import { useState, useRef, useEffect } from 'react';

/**
 * CollapsiblePanel - Unified collapsible/resizable panel component
 * 
 * Features:
 * - Clean expand/collapse with smooth animation
 * - Optional drag-to-resize
 * - Consistent styling
 * - Works in flex container (flex-shrink/grow based on state)
 */
export default function CollapsiblePanel({
  id,
  title,
  badge,
  badgeColor = 'bg-purple-500/20 text-purple-400',
  expanded = true,
  onToggle,
  minHeight = 40,
  resizable = false,
  onResize,
  headerRight,
  statusDot,
  statusColor = 'emerald',
  themeClasses,
  children,
  className = '',
}) {
  const panelRef = useRef(null);
  
  const statusDotClasses = {
    emerald: 'bg-emerald-400 animate-pulse',
    amber: 'bg-amber-400 animate-pulse',
    red: 'bg-red-400',
    gray: 'bg-gray-500',
  };

  const headerBgClass = expanded ? '' : 'hover:bg-[#3c4043]/50';

  return (
    <div
      ref={panelRef}
      className={`flex flex-col overflow-hidden transition-all duration-200 ease-out ${className}`}
      style={{
        minHeight: `${minHeight}px`,
        flex: expanded ? '1 1 auto' : `0 0 ${minHeight}px`,
      }}
    >
      {/* Header - always visible */}
      <div
        onClick={onToggle}
        className={`h-10 flex-shrink-0 flex items-center justify-between px-3 border-b ${themeClasses?.border || 'border-[#5f6368]'} ${themeClasses?.surfaceElevated || 'bg-[#303134]'} cursor-pointer transition-colors ${headerBgClass}`}
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {statusDot && (
            <div className={`w-2 h-2 rounded-full ${statusDotClasses[statusColor] || statusDotClasses.emerald}`} />
          )}
          <span className={`text-sm font-semibold ${themeClasses?.text || 'text-white'}`}>{title}</span>
          {badge !== undefined && badge !== null && (
            <span className={`px-1.5 py-0.5 text-xs rounded-full ${badgeColor}`}>
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {headerRight}
          {!expanded && (
            <span className="text-xs text-gray-500">Click to expand</span>
          )}
        </div>
      </div>

      {/* Content - only rendered when expanded */}
      {expanded && (
        <div className="flex-1 overflow-hidden min-h-0">
          <div className="h-full overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * PanelDivider - Draggable resize handle between panels
 */
export function PanelDivider({ onDragStart, isDragging }) {
  return (
    <div
      onMouseDown={onDragStart}
      className={`h-1.5 flex-shrink-0 cursor-row-resize flex items-center justify-center transition-colors ${
        isDragging ? 'bg-blue-500/30' : 'hover:bg-blue-500/20'
      }`}
    >
      <div className={`w-10 h-0.5 rounded-full transition-colors ${isDragging ? 'bg-blue-500' : 'bg-[#5f6368]'}`} />
    </div>
  );
}
