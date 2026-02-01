import { useState, useRef, useEffect } from 'react';

/**
 * CollapsiblePanel - Premium collapsible panel with smooth animations
 */
export default function CollapsiblePanel({
  id,
  title,
  badge,
  badgeColor = 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  expanded = true,
  onToggle,
  minHeight = 44,
  resizable = false,
  onResize,
  headerRight,
  statusDot,
  statusColor = 'emerald',
  themeClasses,
  children,
  className = '',
  icon,
}) {
  const panelRef = useRef(null);
  
  const statusDotClasses = {
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    red: 'bg-red-400',
    gray: 'bg-gray-500',
    cyan: 'bg-cyan-400',
    purple: 'bg-purple-400',
  };

  return (
    <div
      ref={panelRef}
      className={`flex flex-col overflow-hidden transition-all duration-300 ease-out ${className}`}
      style={{
        minHeight: `${minHeight}px`,
        flex: expanded ? '1 1 auto' : `0 0 ${minHeight}px`,
      }}
    >
      {/* Premium Header */}
      <div
        onClick={onToggle}
        className={`h-11 flex-shrink-0 flex items-center justify-between px-4 border-b border-[#1e1e2d] bg-[#0f0f14] cursor-pointer transition-all duration-200 hover:bg-[#12121a] group`}
      >
        <div className="flex items-center gap-3">
          {/* Animated Chevron */}
          <svg
            className={`w-4 h-4 text-gray-500 group-hover:text-gray-400 transition-all duration-200 ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
          </svg>
          
          {/* Status Dot with Pulse */}
          {statusDot && (
            <div className="relative">
              <div className={`w-2 h-2 rounded-full ${statusDotClasses[statusColor] || statusDotClasses.emerald}`} />
              {statusColor === 'emerald' && (
                <div className={`absolute inset-0 w-2 h-2 rounded-full ${statusDotClasses[statusColor]} animate-ping opacity-40`} />
              )}
            </div>
          )}
          
          {/* Icon */}
          {icon && <span className="text-base">{icon}</span>}
          
          {/* Title */}
          <span className="text-sm font-semibold text-white tracking-tight">{title}</span>
          
          {/* Badge */}
          {badge !== undefined && badge !== null && (
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badgeColor}`}>
              {badge}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {headerRight}
          {!expanded && (
            <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">Click to expand</span>
          )}
        </div>
      </div>

      {/* Content with Smooth Reveal */}
      <div 
        className={`flex-1 overflow-hidden transition-all duration-300 ease-out ${expanded ? 'opacity-100' : 'opacity-0'}`}
        style={{ 
          maxHeight: expanded ? '2000px' : '0px',
          transition: 'max-height 0.3s ease-out, opacity 0.2s ease-out'
        }}
      >
        <div className="h-full overflow-y-auto scrollbar-hide bg-[#0a0a0f]" style={{ scrollbarWidth: 'none' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * PanelDivider - Premium draggable resize handle
 */
export function PanelDivider({ onDragStart, isDragging }) {
  return (
    <div
      onMouseDown={onDragStart}
      className={`h-2 flex-shrink-0 cursor-row-resize flex items-center justify-center transition-all duration-200 ${
        isDragging ? 'bg-cyan-500/20' : 'hover:bg-cyan-500/10'
      }`}
    >
      <div className={`w-12 h-1 rounded-full transition-all duration-200 ${
        isDragging ? 'bg-cyan-500 shadow-lg shadow-cyan-500/30' : 'bg-[#2a2a3d] hover:bg-[#3a3a4d]'
      }`} />
    </div>
  );
}
