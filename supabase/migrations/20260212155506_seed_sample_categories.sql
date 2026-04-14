/*
  # Seed Sample Danish Categories

  1. Category Groups (Hovedkategorier)
    - Indkomst (Income)
    - Bolig (Housing)
    - Mad & Drikke (Food & Drink)
    - Transport (Transport)
    - Sundhed (Health)
    - Fritid (Leisure)
    - Opsparing (Savings)

  2. Categories (Kategorier)
    - Multiple categories under each group representing common budget items

  3. Notes
    - All names are in Danish
    - Represents typical Danish household budget categories
*/

-- Insert category groups
INSERT INTO category_groups (name) VALUES
  ('Indkomst'),
  ('Bolig'),
  ('Mad & Drikke'),
  ('Transport'),
  ('Sundhed'),
  ('Fritid'),
  ('Opsparing')
ON CONFLICT (name) DO NOTHING;

-- Insert categories for Indkomst
INSERT INTO categories (name, category_group_id)
SELECT 'Løn', id FROM category_groups WHERE name = 'Indkomst'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'Bonus', id FROM category_groups WHERE name = 'Indkomst'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'Freelance', id FROM category_groups WHERE name = 'Indkomst'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'Andet indkomst', id FROM category_groups WHERE name = 'Indkomst'
ON CONFLICT (category_group_id, name) DO NOTHING;

-- Insert categories for Bolig
INSERT INTO categories (name, category_group_id)
SELECT 'Husleje', id FROM category_groups WHERE name = 'Bolig'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'El & Vand', id FROM category_groups WHERE name = 'Bolig'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'Internet & TV', id FROM category_groups WHERE name = 'Bolig'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'Forsikring', id FROM category_groups WHERE name = 'Bolig'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'Vedligeholdelse', id FROM category_groups WHERE name = 'Bolig'
ON CONFLICT (category_group_id, name) DO NOTHING;

-- Insert categories for Mad & Drikke
INSERT INTO categories (name, category_group_id)
SELECT 'Dagligvarer', id FROM category_groups WHERE name = 'Mad & Drikke'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'Restaurant', id FROM category_groups WHERE name = 'Mad & Drikke'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'Café', id FROM category_groups WHERE name = 'Mad & Drikke'
ON CONFLICT (category_group_id, name) DO NOTHING;

-- Insert categories for Transport
INSERT INTO categories (name, category_group_id)
SELECT 'Bil - Brændstof', id FROM category_groups WHERE name = 'Transport'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'Bil - Forsikring', id FROM category_groups WHERE name = 'Transport'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'Offentlig transport', id FROM category_groups WHERE name = 'Transport'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'Parkering', id FROM category_groups WHERE name = 'Transport'
ON CONFLICT (category_group_id, name) DO NOTHING;

-- Insert categories for Sundhed
INSERT INTO categories (name, category_group_id)
SELECT 'Læge', id FROM category_groups WHERE name = 'Sundhed'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'Medicin', id FROM category_groups WHERE name = 'Sundhed'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'Tandlæge', id FROM category_groups WHERE name = 'Sundhed'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'Fitness', id FROM category_groups WHERE name = 'Sundhed'
ON CONFLICT (category_group_id, name) DO NOTHING;

-- Insert categories for Fritid
INSERT INTO categories (name, category_group_id)
SELECT 'Underholdning', id FROM category_groups WHERE name = 'Fritid'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'Streaming', id FROM category_groups WHERE name = 'Fritid'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'Hobbyer', id FROM category_groups WHERE name = 'Fritid'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'Rejser', id FROM category_groups WHERE name = 'Fritid'
ON CONFLICT (category_group_id, name) DO NOTHING;

-- Insert categories for Opsparing
INSERT INTO categories (name, category_group_id)
SELECT 'Nødfond', id FROM category_groups WHERE name = 'Opsparing'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'Pension', id FROM category_groups WHERE name = 'Opsparing'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'Investeringer', id FROM category_groups WHERE name = 'Opsparing'
ON CONFLICT (category_group_id, name) DO NOTHING;

INSERT INTO categories (name, category_group_id)
SELECT 'Mål opsparing', id FROM category_groups WHERE name = 'Opsparing'
ON CONFLICT (category_group_id, name) DO NOTHING;