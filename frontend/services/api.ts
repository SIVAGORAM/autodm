// services/api.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true, // Send cookies
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];

function processQueue(error: AxiosError | null, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
}

// ─── Response interceptor: handle 401 → auto-refresh ────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry auth endpoints themselves
      if (originalRequest.url?.includes('/auth/')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest)).catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Refresh token is in httpOnly cookie, just call the endpoint
        await axios.post(`${API_BASE}/api/auth/refresh`, {}, { withCredentials: true });
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        // Redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── API service methods ────────────────────────────────────────
export const authApi = {
  signup: (data: { name: string; email: string; password: string }) =>
    api.post('/auth/signup', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export const instagramApi = {
  getAuthUrl: () => api.get('/instagram/auth-url'),
  accounts: () => api.get('/instagram/accounts'),
  media: (id: string) => api.get(`/instagram/accounts/${id}/media`),
  disconnect: (id: string) => api.delete(`/instagram/accounts/${id}`),
  // Legacy — used by the old campaign pages, pending migration to the automations flow.
  getAccount: () => api.get('/instagram/accounts'),
  getMedia: (id?: string) => api.get(id ? `/instagram/accounts/${id}/media` : '/instagram/accounts'),
  addPostToCampaign: (data: any) => api.post('/instagram/posts', data),
};

export const campaignApi = {
  create: (data: any) => api.post('/campaigns', data),
  list: () => api.get('/campaigns'),
  get: (id: string) => api.get(`/campaigns/${id}`),
  update: (id: string, data: any) => api.patch(`/campaigns/${id}`, data),
  delete: (id: string) => api.delete(`/campaigns/${id}`),
  getAnalytics: (id: string, days?: number) =>
    api.get(`/campaigns/${id}/analytics`, { params: { days } }),
};

export const paymentApi = {
  getPlans: () => api.get('/payments/plans'),
  getSubscription: () => api.get('/payments/subscription'),
  createOrder: () => api.post('/payments/order'),
  verify: (data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    api.post('/payments/verify', data),
  cancel: () => api.post('/payments/cancel'),
};

export const notificationApi = {
  list: () => api.get('/notifications'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
};

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
};

export const userApi = {
  updateProfile: (data: { name?: string; email?: string }) => api.put('/users/profile', data),
  uploadPicture: (formData: FormData) => api.post('/users/profile/picture', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  removePicture: () => api.delete('/users/profile/picture'),
  changePassword: (data: any) => api.put('/users/profile/password', data),
};

export const feedbackApi = {
  submit: (data: any) => api.post('/feedback', data),
};

export const supportApi = {
  submit: (data: any) => api.post('/support', data),
};

// ─── Automations (NestJS backend) ───────────────────────────────
export const automationApi = {
  create: (data: any) => api.post('/automations', data),
  list: () => api.get('/automations'),
  get: (id: string) => api.get(`/automations/${id}`),
  update: (id: string, data: any) => api.patch(`/automations/${id}`, data),
  setStatus: (id: string, status: 'DRAFT' | 'LIVE' | 'PAUSED') =>
    api.patch(`/automations/${id}/status`, { status }),
  analytics: (id: string) => api.get(`/automations/${id}/analytics`),
  runs: (id: string, cursor?: string) => api.get(`/automations/${id}/runs`, { params: cursor ? { cursor } : {} }),
  remove: (id: string) => api.delete(`/automations/${id}`),
};
