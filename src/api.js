import { localStore } from './utils/localStore';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Check if we are running in an environment without a local server (e.g. Vercel, Netlify, GitHub Pages)
const isBrowser = typeof window !== 'undefined';
const isLocalHost = isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const hasExplicitApiUrl = Boolean(import.meta.env.VITE_API_URL);

// If on a static cloud host and no external backend is specified, default to browser storage
let activeMode = (!isLocalHost && !hasExplicitApiUrl) ? 'local' : 'server';

const modeListeners = new Set();
export function subscribeStorageMode(listener) {
  modeListeners.add(listener);
  listener(getStorageMode());
  return () => modeListeners.delete(listener);
}

function setMode(newMode) {
  if (activeMode !== newMode) {
    activeMode = newMode;
    const modeName = getStorageMode();
    modeListeners.forEach((fn) => fn(modeName));
  }
}

export function getStorageMode() {
  return activeMode === 'local' ? 'Browser Storage' : 'Local SQLite';
}

async function handleResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    // If the server returns HTML (like Vercel rewriting to index.html), signal fallback
    throw new Error('NON_JSON_RESPONSE');
  }

  if (!res.ok) {
    let errorMsg = `Server error (${res.status})`;
    try {
      const data = await res.json();
      if (data && data.error) {
        errorMsg = data.error;
      }
    } catch (e) {
      // ignore
    }
    const err = new Error(errorMsg);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function executeWithFallback(serverAction, localAction) {
  if (activeMode === 'local') {
    return localAction();
  }

  try {
    return await serverAction();
  } catch (err) {
    // If backend is not running, or server returned HTML (Vercel rewrite fallback), switch to localStore
    if (err.message === 'NON_JSON_RESPONSE' || err.name === 'TypeError' || err.message?.includes('Failed to fetch')) {
      console.warn('Backend server not reachable or returned HTML. Switching to browser storage.', err.message);
      setMode('local');
      return localAction();
    }
    throw err;
  }
}

export const api = {
  // Passwords
  async getPasswords() {
    return executeWithFallback(
      async () => {
        const res = await fetch(`${API_BASE}/passwords`);
        return handleResponse(res);
      },
      () => localStore.getPasswords()
    );
  },

  async addPassword(password, note = '') {
    return executeWithFallback(
      async () => {
        const res = await fetch(`${API_BASE}/passwords`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, note }),
        });
        return handleResponse(res);
      },
      () => localStore.addPassword(password, note)
    );
  },

  async updatePassword(id, password, note = '') {
    return executeWithFallback(
      async () => {
        const res = await fetch(`${API_BASE}/passwords/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, note }),
        });
        return handleResponse(res);
      },
      () => localStore.updatePassword(id, password, note)
    );
  },

  async deletePassword(id) {
    return executeWithFallback(
      async () => {
        const res = await fetch(`${API_BASE}/passwords/${id}`, {
          method: 'DELETE',
        });
        return handleResponse(res);
      },
      () => localStore.deletePassword(id)
    );
  },

  // Practice Sessions & Logs
  async startSession(mode_type, target_count = 1, total_items = 0) {
    return executeWithFallback(
      async () => {
        const res = await fetch(`${API_BASE}/practice/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode_type, target_count, total_items }),
        });
        return handleResponse(res);
      },
      () => localStore.startSession(mode_type, target_count, total_items)
    );
  },

  async recordLog(logData) {
    return executeWithFallback(
      async () => {
        const res = await fetch(`${API_BASE}/practice/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logData),
        });
        return handleResponse(res);
      },
      () => localStore.recordLog(logData)
    );
  },

  async completeSession(sessionId, summary) {
    return executeWithFallback(
      async () => {
        const res = await fetch(`${API_BASE}/practice/sessions/${sessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(summary),
        });
        return handleResponse(res);
      },
      () => localStore.completeSession(sessionId, summary)
    );
  },

  async getStats() {
    return executeWithFallback(
      async () => {
        const res = await fetch(`${API_BASE}/practice/stats`);
        return handleResponse(res);
      },
      () => localStore.getStats()
    );
  },

  async clearStats() {
    return executeWithFallback(
      async () => {
        const res = await fetch(`${API_BASE}/practice/stats`, {
          method: 'DELETE',
        });
        return handleResponse(res);
      },
      () => localStore.clearStats()
    );
  },
};

export default api;
