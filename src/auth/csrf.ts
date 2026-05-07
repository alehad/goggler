import type { NextRequest } from "next/server.js";

export type CsrfValidation = { ok: true } | { ok: false; error: "invalid_origin" };

export function validateSameOriginRequest(request: NextRequest): CsrfValidation {
  const expectedOrigin = request.nextUrl.origin;
  const origin = request.headers.get("origin");

  if (origin) {
    return origin === expectedOrigin ? { ok: true } : { ok: false, error: "invalid_origin" };
  }

  const referer = request.headers.get("referer");
  if (!referer) {
    return { ok: false, error: "invalid_origin" };
  }

  try {
    return new URL(referer).origin === expectedOrigin ? { ok: true } : { ok: false, error: "invalid_origin" };
  } catch {
    return { ok: false, error: "invalid_origin" };
  }
}
