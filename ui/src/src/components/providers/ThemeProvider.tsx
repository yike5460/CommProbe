'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useAppStore } from '@/stores/appStore';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [isHydrated, setIsHydrated] = useState(false);

  // Only access the store after hydration to avoid SSR mismatch
  const theme = useAppStore((state) =>
    isHydrated ? state.preferences.theme : 'light'
  );

  // Set hydrated flag after component mounts (client-side only)
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme, isHydrated]);

  return <>{children}</>;
}