import { sessionStore } from "../auth/local-auth.ts";

export type EbaySessionAccess =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "reauth_required" };

export function requireSessionEbayAccessToken(sessionId: string): EbaySessionAccess {
  const authorization = sessionStore.getEbayAuthorization(sessionId);
  if (!authorization) {
    return { ok: false, reason: "reauth_required" };
  }

  return { ok: true, accessToken: authorization.accessToken };
}
