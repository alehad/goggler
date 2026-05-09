import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server.js";
import { getAllowedRequestOrigins, getPublicOrigin } from "../../src/http/origin.ts";

test("uses the request origin when no forwarded origin is present", () => {
  const request = new NextRequest("http://localhost:3000/api/auth/ebay/callback");

  assert.equal(getPublicOrigin(request), "http://localhost:3000");
  assert.deepEqual([...getAllowedRequestOrigins(request)], ["http://localhost:3000"]);
});

test("uses forwarded proto and host as the public origin", () => {
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
});
