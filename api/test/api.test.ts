import 'reflect-metadata';
import 'dotenv/config';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createApp } from '../src/app';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

let app: INestApplication;
let db: PrismaClient;
let token: string;
let categoryId: string;
let testUploads: string;
const password = randomBytes(24).toString('hex');
const email = 'integration@example.invalid';
before(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Set TEST_DATABASE_URL to a dedicated database whose name ends in _test. Never run this suite on store data.');
  process.env.DATABASE_URL = url;
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
  process.env.ORDER_TOKEN_SECRET = randomBytes(48).toString('hex');
  testUploads = await mkdtemp(resolve(tmpdir(), 'petcorner-integration-uploads-'));
  process.env.UPLOAD_DIR = testUploads;
  db = new PrismaClient();
  await db.orderStatusHistory.deleteMany(); await db.orderItem.deleteMany(); await db.order.deleteMany();
  await db.productImage.deleteMany(); await db.product.deleteMany(); await db.category.deleteMany(); await db.admin.deleteMany(); await db.storeSettings.deleteMany();
  await db.admin.create({ data: { email, passwordHash: await hashPassword(password) } });
  const category = await db.category.create({ data: { name: 'اختبار القطط', slug: 'test-cats' } });
  categoryId = category.id;
  app = await createApp(); await app.init();
  const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password });
  assert.equal(login.status, 201); token = login.body.accessToken as string;
});
after(async () => {
  await app?.close(); await db?.$disconnect();
  if (testUploads && resolve(testUploads).startsWith(`${resolve(tmpdir())}${sep}petcorner-integration-uploads-`)) await rm(testUploads, { recursive: true, force: true });
});
const api = () => request(app.getHttpServer());
const auth = () => ({ Authorization: `Bearer ${token}` });
const productBody = () => ({ name: 'Pet Corner اختبار', slug: `test-${randomUUID()}`, shortDescription: 'وصف للاختبار', description: 'منتج لاختبار قاعدة البيانات الحقيقية', price: 12500, stock: 10, categoryId, images: [{ url: '/images/product-food.svg', alt: 'منتج' }] });
async function product(overrides: Record<string, unknown> = {}) {
  const r = await api().post('/api/v1/admin/products').set(auth()).send({ ...productBody(), ...overrides });
  assert.equal(r.status, 201, JSON.stringify(r.body)); return r.body as { id: string; slug: string; price: number; stock: number; name: string };
}
const checkout = (productId: string, quantity = 1) => ({ customerName: 'عميل الاختبار', phone: '0991234567', regionId: 'test-region', city: 'دمشق', address: 'شارع الاختبار، بناء ١٢', items: [{ productId, quantity }] });
async function enableCheckout() {
  const r = await api().patch('/api/v1/admin/settings').set(auth()).send({ codEnabled: true, checkoutEnabled: true, whatsappNumber: '963991234567', deliveryPolicy: 'تحدد تكلفة التوصيل بعد مراجعة العنوان', deliveryRegions: [{ id: 'test-region', name: 'منطقة الاختبار', fee: 3000 }] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
}

test('admin mutations reject unauthenticated callers', async () => {
  const response = await request(app.getHttpServer()).post('/api/v1/admin/products').send({});
  assert.equal(response.status, 401);
});

test('public settings provide a safe disabled checkout before configuration', async () => {
  const response = await request(app.getHttpServer()).get('/api/v1/storefront/settings');
  assert.equal(response.status, 200);
  assert.equal(response.body.checkoutEnabled, false);
  assert.equal(response.body.demoMode, false);
});

test('login refuses bad passwords and malformed or forged tokens', async () => {
  assert.equal((await api().post('/api/v1/auth/login').send({ email, password: 'incorrect' })).status, 401);
  assert.equal((await api().get('/api/v1/admin/orders').set('Authorization', 'Bearer forged')).status, 401);
  assert.equal((await api().get('/api/v1/admin/orders')).status, 401);
});

test('administrator creates updates and deactivates products; inactive products disappear publicly', async () => {
  const p = await product();
  let r = await api().get(`/api/v1/storefront/products/${p.slug}`);
  assert.equal(r.status, 200); assert.equal(r.body.price, 12500); assert.equal(r.body.images.length, 1);
  r = await api().patch(`/api/v1/admin/products/${p.id}`).set(auth()).send({ price: 15000 });
  assert.equal(r.status, 200); assert.equal(r.body.price, 15000);
  assert.equal((await api().delete(`/api/v1/admin/products/${p.id}`).set(auth())).status, 200);
  assert.equal((await api().get(`/api/v1/storefront/products/${p.slug}`)).status, 404);
  r = await api().post('/api/v1/storefront/cart/validate').send({ items: [{ productId: p.id, quantity: 2 }] });
  assert.equal(r.status, 201); assert.equal(r.body.items[0].product, null);
});

test('DTO validation rejects client prices, zero quantities, malformed images, negative and fractional money', async () => {
  for (const change of [{ price: -1 }, { price: 1.2 }, { stock: -1 }, { unknown: true }, { images: [{ url: 'javascript:alert(1)', alt: 'x' }] }]) {
    assert.equal((await api().post('/api/v1/admin/products').set(auth()).send({ ...productBody(), ...change })).status, 400);
  }
  const p = await product();
  assert.equal((await api().post('/api/v1/storefront/cart/validate').send({ items: [{ productId: p.id, quantity: 0 }] })).status, 400);
  assert.equal((await api().post('/api/v1/storefront/orders').set('Idempotency-Key', randomUUID()).send({ ...checkout(p.id), price: 1 })).status, 400);
  assert.equal((await api().patch('/api/v1/admin/settings').set(auth()).send({ deliveryRegions: null })).status, 400);
});

test('malformed and oversized JSON requests produce safe client errors', async () => {
  assert.equal((await api().post('/api/v1/storefront/cart/validate').set('Content-Type', 'application/json').send('{broken')).status, 400);
  assert.equal((await api().post('/api/v1/storefront/cart/validate').send({ items: [], extra: 'x'.repeat(120000) })).status, 413);
});

test('catalog filters search category stock price and pagination; empty categories remain hidden', async () => {
  const p = await product({ name: 'منتج فريد قابل للبحث', price: 77777, featured: true });
  await product({ name: 'منتج نفد مخزونه', stock: 0, price: 77777 });
  await api().post('/api/v1/admin/categories').set(auth()).send({ name: 'فئة فارغة', slug: `empty-${randomUUID()}` });
  const r = await api().get('/api/v1/storefront/products').query({ search: 'فريد', category: 'test-cats', minPrice: 77000, maxPrice: 78000, inStock: 'true', featured: 'true', sort: 'price-desc', page: 1, limit: 1 });
  assert.equal(r.status, 200); assert.equal(r.body.total, 1); assert.equal(r.body.items[0].id, p.id); assert.equal(r.body.totalPages, 1);
  const cats = await api().get('/api/v1/storefront/categories');
  assert.ok(cats.body.every((c: { productCount: number }) => c.productCount > 0));
  assert.equal((await api().get('/api/v1/storefront/products?inStock=garbage')).status, 400);
});

test('category changes are protected and category deactivation hides its products', async () => {
  const slug = `category-${randomUUID()}`;
  const c = await api().post('/api/v1/admin/categories').set(auth()).send({ name: 'فئة اختبار مستقلة', slug });
  assert.equal(c.status, 201);
  const p = await product({ categoryId: c.body.id });
  assert.equal((await api().get(`/api/v1/storefront/categories/${slug}/products`)).body.total, 1);
  assert.equal((await api().patch(`/api/v1/admin/categories/${c.body.id}`).set(auth()).send({ name: 'اسم الفئة المعدل' })).status, 200);
  assert.equal((await api().delete(`/api/v1/admin/categories/${c.body.id}`).set(auth())).status, 200);
  assert.equal((await api().get(`/api/v1/storefront/products/${p.slug}`)).status, 404);
  assert.equal((await api().get(`/api/v1/admin/categories/${c.body.id}`).set(auth())).body.active, false);
});

test('checkout remains disabled until delivery policy is configured', async () => {
  const p = await product();
  assert.equal((await api().post('/api/v1/storefront/orders').set('Idempotency-Key', randomUUID()).send(checkout(p.id))).status, 503);
  assert.equal((await api().patch('/api/v1/admin/settings').set(auth()).send({ checkoutEnabled: true })).status, 400);
  await enableCheckout();
  await db.storeSettings.update({ where: { id: 'store' }, data: { whatsappNumber: null } });
  try {
    assert.equal((await api().get('/api/v1/storefront/settings')).body.checkoutEnabled, false);
    assert.equal((await api().post('/api/v1/storefront/orders').set('Idempotency-Key', randomUUID()).send(checkout(p.id))).status, 503);
  } finally { await enableCheckout(); }
});

test('orders calculate server prices, persist immutable item snapshots, protect receipt access and replay safely', async () => {
  const p = await product({ stock: 8 });
  const key = randomUUID(); const body = checkout(p.id, 2);
  const r = await api().post('/api/v1/storefront/orders').set('Idempotency-Key', key).send(body);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.subtotal, 25000); assert.equal(r.body.deliveryFee, null); assert.equal(r.body.total, null);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock, 6);
  await api().patch(`/api/v1/admin/products/${p.id}`).set(auth()).send({ name: 'اسم جديد', price: 50000 });
  assert.equal((await api().get(`/api/v1/storefront/orders/${r.body.orderCode}`)).status, 401);
  assert.equal((await api().get(`/api/v1/storefront/orders/${r.body.orderCode}`).set('X-Order-Token', 'wrong')).status, 401);
  const receipt = await api().get(`/api/v1/storefront/orders/${r.body.orderCode}`).set('X-Order-Token', r.body.accessToken);
  assert.equal(receipt.status, 200); assert.equal(receipt.body.items[0].name, p.name); assert.equal(receipt.body.items[0].price, 12500);
  assert.equal(receipt.headers['cache-control'], 'no-store');
  const replay = await api().post('/api/v1/storefront/orders').set('Idempotency-Key', key).send(body);
  assert.equal(replay.status, 201); assert.equal(replay.body.id, r.body.id); assert.equal(replay.body.accessToken, r.body.accessToken);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock, 6);
  assert.equal((await api().post('/api/v1/storefront/orders').set('Idempotency-Key', key).send(checkout(p.id, 1))).status, 409);
  const detail = await api().get(`/api/v1/admin/orders/${r.body.id}`).set(auth());
  assert.equal(detail.status, 200); assert.equal(detail.body.history.length, 1);
});

