import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MousePointer2,
  TrendingUp,
  Minus,
  AlignCenter,
  ArrowRight,
  Square,
  Layers,
  BarChart2,
  Trash2,
} from 'lucide-react';

const TOOLS = [
  { toolName: 'cursor', label: 'Select', Icon: MousePointer2, group: 1 },
  { toolName: 'TrendLine', label: 'Trend Line', Icon: TrendingUp, group: 2 },
  { toolName: 'HorizontalLine', label: 'H. Line', Icon: Minus, group: 2 },
  { toolName: 'VerticalLine', label: 'V. Line', Icon: AlignCenter, group: 2 },
  { toolName: 'Ray', label: 'Ray', Icon: ArrowRight, group: 2 },
  { toolName: 'Rectangle', label: 'Rectangle', Icon: Square, group: 3 },
  { toolName: 'ParallelChannel', label: 'Channel', Icon: Layers, group: 3 },
  { toolName: 'FibRetracement', label: 'Fibonacci', Icon: BarChart2, group: 4 },
  { toolName: 'clear', label: 'Clear All', Icon: Trash2, group: 5, isClear: true },
];

function ToolButton({ toolName, label, Icon, isClear, activeTool, onToolSelect }) {
  const [hover, setHover] = useState(false);
  const isActive = activeTool === toolName;
  const colorClass = isClear
    ? 'text-red-500/60 hover:text-red-400'
    : isActive
      ? 'text-emerald-400'
      : 'text-gray-500';

  return (
    <div className="relative flex justify-center">
      <motion.button
        type="button"
        aria-label={label}
        className={`flex items-center justify-center w-9 h-9 ${colorClass}`}
        onClick={() => onToolSelect(toolName)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <Icon strokeWidth={1.5} className="w-4 h-4" />
      </motion.button>
      {hover && (
        <div
          className="absolute left-full ml-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 bg-black/80 px-2 py-1 rounded-lg pointer-events-none whitespace-nowrap z-50"
        >
          {label}
        </div>
      )}
    </div>
  );
}

export default function DrawingToolbar({ lineTools, activeTool, onToolSelect }) {
  let lastGroup = 0;
  return (
    <div
      className="flex flex-col w-9 py-2 px-1 rounded-none border-r border-white/10 bg-[#0b0b0b] self-stretch flex-shrink-0"
      role="toolbar"
      aria-label="Drawing tools"
    >
      {TOOLS.map(({ toolName, label, Icon, group, isClear }) => {
        const showSeparator = group !== lastGroup && lastGroup !== 0;
        lastGroup = group;
        return (
          <React.Fragment key={toolName}>
            {showSeparator && (
              <div className="w-4 h-px bg-white/10 mx-auto my-1" />
            )}
            <ToolButton
              toolName={toolName}
              label={label}
              Icon={Icon}
              isClear={!!isClear}
              activeTool={activeTool}
              onToolSelect={onToolSelect}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}
