/**
 * Centralized API Client with Token Authentication.
 */

function resolveApiBaseUrl() {
  const envBase = import.meta.env.VITE_API_BASE_URL;

  if (envBase && typeof envBase === 'string' && envBase.trim() !== '') {
    let clean = envBase.trim().replace(/\/+$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('/')) {
      if (!clean.includes('.')) {
        clean = `https://${clean}.onrender.com`;
      } else {
        clean = `https://${clean}`;
      }
    }
    if (clean.startsWith('http') && !clean.endsWith('/api')) {
      clean = `${clean}/api`;
    }
    return clean;
  }

  // If accessed from a Render production domain and env var was empty/relative
  if (typeof window !== 'undefined' && window.location.hostname.includes('.onrender.com')) {
    return 'https://secure-file-backend-mciu.onrender.com/api';
  }

  return '/api';
}

const API_BASE_URL = resolveApiBaseUrl();

export function getAuthToken() {
  return localStorage.getItem('auth_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

export function getCurrentUser() {
  const user = localStorage.getItem('auth_user');
  return user ? JSON.parse(user) : null;
}

export function setCurrentUser(user) {
  if (user) {
    localStorage.setItem('auth_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('auth_user');
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    ...(options.headers || {}),
  };

  // Attach Token if present
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Token ${token}`;
  }

  // Handle JSON vs FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const config = {
    cache: 'no-store',
    ...options,
    headers,
  };

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  const primaryUrl = `${API_BASE_URL}${cleanEndpoint}`;
  let response;

  try {
    response = await fetch(primaryUrl, config);
  } catch (networkError) {
    // Fallback: In development only, if proxy or localhost resolution failed, try direct 127.0.0.1:8000 IPv4
    if (import.meta.env.DEV && !primaryUrl.includes('127.0.0.1:8000')) {
      const fallbackUrl = `http://127.0.0.1:8000/api${cleanEndpoint}`;
      try {
        response = await fetch(fallbackUrl, config);
      } catch {
        throw networkError;
      }
    } else {
      throw networkError;
    }
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else if (contentType && (contentType.includes('text') || contentType.includes('pdf') || contentType.includes('image') || contentType.includes('octet-stream'))) {
    data = await response.blob();
  } else {
    data = await response.text();
    // Safety check: if an endpoint returned HTML (e.g. from static rewrite or misconfigured proxy)
    if (typeof data === 'string' && (data.includes('<!doctype html') || data.includes('<html'))) {
      throw new Error('API server returned HTML instead of JSON. Please check backend connection.');
    }
  }

  if (!response.ok) {
    let errorMsg = 'An error occurred';
    if (typeof data === 'object' && data !== null) {
      errorMsg = data.error || data.detail || data.message || JSON.stringify(data);
    } else if (typeof data === 'string') {
      errorMsg = data;
    }
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}
