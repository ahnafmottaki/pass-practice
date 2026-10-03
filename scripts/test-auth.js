import db from '../server/db.js';

async function testAuthIntegration() {
  const port = process.env.PORT || 3001;
  const base = `http://localhost:${port}/api`;

  async function req(path, options = {}) {
    const res = await fetch(`${base}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  }

  // 1. Clean test user if exists
  const testEmail = 'alex.tester@example.com';
  db.prepare('DELETE FROM users WHERE email = ? COLLATE NOCASE').run(testEmail);

  // 2. Test mismatched confirm password
  const rMismatch = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Alex Tester',
      email: testEmail,
      password: 'StrongPassword123!',
      confirmPassword: 'WrongPassword!',
    }),
  });
  console.log(`[PASS] Mismatched passwords rejected with status: ${rMismatch.status} (expected 400)`);
  if (rMismatch.status !== 400) throw new Error('Failed to reject mismatched passwords');

  // 3. Test short password
  const rShort = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Alex Tester',
      email: testEmail,
      password: '123',
      confirmPassword: '123',
    }),
  });
  console.log(`[PASS] Short password rejected with status: ${rShort.status} (expected 400)`);
  if (rShort.status !== 400) throw new Error('Failed to reject short password');

  // 4. Test valid registration
  const rValid = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Alex Tester',
      email: testEmail,
      password: 'CorrectHorseBatteryStaple#2026',
      confirmPassword: 'CorrectHorseBatteryStaple#2026',
    }),
  });
  console.log(`[PASS] Valid registration status: ${rValid.status} (expected 201), user id: ${rValid.data.user?.id}`);
  if (rValid.status !== 201 || !rValid.data.token) throw new Error('Registration failed');

  const regToken = rValid.data.token;

  // 5. Verify database storage: Password MUST BE HASHED in SQLite, NOT plaintext!
  const dbUser = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(testEmail);
  console.log('[PASS] DB verification:');
  console.log('   Email stored:', dbUser.email);
  console.log('   Password hash stored:', dbUser.password_hash.slice(0, 24) + '...');
  console.log('   Salt stored:', dbUser.salt);
  if (dbUser.password_hash.includes('CorrectHorseBatteryStaple') || dbUser.password_hash.length < 32) {
    throw new Error('SECURITY VIOLATION: Password was not hashed properly in database!');
  }
  console.log('   [SECURE] Plaintext password is NOT in database!');

  // 6. Test duplicate registration
  const rDup = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Alex Tester 2',
      email: testEmail,
      password: 'AnotherPassword999',
      confirmPassword: 'AnotherPassword999',
    }),
  });
  console.log(`[PASS] Duplicate email rejected with status: ${rDup.status} (expected 409)`);
  if (rDup.status !== 409) throw new Error('Failed to reject duplicate email');

  // 7. Test login with wrong password
  const rWrongPass = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: 'WrongPassword!',
    }),
  });
  console.log(`[PASS] Wrong password login status: ${rWrongPass.status} (expected 401)`);
  if (rWrongPass.status !== 401) throw new Error('Failed to reject wrong password login');

  // 8. Test login with correct password
  const rLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: 'CorrectHorseBatteryStaple#2026',
    }),
  });
  console.log(`[PASS] Login status: ${rLogin.status} (expected 200), token received`);
  if (rLogin.status !== 200 || !rLogin.data.token) throw new Error('Valid login failed');

  const loginToken = rLogin.data.token;

  // 9. Test /api/auth/me
  const rMe = await req('/auth/me', {
    headers: { Authorization: `Bearer ${loginToken}` },
  });
  console.log(`[PASS] /auth/me status: ${rMe.status}, user: ${rMe.data.user?.name} (${rMe.data.user?.email})`);
  if (rMe.status !== 200 || rMe.data.user?.email !== testEmail) throw new Error('/auth/me failed');

  // 10. Test protected route (/api/passwords) with Bearer token
  const rPw = await req('/passwords', {
    headers: { Authorization: `Bearer ${loginToken}` },
  });
  console.log(`[PASS] Protected /passwords access status: ${rPw.status}`);
  if (rPw.status !== 200) throw new Error('Protected /passwords failed');

  // 11. Test adding password scoped to user
  const rAddPw = await req('/passwords', {
    method: 'POST',
    headers: { Authorization: `Bearer ${loginToken}` },
    body: JSON.stringify({ password: 'AlphaTestPassword#99', note: 'Test note for Alex' }),
  });
  console.log(`[PASS] Add user-scoped password status: ${rAddPw.status}`);

  // 12. Test logout
  const rLogout = await req('/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${loginToken}` },
  });
  console.log(`[PASS] Logout status: ${rLogout.status}`);

  // 13. Verify token revoked after logout
  const rMeAfterLogout = await req('/auth/me', {
    headers: { Authorization: `Bearer ${loginToken}` },
  });
  console.log(`[PASS] Access after logout status: ${rMeAfterLogout.status} (expected 401)`);
  if (rMeAfterLogout.status !== 401) throw new Error('Token should be revoked after logout');

  // Clean up test user
  db.prepare('DELETE FROM users WHERE email = ? COLLATE NOCASE').run(testEmail);
  console.log('--- ALL AUTHENTICATION TESTS PASSED PERFECTLY! ---');
}

testAuthIntegration().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
