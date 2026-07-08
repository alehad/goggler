"use client";

import {
  BarChart3,
  Check,
  ChevronDown,
  CircleUserRound,
  Clock3,
  ExternalLink,
  Gavel,
  Heart,
  House,
  Link2,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  X
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_MATCHING_PREFERENCES,
  LEGACY_DEFAULT_MATCHING_CRITERIA_TEXTS,
  type MatchingPreferences
} from "../src/ebay/matching-preferences.ts";
import { buildPurchaseChartPoints, type PurchaseChartPoint } from "../src/ebay/purchase-analytics.ts";
import { ebaySellerProfileUrl } from "../src/ebay/seller-profile.ts";
import { safeEbayImageUrl, safeEbayItemUrl } from "../src/http/safe-external-url.ts";
import { formatAbsoluteDate } from "../src/ui/date-format.ts";

type Tab = "dashboard" | "tracking" | "won" | "analytics" | "account";
type LostFilter = "all" | "neverWon" | "eventuallyWon";
type CaptureFilter = "all" | "captured" | "notCaptured";
type HomeFeedFilter = "search" | "all" | "onWatchlist" | "relistings" | "won" | "neverWon";
type RelistingFormatFilter = "both" | "auction" | "buyNow";
const MATCHING_PREFERENCES_STORAGE_KEY = "goggler.matchingPreferences";

type Candidate = {
  id: string;
  title: string;
  artist: string;
  originalPrice: string;
  currentPrice: string;
  ends: string;
  confidence: number;
  image: string;
  signals: string[];
  seller: string;
  condition: string;
};

type EbaySession = {
  connection: {
    connected: boolean;
    status: "connected_this_session" | "reauth_required" | "disconnected";
    authorizedAt?: string;
    expiresAt?: string;
    scopes: string[];
    identity?: {
      userId: string;
      displayName?: string;
    };
  };
};

type EbayConfigStatus = {
  config: {
    ready: boolean;
    environment: "sandbox" | "production";
    missing: string[];
    invalid: string[];
    marketplaceId: string;
    tradingSiteId: string;
    scopeCount: number;
  };
};

type HistoryItem = {
  itemId: string;
  title: string;
  list: "LostList" | "WonList" | "WatchList";
  currentPrice?: {
    value: number;
    currency: string;
  };
  maxBid?: {
    value: number;
    currency: string;
  };
  endTime?: string;
  sellerUserId?: string;
  conditionDisplayName?: string;
  imageUrl?: string;
  itemWebUrl?: string;
  relistingGroupId?: string;
};

type EndedWatchlistItem = HistoryItem & { captured: boolean };

