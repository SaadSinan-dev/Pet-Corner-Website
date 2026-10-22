import 'dotenv/config';
import { createApp } from './app';

async function main() {
  const app = await createApp();
  await app.listen(Number(process.env.PORT ?? 3001), process.env.HOST ?? '127.0.0.1');
}
main().catch(() => { process.stderr.write('تعذر بدء API. تحقق من الإعدادات واتصال قاعدة البيانات.\n'); process.exitCode = 1; });
