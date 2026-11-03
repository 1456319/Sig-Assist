import { describe, expect, it } from 'vitest';
import { translateRecognizedPhrases } from './partialTranslation';

describe('partialTranslation', () => {
  describe('translateRecognizedPhrases', () => {
    it('returns insulin sliding scale untouched, just uppercased and trimmed', () => {
      expect(translateRecognizedPhrases('  inject 1 unit per sliding scale before meals  ')).toBe('INJECT 1 UNIT PER SLIDING SCALE BEFORE MEALS');
      expect(translateRecognizedPhrases('SLIDING SCALE if 150-200 give 2 units')).toBe('SLIDING SCALE IF 150-200 GIVE 2 UNITS');
    });

    it('translates routes correctly', () => {
      expect(translateRecognizedPhrases('take 1 tablet by mouth')).toBe('TAKE 1 TABLET PO');
      expect(translateRecognizedPhrases('take 1 tablet orally')).toBe('TAKE 1 TABLET PO');
      expect(translateRecognizedPhrases('via PEG tube')).toBe('PEGT');
      expect(translateRecognizedPhrases('through J-TUBE')).toBe('JT');
      expect(translateRecognizedPhrases('inject subcutaneously')).toBe('INJECT SQ');
      expect(translateRecognizedPhrases('dissolve sublingually')).toBe('DISSOLVE SL');
      expect(translateRecognizedPhrases('insert vaginally')).toBe('INSERT PV');
      expect(translateRecognizedPhrases('insert rectally')).toBe('INSERT PR');
      expect(translateRecognizedPhrases('apply topically')).toBe('APPLY TPCL');
      expect(translateRecognizedPhrases('inhale via a nebulizer')).toBe('INHALE NEB');
      expect(translateRecognizedPhrases('inhale using nebuliser')).toBe('INHALE NEB');
    });

    it('translates schedules and frequencies correctly', () => {
      expect(translateRecognizedPhrases('take 1 tablet in the evening')).toBe('TAKE 1 TABLET QPM');
      expect(translateRecognizedPhrases('take 1 tablet every other day')).toBe('TAKE 1 TABLET QOD');
      expect(translateRecognizedPhrases('take 1 tablet every 8 hours')).toBe('TAKE 1 TABLET Q8H');
      // "every 24 hrs" -> Q24H (number normalization changes it to 24 before schedule mapping)
      expect(translateRecognizedPhrases('take 1 tablet every twenty-four hrs')).toBe('TAKE 1 TABLET Q24H');
      expect(translateRecognizedPhrases('take 1 tablet 4 times a day')).toBe('TAKE 1 TABLET QID');
      expect(translateRecognizedPhrases('take 1 tablet four times daily')).toBe('TAKE 1 TABLET QID');
      expect(translateRecognizedPhrases('take 1 tablet 3 times a day')).toBe('TAKE 1 TABLET TID');
      expect(translateRecognizedPhrases('take 1 tablet three times daily')).toBe('TAKE 1 TABLET TID');
      expect(translateRecognizedPhrases('take 1 tablet 2 times a day')).toBe('TAKE 1 TABLET BID');
      expect(translateRecognizedPhrases('take 1 tablet twice a day')).toBe('TAKE 1 TABLET BID');
      expect(translateRecognizedPhrases('take 1 tablet 1 time a day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('take 1 tablet once a day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('take 1 tablet every day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('take 1 tablet daily')).toBe('TAKE 1 TABLET QD');
    });

    it('translates as needed correctly', () => {
      expect(translateRecognizedPhrases('take 1 tablet as needed')).toBe('TAKE 1 TABLET PRN');
    });

    it('translates duration correctly if in SIG_CODE_REFERENCE, or leaves untouched', () => {
      expect(translateRecognizedPhrases('take 1 tablet for 5 days')).toBe('TAKE 1 TABLET X5D');
      expect(translateRecognizedPhrases('take 1 tablet for five days')).toBe('TAKE 1 TABLET X5D');
      expect(translateRecognizedPhrases('take 1 tablet for 2 weeks')).toBe('TAKE 1 TABLET X2WK');
      expect(translateRecognizedPhrases('take 1 tablet for 1 month')).toBe('TAKE 1 TABLET X1M');
      expect(translateRecognizedPhrases('take 1 tablet for 12345 days')).toBe('TAKE 1 TABLET FOR 12345 DAYS');
    });

    it('resolves indications with indicationSpan properly', () => {
      expect(translateRecognizedPhrases('take 1 tablet for pain')).toBe('TAKE 1 TABLET FPAIN');
      expect(translateRecognizedPhrases('take 1 tablet for type 2 diabetes')).toBe('TAKE 1 TABLET FDM2');
      expect(translateRecognizedPhrases('take 1 tablet related to HTN')).toBe('TAKE 1 TABLET FHTN');
      expect(translateRecognizedPhrases('take 1 tablet related to cough as needed')).toBe('TAKE 1 TABLET FCOU PRN');
      expect(translateRecognizedPhrases('take 1 tablet for pain every 8 hours')).toBe('TAKE 1 TABLET FPAIN Q8H');
    });
  });
});
