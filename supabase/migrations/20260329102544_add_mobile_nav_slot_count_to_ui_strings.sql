/*
  # Add mobile nav slot count to ui_strings

  ## Summary
  Inserts a new ui_strings entry to control the number of configurable
  slots in the mobile bottom navigation bar.

  ## Details
  - Key: mobile_nav_slot_count
  - Default value: '4' (4 configurable slots + 1 fixed burger menu = 5 total)
  - Valid range: 2-4 (2 configurable + burger = 3 min, 4 configurable + burger = 5 max)
*/

INSERT INTO ui_strings (key, value, description)
VALUES (
  'mobile_nav_slot_count',
  '4',
  'Antal konfigurerbare slots i bundmenuen (2-4). Burger-menu er altid fast.'
)
ON CONFLICT (key) DO NOTHING;
