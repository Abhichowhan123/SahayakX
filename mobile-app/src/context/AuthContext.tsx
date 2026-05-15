import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { authApi, workerApi, setSessionExpiredCallback } from '../api';
import { appLogger } from '../utils/logger';

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
  user:                AuthUser | null;
  token:               string | null;
  isLoading:           boolean;
  isWorkerMode:        boolean;
  needsProfile:        boolean;
  sendOtp:             (phone: string, role?: 'customer' | 'worker', mode?: 'login' | 'register') => Promise<{ devOtp?: string } | null>;
  verifyOtp:           (phone: string, otp: string) => Promise<void>;
  completeProfileSetup:() => void;
  logout:              () => Promise<void>;
  setWorkerMode:       (v: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user,         setUser]         = useState<AuthUser | null>(null);
  const [token,        setToken]        = useState<string | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isWorkerMode, setWorkerMode]   = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);

  const checkWorkerNeedsProfile = async () => {
    try {
      await workerApi.getMyProfile();
      return false;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        appLogger.info(
          { fn: 'checkWorkerNeedsProfile', tag: 'AuthContext_workerProfile_missing' },
          'Worker auth exists but profile setup is incomplete',
        );
        return true;
      }
      appLogger.warn(
        { fn: 'checkWorkerNeedsProfile', tag: 'AuthContext_workerProfile_checkFailed' },
        'Could not verify worker profile after login; allowing session to continue',
        { status: err?.response?.status, message: err?.response?.data?.message || String(err) },
      );
      return false;
    }
  };

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
          setNeedsProfile(role === 'worker' ? await checkWorkerNeedsProfile() : false);
        }
      } catch (err) {
        appLogger.error({ fn: 'restore', tag: 'AuthContext_restore_sessionLoad' }, 'Failed to restore session', err);
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  useEffect(() => {
    setSessionExpiredCallback(() => {
      setToken(null);
      setUser(null);
      setWorkerMode(false);
      setNeedsProfile(false);
      appLogger.info({ fn: 'sessionExpiredCallback', tag: 'AuthContext_nativeSessionExpired', action: 'SESSION_EXPIRED' }, 'Native session expired, auth state cleared');
    });
    return () => setSessionExpiredCallback(null);
  }, []);

  // Listen for session-expired event dispatched by the API interceptor on refresh failure
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleExpired = () => {
      setToken(null);
      setUser(null);
      setWorkerMode(false);
      setNeedsProfile(false);
      appLogger.info({ fn: 'sessionExpiredHandler', tag: 'AuthContext_sessionExpired', action: 'SESSION_EXPIRED' }, 'Session expired, auth state cleared');
    };
    window.addEventListener('auth:session-expired', handleExpired);
    return () => window.removeEventListener('auth:session-expired', handleExpired);
  }, []);

  const sendOtp = async (phone: string, role: 'customer' | 'worker' = 'customer', mode: 'login' | 'register' = 'login') => {
    try {
      const { data } = await authApi.sendOtp(phone, role, mode);
      appLogger.info({ fn: 'sendOtp', tag: 'AuthContext_sendOtp_success' }, 'OTP sent', { role, mode });
      return (data?.data as { devOtp?: string } | null) ?? null;
    } catch (err) {
      appLogger.error({ fn: 'sendOtp', tag: 'AuthContext_sendOtp_failed' }, 'Failed to send OTP', err);
      throw err;
    }
  };

  const verifyOtp = async (phone: string, otp: string) => {
    try {
      const { data } = await authApi.verifyOtp(phone, otp);
      const payload = data?.data;
      if (!payload?.token || !payload?.role || !payload?.phone) {
        throw new Error('Invalid OTP response structure');
      }
      const { token: newToken, role, phone: userPhone, isNewUser } = payload;

      await storage.set('auth_token', newToken);
      await storage.set('user_role',  role);
      await storage.set('user_phone', userPhone);

      const shouldCompleteProfile = role === 'worker'
        ? isNewUser || await checkWorkerNeedsProfile()
        : isNewUser;

      // Batch all state updates together so the navigator renders with the
      // correct needsProfile value from the start — prevents WorkerDashboard
      // from briefly mounting (and firing booking requests) before we know
      // whether profile setup is required.
      setToken(newToken);
      setUser({ phone: userPhone, role });
      setWorkerMode(role === 'worker');
      setNeedsProfile(shouldCompleteProfile);
      appLogger.info({ fn: 'verifyOtp', tag: 'AuthContext_verifyOtp_success' }, 'OTP verified', { role, isNewUser });
    } catch (err) {
      appLogger.error({ fn: 'verifyOtp', tag: 'AuthContext_verifyOtp_failed' }, 'OTP verification failed', err);
      throw err;
    }
  };

  const completeProfileSetup = () => setNeedsProfile(false);

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      appLogger.warn({ fn: 'logout', tag: 'AuthContext_logout_apiFailed' }, 'Logout API call failed (continuing)', { error: String(err) });
    }
    try {
      await storage.del('auth_token');
      await storage.del('user_role');
      await storage.del('user_phone');
    } catch (err) {
      appLogger.error({ fn: 'logout', tag: 'AuthContext_logout_storageFailed' }, 'Failed to clear auth storage', err);
    }
    setToken(null);
    setUser(null);
    setWorkerMode(false);
    setNeedsProfile(false);
    appLogger.info({ fn: 'logout', tag: 'AuthContext_logout_complete' }, 'User logged out');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isWorkerMode, needsProfile, sendOtp, verifyOtp, completeProfileSetup, logout, setWorkerMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
