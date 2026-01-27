import { useState, useEffect } from 'react';
import Watchlist from './Watchlist';

// Risk Level Folders Component
const StrategiesFolders = ({ savedStrategies, onRemoveSavedStrategy }) => {
  const [expandedFolders, setExpandedFolders] = useState({
    low: true,
    medium: true,
    high: true
  });

  const toggleFolder = (folder) => {
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const riskFolders = [
    { id: 'low', label: 'Low Risk', color: 'emerald', icon: '🛡️' },
    { id: 'medium', label: 'Medium Risk', color: 'amber', icon: '⚖️' },
    { id: 'high', label: 'High Risk', color: 'red', icon: '🔥' }
  ];

  const getStrategiesByRisk = (riskLevel) => {
    return savedStrategies.filter(s => s.riskLevel === riskLevel);
  };

  const colorClasses = {
    low: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', hover: 'hover:border-emerald-500/50' },
    medium: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', hover: 'hover:border-amber-500/50' },
    high: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', hover: 'hover:border-red-500/50' }
  };

  if (savedStrategies.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 text-xs px-2">
        <svg className="w-6 h-6 mx-auto mb-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <p className="text-[10px]">No saved strategies</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 px-2 py-1">
      {riskFolders.map(folder => {
        const strategies = getStrategiesByRisk(folder.id);
        const colors = colorClasses[folder.id];
        const isExpanded = expandedFolders[folder.id];
        
        return (
          <div key={folder.id} className="rounded-lg overflow-hidden">
            <button
              onClick={() => toggleFolder(folder.id)}
              className={`w-full flex items-center justify-between p-1.5 ${colors.bg} border ${colors.border} ${colors.hover} rounded transition-colors`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xs">{folder.icon}</span>
                <span className={`text-[10px] font-medium ${colors.text}`}>{folder.label}</span>
                <span className="text-[9px] text-gray-500">({strategies.length})</span>
              </div>
              <svg 
                className={`w-2.5 h-2.5 ${colors.text} transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            {isExpanded && strategies.length > 0 && (
              <div className="mt-0.5 ml-1.5 space-y-0.5">
                {strategies.map(strategy => (
                  <div 
                    key={strategy.id}
                    className="group flex items-center justify-between p-1.5 rounded bg-[#1A1A1A] border border-[#2A2A2A] hover:border-purple-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <svg className={`w-2.5 h-2.5 ${colors.text} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      <span className="text-[10px] text-[#F5F5F5] truncate">{strategy.name}</span>
                    </div>
                    <button
                      onClick={() => onRemoveSavedStrategy?.(strategy.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all p-0.5 rounded hover:bg-red-500/10"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const navItems = [
  { id: 'watchlist', label: 'Watchlist', icon: 'eye' },
  { id: 'strategies', label: 'Strategies', icon: 'trending-up' },
  { id: 'backtest', label: 'Backtest', icon: 'flask' },
  { id: 'ai-builder', label: 'AI Builder', icon: 'brain' },
  { id: 'news', label: 'News', icon: 'newspaper' },
];

const bottomItems = [
  { id: 'settings', label: 'Settings', icon: 'cog', hasContent: true },
  { id: 'help', label: 'Help', icon: 'question' },
];

// Settings Panel Component
const SettingsPanel = () => {
  const [userInfo, setUserInfo] = useState(() => {
    const saved = localStorage.getItem('stratify-user-info');
    return saved ? JSON.parse(saved) : { firstName: '', lastName: '', email: '' };
  });

  const handleChange = (field, value) => {
    setUserInfo(prev => {
      const updated = { ...prev, [field]: value };
      localStorage.setItem('stratify-user-info', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <div className="px-3 py-3 space-y-3">
      <div className="text-xs text-gray-400 font-medium mb-2">User Information</div>
      
      <div>
        <label className="text-[10px] text-gray-500 block mb-1">First Name</label>
        <input
          type="text"
          value={userInfo.firstName}
          onChange={(e) => handleChange('firstName', e.target.value)}
          placeholder="Enter first name"
          className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded px-2.5 py-1.5 text-sm text-white placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none transition-colors"
        />
      </div>
      
      <div>
        <label className="text-[10px] text-gray-500 block mb-1">Last Name</label>
        <input
          type="text"
          value={userInfo.lastName}
          onChange={(e) => handleChange('lastName', e.target.value)}
          placeholder="Enter last name"
          className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded px-2.5 py-1.5 text-sm text-white placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none transition-colors"
        />
      </div>
      
      <div>
        <label className="text-[10px] text-gray-500 block mb-1">Email</label>
        <input
          type="email"
          value={userInfo.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="Enter email address"
          className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded px-2.5 py-1.5 text-sm text-white placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none transition-colors"
        />
      </div>

      <div className="pt-2 border-t border-[#2A2A2A] mt-3">
        <div className="text-[10px] text-gray-600">Changes are saved automatically</div>
      </div>
    </div>
  );
};

const IconComponent = ({ name, className }) => {
  const icons = {
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

export default function Sidebar({ expanded, onToggle, activeSection, onSectionChange, theme, themeClasses, watchlist = [], onRemoveFromWatchlist, onViewChart, savedStrategies = [], onRemoveSavedStrategy }) {
  const [hoveredItem, setHoveredItem] = useState(null);
  
  // Track which sections are expanded (multiple can be open)
  const [expandedSections, setExpandedSections] = useState(() => {
    const saved = localStorage.getItem('stratify-expanded-sections');
    return saved ? JSON.parse(saved) : { watchlist: true, strategies: false };
  });

  // Save expanded sections to localStorage
  useEffect(() => {
    localStorage.setItem('stratify-expanded-sections', JSON.stringify(expandedSections));
  }, [expandedSections]);

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  // Expand on hover, collapse on leave
  const handleMouseEnter = () => onToggle(true);
  const handleMouseLeave = () => onToggle(false);

  // Count open sections for width calculation
  const openSectionsCount = Object.values(expandedSections).filter(Boolean).length;

  // Determine width based on expanded state
  const getWidth = () => {
    if (!expanded) return 'w-16';
    return 'w-72';
  };

  return (
    <div 
      id="sidebar-container"
      className={`${getWidth()} flex flex-col transition-all duration-200 ${themeClasses.surfaceElevated}`} 
      onMouseEnter={handleMouseEnter} 
      onMouseLeave={handleMouseLeave}
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-center border-b border-[#2A2A2A]">
        {!expanded ? (
          <span className="text-2xl font-semibold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">S</span>
        ) : (
          <span className="font-semibold text-xl bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Stratify</span>
        )}
      </div>

      {/* Navigation - Scrollable */}
      <nav className="flex-1 py-2 flex flex-col overflow-y-auto overflow-x-hidden scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {navItems.map((item) => {
          const isExpanded = expandedSections[item.id];
          const hasContent = item.id === 'watchlist' || item.id === 'strategies';
          
          return (
            <div key={item.id}>
              {/* Section Header */}
              <button 
                onClick={() => {
                  onSectionChange(item.id);
                  if (hasContent && expanded) {
                    toggleSection(item.id);
                  }
                }}
                onMouseEnter={() => setHoveredItem(item.id)} 
                onMouseLeave={() => setHoveredItem(null)}
                className={`w-full flex items-center justify-between px-4 py-2.5 transition-all relative ${
                  activeSection === item.id 
                    ? 'text-[#F5F5F5] bg-[#2A2A2A]' 
                    : 'text-[#6B6B6B] hover:text-[#F5F5F5] hover:bg-[#252525]'
                }`}
              >
                <div className="flex items-center">
                  {/* Active indicator */}
                  {activeSection === item.id && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-emerald-500 rounded-r" />
                  )}
                  
                  {/* Icon */}
                  <IconComponent name={item.icon} className="w-5 h-5 flex-shrink-0" />
                  
                  {/* Label (shown when expanded) */}
                  {expanded && <span className="ml-3 text-sm font-medium whitespace-nowrap">{item.label}</span>}
                </div>

                {/* Expand/Collapse Arrow for sections with content */}
                {expanded && hasContent && (
                  <svg 
                    className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
                
                {/* Tooltip (shown when collapsed and hovered) */}
                {!expanded && hoveredItem === item.id && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-[#333] text-white text-xs rounded shadow-lg whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </button>

              {/* Section Content - Watchlist */}
              {expanded && item.id === 'watchlist' && isExpanded && (
                <div className="border-t border-b border-[#2A2A2A] bg-[#161616]">
                  <div 
                    className="overflow-y-auto scrollbar-hide max-h-48"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    <Watchlist 
                      stocks={watchlist} 
                      onRemove={onRemoveFromWatchlist}
                      onViewChart={onViewChart}
                      themeClasses={themeClasses} 
                    />
                  </div>
                </div>
              )}

              {/* Section Content - Strategies */}
              {expanded && item.id === 'strategies' && isExpanded && (
                <div className="border-t border-b border-[#2A2A2A] bg-[#161616] max-h-64 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <StrategiesFolders 
                    savedStrategies={savedStrategies} 
                    onRemoveSavedStrategy={onRemoveSavedStrategy}
                  />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom items (Settings, Help) */}
      <div className="border-t border-[#2A2A2A] py-2">
        {bottomItems.map((item) => {
          const isSettingsExpanded = expandedSections[item.id];
          
          return (
            <div key={item.id}>
              <button 
                onClick={() => {
                  onSectionChange(item.id);
                  if (item.hasContent && expanded) {
                    toggleSection(item.id);
                  }
                }} 
                onMouseEnter={() => setHoveredItem(item.id)} 
                onMouseLeave={() => setHoveredItem(null)}
                className={`w-full flex items-center justify-between px-4 py-2.5 transition-all relative ${
                  activeSection === item.id 
                    ? 'text-[#F5F5F5] bg-[#2A2A2A]' 
                    : 'text-[#6B6B6B] hover:text-[#F5F5F5] hover:bg-[#252525]'
                }`}
              >
                <div className="flex items-center">
                  {activeSection === item.id && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-emerald-500 rounded-r" />
                  )}
                  <IconComponent name={item.icon} className="w-5 h-5 flex-shrink-0" />
                  {expanded && <span className="ml-3 text-sm font-medium whitespace-nowrap">{item.label}</span>}
                </div>
                
                {expanded && item.hasContent && (
                  <svg 
                    className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isSettingsExpanded ? 'rotate-90' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
                
                {!expanded && hoveredItem === item.id && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-[#333] text-white text-xs rounded shadow-lg whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </button>
              
              {/* Settings Content */}
              {expanded && item.id === 'settings' && isSettingsExpanded && (
                <div className="border-t border-b border-[#2A2A2A] bg-[#161616]">
                  <SettingsPanel />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
