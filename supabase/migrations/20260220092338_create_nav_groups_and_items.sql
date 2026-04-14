/*
  # Create nav_groups and nav_items tables

  ## Purpose
  Enables admin-managed navigation menu configuration.
  Replaces the hardcoded navGroups array in sidebar.tsx and
  burgerSections array in mobile-nav.tsx.

  ## New Tables

  ### nav_groups
  - id (uuid, PK)
  - name (text) — display label for the group header
  - sort_order (integer) — controls rendering order
  - created_at / updated_at

  ### nav_items
  - id (uuid, PK)
  - name (text) — display label
  - href (text, unique) — route path, used as stable identity
  - icon_name (text) — lucide icon key, e.g. "Home"
  - group_id (uuid, FK -> nav_groups.id, nullable)
  - sort_order (integer) — controls order within a group
  - is_system (boolean) — true = belongs to Backend submenu, not movable via admin
  - created_at / updated_at

  ## Security
  Authenticated users can read and write (internal admin tool).

  ## Notes
  - "Plan" item href=/plan keeps its dynamic submenu (budget links) hardcoded in sidebar;
    the DB only controls its group membership and sort order.
  - Backend submenu items are hardcoded in the sidebar and NOT seeded here.
  - group_id is nullable so items can be unassigned without crashing.
  - href has a UNIQUE constraint to enable upsert-on-conflict.
*/

CREATE TABLE IF NOT EXISTS public.nav_groups (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nav_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  href        text        NOT NULL,
  icon_name   text        NOT NULL,
  group_id    uuid        REFERENCES public.nav_groups(id) ON DELETE SET NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  is_system   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nav_items ADD CONSTRAINT nav_items_href_key UNIQUE (href);

CREATE INDEX IF NOT EXISTS idx_nav_items_group_id ON public.nav_items(group_id);

ALTER TABLE public.nav_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nav_items  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read nav_groups"
  ON public.nav_groups FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert nav_groups"
  ON public.nav_groups FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update nav_groups"
  ON public.nav_groups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete nav_groups"
  ON public.nav_groups FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read nav_items"
  ON public.nav_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert nav_items"
  ON public.nav_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update nav_items"
  ON public.nav_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete nav_items"
  ON public.nav_items FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_nav_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER nav_groups_updated_at
  BEFORE UPDATE ON public.nav_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_nav_updated_at();

CREATE TRIGGER nav_items_updated_at
  BEFORE UPDATE ON public.nav_items
  FOR EACH ROW EXECUTE FUNCTION public.update_nav_updated_at();

INSERT INTO public.nav_groups (id, name, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Økonomi',       0),
  ('00000000-0000-0000-0000-000000000002', 'Indstillinger',  1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.nav_items (name, href, icon_name, group_id, sort_order, is_system) VALUES
  ('Hjem',          '/',              'Home',            '00000000-0000-0000-0000-000000000001', 0, false),
  ('Plan',          '/plan',          'LayoutDashboard', '00000000-0000-0000-0000-000000000001', 1, false),
  ('Investering',   '/investering',   'TrendingUp',      '00000000-0000-0000-0000-000000000001', 2, false),
  ('Opsparing',     '/maal',          'Target',          '00000000-0000-0000-0000-000000000001', 3, false),
  ('Husstand',      '/husstand',      'Users',           '00000000-0000-0000-0000-000000000001', 4, false),
  ('Nuvio Checkup', '/checkup',       'Activity',        '00000000-0000-0000-0000-000000000002', 0, false),
  ('Indstillinger', '/indstillinger', 'Settings',        '00000000-0000-0000-0000-000000000002', 1, false)
ON CONFLICT (href) DO NOTHING;
