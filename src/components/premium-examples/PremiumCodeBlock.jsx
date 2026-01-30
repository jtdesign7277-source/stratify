/**
 * Premium Code Block Example 5
 * Syntax-highlighted code display with actions
 */

import { useState } from 'react';

// Simple syntax highlighting for Python
function highlightPython(code) {
  if (!code) return '';
  
  const keywords = ['from', 'import', 'class', 'def', 'if', 'elif', 'else', 'and', 'or', 'not', 'return', 'self', 'True', 'False', 'None'];
  const builtins = ['print', 'len', 'range', 'int', 'float', 'str'];
  
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Comments
    .replace(/(#.*$)/gm, '<span class="text-gray-500 italic">$1</span>')
    // Strings
    .replace(/("[^"]*"|'[^']*')/g, '<span class="text-emerald-400">$1</span>')
    // Numbers
    .replace(/\b(\d+\.?\d*)\b/g, '<span class="text-amber-400">$1</span>')
    // Keywords
    .replace(new RegExp(`\\b(${keywords.join('|')})\\b`, 'g'), '<span class="text-purple-400 font-medium">$1</span>')
    // Builtins
    .replace(new RegExp(`\\b(${builtins.join('|')})\\b`, 'g'), '<span class="text-blue-400">$1</span>')
    // Function definitions
    .replace(/\b(def\s+)(\w+)/g, '$1<span class="text-yellow-400">$2</span>')
    // Class definitions
    .replace(/\b(class\s+)(\w+)/g, '$1<span class="text-cyan-400">$2</span>')
    // Method calls
    .replace(/\.(\w+)\(/g, '.<span class="text-blue-300">$1</span>(');
}

// Premium code block component
export default function PremiumCodeBlock({ 
  code, 
  language = 'python', 
  title,
  onEdit,
  onCopy,
  onRun,
  showLineNumbers = true,
  maxHeight = '400px'
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };
  
  const lines = code?.split('\n') || [];
  const highlightedCode = highlightPython(code);
  
  return (
    <div className="group relative">
      {/* Glow effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Container */}
      <div className="relative bg-gradient-to-br from-[#0d0d0e] to-[#111113] border border-[#2a2b2e] rounded-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#18191b]/50 border-b border-[#2a2b2e]">
          <div className="flex items-center gap-3">
            {/* Window dots */}
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors cursor-pointer" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80 hover:bg-amber-500 transition-colors cursor-pointer" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80 hover:bg-emerald-500 transition-colors cursor-pointer" />
            </div>
            
            {/* Title */}
            {title && (
              <span className="text-sm text-gray-400 font-medium ml-2">{title}</span>
            )}
            
            {/* Language badge */}
            <span className="text-[10px] text-gray-500 uppercase tracking-wider px-2 py-0.5 bg-[#2a2b2e] rounded">
              {language}
            </span>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2">
            {onEdit && (
              <button 
                onClick={onEdit}
                className="p-1.5 text-gray-500 hover:text-blue-400 transition-colors rounded-lg hover:bg-white/5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            
            <button 
              onClick={handleCopy}
              className={`p-1.5 transition-all rounded-lg hover:bg-white/5 ${
                copied ? 'text-emerald-400' : 'text-gray-500 hover:text-white'
              }`}
            >
              {copied ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            
            {onRun && (
              <button 
                onClick={onRun}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors text-xs font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                Run
              </button>
            )}
          </div>
        </div>
        
        {/* Code area */}
        <div 
          className={`overflow-auto transition-all duration-300 ${expanded ? '' : ''}`}
          style={{ maxHeight: expanded ? 'none' : maxHeight }}
        >
          <div className="flex font-mono text-sm leading-relaxed">
            {/* Line numbers */}
            {showLineNumbers && (
              <div className="flex-shrink-0 py-4 px-3 text-right select-none border-r border-[#2a2b2e] bg-[#0a0a0b]">
                {lines.map((_, i) => (
                  <div key={i} className="text-gray-600 text-xs leading-relaxed">
                    {i + 1}
                  </div>
                ))}
              </div>
            )}
            
            {/* Code */}
            <pre className="flex-1 py-4 px-4 overflow-x-auto">
              <code 
                className="text-gray-300 text-xs leading-relaxed"
                dangerouslySetInnerHTML={{ __html: highlightedCode }}
              />
            </pre>
          </div>
        </div>
        
        {/* Expand button (if content is truncated) */}
        {lines.length > 15 && (
          <div className="px-4 py-2 border-t border-[#2a2b2e] bg-[#18191b]/30">
            <button 
              onClick={() => setExpanded(!expanded)}
              className="w-full text-center text-xs text-gray-500 hover:text-white transition-colors flex items-center justify-center gap-1"
            >
              {expanded ? (
                <>
                  <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  Show less
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  Show more ({lines.length - 15} lines)
                </>
              )}
            </button>
          </div>
        )}
        
        {/* Bottom gradient accent */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
      </div>
    </div>
  );
}

// Inline code snippet
export function InlineCode({ children }) {
  return (
    <code className="px-1.5 py-0.5 bg-[#2a2b2e] text-blue-400 rounded text-sm font-mono">
      {children}
    </code>
  );
}

// Code comparison (before/after)
export function CodeComparison({ before, after, beforeTitle = 'Before', afterTitle = 'After' }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          {beforeTitle}
        </div>
        <PremiumCodeBlock code={before} showLineNumbers={false} maxHeight="200px" />
      </div>
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          {afterTitle}
        </div>
        <PremiumCodeBlock code={after} showLineNumbers={false} maxHeight="200px" />
      </div>
    </div>
  );
}
