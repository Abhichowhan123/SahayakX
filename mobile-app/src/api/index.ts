import axios, { AxiosInstance, AxiosError } from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

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

// ─── Request interceptor: inject JWT ─────────────────────────────────────────
api.interceptors.request.use(async (config) => {
  const token = await getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Response interceptor: auto-refresh on 401 ───────────────────────────────
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      const token = await getStoredToken();
      if (token) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { token });
          await setStoredToken(data.data.token);
          if (error.config) {
            error.config.headers.Authorization = `Bearer ${data.data.token}`;
            return api.request(error.config);
          }
        } catch {
          await removeStoredToken();
        }
      }
    }
    return Promise.reject(error);
  },
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  sendOtp:   (phone: string, role: 'customer' | 'worker' = 'customer') =>
    api.post('/auth/send-otp', { phone, role }),

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

  getById:        (bookingId: string) => api.get(`/bookings/${bookingId}`),
  accept:         (bookingId: string) => api.put(`/bookings/${bookingId}/accept`),
  enRoute:        (bookingId: string) => api.put(`/bookings/${bookingId}/en-route`),
  startWork:      (bookingId: string, otp: string) =>
    api.post(`/bookings/${bookingId}/start`, { otp }),
  completeWork:   (bookingId: string) => api.put(`/bookings/${bookingId}/complete`),
  cancel:         (bookingId: string, reason?: string) =>
    api.post(`/bookings/${bookingId}/cancel`, { reason }),
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
