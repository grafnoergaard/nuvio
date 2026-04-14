/*
  # Tilføj budget_account_answer til budgets

  ## Ændringer
  Tilføjer kolonnen `budget_account_answer` til `budgets`-tabellen.
  Kolonnen gemmer brugerens svar fra onboarding-spørgsmålet om fast budgetkonto.

  ## Nye kolonner

  ### budgets
  - `budget_account_answer` (text, nullable): Brugerens svar på om de har en fast budgetkonto.
    Mulige værdier: 'yes_active', 'yes_rarely', 'considering', 'no_unknown'

  ## Formål
  Svaret bruges til at generere målrettede anbefalinger på anbefalings-siden.
  Brugere der ikke bruger eller ikke kender til budgetkonto-konceptet, får en
  konkret anbefaling om at oprette en.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'budget_account_answer'
  ) THEN
    ALTER TABLE budgets ADD COLUMN budget_account_answer text DEFAULT NULL;
  END IF;
END $$;
