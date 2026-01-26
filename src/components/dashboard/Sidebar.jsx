import { useState, useEffect } from 'react';
import Watchlist from './Watchlist';

const navItems = [
  { id: 'portfolio', label: 'Portfolio', icon: 'chart-pie' },
  { id: 'watchlist', label: 'Watchlist', icon: 'eye' },
  { id: 'strategies', label: 'Strategies', icon: 'trending-up' },
  { id: 'backtest', label: 'Backtest', icon: 'flask' },
  { id: 'ai-builder', label: 'AI Builder', icon: 'brain' },
  { id: 'news', label: 'News', icon: 'newspaper' },
];

const bottomItems = [
  { id: 'settings', label: 'Settings', icon: 'cog' },
  { id: 'help', label: 'Help', icon: 'question' },
];

const IconComponent = ({ name, className }) => {
  const icons = {
    'chart-pie': <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>,
    'eye': <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
    'trending-up': <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
    'flask': <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
    'brain': <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
    'newspaper': <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>,
    'cog': <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    'question': <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  };
  return icons[name] || null;
};

export default function Sidebar({ expanded, onToggle, activeSection, onSectionChange, theme, themeClasses, watchlist = [], onRemoveFromWatchlist }) {
  const [hoveredItem, setHoveredItem] = useState(null);
  
  // Auto-expand sidebar when watchlist section is active
  useEffect(() => {
    if (activeSection === 'watchlist') {
      onToggle(true);
    }
  }, [activeSection]);

  // Don't collapse when watchlist is active
  const handleMouseLeave = () => {
    if (activeSection !== 'watchlist') {
      onToggle(false);
    }
  };

  return (
    <div className={`${expanded ? (activeSection === 'watchlist' ? 'w-72' : 'w-60') : 'w-16'} flex flex-col transition-all duration-200 ${themeClasses.surfaceElevated}`} onMouseEnter={() => onToggle(true)} onMouseLeave={handleMouseLeave}>
      <div className="h-14 flex items-center justify-center border-b border-[#2A2A2A]">
        {!expanded && (
          <span className="text-2xl font-semibold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">S</span>
        )}
        {expanded && (
          <span className="font-semibold text-xl bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Stratify</span>
        )}
      </div>
      <nav className="flex-1 py-2 flex flex-col overflow-hidden">
        <div className="flex-shrink-0">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => onSectionChange(item.id)} onMouseEnter={() => setHoveredItem(item.id)} onMouseLeave={() => setHoveredItem(null)}
              className={`w-full flex items-center px-4 py-3 transition-all relative ${activeSection === item.id ? 'text-[#F5F5F5] bg-[#2A2A2A]' : 'text-[#6B6B6B] hover:text-[#F5F5F5] hover:bg-[#252525]'}`}>
              {activeSection === item.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-emerald-500 rounded-r" />}
              <IconComponent name={item.icon} className="w-5 h-5 flex-shrink-0" />
              {expanded && <span className="ml-3 text-sm font-medium">{item.label}</span>}
              {!expanded && hoveredItem === item.id && <div className="absolute left-full ml-2 px-2 py-1 bg-[#333] text-white text-xs rounded shadow-lg whitespace-nowrap z-50">{item.label}</div>}
            </button>
          ))}
        </div>
        
        {/* Watchlist content - shows when watchlist section is active */}
        {activeSection === 'watchlist' && expanded && (
          <div className="flex-1 overflow-y-auto border-t border-[#2A2A2A] mt-2">
            <Watchlist 
              stocks={watchlist} 
              onRemove={onRemoveFromWatchlist} 
              themeClasses={themeClasses} 
            />
          </div>
        )}
      </nav>
      <div className="border-t border-[#2A2A2A] py-2">
        {bottomItems.map((item) => (
          <button key={item.id} onClick={() => onSectionChange(item.id)} onMouseEnter={() => setHoveredItem(item.id)} onMouseLeave={() => setHoveredItem(null)}
            className={`w-full flex items-center px-4 py-3 transition-all relative ${activeSection === item.id ? 'text-[#F5F5F5] bg-[#2A2A2A]' : 'text-[#6B6B6B] hover:text-[#F5F5F5] hover:bg-[#252525]'}`}>
            {activeSection === item.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-emerald-500 rounded-r" />}
            <IconComponent name={item.icon} className="w-5 h-5 flex-shrink-0" />
            {expanded && <span className="ml-3 text-sm font-medium">{item.label}</span>}
            {!expanded && hoveredItem === item.id && <div className="absolute left-full ml-2 px-2 py-1 bg-[#333] text-white text-xs rounded shadow-lg whitespace-nowrap z-50">{item.label}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
