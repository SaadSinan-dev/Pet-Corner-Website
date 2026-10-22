# Pet Corner — الاستضافة المجانية وربط القيم

البنية الحالية: Cloudflare Pages للمتجر، مشروع Pages مستقل للإدارة، Render **Free Web Service** للخادم، وSupabase **Free** لقاعدة PostgreSQL والصور. لا ينشئ المستودع حسابات أو موارد خارجية. `render.yaml` لا يحتوي قاعدة Render أو قرصًا دائمًا أو خطة مدفوعة. لم يُختبر حساب Supabase حقيقي بعد.

## 1. إنشاء Supabase Free وتجهيز البيانات والصور

1. أنشئ مشروعًا في مؤسسة **Free**. احتفظ بكلمة مرور قاعدة البيانات، وProject URL من إعدادات Data API. لا تفعّل IPv4 add-on أو image transformations أو custom domain مدفوعًا؛ الصور تُعالج بـSharp داخل API.
2. افتح **Connect → Session pooler** وانسخ اتصال IPv4 على **5432**. استخدمه بدايةً في `DATABASE_URL` و`DIRECT_URL`، مع `sslmode=require&sslaccept=strict&connection_limit=3`. يجب ترميز الرموز الخاصة في كلمة المرور داخل URI. لا تغيّر اسم المستخدم/المضيف/المنطقة من عندك.
3. إذا احتجت transaction pooling، استخدم اتصال **6543** لـ`DATABASE_URL` فقط وأضف `pgbouncer=true&connection_limit=3&sslmode=require&sslaccept=strict`. يبقى `DIRECT_URL` اتصال Session على 5432. اتصال `db.<ref>.supabase.co` المباشر مناسب فقط إذا كانت شبكتك تدعم IPv6؛ لا تحتاج إلى شراء IPv4 لأن Session pooler متاح. يتحقق التطبيق من تطابق المشروع/قاعدة البيانات/schema بين الاتصالات.
4. من **Storage** أنشئ bucket مخصصًا باسم `product-images`: **Public**، حد الملف **5 MiB**، MIME **image/webp**. يمكن استخدام [ملف SQL المجهز](../deploy/supabase-product-bucket.sql) مرة واحدة عبر SQL Editor. لا تضف أي policy تمنح `anon` أو `authenticated` صلاحية INSERT/UPDATE/DELETE. Public يجعل قراءة الملفات ممكنة فقط؛ الرفع يتم عبر API الإداري.
5. من **Settings → API Keys** انسخ مفتاح server secret `sb_secret_...` أو مفتاح `service_role` القديم إلى `SUPABASE_SERVICE_ROLE_KEY` **داخل Backend فقط**. لا تستخدم anon/publishable، ولا تضع المفتاح في React أو Pages أو GitHub أو المحادثات. يظهر Project URL في `SUPABASE_URL`، ويظل اسم bucket مطابقًا للمتغير.

