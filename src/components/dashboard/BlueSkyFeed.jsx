import { useState, useEffect, useRef, useCallback } from "react";
import { GripVertical, RotateCw, X } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   STRATIFY — BlueSky Social Feed (Floating Panel)
   Draggable + resizable, matches LiveScoresPill / FloatingGrokChat
   ═══════════════════════════════════════════════════════════════ */

const PANEL_WIDTH = 360;
const PANEL_HEIGHT = 520;
const STORAGE_KEY = "stratify-bluesky-feed-v1";
const REFRESH_INTERVAL = 30000;

const BlueskyIcon = ({ size = 16, className = "" }) => (
  <svg viewBox="0 0 568 501" width={size} height={size} className={className}>
    <path
      d="M123.121 33.664C188.241 82.553 258.281 181.68 284 234.873c25.719-53.192 95.759-152.32 160.879-201.21C491.866-1.611 568-28.906 568 57.947c0 17.346-9.945 145.713-15.778 166.555-20.275 72.453-94.155 90.933-159.875 79.748C507.222 323.8 536.444 388.56 473.333 453.32c-119.86 122.992-172.272-30.859-185.702-70.281-2.462-7.227-3.614-10.608-3.631-7.733-.017-2.875-1.169.506-3.631 7.733-13.43 39.422-65.842 193.273-185.702 70.281-63.111-64.76-33.889-129.52 80.986-149.071-65.72 11.185-139.6-7.295-159.875-79.748C9.945 203.659 0 75.291 0 57.946 0-28.906 76.135-1.612 123.121 33.664Z"
      fill="#0085ff"
    />
  </svg>
);

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
  bookmark: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ),
};

