import type { NextRequest } from "next/server.js";

export function getPublicOrigin(request: NextRequest): string {
  const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = firstForwardedValue(request.headers.get("x-forwarded-proto"));

  if (forwardedHost && forwardedProto && isAllowedForwardedOrigin(forwardedProto, forwardedHost)) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

export function getPrimaryPublicOrigin(request: NextRequest): string {
  const host = trustedTunnelHost();
  if (host) {
    return `https://${host}`;
  }
  return request.nextUrl.origin;
}

export function getAllowedRequestOrigins(request: NextRequest): Set<string> {
  return new Set([request.nextUrl.origin, getPublicOrigin(request)]);
}

export function isSecureRequest(request: NextRequest): boolean {
  return new URL(getPublicOrigin(request)).protocol === "https:";
}

function firstForwardedValue(value: string | null): string | undefined {
  return value?.split(",")[0]?.trim() || undefined;
}

const TUNNEL_TARGETS = ["tailscale", "ngrok"] as const;
type TunnelTarget = (typeof TUNNEL_TARGETS)[number];

const TUNNEL_TARGET_HOSTNAME_ENV_VARS: Record<TunnelTarget, string> = {
  tailscale: "GOGGLER_TAILSCALE_HOSTNAME",
  ngrok: "GOGGLER_NGROK_HOSTNAME"
};

function resolveTunnelTarget(): TunnelTarget {
  const raw = process.env.GOGGLER_TUNNEL_TARGET;
  if (raw === undefined) {
    return "tailscale";
  }
  if ((TUNNEL_TARGETS as readonly string[]).includes(raw)) {
    return raw as TunnelTarget;
  }
  throw new Error(`Invalid GOGGLER_TUNNEL_TARGET "${raw}" — expected one of: ${TUNNEL_TARGETS.join(", ")}`);
}

function trustedTunnelHost(): string | undefined {
  return process.env[TUNNEL_TARGET_HOSTNAME_ENV_VARS[resolveTunnelTarget()]];
}

function isAllowedForwardedOrigin(proto: string, host: string): boolean {
  const origin = `${proto}://${host}`;
  if (allowedConfiguredOrigins().has(origin)) {
    return true;
  }

  if (proto !== "https") {
    return false;
  }

  return host === "localhost" || host.startsWith("localhost:") || host === trustedTunnelHost();
}

function allowedConfiguredOrigins(): Set<string> {
  return new Set(
    (process.env.GOGGLER_ALLOWED_PUBLIC_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}
