import axios, { AxiosInstance, AxiosError } from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { appLogger } from '../utils/logger';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:80';

const getStoredToken = () =>
  Platform.OS === 'web'
    ? Promise.resolve(localStorage.getItem('auth_token'))
    : SecureStore.getItemAsync('auth_token');

const setStoredToken = (token: string) =>
  Platform.OS === 'web'
    ? Promise.resolve(localStorage.setItem('auth_token', token))
    : SecureStore.setItemAsync('auth_token', token);

const removeStoredToken = () =>
  Platform.OS === 'web'
    ? Promise.resolve(localStorage.removeItem('auth_token'))
    : SecureStore.deleteItemAsync('auth_token');

const api: AxiosInstance = axios.create({
  baseURL:        BASE_URL,
  timeout:        15000,
  headers:        { 'Content-Type': 'application/json' },
});

// ─── Request interceptor: inject JWT + log outgoing request ──────────────────
api.interceptors.request.use(async (config) => {
  const token = await getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  appLogger.apiReq(
    config.method?.toUpperCase() || 'GET',
    config.url || '',
  );
  return config;
});

// ─── Refresh mutex — prevents concurrent token refresh races ─────────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

// ─── Session-expired callback for native platforms ───────────────────────────
let onSessionExpired: (() => void) | null = null;
export const setSessionExpiredCallback = (cb: (() => void) | null) => {
  onSessionExpired = cb;
};

const drainRefreshQueue = (newToken: string | null) => {
  refreshQueue.forEach((cb) => cb(newToken));
  refreshQueue = [];
};

const handleSessionExpired = async () => {
  await removeStoredToken();
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_phone');
    window.dispatchEvent(new CustomEvent('auth:session-expired'));
  } else {
    onSessionExpired?.();
  }
};

// ─── Response interceptor: auto-refresh on 401 + log response/error ──────────
api.interceptors.response.use(
  (res) => {
    appLogger.apiRes(
      res.config.method?.toUpperCase() || 'GET',
      res.config.url || '',
      res.status,
    );
    return res;
  },
  async (error: AxiosError) => {
    const method = error.config?.method?.toUpperCase() || 'GET';
    const url    = error.config?.url || '';
    const status = error.response?.status;

    if (status === 401) {
      const config = error.config as (typeof error.config & { _retry?: boolean });

      // Already retried once — stop here to avoid infinite refresh loops
      if (config?._retry) {
        appLogger.warn({ fn: 'tokenRefresh', action: 'TOKEN_REFRESH' }, 'Request still 401 after retry — forcing logout');
        await handleSessionExpired();
        appLogger.apiErr(method, url, status, error);
        return Promise.reject(error);
      }

      const requestToken = (config?.headers?.Authorization as string | undefined)
        ?.replace('Bearer ', '') || null;
      const storedToken = await getStoredToken();

      if (storedToken) {
        // Request was sent with a stale token — retry once with the current stored token
        if (requestToken && requestToken !== storedToken) {
          appLogger.info(
            { fn: 'tokenRetry', action: 'TOKEN_RETRY' },
            'Request used stale token, retrying with current token',
          );
          if (config) {
            config._retry = true;
            config.headers.Authorization = `Bearer ${storedToken}`;
            return api.request(config);
          }
        }

        // Request used the current token — it truly expired, needs refresh
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            refreshQueue.push((newToken) => {
              if (newToken && config) {
                config._retry = true;
                config.headers.Authorization = `Bearer ${newToken}`;
                resolve(api.request(config));
              } else {
                reject(error);
              }
            });
          });
        }

        isRefreshing = true;
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { token: storedToken });
          const newToken = data.data.token;
          await setStoredToken(newToken);
          isRefreshing = false;
          drainRefreshQueue(newToken);
          appLogger.info(
            { fn: 'tokenRefresh', action: 'TOKEN_REFRESH' },
            'Token auto-refreshed on 401',
          );
          if (config) {
            config._retry = true;
            config.headers.Authorization = `Bearer ${newToken}`;
            return api.request(config);
          }
        } catch (refreshErr) {
          isRefreshing = false;
          drainRefreshQueue(null);
          appLogger.error(
            { fn: 'tokenRefresh', action: 'TOKEN_REFRESH' },
            'Token refresh failed — logging out',
            refreshErr,
          );
          await handleSessionExpired();
        }
      }
    }

    appLogger.apiErr(method, url, status, error);
    return Promise.reject(error);
  },
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  sendOtp:   (phone: string, role: 'customer' | 'worker' = 'customer', mode: 'login' | 'register' = 'login') =>
    api.post('/auth/send-otp', { phone, role, mode }),

  verifyOtp: (phone: string, otp: string, fcmToken?: string) =>
    api.post('/auth/verify-otp', { phone, otp, fcmToken, platform: Platform.OS }),

  logout:    () => api.post('/auth/logout'),
};

