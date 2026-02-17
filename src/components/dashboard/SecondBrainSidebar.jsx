"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import StockSearch from "./StockSearch";

const STRATEGIES_FOLDER = "strategies";

// ── Icon System ──
const ICONS = {
  strategy: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="#c084fc" strokeWidth="1.5" />
      <path d="M5 8l2 2 4-4" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  folder: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 4.5A1.5 1.5 0 013.5 3H6l1.5 1.5h5A1.5 1.5 0 0114 6v5.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5v-7z" stroke="#a78bfa" strokeWidth="1.5" />
    </svg>
  ),
  doc: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="2" width="10" height="12" rx="1.5" stroke="#94a3b8" strokeWidth="1.5" />
      <path d="M6 6h4M6 8.5h4M6 11h2" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  chevron: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M4.5 2.5l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  plus: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  search: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 4h8M5.5 4V3a1 1 0 011-1h1a1 1 0 011 1v1M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
};

// ── Date formatting helpers ──
const MONTHS = { Jan:"1",Feb:"2",Mar:"3",Apr:"4",May:"5",Jun:"6",Jul:"7",Aug:"8",Sep:"9",Oct:"10",Nov:"11",Dec:"12" };
const DAY_RE = "(?:Sun(?:day)?|Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?)";
const MON_RE = "(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
function monthNum(m) { return MONTHS[m.slice(0,3)] ?? m; }

function shortDate(title) {
  return title
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_,y,m,d) => `${parseInt(m)}/${parseInt(d)}/${y.slice(2)}`)
    .replace(new RegExp(`\\b${DAY_RE},?\\s+${MON_RE}\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, "g"),
      (_,mon,d,y) => `${monthNum(mon)}/${parseInt(d)}/${y.slice(2)}`)
    .replace(new RegExp(`\\b${MON_RE}\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, "g"),
      (_,mon,d,y) => `${monthNum(mon)}/${parseInt(d)}/${y.slice(2)}`)
    .replace(new RegExp(`\\b${DAY_RE},?\\s+${MON_RE}\\s+(\\d{1,2})\\b`, "g"),
      (_,mon,d) => `${monthNum(mon)}/${parseInt(d)}`)
    .replace(/^📝\s*Daily Summary\s*—\s*/i, "")
    .replace(/^📅\s*/, "")
    .replace(/^🗓️?\s*/, "");
}

// ── Build tree from documents ──
function buildTree(documents) {
  const stratDocs = documents.filter((d) => d.folder === STRATEGIES_FOLDER);
  const otherDocs = documents.filter((d) => d.folder !== STRATEGIES_FOLDER);

  return [
    {
      id: "section:strategies",
      name: "Strategies",
      type: "folder",
      icon: "strategy",
      sectionColor: "#c084fc",
      children: stratDocs.map((d) => ({
        id: d.id,
        name: shortDate(d.title) || "Untitled",
        type: "file",
        icon: "strategy",
        docId: d.id,
      })),
    },
    {
      id: "section:documents",
      name: "Documents",
      type: "folder",
      icon: "folder",
      sectionColor: "#a78bfa",
      children: otherDocs.map((d) => ({
        id: d.id,
        name: shortDate(d.title) || "Untitled",
        type: "file",
        icon: "doc",
        docId: d.id,
      })),
    },
  ];
}

function countFiles(node) {
  if (node.type === "file") return 1;
  return (node.children ?? []).reduce((sum, c) => sum + countFiles(c), 0);
}

function TreeRow({
  node, depth, expanded, selectedId, draggingId,
  onToggle, onSelect, onDelete,
}) {
  const isFolder = node.type === "folder";
  const isSection = node.id.startsWith("section:");
  const isSelected = node.id === selectedId;
  const isDragging = draggingId === node.id;
  const indent = depth * 20;
  const fileCount = countFiles(node);

  return (
    <div
      draggable={!isSection && node.type === "file"}
      onClick={(e) => {
        e.stopPropagation();
        if (isFolder) onToggle(node.id);
        else onSelect(node);
      }}
      className="group flex items-center gap-1.5 select-none transition-all duration-150"
      style={{
        padding: isSection ? "10px 12px 8px" : "6px 12px",
        paddingLeft: 12 + indent,
        cursor: "pointer",
        borderRadius: isSection ? 0 : "8px",
        margin: isSection ? "0" : "1px 6px",
        background: isSelected
          ? "rgba(167,139,250,0.1)"
          : "transparent",
        borderLeft: "2px solid transparent",
        opacity: isDragging ? 0.4 : 1,
        borderBottom: isSection ? `1px solid ${node.sectionColor ?? "#a78bfa"}22` : "none",
        marginTop: isSection && depth === 0 ? "8px" : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isSelected && !isSection) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected && !isSection) e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Chevron for folders */}
      {isFolder ? (
        <span
          className="flex items-center shrink-0 transition-transform duration-200"
          style={{
            color: isSection ? (node.sectionColor ?? "rgba(255,255,255,0.35)") : "rgba(255,255,255,0.35)",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            width: 16,
          }}
        >
          {ICONS.chevron}
        </span>
      ) : (
        <span style={{ width: 16 }} className="shrink-0" />
      )}

      {/* Icon */}
      <span className="flex items-center shrink-0">
        {ICONS[node.icon] || ICONS.doc}
      </span>

      {/* Name */}
      <span
        className="flex-1 truncate"
        style={{
          fontSize: isSection ? "12px" : "13px",
          fontWeight: isSection ? 700 : isFolder ? 600 : 400,
          color: isSection
            ? (node.sectionColor ?? "#fff")
            : isSelected ? "#e0d4fc" : "rgba(255,255,255,0.75)",
          letterSpacing: isSection ? "0.08em" : isFolder ? "0.03em" : "0.01em",
          textTransform: isSection ? "uppercase" : undefined,
        }}
      >
        {node.name}
      </span>

      {/* Count badge for folders */}
      {isFolder && (
        <span
          style={{
            fontSize: "10px",
            color: isSection ? (node.sectionColor ?? "rgba(255,255,255,0.25)") : "rgba(255,255,255,0.25)",
            fontWeight: 500, flexShrink: 0,
          }}
        >
          {fileCount}
        </span>
      )}

      {/* Delete button for files */}
      {!isFolder && !isSection && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
          className="hidden group-hover:flex items-center p-0.5 rounded text-zinc-600 hover:text-zinc-300 transition"
          title="Delete"
        >
          {ICONS.trash}
        </button>
      )}
    </div>
  );
}

