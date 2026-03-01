import React, { useState, useEffect, useRef } from 'react';

const LOGO_DEV_TOKEN = import.meta.env.VITE_LOGO_DEV_TOKEN || '';

function getLogoUrls(symbol) {
  const clean = symbol.replace(/^\$/, '').trim().toUpperCase();

  const CRYPTO_MAP = {
    BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', XRP: 'ripple',
    DOGE: 'dogecoin', LINK: 'chainlink', ADA: 'cardano', AVAX: 'avalanche-2',
    DOT: 'polkadot', MATIC: 'polygon', SHIB: 'shiba-inu', UNI: 'uniswap',
    ATOM: 'cosmos', LTC: 'litecoin', BCH: 'bitcoin-cash',
  };

  const isCrypto = CRYPTO_MAP[clean];

  if (isCrypto) {
    return [
      `https://assets.coingecko.com/coins/images/1/small/${isCrypto}.png`,
      `https://logo.synthfinance.com/icon/${clean}`,
      LOGO_DEV_TOKEN ? `https://img.logo.dev/ticker/${clean}?token=${LOGO_DEV_TOKEN}&size=64` : null,
    ].filter(Boolean);
  }

  return [
    `https://logo.synthfinance.com/icon/${clean}`,
    LOGO_DEV_TOKEN ? `https://img.logo.dev/ticker/${clean}?token=${LOGO_DEV_TOKEN}&size=64` : null,
    `https://storage.googleapis.com/iexcloud-hl37opg/api/logos/${clean}.png`,
  ].filter(Boolean);
}

const logoCache = new Map();

function getAccentColor(symbol) {
  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#f97316', '#ec4899', '#6366f1', '#14b8a6',
  ];
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function TickerLogo({
  symbol,
  size = 20,
  className = '',
  rounded = false,
  showFallback = true,
}) {
  const [logoUrl, setLogoUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const attemptRef = useRef(0);

  const clean = symbol?.replace(/^\$/, '').trim().toUpperCase() || '';

  useEffect(() => {
    if (!clean) { setFailed(true); setLoading(false); return; }

    if (logoCache.has(clean)) {
      const cached = logoCache.get(clean);
      if (cached === 'FAILED') { setFailed(true); setLoading(false); }
      else { setLogoUrl(cached); setLoading(false); }
      return;
    }

    const urls = getLogoUrls(clean);
    attemptRef.current = 0;

    function tryNext() {
      if (attemptRef.current >= urls.length) {
        logoCache.set(clean, 'FAILED');
        setFailed(true);
        setLoading(false);
        return;
      }

      const url = urls[attemptRef.current];
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        if (img.naturalWidth > 2 && img.naturalHeight > 2) {
          logoCache.set(clean, url);
          setLogoUrl(url);
          setLoading(false);
        } else {
          attemptRef.current++;
          tryNext();
        }
      };

      img.onerror = () => {
        attemptRef.current++;
        tryNext();
      };

      setTimeout(() => {
        if (loading && attemptRef.current < urls.length) {
          attemptRef.current++;
          tryNext();
        }
      }, 3000);

      img.src = url;
    }

    setLoading(true);
    setFailed(false);
    tryNext();
  }, [clean]);

  if (failed || (!logoUrl && !loading)) {
    if (!showFallback) return null;
    const color = getAccentColor(clean);
    return (
      <div
        className={`flex items-center justify-center flex-shrink-0 rounded-md ${className}`}
        style={{
          width: size, height: size,
          backgroundColor: `${color}20`, color: color,
          fontSize: Math.max(size * 0.4, 8),
          fontWeight: 700, fontFamily: "'Inter', 'SF Mono', monospace",
        }}
      >
        {clean.charAt(0)}
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={`flex-shrink-0 animate-pulse bg-[#1a2538] rounded-md ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img
      src={logoUrl}
      alt={`${clean} logo`}
      className={`flex-shrink-0 object-contain ${rounded ? 'rounded-full' : 'rounded-sm'} ${className}`}
      style={{ width: size, height: size }}
      onError={() => { logoCache.delete(clean); setFailed(true); }}
      loading="lazy"
    />
  );
}

export function TickerWithLogo({
  symbol, size = 16, className = '',
  textClass = 'text-white font-mono text-sm font-medium', gap = 'gap-2',
}) {
  const clean = symbol?.replace(/^\$/, '').trim().toUpperCase() || '';
  return (
    <div className={`flex items-center ${gap} ${className}`}>
      <TickerLogo symbol={clean} size={size} />
      <span className={textClass}>${clean}</span>
    </div>
  );
}

export function preloadLogos(symbols) {
  symbols.forEach((sym) => {
    const clean = sym.replace(/^\$/, '').trim().toUpperCase();
    if (logoCache.has(clean)) return;
    const urls = getLogoUrls(clean);
    if (urls.length > 0) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { if (img.naturalWidth > 2) logoCache.set(clean, urls[0]); };
      img.src = urls[0];
    }
  });
}
