/*
# Create SIG Dictionary Table

## Summary
Creates the `sig_dictionary` table for storing pharmacy SIG codes and their translations.
This is the core lookup table for the HL7 SIG Pre-Parser & Normalization Workbench.

## New Tables

### sig_dictionary
- `id` (uuid, primary key) — unique row identifier
- `sig_code` (text, unique, not null) — the SIG abbreviation code (e.g., "QD", "BID", "PRN")
- `translation` (text, not null) — human-readable meaning (e.g., "Once Daily", "Twice Daily", "As Needed")
- `status` (text, not null, default 'ACTIVE') — either 'ACTIVE' or 'OBSOLETE'
- `redirect_codes` (text[], default '{}') — array of codes that should replace an OBSOLETE code during parsing
- `is_high_risk` (boolean, default false) — flags codes that require pharmacist review
- `high_risk_warning` (text, default '') — tooltip warning text displayed when is_high_risk is true
- `created_at` (timestamptz) — creation timestamp
- `updated_at` (timestamptz) — last update timestamp

## Security
- RLS enabled on sig_dictionary
- Open anon + authenticated CRUD policies (single-tenant, no auth required)

## Indexes
- Unique index on sig_code (uppercase normalized) for fast lookup
- Index on status for filtering active/obsolete entries

## Seed Data
- Common pharmacy SIG codes (QD, BID, TID, QID, PRN, etc.)
- One OBSOLETE redirect example: QDPRN → [QD, PRN]
- One high-risk example: QID (4x daily flagged for certain medications)
*/

CREATE TABLE IF NOT EXISTS sig_dictionary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sig_code text UNIQUE NOT NULL,
  translation text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'OBSOLETE')),
  redirect_codes text[] NOT NULL DEFAULT '{}',
  is_high_risk boolean NOT NULL DEFAULT false,
  high_risk_warning text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sig_dictionary_status ON sig_dictionary(status);
CREATE INDEX IF NOT EXISTS idx_sig_dictionary_sig_code ON sig_dictionary(upper(sig_code));

ALTER TABLE sig_dictionary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sig_dictionary" ON sig_dictionary;
CREATE POLICY "anon_select_sig_dictionary" ON sig_dictionary FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_sig_dictionary" ON sig_dictionary;
CREATE POLICY "anon_insert_sig_dictionary" ON sig_dictionary FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_sig_dictionary" ON sig_dictionary;
CREATE POLICY "anon_update_sig_dictionary" ON sig_dictionary FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_sig_dictionary" ON sig_dictionary;
CREATE POLICY "anon_delete_sig_dictionary" ON sig_dictionary FOR DELETE
  TO anon, authenticated USING (true);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_sig_dictionary_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sig_dictionary_updated_at ON sig_dictionary;
CREATE TRIGGER trg_sig_dictionary_updated_at
  BEFORE UPDATE ON sig_dictionary
  FOR EACH ROW EXECUTE FUNCTION update_sig_dictionary_updated_at();

