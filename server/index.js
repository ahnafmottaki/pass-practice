import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Helper to query password stats along with password details
function getPasswordsWithStats() {
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
    GROUP BY p.id
    ORDER BY p.updated_at DESC
  `;
  return db.prepare(query).all();
}

// 1. Get all passwords
app.get('/api/passwords', (req, res) => {
  try {
    const passwords = getPasswordsWithStats();
    res.json(passwords);
  } catch (error) {
    console.error('Error fetching passwords:', error);
    res.status(500).json({ error: 'Failed to retrieve passwords' });
  }
});

// 2. Add a new password (strictly no duplicate passwords allowed)
app.post('/api/passwords', (req, res) => {
  try {
    const { password, note = '' } = req.body;

    if (!password || typeof password !== 'string' || password.trim().length === 0) {
      return res.status(400).json({ error: 'Password cannot be empty' });
    }

    const trimmedPassword = password.trim();

    // Check duplicate
    const existing = db.prepare('SELECT id FROM passwords WHERE password = ?').get(trimmedPassword);
    if (existing) {
      return res.status(409).json({
        error: 'This password is already saved. Duplicate passwords are not permitted.',
      });
    }

    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO passwords (password, note, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(trimmedPassword, (note || '').trim(), now, now);

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
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'This password already exists. Duplicate passwords are not permitted.' });
    }
    console.error('Error creating password:', error);
    res.status(500).json({ error: 'Failed to save password' });
  }
});

// 3. Update a password or its note
app.put('/api/passwords/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { password, note = '' } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid password ID' });
    }

    if (!password || typeof password !== 'string' || password.trim().length === 0) {
      return res.status(400).json({ error: 'Password cannot be empty' });
    }

    const trimmedPassword = password.trim();

    // Check if another password already has this value
    const duplicate = db.prepare('SELECT id FROM passwords WHERE password = ? AND id != ?').get(trimmedPassword, id);
    if (duplicate) {
      return res.status(409).json({
        error: 'Another entry already uses this password. Duplicate passwords are not permitted.',
      });
    }

    const now = new Date().toISOString();
    const result = db.prepare(`
      UPDATE passwords 
      SET password = ?, note = ?, updated_at = ?
      WHERE id = ?
    `).run(trimmedPassword, (note || '').trim(), now, id);

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

// 4. Delete a password
app.delete('/api/passwords/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid password ID' });
    }

    const result = db.prepare('DELETE FROM passwords WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Password not found' });
    }

    res.json({ success: true, message: 'Password deleted successfully' });
  } catch (error) {
    console.error('Error deleting password:', error);
    res.status(500).json({ error: 'Failed to delete password' });
  }
});

// 5. Start a practice session
app.post('/api/practice/sessions', (req, res) => {
  try {
    const { mode_type, target_count = 1, total_items = 0 } = req.body;
    const now = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO practice_sessions (mode_type, target_count, started_at, total_items)
      VALUES (?, ?, ?, ?)
    `).run(mode_type, target_count, now, total_items);

    res.status(201).json({ sessionId: Number(result.lastInsertRowid) });
  } catch (error) {
    console.error('Error creating practice session:', error);
    res.status(500).json({ error: 'Failed to create practice session' });
  }
});

// 6. Record individual password practice log
app.post('/api/practice/logs', (req, res) => {
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

// 7. Complete practice session
app.put('/api/practice/sessions/:id', (req, res) => {
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
      WHERE id = ?
    `).run(now, total_items, successful_items, avg_accuracy, avg_speed_cpm, id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error completing practice session:', error);
    res.status(500).json({ error: 'Failed to complete practice session' });
  }
});

// 8. Practice Statistics & History Overview
app.get('/api/practice/stats', (req, res) => {
  try {
    const totalSessions = db.prepare('SELECT COUNT(*) as count FROM practice_sessions').get().count;
    const totalAttempts = db.prepare('SELECT COUNT(*) as count FROM practice_logs').get().count;
    const successfulAttempts = db.prepare('SELECT COUNT(*) as count FROM practice_logs WHERE is_success = 1').get().count;
    
    const performanceStats = db.prepare(`
      SELECT 
        ROUND(AVG(accuracy), 1) as avg_accuracy,
        ROUND(AVG(speed_cpm), 1) as avg_cpm,
        ROUND(AVG(speed_wpm), 1) as avg_wpm,
        ROUND(AVG(duration_ms) / 1000.0, 2) as avg_duration_sec,
        MAX(speed_wpm) as best_wpm
      FROM practice_logs
      WHERE is_success = 1
    `).get();

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
      ORDER BY s.id DESC
      LIMIT 10
    `).all();

    res.json({
      totalSessions,
      totalAttempts,
      successfulAttempts,
      overallSuccessRate: totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 100) : 0,
      avgAccuracy: performanceStats.avg_accuracy || 0,
      avgCpm: performanceStats.avg_cpm || 0,
      avgWpm: performanceStats.avg_wpm || 0,
      bestWpm: performanceStats.best_wpm || 0,
      avgDurationSec: performanceStats.avg_duration_sec || 0,
      recentSessions,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch practice statistics' });
  }
});

// 9. Clear all practice statistics and logs
app.delete('/api/practice/stats', (req, res) => {
  try {
    db.exec('DELETE FROM practice_logs;');
    db.exec('DELETE FROM practice_sessions;');
    db.exec('VACUUM;');
    res.json({ success: true, message: 'Practice stats and logs cleared successfully' });
  } catch (error) {
    console.error('Error clearing stats:', error);
    res.status(500).json({ error: 'Failed to clear practice statistics' });
  }
});

// Serve frontend in production build if dist directory exists
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
