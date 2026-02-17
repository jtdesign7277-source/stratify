"use client";

import { useState, useEffect, useCallback } from "react";
import { Pencil, Check, X, Flame } from "lucide-react";

/* ── The 6 pre-trade checklist items ── */
export const CHECKLIST_KEYS = [
  { id: "entry-signal", label: "Entry Signal", userEditable: false, patterns: [
    /\*\*Entry Signal:\*\*\s*(.+)/i,
    /entry\s*signal[:\s]*["""]?([^"\n]+)/i,
    /entry\s*(signal|condition|trigger|point)[:\s]*([^\n.]+)/i,
  ]},
  { id: "volume-check", label: "Volume", userEditable: false, patterns: [
    /\*\*Volume:\*\*\s*(.+)/i,
    /volume[:\s]*["""]?([^"\n]+)/i,
  ]},
  { id: "trend-alignment", label: "Trend", userEditable: false, patterns: [
    /\*\*Trend:\*\*\s*(.+)/i,
    /trend[:\s]*["""]?([^"\n]+)/i,
  ]},
  { id: "risk-reward", label: "Risk/Reward", userEditable: false, patterns: [
    /\*\*Risk\/Reward:\*\*\s*(.+)/i,
    /risk[\/\s]*reward[:\s]*["""]?([^"\n]+)/i,
  ]},
  { id: "stop-loss-set", label: "Stop Loss", userEditable: false, patterns: [
    /\*\*Stop Loss:\*\*\s*(.+)/i,
    /stop[\s-]*loss[:\s]*["""]?([^"\n]+)/i,
  ]},
  { id: "position-sized", label: "$ Allocation", userEditable: true, patterns: [] },
];

/* ── Extract checklist values from markdown content ── */
export function extractChecklist(content) {
  return CHECKLIST_KEYS.map((key) => {
    // User-editable fields start blank for the user to fill in
    if (key.userEditable) {
      return {
        id: key.id,
        label: key.label,
        value: "",
        checked: false,
        userEditable: true,
      };
    }
    let value = "";
    for (const pattern of key.patterns) {
      const match = content.match(pattern);
      if (match) {
        // Use the last capture group
        value = (match[match.length - 1] || match[1] || "").trim()
          .replace(/\*+/g, "").trim() // strip leftover markdown bold
          .slice(0, 100);
        break;
      }
    }
    return {
      id: key.id,
      label: key.label,
      value: value || "—",
      checked: false,
    };
  });
}

/* ── Inline green-glow label shown in Sophia's response ── */
export function InlineChecklistTag({ label, value }) {
  if (!value || value === "—") return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold my-0.5"
      style={{
        color: "#4ade80",
        background: "rgba(74, 222, 128, 0.08)",
        border: "1px solid rgba(74, 222, 128, 0.2)",
        boxShadow: "0 0 8px rgba(74, 222, 128, 0.15), 0 0 2px rgba(74, 222, 128, 0.1)",
        textShadow: "0 0 6px rgba(74, 222, 128, 0.3)",
      }}
    >
      <Check className="h-3 w-3" />
      {label}: {value}
    </span>
  );
}

/* ── Summary card at top of strategy response ── */
export default function PreTradeChecklist({
  items,
  onUpdate,
  onSave,
}) {
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState("");
  const checkedCount = items.filter((i) => i.checked).length;

  const startEdit = (id, currentValue) => {
    setEditing(id);
    setEditValue(currentValue === "—" ? "" : currentValue);
  };

  const commitEdit = (id) => {
    const updated = items.map((i) =>
      i.id === id ? { ...i, value: editValue.trim() || "—" } : i
    );
    onUpdate(updated);
    setEditing(null);
    setEditValue("");
  };

  const toggleCheck = (id) => {
    const updated = items.map((i) =>
      i.id === id ? { ...i, checked: !i.checked } : i
    );
    onUpdate(updated);
  };

  return (
    <div
      className="rounded-xl overflow-hidden mb-3"
      style={{
        background: "linear-gradient(135deg, rgba(16,16,28,0.95) 0%, rgba(11,11,20,0.98) 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-400" />
          <span className="text-xs font-bold text-white/90 uppercase tracking-wider">
            Key Trade Setups Identified
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-mono"
            style={{ color: checkedCount === 6 ? "#4ade80" : "rgba(255,255,255,0.4)" }}
          >
            {checkedCount}/6
          </span>
          <button
            onClick={() => onSave(items)}
            className="rounded-lg px-3 py-1.5 text-[11px] font-bold transition"
            style={{
              background: checkedCount === 6
                ? "rgba(74, 222, 128, 0.15)"
                : "rgba(255,255,255,0.04)",
              border: checkedCount === 6
                ? "1px solid rgba(74, 222, 128, 0.3)"
                : "1px solid rgba(255,255,255,0.08)",
              color: checkedCount === 6 ? "#4ade80" : "rgba(255,255,255,0.4)",
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      </div>

      {/* 3x2 Grid */}
      <div className="grid grid-cols-2 gap-px" style={{ background: "rgba(255,255,255,0.03)" }}>
        {items.map((item) => {
          const isEditing = editing === item.id;
          return (
            <div
              key={item.id}
              className="flex items-center gap-2 px-3 py-2.5 transition"
              style={{
                background: item.checked
                  ? "rgba(74, 222, 128, 0.04)"
                  : "rgba(11,11,20,0.95)",
              }}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleCheck(item.id)}
                className="shrink-0 flex items-center justify-center rounded-md transition"
                style={{
                  width: 22,
                  height: 22,
                  background: item.checked
                    ? "rgba(74, 222, 128, 0.15)"
                    : "rgba(255,255,255,0.04)",
                  border: item.checked
                    ? "1.5px solid rgba(74, 222, 128, 0.5)"
                    : "1.5px solid rgba(255,255,255,0.12)",
                  boxShadow: item.checked
                    ? "0 0 8px rgba(74, 222, 128, 0.2)"
                    : "none",
                }}
              >
                {item.checked && <Check className="h-3 w-3 text-emerald-400" />}
              </button>

              {/* Label + Value */}
              <div className="flex-1 min-w-0">
                <div
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    color: item.checked
                      ? "#4ade80"
                      : "rgba(255,255,255,0.45)",
                    textShadow: item.checked
                      ? "0 0 6px rgba(74, 222, 128, 0.3)"
                      : "none",
                  }}
                >
                  {item.label}
                </div>
                {item.userEditable ? (
                  /* Always-editable field ($ Allocation) */
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[11px] text-amber-400">$</span>
                    <input
                      value={item.value}
                      onChange={(e) => {
                        const updated = items.map((i) =>
                          i.id === item.id ? { ...i, value: e.target.value } : i
                        );
                        onUpdate(updated);
                      }}
                      placeholder="Enter amount..."
                      className="flex-1 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(251, 191, 36, 0.3)",
                      }}
                    />
                  </div>
                ) : isEditing ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit(item.id);
                        if (e.key === "Escape") setEditing(null);
                      }}
                      className="flex-1 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(167,139,250,0.4)",
                      }}
                    />
                    <button onClick={() => commitEdit(item.id)} className="text-emerald-400 hover:text-emerald-300">
                      <Check className="h-3 w-3" />
                    </button>
                    <button onClick={() => setEditing(null)} className="text-zinc-500 hover:text-zinc-300">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className="text-[11px] truncate"
                      style={{
                        color: item.value === "—"
                          ? "rgba(255,255,255,0.2)"
                          : item.checked
                          ? "#4ade80"
                          : "rgba(255,255,255,0.7)",
                        textShadow: item.checked
                          ? "0 0 6px rgba(74, 222, 128, 0.25)"
                          : "none",
                      }}
                    >
                      {item.value}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(item.id, item.value); }}
                      className="shrink-0 text-zinc-600 hover:text-zinc-300 transition"
                      style={{ opacity: 0.3 }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.3"; }}
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
