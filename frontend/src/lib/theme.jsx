import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);
const THEME_KEY = 'wv-theme';

function storedTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  return saved === 'dark' || saved === 'light' || saved === 'system' ? saved : 'system';
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(storedTheme);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const effective = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
      root.dataset.theme = effective;
      root.style.colorScheme = effective;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', effective === 'dark' ? '#211f1b' : '#f4f0e8');
    };
    apply();
    if (preference === 'system') media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);

  const changeTheme = useCallback((nextTheme) => {
    if (!['system', 'light', 'dark'].includes(nextTheme)) throw new RangeError('Theme must be system, light, or dark');
    localStorage.setItem(THEME_KEY, nextTheme);
    setPreference(nextTheme);
  }, []);
  const value = useMemo(() => ({ preference, changeTheme }), [preference, changeTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used within ThemeProvider');
  return value;
}
