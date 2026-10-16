import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded from project root
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Global cached connection for serverless / Vercel container reuse
let cached = global._mongooseCached;
if (!cached) {
  cached = global._mongooseCached = { conn: null, promise: null };
}

export async function connectDB() {
  const uri = process.env.DATABASE_URL || process.env.MONGODB_URI;

  if (!uri || !uri.trim()) {
    throw new Error('DATABASE_URL is not set. Please add your MongoDB Atlas connection string to .env or Vercel environment variables.');
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
    };

    cached.promise = mongoose.connect(uri.trim(), opts).then((m) => {
      console.log('[MongoDB Atlas] Connected successfully');
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}

// -------------------------------------------------------------
// Schemas & Models
// -------------------------------------------------------------

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  salt: { type: String, required: true },
  pin_hash: { type: String, default: null },
  pin_salt: { type: String, default: null },
  created_at: { type: String, default: () => new Date().toISOString() },
  updated_at: { type: String, default: () => new Date().toISOString() },
});

const SessionSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  created_at: { type: String, default: () => new Date().toISOString() },
  expires_at: { type: String, required: true },
});

const PasswordSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  password: { type: String, required: true },
  note: { type: String, default: '' },
  blind_index: { type: String, default: null },
  created_at: { type: String, default: () => new Date().toISOString() },
  updated_at: { type: String, default: () => new Date().toISOString() },
});

PasswordSchema.index({ user_id: 1, blind_index: 1 });
PasswordSchema.index({ user_id: 1, password: 1 });

const PracticeSessionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  mode_type: { type: String, required: true },
  target_count: { type: Number, default: 1 },
  started_at: { type: String, default: () => new Date().toISOString() },
  completed_at: { type: String, default: null },
  total_items: { type: Number, default: 0 },
  successful_items: { type: Number, default: 0 },
  avg_accuracy: { type: Number, default: 0 },
  avg_speed_cpm: { type: Number, default: 0 },
});

const PracticeLogSchema = new mongoose.Schema({
  session_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PracticeSession', default: null, index: true },
  password_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Password', default: null, index: true },
  is_success: { type: Number, required: true, default: 0 },
  duration_ms: { type: Number, default: 0 },
  accuracy: { type: Number, default: 0 },
  typed_length: { type: Number, default: 0 },
  target_length: { type: Number, default: 0 },
  speed_cpm: { type: Number, default: 0 },
  speed_wpm: { type: Number, default: 0 },
  error_count: { type: Number, default: 0 },
  timed_out: { type: Number, default: 0 },
  created_at: { type: String, default: () => new Date().toISOString() },
});

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export const Session = mongoose.models.Session || mongoose.model('Session', SessionSchema);
export const Password = mongoose.models.Password || mongoose.model('Password', PasswordSchema);
export const PracticeSession = mongoose.models.PracticeSession || mongoose.model('PracticeSession', PracticeSessionSchema);
export const PracticeLog = mongoose.models.PracticeLog || mongoose.model('PracticeLog', PracticeLogSchema);

export default {
  connectDB,
  User,
  Session,
  Password,
  PracticeSession,
  PracticeLog,
};
