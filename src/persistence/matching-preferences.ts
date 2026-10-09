import { DEFAULT_MATCHING_PREFERENCES, parseMatchingPreferences, type MatchingPreferences } from "../ebay/matching-preferences.ts";
import type { PrismaClient } from "../generated/prisma/client.ts";
import { getPrismaClient } from "./prisma.ts";

/**
 * The single source of truth every route that needs matching preferences
 * now reads, instead of trusting a client-supplied value — see the
 * Server-Side Business Logic Invariant in AGENTS.md. Never writes: a user
 * who has never saved preferences gets the same default every route
 * already fell back to before this existed.
 */
export async function getMatchingPreferencesForUser(
  userId: string,
  prisma: PrismaClient | undefined = getPrismaClient()
): Promise<MatchingPreferences> {
  if (!prisma) {
    return DEFAULT_MATCHING_PREFERENCES;
  }
  const record = await prisma.matchingPreferences.findUnique({ where: { userId } });
  if (!record) {
    return DEFAULT_MATCHING_PREFERENCES;
  }
  return parseMatchingPreferences(record);
}

/**
 * Validates/bounds via the existing parseMatchingPreferences (same
 * length/count caps already applied to every client-supplied value) before
 * persisting, so a malformed or oversized value can never reach the
 * database. Returns the bounded value, not a pass-through of the raw
 * input, so the caller always knows the real effective value.
 */
export async function setMatchingPreferencesForUser(
  userId: string,
  input: { exactTitleMatch?: string | boolean | null; criteriaText?: string | null },
  prisma: PrismaClient | undefined = getPrismaClient()
): Promise<MatchingPreferences> {
  const preferences = parseMatchingPreferences(input);
  if (!prisma) {
    return preferences;
  }
  await prisma.matchingPreferences.upsert({
    where: { userId },
    create: { userId, ...preferences },
    update: preferences
  });
  return preferences;
}
