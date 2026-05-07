import { NextRequest, NextResponse } from "next/server.js";
import { getCurrentUser } from "../../../../src/auth/current-user.ts";

export async function GET(request: NextRequest) {
  const result = getCurrentUser(request);

  if (!result) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: result.user.id,
      displayName: result.user.displayName
    }
  });
}
