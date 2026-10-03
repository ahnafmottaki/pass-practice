import db from '../server/db.js';

console.log('Clearing SQLite database...');

db.exec('PRAGMA foreign_keys = OFF;');

db.exec(`
  DELETE FROM practice_logs;
  DELETE FROM practice_sessions;
  DELETE FROM passwords;
  DELETE FROM sessions;
  DELETE FROM users;
`);

try {
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'sessions', 'passwords', 'practice_sessions', 'practice_logs');");
} catch (e) {
  // sqlite_sequence might be empty or not yet created
}

db.exec('PRAGMA foreign_keys = ON;');
db.exec('VACUUM;');

const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
const sessionCount = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
const passwordCount = db.prepare('SELECT COUNT(*) as count FROM passwords').get().count;
const practiceCount = db.prepare('SELECT COUNT(*) as count FROM practice_sessions').get().count;

console.log('Database cleared successfully!');
console.log(`Current counts:
- users: ${userCount}
- sessions: ${sessionCount}
- passwords: ${passwordCount}
- practice_sessions: ${practiceCount}
`);
