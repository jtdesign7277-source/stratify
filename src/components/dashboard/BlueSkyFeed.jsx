import { useState, useEffect, useCallback, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════
   STRATIFY — BlueSky Social Feed Panel
   Live posts from Bluesky's public API (no auth required)
   Replaces the old X/Twitter mock feed
   ═══════════════════════════════════════════════════════════════ */

// ── Bluesky Butterfly Icon ─────────────────────────────────────
const BlueskyIcon = ({ size = 16, className = "" }) => (
  <svg viewBox="0 0 568 501" width={size} height={size} className={className}>
    <path
      d="M123.121 33.664C188.241 82.553 258.281 181.68 284 234.873c25.719-53.192 95.759-152.32 160.879-201.21C491.866-1.611 568-28.906 568 57.947c0 17.346-9.945 145.713-15.778 166.555-20.275 72.453-94.155 90.933-159.875 79.748C507.222 323.8 536.444 388.56 473.333 453.32c-119.86 122.992-172.272-30.859-185.702-70.281-2.462-7.227-3.614-10.608-3.631-7.733-.017-2.875-1.169.506-3.631 7.733-13.43 39.422-65.842 193.273-185.702 70.281-63.111-64.76-33.889-129.52 80.986-149.071-65.72 11.185-139.6-7.295-159.875-79.748C9.945 203.659 0 75.291 0 57.946 0-28.906 76.135-1.612 123.121 33.664Z"
      fill="#0085ff"
    />
  </svg>
);

// ── Thin pencil-line icons (strokeWidth 1.5) ───────────────────
const Icons = {
  heart: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  reply: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  repost: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  external: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),
  refresh: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
  close: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  search: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
};

// ── Relative time helper ───────────────────────────────────────
const timeAgo = (dateStr) => {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// ── Fallback posts (shown if API fails) ────────────────────────
const FALLBACK_POSTS = [
  {
    id: "fallback-1",
    author: { handle: "stratify.app", displayName: "Stratify", avatar: null },
    text: "Markets are moving. Track every ticker, test every strategy. What are you watching today? 📈",
    likeCount: 42, replyCount: 8, repostCount: 15,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "fallback-2",
    author: { handle: "trader.bsky.social", displayName: "AlgoTrader", avatar: null },
    text: "$NVDA breakout above resistance. Momentum strategy triggered at the 20 EMA crossover. Let's see if it holds through power hour. 🚀",
    likeCount: 28, replyCount: 5, repostCount: 11,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "fallback-3",
    author: { handle: "markets.bsky.social", displayName: "MarketPulse", avatar: null },
    text: "RSI on $TSLA dipping below 30 — classic bounce setup. Backtesting shows 67% win rate on this pattern over 6 months.",
    likeCount: 19, replyCount: 3, repostCount: 7,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "fallback-4",
    author: { handle: "fintech.bsky.social", displayName: "FinTech Daily", avatar: null },
    text: "AI-powered trading strategies are reshaping retail. No longer just for the institutions. The tools are here — are you using them?",
    likeCount: 55, replyCount: 12, repostCount: 23,
    createdAt: new Date(Date.now() - 14400000).toISOString(),
  },
];

// ── Quick ticker chips ─────────────────────────────────────────
const TICKER_CHIPS = ["$TSLA", "$NVDA", "$AAPL", "$MSFT", "$BTC", "$ETH", "$SPY"];

// ── Single Post Card ───────────────────────────────────────────
const PostCard = ({ post }) => {
  const [expanded, setExpanded] = useState(false);
  const maxLen = 220;
  const isLong = post.text.length > maxLen;
  const displayText = expanded || !isLong ? post.text : post.text.slice(0, maxLen) + "…";

  // Extract rkey from URI for link
  const rkey = post.id?.split("/").pop() || "";
  const postUrl = `https://bsky.app/profile/${post.author.handle}/post/${rkey}`;

  // Initials fallback for avatar
  const initials = (post.author.displayName || post.author.handle || "?")
    .split(/[\s._-]/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Highlight cashtags in text
  const highlightText = (text) => {
    const parts = text.split(/(\$[A-Z]{1,5})/g);
    return parts.map((part, i) =>
      /^\$[A-Z]{1,5}$/.test(part) ? (
        <span key={i} style={{ color: "#22d3ee", fontWeight: 600 }}>{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.015)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        padding: "14px 16px",
        transition: "background 0.2s, border-color 0.2s",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.035)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.015)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
      }}
    >
      {/* Header: avatar + name + time */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        {/* Avatar */}
        {post.author.avatar ? (
          <img
            src={post.author.avatar}
            alt=""
            style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)", objectFit: "cover" }}
            onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
          />
        ) : null}
        <div
          style={{
            width: 34, height: 34, borderRadius: "50%",
            background: "linear-gradient(135deg, #0085ff22, #0085ff08)",
            border: "1px solid #0085ff33",
            display: post.author.avatar ? "none" : "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "#0085ff",
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            flexShrink: 0,
          }}
        >
          {initials}
        </div>

        {/* Name + handle */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {post.author.displayName || post.author.handle}
            </span>
            <span style={{ color: "#334155", fontSize: 11 }}>·</span>
            <span style={{ color: "#475569", fontSize: 11, flexShrink: 0 }}>{timeAgo(post.createdAt)}</span>
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>@{post.author.handle}</div>
        </div>

        {/* Open in Bluesky */}
        <a
          href={postUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ flexShrink: 0, opacity: 0.4, transition: "opacity 0.2s" }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.4)}
          title="View on Bluesky"
        >
          <Icons.external style={{ width: 13, height: 13, color: "#0085ff" }} />
        </a>
      </div>

      {/* Post text */}
      <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.55, margin: "0 0 10px 0", wordBreak: "break-word" }}>
        {highlightText(displayText)}
        {isLong && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            style={{ background: "none", border: "none", color: "#0085ff", fontSize: 12, cursor: "pointer", marginLeft: 4, padding: 0 }}
          >
            more
          </button>
        )}
      </p>

      {/* Engagement row */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#334155", fontSize: 11 }}>
          <Icons.reply style={{ width: 13, height: 13 }} />
          <span>{post.replyCount || 0}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#334155", fontSize: 11 }}>
          <Icons.repost style={{ width: 13, height: 13 }} />
          <span>{post.repostCount || 0}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#334155", fontSize: 11 }}>
          <Icons.heart style={{ width: 13, height: 13 }} />
          <span>{post.likeCount || 0}</span>
        </div>
        <div style={{ flex: 1 }} />
        <BlueskyIcon size={11} className="opacity-20" />
      </div>
    </div>
  );
};

