import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StorageService, SupabaseStorageAdapter } from '../src/storage';
import sharp from 'sharp';

const settings = { url: 'https://petcorner-storage.supabase.co', key: 'server-only-test-secret-123456789012345', bucket: 'product-images' };
test('Supabase adapter uploads immutable WebP then confirms public readability without exposing keys', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const provider = new SupabaseStorageAdapter(settings, async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return init.method === 'HEAD' ? new Response(null, { headers: { 'Content-Type': 'image/webp' } }) : Response.json({ Key: 'ignored' }, { status: 200 });
  });
  const url = await provider.put('test-image.webp', Buffer.from('webp-bytes'));
  assert.equal(url, `${settings.url}/storage/v1/object/public/product-images/test-image.webp`);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(new Headers(calls[0].init.headers).get('apikey'), settings.key);
  assert.equal(new Headers(calls[0].init.headers).get('x-upsert'), 'false');
  assert.equal(new Headers(calls[0].init.headers).get('content-type'), 'image/webp');
  assert.equal(calls[1].init.method, 'HEAD');
  assert.equal(new Headers(calls[1].init.headers).get('apikey'), null);
  assert.ok(calls.every(call => !call.url.includes(settings.key)));
});
test('Supabase refuses failed upload and private/unreadable objects, and cleans only its own completed upload', async () => {
  for (const failedStage of ['POST', 'HEAD']) {
    const methods: string[] = [];
    const provider = new SupabaseStorageAdapter(settings, async (_url, init = {}) => {
      methods.push(init.method!);
      return new Response(null, { status: init.method === failedStage ? 403 : 200, headers: { 'content-type': 'image/webp' } });
    });
    await assert.rejects(() => provider.put('failed-image.webp', Buffer.from('x')));
    assert.equal(methods.includes('DELETE'), failedStage === 'HEAD');
  }
});
test('Supabase adapter rejects path traversal and does not follow redirects with server credentials', async () => {
  let contacted = false;
  const provider = new SupabaseStorageAdapter(settings, async (_url, init) => { contacted = true; assert.equal(init?.redirect, 'error'); throw new Error(settings.key); });
  await assert.rejects(() => provider.put('../other.webp', Buffer.from('x')));
  assert.equal(contacted, false);
  await assert.rejects(() => provider.put('network.webp', Buffer.from('x')));
});
test('storage validation rejects oversized images before any cloud request and never falls back locally', async () => {
  const original = { ...process.env };
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    Object.assign(process.env, { NODE_ENV: 'test', STORAGE_PROVIDER: 'supabase', SUPABASE_URL: settings.url, SUPABASE_SERVICE_ROLE_KEY: settings.key, SUPABASE_STORAGE_BUCKET: settings.bucket });
    globalThis.fetch = async () => { calls++; throw new Error('unavailable'); };
    const storage = new StorageService();
    await assert.rejects(() => storage.upload({ mimetype: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) } as Express.Multer.File));
    await assert.rejects(() => storage.upload({ mimetype: 'image/svg+xml', buffer: Buffer.from('<svg/>') } as Express.Multer.File));
    assert.equal(calls, 0);
    const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).png().toBuffer();
    await assert.rejects(() => storage.upload({ mimetype: 'image/png', buffer: image } as Express.Multer.File), /تعذر حفظ/);
    assert.equal(calls, 1);
    process.env.NODE_ENV = 'production'; process.env.STORAGE_PROVIDER = 'local';
    await assert.rejects(() => storage.upload({ mimetype: 'image/png', buffer: image } as Express.Multer.File), /تعذر حفظ/);
  } finally { process.env = original; globalThis.fetch = originalFetch; }
});
