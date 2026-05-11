import type {
  FixtureRelistingCandidate,
  FixtureWatchlistItem
} from "./buying-history-fixtures.ts";
import type { EbayBuyingHistoryItem } from "./trading-client.ts";

export type HomeFeedFilter = "all" | "needsAction" | "onWatchlist" | "relistings" | "neverWon" | "resolved";
export type HomeFeedSection = "watchlist" | "needs_action" | "unresolved" | "resolved";
export type HomeFeedTag =
  | "Lost bid"
  | "Never won"
  | "Eventually won"
  | "Relisting candidate"
  | "On eBay watchlist"
  | "Not watched";

export type HomeFeedRow = {
  id: string;
  section: HomeFeedSection;
  title: string;
  currentPrice?: { value: number; currency: string };
  originalLostPrice?: { value: number; currency: string };
  endsAt?: string;
  sellerUserId?: string;
  conditionDisplayName?: string;
  watchlistPosition?: number;
  matchConfidence?: number;
  matchSignals: string[];
  relistingGroupId?: string;
  sourceItemId?: string;
  lostItemId?: string;
  tags: HomeFeedTag[];
  actions: ("add_to_watchlist" | "open_on_ebay" | "confirm_match" | "dismiss")[];
};

export type HomeFeed = {
  rows: HomeFeedRow[];
  counts: {
    watchlist: number;
    watchlistRelistings: number;
    needsAction: number;
    relistings: number;
    neverWon: number;
    resolved: number;
  };
};

type BuildHomeFeedInput = {
  lostItems: EbayBuyingHistoryItem[];
  wonItems: EbayBuyingHistoryItem[];
  watchlistItems: FixtureWatchlistItem[];
  relistingCandidates: FixtureRelistingCandidate[];
};

export function buildHomeFeed(input: BuildHomeFeedInput): HomeFeed {
  const wonGroups = groups(input.wonItems);
  const watchlistGroups = groups(input.watchlistItems);
  const candidateGroups = groups(input.relistingCandidates);
  const lostByGroup = new Map(input.lostItems.map((item) => [item.relistingGroupId, item]));

  const watchlistRows = [...input.watchlistItems]
    .sort((left, right) => left.watchlistPosition - right.watchlistPosition)
    .map((item) => {
      const lostItem = item.relistingGroupId ? lostByGroup.get(item.relistingGroupId) : undefined;
      return activeListingRow({
        id: `watchlist-${item.itemId}`,
        item,
        lostItem,
        section: "watchlist",
        tags: [
          "On eBay watchlist",
          ...(lostItem ? ["Lost bid" as const, "Relisting candidate" as const, "Never won" as const] : [])
        ],
        actions: ["open_on_ebay"]
      });
    });

  const needsActionRows = input.relistingCandidates
    .filter((item) => item.relistingGroupId !== undefined && !watchlistGroups.has(item.relistingGroupId))
    .map((item) => {
      const lostItem = lostByGroup.get(item.relistingGroupId);
      return activeListingRow({
        id: `candidate-${item.candidateId}`,
        item,
        lostItem,
        section: "needs_action",
        tags: ["Relisting candidate", "Not watched", ...(lostItem ? ["Lost bid" as const, "Never won" as const] : [])],
        actions: ["add_to_watchlist", "open_on_ebay", "confirm_match", "dismiss"]
      });
    });

  const unresolvedRows = input.lostItems
    .filter((item) => item.relistingGroupId === undefined || !wonGroups.has(item.relistingGroupId))
    .filter((item) => item.relistingGroupId === undefined || !watchlistGroups.has(item.relistingGroupId))
    .filter((item) => item.relistingGroupId === undefined || !candidateGroups.has(item.relistingGroupId))
    .map((item) => historyRow(item, "unresolved", ["Lost bid", "Never won"]));

  const resolvedRows = input.lostItems
    .filter((item) => item.relistingGroupId !== undefined && wonGroups.has(item.relistingGroupId))
    .map((item) => historyRow(item, "resolved", ["Lost bid", "Eventually won"]));

  const rows = [...watchlistRows, ...needsActionRows, ...unresolvedRows, ...resolvedRows];
  return {
    rows,
    counts: {
      watchlist: watchlistRows.length,
      watchlistRelistings: watchlistRows.filter((row) => row.tags.includes("Relisting candidate")).length,
      needsAction: needsActionRows.length,
      relistings: watchlistRows.filter((row) => row.tags.includes("Relisting candidate")).length + needsActionRows.length,
      neverWon: rows.filter((row) => row.tags.includes("Never won")).length,
      resolved: resolvedRows.length
    }
  };
}

export function filterHomeFeedRows(rows: HomeFeedRow[], filter: HomeFeedFilter): HomeFeedRow[] {
  switch (filter) {
    case "needsAction":
      return rows.filter((row) => row.section === "needs_action");
    case "onWatchlist":
      return rows.filter((row) => row.section === "watchlist");
    case "relistings":
      return rows.filter((row) => row.tags.includes("Relisting candidate"));
    case "neverWon":
      return rows.filter((row) => row.tags.includes("Never won"));
    case "resolved":
      return rows.filter((row) => row.section === "resolved");
    case "all":
      return rows;
  }
}

function activeListingRow(input: {
  id: string;
  item: FixtureWatchlistItem | FixtureRelistingCandidate;
  lostItem?: EbayBuyingHistoryItem;
  section: HomeFeedSection;
  tags: HomeFeedTag[];
  actions: HomeFeedRow["actions"];
}): HomeFeedRow {
  return {
    id: input.id,
    section: input.section,
    title: input.item.title,
    currentPrice: input.item.currentPrice,
    originalLostPrice: input.lostItem?.currentPrice,
    endsAt: input.item.endsAt,
    sellerUserId: input.item.sellerUserId,
    conditionDisplayName: input.item.conditionDisplayName,
    watchlistPosition: "watchlistPosition" in input.item ? input.item.watchlistPosition : undefined,
    matchConfidence: input.item.matchConfidence,
    matchSignals: input.item.matchSignals ?? [],
    relistingGroupId: input.item.relistingGroupId,
    sourceItemId: input.item.itemId,
    lostItemId: input.lostItem?.itemId,
    tags: input.tags,
    actions: input.actions
  };
}

function historyRow(item: EbayBuyingHistoryItem, section: HomeFeedSection, tags: HomeFeedTag[]): HomeFeedRow {
  return {
    id: `${section}-${item.itemId}`,
    section,
    title: item.title,
    originalLostPrice: item.currentPrice,
    sellerUserId: item.sellerUserId,
    conditionDisplayName: item.conditionDisplayName,
    relistingGroupId: item.relistingGroupId,
    lostItemId: item.itemId,
    matchSignals: [],
    tags,
    actions: []
  };
}

function groups(items: { relistingGroupId?: string }[]): Set<string> {
  return new Set(items.map((item) => item.relistingGroupId).filter((value): value is string => Boolean(value)));
}
