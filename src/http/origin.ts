import type { NextRequest } from "next/server.js";

export function getPublicOrigin(request: NextRequest): string {
  const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = firstForwardedValue(request.headers.get("x-forwarded-proto"));

  if (forwardedHost && forwardedProto && isAllowedForwardedOrigin(forwardedProto, forwardedHost)) {
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

function isAllowedForwardedOrigin(proto: string, host: string): boolean {
  const origin = `${proto}://${host}`;
  if (allowedConfiguredOrigins().has(origin)) {
    return true;
  }

  if (proto !== "https") {
    return false;
  }

  return host === "localhost" || host.startsWith("localhost:") || host.endsWith(".ngrok-free.dev");
}

function allowedConfiguredOrigins(): Set<string> {
  return new Set(
    (process.env.GOGGLER_ALLOWED_PUBLIC_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}
