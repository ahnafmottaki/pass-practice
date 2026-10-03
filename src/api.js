const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'passpractice_auth_token';

let authToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

export function getAuthToken() {
  return authToken;
}

export function setAuthToken(token) {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }
}

function getHeaders(extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

async function handleResponse(res) {
  if (!res.ok) {
    let errorMsg = `Server error (${res.status})`;
    let errData = {};
    try {
      errData = await res.json();
      if (errData && errData.error) {
        errorMsg = errData.error;
      }
    } catch (e) {
      // ignore parse error
    }
    const err = new Error(errorMsg);
    err.status = res.status;
    err.data = errData;
    err.lockedOut = !!errData.lockedOut;
    err.attemptsRemaining = errData.attemptsRemaining;
    if (res.status === 401) {
      // Don't clear token if it's attempt 1 of PIN verification
      if (errData.lockedOut !== false) {
        setAuthToken(null);
      }
    }
    throw err;
  }
  return res.json();
}

export const api = {
  // ---------------------------------------------
  // Authentication
  // ---------------------------------------------
  async register(name, email, password, confirmPassword) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, confirmPassword }),
    });
    const data = await handleResponse(res);
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  async login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse(res);
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  async getMe() {
    if (!authToken) return null;
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: getHeaders(),
      });
      const data = await handleResponse(res);
      return data.user;
    } catch (err) {
      if (err.status === 401) {
        setAuthToken(null);
      }
      return null;
    }
  },

  async logout() {
    try {
      if (authToken) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: getHeaders(),
        });
      }
    } catch (e) {
      // ignore
    } finally {
      setAuthToken(null);
    }
    return { success: true };
  },

  async setupPin(pin, confirmPin) {
    const res = await fetch(`${API_BASE}/auth/pin/setup`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ pin, confirmPin }),
    });
    return handleResponse(res);
  },

  async verifyPin(pin) {
    const res = await fetch(`${API_BASE}/auth/pin/verify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ pin }),
    });
    return handleResponse(res);
  },

  // ---------------------------------------------
  // Passwords
  // ---------------------------------------------
  async getPasswords() {
    const res = await fetch(`${API_BASE}/passwords`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async addPassword(password, note = '', blindIndex = null) {
    const res = await fetch(`${API_BASE}/passwords`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ password, note, blindIndex }),
    });
    return handleResponse(res);
  },

  async updatePassword(id, password, note = '', blindIndex = null) {
    const res = await fetch(`${API_BASE}/passwords/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ password, note, blindIndex }),
    });
    return handleResponse(res);
  },

  async deletePassword(id) {
    const res = await fetch(`${API_BASE}/passwords/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // ---------------------------------------------
  // Practice Sessions & Logs
  // ---------------------------------------------
  async startSession(mode_type, target_count = 1, total_items = 0) {
    const res = await fetch(`${API_BASE}/practice/sessions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ mode_type, target_count, total_items }),
    });
    return handleResponse(res);
  },

  async recordLog(logData) {
    const res = await fetch(`${API_BASE}/practice/logs`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(logData),
    });
    return handleResponse(res);
  },

  async completeSession(sessionId, summary) {
    const res = await fetch(`${API_BASE}/practice/sessions/${sessionId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(summary),
    });
    return handleResponse(res);
  },

  async getStats() {
    const res = await fetch(`${API_BASE}/practice/stats`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async clearStats() {
    const res = await fetch(`${API_BASE}/practice/stats`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
};

export default api;
