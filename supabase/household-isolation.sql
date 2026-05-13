-- Household isolation migration
-- Run this in Supabase SQL Editor

-- 1. Households table
CREATE TABLE IF NOT EXISTS households (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL DEFAULT 'Porodica',
  invite_code text UNIQUE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- 2. Add household_id to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id) ON DELETE CASCADE;

-- 3. Add household_id to all data tables
ALTER TABLE categories         ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id);
ALTER TABLE recurring_items    ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id);
ALTER TABLE transactions       ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id);
ALTER TABLE cekovi             ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id);
ALTER TABLE savings            ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id);
ALTER TABLE savings_goals      ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id);
ALTER TABLE dugovi             ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id);
ALTER TABLE credits            ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id);
ALTER TABLE notifications      ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id);
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id);
ALTER TABLE months             ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id);
-- debt_payments and credit_payments access through parent's household_id (no column needed)

-- 4. Create initial household and link all existing data to it
DO $$
DECLARE v_hid uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM households LIMIT 1) THEN
    INSERT INTO households (name) VALUES ('Moja porodica') RETURNING id INTO v_hid;
  ELSE
    SELECT id INTO v_hid FROM households LIMIT 1;
  END IF;

  UPDATE members         SET household_id = v_hid WHERE household_id IS NULL;
  UPDATE categories      SET household_id = v_hid WHERE household_id IS NULL;
  UPDATE recurring_items SET household_id = v_hid WHERE household_id IS NULL;
  UPDATE transactions    SET household_id = v_hid WHERE household_id IS NULL;
  UPDATE cekovi          SET household_id = v_hid WHERE household_id IS NULL;
  UPDATE savings         SET household_id = v_hid WHERE household_id IS NULL;
  UPDATE savings_goals   SET household_id = v_hid WHERE household_id IS NULL;
  UPDATE dugovi          SET household_id = v_hid WHERE household_id IS NULL;
  UPDATE credits         SET household_id = v_hid WHERE household_id IS NULL;
  UPDATE notifications   SET household_id = v_hid WHERE household_id IS NULL;
  UPDATE push_subscriptions SET household_id = v_hid WHERE household_id IS NULL;
  UPDATE months          SET household_id = v_hid WHERE household_id IS NULL;
END $$;

-- 5. Helper: get current user's household_id
CREATE OR REPLACE FUNCTION get_my_household_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT household_id FROM members WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 6. Trigger: auto-set household_id on INSERT for all data tables
CREATE OR REPLACE FUNCTION auto_set_household_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.household_id IS NULL THEN
    NEW.household_id := get_my_household_id();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categories','recurring_items','transactions','cekovi',
    'savings','savings_goals','dugovi','credits',
    'notifications','push_subscriptions','months'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS auto_household ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER auto_household BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION auto_set_household_id()',
      t
    );
  END LOOP;
END $$;

-- 7. Drop old open policies, create household-scoped ones
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'members','categories','recurring_items','transactions','cekovi','savings',
    'savings_goals','dugovi','debt_payments','credits','credit_payments',
    'notifications','push_subscriptions','months'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "auth_all" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "household_access" ON %I', t);
  END LOOP;
END $$;

CREATE POLICY "household_access" ON members         FOR ALL USING (household_id = get_my_household_id());
CREATE POLICY "household_access" ON categories      FOR ALL USING (household_id = get_my_household_id());
CREATE POLICY "household_access" ON recurring_items FOR ALL USING (household_id = get_my_household_id());
CREATE POLICY "household_access" ON transactions    FOR ALL USING (household_id = get_my_household_id());
CREATE POLICY "household_access" ON cekovi          FOR ALL USING (household_id = get_my_household_id());
CREATE POLICY "household_access" ON savings         FOR ALL USING (household_id = get_my_household_id());
CREATE POLICY "household_access" ON savings_goals   FOR ALL USING (household_id = get_my_household_id());
CREATE POLICY "household_access" ON dugovi          FOR ALL USING (household_id = get_my_household_id());
CREATE POLICY "household_access" ON credits         FOR ALL USING (household_id = get_my_household_id());
CREATE POLICY "household_access" ON push_subscriptions FOR ALL USING (household_id = get_my_household_id());
CREATE POLICY "household_access" ON months          FOR ALL USING (household_id = get_my_household_id());

-- notifications: household OR null (za sistemske/cron notifikacije)
CREATE POLICY "household_access" ON notifications FOR ALL USING (
  household_id = get_my_household_id() OR household_id IS NULL
);

-- debt_payments: access through parent dugovi
CREATE POLICY "household_access" ON debt_payments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM dugovi
    WHERE dugovi.id = debt_payments.debt_id
    AND dugovi.household_id = get_my_household_id()
  )
);

-- credit_payments: access through parent credits
CREATE POLICY "household_access" ON credit_payments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM credits
    WHERE credits.id = credit_payments.credit_id
    AND credits.household_id = get_my_household_id()
  )
);

-- households: users can only see their own
DROP POLICY IF EXISTS "household_own" ON households;
CREATE POLICY "household_own" ON households FOR ALL USING (id = get_my_household_id());

-- 8. Recreate create_household and join_household RPCs
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

  INSERT INTO members (user_id, name, household_id, color)
  VALUES (v_user_id, p_name, v_household_id, '#6366f1');
END;
$$;

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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  IF EXISTS (SELECT 1 FROM members WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  INSERT INTO members (user_id, name, household_id, color)
  VALUES (v_user_id, p_name, v_household_id, '#ec4899');
END;
$$;

-- 9. Middleware helper: check if user has a household (used by app to redirect to /setup)
CREATE OR REPLACE FUNCTION user_has_household()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM members WHERE user_id = auth.uid() AND household_id IS NOT NULL);
$$;
