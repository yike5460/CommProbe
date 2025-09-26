'use client';

import { ReactNode, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface AppLayoutProps {
  children: ReactNode;
  className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps) {
  const [isHydrated, setIsHydrated] = useState(false);

  // Only access the store after hydration to avoid SSR mismatch
  const collapsed = useAppStore((state) =>
    isHydrated ? state.ui.sidebarCollapsed : false
  );

  // Set hydrated flag after component mounts (client-side only)
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <div className={cn('min-h-screen bg-background', className)}>
      <Sidebar />

      <div
        className={cn(
          'transition-all duration-300 ease-in-out',
          collapsed ? 'ml-16' : 'ml-64'
        )}
      >
        <Header />

        <main className="flex-1 overflow-auto">
          <div className="container mx-auto px-4 py-6 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}