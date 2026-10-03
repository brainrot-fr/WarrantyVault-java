import { createContext, useContext, useEffect, useState } from 'react';
import { apiBaseUrl } from './api.js';

const OnlineContext = createContext(true);
const HEALTH_CHECK_INTERVAL_MS = 10_000;

export function OnlineProvider({ children }) {
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    let disposed = false;
    let timer;
    const updateFromBrowser = () => {
      if (!navigator.onLine) {
        setOnline(false);
        return;
      }
      checkHealth();
    };
    const checkHealth = async () => {
      if (!navigator.onLine) {
        setOnline(false);
        return;
      }
      const controller = new window.AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 3_000);
      try {
        const response = await fetch(`${apiBaseUrl()}/api/health`, {
          cache: 'no-store',
          credentials: 'include',
          signal: controller.signal
        });
        if (!disposed) setOnline(response.ok);
      } catch {
        if (!disposed) setOnline(false);
      } finally {
        clearTimeout(timeout);
      }
    };
    checkHealth();
    timer = window.setInterval(checkHealth, HEALTH_CHECK_INTERVAL_MS);
    window.addEventListener('online', updateFromBrowser);
    window.addEventListener('offline', updateFromBrowser);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('online', updateFromBrowser);
      window.removeEventListener('offline', updateFromBrowser);
    };
  }, []);
  return <OnlineContext.Provider value={online}>{children}</OnlineContext.Provider>;
}

export function useOnlineStatus() {
  return useContext(OnlineContext);
}