-- Seed common pharmacy SIG codes
INSERT INTO sig_dictionary (sig_code, translation, status, redirect_codes, is_high_risk, high_risk_warning) VALUES
  ('QD',      'Once Daily',                          'ACTIVE',   '{}',             false, ''),
  ('BID',     'Twice Daily',                         'ACTIVE',   '{}',             false, ''),
  ('TID',     'Three Times Daily',                   'ACTIVE',   '{}',             false, ''),
  ('QID',     'Four Times Daily',                    'ACTIVE',   '{}',             true,  'QID dosing increases risk of adverse events. Verify patient tolerance and consider simplified regimen.'),
  ('QHS',     'Every Bedtime',                       'ACTIVE',   '{}',             false, ''),
  ('QAM',     'Every Morning',                       'ACTIVE',   '{}',             false, ''),
  ('QPM',     'Every Evening',                       'ACTIVE',   '{}',             false, ''),
  ('Q4H',     'Every 4 Hours',                       'ACTIVE',   '{}',             false, ''),
  ('Q6H',     'Every 6 Hours',                       'ACTIVE',   '{}',             false, ''),
  ('Q8H',     'Every 8 Hours',                       'ACTIVE',   '{}',             false, ''),
  ('Q12H',    'Every 12 Hours',                      'ACTIVE',   '{}',             false, ''),
  ('PRN',     'As Needed',                           'ACTIVE',   '{}',             false, ''),
  ('AC',      'Before Meals',                        'ACTIVE',   '{}',             false, ''),
  ('PC',      'After Meals',                         'ACTIVE',   '{}',             false, ''),
  ('CC',      'With Meals',                          'ACTIVE',   '{}',             false, ''),
  ('ATC',     'Around The Clock',                    'ACTIVE',   '{}',             false, ''),
  ('STAT',    'Immediately',                         'ACTIVE',   '{}',             true,  'STAT orders require immediate dispensing and administration. Verify prescriber authorization.'),
  ('NTE',     'As Directed',                         'ACTIVE',   '{}',             false, ''),
  ('PO',      'By Mouth',                            'ACTIVE',   '{}',             false, ''),
  ('SL',      'Sublingual',                          'ACTIVE',   '{}',             false, ''),
  ('TOP',     'Topically',                           'ACTIVE',   '{}',             false, ''),
  ('IM',      'Intramuscular',                       'ACTIVE',   '{}',             true,  'IM administration requires trained clinical staff. Confirm route appropriateness.'),
  ('IV',      'Intravenous',                         'ACTIVE',   '{}',             true,  'IV administration requires trained clinical staff and sterile technique. Verify concentration and rate.'),
  ('SC',      'Subcutaneous',                        'ACTIVE',   '{}',             false, ''),
  ('SQ',      'Subcutaneous',                        'ACTIVE',   '{}',             false, ''),
  ('NG',      'Nasogastric Tube',                    'ACTIVE',   '{}',             false, ''),
  ('PEG',     'PEG Tube',                            'ACTIVE',   '{}',             false, ''),
  ('PR',      'Per Rectum',                          'ACTIVE',   '{}',             false, ''),
  ('TAB',     'Tablet',                              'ACTIVE',   '{}',             false, ''),
  ('CAP',     'Capsule',                             'ACTIVE',   '{}',             false, ''),
  ('TSP',     'Teaspoon (5 mL)',                     'ACTIVE',   '{}',             false, ''),
  ('TBSP',    'Tablespoon (15 mL)',                  'ACTIVE',   '{}',             false, ''),
  ('GTT',     'Drop(s)',                             'ACTIVE',   '{}',             false, ''),
  ('MCG',     'Micrograms',                          'ACTIVE',   '{}',             false, ''),
  ('MG',      'Milligrams',                          'ACTIVE',   '{}',             false, ''),
  ('ML',      'Milliliters',                         'ACTIVE',   '{}',             false, ''),
  ('SS',      'One Half',                            'ACTIVE',   '{}',             false, ''),
  ('UD',      'As Directed',                         'ACTIVE',   '{}',             false, ''),
  ('UTD',     'As Directed',                         'ACTIVE',   '{}',             false, ''),
  ('NR',      'No Refills',                          'ACTIVE',   '{}',             false, ''),
  ('RF',      'Refill',                              'ACTIVE',   '{}',             false, ''),
  ('WA',      'While Awake',                         'ACTIVE',   '{}',             false, ''),
  ('HS',      'At Bedtime',                          'ACTIVE',   '{}',             false, ''),
  ('QDPRN',   'Once Daily As Needed (OBSOLETE)',     'OBSOLETE', '{QD,PRN}',       false, ''),
  ('BIDPRN',  'Twice Daily As Needed (OBSOLETE)',    'OBSOLETE', '{BID,PRN}',      false, ''),
  ('TIDPRN',  'Three Times Daily As Needed (OBSOLETE)', 'OBSOLETE', '{TID,PRN}',  false, ''),
  ('QHS-PRN', 'Bedtime As Needed (OBSOLETE)',        'OBSOLETE', '{QHS,PRN}',      false, ''),
  ('QDAC',    'Once Daily Before Meals (OBSOLETE)',  'OBSOLETE', '{QD,AC}',        false, ''),
  ('BIDAC',   'Twice Daily Before Meals (OBSOLETE)', 'OBSOLETE', '{BID,AC}',       false, '')
ON CONFLICT (sig_code) DO NOTHING;
