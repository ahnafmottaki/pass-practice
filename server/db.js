import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = !!process.env.VERCEL;
const DB_PATH = isVercel
  ? path.join(os.tmpdir(), 'passwords.db')
  : path.resolve(__dirname, '..', 'passwords.db');

export const db = new DatabaseSync(DB_PATH);

// Enable WAL mode and foreign keys for durability and performance
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// 1. Initialize core tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    pin_hash TEXT DEFAULT NULL,
    pin_salt TEXT DEFAULT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS passwords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    password TEXT NOT NULL,
    note TEXT DEFAULT '',
    blind_index TEXT DEFAULT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS practice_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
`);

// 2. Migration helpers: Ensure columns exist if table was created in an older version
try {
  const pwdCols = db.prepare("PRAGMA table_info('passwords')").all();
  if (!pwdCols.some((c) => c.name === 'user_id')) {
    db.exec('ALTER TABLE passwords ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;');
  }
  if (!pwdCols.some((c) => c.name === 'blind_index')) {
    db.exec('ALTER TABLE passwords ADD COLUMN blind_index TEXT DEFAULT NULL;');
  }
} catch (e) {
  // ignore
}

try {
  const sessCols = db.prepare("PRAGMA table_info('practice_sessions')").all();
  if (!sessCols.some((c) => c.name === 'user_id')) {
    db.exec('ALTER TABLE practice_sessions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;');
  }
} catch (e) {
  // ignore
}

// 3. Create indexes safely
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  CREATE INDEX IF NOT EXISTS idx_passwords_user ON passwords(user_id);
  CREATE INDEX IF NOT EXISTS idx_passwords_blind_index ON passwords(user_id, blind_index);
  CREATE INDEX IF NOT EXISTS idx_practice_sessions_user ON practice_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_logs_session ON practice_logs(session_id);
`);

export default db;
