let accessToken = null;
let refreshPromise = null;

export class ApiError extends Error {
  constructor(status, problem = {}) {
    super(
        problem.detail || problem.title ||
        `Request failed (${status || 'network error'})`);
    this.name = 'ApiError';
    this.status = status || 0;
    this.code = problem.code || 'REQUEST_FAILED';
    this.fieldErrors = problem.fieldErrors || {};
  }
}

export function setAccessToken(token) {
  accessToken = token || null;
}

export function clearAccessToken() {
  accessToken = null;
}

async function problemFrom(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise =
        (async () => {
          let response;
          try {
            response = await fetch('/api/auth/refresh', {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'warrantyvault'
              },
              body: '{}'
            });
          } catch (error) {
            throw new ApiError(0, {
              code: error.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK',
              detail: error.name === 'TimeoutError' ?
                  'The server took too long to respond. Try again.' :
                  'You appear to be offline or the server is unreachable.'
            });
          }
          if (response.status === 401) return null;
          if (!response.ok)
            throw new ApiError(response.status, await problemFrom(response));
          const session = await response.json();
          setAccessToken(session.accessToken);
          return session;
        })().finally(() => {
          refreshPromise = null;
        });
  }
  return refreshPromise;
}

export async function restoreSession() {
  return refreshAccessToken();
}

export async function apiRequest(path, options = {}) {
  const {skipRefresh = false, timeoutMs, ...requestOptions} = options;
  const headers = new Headers(requestOptions.headers || {});
  const isForm = requestOptions.body instanceof FormData;
  if (requestOptions.body != null && !isForm && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let response;
  try {
    response = await fetch(path, {
      ...requestOptions,
      headers,
      credentials: 'include',
      signal: requestOptions.signal ||
          (timeoutMs === undefined ? undefined : AbortSignal.timeout(timeoutMs))
    });
  } catch (error) {
    if (requestOptions.signal?.aborted) throw error;
    throw new ApiError(0, {
      code: error.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK',
      detail: error.name === 'TimeoutError' ?
          'The request timed out. Try again.' :
          'You appear to be offline or the server is unreachable.'
    });
  }

  const publicAuthPath =
      /^\/api\/auth\/(login|register|refresh|logout)$/.test(path);
  if (response.status === 401 && !skipRefresh && !publicAuthPath) {
    const session = await refreshAccessToken();
    if (session) return apiRequest(path, {...options, skipRefresh: true});
    clearAccessToken();
    window.dispatchEvent(new CustomEvent('warrantyvault:session-expired'));
  }
  if (!response.ok)
    throw new ApiError(response.status, await problemFrom(response));
  return response;
}

export async function apiJson(path, options = {}) {
  const response = await apiRequest(path, options);
  return response.status === 204 ? null : response.json();
}
