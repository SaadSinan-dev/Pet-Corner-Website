import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { migrationDatabaseUrl } from '../src/config';

export function runMigrations() {
  // Prisma 6's datasource remains DATABASE_URL for Client. Only this CLI subprocess
  // receives the separate direct/session connection; runtime never switches pools.
  const url = migrationDatabaseUrl();
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { stdio: 'inherit', timeout: 120000, env: { ...process.env, DATABASE_URL: url } });
  return result.status ?? 1;
}
if (require.main === module) {
  try { process.exitCode = runMigrations(); }
  catch { process.stderr.write('Migration refused. Configure DIRECT_URL for a direct/session connection to the intended database.\n'); process.exitCode = 1; }
}