test('concurrent orders cannot oversell a single unit', async () => {
  const p = await product({ stock: 1 });
  const responses = await Promise.all(Array.from({ length: 8 }, () => api().post('/api/v1/storefront/orders').set('Idempotency-Key', randomUUID()).send(checkout(p.id))));
  assert.equal(responses.filter(r => r.status === 201).length, 1, JSON.stringify(responses.map(r => r.status)));
  assert.equal(responses.filter(r => r.status === 409).length, 7);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock, 0);
});

test('concurrent duplicate submissions create exactly one order and one stock decrement', async () => {
  const p = await product({ stock: 20 }); const key = randomUUID();
  const responses = await Promise.all(Array.from({ length: 5 }, () => api().post('/api/v1/storefront/orders').set('Idempotency-Key', key).send(checkout(p.id, 3))));
  assert.ok(responses.every(r => r.status === 201), JSON.stringify(responses.map(r => r.status)));
  assert.equal(new Set(responses.map(r => r.body.id as string)).size, 1);
  assert.equal(await db.order.count({ where: { idempotencyKey: key } }), 1);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock, 17);
});

test('invalid region product stock and empty cart reject orders without changing inventory', async () => {
  const p = await product({ stock: 3 });
  for (const body of [checkout(randomUUID()), checkout(p.id, 4), { ...checkout(p.id), regionId: 'missing' }, { ...checkout(p.id), items: [] }]) {
    const r = await api().post('/api/v1/storefront/orders').set('Idempotency-Key', randomUUID()).send(body);
    assert.ok([400, 409].includes(r.status), JSON.stringify(r.body));
  }
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock, 3);
});

