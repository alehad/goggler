import { NextRequest, NextResponse } from "next/server.js";
import { getCurrentUser } from "../../../../../src/auth/current-user.ts";
import { sessionStore } from "../../../../../src/auth/local-auth.ts";

export async function GET(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: "local_auth_required" }, { status: 401 });
  }

  const status = sessionStore.getEbayConnectionStatus(currentUser.session.id);
  return NextResponse.json({
    connection: {
      connected: status.connected,
      status: status.status,
      authorizedAt: status.authorizedAt?.toISOString(),
      expiresAt: status.expiresAt?.toISOString(),
      scopes: status.scopes
    }
  });
}