التفاصيل الرسمية: [اتصال Supabase وIPv4/IPv6](https://supabase.com/docs/guides/database/connecting-to-postgres)، [Prisma وpoolers](https://supabase.com/docs/guides/database/prisma)، [Supavisor وPrisma 6](https://supabase.github.io/supavisor/orms/prisma/)، [مفاتيح الخادم](https://supabase.com/docs/guides/getting-started/api-keys)، [Public buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals).

## 2. إعداد Render Free

اربط مستودع GitHub بالخدمة أو استورد `render.yaml` بعد مراجعته. الإعدادات: Web Service واحدة، **Free**، فرع `main`، Root Directory `api`، Dockerfile `./Dockerfile` وcontext `.`، وأمر `npm run start:production`. ملف Docker يستخدم Node24. لا تضف Render Database أو Persistent Disk.

ضع متغيرات `api/.env.production.example` في **Render Environment**. املأ القيم الفعلية، ولا تكتفِ بملف `.env` محلي. الإعداد يولّد JWT_SECRET وORDER_TOKEN_SECRET عند إنشاء الخدمة؛ احفظهما ثابتين بين Deploys، خاصة سر الإيصالات. فعّل **After CI Checks Pass**، وHealth Check `/api/v1/health`. راجع proxy topology قبل تعيين `TRUST_PROXY` من 1 إلى 5؛ `false` لا يثق في عناوين forwarded مجهولة.

الإنتاج يرفض `STORAGE_PROVIDER=local` أو إعدادات Supabase الناقصة أو مفتاحًا عامًا. لا يوجد fallback إلى قرص Render عند فشل Storage؛ يعيد الرفع خطأ عربيًا ولا يعيد رابط نجاح. يتم التحقق من القراءة العامة للصورة قبل إعطاء URL إلى نموذج المنتج.

## 3. ربط واجهتي Cloudflare Pages

اربط المشروعين بالمستودع نفسه وفرع الإنتاج `main`، مع تفعيل Git deployments وNode24. كلا المشروعين يبدأ من **جذر المستودع**؛ لا تجعل root مشروع الإدارة `admin`.

| المشروع | أمر البناء | مجلد المخرجات | متغيرات Production العامة |
| --- | --- | --- | --- |
| المتجر | `npm run pages:build:storefront` | `dist` | `VITE_API_BASE_URL` = رابط Render الفعلي + `/api/v1`، `VITE_SITE_URL` = origin المتجر |
| الإدارة | `npm run pages:build:admin` | `admin/dist` | `VITE_ADMIN_API_BASE_URL` = API نفسه، `VITE_ADMIN_SITE_URL` = origin الإدارة، `VITE_STOREFRONT_URL` = origin المتجر |

استخدم عناوين `pages.dev` و`onrender.com` المتاحة أولًا دون شراء نطاق. اجعل `APP_PUBLIC_URL` و`ADMIN_PUBLIC_URL` و`CORS_ORIGINS` في Render تطابق Origins الفعلية بالضبط. بعد تغيير العناوين أعد بناء Pages. Preview deployments تحتاج staging منفصلًا وإعداد CORS خاصًا؛ لا توجّهها إلى بيانات الإنتاج.

Pages يستخدم SPA fallback الأصلي مع غياب `404.html` الجذرية؛ لا توجد قاعدة redirect دائرية. أوامر Pages تنفذ lint/tests/types/build وترفض HTTP وlocalhost والقيم الناقصة والأسرار داخل `VITE_*`. إعداد GitHub في [.github/workflows/ci.yml](../.github/workflows/ci.yml) يستخدم PostgreSQL مؤقتًا ولا يحتاج أسرار Supabase. اشترط **Quality checks** قبل merge إلى main. Pages يبدأ بناءه مستقلًا، وRender ينتظر CI؛ حافظ على توافق عقود API بين الإصدارات.

## 4. جدول المتغيرات المطابق للكود

| المتغير | مصدر القيمة | موضعه |
| --- | --- | --- |
| `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=10000` | الإعداد الجاهز | Render فقط |
| `DATABASE_URL` | Supabase Connect: Session 5432 أو Transaction 6543 مع `pgbouncer=true`، TLS إلزامي لاتصال Supabase | Render runtime؛ `.env` محلي للتطوير فقط |
| `DIRECT_URL` | Supabase Connect: Session 5432، أو direct إذا كان IPv6 متاحًا | Render وملف الصيانة المحلي السري؛ migrations لا تستخدم transaction pool |
| `JWT_SECRET`, `ORDER_TOKEN_SECRET` | أسرار عشوائية مستقلة؛ يولدها قالب Render عند الإنشاء | Backend فقط؛ ليست GitHub CI Secrets أو Vite |
| `CORS_ORIGINS` | origin المتجر وorigin الإدارة الفعليان، مفصولان بفاصلة | Render؛ دون path أو trailing slash أو wildcard |
| `APP_PUBLIC_URL`, `ADMIN_PUBLIC_URL` | العنوانان الفعليان للمتجر والإدارة | Render |
| `STORAGE_PROVIDER=supabase` | الإعداد الجاهز | Render |
| `SUPABASE_URL` | Project URL من Supabase، دون path | Render فقط |
| `SUPABASE_SERVICE_ROLE_KEY` | server secret أو legacy service_role من API Keys | سر داخل Render/ملف صيانة محلي مستبعد من Git؛ ممنوع في Pages/GitHub |
| `SUPABASE_STORAGE_BUCKET=product-images` | اسم bucket الذي أنشأته | Render |
| `TRUST_PROXY` | عدد proxy hops المؤكد أو `false` | Render |
| `VITE_API_BASE_URL`, `VITE_SITE_URL` | روابط API والمتجر | Pages المتجر Production، وأمثلة الجذر |
| `VITE_ADMIN_API_BASE_URL`, `VITE_ADMIN_SITE_URL`, `VITE_STOREFRONT_URL` | روابط API والإدارة والمتجر | Pages الإدارة Production، وأمثلة `admin/` |
| `UPLOAD_DIR`, `PUBLIC_UPLOAD_BASE_URL` | مسار تطوير محلي | **لـlocal storage خارج الإنتاج فقط**؛ لا يحتاجهما Supabase |
| `TEST_DATABASE_URL` | PostgreSQL منفصل ينتهي اسمه بـ`_test` | اختبارات محلية/CI فقط؛ ليس Render |

رقم WhatsApp وسياسة التوصيل والأسعار والمخزون بيانات تُحفظ في PostgreSQL عبر لوحة الإدارة؛ ليست متغيرات سرية تُضاف إلى Vite. لم تُخترع قيم تجارية. لا متغيرات `SUPABASE_*` في واجهتي React.

## 5. Migrations، المدير، والصور القديمة

أمر الإنتاج يتحقق من الإعدادات، ثم يستدعي `prisma migrate deploy` في subprocess يحصل على `DIRECT_URL` بوصفه اتصال CLI. Prisma Client يستمر باستخدام `DATABASE_URL`. يوجد timeout للمهاجرة؛ الفشل يمنع تشغيل Nest. لا `db push` ولا `reset` ولا Seed. محليًا فقط، عند غياب DIRECT_URL يستخدم الأمر DATABASE_URL. جميع migrations السابقة باقية، وأضيف تفعيل RLS لجداول التطبيق دون حذف بيانات؛ اتصال Prisma يجب أن يستخدم مالك الجداول الموثوق أو دورًا مناسبًا، ولا يعمل عبر anon.

على Supabase تُحجب جداول الإدارة والطلبات وسجل `_prisma_migrations` عن أدوار Data API العامة بواسطة RLS وسحب صلاحيات anon/authenticated. تبقى القراءة والكتابة من تطبيقك عبر Nest المحمي؛ هذا يحمي أيضًا المشروعات القديمة التي تحتفظ بمنح public التلقائية. افحص Security Advisor وتجنب إنشاء policies مباشرة تسمح بتجاوز قواعد المتجر، وفق [دليل صلاحيات Supabase](https://supabase.com/docs/guides/api/securing-your-api). Migrations تنشئ/تطوّر المخطط ولا تنقل سجلات قاعدة محلية إلى مشروع آخر. البيانات المحلية باقية؛ نقل بيانات تجارية موجودة إلى Supabase يحتاج backup/import مُراجعًا، دون استيراد Seed بوصفه بضاعة فعلية.

Render Free لا يوفر Shell أو SSH. أنشئ المدير من جهازك ضد اتصال Supabase المقصود:

```powershell
# املأ api/.env.production محليًا من المثال؛ الملف مستبعد من Git.
.\scripts\create-admin.ps1 -EnvironmentFile api/.env.production
```

يعرض السكربت hostname واسم القاعدة فقط للتحقق من الهدف، ويطلب البريد وكلمة مرور مخفية 14–256 حرفًا. يستخدم DIRECT_URL في الإنتاج، ولا يطبع كلمة المرور أو يستبدل حسابًا موجودًا.

لملفات `/uploads/<name>.webp` القديمة، انسخ bytes إلى bucket بنفس الأسماء قبل تحويل الاستضافة. API الجديد يعيد توجيه GET/HEAD لهذه المسارات إلى Supabase دون تغيير سجلات المنتجات أو تاريخ الطلبات:

```powershell
npm --prefix api run build
node --env-file=api/.env.production api/dist/scripts/migrate-uploads.js --source="C:\ABSOLUTE\old-uploads"
# راجع dry run ثم نفّذ النسخ صراحةً:
node --env-file=api/.env.production api/dist/scripts/migrate-uploads.js --source="C:\ABSOLUTE\old-uploads" --apply
```

السكربت لا يحذف المصدر ولا يكتب فوق object مختلف ولا يعدّل DB. إعادة التشغيل تتجاوز الملفات المتطابقة. يدعم ملفات WebP المعقمة التي أنتجتها النسخة السابقة. راجع الملفات الأخرى التي يعدّها skipped. الروابط المطلقة إلى نطاق API قديم تحتاج إبقاء النطاق أو ترحيلًا انتقائيًا مُراجعًا؛ لا يعيد السكربت كتابة روابط مجهولة. تعطيل المنتج لا يحذف الصور حفاظًا على الاستخدامات والبيانات التاريخية؛ لا يوجد حذف نهائي للمنتجات في سياسة التطبيق الحالية.

## 6. تحقق Supabase الحقيقي بعد إدخال القيم

الفحوص المحلية للتكامل تستخدم HTTP fixture معزولًا، ولا تثبت اتصالًا بحساب Supabase. بعد تجهيز القيم:

1. تحقق من health العام. إذا كانت Render نائمة، انتظر بدء الخدمة ثم أعد الفحص. شغّل فحص الربط للقراءة فقط: `npm run verify:public -- --store=https://REAL_STORE --admin=https://REAL_ADMIN --api=https://REAL_API/api/v1 --revision=COMMIT_SHA` مع القيم الحقيقية.
2. من جهازك، نفّذ `npm --prefix api run build` ثم `node --env-file=api/.env.production api/dist/scripts/verify-storage.js`. يرفع الملف المؤقت عبر Supabase REST فعليًا، يسترجعه بلا مفتاح، ثم يحذف **ملف الاختبار الذي أنشأه فقط**. الفشل لا يُعلن نجاح التخزين.
3. سجّل الدخول في Dashboard العامة، وأضف منتجًا مميزًا باسم واضح للاختبار وصورة عبر نموذج الرفع الحقيقي. أعد فتحه، وافتح رابط الصورة العام في جلسة غير مصادقة، وتحقق من صورة المنتج داخل المتجر إذا نشرته مؤقتًا. لا تنشئ بيانات تجريبية تبدو بضاعة حقيقية.
4. أعد تحميل البيانات ثم أعد نشر Render، وتحقق من بقاء السجل والصورة في Supabase. نفذ طلب اختبار معزولًا، وتحقق من ظهوره في الإدارة ورسومه وإجماليه null حتى تسعيره؛ WhatsApp يدوي. نظّف الطلب بالمسار المسموح وعطّل المنتج، دون المساس بسجلات أخرى.
5. اختبر رفض `/api/v1/admin/uploads` بلا Bearer، ورفض الرفع المباشر إلى Storage بمفتاح anon/publishable. إذا قُبل هذا الرفع، أزل سياسة الكتابة غير المقصودة قبل الإطلاق. لا ترسل المفتاح الإداري إلى المتصفح لإجراء الاختبار.

## 7. النسخ الاحتياطي وحدود المجاني

نسخة DB لتطبيقك، باستخدام PostgreSQL client وpg_dump مناسب للإصدار:

```powershell
.\scripts\backup.ps1 -EnvironmentFile api/.env.production -PgDump "C:\PATH\TO\pg_dump.exe"
```

تستخدم DIRECT_URL وTLS، ولا تضع كلمة المرور في argv. يكتب `pg_dump -Fc --schema=public` ملفًا جديدًا لا يُستبدل. تشمل النسخة schema التطبيق فقط؛ صدّر bytes bucket الصور منفصلة. اختبر الاستعادة في قاعدة مستقلة قبل الاعتماد على النسخة. لا تُحذف بيانات أو تُستعاد تلقائيًا. لم يُنفذ backup/restore حقيقي لـSupabase في هذه المهمة.

تمت مراجعة الخطط بتاريخ **22 أكتوبر 2026**:

| المزود | القيود المؤثرة |
| --- | --- |
| Render Free | نوم بعد 15 دقيقة خمول، cold start يقارب دقيقة، filesystem مؤقت، لا persistent disk ولا Shell/SSH، وحصة ساعات شهرية. قد تتوقف الخدمة عند تجاوز الحدود؛ راجع حسابك ولا تفعّل ترقية تلقائية. |
| Supabase Free | 500 MB لقاعدة المشروع، 1 GB ملفات، 5 GB egress و5 GB cached egress، وقد يُوقف المشروع بعد أسبوع خمول. لا تعتمد على automatic daily backups أو SLA مدفوع. |
| Cloudflare Pages Free | مجاني ضمن حصص البناء/الاستخدام الحالية؛ استخدم المشاريع المرتبطة بـGit دون اشتراك مدفوع، وراقب الحصص في Dashboard. شراء نطاق ليس ضمن هذه البنية. |

المصادر: [Render Free](https://render.com/docs/free)، [رسوم تجاوز Render](https://render.com/docs/faq#all-of-my-services-run-on-free-instances-can-i-still-be-billed)، [Supabase Free والحدود](https://supabase.com/pricing)، [توقف مشروعات Supabase](https://supabase.com/docs/guides/platform/free-project-pausing)، [حدود Pages](https://developers.cloudflare.com/pages/platform/limits/).

هذه البنية مناسبة لإطلاق محدود وتجربة التشغيل بأقل تكلفة، لكنها لا تضمن موثوقية تجارية مستمرة بسبب النوم والحصص وغياب SLA وخطة backup مجرّبة. لم تُنشأ موارد مدفوعة أو حسابات، ولم يُدّعَ نشر أو HTTPS أو رفع سحابي حقيقي قبل فحصه على حساب المالك.
