# تحقق إعداد النشر التلقائي — 22 أكتوبر 2026

الحالة: الكود وإعدادات Git/CI/CD جاهزة محليًا ومختبرة. **لم يحدث نشر عام أو إنشاء خدمات أو حساب مدير إنتاجي. لم تُختبر دورة Push→Deploy على حسابات خارجية.** التوجيه الأخير للمالك يقصر هذه المهمة على الإعداد والتنفيذ المحلي ويترك إنشاء المشاريع والربط والأسرار له.

## الملفات والتغييرات

| المجال | الملفات | التنفيذ |
| --- | --- | --- |
| CI والاستضافة | `.github/workflows/ci.yml`, `.github/workflows/verify-deployment.yml`, `render.yaml` | فحص Quality checks على PR وPush إلى main، PostgreSQL مؤقت، lint/types/tests/build وثلاثة تطبيقات واختبار متصفح؛ فحص عام يدوي للقراءة فقط؛ Render بعد نجاح CI مع PostgreSQL وديسك صور دائم معلنين في القالب |
| بناء Pages | `scripts/pages-build.mjs`, `scripts/deployment-config.mjs`, `package.json`, `public/_headers`, `admin/public/_headers` | أوامر منفصلة للمتجر والإدارة، رفض عناوين الإنتاج الناقصة والمحلية وHTTP والأسرار في متغيرات Vite، فحوص كل تطبيق قبل البناء، `deployment.json` لربط الحزمة بـcommit، رؤوس أمن وnoindex للإدارة |
| عناوين الصور | `src/lib/urls.ts`, `api.ts`, `hooks.ts`, `src/components/Common.tsx`, `src/pages/Home.tsx`, `Product.tsx`, اختبارات الصور والرئيسية | تحويل سجلات `/uploads/` القديمة إلى origin الخادم عند انفصال النطاقات، مع الحفاظ على صور `/images` المحلية والروابط المطلقة وبيانات OG/JSON-LD والصور البديلة |
| إنتاج API | `api/src/config.ts`, `app.ts`, `api/scripts/start-production.ts`, `api/package.json`, `Dockerfile`, `api/test/config.test.ts`, `startup.test.ts`, `compose.yaml` | اشتراط إعدادات الإنتاج الصحيحة، HTTPS وCORS محدد، تحقق مسار الصور، TRUST_PROXY محدود، تحقق الإعداد قبل migrate deploy، رفض التشغيل عند فشل migration، دون seed أو reset |
| البيئة والتحقق والتوثيق | أمثلة `.env` و`.env.production.example` في التطبيقات، `.env.deployment.example`, `.gitignore`, `tests/deployment/`, `scripts/public-smoke.mjs`, `scripts/test-browser.mjs`, `e2e/demo-store.spec.ts`, `admin/src/auth.test.tsx`, README، `docs/git-deploy.md`, `e2e/README.md` | فصل أسرار runtime عن متغيرات بناء عامة، اختبارات مستقلة عن عناوين localhost، تدفق متصفح حقيقي عبر origins منفصلة، دليل الربط والتشغيل والنسخ الاحتياطي |

لم تُضف تبعيات تطبيق جديدة. lockfiles الحالية محفوظة. لا تغيير مخطط بيانات جديد، ولا حذف بيانات المتجر أو تشغيل Seed عليه. بيئة المتصفح وحدها تحصل على Seed صريح داخل قاعدة جديدة خاصة بها. قواعد الاختبار والأسرار والملفات المرفوعة والنسخ الاحتياطية خارج Git؛ ملفات الأدلة المختارة تحتوي بيانات اصطناعية فقط.

## نتائج منفذة فعليًا