// ─── User ─────────────────────────────────────────────────────────────────────
export const userApi = {
  getProfile:    ()               => api.get('/users/me'),
  updateProfile: (data: object)   => api.put('/users/me', data),
  updateLocation:(lat: number, lng: number) =>
    api.put('/users/me/location', { latitude: lat, longitude: lng }),
  addAddress:    (address: object) => api.post('/users/me/addresses', address),
  deleteAddress: (id: string)       => api.delete(`/users/me/addresses/${id}`),
  getWallet:     ()               => api.get('/users/me/wallet'),
};

// ─── Catalog ──────────────────────────────────────────────────────────────────
export const catalogApi = {
  getCategories: ()       => api.get('/catalog/categories'),
  getCategory:   (id: string) => api.get(`/catalog/categories/${id}`),
  getPricing:    ()       => api.get('/catalog/pricing'),
};

// ─── Workers ──────────────────────────────────────────────────────────────────
export const workerApi = {
  getWorkers: (params: {
    category:     string;
    subType?:     string;
    lat?:         number;
    lng?:         number;
    maxDistanceKm?: number;
    minRating?:   number;
    page?:        number;
  }) => api.get('/workers', { params }),

  getWorkerById: (id: string) => api.get(`/workers/${id}`),

  // Worker-side
  register:         (data: object)                => api.post('/workers/register', data),
  getMyProfile:     ()                            => api.get('/workers/me'),
  updateMyProfile:  (data: object)                => api.put('/workers/me', data),
  updateMyLocation: (lat: number, lng: number)    =>
    api.put('/workers/me/location', { latitude: lat, longitude: lng }),
  toggleOnline:     (isOnline: boolean)           => api.put('/workers/me/status', { isOnline }),
  submitVerification: (formData: FormData)        =>
    api.post('/workers/me/verify', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// ─── Bookings ─────────────────────────────────────────────────────────────────
export const bookingApi = {
  create: (data: {
    workerId:          string;
    serviceCategory:   string;
    serviceSubType?:   string;
    requestedDate:     string;
    requestedTimeSlot: string;
    estimatedDuration: number;
    customerAddress:   object;
    paymentMethod:     string;
    customerOfferedPrice?: number;
  }) => api.post('/bookings', data),

  getMyBookings:  (params?: { status?: string; page?: number }) =>
    api.get('/bookings', { params }),

  getAvailable:   (params?: { category?: string; page?: number }) =>
    api.get('/bookings/available', { params }),

  getById:        (bookingId: string) => api.get(`/bookings/${bookingId}`),
  accept:         (bookingId: string) => api.put(`/bookings/${bookingId}/accept`),
  reject:         (bookingId: string) => api.put(`/bookings/${bookingId}/reject`),
  enRoute:        (bookingId: string) => api.put(`/bookings/${bookingId}/en-route`),
  arrived:        (bookingId: string) => api.put(`/bookings/${bookingId}/arrived`),
  startWork:      (bookingId: string, otp: string) =>
    api.post(`/bookings/${bookingId}/start`, { otp }),
  completeWork:   (bookingId: string) => api.put(`/bookings/${bookingId}/complete`),
  cancel:         (bookingId: string, reason?: string) =>
    api.post(`/bookings/${bookingId}/cancel`, { reason }),
  getMessages:    (bookingId: string) => api.get(`/bookings/${bookingId}/messages`),
  sos:            (bookingId: string) => api.post(`/bookings/${bookingId}/sos`),
};

// ─── Payments ─────────────────────────────────────────────────────────────────
export const paymentApi = {
  createOrder:    (bookingId: string, amount: number) =>
    api.post('/payments/order', { bookingId, amount }),
  verifyPayment:  (data: object) => api.post('/payments/verify', data),
  getHistory:     ()             => api.get('/payments/history'),
  walletTopup:    (amount: number) => api.post('/payments/wallet/topup', { amount }),
};

// ─── Reviews ──────────────────────────────────────────────────────────────────
export const reviewApi = {
  submit:          (data: { bookingId: string; workerId: string; rating: number; comment?: string }) =>
    api.post('/reviews', data),
  getWorkerReviews:(workerId: string, page = 1) =>
    api.get(`/reviews/worker/${workerId}`, { params: { page } }),
};

export default api;
