import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface User {
  username: string;
  folder: string;
  is_locked: boolean;
  first_login: boolean;
  data_retention_days?: number;
  show_in_list: boolean;
  folders: Array<{ id: string; name: string; type: string; parent_id?: string | null }>;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (userData: User, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('filenexus_user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        console.error('Failed to parse saved user data', e);
      }
    }
    return null;
  });
  
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('filenexus_token');
  });

  // Since we use lazy initialization, we don't need the useEffect for loading
  useEffect(() => {
    // If we wanted to validate the token on mount, we could do it here
  }, []);

  const login = (userData: User, newToken: string) => {
    setUser(userData);
    setToken(newToken);
    localStorage.setItem('filenexus_token', newToken);
    localStorage.setItem('filenexus_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('filenexus_token');
    localStorage.removeItem('filenexus_user');
    // Clear unlock session storage
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('unlocked_')) {
        sessionStorage.removeItem(key);
      }
    });
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const newUser = { ...user, ...updates };
      setUser(newUser);
      localStorage.setItem('filenexus_user', JSON.stringify(newUser));
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      logout, 
      updateUser,
      isAuthenticated: !!token 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
