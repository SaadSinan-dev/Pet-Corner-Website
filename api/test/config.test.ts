import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from '../src/config';

const keys = ['JWT_SECRET', 'ORDER_TOKEN_SECRET', 'DATABASE_URL', 'NODE_ENV', 'PORT', 'CORS_ORIGINS', 'APP_PUBLIC_URL', 'ADMIN_PUBLIC_URL', 'STORAGE_PROVIDER', 'UPLOAD_DIR', 'PUBLIC_UPLOAD_BASE_URL', 'TRUST_PROXY', 'DIRECT_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET'];
const development = { JWT_SECRET: 'a'.repeat(40), ORDER_TOKEN_SECRET: 'b'.repeat(40), DATABASE_URL: 'postgresql://user:password@localhost:5432/store', NODE_ENV: 'development' };
const production = { ...development, NODE_ENV: 'production', DATABASE_URL: 'postgresql://user:password@db:5432/store?schema=public', CORS_ORIGINS: 'https://shop.petcorner.store,https://admin.petcorner.store', APP_PUBLIC_URL: 'https://shop.petcorner.store', ADMIN_PUBLIC_URL: 'https://admin.petcorner.store', DIRECT_URL: 'postgresql://user:password@db:5432/store?schema=public', STORAGE_PROVIDER: 'supabase', SUPABASE_URL: 'https://petcorner-storage.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_12345678901234567890123456789012', SUPABASE_STORAGE_BUCKET: 'product-images' };

function configured<T>(values: Record<string, string | undefined>, check: () => T): T {
  const original = { ...process.env };
  try {
    for (const key of keys) delete process.env[key];
    for (const [key, value] of Object.entries(values)) if (value !== undefined) process.env[key] = value;
    return check();
  } finally { process.env = original; }
}

test('development permits localhost defaults and same-origin upload paths', () => {
  configured(development, () => assert.ok(validateConfig().origins.includes('http://localhost:5175')));
});

test('startup rejects invalid secrets database ports exact origins and providers', () => {
  for (const patch of [{ JWT_SECRET: 'short' }, { DATABASE_URL: 'sqlite://local' }, { PORT: 'NaN' }, { PORT: '65536' }, { CORS_ORIGINS: '*' }, { CORS_ORIGINS: 'http://localhost:5173/path' }, { CORS_ORIGINS: '' }, { NODE_ENV: 'staging' }, { STORAGE_PROVIDER: 'fake' }, { PUBLIC_UPLOAD_BASE_URL: 'http://unsafe.petcorner.store/uploads' }]) {
    configured({ ...development, ...patch }, () => assert.throws(validateConfig));
  }
});

