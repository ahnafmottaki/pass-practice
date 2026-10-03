import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import db from './db.js';
import { hashPassword, verifyPassword, generateToken } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Trust reverse proxy (e.g. Vercel, Caddy, Nginx) for protocol and client IP detection
app.set('trust proxy', 1);

// -------------------------------------------------------------
// Security Headers & CORS Lockdown
// -------------------------------------------------------------
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || process.env.CLIENT_URL;
const allowedOrigins = [
  ALLOWED_ORIGIN,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3001',
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || (ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS policy.`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(cookieParser());
app.use(express.json());

// -------------------------------------------------------------
// Rate Limiters
// -------------------------------------------------------------
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts from this IP. Please try again after 15 minutes.' },
});

const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many PIN verification attempts from this IP. Please try again later.' },
});

// -------------------------------------------------------------
// HttpOnly Cookie Helpers
// -------------------------------------------------------------
const COOKIE_NAME = 'passpractice_session';

function setSessionCookie(req, res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProd && isHttps,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
  });
}

function clearSessionCookie(req, res) {
  const isProd = process.env.NODE_ENV === 'production';
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProd && isHttps,
    path: '/',
  });
}

// -------------------------------------------------------------
// Authentication Middleware
// -------------------------------------------------------------
function authenticate(req, res, next) {
  let token = null;

  // 1. Check HttpOnly cookie first
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    token = req.cookies[COOKIE_NAME];
  }

  // 2. Check Authorization Bearer header fallback
  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const now = new Date().toISOString();

  const session = db.prepare(`
    SELECT s.token, s.user_id, u.name, u.email, u.pin_hash
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > ?
  `).get(token, now);

  if (!session) {
    clearSessionCookie(req, res);
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }

  req.user = {
    id: session.user_id,
    name: session.name,
    email: session.email,
    hasPin: !!session.pin_hash,
  };
  req.userId = session.user_id;
  req.token = token;
  next();
}

// -------------------------------------------------------------
// Auth Routes
// -------------------------------------------------------------

// 1. Register: Name, Email, Password, Confirm Password
app.post('/api/auth/register', authLimiter, (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Full name is required (minimum 2 characters).' });
    }

    const trimmedEmail = (email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    // Check if email already registered
    const existing = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(trimmedEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    const { hash, salt } = hashPassword(password);
    const now = new Date().toISOString();

    const insertResult = db.prepare(`
      INSERT INTO users (name, email, password_hash, salt, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name.trim(), trimmedEmail, hash, salt, now, now);

    const userId = Number(insertResult.lastInsertRowid);
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    db.prepare(`
      INSERT INTO sessions (token, user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(token, userId, now, expiresAt);

    // Set HttpOnly, SameSite=Strict cookie
    setSessionCookie(req, res, token);

    res.status(201).json({
      token,
      user: {
        id: userId,
        name: name.trim(),
        email: trimmedEmail,
        hasPin: false,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create account.' });
  }
});

// 2. Login: Email and Password
app.post('/api/auth/login', authLimiter, (req, res) => {
  try {
    const { email, password } = req.body;

    const trimmedEmail = (email || '').trim().toLowerCase();
    if (!trimmedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(trimmedEmail);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessions (token, user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(token, user.id, now, expiresAt);

    // Set HttpOnly, SameSite=Strict cookie
    setSessionCookie(req, res, token);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        hasPin: !!user.pin_hash,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to sign in.' });
  }
});

// 3. Current User Profile: /api/auth/me
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Track failed PIN attempts per user
const failedPinAttempts = new Map();

// 4. Logout: /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  try {
    let token = req.cookies?.[COOKIE_NAME];
    const authHeader = req.headers['authorization'];
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    if (token) {
      const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
      if (session) {
        failedPinAttempts.delete(session.user_id);
      }
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    clearSessionCookie(req, res);
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to log out.' });
  }
});

// 4a. Setup 6-Digit Encryption PIN
app.post('/api/auth/pin/setup', pinLimiter, authenticate, (req, res) => {
  try {
    const { pin, confirmPin } = req.body;
    const pinRegex = /^\d{6}$/;

    if (!pin || !pinRegex.test(String(pin))) {
      return res.status(400).json({ error: 'PIN must be exactly 6 digits (numbers 0-9).' });
    }

    if (String(pin) !== String(confirmPin)) {
      return res.status(400).json({ error: 'PIN and confirmation PIN do not match.' });
    }

    const { hash, salt } = hashPassword(String(pin));
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE users 
      SET pin_hash = ?, pin_salt = ?, updated_at = ?
      WHERE id = ?
    `).run(hash, salt, now, req.userId);

    failedPinAttempts.delete(req.userId);

    res.json({
      success: true,
      message: 'Encryption PIN setup successful.',
      hasPin: true,
    });
  } catch (error) {
    console.error('PIN setup error:', error);
    res.status(500).json({ error: 'Failed to configure encryption PIN.' });
  }
});

