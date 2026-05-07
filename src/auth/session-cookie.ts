import { SESSION_COOKIE_NAME } from "./session-store.ts";

const MAX_AGE_ZERO = "Max-Age=0";

export function createSessionCookie(token: string, expiresAt: Date, options: { secure?: boolean } = {}): string {
  return compactCookieParts([
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    options.secure === false ? undefined : "Secure",
    `Expires=${expiresAt.toUTCString()}`
  ]);
}

export function clearSessionCookie(options: { secure?: boolean } = {}): string {
  return compactCookieParts([
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    options.secure === false ? undefined : "Secure",
    MAX_AGE_ZERO
  ]);
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

function compactCookieParts(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join("; ");
}
