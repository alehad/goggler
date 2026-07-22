import { NextRequest, NextResponse } from "next/server.js";
import { validateSameOriginRequest } from "../../../../../src/auth/csrf.ts";
import { getOrCreateCurrentUser } from "../../../../../src/auth/current-user.ts";
import { parseMatchingPreferences } from "../../../../../src/ebay/matching-preferences.ts";
import {
  listMatchedSalesSummaries,
  type MatchedSalesGroupKey
} from "../../../../../src/market-insights/price-history.ts";

const MAX_GROUPS = 500;

export async function POST(request: NextRequest) {
  const csrf = validateSameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const currentUser = getOrCreateCurrentUser(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withInternalSessionCookie(
      NextResponse.json({ error: "invalid_json_body" }, { status: 400 }),
      currentUser.setCookie
    );
  }

  const groups = parseGroups(body);
  if (!groups) {
    return withInternalSessionCookie(
      NextResponse.json({ error: "groups_required" }, { status: 400 }),
      currentUser.setCookie
    );
  }

  const matchingPreferences = parseMatchingPreferences(parseMatchingPreferencesInput(body));

  try {
    const summaries = await listMatchedSalesSummaries(currentUser.context.user.id, groups, matchingPreferences);
    return withInternalSessionCookie(NextResponse.json({ summaries }), currentUser.setCookie);
  } catch {
    console.warn("Market insights matched-sales summary lookup failed", { type: "unexpected_error" });
    return withInternalSessionCookie(
      NextResponse.json({ error: "matched_sales_summary_unavailable" }, { status: 502 }),
      currentUser.setCookie
    );
  }
}

function parseMatchingPreferencesInput(body: unknown): { exactTitleMatch?: string | boolean | null; criteriaText?: string | null } {
  if (typeof body !== "object" || body === null || !("matchingPreferences" in body)) {
    return {};
  }

  const matchingPreferences = (body as { matchingPreferences?: unknown }).matchingPreferences;
  if (typeof matchingPreferences !== "object" || matchingPreferences === null) {
    return {};
  }

  const { exactTitleMatch, criteriaText } = matchingPreferences as {
    exactTitleMatch?: unknown;
    criteriaText?: unknown;
  };

  return {
    exactTitleMatch: typeof exactTitleMatch === "boolean" || typeof exactTitleMatch === "string" ? exactTitleMatch : undefined,
    criteriaText: typeof criteriaText === "string" ? criteriaText : undefined
  };
}

function parseGroups(body: unknown): MatchedSalesGroupKey[] | undefined {
  if (typeof body !== "object" || body === null || !("groups" in body)) {
    return undefined;
  }

  const groups = (body as { groups?: unknown }).groups;
  if (!Array.isArray(groups) || groups.length === 0 || groups.length > MAX_GROUPS) {
    return undefined;
  }

  const parsed: MatchedSalesGroupKey[] = [];
  for (const group of groups) {
    if (
      typeof group !== "object" ||
      group === null ||
      typeof (group as { relistingGroupId?: unknown }).relistingGroupId !== "string" ||
      typeof (group as { currency?: unknown }).currency !== "string"
    ) {
      return undefined;
    }
    parsed.push({
      relistingGroupId: (group as { relistingGroupId: string }).relistingGroupId,
      currency: (group as { currency: string }).currency
    });
  }

  return parsed;
}

function withInternalSessionCookie(response: NextResponse, setCookie: string | undefined): NextResponse {
  if (setCookie) {
    response.headers.set("Set-Cookie", setCookie);
  }
  return response;
}
