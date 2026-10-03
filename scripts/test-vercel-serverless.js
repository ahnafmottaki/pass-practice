import http from 'node:http';

async function testVercelServerless() {
  console.log('--- Testing Vercel Serverless Function Bridge with CORS ---');

  process.env.VERCEL = '1';
  process.env.NODE_ENV = 'production';

  const { default: handler } = await import('../api/index.js');

  const server = http.createServer((req, res) => {
    handler(req, res);
  });

  await new Promise((resolve) => server.listen(3009, resolve));
  console.log('Vercel serverless mock server listening on port 3009');

  const BASE = 'http://localhost:3009/api';

  try {
    const timestamp = Date.now();
    const email = `vercel_cors_${timestamp}@example.com`;
    const password = 'Password123!';

    // 1. Test POST /api/auth/register with Origin: https://pass-practice.vercel.app
    console.log('1. Testing POST /api/auth/register with Origin: https://pass-practice.vercel.app...');
    const regRes = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://pass-practice.vercel.app',
      },
      body: JSON.stringify({
        name: 'Vercel User',
        email,
        password,
        confirmPassword: password,
      }),
    });

    console.log('   Status code:', regRes.status);
    console.log('   Access-Control-Allow-Origin:', regRes.headers.get('access-control-allow-origin'));
    console.log('   Access-Control-Allow-Credentials:', regRes.headers.get('access-control-allow-credentials'));

    if (regRes.status !== 201) {
      const err = await regRes.text();
      throw new Error(`Register failed with status ${regRes.status}: ${err}`);
    }

    if (regRes.headers.get('access-control-allow-origin') !== 'https://pass-practice.vercel.app') {
      throw new Error('Expected Access-Control-Allow-Origin to match https://pass-practice.vercel.app');
    }

    const regData = await regRes.json();
    console.log('   User created ID:', regData.user.id);
    console.log('   [PASS] Registration with Vercel origin succeeded!');

    // 2. Test Vercel Preview branch origin: https://pass-practice-b23uuidu-team.vercel.app
    console.log('2. Testing preview branch domain https://pass-practice-b23uuidu.vercel.app...');
    const previewRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://pass-practice-b23uuidu.vercel.app',
      },
      body: JSON.stringify({ email, password }),
    });

    console.log('   Status code:', previewRes.status);
    console.log('   Access-Control-Allow-Origin:', previewRes.headers.get('access-control-allow-origin'));
    if (previewRes.status !== 200) {
      const err = await previewRes.text();
      throw new Error(`Login failed on preview domain: ${err}`);
    }
    console.log('   [PASS] Preview domain origin accepted!');

    console.log('✅ ALL VERCEL CORS AND SERVERLESS TESTS PASSED PERFECTLY!');
  } finally {
    server.close();
  }
}

testVercelServerless().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
