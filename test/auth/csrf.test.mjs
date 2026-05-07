import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server.js";
import { validateSameOriginRequest } from "../../src/auth/csrf.ts";

test("accepts same-origin requests", () => {
  const request = new NextRequest("http://localhost:3000/api/auth/sign-out", {
    headers: { origin: "http://localhost:3000" }
  });

  assert.deepEqual(validateSameOriginRequest(request), { ok: true });
});

test("rejects cross-origin and missing-origin requests", () => {
  const crossOrigin = new NextRequest("http://localhost:3000/api/auth/sign-out", {
    headers: { origin: "https://example.com" }
  });
  const missingOrigin = new NextRequest("http://localhost:3000/api/auth/sign-out");

  assert.deepEqual(validateSameOriginRequest(crossOrigin), { ok: false, error: "invalid_origin" });
  assert.deepEqual(validateSameOriginRequest(missingOrigin), { ok: false, error: "invalid_origin" });
});
