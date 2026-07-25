/*
# Create Tech Rules Table

## Summary
Creates the `tech_rules` table for storing custom transformation rules
that pharmacy technicians can create to normalize SIG input before dictionary lookup.

## New Tables

### tech_rules
- `id` (uuid, primary key) — unique row identifier
- `name` (text, not null) — human-readable rule name
- `target_type` (text, not null) — matching strategy: 'contains', 'starts_with', 'ends_with', 'regex', 'exact'
- `match_values` (text[], not null) — array of strings/patterns to match against
- `action_type` (text, not null) — transformation: 'replace', 'append', 'prepend'
- `output_value` (text, not null) — the replacement/append/prepend value
- `priority` (integer, not null) — lower numbers execute first (1 = highest priority)
- `enabled` (boolean, default true) — whether the rule is active during parsing
- `created_at` (timestamptz) — creation timestamp
- `updated_at` (timestamptz) — last update timestamp

## Security
- RLS enabled on tech_rules
- Open anon + authenticated CRUD policies (single-tenant, no auth required)

## Indexes
- Index on priority for ordered rule retrieval
- Index on enabled for filtering active rules

## Seed Data
- Sample rules demonstrating common pharmacy SIG normalization patterns
*/

CREATE TABLE IF NOT EXISTS tech_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('contains', 'starts_with', 'ends_with', 'regex', 'exact')),
  match_values text[] NOT NULL DEFAULT '{}',
  action_type text NOT NULL CHECK (action_type IN ('replace', 'append', 'prepend')),
  output_value text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tech_rules_priority ON tech_rules(priority);
CREATE INDEX IF NOT EXISTS idx_tech_rules_enabled ON tech_rules(enabled);

ALTER TABLE tech_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_tech_rules" ON tech_rules;
CREATE POLICY "anon_select_tech_rules" ON tech_rules FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_tech_rules" ON tech_rules;
CREATE POLICY "anon_insert_tech_rules" ON tech_rules FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_tech_rules" ON tech_rules;
CREATE POLICY "anon_update_tech_rules" ON tech_rules FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_tech_rules" ON tech_rules;
CREATE POLICY "anon_delete_tech_rules" ON tech_rules FOR DELETE
  TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION update_tech_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tech_rules_updated_at ON tech_rules;
CREATE TRIGGER trg_tech_rules_updated_at
  BEFORE UPDATE ON tech_rules
  FOR EACH ROW EXECUTE FUNCTION update_tech_rules_updated_at();

-- Seed sample normalization rules
INSERT INTO tech_rules (name, target_type, match_values, action_type, output_value, priority, enabled) VALUES
  ('Expand Pneumonia Abbreviations',   'contains',    '{pne,pna}',          'replace',  'Pneumonia',          10,  true),
  ('Normalize "by mouth" to PO',       'contains',    '{"by mouth","orally","oral"}', 'replace', 'PO',        20,  true),
  ('Normalize "as needed" to PRN',     'contains',    '{"as needed","when needed","if needed"}', 'replace', 'PRN', 30, true),
  ('Normalize "at bedtime" to QHS',    'contains',    '{"at bedtime","before bed","at night"}', 'replace', 'QHS', 40, true),
  ('Normalize "twice daily" to BID',   'contains',    '{"twice daily","twice a day","2x daily","2 times daily"}', 'replace', 'BID', 50, true),
  ('Normalize "once daily" to QD',     'contains',    '{"once daily","once a day","1x daily","1 time daily"}', 'replace', 'QD', 60, true),
  ('Normalize "three times" to TID',   'contains',    '{"three times daily","three times a day","3x daily","3 times daily"}', 'replace', 'TID', 70, true),
  ('Normalize "four times" to QID',    'contains',    '{"four times daily","four times a day","4x daily","4 times daily"}', 'replace', 'QID', 80, true)
ON CONFLICT DO NOTHING;