| الفحص | النتيجة |
| --- | --- |
| اختبارات المتجر | **71/71**، ستة ملفات، بما فيها تحميل الصور وmetadata عبر API مستقل |
| اختبارات لوحة الإدارة | **13/13**، أربعة ملفات، نجحت أيضًا ضمن بناء Pages مع عنوان API مطلق |
| اختبارات API | **37/37**، PostgreSQL `_test` معزولة، تشمل الإعدادات والتشغيل والمخزون والطلبات والصلاحيات |
| اختبارات حواجز النشر والفحص العام | **8/8**؛ رفض missing/HTTP/local/private/reserved/placeholder URLs، الأسرار العامة، revision قديم وSeed معروف؛ إثبات GET/OPTIONS فقط للفحص العام |
| المتصفح | **5/5** سيناريوهات، 450 فحص عرض/ثيم/صفحة على المقاسات التسعة؛ API فعلي على origin مختلف عن المتجر والإدارة |
| lint وTypeScript وبناء التطبيقات الثلاثة | نجحت؛ `npm run build:all` مع فحوص الأنواع، وlint للمتجر/API والإدارة |
| `pages:build:storefront` و`pages:build:admin` | نجح الأمران كاملين مع إعدادات إنتاج اصطناعية داخل التجربة المحلية، واختبارات/lint/types/build وmetadata والأيقونات؛ **لم يُرفعا إلى Cloudflare** |
| بدء API إنتاجي محلي | تحقق config ثم migrate deploy ثم health؛ أُعيد التشغيل وقُرئت الملفات المحفوظة؛ فشل migration منع تشغيل Nest |
| إعدادات YAML | CI وRender تحققا وفق schemas المنشورة، وCompose مع HTTPS نجح في `config --quiet`؛ Docker Engine غير متاح، فلم تُشغّل حاويات |

المجموع: 129 اختبار وحدات/تكامل/حواجز، إضافة إلى خمسة سيناريوهات متصفح. المصفوفة 252 حالة متجر و180 حالة إدارة و18 حالة دخول؛ المقاسات 320/360/375/390/430/768/1024/1280/1440 في الوضعين. لا تُعد هذه الفحوص اعتمادًا لكل متصفح أو تدقيق وصول شاملًا.

اختبار المتصفح أنشأ فئة ومنتجًا وصورتين من UI الإدارة، وقرأ صورة WebP من origin API بتحميل فعلي وnaturalWidth أكبر من صفر، ثم أعاد تحميل الصفحة وفحصها مجددًا. حفظ شراء وحدتين من مخزون 9 وسعر 45,678، وفُقدت الاستجابة بعد الحفظ ثم استعيدت بمفتاح الطلب نفسه: طلب واحد، مخزون 7، subtotal 91,356. تسعير توصيل 12,000 من UI الإدارة أعطى total 103,356 وحالة CONFIRMED. لم تُرسل رسالة WhatsApp تلقائيًا. رفضت الإدارة والإيصال الوصول بلا صلاحيات.

آخر قاعدة متصفح معزولة: `pet_corner_browser_1792666694708_2695a08e_test`. [دليل الطلب الاصطناعي دون رموز خاصة](deployment-evidence/cross-origin-order.json). [metadata تجربة بناء المتجر](deployment-evidence/storefront-build-rehearsal.json) و[الإدارة](deployment-evidence/admin-build-rehearsal.json) تستخدم SHA وعناوين **fixtures اصطناعية فقط** لإثبات إعداد الحزمة، وليست روابط نشر أو خدمات موجودة. أُعيد بناء `dist` المحلي بعد التجربة لإزالة إعدادات التجربة من المعاينة المحلية.

## ما أصلحته التجربة والمراجعة

