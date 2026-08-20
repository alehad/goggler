import assert from "node:assert/strict";
import { test } from "node:test";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { createAdapter, resolveDatabaseUrl } from "../../src/persistence/prisma.ts";

const DB_TARGET_ENV_KEYS = ["GOGGLER_DB_TARGET", "DATABASE_URL", "NEON_DATABASE_URL"];

function withDbTargetEnv(overrides, fn) {
  const originals = Object.fromEntries(DB_TARGET_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of DB_TARGET_ENV_KEYS) {
    delete process.env[key];
  }
  Object.assign(process.env, overrides);
  try {
    return fn();
  } finally {
    for (const key of DB_TARGET_ENV_KEYS) {
      if (originals[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originals[key];
      }
    }
  }
}

test("createAdapter uses the Neon HTTP/WebSocket adapter for a *.neon.tech host", () => {
  const adapter = createAdapter("postgresql://user:pass@ep-empty-unit-aybmb3uy.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require");
  assert.ok(adapter instanceof PrismaNeon);
});

test("createAdapter uses the plain TCP adapter for a local host", () => {
  const adapter = createAdapter("postgresql://ahadzic@localhost:5432/goggler_prod");
  assert.ok(adapter instanceof PrismaPg);
});

test("createAdapter uses the plain TCP adapter for a non-Neon remote host", () => {
  const adapter = createAdapter("postgresql://user:pass@some-other-host.example.com:5432/db");
  assert.ok(adapter instanceof PrismaPg);
});

test("resolveDatabaseUrl defaults to the Neon target when GOGGLER_DB_TARGET is unset", () => {
  withDbTargetEnv(
    { DATABASE_URL: "postgresql://local/db", NEON_DATABASE_URL: "postgresql://neon.tech/db" },
    () => {
      assert.equal(resolveDatabaseUrl(), "postgresql://neon.tech/db");
    }
  );
});

test("resolveDatabaseUrl uses the local target when GOGGLER_DB_TARGET=local", () => {
  withDbTargetEnv(
    { GOGGLER_DB_TARGET: "local", DATABASE_URL: "postgresql://local/db", NEON_DATABASE_URL: "postgresql://neon.tech/db" },
    () => {
      assert.equal(resolveDatabaseUrl(), "postgresql://local/db");
    }
  );
});

test("resolveDatabaseUrl uses the neon target when GOGGLER_DB_TARGET=neon", () => {
  withDbTargetEnv(
    { GOGGLER_DB_TARGET: "neon", DATABASE_URL: "postgresql://local/db", NEON_DATABASE_URL: "postgresql://neon.tech/db" },
    () => {
      assert.equal(resolveDatabaseUrl(), "postgresql://neon.tech/db");
    }
  );
});

test("resolveDatabaseUrl throws on an unrecognized GOGGLER_DB_TARGET value", () => {
  withDbTargetEnv({ GOGGLER_DB_TARGET: "some-typo" }, () => {
    assert.throws(() => resolveDatabaseUrl(), /Invalid GOGGLER_DB_TARGET "some-typo"/);
  });
});

test("resolveDatabaseUrl returns undefined when the selected target's URL is not set", () => {
  withDbTargetEnv({ GOGGLER_DB_TARGET: "neon" }, () => {
    assert.equal(resolveDatabaseUrl(), undefined);
  });
});
