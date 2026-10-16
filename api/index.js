import app from '../server/index.js';
import { connectDB } from '../server/db.js';

export default async function handler(req, res) {
  // Normalize req.url so Express router matches regardless of Vercel rewrite prefixing
  if (!req.url.startsWith('/api')) {
    req.url = `/api${req.url === '/' ? '' : req.url}`;
  }
  try {
    await connectDB();
  } catch (err) {
    // Database connection error will be caught and reported gracefully by the Express middleware
  }
  return app(req, res);
}
