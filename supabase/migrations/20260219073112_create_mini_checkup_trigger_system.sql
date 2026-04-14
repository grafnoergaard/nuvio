/*
  # Mini Checkup Trigger System

  ## Overview
  Creates two tables to power the intelligent Mini Checkup trigger system,
  which determines when and how to prompt users to update their financial plan.

  ## New Tables

  ### mini_checkup_settings (1 global row)
  Global admin-configurable rules for when and how to trigger checkups.
  - soft_days: Days since last update before soft nudge (banner + badge)
  - strong_days: Days since last update before strong nudge (modal + banner)
  - reactivate_days: Days since last update before re-activation nudge
  - soft_min_completion: Minimum completion score % required for soft nudge
  - strong_min_completion: Minimum completion score % required for strong nudge
  - reactivate_min_completion: Minimum completion score % required for reactivation nudge
  - banner_cooldown_soft_days: Min days between soft banners per user
  - banner_cooldown_strong_days: Min days between strong banners per user
  - modal_cooldown_hours: Min hours between modal prompts per user
  - modal_enabled: Toggle modal prompts globally
  - badge_enabled: Toggle nav badge globally
  - allow_snooze: Allow users to snooze prompts
  - snooze_days: Days to snooze for short snooze
  - hard_snooze_days: Days to snooze for long snooze ("skjul i X dage")
  - min_activity_days: Only trigger if user logged in within this many days
  - min_sessions_soft: Minimum sessions in last 30 days for soft trigger
  - skip_if_onboarding_incomplete: Don't trigger if onboarding not done

  ### mini_checkup_user_state (per budget/user)
  Tracks per-user/budget checkup prompt state and impression counts.
  - budget_id: FK to budgets
  - user_id: FK to auth.users
  - last_prompted_at: Last time any prompt was shown
  - last_modal_shown_at: Last modal shown timestamp
  - last_banner_shown_at: Last banner shown timestamp
  - snoozed_until: User snoozed until this timestamp
  - last_checkup_completed_at: Last completed checkup
  - impressions_7d: Rolling count of impressions in last 7 days
  - current_level: Evaluated nudge level (NONE/SOFT/STRONG/REACTIVATE)

  ## Security
  - RLS enabled on both tables
  - mini_checkup_settings: only authenticated users can read; only service_role writes (admin manages via edge fn or direct)
  - mini_checkup_user_state: users can only read/write their own rows
*/

CREATE TABLE IF NOT EXISTS mini_checkup_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  soft_days integer NOT NULL DEFAULT 30,
  strong_days integer NOT NULL DEFAULT 60,
  reactivate_days integer NOT NULL DEFAULT 90,
  soft_min_completion integer NOT NULL DEFAULT 70,
  strong_min_completion integer NOT NULL DEFAULT 50,
  reactivate_min_completion integer NOT NULL DEFAULT 30,
  banner_cooldown_soft_days integer NOT NULL DEFAULT 7,
  banner_cooldown_strong_days integer NOT NULL DEFAULT 3,
  modal_cooldown_hours integer NOT NULL DEFAULT 24,
  modal_enabled boolean NOT NULL DEFAULT true,
  badge_enabled boolean NOT NULL DEFAULT true,
  allow_snooze boolean NOT NULL DEFAULT true,
  snooze_days integer NOT NULL DEFAULT 7,
  hard_snooze_days integer NOT NULL DEFAULT 30,
  min_activity_days integer NOT NULL DEFAULT 180,
  min_sessions_soft integer NOT NULL DEFAULT 2,
  skip_if_onboarding_incomplete boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO mini_checkup_settings (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

ALTER TABLE mini_checkup_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read checkup settings"
  ON mini_checkup_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update checkup settings"
  ON mini_checkup_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS mini_checkup_user_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_prompted_at timestamptz,
  last_modal_shown_at timestamptz,
  last_banner_shown_at timestamptz,
  snoozed_until timestamptz,
  last_checkup_completed_at timestamptz,
  impressions_7d integer NOT NULL DEFAULT 0,
  current_level text NOT NULL DEFAULT 'NONE',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(budget_id, user_id)
);

ALTER TABLE mini_checkup_user_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own checkup state"
  ON mini_checkup_user_state FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own checkup state"
  ON mini_checkup_user_state FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checkup state"
  ON mini_checkup_user_state FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mini_checkup_user_state_budget_user
  ON mini_checkup_user_state(budget_id, user_id);

CREATE INDEX IF NOT EXISTS idx_mini_checkup_user_state_user
  ON mini_checkup_user_state(user_id);
