import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';

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
      const token    = await SecureStore.getItemAsync('admin_token');
      const username = await SecureStore.getItemAsync('admin_username');
      if (token && username) {
        setUserToken(token);
        setAdmin({ username, token });
      }
      setIsLoading(false);
    })();
  }, []);

  const login = async (username: string, token: string) => {
    await SecureStore.setItemAsync('admin_token',    token);
    await SecureStore.setItemAsync('admin_username', username);
    setUserToken(token);
    setAdmin({ username, token });
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('admin_token');
    await SecureStore.deleteItemAsync('admin_username');
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
