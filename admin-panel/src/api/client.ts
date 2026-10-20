import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { adminLogger } from '../utils/logger';

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:80';
adminLogger.info({ fn: 'init', action: 'STARTUP' }, 'Admin API client initializing', { baseUrl: BASE_URL });

const getToken = async () => {
  const token = Platform.OS === 'web'
    ? await Promise.resolve(localStorage.getItem('admin_token'))
    : await SecureStore.getItemAsync('admin_token');
  if (!token || token === 'undefined' || token === 'null') {
    return null;
  }
  return token;
};

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
  rejectWorker:       (id: string, reason?: string) =>
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

// ─── Admin User/Worker Management ─────────────────────────────────────────────
export const adminUserApi = {
  list:    (params?: any) => api.get('/admin/users', { params }),
  get:     (phone: string) => api.get(`/admin/users/${phone}`),
  update:  (phone: string, data: any) => api.put(`/admin/users/${phone}`, data),
  delete:  (phone: string) => api.delete(`/admin/users/${phone}`),
};

export const adminWorkerMgmtApi = {
  list:    (params?: any) => api.get('/admin/workers', { params }),
  get:     (id: string) => api.get(`/admin/workers/${id}`),
  update:  (id: string, data: any) => api.put(`/admin/workers/${id}`, data),
  delete:  (id: string) => api.delete(`/admin/workers/${id}`),
};

// ─── Users ────────────────────────────────────────────────────────────────────
const getUserToken = async () => {
  const token = Platform.OS === 'web'
    ? await Promise.resolve(localStorage.getItem('user_token'))
    : await SecureStore.getItemAsync('user_token');
  if (!token || token === 'undefined' || token === 'null') {
    return null;
  }
  return token;
};

export const userApi = {
  getProfile:  () => getUserToken().then(t => api.get('/users/me', { headers: t ? { Authorization: `Bearer ${t}` } : {} })),
  getWallet:   () => getUserToken().then(t => api.get('/users/me/wallet', { params: {}, headers: t ? { Authorization: `Bearer ${t}` } : {} })),
};

// ─── Catalog ──────────────────────────────────────────────────────────────────
export const catalogApi = {
  listCategories:      () => api.get('/catalog/categories'),
  listSubCategories:   (categoryId: string) => api.get(`/catalog/subcategories?categoryId=${categoryId}`),
  searchSubCategories: (q: string) => api.get(`/catalog/subcategories/search?q=${encodeURIComponent(q)}`),
};

// ─── Bookings ─────────────────────────────────────────────────────────────────
export const bookingApi = {
  create:             (data: any) => api.post('/bookings', data),
  myBookings:         (role: 'customer' | 'worker') => api.get(`/bookings/me?role=${role}`),
  get:                (id: string) => api.get(`/bookings/${id}`),
  cancel:             (id: string, reason: string) => api.post(`/bookings/${id}/cancel`, { reason }),
  startWork:          (id: string) => api.post(`/bookings/${id}/start`),
  complete:           (id: string) => api.post(`/bookings/${id}/complete`),
  raiseDispute:       (id: string, reason: string) => api.post(`/bookings/${id}/dispute`, { reason }),
  respondToOffer:     (id: string, accept: boolean, price?: number) => api.post(`/bookings/${id}/respond-offer`, { accept, price }),
  requestExtension:   (id: string, minutes: number, reason: string) => api.post(`/bookings/${id}/request-extension`, { minutes, reason }),
  respondExtension:   (id: string, accept: boolean) => api.post(`/bookings/${id}/respond-extension`, { accept }),
  markArrived:        (id: string) => api.post(`/bookings/${id}/arrived`),
  review:             (id: string, data: any) => api.post(`/bookings/${id}/review`, data),
};

// ─── Workers ──────────────────────────────────────────────────────────────────
export const workerApi = {
  nearMe:             (category: string, lat: number, lng: number, radiusKm = 10) =>
    api.get(`/workers/near?category=${category}&lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`),
  get:                (id: string) => api.get(`/workers/${id}`),
  register:           (data: any) => api.post('/workers/register', data),
  getMe:              () => api.get('/workers/me'),
  updateMe:           (data: any) => api.put('/workers/me', data),
  uploadId:           (form: FormData) => api.post('/workers/me/id-proof', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadAadhaar:      (form: FormData) => api.post('/workers/me/aadhaar', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadSelfie:       (form: FormData) => api.post('/workers/me/selfie', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateLocation:     (lat: number, lng: number) => api.put('/workers/me/location', { lat, lng }),
  getEarnings:        () => api.get('/workers/me/earnings'),
  getBookings:        (status?: string) => api.get(`/workers/me/bookings${status ? '?status=' + status : ''}`),
  goOnline:           (lat: number, lng: number) => api.post('/workers/me/online', { lat, lng }),
  goOffline:          () => api.post('/workers/me/offline'),
};
