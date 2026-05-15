import { NextRequest, NextResponse } from "next/server.js";
import { getOrCreateCurrentUser } from "../../../../../src/auth/current-user.ts";
import { sessionStore } from "../../../../../src/auth/local-auth.ts";

export async function GET(request: NextRequest) {
  const currentUser = getOrCreateCurrentUser(request);

  const status = sessionStore.getEbayConnectionStatus(currentUser.context.session.id);
  const response = NextResponse.json({
    connection: {
      connected: status.connected,
      status: status.status,
      authorizedAt: status.authorizedAt?.toISOString(),
      expiresAt: status.expiresAt?.toISOString(),
      scopes: status.scopes,
      identity: status.identity
    }
  });

  if (currentUser.setCookie) {
    response.headers.set("Set-Cookie", currentUser.setCookie);
  }

  return response;
}
