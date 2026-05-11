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

type LocalSession = {
  user: {
    id: string;
    displayName: string;
  } | null;
};

type EbaySession = {
  connection: {
    connected: boolean;
    status: "connected_this_session" | "reauth_required" | "disconnected";
    authorizedAt?: string;
    expiresAt?: string;
    scopes: string[];
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
  };
  lostItems: HistoryItem[];
  wonItems: HistoryItem[];
};

type HistoryState =
  | { status: "idle" | "loading" }
  | { status: "ready"; history: BuyingHistory }
  | { status: "sign_in_required" | "reauth_required" | "live_not_implemented" | "unavailable"; message: string };

const candidates: Candidate[] = [
  {
    id: "blue-note",
    title: "Wayne Shorter - Speak No Evil LP, Blue Note 84194, Van Gelder",
    artist: "Wayne Shorter",
    originalPrice: "£68.00",
    currentPrice: "£42.00",
    ends: "2h 14m",
    confidence: 92,
    image: "linear-gradient(135deg, #2f4f80, #f5c16c 55%, #111827)",
    signals: ["catalogue match", "title match", "same condition"],
    seller: "north-london-vinyl",
    condition: "VG+ / VG"
  },
  {
    id: "warp",
    title: "Boards of Canada - Music Has The Right To Children 2LP WARP",
    artist: "Boards of Canada",
    originalPrice: "£51.50",
    currentPrice: "£36.00",
    ends: "7h 41m",
    confidence: 86,
    image: "linear-gradient(135deg, #b95432, #f1d08a 48%, #394f4a)",
    signals: ["label match", "format match", "price range"],
    seller: "wax-archive",
    condition: "NM / VG+"
  },
  {
    id: "island",
    title: "Nick Drake - Bryter Layter LP Island pink rim pressing",
    artist: "Nick Drake",
    originalPrice: "£118.00",
    currentPrice: "£88.00",
    ends: "1d 3h",
    confidence: 79,
    image: "linear-gradient(135deg, #65743a, #e3d8b3 52%, #7c2d12)",
    signals: ["pressing hint", "UK seller", "condition close"],
    seller: "needle-and-sleeve",
    condition: "VG / VG"
  }
];

