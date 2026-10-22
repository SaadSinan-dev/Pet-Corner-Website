# Pet Corner — نتائج تجهيز الاستضافة المجانية

التاريخ: 22 أكتوبر 2026. طلب التنفيذ: `e08bfbdb-4901-4ae9-8e2c-c2220502979d`.

الكود والإعدادات جاهزة محليًا للبنية المطلوبة: واجهتا Cloudflare Pages مستقلتان، Render Free Web Service، وSupabase Free PostgreSQL وStorage. **لم يُنشأ حساب أو مشروع خارجي، ولم يُختبر اتصال Supabase حقيقي.** المرجع التنفيذي للمالك: [دليل الربط وجدول المتغيرات](free-hosting.md).

## 1. السلوك الناتج والملفات

| المجال | الملفات الجديدة أو المعدلة لهذه المرحلة | النتيجة |
| --- | --- | --- |
| التخزين والتحقق | `api/src/storage.ts`, `api/src/config.ts`, `api/src/app.ts` | Adapter مستقل لـSupabase، تخزين محلي للتطوير فقط، رفض local في الإنتاج، WebP معقم، تأكيد قراءة عامة قبل إرجاع URL، أخطاء آمنة بلا fallback محلي. تحويل مسارات uploads القديمة بعد نسخ الملفات. |
| الاتصال والترحيلات | `api/scripts/migrate.ts`, `api/scripts/start-production.ts`, `api/scripts/test-migrate.ts`, `api/package.json`, `scripts/test-browser.mjs`, `.github/workflows/ci.yml` | DIRECT_URL لأمر migrate deploy وحده، DATABASE_URL للـruntime، Session/direct للمهاجرة، transaction pool اختياري للـruntime، عزل قواعد الاختبار. Prisma6 والـschema والترحيلات الأصلية محفوظة. |
| حماية Supabase | `api/prisma/migrations/20261022150000_supabase_rls/migration.sql`, `api/prisma/migrations/20261022160000_protect_migration_metadata/migration.sql`, `deploy/supabase-product-bucket.sql` | إضافات RLS وسحب صلاحيات anon/authenticated من الجداول التسعة وسجل الترحيلات. Bucket مخصص للقراءة العامة بلا كتابة عامة. لا حذف بيانات ولا استبدال bucket قائم. |
| أدوات المالك | `api/scripts/migrate-uploads.ts`, `api/scripts/verify-storage.ts`, `api/scripts/backup-database.ts`, `api/scripts/create-admin.ts`, `scripts/create-admin.ps1`, `scripts/backup.ps1` | نقل WebP بنفس الاسم دون overwrite أو حذف المصدر، فحص سحابي صريح، نسخة DB جديدة، إنشاء المدير من جهاز المالك لأن Render Free بلا Shell. |
| إعداد النشر | `render.yaml`, `api/Dockerfile`, `compose.yaml`, `.env.deployment.example`, `api/.env.example`, `api/.env.production.example` | خدمة Render واحدة بخطة free وNode24، لا Render database أو disk أو volume للصور؛ أمثلة متطابقة مع الكود. ملفات Pages العامة الجاهزة `.env.production.example` و`admin/.env.production.example` باقية دون أسرار. |
| الاختبارات | `api/test/storage.test.ts`, `api/test/config.test.ts`, `api/test/startup.test.ts`, `api/test/cloud-integration.test.ts`, `api/test/legacy-transfer.test.ts`, `api/test/api.test.ts`, `tests/deployment/free-hosting.test.mjs` | الحالات الجديدة للتخزين والإعدادات وفشل المهاجرة وحماية metadata ونقل الصور. |
| التوثيق | `README.md`, `admin/README.md`, `docs/free-hosting.md`, `docs/git-deploy.md`, `docs/backend.md`, هذا التقرير وخطة المرحلة | خطوات Supabase/Render/Pages، مصدر كل متغير، المدير، الترحيلات، قبول الرفع الحقيقي، الحدود والنسخ الاحتياطي. التقارير السابقة سجلات تاريخية ولا تثبت نشرًا سحابيًا. |

