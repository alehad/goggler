import { NextRequest, NextResponse } from "next/server.js";
import { validateSameOriginRequest } from "../../../../../src/auth/csrf.ts";
import { getCurrentUser } from "../../../../../src/auth/current-user.ts";
import { sessionStore } from "../../../../../src/auth/local-auth.ts";

export async function POST(request: NextRequest) {
  const csrf = validateSameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const currentUser = getCurrentUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: "local_auth_required" }, { status: 401 });
  }

  sessionStore.clearEbayAuthorization(currentUser.session.id);
  return NextResponse.json({ disconnected: true });
}
