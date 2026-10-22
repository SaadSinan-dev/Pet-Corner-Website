import { isIP } from 'node:net';
import { isAbsolute } from 'node:path';

function parsedUrl(value: string | undefined, key: string): URL {
  // Never propagate URL parser errors: their input property can contain credentials.
  try { if (value && value === value.trim()) return new URL(value); } catch { /* safe error below */ }
  throw new Error(`${key} must be a valid URL`);
}

function hostname(value: string) { return value.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, ''); }
function placeholderHost(value: string) {
  return /(^|\.)(?:example\.(?:com|net|org)|example|invalid|test)$/.test(value)
    || value.split('.').some(label => /^(?:host|placeholder|replace-me|change-me|your-(?:api|app|shop|storefront|admin|domain|site|host))$/.test(label));
}
function nonPublicHost(value: string) {
  const host = hostname(value);
  if (placeholderHost(host) || host.includes('*') || !host.includes('.') && isIP(host) !== 6 || /(^|\.)(?:localhost|local|internal|lan|home|arpa)$/.test(host)) return true;
  if (isIP(host) === 4) {
    const [a, b] = host.split('.').map(Number);
    return [0, 10, 127].includes(a) || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127 || a === 198 && [18, 19].includes(b);
  }
  if (isIP(host) === 6) return host === '::' || host === '::1' || /^(?:f[cd]|fe[89ab]|ff|::ffff:)/.test(host);
  return !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(host);
}

function publicUrl(value: string, key: string, production: boolean) {
  const parsed = parsedUrl(value, key);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash
    || production && (parsed.protocol !== 'https:' || nonPublicHost(parsed.hostname))) {
    throw new Error(`${key} must use an actual public HTTPS hostname in production and contain no credentials, query or fragment`);
  }
  return parsed;
}

export function validateConfig() {
  for (const key of ['JWT_SECRET', 'ORDER_TOKEN_SECRET']) {
    if (!process.env[key] || process.env[key]!.length < 32 || process.env[key]!.startsWith('replace-')) throw new Error(`${key} must be configured with a random secret of at least 32 characters`);
  }
  if (!['development', 'test', 'production'].includes(process.env.NODE_ENV ?? 'development')) throw new Error('NODE_ENV must be development, test or production');
  const production = process.env.NODE_ENV === 'production';
  const database = parsedUrl(process.env.DATABASE_URL, 'DATABASE_URL');
  const dbHost = hostname(database.hostname);
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !dbHost || !database.pathname || database.pathname === '/' || database.hash
    || dbHost.includes('*') || !isIP(dbHost) && !/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(dbHost)
    || production && (placeholderHost(dbHost) || dbHost === '0.0.0.0' || dbHost === '::')) throw new Error('DATABASE_URL must identify a PostgreSQL hostname and database');
  for (const [key, values] of Object.entries({ sslmode: ['disable', 'prefer', 'require'], sslaccept: ['strict', 'accept_invalid_certs'] })) {
    const supplied = database.searchParams.getAll(key);
    if (supplied.length > 1 || supplied.some(value => !values.includes(value))) throw new Error(`DATABASE_URL has an invalid or repeated ${key} parameter`);
  }
  if (process.env.PORT !== undefined && (!/^\d+$/.test(process.env.PORT) || Number(process.env.PORT) < 1 || Number(process.env.PORT) > 65535)) throw new Error('PORT must be a valid TCP port');
  for (const key of ['CORS_ORIGINS', 'APP_PUBLIC_URL', 'ADMIN_PUBLIC_URL', 'STORAGE_PROVIDER', 'UPLOAD_DIR', 'PUBLIC_UPLOAD_BASE_URL']) {
    if (production && !process.env[key]) throw new Error(`${key} must be explicit in production`);
  }
  if (process.env.STORAGE_PROVIDER && process.env.STORAGE_PROVIDER !== 'local') throw new Error('STORAGE_PROVIDER must be local');
  if (production && !isAbsolute(process.env.UPLOAD_DIR!)) throw new Error('UPLOAD_DIR must be an absolute persistent disk mount path in production');
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5174,http://127.0.0.1:5174,http://localhost:5175,http://127.0.0.1:5175').split(',').map(v => v.trim());
  if (!origins.length || origins.some(origin => !origin)) throw new Error('CORS_ORIGINS must contain exact origins');
  for (const origin of origins) {
    if (publicUrl(origin, 'CORS_ORIGINS', production).origin !== origin) throw new Error('CORS_ORIGINS must contain exact HTTP(S) origins');
  }
  for (const key of ['APP_PUBLIC_URL', 'ADMIN_PUBLIC_URL']) {
    const value = process.env[key];
    if (value) {
      const parsed = publicUrl(value, key, production);
      if (production && parsed.origin !== value) throw new Error(`${key} must be an exact HTTPS origin in production`);
      if (!origins.includes(parsed.origin)) throw new Error(`${key} origin must be allowed by CORS_ORIGINS`);
    }
  }
  const uploads = process.env.PUBLIC_UPLOAD_BASE_URL;
  if (uploads && uploads !== '/uploads') {
    const parsed = publicUrl(uploads, 'PUBLIC_UPLOAD_BASE_URL', production);
    if (parsed.protocol !== 'https:' || !/^\/uploads\/?$/.test(parsed.pathname)) throw new Error('PUBLIC_UPLOAD_BASE_URL must be /uploads or an HTTPS URL ending in /uploads');
  }
  let trustProxy: false | number = false;
  const proxy = process.env.TRUST_PROXY;
  if (proxy !== undefined && proxy !== 'false' && proxy !== '0') {
    if (!/^[1-5]$/.test(proxy)) throw new Error('TRUST_PROXY must be false, 0 or an explicit proxy hop count from 1 to 5');
    trustProxy = Number(proxy);
  }
  return { origins, trustProxy };
}
