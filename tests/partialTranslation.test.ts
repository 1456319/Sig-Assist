import { describe, expect, it } from 'vitest';
import { translateRecognizedPhrases } from '../src/lib/clinical/partialTranslation';

describe('translateRecognizedPhrases', () => {
  describe('sliding scale exclusion', () => {
    it('preserves sliding scale instructions verbatim without partial abbreviation', () => {
      const input = 'Inject as per sliding scale: if 181 - 200 = 1 unit < 70 follow hypoglycemic protocol';
      expect(translateRecognizedPhrases(input)).toBe(
        'INJECT AS PER SLIDING SCALE: IF 181 - 200 = 1 UNIT < 70 FOLLOW HYPOGLYCEMIC PROTOCOL'
      );
    });

    it('handles sliding scale case-insensitively and collapses extra spaces', () => {
      const input = '  Take   units   via   sliding   scale   before   meals  ';
      expect(translateRecognizedPhrases(input)).toBe(
        'TAKE UNITS VIA SLIDING SCALE BEFORE MEALS'
      );
    });
  });

  describe('administration route substitutions', () => {
    it('translates oral routes (BY MOUTH, ORALLY) to PO', () => {
      expect(translateRecognizedPhrases('Take 1 tablet by mouth daily')).toBe('TAKE 1 TABLET PO QD');
      expect(translateRecognizedPhrases('Take 1 capsule orally once a day')).toBe('TAKE 1 CAPSULE PO QD');
      expect(translateRecognizedPhrases('Take 1 tablet orally every day')).toBe('TAKE 1 TABLET PO QD');
      expect(translateRecognizedPhrases('By mouth once a day')).toBe('PO QD');
    });

    it('translates enteral tube routes (PEG, G, J, NG)', () => {
      expect(translateRecognizedPhrases('Give 10 ml via PEG tube daily')).toBe('GIVE 10 ML PEGT QD');
      expect(translateRecognizedPhrases('Give 10 ml via PEG-tube daily')).toBe('GIVE 10 ML PEGT QD');
      expect(translateRecognizedPhrases('Administer per G-tube every day')).toBe('ADMINISTER GT QD');
      expect(translateRecognizedPhrases('Give through J tube daily')).toBe('GIVE JT QD');
      expect(translateRecognizedPhrases('Administer per NG tube daily')).toBe('ADMINISTER NG QD');
      expect(translateRecognizedPhrases('Administer via NG-tube daily')).toBe('ADMINISTER NG QD');
    });

    it('translates parenteral and topical routes (SQ, SL, PV, PR, TPCL)', () => {
      expect(translateRecognizedPhrases('Inject 5 units subcutaneously every morning')).toBe('INJECT 5 UNITS SQ EVERY MORNING');
      expect(translateRecognizedPhrases('Dissolve 1 tablet sublingually as needed')).toBe('DISSOLVE 1 TABLET SL PRN');
      expect(translateRecognizedPhrases('Insert 1 suppository vaginally at bedtime')).toBe('INSERT 1 SUPPOSITORY PV AT BEDTIME');
      expect(translateRecognizedPhrases('Insert 1 suppository rectally as needed')).toBe('INSERT 1 SUPPOSITORY PR PRN');
      expect(translateRecognizedPhrases('Apply thin layer topically twice a day')).toBe('APPLY THIN LAYER TPCL BID');
    });

    it('translates nebulizer routes with varying spellings and articles', () => {
      expect(translateRecognizedPhrases('Inhale via a nebulizer twice daily')).toBe('INHALE NEB BID');
      expect(translateRecognizedPhrases('Inhale via nebulizer 3 times a day')).toBe('INHALE NEB TID');
      expect(translateRecognizedPhrases('Inhale using a nebulizer 4 times a day')).toBe('INHALE NEB QID');
      expect(translateRecognizedPhrases('Administer using nebuliser daily')).toBe('ADMINISTER NEB QD');
    });
  });

  describe('frequency and schedule substitutions', () => {
    it('translates evening timing to QPM', () => {
      expect(translateRecognizedPhrases('Take 1 tablet in the evening')).toBe('TAKE 1 TABLET QPM');
    });

    it('translates alternate days to QOD', () => {
      expect(translateRecognizedPhrases('Take 1 tablet every other day')).toBe('TAKE 1 TABLET QOD');
    });

    it('translates 4 times a day variations to QID', () => {
      expect(translateRecognizedPhrases('Take 1 tablet 4 times a day')).toBe('TAKE 1 TABLET QID');
      expect(translateRecognizedPhrases('Take 1 tablet 4 times per day')).toBe('TAKE 1 TABLET QID');
      expect(translateRecognizedPhrases('Take 1 tablet 4 times each day')).toBe('TAKE 1 TABLET QID');
      expect(translateRecognizedPhrases('Take 1 tablet four times a day')).toBe('TAKE 1 TABLET QID');
    });

    it('translates 3 times a day variations to TID', () => {
      expect(translateRecognizedPhrases('Take 1 tablet 3 times a day')).toBe('TAKE 1 TABLET TID');
      expect(translateRecognizedPhrases('Take 1 tablet 3 times per day')).toBe('TAKE 1 TABLET TID');
      expect(translateRecognizedPhrases('Take 1 tablet 3 times each day')).toBe('TAKE 1 TABLET TID');
      expect(translateRecognizedPhrases('Take 1 tablet three times a day')).toBe('TAKE 1 TABLET TID');
    });

    it('translates twice daily variations to BID', () => {
      expect(translateRecognizedPhrases('Take 1 tablet 2 times a day')).toBe('TAKE 1 TABLET BID');
      expect(translateRecognizedPhrases('Take 1 tablet 2 times per day')).toBe('TAKE 1 TABLET BID');
      expect(translateRecognizedPhrases('Take 1 tablet 2 times each day')).toBe('TAKE 1 TABLET BID');
      expect(translateRecognizedPhrases('Take 1 tablet twice daily')).toBe('TAKE 1 TABLET BID');
      expect(translateRecognizedPhrases('Take 1 tablet twice a day')).toBe('TAKE 1 TABLET BID');
    });

    it('translates once daily variations to QD', () => {
      expect(translateRecognizedPhrases('Take 1 tablet 1 time a day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('Take 1 tablet 1 time per day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('Take 1 tablet 1 time each day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('Take 1 tablet once a day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('Take 1 tablet once day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('Take 1 tablet every day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('Take 1 tablet daily')).toBe('TAKE 1 TABLET QD');
    });

    it('translates AS NEEDED to PRN', () => {
      expect(translateRecognizedPhrases('Take 1 tablet every 6 hours as needed')).toBe('TAKE 1 TABLET Q6H PRN');
    });
  });

  describe('hourly schedules', () => {
    it('translates recognized hourly schedules to QNH codes', () => {
      expect(translateRecognizedPhrases('Take 1 tablet every 4 hours')).toBe('TAKE 1 TABLET Q4H');
      expect(translateRecognizedPhrases('Take 1 tablet every 6 hrs')).toBe('TAKE 1 TABLET Q6H');
      expect(translateRecognizedPhrases('Take 1 tablet every 8 hours')).toBe('TAKE 1 TABLET Q8H');
      expect(translateRecognizedPhrases('Take 1 tablet every 12 hours')).toBe('TAKE 1 TABLET Q12H');
    });

    it('retains non-standard hourly schedules as EVERY N HOURS', () => {
      // Q17H is not in SIG_CODE_REFERENCE, so hourlySchedule leaves it as EVERY 17 HOURS
      expect(translateRecognizedPhrases('Take 1 tablet every 17 hours')).toBe('TAKE 1 TABLET EVERY 17 HOURS');
    });

    it('does not crash or produce invalid schedule on zero hours', () => {
      expect(translateRecognizedPhrases('Take 1 tablet every 0 hours')).toBe('TAKE 1 TABLET EVERY 0 HOURS');
    });
  });

  describe('duration substitutions', () => {
    it('translates days, weeks, months, and hours that match SIG_CODE_REFERENCE', () => {
      expect(translateRecognizedPhrases('Take 1 tablet daily for 7 days')).toBe('TAKE 1 TABLET QD X7D');
      expect(translateRecognizedPhrases('Take 1 tablet daily for 10 days')).toBe('TAKE 1 TABLET QD X10D');
      expect(translateRecognizedPhrases('Take 1 tablet daily for 14 days')).toBe('TAKE 1 TABLET QD X14D');
      expect(translateRecognizedPhrases('Take 1 tablet daily for 30 days')).toBe('TAKE 1 TABLET QD X30D');
      expect(translateRecognizedPhrases('Take 1 tablet daily for 2 weeks')).toBe('TAKE 1 TABLET QD X2WK');
      expect(translateRecognizedPhrases('Take 1 tablet daily for 1 month')).toBe('TAKE 1 TABLET QD X1M');
      expect(translateRecognizedPhrases('Apply patch every 48 hours for 48 hours')).toBe('APPLY PATCH Q48H X48H');
    });

    it('preserves duration text verbatim if token is not in SIG_CODE_REFERENCE', () => {
      expect(translateRecognizedPhrases('Take 1 tablet daily for 99 days')).toBe('TAKE 1 TABLET QD FOR 99 DAYS');
      expect(translateRecognizedPhrases('Take 1 tablet daily for 25 weeks')).toBe('TAKE 1 TABLET QD FOR 25 WEEKS');
    });
  });

  describe('indication handling and integration', () => {
    it('resolves mapped indications (e.g., GERD, HTN, PAIN, COUGH)', () => {
      expect(translateRecognizedPhrases('Take 1 tablet by mouth daily for GERD')).toBe('TAKE 1 TABLET PO QD FGERD');
      expect(translateRecognizedPhrases('Take 1 tablet by mouth twice a day for hypertension')).toBe('TAKE 1 TABLET PO BID FHTN');
      expect(translateRecognizedPhrases('Take 1 tablet by mouth every 4 hours as needed for pain')).toBe('TAKE 1 TABLET PO Q4H PRN FPAIN');
      expect(translateRecognizedPhrases('Take 10 ml by mouth every 6 hours as needed for cough')).toBe('TAKE 10 ML PO Q6H PRN FCOU');
    });

    it('preserves unmapped indications with FOR prefix', () => {
      expect(translateRecognizedPhrases('Take 1 tablet by mouth daily for allergic rhinitis')).toBe('TAKE 1 TABLET PO QD FOR ALLERGIC RHINITIS');
    });

    it('translates prose preceding and following the indication span', () => {
      // Indication followed by duration or schedule
      expect(translateRecognizedPhrases('Take 1 tablet by mouth daily for GERD for 14 days')).toBe('TAKE 1 TABLET PO QD FGERD X14D');
      expect(translateRecognizedPhrases('Take 1 tablet by mouth for pain twice daily')).toBe('TAKE 1 TABLET PO FPAIN BID');
    });
  });

  describe('numeric directions normalization integration', () => {
    it('normalizes written number words before phrase substitution', () => {
      // TWO TIMES A DAY -> 2 TIMES A DAY -> BID
      expect(translateRecognizedPhrases('Take two tablets by mouth two times a day')).toBe('TAKE 2 TABLETS PO BID');
      // FOUR TIMES A DAY -> 4 TIMES A DAY -> QID
      expect(translateRecognizedPhrases('Take one capsule orally four times a day')).toBe('TAKE 1 CAPSULE PO QID');
      // THREE TIMES A DAY -> 3 TIMES A DAY -> TID
      expect(translateRecognizedPhrases('Take 1 tablet orally three times a day')).toBe('TAKE 1 TABLET PO TID');
    });
  });

  describe('lossless preservation of unrecognized text', () => {
    it('preserves instructions, qualifiers, and novel actions in uppercase', () => {
      const input = 'Dissolve 1 tablet in 4 oz of warm water and gargle twice daily';
      expect(translateRecognizedPhrases(input)).toBe(
        'DISSOLVE 1 TABLET IN 4 OZ OF WARM WATER AND GARGLE BID'
      );
    });

    it('retains complex qualifiers without stripping them', () => {
      const input = 'Apply sparingly to affected area of left elbow topically twice daily with food';
      expect(translateRecognizedPhrases(input)).toBe(
        'APPLY SPARINGLY TO AFFECTED AREA OF LEFT ELBOW TPCL BID WITH FOOD'
      );
    });
  });
});
