import db from '../server/db.js';
import { deriveKeyFromPin, computeBlindIndex, encryptString, decryptString } from '../src/utils/vaultCrypto.js';

const PORT = process.env.PORT || 3001;
const BASE = `http://localhost:${PORT}/api`;

async function testE2EZeroKnowledge() {
  console.log('--- Testing Zero-Knowledge AES-256-GCM Encryption & Blind Indexing ---');

  const timestamp = Date.now();
  const email = `crypto_user_${timestamp}@example.com`;
  const password = 'UserPassword123!';
  const pin = '852963';

  // 1. Register
  console.log('1. Registering user...');
  const regRes = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Crypto Test User',
      email,
      password,
      confirmPassword: password,
    }),
  });
  const regData = await regRes.json();
  const token = regData.token;
  const userId = regData.user.id;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. Setup PIN
  console.log('2. Setting up 6-digit PIN (852963)...');
  const pinRes = await fetch(`${BASE}/auth/pin/setup`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ pin, confirmPin: pin }),
  });
  if (!pinRes.ok) throw new Error('PIN setup failed');

  // 3. Derive 256-bit AES-GCM Key in client memory
  console.log('3. Deriving AES-GCM key from PIN + user email...');
  const cryptoKey = await deriveKeyFromPin(pin, email);

  // 4. Encrypt sensitive password
  const secretPassword = 'MySuperSecretDrillPassword!#$99';
  const secretNote = 'Bank mnemonic hook 2026';

  console.log('4. Client-side encrypting password and note with AES-256-GCM...');
  const blindIndex = await computeBlindIndex(pin, secretPassword, email);
  const encryptedPassword = await encryptString(secretPassword, cryptoKey);
  const encryptedNote = await encryptString(secretNote, cryptoKey);

  console.log('   Plaintext password:', secretPassword);
  console.log('   Ciphertext password:', encryptedPassword);
  console.log('   Blind index:', blindIndex);

  // 5. Send to backend
  console.log('5. Storing encrypted password in database...');
  const addRes = await fetch(`${BASE}/passwords`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      password: encryptedPassword,
      note: encryptedNote,
      blindIndex,
    }),
  });
  const addedData = await addRes.json();
  if (!addRes.ok) throw new Error(`Add password failed: ${JSON.stringify(addedData)}`);
  const passwordId = addedData.id;

  // 6. Direct Database Inspection (Proof of Zero-Knowledge)
  console.log('\n6. Inspecting SQLite Database directly...');
  const rowInDb = db.prepare('SELECT * FROM passwords WHERE id = ?').get(passwordId);
  console.log('   Database stored password:', rowInDb.password);
  console.log('   Database stored note:', rowInDb.note);
  console.log('   Database stored blind_index:', rowInDb.blind_index);

  if (!rowInDb.password.startsWith('enc:v1:')) {
    throw new Error('FAILED: Password was not stored as ciphertext in SQLite!');
  }
  if (rowInDb.password.includes(secretPassword)) {
    throw new Error('FAILED: Plaintext password leaked into SQLite database!');
  }
  console.log('   [SECURE] Plaintext password is NOT in the database. Only AES-256-GCM ciphertext is stored!');

  // 7. Duplicate Prevention using Blind Index
  console.log('\n7. Testing Zero-Knowledge Duplicate Detection...');
  const dupEncryptedPassword = await encryptString(secretPassword, cryptoKey);
  const dupRes = await fetch(`${BASE}/passwords`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      password: dupEncryptedPassword,
      note: 'Another note',
      blindIndex,
    }),
  });
  console.log('   Duplicate status code:', dupRes.status, '(expected 409)');
  if (dupRes.status !== 409) {
    throw new Error('Duplicate insertion should have been rejected with 409');
  }
  console.log('   [PASS] Duplicate rejected based on blind index!');

  // 8. Fetch and Decrypt
  console.log('\n8. Fetching encrypted list from API and decrypting on client...');
  const listRes = await fetch(`${BASE}/passwords`, { headers: authHeaders });
  const listData = await listRes.json();
  const fetchedItem = listData.find((p) => p.id === passwordId);

  const decryptedPassword = await decryptString(fetchedItem.password, cryptoKey);
  const decryptedNote = await decryptString(fetchedItem.note, cryptoKey);

  console.log('   Fetched ciphertext:', fetchedItem.password);
  console.log('   Client decrypted password:', decryptedPassword);
  console.log('   Client decrypted note:', decryptedNote);

  if (decryptedPassword !== secretPassword) {
    throw new Error('Decrypted password does not match original plaintext!');
  }
  if (decryptedNote !== secretNote) {
    throw new Error('Decrypted note does not match original note!');
  }
  console.log('   [PASS] Passwords decrypted accurately with the unlocked PIN key!');

  console.log('\n✅ ALL ZERO-KNOWLEDGE ENCRYPTION & DECRYPTION TESTS PASSED PERFECTLY!');
}

testE2EZeroKnowledge().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
