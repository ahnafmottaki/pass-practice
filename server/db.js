import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '..', 'passwords.db');

export const db = new DatabaseSync(DB_PATH);

// Enable WAL mode and foreign keys for durability and performance
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS passwords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    password TEXT NOT NULL UNIQUE,
    note TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS practice_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode_type TEXT NOT NULL,
    target_count INTEGER DEFAULT 1,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    total_items INTEGER DEFAULT 0,
    successful_items INTEGER DEFAULT 0,
    avg_accuracy REAL DEFAULT 0,
    avg_speed_cpm REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS practice_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    password_id INTEGER,
    is_success INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    accuracy REAL NOT NULL,
    typed_length INTEGER NOT NULL,
    target_length INTEGER NOT NULL,
    speed_cpm REAL NOT NULL,
    speed_wpm REAL NOT NULL,
    error_count INTEGER NOT NULL,
    timed_out INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES practice_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY(password_id) REFERENCES passwords(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_passwords_created ON passwords(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_logs_session ON practice_logs(session_id);
`);

export default db;
