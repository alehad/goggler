# Design: Server-side matching preferences

## Prisma schema

New model, following the existing `userId`-as-plain-string convention (`WonItem`, `LostItem`, `MarketPriceRecord` all key this way — there's no real multi-user `User` table, just the fixed `local-saja` id from `src/auth/local-auth.ts`). One row per user, so `userId` is the primary key directly rather than a surrogate uuid — this is a genuine singleton-per-user table, unlike the list-shaped models above it:

```prisma
model MatchingPreferences {
  userId          String   @id
  exactTitleMatch Boolean  @default(true)
  criteriaText    String
  updatedAt       DateTime @updatedAt
}
```

Migration follows the same hand-authored path the soft-delete (`deletedAt`) change already established, for the same reason: local Postgres's `default_transaction_read_only` guard and Neon's blocked raw TCP both block `prisma migrate dev` directly.

## `src/persistence/matching-preferences.ts` (new)

```typescript
import { DEFAULT_MATCHING_PREFERENCES, parseMatchingPreferences, type MatchingPreferences } from "../ebay/matching-preferences.ts";
import type { PrismaClient } from "../generated/prisma/client.ts";
import { getPrismaClient } from "./prisma.ts";

/**
 * Never writes — a user who has never saved preferences gets the same
 * default every route already fell back to before this change existed.
 */
export async function getMatchingPreferencesForUser(
  userId: string,
  prisma: PrismaClient | undefined = getPrismaClient()
): Promise<MatchingPreferences> {
  if (!prisma) {
    return DEFAULT_MATCHING_PREFERENCES;
  }
  const record = await prisma.matchingPreferences.findUnique({ where: { userId } });
  if (!record) {
    return DEFAULT_MATCHING_PREFERENCES;
  }
  return parseMatchingPreferences(record);
}

/**
 * Validates/bounds via the existing parseMatchingPreferences (same
 * length/count caps already applied to every client-supplied value today)
 * before persisting, so a malformed or oversized value can never reach the
 * database — and returns that bounded value, so the caller (the new route)
 * always echoes the real effective value, not a raw pass-through of the
 * request body.
 */
export async function setMatchingPreferencesForUser(
  userId: string,
  input: { exactTitleMatch?: string | boolean | null; criteriaText?: string | null },
  prisma: PrismaClient | undefined = getPrismaClient()
): Promise<MatchingPreferences> {
  const preferences = parseMatchingPreferences(input);
  if (!prisma) {
    return preferences;
  }
  await prisma.matchingPreferences.upsert({
    where: { userId },
    create: { userId, ...preferences },
    update: preferences
  });
  return preferences;
}
```

## `GET`/`PUT /api/matching-preferences` (new route)

```typescript
export async function GET(request: NextRequest) {
  const currentUser = getOrCreateCurrentUser(request);
  const preferences = await getMatchingPreferencesForUser(currentUser.context.user.id);
  return withInternalSessionCookie(NextResponse.json(preferences), currentUser.setCookie);
}

export async function PUT(request: NextRequest) {
  const csrf = validateSameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const currentUser = getOrCreateCurrentUser(request);
  const body = (await request.json().catch(() => ({}))) as Partial<{ exactTitleMatch: boolean; criteriaText: string }>;
  const preferences = await setMatchingPreferencesForUser(currentUser.context.user.id, body);
  return withInternalSessionCookie(NextResponse.json(preferences), currentUser.setCookie);
}
```

## Every business route: stop accepting, start loading

Representative before/after — `app/api/market-insights/matched-sales/route.ts`:

```diff
- const matchingPreferences = parseMatchingPreferences({
-   exactTitleMatch: searchParams.get("exactTitleMatch") ?? undefined,
-   criteriaText: searchParams.get("criteriaText") ?? undefined
- });
+ const matchingPreferences = await getMatchingPreferencesForUser(currentUser.context.user.id);
```

The same substitution (delete the client-input parsing block, call `getMatchingPreferencesForUser(currentUser.context.user.id)` instead) applies to all nine routes listed in the proposal. Two have no other use for their parsed body beyond matching preferences (`buying-history` GET, `matched-sales`, `matched-sales/summary`) and get simpler; the rest (`capture`, `watchlist-automation`, `ebay/search`, `buying-history` POST, `buying-history/stream`) keep parsing their other body fields (`items`, `criteriaText`-adjacent lookup helpers aside) unchanged — only the matching-preferences-specific parsing is removed.

## Web app (`app/page.tsx`)

- Delete the `MATCHING_PREFERENCES_STORAGE_KEY` constant and both `localStorage` effects (read-on-mount, write-on-change).
- Delete the top-level `matchingPreferences`/`setMatchingPreferences` state and every place it's threaded into a fetch body/query elsewhere in the file (chat, capture, buying-history refresh, matched-sales, matched-sales/summary, watchlist-automation) — none of those routes read it anymore, so passing it is dead code.
- The `Account` component (where the form already lives) gets its own local state instead, loaded via `GET` on mount and written via `PUT` on an explicit "Save" button — not per-keystroke, avoiding a request per character typed in the criteria textarea:

```typescript
function Account({ ebayConfig, ebayConnection }: { ... }) {
  const [matchingPreferences, setMatchingPreferences] = useState<MatchingPreferences | undefined>();
  const [draft, setDraft] = useState<MatchingPreferences | undefined>();
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/matching-preferences", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((preferences: MatchingPreferences) => {
        setMatchingPreferences(preferences);
        setDraft(preferences);
      })
      .catch(() => setMessage("Could not load matching preferences"));
  }, []);

  async function save() {
    if (!draft) return;
    const response = await fetch("/api/matching-preferences", {
      body: JSON.stringify(draft),
      headers: { "Content-Type": "application/json" },
      method: "PUT"
    });
    if (!response.ok) {
      setMessage("Could not save matching preferences");
      return;
    }
    const saved: MatchingPreferences = await response.json();
    setMatchingPreferences(saved);
    setDraft(saved);
    setMessage("Matching preferences saved");
  }
  // ...form binds to `draft`, Save button calls save(), disabled when draft deep-equals matchingPreferences
}
```

## macOS app

- Delete `DefaultMatchingPreferences.swift` entirely.
- `AnalyticsView.askAssistant()`: delete the `var body = DefaultMatchingPreferences.requestBody` line — the chat route no longer reads these fields, so the POST body only needs `question`.
- `AnalyticsChart`'s matched-sales fetch (`AnalyticsView.loadMatchedSales()`): delete the `exactTitleMatch`/`criteriaText` query items — the route ignores them now.
- New `MatchingPreferences: Codable, Sendable` in `GogglerModels.swift` (`Codable`, not just `Decodable` — this is the first macOS model that needs to be *sent*, not just received):

```swift
struct MatchingPreferences: Codable, Sendable {
    var exactTitleMatch: Bool
    var criteriaText: String
}
```

- `SettingsView.swift` gains a second `Section("Matching preferences")`, loaded on sheet appear and saved via an explicit Save button — same shape as web's fix, so both clients present the *same interaction model* for the first genuinely shared setting:

```swift
@State private var matchingPreferences: MatchingPreferences?
@State private var draft: MatchingPreferences?
@State private var statusMessage: String?

Section("Matching preferences") {
    if let draft {
        Toggle("Exact title match", isOn: Binding(
            get: { draft.exactTitleMatch },
            set: { self.draft?.exactTitleMatch = $0 }
        ))
        TextField("Criteria", text: Binding(
            get: { draft.criteriaText },
            set: { self.draft?.criteriaText = $0 }
        ), axis: .vertical)
            .lineLimit(3...6)
        Button("Save") { Task { await save() } }
            .disabled(draft == matchingPreferences)
    } else {
        ProgressView()
    }
}
.task {
    guard let client = appSettings.apiClient else { return }
    if let (preferences, _) = try? await client.requestDecoded("/api/matching-preferences", as: MatchingPreferences.self) {
        matchingPreferences = preferences
        draft = preferences
    }
}
```

`MatchingPreferences` needs `Equatable` (for the `draft == matchingPreferences` disabled-state check) alongside `Codable, Sendable`.

`save()` POSTs via `client.request("/api/matching-preferences", method: "PUT", jsonBody: [...])` — `jsonBody` is typed `[String: Sendable]`, so `draft` is unpacked into a dictionary literal rather than passed as the struct directly (matching how every other macOS POST call already builds its body).

## Testing

- New `test/persistence/matching-preferences.integration.mjs`: `getMatchingPreferencesForUser` returns the default when no row exists, returns the saved row when one does; `setMatchingPreferencesForUser` upserts, validates/bounds (reuses existing `parseMatchingPreferences` cap tests' fixtures), and a second save overwrites rather than erroring.
- New route tests for `GET`/`PUT /api/matching-preferences` in `test/ebay/routes.test.mjs` (same file every other route test already lives in): unauthenticated GET still returns the default (session is auto-created), PUT persists and a subsequent GET reflects it, PUT rejects a cross-origin request (CSRF), PUT with an oversized criteria string gets bounded rather than rejected (matching existing `parseMatchingPreferences` behavior).
- **Existing tests that currently pass `exactTitleMatch`/`criteriaText` in a request body/query to one of the nine routes** (`test/ebay/routes.test.mjs`, a handful of call sites) need updating: seed the persisted value first (via the persistence module directly, or a `PUT` call) instead of passing it per-request, since the route no longer reads the latter.
- New `GogglerModels`/`GogglerAPIClient` round-trip test on the macOS side (encode `MatchingPreferences`, decode it back) and a `SettingsView` manual check (not unit-testable — it's a live network fetch on `.task`, same category this app already accepts for other settings/auth flows).
- Manual functional testing pause: change a preference in the web `Account` tab, confirm a macOS matched-sales/chat/home-feed call for the same item reflects it without any macOS-side change; then change it from macOS's new settings section and confirm web reflects it the same way. This bidirectional check is the actual proof the fix works, not just that each client's own round-trip works.
