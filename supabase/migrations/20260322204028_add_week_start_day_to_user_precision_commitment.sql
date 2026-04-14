/*
  # Add week start day preference to user settings

  1. Changes
    - Add `week_start_day` column to `user_precision_commitment` table
      - Integer (0-6): 0 = Sunday, 1 = Monday, 2 = Tuesday, etc.
      - Default: 1 (Monday, ISO-8601 standard)
      - NOT NULL with default ensures existing users get Monday

  2. Purpose
    - Allow users to customize when their budget week starts
    - Useful for users who shop for the coming week on weekends
    - Prevents false "over budget" warnings when shopping ahead
    - Improves Nuvio Flow accuracy by matching user behavior

  3. Security
    - No RLS changes needed (table already has proper RLS)
    - Column is user-specific and controlled through existing policies
*/

-- Add week_start_day column with default Monday (1)
ALTER TABLE user_precision_commitment 
ADD COLUMN IF NOT EXISTS week_start_day INTEGER NOT NULL DEFAULT 1
CHECK (week_start_day >= 0 AND week_start_day <= 6);

-- Add comment for clarity
COMMENT ON COLUMN user_precision_commitment.week_start_day IS 
'Day of week when user''s budget week starts (0=Sunday, 1=Monday, etc.). Typically the day user shops for the coming week.';