test('definite inventory rejection has a machine code, creates no order and allows a corrected request', async () => {
  const p = await product({ stock: 1 });
  const rejectedKey = randomUUID();
  const rejected = await api().post('/api/v1/storefront/orders').set('Idempotency-Key', rejectedKey).send(checkout(p.id, 2));
  assert.equal(rejected.status, 409);
  assert.equal(rejected.body.code, 'OUT_OF_STOCK');
  assert.equal(await db.order.count({ where: { idempotencyKey: rejectedKey } }), 0);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock, 1);
  const corrected = await api().post('/api/v1/storefront/orders').set('Idempotency-Key', randomUUID()).send(checkout(p.id, 1));
  assert.equal(corrected.status, 201);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock, 0);
});

test('multi-item failures roll back earlier stock updates', async () => {
  const pair = [await product(), await product()].sort((a, b) => a.id.localeCompare(b.id));
  const p = pair[0]; const bad = pair[1];
  await db.product.update({ where: { id: p.id }, data: { stock: 5 } });
  await db.product.update({ where: { id: bad.id }, data: { stock: 0 } });
  const body = { ...checkout(p.id, 2), items: [{ productId: p.id, quantity: 2 }, { productId: bad.id, quantity: 1 }] };
  assert.equal((await api().post('/api/v1/storefront/orders').set('Idempotency-Key', randomUUID()).send(body)).status, 409);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock, 5);
});

