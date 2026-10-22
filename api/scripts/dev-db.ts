import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Embedded database is for local development only.');
  const local = resolve('.local');
  await mkdir(local, { recursive: true });
  const credentialsPath = resolve(local, 'db.json');
  const credentials: { password: string } = existsSync(credentialsPath) ? JSON.parse(await readFile(credentialsPath, 'utf8')) as { password: string } : { password: randomBytes(32).toString('hex') };
  if (!existsSync(credentialsPath)) await writeFile(credentialsPath, JSON.stringify(credentials), { mode: 0o600, flag: 'wx' });
  const databaseDir = resolve(local, 'postgres');
  const pg = new EmbeddedPostgres({ databaseDir, user: 'petcorner', password: credentials.password, port: 54329, authMethod: 'scram-sha-256', persistent: true, initdbFlags: ['--encoding=UTF8'],
    postgresFlags: ['-h', '127.0.0.1'], onLog: () => undefined, onError: () => undefined });
  if (!existsSync(resolve(databaseDir, 'PG_VERSION'))) await pg.initialise();
  await pg.start();
  const client = pg.getPgClient('postgres', '127.0.0.1');
  await client.connect();
  for (const name of ['petcorner', 'petcorner_test']) {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]);
    if (exists.rowCount === 0) await client.query(`CREATE DATABASE ${name} WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'`);
  }
  await client.end();
  const envPath = resolve('.env');
  if (!existsSync(envPath)) {
    const url = `postgresql://petcorner:${credentials.password}@127.0.0.1:54329/`;
    await writeFile(envPath, `DATABASE_URL=${url}petcorner?schema=public\nTEST_DATABASE_URL=${url}petcorner_test?schema=public\nPORT=3001\nHOST=127.0.0.1\nNODE_ENV=development\nJWT_SECRET=${randomBytes(48).toString('hex')}\nORDER_TOKEN_SECRET=${randomBytes(48).toString('hex')}\nAPP_PUBLIC_URL=http://localhost:5174\nADMIN_PUBLIC_URL=http://localhost:5175\nCORS_ORIGINS=http://localhost:5174,http://127.0.0.1:5174,http://localhost:5175,http://127.0.0.1:5175\nSTORAGE_PROVIDER=local\nUPLOAD_DIR=./uploads\nPUBLIC_UPLOAD_BASE_URL=/uploads\n`, { mode: 0o600, flag: 'wx' });
  }
  process.stdout.write('Local PostgreSQL ready on 127.0.0.1:54329. Local configuration saved without printing credentials.\n');
  const stop = async () => { await pg.stop(); process.exit(0); };
  process.on('SIGINT', () => { void stop(); });
  process.on('SIGTERM', () => { void stop(); });
  await new Promise(() => undefined);
}
main().catch(() => { process.stderr.write('Local PostgreSQL startup failed; check port 54329 and .local directory.\n'); process.exitCode = 1; });
