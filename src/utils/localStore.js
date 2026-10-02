const STORAGE_KEYS = {
  PASSWORDS: 'passpractice_passwords_v1',
  SESSIONS: 'passpractice_sessions_v1',
  LOGS: 'passpractice_logs_v1',
};

function readStorage(key, defaultValue = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    console.warn(`Failed to read from localStorage key "${key}":`, e);
    return defaultValue;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to write to localStorage key "${key}":`, e);
  }
}

export const localStore = {
  getPasswords() {
    const passwords = readStorage(STORAGE_KEYS.PASSWORDS, []);
    const logs = readStorage(STORAGE_KEYS.LOGS, []);

    return passwords.map((p) => {
      const pLogs = logs.filter((l) => l.password_id === p.id);
      const successLogs = pLogs.filter((l) => l.is_success === 1);
      const avgAccuracy = pLogs.length > 0
        ? Math.round((pLogs.reduce((sum, l) => sum + (l.accuracy || 0), 0) / pLogs.length) * 10) / 10
        : 0;
      const speeds = successLogs.filter((l) => l.speed_cpm > 0);
      const avgCpm = speeds.length > 0
        ? Math.round(speeds.reduce((sum, l) => sum + (l.speed_cpm || 0), 0) / speeds.length)
        : 0;
      const lastPractice = pLogs.length > 0
        ? pLogs.reduce((latest, l) => (l.created_at > latest ? l.created_at : latest), pLogs[0].created_at)
        : null;

      return {
        ...p,
        practice_count: pLogs.length,
        success_count: successLogs.length,
        avg_accuracy: avgAccuracy,
        avg_speed_cpm: avgCpm,
        last_practiced_at: lastPractice,
      };
    }).sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  },

  addPassword(password, note = '') {
    const trimmed = (password || '').trim();
    if (!trimmed) {
      throw new Error('Password cannot be empty');
    }

    const passwords = readStorage(STORAGE_KEYS.PASSWORDS, []);
    if (passwords.some((p) => p.password === trimmed)) {
      throw new Error('This password already exists in your vault');
    }

    const now = new Date().toISOString();
    const newItem = {
      id: Date.now(),
      password: trimmed,
      note: (note || '').trim(),
      created_at: now,
      updated_at: now,
      practice_count: 0,
      success_count: 0,
      avg_accuracy: 0,
      avg_speed_cpm: 0,
      last_practiced_at: null,
    };

    writeStorage(STORAGE_KEYS.PASSWORDS, [newItem, ...passwords]);
    return newItem;
  },

  updatePassword(id, password, note = '') {
    const trimmed = (password || '').trim();
    if (!trimmed) {
      throw new Error('Password cannot be empty');
    }

    const passwords = readStorage(STORAGE_KEYS.PASSWORDS, []);
    const numId = Number(id);
    const existingIndex = passwords.findIndex((p) => p.id === numId);
    if (existingIndex === -1) {
      throw new Error('Password not found');
    }

    if (passwords.some((p) => p.id !== numId && p.password === trimmed)) {
      throw new Error('Another entry with this password already exists');
    }

    const updatedItem = {
      ...passwords[existingIndex],
      password: trimmed,
      note: (note || '').trim(),
      updated_at: new Date().toISOString(),
    };

    passwords[existingIndex] = updatedItem;
    writeStorage(STORAGE_KEYS.PASSWORDS, passwords);
    return updatedItem;
  },

  deletePassword(id) {
    const numId = Number(id);
    const passwords = readStorage(STORAGE_KEYS.PASSWORDS, []);
    writeStorage(STORAGE_KEYS.PASSWORDS, passwords.filter((p) => p.id !== numId));
    return { success: true };
  },

  startSession(mode_type, target_count = 1, total_items = 0) {
    const sessions = readStorage(STORAGE_KEYS.SESSIONS, []);
    const newSession = {
      id: Date.now(),
      mode_type,
      target_count,
      started_at: new Date().toISOString(),
      completed_at: null,
      total_items,
      successful_items: 0,
      avg_accuracy: 0,
      avg_speed_cpm: 0,
    };
    writeStorage(STORAGE_KEYS.SESSIONS, [newSession, ...sessions]);
    return { sessionId: newSession.id };
  },

  recordLog(logData) {
    const logs = readStorage(STORAGE_KEYS.LOGS, []);
    const newLog = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      session_id: logData.session_id ? Number(logData.session_id) : null,
      password_id: logData.password_id ? Number(logData.password_id) : null,
      is_success: logData.is_success ? 1 : 0,
      duration_ms: logData.duration_ms || 0,
      accuracy: logData.accuracy || 0,
      typed_length: logData.typed_length || 0,
      target_length: logData.target_length || 0,
      speed_cpm: logData.speed_cpm || 0,
      speed_wpm: logData.speed_wpm || 0,
      error_count: logData.error_count || 0,
      timed_out: logData.timed_out ? 1 : 0,
      created_at: new Date().toISOString(),
    };
    writeStorage(STORAGE_KEYS.LOGS, [...logs, newLog]);
    return { logId: newLog.id };
  },

  completeSession(sessionId, summary = {}) {
    const numId = Number(sessionId);
    const sessions = readStorage(STORAGE_KEYS.SESSIONS, []);
    const idx = sessions.findIndex((s) => s.id === numId);
    if (idx !== -1) {
      sessions[idx] = {
        ...sessions[idx],
        completed_at: new Date().toISOString(),
        total_items: summary.total_items ?? sessions[idx].total_items,
        successful_items: summary.successful_items ?? 0,
        avg_accuracy: summary.avg_accuracy ?? 0,
        avg_speed_cpm: summary.avg_speed_cpm ?? 0,
      };
      writeStorage(STORAGE_KEYS.SESSIONS, sessions);
    }
    return { success: true };
  },

  getStats() {
    const sessions = readStorage(STORAGE_KEYS.SESSIONS, []);
    const logs = readStorage(STORAGE_KEYS.LOGS, []);

    const totalSessions = sessions.length;
    const totalAttempts = logs.length;
    const successfulLogs = logs.filter((l) => l.is_success === 1);
    const successfulAttempts = successfulLogs.length;
    const overallSuccessRate = totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 100) : 0;

    const avgAccuracy = successfulLogs.length > 0
      ? Math.round((successfulLogs.reduce((sum, l) => sum + (l.accuracy || 0), 0) / successfulLogs.length) * 10) / 10
      : 0;

    const avgCpm = successfulLogs.length > 0
      ? Math.round(successfulLogs.reduce((sum, l) => sum + (l.speed_cpm || 0), 0) / successfulLogs.length)
      : 0;

    const avgWpm = successfulLogs.length > 0
      ? Math.round(successfulLogs.reduce((sum, l) => sum + (l.speed_wpm || 0), 0) / successfulLogs.length)
      : 0;

    const bestWpm = successfulLogs.length > 0
      ? Math.round(Math.max(...successfulLogs.map((l) => l.speed_wpm || 0)))
      : 0;

    const avgDurationSec = successfulLogs.length > 0
      ? Math.round((successfulLogs.reduce((sum, l) => sum + (l.duration_ms || 0), 0) / successfulLogs.length / 1000) * 100) / 100
      : 0;

    const recentSessions = sessions.slice(0, 10);

    return {
      totalSessions,
      totalAttempts,
      successfulAttempts,
      overallSuccessRate,
      avgAccuracy,
      avgCpm,
      avgWpm,
      bestWpm,
      avgDurationSec,
      recentSessions,
    };
  },

  clearStats() {
    writeStorage(STORAGE_KEYS.SESSIONS, []);
    writeStorage(STORAGE_KEYS.LOGS, []);
    return { success: true };
  },
};
