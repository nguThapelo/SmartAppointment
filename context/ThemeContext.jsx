import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext({
  themeMode: 'night',
  themeAccent: 'aurora',
  setThemeMode: () => {},
  setThemeAccent: () => {},
  toggleThemeMode: () => {},
});

const STORAGE_KEY = 'themeMode';
const ACCENT_STORAGE_KEY = 'themeAccent';

const ACCENT_CLASS_MAP = {
  aurora: 'theme-accent-aurora',
  sunset: 'theme-accent-sunset',
  ember: 'theme-accent-ember',
  orchid: 'theme-accent-orchid',
};

const ACCENT_CLASSES = Object.values(ACCENT_CLASS_MAP);

export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeMode] = useState('night');
  const [themeAccent, setThemeAccent] = useState('aurora');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedMode = window.localStorage.getItem(STORAGE_KEY);
    const storedAccent = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    if (storedMode === 'night' || storedMode === 'dark') {
      setThemeMode(storedMode);
    }
    if (storedAccent && ACCENT_CLASS_MAP[storedAccent]) {
      setThemeAccent(storedAccent);
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    root.classList.remove('theme-night', 'theme-dark', ...ACCENT_CLASSES);
    root.classList.add(themeMode === 'dark' ? 'theme-dark' : 'theme-night');
    root.classList.add(ACCENT_CLASS_MAP[themeAccent] || ACCENT_CLASS_MAP.aurora);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, themeMode);
      window.localStorage.setItem(ACCENT_STORAGE_KEY, themeAccent);
    }
  }, [themeMode, themeAccent]);

  const value = useMemo(
    () => ({
      themeMode,
      themeAccent,
      setThemeMode,
      setThemeAccent,
      toggleThemeMode: () => setThemeMode((current) => (current === 'night' ? 'dark' : 'night')),
    }),
    [themeMode, themeAccent]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeMode = () => useContext(ThemeContext);
