import { NextRequest, NextResponse } from "next/server.js";
import { validateSameOriginRequest } from "../../../../src/auth/csrf.ts";
import { clearSessionCookie, readSessionToken } from "../../../../src/auth/session-cookie.ts";
import { sessionStore } from "../../../../src/auth/local-auth.ts";

export async function POST(request: NextRequest) {
  const csrf = validateSameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const token = readSessionToken(request.headers.get("cookie"));
  sessionStore.expireSession(token);

  const response = NextResponse.json({ signedOut: true });
  response.headers.set("Set-Cookie", clearSessionCookie({ secure: isSecureRequest(request) }));
  return response;
}

function isSecureRequest(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:";
}
