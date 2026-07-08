import type { EbayBuyingHistoryItem } from "./trading-client.ts";

export type HomeFeedWatchlistItem = {
  itemId: string;
  title: string;
  watchlistPosition: number;
  currentPrice?: { value: number; currency: string };
  endsAt?: string;
  sellerUserId?: string;
  conditionDisplayName?: string;
  categoryId?: string;
  categoryName?: string;
  imageUrl?: string;
  itemWebUrl?: string;
  relistingGroupId?: string;
  matchConfidence?: number;
  matchSignals?: string[];
};

export type HomeFeedRelistingCandidate = Omit<HomeFeedWatchlistItem, "watchlistPosition"> & {
  candidateId: string;
};

export type HomeFeedFilter = "all" | "needsAction" | "won" | "onWatchlist" | "relistings" | "neverWon" | "resolved" | "search";
export type RelistingFormatFilter = "both" | "auction" | "buyNow";
export type HomeFeedModelList = "ebay" | "relisting_candidate" | "search";
export type HomeFeedSection = "watchlist" | "needs_action" | "won" | "unresolved" | "resolved" | "search_result";
export type HomeFeedTag =
  | "Live eBay listing"
  | "Won"
  | "Lost bid"
  | "Never won"
  | "Eventually won"
  | "Relisting candidate"
  | "On eBay watchlist"
  | "Not watched"
  | "Auction"
  | "Buy now";

export type HomeFeedRow = {
  id: string;
  modelList: HomeFeedModelList;
  section: HomeFeedSection;
  title: string;
  currentPrice?: { value: number; currency: string };
  maxBid?: { value: number; currency: string };
  originalLostPrice?: { value: number; currency: string };
  endsAt?: string;
  wonAt?: string;
  sellerUserId?: string;
  conditionDisplayName?: string;
  categoryId?: string;
  categoryName?: string;
  imageUrl?: string;
  itemWebUrl?: string;
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
  ebayRows: HomeFeedRow[];
  relistingRows: HomeFeedRow[];
  rows: HomeFeedRow[];
  counts: {
    watchlist: number;
    watchlistRelistings: number;
    needsAction: number;
    relistings: number;
    won: number;
    neverWon: number;
    resolved: number;
  };
};

type SearchableHomeFeedRow = {
  title: string;
  sellerUserId?: string;
  conditionDisplayName?: string;
  section: string;
  tags: readonly string[];
  matchSignals: readonly string[];
};

type BuildHomeFeedInput = {
  lostItems: EbayBuyingHistoryItem[];
  wonItems: EbayBuyingHistoryItem[];
  watchlistItems: HomeFeedWatchlistItem[];
  relistingCandidates: HomeFeedRelistingCandidate[];
};

export function buildHomeFeed(input: BuildHomeFeedInput): HomeFeed {
  const wonGroups = groups(input.wonItems);
  const watchlistGroups = groups(input.watchlistItems);
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
          ...(lostItem ? ["Lost bid" as const, "Relisting candidate" as const, "Never won" as const] : []),
          ...listingFormatTags(item.matchSignals)
        ],
        actions: item.itemWebUrl ? ["open_on_ebay"] : []
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
        tags: [
          "Relisting candidate",
          "Not watched",
          ...(lostItem ? ["Lost bid" as const, "Never won" as const] : []),
          ...listingFormatTags(item.matchSignals)
        ],
        actions: ["add_to_watchlist", ...(item.itemWebUrl ? ["open_on_ebay" as const] : []), "confirm_match", "dismiss"]
      });
    });

  const unresolvedRows = input.lostItems
    .filter((item) => item.relistingGroupId === undefined || !wonGroups.has(item.relistingGroupId))
    .map((item) => historyRow(item, "unresolved", ["Lost bid", "Never won"]));

  const resolvedRows = input.lostItems
    .filter((item) => item.relistingGroupId !== undefined && wonGroups.has(item.relistingGroupId))
    .map((item) => historyRow(item, "resolved", ["Lost bid", "Eventually won"]));

  const wonRows = input.wonItems.map((item) => historyRow(item, "won", ["Won"]));

  const ebayRows = [...watchlistRows, ...wonRows, ...unresolvedRows, ...resolvedRows];
  const relistingRows = needsActionRows;
  const rows = [...watchlistRows, ...relistingRows, ...wonRows, ...unresolvedRows, ...resolvedRows];
  return {
    ebayRows,
    relistingRows,
    rows,
    counts: {
      watchlist: watchlistRows.length,
      watchlistRelistings: watchlistRows.filter((row) => row.tags.includes("Relisting candidate")).length,
      needsAction: relistingRows.length,
      relistings: relistingRows.length,
      won: wonRows.length,
      neverWon: unresolvedRows.length,
      resolved: resolvedRows.length
    }
  };
}

