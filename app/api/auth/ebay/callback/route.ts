import { NextRequest, NextResponse } from "next/server.js";
import { getCurrentUser } from "../../../../../src/auth/current-user.ts";
import { sessionStore } from "../../../../../src/auth/local-auth.ts";
import { loadEbayConfig } from "../../../../../src/ebay/config.ts";
import { exchangeEbayAuthorizationCode } from "../../../../../src/ebay/oauth-client.ts";
import { getEbayOAuthStateStore } from "../../../../../src/ebay/oauth-state.ts";

export async function GET(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: "local_auth_required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const providerError = url.searchParams.get("error");
  if (providerError) {
    return redirectToAccount(request, `ebay_${providerError}`);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "missing_authorization_code" }, { status: 400 });
  }

  const stateValidation = getEbayOAuthStateStore().validate(url.searchParams.get("state") ?? undefined, {
    userId: currentUser.user.id,
    sessionId: currentUser.session.id
  });
  if (!stateValidation.ok) {
    return NextResponse.json({ error: "invalid_oauth_state", reason: stateValidation.reason }, { status: 400 });
  }

  const consumed = sessionStore.consumePendingEbayOAuthState(currentUser.session.id, stateValidation.payload.id);
  if (!consumed) {
    return NextResponse.json({ error: "invalid_oauth_state", reason: "replayed" }, { status: 400 });
  }

  try {
    const authorization = await exchangeEbayAuthorizationCode(loadEbayConfig(), code);
    sessionStore.setEbayAuthorization(currentUser.session.id, authorization);
  } catch (error) {
    return NextResponse.json({ error: "ebay_token_exchange_failed", message: getPublicErrorMessage(error) }, { status: 502 });
  }

  return redirectToAccount(request, "ebay_connected");
}

function redirectToAccount(request: NextRequest, status: string): NextResponse {
  return NextResponse.redirect(new URL(`/?account=${encodeURIComponent(status)}`, request.nextUrl.origin));
}

function getPublicErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown eBay OAuth error";
}
