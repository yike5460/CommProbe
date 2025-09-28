'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Lightbulb,
  TrendingUp,
  Settings,
  Play,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Panda,
  PawPrint
} from 'lucide-react';

const navigationItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    view: 'dashboard'
  },
  {
    label: 'Insights',
    href: '/insights',
    icon: Lightbulb,
    view: 'insights'
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    view: 'analytics'
  },
  {
    label: 'Trends',
    href: '/trends',
    icon: TrendingUp,
    view: 'trends'
  },
  {
    label: 'Operations',
    href: '/operations',
    icon: Play,
    view: 'operations'
  },
  {
    label: 'Configuration',
    href: '/config',
    icon: Settings,
    view: 'config'
  }
];

export function Sidebar() {
  const pathname = usePathname();
  const [isHydrated, setIsHydrated] = useState(false);

  // Only access the store after hydration to avoid SSR mismatch
  const collapsed = useAppStore((state) =>
    isHydrated ? state.ui.sidebarCollapsed : false
  );
  const toggle = useAppStore((state) => state.toggleSidebar);
  const setCurrentView = useAppStore((state) => state.setCurrentView);

  // Set hydrated flag after component mounts (client-side only)
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const handleViewChange = (view: string) => {
    setCurrentView(view);
  };

  return (
    <div
      className={cn(
        'fixed top-0 left-0 h-full bg-card border-r border-border transition-all duration-300 ease-in-out z-40',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center space-x-2">
            {/* <Brain className="h-8 w-8 text-primary" /> */}
            <Panda className="h-8 w-8 text-primary" />
            <h1 className="text-base font-semibold text-foreground">
              Community Insight
            </h1>
          </div>
        )}

        {collapsed && (
          <div className="flex justify-center w-full">
            <PawPrint className="h-8 w-8 text-primary" />
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          className={cn(
            'h-8 w-8 p-0',
            collapsed && 'absolute -right-3 top-4 bg-background border shadow-sm'
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="p-2 space-y-1">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => handleViewChange(item.view)}
              className={cn(
                'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200',
                'hover:bg-accent hover:text-accent-foreground',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground',
                collapsed && 'justify-center px-2'
              )}
            >
              <Icon className={cn('h-5 w-5 flex-shrink-0')} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* System Status Indicator (when collapsed) */}
      {collapsed && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
        </div>
      )}

      {/* Footer (when expanded) */}
      {!collapsed && (
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-muted/30">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <div className="h-2 w-2 bg-green-500 rounded-full" />
            <span>System Online</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            v1.0.0 • {process.env.NEXT_PUBLIC_ENVIRONMENT}
          </div>
        </div>
      )}
    </div>
  );
}