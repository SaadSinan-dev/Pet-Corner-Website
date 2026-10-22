import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seeding is disabled in production.');
  const current = await db.storeSettings.findUnique({ where: { id: 'store' } });
  if (!current?.demoMode && await db.product.count() > 0) throw new Error('Refusing to turn an existing non-demo catalog into a demo store.');
  const pages = {
    about: { title: 'عن Pet Corner', body: 'Pet Corner متجر لمستلزمات القطط والكلاب. هذا الكتالوج تجريبي لتوضيح تجربة التسوق، ويجب استبدال المنتجات والأسعار ببيانات المتجر الفعلية قبل الإطلاق.' },
    contact: { title: 'تواصل معنا', body: 'يمكن إضافة رقم الهاتف والبريد الإلكتروني من إعدادات الإدارة. بيانات التواصل لم تُضف بعد في هذا المتجر التجريبي.' },
    faq: { title: 'الأسئلة الشائعة', body: 'كيف أطلب؟ اختر المنتجات ثم أكمل بيانات التوصيل. كيف أدفع؟ الدفع عند الاستلام عندما يكون مفعّلاً. كيف أتابع الطلب؟ احتفظ برابط التأكيد الخاص بك.' },
    shipping: { title: 'التوصيل والاستبدال', body: 'هذه سياسة تجريبية. تحدد تكلفة التوصيل والإجمالي بعد مراجعة الطلب عبر واتساب. يجب اعتماد سياسة المتجر الفعلية قبل الإطلاق.' },
    privacy: { title: 'الخصوصية', body: 'نستخدم الاسم ورقم الهاتف وعنوان التوصيل لمعالجة الطلب. رابط تأكيد الطلب خاص بك؛ لا تشاركه. يجب اعتماد سياسة الخصوصية النهائية للمتجر قبل الإطلاق.' },
    terms: { title: 'الشروط والأحكام', body: 'هذه نسخة تجريبية. يحسب الخادم السعر والمخزون عند إرسال الطلب. يجب تأكيد توافر المنتجات وتفاصيل التوصيل مع المتجر وفق السياسة المعتمدة قبل الإطلاق التجاري.' },
  };
  await db.storeSettings.upsert({ where: { id: 'store' }, update: {}, create: { id: 'store' } });
  await db.storeSettings.update({ where: { id: 'store' }, data: { demoMode: true, codEnabled: true, checkoutEnabled: true, currency: 'SYP', currencyLabel: 'ل.س', deliveryRegions: [{ id: 'damascus', name: 'دمشق', fee: 15000 }, { id: 'rural-damascus', name: 'ريف دمشق', fee: 20000 }, { id: 'aleppo', name: 'حلب', fee: 25000 }], pages } });
  const categories = [
    ['cat-food', 'طعام القطط', 'product-food'], ['cat-supplies', 'مستلزمات القطط', 'product-bowl'],
    ['dog-food', 'طعام الكلاب', 'product-food'], ['dog-supplies', 'مستلزمات الكلاب', 'product-bowl'],
    ['toys', 'الألعاب', 'product-toy'], ['care', 'العناية والنظافة', 'product-care'], ['accessories', 'الإكسسوارات', 'product-bowl'],
  ];
  const names: Record<string, string[]> = {
    'cat-food': ['طعام القطط البالغة', 'طعام القطط الصغيرة'], 'cat-supplies': ['وعاء طعام للقطط', 'صندوق رمل للقطط'],
    'dog-food': ['طعام الكلاب البالغة', 'طعام الجراء'], 'dog-supplies': ['وعاء طعام للكلاب', 'سرير مريح للكلاب'],
    toys: ['كرة لعب للحيوانات الأليفة', 'لعبة حبل للكلاب'], care: ['فرشاة للعناية بالفراء', 'شامبو للحيوانات الأليفة'], accessories: ['طوق قابل للتعديل', 'مقود للمشي اليومي'],
  };
  let count = 0;
  for (const [slug, name, image] of categories) {
    const category = await db.category.upsert({ where: { slug }, update: {}, create: { slug, name, image: `/images/${image}.svg` } });
    for (const [index, title] of names[slug].entries()) {
      const productSlug = `pet-corner-${slug}-${index + 1}`;
      await db.product.upsert({ where: { slug: productSlug }, update: {}, create: {
        name: `Pet Corner — ${title}`, slug: productSlug, sku: `DEMO-${slug.toUpperCase()}-${index + 1}`, categoryId: category.id,
        shortDescription: 'منتج تجريبي من Pet Corner، لاستكشاف تجربة التسوق.',
        description: `${title} ضمن كتالوج Pet Corner التجريبي. الصورة توضيحية، والسعر وبيانات المخزون لأغراض التجربة. يجب استبدال هذه البيانات بالمواصفات الفعلية للمنتج قبل إطلاق المتجر.`,
        isDemo: true, price: 35000 + count * 12500, stock: 24 + count, featured: count % 2 === 0,
        images: { create: { url: `/images/${image}.svg`, alt: title } },
      } });
      count++;
    }
  }
  process.stdout.write(`Explicit demo seed completed: ${count} products, 7 categories.\n`);
}
main().catch((e: unknown) => { process.stderr.write(`${e instanceof Error ? e.message : 'Demo seed failed'}\n`); process.exitCode = 1; }).finally(async () => db.$disconnect());
