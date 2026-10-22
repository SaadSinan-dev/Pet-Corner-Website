-- Additive upgrade: retain all catalog and historical order records.
ALTER TABLE "Category" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
-- Recognize only the exact, explicitly labelled original seed signatures.
UPDATE "Product" SET "isDemo" = true WHERE "slug" ~ '^pet-corner-(cat-food|cat-supplies|dog-food|dog-supplies|toys|care|accessories)-[12]$'
  AND "sku" = 'DEMO-' || upper(substring("slug" from 12 for length("slug") - 13)) || '-' || right("slug", 1)
  AND "shortDescription" = 'منتج تجريبي من Pet Corner، لاستكشاف تجربة التسوق.';
ALTER TABLE "StoreSettings"
  ADD COLUMN "whatsappNumber" TEXT,
  ADD COLUMN "socialLinks" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "heroEyebrow" TEXT NOT NULL DEFAULT '', ADD COLUMN "heroTitle" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "heroDescription" TEXT NOT NULL DEFAULT '', ADD COLUMN "heroButtonText" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "heroImageUrl" TEXT, ADD COLUMN "footerText" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "checkoutMessage" TEXT NOT NULL DEFAULT 'سيتم تأكيد تكلفة التوصيل والإجمالي النهائي معك عبر واتساب بعد مراجعة تفاصيل الطلب',
  ADD COLUMN "deliveryPolicy" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ALTER COLUMN "regionId" DROP NOT NULL, ALTER COLUMN "deliveryFee" DROP NOT NULL, ALTER COLUMN "total" DROP NOT NULL;
ALTER TABLE "Order" ADD COLUMN "governorate" TEXT;
UPDATE "Order" SET "governorate" = "regionName";
ALTER TABLE "Order" ALTER COLUMN "governorate" SET NOT NULL;
ALTER TABLE "Order" DROP CONSTRAINT "Order_money_valid";
ALTER TABLE "Order" ADD CONSTRAINT "Order_money_valid" CHECK (
  "subtotal" >= 0 AND (("deliveryFee" IS NULL AND "total" IS NULL) OR
  ("deliveryFee" IS NOT NULL AND "total" IS NOT NULL AND "deliveryFee" >= 0 AND "total" = "subtotal" + "deliveryFee")));
CREATE TABLE "OrderDeliveryHistory" (
  "id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "previousFee" INTEGER, "deliveryFee" INTEGER NOT NULL, "total" INTEGER NOT NULL,
  "adminId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderDeliveryHistory_money_valid" CHECK ("deliveryFee" >= 0 AND "total" >= "deliveryFee")
);
CREATE INDEX "OrderDeliveryHistory_orderId_createdAt_idx" ON "OrderDeliveryHistory"("orderId", "createdAt");
CREATE INDEX "Product_active_isDemo_position_idx" ON "Product"("active", "isDemo", "position");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
