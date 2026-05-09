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

export default apiClient;