test('production requires Supabase cloud settings, migration connection and exact application origins', () => {
  for (const key of ['CORS_ORIGINS', 'APP_PUBLIC_URL', 'ADMIN_PUBLIC_URL', 'STORAGE_PROVIDER', 'DIRECT_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET']) {
    configured({ ...production, [key]: undefined }, () => assert.throws(validateConfig, new RegExp(key)));
  }
  configured({ ...production, STORAGE_PROVIDER: 'local' }, () => assert.throws(validateConfig, /supabase/));
  configured({ ...production, APP_PUBLIC_URL: 'https://shop.petcorner.store/catalog' }, () => assert.throws(validateConfig, /APP_PUBLIC_URL/));
  configured({ ...production, ADMIN_PUBLIC_URL: 'https://unlisted.petcorner.store' }, () => assert.throws(validateConfig, /ADMIN_PUBLIC_URL/));
  configured(production, () => assert.equal(validateConfig().origins.length, 2));
  configured({ ...production, SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_public-key' }, () => assert.throws(validateConfig, /SUPABASE_SERVICE_ROLE_KEY/));
  configured({ ...production, SUPABASE_STORAGE_BUCKET: '../other' }, () => assert.throws(validateConfig, /SUPABASE_STORAGE_BUCKET/));
});

test('production refuses insecure local wildcard private and placeholder public deployment URLs', () => {
  const origins = ['http://shop.petcorner.store', 'https://localhost', 'https://shop.localhost', 'https://localhost.', 'https://127.0.0.2', 'https://2130706433', 'https://[::1]', 'https://[::ffff:127.0.0.1]', 'https://0.0.0.0', 'https://[::]', 'https://10.0.0.8', 'https://192.168.1.8', 'https://*.petcorner.store', 'https://shop.example.com', 'https://shop.example', 'https://your-api.onrender.com', 'https://shop.invalid'];
  for (const origin of origins) {
    configured({ ...production, CORS_ORIGINS: `${origin},https://admin.petcorner.store`, APP_PUBLIC_URL: origin }, () => assert.throws(validateConfig, /CORS_ORIGINS|APP_PUBLIC_URL/, origin));
    configured({ ...production, SUPABASE_URL: origin }, () => assert.throws(validateConfig, /SUPABASE_URL/, origin));
  }
  for (const url of ['https://petcorner-storage.supabase.co/images', 'https://petcorner-storage.supabase.co/?token=secret', 'https://user:secret@petcorner-storage.supabase.co']) {
    configured({ ...production, SUPABASE_URL: url }, () => assert.throws(validateConfig, /SUPABASE_URL/));
  }
});

test('malformed URLs and database SSL configuration fail without exposing credentials', () => {
  for (const url of ['postgresql://user:super-secret@bad host/store', 'postgresql://user:super-secret@*/store', 'postgresql://user:super-secret@db/store?sslmode=invalid', 'postgresql://user:super-secret@db/store?sslmode=require&sslmode=disable', 'postgresql://user:super-secret@db/store?sslaccept=invalid', 'postgresql://user:super-secret@db/store?sslaccept=strict&sslaccept=accept_invalid_certs', 'postgresql://user:super-secret@example.com/store', 'postgresql://user:super-secret@0.0.0.0/store']) {
    configured({ ...production, DATABASE_URL: url }, () => assert.throws(validateConfig, (error: unknown) => error instanceof Error && /DATABASE_URL/.test(error.message) && !error.message.includes('super-secret')));
  }
  configured({ ...production, APP_PUBLIC_URL: 'https://user:super-secret@bad host' }, () => assert.throws(validateConfig, (error: unknown) => error instanceof Error && /APP_PUBLIC_URL/.test(error.message) && !error.message.includes('super-secret')));
  for (const host of ['db', 'postgres', 'dpg-petcorner-a', '127.0.0.1']) {
    for (const query of ['', '?sslmode=require&sslaccept=strict', '?sslmode=disable', '?sslmode=prefer']) {
      configured({ ...production, DATABASE_URL: `postgresql://user:password@${host}:5432/store${query}` }, () => assert.doesNotThrow(validateConfig));
    }
  }
});

test('proxy trust defaults off and only accepts an explicit bounded hop count', () => {
  for (const value of [undefined, 'false', '0']) configured({ ...production, TRUST_PROXY: value }, () => assert.equal((validateConfig() as { trustProxy?: unknown }).trustProxy, false));
  for (const value of ['1', '2', '5']) configured({ ...production, TRUST_PROXY: value }, () => assert.equal((validateConfig() as { trustProxy?: unknown }).trustProxy, Number(value)));
  for (const value of ['true', '*', '6', '-1', '1.5', '', 'loopback', '127.0.0.1', ' 1 ']) configured({ ...production, TRUST_PROXY: value }, () => assert.throws(validateConfig, /TRUST_PROXY/));
});

test('Supabase transaction runtime and session migration URLs are separated and validate TLS and pool mode', () => {
  const runtime = 'postgresql://postgres.petcorner:password@aws-0-eu.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=3&sslmode=require&sslaccept=strict';
  const direct = 'postgresql://postgres.petcorner:password@aws-0-eu.pooler.supabase.com:5432/postgres?sslmode=require&sslaccept=strict';
  configured({ ...production, DATABASE_URL: runtime, DIRECT_URL: direct, SUPABASE_URL: 'https://petcorner.supabase.co' }, () => assert.doesNotThrow(validateConfig));
  for (const patch of [{ DIRECT_URL: runtime }, { DATABASE_URL: runtime.replace('&sslaccept=strict', '') }, { DIRECT_URL: direct.replace('&sslaccept=strict', '') }, { DATABASE_URL: runtime.replace('pgbouncer=true&', ''), DIRECT_URL: direct }, { DATABASE_URL: runtime.replace('&sslmode=require', ''), DIRECT_URL: direct }, { DIRECT_URL: direct.replace('/postgres?', '/different?') }, { DIRECT_URL: direct.replace('postgres.petcorner:', 'postgres.wrongproject:') }, { SUPABASE_URL: 'https://wrongproject.supabase.co' }]) {
    configured(Object.assign({}, production, { DATABASE_URL: runtime, DIRECT_URL: direct, SUPABASE_URL: 'https://petcorner.supabase.co' }, patch), () => assert.throws(validateConfig));
  }
});
