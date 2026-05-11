export type EbayHistorySource = "fixture" | "live";

export type EbayHistorySourceStatus =
  | { ok: true; source: EbayHistorySource; fixture: boolean }
  | { ok: false; source: EbayHistorySource; error: "fixture_not_allowed_in_production" };

type Env = Record<string, string | undefined>;

export function getEbayHistorySourceStatus(
  env: Env = process.env,
  nodeEnv = process.env.NODE_ENV
): EbayHistorySourceStatus {
  const source = parseEbayHistorySource(env.GOGGLER_EBAY_HISTORY_SOURCE, nodeEnv);
  if (source === "fixture" && nodeEnv === "production") {
    return { ok: false, source, error: "fixture_not_allowed_in_production" };
  }

  return { ok: true, source, fixture: source === "fixture" };
}

export function parseEbayHistorySource(value: string | undefined, nodeEnv = process.env.NODE_ENV): EbayHistorySource {
  if (!value) {
    return nodeEnv === "production" ? "live" : "fixture";
  }

  if (value === "fixture" || value === "live") {
    return value;
  }

  throw new Error("GOGGLER_EBAY_HISTORY_SOURCE must be fixture or live");
}
