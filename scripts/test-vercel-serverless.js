import http from 'node:http';

async function testVercelServerless() {
  console.log('--- Testing Vercel Serverless Function Bridge ---');

  process.env.VERCEL = '1';
  process.env.NODE_ENV = 'production';

  // Import handler dynamically after setting process.env.VERCEL
  const { default: handler } = await import('../api/index.js');

  const server = http.createServer((req, res) => {
    handler(req, res);
  });

  await new Promise((resolve) => server.listen(3009, resolve));
  console.log('Vercel serverless mock server listening on port 3009');

  const BASE = 'http://localhost:3009/api';

  try {
    const timestamp = Date.now();
    const email = `vercel_${timestamp}@example.com`;
    const password = 'Password123!';

    // 1. Test POST /api/auth/register
    console.log('1. Testing POST /api/auth/register through serverless bridge...');
    const regRes = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Vercel User',
        email,
        password,
        confirmPassword: password,
      }),
    });

    console.log('   Status code:', regRes.status);
    if (regRes.status !== 201) {
      const err = await regRes.text();
      throw new Error(`Register failed with status ${regRes.status}: ${err}`);
    }

    const regData = await regRes.json();
    console.log('   User created ID:', regData.user.id);
    console.log('   [PASS] Registration succeeded through serverless bridge!');

    // 2. Test URL without /api prefix (simulating Vercel stripped prefix)
    console.log('2. Testing URL normalization when Vercel strips /api prefix...');
    const noPrefixRes = await fetch('http://localhost:3009/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    console.log('   Status code without /api prefix:', noPrefixRes.status);
    if (noPrefixRes.status !== 200) {
      const err = await noPrefixRes.text();
      throw new Error(`Login without /api failed: ${err}`);
    }
    console.log('   [PASS] URL normalization handles stripped prefix smoothly!');

    console.log('✅ VERCEL SERVERLESS FUNCTION BRIDGE WORKS 100% PERFECTLY!');
  } finally {
    server.close();
  }
}

testVercelServerless().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
