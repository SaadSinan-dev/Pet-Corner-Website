# Pet Corner

افتح [المتجر](http://127.0.0.1:5174) أو [لوحة الإدارة المستقلة](http://127.0.0.1:5175). الخادم على `3001` و[توثيق API](http://127.0.0.1:3001/api/docs).

ثلاثة تطبيقات مستقلة: متجر React/TypeScript عربي RTL، لوحة إدارة داخل `admin/`، وخادم NestJS/Prisma/PostgreSQL داخل `api/`. البيانات المحلية التجريبية محفوظة ومعلّمة؛ الإنتاج يستبعدها تلقائيًا. لا يوجد حساب إداري افتراضي.

## 1. التشغيل المحلي

المتطلبات: Node.js 24، npm، PostgreSQL. الأوامر من مجلد المشروع، دون إعادة ضبط البيانات.

```powershell
npm ci
npm --prefix api ci
npm --prefix admin ci
npm --prefix api run db:generate
```

عند غياب PostgreSQL، شغّل المساعد واتركه يعمل في نافذة منفصلة:

```powershell
npm --prefix api run db:dev
```

ينشئ `api/.env` عند غيابه فقط، وقاعدتي `petcorner` و`petcorner_test` على `127.0.0.1:54329`، مع بيانات دائمة داخل `api/.local/`. للخادم الخارجي انسخ `api/.env.example` إلى `api/.env` واضبط الاتصال والأسرار. المساعد للتطوير فقط.

طبّق migrations الإضافية ثم شغّل كل تطبيق في نافذة مستقلة:

```powershell
npm --prefix api run db:migrate
npm --prefix api run dev
```

```powershell
npm run dev
```

```powershell
npm run dev:admin
```

المتجر `5174` والإدارة `5175` يمرران `/api` و`/uploads` إلى API `3001`. يمكن تغيير هدف التطوير بـ`API_PROXY_TARGET`. API يراقب الملفات المبنية؛ شغّل `npm --prefix api run build` بعد تعديل المصدر. على Windows أوقف API قبل `db:generate` لتجنب قفل محرك Prisma.

على قاعدة تطوير جديدة فقط، `npm --prefix api run db:seed` يحمّل كتالوجًا تجريبيًا باختيار صريح ويرفض الإنتاج. بدونه يبدأ الكتالوج فارغًا.

## 2. المدير وتجهيز البيع

```powershell
.\scripts\create-admin.ps1
```

أدخل بريدك وكلمة مرور فريدة من 14 إلى 256 حرفًا في prompt مخفي. لا تُطبع كلمة المرور أو تُمرر كوسيط عملية، ولا يُستبدل حساب موجود. سجّل الدخول في لوحة الإدارة؛ الجلسة في الذاكرة فقط، لذلك إعادة تحميل الصفحة بالكامل تتطلب تسجيل الدخول مجددًا.

1. أضف الفئات والمنتجات الفعلية بصورها وأسعارها ومخزونها. التعديل والترتيب والرفع يحفظ فعليًا؛ الحذف يعطّل السجل ويحفظ تاريخ الطلبات.
2. في إعدادات المتجر أدخل رقم WhatsApp التجاري بصيغة دولية، وسياسة التوصيل المعتمدة، ومعلومات التواصل والمحتوى الفعلي. لا يوجد رقم افتراضي.
3. فعّل الدفع عند الاستلام واستقبال الطلبات، وأوقف الوضع التجريبي عند الإطلاق. لا يُفعّل checkout دون رقم WhatsApp وسياسة توصيل. منتجات `isDemo` القديمة تبقى مستبعدة في الإنتاج؛ أضف منتجات تجارية جديدة.

الطلب الجديد يحفظ المجموع الفرعي فقط، وتكون `deliveryFee` و`total` بقيمة `null`. بعد الاتفاق مع العميل، أدخل التكلفة الفعلية في تفاصيل الطلب؛ يحسب الخادم الإجمالي ويسجل التعديل. الصفر يعني توصيلًا مجانيًا متفقًا عليه. لا يمكن الإرسال قبل تحديد التكلفة أو تعديلها بعد الإرسال/الإلغاء.

WhatsApp رابط رسالة جاهزة للمراجعة والإرسال اليدوي فقط؛ لا توجد Business API أو رسالة تلقائية. الطلب محفوظ قبل فتح الرابط. استعادة الاستجابة المفقودة تستخدم البيانات والمفتاح نفسيهما لمنع الطلب المكرر وخصم المخزون مرتين. الإيصال محمي برمز خاص مستقل عن رقم الطلب.

## 3. البيئة والصور

| الملف | المتغيرات |
| --- | --- |
| `api/.env` | `DATABASE_URL`، `TEST_DATABASE_URL` لقاعدة منفصلة تنتهي بـ`_test`، `JWT_SECRET` و`ORDER_TOKEN_SECRET` مستقلان وعشوائيان بطول 32 حرفًا أو أكثر، `NODE_ENV`، `HOST`، `PORT` |
| `api/.env` | `CORS_ORIGINS` origins محددة مفصولة بفاصلة؛ `APP_PUBLIC_URL` و`ADMIN_PUBLIC_URL` إلزاميان للإنتاج ويجب أن يكون أصلهما ضمن القائمة |
| `api/.env` | `STORAGE_PROVIDER=local`، `UPLOAD_DIR` دائم وقابل للكتابة، `PUBLIC_UPLOAD_BASE_URL=/uploads` أو URL صور HTTPS مطلق |
| `.env` للمتجر | `VITE_API_BASE_URL=/api/v1`، `VITE_SITE_URL` للنطاق الحقيقي |
| `admin/.env` | `VITE_ADMIN_API_BASE_URL=/api/v1`، `VITE_STOREFRONT_URL` لرابط المتجر، `VITE_ADMIN_SITE_URL` لتوثيق عنوان الإدارة |

كل متغير `VITE_` عام؛ لا تضع فيه أسرارًا. حافظ على `ORDER_TOKEN_SECRET` ثابتًا لصلاحية الإيصالات. راجع ملفات `.env.example` الثلاثة و`.env.deployment.example`.

رفع JPEG/PNG/WebP فعلي حتى 5 MiB و16 مليون بكسل، مع إعادة ترميز WebP وأسماء عشوائية وإزالة metadata. التخزين المحلي فقط منفذ؛ تغيير URL لا ينشئ تخزينًا سحابيًا. Compose يوفر volume دائمًا وكلا Nginx يمرر `/uploads` إلى API، لذلك يعمل المسار النسبي على النطاقين. دون هذا proxy استخدم URL صور HTTPS مطلقًا. [مصادر الأصول](docs/assets.md).

## 4. الاختبارات والبناء

```powershell
npm test
npm --prefix admin test
npm --prefix api run db:migrate:test
npm --prefix api test
npm run lint
npm --prefix admin run lint
npm run build:all
npm run test:e2e
```

البناء يشمل TypeScript للتطبيقات الثلاثة. اختبارات API تعيد تجهيز قاعدة `TEST_DATABASE_URL` المعزولة فقط. اختبارات المتصفح تنشئ قاعدة `pet_corner_browser_*_test` جديدة وخدمات `3002/5176/5177`؛ تحتاج صلاحية PostgreSQL `CREATEDB`. تبقى قاعدة الاختبار للمراجعة دون حذف تلقائي. على Windows يستخدم الاختبار Edge؛ خلاف ذلك ثبّت Chromium بـ`npx playwright install chromium` أو اضبط `PLAYWRIGHT_EXECUTABLE_PATH`.

التغطية: إدارة منتج وصورتين، شراء حقيقي، فقد استجابة واستعادتها دون تكرار، ظهور الطلب وتسعيره في الإدارة، الصلاحيات، شاشة البداية والثيم والقائمة، التحميل/الفراغ/الفشل وإعادة المحاولة. المقاسات: `320,360,375,390,430,768,1024,1280,1440` في الوضعين. [دليل المتصفح](e2e/README.md) و[تقرير الترقية والنتائج](docs/verification-2026-10-22.md).

## 5. النشر التلقائي عبر Git

إعداد الربط الكامل في [دليل Git وCloudflare وRender](docs/git-deploy.md)، والنتائج الفعلية في [تقرير النشر التلقائي](docs/verification-automated-deployment-2026-10-22.md). فرع الإنتاج المقترح والمثبت في CI هو `main`؛ لا يوجد Git remote في هذا المجلد بعد، وربطه من طرفك.

| المشروع | Root في Pages | Build command | Output |
| --- | --- | --- | --- |
| المتجر | جذر المستودع | `npm run pages:build:storefront` | `dist` |
| الإدارة | جذر المستودع نفسه | `npm run pages:build:admin` | `admin/dist` |

كلا المشروعين يستخدم Node 24 والنشر التلقائي من `main`. ضع قيم HTTPS الفعلية في Production Variables لكل مشروع، حسب `.env.production.example` الخاص به؛ لا يكفي تغيير `.env` المحلي. أمر Pages يشغّل lint/tests/TypeScript/build ويرفض API نسبيًا أو محليًا أو ناقصًا. ملف `deployment.json` داخل الحزمة يسجل SHA البناء وعناوينه العامة للتحقق من التحديث. Preview deployments معطلة أولًا حتى تجهيز staging منفصل.

ملف `.github/workflows/ci.yml` يشغّل **Quality checks** على PR وPush إلى main بقاعدة PostgreSQL مؤقتة فقط، بلا أسرار إنتاج. فعّل حماية main واشترط نجاح هذا الفحص قبل merge؛ Pages يبدأ بناءه مستقلاً عن فحوص GitHub الأخرى. `render.yaml` يجهز API Docker وPostgreSQL وديسك صور دائمًا مع **After CI Checks Pass**؛ هو قالب لخدمات مدفوعة تنشئها أنت، وليس خدمة تم إنشاؤها.

Runtime الخادم في `api/.env.production.example`: أسرار DB/JWT/الإيصال وCORS والنطاقات والتخزين على الاستضافة فقط. `start:production` يتحقق من الإعدادات ثم ينفذ `prisma migrate deploy` ويشغّل Nest؛ لا Seed أو Reset. رقم WhatsApp والسياسات بيانات تجارية تُحفظ عبر إعدادات لوحة الإدارة، وليست متغيرات Vite أو أرقامًا افتراضية.

بعد الربط، استخدم فحصًا عامًا للقراءة فقط بالقيم الحقيقية:

```powershell
npm run verify:public -- --store=https://REAL_STORE --admin=https://REAL_ADMIN --api=https://REAL_API/api/v1 --revision=COMMIT_SHA
```

استبدل أسماء REAL وCOMMIT_SHA بقيمك؛ الأمر يرفض localhost وHTTP ولا يرسل طلب شراء أو بيانات دخول. يتحقق من health والصلاحيات وCORS والمسارات والأيقونات ونسخة البناء. لا يُدّعى نجاح Push→Deploy حتى تنفذه على الحسابات المربوطة وتتحقق من SHA نفسه.

### بديل Docker Compose على مضيف تديره


جهّز نطاقين وDNS ومضيفًا. انسخ `.env.deployment.example` إلى `.env.deployment` السري. أدخل `POSTGRES_PASSWORD` عشوائيًا بصيغة hex صالحة لعنوان الاتصال، وسرّي JWT والإيصال، و`APP_PUBLIC_URL` و`ADMIN_PUBLIC_URL` بصيغة HTTPS وأصلهما في `CORS_ORIGINS`، و`VITE_SITE_URL` مطابقًا للمتجر. أدخل `STORE_DOMAIN` و`ADMIN_DOMAIN` دون scheme و`TLS_EMAIL` لـCaddy.

```powershell
docker compose --env-file .env.deployment -f compose.yaml -f compose.https.yaml config --quiet
docker compose --env-file .env.deployment -f compose.yaml -f compose.https.yaml up -d --build
```

البناء مستقل عبر `Dockerfile` و`admin/Dockerfile` و`api/Dockerfile`. Compose يطبق migrations قبل API، مع health checks لـPostgreSQL و`/api/v1/health` و`/healthz`. Caddy يوفر HTTPS وشهادات محفوظة في volume؛ يحتاج DNS ووصولًا عامًا للمنفذين 80/443. دون ملف HTTPS، الواجهتان على loopback `8080/8081` خلف proxy تديره أنت.

لإنشاء مدير داخل النشر، مرّر كلمة المرور من prompt مخفي إلى stdin للأمر `docker compose --env-file .env.deployment exec -T api node dist/scripts/create-admin.js YOUR_EMAIL`، دون وضعها ضمن الأمر أو التاريخ. بعدها أضف المنتجات والإعدادات التجارية في اللوحة.

```powershell
.\scripts\backup.ps1 -EnvironmentFile .env.deployment
```

السكربت ينسخ PostgreSQL بصيغة `pg_dump -Fc` وأرشيف الصور إلى `backups/` بنقل ثنائي آمن. خزّن نسخة مشفرة خارج المضيف، وجدول التشغيل، واختبر الاستعادة في قاعدة ومجلد مستقلين. لا تحذف volumes أثناء الترقية.

**لم يُشغّل Docker أو HTTPS العام أو النسخ/الاستعادة فعليًا لأن Docker Engine غير متاح على الجهاز.** التحقق المحلي يشمل صيغة Compose والسكربتات وبناء التطبيقات. قبل الإطلاق يلزم اختبار الحاويات والشهادات والنطاقات والاستعادة، وضبط المراقبة وproxy/rate limits، واعتماد بيانات المنتجات والسياسات ورقم WhatsApp. لا توجد بوابة دفع إلكتروني موصولة.

التفاصيل: [عقد API](docs/api-contract.md)، [الخادم](docs/backend.md)، [الإدارة](admin/README.md).
