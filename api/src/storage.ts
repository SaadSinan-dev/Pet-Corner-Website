import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

export interface StorageAdapter { put(name: string, data: Buffer): Promise<string>; }
export class LocalStorageAdapter implements StorageAdapter {
  async put(name: string, data: Buffer): Promise<string> {
    const directory = resolve(process.env.UPLOAD_DIR ?? './uploads');
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, name), data, { flag: 'wx', mode: 0o644 });
    return `${(process.env.PUBLIC_UPLOAD_BASE_URL ?? '/uploads').replace(/\/$/, '')}/${name}`;
  }
}
@Injectable()
export class StorageService {
  private readonly adapter: StorageAdapter = new LocalStorageAdapter();
  async upload(file?: Express.Multer.File) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) throw new BadRequestException('ارفع صورة بصيغة JPEG أو PNG أو WebP');
    let output: Buffer;
    try {
      const image = sharp(file.buffer, { limitInputPixels: 16000000, animated: false, failOn: 'warning' });
      const metadata = await image.metadata();
      if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format) || !metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) throw new Error('Invalid format');
      output = await image.rotate().resize(1800, 1800, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    } catch { throw new BadRequestException('ملف الصورة تالف أو أبعاده أكبر من الحد المسموح'); }
    try { return { url: await this.adapter.put(`${randomUUID()}.webp`, output) }; }
    catch { throw new ServiceUnavailableException('تعذر حفظ الصورة، يرجى المحاولة مجدداً'); }
  }
}
