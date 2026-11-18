import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fetchWithRecovery } from '../src/lib/api-recovery.ts';
import { createApiTransport } from '../src/lib/api-response.ts';
const options = (fetcher) => ({ fetcher, wait: async () => {} });

test('a provider 429 pauses all API calls until Retry-After and never replays the blocked write', async () => {
  let now = 100000, calls = 0;
  const transport = createApiTransport((url, init, control) => fetchWithRecovery(url, init, { ...control, ...options(async () => {
    calls++;
    return calls === 1 ? new Response('<html>challenge</html>', { status: 429, headers: { 'Content-Type': 'text/html', 'Retry-After': '60' } }) : Response.json({ ok: true });
  }) }), () => now);
  await assert.rejects(transport('https://fixture.test/api/csrf'), { code: 'UPSTREAM_RATE_LIMITED' });
  now += 10000;
  await assert.rejects(transport('https://fixture.test/api/session', { method: 'POST' }), (error) => error.retryAfterSeconds === 50);
  await assert.rejects(transport('https://fixture.test/api/state'), { status: 429 });
  assert.equal(calls, 1);
  now += 50000;
  assert.equal((await transport('https://fixture.test/api/state')).status, 200);
  assert.equal(calls, 2);
});

test('a pending gateway retry stops when a parallel request establishes a cooldown', async () => {
  let release, waiting;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { waiting = resolve; });
  const sends = [];
  const transport = createApiTransport((url, init, control) => fetchWithRecovery(url, init, {
    ...control,
    fetcher: async (url) => {
      sends.push(url);
      return new Response('temporary', { status: url.endsWith('/a') ? 502 : 429, headers: { 'Retry-After': '60' } });
    },
    wait: async () => { waiting(); await gate; },
  }));
  const pending = transport('https://fixture.test/api/a');
  await started;
  await assert.rejects(transport('https://fixture.test/api/b'), { status: 429 });
  release();
  await assert.rejects(pending, { status: 429 });
  assert.deepEqual(sends, ['https://fixture.test/api/a', 'https://fixture.test/api/b']);
});

test('a late short Retry-After cannot shorten a longer active cooldown; logout can terminate its session', async () => {
  let now = 100000, release, calls = 0;
  const delayed = new Promise(resolve => { release = resolve; });
  const transport = createApiTransport(async (url) => {
    calls++;
    if (url.endsWith('/slow')) await delayed;
    if (url.endsWith('/logout') || url.endsWith('/csrf')) return Response.json({ ok: true });
    return new Response('limited', { status: 429, headers: { 'Retry-After': url.endsWith('/slow') ? '1' : '60' } });
  }, () => now);
  const slow = transport('https://fixture.test/api/slow');
  await assert.rejects(transport('https://fixture.test/api/fast'), { retryAfterSeconds: 60 });
  release();
  await assert.rejects(slow, { retryAfterSeconds: 60 });
  now += 2000;
  await assert.rejects(transport('https://fixture.test/api/state'), { retryAfterSeconds: 58 });
  assert.equal(calls, 2);
  await assert.rejects(transport('https://fixture.test/api/csrf'), { status: 429 });
  await assert.rejects(transport('https://fixture.test/api/bookings', { method: 'POST' }, { forSignOut: true }), { status: 429 });
  assert.equal((await transport('https://fixture.test/api/csrf', {}, { forSignOut: true })).status, 200);
  assert.equal((await transport('https://fixture.test/api/logout', { method: 'POST' })).status, 200);
  assert.equal(calls, 4);
});

test('cold-start HTML 502 and 504 recover before parsing the successful GET', async () => {
  let calls = 0;
  const response = await fetchWithRecovery('https://fixture.test/api/csrf', {}, options(async () => {
    calls++;
    return calls < 3 ? new Response('<!DOCTYPE html>', { status: calls === 1 ? 502 : 504 }) : Response.json({ token: 'fixture' });
  }));
  assert.equal(calls, 3);
  assert.deepEqual(await response.json(), { token: 'fixture' });
});

test('booking, payment and session mutations are never automatically replayed', async () => {
  for (const method of ['POST', 'PATCH', 'DELETE']) {
    let calls = 0;
    const r = await fetchWithRecovery('https://fixture.test/api/bookings', { method }, options(async () => {
      calls++;
      return new Response('unavailable', { status: 502 });
    }));
    assert.equal(r.status, 502);
    assert.equal(calls, 1);
  }
});

test('authentication, validation and rate-limit failures are not retried', async () => {
  for (const status of [400, 401, 403, 409, 429]) {
    let calls = 0;
    const r = await fetchWithRecovery('https://fixture.test/api/state', {}, options(async () => {
      calls++;
      return Response.json({ code: 'fixture' }, { status });
    }));
    assert.equal(r.status, status);
    assert.equal(calls, 1);
  }
});

test('persistent outage is bounded to four attempts', async () => {
  let calls = 0;
  const r = await fetchWithRecovery('https://fixture.test/api/public', {}, options(async () => {
    calls++;
    return new Response('unavailable', { status: 503 });
  }));
  assert.equal(r.status, 503);
  assert.equal(calls, 4);
});

test('temporary network failure can recover; explicit cancellation does not retry', async () => {
  let calls = 0;
  const r = await fetchWithRecovery('https://fixture.test/api/state', {}, options(async () => {
    if (++calls === 1) throw new TypeError('Network request failed');
    return Response.json({ ok: true });
  }));
  assert.equal(calls, 2);
  assert.equal(r.status, 200);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchWithRecovery('https://fixture.test/api/state', { signal: controller.signal }, options(async () => {
    throw new Error('must not send an aborted request');
  })), { name: 'AbortError' });
});

test('a timed-out cold-start GET retries with a fresh request signal', async () => {
  let calls = 0;
  const r = await fetchWithRecovery('https://fixture.test/api/csrf', {}, {
    ...options(async (_url, init) => {
      if (++calls === 1) return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError'))));
      assert.equal(init.signal.aborted, false);
      return Response.json({ token: 'ready' });
    }),
    attemptTimeoutMs: 5,
  });
  assert.equal(r.status, 200);
  assert.equal(calls, 2);
});

test('response bodies stay inside the timeout; a hanging mutation body is not replayed', async () => {
  let reads = 0, writes = 0;
  const server = createServer((req, res) => {
    const count = req.method === 'GET' ? ++reads : ++writes;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (count === 1) res.write('{"unfinished":');
    else res.end('{"ready":true}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  try {
    const r = await fetchWithRecovery(url, {}, { attemptTimeoutMs: 100, wait: async () => {} });
    assert.deepEqual(await r.json(), { ready: true });
    assert.equal(reads, 2);
    await assert.rejects(fetchWithRecovery(url, { method: 'POST' }, { attemptTimeoutMs: 100 }), { name: 'AbortError' });
    assert.equal(writes, 1);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
