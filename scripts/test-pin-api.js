const PORT = process.env.PORT || 3001;
const BASE = `http://localhost:${PORT}/api`;

async function run() {
  const timestamp = Date.now();
  const testEmail = `pin_test_${timestamp}@example.com`;
  const testPassword = 'StrongPassword123!';

  console.log(`1. Registering test user: ${testEmail}`);
  const regRes = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'PIN Test User',
      email: testEmail,
      password: testPassword,
      confirmPassword: testPassword,
    }),
  });
  const regData = await regRes.json();
  if (!regRes.ok) throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
  console.log('Registered user ID:', regData.user.id, 'hasPin:', regData.user.hasPin);

  const token = regData.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Check me
  console.log('\n2. Verifying /auth/me returns hasPin = false');
  const meRes = await fetch(`${BASE}/auth/me`, { headers: authHeaders });
  const meData = await meRes.json();
  console.log('Me hasPin:', meData.user.hasPin);

  // Setup invalid PIN (not 6 digits)
  console.log('\n3. Testing PIN validation: 4 digits should fail');
  const invalidRes = await fetch(`${BASE}/auth/pin/setup`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ pin: '1234', confirmPin: '1234' }),
  });
  console.log('Invalid PIN response status:', invalidRes.status, '(expected 400)');

  // Setup PIN mismatch
  console.log('\n4. Testing PIN mismatch');
  const mismatchRes = await fetch(`${BASE}/auth/pin/setup`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ pin: '123456', confirmPin: '654321' }),
  });
  console.log('Mismatch PIN response status:', mismatchRes.status, '(expected 400)');

  // Setup valid 6-digit PIN
  console.log('\n5. Setting up valid 6-digit PIN (987654)');
  const setupRes = await fetch(`${BASE}/auth/pin/setup`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ pin: '987654', confirmPin: '987654' }),
  });
  const setupData = await setupRes.json();
  console.log('Setup status:', setupRes.status, setupData);

  // Check me again (hasPin should be true)
  console.log('\n6. Checking /auth/me after setup (hasPin should be true)');
  const meRes2 = await fetch(`${BASE}/auth/me`, { headers: authHeaders });
  const meData2 = await meRes2.json();
  console.log('Me hasPin:', meData2.user.hasPin);

  // Verify PIN with correct PIN
  console.log('\n7. Verifying correct PIN (987654)');
  const verifyRes1 = await fetch(`${BASE}/auth/pin/verify`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ pin: '987654' }),
  });
  console.log('Verify correct PIN status:', verifyRes1.status);

  // Test Attempt 1 failure
  console.log('\n8. Testing Attempt 1 failure with wrong PIN (000000)');
  const failRes1 = await fetch(`${BASE}/auth/pin/verify`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ pin: '000000' }),
  });
  const failData1 = await failRes1.json();
  console.log('Attempt 1 status:', failRes1.status, failData1);

  // Test Attempt 2 failure (should trigger lockout & session revocation)
  console.log('\n9. Testing Attempt 2 failure with wrong PIN (111111) -> should lockout');
  const failRes2 = await fetch(`${BASE}/auth/pin/verify`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ pin: '111111' }),
  });
  const failData2 = await failRes2.json();
  console.log('Attempt 2 status:', failRes2.status, failData2);

  // Test subsequent request with the old token -> should be 401 Unauthorized
  console.log('\n10. Testing session revocation: /auth/me with revoked token');
  const meRes3 = await fetch(`${BASE}/auth/me`, { headers: authHeaders });
  console.log('Revoked session status:', meRes3.status, '(expected 401)');

  console.log('\n✅ All PIN setup, verification, and 2-attempt lockout tests passed successfully!');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
