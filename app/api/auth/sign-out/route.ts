import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, readSessionToken } from "../../../../src/auth/session-cookie";
import { sessionStore } from "../../../../src/auth/local-auth";

export async function POST(request: NextRequest) {
  const token = readSessionToken(request.headers.get("cookie"));
  sessionStore.expireSession(token);

  const response = NextResponse.json({ signedOut: true });
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}