1. الصور النسبية كانت تُطلب من نطاق Pages بدل API؛ أُصلحت كل نقاط عرضها وmetadata واختُبرت عبر origins مختلفة.
2. أمر بناء الإدارة بالقيم المطلقة كشف توقعًا محليًا ثابتًا في اختبار الجلسة؛ أصبح التوقع يتحقق من origin البيئة والـendpoint الصحيح، مع الحفاظ على التحقق من Bearer والذاكرة فقط.
3. المراجعة المستقلة كشفت مرور `localhost.` وreserved IPv4 في حارس Pages؛ أُضيف اختبار أحمر ثم أُصلح الحارس وأصبح 8/8 أخضر.
4. حُذفت قاعدة SPA catch-all غير اللازمة؛ Pages يستخدم fallback الأصلي عند غياب `404.html` الجذرية، وتبقى API على عنوان HTTPS مستقل واضح.
5. تجربة npm ci على Windows واجهت قفل وحدة compiler بسبب Vite مفتوح؛ أُوقف فقط خادما الإدارة المحليان اللذان تم التحقق من مساريهما، وأُعيد التثبيت والبناء بنجاح ثم تشغيل الإدارة على 5175. هذه ليست مشكلة في حساب Cloudflare أو نشر تم تنفيذه.

## قواعد الإطلاق

فرع الإنتاج المعد في CI وRender والدليل هو **main**. لم يُنشأ Git remote؛ يختار المالك المستودع ويدفع المشروع ثم يربطه بالخدمات. الإعداد المقترح:

- Storefront Pages: root المستودع، `npm run pages:build:storefront`، output `dist`.
- Admin Pages مستقل: root المستودع نفسه، `npm run pages:build:admin`، output `admin/dist`.
- Backend Render: `render.yaml`، rootDir `api`، `npm run start:production`، **After CI Checks Pass**، health `/api/v1/health`.
- GitHub: حماية main مع PR وrequired **Quality checks** ومنع bypass الملائم. Pages native Git يبدأ بناءه مستقلاً ولا ينتظر تلقائيًا كل فحص GitHub آخر؛ حماية الفرع هي بوابة دمج المجموعة كاملة.

دليل القيم والغرض ومكانها في [Git deployment setup](git-deploy.md#variable-placement). المتجر يحتاج `VITE_API_BASE_URL` و`VITE_SITE_URL`؛ الإدارة تحتاج `VITE_ADMIN_API_BASE_URL` و`VITE_ADMIN_SITE_URL` و`VITE_STOREFRONT_URL` في إعدادات Pages Production، مع Node24. الأسرار وDATABASE_URL ومحددات CORS والتخزين على Backend فقط، ولا أسرار إنتاج مطلوبة في Workflow CI. رقم WhatsApp والسياسات تُحفظ من لوحة الإدارة في PostgreSQL.

## ما لا يزال خارج التحقق المحلي

لم يُنشأ مشروع Pages أو Render أو PostgreSQL خارجي، ولم يُسجّل دخول خارجي بعد التوجيه الأخير. لم يُنشأ حساب مدير حقيقي أو تُخترع بيانات تجارية. لم يُنفذ Push→Deploy أو فحص URL عام أو إصدار شهادة أو ربط DNS أو اختبار قرص استضافة/استعادة backup. ملفات النشر لا تثبت وجود هذه الموارد.

قالب Render يصف موارد **مدفوعة** وديسك صور دائمًا مرتبطًا بالخدمة، لكنه لا ينشئها دون ربط المالك. بقاء ملفات المسار عبر restart اختُبر محليًا؛ بقاء صور حقيقية عبر redeploy على المضيف يحتاج التجربة بعد الربط. `scripts/backup.ps1` مخصص لـCompose؛ لا يتظاهر بأنه ينسخ Render. لخدمات Render استخدم backup PostgreSQL الموثق ونسخة authenticated من uploads واختبر الاستعادة إلى هدف مستقل قبل اعتماد استعادة إنتاج. لا تُشغّل reset أو seed أو اختبارات DB على قاعدة تجارية.

المطلوب من المالك فقط: ربط Git والمشاريع، إدخال القيم الفعلية، تفعيل حماية main، إنشاء المدير والبيانات التجارية من البيئة المنشورة، ثم قبول دورة نشر واحدة ومقارنتها بالـSHA. [الدليل التنفيذي](git-deploy.md) يتضمن أوامر health/revision للقراءة فقط وفصل تجربة الشراء العامة عن اختبارات CI الآمنة.