// ── Main Sidebar Component ──
export default function SecondBrainSidebar({
  documents, selectedId, search, onSearchChange, onSelect, onCreate, onDelete,
}) {
  const [expandedIds, setExpandedIds] = useState(new Set(["section:strategies", "section:documents"]));
  const [draggingId, setDraggingId] = useState(null);
  const [showNewInput, setShowNewInput] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const newInputRef = useRef(null);

  useEffect(() => {
    if (showNewInput && newInputRef.current) newInputRef.current.focus();
  }, [showNewInput]);

  const handleNewDocSubmit = useCallback(() => {
    const name = newDocName.trim();
    if (name) onCreate(name);
    else onCreate();
    setNewDocName("");
    setShowNewInput(false);
  }, [newDocName, onCreate]);

  const tree = useMemo(() => buildTree(documents), [documents]);

  const findDoc = useCallback((node) => {
    return documents.find((d) => d.id === (node.docId ?? node.id));
  }, [documents]);

  const toggleExpand = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSelect = useCallback((node) => {
    const doc = findDoc(node);
    if (doc) onSelect(doc);
  }, [findDoc, onSelect]);

  const renderNodes = (nodes, depth) => {
    return nodes.map((node) => {
      const isExpanded = expandedIds.has(node.id);
      return (
        <div key={node.id}>
          <TreeRow
            node={node}
            depth={depth}
            expanded={isExpanded}
            selectedId={selectedId}
            draggingId={draggingId}
            onToggle={toggleExpand}
            onSelect={handleSelect}
            onDelete={(id) => onDelete(id)}
          />
          {node.type === "folder" && isExpanded && node.children && node.children.length > 0 && (
            <div style={{
              overflow: "hidden",
              transition: "max-height 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease",
            }}>
              {renderNodes(node.children, depth + 1)}
            </div>
          )}
          {node.type === "folder" && isExpanded && (!node.children || node.children.length === 0) && (
            <div
              style={{
                padding: `8px 12px 8px ${12 + (depth + 1) * 20 + 22}px`,
                fontSize: "12px",
                color: "rgba(255,255,255,0.2)",
                fontStyle: "italic",
              }}
            >
              {node.id.startsWith("section:") ? "Nothing here yet" : "Empty"}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <aside
      className="flex h-full w-72 flex-col border-r border-zinc-800"
      style={{
        background: "linear-gradient(180deg, rgba(16,16,22,0.98) 0%, rgba(11,11,16,1) 100%)",
      }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-1">
        <h3 className="text-[14px] font-bold text-white/90 tracking-wide">Second Brain</h3>
        <span className="text-[11px] text-white/30 font-normal">
          {documents.length} document{documents.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Stock Search */}
      <div className="px-4 pt-3">
        <StockSearch />
      </div>

      {/* Search + New */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-2.5 text-zinc-500">
              {ICONS.search}
            </span>
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search documents..."
              className="w-full rounded-lg py-2 pl-9 pr-3 text-[13px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowNewInput((v) => !v)}
            title="New File"
            className="flex items-center justify-center rounded-lg transition"
            style={{
              background: showNewInput ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
              border: showNewInput ? "1px solid rgba(167,139,250,0.4)" : "1px solid rgba(255,255,255,0.08)",
              color: showNewInput ? "#a78bfa" : "rgba(255,255,255,0.5)",
              padding: "7px 8px",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => { if (!showNewInput) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; } }}
            onMouseLeave={(e) => { if (!showNewInput) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; } }}
          >
            {ICONS.plus}
          </button>
        </div>

        {/* New document name input */}
        {showNewInput && (
          <div className="mt-2 flex items-center gap-2">
            <input
              ref={newInputRef}
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNewDocSubmit();
                if (e.key === "Escape") { setShowNewInput(false); setNewDocName(""); }
              }}
              placeholder="Document name..."
              className="flex-1 rounded-lg py-2 px-3 text-[13px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(167,139,250,0.4)",
              }}
            />
            <button
              onClick={handleNewDocSubmit}
              className="rounded-lg px-3 py-2 text-[12px] font-semibold transition"
              style={{
                background: "rgba(167,139,250,0.15)",
                border: "1px solid rgba(167,139,250,0.3)",
                color: "#a78bfa",
                cursor: "pointer",
              }}
            >
              Create
            </button>
          </div>
        )}
      </div>

      {/* Tree */}
      <nav className="flex-1 overflow-y-auto pt-1 pb-4" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
        {renderNodes(tree, 0)}
      </nav>

      {/* Footer */}
      <div
        className="px-5 py-3 text-[10px] text-white/20 font-normal"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        Right-click for options · Drag to move
      </div>
    </aside>
  );
}
