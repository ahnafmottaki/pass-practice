import db from './db.js';

console.log('Testing DB operations:');
// Clean up for test
db.exec('DELETE FROM practice_logs;');
db.exec('DELETE FROM practice_sessions;');
db.exec('DELETE FROM passwords;');

// 1. Insert password
const now = new Date().toISOString();
const r1 = db.prepare('INSERT INTO passwords (password, note, created_at, updated_at) VALUES (?, ?, ?, ?)').run('SecretPass123!', 'Home wifi format', now, now);
console.log('Inserted id:', r1.lastInsertRowid);

// 2. Try inserting duplicate
try {
  db.prepare('INSERT INTO passwords (password, note, created_at, updated_at) VALUES (?, ?, ?, ?)').run('SecretPass123!', 'Duplicate test', now, now);
  console.error('ERROR: Duplicate was not caught!');
} catch (e) {
  console.log('SUCCESS: Duplicate correctly rejected with constraint:', e.message);
}

// 3. Insert second password
const r2 = db.prepare('INSERT INTO passwords (password, note, created_at, updated_at) VALUES (?, ?, ?, ?)').run('AlphaBravo#2026', 'Mnemonic 2', now, now);
console.log('Inserted second id:', r2.lastInsertRowid);

// 4. Query passwords
const all = db.prepare('SELECT * FROM passwords').all();
console.log('Total passwords:', all.length);

// 5. Create practice session
const s = db.prepare('INSERT INTO practice_sessions (mode_type, target_count, started_at, total_items) VALUES (?, ?, ?, ?)').run('time_all', 1, now, 2);
console.log('Created session:', s.lastInsertRowid);

// 6. Create practice log
const l = db.prepare(`
  INSERT INTO practice_logs (
    session_id, password_id, is_success, duration_ms, accuracy, typed_length, target_length, speed_cpm, speed_wpm, error_count, timed_out, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(s.lastInsertRowid, r1.lastInsertRowid, 1, 4500, 100, 14, 14, 186, 37.2, 0, 0, now);
console.log('Created log:', l.lastInsertRowid);

console.log('All DB test operations succeeded cleanly!');
