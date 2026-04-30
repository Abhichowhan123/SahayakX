import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { authApi } from '../api';

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

interface AuthUser {
  phone: string;
  role:  'customer' | 'worker' | 'admin';
}

interface AuthContextType {
  user:         AuthUser | null;
  token:        string | null;
  isLoading:    boolean;
  isWorkerMode: boolean;
  sendOtp:      (phone: string, role?: 'customer' | 'worker') => Promise<void>;
  verifyOtp:    (phone: string, otp: string) => Promise<void>;
  logout:       () => Promise<void>;
  setWorkerMode:(v: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user,         setUser]         = useState<AuthUser | null>(null);
  const [token,        setToken]        = useState<string | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isWorkerMode, setWorkerMode]   = useState(false);

  // Restore session on app start
  useEffect(() => {
    const restore = async () => {
      try {
        const stored = await storage.get('auth_token');
        const role   = (await storage.get('user_role')) as AuthUser['role'] | null;
        const phone  = await storage.get('user_phone');
        if (stored && phone && role) {
          setToken(stored);
          setUser({ phone, role });
          setWorkerMode(role === 'worker');
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  const sendOtp = async (phone: string, role: 'customer' | 'worker' = 'customer') => {
    await authApi.sendOtp(phone, role);
  };

  const verifyOtp = async (phone: string, otp: string) => {
    const { data } = await authApi.verifyOtp(phone, otp);
    const { token: newToken, role, phone: userPhone } = data.data;

    await storage.set('auth_token', newToken);
    await storage.set('user_role',  role);
    await storage.set('user_phone', userPhone);

    setToken(newToken);
    setUser({ phone: userPhone, role });
    setWorkerMode(role === 'worker');
  };

  const logout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    await storage.del('auth_token');
    await storage.del('user_role');
    await storage.del('user_phone');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isWorkerMode, sendOtp, verifyOtp, logout, setWorkerMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
