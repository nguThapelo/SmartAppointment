import axios from 'axios';
import CryptoJS from 'crypto-js';
import { queryKeys } from './queries';
import { supabase } from './supabaseClient';

const apiRoutes = {
  [queryKeys.GET_USERS]: '/api/Users',
  [queryKeys.GET_USER_BY_ID]: (id) => `/api/users/${id}`,
};

export const fetchData = async (key, params) => {
  const route = apiRoutes[key];
  if (!route) {
    throw new Error(`API route for key "${key}" not found`);
  }

  const url = typeof route === 'function' ? route(...params) : route;
  const response = await axios.get(url);
  return response.data;
};

const SECURITY_KEY = process.env.NEXT_PUBLIC_REQUEST_ENCRYPTION_KEY || 'dev-encryption-key';

export const apiInstance = axios.create({
  baseURL: '/',
  withCredentials: true,
});

const getStoredCSRFToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem('csrfToken');
};

const setStoredCSRFToken = (token) => {
  if (typeof window === 'undefined' || !token) {
    return;
  }
  window.localStorage.setItem('csrfToken', token);
};

const clearStoredCSRFToken = () => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem('csrfToken');
};

export const bootstrapCSRFToken = async ({ forceRefresh = false } = {}) => {
  const token = getStoredCSRFToken();
  if (!forceRefresh && token) {
    return token;
  }

  const response = await axios.get('/api/security/csrf', { withCredentials: true });
  const csrfToken = response?.data?.csrfToken;
  setStoredCSRFToken(csrfToken);
  return csrfToken;
};

const encryptPayload = (payload) => {
  const iv = CryptoJS.lib.WordArray.random(16);
  const key = CryptoJS.SHA256(SECURITY_KEY);
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(payload), key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return `${iv.toString(CryptoJS.enc.Hex)}:${encrypted.ciphertext.toString(CryptoJS.enc.Hex)}`;
};

apiInstance.interceptors.request.use(async (config) => {
  const nextConfig = { ...config, headers: { ...(config.headers || {}) } };

  const hasAuthHeader = Boolean(
    nextConfig.headers.Authorization ||
    nextConfig.headers.authorization
  );

  if (!hasAuthHeader) {
    const { data } = await supabase.auth.getSession();
    const accessToken = data?.session?.access_token;
    if (accessToken) {
      nextConfig.headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  // Always attach a CSRF token for state-changing requests.
  if (['post', 'put', 'patch', 'delete'].includes(String(config.method).toLowerCase())) {
    const csrfToken = await bootstrapCSRFToken();
    if (csrfToken) {
      nextConfig.headers['x-csrf-token'] = csrfToken;
    }

    // Encrypt outbound payload before it leaves the browser.
    const alreadyEncrypted =
      nextConfig.headers['x-payload-encrypted'] === 'true' ||
      nextConfig.headers['X-Payload-Encrypted'] === 'true';

    if (!alreadyEncrypted && config.data && typeof config.data === 'object') {
      nextConfig.data = {
        encryptedPayload: encryptPayload(config.data),
      };
      nextConfig.headers['x-payload-encrypted'] = 'true';
    }
  }

  return nextConfig;
});

apiInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const status = error?.response?.status;
    const message = String(error?.response?.data?.error || '').toLowerCase();
    const isCsrfError = status === 403 && message.includes('csrf');

    if (!isCsrfError || !originalRequest || originalRequest._csrfRetried) {
      return Promise.reject(error);
    }

    originalRequest._csrfRetried = true;
    clearStoredCSRFToken();

    try {
      const freshToken = await bootstrapCSRFToken({ forceRefresh: true });
      originalRequest.headers = {
        ...(originalRequest.headers || {}),
        'x-csrf-token': freshToken,
      };
      return apiInstance(originalRequest);
    } catch (_refreshError) {
      return Promise.reject(error);
    }
  }
);

export const setAuthToken = (accessToken) => {
  if (!accessToken) {
    delete apiInstance.defaults.headers.common.Authorization;
    return;
  }
  apiInstance.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
};