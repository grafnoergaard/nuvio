
/*
  # Fix user data isolation — critical security fix

  ## Problem
  Several tables were missing user_id columns or had RLS policies that only
  checked "is the user authenticated?" rather than "does this user own the row?".
  This meant any logged-in user could read, modify, or delete data belonging to
  other users.

  ## Tables fixed

  ### 1. budgets
  - Added `user_id uuid` column referencing auth.users
  - Populated from auth.users (only one user in system, safe to assign)
  - Replaced weak RLS (auth.uid() IS NOT NULL) with strict ownership check

  ### 2. category_groups
  - Added `user_id uuid` column (derived via budget join not possible — standalone table)
  - Populated by assigning to the single existing budget owner
  - Replaced weak RLS with ownership check

  ### 3. recipients
  - Added `user_id uuid` column
  - Populated similarly
  - Replaced weak RLS with ownership check

  ### 4. savings_goals
  - Added `user_id uuid` column
  - Replaced weak RLS with ownership check

  ### 5. budget_plans, transactions, merchant_rules, recipient_rules
  - These are linked via budget_id — RLS updated to check via budgets.user_id join
  - No column addition needed — ownership derived from parent budget

  ## Security
  - All policies now enforce auth.uid() = user_id (direct or via join)
  - No data is deleted — only schema and policies updated
*/

-- ============================================================
-- 1. budgets — add user_id column
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE budgets ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Populate user_id for existing budgets from the single user in auth.users
UPDATE budgets SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;

-- ============================================================
-- 2. category_groups — add user_id column
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'category_groups' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE category_groups ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

UPDATE category_groups SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;

-- ============================================================
-- 3. recipients — add user_id column
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recipients' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE recipients ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

UPDATE recipients SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;

-- ============================================================
-- 4. savings_goals — add user_id column
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'savings_goals' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE savings_goals ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

UPDATE savings_goals SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;

-- ============================================================
-- 5. Fix RLS: budgets
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read budgets" ON budgets;
DROP POLICY IF EXISTS "Authenticated users can insert budgets" ON budgets;
DROP POLICY IF EXISTS "Authenticated users can update budgets" ON budgets;
DROP POLICY IF EXISTS "Authenticated users can delete budgets" ON budgets;

CREATE POLICY "Users can read own budgets"
  ON budgets FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own budgets"
  ON budgets FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own budgets"
  ON budgets FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own budgets"
  ON budgets FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================
-- 6. Fix RLS: category_groups
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read category_groups" ON category_groups;
DROP POLICY IF EXISTS "Authenticated users can insert category_groups" ON category_groups;
DROP POLICY IF EXISTS "Authenticated users can update category_groups" ON category_groups;
DROP POLICY IF EXISTS "Authenticated users can delete category_groups" ON category_groups;

CREATE POLICY "Users can read own category_groups"
  ON category_groups FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own category_groups"
  ON category_groups FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own category_groups"
  ON category_groups FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own category_groups"
  ON category_groups FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================
-- 7. Fix RLS: recipients
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read recipients" ON recipients;
DROP POLICY IF EXISTS "Authenticated users can insert recipients" ON recipients;
DROP POLICY IF EXISTS "Authenticated users can update recipients" ON recipients;
DROP POLICY IF EXISTS "Authenticated users can delete recipients" ON recipients;

CREATE POLICY "Users can read own recipients"
  ON recipients FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own recipients"
  ON recipients FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own recipients"
  ON recipients FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own recipients"
  ON recipients FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================
-- 8. Fix RLS: savings_goals
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read savings_goals" ON savings_goals;
DROP POLICY IF EXISTS "Authenticated users can insert savings_goals" ON savings_goals;
DROP POLICY IF EXISTS "Authenticated users can update savings_goals" ON savings_goals;
DROP POLICY IF EXISTS "Authenticated users can delete savings_goals" ON savings_goals;

CREATE POLICY "Users can read own savings_goals"
  ON savings_goals FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own savings_goals"
  ON savings_goals FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own savings_goals"
  ON savings_goals FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own savings_goals"
  ON savings_goals FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================
-- 9. Fix RLS: transactions (via budget ownership)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read transactions" ON transactions;
DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Authenticated users can update transactions" ON transactions;
DROP POLICY IF EXISTS "Authenticated users can delete transactions" ON transactions;

CREATE POLICY "Users can read own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = transactions.budget_id
      AND budgets.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = transactions.budget_id
      AND budgets.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = transactions.budget_id
      AND budgets.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = transactions.budget_id
      AND budgets.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = transactions.budget_id
      AND budgets.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- 10. Fix RLS: budget_plans (via budget ownership)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read budget_plans" ON budget_plans;
DROP POLICY IF EXISTS "Authenticated users can insert budget_plans" ON budget_plans;
DROP POLICY IF EXISTS "Authenticated users can update budget_plans" ON budget_plans;
DROP POLICY IF EXISTS "Authenticated users can delete budget_plans" ON budget_plans;

CREATE POLICY "Users can read own budget_plans"
  ON budget_plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = budget_plans.budget_id
      AND budgets.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert own budget_plans"
  ON budget_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = budget_plans.budget_id
      AND budgets.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update own budget_plans"
  ON budget_plans FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = budget_plans.budget_id
      AND budgets.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = budget_plans.budget_id
      AND budgets.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete own budget_plans"
  ON budget_plans FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = budget_plans.budget_id
      AND budgets.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- 11. Fix RLS: merchant_rules (via budget ownership)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read merchant_rules" ON merchant_rules;
DROP POLICY IF EXISTS "Authenticated users can insert merchant_rules" ON merchant_rules;
DROP POLICY IF EXISTS "Authenticated users can update merchant_rules" ON merchant_rules;
DROP POLICY IF EXISTS "Authenticated users can delete merchant_rules" ON merchant_rules;

CREATE POLICY "Users can read own merchant_rules"
  ON merchant_rules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = merchant_rules.budget_id
      AND budgets.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert own merchant_rules"
  ON merchant_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = merchant_rules.budget_id
      AND budgets.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update own merchant_rules"
  ON merchant_rules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = merchant_rules.budget_id
      AND budgets.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = merchant_rules.budget_id
      AND budgets.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete own merchant_rules"
  ON merchant_rules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = merchant_rules.budget_id
      AND budgets.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- 12. Fix RLS: recipient_rules (via recipient -> user_id)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read recipient_rules" ON recipient_rules;
DROP POLICY IF EXISTS "Authenticated users can insert recipient_rules" ON recipient_rules;
DROP POLICY IF EXISTS "Authenticated users can update recipient_rules" ON recipient_rules;
DROP POLICY IF EXISTS "Authenticated users can delete recipient_rules" ON recipient_rules;

CREATE POLICY "Users can read own recipient_rules"
  ON recipient_rules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recipients
      WHERE recipients.id = recipient_rules.recipient_id
      AND recipients.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert own recipient_rules"
  ON recipient_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipients
      WHERE recipients.id = recipient_rules.recipient_id
      AND recipients.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update own recipient_rules"
  ON recipient_rules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recipients
      WHERE recipients.id = recipient_rules.recipient_id
      AND recipients.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipients
      WHERE recipients.id = recipient_rules.recipient_id
      AND recipients.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete own recipient_rules"
  ON recipient_rules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recipients
      WHERE recipients.id = recipient_rules.recipient_id
      AND recipients.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- 13. Add indexes for new user_id columns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_category_groups_user_id ON category_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_recipients_user_id ON recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id);
