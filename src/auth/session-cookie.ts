import { SESSION_COOKIE_NAME } from "./session-store.ts";

const MAX_AGE_ZERO = "Max-Age=0";

export function createSessionCookie(token: string, expiresAt: Date): string {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
    `Expires=${expiresAt.toUTCString()}`
  ].join("; ");
}

export function clearSessionCookie(): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
    MAX_AGE_ZERO
  ].join("; ");
}

export function readSessionToken(cookieHeader: string | null | undefined): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  const cookies = cookieHeader.split(";").map((part) => part.trim());
  const sessionCookie = cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!sessionCookie) {
    return undefined;
  }

  const [, value] = sessionCookie.split("=");
  return value ? decodeURIComponent(value) : undefined;
}
