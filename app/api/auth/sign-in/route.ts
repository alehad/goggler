import { NextResponse } from "next/server";
import { createSessionCookie } from "../../../../src/auth/session-cookie";
import { getDefaultLocalUser, sessionStore } from "../../../../src/auth/local-auth";

export async function POST() {
  const user = getDefaultLocalUser();
  const { token, session } = sessionStore.createSession(user.id);

  const response = NextResponse.json({
    user: {
      id: user.id,
      displayName: user.displayName
    }
  });

  response.headers.set("Set-Cookie", createSessionCookie(token, session.expiresAt));
  return response;
}

