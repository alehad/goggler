import type { EbayHistoryResponse } from "./history-response.ts";

export type HistoryFetchStage = "native_prices" | "relistings";

export type BuyingHistoryStreamEvent =
  | { type: "progress"; stage: HistoryFetchStage; completed: number; total: number }
  | { type: "partial"; history: EbayHistoryResponse }
  | { type: "complete"; history: EbayHistoryResponse }
  | { type: "error"; error: string };

/**
 * How often (in completed items within a stage) a `partial` snapshot is
 * emitted alongside `progress` events — coarse enough that assembling a
 * snapshot (rebuilding the home feed) stays cheap relative to the
 * per-item eBay API calls it's reporting on.
 */
export const PARTIAL_SNAPSHOT_BATCH_SIZE = 10;
