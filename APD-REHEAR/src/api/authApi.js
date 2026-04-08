import { apiUrl } from './config.js';

const TOKEN_KEY = 'rehear_token';
const USER_KEY = 'rehear_user';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

async function handleJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data.detail ||
      (typeof data.error === 'string' ? data.error : null) ||
      res.statusText ||
      'Request failed';
    const err = new Error(msg);
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function signup({ name, email, password }) {
  const res = await fetch(apiUrl('/api/auth/signup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  return handleJson(res);
}

export async function verifyOtp({ email, otp }) {
  const res = await fetch(apiUrl('/api/auth/verify-otp'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });
  return handleJson(res);
}

export async function resendOtp(email) {
  const res = await fetch(apiUrl(`/api/auth/resend-otp?email=${encodeURIComponent(email)}`), {
    method: 'POST',
  });
  return handleJson(res);
}

export async function login({ email, password }) {
  const res = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handleJson(res);
}

export async function fetchMe(token) {
  const res = await fetch(apiUrl('/api/auth/me'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleJson(res);
}
