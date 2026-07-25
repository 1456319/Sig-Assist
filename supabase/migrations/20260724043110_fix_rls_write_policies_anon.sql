/*
# Fix RLS write policies — open all writes to anon + authenticated

## Summary
This app has no sign-in screen. The client runs under the anon key for its entire
lifetime, so every write policy that is scoped TO authenticated only silently blocks
all inserts, updates, and deletes made by the frontend.

The SELECT policies on all three tables already correctly list TO anon, authenticated.
The nine write policies (INSERT/UPDATE/DELETE on sig_dictionary, sig_expansions,
tech_rules) were mistakenly scoped TO authenticated only.

This migration drops and recreates those nine policies to include TO anon, authenticated.
USING (true) / WITH CHECK (true) is intentional and correct for a single-tenant
no-auth app where the data is shared/public by design.

## Tables affected
- public.sig_dictionary  — INSERT, UPDATE, DELETE
- public.sig_expansions  — INSERT, UPDATE, DELETE
- public.tech_rules      — INSERT, UPDATE, DELETE

## No data changes; no structural changes.
*/

-- ── sig_dictionary ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "anon_insert_sig_dictionary" ON public.sig_dictionary;
CREATE POLICY "anon_insert_sig_dictionary" ON public.sig_dictionary
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_sig_dictionary" ON public.sig_dictionary;
CREATE POLICY "anon_update_sig_dictionary" ON public.sig_dictionary
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_sig_dictionary" ON public.sig_dictionary;
CREATE POLICY "anon_delete_sig_dictionary" ON public.sig_dictionary
  FOR DELETE TO anon, authenticated USING (true);

-- ── sig_expansions ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "auth_insert_sig_expansions" ON public.sig_expansions;
CREATE POLICY "auth_insert_sig_expansions" ON public.sig_expansions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_sig_expansions" ON public.sig_expansions;
CREATE POLICY "auth_update_sig_expansions" ON public.sig_expansions
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_sig_expansions" ON public.sig_expansions;
CREATE POLICY "auth_delete_sig_expansions" ON public.sig_expansions
  FOR DELETE TO anon, authenticated USING (true);

-- ── tech_rules ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "anon_insert_tech_rules" ON public.tech_rules;
CREATE POLICY "anon_insert_tech_rules" ON public.tech_rules
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_tech_rules" ON public.tech_rules;
CREATE POLICY "anon_update_tech_rules" ON public.tech_rules
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_tech_rules" ON public.tech_rules;
CREATE POLICY "anon_delete_tech_rules" ON public.tech_rules
  FOR DELETE TO anon, authenticated USING (true);
