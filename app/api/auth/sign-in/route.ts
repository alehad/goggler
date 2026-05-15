import { NextRequest, NextResponse } from "next/server.js";
import { validateSameOriginRequest } from "../../../../src/auth/csrf.ts";
import { getOrCreateCurrentUser } from "../../../../src/auth/current-user.ts";

export async function POST(request: NextRequest) {
  const csrf = validateSameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const currentUser = getOrCreateCurrentUser(request);

  const response = NextResponse.json({
    user: {
      id: currentUser.context.user.id,
      displayName: currentUser.context.user.displayName
    }
  });

  if (currentUser.setCookie) {
    response.headers.set("Set-Cookie", currentUser.setCookie);
  }

  return response;
}