// 4b. Verify 6-Digit Encryption PIN (2-attempt lockout rule)
app.post('/api/auth/pin/verify', pinLimiter, authenticate, (req, res) => {
  try {
    const { pin } = req.body;
    const pinRegex = /^\d{6}$/;

    if (!pin || !pinRegex.test(String(pin))) {
      return res.status(400).json({ error: 'PIN must be exactly 6 digits.' });
    }

    const user = db.prepare('SELECT pin_hash, pin_salt FROM users WHERE id = ?').get(req.userId);
    if (!user || !user.pin_hash) {
      return res.status(400).json({ error: 'No encryption PIN configured for this account.' });
    }

    const isValid = verifyPassword(String(pin), user.pin_hash, user.pin_salt);

    if (!isValid) {
      const attempts = (failedPinAttempts.get(req.userId) || 0) + 1;
      failedPinAttempts.set(req.userId, attempts);

      if (attempts >= 2) {
        // Exceeded 2 attempts: revoke all sessions for this user immediately and clear cookie
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.userId);
        failedPinAttempts.delete(req.userId);
        clearSessionCookie(req, res);
        return res.status(401).json({
          error: 'Incorrect PIN. You entered the wrong PIN twice and have been logged out for security.',
          lockedOut: true,
          attemptsRemaining: 0,
        });
      }

      return res.status(401).json({
        error: 'Incorrect PIN. 1 attempt remaining before automatic logout.',
        lockedOut: false,
        attemptsRemaining: 1,
      });
    }

    // Correct PIN: reset failed attempts counter
    failedPinAttempts.delete(req.userId);
    res.json({ success: true, message: 'PIN verified successfully.' });
  } catch (error) {
    console.error('PIN verification error:', error);
    res.status(500).json({ error: 'Failed to verify PIN.' });
  }
});

// -------------------------------------------------------------
// Password Management Routes (Scoped to Authenticated User)
// -------------------------------------------------------------

function getPasswordsWithStats(userId) {
  const query = `
    SELECT 
      p.id, 
      p.password, 
      p.note, 
      p.created_at, 
      p.updated_at,
      COUNT(l.id) as practice_count,
      SUM(CASE WHEN l.is_success = 1 THEN 1 ELSE 0 END) as success_count,
      ROUND(AVG(l.accuracy), 1) as avg_accuracy,
      ROUND(AVG(l.speed_cpm), 1) as avg_speed_cpm,
      MAX(l.created_at) as last_practiced_at
    FROM passwords p
    LEFT JOIN practice_logs l ON p.id = l.password_id
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY p.updated_at DESC
  `;
  return db.prepare(query).all(userId);
}

// 5. Get all passwords for authenticated user
app.get('/api/passwords', authenticate, (req, res) => {
  try {
    const passwords = getPasswordsWithStats(req.userId);
    res.json(passwords);
  } catch (error) {
    console.error('Error fetching passwords:', error);
    res.status(500).json({ error: 'Failed to retrieve passwords' });
  }
});

