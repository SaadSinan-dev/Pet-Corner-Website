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

## 3. البيئة والإنتاج المجاني

[دليل الاستضافة المجانية الكامل](docs/free-hosting.md) هو المرجع الحالي. البنية: واجهتا Cloudflare Pages، Render Free API، Supabase Free PostgreSQL وStorage. أزيلت قاعدة Render المدفوعة والـPersistent Disk من render.yaml. الإنتاج يرفض التخزين المحلي.

| الملف | مكان القيم الفعلية |
| --- | --- |
| .env.example وadmin/.env.example | تطوير محلي؛ local storage خارج الإنتاج فقط |
| .env.production.example | Pages المتجر: VITE_API_BASE_URL وVITE_SITE_URL |
| admin/.env.production.example | Pages الإدارة: VITE_ADMIN_API_BASE_URL وVITE_ADMIN_SITE_URL وVITE_STOREFRONT_URL |
| api/.env.production.example | Render: DATABASE_URL وDIRECT_URL وأسرار JWT/الإيصال وCORS وعناوين التطبيقات ومتغيرات SUPABASE_* |

كل VITE_ عام. SUPABASE_SERVICE_ROLE_KEY يبقى في Backend فقط، ولا يدخل Git أو GitHub Actions أو React. الإعدادات المنشورة تُغيّر في لوحات المنصات ثم يُعاد بناء Pages؛ تعديل ملف محلي وحده لا يحدّث الإنتاج. رقم WhatsApp والسياسة بيانات فعلية محفوظة عبر الإدارة، لا متغيرات واجهة افتراضية.

## 4. الفحوص والبناء

من مجلد المشروع:

```powershell
npm test
npm --prefix admin test
npm --prefix api run db:migrate:test
npm --prefix api test
npm run test:deploy
npm run lint
npm --prefix admin run lint
npm run build:all
npm run test:e2e
```

اختبارات DB تستخدم قاعدة _test فقط. المتصفح ينشئ قاعدة جديدة وخدمات 3002/5176/5177، بلا اتصال بإنتاجك. تكامل Supabase المحلي يستخدم HTTP fixture معزولًا؛ لا يدّعي اتصالًا بحساب سحابي. [تفاصيل المتصفح](e2e/README.md).

## 5. الربط اليدوي مرة واحدة

1. أنشئ Supabase Free، وانسخ اتصال Session pooler 5432 وProject URL والمفتاح الإداري، وأنشئ bucket product-images عامًا للقراءة بلا سياسات كتابة للزوار. راجع [جدول المتغيرات](docs/free-hosting.md).
2. اربط Render Free بالمستودع باستخدام render.yaml وأدخل قيم api/.env.production.example. لا تنشئ Render PostgreSQL أو Disk؛ لا يوجد مورد مدفوع في القالب.
3. اربط مشروعي Pages بفرع main وجذر المستودع نفسه: المتجر بأمر npm run pages:build:storefront ومخرجات dist؛ الإدارة بأمر npm run pages:build:admin ومخرجات admin/dist. استخدم Node24 وURLs HTTPS الفعلية.
4. فعّل حماية main واشترط Quality checks قبل merge. Render مضبوط على After CI Checks Pass؛ Pages يبني بعد Push مستقلاً. لم تُختبر دورة Push→Deploy خارجيًا بعد.
5. أنشئ المدير من جهازك، ثم اختبر رفع منتج وصورة فعلية وإعادة نشر API. Render Free لا يوفر Shell. خطوات المدير وMigrations ونقل الصور القديمة والفحص العام والنسخ الاحتياطي في الدليل.

أوامر الصيانة تستخدم ملف إنتاج محليًا مستبعدًا من Git بالقيم التي وضعتها على المنصات:

```powershell
.\scripts\create-admin.ps1 -EnvironmentFile api/.env.production
.\scripts\backup.ps1 -EnvironmentFile api/.env.production -PgDump "C:\PATH\TO\pg_dump.exe"
```

Migrations تستخدم DIRECT_URL في subprocess ثم يبدأ API بـDATABASE_URL؛ لا Reset أو Seed. أضيفت حماية RLS لجداول التطبيق كي لا تتجاوز Supabase Data API صلاحيات Nest. تبقى البيانات المحلية؛ migrations لا تنقلها تلقائيًا إلى مشروع آخر. الصور القديمة /uploads تعمل بعد نسخ ملفات WebP بنفس الأسماء إلى bucket عبر storage:migrate؛ لا تُحذف المصادر أو سجلات المنتجات.

الخطط المجانية لها نوم وcold starts وحصص، وليست ضمانًا لتشغيل تجاري مستمر. لم يُنشأ حساب خارجي، ولم تُختبر Supabase أو HTTPS أو backup/restore العام. [تقرير النتائج الحالية](docs/verification-free-hosting-2026-10-22.md)، [إعداد Git](docs/git-deploy.md)، [الخادم](docs/backend.md)، [عقد API](docs/api-contract.md).
