/*
  # Create duplicate_budget RPC

  ## Summary
  Adds a Postgres function `duplicate_budget` that atomically duplicates a budget
  and all its budget_plans rows inside a single transaction. If any step fails the
  entire operation is rolled back, so the database is never left in a partial state
  (e.g. a budget row without its plans).

  ## New Functions
  - `duplicate_budget(source_id uuid, new_name text, new_year int)`
    - Looks up the source budget (owned by the calling user via RLS)
    - Inserts a new budget row with the supplied name and year
    - Copies every budget_plans row from the source to the new budget
    - Returns the new budget row as JSON
    - Raises an exception (surfaced as a Postgres error) if the source is not found

  ## Security
  - SECURITY DEFINER is NOT used; the function runs with the caller's privileges so
    all existing RLS policies on `budgets` and `budget_plans` are enforced.
  - Granted to `authenticated` only.
*/

CREATE OR REPLACE FUNCTION duplicate_budget(
  source_id  uuid,
  new_name   text,
  new_year   int
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_source   budgets%ROWTYPE;
  v_new      budgets%ROWTYPE;
BEGIN
  SELECT * INTO v_source
  FROM budgets
  WHERE id = source_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget ikke fundet: %', source_id;
  END IF;

  INSERT INTO budgets (
    user_id,
    name,
    year,
    start_month,
    end_month
  )
  VALUES (
    v_source.user_id,
    new_name,
    new_year,
    COALESCE(v_source.start_month, 1),
    COALESCE(v_source.end_month, 12)
  )
  RETURNING * INTO v_new;

  INSERT INTO budget_plans (
    budget_id,
    recipient_id,
    month,
    amount_planned
  )
  SELECT
    v_new.id,
    recipient_id,
    month,
    COALESCE(amount_planned, 0)
  FROM budget_plans
  WHERE budget_id = source_id;

  RETURN row_to_json(v_new);
END;
$$;

GRANT EXECUTE ON FUNCTION duplicate_budget(uuid, text, int) TO authenticated;