const tabs = [
  { id: "dashboard", label: "Home", mobileLabel: "Home", icon: House },
  { id: "tracking", label: "Watching", mobileLabel: "Watching", icon: Heart },
  { id: "won", label: "Purchases", mobileLabel: "Purchases", icon: ShoppingBag },
  { id: "account", label: "My goggler", mobileLabel: "My", icon: CircleUserRound }
] satisfies { id: Tab; label: string; mobileLabel: string; icon: typeof House }[];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [localSession, setLocalSession] = useState<LocalSession | null>(null);
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

  async function refreshLocalSession() {
    const sessionResponse = await fetch("/api/auth/session");
    setLocalSession(sessionResponse.ok ? ((await sessionResponse.json()) as LocalSession) : { user: null });
  }

  async function refreshBuyingHistory() {
    if (!localSession?.user) {
      setHistoryState({
        status: "sign_in_required",
        message: "Sign in locally and connect eBay to view buying history"
      });
      return;
    }

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
        message: "Connect eBay in My goggler to view buying history"
      });
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
    void refreshLocalSession();
  }, []);

  useEffect(() => {
    if (activeTab === "tracking" || activeTab === "won") {
      void refreshBuyingHistory();
    }
  }, [activeTab, localSession?.user?.id]);

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
          <div className="setup-chip" title="Connect from My goggler">
            <ShieldCheck size={16} />
            <span>eBay setup</span>
          </div>
          <button className="icon-button" title="Filters" type="button">
            <SlidersHorizontal size={18} />
          </button>
          <button className="user-switch" type="button">
            <CircleUserRound size={18} />
            <span>{localSession?.user?.displayName ?? "Not signed in"}</span>
            <ChevronDown size={16} />
          </button>
        </header>

        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "tracking" && <Tracking historyState={historyState} refreshBuyingHistory={refreshBuyingHistory} />}
        {activeTab === "won" && <Won historyState={historyState} stats={stats} refreshBuyingHistory={refreshBuyingHistory} />}
        {activeTab === "account" && (
          <Account
            localSession={localSession}
            refreshLocalSession={refreshLocalSession}
            clearHistory={() => setHistoryState({ status: "idle" })}
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

function Dashboard() {
  return (
    <section className="content">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Home</p>
          <h1>Likely relistings</h1>
        </div>
        <button className="primary-button" type="button">
          <Sparkles size={17} />
          <span>Run search</span>
        </button>
      </div>

      <div className="summary-grid">
        <Metric label="Unresolved candidates" value="12" detail="+3 since last import" />
        <Metric label="Tracked lost items" value="38" detail="21 actively searched" />
        <Metric label="Best confidence" value="92%" detail="Wayne Shorter LP" />
      </div>

      <div className="candidate-list">
        {candidates.map((candidate) => (
          <article className="candidate-card" key={candidate.id}>
            <div className="record-art" style={{ background: candidate.image }}>
              <div className="vinyl-disc" />
            </div>
            <div className="candidate-main">
              <div className="candidate-title-row">
                <div>
                  <p className="artist">{candidate.artist}</p>
                  <h2>{candidate.title}</h2>
                </div>
                <span className="confidence">{candidate.confidence}%</span>
              </div>

              <div className="meta-row">
                <span>{candidate.condition}</span>
                <span>{candidate.seller}</span>
                <span>{candidate.originalPrice} lost bid</span>
              </div>

              <div className="signal-row">
                {candidate.signals.map((signal) => (
                  <span className="signal" key={signal}>
                    {signal}
                  </span>
                ))}
              </div>
            </div>

            <div className="listing-side">
              <strong>{candidate.currentPrice}</strong>
              <span>current bid</span>
              <span className="confidence">{candidate.confidence}% match</span>
              <span className="ends">
                <Clock3 size={16} />
                {candidate.ends}
              </span>
            </div>

            <div className="card-actions">
              <button className="icon-button positive" title="Confirm match" type="button">
                <Check size={18} />
              </button>
              <button className="icon-button negative" title="Reject match" type="button">
                <X size={18} />
              </button>
              <button className="icon-button" title="Open listing" type="button">
                <ExternalLink size={18} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
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

function Account({
  localSession,
  refreshLocalSession,
  clearHistory
}: {
  localSession: LocalSession | null;
  refreshLocalSession: () => Promise<void>;
  clearHistory: () => void;
}) {
  const [ebaySession, setEbaySession] = useState<EbaySession | null>(null);
  const [ebayConfigStatus, setEbayConfigStatus] = useState<EbayConfigStatus | null>(null);
  const [ebayStartReady, setEbayStartReady] = useState(false);
  const [message, setMessage] = useState<string>("");

  async function refreshEbayConfigStatus() {
    const response = await fetch("/api/auth/ebay/config-status");
    setEbayConfigStatus(response.ok ? ((await response.json()) as EbayConfigStatus) : null);
  }

  async function refreshEbaySessionState() {
    await refreshEbayConfigStatus();

    if (localSession?.user) {
      const ebayResponse = await fetch("/api/auth/ebay/session");
      setEbaySession(ebayResponse.ok ? ((await ebayResponse.json()) as EbaySession) : null);
      return;
    }

    setEbaySession(null);
  }

  useEffect(() => {
    void refreshEbaySessionState();
  }, [localSession?.user?.id]);

  useEffect(() => {
    const user = localSession?.user;
    const ebayConfig = ebayConfigStatus?.config;
    if (!user || !ebayConfig?.ready) {
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
  }, [localSession?.user?.id, ebayConfigStatus?.config?.ready]);

  async function signIn() {
    setMessage("");
    const response = await fetch("/api/auth/sign-in", { method: "POST" });
    if (!response.ok) {
      setMessage("Could not sign in locally");
      return;
    }

    await refreshLocalSession();
  }

  async function signOut() {
    setMessage("");
    await fetch("/api/auth/sign-out", { method: "POST" });
    clearHistory();
    await refreshLocalSession();
  }

  async function disconnectEbay() {
    setMessage("");
    const response = await fetch("/api/auth/ebay/disconnect", { method: "POST" });
    if (!response.ok) {
      setMessage("Could not disconnect eBay");
      return;
    }

    await refreshEbaySessionState();
    clearHistory();
  }

  const user = localSession?.user;
  const ebayConnection = ebaySession?.connection;
  const ebayConfig = ebayConfigStatus?.config;
  const ebayConnected = ebayConnection?.connected === true;
  const canConnectEbay = Boolean(user && ebayConfig?.ready);
  const canStartEbayConnect = canConnectEbay && ebayStartReady;

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
            <h2>Signed in user</h2>
            <p>{user ? `${user.displayName} (${user.id})` : "Not signed in"}</p>
          </div>
          <button className="secondary-button" onClick={user ? signOut : signIn} type="button">
            <CircleUserRound size={17} />
            <span>{user ? "Sign out" : "Sign in"}</span>
          </button>
        </div>
        <div className="setting-row">
          <div>
            <h2>eBay UK</h2>
            <p>{formatEbayStatus(ebayConnection, ebayConfig)}</p>
          </div>
          <button
            className="secondary-button"
            disabled={!canStartEbayConnect && !ebayConnected}
            onClick={
              ebayConnected
                ? disconnectEbay
                : () => {
                    window.location.href = "/api/auth/ebay/start";
                  }
            }
            type="button"
          >
            {ebayConnected ? <X size={17} /> : <Link2 size={17} />}
            <span>{formatEbayActionLabel(ebayConnected, canConnectEbay, ebayStartReady)}</span>
          </button>
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

function formatEbayActionLabel(connected: boolean, canConnect: boolean, startReady: boolean): string {
  if (connected) {
    return "Disconnect";
  }

  if (canConnect && !startReady) {
    return "Preparing...";
  }

  return "Connect";
}

function formatEbayStatus(
  connection: EbaySession["connection"] | undefined,
  config: EbayConfigStatus["config"] | undefined
): string {
  if (!connection) {
    return "Sign in locally before connecting eBay";
  }

  if (!config) {
    return "Checking eBay Sandbox configuration";
  }

  if (!config.ready) {
    return formatEbayConfigGap(config);
  }

  if (connection.connected) {
    return connection.expiresAt
      ? `Connected for this session until ${new Date(connection.expiresAt).toLocaleTimeString()}`
      : "Connected for this session";
  }

  if (connection.status === "reauth_required") {
    return "Reconnect eBay for this goggler session";
  }

  return "Not connected";
}

function formatEbayConfigGap(config: EbayConfigStatus["config"]): string {
  const missing = config.missing.length > 0 ? `missing ${config.missing.join(", ")}` : "";
  const invalid = config.invalid.length > 0 ? `invalid ${config.invalid.join(", ")}` : "";
  return `Sandbox config not ready${missing || invalid ? `: ${[missing, invalid].filter(Boolean).join("; ")}` : ""}`;
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

function formatLostStatus(item: HistoryItem, wonItems: HistoryItem[]): string {
  const wasEventuallyWon = wonItems.some((wonItem) => wonItem.relistingGroupId === item.relistingGroupId);
  return wasEventuallyWon ? "Eventually won" : "Never won";
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
