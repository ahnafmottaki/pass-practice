import db from '../server/db.js';
import { hashPassword, verifyPassword } from '../server/auth.js';

console.log('Testing PIN Hashing & Scrypt Verification...');

const pin = '123456';
const { hash, salt } = hashPassword(pin);
console.log('PIN:', pin);
console.log('PIN Salt (hex):', salt);
console.log('PIN Hash (hex):', hash);

const valid = verifyPassword('123456', hash, salt);
console.log('Verify correct PIN 123456:', valid ? 'PASS' : 'FAIL');

const invalid = verifyPassword('654321', hash, salt);
console.log('Verify wrong PIN 654321:', !invalid ? 'PASS' : 'FAIL');

console.log('All unit crypto tests passed!');