// ── Loading skeleton ───────────────────────────────────────────
const SkeletonCard = () => (
  <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
      <div style={{ flex: 1 }}>
        <div style={{ width: "40%", height: 10, borderRadius: 4, background: "rgba(255,255,255,0.05)", marginBottom: 6 }} />
        <div style={{ width: "25%", height: 8, borderRadius: 4, background: "rgba(255,255,255,0.03)" }} />
      </div>
    </div>
    <div style={{ width: "90%", height: 10, borderRadius: 4, background: "rgba(255,255,255,0.04)", marginBottom: 8 }} />
    <div style={{ width: "70%", height: 10, borderRadius: 4, background: "rgba(255,255,255,0.03)" }} />
  </div>
);

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function BlueSkyFeed({ isOpen, onClose, ticker = "$TSLA" }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTicker, setSearchTicker] = useState(ticker);
  const [customSearch, setCustomSearch] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef(null);
  const panelRef = useRef(null);

  // Update search when parent ticker changes
  useEffect(() => {
    if (ticker) setSearchTicker(ticker);
  }, [ticker]);

  // Fetch posts from Bluesky public API
  const fetchPosts = useCallback(async (query, isAutoRefresh = false) => {
    if (!isAutoRefresh) setLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const searchQuery = query || searchTicker;
      const url = `/api/bluesky?q=${encodeURIComponent(searchQuery)}&limit=25`;
      const res = await fetch(url);

      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();

      if (!data.posts || data.posts.length === 0) {
        // Use fallbacks if no results
        setPosts(FALLBACK_POSTS);
      } else {
        const mapped = data.posts.map((p) => ({
          id: p.uri,
          author: {
            handle: p.author?.handle || "unknown",
            displayName: p.author?.displayName || p.author?.handle || "Unknown",
            avatar: p.author?.avatar || null,
          },
          text: p.record?.text || "",
          likeCount: p.likeCount || 0,
          replyCount: p.replyCount || 0,
          repostCount: p.repostCount || 0,
          createdAt: p.record?.createdAt || p.indexedAt || new Date().toISOString(),
        }));
        setPosts(mapped);
      }
      setLastRefresh(new Date());
    } catch (err) {
      console.warn("Bluesky fetch failed:", err.message);
      setError(err.message);
      if (posts.length === 0) setPosts(FALLBACK_POSTS);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [searchTicker]);

  // Initial fetch + auto-refresh every 30s
  useEffect(() => {
    if (!isOpen) return;
    fetchPosts(searchTicker);
    intervalRef.current = setInterval(() => fetchPosts(searchTicker, true), 30000);
    return () => clearInterval(intervalRef.current);
  }, [isOpen, searchTicker, fetchPosts]);

  // Handle chip click
  const handleChipClick = (chip) => {
    setSearchTicker(chip);
    setCustomSearch("");
  };

  // Handle custom search
  const handleCustomSearch = (e) => {
    e.preventDefault();
    if (customSearch.trim()) {
      const q = customSearch.trim().startsWith("$") ? customSearch.trim() : `$${customSearch.trim().toUpperCase()}`;
      setSearchTicker(q);
      setCustomSearch("");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: 56,
        right: 16,
        bottom: 16,
        width: 380,
        zIndex: 50,
        background: "#060d18",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        padding: "16px 16px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "linear-gradient(180deg, rgba(0,133,255,0.04) 0%, transparent 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BlueskyIcon size={18} />
            <span style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0", letterSpacing: "-0.01em" }}>Social Feed</span>
            {isRefreshing && (
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#0085ff", animation: "pulse 1s ease infinite" }} />
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Refresh button */}
            <button
              onClick={() => fetchPosts(searchTicker)}
              disabled={loading}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 4,
                opacity: loading ? 0.3 : 0.5, transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.5)}
              title="Refresh feed"
            >
              <Icons.refresh style={{ width: 14, height: 14, color: "#94a3b8", animation: loading ? "spin 1s linear infinite" : "none" }} />
            </button>
            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 4,
                opacity: 0.5, transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.5)}
            >
              <Icons.close style={{ width: 14, height: 14, color: "#94a3b8" }} />
            </button>
          </div>
        </div>

        {/* Ticker chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {TICKER_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => handleChipClick(chip)}
              style={{
                padding: "4px 10px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                border: searchTicker === chip ? "1px solid #0085ff55" : "1px solid rgba(255,255,255,0.08)",
                background: searchTicker === chip ? "#0085ff15" : "rgba(255,255,255,0.03)",
                color: searchTicker === chip ? "#0085ff" : "#64748b",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Custom search */}
        <form onSubmit={handleCustomSearch} style={{ display: "flex", gap: 6 }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, padding: "0 10px",
          }}>
            <Icons.search style={{ width: 13, height: 13, color: "#334155", flexShrink: 0 }} />
            <input
              value={customSearch}
              onChange={(e) => setCustomSearch(e.target.value)}
              placeholder="Search ticker or topic..."
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                color: "#e2e8f0", fontSize: 12, padding: "8px 0",
                fontFamily: "'SF Mono', 'Fira Code', monospace",
              }}
            />
          </div>
        </form>
      </div>

      {/* ── Posts list ──────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8,
        scrollbarWidth: "thin", scrollbarColor: "#1e293b #060d18",
      }}>
        {/* Active search indicator */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "4px 0", marginBottom: 2,
        }}>
          <span style={{ fontSize: 11, color: "#475569" }}>
            Showing results for <span style={{ color: "#22d3ee", fontWeight: 600, fontFamily: "'SF Mono', 'Fira Code', monospace" }}>{searchTicker}</span>
          </span>
          {lastRefresh && (
            <span style={{ fontSize: 10, color: "#1e293b" }}>
              {timeAgo(lastRefresh.toISOString())}
            </span>
          )}
        </div>

        {/* Loading state */}
        {loading && posts.length === 0 ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}

        {/* Error banner */}
        {error && (
          <div style={{
            padding: "8px 12px", borderRadius: 8,
            background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)",
            fontSize: 11, color: "#f87171", textAlign: "center",
          }}>
            Feed unavailable — showing cached posts
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div style={{
        padding: "10px 16px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      }}>
        <BlueskyIcon size={12} className="opacity-30" />
        <span style={{ fontSize: 10, color: "#1e293b", letterSpacing: "0.02em" }}>
          Powered by Bluesky · Public API · No account required
        </span>
      </div>

      {/* ── Animations ─────────────────────────────────────── */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
