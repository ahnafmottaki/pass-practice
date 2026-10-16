import { connectDB, User, Session, Password, PracticeSession, PracticeLog } from '../server/db.js';

async function clearDB() {
  console.log('Connecting to MongoDB Atlas...');
  await connectDB();

  console.log('Clearing MongoDB database collections...');
  await Promise.all([
    PracticeLog.deleteMany({}),
    PracticeSession.deleteMany({}),
    Password.deleteMany({}),
    Session.deleteMany({}),
    User.deleteMany({}),
  ]);

  const [userCount, sessionCount, passwordCount, practiceCount] = await Promise.all([
    User.countDocuments(),
    Session.countDocuments(),
    Password.countDocuments(),
    PracticeSession.countDocuments(),
  ]);

  console.log('Database cleared successfully!');
  console.log(`Current counts:
- users: ${userCount}
- sessions: ${sessionCount}
- passwords: ${passwordCount}
- practice_sessions: ${practiceCount}
`);

  process.exit(0);
}

clearDB().catch((err) => {
  console.error('Failed to clear database:', err);
  process.exit(1);
});