// 6. Add password (enforces uniqueness per user, supports zero-knowledge blind index)
app.post('/api/passwords', authenticate, (req, res) => {
  try {
    const { password, note = '', blindIndex = null } = req.body;

    if (!password || typeof password !== 'string' || password.trim().length === 0) {
      return res.status(400).json({ error: 'Password cannot be empty' });
    }

    const trimmedPassword = password.trim();

    // Check duplicate for this user
    let existing = null;
    if (blindIndex) {
      existing = db.prepare('SELECT id FROM passwords WHERE blind_index = ? AND user_id = ?').get(blindIndex, req.userId);
    } else {
      existing = db.prepare('SELECT id FROM passwords WHERE password = ? AND user_id = ?').get(trimmedPassword, req.userId);
    }

    if (existing) {
      return res.status(409).json({
        error: 'This password is already saved in your vault. Duplicate passwords are not permitted.',
      });
    }

    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO passwords (user_id, password, note, blind_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.userId, trimmedPassword, (note || '').trim(), blindIndex || null, now, now);

    const newPassword = db.prepare('SELECT * FROM passwords WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({
      ...newPassword,
      practice_count: 0,
      success_count: 0,
      avg_accuracy: null,
      avg_speed_cpm: null,
      last_practiced_at: null,
    });
  } catch (error) {
    console.error('Error creating password:', error);
    res.status(500).json({ error: 'Failed to save password' });
  }
});

// 7. Update password or note for authenticated user
app.put('/api/passwords/:id', authenticate, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { password, note = '', blindIndex = null } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid password ID' });
    }

    if (!password || typeof password !== 'string' || password.trim().length === 0) {
      return res.status(400).json({ error: 'Password cannot be empty' });
    }

    const trimmedPassword = password.trim();

    // Check duplicate among this user's other passwords
    let duplicate = null;
    if (blindIndex) {
      duplicate = db.prepare('SELECT id FROM passwords WHERE blind_index = ? AND id != ? AND user_id = ?').get(blindIndex, id, req.userId);
    } else {
      duplicate = db.prepare('SELECT id FROM passwords WHERE password = ? AND id != ? AND user_id = ?').get(trimmedPassword, id, req.userId);
    }

    if (duplicate) {
      return res.status(409).json({
        error: 'Another entry already uses this password. Duplicate passwords are not permitted.',
      });
    }

    const now = new Date().toISOString();
    const result = db.prepare(`
      UPDATE passwords 
      SET password = ?, note = ?, blind_index = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(trimmedPassword, (note || '').trim(), blindIndex || null, now, id, req.userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Password not found' });
    }

    const updated = db.prepare('SELECT * FROM passwords WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// 8. Delete password
app.delete('/api/passwords/:id', authenticate, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid password ID' });
    }

    const result = db.prepare('DELETE FROM passwords WHERE id = ? AND user_id = ?').run(id, req.userId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Password not found' });
    }

    res.json({ success: true, message: 'Password deleted successfully' });
  } catch (error) {
    console.error('Error deleting password:', error);
    res.status(500).json({ error: 'Failed to delete password' });
  }
});

// -------------------------------------------------------------
// Practice Sessions & Logs (Scoped to Authenticated User)
// -------------------------------------------------------------

// 9. Start a practice session
app.post('/api/practice/sessions', authenticate, (req, res) => {
  try {
    const { mode_type, target_count = 1, total_items = 0 } = req.body;
    const now = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO practice_sessions (user_id, mode_type, target_count, started_at, total_items)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.userId, mode_type, target_count, now, total_items);

    res.status(201).json({ sessionId: Number(result.lastInsertRowid) });
  } catch (error) {
    console.error('Error creating practice session:', error);
    res.status(500).json({ error: 'Failed to create practice session' });
  }
});

// 10. Record individual practice log
app.post('/api/practice/logs', authenticate, (req, res) => {
  try {
    const {
      session_id,
      password_id,
      is_success,
      duration_ms,
      accuracy,
      typed_length,
      target_length,
      speed_cpm,
      speed_wpm,
      error_count,
      timed_out = 0,
    } = req.body;

    const now = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO practice_logs (
        session_id, password_id, is_success, duration_ms,
        accuracy, typed_length, target_length, speed_cpm,
        speed_wpm, error_count, timed_out, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session_id || null,
      password_id || null,
      is_success ? 1 : 0,
      duration_ms || 0,
      accuracy || 0,
      typed_length || 0,
      target_length || 0,
      speed_cpm || 0,
      speed_wpm || 0,
      error_count || 0,
      timed_out ? 1 : 0,
      now
    );

    res.status(201).json({ logId: Number(result.lastInsertRowid) });
  } catch (error) {
    console.error('Error recording practice log:', error);
    res.status(500).json({ error: 'Failed to record practice log' });
  }
});

// 11. Complete practice session
app.put('/api/practice/sessions/:id', authenticate, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      total_items = 0,
      successful_items = 0,
      avg_accuracy = 0,
      avg_speed_cpm = 0,
    } = req.body;

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE practice_sessions
      SET completed_at = ?, total_items = ?, successful_items = ?, avg_accuracy = ?, avg_speed_cpm = ?
      WHERE id = ? AND user_id = ?
    `).run(now, total_items, successful_items, avg_accuracy, avg_speed_cpm, id, req.userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error completing practice session:', error);
    res.status(500).json({ error: 'Failed to complete practice session' });
  }
});

