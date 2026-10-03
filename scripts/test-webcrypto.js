// Test Web Crypto API native support
const crypto = globalThis.crypto;

async function testCrypto() {
  const pin = '123456';
  const salt = 'usersalt_test';

  // 1. Derive AES key from PIN
  const enc = new TextEncoder();
  const rawHash = await crypto.subtle.digest('SHA-256', enc.encode(pin + ':' + salt));
  const aesKey = await crypto.subtle.importKey(
    'raw',
    rawHash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );

  console.log('AES-GCM Key created:', aesKey.algorithm);

  // 2. Encrypt plaintext
  const plaintext = 'SecretP@ssw0rd!#';
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    enc.encode(plaintext)
  );

  // Pack as base64 string
  const ivB64 = Buffer.from(iv).toString('base64');
  const cipherB64 = Buffer.from(cipherBuffer).toString('base64');
  const packed = `enc:v1:${ivB64}:${cipherB64}`;
  console.log('Encrypted ciphertext packed:', packed);

  // 3. Decrypt
  const parts = packed.split(':');
  const extractedIv = Buffer.from(parts[2], 'base64');
  const extractedCipher = Buffer.from(parts[3], 'base64');

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: extractedIv },
    aesKey,
    extractedCipher
  );
  const decrypted = new TextDecoder().decode(decryptedBuffer);
  console.log('Decrypted plaintext:', decrypted);
  console.log('Matches original:', decrypted === plaintext ? 'PASS' : 'FAIL');
}

testCrypto().catch(console.error);
