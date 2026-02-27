import React, { useState, useRef, useCallback, useEffect } from 'react';

/**
 * ResizablePanelGroup - Drag-to-resize stacked panels
 * 
 * Usage in your Community page right sidebar:
 * 
 * <ResizablePanelGroup
 *   topPanel={<LiveNewsWidget />}
 *   bottomPanel={<WatchlistWidget />}
 *   defaultTopHeight={50}    // percentage (0-100)
 *   minTopHeight={15}        // minimum % for top panel
 *   minBottomHeight={15}     // minimum % for bottom panel
 *   containerClassName="h-full"
 * />
 * 
 * The parent container MUST have a defined height (e.g., h-full, h-screen, or fixed px).
 */

const HANDLE_HEIGHT = 12; // px - the drag handle area

export default function ResizablePanelGroup({
  topPanel,
  bottomPanel,
  defaultTopHeight = 50,
  minTopHeight = 15,
  minBottomHeight = 15,
  containerClassName = '',
}) {
  const [topPercent, setTopPercent] = useState(defaultTopHeight);
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startPercent = useRef(0);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    startY.current = e.clientY;
    startPercent.current = topPercent;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [topPercent]);

  const handleTouchStart = useCallback((e) => {
    isDragging.current = true;
    startY.current = e.touches[0].clientY;
    startPercent.current = topPercent;
    document.body.style.userSelect = 'none';
  }, [topPercent]);

  useEffect(() => {
    const handleMove = (clientY) => {
      if (!isDragging.current || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const containerHeight = containerRect.height;
      const deltaY = clientY - startY.current;
      const deltaPercent = (deltaY / containerHeight) * 100;
      const newPercent = Math.min(
        100 - minBottomHeight,
        Math.max(minTopHeight, startPercent.current + deltaPercent)
      );
      setTopPercent(newPercent);
    };

    const handleMouseMove = (e) => handleMove(e.clientY);
    const handleTouchMove = (e) => handleMove(e.touches[0].clientY);

    const handleEnd = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [minTopHeight, minBottomHeight]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col overflow-hidden ${containerClassName}`}
    >
      {/* Top Panel */}
      <div
        className="overflow-hidden"
        style={{ height: `calc(${topPercent}% - ${HANDLE_HEIGHT / 2}px)` }}
      >
        {topPanel}
      </div>

      {/* Drag Handle */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className="flex-shrink-0 flex items-center justify-center cursor-row-resize group z-10"
        style={{ height: `${HANDLE_HEIGHT}px` }}
      >
        {/* Visual grip indicator */}
        <div className="flex flex-col items-center gap-[2px] py-1 px-6 rounded-full 
                        transition-colors duration-150
                        group-hover:bg-blue-500/10">
          <div className="w-8 h-[2px] rounded-full bg-white/10 group-hover:bg-blue-500/60 transition-colors" />
          <div className="w-8 h-[2px] rounded-full bg-white/10 group-hover:bg-blue-500/60 transition-colors" />
        </div>
      </div>

      {/* Bottom Panel */}
      <div
        className="overflow-hidden"
        style={{ height: `calc(${100 - topPercent}% - ${HANDLE_HEIGHT / 2}px)` }}
      >
        {bottomPanel}
      </div>
    </div>
  );
}
