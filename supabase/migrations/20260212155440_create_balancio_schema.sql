/*
  # Create Balancio Pro App Schema

  1. New Tables
    - `budgets`
      - `id` (uuid, primary key)
      - `name` (text)
      - `year` (integer) - e.g., 2026
      - `start_month` (integer, 1-12) - default 1
      - `end_month` (integer, 1-12) - default 12
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `category_groups`
      - `id` (uuid, primary key)
      - `name` (text, unique) - Hovedkategori name
      - `created_at` (timestamptz)

    - `categories`
      - `id` (uuid, primary key)
      - `name` (text) - Kategori name
      - `category_group_id` (uuid, FK -> category_groups)
      - `created_at` (timestamptz)
      - Unique constraint on (category_group_id, name)

    - `transactions`
      - `id` (uuid, primary key)
      - `budget_id` (uuid, FK -> budgets)
      - `date` (date)
      - `amount` (numeric)
      - `category_group_id` (uuid, nullable FK -> category_groups)
      - `category_id` (uuid, nullable FK -> categories)
      - `created_at` (timestamptz)

    - `budget_lines`
      - `id` (uuid, primary key)
      - `budget_id` (uuid, FK -> budgets)
      - `category_id` (uuid, FK -> categories)
      - `amount_planned` (numeric)
      - `created_at` (timestamptz)
      - Unique constraint on (budget_id, category_id)

  2. Security
    - Enable RLS on all tables
    - Add policies for public access (since no auth in MVP)

  3. Notes
    - All IDs are UUIDs with automatic generation
    - Timestamps use timestamptz for proper timezone handling
    - Amount fields use numeric type for precise decimal calculations
    - Foreign key constraints ensure referential integrity
    - Unique constraints prevent duplicate entries
*/

-- Create budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  year integer NOT NULL,
  start_month integer NOT NULL DEFAULT 1 CHECK (start_month >= 1 AND start_month <= 12),
  end_month integer NOT NULL DEFAULT 12 CHECK (end_month >= 1 AND end_month <= 12),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create category_groups table
CREATE TABLE IF NOT EXISTS category_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category_group_id uuid NOT NULL REFERENCES category_groups(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (category_group_id, name)
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  date date NOT NULL,
  amount numeric NOT NULL,
  category_group_id uuid REFERENCES category_groups(id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create budget_lines table
CREATE TABLE IF NOT EXISTS budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount_planned numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (budget_id, category_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_categories_group ON categories(category_group_id);
CREATE INDEX IF NOT EXISTS idx_transactions_budget ON transactions(budget_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_budget_lines_budget ON budget_lines(budget_id);

-- Enable Row Level Security
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_lines ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (MVP - no authentication)
-- All users can read all data
CREATE POLICY "Allow public read access to budgets"
  ON budgets FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to budgets"
  ON budgets FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to budgets"
  ON budgets FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to budgets"
  ON budgets FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Allow public read access to category_groups"
  ON category_groups FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to category_groups"
  ON category_groups FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to category_groups"
  ON category_groups FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to category_groups"
  ON category_groups FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Allow public read access to categories"
  ON categories FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to categories"
  ON categories FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to categories"
  ON categories FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to categories"
  ON categories FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Allow public read access to transactions"
  ON transactions FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to transactions"
  ON transactions FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to transactions"
  ON transactions FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to transactions"
  ON transactions FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Allow public read access to budget_lines"
  ON budget_lines FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to budget_lines"
  ON budget_lines FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to budget_lines"
  ON budget_lines FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to budget_lines"
  ON budget_lines FOR DELETE
  TO public
  USING (true);