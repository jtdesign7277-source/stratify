/**
 * Premium Input Example 3
 * Floating label inputs with focus animations
 */

import { useState } from 'react';

// Floating label text input
export function FloatingInput({ label, value, onChange, type = 'text', icon }) {
  const [focused, setFocused] = useState(false);
  const hasValue = value && value.length > 0;
  
  return (
    <div className="group relative">
      {/* Glow on focus */}
      <div className={`absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur-md transition-opacity duration-300 ${
        focused ? 'opacity-100' : 'opacity-0'
      }`} />
      
      <div className={`relative bg-[#18191b] border rounded-xl transition-all duration-200 ${
        focused 
          ? 'border-blue-500/50' 
          : 'border-[#2a2b2e] hover:border-[#3c4043]'
      }`}>
        <div className="flex items-center px-4">
          {/* Icon */}
          {icon && (
            <div className={`mr-3 transition-colors duration-200 ${
              focused ? 'text-blue-400' : 'text-gray-500'
            }`}>
              {icon}
            </div>
          )}
          
          <div className="relative flex-1 py-4">
            {/* Floating label */}
            <label className={`absolute left-0 transition-all duration-200 pointer-events-none ${
              focused || hasValue
                ? 'text-xs -top-0.5 text-blue-400 font-medium'
                : 'text-sm top-1/2 -translate-y-1/2 text-gray-500'
            }`}>
              {label}
            </label>
            
            {/* Input */}
            <input
              type={type}
              value={value}
              onChange={onChange}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className={`w-full bg-transparent text-white outline-none transition-all duration-200 ${
                focused || hasValue ? 'pt-3' : ''
              }`}
            />
          </div>
        </div>
        
        {/* Focus indicator line */}
        <div className={`absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent transition-opacity duration-300 ${
          focused ? 'opacity-100' : 'opacity-0'
        }`} />
      </div>
    </div>
  );
}

// Text area with character count
export function PremiumTextarea({ label, value, onChange, maxLength = 500, placeholder }) {
  const [focused, setFocused] = useState(false);
  const charCount = value?.length || 0;
  
  return (
    <div className="group relative">
      {/* Glow on focus */}
      <div className={`absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur-md transition-opacity duration-300 ${
        focused ? 'opacity-100' : 'opacity-0'
      }`} />
      
      <div className={`relative bg-[#18191b] border rounded-xl transition-all duration-200 ${
        focused 
          ? 'border-blue-500/50' 
          : 'border-[#2a2b2e] hover:border-[#3c4043]'
      }`}>
        {/* Label */}
        <div className="px-4 pt-3">
          <label className={`text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${
            focused ? 'text-blue-400' : 'text-gray-500'
          }`}>
            {label}
          </label>
        </div>
        
        {/* Textarea */}
        <textarea
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={4}
          className="w-full bg-transparent text-white text-sm px-4 py-2 outline-none resize-none placeholder-gray-600"
        />
        
        {/* Footer with character count */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 bg-[#2a2b2e] rounded text-gray-400 font-mono">⌘</kbd>
            <kbd className="px-1.5 py-0.5 bg-[#2a2b2e] rounded text-gray-400 font-mono">↵</kbd>
            <span>to submit</span>
          </div>
          <span className={`text-xs transition-colors ${
            charCount > maxLength * 0.9 ? 'text-amber-400' : 'text-gray-500'
          }`}>
            {charCount}/{maxLength}
          </span>
        </div>
        
        {/* Focus indicator line */}
        <div className={`absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent transition-opacity duration-300 ${
          focused ? 'opacity-100' : 'opacity-0'
        }`} />
      </div>
    </div>
  );
}

// Search input with suggestions
export function PremiumSearch({ value, onChange, suggestions = [], onSelect }) {
  const [focused, setFocused] = useState(false);
  const showSuggestions = focused && suggestions.length > 0;
  
  return (
    <div className="relative">
      {/* Input container */}
      <div className={`relative bg-[#18191b] border rounded-xl transition-all duration-200 ${
        focused 
          ? 'border-blue-500/50 ring-1 ring-blue-500/20' 
          : 'border-[#2a2b2e] hover:border-[#3c4043]'
      }`}>
        <div className="flex items-center px-4 py-3">
          {/* Search icon */}
          <svg className={`w-5 h-5 mr-3 transition-colors duration-200 ${
            focused ? 'text-blue-400' : 'text-gray-500'
          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          
          <input
            type="text"
            value={value}
            onChange={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search..."
            className="flex-1 bg-transparent text-white outline-none placeholder-gray-500"
          />
          
          {/* Clear button */}
          {value && (
            <button 
              onClick={() => onChange({ target: { value: '' } })}
              className="p-1 text-gray-500 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div className="absolute top-full mt-2 w-full bg-gradient-to-b from-[#1e1f22] to-[#18191b] border border-[#2a2b2e] rounded-xl shadow-2xl overflow-hidden z-50">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSelect(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-3 border-b border-[#2a2b2e] last:border-0"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <span className="text-blue-400 text-sm font-bold">{suggestion.symbol?.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium">{suggestion.symbol}</div>
                <div className="text-xs text-gray-500 truncate">{suggestion.name}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
