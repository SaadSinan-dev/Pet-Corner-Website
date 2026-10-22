import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { SupabaseStorageAdapter, storageAdapter } from '../src/storage';
import { validateConfig } from '../src/config';

async function main() {
  validateConfig();
  const adapter = storageAdapter();
  if (!(adapter instanceof SupabaseStorageAdapter)) throw new Error('Supabase is required');
  const name = `verification-${randomUUID()}.webp`;
  const data = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#103f6b' } }).webp().toBuffer();
  let uploaded = false;
  try {
    const url = await adapter.put(name, data); uploaded = true;
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok || !(await response.arrayBuffer()).byteLength) throw new Error('Public retrieval failed');
    process.stdout.write('Supabase upload and unauthenticated public retrieval verified. Test object will be removed.\n');
  } finally { if (uploaded) await adapter.remove(name); }
}
main().catch(() => { process.stderr.write('Storage verification failed. Check the server-only key, public product bucket and network. No successful cloud integration is claimed.\n'); process.exitCode = 1; });
