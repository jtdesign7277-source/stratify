#!/usr/bin/env python3
"""
Run this from your Stratify project root:
  python3 fix-news-panel.py
It patches TraderPage.jsx in-place and then git commits + pushes.
"""
import subprocess, sys, os

TARGET = os.path.expanduser(
    "~/Desktop/Stratify/src/components/dashboard/TraderPage.jsx"
)

with open(TARGET, "r") as f:
    src = f.read()

original = src  # keep for diff check

# ── 1. Swap 3-state → boolean ──────────────────────────────────
src = src.replace(
    "const [newsPanelState, setNewsPanelState] = useState('peek');",
    "const [isNewsOpen, setIsNewsOpen] = useState(true);"
)

# ── 2. Replace height calc ─────────────────────────────────────
src = src.replace(
    "// News panel: 3-state click cycle with fixed pixel heights\n"
    "  const newsPanelHeight = newsPanelState === 'closed' ? 0 : newsPanelState === 'peek' ? 180 : 340;",
    "const newsPanelHeight = isNewsOpen ? 280 : 0;"
)

# ── 3. Replace toggle fn ───────────────────────────────────────
src = src.replace(
    "  const toggleNewsPanelCollapsed = useCallback(() => {\n"
    "    setNewsPanelState((prev) => {\n"
    "      if (prev === 'peek') return 'open';\n"
    "      if (prev === 'open') return 'closed';\n"
    "      return 'peek';\n"
    "    });\n"
    "  }, []);",
    "  const toggleNewsPanelCollapsed = useCallback(() => {\n"
    "    setIsNewsOpen(prev => !prev);\n"
    "  }, []);"
)

# ── 4. Remove buried chevron inside zero-height news panel ─────
src = src.replace(
    "                {/* Toggle button — top-right corner inside news panel */}\n"
    "                <button\n"
    "                  type=\"button\"\n"
    "                  onClick={toggleNewsPanelCollapsed}\n"
    "                  className=\"absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-emerald-300 hover:bg-white/20 hover:text-emerald-200 transition-colors cursor-pointer\"\n"
    "                  title={newsPanelState === 'peek' ? 'Expand news' : 'Collapse news'}\n"
    "                >\n"
    "                  {newsPanelState === 'peek' ? (\n"
    "                    <ChevronsUp className=\"h-4 w-4\" strokeWidth={1.7} />\n"
    "                  ) : (\n"
    "                    <ChevronsDown className=\"h-4 w-4\" strokeWidth={1.7} />\n"
    "                  )}\n"
    "                </button>",
    ""
)

# ── 5. Remove orphaned "Show News" button at bottom ────────────
src = src.replace(
    "              {/* Show news button when panel is closed */}\n"
    "              {newsPanelState === 'closed' && (\n"
    "                <button\n"
    "                  type=\"button\"\n"
    "                  onClick={toggleNewsPanelCollapsed}\n"
    "                  className=\"flex h-8 shrink-0 items-center justify-center gap-2 bg-white/[0.05] text-[11px] font-medium text-emerald-300 hover:bg-white/[0.10] transition-colors cursor-pointer\"\n"
    "                >\n"
    "                  <ChevronsUp className=\"h-3.5 w-3.5\" strokeWidth={1.7} />\n"
    "                  Show News\n"
    "                </button>\n"
    "              )}",
    ""
)

# ── 6. Add "News" toggle button into chart toolbar ─────────────
src = src.replace(
    '                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">\n'
    "                  {CHART_TIMEFRAME_OPTIONS.map((timeframe) => {",
    '                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">\n'
    "                  <motion.button\n"
    "                    type=\"button\"\n"
    "                    onClick={toggleNewsPanelCollapsed}\n"
    "                    whileHover={{ scale: 1.02 }}\n"
    "                    whileTap={{ scale: 0.98 }}\n"
    "                    transition={interactiveTransition}\n"
    "                    className={`flex h-7 shrink-0 items-center gap-1.5 border px-2.5 text-[11px] font-medium transition-colors ${\n"
    "                      isNewsOpen\n"
    "                        ? 'border-emerald-400 text-emerald-400'\n"
    "                        : 'border-white/[0.14] text-gray-300 hover:bg-white/[0.08] hover:text-white'\n"
    "                    }`}\n"
    "                    title={isNewsOpen ? 'Hide news' : 'Show news'}\n"
    "                  >\n"
    "                    <ChevronsDown\n"
    "                      className={`h-3.5 w-3.5 transition-transform duration-300 ${\n"
    "                        isNewsOpen ? 'rotate-0' : 'rotate-180'\n"
    "                      }`}\n"
    "                      strokeWidth={1.7}\n"
    "                    />\n"
    "                    News\n"
    "                  </motion.button>\n"
    "                  {CHART_TIMEFRAME_OPTIONS.map((timeframe) => {"
)

if src == original:
    print("❌  No changes applied — strings may not have matched exactly.")
    print("    Check that TraderPage.jsx has not been modified since you pasted it.")
    sys.exit(1)

with open(TARGET, "w") as f:
    f.write(src)

print("✅  TraderPage.jsx patched successfully.")

# Git commit + push
os.chdir(os.path.expanduser("~/Desktop/Stratify"))
subprocess.run(["git", "add", "src/components/dashboard/TraderPage.jsx"], check=True)
subprocess.run([
    "git", "commit", "-m",
    "fix: news panel 1-click toggle with News button in chart toolbar"
], check=True)
subprocess.run(["git", "push"], check=True)
print("🚀  Pushed to GitHub — Vercel deploying now.")
