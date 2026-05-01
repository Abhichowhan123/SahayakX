import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { adminLogger } from '../utils/logger';

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:80';
adminLogger.info({ fn: 'init', action: 'STARTUP' }, 'Admin API client initializing', { baseUrl: BASE_URL });

const getToken = () =>
  Platform.OS === 'web'
    ? Promise.resolve(localStorage.getItem('admin_token'))
    : SecureStore.getItemAsync('admin_token');

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor: inject JWT + log outgoing request ──────────────────
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  adminLogger.apiReq(
    config.method?.toUpperCase() || 'GET',
    config.url || '',
  );
  return config;
});

// ─── Response interceptor: log response + errors ─────────────────────────────
api.interceptors.response.use(
  (res) => {
    adminLogger.apiRes(
      res.config.method?.toUpperCase() || 'GET',
      res.config.url || '',
      res.status,
    );
    return res;
  },
  (error: AxiosError) => {
    adminLogger.apiErr(
      error.config?.method?.toUpperCase() || 'GET',
      error.config?.url || '',
      error.response?.status,
      error,
    );
    return Promise.reject(error);
  },
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  sendOtp:   (phone: string, role: 'customer' | 'worker' = 'customer') =>
    api.post('/auth/send-otp', { phone, role }),
  verifyOtp: (phone: string, otp: string) =>
    api.post('/auth/verify-otp', { phone, otp }),
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  login:              (username: string, password: string) =>
    api.post('/admin/login', { username, password }),
  getPendingWorkers:  () => api.get('/admin/workers/pending-verification'),
  approveWorker:      (id: string) => api.post(`/admin/workers/${id}/verify`),
  rejectWorker:       (id: string, reason: string) =>
    api.post(`/admin/workers/${id}/reject`, { rejectionReason: reason }),
  blockUser:          (phone: string) => api.post(`/admin/users/${phone}/block`),
  blockWorker:        (id: string) => api.post(`/admin/workers/${id}/block`),
  getDisputes:        () => api.get('/admin/bookings/disputed'),
  resolveDispute:     (bookingId: string, resolution: string) =>
    api.post(`/admin/bookings/${bookingId}/resolve-dispute`, { resolution }),
  broadcast:          (title: string, body: string) =>
    api.post('/admin/broadcast-notification', { title, body }),
  getStats:           () => api.get('/admin/dashboard'),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const userApi = {
  getProfile:  () => api.get('/users/me'),
  getWallet:   () => api.get('/users/me/wallet'),
};

// ─── Catalog ──────────────────────────────────────────────────────────────────
export const catalogApi = {
  getCategories: () => api.get('/catalog/categories'),
  getPricing:    () => api.get('/catalog/pricing'),
};

// ─── Workers ──────────────────────────────────────────────────────────────────
export const workerApi = {
  search: (category: string, lat = 28.6139, lng = 77.2090) =>
    api.get('/workers', { params: { category, lat, lng, maxDistanceKm: 10 } }),
  getById: (id: string) => api.get(`/workers/${id}`),
};

// ─── Bookings ─────────────────────────────────────────────────────────────────
export const bookingApi = {
  getMyBookings: (status?: string) =>
    api.get('/bookings', { params: { status } }),
  getById:       (id: string)      => api.get(`/bookings/${id}`),
  cancel:        (id: string)      => api.post(`/bookings/${id}/cancel`),
};

// ─── Payments ─────────────────────────────────────────────────────────────────
export const paymentApi = {
  getHistory: () => api.get('/payments/history'),
};

// ─── Reviews ──────────────────────────────────────────────────────────────────
export const reviewApi = {
  getWorkerReviews: (workerId: string) =>
    api.get(`/reviews/worker/${workerId}`),
};

// ─── Health ───────────────────────────────────────────────────────────────────
export const healthApi = {
  check: () => axios.get(`${BASE_URL}/health`, { timeout: 5000 }),
};

export default api;
