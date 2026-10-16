import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { connectDB, User, Session, Password, PracticeSession, PracticeLog } from './db.js';
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

function isOriginAllowed(origin) {
  if (!origin) return true; // Same-origin, direct API calls, or tools

  // Configured origin from env
  if (ALLOWED_ORIGIN && (origin === ALLOWED_ORIGIN || ALLOWED_ORIGIN === '*')) {
    return true;
  }

  // Allow Vercel deployment domains (both production and preview deployments)
  try {
    const url = new URL(origin);
    if (url.hostname.endsWith('.vercel.app')) {
      return true;
    }
    if (process.env.VERCEL_URL && url.hostname === process.env.VERCEL_URL) {
      return true;
    }
  } catch (e) {
    // ignore parse error
  }

  // Allow localhost & local IP during development
  if (
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
  ) {
    return true;
  }

  return false;
}

app.use(cors({
  origin: function (origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(cookieParser());
app.use(express.json());

// -------------------------------------------------------------
// Database Connection Verification Middleware
// -------------------------------------------------------------
app.use(async (req, res, next) => {
  // Only enforce database connection for API routes
  if (req.path.startsWith('/api')) {
    try {
      await connectDB();
      next();
    } catch (err) {
      return res.status(503).json({
        error: 'Database connection failed. Please ensure DATABASE_URL in your .env file or Vercel environment is valid.',
        details: err.message,
      });
    }
  } else {
    next();
  }
});

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
async function authenticate(req, res, next) {
  try {
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
    const session = await Session.findOne({
      token,
      expires_at: { $gt: now },
    }).populate('user_id');

    if (!session || !session.user_id) {
      clearSessionCookie(req, res);
      return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    }

    const user = session.user_id;
    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      hasPin: !!user.pin_hash,
    };
    req.userId = user._id.toString();
    req.token = token;
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({ error: 'Authentication verification failed.' });
  }
}

// -------------------------------------------------------------
// Auth Routes
// -------------------------------------------------------------

// 1. Register: Name, Email, Password, Confirm Password
app.post('/api/auth/register', authLimiter, async (req, res) => {
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
    const existing = await User.findOne({ email: trimmedEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    const { hash, salt } = hashPassword(password);
    const now = new Date().toISOString();

    const user = await User.create({
      name: name.trim(),
      email: trimmedEmail,
      password_hash: hash,
      salt,
      created_at: now,
      updated_at: now,
    });

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    await Session.create({
      token,
      user_id: user._id,
      created_at: now,
      expires_at: expiresAt,
    });

    // Set HttpOnly, SameSite=Strict cookie
    setSessionCookie(req, res, token);

    res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        hasPin: false,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create account.' });
  }
});

// 2. Login: Email and Password
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    const trimmedEmail = (email || '').trim().toLowerCase();
    if (!trimmedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: trimmedEmail });
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

    await Session.create({
      token,
      user_id: user._id,
      created_at: now,
      expires_at: expiresAt,
    });

    // Set HttpOnly, SameSite=Strict cookie
    setSessionCookie(req, res, token);

    res.json({
      token,
      user: {
        id: user._id.toString(),
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
app.post('/api/auth/logout', async (req, res) => {
  try {
    let token = req.cookies?.[COOKIE_NAME];
    const authHeader = req.headers['authorization'];
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    if (token) {
      const session = await Session.findOne({ token });
      if (session) {
        failedPinAttempts.delete(session.user_id.toString());
      }
      await Session.deleteOne({ token });
    }
    clearSessionCookie(req, res);
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to log out.' });
  }
});

// 4a. Setup 6-Digit Encryption PIN
app.post('/api/auth/pin/setup', pinLimiter, authenticate, async (req, res) => {
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

    await User.findByIdAndUpdate(req.userId, {
      pin_hash: hash,
      pin_salt: salt,
      updated_at: now,
    });

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
app.post('/api/auth/pin/verify', pinLimiter, authenticate, async (req, res) => {
  try {
    const { pin } = req.body;
    const pinRegex = /^\d{6}$/;

    if (!pin || !pinRegex.test(String(pin))) {
      return res.status(400).json({ error: 'PIN must be exactly 6 digits.' });
    }

    const user = await User.findById(req.userId);
    if (!user || !user.pin_hash) {
      return res.status(400).json({ error: 'No encryption PIN configured for this account.' });
    }

    const isValid = verifyPassword(String(pin), user.pin_hash, user.pin_salt);

    if (!isValid) {
      const attempts = (failedPinAttempts.get(req.userId) || 0) + 1;
      failedPinAttempts.set(req.userId, attempts);

      if (attempts >= 2) {
        // Exceeded 2 attempts: revoke all sessions for this user immediately and clear cookie
        await Session.deleteMany({ user_id: req.userId });
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

async function getPasswordsWithStats(userId) {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const passwords = await Password.aggregate([
    { $match: { user_id: userObjectId } },
    { $sort: { updated_at: -1 } },
    {
      $lookup: {
        from: 'practicelogs',
        localField: '_id',
        foreignField: 'password_id',
        as: 'logs',
      },
    },
    {
      $project: {
        id: { $toString: '$_id' },
        password: 1,
        note: 1,
        blind_index: 1,
        created_at: 1,
        updated_at: 1,
        practice_count: { $size: '$logs' },
        success_count: {
          $size: {
            $filter: {
              input: '$logs',
              as: 'log',
              cond: { $eq: ['$$log.is_success', 1] },
            },
          },
        },
        avg_accuracy: {
          $cond: [
            { $gt: [{ $size: '$logs' }, 0] },
            { $round: [{ $avg: '$logs.accuracy' }, 1] },
            null,
          ],
        },
        avg_speed_cpm: {
          $cond: [
            { $gt: [{ $size: '$logs' }, 0] },
            { $round: [{ $avg: '$logs.speed_cpm' }, 1] },
            null,
          ],
        },
        last_practiced_at: {
          $cond: [
            { $gt: [{ $size: '$logs' }, 0] },
            { $max: '$logs.created_at' },
            null,
          ],
        },
      },
    },
  ]);
  return passwords;
}

// 5. Get all passwords for authenticated user
app.get('/api/passwords', authenticate, async (req, res) => {
  try {
    const passwords = await getPasswordsWithStats(req.userId);
    res.json(passwords);
  } catch (error) {
    console.error('Error fetching passwords:', error);
    res.status(500).json({ error: 'Failed to retrieve passwords' });
  }
});

// 6. Add password (enforces uniqueness per user, supports zero-knowledge blind index)
app.post('/api/passwords', authenticate, async (req, res) => {
  try {
    const { password, note = '', blindIndex = null } = req.body;

    if (!password || typeof password !== 'string' || password.trim().length === 0) {
      return res.status(400).json({ error: 'Password cannot be empty' });
    }

    const trimmedPassword = password.trim();

    // Check duplicate for this user
    let existing = null;
    if (blindIndex) {
      existing = await Password.findOne({ user_id: req.userId, blind_index: blindIndex });
    } else {
      existing = await Password.findOne({ user_id: req.userId, password: trimmedPassword });
    }

    if (existing) {
      return res.status(409).json({
        error: 'This password is already saved in your vault. Duplicate passwords are not permitted.',
      });
    }

    const now = new Date().toISOString();
    const newPassword = await Password.create({
      user_id: req.userId,
      password: trimmedPassword,
      note: (note || '').trim(),
      blind_index: blindIndex || null,
      created_at: now,
      updated_at: now,
    });

    res.status(201).json({
      id: newPassword._id.toString(),
      password: newPassword.password,
      note: newPassword.note,
      blind_index: newPassword.blind_index,
      created_at: newPassword.created_at,
      updated_at: newPassword.updated_at,
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
app.put('/api/passwords/:id', authenticate, async (req, res) => {
  try {
    const id = req.params.id;
    const { password, note = '', blindIndex = null } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid password ID' });
    }

    if (!password || typeof password !== 'string' || password.trim().length === 0) {
      return res.status(400).json({ error: 'Password cannot be empty' });
    }

    const trimmedPassword = password.trim();

    // Check duplicate among this user's other passwords
    const query = blindIndex
      ? { user_id: req.userId, blind_index: blindIndex, _id: { $ne: id } }
      : { user_id: req.userId, password: trimmedPassword, _id: { $ne: id } };

    const duplicate = await Password.findOne(query);
    if (duplicate) {
      return res.status(409).json({
        error: 'Another entry already uses this password. Duplicate passwords are not permitted.',
      });
    }

    const now = new Date().toISOString();
    const updated = await Password.findOneAndUpdate(
      { _id: id, user_id: req.userId },
      {
        password: trimmedPassword,
        note: (note || '').trim(),
        blind_index: blindIndex || null,
        updated_at: now,
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Password not found' });
    }

    res.json({
      id: updated._id.toString(),
      password: updated.password,
      note: updated.note,
      blind_index: updated.blind_index,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// 8. Delete password
app.delete('/api/passwords/:id', authenticate, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid password ID' });
    }

    const result = await Password.findOneAndDelete({ _id: id, user_id: req.userId });
    if (!result) {
      return res.status(404).json({ error: 'Password not found' });
    }

    await PracticeLog.updateMany({ password_id: id }, { $set: { password_id: null } });

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
app.post('/api/practice/sessions', authenticate, async (req, res) => {
  try {
    const { mode_type, target_count = 1, total_items = 0 } = req.body;
    const now = new Date().toISOString();

    const session = await PracticeSession.create({
      user_id: req.userId,
      mode_type,
      target_count,
      started_at: now,
      total_items,
    });

    res.status(201).json({ sessionId: session._id.toString() });
  } catch (error) {
    console.error('Error creating practice session:', error);
    res.status(500).json({ error: 'Failed to create practice session' });
  }
});

// 10. Record individual practice log
app.post('/api/practice/logs', authenticate, async (req, res) => {
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

    const log = await PracticeLog.create({
      session_id: session_id && mongoose.Types.ObjectId.isValid(session_id) ? session_id : null,
      password_id: password_id && mongoose.Types.ObjectId.isValid(password_id) ? password_id : null,
      is_success: is_success ? 1 : 0,
      duration_ms: duration_ms || 0,
      accuracy: accuracy || 0,
      typed_length: typed_length || 0,
      target_length: target_length || 0,
      speed_cpm: speed_cpm || 0,
      speed_wpm: speed_wpm || 0,
      error_count: error_count || 0,
      timed_out: timed_out ? 1 : 0,
      created_at: now,
    });

    res.status(201).json({ logId: log._id.toString() });
  } catch (error) {
    console.error('Error recording practice log:', error);
    res.status(500).json({ error: 'Failed to record practice log' });
  }
});

// 11. Complete practice session
app.put('/api/practice/sessions/:id', authenticate, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const {
      total_items = 0,
      successful_items = 0,
      avg_accuracy = 0,
      avg_speed_cpm = 0,
    } = req.body;

    const now = new Date().toISOString();

    await PracticeSession.findOneAndUpdate(
      { _id: id, user_id: req.userId },
      {
        completed_at: now,
        total_items,
        successful_items,
        avg_accuracy,
        avg_speed_cpm,
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error completing practice session:', error);
    res.status(500).json({ error: 'Failed to complete practice session' });
  }
});

// 12. Practice Statistics & History Overview for User
app.get('/api/practice/stats', authenticate, async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.userId);
    const totalSessions = await PracticeSession.countDocuments({ user_id: req.userId });

    const attemptsStats = await PracticeSession.aggregate([
      { $match: { user_id: userObjectId } },
      {
        $lookup: {
          from: 'practicelogs',
          localField: '_id',
          foreignField: 'session_id',
          as: 'log',
        },
      },
      { $unwind: '$log' },
      {
        $group: {
          _id: null,
          total_attempts: { $sum: 1 },
          successful_attempts: {
            $sum: { $cond: [{ $eq: ['$log.is_success', 1] }, 1, 0] },
          },
        },
      },
    ]);

    const totalAttempts = attemptsStats[0]?.total_attempts || 0;
    const successfulAttempts = attemptsStats[0]?.successful_attempts || 0;

    const performanceStats = await PracticeSession.aggregate([
      { $match: { user_id: userObjectId } },
      {
        $lookup: {
          from: 'practicelogs',
          localField: '_id',
          foreignField: 'session_id',
          as: 'log',
        },
      },
      { $unwind: '$log' },
      { $match: { 'log.is_success': 1 } },
      {
        $group: {
          _id: null,
          avg_accuracy: { $avg: '$log.accuracy' },
          avg_cpm: { $avg: '$log.speed_cpm' },
          avg_wpm: { $avg: '$log.speed_wpm' },
          avg_duration_sec: { $avg: { $divide: ['$log.duration_ms', 1000] } },
          best_wpm: { $max: '$log.speed_wpm' },
        },
      },
    ]);

    const perf = performanceStats[0] || {};

    const recentSessionsDocs = await PracticeSession.find({ user_id: req.userId })
      .sort({ _id: -1 })
      .limit(10)
      .lean();

    const recentSessions = recentSessionsDocs.map((s) => ({
      id: s._id.toString(),
      mode_type: s.mode_type,
      target_count: s.target_count,
      started_at: s.started_at,
      completed_at: s.completed_at,
      total_items: s.total_items,
      successful_items: s.successful_items,
      avg_accuracy: s.avg_accuracy,
      avg_speed_cpm: s.avg_speed_cpm,
    }));

    res.json({
      totalSessions,
      totalAttempts,
      successfulAttempts,
      overallSuccessRate: totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 100) : 0,
      avgAccuracy: perf.avg_accuracy ? Math.round(perf.avg_accuracy * 10) / 10 : 0,
      avgCpm: perf.avg_cpm ? Math.round(perf.avg_cpm * 10) / 10 : 0,
      avgWpm: perf.avg_wpm ? Math.round(perf.avg_wpm * 10) / 10 : 0,
      bestWpm: perf.best_wpm ? Math.round(perf.best_wpm * 10) / 10 : 0,
      avgDurationSec: perf.avg_duration_sec ? Math.round(perf.avg_duration_sec * 100) / 100 : 0,
      recentSessions,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch practice statistics' });
  }
});

// 13. Clear all practice statistics and logs for User
app.delete('/api/practice/stats', authenticate, async (req, res) => {
  try {
    const userSessions = await PracticeSession.find({ user_id: req.userId }).select('_id');
    const sessionIds = userSessions.map((s) => s._id);

    await PracticeLog.deleteMany({ session_id: { $in: sessionIds } });
    await PracticeSession.deleteMany({ user_id: req.userId });

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

  // Attempt initial DB connection
  connectDB()
    .then(() => {
      console.log('[MongoDB Atlas] Connected to database.');
    })
    .catch((err) => {
      console.warn('[MongoDB Atlas] Initial connection note:', err.message);
    });

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

export default app;
