import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { open } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { migrationDatabaseUrl } from '../src/config';

async function main() {
  const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
  const executable = process.argv.find(arg => arg.startsWith('--pg-dump='))?.slice(10) || 'pg_dump';
  if (!output || !isAbsolute(output)) throw new Error('Select an absolute output path');
  const url = new URL(migrationDatabaseUrl());
  // pg_dump/libpq does not understand Prisma-only URL options.
  for (const key of [...url.searchParams.keys()]) if (!['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'connect_timeout'].includes(key)) url.searchParams.delete(key);
  if (/\.supabase\.(co|com)$/.test(url.hostname)) url.searchParams.set('sslmode', 'verify-full');
  const reserved = await open(output, 'wx', 0o600); await reserved.close();
  // No database URI or password in argv, output or logs. Never overwrite an existing backup.
  const dumped = spawnSync(executable, ['--format=custom', '--no-owner', '--no-acl', '--schema=public', `--file=${output}`], { windowsHide: true, stdio: 'pipe', env: { ...process.env, PGDATABASE: url.href } });
  if (dumped.status !== 0) throw new Error('Backup failed; reserved output is incomplete and must not be used');
  process.stdout.write('Application schema backup created. Back up Storage bytes separately and verify restoration in an isolated database.\n');
}
main().catch(() => { process.stderr.write('Backup failed. Check DIRECT_URL, pg_dump availability/version, TLS, permissions and a new output path. No restore success is claimed.\n'); process.exitCode = 1; });