**مزود الإنتاج المهيأ في الكود هو Supabase Storage.** التشغيل المحلي الحالي يبقى local وفق `api/.env`؛ لا يعني إعداد الإنتاج وجود اتصال سحابي فعلي. المفتاح الإداري داخل Backend فقط، ولا يلزم React أو Pages أو GitHub Actions. الروابط العامة لا تحتوي المفتاح.

سياسة التطبيق تحفظ السجلات بالتعطيل ولا تقدم حذفًا نهائيًا للمنتج؛ لذلك لا تحذف صور المنتج تلقائيًا. يبقى ترتيب الصور وتعددها وسجل الطلبات كما هو. تُحذف فقط صورة الفحص التي تنشئها أداة الفحص، أو الصورة الجديدة التي فشل التحقق العام منها بعد اكتمال رفعها. POST الفاشل أو المتعارض لا يسبب حذف صورة موجودة.

## 2. الفحوص المنفذة فعليًا

| الفحص | النتيجة |
| --- | --- |
| `npm test` للمتجر | **71/71 ناجح** |
| `npm --prefix admin test` | **13/13 ناجح** |
| `npm --prefix api test` | **45/45 ناجح** بعد إصلاح ملاحظات المراجعة |
| `npm run test:deploy` | **10/10 ناجح**؛ قالب Render مجاني بلا DB/disk، الأسرار خارج Pages/CI، وفحوص الربط العامة |
| الإجمالي السابق | **139 اختبارًا ناجحًا**؛ اختبارات المتصفح منفصلة أدناه |
| lint للمتجر/API واللوحة المستقلة | ناجح دون تشخيصات |
| TypeScript وبناء التطبيقات الثلاثة | ناجح؛ بُني API مجددًا ضمن الاختبار النهائي |
| ترحيلات PostgreSQL | أربع migrations نجحت على قاعدة اختبار جديدة وعلى قاعدة `_test` القائمة؛ لم تُطبّق في قاعدة المتجر المحلية |
| `npm run test:e2e` | **5/5 ناجح** في 1.2 دقيقة؛ 450 فحص عرض في الوضعين الفاتح والداكن على تسعة مقاسات، بعد تطبيق الترحيلات الأربع على قاعدة جديدة |
| PowerShell maintenance helpers | تحليل الصياغة ناجح |
| Docker Compose | فحص `config --quiet` بقيم اصطناعية نجح؛ Docker Engine غير متاح، لذلك لم تُشغّل حاويات |

فحص API يستخدم PostgreSQL حقيقيًا منفصلًا ينتهي اسمه بـ`_test`، ولا يستخدم بيانات المالك. يختبر السباق على المخزون، إعادة الطلب بالمفتاح نفسه، rollback، صلاحيات الإدارة، الصور، ورسوم الشحن غير المحددة `null` ثم التسعير بصفر أو قيمة فعلية. سجل Prisma ما زال متاحًا للمالك بعد تطبيق RLS.

قاعدة المتصفح الأخيرة: `pet_corner_browser_1792679235036_5e4a9f4b_test`. أدلة محفوظة بلا كلمات مرور أو رموز إيصال: [مقاسات المتجر](free-hosting-evidence/store-responsive-matrix.json) فيها252 حالة، [مقاسات الإدارة](free-hosting-evidence/admin-responsive-matrix.json) فيها180 حالة، و[الطلب المعزول](free-hosting-evidence/persisted-order-no-private-token.json). يُضاف18 فحصًا لصفحة دخول الإدارة داخل الاختبار ليصبح الإجمالي450. المتصفح يستخدم adapter المحلي للتطوير؛ اختبار HTTP المنفصل يختبر adapter السحابي، فلا تعني هذه النتائج نجاح اتصال سحابي حقيقي.

تكامل التخزين يستخدم **خادم HTTP محليًا معزولًا** يمثل Supabase، مع عناوين HTTPS اصطناعية وإعادة توجيه transport داخل الاختبار فقط. يختبر رفع صورة معقمة، رفض الزائر والملفات الكبيرة، إنشاء منتج والسلة والطلب، إعادة إنشاء Nest واسترجاع الصورة، بقاء الصورة بعد تعطيل المنتج، وفشل المزود دون رابط نجاح أو سجل منتج جديد. لا تُرسل طلبات إلى حساب Supabase.

