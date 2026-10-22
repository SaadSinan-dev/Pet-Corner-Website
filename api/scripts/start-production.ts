import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { validateConfig } from '../src/config';

let configured = false;
try {
  if (process.env.NODE_ENV !== 'production') throw new Error('NODE_ENV must be production for start:production');
  validateConfig();
  configured = true;
} catch (error) {
  // Configuration errors contain variable names only, never connection strings.
  process.stderr.write(`Production startup refused: ${error instanceof Error ? error.message : 'invalid configuration'}.\n`);
  process.exitCode = 1;
}

if (configured) {
  // Deploy only checked-in migrations. Builds never connect to the database.
  // Prisma's migration lock also prevents concurrent migration execution.
  const migration = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { stdio: 'inherit', env: process.env });
  if (migration.status !== 0) {
    process.stderr.write('Production startup stopped because database migrations did not succeed. The API was not started.\n');
    process.exitCode = 1;
  } else {
    // Load Nest in this process only after migration success, preserving signal handling.
    require('../src/main');
  }
}
