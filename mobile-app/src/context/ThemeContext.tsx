import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { THEMES, ThemeName, ThemeColors } from '../theme/theme';

const STORAGE_KEY = 'theme_mode';

const storage = {
  get: (key: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(localStorage.getItem(key))
      : SecureStore.getItemAsync(key),
  set: (key: string, value: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(localStorage.setItem(key, value))
      : SecureStore.setItemAsync(key, value),
};

interface ThemeContextType {
  scheme:   ThemeName;
  colors:   ThemeColors;
  setTheme: (next: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [scheme, setScheme] = useState<ThemeName>('dark');

  useEffect(() => {
    const restore = async () => {
      try {
        const stored = await storage.get(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') {
          setScheme(stored);
        }
      } catch {
        // fall back to dark
      }
    };
    restore();
  }, []);

  const setTheme = useCallback(async (next: ThemeName) => {
    setScheme(next);
    try {
      await storage.set(STORAGE_KEY, next);
    } catch {
      // persist failed; state still updated
    }
  }, []);

  const colors = THEMES[scheme];

  return (
    <ThemeContext.Provider value={{ scheme, colors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
