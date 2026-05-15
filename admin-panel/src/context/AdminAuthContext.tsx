import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const storage = {
  get: (key: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(localStorage.getItem(key))
      : SecureStore.getItemAsync(key),
  set: (key: string, value: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(localStorage.setItem(key, value))
      : SecureStore.setItemAsync(key, value),
  del: (key: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(localStorage.removeItem(key))
      : SecureStore.deleteItemAsync(key),
};

interface AdminUser { username: string; token: string }

interface AdminAuthContextType {
  admin:     AdminUser | null;
  userToken: string | null;
  login:     (username: string, token: string) => Promise<void>;
  logout:    () => Promise<void>;
  isLoading: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType>({} as AdminAuthContextType);

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [admin,     setAdmin]     = useState<AdminUser | null>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token    = await storage.get('admin_token');
        const username = await storage.get('admin_username');
        if (token && username) {
          setUserToken(token);
          setAdmin({ username, token });
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (username: string, token: string) => {
    await storage.set('admin_token',    token);
    await storage.set('admin_username', username);
    setUserToken(token);
    setAdmin({ username, token });
  };

  const logout = async () => {
    await storage.del('admin_token');
    await storage.del('admin_username');
    setUserToken(null);
    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, userToken, login, logout, isLoading }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => useContext(AdminAuthContext);
