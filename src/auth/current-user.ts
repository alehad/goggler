import type { NextRequest } from "next/server.js";
import { getDefaultLocalUser, sessionStore } from "./local-auth.ts";
import { createSessionCookie, readSessionToken } from "./session-cookie.ts";
import type { SessionLookupResult } from "./session-store.ts";
import { isSecureRequest } from "../http/origin.ts";

export function getCurrentUser(request: NextRequest): SessionLookupResult | undefined {
  const token = readSessionToken(request.headers.get("cookie"));
  return sessionStore.lookupSession(token);
}

export type CurrentUserResult = {
  context: SessionLookupResult;
  setCookie?: string;
};

export function getOrCreateCurrentUser(request: NextRequest): CurrentUserResult {
  const currentUser = getCurrentUser(request);
  if (currentUser) {
    return { context: currentUser };
  }

  const user = getDefaultLocalUser();
  const { token, session } = sessionStore.createSession(user.id);
  return {
    context: { session, user },
    setCookie: createSessionCookie(token, session.expiresAt, { secure: isSecureRequest(request) })
  };
}
