/*
  # Add variable expense wizard inputs to household

  ## Summary
  Stores the inputs used to calculate the variable expense estimate so the
  dashboard can re-render the full breakdown without re-running the wizard.

  ## New Columns on household
  - `variable_postal_code` (text) – postal code used for regional adjustment
  - `variable_is_student` (boolean) – whether student rates were applied
  - `variable_children_birth_years` (jsonb) – array of birth years for children
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'household' AND column_name = 'variable_postal_code'
  ) THEN
    ALTER TABLE household ADD COLUMN variable_postal_code text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'household' AND column_name = 'variable_is_student'
  ) THEN
    ALTER TABLE household ADD COLUMN variable_is_student boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'household' AND column_name = 'variable_children_birth_years'
  ) THEN
    ALTER TABLE household ADD COLUMN variable_children_birth_years jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
