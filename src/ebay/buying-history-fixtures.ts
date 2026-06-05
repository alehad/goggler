import type { EbayBuyingHistoryItem } from "./trading-client.ts";
import type { HomeFeedRelistingCandidate, HomeFeedWatchlistItem } from "./home-feed.ts";

type FixtureItem = EbayBuyingHistoryItem & {
  relistingGroupId: string;
};

export type FixtureWatchlistItem = HomeFeedWatchlistItem;
export type FixtureRelistingCandidate = HomeFeedRelistingCandidate;

export const mockLostBidItems: FixtureItem[] = [
  lostItem("sandbox-lost-001", "Rega Planar 3 turntable with Elys cartridge", "relist-rega-planar-3", 214.25, "2026-01-12"),
  lostItem("sandbox-lost-002", "Naim Nait 5si integrated amplifier", "relist-naim-nait-5si", 326.01, "2026-01-28"),
  lostItem("sandbox-lost-003", "Linn Kan bookshelf speakers in walnut", "relist-linn-kan-walnut", 181.5, "2026-02-09"),
  lostItem("sandbox-lost-004", "Technics SL-1200MK2 serviced deck", "relist-technics-1200-mk2", 398.99, "2026-02-22"),
  lostItem("sandbox-lost-005", "Quad 33 preamp and 303 power amp pair", "lost-quad-33-303", 455, "2026-03-02"),
  lostItem("sandbox-lost-006", "Mission 770 speakers with original stands", "lost-mission-770-stands", 522.27, "2026-03-15"),
  lostItem("sandbox-lost-007", "Arcam Alpha 9 CD player boxed", "lost-arcam-alpha-9", 92, "2026-03-21"),
  lostItem("sandbox-lost-008", "Thorens TD160 turntable restoration project", "lost-thorens-td160", 164.99, "2026-04-03"),
  lostItem("sandbox-lost-009", "Creek 4040 S2 amplifier", "lost-creek-4040-s2", 137.51, "2026-04-11"),
  lostItem("sandbox-lost-010", "KEF Coda III speakers black ash", "lost-kef-coda-iii", 76.65, "2026-04-19")
];

export const mockWonItems: FixtureItem[] = [
  wonItem("sandbox-won-001", "Rega Planar 3 turntable with Elys cartridge", "relist-rega-planar-3", 221, "2026-02-05"),
  wonItem("sandbox-won-002", "Naim Nait 5si integrated amplifier", "relist-naim-nait-5si", 341.89, "2026-02-25"),
  wonItem("sandbox-won-003", "Linn Kan bookshelf speakers in walnut", "relist-linn-kan-walnut", 205.1, "2026-03-07"),
  wonItem("sandbox-won-004", "Technics SL-1200MK2 serviced deck", "relist-technics-1200-mk2", 412, "2026-03-18"),
  wonItem("sandbox-won-005", "Rotel RA-930AX integrated amplifier", "won-rotel-ra-930ax", 88.5, "2026-04-02"),
  wonItem("sandbox-won-006", "Bowers & Wilkins DM601 S2 speaker pair", "won-bw-dm601-s2", 151.22, "2026-04-24"),
  wonItem("sandbox-won-007", "Cambridge Audio DacMagic Plus silver", "won-dacmagic-plus", 119.99, "2026-05-01")
];

export const mockWatchlistItems: FixtureWatchlistItem[] = [
  watchlistItem(
    "sandbox-watch-001",
    "Quad 33 preamp and 303 power amp pair - serviced",
    1,
    "lost-quad-33-303",
    92,
    ["same model", "same amp pair", "price range"]
  ),
  watchlistItem(
    "sandbox-watch-002",
    "Mission 770 speakers with original stands",
    2,
    "lost-mission-770-stands",
    88,
    ["same model", "original stands", "UK seller"]
  ),
  watchlistItem("sandbox-watch-003", "Sansui AU-217 integrated amplifier", 3),
  watchlistItem("sandbox-watch-004", "Rega Fono Mini A2D phono stage", 4),
  watchlistItem("sandbox-watch-005", "Tannoy Mercury M20 Gold speakers", 5),
  watchlistItem("sandbox-watch-006", "Sony WM-D6C Professional Walkman", 6)
];

