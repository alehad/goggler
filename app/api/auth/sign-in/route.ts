import { NextRequest, NextResponse } from "next/server.js";
import { validateSameOriginRequest } from "../../../../src/auth/csrf.ts";
import { createSessionCookie } from "../../../../src/auth/session-cookie.ts";
import { getDefaultLocalUser, sessionStore } from "../../../../src/auth/local-auth.ts";

export async function POST(request: NextRequest) {
  const csrf = validateSameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const user = getDefaultLocalUser();
  const { token, session } = sessionStore.createSession(user.id);

  const response = NextResponse.json({
    user: {
      id: user.id,
      displayName: user.displayName
    }
  });

  response.headers.set("Set-Cookie", createSessionCookie(token, session.expiresAt, { secure: isSecureRequest(request) }));
  return response;
}

function isSecureRequest(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:";
}
