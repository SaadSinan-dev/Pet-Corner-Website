import 'reflect-metadata';
import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { INestApplication } from '@nestjs/common';
import { createApp } from '../src/app';
import { hashPassword } from '../src/auth';
import { transferLegacyUploads } from '../scripts/migrate-uploads';

test('protected cloud upload, product, cart, order, restart and legacy transfer use a local HTTP storage fixture', { timeout: 45000 }, async () => {
  const original = { ...process.env };
  const nativeFetch = globalThis.fetch;
  const database = process.env.TEST_DATABASE_URL;
  assert.ok(database && new URL(database).pathname.endsWith('_test'));
  const objects = new Map<string, Buffer>();
  const secret = 'sb_secret_fixture_server_only_12345678901234567890';
  let writes = 0; let rejectWrites = false;
  const server = createServer(async (req, res) => {
    const path = req.url || '';
    if (['GET', 'HEAD'].includes(req.method || '') && path.startsWith('/storage/v1/object/public/product-images/')) {
      const object = objects.get(path.split('/').pop()!);
      if (!object) { res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ statusCode: '404', error: 'not_found', message: 'Object not found', code: 'NoSuchKey' })); return; }
      res.writeHead(200, { 'Content-Type': 'image/webp' }); res.end(req.method === 'HEAD' ? undefined : object); return;
    }
    if (req.headers.apikey !== secret) { res.writeHead(401).end(); return; }
    const buffers: Buffer[] = []; for await (const chunk of req) buffers.push(Buffer.from(chunk));
    if (req.method === 'POST') {
      writes++; if (rejectWrites) { res.writeHead(503).end(); return; }
      const name = path.split('/').pop()!;
      if (objects.has(name)) { res.writeHead(409).end(); return; }
      objects.set(name, Buffer.concat(buffers)); res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}'); return;
    }
    if (req.method === 'DELETE') { for (const key of JSON.parse(Buffer.concat(buffers).toString()).prefixes) objects.delete(key); res.writeHead(200).end('{}'); return; }
    res.writeHead(404).end();
  });
  await new Promise<void>(accept => server.listen(0, '127.0.0.1', accept));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const endpoint = `http://127.0.0.1:${address.port}`;
  const publicOrigin = 'https://fixture-storage.supabase.co';
  // Synthetic HTTPS public URLs remain valid product input. Only this isolated
  // test transport routes them to its own local HTTP server; no cloud is contacted.
  globalThis.fetch = (input, options) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return nativeFetch(url.startsWith(publicOrigin) ? url.replace(publicOrigin, endpoint) : input, options);
  };
  Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: database, DIRECT_URL: database, STORAGE_PROVIDER: 'supabase', SUPABASE_URL: publicOrigin, SUPABASE_SERVICE_ROLE_KEY: secret, SUPABASE_STORAGE_BUCKET: 'product-images', JWT_SECRET: randomBytes(40).toString('hex'), ORDER_TOKEN_SECRET: randomBytes(40).toString('hex') });
  const db = new PrismaClient(); let app: INestApplication | undefined;
  const directory = await mkdtemp(resolve(tmpdir(), 'petcorner-legacy-transfer-'));
  try {
    const suffix = randomUUID(); const email = `storage-${suffix}@example.invalid`; const password = randomBytes(24).toString('hex');
    await db.admin.create({ data: { email, passwordHash: await hashPassword(password) } });
    const category = await db.category.create({ data: { name: 'Cloud storage fixture', slug: `storage-${suffix}` } });
    app = await createApp(); await app.init();
    const api = () => request(app!.getHttpServer());
    const login = await api().post('/api/v1/auth/login').send({ email, password }); const auth = { Authorization: `Bearer ${login.body.accessToken}` };
    const image = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#103f6b' } }).png().toBuffer();
    assert.equal((await api().post('/api/v1/admin/uploads').attach('file', image, 'image.png')).status, 401); assert.equal(writes, 0);
    assert.equal((await api().post('/api/v1/admin/uploads').set(auth).attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), 'large.png')).status, 413);
    const uploaded = await api().post('/api/v1/admin/uploads').set(auth).attach('file', image, 'image.png');
    assert.equal(uploaded.status, 201); assert.ok(uploaded.body.url.startsWith(`${publicOrigin}/storage/v1/object/public/product-images/`));
    const stored = await fetch(uploaded.body.url); assert.equal(stored.status, 200); assert.equal((await sharp(Buffer.from(await stored.arrayBuffer())).metadata()).format, 'webp');
    const product = await api().post('/api/v1/admin/products').set(auth).send({ name: 'Cloud test', slug: `cloud-${suffix}`, shortDescription: 'fixture', description: 'isolated storage fixture', price: 12500, stock: 3, categoryId: category.id, images: [{ url: uploaded.body.url, alt: 'fixture' }] });
    assert.equal(product.status, 201);
    assert.equal((await api().post('/api/v1/storefront/cart/validate').send({ items: [{ productId: product.body.id, quantity: 1 }] })).body.items[0].product.images[0].url, uploaded.body.url);
    await api().patch('/api/v1/admin/settings').set(auth).send({ codEnabled: true, checkoutEnabled: true, whatsappNumber: '15555550100', deliveryPolicy: 'Isolated test policy' });
    const order = await api().post('/api/v1/storefront/orders').set('Idempotency-Key', randomUUID()).send({ customerName: 'Test customer', phone: '0991234567', governorate: 'دمشق', city: 'دمشق', address: 'Isolated test address', items: [{ productId: product.body.id, quantity: 1 }] });
    assert.equal(order.status, 201); assert.equal(order.body.deliveryFee, null); assert.equal(order.body.total, null);
    const quoted = await api().patch(`/api/v1/admin/orders/${order.body.id}/delivery`).set(auth).send({ deliveryFee: 0 }); assert.equal(quoted.body.total, 12500);
    await app.close(); app = await createApp(); await app.init();
    assert.equal((await api().get(`/api/v1/storefront/products/${product.body.slug}`)).body.images[0].url, uploaded.body.url);
    assert.equal((await fetch(uploaded.body.url)).status, 200);
    await api().delete(`/api/v1/admin/products/${product.body.id}`).set(auth); assert.equal((await fetch(uploaded.body.url)).status, 200);
    const legacy = await sharp(image).webp().toBuffer(); await writeFile(resolve(directory, 'legacy-image.webp'), legacy);
    assert.equal((await transferLegacyUploads(directory)).dryRun, true);
    assert.equal((await transferLegacyUploads(directory, true)).copied, 1);
    assert.equal((await transferLegacyUploads(directory, true)).alreadyIdentical, 1);
    assert.deepEqual(await readFile(resolve(directory, 'legacy-image.webp')), legacy);
    const old = await api().get('/uploads/legacy-image.webp'); assert.equal(old.status, 307); assert.equal((await fetch(`${endpoint}/storage/v1/object/public/product-images/legacy-image.webp`)).status, 200);
    rejectWrites = true; const count = await db.product.count();
    const failed = await api().post('/api/v1/admin/uploads').set(auth).attach('file', image, 'failed.png'); assert.equal(failed.status, 503); assert.equal(failed.body.url, undefined); assert.equal(await db.product.count(), count); assert.ok(!JSON.stringify(failed.body).includes(secret));
  } finally {
    await app?.close(); await db.$disconnect(); await new Promise<void>(accept => server.close(() => accept())); process.env = original; globalThis.fetch = nativeFetch;
    assert.ok(resolve(directory).startsWith(`${resolve(tmpdir())}${sep}petcorner-legacy-transfer-`)); await rm(directory, { recursive: true, force: true });
  }
});
