"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SecondBrainSidebar from "./SecondBrainSidebar";
import SecondBrainDocumentViewer from "./SecondBrainDocumentViewer";

const STRATEGIES_FOLDER = "strategies";

function toDocument(strategy, index) {
  const now = new Date().toISOString();
  const title = strategy?.name || strategy?.title || `Untitled Strategy ${index + 1}`;
  const ticker = String(strategy?.ticker || "").replace(/^\$/, "").toUpperCase();
  const content = strategy?.content || strategy?.raw || strategy?.code || [
    `# ${title}`,
    "",
    "## Strategy Overview",
    strategy?.summary || strategy?.description || "No analysis content available.",
    "",
    "## KEY TRADE SETUPS",
    `- **Entry Signal:** ${strategy?.entry || "—"}`,
    `- **Volume:** ${strategy?.volume || "—"}`,
    `- **Trend:** ${strategy?.trend || "—"}`,
    `- **Risk/Reward:** ${strategy?.riskReward || "—"}`,
    `- **Stop Loss:** ${strategy?.stopLoss || "—"}`,
    `- **$ Allocation:** ${strategy?.allocation || strategy?.positionSize || "—"}`,
    "",
    "## Notes",
    ticker ? `Ticker: $${ticker}` : "Ticker: —",
  ].join("\n");

  return {
    id: strategy?.id || crypto.randomUUID(),
    user_id: "local",
    title,
    content,
    folder: STRATEGIES_FOLDER,
    created_at: strategy?.savedAt ? new Date(strategy.savedAt).toISOString() : now,
    updated_at: now,
  };
}

function dedupeById(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = String(item.id || item.title);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export default function SecondBrainTerminalLayout({
  strategies = [],
  savedStrategies = [],
  deployedStrategies = [],
}) {
  const sourceDocuments = useMemo(() => {
    const combined = [...savedStrategies, ...deployedStrategies, ...strategies];
    const mapped = combined.map((strategy, index) => toDocument(strategy, index));
    return dedupeById(mapped);
  }, [strategies, savedStrategies, deployedStrategies]);

  const [documents, setDocuments] = useState(sourceDocuments);
  const [selected, setSelected] = useState(sourceDocuments[0] ?? null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setDocuments(sourceDocuments);
    setSelected((prev) => {
      if (!sourceDocuments.length) return null;
      if (prev && sourceDocuments.some((d) => d.id === prev.id)) {
        return sourceDocuments.find((d) => d.id === prev.id) || sourceDocuments[0];
      }
      return sourceDocuments[0];
    });
  }, [sourceDocuments]);

  const filteredDocuments = useMemo(() => {
    if (!search.trim()) return documents;
    const term = search.toLowerCase();
    return documents.filter(
      (d) =>
        d.title.toLowerCase().includes(term) ||
        d.content.toLowerCase().includes(term)
    );
  }, [documents, search]);

  const selectDocument = useCallback((doc) => {
    setSelected(doc);
  }, []);

  const deselectDocument = useCallback(() => {
    setSelected(null);
  }, []);

  const createDocument = useCallback((name) => {
    const now = new Date().toISOString();
    const doc = {
      id: crypto.randomUUID(),
      user_id: "local",
      title: name?.trim() || "Untitled",
      content: "",
      folder: STRATEGIES_FOLDER,
      created_at: now,
      updated_at: now,
    };
    setDocuments((prev) => [doc, ...prev]);
    setSelected(doc);
  }, []);

  const updateDocument = useCallback(async (doc) => {
    setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...doc, updated_at: new Date().toISOString() } : d)));
    setSelected((prev) => (prev?.id === doc.id ? { ...doc, updated_at: new Date().toISOString() } : prev));
  }, []);

  const deleteDocument = useCallback((id) => {
    setDocuments((prev) => {
      const next = prev.filter((d) => d.id !== id);
      setSelected((current) => {
        if (!current || current.id !== id) return current;
        return next[0] ?? null;
      });
      return next;
    });
  }, []);

  return (
    <div className="flex h-full w-full bg-zinc-950 text-zinc-100">
      <SecondBrainSidebar
        documents={filteredDocuments}
        selectedId={selected?.id ?? null}
        search={search}
        onSearchChange={setSearch}
        onSelect={selectDocument}
        onCreate={createDocument}
        onDelete={deleteDocument}
      />

      <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4">
        <div className="flex-1 min-h-0">
          <SecondBrainDocumentViewer
            document={selected}
            onSave={updateDocument}
            onClose={deselectDocument}
          />
        </div>
      </main>
    </div>
  );
}
