import { OpenAPIObject, SchemaObject } from '@nestjs/swagger';

export function documentResponses(document: OpenAPIObject): OpenAPIObject {
  const string: SchemaObject = { type: 'string' };
  const money: SchemaObject = { type: 'integer', minimum: 0 };
  const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
  const object = (properties: Record<string, SchemaObject | { $ref: string }>): SchemaObject => ({ type: 'object', required: Object.keys(properties), properties });
  const array = (items: SchemaObject | { $ref: string }): SchemaObject => ({ type: 'array', items });
  const page = (item: string) => object({ items: array(ref(item)), total: money, page: { type: 'integer', minimum: 1 }, limit: { type: 'integer', minimum: 1 }, totalPages: money });
  const schemas: Record<string, SchemaObject> = {
    Product: object({ id: string, name: string, slug: string, shortDescription: string, description: string, position: money, sku: { type: 'string', nullable: true }, price: money,
      compareAtPrice: { ...money, nullable: true }, stock: money, featured: { type: 'boolean' }, images: array(object({ id: string, url: string, alt: string })), category: object({ id: string, name: string, slug: string }), createdAt: { type: 'string', format: 'date-time' } }),
    Category: object({ id: string, name: string, slug: string, position: money, image: { type: 'string', nullable: true }, productCount: money }),
    ProductPage: page('Product'),
    StoreSettings: object({ storeName: string, currency: string, currencyLabel: string, demoMode: { type: 'boolean' }, codEnabled: { type: 'boolean' }, checkoutEnabled: { type: 'boolean' }, contactPhone: { type: 'string', nullable: true }, contactEmail: { type: 'string', nullable: true }, deliveryRegions: array(object({ id: string, name: string, fee: money })), pages: { type: 'object', additionalProperties: object({ title: string, body: string }) } }),
    OrderReceipt: object({ id: string, orderCode: string, accessToken: string, whatsappNumber: { ...string, nullable: true }, status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'] }, customerName: string, phone: string, governorate: string, regionName: string, city: string, address: string, notes: { type: 'string', nullable: true }, items: array(object({ productId: string, name: string, price: money, quantity: { type: 'integer', minimum: 1 } })), subtotal: money, deliveryFee: { ...money, nullable: true }, total: { ...money, nullable: true }, currency: string, createdAt: { type: 'string', format: 'date-time' } }),
    OrderPage: page('OrderReceipt'),
    SafeError: object({ message: { oneOf: [string, array(string)] } }),
    CartValidation: object({ items: array(object({ product: { ...ref('Product'), nullable: true } as SchemaObject, productId: string, quantity: { type: 'integer', minimum: 1 } })) }),
  };
  Object.assign(schemas.StoreSettings.properties!, {
    whatsappNumber: { type: 'string', nullable: true }, socialLinks: array(object({ label: string, url: { type: 'string', format: 'uri' } })),
    heroEyebrow: string, heroTitle: string, heroDescription: string, heroButtonText: string, heroImageUrl: { type: 'string', nullable: true },
    footerText: string, checkoutMessage: string, deliveryPolicy: string,
  });
  schemas.StoreSettings.required = Object.keys(schemas.StoreSettings.properties!);
  schemas.OrderDetail = { allOf: [ref('OrderReceipt'), object({
    history: array(object({ id: string, orderId: string, status: string, adminId: { ...string, nullable: true }, createdAt: { ...string, format: 'date-time' } })),
    deliveryHistory: array(object({ id: string, orderId: string, previousFee: { ...money, nullable: true }, deliveryFee: money, total: money, adminId: string, createdAt: { ...string, format: 'date-time' } })),
  })] };
  document.components ??= {};
  document.components.schemas = { ...document.components.schemas, ...schemas };
  for (const [path, entry] of Object.entries(document.paths)) {
    for (const [verb, operation] of Object.entries(entry)) {
      if (!operation || typeof operation !== 'object' || !('responses' in operation)) continue;
      let schema: SchemaObject | { $ref: string } | undefined;
      if (path.includes('/settings')) schema = ref('StoreSettings');
      else if (path.endsWith('/health')) schema = object({ status: { type: 'string', enum: ['ok'] } });
      else if (path.endsWith('/auth/me')) schema = object({ id: string, email: string, role: { type: 'string', enum: ['ADMIN'] } });
      else if (path.endsWith('/auth/login')) schema = object({ accessToken: string });
      else if (path.endsWith('/uploads')) schema = object({ url: string });
      else if (path.endsWith('/cart/validate')) schema = ref('CartValidation');
      else if (path.includes('/orders')) schema = path.endsWith('/admin/orders') && verb === 'get' ? ref('OrderPage') : path.endsWith('/admin/orders/{id}') && verb === 'get' ? ref('OrderDetail') : ref('OrderReceipt');
      else if (path.includes('/products')) schema = verb === 'get' && !path.endsWith('/{slug}') && !path.endsWith('/{id}') ? ref('ProductPage') : ref('Product');
      else if (path.includes('/categories')) schema = verb === 'get' && !path.endsWith('/{id}') ? array(ref('Category')) : ref('Category');
      if (verb === 'delete') schema = object({ message: string });
      const responses = operation.responses as Record<string, unknown>;
      if (schema) responses[verb === 'post' ? '201' : '200'] = { description: 'Success', content: { 'application/json': { schema } } };
      for (const code of ['400', '401', '404', '409', '429', '503']) responses[code] = { description: 'Safe Arabic error', content: { 'application/json': { schema: ref('SafeError') } } };
    }
  }
  return document;
}
