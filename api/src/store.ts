import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Order, OrderItem, Prisma } from '@prisma/client';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Database } from './database';
import { CartItemDto, CategoryDto, OrderDto, OrderQueryDto, ProductDto, ProductQueryDto, SettingsDto, StatusDto, UpdateCategoryDto, UpdateProductDto } from './dto';

const productInclude = { images: { orderBy: { position: 'asc' as const } }, category: true };
type FullProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>;
type FullOrder = Order & { items: OrderItem[] };
type Region = { id: string; name: string; fee: number };
const publicProduct = (p: FullProduct) => ({
  id: p.id, name: p.name, slug: p.slug, shortDescription: p.shortDescription, description: p.description,
  position: p.position, sku: p.sku, price: p.price, compareAtPrice: p.compareAtPrice, stock: p.stock, featured: p.featured,
  images: p.images.map(({ id, url, alt }) => ({ id, url, alt })),
  category: { id: p.category.id, name: p.category.name, slug: p.category.slug }, createdAt: p.createdAt.toISOString(),
});
const pageResult = <T>(items: T[], total: number, page: number, limit: number) => ({ items, total, page, limit, totalPages: Math.ceil(total / limit) });

@Injectable()
export class StoreService {
  constructor(private readonly db: Database) {}
  private publicCatalog(): Prisma.ProductWhereInput { return process.env.NODE_ENV === 'production' ? { isDemo: false } : {}; }
  async settings(admin = false) {
    const s = await this.db.storeSettings.upsert({ where: { id: 'store' }, update: {}, create: { id: 'store' } });
    const hideDemoSettings = !admin && process.env.NODE_ENV === 'production' && s.demoMode;
    return { storeName: s.storeName, currency: s.currency, currencyLabel: s.currencyLabel, demoMode: s.demoMode, codEnabled: s.codEnabled,
      checkoutEnabled: s.checkoutEnabled && s.codEnabled && !!s.whatsappNumber && !!s.deliveryPolicy.trim() && !(process.env.NODE_ENV === 'production' && s.demoMode), whatsappNumber: s.whatsappNumber, socialLinks: s.socialLinks, heroEyebrow: s.heroEyebrow, heroTitle: s.heroTitle, heroDescription: s.heroDescription, heroButtonText: s.heroButtonText, heroImageUrl: s.heroImageUrl, footerText: s.footerText, checkoutMessage: s.checkoutMessage, deliveryPolicy: s.deliveryPolicy, contactPhone: s.contactPhone, contactEmail: s.contactEmail, deliveryRegions: hideDemoSettings ? [] : s.deliveryRegions, pages: hideDemoSettings ? {} : s.pages };
  }
  async patchSettings(dto: SettingsDto) {
    const patch = Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)) as SettingsDto;
    if (Object.entries(patch).some(([key, value]) => value === null && !['contactPhone', 'contactEmail', 'whatsappNumber', 'heroImageUrl'].includes(key))) throw new BadRequestException('لا يمكن حذف قيمة هذا الإعداد');
    const current = await this.settings(true);
    const merged = { ...current, ...patch };
    const regions = merged.deliveryRegions as Region[];
    if (new Set(regions.map(r => r.id)).size !== regions.length) throw new BadRequestException('معرفات مناطق التوصيل يجب أن تكون فريدة');
    if (merged.checkoutEnabled && (!merged.codEnabled || !merged.whatsappNumber || !merged.deliveryPolicy.trim())) throw new BadRequestException('أضف رقم واتساب وسياسة التوصيل وفعّل الدفع عند الاستلام قبل تفعيل الطلبات');
    if (patch.pages) {
      if (Object.keys(patch.pages).length > 20) throw new BadRequestException('عدد الصفحات أكبر من الحد المسموح');
      for (const [key, value] of Object.entries(patch.pages)) {
        if (!/^[a-z][a-z0-9-]{0,49}$/.test(key) || !value || typeof value !== 'object' || Object.keys(value).some(k => !['title', 'body'].includes(k)) || typeof value.title !== 'string' || typeof value.body !== 'string' || !value.title.trim() || value.title.length > 200 || value.body.length > 30000) throw new BadRequestException('محتوى الصفحة غير صالح');
      }
    }
    await this.db.storeSettings.update({ where: { id: 'store' }, data: patch as Prisma.StoreSettingsUpdateInput });
    return this.settings(true);
  }
  async categories(admin = false) {
    const rows = await this.db.category.findMany({
      where: admin ? {} : { active: true, products: { some: { active: true, ...this.publicCatalog() } } }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { products: { where: admin ? {} : { active: true, ...this.publicCatalog() } } } } },
    });
    return rows.map(c => ({ id: c.id, name: c.name, slug: c.slug, image: c.image, position: c.position, productCount: c._count.products, ...(admin ? { active: c.active } : {}) }));
  }
  async products(query: ProductQueryDto, admin = false, category?: string) {
    if (query.minPrice !== undefined && query.maxPrice !== undefined && query.minPrice > query.maxPrice) throw new BadRequestException('نطاق السعر غير صالح');
    const where: Prisma.ProductWhereInput = {
      ...(admin ? {} : { active: true, ...this.publicCatalog(), category: { active: true } }),
      ...((category || query.category) ? { category: { slug: category || query.category, ...(admin ? {} : { active: true }) } } : {}),
      ...(query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { shortDescription: { contains: query.search, mode: 'insensitive' } }] } : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined ? { price: { gte: query.minPrice, lte: query.maxPrice } } : {}),
      ...(query.inStock === 'true' ? { stock: { gt: 0 } } : {}),
      ...(query.featured === 'true' ? { featured: true } : {}),
    };
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = query.sort === 'price-asc' ? [{ price: 'asc' }, { id: 'asc' }] : query.sort === 'price-desc' ? [{ price: 'desc' }, { id: 'asc' }] : [{ position: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }];
    const [rows, total] = await this.db.$transaction([this.db.product.findMany({ where, include: productInclude, skip: (query.page - 1) * query.limit, take: query.limit, orderBy }), this.db.product.count({ where })]);
    return pageResult(rows.map(p => ({ ...publicProduct(p), ...(admin ? { active: p.active } : {}) })), total, query.page, query.limit);
  }
  async product(slugOrId: string, admin = false) {
    const p = await this.db.product.findFirst({ where: admin ? { id: slugOrId } : { slug: slugOrId, active: true, ...this.publicCatalog(), category: { active: true } }, include: productInclude });
    if (!p) throw new NotFoundException('المنتج غير موجود');
    return { ...publicProduct(p), ...(admin ? { active: p.active } : {}) };
  }
  async cart(items: CartItemDto[]) {
    const products = await this.db.product.findMany({ where: { id: { in: items.map(i => i.productId) }, active: true, ...this.publicCatalog(), category: { active: true } }, include: productInclude });
    return { items: items.map(i => ({ product: products.find(p => p.id === i.productId) ? publicProduct(products.find(p => p.id === i.productId)!) : null, productId: i.productId, quantity: i.quantity })) };
  }
  async createCategory(dto: CategoryDto) {
    const c = await this.db.category.create({ data: dto });
    return { ...c, productCount: 0 };
  }
  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const c = await this.db.category.update({ where: { id }, data: dto });
    return { ...c, productCount: await this.db.product.count({ where: { categoryId: id } }) };
  }
  async removeCategory(id: string) { await this.db.category.update({ where: { id }, data: { active: false } }); return { message: 'تم إخفاء الفئة' }; }
  private checkCompare(price: number, compare?: number | null) {
    if (compare !== undefined && compare !== null && compare <= price) throw new BadRequestException('السعر السابق يجب أن يكون أعلى من السعر الحالي');
  }
  async createProduct(dto: ProductDto) {
    this.checkCompare(dto.price, dto.compareAtPrice);
    const { images, ...data } = dto;
    const p = await this.db.product.create({ data: { ...data, images: { create: images.map((i, position) => ({ ...i, position })) } }, include: productInclude });
    return { ...publicProduct(p), active: p.active };
  }
  async updateProduct(id: string, dto: UpdateProductDto) {
    const old = await this.db.product.findUnique({ where: { id } });
    if (!old) throw new NotFoundException('المنتج غير موجود');
    this.checkCompare(dto.price ?? old.price, dto.compareAtPrice === undefined ? old.compareAtPrice : dto.compareAtPrice);
    const { images, ...data } = dto;
    const p = await this.db.product.update({ where: { id }, data: { ...data, ...(images ? { images: { deleteMany: {}, create: images.map((i, position) => ({ ...i, position })) } } : {}) }, include: productInclude });
    return { ...publicProduct(p), active: p.active };
  }
  async removeProduct(id: string) { await this.db.product.update({ where: { id }, data: { active: false } }); return { message: 'تم إخفاء المنتج' }; }
  private token(id: string): string { return createHmac('sha256', process.env.ORDER_TOKEN_SECRET!).update(`receipt:${id}`).digest('base64url'); }
  private receipt(order: FullOrder) {
    return { id: order.id, orderCode: order.orderCode, accessToken: this.token(order.id), status: order.status, customerName: order.customerName, phone: order.phone,
      governorate: order.governorate, regionName: order.regionName, city: order.city, address: order.address, notes: order.notes,
      items: order.items.map(({ productId, name, price, quantity }) => ({ productId, name, price, quantity })),
      subtotal: order.subtotal, deliveryFee: order.deliveryFee, total: order.total, currency: order.currency, createdAt: order.createdAt.toISOString() };
  }
  private normalize(dto: OrderDto): { customerName: string; phone: string; governorate?: string; regionId?: string; city: string; address: string; notes: string | null; items: CartItemDto[] } {
    const merged = new Map<string, number>();
    for (const item of dto.items) merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
    const items = [...merged].map(([productId, quantity]) => ({ productId, quantity })).sort((a, b) => a.productId.localeCompare(b.productId));
    if (items.length === 0 || items.some(i => i.quantity > 100)) throw new BadRequestException('السلة فارغة أو الكمية تتجاوز الحد المسموح');
    if ((!dto.governorate && !dto.regionId) || (dto.governorate && dto.regionId)) throw new BadRequestException('حدد المحافظة فقط أو منطقة طلب سابق');
    return { customerName: dto.customerName, phone: dto.phone, ...(dto.governorate ? { governorate: dto.governorate } : { regionId: dto.regionId }), city: dto.city, address: dto.address, notes: dto.notes || null, items };
  }
  private async transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 6; attempt++) {
      try { return await this.db.$transaction(fn, { isolationLevel: 'Serializable', maxWait: 15000, timeout: 15000 }); }
      catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(e.code) && attempt < 5) { await new Promise(resolve => setTimeout(resolve, 20 * (attempt + 1))); continue; }
        throw e;
      }
    }
    throw new ConflictException('تعذر إتمام الطلب، يرجى المحاولة مجدداً');
  }
  async createOrder(dto: OrderDto, key?: string) {
    if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) throw new BadRequestException('يلزم مفتاح صالح لمنع تكرار الطلب');
    const normalized = this.normalize(dto);
    const payloadHash = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
    const order = await this.transaction(async tx => {
      const existing = await tx.order.findUnique({ where: { idempotencyKey: key }, include: { items: true } });
      if (existing) { if (existing.payloadHash !== payloadHash) throw new ConflictException('استُخدم مفتاح الطلب لبيانات مختلفة'); return existing; }
      const settings = await tx.storeSettings.findUnique({ where: { id: 'store' } });
      if (!settings?.checkoutEnabled || !settings.codEnabled || !settings.whatsappNumber || !settings.deliveryPolicy.trim() || (process.env.NODE_ENV === 'production' && settings.demoMode)) throw new ServiceUnavailableException('استقبال الطلبات غير متاح حالياً');
      const region = normalized.regionId ? (settings.deliveryRegions as Region[]).find(r => r.id === normalized.regionId) : undefined;
      if (normalized.regionId && !region) throw new BadRequestException('منطقة التوصيل غير متاحة');
      const governorate = normalized.governorate ?? region!.name;
      const snapshots: { productId: string; name: string; price: number; quantity: number }[] = [];
      let subtotal = 0;
      for (const item of normalized.items) {
        const p = await tx.product.findFirst({ where: { id: item.productId, active: true, ...this.publicCatalog(), category: { active: true } } });
        if (!p) throw new BadRequestException('يوجد منتج غير متاح في السلة');
        const changed = await tx.product.updateMany({ where: { id: p.id, active: true, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
        if (changed.count !== 1) throw new ConflictException({ message: `الكمية المتاحة من ${p.name} غير كافية`, code: 'OUT_OF_STOCK' });
        subtotal += p.price * item.quantity;
        snapshots.push({ productId: p.id, name: p.name, price: p.price, quantity: item.quantity });
      }
      if (!Number.isSafeInteger(subtotal) || subtotal > 2000000000) throw new BadRequestException('قيمة الطلب تتجاوز الحد المسموح');
      const id = randomUUID();
      return tx.order.create({ data: { id, orderCode: `PC-${randomUUID().replace(/-/g, '').slice(0, 14).toUpperCase()}`, idempotencyKey: key, payloadHash,
        customerName: normalized.customerName, phone: normalized.phone, regionId: region?.id ?? null, regionName: governorate, governorate, city: normalized.city, address: normalized.address,
        notes: normalized.notes, subtotal, deliveryFee: null, total: null, currency: settings.currency,
        items: { create: snapshots }, history: { create: { status: 'PENDING' } } }, include: { items: true } });
    });
    return { ...this.receipt(order), whatsappNumber: (await this.settings()).whatsappNumber };
  }
  async getReceipt(code: string, token?: string) {
    if (!token || token.length > 200) throw new UnauthorizedException('يلزم رابط الطلب الخاص');
    const order = await this.db.order.findUnique({ where: { orderCode: code }, include: { items: true } });
    const expected = order ? this.token(order.id) : this.token('missing');
    const supplied = Buffer.from(token);
    if (!order || supplied.length !== expected.length || !timingSafeEqual(supplied, Buffer.from(expected))) throw new UnauthorizedException('رابط الطلب غير صالح');
    return { ...this.receipt(order), whatsappNumber: (await this.settings()).whatsappNumber };
  }
  async orders(query: OrderQueryDto) {
    const where: Prisma.OrderWhereInput = { ...(query.status ? { status: query.status } : {}), ...(query.search ? { OR: ['orderCode', 'customerName', 'phone'].map(field => ({ [field]: { contains: query.search, mode: 'insensitive' } })) } : {}) };
    const [items, total] = await this.db.$transaction([this.db.order.findMany({ where, include: { items: true }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }), this.db.order.count({ where })]);
    const { whatsappNumber } = await this.settings();
    return pageResult(items.map(o => ({ ...this.receipt(o), whatsappNumber })), total, query.page, query.limit);
  }
  async order(id: string) {
    const order = await this.db.order.findUnique({ where: { id }, include: { items: true, history: { orderBy: { createdAt: 'asc' } }, deliveryHistory: { orderBy: { createdAt: 'asc' } } } });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    return { ...this.receipt(order), whatsappNumber: (await this.settings()).whatsappNumber, history: order.history, deliveryHistory: order.deliveryHistory };
  }
  async delivery(id: string, deliveryFee: number, adminId: string) {
    const order = await this.transaction(async tx => {
      const current = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!current) throw new NotFoundException('الطلب غير موجود');
      if (!['PENDING', 'CONFIRMED', 'PREPARING'].includes(current.status)) throw new ConflictException('لا يمكن تعديل التوصيل بعد الإرسال أو الإلغاء');
      if (current.deliveryFee === deliveryFee) return current;
      const total = current.subtotal + deliveryFee;
      if (!Number.isSafeInteger(total) || total > 2000000000) throw new BadRequestException('قيمة الطلب تتجاوز الحد المسموح');
      return tx.order.update({ where: { id }, data: { deliveryFee, total, deliveryHistory: { create: { previousFee: current.deliveryFee, deliveryFee, total, adminId } } }, include: { items: true } });
    });
    return { ...this.receipt(order), whatsappNumber: (await this.settings()).whatsappNumber };
  }
  async status(id: string, status: StatusDto['status'], adminId: string) {
    const next: Record<string, string> = { PENDING: 'CONFIRMED', CONFIRMED: 'PREPARING', PREPARING: 'OUT_FOR_DELIVERY', OUT_FOR_DELIVERY: 'DELIVERED' };
    const order = await this.transaction(async tx => {
      const current = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!current) throw new NotFoundException('الطلب غير موجود');
      if (current.status === status) return current;
      if (status === 'OUT_FOR_DELIVERY' && (current.deliveryFee === null || current.total === null)) throw new ConflictException('حدد تكلفة التوصيل قبل إرسال الطلب');
      const canCancel = status === 'CANCELLED' && ['PENDING', 'CONFIRMED', 'PREPARING'].includes(current.status);
      if (!canCancel && next[current.status] !== status) throw new ConflictException('انتقال حالة الطلب غير مسموح');
      await tx.order.update({ where: { id }, data: { status, ...(canCancel ? { inventoryRestored: true } : {}), history: { create: { status, adminId } } } });
      if (canCancel && !current.inventoryRestored) {
        for (const item of [...current.items].sort((a, b) => a.productId.localeCompare(b.productId))) await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }
      return tx.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
    });
    return { ...this.receipt(order), whatsappNumber: (await this.settings()).whatsappNumber };
  }
}
