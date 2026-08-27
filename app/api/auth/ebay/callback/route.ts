import { NextRequest, NextResponse } from "next/server.js";
import { getCurrentUser } from "../../../../../src/auth/current-user.ts";
import { sessionStore } from "../../../../../src/auth/local-auth.ts";
import { loadEbayConfig } from "../../../../../src/ebay/config.ts";
import { fetchEbayAccountIdentity } from "../../../../../src/ebay/identity-client.ts";
import { exchangeEbayAuthorizationCode } from "../../../../../src/ebay/oauth-client.ts";
import { getEbayOAuthStateStore, peekRedirectTarget } from "../../../../../src/ebay/oauth-state.ts";
import { getPrimaryPublicOrigin } from "../../../../../src/http/origin.ts";

const NATIVE_CALLBACK_URL = "goggler://oauth-complete";

export async function GET(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? undefined;

  const providerError = url.searchParams.get("error");
  if (providerError) {
    return redirectToAccount(request, `ebay_${providerError}`, peekRedirectTarget(state) === "native");
  }

  const code = url.searchParams.get("code");
  if (!code) {
    if (peekRedirectTarget(state) === "native") {
      return redirectToAccount(request, "ebay_missing_authorization_code", true);
    }
    return NextResponse.json({ error: "missing_authorization_code" }, { status: 400 });
  }

  const stateStore = getEbayOAuthStateStore();
  const stateValidation = currentUser
    ? stateStore.validate(state, {
        userId: currentUser.user.id,
        sessionId: currentUser.session.id
      })
    : stateStore.validateSignedState(state);
  if (!stateValidation.ok) {
    if (peekRedirectTarget(state) === "native") {
      return redirectToAccount(request, "ebay_invalid_oauth_state", true);
    }
    return NextResponse.json({ error: "invalid_oauth_state", reason: stateValidation.reason }, { status: 400 });
  }

  const isNative = stateValidation.payload.redirectTarget === "native";
  const sessionContext = currentUser ?? sessionStore.lookupSessionById(stateValidation.payload.sessionId);
  if (!sessionContext || sessionContext.user.id !== stateValidation.payload.userId) {
    if (isNative) {
      return redirectToAccount(request, "ebay_local_auth_required", true);
    }
    return NextResponse.json({ error: "local_auth_required" }, { status: 401 });
  }

  const consumed = sessionStore.consumePendingEbayOAuthState(sessionContext.session.id, stateValidation.payload.id);
  if (!consumed) {
    if (isNative) {
      return redirectToAccount(request, "ebay_invalid_oauth_state", true);
    }
    return NextResponse.json({ error: "invalid_oauth_state", reason: "replayed" }, { status: 400 });
  }

  try {
    const config = loadEbayConfig();
    const authorization = await exchangeEbayAuthorizationCode(config, code);
    authorization.identity = await fetchEbayAccountIdentity(config, authorization.accessToken).catch(() => undefined);
    sessionStore.setEbayAuthorization(sessionContext.session.id, authorization);
  } catch {
    if (isNative) {
      return redirectToAccount(request, "ebay_token_exchange_failed", true);
    }
    return NextResponse.json({ error: "ebay_token_exchange_failed" }, { status: 502 });
  }

  // The native app's own URLSession never saw this session — ASWebAuthenticationSession
  // runs an isolated browser context that doesn't share cookies with the app. On success,
  // mint a fresh token for the session the authorization actually landed on and hand it
  // back via the custom-scheme redirect so the app can adopt it. See
  // openspec/changes/macos-ebay-oauth/design.md.
  const sessionToken = isNative ? sessionStore.reissueToken(sessionContext.session.id) : undefined;
  return redirectToAccount(request, "ebay_connected", isNative, sessionToken);
}

function redirectToAccount(request: NextRequest, status: string, isNative: boolean, sessionToken?: string): NextResponse {
  if (isNative) {
    const nativeUrl = new URL(NATIVE_CALLBACK_URL);
    nativeUrl.searchParams.set("account", status);
    if (sessionToken) {
      nativeUrl.searchParams.set("sessionToken", sessionToken);
    }
    return NextResponse.redirect(nativeUrl);
  }

  return NextResponse.redirect(new URL(`/?account=${encodeURIComponent(status)}`, getPrimaryPublicOrigin(request)));
}
