/*
  # Add user_id to household table

  ## Summary
  Migrates the household table from a single shared record (hardcoded UUID) to
  per-user records. Each authenticated user now owns their own household row,
  identified by their auth.uid().

  ## Changes

  ### Modified Tables
  - `household`
    - Add `user_id` (uuid, nullable initially for migration safety, then unique)
    - Backfill: the single existing legacy row gets no user_id and will be ignored
      by the new RLS policies — new logins will create fresh rows via upsert

  ## Security Changes
  - Drop old public read/write policies (USING true — no auth check)
  - Add per-user policies: users can only read/insert/update their own household row
    identified by auth.uid() = user_id

  ## Notes
  1. user_id is added as NULLABLE first so the migration doesn't break the existing
     legacy row (00000000-0000-0000-0000-000000000001). That row is effectively orphaned
     — no authenticated user will match it under the new policies.
  2. A UNIQUE constraint on user_id ensures one household per user.
  3. Application code must pass user_id on all inserts/upserts and filter selects by
     user_id = auth.uid().
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'household' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE household ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'household' AND indexname = 'household_user_id_key'
  ) THEN
    CREATE UNIQUE INDEX household_user_id_key ON household (user_id) WHERE user_id IS NOT NULL;
  END IF;
END $$;

DROP POLICY IF EXISTS "Public can read household" ON household;
DROP POLICY IF EXISTS "Public can insert household" ON household;
DROP POLICY IF EXISTS "Public can update household" ON household;

CREATE POLICY "Users can read own household"
  ON household FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own household"
  ON household FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own household"
  ON household FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
