/*
  # Add housing_type and housing_contribution to household table

  ## Summary
  Adds explicit housing situation tracking to the household table.

  ## New Columns
  - `housing_type` (text): One of OWNER, COOPERATIVE, RENT, HOME_WITH_PARENTS, OTHER
    - OWNER: Ejerbolig
    - COOPERATIVE: Andelsbolig
    - RENT: Lejebolig
    - HOME_WITH_PARENTS: Bor hjemme
    - OTHER: Andet / midlertidigt
  - `housing_contribution` (numeric): Optional monthly contribution when living at home with parents

  ## Why
  Without explicit housing type:
  - HOME_WITH_PARENTS users get artificially high disposable income
  - Housing engines, maintenance costs, and credit simulations are misleading
  - Robustness scores are inaccurate

  ## Behavior
  When housing_type = HOME_WITH_PARENTS:
  - Skip housing engine (no rent/mortgage)
  - Skip maintenance costs
  - Skip property tax
  - Use housing_contribution as "Boligbidrag" if set
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'household' AND column_name = 'housing_type'
  ) THEN
    ALTER TABLE household ADD COLUMN housing_type text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'household' AND column_name = 'housing_contribution'
  ) THEN
    ALTER TABLE household ADD COLUMN housing_contribution numeric DEFAULT NULL;
  END IF;
END $$;
