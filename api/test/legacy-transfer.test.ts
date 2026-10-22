import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import sharp from 'sharp';
import { transferLegacyUploads } from '../scripts/migrate-uploads';

test('legacy transfer recognizes Supabase missing-object responses but refuses bucket and permission failures', async () => {
  const originalFetch = globalThis.fetch;
  const original = { ...process.env };
  const directory = await mkdtemp(resolve(tmpdir(), 'petcorner-transfer-errors-'));
  let writes = 0;
  const adapter = { publicUrl: (name: string) => `https://fixture.supabase.co/storage/v1/object/public/product-images/${name}`, put: async () => { writes++; return 'https://fixture.supabase.co/image.webp'; } };
  try {
    process.env.STORAGE_PROVIDER = 'supabase';
    await writeFile(resolve(directory, 'old-image.webp'), await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).webp().toBuffer());
    for (const response of [new Response(null, { status: 404 }), Response.json({ statusCode: '404', error: 'not_found', code: 'NoSuchKey', message: 'Object not found' }, { status: 400 }), Response.json({ statusCode: '404', error: 'not_found', message: 'Object not found' }, { status: 400 })]) {
      globalThis.fetch = async () => response;
      assert.equal((await transferLegacyUploads(directory, true, adapter)).copied, 1);
    }
    assert.equal(writes, 3);
    for (const response of [Response.json({ statusCode: '404', error: 'not_found', code: 'NoSuchBucket', message: 'Bucket not found' }, { status: 400 }), Response.json({ statusCode: '403', error: 'Unauthorized' }, { status: 403 }), new Response('invalid JSON', { status: 400 })]) {
      globalThis.fetch = async () => response;
      await assert.rejects(() => transferLegacyUploads(directory, true, adapter));
      assert.equal(writes, 3, 'A bucket, permission or unknown failure must not trigger an upload');
    }
  } finally {
    globalThis.fetch = originalFetch; process.env = original;
    assert.ok(resolve(directory).startsWith(`${resolve(tmpdir())}${sep}petcorner-transfer-errors-`));
    await rm(directory, { recursive: true, force: true });
  }
});