export function filterHomeFeedRows(
  rows: HomeFeedRow[],
  filter: HomeFeedFilter,
  relistingFormatFilter: RelistingFormatFilter = "both"
): HomeFeedRow[] {
  switch (filter) {
    case "needsAction":
      return rows.filter((row) => row.modelList === "relisting_candidate" && row.section === "needs_action");
    case "won":
      return rows.filter((row) => row.modelList === "ebay" && row.section === "won");
    case "onWatchlist":
      return rows.filter((row) => row.modelList === "ebay" && row.section === "watchlist");
    case "relistings":
      return rows
        .filter((row) => row.modelList === "relisting_candidate")
        .filter((row) => relistingFormatFilter === "both" || row.tags.includes(formatTagForRelistingFilter(relistingFormatFilter)));
    case "neverWon":
      return rows.filter((row) => row.modelList === "ebay" && row.section === "unresolved");
    case "resolved":
      return rows.filter((row) => row.modelList === "ebay" && row.section === "resolved");
    case "all":
    case "search":
      return rows;
  }
}

function formatTagForRelistingFilter(filter: Exclude<RelistingFormatFilter, "both">): "Auction" | "Buy now" {
  return filter === "auction" ? "Auction" : "Buy now";
}

export function searchHomeFeedRows<Row extends SearchableHomeFeedRow>(rows: Row[], query: string): Row[] {
  const terms = normalizedSearchTerms(query);
  if (terms.length === 0) {
    return [];
  }

  return rows.filter((row) => {
    const searchText = normalizedSearchText([
      row.title,
      row.sellerUserId,
      row.conditionDisplayName,
      row.tags.join(" "),
      row.matchSignals.join(" "),
      row.section
    ]);
    return terms.every((term) => searchText.includes(term));
  });
}

function activeListingRow(input: {
  id: string;
  item: HomeFeedWatchlistItem | HomeFeedRelistingCandidate;
  lostItem?: EbayBuyingHistoryItem;
  section: HomeFeedSection;
  tags: HomeFeedTag[];
  actions: HomeFeedRow["actions"];
}): HomeFeedRow {
  return {
    id: input.id,
    modelList: input.section === "needs_action" ? "relisting_candidate" : "ebay",
    section: input.section,
    title: input.item.title,
    currentPrice: input.item.currentPrice,
    maxBid: undefined,
    originalLostPrice: input.lostItem?.currentPrice,
    endsAt: input.item.endsAt,
    sellerUserId: input.item.sellerUserId,
    conditionDisplayName: input.item.conditionDisplayName,
    categoryId: input.item.categoryId,
    categoryName: input.item.categoryName,
    imageUrl: input.item.imageUrl,
    itemWebUrl: input.item.itemWebUrl,
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
    modelList: "ebay",
    section,
    title: item.title,
    currentPrice: item.currentPrice,
    maxBid: item.maxBid,
    originalLostPrice: section === "won" ? undefined : item.currentPrice,
    wonAt: section === "won" ? item.endTime : undefined,
    sellerUserId: item.sellerUserId,
    conditionDisplayName: item.conditionDisplayName,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    imageUrl: item.imageUrl,
    itemWebUrl: item.itemWebUrl,
    relistingGroupId: item.relistingGroupId,
    sourceItemId: item.itemId,
    lostItemId: section === "won" ? undefined : item.itemId,
    matchSignals: [],
    tags,
    actions: []
  };
}

function groups(items: { relistingGroupId?: string }[]): Set<string> {
  return new Set(items.map((item) => item.relistingGroupId).filter((value): value is string => Boolean(value)));
}

function listingFormatTags(matchSignals: readonly string[] | undefined): HomeFeedTag[] {
  const normalizedSignals = new Set((matchSignals ?? []).map((signal) => signal.toLocaleUpperCase("en-GB")));
  return [
    ...(normalizedSignals.has("AUCTION") ? ["Auction" as const] : []),
    ...(normalizedSignals.has("FIXED_PRICE") || normalizedSignals.has("BUY_IT_NOW") ? ["Buy now" as const] : [])
  ];
}

function normalizedSearchTerms(query: string): string[] {
  return normalizedSearchText([query]).split(" ").filter(Boolean).slice(0, 8);
}

function normalizedSearchText(values: Array<string | undefined>): string {
  return values.join(" ").toLocaleLowerCase("en-GB").replace(/\s+/g, " ").trim();
}
