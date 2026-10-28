import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let waitingQueue: Array<(ok: boolean) => void> = [];

function drainQueue(ok: boolean) {
  waitingQueue.forEach(cb => cb(ok));
  waitingQueue = [];
}

function redirectToLogin() {
  isRefreshing = false;
  waitingQueue = [];
  window.location.href = '/login';
}

apiClient.interceptors.response.use(
  res => res,
  async error => {
    const original = error.config;

    if (error.response?.status !== 401) return Promise.reject(error);

    const url: string = original?.url || '';

    // Auth endpoints: never try to refresh, just propagate the error.
    // AuthContext handles /auth/me failures by setting isAuthenticated=false.
    if (url.includes('/auth/')) {
      if (url.includes('/auth/refresh')) drainQueue(false);
      return Promise.reject(error);
    }

    // Already retried this request — don't retry again
    if (original?._retry) return Promise.reject(error);

    original._retry = true;

    // A refresh is already in progress — queue this request to retry when done
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        waitingQueue.push(ok => {
          if (ok) resolve(apiClient(original));
          else reject(error);
        });
      });
    }

    isRefreshing = true;
    try {
      await apiClient.post('/api/v1/auth/refresh');
      isRefreshing = false;
      drainQueue(true);
      return apiClient(original);
    } catch {
      drainQueue(false);
      redirectToLogin();
      return Promise.reject(error);
    }
  },
);

// Identical GETs fired while one is still in flight (header + page both
// loading /auth/me, a list loaded on mount and again by a tab handler) share
// the first request instead of each paying a round trip to the API.
const inflightGets = new Map<string, Promise<any>>();
const rawGet = apiClient.get.bind(apiClient);
apiClient.get = ((url: string, config?: any) => {
  const key = `${url}|${JSON.stringify(config?.params ?? null)}|${config?.responseType ?? ''}`;
  const pending = inflightGets.get(key);
  if (pending) return pending;
  const request = rawGet(url, config).finally(() => inflightGets.delete(key));
  inflightGets.set(key, request);
  return request;
}) as typeof apiClient.get;

export default apiClient;
