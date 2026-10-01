import { createContext, useContext, useEffect, useState } from 'react';

const OnlineContext = createContext(true);

export function OnlineProvider({ children }) {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return <OnlineContext.Provider value={online}>{children}</OnlineContext.Provider>;
}

export function useOnlineStatus() {
  return useContext(OnlineContext);
}
