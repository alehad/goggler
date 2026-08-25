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
  Mic,
  MicOff,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TrendingUp,
  X
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  DEFAULT_MATCHING_PREFERENCES,
  LEGACY_DEFAULT_MATCHING_CRITERIA_TEXTS,
  type MatchingPreferences
} from "../src/ebay/matching-preferences.ts";
import { buildPurchaseChartPoints, type PurchaseChartPoint } from "../src/ebay/purchase-analytics.ts";
import { ebaySellerProfileUrl } from "../src/ebay/seller-profile.ts";
import { safeEbayImageUrl, safeEbayItemUrl } from "../src/http/safe-external-url.ts";
import type { WatchlistAutomationCandidate, WatchlistAutomationEvent } from "../src/market-insights/watchlist-automation.ts";
import { formatAbsoluteDate } from "../src/ui/date-format.ts";
import { getSpeechRecognitionConstructor, type SpeechRecognition, type SpeechRecognitionEvent } from "../src/ui/speech-recognition.ts";

type Tab = "dashboard" | "tracking" | "won" | "analytics" | "account";
type LostFilter = "all" | "neverWon" | "eventuallyWon";
type CaptureFilter = "all" | "captured" | "notCaptured";
type HomeFeedFilter = "search" | "all" | "onWatchlist" | "relistings" | "won" | "neverWon";
type RelistingFormatFilter = "both" | "auction" | "buyNow";
const MATCHING_PREFERENCES_STORAGE_KEY = "goggler.matchingPreferences";

// The assistant's answer text can echo real eBay listing titles, which are third-party
// content (any seller can title a listing however they like) flowing in unsanitized from
// src/persistence/market-price-records.ts. Markdown syntax in a title (e.g. an embedded
// image) would otherwise render as a live <img>/<a> and fire an unsanitized cross-origin
// request the moment the answer renders — restrict both to the same trusted-eBay-host allow
// list already used for images/links sourced directly from the API elsewhere in this file.
const AI_MARKDOWN_COMPONENTS: Components = {
  img: ({ alt, src }) => {
    const safeSrc = typeof src === "string" ? safeEbayImageUrl(src) : undefined;
    return safeSrc ? <img alt={alt ?? ""} src={safeSrc} /> : null;
  },
  a: ({ children, href }) => {
    const safeHref = typeof href === "string" ? safeEbayItemUrl(href) : undefined;
    return safeHref ? (
      <a href={safeHref} rel="noopener noreferrer" target="_blank">
        {children}
      </a>
    ) : (
      <>{children}</>
    );
  }
};

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

type WinStatusFilter = "all" | "won" | "eventuallyWon" | "neverWon";

type AnalyticsItem = HistoryItem & { captured: boolean; won: boolean; eventuallyWon: boolean };

type MatchedSalePoint = {
  venueItemId: string;
  title: string;
  price: { value: number; currency: string };
  endedAt?: string;
  won: boolean;
};

type MatchedSalesSummary = {
  count: number;
  average: number;
  lowest: { value: number; endedAt?: string };
  highest: { value: number; endedAt?: string };
};

type MatchedSalesState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; sales: MatchedSalePoint[]; summary?: MatchedSalesSummary }
  | { status: "unavailable" };

