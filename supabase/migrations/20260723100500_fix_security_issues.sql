
/*
# Fix security issues: mutable search_path on trigger functions + overly-permissive RLS write policies

## Summary
Addresses two categories of security scanner findings:

### 1. Function Search Path Mutable
Both `update_sig_dictionary_updated_at` and `update_tech_rules_updated_at` trigger functions
were created without a fixed `search_path`, making them vulnerable to search_path injection.
Fix: recreate both functions with `SET search_path = ''` and use fully-qualified
`pg_catalog.now()` so the functions are immune to schema manipulation.

### 2. RLS Write Policies Always True for anon
INSERT, UPDATE, and DELETE policies on `sig_dictionary` and `tech_rules` granted unrestricted
write access to both `anon` AND `authenticated` roles. Since this is an internal admin tool,
anonymous write access is not appropriate — only authenticated sessions should be able to
create, modify, or delete dictionary entries and tech rules.

Fix: drop and recreate the INSERT/UPDATE/DELETE policies scoped to `authenticated` only.
SELECT policies remain open to `anon, authenticated` so the anon-key frontend can still
read dictionary data and rules for the parser workbench.

### Tables modified
- `sig_dictionary`: INSERT, UPDATE, DELETE policies now `TO authenticated` only
- `tech_rules`: INSERT, UPDATE, DELETE policies now `TO authenticated` only

### Functions modified
- `public.update_sig_dictionary_updated_at`: fixed search_path
- `public.update_tech_rules_updated_at`: fixed search_path
*/

-- ── Fix trigger function search paths ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_sig_dictionary_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_tech_rules_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

-- ── sig_dictionary: restrict writes to authenticated only ─────────────────────

DROP POLICY IF EXISTS "anon_insert_sig_dictionary" ON public.sig_dictionary;
CREATE POLICY "anon_insert_sig_dictionary" ON public.sig_dictionary
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_sig_dictionary" ON public.sig_dictionary;
CREATE POLICY "anon_update_sig_dictionary" ON public.sig_dictionary
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_sig_dictionary" ON public.sig_dictionary;
CREATE POLICY "anon_delete_sig_dictionary" ON public.sig_dictionary
  FOR DELETE TO authenticated
  USING (true);

-- ── tech_rules: restrict writes to authenticated only ────────────────────────

DROP POLICY IF EXISTS "anon_insert_tech_rules" ON public.tech_rules;
CREATE POLICY "anon_insert_tech_rules" ON public.tech_rules
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_tech_rules" ON public.tech_rules;
CREATE POLICY "anon_update_tech_rules" ON public.tech_rules
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_tech_rules" ON public.tech_rules;
CREATE POLICY "anon_delete_tech_rules" ON public.tech_rules
  FOR DELETE TO authenticated
  USING (true);
