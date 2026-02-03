import { useCallback, useEffect, useRef, useState } from 'react';

const AUTO_DISMISS_MS = 30000;

const useBreakingNews = () => {
  const [breakingNews, setBreakingNews] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const dismissTimerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const dismissBreakingNews = useCallback(() => {
    setIsVisible(false);
    clearTimer();
  }, [clearTimer]);

  const triggerBreakingNews = useCallback((news) => {
    setBreakingNews(news);
    setIsVisible(true);
  }, []);

  useEffect(() => {
    if (!isVisible) return undefined;

    clearTimer();
    dismissTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, AUTO_DISMISS_MS);

    return clearTimer;
  }, [isVisible, breakingNews, clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  return {
    breakingNews,
    isVisible,
    triggerBreakingNews,
    dismissBreakingNews,
  };
};

export default useBreakingNews;
