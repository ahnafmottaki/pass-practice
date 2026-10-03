import app from '../server/index.js';

export default function handler(req, res) {
  // Normalize req.url so Express router matches regardless of Vercel rewrite prefixing
  if (!req.url.startsWith('/api')) {
    req.url = `/api${req.url === '/' ? '' : req.url}`;
  }
  return app(req, res);
}
