import { randomBytes, randomUUID, scryptSync } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { expect, request as requestFactory, test, type APIRequestContext, type APIResponse, type Page, type TestInfo } from '@playwright/test'
import type { PrismaClient as FixtureDatabase } from '../api/node_modules/@prisma/client/index.js'
import type { OrderReceipt, Product, ProductPage } from '../src/lib/types'

const apiRequire = createRequire(resolve(process.cwd(), 'api/package.json'))
const apiOrigin = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:3002'
const adminOrigin = process.env.PLAYWRIGHT_ADMIN_URL || 'http://127.0.0.1:5177'
const fixtureKey = randomUUID().replace(/-/g, '').slice(0, 10)
const fixtureName = `منتج اختبار المتصفح ${fixtureKey}`
const categoryName = `فئة اختبار ${fixtureKey}`
const adminEmail = `browser-${fixtureKey}@example.invalid`
const password = randomBytes(36).toString('base64url')
const unitPrice = 45678
const widths = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440]
let api: APIRequestContext
let db: FixtureDatabase
let product: Product
let categoryId: string
let created: OrderReceipt

async function json<T>(response: Pick<APIResponse, 'status' | 'json'>, status = 200): Promise<T> {
  expect(response.status(), 'API response status').toBe(status)
  return response.json() as Promise<T>
}
async function evidence(info: TestInfo, name: string, value: unknown) {
  const path = info.outputPath(`${name}.json`)
  await writeFile(path, JSON.stringify(value, null, 2))
  await info.attach(name, { path, contentType: 'application/json' })
}
async function login(page: Page, target = '/orders') {
  await page.goto(`${adminOrigin}${target}`)
  await expect(page).toHaveURL(`${adminOrigin}/login`)
  await page.getByLabel('البريد الإلكتروني').fill(adminEmail)
  await page.getByLabel('كلمة المرور').fill(password)
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click()
  await expect(page.locator('main h1')).toBeVisible()
}
// Route through React Router while preserving the deliberately memory-only admin session.
async function spa(page: Page, path: string) {
  await page.evaluate(next => { history.pushState(null, '', next); window.dispatchEvent(new PopStateEvent('popstate')) }, path)
  await expect(page.locator('main h1')).toBeVisible()
}
async function theme(page: Page, value: string) {
  await page.setViewportSize({ width: 1440, height: 1000 })
  if (await page.locator('html').getAttribute('data-theme') !== value) {
    await page.getByRole('button', { name: value === 'dark' ? 'تفعيل الوضع الداكن' : 'تفعيل الوضع الفاتح', exact: true }).filter({ visible: true }).first().click()
  }
  await expect(page.locator('html')).toHaveAttribute('data-theme', value)
}
async function noOverflow(page: Page, width: number, route: string, mode: string) {
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }))
  expect(dimensions.document, `${route}, ${mode}, ${width}px document`).toBeLessThanOrEqual(dimensions.viewport + 1)
  expect(dimensions.body, `${route}, ${mode}, ${width}px body`).toBeLessThanOrEqual(dimensions.viewport + 1)
  return dimensions
}
async function matrix(page: Page, routes: string[], info: TestInfo, admin = false) {
  const checks = []
  for (const [index, route] of routes.entries()) {
    if (admin) await spa(page, route)
    else await page.goto(route)
    await expect(page.locator('main h1')).toBeVisible()
    await expect(page.locator('main .skeleton').first()).toHaveCount(0)
    for (const mode of ['light', 'dark']) {
      await theme(page, mode)
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 })
        checks.push({ route, theme: mode, width, ...await noOverflow(page, width, route, mode) })
        if ([320, 768, 1440].includes(width)) await page.screenshot({ path: info.outputPath(`${admin ? 'admin' : 'store'}-${index}-${mode}-${width}.png`), fullPage: true })
      }
    }
  }
  await evidence(info, admin ? 'admin-responsive-matrix' : 'store-responsive-matrix', checks)
}

