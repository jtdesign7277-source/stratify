import { useState, useEffect } from 'react';
import Watchlist from './Watchlist';

// Stratify Logo - Orbital S design
const StratifyLogo = ({ collapsed }) => {
  if (collapsed) {
    return (
      <svg viewBox="0 0 40 40" className="w-8 h-8">
        {/* Outer orbital ring */}
        <ellipse cx="20" cy="20" rx="18" ry="10" fill="none" stroke="#3B82F6" strokeWidth="0.8" opacity="0.4" transform="rotate(-20 20 20)" />
        {/* Middle orbital ring */}
        <ellipse cx="20" cy="20" rx="16" ry="14" fill="none" stroke="#60A5FA" strokeWidth="0.6" opacity="0.5" transform="rotate(25 20 20)" />
        {/* Inner orbital ring */}
        <ellipse cx="20" cy="20" rx="14" ry="12" fill="none" stroke="#93C5FD" strokeWidth="0.5" opacity="0.3" transform="rotate(-45 20 20)" />
        {/* Orbital dots */}
        <circle cx="36" cy="14" r="1.5" fill="#60A5FA" />
        <circle cx="4" cy="26" r="1.5" fill="#60A5FA" />
        <circle cx="28" cy="34" r="1.2" fill="#3B82F6" opacity="0.7" />
        <circle cx="8" cy="8" r="1" fill="#93C5FD" opacity="0.5" />
        {/* The S */}
        <text x="20" y="26" textAnchor="middle" fill="url(#logoGradient)" fontSize="18" fontWeight="600" fontFamily="system-ui, -apple-system, sans-serif">S</text>
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 40 40" className="w-7 h-7">
        <ellipse cx="20" cy="20" rx="18" ry="10" fill="none" stroke="#3B82F6" strokeWidth="0.8" opacity="0.4" transform="rotate(-20 20 20)" />
        <ellipse cx="20" cy="20" rx="16" ry="14" fill="none" stroke="#60A5FA" strokeWidth="0.6" opacity="0.5" transform="rotate(25 20 20)" />
        <ellipse cx="20" cy="20" rx="14" ry="12" fill="none" stroke="#93C5FD" strokeWidth="0.5" opacity="0.3" transform="rotate(-45 20 20)" />
        <circle cx="36" cy="14" r="1.5" fill="#60A5FA" />
        <circle cx="4" cy="26" r="1.5" fill="#60A5FA" />
        <circle cx="28" cy="34" r="1.2" fill="#3B82F6" opacity="0.7" />
        <circle cx="8" cy="8" r="1" fill="#93C5FD" opacity="0.5" />
        <text x="20" y="26" textAnchor="middle" fill="url(#logoGradientFull)" fontSize="18" fontWeight="600" fontFamily="system-ui, -apple-system, sans-serif">S</text>
        <defs>
          <linearGradient id="logoGradientFull" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
      </svg>
      <span className="text-lg font-semibold text-white tracking-tight">Stratify</span>
    </div>
  );
};

// Clean folder icon - just lines
const FolderIcon = ({ open, className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    {open ? (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    )}
  </svg>
);

// Chevron icon
const ChevronIcon = ({ open, className = "w-3 h-3" }) => (
  <svg className={`${className} transition-transform duration-150 ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

// Strategy Folders Component - Clean design
const StrategiesFolders = ({ savedStrategies, onRemoveSavedStrategy, sidebarExpanded }) => {
  const [expandedFolders, setExpandedFolders] = useState({
    low: false,
    medium: false,
    high: false
  });

  const toggleFolder = (folder) => {
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const folders = [
    { id: 'low', label: 'Low Risk', color: '#10B981' },
    { id: 'medium', label: 'Medium Risk', color: '#F59E0B' },
    { id: 'high', label: 'High Risk', color: '#EF4444' }
  ];

  const getStrategiesByRisk = (riskLevel) => {
    return savedStrategies.filter(s => s.riskLevel === riskLevel);
  };

  if (savedStrategies.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-xs text-gray-500">No saved strategies</p>
      </div>
    );
  }

  return (
    <div className="py-1">
      {folders.map(folder => {
        const strategies = getStrategiesByRisk(folder.id);
        const isOpen = expandedFolders[folder.id];
        
        return (
          <div key={folder.id}>
            {/* Folder header - clean, no background box */}
            <button
              onClick={() => toggleFolder(folder.id)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-gray-400 hover:text-white transition-colors group"
            >
              <ChevronIcon open={isOpen} className="w-2.5 h-2.5 text-gray-500 group-hover:text-gray-400" />
              <FolderIcon open={isOpen} className="w-3.5 h-3.5" style={{ color: folder.color }} />
              <span className="text-xs font-medium flex-1 text-left">{folder.label}</span>
              {strategies.length > 0 && (
                <span className="text-[10px] text-gray-600">{strategies.length}</span>
              )}
            </button>
            
            {/* Strategies list - indented, clean lines */}
            {isOpen && strategies.length > 0 && (
              <div className="ml-5 border-l border-[#5f6368]">
                {strategies.map(strategy => (
                  <div 
                    key={strategy.id}
                    className="group flex items-center justify-between pl-3 pr-2 py-1 hover:bg-[#3c4043] transition-colors"
                  >
                    <span className="text-[11px] text-gray-400 group-hover:text-gray-200 truncate">
                      {strategy.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveSavedStrategy?.(strategy.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-0.5"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

// Nav items - customizable
const defaultNavItems = [
  { id: 'watchlist', label: 'Lists', icon: 'eye', hasContent: true },
  { id: 'strategies', label: 'Strategies', icon: 'chart', hasContent: true },
  { id: 'brokers', label: 'Brokers', icon: 'link', hasContent: true },
  { id: 'backtest', label: 'Backtest', icon: 'flask' },
  { id: 'ai-builder', label: 'AI Builder', icon: 'spark' },
  { id: 'news', label: 'News', icon: 'document' },
];

const defaultBottomItems = [
  { id: 'settings', label: 'Settings', icon: 'gear', hasContent: true },
  { id: 'help', label: 'Help', icon: 'question' },
];

// Icon component - clean outlined icons, no backgrounds
const Icon = ({ name, className = "w-4 h-4" }) => {
  const icons = {
    eye: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    chart: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
    flask: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611l-.002 0a9.002 9.002 0 01-6.766-1.604 9.002 9.002 0 00-6.766 1.604l-.002 0c-1.717-.293-2.299-2.379-1.067-3.611L5 14.5" />
      </svg>
    ),
    spark: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
    document: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    gear: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    question: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
    ),
    link: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
  };
  return icons[name] || null;
};

// Settings Panel Component - Clean design
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
      <div className="space-y-2">
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wide">First Name</label>
          <input
            type="text"
            value={userInfo.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            placeholder="Enter first name"
            className="w-full bg-transparent border-b border-[#5f6368] focus:border-blue-500 px-0 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
          />
        </div>
        
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wide">Last Name</label>
          <input
            type="text"
            value={userInfo.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            placeholder="Enter last name"
            className="w-full bg-transparent border-b border-[#5f6368] focus:border-blue-500 px-0 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
          />
        </div>
        
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wide">Email</label>
          <input
            type="email"
            value={userInfo.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="Enter email address"
            className="w-full bg-transparent border-b border-[#5f6368] focus:border-blue-500 px-0 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
          />
        </div>
      </div>
    </div>
  );
};

// Mini broker icons for sidebar
const MiniBrokerIcon = ({ broker, className = "w-6 h-6" }) => {
  const icons = {
    alpaca: <div className={`${className} rounded bg-[#FFCD00] flex items-center justify-center text-[8px] font-bold text-black`}>A</div>,
    polymarket: <div className={`${className} rounded bg-[#6366F1] flex items-center justify-center text-[8px] font-bold text-white`}>P</div>,
    kalshi: <div className={`${className} rounded bg-[#00D4AA] flex items-center justify-center text-[8px] font-bold text-black`}>K</div>,
    webull: <div className={`${className} rounded bg-[#FF5722] flex items-center justify-center text-[8px] font-bold text-white`}>W</div>,
    ibkr: <div className={`${className} rounded bg-[#D32F2F] flex items-center justify-center text-[6px] font-bold text-white`}>IB</div>,
    robinhood: <div className={`${className} rounded bg-[#00C805] flex items-center justify-center text-[8px] font-bold text-white`}>R</div>,
    coinbase: <div className={`${className} rounded bg-[#0052FF] flex items-center justify-center text-[8px] font-bold text-white`}>C</div>,
    binance: <div className={`${className} rounded bg-[#F3BA2F] flex items-center justify-center text-[8px] font-bold text-black`}>B</div>,
  };
  return icons[broker] || null;
};

const availableBrokers = [
  { id: 'alpaca', name: 'Alpaca' },
  { id: 'polymarket', name: 'Polymarket' },
  { id: 'kalshi', name: 'Kalshi' },
  { id: 'webull', name: 'Webull' },
  { id: 'ibkr', name: 'IBKR' },
  { id: 'robinhood', name: 'Robinhood' },
  { id: 'coinbase', name: 'Coinbase' },
  { id: 'binance', name: 'Binance' },
];

// Brokers Grid Component
const BrokersGrid = ({ connectedBrokers = [], onOpenBrokerModal }) => {
  const isConnected = (brokerId) => connectedBrokers.some(b => b.id === brokerId);
  
  return (
    <div className="p-2">
      <div className="grid grid-cols-4 gap-1.5">
        {availableBrokers.map(broker => {
          const connected = isConnected(broker.id);
          return (
            <button
              key={broker.id}
              onClick={() => !connected && onOpenBrokerModal?.()}
              className={`relative p-2 rounded-lg transition-all flex flex-col items-center gap-1 ${
                connected 
                  ? 'bg-emerald-500/10 border border-emerald-500/30'
                  : 'bg-[#303134] border border-[#5f6368] hover:border-blue-500/50'
              }`}
            >
              {connected && (
                <div className="absolute -top-1 -right-1">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full flex items-center justify-center">
                    <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
              <MiniBrokerIcon broker={broker.id} />
              <span className="text-[9px] text-gray-400 truncate w-full text-center">{broker.name}</span>
            </button>
          );
        })}
      </div>
      <button
        onClick={() => onOpenBrokerModal?.()}
        className="w-full mt-2 py-1.5 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
      >
        + Connect New Broker
      </button>
    </div>
  );
};

export default function Sidebar({ 
  expanded, 
  onToggle, 
  activeSection, 
  onSectionChange, 
  theme, 
  themeClasses, 
  watchlist = [], 
  onRemoveFromWatchlist, 
  onViewChart, 
  savedStrategies = [], 
  onRemoveSavedStrategy,
  connectedBrokers = [],
  onOpenBrokerModal,
  customNavItems,
  customBottomItems
}) {
  const [hoveredItem, setHoveredItem] = useState(null);
  
  // Use custom items if provided, otherwise defaults
  const navItems = customNavItems || defaultNavItems;
  const bottomItems = customBottomItems || defaultBottomItems;
  
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

  return (
    <div 
      id="sidebar-container"
      className={`${expanded ? 'w-80' : 'w-14'} flex flex-col transition-all duration-200 ease-out bg-[#202124] border-r border-[#5f6368]`}
      onMouseEnter={handleMouseEnter} 
      onMouseLeave={handleMouseLeave}
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-center px-3">
        <StratifyLogo collapsed={!expanded} />
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-[#5f6368]" />

      {/* Navigation */}
      <nav className="flex-1 py-3 flex flex-col overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {navItems.map((item) => {
          const isExpanded = expandedSections[item.id];
          const isActive = activeSection === item.id;
          
          return (
            <div key={item.id}>
              {/* Nav item */}
              <button 
                onClick={() => {
                  onSectionChange(item.id);
                  if (item.hasContent && expanded) {
                    toggleSection(item.id);
                  }
                }}
                onMouseEnter={() => setHoveredItem(item.id)} 
                onMouseLeave={() => setHoveredItem(null)}
                className={`w-full flex items-center gap-3 px-4 py-2 transition-colors relative group ${
                  isActive 
                    ? 'text-white' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {/* Active indicator - subtle left border */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-500 rounded-r" />
                )}
                
                {/* Icon - no background, just the icon */}
                <Icon name={item.icon} className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
                
                {/* Label */}
                {expanded && (
                  <>
                    <span className="text-sm flex-1 text-left">{item.label}</span>
                    {item.hasContent && (
                      <ChevronIcon open={isExpanded} className="w-3 h-3 text-gray-600" />
                    )}
                  </>
                )}
                
                {/* Tooltip when collapsed */}
                {!expanded && hoveredItem === item.id && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-[#3c4043] text-white text-xs rounded shadow-lg whitespace-nowrap z-50 border border-[#5f6368]">
                    {item.label}
                  </div>
                )}
              </button>

              {/* Watchlist content */}
              {expanded && item.id === 'watchlist' && isExpanded && (
                <div className="ml-4 border-l border-[#5f6368]">
                  <div className="max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <Watchlist 
                      stocks={watchlist} 
                      onRemove={onRemoveFromWatchlist}
                      onViewChart={onViewChart}
                      themeClasses={themeClasses}
                      compact={true}
                    />
                  </div>
                </div>
              )}

              {/* Strategies content */}
              {expanded && item.id === 'strategies' && isExpanded && (
                <div className="ml-4 border-l border-[#5f6368]">
                  <div className="max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <StrategiesFolders 
                      savedStrategies={savedStrategies} 
                      onRemoveSavedStrategy={onRemoveSavedStrategy}
                      sidebarExpanded={expanded}
                    />
                  </div>
                </div>
              )}

              {/* Brokers content */}
              {expanded && item.id === 'brokers' && isExpanded && (
                <div className="ml-4 border-l border-[#5f6368]">
                  <BrokersGrid 
                    connectedBrokers={connectedBrokers}
                    onOpenBrokerModal={onOpenBrokerModal}
                  />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 border-t border-[#5f6368]" />

      {/* Bottom items */}
      <div className="py-3">
        {bottomItems.map((item) => {
          const isExpanded = expandedSections[item.id];
          const isActive = activeSection === item.id;
          
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
                className={`w-full flex items-center gap-3 px-4 py-2 transition-colors relative group ${
                  isActive 
                    ? 'text-white' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-500 rounded-r" />
                )}
                
                <Icon name={item.icon} className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
                
                {expanded && (
                  <>
                    <span className="text-sm flex-1 text-left">{item.label}</span>
                    {item.hasContent && (
                      <ChevronIcon open={isExpanded} className="w-3 h-3 text-gray-600" />
                    )}
                  </>
                )}
                
                {!expanded && hoveredItem === item.id && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-[#3c4043] text-white text-xs rounded shadow-lg whitespace-nowrap z-50 border border-[#5f6368]">
                    {item.label}
                  </div>
                )}
              </button>
              
              {/* Settings content */}
              {expanded && item.id === 'settings' && isExpanded && (
                <div className="ml-4 border-l border-[#5f6368]">
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
