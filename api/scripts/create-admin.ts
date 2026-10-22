import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth';
import { migrationDatabaseUrl } from '../src/config';

async function main() {
  // Password is read from piped stdin, never from process arguments or shell history.
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Usage: pipe a password to npm run admin:create -- admin@example.com');
  if (process.stdin.isTTY) throw new Error('Pipe a password from a password manager or hidden prompt through stdin.');
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > 1024) throw new Error('Password input is too long.');
    chunks.push(buffer);
  }
  const password = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
  if (password.length < 14 || password.length > 256) throw new Error('Use a unique password containing 14–256 characters.');
  // Render Free has no remote shell. This maintenance command can run locally
  // against the explicitly selected production session/direct connection.
  const options: Prisma.PrismaClientOptions = process.env.NODE_ENV === 'production' ? { datasourceUrl: migrationDatabaseUrl() } : {};
  const db = new PrismaClient(options);
  try { await db.admin.create({ data: { email, passwordHash: await hashPassword(password) } }); process.stdout.write('Administrator created.\n'); }
  finally { await db.$disconnect(); }
}
main().catch(() => { process.stderr.write('Administrator creation failed. Check email, password requirements and database configuration. Existing accounts are never overwritten.\n'); process.exitCode = 1; });
