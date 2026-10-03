import http from 'node:http';

async function testHardening() {
  console.log('--- Testing HttpOnly Cookies & Rate Limiting Hardening ---');

  const { spawn } = await import('node:child_process');
  const serverProcess = spawn('node', ['server/index.js'], {
    env: { ...process.env, PORT: '3008', NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise((resolve) => {
    serverProcess.stdout.on('data', (d) => {
      if (d.toString().includes('Server listening')) resolve();
    });
  });

  const BASE = 'http://localhost:3008/api';

  try {
    const timestamp = Date.now();
    const email = `cookie_user_${timestamp}@example.com`;
    const password = 'StrongPassword123!';

    // 1. Test Registration with HttpOnly Cookie
    console.log('1. Testing Registration and Set-Cookie header...');
    const regRes = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cookie User',
        email,
        password,
        confirmPassword: password,
      }),
    });

    const setCookieHeader = regRes.headers.get('set-cookie');
    console.log('   Set-Cookie Header:', setCookieHeader);

    if (!setCookieHeader || !setCookieHeader.includes('passpractice_session')) {
      throw new Error('Expected passpractice_session cookie in Set-Cookie header!');
    }
    if (!setCookieHeader.toLowerCase().includes('httponly')) {
      throw new Error('Expected HttpOnly flag on cookie!');
    }
    if (!setCookieHeader.toLowerCase().includes('samesite=strict')) {
      throw new Error('Expected SameSite=Strict flag on cookie!');
    }
    console.log('   [PASS] HttpOnly and SameSite=Strict verified!');

    // Extract cookie value
    const match = setCookieHeader.match(/passpractice_session=([^;]+)/);
    const cookieVal = match ? match[1] : null;

    // 2. Test accessing /api/auth/me using ONLY the cookie (NO Authorization header)
    console.log('2. Accessing /api/auth/me using ONLY Cookie header...');
    const meRes = await fetch(`${BASE}/auth/me`, {
      headers: {
        Cookie: `passpractice_session=${cookieVal}`,
      },
    });

    if (meRes.status !== 200) {
      throw new Error(`Expected 200 from /auth/me with cookie, got: ${meRes.status}`);
    }
    const meData = await meRes.json();
    console.log('   Me User:', meData.user.email);
    console.log('   [PASS] Authenticated successfully via HttpOnly cookie!');

    // 3. Test Logout clears cookie
    console.log('3. Testing Logout clears cookie...');
    const logoutRes = await fetch(`${BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: `passpractice_session=${cookieVal}`,
      },
    });
    const logoutSetCookie = logoutRes.headers.get('set-cookie');
    console.log('   Logout Set-Cookie:', logoutSetCookie);
    if (!logoutSetCookie || !logoutSetCookie.includes('passpractice_session=;')) {
      throw new Error('Expected cleared passpractice_session cookie on logout');
    }
    console.log('   [PASS] Cookie cleared on logout!');

    // 4. Test Rate Limiting on /api/auth/login
    console.log('4. Testing Rate Limiting on /api/auth/login (exceeding limit)...');
    let rateLimited = false;
    for (let i = 0; i < 25; i++) {
      const res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'spam@test.com', password: 'wrong' }),
      });
      if (res.status === 429) {
        rateLimited = true;
        console.log(`   [PASS] Rate limit triggered with status 429 at attempt #${i + 1}`);
        break;
      }
    }

    if (!rateLimited) {
      throw new Error('Expected 429 Too Many Requests from rate limiter');
    }

    console.log('✅ ALL COOKIE, RATE LIMITING, AND SECURITY TESTS PASSED!');
  } finally {
    serverProcess.kill();
  }
}

testHardening().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
