import assert from "node:assert/strict";
import { test } from "node:test";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { createAdapter } from "../../src/persistence/prisma.ts";

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
