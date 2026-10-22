export interface ProductImage { id: string; url: string; alt: string }
export interface Category { id: string; name: string; slug: string; image: string | null; productCount: number; position?: number }
export interface Product {
  id: string; name: string; slug: string; shortDescription: string; description: string;
  sku: string | null; price: number; compareAtPrice: number | null; stock: number; featured: boolean;
  images: ProductImage[]; category: Pick<Category, 'id' | 'name' | 'slug'>; createdAt: string; position?: number;
}
export interface ProductPage { items: Product[]; total: number; page: number; limit: number; totalPages: number }
export interface StoreSettings {
  storeName: string; currency: string; currencyLabel: string; demoMode: boolean; codEnabled: boolean;
  checkoutEnabled: boolean; contactPhone: string | null; contactEmail: string | null;
  deliveryRegions?: { id: string; name: string; fee: number }[];
  whatsappNumber?: string | null; socialLinks?: { label: string; url: string }[];
  heroEyebrow?: string; heroTitle?: string; heroDescription?: string; heroButtonText?: string;
  heroImageUrl?: string | null; footerText?: string; checkoutMessage?: string; deliveryPolicy?: string;
  pages: Record<string, { title: string; body: string }>;
}
export interface CartLine { productId: string; quantity: number }
export interface ValidatedCart { items: { product: Product | null; productId: string; quantity: number }[] }
interface CustomerOrderInput { customerName: string; phone: string; city: string; address: string; notes?: string; items: CartLine[] }
// Legacy region payloads are only replayed unchanged for unresolved orders from older sessions.
export type OrderInput = CustomerOrderInput & ({ governorate: string; regionId?: never } | { governorate?: never; regionId: string })
export interface OrderReceipt {
  id: string; orderCode: string; accessToken: string; status: string; customerName: string; phone: string;
  governorate: string; regionName: string; city: string; address: string; notes: string | null; whatsappNumber: string | null;
  items: { productId: string; name: string; price: number; quantity: number }[];
  subtotal: number; deliveryFee: number | null; total: number | null; currency: string; createdAt: string;
}
