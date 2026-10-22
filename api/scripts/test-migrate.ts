import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL must identify a dedicated database ending in _test');
const result = spawnSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
process.exitCode = result.status ?? 1;
