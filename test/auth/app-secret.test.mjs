import assert from "node:assert/strict";
import { test } from "node:test";
import { loadRequiredAppSecret } from "../../src/auth/app-secret.ts";

test("loads a strong app secret", () => {
  assert.equal(
    loadRequiredAppSecret({
      GOGGLER_AUTH_SECRET: "test-secret-with-at-least-32-characters"
    }),
    "test-secret-with-at-least-32-characters"
  );
});

test("rejects missing or weak app secrets", () => {
  assert.throws(() => loadRequiredAppSecret({}), /GOGGLER_AUTH_SECRET is required/);
  assert.throws(() => loadRequiredAppSecret({ GOGGLER_AUTH_SECRET: "short" }), /at least 32 characters/);
});
