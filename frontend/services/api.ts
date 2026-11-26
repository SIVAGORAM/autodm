// services/api.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- shared with the Node policy check.
const shouldSkipAuthRefresh = require('../lib/auth-refresh-policy.cjs').shouldSkipAuthRefresh as (url?: string) => boolean;

export const api = axios.create({
  // Keep browser requests on the frontend origin. next.config.js proxies /api
  // to the backend so auth cookies remain first-party in production browsers.
  baseURL: '/api',
  withCredentials: true,
  timeout: 45000,
  headers: { 'Content-Type': 'application/json' },
});

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return process.env.NODE_ENV === 'development'
      ? 'The API did not respond in time. Check that the backend and its database are running, then try again.'
      : 'The service did not respond in time. Please try again shortly.';
  }
  if (!error.response) {
    return process.env.NODE_ENV === 'development'
      ? 'Cannot reach the API. Start the backend with `npm run dev` and confirm it is available on port 4000.'
      : 'We could not reach the service. Please try again shortly.';
  }
  const body = error.response.data as { message?: unknown; error?: { message?: unknown } } | undefined;
  if (typeof body?.message === 'string') return body.message;
  if (typeof body?.error?.message === 'string') return body.error.message;
  return fallback;
}

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

    if (error.response?.status === 403 && typeof window !== 'undefined' &&
      (error.response.data as { message?: string } | undefined)?.message === 'LEGAL_ACCEPTANCE_REQUIRED' &&
      window.location.pathname !== '/legal/accept') {
      window.location.assign('/legal/accept');
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Credential/public auth endpoints must not be retried. Protected session
      // endpoints (especially /auth/me) do refresh so a short-lived access
      // cookie does not log an active user out while their refresh cookie lives.
      if (shouldSkipAuthRefresh(originalRequest.url)) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // This request has already received its first 401. Mark it before it
        // enters the queue so a still-unauthorized replay cannot start another
        // refresh cycle after the in-flight refresh completes.
        originalRequest._retry = true;
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest)).catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Refresh token is in httpOnly cookie, just call the endpoint
        await api.post('/auth/refresh');
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        // Only discard the session when the backend definitively rejects the
        // refresh cookie. A timeout or 5xx can be a sleeping/restarting API;
        // the dashboard should offer a retry instead of logging the creator out.
        const refreshStatus = axios.isAxiosError(refreshError) ? refreshError.response?.status : undefined;
        if (refreshStatus === 401 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
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
  signup: (data: {
    name: string; email: string; password: string;
    termsAccepted: true; privacyAcknowledged: true; ageConfirmed: true;
    termsVersion: string; privacyVersion: string;
  }) =>
    api.post('/auth/signup', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  beginAdminMfaSetup: (currentPassword: string) => api.post('/auth/admin-mfa/setup', { currentPassword }),
  confirmAdminMfaSetup: (code: string) => api.post('/auth/admin-mfa/confirm', { code }),
  verifyAdminMfa: (code: string) => api.post('/auth/admin-mfa/verify', { code }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data: { token: string; password: string }) => api.post('/auth/reset-password', data),
  verifyOtp: (code: string) => api.post('/auth/verify-otp', { code }),
  resendOtp: () => api.post('/auth/resend-otp'),
  verificationEmailStatus: () => api.get('/auth/verification-email-status'),
  acceptLegalPolicies: (data: {
    termsAccepted: true; privacyAcknowledged: true; ageConfirmed: true;
    termsVersion: string; privacyVersion: string;
  }) => api.post('/auth/accept-policies', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  get2faStatus: () => api.get('/auth/2fa/status'),
  begin2faSetup: (currentPassword: string) => api.post('/auth/2fa/setup', { currentPassword }),
  confirm2faSetup: (code: string) => api.post('/auth/2fa/confirm', { code }),
  disable2fa: (data: { currentPassword: string; code: string }) => api.post('/auth/2fa/disable', data),
  regenerate2faRecoveryCodes: (data: { currentPassword: string; code: string }) => api.post('/auth/2fa/recovery-codes', data),
};

export const instagramApi = {
  getAuthUrl: (mode: 'INSTAGRAM_LOGIN' | 'UNIFIED_LOGIN' = 'INSTAGRAM_LOGIN') =>
    api.get('/instagram/auth-url', { params: mode === 'INSTAGRAM_LOGIN' ? undefined : { mode } }),
  loginOptions: () => api.get('/instagram/login-options'),
  accounts: () => api.get('/instagram/accounts'),
  media: (id: string, after?: string, type?: string) =>
    api.get(`/instagram/accounts/${id}/media`, { params: { ...(after ? { after } : {}), ...(type ? { type } : {}) } }),
  subscribeWebhooks: (id: string) => api.post(`/instagram/accounts/${id}/webhooks/subscribe`),
  disconnect: (id: string) => api.delete(`/instagram/accounts/${id}`),
};

export const paymentApi = {
  getPlans: () => api.get('/payments/plans'),
  getSubscription: () => api.get('/payments/subscription'),
  createOrder: (plan: string) => api.post('/payments/order', { plan }),
  verify: (data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    api.post('/payments/verify', data),
};

export const userApi = {
  updateProfile: (data: { name: string }) => api.put('/users/profile', data),
  publicProfile: () => api.get('/users/public-profile'),
  usernameAvailability: (username: string) => api.get('/users/public-profile/username-availability', { params: { username } }),
  savePublicProfile: (data: unknown) => api.post('/users/public-profile', data),
  uploadPublicProfileAvatar: (data: FormData, onUploadProgress?: (percent: number) => void) =>
    api.post('/users/public-profile/avatar', data, { headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => { if (event.total) onUploadProgress?.(Math.round(event.loaded * 100 / event.total)); } }),
  removePublicProfileAvatar: () => api.delete('/users/public-profile/avatar'),
  exportData: () => api.get('/users/export', { responseType: 'blob' }),
  contacts: (params: { page: number; pageSize: number; accountId?: string; search?: string }) => api.get('/users/contacts', { params }),
  updateContact: (id: string, data: { notes: string; tags: string[] }) => api.patch(`/users/contacts/${id}`, data),
  exportContacts: (params: { accountId?: string; search?: string }) => api.get('/users/contacts/export', { params, responseType: 'blob' }),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/users/profile/password', data),
  requestAccountDeletion: (data: { currentPassword: string; confirmationEmail: string }) => api.delete('/users/account', { data }),
};

export const adminApi = {
  commandCenter: () => api.get('/admin/command-center/overview'),
  auditEvents: (params: { page?: number; pageSize?: number; action?: string } = {}) => api.get('/admin/command-center/audit-events', { params }),
  paymentLedger: (params: { page?: number; pageSize?: number; search?: string; plan?: 'FREE' | 'CREATOR' | 'PRO' | 'AGENCY'; currency?: string; from?: string; to?: string } = {}) =>
    api.get('/admin/command-center/payments', { params }),
  team: () => api.get('/admin/team'),
  addAdmin: (email: string, reason: string) => api.post('/admin/team', { email, reason }),
  adminInvitations: () => api.get('/admin/team/invitations'),
  createAdminInvitation: (email: string, permissions: Array<'SUPPORT_MANAGE' | 'PROFILE_MODERATE' | 'CONTACT_MANAGE' | 'MAIL_READ' | 'OPERATIONS_READ'>, reason: string) =>
    api.post('/admin/team/invitations', { email, permissions, reason }),
  revokeAdminInvitation: (id: string, reason: string) => api.delete(`/admin/team/invitations/${id}`, { data: { reason } }),
  acceptAdminInvitation: (token: string) => api.post('/admin/invitations/accept', { token }),
  updateAdminRole: (userId: string, role: 'ADMIN' | 'SUPER_ADMIN' | 'INFLUENCER', reason: string) =>
    api.patch(`/admin/team/${userId}/role`, { role, reason }),
  updateAdminPermissions: (userId: string, permissions: Array<'SUPPORT_MANAGE' | 'PROFILE_MODERATE' | 'CONTACT_MANAGE' | 'MAIL_READ' | 'OPERATIONS_READ'>, reason: string) =>
    api.patch(`/admin/team/${userId}/permissions`, { permissions, reason }),
    suspendAdmin: (userId: string, reason: string) => api.post(`/admin/team/${userId}/suspend`, { reason }),
    reactivateAdmin: (userId: string, reason: string) => api.post(`/admin/team/${userId}/reactivate`, { reason }),
  resetAdminMfa: (userId: string, reason: string) => api.delete(`/admin/team/${userId}/mfa`, { data: { reason } }),
  customers: (params: { page: number; pageSize: number; search?: string; status?: 'ACTIVE' | 'SUSPENDED' | 'PENDING_DELETION'; plan?: 'FREE' | 'CREATOR' | 'PRO' | 'AGENCY' | 'PAID' }) =>
    api.get('/admin/customers', { params }),
  customer: (id: string) => api.get(`/admin/customers/${id}`),
  suspendCustomer: (id: string, reason: string) => api.post(`/admin/customers/${id}/suspend`, { reason }),
  reactivateCustomer: (id: string, reason: string) => api.post(`/admin/customers/${id}/reactivate`, { reason }),
  deadLetters: (page = 1) => api.get('/admin/webhook-events/dead-letter', { params: { page } }),
  redriveWebhookEvent: (id: string, reason: string) => api.post(`/admin/webhook-events/${id}/redrive`, { reason }),
  mailOutbox: (page = 1, status?: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED') =>
    api.get('/admin/mail-outbox', { params: { page, status } }),
  workerHealth: () => api.get('/admin/health/worker'),
  supportRequests: (page = 1, status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED') =>
    api.get('/admin/support-requests', { params: { page, status } }),
  publicProfileReports: (page = 1, status?: 'OPEN' | 'IN_REVIEW' | 'ACTIONED' | 'DISMISSED') =>
    api.get('/admin/profile-reports', { params: { page, status } }),
  reviewPublicProfileReport: (id: string, status: 'IN_REVIEW' | 'ACTIONED' | 'DISMISSED', moderationNote: string) =>
    api.post(`/admin/profile-reports/${id}/review`, { status, moderationNote }),
  restorePublicProfileReport: (id: string, reason: string) =>
    api.post(`/admin/profile-reports/${id}/restore`, { reason }),
    contactEnquiries: (params: { page?: number; pageSize?: number; status?: string; priority?: string; search?: string; assigned?: 'MINE' | 'UNASSIGNED' } = {}) =>
      api.get('/admin/contact-enquiries', { params }),
    contactEnquiry: (id: string) => api.get(`/admin/contact-enquiries/${id}`),
    updateContactEnquiryStatus: (id: string, status: string, reason: string) =>
      api.patch(`/admin/contact-enquiries/${id}/status`, { status, reason }),
    updateContactEnquiryPriority: (id: string, priority: string, reason: string) =>
      api.patch(`/admin/contact-enquiries/${id}/priority`, { priority, reason }),
    assignContactEnquiry: (id: string, assignedAdminId: string | null) =>
      api.patch(`/admin/contact-enquiries/${id}/assignment`, { assignedAdminId }),
    replyToContactEnquiry: (id: string, body: string) => api.post(`/admin/contact-enquiries/${id}/messages`, { body }),
    addContactEnquiryNote: (id: string, body: string) => api.post(`/admin/contact-enquiries/${id}/notes`, { body }),
  updateSupportRequest: (id: string, status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED') =>
    api.patch(`/admin/support-requests/${id}/status`, { status }),
  replyToSupportRequest: (id: string, body: string) =>
    api.post(`/admin/support-requests/${id}/messages`, { body }),
};

export const healthApi = {
  workerStatus: () => api.get('/health/worker'),
};

export const contactApi = {
  createEnquiry: (input: { name: string; email: string; subject: string; message: string; website?: string }) =>
    api.post('/contact/enquiries', input),
};

export const supportApi = {
  mine: () => api.get('/support/requests/mine'),
  create: (data: { type: 'SUPPORT' | 'FEEDBACK'; subject: string; message: string; rating?: number }) =>
    api.post('/support/requests', data),
  reply: (id: string, body: string) => api.post(`/support/requests/${id}/messages`, { body }),
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
