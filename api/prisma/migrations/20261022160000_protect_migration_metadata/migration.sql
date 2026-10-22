-- Migration history must remain writable only by the trusted database owner.
-- Include projects retaining Supabase's automatic public-schema grants.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE "_prisma_migrations" FROM %I', client_role);
    END IF;
  END LOOP;
END $$;
