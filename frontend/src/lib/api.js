const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();
const baseUrl = configuredBase || (import.meta.env.DEV ? 'http://localhost:8080' : '');
let accessToken = null;
let refreshPromise = null;
let activeUserId = '';
const REQUEST_TIMEOUT_MS = 30_000;

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
  return !baseUrl && import.meta.env.DEV
    ? 'Set VITE_API_BASE_URL to your WarrantyVault API URL and rebuild the application.'
    : '';
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
    refreshPromise = (async () => {
      const startedAt = Date.now();
      let attempt = 0;
      while (true) {
        const controller = new globalThis.AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
          const response = await fetch(`${baseUrl}/api/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'warrantyvault'
            },
            body: '{}',
            signal: controller.signal
          });
          if (response.status === 401) return null;
          if (response.ok) {
            const session = await response.json();
            setAccessToken(session.accessToken);
            return session;
          }
          if (response.status < 500) throw new ApiError(response, await readProblem(response));
        } catch (error) {
          if (error instanceof ApiError) throw error;
        } finally {
          clearTimeout(timeout);
        }
        if (Date.now() - startedAt >= 60_000) attempt = Math.max(attempt, 3);
        await new Promise((resolve) => setTimeout(resolve, Math.min(8_000, 1_000 * (2 ** attempt))));
        attempt += 1;
      }
    })()
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
    this.status = response?.status || 0;
    this.code = problem?.code || 'REQUEST_FAILED';
    this.fieldErrors = problem?.fieldErrors || {};
  }
}

async function readProblem(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function apiRequest(path, options = {}) {
  const configurationError = getApiConfigurationError();
  if (configurationError) throw new Error(configurationError);
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

  const controller = new globalThis.AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...requestOptions,
      headers,
      credentials: 'include',
      signal: requestOptions.signal || controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError' && requestOptions.signal?.aborted) throw error;
    throw new ApiError(null, { code: 'NETWORK', detail: 'You appear to be offline or the server is unreachable.' });
  } finally {
    clearTimeout(timeout);
  }
  const publicAuthPath = /^\/api\/auth\/(login|register|refresh|logout)$/.test(path);
  if (response.status === 401 && !skipRefresh && !publicAuthPath) {
    let session = null;
    session = await refreshAccessToken();
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
  const configurationError = getApiConfigurationError();
  if (configurationError) throw new Error(configurationError);
  return refreshAccessToken();
}
