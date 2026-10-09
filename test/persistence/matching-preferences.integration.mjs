import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { config } from "dotenv";
import { DEFAULT_MATCHING_PREFERENCES } from "../../src/ebay/matching-preferences.ts";
import { getMatchingPreferencesForUser, setMatchingPreferencesForUser } from "../../src/persistence/matching-preferences.ts";
import { createPrismaClient } from "../../src/persistence/prisma.ts";

config({ path: ".env.local" });

let prisma;

before(async () => {
  assert.ok(process.env.TEST_DATABASE_URL, "TEST_DATABASE_URL is required");
  prisma = createPrismaClient(process.env.TEST_DATABASE_URL);
});

beforeEach(async () => {
  await prisma.matchingPreferences.deleteMany();
});

after(async () => {
  await prisma?.$disconnect();
});

test("returns the default when no preferences have been saved, without writing anything", async () => {
  const preferences = await getMatchingPreferencesForUser("local-saja", prisma);

  assert.deepEqual(preferences, DEFAULT_MATCHING_PREFERENCES);
  const rowCount = await prisma.matchingPreferences.count();
  assert.equal(rowCount, 0);
});

test("saves preferences and reads them back", async () => {
  await setMatchingPreferencesForUser(
    "local-saja",
    { exactTitleMatch: false, criteriaText: String.raw`TBM\s*\d{1,4}` },
    prisma
  );

  const preferences = await getMatchingPreferencesForUser("local-saja", prisma);
  assert.equal(preferences.exactTitleMatch, false);
  assert.equal(preferences.criteriaText, String.raw`TBM\s*\d{1,4}`);
});

test("a second save overwrites rather than erroring", async () => {
  await setMatchingPreferencesForUser("local-saja", { exactTitleMatch: false, criteriaText: "AAA" }, prisma);
  await setMatchingPreferencesForUser("local-saja", { exactTitleMatch: true, criteriaText: "BBB" }, prisma);

  const preferences = await getMatchingPreferencesForUser("local-saja", prisma);
  assert.equal(preferences.exactTitleMatch, true);
  assert.equal(preferences.criteriaText, "BBB");
  const rowCount = await prisma.matchingPreferences.count();
  assert.equal(rowCount, 1);
});

test("validates and bounds input the same way every other matching-preferences input already is", async () => {
  const oversizedCriteria = "A".repeat(10000);

  const saved = await setMatchingPreferencesForUser(
    "local-saja",
    { exactTitleMatch: "not-a-boolean", criteriaText: oversizedCriteria },
    prisma
  );

  assert.ok(saved.criteriaText.length < oversizedCriteria.length);
  const reloaded = await getMatchingPreferencesForUser("local-saja", prisma);
  assert.deepEqual(reloaded, saved);
});

test("preferences are scoped per user", async () => {
  await setMatchingPreferencesForUser("local-saja", { exactTitleMatch: false, criteriaText: "AAA" }, prisma);

  const otherUser = await getMatchingPreferencesForUser("some-other-user", prisma);
  assert.deepEqual(otherUser, DEFAULT_MATCHING_PREFERENCES);
});
