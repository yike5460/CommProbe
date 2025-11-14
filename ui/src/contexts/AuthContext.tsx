'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated via server-side token
    verifyAuthentication();
  }, []);

  const verifyAuthentication = async () => {
    try {
      const response = await fetch('/api/auth/verify', {
        credentials: 'include', // Include cookies
      });

      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          setIsAuthenticated(true);
          setUsername(data.username);
        }
      }
    } catch (error) {
      console.error('Auth verification error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        credentials: 'include', // Include cookies
      });

      const data = await response.json();

      if (data.success) {
        setIsAuthenticated(true);
        setUsername(data.username);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsAuthenticated(false);
      setUsername(null);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
