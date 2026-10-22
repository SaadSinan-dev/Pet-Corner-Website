import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Database } from './database';

@Controller('health')
export class HealthController {
  constructor(private readonly db: Database) {}
  @Get()
  async readiness() {
    try { await this.db.$queryRaw`SELECT 1`; return { status: 'ok' }; }
    catch { throw new ServiceUnavailableException('الخدمة غير جاهزة حالياً'); }
  }
}
