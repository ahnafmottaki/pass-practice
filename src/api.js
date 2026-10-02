const API_BASE = '/api';

async function handleResponse(res) {
  if (!res.ok) {
    let errorMsg = `Server error (${res.status})`;
    try {
      const data = await res.json();
      if (data && data.error) {
        errorMsg = data.error;
      }
    } catch (e) {
      // ignore json parse error
    }
    const err = new Error(errorMsg);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const api = {
  // Passwords
  async getPasswords() {
    const res = await fetch(`${API_BASE}/passwords`);
    return handleResponse(res);
  },

  async addPassword(password, note = '') {
    const res = await fetch(`${API_BASE}/passwords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, note }),
    });
    return handleResponse(res);
  },

  async updatePassword(id, password, note = '') {
    const res = await fetch(`${API_BASE}/passwords/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, note }),
    });
    return handleResponse(res);
  },

  async deletePassword(id) {
    const res = await fetch(`${API_BASE}/passwords/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  // Practice Sessions & Logs
  async startSession(mode_type, target_count = 1, total_items = 0) {
    const res = await fetch(`${API_BASE}/practice/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode_type, target_count, total_items }),
    });
    return handleResponse(res);
  },

  async recordLog(logData) {
    const res = await fetch(`${API_BASE}/practice/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData),
    });
    return handleResponse(res);
  },

  async completeSession(sessionId, summary) {
    const res = await fetch(`${API_BASE}/practice/sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(summary),
    });
    return handleResponse(res);
  },

  async getStats() {
    const res = await fetch(`${API_BASE}/practice/stats`);
    return handleResponse(res);
  },

  async clearStats() {
    const res = await fetch(`${API_BASE}/practice/stats`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },
};

export default api;