اختبارات نقل الصور تغطي HTTP404 ورد Supabase الفعلي HTTP400 مع `NoSuchKey`/رد Object not found القديم، وتتوقف عند NoSuchBucket أو403 أوJSON غير معروف. النسخ يعيد تجاوز الملف المتطابق، ويرفض اختلاف محتوى object موجود. ظهرت الحالات الفاشلة قبل الإصلاح ثم نجحت. كشفت المراجعة أيضًا ضرورة حماية `_prisma_migrations`؛ أُضيفت migration جديدة دون تعديل migration سبق تطبيقها. المراجعة اللاحقة لم تجد مشكلة مهمة متبقية.

## 3. ما لم يُختبر خارجيًا بعد

1. حساب Supabase والـbucket الحقيقيان، مصادقة المفتاح الفعلي، TLS/شبكة Render إلى pooler، وحدود المؤسسة المجانية.
2. نشر Render وواجهتي Pages وHTTPS العام ودورة GitHub Push → CI → Deploy.
3. بقاء صورة على Supabase بعد إعادة نشر Render فعليًا؛ الاختبار المحلي يثبت استقلال adapter والروابط عن عمر Nest فقط.
4. إنشاء مدير حقيقي، منتجات تجارية، أو طلب عميل؛ الاختبارات تستخدم بيانات معزولة فقط.
5. نسخ Supabase الاحتياطي واستعادته؛ الأداة جاهزة لكن لا توجد دعوى نجاح backup/restore أو SLA تجاري.

لم تُحذف ملفات uploads القديمة أو تُغيّر بيانات المتجر. لا تنقل migrations وحدها بيانات قاعدة محلية إلى Supabase؛ عند وجود بيانات تجارية يلزم نقل مُراجع قبل تحويل الخدمة. الروابط المطلقة إلى نطاق قديم تتطلب الحفاظ على النطاق أو ترحيلًا انتقائيًا؛ مسارات `/uploads/<name>.webp` النسبية تعمل عبر API الجديد بعد النسخ بنفس الأسماء.

## 4. الربط والقبول بواسطة المالك

1. أنشئ مشروع **Supabase Free** وbucket `product-images`. انسخ Session pooler5432 إلى DATABASE_URL وDIRECT_URL مع TLS strict، وProject URL والمفتاح الإداري إلى ملف Backend السري/Render وفق [جدول القيم](free-hosting.md#4-جدول-المتغيرات-المطابق-للكود).
2. أنشئ **Render Free Web Service** من القالب، وأدخل متغيرات Backend في لوحة المنصة؛ لا تضف DB أوdisk. بدء الإنتاج ينفذ migrate deploy دون reset/seed ويوقف الخدمة إذا فشل.
3. اربط مشروعي **Cloudflare Pages** المستقلين بفرع main وجذر المستودع. أدخل VITE العامة فقط، واضبط CORS إلى العنوانين الفعليين. فعّل شرط Quality checks وAfter CI Checks Pass وفق [إعداد Git](git-deploy.md).
4. أنشئ المدير من جهازك عبر `scripts/create-admin.ps1 -EnvironmentFile api/.env.production`، وانسخ الصور القديمة صراحة عند الحاجة. نفّذ `verify-storage.js` ثم ارفع صورة ومنتجًا من لوحة الإدارة العامة.
5. أعد نشر API وتحقق من الصورة والسجل والطلب والصلاحيات. خطوات القبول الخارجي وأوامره الدقيقة في [قسم الفحص الحقيقي](free-hosting.md#6-تحقق-supabase-الحقيقي-بعد-إدخال-القيم).

## 5. حدود الجاهزية التجارية

Render Free ينام بعد الخمول ويستخدم ملفات مؤقتة، وSupabase Free يخضع للحصص وقد يتوقف بعد الخمول. لا يوجد ضمان تشغيل مستمر أو خطة استعادة مجربة. تفاصيل الحدود ومصادرها الرسمية بتاريخ المراجعة موجودة في [دليل حدود المجاني](free-hosting.md#7-النسخ-الاحتياطي-وحدود-المجاني). هذه الإعدادات لا تنشئ موارد مدفوعة ولا تتجاوز خطوات المالك الشخصية.