test('status transitions reject skips and cancellation restores stock once even concurrently', async () => {
  const p = await product({ stock: 10 });
  const r = await api().post('/api/v1/storefront/orders').set('Idempotency-Key', randomUUID()).send(checkout(p.id, 3));
  const path = `/api/v1/admin/orders/${r.body.id}/status`;
  assert.equal((await api().patch(path).set(auth()).send({ status: 'DELIVERED' })).status, 409);
  assert.equal((await api().patch(path).set(auth()).send({ status: 'CONFIRMED' })).status, 200);
  const results = await Promise.all(Array.from({ length: 4 }, () => api().patch(path).set(auth()).send({ status: 'CANCELLED' })));
  assert.ok(results.every(x => x.status === 200), JSON.stringify(results.map(x => x.status)));
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock, 10);
  assert.equal((await api().patch(path).set(auth()).send({ status: 'CONFIRMED' })).status, 409);
  assert.equal(await db.orderStatusHistory.count({ where: { orderId: r.body.id, status: 'CANCELLED' } }), 1);
});

test('dispatched orders cannot cancel and follow the complete fulfillment chain', async () => {
  const p = await product({ stock: 4 });
  const r = await api().post('/api/v1/storefront/orders').set('Idempotency-Key', randomUUID()).send(checkout(p.id));
  const path = `/api/v1/admin/orders/${r.body.id}/status`;
  assert.equal((await api().patch(`/api/v1/admin/orders/${r.body.id}/delivery`).set(auth()).send({ deliveryFee: 3000 })).status, 200);
  for (const status of ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY']) assert.equal((await api().patch(path).set(auth()).send({ status })).status, 200);
  assert.equal((await api().patch(path).set(auth()).send({ status: 'CANCELLED' })).status, 409);
  assert.equal((await api().patch(path).set(auth()).send({ status: 'DELIVERED' })).status, 200);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock, 3);
});

test('upload validates decoded images and stores a generated sanitized webp file', async () => {
  assert.equal((await api().post('/api/v1/admin/uploads').attach('file', Buffer.from('<svg onload="alert(1)"/>'), { filename: 'fake.png', contentType: 'image/png' })).status, 401);
  assert.equal((await api().post('/api/v1/admin/uploads').set(auth()).attach('file', Buffer.from('not a picture'), { filename: 'fake.png', contentType: 'image/png' })).status, 400);
  const buffer = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#103f6b' } }).png().toBuffer();
  const r = await api().post('/api/v1/admin/uploads').set(auth()).attach('file', buffer, { filename: '../../unsafe.png', contentType: 'image/png' });
  assert.equal(r.status, 201, JSON.stringify(r.body)); assert.match(r.body.url as string, /^\/uploads\/[a-f0-9-]+\.webp$/);
  const image = await api().get(r.body.url as string); assert.equal(image.status, 200); assert.equal(image.headers['x-content-type-options'], 'nosniff');
});

test('Swagger documents protected and public endpoints', async () => {
  const r = await api().get('/api/docs-json');
  assert.equal(r.status, 200); assert.ok(r.body.paths['/api/v1/admin/products']); assert.ok(r.body.paths['/api/v1/storefront/orders']);
  assert.ok(r.body.paths['/api/v1/health']); assert.ok(r.body.paths['/api/v1/auth/me'].get.security);
  assert.ok(r.body.paths['/api/v1/admin/orders/{id}/delivery']);
  assert.equal(r.body.components.schemas.OrderReceipt.properties.total.nullable, true);
  assert.equal(r.body.components.schemas.OrderReceipt.properties.deliveryFee.nullable, true);
  assert.ok(r.body.components.schemas.SettingsDto.properties.heroTitle);
  assert.ok(r.body.components.schemas.DeliveryDto.properties.deliveryFee);
});

