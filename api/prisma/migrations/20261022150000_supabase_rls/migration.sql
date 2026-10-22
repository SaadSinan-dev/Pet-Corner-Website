-- Additive protection for Supabase's public Data API. The Nest API connects as
-- the trusted migration/table owner; anon/authenticated clients get no policies.
ALTER TABLE "Admin" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductImage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoreSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderDeliveryHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderStatusHistory" ENABLE ROW LEVEL SECURITY;

-- These roles exist on Supabase, but not necessarily on local PostgreSQL.
DO $$
DECLARE client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE "Admin", "Category", "Product", "ProductImage", "StoreSettings", "Order", "OrderDeliveryHistory", "OrderItem", "OrderStatusHistory" FROM %I', client_role);
    END IF;
  END LOOP;
END $$;
