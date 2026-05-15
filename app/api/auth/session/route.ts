import { NextRequest, NextResponse } from "next/server.js";
import { getOrCreateCurrentUser } from "../../../../src/auth/current-user.ts";

export async function GET(request: NextRequest) {
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
