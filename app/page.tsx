"use client";

import {
  BarChart3,
  Check,
  ChevronDown,
  CircleUserRound,
  Clock3,
  ExternalLink,
  Gauge,
  Gavel,
  Heart,
  Link2,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X
} from "lucide-react";
import { useMemo, useState } from "react";

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
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "tracking", label: "Tracking", icon: Heart },
  { id: "won", label: "Won", icon: BarChart3 },
  { id: "account", label: "Account", icon: CircleUserRound }
] satisfies { id: Tab; label: string; icon: typeof Gauge }[];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const stats = useMemo(() => {
    const prices = wonItems.map((item) => item.price).sort((a, b) => a - b);
    const median = (prices[1] + prices[2]) / 2;
    return {
      highest: Math.max(...prices),
      lowest: Math.min(...prices),
      median
    };
  }, []);

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <div className="brand-mark">g</div>
          <div>
            <strong>goggler</strong>
            <span>eBay UK tracker</span>
          </div>
        </div>

        <nav className="nav-list">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                className={activeTab === tab.id ? "nav-item active" : "nav-item"}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
                title={tab.label}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sync-card">
          <div className="sync-icon">
            <ShieldCheck size={18} />
          </div>
          <strong>eBay connected</strong>
          <span>Last import 18 minutes ago</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="search-box">
            <Search size={18} />
            <input aria-label="Search tracked items" placeholder="Search tracked records, artists, catalogue numbers" />
          </div>
          <button className="icon-button" title="Filters" type="button">
            <SlidersHorizontal size={18} />
          </button>
          <button className="user-switch" type="button">
            <CircleUserRound size={18} />
            <span>Saja</span>
            <ChevronDown size={16} />
          </button>
        </header>

        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "tracking" && <Tracking />}
        {activeTab === "won" && <Won stats={stats} />}
        {activeTab === "account" && <Account />}
      </section>
    </main>
  );
}

function Dashboard() {
  return (
    <section className="content">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Review queue</p>
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
                <span>{candidate.currentPrice} current bid</span>
                <span>{candidate.originalPrice} original lost bid</span>
                <span>{candidate.condition}</span>
                <span>{candidate.seller}</span>
              </div>

              <div className="signal-row">
                {candidate.signals.map((signal) => (
                  <span className="signal" key={signal}>
                    {signal}
                  </span>
                ))}
              </div>
            </div>

            <div className="card-actions">
              <span className="ends">
                <Clock3 size={16} />
                {candidate.ends}
              </span>
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
          <p className="eyebrow">Lost auctions</p>
          <h1>Tracked items</h1>
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
          <p className="eyebrow">Purchase analytics</p>
          <h1>Won items</h1>
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

function Account() {
  return (
    <section className="content account-layout">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Local profile</p>
          <h1>Account</h1>
        </div>
      </div>

      <div className="settings-panel">
        <div className="setting-row">
          <div>
            <h2>Signed in user</h2>
            <p>Saja</p>
          </div>
          <button className="secondary-button" type="button">
            <CircleUserRound size={17} />
            <span>Switch</span>
          </button>
        </div>
        <div className="setting-row">
          <div>
            <h2>eBay UK</h2>
            <p>Connected and ready to import buying history</p>
          </div>
          <button className="secondary-button" type="button">
            <Link2 size={17} />
            <span>Reconnect</span>
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
    </section>
  );
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

