const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();
const baseUrl = configuredBase || (import.meta.env.DEV ? 'http://localhost:8080' : '');
let accessToken = null;
let refreshPromise = null;
let activeUserId = '';

function userIdForToken(token) {
  try {
    const payload = JSON.parse(globalThis.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.sub === 'string' ? payload.sub : '';
  } catch {
    return '';
  }
}

export function apiBaseUrl() {
  return baseUrl;
}

export function getApiConfigurationError() {
  return baseUrl ? '' : 'Set VITE_API_BASE_URL to your WarrantyVault API URL and rebuild the application.';
}

export function setAccessToken(token) {
  accessToken = token || null;
  activeUserId = token ? userIdForToken(token) : '';
}

export function clearAccessToken() {
  accessToken = null;
  activeUserId = '';
}

export function clearCachedUserData() {
  if (!activeUserId) return;
  navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_USER_CACHE', userId: activeUserId });
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'warrantyvault'
      },
      body: '{}'
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const session = await response.json();
        accessToken = session.accessToken;
        return session;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export class ApiError extends Error {
  constructor(response, problem) {
    super(problem?.detail || problem?.title || `Request failed (${response.status})`);
    this.name = 'ApiError';
    this.status = response.status;
    this.code = problem?.code || 'REQUEST_FAILED';
    this.fieldErrors = problem?.fieldErrors || {};
  }
}

export async function apiRequest(path, options = {}) {
  if (!baseUrl) throw new Error(getApiConfigurationError());
  const {
    skipRefresh = false,
    ...requestOptions
  } = options;
  const headers = new Headers(requestOptions.headers || {});
  const isForm = requestOptions.body instanceof FormData;
  if (requestOptions.body != null && !isForm && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${baseUrl}${path}`, {
    ...requestOptions,
    headers,
    credentials: 'include'
  });
  const publicAuthPath = /^\/api\/auth\/(login|register|refresh|logout)$/.test(path);
  if (response.status === 401 && !skipRefresh && !publicAuthPath) {
    let session = null;
    try {
      session = await refreshAccessToken();
    } catch {
      session = null;
    }
    if (session) return apiRequest(path, { ...options, skipRefresh: true });
    clearCachedUserData();
    clearAccessToken();
    window.dispatchEvent(new CustomEvent('warrantyvault:session-expired'));
    const next = `${window.location.pathname}${window.location.search}`;
    if (window.location.pathname !== '/login') {
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    }
  }
  if (!response.ok) {
    let problem = null;
    try {
      problem = await response.json();
    } catch {
      problem = null;
    }
    throw new ApiError(response, problem);
  }
  return response;
}

export async function apiJson(path, options = {}) {
  const response = await apiRequest(path, options);
  if (response.status === 204) return null;
  return response.json();
}

export async function refreshSession() {
  if (!baseUrl) throw new Error(getApiConfigurationError());
  return refreshAccessToken();
}
