import { describe, expect, it } from 'vitest';
import { translateRecognizedPhrases } from '../src/lib/clinical/partialTranslation';

describe('translateRecognizedPhrases', () => {
  describe('sliding scale insulin bypass', () => {
    it('bypasses translation and preserves scale with whitespace normalization and uppercase', () => {
      const input = 'Inject per sliding scale: 150-200 = 2 units, 201-250 = 4 units by mouth';
      const output = translateRecognizedPhrases(input);
      // "by mouth" should NOT be replaced by PO because it's a sliding scale
      expect(output).toBe('INJECT PER SLIDING SCALE: 150-200 = 2 UNITS, 201-250 = 4 UNITS BY MOUTH');
    });

    it('matches sliding scale case-insensitively with leading and trailing whitespace', () => {
      const input = '  Take as per Sliding Scale subcutaneously  ';
      expect(translateRecognizedPhrases(input)).toBe('TAKE AS PER SLIDING SCALE SUBCUTANEOUSLY');
    });
  });

  describe('route phrase substitutions', () => {
    it('translates oral routes BY MOUTH and ORALLY to PO', () => {
      expect(translateRecognizedPhrases('Take 1 tablet by mouth daily')).toBe('TAKE 1 TABLET PO QD');
      expect(translateRecognizedPhrases('Take 1 capsule orally daily')).toBe('TAKE 1 CAPSULE PO QD');
    });

    it('translates enteral tube routes (PEG, G, J, NG)', () => {
      expect(translateRecognizedPhrases('Give 10 ml via peg-tube daily')).toBe('GIVE 10 ML PEGT QD');
      expect(translateRecognizedPhrases('Give 10 ml via peg tube daily')).toBe('GIVE 10 ML PEGT QD');
      expect(translateRecognizedPhrases('Give 15 ml per g-tube daily')).toBe('GIVE 15 ML GT QD');
      expect(translateRecognizedPhrases('Give 15 ml through j tube daily')).toBe('GIVE 15 ML JT QD');
      expect(translateRecognizedPhrases('Administer 20 ml per ng-tube daily')).toBe('ADMINISTER 20 ML NG QD');
    });

    it('translates SQ, SL, PV, PR, TPCL', () => {
      expect(translateRecognizedPhrases('Inject 5 units subcutaneously daily')).toBe('INJECT 5 UNITS SQ QD');
      expect(translateRecognizedPhrases('Dissolve 1 tablet sublingually as needed')).toBe('DISSOLVE 1 TABLET SL PRN');
      expect(translateRecognizedPhrases('Insert 1 applicator vaginally at bedtime')).toBe('INSERT 1 APPLICATOR PV AT BEDTIME');
      expect(translateRecognizedPhrases('Insert 1 suppository rectally daily')).toBe('INSERT 1 SUPPOSITORY PR QD');
      expect(translateRecognizedPhrases('Apply thin layer topically daily')).toBe('APPLY THIN LAYER TPCL QD');
    });

    it('translates nebulizer variations (via / using a nebulizer/nebuliser)', () => {
      expect(translateRecognizedPhrases('Inhale 1 vial via nebulizer twice daily')).toBe('INHALE 1 VIAL NEB BID');
      expect(translateRecognizedPhrases('Inhale 1 vial using a nebulizer twice daily')).toBe('INHALE 1 VIAL NEB BID');
      expect(translateRecognizedPhrases('Inhale 1 vial via nebuliser twice daily')).toBe('INHALE 1 VIAL NEB BID');
      expect(translateRecognizedPhrases('Inhale 1 vial using a nebuliser twice daily')).toBe('INHALE 1 VIAL NEB BID');
    });
  });

  describe('schedule and frequency phrase substitutions', () => {
    it('translates IN THE EVENING to QPM', () => {
      expect(translateRecognizedPhrases('Take 1 tablet in the evening')).toBe('TAKE 1 TABLET QPM');
    });

    it('translates EVERY OTHER DAY to QOD', () => {
      expect(translateRecognizedPhrases('Take 1 tablet every other day')).toBe('TAKE 1 TABLET QOD');
    });

    it('translates hourly intervals via hourlySchedule', () => {
      expect(translateRecognizedPhrases('Take 1 tablet every 4 hours')).toBe('TAKE 1 TABLET Q4H');
      expect(translateRecognizedPhrases('Take 1 tablet every 6 hrs')).toBe('TAKE 1 TABLET Q6H');
      expect(translateRecognizedPhrases('Take 1 tablet every 8 hours')).toBe('TAKE 1 TABLET Q8H');
      expect(translateRecognizedPhrases('Take 1 tablet every 12 hr')).toBe('TAKE 1 TABLET Q12H');
      // Zero or invalid hourly schedule falls back to original
      expect(translateRecognizedPhrases('Take 1 tablet every 0 hours')).toBe('TAKE 1 TABLET EVERY 0 HOURS');
    });

    it('translates 4 times daily phrases to QID', () => {
      expect(translateRecognizedPhrases('Take 1 tablet 4 times a day')).toBe('TAKE 1 TABLET QID');
      expect(translateRecognizedPhrases('Take 1 tablet 4 times per day')).toBe('TAKE 1 TABLET QID');
      expect(translateRecognizedPhrases('Take 1 tablet 4 times each day')).toBe('TAKE 1 TABLET QID');
      // "four times a day" is normalized by normalizeNumericDirections to "4 times a day", then translated to QID
      expect(translateRecognizedPhrases('Take 1 tablet four times a day')).toBe('TAKE 1 TABLET QID');
      expect(translateRecognizedPhrases('Take 1 tablet four times per day')).toBe('TAKE 1 TABLET QID');
    });

    it('translates 3 times daily phrases to TID', () => {
      expect(translateRecognizedPhrases('Take 1 tablet 3 times a day')).toBe('TAKE 1 TABLET TID');
      expect(translateRecognizedPhrases('Take 1 tablet 3 times per day')).toBe('TAKE 1 TABLET TID');
      expect(translateRecognizedPhrases('Take 1 tablet 3 times each day')).toBe('TAKE 1 TABLET TID');
      // "three times a day" is normalized to "3 times a day", then translated to TID
      expect(translateRecognizedPhrases('Take 1 tablet three times a day')).toBe('TAKE 1 TABLET TID');
      expect(translateRecognizedPhrases('Take 1 tablet three times per day')).toBe('TAKE 1 TABLET TID');
    });

    it('translates 2 times daily phrases to BID', () => {
      expect(translateRecognizedPhrases('Take 1 tablet 2 times a day')).toBe('TAKE 1 TABLET BID');
      expect(translateRecognizedPhrases('Take 1 tablet 2 times per day')).toBe('TAKE 1 TABLET BID');
      expect(translateRecognizedPhrases('Take 1 tablet 2 times each day')).toBe('TAKE 1 TABLET BID');
      expect(translateRecognizedPhrases('Take 1 tablet twice daily')).toBe('TAKE 1 TABLET BID');
      expect(translateRecognizedPhrases('Take 1 tablet twice a day')).toBe('TAKE 1 TABLET BID');
      expect(translateRecognizedPhrases('Take 1 tablet two times a day')).toBe('TAKE 1 TABLET BID');
    });

    it('translates once daily phrases to QD', () => {
      expect(translateRecognizedPhrases('Take 1 tablet 1 time a day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('Take 1 tablet 1 time per day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('Take 1 tablet 1 time each day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('Take 1 tablet once a day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('Take 1 tablet once day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('Take 1 tablet every day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('Take 1 tablet daily')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('Take 1 tablet one time a day')).toBe('TAKE 1 TABLET QD');
    });

    it('translates AS NEEDED to PRN', () => {
      expect(translateRecognizedPhrases('Take 1 tablet every 6 hours as needed')).toBe('TAKE 1 TABLET Q6H PRN');
    });
  });

  describe('duration phrase substitutions', () => {
    it('translates recognized duration phrases (days, weeks, months, hours)', () => {
      expect(translateRecognizedPhrases('Take 1 tablet daily for 7 days')).toBe('TAKE 1 TABLET QD X7D');
      expect(translateRecognizedPhrases('Take 1 tablet daily for 10 days')).toBe('TAKE 1 TABLET QD X10D');
      expect(translateRecognizedPhrases('Take 1 tablet daily for 2 weeks')).toBe('TAKE 1 TABLET QD X2WK');
      expect(translateRecognizedPhrases('Take 1 tablet daily for 1 month')).toBe('TAKE 1 TABLET QD X1M');
      expect(translateRecognizedPhrases('Take 1 tablet daily for 48 hours')).toBe('TAKE 1 TABLET QD X48H');
    });

    it('preserves duration text when token does not exist in SIG_CODE_REFERENCE', () => {
      // 999 days and 24 hours do not exist in SIG_CODE_REFERENCE
      expect(translateRecognizedPhrases('Take 1 tablet daily for 999 days')).toBe('TAKE 1 TABLET QD FOR 999 DAYS');
      expect(translateRecognizedPhrases('Take 1 tablet daily for 24 hours')).toBe('TAKE 1 TABLET QD FOR 24 HOURS');
    });
  });

  describe('indication span resolution integration', () => {
    it('translates text before and after indication and resolves indication token', () => {
      expect(translateRecognizedPhrases('Take 1 tablet by mouth daily for GERD')).toBe('TAKE 1 TABLET PO QD FGERD');
      expect(translateRecognizedPhrases('Take 1 tablet by mouth daily for hypertension')).toBe('TAKE 1 TABLET PO QD FHTN');
      expect(translateRecognizedPhrases('Take 1 tablet by mouth twice daily for cough for 7 days')).toBe('TAKE 1 TABLET PO BID FCOU X7D');
    });

    it('resolves unmapped indication cleanly without losing words', () => {
      expect(translateRecognizedPhrases('Take 1 tablet by mouth daily for restless legs')).toBe('TAKE 1 TABLET PO QD FOR RESTLESS LEGS');
    });
  });

  describe('lossless preservation of unrecognized words and qualifiers', () => {
    it('retains arbitrary instructions, dosages, and notes unmodified', () => {
      const input = 'Swallow whole with a full glass of water, do not crush or chew, take 2 tablets by mouth daily with breakfast';
      expect(translateRecognizedPhrases(input)).toBe('SWALLOW WHOLE WITH A FULL GLASS OF WATER, DO NOT CRUSH OR CHEW, TAKE 2 TABLETS PO QD WITH BREAKFAST');
    });

    it('handles numeric direction normalization integration', () => {
      // "two tablets" should normalize to "2 tablets"
      expect(translateRecognizedPhrases('Give two tablets by mouth twice daily')).toBe('GIVE 2 TABLETS PO BID');
    });

    it('handles empty or whitespace strings', () => {
      expect(translateRecognizedPhrases('')).toBe('');
      expect(translateRecognizedPhrases('   ')).toBe('');
    });
  });
});
