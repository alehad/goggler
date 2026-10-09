import { NextRequest, NextResponse } from "next/server.js";
import { validateSameOriginRequest } from "../../../src/auth/csrf.ts";
import { getOrCreateCurrentUser } from "../../../src/auth/current-user.ts";
import { getMatchingPreferencesForUser, setMatchingPreferencesForUser } from "../../../src/persistence/matching-preferences.ts";

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
  const body = (await request.json().catch(() => ({}))) as Partial<{
    exactTitleMatch: boolean;
    criteriaText: string;
  }>;

  const preferences = await setMatchingPreferencesForUser(currentUser.context.user.id, {
    exactTitleMatch: body.exactTitleMatch,
    criteriaText: body.criteriaText
  });

  return withInternalSessionCookie(NextResponse.json(preferences), currentUser.setCookie);
}

function withInternalSessionCookie(response: NextResponse, setCookie: string | undefined): NextResponse {
  if (setCookie) {
    response.headers.set("Set-Cookie", setCookie);
  }
  return response;
}
