import { useCallback, useEffect, useRef, useState } from 'react';

const AUTO_DISMISS_MS = 30000;

const useBreakingNews = () => {
  const [breakingNews, setBreakingNews] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [status, setStatus] = useState('idle');
  const dismissTimerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const dismissBreakingNews = useCallback(() => {
    setIsVisible(false);
    setStatus('dismissed');
    clearTimer();
  }, [clearTimer]);

  const triggerBreakingNews = useCallback((news) => {
    setBreakingNews(news);
    setIsVisible(true);
    setStatus('visible');
  }, []);

  useEffect(() => {
    if (!isVisible) return undefined;

    clearTimer();
    dismissTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      setStatus('dismissed');
    }, AUTO_DISMISS_MS);

    return clearTimer;
  }, [isVisible, breakingNews, clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  return {
    breakingNews,
    isVisible,
    status,
    triggerBreakingNews,
    dismissBreakingNews,
  };
};

export default useBreakingNews;
