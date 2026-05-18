import safeRegex from "safe-regex2";

export type MatchingPreferences = {
  exactTitleMatch: boolean;
  criteriaText: string;
};

export const DEFAULT_MATCHING_CRITERIA_TEXT = String.raw`TBM\s*\d{1,4}; PAP\s*\d{1,4}`;

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
  const criteriaGroup = criteriaRelistingGroup(title, preferences.criteriaText);
  if (criteriaGroup) {
    return criteriaGroup;
  }

  if (!preferences.exactTitleMatch) {
    return undefined;
  }

  return titleRelistingGroup(title);
}

export function titleRelistingGroup(title: string): string {
  return `title:${normalizeTitle(title)}`;
}

function criteriaRelistingGroup(title: string, criteriaText: string): string | undefined {
  const boundedTitle = title.slice(0, MAX_MATCH_TITLE_LENGTH);
  for (const criterion of parseCriteria(criteriaText)) {
    const match = boundedTitle.match(criterion);
    if (match?.[0]) {
      return `criteria:${normalizeCriterionMatch(match[0])}`;
    }
  }

  return undefined;
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
  return value.trim().toLocaleUpperCase("en-GB").replace(/\s+/g, "");
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
