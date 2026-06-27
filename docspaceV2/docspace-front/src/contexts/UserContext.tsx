import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { User } from '../types';
import { clearAuthToken, getAuthToken } from '../lib/authStorage';
import { fetchCurrentUser, loginWithPassword, logoutRequest } from '../services/auth';

interface UserContextType {
  currentUser: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setIsLoading(false);
      setCurrentUser(null);
      return;
    }

    let cancelled = false;

    async function loadCurrentUser() {
      try {
        const user = await fetchCurrentUser();
        if (!cancelled) {
          setCurrentUser(user);
        }
      } catch {
        if (!cancelled) {
          clearAuthToken();
          setCurrentUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const user = await loginWithPassword(username, password);
      setCurrentUser(user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await logoutRequest();
    setCurrentUser(null);
  };

  const refreshCurrentUser = async () => {
    const token = getAuthToken();
    if (!token) {
      setCurrentUser(null);
      return;
    }
    try {
      const user = await fetchCurrentUser();
      setCurrentUser(user);
    } catch {
      clearAuthToken();
      setCurrentUser(null);
    }
  };

  const value = useMemo<UserContextType>(
    () => ({
      currentUser,
      isLoading,
      isAuthenticated: currentUser !== null,
      login,
      logout,
      refreshCurrentUser,
    }),
    [currentUser, isLoading]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);

  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }

  return context;
}
