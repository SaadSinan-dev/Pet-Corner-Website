import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChildProcess, spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import { setTimeout } from 'node:timers/promises';

const production = { NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(40), ORDER_TOKEN_SECRET: 'b'.repeat(40), CORS_ORIGINS: 'https://shop.petcorner.store,https://admin.petcorner.store', APP_PUBLIC_URL: 'https://shop.petcorner.store', ADMIN_PUBLIC_URL: 'https://admin.petcorner.store', STORAGE_PROVIDER: 'local', PUBLIC_UPLOAD_BASE_URL: '/uploads', TRUST_PROXY: '1', HOST: '127.0.0.1' };

test('production startup refuses a nonproduction environment before attempting any migrations', () => {
  const result = spawnSync(process.execPath, [resolve('dist/scripts/start-production.js')], { encoding: 'utf8', env: { ...process.env, NODE_ENV: 'development', DATABASE_URL: 'invalid://startup-secret' } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /NODE_ENV must be production/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /startup-secret|Datasource|Prisma schema loaded/);
});

test('a failed migration stops production startup before Nest can listen', () => {
  // Invalid engine-specific pool configuration fails before any database connection.
  const result = spawnSync(process.execPath, [resolve('dist/scripts/start-production.js')], { timeout: 20000, encoding: 'utf8', env: { ...process.env, ...production, DATABASE_URL: 'postgresql://user:unprinted-password@127.0.0.1:1/unavailable_test?connection_limit=invalid', UPLOAD_DIR: resolve('uploads') } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /database migrations did not succeed/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /unprinted-password/);
});

test('production startup deploys migrations and existing upload files survive an API restart', { timeout: 60000 }, async () => {
  const database = process.env.TEST_DATABASE_URL;
  assert.ok(database && new URL(database).pathname.endsWith('_test'), 'Set TEST_DATABASE_URL to a dedicated database ending in _test; this acceptance check never uses DATABASE_URL.');
  const directory = await mkdtemp(resolve(tmpdir(), 'petcorner-startup-'));
  await writeFile(resolve(directory, 'persistent.txt'), 'persisted-upload');
  const portServer = createServer();
  await new Promise<void>(accept => portServer.listen(0, '127.0.0.1', accept));
  const address = portServer.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;
  await new Promise<void>((accept, reject) => portServer.close(error => error ? reject(error) : accept()));
  let child: ChildProcess | undefined;
  let output = '';
  const stop = async () => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const closed = new Promise<void>(accept => child!.once('close', () => accept()));
    child.kill('SIGTERM');
    await closed;
  };
  try {
    for (let restart = 0; restart < 2; restart++) {
      output = '';
      child = spawn(process.execPath, [resolve('dist/scripts/start-production.js')], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...production, DATABASE_URL: database, UPLOAD_DIR: directory, PORT: String(port) } });
      child.stdout?.on('data', chunk => { output += String(chunk); });
      child.stderr?.on('data', chunk => { output += String(chunk); });
      let ready = false;
      for (let attempt = 0; attempt < 150 && child.exitCode === null; attempt++) {
        try { ready = (await fetch(`http://127.0.0.1:${port}/api/v1/health`, { signal: AbortSignal.timeout(500) })).ok; } catch { /* wait for migration and startup */ }
        if (ready) break;
        await setTimeout(100);
      }
      assert.ok(ready, 'Production startup must complete migrations and expose a healthy API on the isolated test database.');
      assert.match(output, /No pending migrations|All migrations have been successfully applied/);
      const upload = await fetch(`http://127.0.0.1:${port}/uploads/persistent.txt`);
      assert.equal(upload.status, 200);
      assert.equal(await upload.text(), 'persisted-upload');
      await stop();
    }
  } finally {
    await stop();
    assert.ok(resolve(directory).startsWith(`${resolve(tmpdir())}${sep}petcorner-startup-`), 'Remove only the temporary upload directory created by this test.');
    await rm(directory, { recursive: true, force: true });
  }
});

test('production startup validates public URLs before attempting migrations and reports safe errors', () => {
  const result = spawnSync(process.execPath, [resolve('dist/scripts/start-production.js')], { encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: 'postgresql://user:startup-secret@db:5432/store', JWT_SECRET: 'a'.repeat(40), ORDER_TOKEN_SECRET: 'b'.repeat(40), CORS_ORIGINS: 'http://localhost:5174', APP_PUBLIC_URL: 'http://localhost:5174', ADMIN_PUBLIC_URL: 'http://localhost:5175', STORAGE_PROVIDER: 'local', UPLOAD_DIR: resolve('uploads'), PUBLIC_UPLOAD_BASE_URL: '/uploads' } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CORS_ORIGINS/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /startup-secret|Datasource|Prisma schema loaded/);
});
