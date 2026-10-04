import { describe, expect, it } from 'vitest';
import cases from './fixtures/reported-discrepancies-2026-10-01-batch2.json';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';

function translate(drugName: string, rawProse: string, defaultSigTemplate?: string, indication?: string) {
  return translateClinicalSig({ id: 'batch2-case', pon: 'MANUAL_ENTRY', drugName, rawProse, defaultSigTemplate, indication, sourceFormat: 'manual_text' });
}

export const expectedBatch2 = [
  '1G OS PRN FOR EYE COMFORT PER OPTOMETRIST',
  'AP 2GM TPCL TO NECK, UP TO LT EAR QID FOR NECK PAIN',
  '2T (1000MG) PO Q8H PRN FPAIN 3GM',
  '1T PO QDDAY2467 FOR LOW THYROID HORMONE',
  '1T PO QD FBCP',
  'MIX 17 GM (1 PACKET) IN 8OZ OF WATER AND GIVE PO QD FCON',
];

describe('six new reported mistranslations, 2026-10-01 batch 2', () => {
  it.each(cases.reports.map((report, index) => ({ ...report, expected: expectedBatch2[index] })))('replays $id without changing source meaning', report => {
    expect(translate(report.drugName, report.rawProse).primarySig).toBe(report.expected);
  });

  it('flags the absent PRN interval and never adds a scheduled QD', () => {
    const result = translate(cases.reports[0].drugName, cases.reports[0].rawProse);
    expect(result.primarySig).not.toMatch(/\b(?:QD|PO|1T)\b/);
    expect(result.abnormalities.some(a => a.title === 'Missing Frequency')).toBe(true);
  });

  it('does not derive a frequency from daily symptoms in the indication', () => {
    const result = translate('UNKNOWN DRUG', 'Instill 1 drop in each eye as needed for daily eye discomfort');
    expect(result.primarySig).toBe('1G OU PRN FOR DAILY EYE DISCOMFORT');
    expect(result.abnormalities.some(a => a.title === 'Missing Frequency')).toBe(true);
  });

  it('mutates an existing preparation schedule to the prescribed frequency', () => {
    expect(translate(cases.reports[5].drugName, 'Give 1 packet orally twice daily for constipation', 'MIX 17 GM (1 PACKET) IN 8OZ OF WATER AND GIVE PO QD').primarySig)
      .toBe('MIX 17 GM (1 PACKET) IN 8OZ OF WATER AND GIVE PO BID FCON');
  });

  it.each([['left', 'OS'], ['right', 'OD'], ['both', 'OU'], ['each', 'OU']])('keeps explicit %s eye laterality', (eye, route) => {
    expect(translate('UNKNOWN DRUG', `Instill 2 drops in ${eye} eye daily for dry eyes`).primarySig).toBe(`2G ${route} QD FDE`);
  });

  it.each(['Instill 1 drop daily', 'Instill 1-2 drops in left eye daily', 'Instill 0 drops in right eye daily', 'Instill 1 drop in left eye and right ear daily'])('retains ambiguous drop directions for manual translation: %s', prose => {
    const result = translate('UNKNOWN DRUG', prose);
    expect(result.primarySig).toBe(prose.toUpperCase().replace(/DAILY$/, 'QD'));
    expect(result.abnormalities.some(a => a.tier === 'uncorrected_gap')).toBe(true);
  });

  it('does not discard an unrecognized explicit PRN interval', () => {
    const prose = 'Instill 1 drop in left eye every 45 minutes as needed';
    expect(translate('UNKNOWN DRUG', prose).primarySig).toBe('INSTILL 1 DROP IN LEFT EYE EVERY 45 MINUTES PRN');
  });

  it('preserves specified diclofenac quantity and every site', () => {
    expect(translate('DICLOFENAC GEL 1%', 'Apply 3 grams to neck and left shoulder topically four times a day for neck pain').primarySig)
      .toBe('AP 3GM TPCL TO NECK AND LT SHOULDER QID FOR NECK PAIN');
  });

  it('does not apply the diclofenac 1% dose default to a different strength', () => {
    expect(translate('DICLOFENAC GEL 0.1%', 'Apply to neck topically daily for neck pain').primarySig).toBe('AP TPCL TO NECK QD FOR NECK PAIN');
  });

  it('shows the added diclofenac dose and flags an unverified site category', () => {
    const result = translate(cases.reports[1].drugName, cases.reports[1].rawProse);
    expect(result.abnormalities.some(a => a.title === 'Diclofenac Dose Default Applied')).toBe(true);
    expect(result.abnormalities.some(a => a.title === 'Diclofenac Site/Dose Requires Verification')).toBe(true);
    expect(result.abnormalities.map(a => a.trigger).join(' ')).toContain('NECK');
  });

  it.each([
    ['pain', 'FPAIN'], ['neck pain', 'FOR NECK PAIN'], ['hip pain', 'FOR HIP PAIN'],
    ['severe pain rated 7-10', 'FOR SEVERE PAIN RATED 7-10'],
    ['pain and inflammation', 'FPAIN AND FOR INFLAMMATION'],
    ['constipation due to opioids', 'FOR CONSTIPATION DUE TO OPIOIDS'],
    ['blood clot prevention', 'FBCP'],
  ])('only abbreviates the complete matching indication: %s', (indication, token) => {
    expect(translate('UNKNOWN DRUG', `Give 1 tablet by mouth daily for ${indication}`).primarySig).toBe(`1T PO QD ${token}`);
  });

  it('does not invent neck pain or discomfort from the submitted corrections', () => {
    expect(translate(cases.reports[2].drugName, cases.reports[2].rawProse).primarySig).not.toContain('NECK');
    expect(translate(cases.reports[0].drugName, cases.reports[0].rawProse).primarySig).not.toContain('DISCOMFORT');
  });

  it('retains diagnosis wording and non-code parentheses while removing ICD-10 codes', () => {
    expect(translate('TOPICAL CREAM', 'Apply to neck topically daily for neck pain (M54.2) (after injury)').primarySig)
      .toBe('AP TPCL TO NECK QD FOR NECK PAIN (AFTER INJURY)');
    expect(translate('UNKNOWN DRUG', 'Give 1 tablet daily for vitamin B12 deficiency').primarySig).toBe('1T PO QD FOR VITAMIN B12 DEFICIENCY');
  });

  it('uses the same qualified indication rules for XML fallback indications', () => {
    expect(translate('UNKNOWN DRUG', 'Give 1 tablet daily', undefined, 'Neck pain (M54.2)').primarySig).toBe('1T PO QD FOR NECK PAIN');
  });

  it.each([
    ['every Tue, Thu, Sat, Sun', 'QDDAY2467'], ['on Tuesdays and Thursdays', 'QDDAY24'],
    ['every Sun / Sat', 'QDDAY67'], ['every morning every Tue, Thu, Sat, Sun', 'QAMDAY2467'],
    ['in the evening every Tue, Thu, Sat, Sun', 'QPMDAY2467'], ['every Mon through Fri', 'QDDAY12345'],
  ])('preserves the entire weekday schedule: %s', (schedule, code) => {
    expect(translate('UNKNOWN DRUG', `Give 1 tablet by mouth ${schedule} for pain`).primarySig).toBe(`1T PO ${code} FPAIN`);
  });

  it.each([
    ['one time a day every other Tue', 'QD EVERY OTHER TUE'],
    ['twice daily every Tue and Thu', 'BID EVERY TUE AND THU'],
    ['every Tue except holidays', 'EVERY TUE EXCEPT HOLIDAYS'],
  ])('retains unsupported weekday qualifiers without dropping them: %s', (schedule, expected) => {
    const prose = `Give 1 tablet by mouth ${schedule} for pain`;
    expect(translate('UNKNOWN DRUG', prose).primarySig).toBe(`GIVE 1 TABLET PO ${expected} FPAIN`);
  });

  it('mutates the PEG preparation with source PRN frequency, duration and hold', () => {
    const result = translate(cases.reports[5].drugName, 'Give 1 packet orally twice daily as needed for constipation for 7 days hold if more than 2 bowel movements daily');
    expect(result.primarySig).toBe('MIX 17 GM (1 PACKET) IN 8OZ OF WATER AND GIVE PO BID PRN FCON X7D (H >2 BOWEL MOVEMENTS DAILY)');
    expect(result.abnormalities.some(a => a.title === 'PEG Packet Preparation Added')).toBe(true);
  });

  it('honors an explicit technician preparation template', () => {
    expect(translate(cases.reports[5].drugName, cases.reports[5].rawProse, 'MIX 17 GM (1 PACKET) IN 4OZ OF JUICE AND GIVE PO').primarySig)
      .toBe('MIX 17 GM (1 PACKET) IN 4OZ OF JUICE AND GIVE PO QD FCON');
  });

  it('retains explicit source preparation instead of overwriting it with 8 oz water', () => {
    const prose = 'Give 1 packet orally daily for constipation. Mix in 4 oz of juice.';
    expect(translate(cases.reports[5].drugName, prose).primarySig).toBe('MIX 17 GM (1 PACKET) IN 4OZ OF JUICE AND GIVE PO QD FCON');
  });

  it('also preserves source diluent and volume without a mix verb', () => {
    const prose = 'Give 1 packet orally in 4 oz water daily for constipation';
    expect(translate(cases.reports[5].drugName, prose).primarySig).toBe('GIVE 1 PACKET PO IN 4 OZ WATER QD FCON');
  });

  it.each(['UNKNOWN POWDER PACKET', 'CHOLESTYRAMINE PWD PACKET 4GM', 'POLYETH GLYC PWD PACKET 8.5GM', 'POLYETHYLENE GLYCOL WITH ELECTROLYTES PACKET 17GM', 'MIRALAX PACKETS'])('does not add the PEG 17 g template to %s', drug => {
    expect(translate(drug, 'Give 1 packet orally daily for constipation').primarySig).toBe('1PKT PO QD FCON');
  });

  it('does not apply a one-packet preparation to a different prescribed quantity', () => {
    expect(translate(cases.reports[5].drugName, 'Give 2 packets orally daily for constipation').primarySig).toBe('2PKT PO QD FCON');
  });
});
