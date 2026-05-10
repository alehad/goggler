import { NextRequest, NextResponse } from "next/server.js";
import { getCurrentUser } from "../../../../../src/auth/current-user.ts";
import { sessionStore } from "../../../../../src/auth/local-auth.ts";
import { buildEbayConsentUrl, loadEbayConfig } from "../../../../../src/ebay/config.ts";
import { getEbayOAuthStateStore } from "../../../../../src/ebay/oauth-state.ts";

export async function HEAD(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) {
    return new NextResponse(null, { status: 401 });
  }

  try {
    loadEbayConfig();
  } catch {
    return new NextResponse(null, { status: 503 });
  }

  return new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: "local_auth_required" }, { status: 401 });
  }

  let consentUrl: URL;
  try {
    const config = loadEbayConfig();
    const { payload, state } = getEbayOAuthStateStore().createWithPayload({
      userId: currentUser.user.id,
      sessionId: currentUser.session.id
    });
    sessionStore.addPendingEbayOAuthState(currentUser.session.id, payload.id, new Date(payload.expiresAt));
    consentUrl = buildEbayConsentUrl(config, state);
  } catch (error) {
    return NextResponse.json({ error: "ebay_config_error" }, { status: 500 });
  }

  return NextResponse.redirect(consentUrl);
}
