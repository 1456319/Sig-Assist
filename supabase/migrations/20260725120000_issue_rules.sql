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

INSERT INTO public.tech_rules (name, target_type, match_values, action_type, output_value, priority, enabled)
VALUES
  ('10 milliliter', 'contains', '{"10 milliliter"}', 'replace', 'ADM 10ML', 5, true),
  ('Give 30 ml', 'contains', '{"give 30 ml"}', 'replace', 'ADM 30ML', 5, true),
  ('Give 10 ml', 'contains', '{"give 10 ml"}', 'replace', 'ADM 10ML', 5, true),
  ('take 0.25ml (5mg)', 'contains', '{"take 0.25ml (5mg)"}', 'replace', 'ROX5MG', 5, true),
  ('take 0.25ml (0.5mg)', 'contains', '{"take 0.25ml (0.5mg)"}', 'replace', 'LOR0.5MG', 5, true),
  ('Inject 10 unit', 'contains', '{"inject 10 unit"}', 'replace', 'INJ 10 UN', 5, true),
  ('Inject 3 ml', 'contains', '{"inject 3 ml"}', 'replace', 'INJ 3ML', 5, true),
  ('Inject 4.5 mg', 'contains', '{"inject 4.5 mg"}', 'replace', 'INJ 0.5ML (4.5MG)', 5, true),
  ('For 10 days', 'contains', '{"for 10 days"}', 'replace', 'X10D', 15, true),
  ('For 14 days', 'contains', '{"for 14 days"}', 'replace', 'X14D', 15, true),
  ('For 13 days', 'contains', '{"for 13 days"}', 'replace', 'X13D', 15, true),
  ('For 7 days', 'contains', '{"for 7 days"}', 'replace', 'X7D', 15, true),
  ('Give 20 gram', 'contains', '{"give 20 gram"}', 'replace', 'DIS 2 PACKETS IN 4OZ OF WATER AND GIVE', 5, true),
  ('Give 1 scoop', 'contains', '{"give 1 scoop"}', 'replace', 'MIX 17 GM (SEE INSIDE CAP) IN 8OZ OF WATER AND GIVE', 5, true),
  ('Apply to affected areas', 'contains', '{"apply to affected areas"}', 'replace', 'AP 2GM TPCL TO AFFECTED AREAS', 5, true),
  ('Apply to lower back, legs', 'contains', '{"apply to lower back, legs"}', 'replace', 'AP 2GM TPCL TO LOWER BACK', 5, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.tech_rules (name, target_type, match_values, action_type, output_value, priority, enabled)
VALUES
  ('Hold HR/SBP', 'contains', '{"hold for sbp less than 100 or heart rate less than 60"}', 'replace', 'HR60SBP100', 5, true),
  ('Pain rated', 'contains', '{"rated 7-10 for up to 10 days"}', 'replace', '7-10/10 FOR UP TO 10 DAYS', 5, true),
  ('Until date', 'regex', '{"until \\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2}"}', 'replace', '', 5, true),
  ('In the evening every sun', 'contains', '{"in the evening every sun"}', 'replace', 'QPMDAY7', 5, true),
  ('Before breakfast', 'contains', '{"before breakfast"}', 'replace', 'QDA/B', 5, true),
  ('GI discomfort', 'contains', '{"for gi discomfort"}', 'replace', 'FOR GI DISCOMFORT', 5, true),
  ('Of scrotum', 'contains', '{"of scrotum"}', 'replace', 'OF SCROTUM', 5, true),
  ('Or under the tongue', 'contains', '{"or under the tongue"}', 'replace', '/SL', 10, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.tech_rules (name, target_type, match_values, action_type, output_value, priority, enabled)
VALUES
  ('By mouth or under the tongue', 'contains', '{"by mouth or under the tongue"}', 'replace', 'PO/SL', 5, true),
  ('Give 1 packet by mouth', 'contains', '{"give 1 packet by mouth"}', 'replace', 'MIX 17 GM (1 PACKET) IN 8OZ OF WATER AND GIVE PO', 2, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.tech_rules (name, target_type, match_values, action_type, output_value, priority, enabled)
VALUES
  ('Give 1 capsule', 'contains', '{"give 1 capsule"}', 'replace', '1C', 2, true),
  ('Give 0.5 tablet', 'contains', '{"give 0.5 tablet"}', 'replace', '1/2T', 2, true),
  ('Give 1 tablet', 'contains', '{"give 1 tablet"}', 'replace', '1T', 2, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.tech_rules (name, target_type, match_values, action_type, output_value, priority, enabled)
VALUES
  ('Give 1 capsule', 'contains', '{"give 1 capsule"}', 'replace', '1C', 2, true),
  ('Give 0.5 tablet', 'contains', '{"give 0.5 tablet"}', 'replace', '1/2T', 2, true),
  ('Give 1 tablet', 'contains', '{"give 1 tablet"}', 'replace', '1T', 2, true),
  ('Give 1 packet', 'contains', '{"give 1 packet"}', 'replace', '1PKT', 2, true),
  ('10 milliliter', 'contains', '{"10 milliliter"}', 'replace', 'ADM 10ML', 2, true),
  ('Give 30 ml', 'contains', '{"give 30 ml"}', 'replace', 'ADM 30ML', 2, true),
  ('Give 10 ml', 'contains', '{"give 10 ml"}', 'replace', 'ADM 10ML', 2, true),
  ('take 0.25ml (5mg)', 'contains', '{"take 0.25ml (5mg)"}', 'replace', 'ROX5MG', 2, true),
  ('take 0.25ml (0.5mg)', 'contains', '{"take 0.25ml (0.5mg)"}', 'replace', 'LOR0.5MG', 2, true),
  ('Inject 10 unit', 'contains', '{"inject 10 unit"}', 'replace', 'INJ 10 UN', 2, true),
  ('Inject 3 ml', 'contains', '{"inject 3 ml"}', 'replace', 'INJ 3ML', 2, true),
  ('Inject 4.5 mg', 'contains', '{"inject 4.5 mg"}', 'replace', 'INJ 0.5ML', 2, true),
  ('For 10 days', 'contains', '{"for 10 days"}', 'replace', 'X10D', 2, true),
  ('For 14 days', 'contains', '{"for 14 days"}', 'replace', 'X14D', 2, true),
  ('For 13 days', 'contains', '{"for 13 days"}', 'replace', 'X13D', 2, true),
  ('For 7 days', 'contains', '{"for 7 days"}', 'replace', 'X7D', 2, true),
  ('Give 20 gram', 'contains', '{"give 20 gram"}', 'replace', 'DIS 2 PACKETS IN 4OZ OF WATER AND GIVE', 2, true),
  ('Give 1 scoop', 'contains', '{"give 1 scoop"}', 'replace', 'MIX 17 GM (SEE INSIDE CAP) IN 8OZ OF WATER AND GIVE', 2, true),
  ('Apply to affected areas', 'contains', '{"apply to affected areas"}', 'replace', 'AP 2GM TPCL TO AFFECTED AREAS', 2, true),
  ('Apply to lower back, legs', 'contains', '{"apply to lower back, legs"}', 'replace', 'AP 2GM TPCL TO LOWER BACK', 2, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.tech_rules (name, target_type, match_values, action_type, output_value, priority, enabled)
VALUES
  ('Give 1 capsule', 'contains', '{"give 1 capsule by mouth"}', 'replace', '1C PO', 1, true),
  ('Give 0.5 tablet', 'contains', '{"give 0.5 tablet by mouth"}', 'replace', '1/2T PO', 1, true),
  ('Give 1 tablet', 'contains', '{"give 1 tablet by mouth"}', 'replace', '1T PO', 1, true),
  ('Give 1 packet', 'contains', '{"give 1 packet by mouth"}', 'replace', '1PKT PO', 1, true),
  ('10 milliliter', 'contains', '{"10 milliliter oral"}', 'replace', 'ADM 10ML PO', 1, true),
  ('Give 30 ml', 'contains', '{"give 30 ml by mouth"}', 'replace', 'ADM 30ML PO', 1, true),
  ('Give 10 ml', 'contains', '{"give 10 ml by mouth"}', 'replace', 'ADM 10ML PO', 1, true),
  ('take 0.25ml (5mg)', 'contains', '{"take 0.25ml (5mg) by mouth or under the tongue"}', 'replace', 'ROX5MG PO/SL', 1, true),
  ('take 0.25ml (0.5mg)', 'contains', '{"take 0.25ml (0.5mg) by mouth or under the tongue"}', 'replace', 'LOR0.5MG PO/SL', 1, true),
  ('Inject 10 unit', 'contains', '{"inject 10 unit subcutaneously"}', 'replace', 'INJ 10 UN SQ', 1, true),
  ('Inject 3 ml', 'contains', '{"inject 3 ml subcutaneously"}', 'replace', 'INJ 3ML SQ', 1, true),
  ('Inject 4.5 mg', 'contains', '{"inject 4.5 mg subcutaneously"}', 'replace', 'INJ 0.5ML SQ', 1, true),
  ('Give 20 gram', 'contains', '{"give 20 gram by mouth"}', 'replace', 'DIS 2 PACKETS IN 4OZ OF WATER AND GIVE PO', 1, true),
  ('Give 1 scoop', 'contains', '{"give 1 scoop by mouth"}', 'replace', 'MIX 17 GM (SEE INSIDE CAP) IN 8OZ OF WATER AND GIVE PO', 1, true),
  ('Apply to affected areas', 'contains', '{"apply to affected areas topically"}', 'replace', 'AP 2GM TPCL TO AFFECTED AREAS', 1, true),
  ('Apply to lower back, legs', 'contains', '{"apply to lower back, legs topically"}', 'replace', 'AP 2GM TPCL TO LOWER BACK', 1, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.tech_rules (name, target_type, match_values, action_type, output_value, priority, enabled)
VALUES
  ('One time a day', 'contains', '{"1 time a day"}', 'replace', 'QD', 1, true),
  ('Two times a day', 'contains', '{"2 times a day"}', 'replace', 'BID', 1, true),
  ('Three times a day', 'contains', '{"3 times a day"}', 'replace', 'TID', 1, true),
  ('Four times a day', 'contains', '{"4 times a day"}', 'replace', 'QID', 1, true),
  ('Every 6 hours', 'contains', '{"every 6 hours"}', 'replace', 'Q6H', 1, true),
  ('Every 12 hours', 'contains', '{"every 12 hours"}', 'replace', 'Q12H', 1, true),
  ('As needed', 'contains', '{"as needed", "prn"}', 'replace', 'PRN', 1, true),
  ('At bedtime', 'contains', '{"at bedtime"}', 'replace', 'QHS', 1, true),
  ('Subcutaneously', 'contains', '{"subcutaneously"}', 'replace', 'SQ', 1, true),
  ('Topically', 'contains', '{"topically"}', 'replace', 'TPCL', 1, true),
  ('For GERD', 'contains', '{"for gerd"}', 'replace', 'FGERD', 1, true),
  ('For supplement', 'contains', '{"for supplement"}', 'replace', 'FSU', 1, true),
  ('For BPH', 'contains', '{"for bph"}', 'replace', 'FBPH', 1, true),
  ('For hypothyroidism', 'contains', '{"for hypothyroidism"}', 'replace', 'FHYT', 1, true),
  ('For GI prophylaxis', 'contains', '{"for gi prophylaxis"}', 'replace', 'FGIP', 1, true),
  ('For anxiety or agitation', 'contains', '{"for anxiety or agitation"}', 'replace', 'FAA', 1, true),
  ('For shortness of breath or pain', 'contains', '{"for shortness of breath or pain"}', 'replace', 'FSOBP', 1, true),
  ('For cellulitis', 'contains', '{"for cellulitis"}', 'replace', 'FCEL', 1, true),
  ('Indication: cough', 'contains', '{"indication: cough", "for cough"}', 'replace', 'FCOU', 1, true),
  ('For DM2', 'contains', '{"for dm2"}', 'replace', 'FDM2', 1, true),
  ('For DM', 'contains', '{"for dm"}', 'replace', 'FDM', 1, true),
  ('For HTN', 'contains', '{"for htn"}', 'replace', 'FHTN', 1, true),
  ('For severe pain', 'contains', '{"for severe pain"}', 'replace', 'FSP', 1, true),
  ('For constipation', 'contains', '{"for constipation"}', 'replace', 'FCON', 1, true),
  ('For pain', 'contains', '{"for pain"}', 'replace', 'FPAIN', 1, true),
  ('For DVT prevention', 'contains', '{"for dvt prevention"}', 'replace', 'FDVTP', 1, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.tech_rules (name, target_type, match_values, action_type, output_value, priority, enabled)
VALUES
  ('Give 1 capsule', 'contains', '{"give 1 capsule"}', 'replace', '1C', 0, true),
  ('Give 0.5 tablet', 'contains', '{"give 0.5 tablet"}', 'replace', '1/2T', 0, true),
  ('Give 1 tablet', 'contains', '{"give 1 tablet"}', 'replace', '1T', 0, true),
  ('Give 1 packet', 'contains', '{"give 1 packet"}', 'replace', '1PKT', 0, true),
  ('10 milliliter', 'contains', '{"10 milliliter"}', 'replace', 'ADM 10ML', 0, true),
  ('Give 30 ml', 'contains', '{"give 30 ml"}', 'replace', 'ADM 30ML', 0, true),
  ('Give 10 ml', 'contains', '{"give 10 ml"}', 'replace', 'ADM 10ML', 0, true),
  ('take 0.25ml (5mg)', 'contains', '{"take 0.25ml (5mg)"}', 'replace', 'ROX5MG', 0, true),
  ('take 0.25ml (0.5mg)', 'contains', '{"take 0.25ml (0.5mg)"}', 'replace', 'LOR0.5MG', 0, true),
  ('Inject 10 unit', 'contains', '{"inject 10 unit"}', 'replace', 'INJ 10 UN', 0, true),
  ('Inject 3 ml', 'contains', '{"inject 3 ml"}', 'replace', 'INJ 3ML', 0, true),
  ('Inject 4.5 mg', 'contains', '{"inject 4.5 mg"}', 'replace', 'INJ 0.5ML', 0, true),
  ('Give 20 gram', 'contains', '{"give 20 gram"}', 'replace', 'DIS 2 PACKETS IN 4OZ OF WATER AND GIVE', 0, true),
  ('Give 1 scoop', 'contains', '{"give 1 scoop"}', 'replace', 'MIX 17 GM (SEE INSIDE CAP) IN 8OZ OF WATER AND GIVE', 0, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.tech_rules (name, target_type, match_values, action_type, output_value, priority, enabled)
VALUES
  ('Give 1 capsule 2', 'regex', '{"give 1 capsule(?=\\s)"}', 'replace', '1C', 0, true),
  ('Give 0.5 tablet 2', 'regex', '{"give 0.5 tablet(?=\\s)"}', 'replace', '1/2T', 0, true),
  ('Give 1 tablet 2', 'regex', '{"give 1 tablet(?=\\s)"}', 'replace', '1T', 0, true),
  ('Give 1 packet 2', 'regex', '{"give 1 packet(?=\\s)"}', 'replace', '1PKT', 0, true),
  ('10 milliliter 2', 'regex', '{"10 milliliter(?=\\s)"}', 'replace', 'ADM 10ML', 0, true),
  ('Give 30 ml 2', 'regex', '{"give 30 ml(?=\\s)"}', 'replace', 'ADM 30ML', 0, true),
  ('Give 10 ml 2', 'regex', '{"give 10 ml(?=\\s)"}', 'replace', 'ADM 10ML', 0, true),
  ('Inject 10 unit 2', 'regex', '{"inject 10 unit(?=\\s)"}', 'replace', 'INJ 10 UN', 0, true),
  ('Inject 3 ml 2', 'regex', '{"inject 3 ml(?=\\s)"}', 'replace', 'INJ 3ML', 0, true),
  ('Inject 4.5 mg 2', 'regex', '{"inject 4.5 mg(?=\\s)"}', 'replace', 'INJ 0.5ML', 0, true),
  ('Give 20 gram 2', 'regex', '{"give 20 gram(?=\\s)"}', 'replace', 'DIS 2 PACKETS IN 4OZ OF WATER AND GIVE', 0, true),
  ('Give 1 scoop 2', 'regex', '{"give 1 scoop(?=\\s)"}', 'replace', 'MIX 17 GM (SEE INSIDE CAP) IN 8OZ OF WATER AND GIVE', 0, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.tech_rules (name, target_type, match_values, action_type, output_value, priority, enabled)
VALUES
  ('By mouth 2', 'regex', '{"(?<!give 1 packet )(?<!give 0.5 tablet )(?<!give 1 tablet )(?<!give 1 capsule )(?<!take 0.25ml \\(5mg\\) )(?<!take 0.25ml \\(0.5mg\\) )(?<!10 milliliter )(?<!give 30 ml )(?<!give 10 ml )(?<!give 20 gram )(?<!give 1 scoop )by mouth(?=\\s|/)"}', 'replace', 'PO', 0, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.tech_rules (name, target_type, match_values, action_type, output_value, priority, enabled)
VALUES
  ('10 milliliter 3', 'regex', '{"10 milliliter"}', 'replace', 'ADM 10ML', 0, true),
  ('Give 1 tablet 3', 'regex', '{"give 1 tablet"}', 'replace', '1T', 0, true)
ON CONFLICT DO NOTHING;
