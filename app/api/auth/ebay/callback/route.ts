import { NextRequest, NextResponse } from "next/server.js";
import { getCurrentUser } from "../../../../../src/auth/current-user.ts";
import { sessionStore } from "../../../../../src/auth/local-auth.ts";
import { loadEbayConfig } from "../../../../../src/ebay/config.ts";
import { fetchEbayAccountIdentity } from "../../../../../src/ebay/identity-client.ts";
import { exchangeEbayAuthorizationCode } from "../../../../../src/ebay/oauth-client.ts";
import { getEbayOAuthStateStore } from "../../../../../src/ebay/oauth-state.ts";
import { getPublicOrigin } from "../../../../../src/http/origin.ts";

export async function GET(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  const url = new URL(request.url);
  const providerError = url.searchParams.get("error");
  if (providerError) {
    return redirectToAccount(request, `ebay_${providerError}`);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "missing_authorization_code" }, { status: 400 });
  }

  const state = url.searchParams.get("state") ?? undefined;
  const stateStore = getEbayOAuthStateStore();
  const stateValidation = currentUser
    ? stateStore.validate(state, {
        userId: currentUser.user.id,
        sessionId: currentUser.session.id
      })
    : stateStore.validateSignedState(state);
  if (!stateValidation.ok) {
    return NextResponse.json({ error: "invalid_oauth_state", reason: stateValidation.reason }, { status: 400 });
  }

  const sessionContext = currentUser ?? sessionStore.lookupSessionById(stateValidation.payload.sessionId);
  if (!sessionContext || sessionContext.user.id !== stateValidation.payload.userId) {
    return NextResponse.json({ error: "local_auth_required" }, { status: 401 });
  }

  const consumed = sessionStore.consumePendingEbayOAuthState(sessionContext.session.id, stateValidation.payload.id);
  if (!consumed) {
    return NextResponse.json({ error: "invalid_oauth_state", reason: "replayed" }, { status: 400 });
  }

  try {
    const config = loadEbayConfig();
    const authorization = await exchangeEbayAuthorizationCode(config, code);
    authorization.identity = await fetchEbayAccountIdentity(config, authorization.accessToken).catch(() => undefined);
    sessionStore.setEbayAuthorization(sessionContext.session.id, authorization);
  } catch {
    return NextResponse.json({ error: "ebay_token_exchange_failed" }, { status: 502 });
  }

  return redirectToAccount(request, "ebay_connected");
}

function redirectToAccount(request: NextRequest, status: string): NextResponse {
  return NextResponse.redirect(new URL(`/?account=${encodeURIComponent(status)}`, getPublicOrigin(request)));
}