type MatchedSalesSummariesState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; summaries: Record<string, MatchedSalesSummary | undefined> }
  | { status: "unavailable" };

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
  warnings?: string[];
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
  const [analyticsSelectedItemId, setAnalyticsSelectedItemId] = useState<string | undefined>();
  const [analyticsGroupFilter, setAnalyticsGroupFilter] = useState<string | undefined>();

  function viewPriceHistory(itemId: string, relistingGroupId: string | undefined) {
    setAnalyticsSelectedItemId(itemId);
    setAnalyticsGroupFilter(relistingGroupId);
    setActiveTab("analytics");
  }

  function markItemsCaptured(itemIds: string[]) {
    setHistoryState((current) => {
      if (current.status !== "ready") {
        return current;
      }

      const idSet = new Set(itemIds);
      return {
        ...current,
        history: {
          ...current.history,
          endedWatchlistItems: current.history.endedWatchlistItems.map((item) =>
            idSet.has(item.itemId) ? { ...item, captured: true } : item
          )
        }
      };
    });
  }

  function removeHistoryItems(itemIds: string[]) {
    setHistoryState((current) => {
      if (current.status !== "ready") {
        return current;
      }

      const idSet = new Set(itemIds);
      return {
        ...current,
        history: {
          ...current.history,
          endedWatchlistItems: current.history.endedWatchlistItems.filter((item) => !idSet.has(item.itemId))
        }
      };
    });
  }

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

    let response: Response;
    try {
      response = await fetch("/api/ebay/buying-history", {
        body: JSON.stringify(matchingPreferences),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
    } catch {
      if (previousHistory) {
        setHistoryState({ status: "ready", history: previousHistory });
        return;
      }
      setHistoryState({
        status: "unavailable",
        message: "Could not reach the server. Check your connection and try again."
      });
      return;
    }

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
            matchingPreferences={matchingPreferences}
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
            matchingPreferences={matchingPreferences}
            refreshBuyingHistory={refreshBuyingHistory}
            onViewPriceHistory={viewPriceHistory}
          />
        )}
        {activeTab === "analytics" && (
          <Analytics
            historyState={historyState}
            matchingPreferences={matchingPreferences}
            refreshBuyingHistory={refreshBuyingHistory}
            selectedItemId={analyticsSelectedItemId}
            onSelectItem={setAnalyticsSelectedItemId}
            groupFilter={analyticsGroupFilter}
            onClearGroupFilter={() => setAnalyticsGroupFilter(undefined)}
            onItemsCaptured={markItemsCaptured}
            onItemsRemoved={removeHistoryItems}
          />
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
  matchingPreferences,
  searchQuery,
  searchState,
  refreshBuyingHistory
}: {
  clearSearch: () => void;
  historyState: HistoryState;
  matchingPreferences: MatchingPreferences;
  searchQuery: string;
  searchState: HomeSearchState;
  refreshBuyingHistory: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<HomeFeedFilter>("onWatchlist");
  const [relistingFormatFilter, setRelistingFormatFilter] = useState<RelistingFormatFilter>("both");
  const [locallyWatchedIds, setLocallyWatchedIds] = useState<string[]>([]);
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [findingAuctions, setFindingAuctions] = useState(false);
  const [automationStatus, setAutomationStatus] = useState("");
  const [justAddedRows, setJustAddedRows] = useState<HomeFeedRow[]>([]);
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

    const knownIds = new Set(updatedRows.map((row) => row.id));
    const newlyAddedRows = justAddedRows.filter((row) => !knownIds.has(row.id));
    const combinedRows = [...newlyAddedRows, ...updatedRows];

    return filter === "search" ? searchRowsForState(searchState, combinedRows) : filterHomeRows(combinedRows, filter, relistingFormatFilter);
  }, [filter, historyState, justAddedRows, locallyWatchedIds, relistingFormatFilter, searchState]);

  async function findAndWatchNewAuctions() {
    setAutomationStatus("Starting search...");
    setFindingAuctions(true);
    try {
      const response = await fetch("/api/market-insights/watchlist-automation", {
        body: JSON.stringify(matchingPreferences),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });

      if (!response.ok || !response.body) {
        setAutomationStatus("Could not search for new auctions to watch");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;
        buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim()) {
            handleAutomationEvent(JSON.parse(line));
          }
        }
      }

      await refreshBuyingHistory();
      setJustAddedRows([]);
    } finally {
      setFindingAuctions(false);
    }
  }

  function handleAutomationEvent(event: WatchlistAutomationEvent) {
    switch (event.type) {
      case "search_started":
        setAutomationStatus(`Searching ${event.recordId}... (${event.completed}/${event.total} record IDs)`);
        break;
      case "search_completed":
        setAutomationStatus(`Searched ${event.completed}/${event.total} record IDs...`);
        break;
      case "added":
        setJustAddedRows((existing) => [candidateToRow(event.candidate), ...existing]);
        setAutomationStatus(`Added "${event.candidate.title}" to the watchlist`);
        break;
      case "already_watched":
      case "skipped_per_record_cap":
      case "failed":
        break;
      case "done": {
        const { result } = event;
        setAutomationStatus(
          `Searched ${result.recordIdsSearched} record ID${result.recordIdsSearched === 1 ? "" : "s"}, ` +
            `found ${result.candidatesFound} live auction${result.candidatesFound === 1 ? "" : "s"}. ` +
            `Added ${result.added.length} new item${result.added.length === 1 ? "" : "s"} to the watchlist` +
            (result.alreadyWatched ? ` (${result.alreadyWatched} already watched)` : "") +
            (result.skippedPerRecordCap
              ? ` (${result.skippedPerRecordCap} skipped: per-record limit reached for that catalogue number)`
              : "") +
            "." +
            (result.failed.length > 0
              ? ` Failed to add ${result.failed.length}: ${result.failed.map((item) => `${item.title} (${item.reason})`).join("; ")}.`
              : "")
        );
        break;
      }
    }
  }

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
        <div className="section-heading-actions">
          <button
            className="secondary-button compact"
            disabled={findingAuctions}
            onClick={() => void findAndWatchNewAuctions()}
            type="button"
          >
            <Gavel size={16} />
            <span>{findingAuctions ? "Searching..." : "Find & watch new auctions"}</span>
          </button>
          <button className="primary-button" onClick={() => void refreshBuyingHistory()} type="button">
            <Sparkles size={17} />
            <span>Refresh feed</span>
          </button>
        </div>
      </div>

      {automationStatus && <p className="form-message">{automationStatus}</p>}

      {historyState.status === "ready" && historyState.history.warnings && historyState.history.warnings.length > 0 && (
        <div className="warning-banner">
          {historyState.history.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

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
            <h2>{row.title}</h2>
          </div>
          {row.matchConfidence !== undefined && <span className="confidence">{row.matchConfidence}%</span>}
        </div>

        <div className="meta-row">
          <span>seller: <SellerLink inline sellerUserId={row.sellerUserId} /></span>
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
  matchingPreferences,
  refreshBuyingHistory,
  onViewPriceHistory
}: {
  historyState: HistoryState;
  matchingPreferences: MatchingPreferences;
  refreshBuyingHistory: () => Promise<void>;
  onViewPriceHistory: (itemId: string, relistingGroupId: string | undefined) => void;
}) {
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [summariesState, setSummariesState] = useState<MatchedSalesSummariesState>({ status: "idle" });
  const wonItems = useMemo(
    () => (historyState.status === "ready" ? historyState.history.wonItems : []),
    [historyState]
  );
  const chartPoints = useMemo(() => buildPurchaseChartPoints(wonItems), [wonItems]);
  const filteredItems = useMemo(() => {
    const term = searchQuery.trim().toLocaleLowerCase("en-GB");
    if (!term) {
      return wonItems;
    }
    return wonItems.filter(
      (item) => item.title.toLocaleLowerCase("en-GB").includes(term) || item.sellerUserId?.toLocaleLowerCase("en-GB").includes(term)
    );
  }, [wonItems, searchQuery]);
  const selectedItem = wonItems.find((item) => item.itemId === selectedItemId);
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

  useEffect(() => {
    const groups = new Map<string, { relistingGroupId: string; currency: string }>();
    for (const item of wonItems) {
      if (item.relistingGroupId && item.currentPrice?.currency) {
        groups.set(matchedSalesSummaryKey(item.relistingGroupId, item.currentPrice.currency), {
          relistingGroupId: item.relistingGroupId,
          currency: item.currentPrice.currency
        });
      }
    }

    if (groups.size === 0) {
      setSummariesState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setSummariesState({ status: "loading" });

    fetch("/api/market-insights/matched-sales/summary", {
      body: JSON.stringify({ groups: [...groups.values()], matchingPreferences }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("matched_sales_summary_unavailable"))))
      .then((body: { summaries?: Record<string, MatchedSalesSummary | undefined> }) => {
        if (!cancelled) {
          setSummariesState({ status: "ready", summaries: body.summaries ?? {} });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSummariesState({ status: "unavailable" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [wonItems, matchingPreferences.criteriaText, matchingPreferences.exactTitleMatch]);

  const summaries = summariesState.status === "ready" ? summariesState.summaries : {};

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

          <form className="search-box tab-search" onSubmit={(event) => event.preventDefault()}>
            <Search size={18} />
            <input
              aria-label="Search purchases"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by title or seller"
              value={searchQuery}
            />
          </form>

          {filteredItems.length > 0 ? (
            <div className="candidate-list purchase-list">
              {filteredItems.map((item) => (
                <PurchaseCard
                  item={item}
                  key={item.itemId}
                  onSelect={selectPurchase}
                  onViewPriceHistory={onViewPriceHistory}
                  selected={item.itemId === selectedPoint?.itemId || item.itemId === selectedItem?.itemId}
                  summary={
                    item.relistingGroupId && item.currentPrice?.currency
                      ? summaries[matchedSalesSummaryKey(item.relistingGroupId, item.currentPrice.currency)]
                      : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              <ShoppingBag size={20} />
              <h2>No purchases yet</h2>
              <p>{searchQuery.trim() ? "No purchases match your search." : "Won items will appear here after eBay reports them in your buying history."}</p>
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
            const pointClasses = ["purchase-point", selected && "selected", point.won && "won"]
              .filter(Boolean)
              .join(" ");
            return (
              <g
                aria-label={`${point.title}, ${formatMoneyValue(point.price)}, ${formatShortDate(point.date)}${point.won ? ", won" : ""}`}
                className={pointClasses}
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
  onViewPriceHistory,
  selected,
  summary
}: {
  item: HistoryItem;
  onSelect: (itemId: string) => void;
  onViewPriceHistory: (itemId: string, relistingGroupId: string | undefined) => void;
  selected: boolean;
  summary: MatchedSalesSummary | undefined;
}) {
  const imageUrl = safeEbayImageUrl(item.imageUrl);
  const wonDate = formatAbsoluteDate(item.endTime);
  const paidValue = item.currentPrice?.value;
  const paidCurrency = item.currentPrice?.currency;
  const comparableSummary = summary && summary.count > 1 ? summary : undefined;
  const diff = comparableSummary && paidValue !== undefined ? paidValue - comparableSummary.average : undefined;
  const diffPercent =
    diff !== undefined && comparableSummary && comparableSummary.average !== 0 ? (diff / comparableSummary.average) * 100 : undefined;

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
            <h2>{item.title}</h2>
          </div>
        </div>
        <div className="meta-row">
          <span>seller: <SellerLink inline sellerUserId={item.sellerUserId} /></span>
          {wonDate && <span>won: {wonDate}</span>}
        </div>
        <div className="signal-row">
          <span className="signal">Won</span>
          {selected && <span className="signal attention">Selected</span>}
        </div>
      </div>
      <div className="market-stats">
        <div className="stat-row">
          <strong className="stat-value">{item.currentPrice ? formatMoneyValue(item.currentPrice) : "-"}</strong>
          <span className="stat-label">paid</span>
        </div>
        <div className="stat-row">
          <strong className="stat-value">
            {comparableSummary && paidCurrency ? formatMoneyAmount(comparableSummary.average, paidCurrency) : "--"}
          </strong>
          <span className="stat-label">avg</span>
        </div>
        <div className={diff === undefined ? "stat-row" : diff > 0 ? "stat-row negative" : diff < 0 ? "stat-row positive" : "stat-row"}>
          <strong className="stat-value">
            {diff !== undefined && paidCurrency ? `${diff > 0 ? "+" : ""}${formatMoneyAmount(diff, paidCurrency)}` : "--"}
          </strong>
          {diff !== undefined && diffPercent !== undefined && (
            <span className="stat-note">{`${diffPercent > 0 ? "+" : ""}${diffPercent.toFixed(0)}%`}</span>
          )}
          <span className="stat-label">diff</span>
        </div>
      </div>
      <div className="card-actions">
        <button
          className="icon-button"
          onClick={(event) => {
            event.stopPropagation();
            onViewPriceHistory(item.itemId, item.relistingGroupId);
          }}
          title="View price history"
          type="button"
        >
          <TrendingUp size={18} />
        </button>
      </div>
    </article>
  );
}

function Analytics({
  historyState,
  matchingPreferences,
  refreshBuyingHistory,
  selectedItemId,
  onSelectItem,
  groupFilter,
  onClearGroupFilter,
  onItemsCaptured,
  onItemsRemoved
}: {
  historyState: HistoryState;
  matchingPreferences: MatchingPreferences;
  refreshBuyingHistory: () => Promise<void>;
  selectedItemId: string | undefined;
  onSelectItem: (itemId: string | undefined) => void;
  groupFilter: string | undefined;
  onClearGroupFilter: () => void;
  onItemsCaptured: (itemIds: string[]) => void;
  onItemsRemoved: (itemIds: string[]) => void;
}) {
  const [filter, setFilter] = useState<CaptureFilter>("all");
  const [winFilter, setWinFilter] = useState<WinStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingItemIds, setPendingItemIds] = useState<string[]>([]);
  const [deletingItemIds, setDeletingItemIds] = useState<string[]>([]);
  const [bulkCapturing, setBulkCapturing] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [matchedSalesState, setMatchedSalesState] = useState<MatchedSalesState>({ status: "idle" });
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFilterItemIds, setAiFilterItemIds] = useState<string[] | undefined>();
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setVoiceSupported(Boolean(getSpeechRecognitionConstructor(typeof window === "undefined" ? undefined : window)));
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const items: AnalyticsItem[] = useMemo(() => {
    if (historyState.status !== "ready") {
      return [];
    }

    const { endedWatchlistItems, wonItems } = historyState.history;
    const wonItemIds = new Set(wonItems.map((won) => won.itemId));
    const wonGroupIds = new Set(
      wonItems.map((won) => won.relistingGroupId).filter((groupId): groupId is string => Boolean(groupId))
    );

    const watchlistRows: AnalyticsItem[] = endedWatchlistItems.map((item) => {
      const won = wonItemIds.has(item.itemId);
      return {
        ...item,
        won,
        eventuallyWon: !won && Boolean(item.relistingGroupId) && wonGroupIds.has(item.relistingGroupId as string)
      };
    });
    const watchlistIds = new Set(watchlistRows.map((row) => row.itemId));
    const wonOnlyRows: AnalyticsItem[] = wonItems
      .filter((won) => !watchlistIds.has(won.itemId))
      .map((won) => ({ ...won, captured: false, won: true, eventuallyWon: false }));

    return [...watchlistRows, ...wonOnlyRows].sort((a, b) => Date.parse(b.endTime ?? "") - Date.parse(a.endTime ?? ""));
  }, [historyState]);
  const capturedCount = items.filter((item) => item.captured).length;
  const notCapturedCount = items.length - capturedCount;
  const filteredItems = useMemo(() => {
    if (aiFilterItemIds) {
      const itemsById = new Map(items.map((item) => [item.itemId, item]));
      return aiFilterItemIds.flatMap((itemId) => {
        const item = itemsById.get(itemId);
        return item ? [item] : [];
      });
    }

    const groupFiltered = groupFilter ? items.filter((item) => item.relistingGroupId === groupFilter) : items;
    const captureFiltered =
      filter === "captured"
        ? groupFiltered.filter((item) => item.captured)
        : filter === "notCaptured"
          ? groupFiltered.filter((item) => !item.captured)
          : groupFiltered;
    const winFiltered =
      winFilter === "won"
        ? captureFiltered.filter((item) => item.won)
        : winFilter === "eventuallyWon"
          ? captureFiltered.filter((item) => item.eventuallyWon)
          : winFilter === "neverWon"
            ? captureFiltered.filter((item) => !item.won && !item.eventuallyWon)
            : captureFiltered;
    const term = searchQuery.trim().toLocaleLowerCase("en-GB");
    if (!term) {
      return winFiltered;
    }
    return winFiltered.filter(
      (item) => item.title.toLocaleLowerCase("en-GB").includes(term) || item.sellerUserId?.toLocaleLowerCase("en-GB").includes(term)
    );
  }, [filter, winFilter, items, searchQuery, groupFilter, aiFilterItemIds]);

  const selectedItem = items.find((item) => item.itemId === selectedItemId);

  useEffect(() => {
    if (!selectedItemId) {
      return;
    }

    document.getElementById(analyticsRowDomId(selectedItemId))?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }, [selectedItemId]);

  useEffect(() => {
    if (!selectedItem) {
      setMatchedSalesState({ status: "idle" });
      return;
    }

    const relistingGroupId = selectedItem.relistingGroupId;
    const currency = selectedItem.currentPrice?.currency;
    if (!relistingGroupId || !currency) {
      setMatchedSalesState({ status: "unavailable" });
      return;
    }

    let cancelled = false;
    setMatchedSalesState({ status: "loading" });

    const params = new URLSearchParams({
      relistingGroupId,
      currency,
      exactTitleMatch: String(matchingPreferences.exactTitleMatch),
      criteriaText: matchingPreferences.criteriaText
    });

    fetch(`/api/market-insights/matched-sales?${params.toString()}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("matched_sales_unavailable"))))
      .then((body: { sales?: MatchedSalePoint[]; summary?: MatchedSalesSummary }) => {
        if (!cancelled) {
          setMatchedSalesState({ status: "ready", sales: Array.isArray(body.sales) ? body.sales : [], summary: body.summary });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMatchedSalesState({ status: "unavailable" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [matchingPreferences.criteriaText, matchingPreferences.exactTitleMatch, selectedItem]);

  const matchedSales = matchedSalesState.status === "ready" ? matchedSalesState.sales : [];
  const summary = matchedSalesState.status === "ready" ? matchedSalesState.summary : undefined;
  const chartPoints: PurchaseChartPoint[] = useMemo(
    () =>
      matchedSales
        .flatMap((sale): PurchaseChartPoint[] => {
          const timestamp = sale.endedAt ? Date.parse(sale.endedAt) : Number.NaN;
          if (!Number.isFinite(timestamp)) {
            return [];
          }
          return [{ itemId: sale.venueItemId, title: sale.title, price: sale.price, timestamp, date: sale.endedAt ?? "", won: sale.won }];
        })
        .sort((left, right) => left.timestamp - right.timestamp),
    [matchedSales]
  );
  const wonSales = matchedSales.filter((sale) => sale.won);
  const myPricePaid = wonSales[wonSales.length - 1];
  const salesCurrency = matchedSales[0]?.price.currency ?? selectedItem?.currentPrice?.currency;

  async function askAssistant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = aiQuestion.trim();
    if (!question || aiLoading) {
      return;
    }

    setAiLoading(true);
    setAiError("");

    try {
      const response = await fetch("/api/market-insights/chat", {
        body: JSON.stringify({
          question,
          exactTitleMatch: matchingPreferences.exactTitleMatch,
          criteriaText: matchingPreferences.criteriaText
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });

      if (!response.ok) {
        setAiError("Could not answer that question right now.");
        return;
      }

      const result = (await response.json().catch(() => ({}))) as Partial<{ answer: string; itemIds: string[] }>;
      setAiAnswer(typeof result.answer === "string" ? result.answer : "");
      setAiFilterItemIds(Array.isArray(result.itemIds) ? result.itemIds : []);
    } catch {
      setAiError("Could not answer that question right now.");
    } finally {
      setAiLoading(false);
    }
  }

  function clearAiFilter() {
    setAiFilterItemIds(undefined);
    setAiAnswer("");
    setAiError("");
  }

  function toggleVoiceInput() {
    if (voiceListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognitionConstructor(typeof window === "undefined" ? undefined : window);
    if (!SpeechRecognitionCtor) {
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-GB";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i]?.[0]?.transcript ?? "";
      }
      setAiQuestion(transcript);
    };

    recognition.onerror = (event) => {
      setVoiceError(
        event.error === "not-allowed" || event.error === "permission-denied"
          ? "Microphone access denied"
          : event.error === "no-speech"
            ? "Didn't catch that — try again"
            : "Voice input failed"
      );
      setVoiceListening(false);
    };

    recognition.onend = () => {
      setVoiceListening(false);
    };

    recognitionRef.current = recognition;
    setVoiceError("");
    setVoiceListening(true);
    recognition.start();
  }

  async function captureVenueItems(itemsToCapture: AnalyticsItem[]) {
    setMessage("");
    const response = await fetch("/api/market-insights/capture", {
      body: JSON.stringify({ items: itemsToCapture.map(toCaptureRequestItem) }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });

    if (!response.ok) {
      setMessage("Could not capture price history for this item");
      return;
    }

    const result = (await response.json().catch(() => ({}))) as Partial<{ captured: string[]; skipped: string[] }>;
    const captured = Array.isArray(result.captured) ? result.captured : itemsToCapture.map((item) => item.itemId);
    const skipped = Array.isArray(result.skipped) ? result.skipped : [];
    onItemsCaptured(captured);

    if (skipped.length > 0) {
      const skippedTitles = skipped.map((itemId) => items.find((item) => item.itemId === itemId)?.title ?? itemId);
      setMessage(
        `Captured ${captured.length} of ${itemsToCapture.length} item${itemsToCapture.length === 1 ? "" : "s"}. ` +
          `Skipped (price could not be verified): ${skippedTitles.join(", ")}. Try refreshing and capturing again.`
      );
    }
  }

  async function captureOne(itemId: string) {
    const item = items.find((candidate) => candidate.itemId === itemId);
    if (!item) {
      return;
    }

    setPendingItemIds((ids) => [...ids, itemId]);
    try {
      await captureVenueItems([item]);
    } finally {
      setPendingItemIds((ids) => ids.filter((id) => id !== itemId));
    }
  }

  async function captureAllVisible() {
    const visibleNotCaptured = filteredItems.filter((item) => !item.captured && item.list === "WatchList");
    if (visibleNotCaptured.length === 0) {
      return;
    }

    setBulkCapturing(true);
    try {
      await captureVenueItems(visibleNotCaptured);
    } finally {
      setBulkCapturing(false);
    }
  }

  async function deleteHistoryItems(itemIds: string[]) {
    setMessage("");
    let response: Response;
    try {
      response = await fetch("/api/market-insights/history", {
        body: JSON.stringify({ itemIds }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "DELETE"
      });
    } catch {
      setMessage("Could not remove items from price history: network error");
      return;
    }

    if (!response.ok) {
      setMessage("Could not remove items from price history");
      return;
    }

    onItemsRemoved(itemIds);
  }

  async function deleteOne(itemId: string) {
    setDeletingItemIds((ids) => [...ids, itemId]);
    try {
      await deleteHistoryItems([itemId]);
    } finally {
      setDeletingItemIds((ids) => ids.filter((id) => id !== itemId));
    }
  }

  async function deleteAllVisible() {
    const deletable = filteredItems.filter((item) => item.captured && item.list === "WatchList");
    if (deletable.length === 0) {
      return;
    }
    if (
      !window.confirm(
        `Remove ${deletable.length} item${deletable.length === 1 ? "" : "s"} from price history? This can't be undone.`
      )
    ) {
      return;
    }

    setBulkDeleting(true);
    try {
      await deleteHistoryItems(deletable.map((item) => item.itemId));
    } finally {
      setBulkDeleting(false);
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
            <Metric label="Items" value={String(items.length)} detail="Ended watchlist + won purchases" />
            <Metric label="Captured" value={String(capturedCount)} detail="In price history" />
            <Metric label="Not captured" value={String(notCapturedCount)} detail="Available to add" />
          </div>

          <PurchaseChart
            emptyLabel={
              !selectedItem
                ? "Select an item below to see its price history"
                : matchedSalesState.status === "loading"
                  ? "Loading matched sales..."
                  : !selectedItem.relistingGroupId || !selectedItem.currentPrice
                    ? "This item doesn't have enough data to match other sales"
                    : "No matched sales found yet"
            }
            points={chartPoints}
            subtitle={selectedItem ? `Matched sales for "${selectedItem.title}"` : undefined}
            title="Matched sales over time"
          />

          {selectedItem && matchedSalesState.status === "ready" && matchedSales.length > 0 && (
            <div className="summary-grid">
              <Metric label="Sales" value={String(matchedSales.length)} detail="Matched listings" />
              <Metric
                label="My price paid"
                value={myPricePaid ? formatMoneyAmount(myPricePaid.price.value, myPricePaid.price.currency) : "-"}
                detail={myPricePaid?.endedAt ? formatShortDate(myPricePaid.endedAt) : "Not won yet"}
              />
              <Metric
                label="Average"
                value={summary && salesCurrency ? formatMoneyAmount(summary.average, salesCurrency) : "-"}
                detail={`${matchedSales.length} matched sales`}
              />
              <Metric
                label="Lowest"
                value={summary && salesCurrency ? formatMoneyAmount(summary.lowest.value, salesCurrency) : "-"}
                detail={summary?.lowest.endedAt ? formatShortDate(summary.lowest.endedAt) : ""}
              />
              <Metric
                label="Highest"
                value={summary && salesCurrency ? formatMoneyAmount(summary.highest.value, salesCurrency) : "-"}
                detail={summary?.highest.endedAt ? formatShortDate(summary.highest.endedAt) : ""}
              />
            </div>
          )}

          {groupFilter && (
            <div className="group-filter-banner">
              <span>Showing matches for "{selectedItem?.title ?? "selected item"}"</span>
              <button className="secondary-button compact" onClick={onClearGroupFilter} type="button">
                <X size={14} />
                <span>Clear filter</span>
              </button>
            </div>
          )}

          <form className="ai-assistant" onSubmit={(event) => void askAssistant(event)}>
            <div className="ai-assistant-input-row">
              <input
                aria-label="Ask about your price history"
                onChange={(event) => setAiQuestion(event.target.value)}
                placeholder='Ask about your items, e.g. "what is the highest paid item?"'
                value={aiQuestion}
              />
              {voiceSupported && (
                <button
                  aria-label={voiceListening ? "Stop listening" : "Ask by voice"}
                  className={voiceListening ? "secondary-button compact listening" : "secondary-button compact"}
                  disabled={aiLoading}
                  onClick={toggleVoiceInput}
                  type="button"
                >
                  {voiceListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}
              <button className="primary-button compact" disabled={aiLoading || aiQuestion.trim().length === 0} type="submit">
                <span>{aiLoading ? "Thinking..." : "Ask"}</span>
              </button>
            </div>
            {voiceError && <p className="form-message">{voiceError}</p>}
            {aiError && <p className="form-message">{aiError}</p>}
            {aiAnswer && (
              <div className="ai-assistant-answer">
                <div className="ai-assistant-markdown">
                  <ReactMarkdown components={AI_MARKDOWN_COMPONENTS} remarkPlugins={[remarkGfm]}>
                    {aiAnswer}
                  </ReactMarkdown>
                </div>
                {aiFilterItemIds && (
                  <button className="secondary-button compact" onClick={clearAiFilter} type="button">
                    <X size={14} />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            )}
          </form>

          <form className="search-box tab-search" onSubmit={(event) => event.preventDefault()}>
            <Search size={18} />
            <input
              aria-label="Search ended watchlist items"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by title or seller"
              value={searchQuery}
            />
          </form>

          <div className="section-heading">
            <div className="filter-row">
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

              <div className="segmented-control win-status-filter" aria-label="Win status filter">
                <button className={winFilter === "all" ? "active" : ""} onClick={() => setWinFilter("all")} type="button">
                  All
                </button>
                <button className={winFilter === "won" ? "active" : ""} onClick={() => setWinFilter("won")} type="button">
                  Won
                </button>
                <button
                  className={winFilter === "eventuallyWon" ? "active" : ""}
                  onClick={() => setWinFilter("eventuallyWon")}
                  type="button"
                >
                  Eventually won
                </button>
                <button
                  className={winFilter === "neverWon" ? "active" : ""}
                  onClick={() => setWinFilter("neverWon")}
                  type="button"
                >
                  Never won
                </button>
              </div>

              <div className="filter-row-actions">
                {filteredItems.some((item) => !item.captured && item.list === "WatchList") && (
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

                {filteredItems.some((item) => item.captured && item.list === "WatchList") && (
                  <button
                    className="secondary-button compact capture-action danger-action"
                    disabled={bulkDeleting}
                    onClick={() => void deleteAllVisible()}
                    type="button"
                  >
                    <Trash2 size={16} />
                    <span>{bulkDeleting ? "Removing..." : "Delete all visible"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {message && <p className="form-message">{message}</p>}

          {filteredItems.length > 0 ? (
            <div className="candidate-list">
              {filteredItems.map((item) => (
                <AnalyticsRow
                  capturing={pendingItemIds.includes(item.itemId)}
                  deleting={deletingItemIds.includes(item.itemId)}
                  item={item}
                  key={item.itemId}
                  onCapture={() => void captureOne(item.itemId)}
                  onDelete={() => void deleteOne(item.itemId)}
                  onSelect={() => onSelectItem(item.itemId)}
                  selected={item.itemId === selectedItemId}
                />
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              <TrendingUp size={20} />
              <h2>No ended watchlist items</h2>
              <p>{searchQuery.trim() ? "No items match your search." : "Items you watch on eBay will appear here once their listing ends, so you can capture their final price."}</p>
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
  deleting,
  item,
  onCapture,
  onDelete,
  onSelect,
  selected
}: {
  capturing: boolean;
  deleting: boolean;
  item: AnalyticsItem;
  onCapture: () => void;
  onDelete: () => void;
  onSelect: () => void;
  selected: boolean;
}) {
  const imageUrl = safeEbayImageUrl(item.imageUrl);
  const dateLabel = formatAbsoluteDate(item.endTime);
  const isWonOnly = item.list === "WonList";

  return (
    <article
      className={selected ? "candidate-card home-feed-card analytics-row selected" : "candidate-card home-feed-card analytics-row"}
      id={analyticsRowDomId(item.itemId)}
      onClick={onSelect}
    >
      <div className="watch-thumbnail" title={imageUrl ? "eBay listing image" : "Ended watchlist item"}>
        {imageUrl ? <img alt="" loading="lazy" referrerPolicy="no-referrer" src={imageUrl} /> : <TrendingUp size={20} />}
      </div>
      <div className="candidate-main">
        <div className="candidate-title-row">
          <div>
            <h2>{item.title}</h2>
          </div>
        </div>
        <div className="meta-row">
          <span>seller: <SellerLink inline sellerUserId={item.sellerUserId} /></span>
          {dateLabel && <span>{isWonOnly ? "won" : "ended"}: {dateLabel}</span>}
        </div>
        <div className="signal-row">
          <span className={item.captured ? "signal" : "signal attention"}>{item.captured ? "Captured" : "Not captured"}</span>
          {item.won && <span className="signal">Won</span>}
          {item.eventuallyWon && <span className="signal attention">Eventually won</span>}
        </div>
      </div>
      <div className="listing-side listing-side-centered">
        <strong>{item.currentPrice ? formatMoneyValue(item.currentPrice) : "-"}</strong>
        <span>{isWonOnly ? "paid price" : "final price"}</span>
      </div>
      <div className="card-actions">
        {!item.captured && !isWonOnly && (
          <button
            className="secondary-button compact capture-action"
            disabled={capturing}
            onClick={(event) => {
              event.stopPropagation();
              onCapture();
            }}
            type="button"
          >
            <Check size={16} />
            <span>{capturing ? "Adding..." : "Add to history"}</span>
          </button>
        )}
        {item.captured && !isWonOnly && (
          <button
            className="secondary-button compact capture-action danger-action"
            disabled={deleting}
            onClick={(event) => {
              event.stopPropagation();
              if (window.confirm(`Remove "${item.title}" from price history? This can't be undone.`)) {
                onDelete();
              }
            }}
            type="button"
          >
            <Trash2 size={16} />
            <span>{deleting ? "Removing..." : "Remove from history"}</span>
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

function analyticsRowDomId(itemId: string): string {
  return `analytics-row-${itemId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function matchedSalesSummaryKey(relistingGroupId: string, currency: string): string {
  return `${relistingGroupId}::${currency}`;
}

function candidateToRow(candidate: WatchlistAutomationCandidate): HomeFeedRow {
  return {
    id: `watchlist-${candidate.itemId}`,
    modelList: "ebay",
    section: "watchlist",
    title: candidate.title,
    currentPrice: candidate.currentPrice,
    endsAt: candidate.endsAt,
    sellerUserId: candidate.sellerUserId,
    conditionDisplayName: candidate.conditionDisplayName,
    imageUrl: candidate.imageUrl,
    itemWebUrl: candidate.itemWebUrl,
    matchSignals: [],
    relistingGroupId: `criteria:${candidate.recordId}`,
    sourceItemId: candidate.itemId,
    tags: ["On eBay watchlist", "Just added"],
    actions: candidate.itemWebUrl ? ["open_on_ebay"] : []
  };
}

function toCaptureRequestItem(item: AnalyticsItem) {
  return {
    itemId: item.itemId,
    title: item.title,
    list: item.list,
    endTime: item.endTime,
    sellerUserId: item.sellerUserId,
    conditionDisplayName: item.conditionDisplayName,
    imageUrl: item.imageUrl,
    itemWebUrl: item.itemWebUrl
  };
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
