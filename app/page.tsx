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

const trackedItems = [
  {
    title: "The Smiths - The Queen Is Dead original Rough Trade LP",
    price: "Lost at £74.00",
    status: "Searching",
    matches: 0
  },
  {
    title: "Stereolab - Emperor Tomato Ketchup Duophonic vinyl",
    price: "Lost at £44.20",
    status: "2 candidates",
    matches: 2
  },
  {
    title: "John Coltrane - A Love Supreme Impulse stereo pressing",
    price: "Lost at £96.00",
    status: "Searching",
    matches: 0
  }
];

const wonItems = [
  { title: "Aphex Twin - Selected Ambient Works 85-92", price: 64 },
  { title: "Joni Mitchell - Blue UK LP", price: 28 },
  { title: "Miles Davis - In A Silent Way", price: 42 },
  { title: "Cocteau Twins - Heaven or Las Vegas", price: 55 }
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
  const stats = useMemo(() => {
    const prices = wonItems.map((item) => item.price).sort((a, b) => a - b);
    const median = (prices[1] + prices[2]) / 2;
    return {
      highest: Math.max(...prices),
      lowest: Math.min(...prices),
      median
    };
  }, []);

  async function refreshLocalSession() {
    const sessionResponse = await fetch("/api/auth/session");
    setLocalSession(sessionResponse.ok ? ((await sessionResponse.json()) as LocalSession) : { user: null });
  }

  useEffect(() => {
    void refreshLocalSession();
  }, []);

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
        {activeTab === "tracking" && <Tracking />}
        {activeTab === "won" && <Won stats={stats} />}
        {activeTab === "account" && <Account localSession={localSession} refreshLocalSession={refreshLocalSession} />}
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

function Tracking() {
  return (
    <section className="content">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Watching</p>
          <h1>Tracked lost auctions</h1>
        </div>
        <button className="primary-button" type="button">
          <Gavel size={17} />
          <span>Import history</span>
        </button>
      </div>

      <div className="table-panel">
        {trackedItems.map((item) => (
          <div className="tracking-row" key={item.title}>
            <div>
              <h2>{item.title}</h2>
              <p>{item.price}</p>
            </div>
            <span className={item.matches > 0 ? "status hot" : "status"}>{item.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Won({ stats }: { stats: { highest: number; lowest: number; median: number } }) {
  return (
    <section className="content">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Purchases</p>
          <h1>Won item history</h1>
        </div>
      </div>

      <div className="summary-grid">
        <Metric label="Highest paid" value={`£${stats.highest}`} detail="Imported won auctions" />
        <Metric label="Lowest paid" value={`£${stats.lowest}`} detail="Imported won auctions" />
        <Metric label="Median paid" value={`£${stats.median}`} detail="Mock data" />
      </div>

      <div className="table-panel">
        {wonItems.map((item) => (
          <div className="tracking-row" key={item.title}>
            <div>
              <h2>{item.title}</h2>
              <p>Won auction</p>
            </div>
            <span className="price-pill">£{item.price}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Account({
  localSession,
  refreshLocalSession
}: {
  localSession: LocalSession | null;
  refreshLocalSession: () => Promise<void>;
}) {
  const [ebaySession, setEbaySession] = useState<EbaySession | null>(null);
  const [ebayConfigStatus, setEbayConfigStatus] = useState<EbayConfigStatus | null>(null);
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
  }

  const user = localSession?.user;
  const ebayConnection = ebaySession?.connection;
  const ebayConfig = ebayConfigStatus?.config;
  const ebayConnected = ebayConnection?.connected === true;
  const canConnectEbay = Boolean(user && ebayConfig?.ready);

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
            disabled={!canConnectEbay && !ebayConnected}
            onClick={ebayConnected ? disconnectEbay : () => {
              window.location.href = "/api/auth/ebay/start";
            }}
            type="button"
          >
            {ebayConnected ? <X size={17} /> : <Link2 size={17} />}
            <span>{ebayConnected ? "Disconnect" : "Connect"}</span>
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

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  );
}
