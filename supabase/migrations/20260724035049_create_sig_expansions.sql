
/*
# Create sig_expansions table

## Summary
Adds the sig_expansions table to support user-defined phrase-level alias/expansion rules.

This is distinct from tech_rules (which do regex/contains/replace transforms on raw text):
expansions map one or more short-form input aliases to a fixed full-text output phrase.
The parser applies expansions as a pre-processing step before tokenization.

## New Tables

### sig_expansions
- `id` (uuid, primary key)
- `output_phrase` (text, not null) — the canonical full-text phrase to output, e.g. "FOR GENERALIZED ANXIETY DISORDER"
- `aliases` (text[], not null) — the input strings that trigger this expansion, e.g. ["GEN ANX DIS", "GAD", "FGAD"]
- `match_type` (text, default 'token') — 'token' (whole-token match) or 'phrase' (substring/phrase match)
- `enabled` (boolean, default true)
- `priority` (integer, default 100) — lower runs first
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

## Security
- RLS enabled.
- SELECT open to anon + authenticated (parser workbench reads expansions).
- INSERT/UPDATE/DELETE restricted to authenticated only (matches existing table policy pattern).

## Notes
- Trigger keeps updated_at current.
- ON CONFLICT (id) safe for upsert pattern used by the service layer.
*/

CREATE TABLE IF NOT EXISTS public.sig_expansions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  output_phrase text        NOT NULL,
  aliases       text[]      NOT NULL DEFAULT '{}',
  match_type    text        NOT NULL DEFAULT 'token' CHECK (match_type IN ('token', 'phrase')),
  enabled       boolean     NOT NULL DEFAULT true,
  priority      integer     NOT NULL DEFAULT 100,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sig_expansions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sig_expansions" ON public.sig_expansions;
CREATE POLICY "anon_select_sig_expansions" ON public.sig_expansions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_sig_expansions" ON public.sig_expansions;
CREATE POLICY "auth_insert_sig_expansions" ON public.sig_expansions
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_sig_expansions" ON public.sig_expansions;
CREATE POLICY "auth_update_sig_expansions" ON public.sig_expansions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_sig_expansions" ON public.sig_expansions;
CREATE POLICY "auth_delete_sig_expansions" ON public.sig_expansions
  FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_sig_expansions_updated_at()
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

DROP TRIGGER IF EXISTS trg_sig_expansions_updated_at ON public.sig_expansions;
CREATE TRIGGER trg_sig_expansions_updated_at
  BEFORE UPDATE ON public.sig_expansions
  FOR EACH ROW EXECUTE FUNCTION public.update_sig_expansions_updated_at();
