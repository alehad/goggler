import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server.js";
import { getAllowedRequestOrigins, getPublicOrigin, isSecureRequest } from "../../src/http/origin.ts";

const TUNNEL_ENV_KEYS = [
  "GOGGLER_TUNNEL_TARGET",
  "GOGGLER_TAILSCALE_HOSTNAME",
  "GOGGLER_NGROK_HOSTNAME",
  "GOGGLER_ALLOWED_PUBLIC_ORIGINS"
];

function withTunnelEnv(overrides, fn) {
  const originals = Object.fromEntries(TUNNEL_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of TUNNEL_ENV_KEYS) {
    delete process.env[key];
  }
  Object.assign(process.env, overrides);
  try {
    return fn();
  } finally {
    for (const key of TUNNEL_ENV_KEYS) {
      if (originals[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originals[key];
      }
    }
  }
}

function forwardedRequest(host, proto = "https") {
  return new NextRequest("http://localhost:3000/api/auth/ebay/callback", {
    headers: { "x-forwarded-host": host, "x-forwarded-proto": proto }
  });
}

test("uses the request origin when no forwarded origin is present", () => {
  const request = new NextRequest("http://localhost:3000/api/auth/ebay/callback");

  assert.equal(getPublicOrigin(request), "http://localhost:3000");
  assert.deepEqual([...getAllowedRequestOrigins(request)], ["http://localhost:3000"]);
  assert.equal(isSecureRequest(request), false);
});

test("defaults to the tailscale target and trusts its exact configured hostname", () => {
  withTunnelEnv({ GOGGLER_TAILSCALE_HOSTNAME: "goggler.tailde35d2.ts.net" }, () => {
    const request = forwardedRequest("goggler.tailde35d2.ts.net");

    assert.equal(getPublicOrigin(request), "https://goggler.tailde35d2.ts.net");
    assert.deepEqual([...getAllowedRequestOrigins(request)], [
      "http://localhost:3000",
      "https://goggler.tailde35d2.ts.net"
    ]);
    assert.equal(isSecureRequest(request), true);
  });
});

test("rejects a different host under the same shared .ts.net suffix", () => {
  withTunnelEnv({ GOGGLER_TAILSCALE_HOSTNAME: "goggler.tailde35d2.ts.net" }, () => {
    const request = forwardedRequest("someone-elses-tailnet.ts.net");

    assert.equal(getPublicOrigin(request), "http://localhost:3000");
  });
});

test("trusts the ngrok hostname only when explicitly targeted", () => {
  withTunnelEnv(
    { GOGGLER_TUNNEL_TARGET: "ngrok", GOGGLER_NGROK_HOSTNAME: "unrigged-fifth-nastily.ngrok-free.dev" },
    () => {
      const request = forwardedRequest("unrigged-fifth-nastily.ngrok-free.dev");

      assert.equal(getPublicOrigin(request), "https://unrigged-fifth-nastily.ngrok-free.dev");
    }
  );
});

test("does not trust the ngrok hostname when the tailscale target is selected", () => {
  withTunnelEnv(
    {
      GOGGLER_TAILSCALE_HOSTNAME: "goggler.tailde35d2.ts.net",
      GOGGLER_NGROK_HOSTNAME: "unrigged-fifth-nastily.ngrok-free.dev"
    },
    () => {
      const request = forwardedRequest("unrigged-fifth-nastily.ngrok-free.dev");

      assert.equal(getPublicOrigin(request), "http://localhost:3000");
    }
  );
});

test("throws on an unrecognized GOGGLER_TUNNEL_TARGET value", () => {
  withTunnelEnv({ GOGGLER_TUNNEL_TARGET: "some-typo" }, () => {
    const request = forwardedRequest("goggler.tailde35d2.ts.net");

    assert.throws(() => getPublicOrigin(request), /Invalid GOGGLER_TUNNEL_TARGET "some-typo"/);
  });
});

test("ignores untrusted forwarded hosts", () => {
  withTunnelEnv({}, () => {
    const request = forwardedRequest("evil.example.com");

    assert.equal(getPublicOrigin(request), "http://localhost:3000");
    assert.deepEqual([...getAllowedRequestOrigins(request)], ["http://localhost:3000"]);
  });
});

test("uses explicitly configured forwarded origins regardless of tunnel target", () => {
  withTunnelEnv({ GOGGLER_ALLOWED_PUBLIC_ORIGINS: "https://goggler-dev.example.com" }, () => {
    const request = forwardedRequest("goggler-dev.example.com");

    assert.equal(getPublicOrigin(request), "https://goggler-dev.example.com");
  });
});
