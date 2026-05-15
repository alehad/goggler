import { NextRequest, NextResponse } from "next/server.js";
import { getOrCreateCurrentUser } from "../../../../../src/auth/current-user.ts";
import { sessionStore } from "../../../../../src/auth/local-auth.ts";
import { buildEbayConsentUrl, loadEbayConfig } from "../../../../../src/ebay/config.ts";
import { getEbayOAuthStateStore } from "../../../../../src/ebay/oauth-state.ts";

export async function HEAD(request: NextRequest) {
  const currentUser = getOrCreateCurrentUser(request);

  try {
    loadEbayConfig();
  } catch {
    const response = new NextResponse(null, { status: 503 });
    if (currentUser.setCookie) {
      response.headers.set("Set-Cookie", currentUser.setCookie);
    }
    return response;
  }

  const response = new NextResponse(null, { status: 204 });
  if (currentUser.setCookie) {
    response.headers.set("Set-Cookie", currentUser.setCookie);
  }
  return response;
}

export async function GET(request: NextRequest) {
  const currentUser = getOrCreateCurrentUser(request);

  let consentUrl: URL;
  try {
    const config = loadEbayConfig();
    const { payload, state } = getEbayOAuthStateStore().createWithPayload({
      userId: currentUser.context.user.id,
      sessionId: currentUser.context.session.id
    });
    sessionStore.addPendingEbayOAuthState(currentUser.context.session.id, payload.id, new Date(payload.expiresAt));
    consentUrl = buildEbayConsentUrl(config, state);
  } catch (error) {
    const response = NextResponse.json({ error: "ebay_config_error" }, { status: 500 });
    if (currentUser.setCookie) {
      response.headers.set("Set-Cookie", currentUser.setCookie);
    }
    return response;
  }

  const response = NextResponse.redirect(consentUrl);
  if (currentUser.setCookie) {
    response.headers.set("Set-Cookie", currentUser.setCookie);
  }
  return response;
}
