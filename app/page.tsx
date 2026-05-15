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
  Settings,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Tab = "dashboard" | "tracking" | "won" | "account";
type LostFilter = "all" | "neverWon" | "eventuallyWon";
type HomeFeedFilter = "all" | "needsAction" | "onWatchlist" | "relistings" | "neverWon" | "resolved";

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
  relistingGroupId?: string;
};

type BuyingHistory = {
  source: "fixture";
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
  section: "watchlist" | "needs_action" | "unresolved" | "resolved";
  title: string;
  currentPrice?: { value: number; currency: string };
  originalLostPrice?: { value: number; currency: string };
  endsAt?: string;
  sellerUserId?: string;
  conditionDisplayName?: string;
  imageUrl?: string;
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
  const stats = useMemo(() => {
    const prices =
      historyState.status === "ready"
        ? historyState.history.wonItems.map((item) => item.currentPrice?.value ?? 0).sort((a, b) => a - b)
        : [];
    const median =
      prices.length === 0
        ? 0
        : prices.length % 2 === 0
          ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
          : prices[Math.floor(prices.length / 2)];
    return {
      highest: prices.length > 0 ? Math.max(...prices) : 0,
      lowest: prices.length > 0 ? Math.min(...prices) : 0,
      median
    };
  }, [historyState]);

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
    setHistoryState({ status: "loading" });
    const response = await fetch("/api/ebay/buying-history", { cache: "no-store" });
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
      setHistoryState({
        status: "live_not_implemented",
        message: "Live history import is not implemented yet"
      });
      return;
    }

    setHistoryState({
      status: "unavailable",
      message: body.error ? `History unavailable: ${body.error}` : "History is unavailable"
    });
  }

  useEffect(() => {
    void refreshEbaySessionState();
  }, []);

  useEffect(() => {
    if (activeTab === "dashboard" || activeTab === "tracking" || activeTab === "won") {
      void refreshBuyingHistory();
    }
  }, [activeTab]);

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
        {activeTab === "won" && <Won historyState={historyState} stats={stats} refreshBuyingHistory={refreshBuyingHistory} />}
        {activeTab === "account" && (
          <Account
            ebayConfig={ebayConfigStatus?.config}
            ebayConnection={ebaySession?.connection}
            message={accountMessage}
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
  const [filter, setFilter] = useState<HomeFeedFilter>("all");
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
            <Metric label="Needs action" value={String(historyState.history.counts.needsAction)} detail="Not watched yet" />
          </div>

          <div className="segmented-control home-filters" aria-label="Home feed filter">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")} type="button">
              All
            </button>
            <button
              className={filter === "needsAction" ? "active" : ""}
              onClick={() => setFilter("needsAction")}
              type="button"
            >
              Needs action
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
            <button
              className={filter === "neverWon" ? "active" : ""}
              onClick={() => setFilter("neverWon")}
              type="button"
            >
              Never won
            </button>
            <button
              className={filter === "resolved" ? "active" : ""}
              onClick={() => setFilter("resolved")}
              type="button"
            >
              Resolved
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
  return (
    <article className="candidate-card home-feed-card">
      <div className="watch-thumbnail" title={row.imageUrl ? "eBay listing image" : "goggler feed"}>
        {row.imageUrl ? <img alt="" loading="lazy" referrerPolicy="no-referrer" src={row.imageUrl} /> : <Sparkles size={20} />}
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
        {row.actions.includes("open_on_ebay") && (
          <button className="icon-button" title="Open on eBay" type="button">
            <ExternalLink size={18} />
          </button>
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
  stats,
  refreshBuyingHistory
}: {
  historyState: HistoryState;
  stats: { highest: number; lowest: number; median: number };
  refreshBuyingHistory: () => Promise<void>;
}) {
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
            <Metric label="Won items" value={String(historyState.history.counts.won)} detail="Fixture history" />
            <Metric label="Highest paid" value={formatCurrency(stats.highest)} detail="Won auctions" />
            <Metric label="Median paid" value={formatCurrency(stats.median)} detail="Won auctions" />
          </div>

          <div className="table-panel">
            {historyState.history.wonItems.map((item) => (
              <HistoryRow item={item} key={item.itemId} sideLabel="Won" />
            ))}
          </div>
        </>
      ) : (
        <HistoryEmptyState state={historyState} />
      )}
    </section>
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
  message
}: {
  ebayConfig: EbayConfigStatus["config"] | undefined;
  ebayConnection: EbaySession["connection"] | undefined;
  message: string;
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
            <p>Exact relisting signals only</p>
          </div>
          <button className="secondary-button" type="button">
            <Settings size={17} />
            <span>Edit</span>
          </button>
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

function formatHomeSection(section: HomeFeedRow["section"]): string {
  switch (section) {
    case "watchlist":
      return "eBay watchlist";
    case "needs_action":
      return "Relisting candidate";
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
