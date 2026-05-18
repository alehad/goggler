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
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_MATCHING_PREFERENCES,
  type MatchingPreferences
} from "../src/ebay/matching-preferences.ts";
import { buildPurchaseAnalytics, type PurchaseChartPoint } from "../src/ebay/purchase-analytics.ts";
import { safeEbayImageUrl, safeEbayItemUrl } from "../src/http/safe-external-url.ts";

type Tab = "dashboard" | "tracking" | "won" | "account";
type LostFilter = "all" | "neverWon" | "eventuallyWon";
type HomeFeedFilter = "all" | "onWatchlist" | "relistings" | "won" | "neverWon";
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
  list: "LostList" | "WonList";
  currentPrice?: {
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

type HomeFeedRow = {
  id: string;
  section: "watchlist" | "needs_action" | "won" | "unresolved" | "resolved";
  title: string;
  currentPrice?: { value: number; currency: string };
  originalLostPrice?: { value: number; currency: string };
  endsAt?: string;
  sellerUserId?: string;
  conditionDisplayName?: string;
  imageUrl?: string;
  itemWebUrl?: string;
  watchlistPosition?: number;
  matchConfidence?: number;
  matchSignals: string[];
  tags: string[];
  actions: string[];
};

const tabs = [
  { id: "dashboard", label: "Home", mobileLabel: "Home", icon: House },
  { id: "tracking", label: "Watching", mobileLabel: "Watching", icon: Heart },
  { id: "won", label: "Purchases", mobileLabel: "Purchases", icon: ShoppingBag },
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
        criteriaText:
          typeof parsed.criteriaText === "string" && parsed.criteriaText.trim()
            ? parsed.criteriaText
            : DEFAULT_MATCHING_PREFERENCES.criteriaText
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
          <div className="search-box">
            <Search size={18} />
            <input aria-label="Search tracked items" placeholder="Search tracked records, artists, catalogue numbers" />
          </div>
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

        {activeTab === "dashboard" && <Dashboard historyState={historyState} refreshBuyingHistory={refreshBuyingHistory} />}
        {activeTab === "tracking" && <Tracking historyState={historyState} refreshBuyingHistory={refreshBuyingHistory} />}
        {activeTab === "won" && <Won historyState={historyState} refreshBuyingHistory={refreshBuyingHistory} />}
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
  historyState,
  refreshBuyingHistory
}: {
  historyState: HistoryState;
  refreshBuyingHistory: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<HomeFeedFilter>("onWatchlist");
  const [locallyWatchedIds, setLocallyWatchedIds] = useState<string[]>([]);
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

    return filterHomeRows(updatedRows, filter);
  }, [filter, historyState, locallyWatchedIds]);

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

          <div className="candidate-list">
            {rows.map((row) => (
              <HomeFeedCard
                key={row.id}
                row={row}
                onAddToWatchlist={() => setLocallyWatchedIds((ids) => [...new Set([...ids, row.id])])}
              />
            ))}
          </div>
        </>
      ) : (
        <HistoryEmptyState state={historyState} />
      )}
    </section>
  );
}

function HomeFeedCard({ row, onAddToWatchlist }: { row: HomeFeedRow; onAddToWatchlist: () => void }) {
  const imageUrl = safeEbayImageUrl(row.imageUrl);
  const itemWebUrl = safeEbayItemUrl(row.itemWebUrl);

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
          <span>{row.sellerUserId ?? "Unknown seller"}</span>
          {row.originalLostPrice && <span>{formatCurrency(row.originalLostPrice.value)} lost bid</span>}
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
        <strong>{row.currentPrice ? formatCurrency(row.currentPrice.value) : "-"}</strong>
        <span>{row.currentPrice ? "current price" : "lost bid"}</span>
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
  const analytics = useMemo(
    () => (historyState.status === "ready" ? buildPurchaseAnalytics(historyState.history.wonItems) : buildPurchaseAnalytics([])),
    [historyState]
  );
  const selectedPoint = analytics.chartPoints.find((point) => point.itemId === selectedItemId);

  useEffect(() => {
    if (!selectedItemId) {
      return;
    }

    document.getElementById(purchaseCardDomId(selectedItemId))?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
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
          <div className="summary-grid">
            <Metric label="Average paid" value={formatMoneyValue(analytics.stats.average)} detail={`${analytics.stats.count} priced wins`} />
            <Metric label="Lowest paid" value={formatMoneyValue(analytics.stats.lowest)} detail="Won auctions" />
            <Metric label="Highest paid" value={formatMoneyValue(analytics.stats.highest)} detail="Won auctions" />
          </div>

          <PurchaseChart points={analytics.chartPoints} selectedItemId={selectedItemId} onSelect={setSelectedItemId} />

          {historyState.history.wonItems.length > 0 ? (
            <div className="candidate-list purchase-list">
              {historyState.history.wonItems.map((item) => (
                <PurchaseCard item={item} key={item.itemId} selected={item.itemId === selectedPoint?.itemId} />
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
  points,
  selectedItemId,
  onSelect
}: {
  points: PurchaseChartPoint[];
  selectedItemId: string | undefined;
  onSelect: (itemId: string) => void;
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
  const priceStep = highestPrice <= 150 ? 10 : 15;
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
          <h2>Price paid over time</h2>
          <p>{points.length > 0 ? `${points.length} plotted purchases` : "No dated purchase prices to plot"}</p>
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
                onClick={() => onSelect(point.itemId)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(point.itemId);
                  }
                }}
                role="button"
                tabIndex={0}
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
          <span>No dated purchases to chart</span>
        </div>
      )}
    </section>
  );
}

function PurchaseCard({ item, selected }: { item: HistoryItem; selected: boolean }) {
  const imageUrl = safeEbayImageUrl(item.imageUrl);
  const itemWebUrl = safeEbayItemUrl(item.itemWebUrl);

  return (
    <article
      className={selected ? "candidate-card home-feed-card purchase-card selected" : "candidate-card home-feed-card purchase-card"}
      id={purchaseCardDomId(item.itemId)}
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
          <span>{item.sellerUserId ?? "Unknown seller"}</span>
          {item.endTime && <span>{formatShortDate(item.endTime)}</span>}
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
          <a className="icon-button" href={itemWebUrl} rel="noopener noreferrer" target="_blank" title="View on eBay">
            <ExternalLink size={18} />
          </a>
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
          {item.sellerUserId ?? "Unknown seller"}
          {item.conditionDisplayName ? ` | ${item.conditionDisplayName}` : ""}
          {item.endTime ? ` | ended ${new Date(item.endTime).toLocaleDateString()}` : ""}
        </p>
      </div>
      <div className="history-side">
        <span className="price-pill">{formatCurrency(item.currentPrice?.value ?? 0)}</span>
        <span className={sideLabel === "Eventually won" ? "status hot" : "status"}>{sideLabel}</span>
      </div>
    </div>
  );
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

function filterHomeRows(rows: HomeFeedRow[], filter: HomeFeedFilter): HomeFeedRow[] {
  switch (filter) {
    case "onWatchlist":
      return rows.filter((row) => row.section === "watchlist");
    case "relistings":
      return rows.filter((row) => row.tags.includes("Relisting candidate"));
    case "won":
      return rows.filter((row) => row.section === "won");
    case "neverWon":
      return rows.filter((row) => row.tags.includes("Never won"));
    case "all":
      return rows;
  }
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
  return new Intl.NumberFormat("en-GB", {
    currency,
    style: "currency"
  }).format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    currency: "GBP",
    style: "currency"
  }).format(value);
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