test.describe('isolated storefront and independent administration', () => {
  test.describe.configure({ mode: 'serial' })
  test.beforeAll(async () => {
    const url = process.env.DATABASE_URL
    const marker = process.env.PET_CORNER_BROWSER_DB
    if (!url || !marker || !/^pet_corner_browser_\d+_[a-f0-9]+_test$/.test(marker) || new URL(url).pathname !== `/${marker}`) throw new Error('Run node scripts/test-browser.mjs. Fixtures require its newly created dedicated database.')
    if (apiOrigin !== 'http://127.0.0.1:3002' || adminOrigin !== 'http://127.0.0.1:5177') throw new Error('Browser tests require isolated service ports.')
    api = await requestFactory.newContext()
    const PrismaClient = apiRequire('@prisma/client').PrismaClient
    db = new PrismaClient()
    const salt = randomBytes(24).toString('hex')
    const hash = scryptSync(password, salt, 64).toString('hex')
    await db.admin.create({ data: { email: adminEmail, passwordHash: `scrypt:${salt}:${hash}` } })
  })
  test.afterAll(async () => { await api?.dispose(); await db?.$disconnect() })

  test('admin creates category and ordered uploaded images; real purchase appears and is quoted in dashboard', async ({ page, context, browser }, info) => {
    test.setTimeout(150_000)
    const dashboard = await context.newPage()
    await login(dashboard)
    await expect(dashboard.getByRole('heading', { name: 'بانتظار أول طلب' })).toBeVisible()
    await spa(dashboard, '/settings')
    await dashboard.getByLabel('رقم واتساب المتجر').fill('15555550100')
    await dashboard.getByRole('textbox', { name: 'سياسة التوصيل', exact: true }).fill('سياسة اختبار معزولة: نراجع عنوان العميل ونؤكد تكلفة التوصيل عبر واتساب قبل التجهيز.')
    await dashboard.getByLabel('عنوان الرئيسية').fill('عناية مدروسة لرفيقك')
    await dashboard.getByLabel('نص التذييل').fill('محتوى محفوظ من لوحة الإدارة ضمن الاختبار المعزول.')
    await dashboard.getByRole('checkbox', { name: /^الدفع عند الاستلام/ }).check()
    await dashboard.getByRole('checkbox', { name: /^استقبال الطلبات/ }).check()
    await dashboard.getByRole('button', { name: 'حفظ إعدادات المتجر', exact: true }).click()
    await expect(dashboard.getByRole('status')).toContainText('تم حفظ إعدادات المتجر بنجاح')
    await spa(dashboard, '/categories/new')
    await dashboard.getByLabel('اسم الفئة').fill(categoryName)
    await dashboard.getByLabel('الرابط المختصر (Slug)').fill(`browser-category-${fixtureKey}`)
    const categoryResponse = dashboard.waitForResponse(r => r.url().endsWith('/admin/categories') && r.request().method() === 'POST')
    await dashboard.getByRole('button', { name: 'إنشاء الفئة', exact: true }).click()
    categoryId = (await json<{ id: string }>(await categoryResponse, 201)).id
    await expect(dashboard.getByRole('link', { name: categoryName, exact: true })).toBeVisible()
    await spa(dashboard, '/products/new')
    await dashboard.getByLabel('اسم المنتج').fill(fixtureName)
    await dashboard.getByLabel('الرابط المختصر (Slug)').fill(`browser-product-${fixtureKey}`)
    await dashboard.getByLabel('وصف مختصر').fill('منتج مستقل مخصص للتحقق الآلي من رحلة الشراء.')
    await dashboard.getByLabel('الوصف التفصيلي').fill('بيانات اختبار معزولة لا تخص المخزون التجاري. نتحقق من رفع الصور وترتيبها وحفظ سعر المنتج ومخزونه.')
    await dashboard.getByLabel('السعر الحالي').fill(String(unitPrice))
    await dashboard.getByLabel('الكمية المتاحة').fill('9')
    await dashboard.getByLabel('رمز المنتج (SKU)').fill(`BROWSER-${fixtureKey}`)
    await dashboard.getByLabel('الفئة').selectOption(categoryId)
    await dashboard.getByRole('checkbox', { name: /^منتج مميز/ }).check()
    const sharp = apiRequire('sharp')
    for (const [index, color] of ['#103f6b', '#e8bf82'].entries()) {
      const buffer = await sharp({ create: { width: 320, height: 320, channels: 3, background: color } }).png().toBuffer()
      const uploaded = dashboard.waitForResponse(r => r.url().endsWith('/admin/uploads') && r.request().method() === 'POST')
      await dashboard.getByLabel('رفع صورة').setInputFiles({ name: `fixture-${index + 1}.png`, mimeType: 'image/png', buffer })
      await json(await uploaded, 201)
      await expect(dashboard.getByLabel(`وصف الصورة ${index + 1}`)).toBeVisible()
    }
    await dashboard.getByLabel('وصف الصورة 1').fill('صورة الاختبار الأولى')
    await dashboard.getByLabel('وصف الصورة 2').fill('صورة الاختبار الثانية')
    await dashboard.getByRole('button', { name: 'تقديم الصورة 2', exact: true }).click()
    await expect(dashboard.getByLabel('وصف الصورة 1')).toHaveValue('صورة الاختبار الثانية')
    const productResponse = dashboard.waitForResponse(r => r.url().endsWith('/admin/products') && r.request().method() === 'POST')
    await dashboard.getByRole('button', { name: 'إنشاء المنتج', exact: true }).click()
    product = await json<Product>(await productResponse, 201)
    expect(product.images.map(image => image.alt)).toEqual(['صورة الاختبار الثانية', 'صورة الاختبار الأولى'])
    expect(product.images.every(image => image.url.startsWith('/uploads/') && image.url.endsWith('.webp'))).toBe(true)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'عناية مدروسة لرفيقك', exact: true })).toBeVisible()
    await expect(page.getByText('محتوى محفوظ من لوحة الإدارة ضمن الاختبار المعزول.', { exact: true })).toBeVisible()
    await page.goto(`/product/${product.slug}`)
    await expect(page.getByRole('heading', { name: fixtureName, exact: true })).toBeVisible()
    // Independent frontend/API origins: legacy relative upload records must load from the API.
    const uploadedImage = page.locator('.detail-image img')
    await expect(uploadedImage).toHaveAttribute('src', `${apiOrigin}${product.images[0].url}`)
    await expect.poll(() => uploadedImage.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    const imageResponse = await api.get(`${apiOrigin}${product.images[0].url}`)
    expect(imageResponse.status()).toBe(200)
    expect(imageResponse.headers()['content-type']).toContain('image/webp')
    await page.reload()
    await expect(page.locator('.detail-image img')).toHaveAttribute('src', `${apiOrigin}${product.images[0].url}`)
    await expect.poll(() => page.locator('.detail-image img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    await page.getByRole('button', { name: 'أضف إلى السلة', exact: true }).click()
    await page.goto('/cart')
    await page.getByRole('button', { name: `زيادة كمية ${fixtureName}`, exact: true }).click()
    await page.getByRole('link', { name: 'إكمال الطلب', exact: true }).click()
    await page.getByLabel('الاسم الكامل').fill('عميل اختبار المتصفح')
    await page.getByLabel('رقم الهاتف').fill('0912345678')
    await page.getByLabel('المحافظة').selectOption('دمشق')
    await page.getByLabel('المدينة أو البلدة').fill('دمشق')
    await page.getByLabel('العنوان التفصيلي').fill('عنوان اختبار معزول، بناء الاختبار، الطابق الأول')
    await expect(page.getByText('تُحدّد بعد المراجعة', { exact: true })).toBeVisible()
    await expect(page.getByText('الإجمالي النهائي', { exact: true })).toHaveCount(0)
    let whatsappRequests = 0
    context.on('request', request => { if (/wa\.me|whatsapp\.com/.test(request.url())) whatsappRequests++ })
    // Lose the response after the server saves it, then replay through the recovery UI.
    let intercepted = false
    let firstKey: string | undefined
    await page.route('**/api/v1/storefront/orders', async route => {
      if (route.request().method() !== 'POST' || intercepted) return route.continue()
      intercepted = true
      firstKey = route.request().headers()['idempotency-key']
      const response = await route.fetch()
      created = await response.json()
      await route.abort('failed')
    })
    await page.getByRole('button', { name: 'تأكيد الطلب', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'لم تتأكد نتيجة الطلب السابق بعد' })).toBeVisible()
    await page.unrouteAll({ behavior: 'wait' })
    await expect(page.getByRole('button', { name: 'التحقق من الطلب السابق', exact: true })).toBeEnabled()
    const replay = page.waitForResponse(r => r.url().endsWith('/storefront/orders') && r.request().method() === 'POST')
    await page.getByRole('button', { name: 'التحقق من الطلب السابق', exact: true }).click()
    const replayResponse = await replay
    expect(replayResponse.request().headers()['idempotency-key']).toBe(firstKey)
    expect((await json<OrderReceipt>(replayResponse, 201)).id).toBe(created.id)
    await expect(page.getByRole('heading', { name: 'تم استلام طلبك', exact: true })).toBeVisible()
    expect(created.deliveryFee).toBeNull()
    expect(created.total).toBeNull()
    expect(created.subtotal).toBe(unitPrice * 2)
    expect(created.items).toEqual([{ productId: product.id, name: fixtureName, price: unitPrice, quantity: 2 }])
    expect(await db.order.count()).toBe(1)
    expect((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(7)
    expect(await page.evaluate(() => localStorage.getItem('pet-corner:cart'))).toBe('[]')
    const whatsapp = page.getByRole('link', { name: 'متابعة الطلب عبر واتساب', exact: true })
    const messageUrl = new URL((await whatsapp.getAttribute('href'))!)
    expect(messageUrl.hostname).toBe('wa.me')
    expect(messageUrl.pathname).toBe('/15555550100')
    expect(messageUrl.searchParams.get('text')).toContain(created.orderCode)
    expect(messageUrl.searchParams.get('text')).toContain(fixtureName)
    expect(messageUrl.searchParams.get('text')).toContain('قيد التأكيد')
    await expect(page.getByText('تفتح الرسالة جاهزة في واتساب، وعليك إرسالها بنفسك.', { exact: false })).toBeVisible()
    expect(whatsappRequests).toBe(0)
    await spa(dashboard, '/orders')
    await dashboard.getByLabel('البحث في الطلبات').fill(created.orderCode)
    await dashboard.getByRole('button', { name: 'بحث', exact: true }).click()
    await dashboard.getByRole('link', { name: created.orderCode, exact: true }).click()
    await dashboard.getByLabel('تكلفة التوصيل الفعلية').fill('12000')
    await dashboard.getByRole('button', { name: 'حفظ تكلفة التوصيل', exact: true }).click()
    await expect(dashboard.getByRole('status')).toContainText('تم حفظ تكلفة التوصيل')
    await dashboard.getByLabel('الحالة التالية').selectOption('CONFIRMED')
    await dashboard.getByRole('button', { name: 'تحديث حالة الطلب', exact: true }).click()
    await expect(dashboard.getByRole('status')).toContainText('تم تحديث حالة الطلب')
    await page.getByRole('button', { name: 'تحديث حالة الطلب', exact: true }).click()
    await expect(page.getByText('تم التأكيد', { exact: true })).toBeVisible()
    await expect(page.getByText('الإجمالي النهائي', { exact: true })).toBeVisible()
    const persisted = await db.order.findUniqueOrThrow({ where: { id: created.id }, include: { deliveryHistory: true } })
    expect(persisted.deliveryFee).toBe(12000)
    expect(persisted.total).toBe(103356)
    expect(persisted.status).toBe('CONFIRMED')
    expect(persisted.deliveryHistory).toHaveLength(1)
    expect(whatsappRequests).toBe(0)
    expect(new URL((await whatsapp.getAttribute('href'))!).searchParams.get('text')).toContain('الإجمالي النهائي')
    expect((await api.get(`${apiOrigin}/api/v1/admin/orders`)).status()).toBe(401)
    expect((await api.patch(`${apiOrigin}/api/v1/admin/orders/${created.id}/delivery`, { data: { deliveryFee: 0 } })).status()).toBe(401)
    expect((await api.get(`${apiOrigin}/api/v1/storefront/orders/${created.orderCode}`)).status()).toBe(401)
    const privateContext = await browser.newContext()
    try { const outsider = await privateContext.newPage(); await outsider.goto(page.url()); await expect(outsider.getByRole('heading', { name: 'الإيصال خاص بصاحب الطلب' })).toBeVisible() } finally { await privateContext.close() }
    await evidence(info, 'persisted-order-no-private-token', { orderCode: created.orderCode, product: fixtureName, quantity: 2, subtotal: persisted.subtotal, deliveryFee: persisted.deliveryFee, total: persisted.total, status: persisted.status, ordersAfterReplay: 1, stock: 7, whatsappRequests })
    await page.screenshot({ path: info.outputPath('confirmed-receipt.png'), fullPage: true })
    await dashboard.screenshot({ path: info.outputPath('quoted-admin-order.png'), fullPage: true })
    await dashboard.close()
  })

  test('light default, saved theme, splash removal and keyboard-controlled mobile drawer', async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 390, height: 850 })
    let startReact!: () => void
    const initialization = new Promise<void>(resolveStart => { startReact = resolveStart })
    await page.route('**/src/main.tsx*', async route => { await initialization; await route.continue() })
    try {
      await page.goto('/', { waitUntil: 'commit' })
      await expect(page.locator('#startup-splash')).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
      await page.screenshot({ path: info.outputPath('initial-splash-reduced-motion.png') })
      await expect(page.getByRole('button', { name: 'إعادة تحميل المتجر', exact: true })).toBeVisible({ timeout: 12_000 })
    } finally { startReact() }
    await page.unrouteAll({ behavior: 'wait' })
    await expect(page.locator('main h1')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(page.locator('#startup-splash')).toHaveCount(0)
    await page.getByRole('button', { name: 'تفعيل الوضع الداكن', exact: true }).first().click()
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    const opener = page.getByRole('button', { name: 'فتح القائمة', exact: true })
    await opener.click()
    const drawer = page.getByRole('dialog', { name: 'قائمة المتجر' })
    await expect(drawer).toBeVisible()
    await page.screenshot({ path: info.outputPath('store-drawer-dark-mobile.png') })
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
    await page.keyboard.press('Escape')
    await expect(drawer).not.toBeVisible()
    await expect(opener).toBeFocused()
    await opener.click()
    await page.mouse.click(2, 400)
    await expect(drawer).not.toBeVisible()
    await opener.click()
    await drawer.getByRole('link', { name: 'جميع المنتجات', exact: true }).click()
    await expect(page).toHaveURL(/\/shop$/)
    await expect(drawer).not.toBeVisible()
    const favicon = await page.locator('link[rel="icon"]').first().getAttribute('href')
    expect((await page.request.get(favicon!)).ok()).toBe(true)
  })

  test('catalog filters, skeletons, empty and retry states use real requests', async ({ page }) => {
    let release!: () => void
    const gate = new Promise<void>(resolveGate => { release = resolveGate })
    await page.route('**/api/v1/storefront/products?**', async route => { await gate; await route.continue() })
    try { await page.goto('/shop', { waitUntil: 'domcontentloaded' }); await expect(page.locator('.product-grid[aria-busy="true"]')).toBeVisible() } finally { release() }
    await expect(page.locator('.catalog-results .product-card h3').first()).toBeVisible()
    await page.unroute('**/api/v1/storefront/products?**')
    await page.getByRole('textbox', { name: 'ابحث في المتجر' }).fill(`missing-${fixtureKey}`)
    await page.locator('.catalog-search').getByRole('button', { name: 'بحث', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'لم نجد ما تبحث عنه' })).toBeVisible()
    await page.getByRole('textbox', { name: 'ابحث في المتجر' }).fill('')
    await page.locator('.catalog-search').getByRole('button', { name: 'بحث', exact: true }).click()
    await expect(page).not.toHaveURL(/search=/)
    await expect(page.locator('.catalog-results .product-card h3').first()).toBeVisible()
    const sortedResponse = page.waitForResponse(r => new URL(r.url()).searchParams.get('sort') === 'price-asc')
    await page.getByRole('combobox', { name: 'ترتيب حسب' }).selectOption('price-asc')
    const sorted = await json<ProductPage>(await sortedResponse)
    expect(sorted.total).toBeGreaterThan(0)
    expect(sorted.items.map(item => item.price)).toEqual(sorted.items.map(item => item.price).sort((a, b) => a - b))
    await expect(page.locator('.catalog-results .product-card h3')).toHaveText(sorted.items.map(item => item.name))
    if (sorted.totalPages > 1) {
      const nextResponse = page.waitForResponse(r => new URL(r.url()).searchParams.get('page') === '2')
      await page.getByRole('button', { name: 'الصفحة التالية', exact: true }).click()
      const next = await json<ProductPage>(await nextResponse)
      await expect(page.locator('.catalog-results .product-card h3')).toHaveText(next.items.map(item => item.name))
    }
    const categoryResponse = page.waitForResponse(r => new URL(r.url()).searchParams.get('category') === product.category.slug)
    await page.getByRole('radio', { name: new RegExp(`^${categoryName}`) }).click()
    const filtered = await json<ProductPage>(await categoryResponse)
    expect(filtered.items.every(item => item.category.id === categoryId)).toBe(true)
    await page.getByRole('spinbutton', { name: 'من', exact: true }).fill('50000')
    await page.getByRole('spinbutton', { name: 'إلى', exact: true }).fill('30000')
    await page.getByRole('button', { name: 'تطبيق السعر', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('الأدنى')
    expect(new URL(page.url()).searchParams.has('minPrice')).toBe(false)
    await page.getByRole('spinbutton', { name: 'من', exact: true }).fill('0')
    await page.getByRole('spinbutton', { name: 'إلى', exact: true }).fill('100000000')
    const pricedResponse = page.waitForResponse(r => new URL(r.url()).searchParams.get('maxPrice') === '100000000')
    await page.getByRole('button', { name: 'تطبيق السعر', exact: true }).click()
    await json<ProductPage>(await pricedResponse)
    await page.route('**/api/v1/storefront/products?**', route => route.abort('failed'))
    await page.getByRole('combobox', { name: 'ترتيب حسب' }).selectOption('price-desc')
    await expect(page.locator('.catalog-results').getByRole('heading', { name: 'تعذّر تحميل المحتوى' })).toBeVisible()
    await page.unroute('**/api/v1/storefront/products?**')
    await page.getByRole('button', { name: 'إعادة المحاولة', exact: true }).click()
    await expect(page.locator('.catalog-results .product-card h3').first()).toBeVisible()
  })

  test('all storefront routes and populated commerce fit nine widths in both themes', async ({ page }, info) => {
    test.setTimeout(300_000)
    await page.goto('/')
    await page.evaluate(({ productId, code, token }) => {
      localStorage.setItem('pet-corner:cart', JSON.stringify([{ productId, quantity: 1 }]))
      sessionStorage.setItem(`pet-corner:receipt:${code}`, token)
    }, { productId: product.id, code: created.orderCode, token: created.accessToken })
    await matrix(page, ['/', '/shop', `/category/${product.category.slug}`, `/product/${product.slug}`, '/cart', '/checkout', `/order-success/${created.orderCode}`, '/about', '/contact', '/faq', '/shipping', '/privacy', '/terms', '/page-not-found'], info)
  })

  test('admin authentication, loading, errors and all routes fit nine widths and both themes', async ({ page }, info) => {
    test.setTimeout(300_000)
    await page.goto(`${adminOrigin}/products`)
    await expect(page).toHaveURL(`${adminOrigin}/login`)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    for (const mode of ['light', 'dark']) {
      await theme(page, mode)
      for (const width of widths) { await page.setViewportSize({ width, height: 1000 }); await noOverflow(page, width, '/login', mode) }
      await page.screenshot({ path: info.outputPath(`admin-login-${mode}.png`), fullPage: true })
    }
    await login(page)
    let release!: () => void
    const gate = new Promise<void>(resolveGate => { release = resolveGate })
    await page.route('**/api/v1/admin/categories', async route => { await gate; await route.continue() })
    try { await spa(page, '/categories'); await expect(page.getByRole('status', { name: 'جارٍ تحميل البيانات', exact: true })).toBeVisible() } finally { release() }
    await expect(page.getByRole('link', { name: categoryName, exact: true })).toBeVisible()
    await page.unroute('**/api/v1/admin/categories')
    await page.route('**/api/v1/admin/products?**', route => route.abort('failed'))
    await spa(page, '/products')
    await expect(page.getByRole('alert')).toBeVisible()
    await page.unroute('**/api/v1/admin/products?**')
    await page.getByRole('button', { name: 'إعادة المحاولة', exact: true }).click()
    await expect(page.getByRole('link', { name: new RegExp(fixtureName) }).first()).toBeVisible()
    await page.setViewportSize({ width: 390, height: 900 })
    await page.getByRole('button', { name: 'فتح قائمة الإدارة', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'قائمة الإدارة', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'قائمة الإدارة', exact: true })).not.toBeVisible()
    await matrix(page, ['/orders', `/orders/${created.id}`, '/products', '/products/new', `/products/${product.id}`, '/categories', '/categories/new', `/categories/${categoryId}`, '/settings', '/not-found'], info, true)
    const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))
    expect(stored).not.toContain('accessToken')
    expect(stored).not.toContain(password)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click()
    await expect(page).toHaveURL(`${adminOrigin}/login`)
    await page.getByRole('button', { name: 'تفعيل الوضع الفاتح', exact: true }).click()
    await page.getByRole('button', { name: 'تفعيل الوضع الداكن', exact: true }).click()
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})



