/**
 * 应用壳上下文，统一维护当前视图和搜索关键字等跨页面状态。
 */
import React, { ReactNode, createContext, useContext, useState } from 'react';
import { View } from '../types';

interface AppShellContextValue {
  currentView: View;
  setCurrentView: (view: View) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  submitSearch: (value?: string) => void;
}

const AppShellContext = createContext<AppShellContextValue | undefined>(undefined);

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  const submitSearch = (value?: string) => {
    const nextValue = value ?? searchQuery;
    setSearchQuery(nextValue.trim());
    setCurrentView('search');
  };

  return (
    <AppShellContext.Provider
      value={{
        currentView,
        setCurrentView,
        searchQuery,
        setSearchQuery,
        submitSearch,
      }}
    >
      {children}
    </AppShellContext.Provider>
  );
}

export function useAppShell() {
  const context = useContext(AppShellContext);

  if (!context) {
    throw new Error('useAppShell must be used within AppShellProvider');
  }

  return context;
}
