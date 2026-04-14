/*
  # Add wizard_enabled flags to ui_strings

  ## Summary
  Inserts one ui_strings row per wizard to control whether each wizard
  is enabled or disabled for regular users. Admins always see them via
  the preview page regardless.

  ## New keys
  - wizard_enabled_why
  - wizard_enabled_onboarding
  - wizard_enabled_income
  - wizard_enabled_household
  - wizard_enabled_investment
  - wizard_enabled_budget_setup
  - wizard_enabled_fixed_expenses
  - wizard_enabled_variable_expenses
  - wizard_enabled_variable_forbrug
  - wizard_enabled_checkup
  - wizard_enabled_data_reset
  - wizard_enabled_savings

  All default to 'true' (enabled).
*/

INSERT INTO ui_strings (key, value) VALUES
  ('wizard_enabled_why', 'true'),
  ('wizard_enabled_onboarding', 'true'),
  ('wizard_enabled_income', 'true'),
  ('wizard_enabled_household', 'true'),
  ('wizard_enabled_investment', 'true'),
  ('wizard_enabled_budget_setup', 'true'),
  ('wizard_enabled_fixed_expenses', 'true'),
  ('wizard_enabled_variable_expenses', 'true'),
  ('wizard_enabled_variable_forbrug', 'true'),
  ('wizard_enabled_checkup', 'true'),
  ('wizard_enabled_data_reset', 'true'),
  ('wizard_enabled_savings', 'true')
ON CONFLICT (key) DO NOTHING;
