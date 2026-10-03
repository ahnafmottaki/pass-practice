/**
 * Zero-Knowledge Client-Side Cryptography Utility
 * Uses native Web Crypto API (crypto.subtle) for AES-GCM 256-bit encryption/decryption
 */

const CIPHER_PREFIX = 'enc:v1:';

function bytesToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive a 256-bit AES-GCM CryptoKey from the user's 6-digit PIN and user-scoped salt
 * Uses PBKDF2-HMAC-SHA256 with 600,000 iterations (OWASP recommendation) to prevent
 * offline GPU brute-force attacks against 6-digit PINs.
 */
export async function deriveKeyFromPin(pin, salt = 'passpractice_vault') {
  if (!pin || typeof pin !== 'string') {
    throw new Error('Valid 6-digit PIN is required to derive encryption key');
  }

  const enc = new TextEncoder();
  const pinBuffer = enc.encode(pin);
  const saltBuffer = enc.encode(`passpractice_master_salt:${salt}`);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    pinBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 600000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Compute a blind index (deterministic hash) for server-side duplicate prevention
 * without exposing the plaintext password or PIN.
 * Uses PBKDF2 with 100,000 iterations to resist rainbow table and dictionary attacks.
 */
export async function computeBlindIndex(pin, plaintext, salt = 'passpractice_vault') {
  if (!plaintext) return '';
  const enc = new TextEncoder();
  const pinBuffer = enc.encode(pin);
  const saltBuffer = enc.encode(`passpractice_blind_salt:${salt}:${plaintext.trim()}`);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    pinBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    256
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encrypt a string with AES-256-GCM using a random 12-byte IV for every operation
 */
export async function encryptString(plaintext, cryptoKey) {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return '';
  }

  if (!cryptoKey) {
    throw new Error('Encryption key is required to encrypt data');
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    enc.encode(plaintext)
  );

  const ivB64 = bytesToBase64(iv);
  const cipherB64 = bytesToBase64(new Uint8Array(cipherBuffer));

  return `${CIPHER_PREFIX}${ivB64}:${cipherB64}`;
}

/**
 * Decrypt a string with AES-256-GCM using the derived CryptoKey
 */
export async function decryptString(encryptedText, cryptoKey) {
  if (!encryptedText || typeof encryptedText !== 'string') {
    return '';
  }

  // Gracefully return unencrypted legacy plaintext if not prefixed
  if (!encryptedText.startsWith(CIPHER_PREFIX)) {
    return encryptedText;
  }

  if (!cryptoKey) {
    throw new Error('Encryption key is required to decrypt vault data');
  }

  try {
    const raw = encryptedText.slice(CIPHER_PREFIX.length);
    const separatorIdx = raw.indexOf(':');
    if (separatorIdx === -1) {
      throw new Error('Malformed encrypted format');
    }

    const ivB64 = raw.slice(0, separatorIdx);
    const cipherB64 = raw.slice(separatorIdx + 1);

    const iv = base64ToBytes(ivB64);
    const cipherBytes = base64ToBytes(cipherB64);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      cipherBytes
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    console.error('Decryption failed for item:', err);
    throw new Error('Unable to decrypt item with the provided PIN.');
  }
}
