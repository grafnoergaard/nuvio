/*
  # Add DEFAULT gen_random_uuid() to ui_strings.id

  The upsert on ui_strings fails when no id is provided because the id column
  has no default value. This migration adds a default so upsert works correctly.
*/

ALTER TABLE ui_strings ALTER COLUMN id SET DEFAULT gen_random_uuid();