test('failed image persistence returns a safe error and never reports upload success', async () => {
  const original = process.env.UPLOAD_DIR;
  const blocked = resolve(testUploads, `upload-blocked-${randomUUID()}`);
  await writeFile(blocked, 'fixture');
  const buffer = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ffffff' } }).png().toBuffer();
  try {
    process.env.UPLOAD_DIR = blocked;
    const r = await api().post('/api/v1/admin/uploads').set(auth()).attach('file', buffer, { filename: 'test.png', contentType: 'image/png' });
    assert.equal(r.status, 503); assert.ok(!r.body.url); assert.ok(!JSON.stringify(r.body).includes(blocked));
  } finally { if (original === undefined) delete process.env.UPLOAD_DIR; else process.env.UPLOAD_DIR = original; await unlink(blocked); }
});

test('disabling an administrator immediately revokes an existing bearer token', async () => {
  await db.admin.update({ where: { email }, data: { active: false } });
  try { assert.equal((await api().get('/api/v1/admin/orders').set(auth())).status, 401); }
  finally { await db.admin.update({ where: { email }, data: { active: true } }); }
});

test('PostgreSQL constraints independently prevent negative inventory and money', async () => {
  const p = await product();
  await assert.rejects(db.product.update({ where: { id: p.id }, data: { stock: -1 } }));
  await assert.rejects(db.product.update({ where: { id: p.id }, data: { price: -1 } }));
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock, 10);
});

test('governorate checkout starts unquoted and only protected delivery quote enables dispatch', async () => {
  const p = await product();
  const { regionId: _legacy, ...body } = checkout(p.id);
  const r = await api().post('/api/v1/storefront/orders').set('Idempotency-Key', randomUUID()).send({ ...body, governorate: 'دمشق' });
  assert.equal(r.status, 201, JSON.stringify(r.body)); assert.equal(r.body.governorate, 'دمشق');
  assert.equal(r.body.deliveryFee, null); assert.equal(r.body.total, null);
  const path = `/api/v1/admin/orders/${r.body.id}`;
  assert.equal((await api().patch(`${path}/delivery`).send({ deliveryFee: 5000 })).status, 401);
  for (const status of ['CONFIRMED', 'PREPARING']) assert.equal((await api().patch(`${path}/status`).set(auth()).send({ status })).status, 200);
  assert.equal((await api().patch(`${path}/status`).set(auth()).send({ status: 'OUT_FOR_DELIVERY' })).status, 409);
  for (const deliveryFee of [-1, 1.5, null, '100']) assert.equal((await api().patch(`${path}/delivery`).set(auth()).send({ deliveryFee })).status, 400);
  const quoted = await api().patch(`${path}/delivery`).set(auth()).send({ deliveryFee: 5000 });
  assert.equal(quoted.status, 200); assert.equal(quoted.body.total, p.price + 5000);
  assert.equal((await api().patch(`${path}/delivery`).set(auth()).send({ deliveryFee: 0 })).body.total, p.price);
  const detail = await api().get(path).set(auth()); assert.equal(detail.body.deliveryHistory.length, 2);
  assert.equal((await api().patch(`${path}/status`).set(auth()).send({ status: 'OUT_FOR_DELIVERY' })).status, 200);
  assert.equal((await api().patch(`${path}/delivery`).set(auth()).send({ deliveryFee: 1000 })).status, 409);
});

test('admin identity readiness order search settings content and ordering are real', async () => {
  assert.equal((await api().get('/api/v1/auth/me')).status, 401);
  const identity = await api().get('/api/v1/auth/me').set(auth()); assert.equal(identity.status, 200); assert.equal(identity.body.email, email);
  assert.equal((await api().get('/api/v1/health')).body.status, 'ok');
  const settings = { whatsappNumber: '963991234567', socialLinks: [{ label: 'المتجر', url: 'https://example.com' }], heroEyebrow: 'كل يوم', heroTitle: 'أصدقاء البيت', heroDescription: 'رعاية لأصدقائك', heroButtonText: 'تسوق الآن', heroImageUrl: null, footerText: 'رعاية بكل حب', checkoutMessage: 'سنؤكد التوصيل عبر واتساب', deliveryPolicy: 'يحدد التوصيل بعد المراجعة' };
  const saved = await api().patch('/api/v1/admin/settings').set(auth()).send(settings); assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const publicSettings = await api().get('/api/v1/storefront/settings');
  for (const [key, value] of Object.entries(settings)) assert.deepEqual(publicSettings.body[key], value);
  assert.equal((await api().patch('/api/v1/admin/settings').set(auth()).send({ socialLinks: [{ label: 'x', url: 'javascript:alert(1)' }] })).status, 400);
  const p = await product({ position: 20, images: [{ url: '/images/second.svg', alt: 'الثانية' }, { url: '/images/first.svg', alt: 'الأولى' }] });
  assert.equal((await api().get(`/api/v1/storefront/products/${p.slug}`)).body.images[0].url, '/images/second.svg');
  const order = await api().post('/api/v1/storefront/orders').set('Idempotency-Key', randomUUID()).send(checkout(p.id));
  const found = await api().get('/api/v1/admin/orders').set(auth()).query({ search: order.body.orderCode, page: 1, limit: 1 });
  assert.equal(found.status, 200); assert.equal(found.body.total, 1); assert.equal(found.body.items[0].id, order.body.id);
});

