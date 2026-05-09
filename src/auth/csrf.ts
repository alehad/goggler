import type { NextRequest } from "next/server.js";
import { getAllowedRequestOrigins } from "../http/origin.ts";

export type CsrfValidation = { ok: true } | { ok: false; error: "invalid_origin" };

export function validateSameOriginRequest(request: NextRequest): CsrfValidation {
  const origin = request.headers.get("origin");

  if (origin) {
    return expectedOrigins(request).has(origin) ? { ok: true } : { ok: false, error: "invalid_origin" };
  }

  const referer = request.headers.get("referer");
  if (!referer) {
    return { ok: false, error: "invalid_origin" };
  }

  try {
    return expectedOrigins(request).has(new URL(referer).origin) ? { ok: true } : { ok: false, error: "invalid_origin" };
  } catch {
    return { ok: false, error: "invalid_origin" };
  }
}

function expectedOrigins(request: NextRequest): Set<string> {
  return getAllowedRequestOrigins(request);
}
