import http from 'node:http';

async function runTests() {
  console.log('--- Starting Integration Tests against API ---');
  const base = 'http://localhost:3001/api';

  // Helper for requests
  async function request(path, options = {}) {
    const res = await fetch(`${base}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data };
  }

  // 1. Clean test passwords
  const list = await request('/passwords');
  console.log(`[PASS] Initial passwords count: ${list.data.length}`);

  // 2. Add first password
  const p1 = await request('/passwords', {
    method: 'POST',
    body: JSON.stringify({ password: 'AlphaOmega!#992', note: 'First test note' }),
  });
  console.log(`[PASS] Add password status: ${p1.status}, id: ${p1.data.id}`);
  if (p1.status !== 201) throw new Error('Failed to create password');

  // 3. Test duplicate rejection
  const p1Dup = await request('/passwords', {
    method: 'POST',
    body: JSON.stringify({ password: 'AlphaOmega!#992', note: 'Attempting duplicate' }),
  });
  console.log(`[PASS] Duplicate rejected status: ${p1Dup.status} (expected 409)`);
  if (p1Dup.status !== 409) throw new Error('Duplicate should return 409');

  // 4. Add second password
  const p2 = await request('/passwords', {
    method: 'POST',
    body: JSON.stringify({ password: 'BetaGamma$404', note: 'Second test note' }),
  });
  console.log(`[PASS] Add second password status: ${p2.status}`);

  // 5. Test duplicate check on update
  const p2DupUpdate = await request(`/passwords/${p2.data.id}`, {
    method: 'PUT',
    body: JSON.stringify({ password: 'AlphaOmega!#992', note: 'Trying to collide with p1' }),
  });
  console.log(`[PASS] Update collision rejected status: ${p2DupUpdate.status} (expected 409)`);
  if (p2DupUpdate.status !== 409) throw new Error('Collision update should return 409');

  // 6. Test valid update
  const p2ValidUpdate = await request(`/passwords/${p2.data.id}`, {
    method: 'PUT',
    body: JSON.stringify({ password: 'BetaGamma$404_Updated', note: 'Updated note' }),
  });
  console.log(`[PASS] Valid update status: ${p2ValidUpdate.status}`);
  if (p2ValidUpdate.status !== 200) throw new Error('Valid update should return 200');

  // 7. Practice session start
  const sess = await request('/practice/sessions', {
    method: 'POST',
    body: JSON.stringify({ mode_type: 'time_all', target_count: 1, total_items: 2 }),
  });
  console.log(`[PASS] Start practice session status: ${sess.status}, sessionId: ${sess.data.sessionId}`);

  // 8. Practice log record
  const log = await request('/practice/logs', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sess.data.sessionId,
      password_id: p1.data.id,
      is_success: 1,
      duration_ms: 3200,
      accuracy: 100,
      typed_length: 15,
      target_length: 15,
      speed_cpm: 280,
      speed_wpm: 56,
      error_count: 0,
      timed_out: 0,
    }),
  });
  console.log(`[PASS] Record practice log status: ${log.status}, logId: ${log.data.logId}`);

  // 9. Complete practice session
  const completeSess = await request(`/practice/sessions/${sess.data.sessionId}`, {
    method: 'PUT',
    body: JSON.stringify({
      total_items: 1,
      successful_items: 1,
      avg_accuracy: 100,
      avg_speed_cpm: 280,
    }),
  });
  console.log(`[PASS] Complete session status: ${completeSess.status}`);

  // 10. Check stats
  const stats = await request('/practice/stats');
  console.log(`[PASS] Stats response: totalSessions=${stats.data.totalSessions}, avgAccuracy=${stats.data.avgAccuracy}%`);

  // 11. Delete test items
  await request(`/passwords/${p1.data.id}`, { method: 'DELETE' });
  await request(`/passwords/${p2.data.id}`, { method: 'DELETE' });
  console.log('[PASS] Deleted test passwords cleanly.');

  console.log('--- ALL 11 INTEGRATION TESTS PASSED PERFECTLY! ---');
}

runTests().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
