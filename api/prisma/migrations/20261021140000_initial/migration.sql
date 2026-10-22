CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');
CREATE TABLE "Admin" (
  "id" TEXT PRIMARY KEY, "email" TEXT NOT NULL UNIQUE, "passwordHash" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "Category" (
  "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "slug" TEXT NOT NULL UNIQUE, "image" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "Product" (
  "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "slug" TEXT NOT NULL UNIQUE, "shortDescription" TEXT NOT NULL,
  "description" TEXT NOT NULL, "sku" TEXT UNIQUE, "price" INTEGER NOT NULL, "compareAtPrice" INTEGER,
  "stock" INTEGER NOT NULL DEFAULT 0, "featured" BOOLEAN NOT NULL DEFAULT false, "active" BOOLEAN NOT NULL DEFAULT true,
  "categoryId" TEXT NOT NULL REFERENCES "Category"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_price_nonnegative" CHECK ("price" >= 0),
  CONSTRAINT "Product_stock_nonnegative" CHECK ("stock" >= 0),
  CONSTRAINT "Product_compare_valid" CHECK ("compareAtPrice" IS NULL OR "compareAtPrice" > "price")
);
CREATE INDEX "Product_active_categoryId_createdAt_idx" ON "Product"("active", "categoryId", "createdAt");
CREATE INDEX "Product_active_price_idx" ON "Product"("active", "price");
CREATE TABLE "ProductImage" (
  "id" TEXT PRIMARY KEY, "url" TEXT NOT NULL, "alt" TEXT NOT NULL, "position" INTEGER NOT NULL DEFAULT 0,
  "productId" TEXT NOT NULL REFERENCES "Product"("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX "ProductImage_productId_position_idx" ON "ProductImage"("productId", "position");
CREATE TABLE "StoreSettings" (
  "id" TEXT PRIMARY KEY DEFAULT 'store', "storeName" TEXT NOT NULL DEFAULT 'Pet Corner',
  "currency" TEXT NOT NULL DEFAULT 'SYP', "currencyLabel" TEXT NOT NULL DEFAULT 'ل.س',
  "demoMode" BOOLEAN NOT NULL DEFAULT false, "codEnabled" BOOLEAN NOT NULL DEFAULT false,
  "checkoutEnabled" BOOLEAN NOT NULL DEFAULT false, "contactPhone" TEXT, "contactEmail" TEXT,
  "deliveryRegions" JSONB NOT NULL DEFAULT '[]', "pages" JSONB NOT NULL DEFAULT '{}', "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Order" (
  "id" TEXT PRIMARY KEY, "orderCode" TEXT NOT NULL UNIQUE, "idempotencyKey" TEXT NOT NULL UNIQUE,
  "payloadHash" TEXT NOT NULL, "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
  "customerName" TEXT NOT NULL, "phone" TEXT NOT NULL, "regionId" TEXT NOT NULL, "regionName" TEXT NOT NULL,
  "city" TEXT NOT NULL, "address" TEXT NOT NULL, "notes" TEXT,
  "subtotal" INTEGER NOT NULL, "deliveryFee" INTEGER NOT NULL, "total" INTEGER NOT NULL,
  "currency" TEXT NOT NULL, "inventoryRestored" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Order_money_valid" CHECK ("subtotal" >= 0 AND "deliveryFee" >= 0 AND "total" = "subtotal" + "deliveryFee")
);
CREATE INDEX "Order_createdAt_status_idx" ON "Order"("createdAt", "status");
CREATE TABLE "OrderItem" (
  "id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "productId" TEXT NOT NULL, "name" TEXT NOT NULL, "price" INTEGER NOT NULL, "quantity" INTEGER NOT NULL,
  CONSTRAINT "OrderItem_values_valid" CHECK ("price" >= 0 AND "quantity" > 0)
);
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE TABLE "OrderStatusHistory" (
  "id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "status" "OrderStatus" NOT NULL, "adminId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");
