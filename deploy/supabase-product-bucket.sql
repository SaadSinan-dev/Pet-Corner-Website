-- Run once in the owner's new Supabase Free project, using a dedicated new bucket.
-- Public reads do not grant INSERT/UPDATE/DELETE. Do not add anon/authenticated write policies.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, 5242880, ARRAY['image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Existing buckets are not silently made public or modified.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'product-images' AND public = true
      AND file_size_limit >= 5242880
      AND (allowed_mime_types IS NULL OR 'image/webp' = ANY(allowed_mime_types))
  ) THEN
    RAISE EXCEPTION 'Use a dedicated public product-images bucket allowing WebP and 5 MiB. Existing bucket was not modified.';
  END IF;
END $$;
