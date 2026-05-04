import type { NextRequest } from "next/server";
import { sessionStore } from "./local-auth.ts";
import { readSessionToken } from "./session-cookie.ts";
import type { SessionLookupResult } from "./session-store.ts";

export function getCurrentUser(request: NextRequest): SessionLookupResult | undefined {
  const token = readSessionToken(request.headers.get("cookie"));
  return sessionStore.lookupSession(token);
}

