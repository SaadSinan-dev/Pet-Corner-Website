import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

export interface StorageAdapter { put(name: string, data: Buffer): Promise<string>; publicUrl(name: string): string; }
export const safeImageName = (name: string) => /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,150}\.webp$/.test(name);
export class LocalStorageAdapter implements StorageAdapter {
  publicUrl(name: string) { return `${(process.env.PUBLIC_UPLOAD_BASE_URL ?? '/uploads').replace(/\/$/, '')}/${name}`; }
  async put(name: string, data: Buffer): Promise<string> {
    const directory = resolve(process.env.UPLOAD_DIR ?? './uploads');
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, name), data, { flag: 'wx', mode: 0o644 });
    return this.publicUrl(name);
  }
}
export interface SupabaseStorageSettings { url: string; key: string; bucket: string; }
type StorageFetch = (url: string, options?: RequestInit) => Promise<Response>;
export class SupabaseStorageAdapter implements StorageAdapter {
  constructor(private readonly settings: SupabaseStorageSettings, private readonly transport: StorageFetch = fetch) {}
  private objectPath(name: string) {
    if (!safeImageName(name)) throw new Error('Invalid storage object name');
    return `${encodeURIComponent(this.settings.bucket)}/${encodeURIComponent(name)}`;
  }
  publicUrl(name: string) { return `${this.settings.url.replace(/\/$/, '')}/storage/v1/object/public/${this.objectPath(name)}`; }
  private headers() {
    return { apikey: this.settings.key, ...(!this.settings.key.startsWith('sb_secret_') ? { Authorization: `Bearer ${this.settings.key}` } : {}) };
  }
  async remove(name: string) {
    this.objectPath(name);
    const response = await this.transport(`${this.settings.url.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(this.settings.bucket)}`, { method: 'DELETE', headers: { ...this.headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [name] }), redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Storage cleanup failed');
  }
  async put(name: string, data: Buffer) {
    const path = this.objectPath(name);
    const uploaded = await this.transport(`${this.settings.url.replace(/\/$/, '')}/storage/v1/object/${path}`, {
      method: 'POST', headers: { ...this.headers(), 'Content-Type': 'image/webp', 'x-upsert': 'false', 'Cache-Control': 'max-age=31536000' },
      body: new Uint8Array(data), redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    if (!uploaded.ok) throw new Error('Storage upload failed');
    const url = this.publicUrl(name);
    try {
      const readable = await this.transport(url, { method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(5000) });
      if (!readable.ok || !readable.headers.get('content-type')?.toLowerCase().startsWith('image/webp')) throw new Error('Storage object is not publicly readable');
      return url;
    } catch {
      // Only the random object just uploaded by this operation is eligible for cleanup.
      // A failed/conflicting POST never deletes an existing object.
      await this.remove(name).catch(() => undefined);
      throw new Error('Storage public verification failed');
    }
  }
}
export function storageAdapter(): StorageAdapter {
  const provider = process.env.STORAGE_PROVIDER ?? 'local';
  if (provider === 'supabase') {
    const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, SUPABASE_STORAGE_BUCKET: bucket } = process.env;
    if (!url || !key || !bucket) throw new Error('Supabase storage settings are required');
    return new SupabaseStorageAdapter({ url, key, bucket });
  }
  if (provider !== 'local' || process.env.NODE_ENV === 'production') throw new Error('Production requires Supabase storage');
  return new LocalStorageAdapter();
}
@Injectable()
export class StorageService {
  async upload(file?: Express.Multer.File) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) throw new BadRequestException('ارفع صورة بصيغة JPEG أو PNG أو WebP');
    if (file.buffer.length > 5 * 1024 * 1024) throw new BadRequestException('حجم الصورة يتجاوز الحد المسموح');
    let output: Buffer;
    try {
      const image = sharp(file.buffer, { limitInputPixels: 16000000, animated: false, failOn: 'warning' });
      const metadata = await image.metadata();
      if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format) || !metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) throw new Error('Invalid format');
      output = await image.rotate().resize(1800, 1800, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    } catch { throw new BadRequestException('ملف الصورة تالف أو أبعاده أكبر من الحد المسموح'); }
    try { return { url: await storageAdapter().put(`${randomUUID()}.webp`, output) }; }
    catch { throw new ServiceUnavailableException('تعذر حفظ الصورة، يرجى المحاولة مجدداً'); }
  }
}
