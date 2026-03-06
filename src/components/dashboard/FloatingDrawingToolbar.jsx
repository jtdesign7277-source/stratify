import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical, Minus, TrendingUp, Square, Trash2, RefreshCw } from 'lucide-react';

const STORAGE_KEY = 'stratify-drawing-toolbar-v1';

function LineSegmentIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <line x1="6" y1="18" x2="18" y2="6" />
    </svg>
  );
}

const TOOLS = [
  { id: 'horizontal', label: 'Horizontal line', icon: Minus },
  { id: 'trend', label: 'Trend line', icon: TrendingUp },
  { id: 'line-segment', label: 'Line segment', icon: LineSegmentIcon },
  { id: 'rectangle', label: 'Rectangle', icon: Square },
];

export default function FloatingDrawingToolbar({ onSelectTool, onClear, selectedToolId = null }) {
  const barRef = useRef(null);
  const positionRef = useRef({ x: 24, y: 120 });
  const dragOffset = useRef({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 24, y: 120 });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { x, y } = JSON.parse(saved);
        if (Number.isFinite(x) && Number.isFinite(y)) setPosition({ x, y });
      }
    } catch {}
  }, []);

  const savePosition = useCallback((pos = positionRef.current) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch {}
  }, []);

  const clampPosition = useCallback((pos) => {
    if (typeof window === 'undefined') return pos;
    const bar = barRef.current;
    const w = bar ? bar.offsetWidth : 280;
    const h = bar ? bar.offsetHeight : 44;
    return {
      x: Math.min(Math.max(0, pos.x), window.innerWidth - w),
      y: Math.min(Math.max(0, pos.y), window.innerHeight - h),
    };
  }, []);

  const handleDragStart = (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragOffset.current = { x: clientX - positionRef.current.x, y: clientY - positionRef.current.y };
    setIsDragging(true);
  };

  const handleDragMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const newPos = clampPosition({
        x: clientX - dragOffset.current.x,
        y: clientY - dragOffset.current.y,
      });
      positionRef.current = newPos;
      if (barRef.current) {
        barRef.current.style.left = `${newPos.x}px`;
        barRef.current.style.top = `${newPos.y}px`;
      }
    },
    [isDragging, clampPosition]
  );

  const handleDragEnd = useCallback(() => {
    if (isDragging) {
      setPosition({ ...positionRef.current });
      savePosition(positionRef.current);
    }
    setIsDragging(false);
  }, [isDragging, savePosition]);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label="Drawing tools"
      className="fixed z-[100] flex items-center gap-0.5 rounded-xl border border-white/[0.08] bg-[#1a1a1f] px-1.5 py-1.5 shadow-lg"
      style={{
        left: position.x,
        top: position.y,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      <div
        className="flex cursor-grab items-center justify-center rounded p-1.5 text-gray-500 hover:text-gray-400 active:cursor-grabbing"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <GripVertical className="h-4 w-4" strokeWidth={2} />
      </div>
      <div className="h-5 w-px bg-white/10" />
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const isActive = selectedToolId === t.id;
        return (
          <button
            key={t.id}
            type="button"
            title={t.label}
            onClick={() => onSelectTool?.(isActive ? null : t.id)}
            className={`flex items-center justify-center rounded p-2 transition-colors ${
              isActive ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            {typeof Icon === 'function' ? <Icon className="h-4 w-4" /> : <Icon className="h-4 w-4" strokeWidth={2} />}
          </button>
        );
      })}
      <div className="h-5 w-px bg-white/10" />
      <button
        type="button"
        title="Clear all drawings"
        onClick={() => onClear?.()}
        className="flex items-center justify-center rounded p-2 text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
      >
        <Trash2 className="h-4 w-4" strokeWidth={2} />
      </button>
      <button
        type="button"
        title="Refresh chart — clear all drawing lines (use if any line is stuck)"
        onClick={() => onClear?.()}
        className="flex items-center justify-center rounded p-2 text-gray-400 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors"
      >
        <RefreshCw className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
