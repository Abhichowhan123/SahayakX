import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '../api';

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
        const stored = await SecureStore.getItemAsync('auth_token');
        const role   = (await SecureStore.getItemAsync('user_role')) as AuthUser['role'] | null;
        const phone  = await SecureStore.getItemAsync('user_phone');
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

    await SecureStore.setItemAsync('auth_token', newToken);
    await SecureStore.setItemAsync('user_role',  role);
    await SecureStore.setItemAsync('user_phone', userPhone);

    setToken(newToken);
    setUser({ phone: userPhone, role });
    setWorkerMode(role === 'worker');
  };

  const logout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('user_role');
    await SecureStore.deleteItemAsync('user_phone');
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