test('legacy pre-upgrade idempotency payloads replay even after checkout is disabled', async () => {
  const p = await product(); const key = randomUUID(); const body = checkout(p.id);
  const normalized = { customerName: body.customerName, phone: body.phone, regionId: body.regionId, city: body.city, address: body.address, notes: null, items: body.items };
  const payloadHash = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  const historical = await db.order.create({ data: { orderCode: `PC-LEGACY-${randomUUID()}`, idempotencyKey: key, payloadHash, customerName: body.customerName, phone: body.phone, regionId: body.regionId, regionName: 'منطقة قديمة', governorate: 'منطقة قديمة', city: body.city, address: body.address, subtotal: p.price, deliveryFee: 3000, total: p.price + 3000, currency: 'SYP', items: { create: { productId: p.id, name: p.name, price: p.price, quantity: 1 } } } });
  await db.storeSettings.update({ where: { id: 'store' }, data: { checkoutEnabled: false } });
  try {
    const replay = await api().post('/api/v1/storefront/orders').set('Idempotency-Key', key).send(body);
    assert.equal(replay.status, 201); assert.equal(replay.body.id, historical.id); assert.equal(replay.body.total, p.price + 3000);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock, 10);
  } finally { await db.storeSettings.update({ where: { id: 'store' }, data: { checkoutEnabled: true } }); }
});

test('production excludes explicitly marked demo catalog from search detail cart and new orders', async () => {
  const p = await product(); await db.product.update({ where: { id: p.id }, data: { isDemo: true } });
  const env = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
  try {
    assert.equal((await api().get('/api/v1/storefront/products').query({ search: p.slug })).body.total, 0);
    assert.equal((await api().get(`/api/v1/storefront/products/${p.slug}`)).status, 404);
    assert.equal((await api().post('/api/v1/storefront/cart/validate').send({ items: [{ productId: p.id, quantity: 1 }] })).body.items[0].product, null);
    assert.equal((await api().post('/api/v1/storefront/orders').set('Idempotency-Key', randomUUID()).send(checkout(p.id))).status, 400);
    assert.equal((await api().get(`/api/v1/admin/products/${p.id}`).set(auth())).status, 200);
    await db.storeSettings.update({ where: { id: 'store' }, data: { demoMode: true } });
    assert.equal((await api().get('/api/v1/storefront/settings')).body.checkoutEnabled, false);
  } finally { if (env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = env; await db.storeSettings.update({ where: { id: 'store' }, data: { demoMode: false } }); }
});

test('database rejects partial quotes and quote changes are serialized and audited', async () => {
  const p = await product(); const created = await api().post('/api/v1/storefront/orders').set('Idempotency-Key', randomUUID()).send(checkout(p.id));
  const id = created.body.id as string;
  await assert.rejects(db.order.update({ where: { id }, data: { deliveryFee: 100 } }));
  await assert.rejects(db.order.update({ where: { id }, data: { total: p.price } }));
  const responses = await Promise.all([1000, 2000, 3000].map(deliveryFee => api().patch(`/api/v1/admin/orders/${id}/delivery`).set(auth()).send({ deliveryFee })));
  assert.ok(responses.every(r => r.status === 200));
  const saved = await db.order.findUniqueOrThrow({ where: { id } }); assert.equal(saved.total, saved.subtotal + saved.deliveryFee!);
  assert.equal(await db.orderDeliveryHistory.count({ where: { orderId: id } }), 3);
});
