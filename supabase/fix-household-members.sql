-- Fix: household_members view + buckets household_id
-- Run in Supabase SQL Editor

-- 1. Add role column to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';

-- 2. Set the earliest member of each household as 'owner'
UPDATE members m
SET role = 'owner'
WHERE id IN (
  SELECT DISTINCT ON (household_id) id
  FROM members
  WHERE household_id IS NOT NULL
  ORDER BY household_id, created_at ASC
);

-- 3. Update create_household RPC (sets creator as owner)
CREATE OR REPLACE FUNCTION create_household(
  p_name text,
  p_invite_code text,
  p_user_id uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
  v_household_id uuid;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF EXISTS (SELECT 1 FROM members WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'already_member';
  END IF;
  INSERT INTO households (name, invite_code)
  VALUES (p_name, p_invite_code)
  RETURNING id INTO v_household_id;
  INSERT INTO members (user_id, name, household_id, color, role)
  VALUES (v_user_id, p_name, v_household_id, '#6366f1', 'owner');
END;
$$;

-- 4. Update join_household RPC (joined members are 'member')
CREATE OR REPLACE FUNCTION join_household(
  p_name text,
  p_invite_code text DEFAULT NULL,
  p_code text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
  v_household_id uuid;
  v_code text;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  v_code := COALESCE(p_invite_code, p_code);
  SELECT id INTO v_household_id FROM households WHERE invite_code = v_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_code'; END IF;
  IF EXISTS (SELECT 1 FROM members WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'already_member';
  END IF;
  INSERT INTO members (user_id, name, household_id, color, role)
  VALUES (v_user_id, p_name, v_household_id, '#ec4899', 'member');
END;
$$;

-- 5. Create household_members as an auto-updatable view over members
--    security_invoker=true ensures RLS from members table is respected
DROP VIEW IF EXISTS household_members;
CREATE VIEW household_members WITH (security_invoker = true) AS
  SELECT * FROM members;

-- 6. Add household_id to buckets
ALTER TABLE buckets ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id);

-- 7. Assign all existing buckets to the first household
UPDATE buckets
SET household_id = (SELECT id FROM households ORDER BY created_at LIMIT 1)
WHERE household_id IS NULL;

-- 8. Auto-set household_id trigger on buckets inserts
DROP TRIGGER IF EXISTS auto_household ON buckets;
CREATE TRIGGER auto_household BEFORE INSERT ON buckets
  FOR EACH ROW EXECUTE FUNCTION auto_set_household_id();

-- 9. Update buckets RLS: household-scoped only
DROP POLICY IF EXISTS "buckets_read" ON buckets;
DROP POLICY IF EXISTS "household_access" ON buckets;
CREATE POLICY "household_access" ON buckets FOR ALL USING (
  household_id = get_my_household_id()
);

-- 10. Per-household slug uniqueness
ALTER TABLE buckets DROP CONSTRAINT IF EXISTS buckets_slug_key;
DROP INDEX IF EXISTS buckets_slug_household_key;
CREATE UNIQUE INDEX IF NOT EXISTS buckets_slug_household_key ON buckets(slug, household_id);