export const mockRelistingCandidates: FixtureRelistingCandidate[] = [
  relistingCandidate(
    "candidate-001",
    "sandbox-candidate-001",
    "Arcam Alpha 9 CD player boxed",
    "lost-arcam-alpha-9",
    84,
    ["same model", "boxed", "seller title match"]
  ),
  relistingCandidate(
    "candidate-002",
    "sandbox-candidate-002",
    "Thorens TD160 turntable restoration project",
    "lost-thorens-td160",
    81,
    ["same model", "project condition", "price range"]
  )
];

export function filterLostItemsNeverWon(lostItems: FixtureItem[], wonItems: FixtureItem[]): FixtureItem[] {
  const wonRelistingGroups = new Set(wonItems.map((item) => item.relistingGroupId));
  return lostItems.filter((item) => !wonRelistingGroups.has(item.relistingGroupId));
}

export function filterLostItemsEventuallyWon(lostItems: FixtureItem[], wonItems: FixtureItem[]): FixtureItem[] {
  const wonRelistingGroups = new Set(wonItems.map((item) => item.relistingGroupId));
  return lostItems.filter((item) => wonRelistingGroups.has(item.relistingGroupId));
}

function lostItem(
  itemId: string,
  title: string,
  relistingGroupId: string,
  value: number,
  date: string
): FixtureItem {
  return historyItem("LostList", itemId, title, relistingGroupId, value, date);
}

function wonItem(
  itemId: string,
  title: string,
  relistingGroupId: string,
  value: number,
  date: string
): FixtureItem {
  return historyItem("WonList", itemId, title, relistingGroupId, value, date);
}

function historyItem(
  list: "LostList" | "WonList",
  itemId: string,
  title: string,
  relistingGroupId: string,
  value: number,
  date: string
): FixtureItem {
  return {
    itemId,
    title,
    list,
    relistingGroupId,
    currentPrice: { value, currency: "GBP" },
    maxBid: list === "LostList" ? { value: Math.max(0, value - 7.5), currency: "GBP" } : undefined,
    endTime: `${date}T20:15:00.000Z`,
    sellerUserId: "sandbox-seller",
    conditionDisplayName: "Used",
    imageUrl: `https://i.ebayimg.example/${itemId}.jpg`,
    itemWebUrl: `https://www.ebay.co.uk/itm/${itemId}`
  };
}

function watchlistItem(
  itemId: string,
  title: string,
  watchlistPosition: number,
  relistingGroupId?: string,
  matchConfidence?: number,
  matchSignals: string[] = []
): FixtureWatchlistItem {
  return {
    itemId,
    title,
    watchlistPosition,
    relistingGroupId,
    matchConfidence,
    matchSignals,
    currentPrice: { value: 95 + watchlistPosition * 17.5, currency: "GBP" },
    endsAt: `2026-05-${String(11 + watchlistPosition).padStart(2, "0")}T19:30:00.000Z`,
    sellerUserId: "watchlist-seller",
    conditionDisplayName: "Used",
    imageUrl: `https://i.ebayimg.example/watchlist-${watchlistPosition}.jpg`,
    itemWebUrl: `https://www.ebay.co.uk/itm/${itemId}`
  };
}

function relistingCandidate(
  candidateId: string,
  itemId: string,
  title: string,
  relistingGroupId: string,
  matchConfidence: number,
  matchSignals: string[]
): FixtureRelistingCandidate {
  return {
    candidateId,
    itemId,
    title,
    relistingGroupId,
    matchConfidence,
    matchSignals,
    currentPrice: { value: 110 + matchConfidence, currency: "GBP" },
    endsAt: `2026-05-${String(matchConfidence - 70).padStart(2, "0")}T20:45:00.000Z`,
    sellerUserId: "candidate-seller",
    conditionDisplayName: "Used",
    imageUrl: `https://i.ebayimg.example/${itemId}.jpg`,
    itemWebUrl: `https://www.ebay.co.uk/itm/${itemId}`
  };
}