type BuyingHistory = {
  source: "fixture" | "live";
  counts: {
    lost: number;
    won: number;
    eventuallyWon: number;
    neverWon: number;
    watchlist: number;
    watchlistRelistings: number;
    needsAction: number;
    relistings: number;
  };
  lostItems: HistoryItem[];
  wonItems: HistoryItem[];
  endedWatchlistItems: EndedWatchlistItem[];
  homeFeed: {
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
};

type HistoryState =
  | { status: "idle" | "loading" }
  | { status: "ready"; history: BuyingHistory }
  | { status: "sign_in_required" | "reauth_required" | "live_not_implemented" | "unavailable"; message: string };

type HomeSearchState =
  | { status: "idle" }
  | { status: "loading"; query: string }
  | { status: "ready"; query: string; rows: HomeFeedRow[]; total?: number }
  | { status: "unavailable"; query: string; message: string };

type HomeFeedRow = {
  id: string;
  modelList: "ebay" | "relisting_candidate" | "search";
  section: "watchlist" | "needs_action" | "won" | "unresolved" | "resolved" | "search_result";
  title: string;
  currentPrice?: { value: number; currency: string };
  maxBid?: { value: number; currency: string };
  originalLostPrice?: { value: number; currency: string };
  endsAt?: string;
  wonAt?: string;
  sellerUserId?: string;
  conditionDisplayName?: string;
  imageUrl?: string;
  itemWebUrl?: string;
  watchlistPosition?: number;
  matchConfidence?: number;
  matchSignals: string[];
  relistingGroupId?: string;
  sourceItemId?: string;
  lostItemId?: string;
  tags: string[];
  actions: string[];
};

const tabs = [
  { id: "dashboard", label: "Home", mobileLabel: "Home", icon: House },
  { id: "tracking", label: "Watching", mobileLabel: "Watching", icon: Heart },
  { id: "won", label: "Purchases", mobileLabel: "Purchases", icon: ShoppingBag },
  { id: "analytics", label: "Analytics", mobileLabel: "Analytics", icon: TrendingUp },
  { id: "account", label: "My goggler", mobileLabel: "My", icon: CircleUserRound }
] satisfies { id: Tab; label: string; mobileLabel: string; icon: typeof House }[];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [ebaySession, setEbaySession] = useState<EbaySession | null>(null);
  const [ebayConfigStatus, setEbayConfigStatus] = useState<EbayConfigStatus | null>(null);
  const [ebayStartReady, setEbayStartReady] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  const [historyState, setHistoryState] = useState<HistoryState>({ status: "idle" });
  const [matchingPreferences, setMatchingPreferences] = useState<MatchingPreferences>(DEFAULT_MATCHING_PREFERENCES);
  const [searchDraft, setSearchDraft] = useState("");
  const [homeSearchQuery, setHomeSearchQuery] = useState("");
  const [homeSearchState, setHomeSearchState] = useState<HomeSearchState>({ status: "idle" });

  async function refreshEbayConfigStatus() {
    const response = await fetch("/api/auth/ebay/config-status");
    setEbayConfigStatus(response.ok ? ((await response.json()) as EbayConfigStatus) : null);
  }

  async function refreshEbaySessionState() {
    await refreshEbayConfigStatus();
    const ebayResponse = await fetch("/api/auth/ebay/session");
    setEbaySession(ebayResponse.ok ? ((await ebayResponse.json()) as EbaySession) : null);
  }

  async function refreshBuyingHistory() {
    const previousHistory = historyState.status === "ready" ? historyState.history : undefined;
    setHistoryState({ status: "loading" });
    const response = await fetch("/api/ebay/buying-history", {
      body: JSON.stringify(matchingPreferences),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    const body = await response.json().catch(() => ({}));

    if (response.ok) {
      setHistoryState({ status: "ready", history: body as BuyingHistory });
      return;
    }

    if (response.status === 409) {
      setHistoryState({
        status: "reauth_required",
        message: "Connect eBay from the account button to view buying history"
      });
      await refreshEbaySessionState();
      return;
    }

    if (response.status === 501) {
      if (previousHistory) {
        setHistoryState({ status: "ready", history: previousHistory });
        return;
      }

      setHistoryState({
        status: "live_not_implemented",
        message: "Live history import is not implemented yet"
      });
      return;
    }

    if (previousHistory && response.status >= 500) {
      setHistoryState({ status: "ready", history: previousHistory });
      return;
    }

    setHistoryState({
      status: "unavailable",
      message: body.error ? `History unavailable: ${body.error}` : "History is unavailable"
    });
  }

  useEffect(() => {
    const storedPreferences = window.localStorage.getItem(MATCHING_PREFERENCES_STORAGE_KEY);
    if (!storedPreferences) {
      return;
    }

    try {
      const parsed = JSON.parse(storedPreferences) as Partial<MatchingPreferences>;
      setMatchingPreferences({
        exactTitleMatch:
          typeof parsed.exactTitleMatch === "boolean"
            ? parsed.exactTitleMatch
            : DEFAULT_MATCHING_PREFERENCES.exactTitleMatch,
        criteriaText: storedCriteriaText(parsed.criteriaText)
      });
    } catch {
      setMatchingPreferences(DEFAULT_MATCHING_PREFERENCES);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(MATCHING_PREFERENCES_STORAGE_KEY, JSON.stringify(matchingPreferences));
  }, [matchingPreferences]);

  useEffect(() => {
    void refreshEbaySessionState();
  }, []);

  useEffect(() => {
    void refreshBuyingHistory();
  }, []);

  useEffect(() => {
    const ebayConfig = ebayConfigStatus?.config;
    const ebayConnection = ebaySession?.connection;
    if (!ebayConfig?.ready || ebayConnection?.connected) {
      setEbayStartReady(false);
      return;
    }

    const controller = new AbortController();
    setEbayStartReady(false);

    fetch("/api/auth/ebay/start", {
      cache: "no-store",
      method: "HEAD",
      signal: controller.signal
    })
      .then((response) => {
        if (!controller.signal.aborted) {
          setEbayStartReady(response.ok);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setEbayStartReady(false);
        }
      });

    return () => controller.abort();
  }, [ebayConfigStatus?.config?.ready, ebaySession?.connection?.connected]);

  async function disconnectEbay() {
    setAccountMessage("");
    const response = await fetch("/api/auth/ebay/disconnect", { method: "POST" });
    if (!response.ok) {
      setAccountMessage("Could not disconnect eBay");
      return;
    }

    setHistoryState({ status: "idle" });
    await refreshEbaySessionState();
  }

  function connectEbay() {
    setAccountMessage("");
    window.location.href = "/api/auth/ebay/start";
  }

  async function executeHomeSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchDraft.trim();
    setHomeSearchQuery(query);
    if (query) {
      setActiveTab("dashboard");
      setHomeSearchState({ status: "loading", query });
      const response = await fetch("/api/ebay/search", {
        body: JSON.stringify({
          query,
          exactTitleMatch: matchingPreferences.exactTitleMatch,
          criteriaText: matchingPreferences.criteriaText
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const body = await response.json().catch(() => ({}));

      if (response.ok) {
        setHomeSearchState({
          status: "ready",
          query,
          rows: Array.isArray(body.rows) ? (body.rows as HomeFeedRow[]) : [],
          total: typeof body.total === "number" ? body.total : undefined
        });
        return;
      }

      setHomeSearchState({
        status: "unavailable",
        query,
        message: body.error ? `Search unavailable: ${body.error}` : "Search is unavailable"
      });
    } else {
      setHomeSearchState({ status: "idle" });
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">g</div>
            <div>
              <strong>goggler</strong>
              <span>eBay UK tracker</span>
            </div>
          </div>
          <form className="search-box" onSubmit={executeHomeSearch}>
            <Search size={18} />
            <input
              aria-label="Search tracked items"
              onChange={(event) => {
                setSearchDraft(event.target.value);
                if (!event.target.value.trim()) {
                  setHomeSearchQuery("");
                  setHomeSearchState({ status: "idle" });
                }
              }}
              placeholder="Search tracked records, artists, catalogue numbers"
              value={searchDraft}
            />
          </form>
          <button className="icon-button" title="Filters" type="button">
            <SlidersHorizontal size={18} />
          </button>
          <EbayAccountControl
            config={ebayConfigStatus?.config}
            connection={ebaySession?.connection}
            disconnectEbay={disconnectEbay}
            ebayStartReady={ebayStartReady}
            startEbayConnect={connectEbay}
          />
        </header>

        {activeTab === "dashboard" && (
          <Dashboard
            historyState={historyState}
            searchQuery={homeSearchQuery}
            searchState={homeSearchState}
            clearSearch={() => {
              setHomeSearchQuery("");
              setSearchDraft("");
              setHomeSearchState({ status: "idle" });
            }}
            refreshBuyingHistory={refreshBuyingHistory}
          />
        )}
        {activeTab === "tracking" && <Tracking historyState={historyState} refreshBuyingHistory={refreshBuyingHistory} />}
        {activeTab === "won" && (
          <Won
            historyState={historyState}
            refreshBuyingHistory={refreshBuyingHistory}
          />
        )}
        {activeTab === "analytics" && (
          <Analytics historyState={historyState} refreshBuyingHistory={refreshBuyingHistory} />
        )}
        {activeTab === "account" && (
          <Account
            ebayConfig={ebayConfigStatus?.config}
            ebayConnection={ebaySession?.connection}
            matchingPreferences={matchingPreferences}
            message={accountMessage}
            setMatchingPreferences={setMatchingPreferences}
          />
        )}
      </section>

      <nav className="bottom-tabbar" aria-label="Primary navigation">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              className={activeTab === tab.id ? "bottom-tab active" : "bottom-tab"}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
              title={tab.label}
            >
              <Icon size={20} />
              <span>{tab.mobileLabel}</span>
            </button>
          );
        })}
      </nav>
    </main>
  );
}

function Dashboard({
  clearSearch,
  historyState,
  searchQuery,
  searchState,
  refreshBuyingHistory
}: {
  clearSearch: () => void;
  historyState: HistoryState;
  searchQuery: string;
  searchState: HomeSearchState;
  refreshBuyingHistory: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<HomeFeedFilter>("onWatchlist");
  const [relistingFormatFilter, setRelistingFormatFilter] = useState<RelistingFormatFilter>("both");
  const [locallyWatchedIds, setLocallyWatchedIds] = useState<string[]>([]);
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const trimmedSearchQuery = searchQuery.trim();
  const rows = useMemo(() => {
    if (historyState.status !== "ready") {
      return [];
    }

    const updatedRows = historyState.history.homeFeed.rows.map((row) => {
      if (!locallyWatchedIds.includes(row.id)) {
        return row;
      }

      return {
        ...row,
        tags: [...new Set([...row.tags.filter((tag) => tag !== "Not watched"), "Added by goggler"])],
        actions: row.actions.filter((action) => action !== "add_to_watchlist")
      };
    });

    return filter === "search" ? searchRowsForState(searchState, updatedRows) : filterHomeRows(updatedRows, filter, relistingFormatFilter);
  }, [filter, historyState, locallyWatchedIds, relistingFormatFilter, searchState]);

  useEffect(() => {
    if (trimmedSearchQuery && trimmedSearchQuery !== activeSearchQuery) {
      setActiveSearchQuery(trimmedSearchQuery);
      setFilter("search");
    } else if (!trimmedSearchQuery && filter === "search") {
      setActiveSearchQuery("");
      setFilter("onWatchlist");
    }
  }, [activeSearchQuery, filter, trimmedSearchQuery]);

  return (
    <section className="content">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Home</p>
          <h1>Watchlist and relistings</h1>
        </div>
        <button className="primary-button" onClick={() => void refreshBuyingHistory()} type="button">
          <Sparkles size={17} />
          <span>Refresh feed</span>
        </button>
      </div>

      {historyState.status === "ready" ? (
        <>
          <div className="summary-grid">
            <Metric label="On watchlist" value={String(historyState.history.counts.watchlist)} detail="Shown first" />
            <Metric
              label="Relistings"
              value={String(historyState.history.counts.relistings)}
              detail={`${historyState.history.counts.watchlistRelistings} already watched`}
            />
            <Metric label="Won" value={String(historyState.history.counts.won)} detail="Purchase history" />
            <Metric label="Never won" value={String(historyState.history.counts.neverWon)} detail="Still unresolved" />
          </div>

          <div className="segmented-control home-filters" aria-label="Home feed filter">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")} type="button">
              All
            </button>
            <button
              className={filter === "search" ? "active" : ""}
              disabled={!trimmedSearchQuery}
              onClick={() => setFilter("search")}
              type="button"
            >
              Search
            </button>
            <button
              className={filter === "onWatchlist" ? "active" : ""}
              onClick={() => setFilter("onWatchlist")}
              type="button"
            >
              On watchlist
            </button>
            <button
              className={filter === "relistings" ? "active" : ""}
              onClick={() => setFilter("relistings")}
              type="button"
            >
              Relistings
            </button>
            <button className={filter === "won" ? "active" : ""} onClick={() => setFilter("won")} type="button">
              Won
            </button>
            <button
              className={filter === "neverWon" ? "active" : ""}
              onClick={() => setFilter("neverWon")}
              type="button"
            >
              Never won
            </button>
          </div>

          {filter === "relistings" && (
            <div className="relisting-format-toolbar">
              <div className="segmented-control relisting-format-filter" aria-label="Relisting listing format filter">
                <button
                  className={relistingFormatFilter === "both" ? "active" : ""}
                  onClick={() => setRelistingFormatFilter("both")}
                  type="button"
                >
                  Both
                </button>
                <button
                  className={relistingFormatFilter === "auction" ? "active" : ""}
                  onClick={() => setRelistingFormatFilter("auction")}
                  type="button"
                >
                  Auction
                </button>
                <button
                  className={relistingFormatFilter === "buyNow" ? "active" : ""}
                  onClick={() => setRelistingFormatFilter("buyNow")}
                  type="button"
                >
                  Buy now
                </button>
              </div>
            </div>
          )}

          {filter === "search" && searchState.status === "loading" && (
            <div className="empty-panel">
              <Search size={20} />
              <h2>Searching eBay</h2>
              <p>{`Looking for "${searchState.query}" in live listings.`}</p>
            </div>
          )}

          {filter === "search" && searchState.status === "unavailable" && (
            <div className="empty-panel">
              <Search size={20} />
              <h2>Search unavailable</h2>
              <p>{searchState.message}</p>
              <button
                className="secondary-button compact"
                onClick={() => {
                  clearSearch();
                  setFilter("onWatchlist");
                }}
                type="button"
              >
                On watchlist
              </button>
            </div>
          )}

          {filter === "search" && searchState.status === "ready" && rows.length > 0 && (
            <div className="search-results-strip">
              <span>{`${rows.length} live result${rows.length === 1 ? "" : "s"}`}</span>
              <strong>{searchState.query}</strong>
            </div>
          )}

          {filter === "search" && searchState.status === "ready" && rows.length === 0 ? (
            <SearchEmptyState
              query={searchState.query}
              onReturnToWatchlist={() => {
                clearSearch();
                setFilter("onWatchlist");
              }}
            />
          ) : filter === "search" && searchState.status !== "ready" ? null : (
            <div className="candidate-list">
              {rows.map((row) => (
                <HomeFeedCard
                  key={row.id}
                  row={row}
                  onAddToWatchlist={() => setLocallyWatchedIds((ids) => [...new Set([...ids, row.id])])}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <HistoryEmptyState state={historyState} />
      )}
    </section>
  );
}

function SearchEmptyState({ onReturnToWatchlist, query }: { onReturnToWatchlist: () => void; query: string }) {
  return (
    <div className="empty-panel">
      <Search size={20} />
      <h2>No search results</h2>
      <p>{`No live eBay listings match "${query}".`}</p>
      <button className="secondary-button compact" onClick={onReturnToWatchlist} type="button">
        On watchlist
      </button>
    </div>
  );
}

function HomeFeedCard({ row, onAddToWatchlist }: { row: HomeFeedRow; onAddToWatchlist: () => void }) {
  const imageUrl = safeEbayImageUrl(row.imageUrl);
  const itemWebUrl = safeEbayItemUrl(row.itemWebUrl);
  const wonDate = formatAbsoluteDate(row.wonAt);

  return (
    <article className="candidate-card home-feed-card">
      <div className="watch-thumbnail" title={imageUrl ? "eBay listing image" : "goggler feed"}>
        {imageUrl ? <img alt="" loading="lazy" referrerPolicy="no-referrer" src={imageUrl} /> : <Sparkles size={20} />}
      </div>
      <div className="candidate-main">
        <div className="candidate-title-row">
          <div>
            <p className="artist">{formatHomeSection(row.section)}</p>
            <h2>{row.title}</h2>
          </div>
          {row.matchConfidence !== undefined && <span className="confidence">{row.matchConfidence}%</span>}
        </div>

        <div className="meta-row">
          <span>{row.conditionDisplayName ?? "Condition unknown"}</span>
          <SellerLink sellerUserId={row.sellerUserId} />
          {wonDate && <span>won: {wonDate}</span>}
          {row.maxBid && <span>max bid: {formatMoneyValue(row.maxBid)}</span>}
          {row.section === "unresolved" || row.section === "resolved" ? (
            row.currentPrice && <span>sold for: {formatMoneyValue(row.currentPrice)}</span>
          ) : (
            row.originalLostPrice && <span>previous sold for: {formatMoneyValue(row.originalLostPrice)}</span>
          )}
        </div>

        <div className="signal-row">
          {row.tags.map((tag) => (
            <span className={tag === "Not watched" ? "signal attention" : "signal"} key={tag}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="listing-side">
        <strong>{formatHomeFeedSidePrice(row)}</strong>
        <span>{homeFeedSideLabel(row)}</span>
        {row.endsAt && (
          <span className="ends">
            <Clock3 size={16} />
            {formatRelativeDate(row.endsAt)}
          </span>
        )}
      </div>

      <div className="card-actions">
        {row.actions.includes("add_to_watchlist") && (
          <button className="secondary-button compact" onClick={onAddToWatchlist} type="button">
            <Heart size={17} />
            <span>Add</span>
          </button>
        )}
        {row.actions.includes("confirm_match") && (
          <button className="icon-button positive" title="Confirm match" type="button">
            <Check size={18} />
          </button>
        )}
        {row.actions.includes("dismiss") && (
          <button className="icon-button negative" title="Dismiss" type="button">
            <X size={18} />
          </button>
        )}
        {row.actions.includes("open_on_ebay") && itemWebUrl && (
          <a
            className="icon-button"
            href={itemWebUrl}
            rel="noopener noreferrer"
            target="_blank"
            title="View on eBay"
          >
            <ExternalLink size={18} />
          </a>
        )}
      </div>
    </article>
  );
}

function Tracking({
  historyState,
  refreshBuyingHistory
}: {
  historyState: HistoryState;
  refreshBuyingHistory: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<LostFilter>("all");
  const filteredItems = useMemo(() => {
    if (historyState.status !== "ready") {
      return [];
    }

    const wonGroups = new Set(historyState.history.wonItems.map((item) => item.relistingGroupId));
    if (filter === "neverWon") {
      return historyState.history.lostItems.filter((item) => !wonGroups.has(item.relistingGroupId));
    }

    if (filter === "eventuallyWon") {
      return historyState.history.lostItems.filter((item) => wonGroups.has(item.relistingGroupId));
    }

    return historyState.history.lostItems;
  }, [filter, historyState]);

  return (
    <section className="content">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Watching</p>
          <h1>Tracked lost auctions</h1>
        </div>
        <button className="primary-button" onClick={() => void refreshBuyingHistory()} type="button">
          <Gavel size={17} />
          <span>Refresh history</span>
        </button>
      </div>

      {historyState.status === "ready" ? (
        <>
          <div className="summary-grid">
            <Metric label="Lost bids" value={String(historyState.history.counts.lost)} detail="Fixture history" />
            <Metric label="Never won" value={String(historyState.history.counts.neverWon)} detail="Still unresolved" />
            <Metric
              label="Eventually won"
              value={String(historyState.history.counts.eventuallyWon)}
              detail="Won through relisting"
            />
          </div>
          <div className="segmented-control" aria-label="Lost bid filter">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")} type="button">
              All
            </button>
            <button
              className={filter === "neverWon" ? "active" : ""}
              onClick={() => setFilter("neverWon")}
              type="button"
            >
              Never won
            </button>
            <button
              className={filter === "eventuallyWon" ? "active" : ""}
              onClick={() => setFilter("eventuallyWon")}
              type="button"
            >
              Eventually won
            </button>
          </div>
          <div className="table-panel">
            {filteredItems.map((item) => (
              <HistoryRow item={item} key={item.itemId} sideLabel={formatLostStatus(item, historyState.history.wonItems)} />
            ))}
          </div>
        </>
      ) : (
        <HistoryEmptyState state={historyState} />
      )}
    </section>
  );
}

function Won({
  historyState,
  refreshBuyingHistory
}: {
  historyState: HistoryState;
  refreshBuyingHistory: () => Promise<void>;
}) {
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>();
  const chartPoints = useMemo(
    () => (historyState.status === "ready" ? buildPurchaseChartPoints(historyState.history.wonItems) : []),
    [historyState]
  );
  const selectedItem =
    historyState.status === "ready" ? historyState.history.wonItems.find((item) => item.itemId === selectedItemId) : undefined;
  const selectedPoint = chartPoints.find((point) => point.itemId === selectedItemId);

  function selectPurchase(itemId: string) {
    setSelectedItemId(itemId);
  }

  useEffect(() => {
    if (!selectedItemId) {
      return;
    }

    document.getElementById(purchaseCardDomId(selectedItemId))?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }, [selectedItemId]);

  return (
    <section className="content">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Purchases</p>
          <h1>Won item history</h1>
        </div>
        <button className="primary-button" onClick={() => void refreshBuyingHistory()} type="button">
          <ShoppingBag size={17} />
          <span>Refresh history</span>
        </button>
      </div>

      {historyState.status === "ready" ? (
        <>
          <PurchaseChart points={chartPoints} selectedItemId={selectedItemId} onSelect={selectPurchase} />

          {historyState.history.wonItems.length > 0 ? (
            <div className="candidate-list purchase-list">
              {historyState.history.wonItems.map((item) => (
                <PurchaseCard
                  item={item}
                  key={item.itemId}
                  onSelect={selectPurchase}
                  selected={item.itemId === selectedPoint?.itemId || item.itemId === selectedItem?.itemId}
                />
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              <ShoppingBag size={20} />
              <h2>No purchases yet</h2>
              <p>Won items will appear here after eBay reports them in your buying history.</p>
            </div>
          )}
        </>
      ) : (
        <HistoryEmptyState state={historyState} />
      )}
    </section>
  );
}

function PurchaseChart({
  emptyLabel = "No dated purchases to chart",
  points,
  selectedItemId,
  onSelect,
  subtitle,
  title = "Price paid over time"
}: {
  emptyLabel?: string;
  points: PurchaseChartPoint[];
  selectedItemId?: string;
  onSelect?: (itemId: string) => void;
  subtitle?: string;
  title?: string;
}) {
  const width = 760;
  const height = 260;
  const padding = { top: 22, right: 28, bottom: 42, left: 62 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const minTime = points.length > 0 ? Math.min(...points.map((point) => point.timestamp)) : 0;
  const maxTime = points.length > 0 ? Math.max(...points.map((point) => point.timestamp)) : 0;
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const lowestPrice = points.length > 0 ? Math.min(...points.map((point) => point.price.value)) : 0;
  const highestPrice = points.length > 0 ? Math.max(...points.map((point) => point.price.value)) : 0;
  const chartCurrency = firstPoint?.price.currency ?? "GBP";
  const priceStep = 20;
  const minPrice = Math.max(0, Math.floor(lowestPrice / priceStep) * priceStep);
  const maxPrice = points.length > 0 ? Math.ceil((highestPrice * 1.1) / priceStep) * priceStep : 0;
  const xTicks = points.length > 0 ? weeklyTicks(minTime, maxTime) : [];
  const yTicks = points.length > 0 ? priceTicks(minPrice, maxPrice, priceStep) : [];

  function xFor(timestamp: number): number {
    if (maxTime === minTime) {
      return padding.left + plotWidth / 2;
    }
    return padding.left + ((timestamp - minTime) / (maxTime - minTime)) * plotWidth;
  }

  function yFor(value: number): number {
    if (maxPrice === minPrice) {
      return padding.top + plotHeight / 2;
    }
    return padding.top + plotHeight - ((value - minPrice) / (maxPrice - minPrice)) * plotHeight;
  }

  return (
    <section className="purchase-chart-panel" aria-label="Purchase prices over time">
      <div className="chart-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle ?? (points.length > 0 ? `${points.length} plotted purchases` : "No dated purchase prices to plot")}</p>
        </div>
        {points.length > 0 && <span>{`${formatShortDate(firstPoint.date)} - ${formatShortDate(lastPoint.date)}`}</span>}
      </div>

      {points.length > 0 ? (
        <svg className="purchase-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Purchase price scatter plot">
          <line className="chart-axis" x1={padding.left} x2={padding.left} y1={padding.top} y2={height - padding.bottom} />
          <line
            className="chart-axis"
            x1={padding.left}
            x2={width - padding.right}
            y1={height - padding.bottom}
            y2={height - padding.bottom}
          />
          {xTicks.map((tick) => (
            <line
              className="chart-grid"
              key={`x-${tick}`}
              x1={xFor(tick)}
              x2={xFor(tick)}
              y1={padding.top}
              y2={height - padding.bottom}
            />
          ))}
          {yTicks.map((tick) => (
            <line
              className="chart-grid"
              key={`y-${tick}`}
              x1={padding.left}
              x2={width - padding.right}
              y1={yFor(tick)}
              y2={yFor(tick)}
            />
          ))}
          <text className="chart-label" x={padding.left} y={height - 12}>
            {formatShortDate(firstPoint.date)}
          </text>
          <text className="chart-label chart-label-end" x={width - padding.right} y={height - 12}>
            {formatShortDate(lastPoint.date)}
          </text>
          <text className="chart-label" x={10} y={yFor(maxPrice) + 4}>
            {formatMoneyAmount(maxPrice, chartCurrency)}
          </text>
          <text className="chart-label" x={10} y={yFor(minPrice) + 4}>
            {formatMoneyAmount(minPrice, chartCurrency)}
          </text>
          {yTicks
            .filter((tick) => tick !== minPrice && tick !== maxPrice)
            .map((tick) => (
              <text className="chart-label" key={`label-${tick}`} x={10} y={yFor(tick) + 4}>
                {formatMoneyAmount(tick, chartCurrency)}
              </text>
            ))}
          {points.map((point) => {
            const selected = point.itemId === selectedItemId;
            return (
              <g
                aria-label={`${point.title}, ${formatMoneyValue(point.price)}, ${formatShortDate(point.date)}`}
                className={selected ? "purchase-point selected" : "purchase-point"}
                key={point.itemId}
                onClick={() => onSelect?.(point.itemId)}
                onKeyDown={(event) => {
                  if (onSelect && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    onSelect(point.itemId);
                  }
                }}
                role={onSelect ? "button" : "img"}
                tabIndex={onSelect ? 0 : undefined}
              >
                <title>{`${point.title} | ${formatMoneyValue(point.price)} | ${formatShortDate(point.date)}`}</title>
                <circle cx={xFor(point.timestamp)} cy={yFor(point.price.value)} r={selected ? 8 : 6} />
              </g>
            );
          })}
        </svg>
      ) : (
        <div className="chart-empty">
          <BarChart3 size={20} />
          <span>{emptyLabel}</span>
        </div>
      )}
    </section>
  );
}

function PurchaseCard({
  item,
  onSelect,
  selected
}: {
  item: HistoryItem;
  onSelect: (itemId: string) => void;
  selected: boolean;
}) {
  const imageUrl = safeEbayImageUrl(item.imageUrl);
  const itemWebUrl = safeEbayItemUrl(item.itemWebUrl);
  const wonDate = formatAbsoluteDate(item.endTime);

  return (
    <article
      className={selected ? "candidate-card home-feed-card purchase-card selected" : "candidate-card home-feed-card purchase-card"}
      id={purchaseCardDomId(item.itemId)}
      onClick={() => onSelect(item.itemId)}
    >
      <div className="watch-thumbnail" title={imageUrl ? "eBay listing image" : "Purchase"}>
        {imageUrl ? <img alt="" loading="lazy" referrerPolicy="no-referrer" src={imageUrl} /> : <ShoppingBag size={20} />}
      </div>
      <div className="candidate-main">
        <div className="candidate-title-row">
          <div>
            <p className="artist">Won purchase</p>
            <h2>{item.title}</h2>
          </div>
        </div>
        <div className="meta-row">
          <span>{item.conditionDisplayName ?? "Condition unknown"}</span>
          <SellerLink sellerUserId={item.sellerUserId} />
          {wonDate && <span>won: {wonDate}</span>}
        </div>
        <div className="signal-row">
          <span className="signal">Won</span>
          {selected && <span className="signal attention">Selected</span>}
        </div>
      </div>
      <div className="listing-side">
        <strong>{item.currentPrice ? formatMoneyValue(item.currentPrice) : "-"}</strong>
        <span>paid price</span>
      </div>
      <div className="card-actions">
        {itemWebUrl && (
          <a
            className="icon-button"
            href={itemWebUrl}
            onClick={(event) => event.stopPropagation()}
            rel="noopener noreferrer"
            target="_blank"
            title="View on eBay"
          >
            <ExternalLink size={18} />
          </a>
        )}
      </div>
    </article>
  );
}

function Analytics({
  historyState,
  refreshBuyingHistory
}: {
  historyState: HistoryState;
  refreshBuyingHistory: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<CaptureFilter>("all");
  const [pendingItemIds, setPendingItemIds] = useState<string[]>([]);
  const [bulkCapturing, setBulkCapturing] = useState(false);
  const [message, setMessage] = useState("");
  const [locallyCapturedIds, setLocallyCapturedIds] = useState<string[]>([]);

  const items = useMemo(() => {
    const endedItems = historyState.status === "ready" ? historyState.history.endedWatchlistItems : [];
    return endedItems.map((item) =>
      locallyCapturedIds.includes(item.itemId) ? { ...item, captured: true } : item
    );
  }, [historyState, locallyCapturedIds]);
  const capturedCount = items.filter((item) => item.captured).length;
  const notCapturedItems = items.filter((item) => !item.captured);
  const filteredItems = useMemo(() => {
    if (filter === "captured") {
      return items.filter((item) => item.captured);
    }
    if (filter === "notCaptured") {
      return notCapturedItems;
    }
    return items;
  }, [filter, items, notCapturedItems]);

  async function captureVenueItemIds(venueItemIds: string[]) {
    setMessage("");
    const response = await fetch("/api/market-insights/capture", {
      body: JSON.stringify({ venueItemIds }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });

    if (!response.ok) {
      setMessage("Could not capture price history for this item");
      return;
    }

    const result = (await response.json().catch(() => ({}))) as Partial<{ captured: string[] }>;
    const captured = Array.isArray(result.captured) ? result.captured : venueItemIds;
    setLocallyCapturedIds((ids) => [...new Set([...ids, ...captured])]);
  }

  async function captureOne(itemId: string) {
    setPendingItemIds((ids) => [...ids, itemId]);
    try {
      await captureVenueItemIds([itemId]);
    } finally {
      setPendingItemIds((ids) => ids.filter((id) => id !== itemId));
    }
  }

  async function captureAllVisible() {
    const visibleNotCaptured = filteredItems.filter((item) => !item.captured).map((item) => item.itemId);
    if (visibleNotCaptured.length === 0) {
      return;
    }

    setBulkCapturing(true);
    try {
      await captureVenueItemIds(visibleNotCaptured);
    } finally {
      setBulkCapturing(false);
    }
  }

  return (
    <section className="content">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1>Price history capture</h1>
        </div>
        <button className="primary-button" onClick={() => void refreshBuyingHistory()} type="button">
          <TrendingUp size={17} />
          <span>Refresh ended items</span>
        </button>
      </div>

      {historyState.status === "ready" ? (
        <>
          <div className="summary-grid">
            <Metric label="Ended items" value={String(items.length)} detail="From your eBay watchlist" />
            <Metric label="Captured" value={String(capturedCount)} detail="In price history" />
            <Metric label="Not captured" value={String(notCapturedItems.length)} detail="Available to add" />
          </div>

          <div className="section-heading">
            <div className="segmented-control" aria-label="Capture status filter">
              <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")} type="button">
                All
              </button>
              <button className={filter === "captured" ? "active" : ""} onClick={() => setFilter("captured")} type="button">
                Captured
              </button>
              <button
                className={filter === "notCaptured" ? "active" : ""}
                onClick={() => setFilter("notCaptured")}
                type="button"
              >
                Not captured
              </button>
            </div>

            {filteredItems.some((item) => !item.captured) && (
              <button
                className="secondary-button compact capture-action"
                disabled={bulkCapturing}
                onClick={() => void captureAllVisible()}
                type="button"
              >
                <Check size={16} />
                <span>{bulkCapturing ? "Capturing..." : "Capture all visible"}</span>
              </button>
            )}
          </div>

          {message && <p className="form-message">{message}</p>}

          {filteredItems.length > 0 ? (
            <div className="candidate-list">
              {filteredItems.map((item) => (
                <AnalyticsRow
                  capturing={pendingItemIds.includes(item.itemId)}
                  item={item}
                  key={item.itemId}
                  onCapture={() => void captureOne(item.itemId)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              <TrendingUp size={20} />
              <h2>No ended watchlist items</h2>
              <p>Items you watch on eBay will appear here once their listing ends, so you can capture their final price.</p>
            </div>
          )}
        </>
      ) : (
        <HistoryEmptyState state={historyState} />
      )}
    </section>
  );
}

function AnalyticsRow({
  capturing,
  item,
  onCapture
}: {
  capturing: boolean;
  item: EndedWatchlistItem;
  onCapture: () => void;
}) {
  const imageUrl = safeEbayImageUrl(item.imageUrl);
  const endedDate = formatAbsoluteDate(item.endTime);

  return (
    <article className="candidate-card home-feed-card">
      <div className="watch-thumbnail" title={imageUrl ? "eBay listing image" : "Ended watchlist item"}>
        {imageUrl ? <img alt="" loading="lazy" referrerPolicy="no-referrer" src={imageUrl} /> : <TrendingUp size={20} />}
      </div>
      <div className="candidate-main">
        <div className="candidate-title-row">
          <div>
            <p className="artist">Ended watchlist item</p>
            <h2>{item.title}</h2>
          </div>
        </div>
        <div className="meta-row">
          <span>{item.conditionDisplayName ?? "Condition unknown"}</span>
          <SellerLink sellerUserId={item.sellerUserId} />
          {endedDate && <span>ended: {endedDate}</span>}
        </div>
        <div className="signal-row">
          <span className={item.captured ? "signal" : "signal attention"}>{item.captured ? "Captured" : "Not captured"}</span>
        </div>
      </div>
      <div className="listing-side listing-side-centered">
        <strong>{item.currentPrice ? formatMoneyValue(item.currentPrice) : "-"}</strong>
        <span>final price</span>
      </div>
      <div className="card-actions">
        {!item.captured && (
          <button className="secondary-button compact capture-action" disabled={capturing} onClick={onCapture} type="button">
            <Check size={16} />
            <span>{capturing ? "Adding..." : "Add to history"}</span>
          </button>
        )}
      </div>
    </article>
  );
}

function EbayAccountControl({
  config,
  connection,
  disconnectEbay,
  ebayStartReady,
  startEbayConnect
}: {
  config: EbayConfigStatus["config"] | undefined;
  connection: EbaySession["connection"] | undefined;
  disconnectEbay: () => Promise<void>;
  ebayStartReady: boolean;
  startEbayConnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const connected = connection?.connected === true;
  const canConnect = Boolean(config?.ready && ebayStartReady);

  if (!connected) {
    return (
      <button
        className="user-switch"
        disabled={!canConnect}
        onClick={startEbayConnect}
        title={formatEbayStatus(connection, config)}
        type="button"
      >
        <Link2 size={18} />
        <span>{formatEbayConnectLabel(connection, config, ebayStartReady)}</span>
      </button>
    );
  }

  return (
    <div className="account-menu">
      <button
        aria-expanded={open}
        className="user-switch"
        onClick={() => setOpen((current) => !current)}
        title={formatEbayStatus(connection, config)}
        type="button"
      >
        <ShieldCheck size={18} />
        <span>{formatEbayAccountLabel(connection)}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="account-dropdown">
          <div>
            <strong>{formatEbayAccountLabel(connection)}</strong>
            <p>{formatEbayStatus(connection, config)}</p>
          </div>
          <button
            className="dropdown-action"
            onClick={() => {
              setOpen(false);
              void disconnectEbay();
            }}
            type="button"
          >
            <X size={16} />
            <span>Disconnect eBay</span>
          </button>
        </div>
      )}
    </div>
  );
}

function Account({
  ebayConfig,
  ebayConnection,
  matchingPreferences,
  message,
  setMatchingPreferences
}: {
  ebayConfig: EbayConfigStatus["config"] | undefined;
  ebayConnection: EbaySession["connection"] | undefined;
  matchingPreferences: MatchingPreferences;
  message: string;
  setMatchingPreferences: (preferences: MatchingPreferences) => void;
}) {
  return (
    <section className="content account-layout">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Account and preferences</p>
          <h1>My goggler</h1>
        </div>
      </div>

      <div className="settings-panel">
        <div className="setting-row">
          <div>
            <h2>eBay session</h2>
            <p>{formatEbayStatus(ebayConnection, ebayConfig)}</p>
          </div>
          <span className={ebayConnection?.connected ? "status connected" : "status"}>{formatEbayAccountLabel(ebayConnection)}</span>
        </div>
        <div className="setting-row">
          <div>
            <h2>Matching preferences</h2>
            <p>Applies when buying history is refreshed</p>
          </div>
          <div className="matching-controls">
            <label className="checkbox-control">
              <input
                checked={matchingPreferences.exactTitleMatch}
                onChange={(event) =>
                  setMatchingPreferences({
                    ...matchingPreferences,
                    exactTitleMatch: event.target.checked
                  })
                }
                type="checkbox"
              />
              <span>Exact title match</span>
            </label>
            <label className="criteria-control">
              <span>Criteria</span>
              <textarea
                onChange={(event) =>
                  setMatchingPreferences({
                    ...matchingPreferences,
                    criteriaText: event.target.value
                  })
                }
                rows={3}
                spellCheck={false}
                value={matchingPreferences.criteriaText}
              />
            </label>
          </div>
        </div>
      </div>
      {message && <p className="form-message">{message}</p>}
    </section>
  );
}

function formatEbayConnectLabel(
  connection: EbaySession["connection"] | undefined,
  config: EbayConfigStatus["config"] | undefined,
  startReady: boolean
): string {
  if (!config) {
    return "Checking eBay";
  }

  if (!config.ready) {
    return "eBay config";
  }

  if (connection?.status === "reauth_required") {
    return startReady ? "Reconnect eBay" : "Preparing...";
  }

  if (!startReady) {
    return "Preparing...";
  }

  return "Connect eBay";
}

function formatEbayAccountLabel(connection: EbaySession["connection"] | undefined): string {
  if (!connection?.connected) {
    return "Connect eBay";
  }

  return connection.identity?.displayName ?? "Signed into eBay";
}

function formatEbayStatus(
  connection: EbaySession["connection"] | undefined,
  config: EbayConfigStatus["config"] | undefined
): string {
  if (!connection) {
    return "Checking eBay session";
  }

  if (!config) {
    return "Checking eBay configuration";
  }

  if (!config.ready) {
    return formatEbayConfigGap(config);
  }

  if (connection.connected) {
    const remaining = formatConnectionRemaining(connection.expiresAt);
    return remaining ? `Connected for ${remaining}` : "Connected for this session";
  }

  if (connection.status === "reauth_required") {
    return "Reconnect eBay to refresh this session";
  }

  return "Not connected";
}

function formatConnectionRemaining(expiresAt: string | undefined): string | undefined {
  if (!expiresAt) {
    return undefined;
  }

  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) {
    return "less than a minute";
  }

  const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
  if (remainingMinutes < 60) {
    return `${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}`;
  }

  const remainingHours = Math.floor(remainingMinutes / 60);
  const extraMinutes = remainingMinutes % 60;
  return extraMinutes > 0 ? `${remainingHours}h ${extraMinutes}m` : `${remainingHours} hour${remainingHours === 1 ? "" : "s"}`;
}

function formatEbayConfigGap(config: EbayConfigStatus["config"]): string {
  const missing = config.missing.length > 0 ? `missing ${config.missing.join(", ")}` : "";
  const invalid = config.invalid.length > 0 ? `invalid ${config.invalid.join(", ")}` : "";
  const label = config.environment === "production" ? "Production" : "Sandbox";
  return `${label} config not ready${missing || invalid ? `: ${[missing, invalid].filter(Boolean).join("; ")}` : ""}`;
}

function HistoryRow({ item, sideLabel }: { item: HistoryItem; sideLabel: string }) {
  return (
    <div className="tracking-row">
      <div>
        <h2>{item.title}</h2>
        <p>
          <SellerLink inline sellerUserId={item.sellerUserId} />
          {item.conditionDisplayName ? ` | ${item.conditionDisplayName}` : ""}
          {item.endTime ? ` | ended ${new Date(item.endTime).toLocaleDateString()}` : ""}
        </p>
      </div>
      <div className="history-side">
        <span className="price-pill">{item.maxBid ? `max bid: ${formatMoneyValue(item.maxBid)}` : "max bid unavailable"}</span>
        <span className="price-pill">{item.currentPrice ? `sold for: ${formatMoneyValue(item.currentPrice)}` : "sold price unavailable"}</span>
        <span className={sideLabel === "Eventually won" ? "status hot" : "status"}>{sideLabel}</span>
      </div>
    </div>
  );
}

function SellerLink({ inline = false, sellerUserId }: { inline?: boolean; sellerUserId?: string }) {
  const sellerUrl = ebaySellerProfileUrl(sellerUserId);
  const sellerLabel = sellerUserId?.trim() || "Unknown seller";
  const content = sellerUrl ? (
    <a className="seller-link" href={sellerUrl} rel="noreferrer" target="_blank">
      {sellerLabel}
    </a>
  ) : (
    sellerLabel
  );

  return inline ? <>{content}</> : <span>{content}</span>;
}

function HistoryEmptyState({ state }: { state: HistoryState }) {
  const message = getHistoryMessage(state);

  return (
    <div className="empty-panel">
      <Gavel size={20} />
      <h2>Buying history unavailable</h2>
      <p>{message}</p>
    </div>
  );
}

function getHistoryMessage(state: HistoryState): string {
  switch (state.status) {
    case "idle":
    case "loading":
      return "Loading buying history";
    case "ready":
      return "";
    case "sign_in_required":
    case "reauth_required":
    case "live_not_implemented":
    case "unavailable":
      return state.message;
  }
}

function storedCriteriaText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    return DEFAULT_MATCHING_PREFERENCES.criteriaText;
  }

  return LEGACY_DEFAULT_MATCHING_CRITERIA_TEXTS.includes(
    value.trim() as (typeof LEGACY_DEFAULT_MATCHING_CRITERIA_TEXTS)[number]
  )
    ? DEFAULT_MATCHING_PREFERENCES.criteriaText
    : value;
}

function filterHomeRows(
  rows: HomeFeedRow[],
  filter: HomeFeedFilter,
  relistingFormatFilter: RelistingFormatFilter = "both"
): HomeFeedRow[] {
  switch (filter) {
    case "search":
      return rows;
    case "onWatchlist":
      return rows.filter((row) => row.modelList === "ebay" && row.section === "watchlist");
    case "relistings":
      return rows
        .filter((row) => row.modelList === "relisting_candidate")
        .filter((row) => relistingFormatFilter === "both" || row.tags.includes(formatTagForRelistingFilter(relistingFormatFilter)));
    case "won":
      return rows.filter((row) => row.modelList === "ebay" && row.section === "won");
    case "neverWon":
      return rows.filter((row) => row.modelList === "ebay" && row.section === "unresolved");
    case "all":
      return rows;
  }
}

function formatTagForRelistingFilter(filter: Exclude<RelistingFormatFilter, "both">): "Auction" | "Buy now" {
  return filter === "auction" ? "Auction" : "Buy now";
}

function searchRowsForState(searchState: HomeSearchState, loadedRows: HomeFeedRow[]): HomeFeedRow[] {
  if (searchState.status !== "ready") {
    return [];
  }

  return searchState.rows.map((row) => tagLiveSearchRow(row, loadedRows));
}

function tagLiveSearchRow(row: HomeFeedRow, loadedRows: HomeFeedRow[]): HomeFeedRow {
  const tags = new Set(row.tags);
  const normalizedUrl = normalizedEbayUrl(row.itemWebUrl);
  const normalizedTitle = normalizeSearchComparable(row.title);
  const sameUrlRows = normalizedUrl ? loadedRows.filter((loadedRow) => normalizedEbayUrl(loadedRow.itemWebUrl) === normalizedUrl) : [];
  const sameTitleRows = loadedRows.filter((loadedRow) => normalizeSearchComparable(loadedRow.title) === normalizedTitle);
  const sameGroupRows = row.relistingGroupId
    ? loadedRows.filter((loadedRow) => loadedRow.relistingGroupId === row.relistingGroupId)
    : [];
  const matchedRows = [...sameUrlRows, ...sameGroupRows, ...sameTitleRows];
  const onWatchlist = matchedRows.some((loadedRow) => loadedRow.section === "watchlist");
  const neverWon = matchedRows.some((loadedRow) => loadedRow.modelList === "ebay" && loadedRow.section === "unresolved");
  const won = matchedRows.some((loadedRow) => loadedRow.tags.includes("Won"));

  if (onWatchlist) {
    tags.add("On eBay watchlist");
  }
  if (neverWon) {
    tags.add("Relisting candidate");
    tags.add("Never won");
    if (!onWatchlist) {
      tags.add("Not watched");
    }
  }
  if (won) {
    tags.add("Won");
  }

  return {
    ...row,
    tags: [...tags],
    actions: [...new Set([...row.actions, ...(row.itemWebUrl ? ["open_on_ebay" as const] : [])])]
  };
}

function normalizedEbayUrl(value: string | undefined): string | undefined {
  const safeUrl = safeEbayItemUrl(value);
  return safeUrl ? new URL(safeUrl).toString() : undefined;
}

function normalizeSearchComparable(value: string): string {
  return value.trim().toLocaleLowerCase("en-GB").replace(/\s+/g, " ");
}

function purchaseCardDomId(itemId: string): string {
  return `purchase-${itemId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function weeklyTicks(minTime: number, maxTime: number): number[] {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const first = startOfWeekUtc(minTime);
  const last = startOfWeekUtc(maxTime) + weekMs;
  const ticks: number[] = [];

  for (let tick = first; tick <= last; tick += weekMs) {
    ticks.push(tick);
  }

  return ticks;
}

function startOfWeekUtc(timestamp: number): number {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + mondayOffset);
}

function priceTicks(minPrice: number, maxPrice: number, step: number): number[] {
  const ticks: number[] = [];
  for (let tick = minPrice; tick <= maxPrice; tick += step) {
    ticks.push(tick);
  }
  return ticks;
}

function formatHomeSection(section: HomeFeedRow["section"]): string {
  switch (section) {
    case "search_result":
      return "Live eBay listing";
    case "watchlist":
      return "eBay watchlist";
    case "needs_action":
      return "Relisting candidate";
    case "won":
      return "Won";
    case "unresolved":
      return "Unresolved lost bid";
    case "resolved":
      return "Eventually won";
  }
}

function formatLostStatus(item: HistoryItem, wonItems: HistoryItem[]): string {
  const wasEventuallyWon = wonItems.some((wonItem) => wonItem.relistingGroupId === item.relistingGroupId);
  return wasEventuallyWon ? "Eventually won" : "Never won";
}

function formatRelativeDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short"
  });
}

function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit"
  });
}

function formatMoneyValue(value: { value: number; currency: string } | undefined): string {
  if (!value) {
    return "-";
  }

  return formatMoneyAmount(value.value, value.currency);
}

function formatMoneyAmount(value: number, currency: string): string {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-GB", {
    currency,
    style: "currency"
  }).format(value);
}

function formatHomeFeedSidePrice(row: HomeFeedRow): string {
  if (row.section === "unresolved" || row.section === "resolved") {
    return formatMoneyValue(row.currentPrice);
  }

  return formatMoneyValue(row.currentPrice);
}

function homeFeedSideLabel(row: HomeFeedRow): string {
  if (row.section === "unresolved" || row.section === "resolved") {
    return row.currentPrice ? "sold for" : "sold price";
  }

  if (row.section === "won") {
    return row.currentPrice ? "paid price" : "paid price";
  }

  return row.currentPrice ? "current price" : "price unavailable";
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  );
}