// 12. Practice Statistics & History Overview for User
app.get('/api/practice/stats', authenticate, (req, res) => {
  try {
    const totalSessions = db.prepare('SELECT COUNT(*) as count FROM practice_sessions WHERE user_id = ?').get(req.userId).count;
    
    const attemptsStats = db.prepare(`
      SELECT 
        COUNT(l.id) as total_attempts,
        SUM(CASE WHEN l.is_success = 1 THEN 1 ELSE 0 END) as successful_attempts
      FROM practice_logs l
      JOIN practice_sessions s ON l.session_id = s.id
      WHERE s.user_id = ?
    `).get(req.userId);

    const totalAttempts = attemptsStats.total_attempts || 0;
    const successfulAttempts = attemptsStats.successful_attempts || 0;
    
    const performanceStats = db.prepare(`
      SELECT 
        ROUND(AVG(l.accuracy), 1) as avg_accuracy,
        ROUND(AVG(l.speed_cpm), 1) as avg_cpm,
        ROUND(AVG(l.speed_wpm), 1) as avg_wpm,
        ROUND(AVG(l.duration_ms) / 1000.0, 2) as avg_duration_sec,
        MAX(l.speed_wpm) as best_wpm
      FROM practice_logs l
      JOIN practice_sessions s ON l.session_id = s.id
      WHERE s.user_id = ? AND l.is_success = 1
    `).get(req.userId);

    const recentSessions = db.prepare(`
      SELECT 
        s.id,
        s.mode_type,
        s.target_count,
        s.started_at,
        s.completed_at,
        s.total_items,
        s.successful_items,
        s.avg_accuracy,
        s.avg_speed_cpm
      FROM practice_sessions s
      WHERE s.user_id = ?
      ORDER BY s.id DESC
      LIMIT 10
    `).all(req.userId);

    res.json({
      totalSessions,
      totalAttempts,
      successfulAttempts,
      overallSuccessRate: totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 100) : 0,
      avgAccuracy: performanceStats?.avg_accuracy || 0,
      avgCpm: performanceStats?.avg_cpm || 0,
      avgWpm: performanceStats?.avg_wpm || 0,
      bestWpm: performanceStats?.best_wpm || 0,
      avgDurationSec: performanceStats?.avg_duration_sec || 0,
      recentSessions,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch practice statistics' });
  }
});

// 13. Clear all practice statistics and logs for User
app.delete('/api/practice/stats', authenticate, (req, res) => {
  try {
    db.prepare(`
      DELETE FROM practice_logs 
      WHERE session_id IN (SELECT id FROM practice_sessions WHERE user_id = ?)
    `).run(req.userId);

    db.prepare('DELETE FROM practice_sessions WHERE user_id = ?').run(req.userId);

    res.json({ success: true, message: 'Practice stats and logs cleared successfully' });
  } catch (error) {
    console.error('Error clearing stats:', error);
    res.status(500).json({ error: 'Failed to clear practice statistics' });
  }
});

// -------------------------------------------------------------
// Serve Static Frontend Assets (When running standalone, not in Vercel)
// -------------------------------------------------------------
if (!process.env.VERCEL) {
  const distPath = path.resolve(__dirname, '..', 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

export default app;
