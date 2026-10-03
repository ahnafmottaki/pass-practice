import crypto from 'node:crypto';

/**
 * Hash a password using scrypt with a random 16-byte salt
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

/**
 * Verify password against stored scrypt hash and salt
 */
export function verifyPassword(password, storedHash, salt) {
  try {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Generate a cryptographically secure 64-char hex session token
 */
export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}
