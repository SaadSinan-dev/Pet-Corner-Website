import { isIP } from 'node:net';

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

function supabaseProject(database: URL) {
  if (/^db\.[a-z0-9-]+\.supabase\.co$/.test(database.hostname)) return database.hostname.split('.')[1];
  if (/\.pooler\.supabase\.com$/.test(database.hostname)) return database.username.split('.').at(-1);
  return undefined;
}

export function databaseUrl(value: string | undefined, key: string, production: boolean) {
  const database = parsedUrl(value, key);
  const dbHost = hostname(database.hostname);
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !dbHost || !database.pathname || database.pathname === '/' || database.hash
    || dbHost.includes('*') || !isIP(dbHost) && !/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(dbHost)
    || production && (placeholderHost(dbHost) || dbHost === '0.0.0.0' || dbHost === '::')) throw new Error(`${key} must identify a PostgreSQL hostname and database`);
  for (const [sslKey, values] of Object.entries({ sslmode: ['disable', 'prefer', 'require'], sslaccept: ['strict', 'accept_invalid_certs'] })) {
    const supplied = database.searchParams.getAll(sslKey);
    if (supplied.length > 1 || supplied.some(value => !values.includes(value))) throw new Error(`${key} has an invalid or repeated ${sslKey} parameter`);
  }
  if (production && /\.supabase\.(?:co|com)$/.test(dbHost) && (database.searchParams.get('sslmode') !== 'require' || database.searchParams.get('sslaccept') !== 'strict')) throw new Error(`${key} must set sslmode=require and sslaccept=strict for Supabase`);
  return database;
}

export function migrationDatabaseUrl(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const value = env.DIRECT_URL || (!production ? env.DATABASE_URL : undefined);
  const direct = databaseUrl(value, 'DIRECT_URL', production);
  if (/\.pooler\.supabase\.com$/.test(direct.hostname) && (direct.port === '6543' || direct.searchParams.get('pgbouncer') === 'true')) throw new Error('DIRECT_URL must use the Supabase session pooler on port 5432 or a reachable direct connection, not transaction pooling');
  return value!;
}

export function validateConfig() {
  for (const key of ['JWT_SECRET', 'ORDER_TOKEN_SECRET']) {
    if (!process.env[key] || process.env[key]!.length < 32 || process.env[key]!.startsWith('replace-')) throw new Error(`${key} must be configured with a random secret of at least 32 characters`);
  }
  if (!['development', 'test', 'production'].includes(process.env.NODE_ENV ?? 'development')) throw new Error('NODE_ENV must be development, test or production');
  const production = process.env.NODE_ENV === 'production';
  const database = databaseUrl(process.env.DATABASE_URL, 'DATABASE_URL', production);
  if (/\.pooler\.supabase\.com$/.test(database.hostname) && database.port === '6543' && database.searchParams.get('pgbouncer') !== 'true') throw new Error('DATABASE_URL transaction pooling requires pgbouncer=true for Prisma 6');
  if (production || process.env.DIRECT_URL) {
    const direct = new URL(migrationDatabaseUrl());
    if (database.pathname !== direct.pathname || (database.searchParams.get('schema') || 'public') !== (direct.searchParams.get('schema') || 'public')) throw new Error('DIRECT_URL and DATABASE_URL must target the same database and schema');
    if (supabaseProject(database) && supabaseProject(direct) && supabaseProject(database) !== supabaseProject(direct)) throw new Error('DIRECT_URL and DATABASE_URL must target the same Supabase project');
  }
  if (process.env.PORT !== undefined && (!/^\d+$/.test(process.env.PORT) || Number(process.env.PORT) < 1 || Number(process.env.PORT) > 65535)) throw new Error('PORT must be a valid TCP port');
  for (const key of ['CORS_ORIGINS', 'APP_PUBLIC_URL', 'ADMIN_PUBLIC_URL', 'STORAGE_PROVIDER']) {
    if (production && !process.env[key]) throw new Error(`${key} must be explicit in production`);
  }
  const provider = process.env.STORAGE_PROVIDER ?? 'local';
  if (!['local', 'supabase'].includes(provider) || production && provider !== 'supabase') throw new Error('STORAGE_PROVIDER must be supabase in production; local is available only for development/test');
  if (provider === 'supabase') {
    const endpoint = publicUrl(process.env.SUPABASE_URL || '', 'SUPABASE_URL', production);
    if (endpoint.pathname !== '/') throw new Error('SUPABASE_URL must be an origin without a path');
    if (production && supabaseProject(database) && endpoint.hostname.endsWith('.supabase.co') && endpoint.hostname.split('.')[0] !== supabaseProject(database)) throw new Error('SUPABASE_URL and DATABASE_URL must target the same Supabase project');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    let role: string | undefined;
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { /* opaque server secret keys do not have a JWT payload */ }
    if (!/^sb_secret_[a-zA-Z0-9_-]{20,}$/.test(key) && !(key.split('.').length === 3 && role === 'service_role')) throw new Error('SUPABASE_SERVICE_ROLE_KEY must be a server secret key or legacy service_role JWT, never an anon/publishable key');
    if (!/^[a-z0-9][a-z0-9._-]{0,62}$/.test(process.env.SUPABASE_STORAGE_BUCKET || '')) throw new Error('SUPABASE_STORAGE_BUCKET must be an explicit safe bucket name');
  }
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
  if (provider === 'local' && uploads && uploads !== '/uploads') {
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
