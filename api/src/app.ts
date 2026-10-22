import 'reflect-metadata';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { resolve } from 'node:path';
import { AdminGuard, AuthController } from './auth';
import { AdminController, StorefrontController } from './controllers';
import { Database } from './database';
import { safeImageName, storageAdapter, StorageService } from './storage';
import { StoreService } from './store';
import { documentResponses } from './openapi';
import { validateConfig } from './config';
import { HealthController } from './health';

@Catch()
class SafeErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    let status = 500;
    let code: string | undefined;
    let message = 'حدث خطأ غير متوقع، يرجى المحاولة مجدداً';
    if (error instanceof HttpException) {
      status = error.getStatus();
      const body = error.getResponse();
      if (typeof body === 'object' && body !== null && 'code' in body && body.code === 'OUT_OF_STOCK') code = 'OUT_OF_STOCK';
      const original = typeof body === 'string' ? body : (body as { message?: unknown }).message;
      if (typeof original === 'string' && /[\u0600-\u06ff]/.test(original)) message = original;
      else message = ({ 400: 'تحقق من البيانات المدخلة', 401: 'يلزم تسجيل الدخول أو رابط طلب صالح', 403: 'ليس لديك صلاحية لهذا الإجراء', 404: 'المحتوى المطلوب غير موجود', 413: 'حجم الملف يتجاوز الحد المسموح', 429: 'طلبات كثيرة، يرجى الانتظار قليلاً' } as Record<number, string>)[status] ?? message;
    } else if (typeof error === 'object' && error !== null && 'status' in error && error.status === 413) {
      status = 413; message = 'حجم الطلب يتجاوز الحد المسموح';
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') { status = 409; message = 'توجد بيانات أخرى بنفس المعرف'; }
      if (error.code === 'P2025') { status = 404; message = 'المحتوى المطلوب غير موجود'; }
      if (['P2003', 'P2000', 'P2004'].includes(error.code)) { status = 400; message = 'البيانات غير صالحة أو مرتبطة بمحتوى غير موجود'; }
      if (error.code === 'P2034') { status = 409; message = 'تعارضت العملية مع تعديل آخر، يرجى المحاولة مجدداً'; }
      if (['P1001', 'P1002', 'P1017', 'P2024'].includes(error.code)) { status = 503; message = 'تعذّر الاتصال بقاعدة البيانات، يرجى إعادة المحاولة'; }
    } else if (error instanceof Prisma.PrismaClientInitializationError) { status = 503; message = 'تعذّر الاتصال بقاعدة البيانات، يرجى إعادة المحاولة';
    } else if (error instanceof Prisma.PrismaClientValidationError) { status = 400; message = 'تحقق من البيانات المدخلة'; }
    const response = host.switchToHttp().getResponse<Response>();
    response.status(status).json({ message, ...(code ? { code } : {}) });
  }
}

@Module({
  imports: [
    JwtModule.registerAsync({ useFactory: () => ({ secret: process.env.JWT_SECRET, signOptions: { algorithm: 'HS256', expiresIn: '1h', issuer: 'pet-corner-api', audience: 'pet-corner-admin' } }) }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 150 }]),
  ],
  controllers: [StorefrontController, AdminController, AuthController, HealthController],
  providers: [Database, StoreService, StorageService, AdminGuard, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class AppModule {}

export async function createApp() {
  const { origins, trustProxy } = validateConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false, bodyParser: false });
  app.set('trust proxy', trustProxy);
  app.useBodyParser('json', { limit: '100kb' });
  app.setGlobalPrefix('api/v1');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (/^\/api\/v1\/(?:admin|auth|storefront\/orders)(?:\/|$)/.test(req.path)) res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.enableCors({ origin: origins, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Order-Token'], maxAge: 600 });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true, validationError: { target: false, value: false } }));
  app.useGlobalFilters(new SafeErrors());
  if (process.env.STORAGE_PROVIDER === 'supabase') {
    // Existing DB links retain /uploads/<filename>. Copy those files once with
    // storage:migrate; the same names then resolve durably without rewriting history.
    app.use('/uploads', (req: Request, res: Response) => {
      const name = req.path.slice(1);
      if (!['GET', 'HEAD'].includes(req.method) || !safeImageName(name)) { res.status(404).end(); return; }
      res.redirect(307, storageAdapter().publicUrl(name));
    });
  } else {
    app.useStaticAssets(resolve(process.env.UPLOAD_DIR ?? './uploads'), { prefix: '/uploads/', dotfiles: 'deny', index: false, fallthrough: false, maxAge: '7d', immutable: true });
  }
  const config = new DocumentBuilder().setTitle('Pet Corner API').setDescription('Public store and protected administration APIs. Currency uses integer units; demo data requires an explicit seed command.').setVersion('1.0').addBearerAuth().build();
  SwaggerModule.setup('api/docs', app, documentResponses(SwaggerModule.createDocument(app, config)));
  app.enableShutdownHooks();
  return app;
}
