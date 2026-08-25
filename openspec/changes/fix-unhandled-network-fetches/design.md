# Design: Fix remaining unhandled network-level fetch failures in app/page.tsx

## The fix

### `refreshEbayConfigStatus` / `refreshEbaySessionState` (background polling, no user-facing loading state)

```tsx
async function refreshEbayConfigStatus() {
  try {
    const response = await fetch("/api/auth/ebay/config-status");
    setEbayConfigStatus(response.ok ? ((await response.json()) as EbayConfigStatus) : null);
  } catch {
    setEbayConfigStatus(null);
  }
}

async function refreshEbaySessionState() {
  await refreshEbayConfigStatus();
  try {
    const ebayResponse = await fetch("/api/auth/ebay/session");
    setEbaySession(ebayResponse.ok ? ((await ebayResponse.json()) as EbaySession) : null);
  } catch {
    setEbaySession(null);
  }
}
```

These two are called from `useEffect` on mount and after `disconnectEbay`, not from a control with its own loading indicator — there's nothing to "unstick." Treating a network failure the same as a non-`ok` response (fall back to `null`) is the minimal, already-established behavior for "we don't know the eBay state right now."

### `disconnectEbay` (user-facing action, has `accountMessage`)

```tsx
async function disconnectEbay() {
  setAccountMessage("");
  let response: Response;
  try {
    response = await fetch("/api/auth/ebay/disconnect", { method: "POST" });
  } catch {
    setAccountMessage("Could not disconnect eBay: network error");
    return;
  }

  if (!response.ok) {
    setAccountMessage("Could not disconnect eBay");
    return;
  }

  setHistoryState({ status: "idle" });
  await refreshEbaySessionState();
}
```

Mirrors `deleteHistoryItems`'s existing `": network error"` suffix convention for this exact fetch-reject case.

### `executeHomeSearch` (user-facing search submit, has `homeSearchState`)

```tsx
async function executeHomeSearch(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const query = searchDraft.trim();
  setHomeSearchQuery(query);
  if (query) {
    setActiveTab("dashboard");
    setHomeSearchState({ status: "loading", query });

    let response: Response;
    try {
      response = await fetch("/api/ebay/search", {
        body: JSON.stringify({
          query,
          exactTitleMatch: matchingPreferences.exactTitleMatch,
          criteriaText: matchingPreferences.criteriaText
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
    } catch {
      setHomeSearchState({
        status: "unavailable",
        query,
        message: "Could not reach the server. Check your connection and try again."
      });
      return;
    }

    const body = await response.json().catch(() => ({}));
    // ...unchanged from here (response.ok / non-ok branches)
  } else {
    setHomeSearchState({ status: "idle" });
  }
}
```

`HomeSearchState`'s `"unavailable"` variant has no slot for a stale-but-valid previous result (unlike `BuyingHistoryState`, it doesn't carry `rows` alongside an error), so there's no previous-state fallback available here — same "show a message, let the user retry" treatment the function already gives a non-`ok` response.

### `captureVenueItems` (user-facing capture action, has `message`)

```tsx
async function captureVenueItems(itemsToCapture: AnalyticsItem[]) {
  setMessage("");
  let response: Response;
  try {
    response = await fetch("/api/market-insights/capture", {
      body: JSON.stringify({ items: itemsToCapture.map(toCaptureRequestItem) }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
  } catch {
    setMessage("Could not capture price history for this item: network error");
    return;
  }

  if (!response.ok) {
    setMessage("Could not capture price history for this item");
    return;
  }

  // ...unchanged from here
}
```

Same `": network error"` suffix convention. `captureOne`/`captureAllVisible` already wrap their call to this function in `try`/`finally` purely to clear `pendingItemIds`/`bulkCapturing` — since `captureVenueItems` will no longer throw at all (network failure is now caught internally, same as every other branch), those `finally` blocks keep working exactly as before with no changes needed.

## Why one change for all five

Unlike the original change (scoped to the one function that was actually reported broken), these five were already identified as a known, deferred set in [[fix-refresh-feed-network-error]]'s tasks.md — fixing them together avoids five near-identical single-line-diff PRs for the same bug class.

## Testing

Same category as the original: UI error-handling triggered by a network condition, no clean unit-test seam in this file. Verified manually per function by stopping the dev server (or otherwise forcing `fetch` to reject) and exercising each control directly:

- Reload the app (mount effects) → confirm `refreshEbayConfigStatus`/`refreshEbaySessionState` no longer produce an unhandled rejection in the console, and the account control renders its disconnected state instead of stale data.
- Click "Disconnect" while connected → confirm `accountMessage` shows the network-error message instead of nothing happening.
- Submit the top search box → confirm the search results area shows the "could not reach the server" message instead of hanging on a spinner.
- Trigger an individual and a bulk capture → confirm the Analytics `message` banner shows the network-error text and the pending/bulk-capturing indicator clears instead of getting stuck.

Then restart the server and re-verify the normal (non-network-failure) paths for all five are unchanged.