const timeAgo = (dateStr) => {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

const fmtNum = (n) => {
  if (!n) return "0";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
};

const HighlightedText = ({ text }) => {
  if (!text) return null;
  const parts = text.split(/(\$[A-Za-z]{1,6})/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\$[A-Za-z]{1,6}$/.test(p) ? (
          <span key={i} className="text-emerald-400 font-semibold">{p}</span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
};

const PostSkeleton = () => (
  <div className="p-4 animate-pulse">
    <div className="flex gap-3">
      <div className="w-10 h-10 rounded-full bg-white/10" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-32 bg-white/10 rounded" />
        <div className="h-3 w-full bg-white/10 rounded" />
        <div className="h-3 w-3/4 bg-white/10 rounded" />
      </div>
    </div>
  </div>
);

const PostCard = ({ post }) => {
  const author = post.author || {};
  const record = post.record || {};
  const displayName = author.displayName || author.handle || "Unknown";
  const handle = author.handle || "";
  const avatar = author.avatar;
  const text = record.text || "";
  const createdAt = record.createdAt || post.indexedAt;

  const postUrl = post.uri
    ? `https://bsky.app/profile/${handle}/post/${post.uri.split("/").pop()}`
    : "#";

  const initials = displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
      <div className="flex gap-3">
        {avatar ? (
          <img src={avatar} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border border-white/10 flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-bold text-white/60">{initials}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[13px] font-semibold text-white truncate max-w-[140px]">{displayName}</span>
            <span className="text-[11px] text-white/30">·</span>
            <span className="text-[11px] text-white/30">{timeAgo(createdAt)}</span>
            <div className="ml-auto">
              <a href={postUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                <Icons.external className="w-3.5 h-3.5 text-white/20 hover:text-[#0085ff] transition-colors" />
              </a>
            </div>
          </div>
          <p className="text-[12px] text-white/40 -mt-1 mb-1.5 truncate">@{handle}</p>
          <p className="text-[13px] text-white/80 leading-relaxed whitespace-pre-wrap break-words">
            <HighlightedText text={text} />
          </p>
          <div className="flex items-center gap-5 mt-2">
            <span className="flex items-center gap-1 text-white/25 hover:text-blue-400 transition-colors cursor-default">
              <Icons.reply className="w-3.5 h-3.5" />
              <span className="text-[11px]">{fmtNum(post.replyCount)}</span>
            </span>
            <span className="flex items-center gap-1 text-white/25 hover:text-green-400 transition-colors cursor-default">
              <Icons.repost className="w-3.5 h-3.5" />
              <span className="text-[11px]">{fmtNum(post.repostCount)}</span>
            </span>
            <span className="flex items-center gap-1 text-white/25 hover:text-rose-400 transition-colors cursor-default">
              <Icons.heart className="w-3.5 h-3.5" />
              <span className="text-[11px]">{fmtNum(post.likeCount)}</span>
            </span>
            <span className="ml-auto text-white/25 hover:text-yellow-400 transition-colors cursor-default">
              <Icons.bookmark className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
const BlueSkyFeed = ({ isOpen, onClose }) => {
  const containerRef = useRef(null);
  const positionRef = useRef({ x: 0, y: 0 });
  const sizeRef = useRef({ width: PANEL_WIDTH, height: PANEL_HEIGHT });
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [size, setSize] = useState({ width: PANEL_WIDTH, height: PANEL_HEIGHT });
  const [position, setPosition] = useState({ x: 400, y: 100 });

  useEffect(() => { sizeRef.current = size; }, [size]);
  useEffect(() => { positionRef.current = position; }, [position]);

  // Load saved position/size
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { pos, sz } = JSON.parse(saved);
        if (pos) setPosition(pos);
        if (sz) setSize(sz);
      }
    } catch {}
  }, []);

  const saveState = (pos = positionRef.current, sz = sizeRef.current) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ pos, sz })); } catch {}
  };

  const clampPosition = useCallback((pos, sz = sizeRef.current) => {
    if (typeof window === "undefined") return pos;
    return {
      x: Math.min(Math.max(0, pos.x), window.innerWidth - sz.width),
      y: Math.min(Math.max(0, pos.y), window.innerHeight - sz.height),
    };
  }, []);

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bluesky?q=ALL&limit=25`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      if (data.posts && data.posts.length > 0) setPosts(data.posts);
    } catch (err) {
      console.warn("Bluesky fetch failed:", err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchPosts();
    const iv = setInterval(fetchPosts, REFRESH_INTERVAL);
    return () => clearInterval(iv);
  }, [isOpen, fetchPosts]);

  // ── Drag ─────────────────────────────────────────────────────
  const handleDragStart = (e) => {
    if (e.target.closest("button") || e.target.closest("a")) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragOffset.current = { x: clientX - positionRef.current.x, y: clientY - positionRef.current.y };
    setIsDragging(true);
  };

  const handleDragMove = useCallback((e) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const newPos = clampPosition({ x: clientX - dragOffset.current.x, y: clientY - dragOffset.current.y });
    positionRef.current = newPos;
    if (containerRef.current) containerRef.current.style.transform = `translate(${newPos.x}px, ${newPos.y}px)`;
  }, [isDragging, clampPosition]);

  const handleDragEnd = useCallback(() => {
    if (isDragging) { setPosition({ ...positionRef.current }); saveState(); }
    setIsDragging(false);
  }, [isDragging]);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchmove", handleDragMove, { passive: false });
    window.addEventListener("touchend", handleDragEnd);
    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleDragMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // ── Resize ───────────────────────────────────────────────────
  const handleResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    resizeStart.current = { x: clientX, y: clientY, width: sizeRef.current.width, height: sizeRef.current.height };
    setIsResizing(true);
  };

  const handleResizeMove = useCallback((e) => {
    if (!isResizing) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const newSize = {
      width: Math.max(300, Math.min(600, resizeStart.current.width + (clientX - resizeStart.current.x))),
      height: Math.max(300, Math.min(800, resizeStart.current.height + (clientY - resizeStart.current.y))),
    };
    sizeRef.current = newSize;
    if (containerRef.current) {
      containerRef.current.style.width = `${newSize.width}px`;
      containerRef.current.style.height = `${newSize.height}px`;
    }
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    if (isResizing) { setSize({ ...sizeRef.current }); saveState(); }
    setIsResizing(false);
  }, [isResizing]);

  useEffect(() => {
    if (!isResizing) return;
    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeEnd);
    window.addEventListener("touchmove", handleResizeMove, { passive: false });
    window.addEventListener("touchend", handleResizeEnd);
    return () => {
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
      window.removeEventListener("touchmove", handleResizeMove);
      window.removeEventListener("touchend", handleResizeEnd);
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-[9999] flex flex-col rounded-xl overflow-hidden shadow-2xl shadow-black/50"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: size.width,
        height: size.height,
        background: "linear-gradient(180deg, #0a1628 0%, #060d18 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        left: 0,
        top: 0,
        userSelect: isDragging || isResizing ? "none" : "auto",
      }}
    >
      {/* Header (draggable) */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <GripVertical className="w-3.5 h-3.5 text-white/20" strokeWidth={1.5} />
        <BlueskyIcon size={18} />
        <span className="text-[13px] font-semibold text-white tracking-wide">Social Feed</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={fetchPosts} className="p-1.5 rounded-md hover:bg-white/5 transition-colors" title="Refresh">
            <RotateCw className={`w-3.5 h-3.5 text-white/40 hover:text-white/70 ${isLoading ? "animate-spin" : ""}`} strokeWidth={1.5} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/5 transition-colors" title="Close">
            <X className="w-3.5 h-3.5 text-white/40 hover:text-white/70" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && posts.length === 0 && (
        <div className="px-3 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
          <p className="text-[11px] text-yellow-400/80">Feed unavailable — retrying...</p>
        </div>
      )}

      {/* Posts */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {isLoading && posts.length === 0 ? (
          <>{Array.from({ length: 5 }).map((_, i) => <PostSkeleton key={i} />)}</>
        ) : posts.length > 0 ? (
          posts.map((post, i) => <PostCard key={post.uri || i} post={post} />)
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <BlueskyIcon size={32} className="mb-3 opacity-30" />
            <p className="text-[13px] text-white/30">No posts available</p>
            <button onClick={fetchPosts} className="mt-3 text-[12px] text-[#0085ff] hover:text-[#0085ff]/80 transition-colors">
              Try again
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-white/5 flex items-center justify-center gap-1">
        <BlueskyIcon size={10} className="opacity-40" />
        <span className="text-[10px] text-white/20">Powered by Bluesky · Public API</span>
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        onMouseDown={handleResizeStart}
        onTouchStart={handleResizeStart}
      >
        <svg className="w-3 h-3 text-white/15 absolute bottom-0.5 right-0.5" viewBox="0 0 10 10">
          <path d="M9 1v8H1" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M9 5v4H5" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
};

export default BlueSkyFeed;
