/*
  # Add Nuvio Flow Status Configuration to standard_data_entries

  ## Summary
  Adds fully configurable status thresholds, badge texts, and color tokens
  for the 5 status tiers in Nuvio Flow. Admins can control all values from
  /admin/standard-data without code deployments.

  ## New Entries (section: nuvio_flow)

  ### Thresholds
  - FLOW_STATUS_OVER_BUDGET_USED_PCT        → threshold for "Over budget" (>100 means overrun)
  - FLOW_STATUS_WARN_USED_PCT               → usedPct threshold for "Stram op"
  - FLOW_STATUS_WARN_HEALTH_MIN             → min healthPct before "Stram op"
  - FLOW_STATUS_KURSEN_HEALTH_MIN           → min healthPct for "Hold kursen"
  - FLOW_STATUS_TEMPO_HEALTH_MIN            → min healthPct for "Godt tempo"
  - FLOW_STATUS_FLOW_HEALTH_MIN             → min healthPct for "Nuvio Flow"
  - FLOW_STATUS_FLOW_USED_MAX               → max usedPct for "Nuvio Flow"

  ### Badge texts (text values)
  - FLOW_BADGE_OVER                         → "Over budget"
  - FLOW_BADGE_WARN                         → "Stram op"
  - FLOW_BADGE_KURSEN                       → "Hold kursen"
  - FLOW_BADGE_TEMPO                        → "Godt tempo"
  - FLOW_BADGE_FLOW                         → "Nuvio Flow"

  ### Headlines (text values)
  - FLOW_HEADLINE_OVER                      → "Du har overskredet dit budget"
  - FLOW_HEADLINE_WARN                      → "Hold igen på forbruget"
  - FLOW_HEADLINE_KURSEN                    → "Du er på rette spor"
  - FLOW_HEADLINE_TEMPO                     → "Du klarer det fremragende"
  - FLOW_HEADLINE_FLOW                      → "Du er i Nuvio Flow"

  ### Colors (Tailwind class tokens, text values)
  - FLOW_COLOR_OVER_BG                      → "bg-red-500"
  - FLOW_COLOR_WARN_BG                      → "bg-amber-500"
  - FLOW_COLOR_KURSEN_BG                    → "bg-emerald-500"
  - FLOW_COLOR_TEMPO_BG                     → "bg-emerald-500"
  - FLOW_COLOR_OVER_CARD                    → card gradient class
  - FLOW_COLOR_WARN_CARD                    → card gradient class
  - FLOW_COLOR_GOOD_CARD                    → card gradient class (kursen+tempo)
  - FLOW_COLOR_FLOW_CARD                    → card gradient class (nuvio flow)

  ## Notes
  - All entries are soft-coded via standard_data_entries
  - Fallbacks are embedded in the frontend for resilience
  - Section: nuvio_flow
*/

DO $$
DECLARE
  v_version_id uuid;
