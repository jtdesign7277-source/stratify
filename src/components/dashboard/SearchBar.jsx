import { useState, useEffect, useRef } from 'react';
import { API_URL } from '../../config';

export default function SearchBar({ onSelectStock }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/public/search?q=${query}`);
        const data = await res.json();
        setResults(data.slice(0, 10));
        setIsOpen(true);
      } catch (err) {
        console.error('Search error:', err);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = async (stock) => {
    setQuery('');
    setIsOpen(false);
    try {
      const res = await fetch(`${API_URL}/api/public/quote/${stock.symbol}`);
      const quote = await res.json();
      onSelectStock?.({ ...stock, ...quote });
    } catch (err) {
      onSelectStock?.(stock);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2">
        <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value.toUpperCase())}
          placeholder="Search stocks..."
          className="bg-transparent text-white text-sm outline-none w-48"
        />
        {loading && <span className="text-xs text-gray-400">...</span>}
      </div>
      
      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-1 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
          {results.map((stock) => (
            <div
              key={stock.symbol}
              onClick={() => handleSelect(stock)}
              className="px-4 py-3 hover:bg-gray-800 cursor-pointer border-b border-gray-800 last:border-0"
            >
              <div className="flex justify-between items-center">
                <span className="text-emerald-400 font-semibold">{stock.symbol}</span>
                <span className="text-xs text-gray-500">{stock.exchange}</span>
              </div>
              <div className="text-sm text-gray-400 truncate">{stock.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
