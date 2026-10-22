import { Body, CanActivate, Controller, ExecutionContext, Get, Injectable, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Request } from 'express';
import { Database } from './database';
import { LoginDto } from './dto';

const scrypt = promisify(scryptCallback);
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(24).toString('hex');
  const hash = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  const hash = Buffer.from(expected, 'hex');
  return hash.length === actual.length && timingSafeEqual(hash, actual);
}
// Fixed valid hash keeps unknown-user verification on the same expensive path.
const dummyHash = `scrypt:${'0'.repeat(48)}:${'0'.repeat(128)}`;

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly db: Database) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request & { adminId?: string }>();
    const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException('يلزم تسجيل الدخول');
    try {
      const claims = await this.jwt.verifyAsync<{ sub: string; role: string }>(match[1], { algorithms: ['HS256'], audience: 'pet-corner-admin', issuer: 'pet-corner-api' });
      if (claims.role !== 'ADMIN') throw new Error('role');
      const admin = await this.db.admin.findUnique({ where: { id: claims.sub } });
      if (!admin?.active) throw new Error('inactive');
      req.adminId = admin.id;
      return true;
    } catch { throw new UnauthorizedException('انتهت الجلسة أو بيانات الدخول غير صالحة'); }
  }
}
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly db: Database, private readonly jwt: JwtService) {}
  @Get('me') @ApiBearerAuth() @UseGuards(AdminGuard)
  async me(@Req() req: Request & { adminId: string }) {
    const admin = await this.db.admin.findUniqueOrThrow({ where: { id: req.adminId } });
    return { id: admin.id, email: admin.email, role: 'ADMIN' };
  }
  @Post('login')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async login(@Body() body: LoginDto) {
    const admin = await this.db.admin.findUnique({ where: { email: body.email.toLowerCase() } });
    const valid = await verifyPassword(body.password, admin?.passwordHash ?? dummyHash);
    if (!admin?.active || !valid) throw new UnauthorizedException('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    return { accessToken: await this.jwt.signAsync({ sub: admin.id, role: 'ADMIN' }) };
  }
}
