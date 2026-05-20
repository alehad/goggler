import safeRegex from "safe-regex2";

export type MatchingPreferences = {
  exactTitleMatch: boolean;
  criteriaText: string;
};

export const DEFAULT_MATCHING_CRITERIA_TEXT = String.raw`\b[A-Z]{1,5}\d{1,6}\b`;
export const LEGACY_DEFAULT_MATCHING_CRITERIA_TEXTS = [
  String.raw`TBM\s*\d{1,4}; PAP\s*\d{1,4}`,
  String.raw`TBM[-\s]*\d{1,4}; PAP[-\s]*\d{1,4}`
] as const;

export const DEFAULT_MATCHING_PREFERENCES: MatchingPreferences = {
  exactTitleMatch: true,
  criteriaText: DEFAULT_MATCHING_CRITERIA_TEXT
};

const MAX_CRITERIA_TEXT_LENGTH = 500;
const MAX_CRITERION_LENGTH = 80;
const MAX_CRITERIA_COUNT = 12;
const MAX_MATCH_TITLE_LENGTH = 240;

export function parseMatchingPreferences(input: {
  exactTitleMatch?: string | boolean | null;
  criteriaText?: string | null;
}): MatchingPreferences {
  return {
    exactTitleMatch: parseBoolean(input.exactTitleMatch, DEFAULT_MATCHING_PREFERENCES.exactTitleMatch),
    criteriaText: boundedCriteriaText(input.criteriaText?.trim() || DEFAULT_MATCHING_PREFERENCES.criteriaText)
  };
}

export function relistingGroupForTitle(title: string, preferences: MatchingPreferences): string | undefined {
  const criteriaMatch = criteriaMatchForTitle(title, preferences.criteriaText);
  if (criteriaMatch) {
    return `criteria:${normalizeCriterionMatch(criteriaMatch)}`;
  }

  if (!preferences.exactTitleMatch) {
    return undefined;
  }

  return titleRelistingGroup(title);
}

export function criteriaMatchForTitle(title: string, criteriaText: string): string | undefined {
  const boundedTitle = title.slice(0, MAX_MATCH_TITLE_LENGTH);
  for (const criterion of parseCriteria(criteriaText)) {
    const match = boundedTitle.match(criterion);
    if (match?.[0]) {
      return normalizeCriterionMatch(match[0]);
    }
  }

  return undefined;
}

export function catalogueIdForTitle(title: string, criteriaText: string): string | undefined {
  return criteriaMatchForTitle(title, criteriaText) ?? builtInCatalogueIdForTitle(title);
}

export function titleRelistingGroup(title: string): string {
  return `title:${normalizeTitle(title)}`;
}

function parseCriteria(criteriaText: string): RegExp[] {
  return criteriaText
    .split(";")
    .map((criterion) => criterion.trim())
    .filter(Boolean)
    .slice(0, MAX_CRITERIA_COUNT)
    .filter((criterion) => criterion.length <= MAX_CRITERION_LENGTH)
    .filter((criterion) => safeRegex(criterion))
    .flatMap((criterion) => {
      try {
        return [new RegExp(criterion, "i")];
      } catch {
        return [];
      }
    });
}

function boundedCriteriaText(value: string): string {
  return value.slice(0, MAX_CRITERIA_TEXT_LENGTH);
}

function normalizeTitle(title: string): string {
  return title.trim().toLocaleLowerCase("en-GB").replace(/\s+/g, " ");
}

function normalizeCriterionMatch(value: string): string {
  return value.trim().toLocaleUpperCase("en-GB").replace(/[-\s]+/g, "");
}

function builtInCatalogueIdForTitle(title: string): string | undefined {
  const match = title.slice(0, MAX_MATCH_TITLE_LENGTH).match(/\b[A-Z]{1,5}\d{1,6}\b/i);
  return match?.[0] ? normalizeCriterionMatch(match[0]) : undefined;
}

function parseBoolean(value: string | boolean | null | undefined, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}
