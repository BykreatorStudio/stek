-- Fix FK constraints: make nullable + SET NULL (instead of NOT NULL / CASCADE)
-- Run this in Supabase SQL Editor before deploying the new delete logic

-- 1. Make bucket_id nullable across all tables
ALTER TABLE dugovi          ALTER COLUMN bucket_id DROP NOT NULL;
ALTER TABLE categories      ALTER COLUMN bucket_id DROP NOT NULL;
ALTER TABLE recurring_items ALTER COLUMN bucket_id DROP NOT NULL;
ALTER TABLE transactions    ALTER COLUMN bucket_id DROP NOT NULL;

-- 2. credits: was CASCADE → change to SET NULL
ALTER TABLE credits DROP CONSTRAINT IF EXISTS credits_bucket_id_fkey;
ALTER TABLE credits ALTER COLUMN bucket_id DROP NOT NULL;
ALTER TABLE credits ADD CONSTRAINT credits_bucket_id_fkey
  FOREIGN KEY (bucket_id) REFERENCES buckets(id) ON DELETE SET NULL;

-- 3. categories: was CASCADE → SET NULL (deleting bucket won't auto-delete categories)
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_bucket_id_fkey;
ALTER TABLE categories ADD CONSTRAINT categories_bucket_id_fkey
  FOREIGN KEY (bucket_id) REFERENCES buckets(id) ON DELETE SET NULL;

-- 4. recurring_items bucket: was CASCADE → SET NULL
ALTER TABLE recurring_items DROP CONSTRAINT IF EXISTS recurring_items_bucket_id_fkey;
ALTER TABLE recurring_items ADD CONSTRAINT recurring_items_bucket_id_fkey
  FOREIGN KEY (bucket_id) REFERENCES buckets(id) ON DELETE SET NULL;

-- 5. transactions bucket: was CASCADE → SET NULL
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_bucket_id_fkey;
ALTER TABLE transactions ADD CONSTRAINT transactions_bucket_id_fkey
  FOREIGN KEY (bucket_id) REFERENCES buckets(id) ON DELETE SET NULL;

-- 6. Make category_id nullable
ALTER TABLE transactions    ALTER COLUMN category_id DROP NOT NULL;
ALTER TABLE recurring_items ALTER COLUMN category_id DROP NOT NULL;

-- 7. transactions category: was CASCADE → SET NULL
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_category_id_fkey;
ALTER TABLE transactions ADD CONSTRAINT transactions_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

-- 8. recurring_items category: was CASCADE → SET NULL
ALTER TABLE recurring_items DROP CONSTRAINT IF EXISTS recurring_items_category_id_fkey;
ALTER TABLE recurring_items ADD CONSTRAINT recurring_items_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

-- 9. dugovi.start_date: make optional (form treats it as optional)
ALTER TABLE dugovi ALTER COLUMN start_date DROP NOT NULL;

-- 10. Bucket slug: per-household uniqueness instead of global
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buckets' AND column_name = 'household_id'
  ) THEN
    ALTER TABLE buckets DROP CONSTRAINT IF EXISTS buckets_slug_key;
    BEGIN
      ALTER TABLE buckets ADD CONSTRAINT buckets_slug_household_key
        UNIQUE (slug, household_id);
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'Constraint already exists, skipping.';
    END;
  END IF;
END $$;