BEGIN
  SELECT id INTO v_version_id
  FROM public.standard_data_versions
  WHERE is_active = true
  ORDER BY valid_from DESC
  LIMIT 1;

  IF v_version_id IS NULL THEN
    RAISE EXCEPTION 'No active standard_data_version found';
  END IF;

  -- Thresholds (numeric)
  INSERT INTO public.standard_data_entries (version_id, section, key, value_numeric, value_text, unit, label, notes, requires_admin_value)
  VALUES
    (v_version_id, 'nuvio_flow', 'FLOW_STATUS_WARN_USED_PCT',    75,  NULL, 'pct', 'Stram op — max % af budget brugt', 'Hvis usedPct overstiger denne værdi, vises "Stram op". Standard: 75', false),
    (v_version_id, 'nuvio_flow', 'FLOW_STATUS_WARN_HEALTH_MIN',  30,  NULL, 'pct', 'Stram op — min sundhedsscore',      'Hvis healthPct er under denne værdi, vises "Stram op". Standard: 30', false),
    (v_version_id, 'nuvio_flow', 'FLOW_STATUS_KURSEN_HEALTH_MIN',0,   NULL, 'pct', 'Hold kursen — min sundhedsscore',   'Bundgrænse for "Hold kursen". Standard: 0', false),
    (v_version_id, 'nuvio_flow', 'FLOW_STATUS_TEMPO_HEALTH_MIN', 60,  NULL, 'pct', 'Godt tempo — min sundhedsscore',    'Min healthPct for "Godt tempo". Standard: 60', false),
    (v_version_id, 'nuvio_flow', 'FLOW_STATUS_FLOW_HEALTH_MIN',  80,  NULL, 'pct', 'Nuvio Flow — min sundhedsscore',    'Min healthPct for "Nuvio Flow". Standard: 80', false),
    (v_version_id, 'nuvio_flow', 'FLOW_STATUS_FLOW_USED_MAX',    60,  NULL, 'pct', 'Nuvio Flow — max % af budget brugt','Max usedPct for "Nuvio Flow". Standard: 60', false)
  ON CONFLICT (version_id, key) DO NOTHING;

  -- Badge texts (text)
  INSERT INTO public.standard_data_entries (version_id, section, key, value_numeric, value_text, unit, label, notes, requires_admin_value)
  VALUES
    (v_version_id, 'nuvio_flow', 'FLOW_BADGE_OVER',    NULL, 'Over budget', 'tekst', 'Badge-tekst: Over budget',   NULL, false),
    (v_version_id, 'nuvio_flow', 'FLOW_BADGE_WARN',    NULL, 'Stram op',    'tekst', 'Badge-tekst: Stram op',      NULL, false),
    (v_version_id, 'nuvio_flow', 'FLOW_BADGE_KURSEN',  NULL, 'Hold kursen', 'tekst', 'Badge-tekst: Hold kursen',   NULL, false),
    (v_version_id, 'nuvio_flow', 'FLOW_BADGE_TEMPO',   NULL, 'Godt tempo',  'tekst', 'Badge-tekst: Godt tempo',    NULL, false),
    (v_version_id, 'nuvio_flow', 'FLOW_BADGE_FLOW',    NULL, 'Nuvio Flow',  'tekst', 'Badge-tekst: Nuvio Flow',    NULL, false)
  ON CONFLICT (version_id, key) DO NOTHING;

  -- Headlines (text)
  INSERT INTO public.standard_data_entries (version_id, section, key, value_numeric, value_text, unit, label, notes, requires_admin_value)
  VALUES
    (v_version_id, 'nuvio_flow', 'FLOW_HEADLINE_OVER',    NULL, 'Du har overskredet dit budget', 'tekst', 'Overskrift: Over budget',   NULL, false),
    (v_version_id, 'nuvio_flow', 'FLOW_HEADLINE_WARN',    NULL, 'Hold igen på forbruget',        'tekst', 'Overskrift: Stram op',      NULL, false),
    (v_version_id, 'nuvio_flow', 'FLOW_HEADLINE_KURSEN',  NULL, 'Du er på rette spor',           'tekst', 'Overskrift: Hold kursen',   NULL, false),
    (v_version_id, 'nuvio_flow', 'FLOW_HEADLINE_TEMPO',   NULL, 'Du klarer det fremragende',     'tekst', 'Overskrift: Godt tempo',    NULL, false),
    (v_version_id, 'nuvio_flow', 'FLOW_HEADLINE_FLOW',    NULL, 'Du er i Nuvio Flow',            'tekst', 'Overskrift: Nuvio Flow',    NULL, false)
  ON CONFLICT (version_id, key) DO NOTHING;

  -- Badge background colors (Tailwind tokens)
  INSERT INTO public.standard_data_entries (version_id, section, key, value_numeric, value_text, unit, label, notes, requires_admin_value)
  VALUES
    (v_version_id, 'nuvio_flow', 'FLOW_COLOR_OVER_BADGE',   NULL, 'bg-red-500',     'tailwind', 'Badgefarve: Over budget',  'Tailwind baggrundklasse til badge. Standard: bg-red-500', false),
    (v_version_id, 'nuvio_flow', 'FLOW_COLOR_WARN_BADGE',   NULL, 'bg-amber-500',   'tailwind', 'Badgefarve: Stram op',     'Tailwind baggrundklasse til badge. Standard: bg-amber-500', false),
    (v_version_id, 'nuvio_flow', 'FLOW_COLOR_KURSEN_BADGE', NULL, 'bg-emerald-500', 'tailwind', 'Badgefarve: Hold kursen',  'Tailwind baggrundklasse til badge. Standard: bg-emerald-500', false),
    (v_version_id, 'nuvio_flow', 'FLOW_COLOR_TEMPO_BADGE',  NULL, 'bg-emerald-500', 'tailwind', 'Badgefarve: Godt tempo',   'Tailwind baggrundklasse til badge. Standard: bg-emerald-500', false),
    (v_version_id, 'nuvio_flow', 'FLOW_COLOR_OVER_CARD',    NULL, 'bg-gradient-to-br from-red-50 via-rose-50/60 to-white border-red-200/60',         'tailwind', 'Kortfarve: Over budget',   NULL, false),
    (v_version_id, 'nuvio_flow', 'FLOW_COLOR_WARN_CARD',    NULL, 'bg-gradient-to-br from-amber-50 via-orange-50/40 to-white border-amber-200/60',   'tailwind', 'Kortfarve: Stram op',      NULL, false),
    (v_version_id, 'nuvio_flow', 'FLOW_COLOR_GOOD_CARD',    NULL, 'bg-gradient-to-br from-emerald-50/80 via-teal-50/30 to-white border-emerald-200/50', 'tailwind', 'Kortfarve: Hold kursen + Godt tempo', NULL, false),
    (v_version_id, 'nuvio_flow', 'FLOW_COLOR_FLOW_CARD',    NULL, 'bg-gradient-to-br from-slate-50 via-gray-50/80 to-white border-yellow-300/40',     'tailwind', 'Kortfarve: Nuvio Flow',    NULL, false)
  ON CONFLICT (version_id, key) DO NOTHING;

END $$;
