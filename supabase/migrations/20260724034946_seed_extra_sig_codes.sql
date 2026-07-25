
/*
# Seed extra SIG dictionary codes

Inserts 55 additional facility-specific SIG codes into the sig_dictionary table.
These cover:
- Self-administration flags (UNSA)
- Pain scale qualifiers (1-10/10, 1-3/10, 1-4/10)
- Patch application codes (2PA, 3PA)
- Completion/direction codes (UD, UF, UG)
- Administration route (IA)
- Hold parameter (SBP110)
- Z-Pak dosing codes (ZPAK1, ZPAK2)
- Single-use protocol codes (SPS)
- Condition-specific FOR codes (FMDD, FXER, FDER, FVITDD, etc.)
- Behavioral qualifier (WBEHD)
- Safety instruction (DNCCS)
- Shift-specific frequency codes (QDDS, QDPS, QDNS, BIDDPS, BIDDNS, BIDPNS)

Uses upsert (ON CONFLICT DO NOTHING) so re-running is safe and existing customized
entries are never overwritten.
*/

INSERT INTO public.sig_dictionary (sig_code, translation, status, redirect_codes, is_high_risk, high_risk_warning)
VALUES
  ('UNSA',     'UNSUPERVISED SELF-ADMINISTRATION',                              'ACTIVE', '{}', false, ''),
  ('1-10/10',  '1-10 ON A SCALE TO 10',                                         'ACTIVE', '{}', false, ''),
  ('1-3/10',   '1-3 ON A SCALE TO 10',                                          'ACTIVE', '{}', false, ''),
  ('1-4/10',   '1-4 ON A SCALE TO 10',                                          'ACTIVE', '{}', false, ''),
  ('2PA',      'APPLY 2 PATCHES',                                                'ACTIVE', '{}', false, ''),
  ('3PA',      'APPLY 3 PATCHES',                                                'ACTIVE', '{}', false, ''),
  ('UD',       'AS DIRECTED',                                                    'ACTIVE', '{}', false, ''),
  ('UF',       'UNTIL FINISHED',                                                 'ACTIVE', '{}', false, ''),
  ('UG',       'UNTIL GONE',                                                     'ACTIVE', '{}', false, ''),
  ('IA',       'INTRA-ARTICULARLY',                                              'ACTIVE', '{}', false, ''),
  ('SBP110',   'HOLD FOR SYSTOLIC BLOOD PRESSURE <110',                          'ACTIVE', '{}', true,  'HOLD PARAMETER: Verify systolic BP before administration'),
  ('ZPAK1',    'ADMINISTER 2 TABLETS (500MG) BY MOUTH DAILY FOR 1 DAY',         'ACTIVE', '{}', false, ''),
  ('ZPAK2',    'ADMINISTER 1 TABLET BY MOUTH DAILY FOR 4 DAYS',                 'ACTIVE', '{}', false, ''),
  ('SPS',      'ADM 60ML (15GM) PO X1 ONLY X1D FOR HYPERKALEMIA',               'ACTIVE', '{}', true,  'Single-use protocol — verify hyperkalemia indication before dispensing'),
  ('FMDD',     'FOR MAJOR DEPRESSIVE DISORDER',                                  'ACTIVE', '{}', false, ''),
  ('FXER',     'FOR XEROSIS',                                                    'ACTIVE', '{}', false, ''),
  ('FDER',     'FOR DERMATITIS',                                                 'ACTIVE', '{}', false, ''),
  ('FVITDD',   'FOR VITAMIN D DEFICIENCY',                                       'ACTIVE', '{}', false, ''),
  ('FVITB12D', 'FOR VITAMIN B-12 DEFICIENCY',                                   'ACTIVE', '{}', false, ''),
  ('FVITB1D',  'FOR VITAMIN B-1 DEFICIENCY',                                    'ACTIVE', '{}', false, ''),
  ('FASI',     'FOR ALTERED SKIN INTEGRITY',                                     'ACTIVE', '{}', false, ''),
  ('FPRU',     'FOR PRURITIS',                                                   'ACTIVE', '{}', false, ''),
  ('FRLS',     'FOR RESTLESS LEG SYNDROME',                                      'ACTIVE', '{}', false, ''),
  ('FCD',      'FOR CALCIUM DEFICIENCY',                                         'ACTIVE', '{}', false, ''),
  ('FFRET',    'FOR FLUID RETENTION',                                            'ACTIVE', '{}', false, ''),
  ('FFOL',     'FOR FLUID OVERLOAD',                                             'ACTIVE', '{}', false, ''),
  ('FLTH',     'LOW THYROID HORMONE',                                            'ACTIVE', '{}', false, ''),
  ('FDS',      'FOR DRY SKIN',                                                   'ACTIVE', '{}', false, ''),
  ('FWC',      'FOR WOUND CARE',                                                 'ACTIVE', '{}', false, ''),
  ('FIS',      'FOR INCREASED SECRETIONS',                                       'ACTIVE', '{}', false, ''),
  ('FSEC',     'FOR SECRETIONS',                                                 'ACTIVE', '{}', false, ''),
  ('FECZ',     'FOR ECZEMA',                                                     'ACTIVE', '{}', false, ''),
  ('FTC',      'FOR TERMINAL CONGESTION',                                        'ACTIVE', '{}', false, ''),
  ('FBC',      'FOR BLOOD CLOTS',                                                'ACTIVE', '{}', false, ''),
  ('FBLO',     'FOR BLOATING',                                                   'ACTIVE', '{}', false, ''),
  ('FGAS',     'FOR GAS',                                                        'ACTIVE', '{}', false, ''),
  ('FRASH',    'FOR RASH',                                                       'ACTIVE', '{}', false, ''),
  ('FSTR',     'FOR STROKE',                                                     'ACTIVE', '{}', false, ''),
  ('FHH',      'FOR HEART HEALTH',                                               'ACTIVE', '{}', false, ''),
  ('FBT',      'FOR BLOOD THINNER',                                              'ACTIVE', '{}', false, ''),
  ('FBR',      'FOR BOWEL REGIMEN',                                              'ACTIVE', '{}', false, ''),
  ('FINFL',    'FOR INFLAMMATION',                                               'ACTIVE', '{}', false, ''),
  ('FCAN',     'FOR CANCER',                                                     'ACTIVE', '{}', false, ''),
  ('FALGY',    'FOR ALLERGIES',                                                  'ACTIVE', '{}', false, ''),
  ('FBRO',     'FOR BRONCHITIS',                                                 'ACTIVE', '{}', false, ''),
  ('FLEU',     'FOR LEUKOCYTOSIS',                                               'ACTIVE', '{}', false, ''),
  ('FRAD',     'FOR RADICULOPATHY',                                              'ACTIVE', '{}', false, ''),
  ('FLRAD',    'FOR LUMBAR RADICULOPATHY',                                       'ACTIVE', '{}', false, ''),
  ('FCHEM',    'FOR CHEMOTHERAPY',                                               'ACTIVE', '{}', false, ''),
  ('FHX',      'FOR HISTORY OF',                                                 'ACTIVE', '{}', false, ''),
  ('FMASD',    'FOR MASD',                                                       'ACTIVE', '{}', false, ''),
  ('WBEHD',    'WITH BEHAVIORAL DISTURBANCE',                                    'ACTIVE', '{}', false, ''),
  ('DNCCS',    'DO NOT CRUSH, CHEW, OR SPLIT',                                   'ACTIVE', '{}', true,  'Extended-release or enteric-coated — crushing may alter drug release'),
  ('QDDS',     'ONE TIME A DAY (DURING DAY SHIFT)',                              'ACTIVE', '{}', false, ''),
  ('QDPS',     'ONE TIME A DAY (DURING EVENING SHIFT)',                          'ACTIVE', '{}', false, ''),
  ('QDNS',     'ONE TIME A DAY (DURING NIGHT SHIFT)',                            'ACTIVE', '{}', false, ''),
  ('BIDDPS',   'TWO TIMES A DAY (DURING DAY AND EVENING SHIFT)',                 'ACTIVE', '{}', false, ''),
  ('BIDDNS',   'TWO TIMES A DAY (DURING DAY AND NIGHT SHIFT)',                   'ACTIVE', '{}', false, ''),
  ('BIDPNS',   'TWO TIMES A DAY (DURING EVENING AND NIGHT SHIFT)',               'ACTIVE', '{}', false, '')
ON CONFLICT (sig_code) DO NOTHING;
