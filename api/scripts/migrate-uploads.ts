import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readdir, readFile, lstat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import sharp from 'sharp';
import { safeImageName, storageAdapter, StorageAdapter } from '../src/storage';
import { validateConfig } from '../src/config';

async function isMissingObject(response: Response): Promise<boolean> {
  if (response.status === 404) return true;
  if (response.status !== 400) return false;
  // Storage's REST API can return HTTP 400 with an internal 404. Do not
  // confuse bucket, authorization or unknown failures with an absent object.
  const body = await response.json().catch(() => null);
  return body !== null && String(body.statusCode) === '404' &&
    (body.code === 'NoSuchKey' || (!body.code && body.error === 'not_found' && body.message === 'Object not found'));
}

export async function transferLegacyUploads(source: string, apply = false, adapter?: StorageAdapter) {
  if (!isAbsolute(source)) throw new Error('Source must be an explicitly selected absolute directory');
  const entries = await readdir(source, { withFileTypes: true });
  const files = entries.filter(entry => entry.isFile() && safeImageName(entry.name));
  const result = { candidates: files.length, copied: 0, alreadyIdentical: 0, skipped: entries.length - files.length, dryRun: !apply };
  if (!apply) return result;
  const target = adapter ?? storageAdapter();
  if (process.env.STORAGE_PROVIDER !== 'supabase') throw new Error('Select Supabase storage for an explicit transfer');
  for (const entry of files) {
    const path = resolve(source, entry.name);
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 5 * 1024 * 1024) throw new Error('Legacy upload is not a supported image file');
    const data = await readFile(path);
    const meta = await sharp(data, { limitInputPixels: 16000000, animated: false }).metadata();
    if (meta.format !== 'webp' || (meta.pages ?? 1) > 1) throw new Error('Legacy upload must be sanitized WebP');
    const existing = await fetch(target.publicUrl(entry.name), { redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (existing.ok) {
      const same = createHash('sha256').update(Buffer.from(await existing.arrayBuffer())).digest('hex') === createHash('sha256').update(data).digest('hex');
      if (!same) throw new Error('An existing cloud object differs; no overwrite was attempted');
      result.alreadyIdentical++;
    } else if (await isMissingObject(existing)) {
      await target.put(entry.name, data); result.copied++;
    } else { throw new Error('Could not verify the existing cloud object'); }
  }
  return result; // Source bytes and database records are never removed or rewritten.
}
if (require.main === module) {
  const source = process.argv.find(arg => arg.startsWith('--source='))?.slice(9);
  const apply = process.argv.includes('--apply');
  Promise.resolve().then(() => { if (!source) throw new Error('source'); if (apply) validateConfig(); return transferLegacyUploads(source, apply); })
    .then(result => console.log(JSON.stringify(result)))
    .catch(() => { process.stderr.write('Legacy transfer stopped. Select an absolute --source directory and valid Supabase settings. Sources, existing objects and database records are never overwritten.\n'); process.exitCode = 1; });
}
