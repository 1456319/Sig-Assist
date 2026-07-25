INSERT INTO public.sig_dictionary (sig_code, translation, status)
VALUES
  ('1T', '1 TABLET', 'ACTIVE'),
  ('1C', '1 CAPSULE', 'ACTIVE'),
  ('1PKT', '1 PACKET', 'ACTIVE'),
  ('FGERD', 'FOR GERD', 'ACTIVE'),
  ('FSU', 'FOR SUPPLEMENT', 'ACTIVE'),
  ('FBPH', 'FOR BPH', 'ACTIVE'),
  ('FHYT', 'FOR HYPOTHYROIDISM', 'ACTIVE'),
  ('FGIP', 'FOR GI PROPHYLAXIS', 'ACTIVE'),
  ('FAA', 'FOR ANXIETY OR AGITATION', 'ACTIVE'),
  ('FSOBP', 'FOR SHORTNESS OF BREATH OR PAIN', 'ACTIVE'),
  ('FCEL', 'FOR CELLULITIS', 'ACTIVE'),
  ('FCOU', 'FOR COUGH', 'ACTIVE'),
  ('FDM', 'FOR DM', 'ACTIVE'),
  ('FDM2', 'FOR DM2', 'ACTIVE'),
  ('FHTN', 'FOR HTN', 'ACTIVE'),
  ('FSP', 'FOR SEVERE PAIN', 'ACTIVE'),
  ('FCON', 'FOR CONSTIPATION', 'ACTIVE'),
  ('FPAIN', 'FOR PAIN', 'ACTIVE'),
  ('FDVTP', 'FOR DVT PREVENTION', 'ACTIVE'),
  ('QDP/D', 'ONCE DAILY IN THE EVENING', 'ACTIVE'),
  ('QDA/B', 'ONCE DAILY BEFORE BREAKFAST', 'ACTIVE')
ON CONFLICT (sig_code) DO NOTHING;

INSERT INTO public.tech_rules (name, target_type, match_values, action_type, output_value, priority, enabled)
VALUES
  ('Give 1 tablet', 'contains', '{"give 1 tablet"}', 'replace', '1T', 10, true),
  ('Give 0.5 tablet', 'contains', '{"give 0.5 tablet"}', 'replace', '1/2T', 10, true),
  ('Give 1 capsule', 'contains', '{"give 1 capsule"}', 'replace', '1C', 10, true),
  ('Give 1 packet', 'contains', '{"give 1 packet"}', 'replace', '1PKT', 10, true),
  ('By mouth', 'contains', '{"by mouth", "oral"}', 'replace', 'PO', 20, true),
  ('One time a day', 'contains', '{"one time a day", "1 time a day"}', 'replace', 'QD', 30, true),
  ('Two times a day', 'contains', '{"two times a day", "2 times a day"}', 'replace', 'BID', 30, true),
  ('Three times a day', 'contains', '{"three times a day", "3 times a day"}', 'replace', 'TID', 30, true),
  ('Four times a day', 'contains', '{"four times a day", "4 times a day"}', 'replace', 'QID', 30, true),
  ('Every 6 hours', 'contains', '{"every 6 hours"}', 'replace', 'Q6H', 40, true),
  ('Every 12 hours', 'contains', '{"every 12 hours"}', 'replace', 'Q12H', 40, true),
  ('As needed', 'contains', '{"as needed", "prn"}', 'replace', 'PRN', 50, true),
  ('At bedtime', 'contains', '{"at bedtime"}', 'replace', 'QHS', 60, true),
  ('Subcutaneously', 'contains', '{"subcutaneously"}', 'replace', 'SQ', 70, true),
  ('Topically', 'contains', '{"topically"}', 'replace', 'TPCL', 70, true),
  ('Under the tongue', 'contains', '{"under the tongue"}', 'replace', 'SL', 70, true),
  ('For GERD', 'contains', '{"for gerd"}', 'replace', 'FGERD', 80, true),
  ('For supplement', 'contains', '{"for supplement"}', 'replace', 'FSU', 80, true),
  ('For BPH', 'contains', '{"for bph"}', 'replace', 'FBPH', 80, true),
  ('For hypothyroidism', 'contains', '{"for hypothyroidism"}', 'replace', 'FHYT', 80, true),
  ('For GI prophylaxis', 'contains', '{"for gi prophylaxis"}', 'replace', 'FGIP', 80, true),
  ('For anxiety or agitation', 'contains', '{"for anxiety or agitation"}', 'replace', 'FAA', 80, true),
  ('For shortness of breath or pain', 'contains', '{"for shortness of breath or pain"}', 'replace', 'FSOBP', 80, true),
  ('For cellulitis', 'contains', '{"for cellulitis"}', 'replace', 'FCEL', 80, true),
  ('Indication: cough', 'contains', '{"indication: cough", "for cough"}', 'replace', 'FCOU', 80, true),
  ('For DM2', 'contains', '{"for dm2"}', 'replace', 'FDM2', 80, true),
  ('For DM', 'contains', '{"for dm"}', 'replace', 'FDM', 80, true),
  ('For HTN', 'contains', '{"for htn"}', 'replace', 'FHTN', 80, true),
  ('For severe pain', 'contains', '{"for severe pain"}', 'replace', 'FSP', 80, true),
  ('For constipation', 'contains', '{"for constipation"}', 'replace', 'FCON', 80, true),
  ('For pain', 'contains', '{"for pain"}', 'replace', 'FPAIN', 80, true),
  ('For DVT prevention', 'contains', '{"for dvt prevention"}', 'replace', 'FDVTP', 80, true)
ON CONFLICT DO NOTHING;
INSERT INTO public.sig_expansions (output_phrase, aliases, match_type, priority, enabled)
VALUES
  ('QDP/D IN THE EVENING', '{"one time a day in the evening", "in the evening one time a day", "in the evening"}', 'phrase', 20, true),
  ('QDA/B', '{"one time a day before breakfast", "before breakfast one time a day", "before breakfast"}', 'phrase', 20, true)
ON CONFLICT DO NOTHING;
