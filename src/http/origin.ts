import type { NextRequest } from "next/server.js";

export function getPublicOrigin(request: NextRequest): string {
  const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = firstForwardedValue(request.headers.get("x-forwarded-proto"));

  if (forwardedHost && forwardedProto) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

export function getAllowedRequestOrigins(request: NextRequest): Set<string> {
  return new Set([request.nextUrl.origin, getPublicOrigin(request)]);
}

function firstForwardedValue(value: string | null): string | undefined {
  return value?.split(",")[0]?.trim() || undefined;
}
