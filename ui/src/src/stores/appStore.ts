/**
 * Global Application State Store using Zustand
 *
 * Manages user preferences, UI state, and application-wide settings
 * Persists state to localStorage for better user experience
 */

import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import { AppState, InsightsListParams } from '@/types';

/**
 * Default application state
 */
const defaultState = {
  preferences: {
    defaultFilters: {
      priority_min: 5,
      priority_max: 10,
      limit: 50,
    } as InsightsListParams,
    dashboardLayout: ['kpis', 'high-priority', 'analytics-preview'] as string[],
    theme: 'light' as const,
  },
  ui: {
    sidebarCollapsed: false,
    activeInsightId: null,
    currentView: 'dashboard',
  },
};

/**
 * Main application store
 */
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...defaultState,

      // ================================
      // Preference Actions
      // ================================

      setPreferences: (preferences) =>
        set((state) => ({
          preferences: { ...state.preferences, ...preferences },
        })),

      setDefaultFilters: (filters: Partial<InsightsListParams>) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            defaultFilters: { ...state.preferences.defaultFilters, ...filters },
          },
        })),

      setDashboardLayout: (layout: string[]) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            dashboardLayout: layout,
          },
        })),

      setTheme: (theme: 'light' | 'dark') =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            theme,
          },
        })),

      // ================================
      // UI State Actions
      // ================================

      toggleSidebar: () =>
        set((state) => ({
          ui: {
            ...state.ui,
            sidebarCollapsed: !state.ui.sidebarCollapsed,
          },
        })),

      setSidebarCollapsed: (collapsed: boolean) =>
        set((state) => ({
          ui: {
            ...state.ui,
            sidebarCollapsed: collapsed,
          },
        })),

      setActiveInsight: (id: string | null) =>
        set((state) => ({
          ui: {
            ...state.ui,
            activeInsightId: id,
          },
        })),

      setCurrentView: (view: string) =>
        set((state) => ({
          ui: {
            ...state.ui,
            currentView: view,
          },
        })),

      // ================================
      // Utility Actions
      // ================================

      resetPreferences: () =>
        set((state) => ({
          preferences: defaultState.preferences,
        })),

      resetUI: () =>
        set((state) => ({
          ui: defaultState.ui,
        })),

      resetAll: () => set(defaultState),

      // ================================
      // Getters (computed values)
      // ================================

      getFilterPreset: (name: string) => {
        const state = get();
        // You could extend this to support multiple saved filter presets
        return name === 'default' ? state.preferences.defaultFilters : null;
      },
    }),
    {
      name: 'supio-app-store', // unique name for localStorage key
      storage: createJSONStorage(() => localStorage),
      // Only persist preferences, not UI state
      partialize: (state) => ({
        preferences: state.preferences,
      }),
      // Merge strategy for when the stored state doesn't match current structure
      merge: (persistedState, currentState) => ({
        ...currentState,
        preferences: {
          ...currentState.preferences,
          ...(persistedState as any)?.preferences,
        },
      }),
    }
  )
);

// ================================
// Extended App Store Interface
// ================================

interface ExtendedAppState extends AppState {
  // Additional methods not in the base AppState interface
  setDefaultFilters: (filters: Partial<InsightsListParams>) => void;
  setDashboardLayout: (layout: string[]) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCurrentView: (view: string) => void;
  resetPreferences: () => void;
  resetUI: () => void;
  resetAll: () => void;
  getFilterPreset: (name: string) => InsightsListParams | null;
}

// Re-export with extended interface
export type AppStore = ExtendedAppState;

// ================================
// Cached Selector Functions
// ================================

const sidebarSelector = (state: any) => ({
  collapsed: state.ui.sidebarCollapsed,
  toggle: state.toggleSidebar,
  setCollapsed: state.setSidebarCollapsed,
});

const themeSelector = (state: any) => ({
  theme: state.preferences.theme,
  setTheme: state.setTheme,
});

const filtersSelector = (state: any) => ({
  filters: state.preferences.defaultFilters,
  setFilters: state.setDefaultFilters,
});

const activeInsightSelector = (state: any) => ({
  activeInsightId: state.ui.activeInsightId,
  setActiveInsight: state.setActiveInsight,
});

const currentViewSelector = (state: any) => ({
  currentView: state.ui.currentView,
  setCurrentView: state.setCurrentView,
});

const dashboardLayoutSelector = (state: any) => ({
  layout: state.preferences.dashboardLayout,
  setLayout: state.setDashboardLayout,
});

// ================================
// Selector Hooks for Performance
// ================================

/**
 * Hook to get only sidebar state (prevents unnecessary re-renders)
 */
export const useSidebarState = () => useAppStore(sidebarSelector, shallow);

/**
 * Hook to get only theme preferences
 */
export const useThemePreference = () => useAppStore(themeSelector, shallow);

/**
 * Hook to get only default filters
 */
export const useDefaultFilters = () => useAppStore(filtersSelector, shallow);

/**
 * Hook to get only active insight state
 */
export const useActiveInsight = () => useAppStore(activeInsightSelector, shallow);

/**
 * Hook to get only current view state
 */
export const useCurrentView = () => useAppStore(currentViewSelector, shallow);

/**
 * Hook to get only dashboard layout preferences
 */
export const useDashboardLayout = () => useAppStore(dashboardLayoutSelector, shallow);

// ================================
// Store Utilities
// ================================

/**
 * Get current app store state (for use outside React components)
 */
export const getAppState = () => useAppStore.getState();

/**
 * Subscribe to app store changes (for use outside React components)
 */
export const subscribeToAppStore = useAppStore.subscribe;

/**
 * Reset all persisted state (useful for logout or testing)
 */
export const clearPersistedState = () => {
  localStorage.removeItem('supio-app-store');
  useAppStore.getState().resetAll();
};