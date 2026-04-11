import React, { createContext, useContext, useEffect, useMemo } from 'react';
import type { AppTheme } from '../types';
import { THEME_TOKENS } from './tokens';

type ThemeContextValue = {
  theme: AppTheme;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  isDark: true,
});

type ThemeProviderProps = {
  theme: AppTheme;
  children: React.ReactNode;
};

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const isDark = theme === 'dark';

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const tokens = THEME_TOKENS[theme];

    root.dataset.theme = theme;
    root.style.colorScheme = isDark ? 'dark' : 'light';
    body?.setAttribute('data-theme', theme);

    for (const [name, value] of Object.entries(tokens)) {
      root.style.setProperty(name, value);
    }
  }, [isDark, theme]);

  const value = useMemo(() => ({ theme, isDark }), [theme, isDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}