import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const PORT = 4293;
const base = `http://127.0.0.1:${PORT}`;
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    PORT: String(PORT),
    BROKER_API_DISABLED: 'true',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

try {
  await waitForServer();

  const health = await getJson('/api/health');
  assert.equal(health.ok, true);

  const columns = await getJson('/api/columns');
  assert.equal(columns.ok, true);
  assert.ok(columns.data.some(c => c.columnCode === 'SEC0004'));

  const comment = await getJson('/api/comment?columnCode=SEC0004');
  assert.equal(comment.ok, true);
  assert.match(comment.data.title, /盘中解读/);
  assert.ok(comment.data.paragraphs.length >= 4);

  const analysis = await getJson('/api/analyze?columnCode=SEC0004');
  assert.equal(analysis.ok, true);
  assert.ok(analysis.topics.length >= 3);
  assert.ok(analysis.topics[0].banner.title);
  assert.ok(analysis.topics[0].article.includes('风险提示'));
  assert.ok(analysis.topics.some(t => t.title.includes('机器人')));

  const html = await getText('/');
  assert.match(html, /券商评论热点生成 MVP/);

  console.log('smoke test passed');
} finally {
  server.kill('SIGTERM');
}

async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < 8000) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw new Error('server did not start');
}

async function getText(pathname) {
  const res = await fetch(`${base}${pathname}`);
  assert.equal(res.ok, true, pathname);
  return res.text();
}

async function getJson(pathname) {
  return JSON.parse(await getText(pathname));
}
