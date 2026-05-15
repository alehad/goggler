import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server.js";
import { getAllowedRequestOrigins, getPublicOrigin, isSecureRequest } from "../../src/http/origin.ts";

test("uses the request origin when no forwarded origin is present", () => {
  const request = new NextRequest("http://localhost:3000/api/auth/ebay/callback");

  assert.equal(getPublicOrigin(request), "http://localhost:3000");
  assert.deepEqual([...getAllowedRequestOrigins(request)], ["http://localhost:3000"]);
  assert.equal(isSecureRequest(request), false);
});

test("uses an allowed forwarded proto and host as the public origin", () => {
  const request = new NextRequest("http://localhost:3000/api/auth/ebay/callback", {
    headers: {
      "x-forwarded-host": "example.ngrok-free.dev",
      "x-forwarded-proto": "https"
    }
  });

  assert.equal(getPublicOrigin(request), "https://example.ngrok-free.dev");
  assert.deepEqual([...getAllowedRequestOrigins(request)], [
    "http://localhost:3000",
    "https://example.ngrok-free.dev"
  ]);
  assert.equal(isSecureRequest(request), true);
});

test("ignores untrusted forwarded hosts", () => {
  const request = new NextRequest("http://localhost:3000/api/auth/ebay/callback", {
    headers: {
      "x-forwarded-host": "evil.example.com",
      "x-forwarded-proto": "https"
    }
  });

  assert.equal(getPublicOrigin(request), "http://localhost:3000");
  assert.deepEqual([...getAllowedRequestOrigins(request)], ["http://localhost:3000"]);
});

test("uses explicitly configured forwarded origins", () => {
  const previous = process.env.GOGGLER_ALLOWED_PUBLIC_ORIGINS;
  process.env.GOGGLER_ALLOWED_PUBLIC_ORIGINS = "https://goggler-dev.example.com";

  try {
    const request = new NextRequest("http://localhost:3000/api/auth/ebay/callback", {
      headers: {
        "x-forwarded-host": "goggler-dev.example.com",
        "x-forwarded-proto": "https"
      }
    });

    assert.equal(getPublicOrigin(request), "https://goggler-dev.example.com");
  } finally {
    if (previous === undefined) {
      delete process.env.GOGGLER_ALLOWED_PUBLIC_ORIGINS;
    } else {
      process.env.GOGGLER_ALLOWED_PUBLIC_ORIGINS = previous;
    }
  }
});
