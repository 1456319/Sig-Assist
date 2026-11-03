import { describe, expect, it } from 'vitest';
import { translateRecognizedPhrases } from '../src/lib/clinical/partialTranslation';

describe('translateRecognizedPhrases', () => {
  describe('sliding scale bypass', () => {
    it('bypasses translation for sliding scale insulin directions', () => {
      const input = 'Inject as per sliding scale: if 181 - 200 = 1 unit, subcutaneously before meals for DM';
      const output = translateRecognizedPhrases(input);
      // Preserves original words in uppercase and trimmed, without abbreviating to SQ or FDM
      expect(output).toBe('INJECT AS PER SLIDING SCALE: IF 181 - 200 = 1 UNIT, SUBCUTANEOUSLY BEFORE MEALS FOR DM');
      expect(output).not.toContain('SQ');
      expect(output).not.toContain('FDM');
    });

    it('handles sliding scale with irregular whitespace and casing', () => {
      const input = '  Take   with   SLIDING   scale  as directed  ';
      expect(translateRecognizedPhrases(input)).toBe('TAKE WITH SLIDING SCALE AS DIRECTED');
    });
  });

  describe('route translations', () => {
    it('translates oral routes (BY MOUTH, ORALLY)', () => {
      expect(translateRecognizedPhrases('Take 1 tablet by mouth')).toBe('TAKE 1 TABLET PO');
      expect(translateRecognizedPhrases('Take 1 capsule orally')).toBe('TAKE 1 CAPSULE PO');
      expect(translateRecognizedPhrases('GIVE TWO TABLETS BY   MOUTH')).toBe('GIVE 2 TABLETS PO');
    });

    it('translates tube routes (PEG, G, J, NG)', () => {
      expect(translateRecognizedPhrases('Give via peg-tube')).toBe('GIVE PEGT');
      expect(translateRecognizedPhrases('Give per peg tube')).toBe('GIVE PEGT');
      expect(translateRecognizedPhrases('Give through peg tube')).toBe('GIVE PEGT');

      expect(translateRecognizedPhrases('Administer via g-tube')).toBe('ADMINISTER GT');
      expect(translateRecognizedPhrases('Administer per g tube')).toBe('ADMINISTER GT');
      expect(translateRecognizedPhrases('Administer through g tube')).toBe('ADMINISTER GT');

      expect(translateRecognizedPhrases('Give per j-tube')).toBe('GIVE JT');
      expect(translateRecognizedPhrases('Give via j tube')).toBe('GIVE JT');
      expect(translateRecognizedPhrases('Give through j tube')).toBe('GIVE JT');

      expect(translateRecognizedPhrases('Give per ng-tube')).toBe('GIVE NG');
      expect(translateRecognizedPhrases('Give via ng tube')).toBe('GIVE NG');
      expect(translateRecognizedPhrases('Give through ng tube')).toBe('GIVE NG');
    });

    it('translates other routes (SQ, SL, PV, PR, TPCL, NEB)', () => {
      expect(translateRecognizedPhrases('Inject subcutaneously')).toBe('INJECT SQ');
      expect(translateRecognizedPhrases('Dissolve sublingually')).toBe('DISSOLVE SL');
      expect(translateRecognizedPhrases('Insert vaginally')).toBe('INSERT PV');
      expect(translateRecognizedPhrases('Insert rectally')).toBe('INSERT PR');
      expect(translateRecognizedPhrases('Apply topically')).toBe('APPLY TPCL');
      expect(translateRecognizedPhrases('Inhale via nebulizer')).toBe('INHALE NEB');
      expect(translateRecognizedPhrases('Inhale using a nebulizer')).toBe('INHALE NEB');
      expect(translateRecognizedPhrases('Inhale via a nebuliser')).toBe('INHALE NEB');
      expect(translateRecognizedPhrases('Inhale using nebuliser')).toBe('INHALE NEB');
    });
  });

  describe('frequency and schedule translations', () => {
    it('translates daily frequency variations', () => {
      expect(translateRecognizedPhrases('Take 1 tablet 1 time a day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('Take 1 tablet 1 time per day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('Take 1 tablet 1 time each day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('Take 1 tablet once a day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('Take 1 tablet once day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('Take 1 tablet every day')).toBe('TAKE 1 TABLET QD');
      expect(translateRecognizedPhrases('Take 1 tablet daily')).toBe('TAKE 1 TABLET QD');
    });

    it('translates twice daily variations', () => {
      expect(translateRecognizedPhrases('Take 1 tablet 2 times a day')).toBe('TAKE 1 TABLET BID');
      expect(translateRecognizedPhrases('Take 1 tablet 2 times per day')).toBe('TAKE 1 TABLET BID');
      expect(translateRecognizedPhrases('Take 1 tablet 2 times each day')).toBe('TAKE 1 TABLET BID');
      expect(translateRecognizedPhrases('Take 1 tablet twice daily')).toBe('TAKE 1 TABLET BID');
      expect(translateRecognizedPhrases('Take 1 tablet twice a day')).toBe('TAKE 1 TABLET BID');
    });

    it('translates three times daily variations', () => {
      expect(translateRecognizedPhrases('Take 1 tablet 3 times a day')).toBe('TAKE 1 TABLET TID');
      expect(translateRecognizedPhrases('Take 1 tablet 3 times per day')).toBe('TAKE 1 TABLET TID');
      expect(translateRecognizedPhrases('Take 1 tablet 3 times each day')).toBe('TAKE 1 TABLET TID');
      expect(translateRecognizedPhrases('Take 1 tablet three times daily')).toBe('TAKE 1 TABLET TID');
      expect(translateRecognizedPhrases('Take 1 tablet three times a day')).toBe('TAKE 1 TABLET TID');
    });

    it('translates four times daily variations', () => {
      expect(translateRecognizedPhrases('Take 1 tablet 4 times a day')).toBe('TAKE 1 TABLET QID');
      expect(translateRecognizedPhrases('Take 1 tablet 4 times per day')).toBe('TAKE 1 TABLET QID');
      expect(translateRecognizedPhrases('Take 1 tablet 4 times each day')).toBe('TAKE 1 TABLET QID');
      expect(translateRecognizedPhrases('Take 1 tablet four times daily')).toBe('TAKE 1 TABLET QID');
      expect(translateRecognizedPhrases('Take 1 tablet four times a day')).toBe('TAKE 1 TABLET QID');
    });

    it('translates specific time-of-day and PRN variations', () => {
      expect(translateRecognizedPhrases('Take 1 tablet at bedtime')).toBe('TAKE 1 TABLET QHS');
      expect(translateRecognizedPhrases('Take 1 tablet in the morning')).toBe('TAKE 1 TABLET QAM');
      expect(translateRecognizedPhrases('Take 1 tablet in the evening')).toBe('TAKE 1 TABLET QPM');
      expect(translateRecognizedPhrases('Take 1 tablet every other day')).toBe('TAKE 1 TABLET QOD');
      expect(translateRecognizedPhrases('Take 1 tablet as needed')).toBe('TAKE 1 TABLET PRN');
    });

    it('translates hourly schedules via hourlySchedule', () => {
      expect(translateRecognizedPhrases('Take 1 tablet every 4 hours')).toBe('TAKE 1 TABLET Q4H');
      expect(translateRecognizedPhrases('Take 1 tablet every 6 hrs')).toBe('TAKE 1 TABLET Q6H');
      expect(translateRecognizedPhrases('Take 1 tablet every 8 hr')).toBe('TAKE 1 TABLET Q8H');
      expect(translateRecognizedPhrases('Take 1 tablet every 12 hours')).toBe('TAKE 1 TABLET Q12H');
      // Interval not in SIG_CODE_REFERENCE (e.g. 5 hours) formats with standard expansion
      expect(translateRecognizedPhrases('Take 1 tablet every 5 hours')).toBe('TAKE 1 TABLET Q5H');
      // Every 0 hours is invalid and preserved
      expect(translateRecognizedPhrases('Take 1 tablet every 0 hours')).toBe('TAKE 1 TABLET EVERY 0 HOURS');
    });
  });

  describe('duration translations', () => {
    it('translates valid duration codes present in SIG_CODE_REFERENCE', () => {
      expect(translateRecognizedPhrases('Take 1 tablet daily for 7 days')).toBe('TAKE 1 TABLET QD X7D');
      expect(translateRecognizedPhrases('Take 1 tablet daily for 10 days')).toBe('TAKE 1 TABLET QD X10D');
      expect(translateRecognizedPhrases('Take 1 tablet daily for 14 days')).toBe('TAKE 1 TABLET QD X14D');
      expect(translateRecognizedPhrases('Take 1 tablet daily for 30 days')).toBe('TAKE 1 TABLET QD X30D');
      expect(translateRecognizedPhrases('Take 1 tablet daily for 1 week')).toBe('TAKE 1 TABLET QD X1WK');
      expect(translateRecognizedPhrases('Take 1 tablet daily for 2 weeks')).toBe('TAKE 1 TABLET QD X2WK');
      expect(translateRecognizedPhrases('Take 1 tablet daily for 1 month')).toBe('TAKE 1 TABLET QD X1M');
      expect(translateRecognizedPhrases('Take 1 tablet daily for 48 hours')).toBe('TAKE 1 TABLET QD X48H');
    });

    it('retains prose when duration token does not exist in SIG_CODE_REFERENCE', () => {
      // X999D is not in SIG_CODE_REFERENCE
      expect(translateRecognizedPhrases('Take 1 tablet daily for 999 days')).toBe('TAKE 1 TABLET QD FOR 999 DAYS');
    });
  });

  describe('indication preservation and token resolution', () => {
    it('resolves recognized indications while translating surrounding prose', () => {
      expect(translateRecognizedPhrases('Take 1 tablet by mouth daily for pain')).toBe('TAKE 1 TABLET PO QD FPAIN');
      expect(translateRecognizedPhrases('Take 1 tablet by mouth daily for hypertension')).toBe('TAKE 1 TABLET PO QD FHTN');
      expect(translateRecognizedPhrases('Take 1 tablet by mouth daily for GERD')).toBe('TAKE 1 TABLET PO QD FGERD');
      expect(translateRecognizedPhrases('Take 1 tablet by mouth twice a day for cough')).toBe('TAKE 1 TABLET PO BID FCOU');
    });

    it('handles unrecognized indications gracefully', () => {
      expect(translateRecognizedPhrases('Take 1 tablet by mouth daily for unknown illness')).toBe('TAKE 1 TABLET PO QD FOR UNKNOWN ILLNESS');
    });

    it('translates text before and after indication span correctly', () => {
      expect(translateRecognizedPhrases('Take 1 tablet by mouth for pain as needed')).toBe('TAKE 1 TABLET PO FPAIN PRN');
      expect(translateRecognizedPhrases('Take 1 tablet by mouth for GERD in the evening')).toBe('TAKE 1 TABLET PO FGERD QPM');
    });
  });

  describe('lossless preservation and numeric normalization', () => {
    it('normalizes numeric words before regex translation', () => {
      // TWO TABLETS -> 2 TABLETS, FOUR TIMES A DAY -> 4 TIMES A DAY -> QID
      expect(translateRecognizedPhrases('Give two tablets by mouth four times a day')).toBe('GIVE 2 TABLETS PO QID');
      expect(translateRecognizedPhrases('Give one capsule by mouth twice daily')).toBe('GIVE 1 CAPSULE PO BID');
      expect(translateRecognizedPhrases('Give three tablets by mouth three times a day')).toBe('GIVE 3 TABLETS PO TID');
    });

    it('preserves unrecognized clinical qualifiers, actions, and custom dose instructions', () => {
      expect(translateRecognizedPhrases('Take 1 tablet with warm applesauce before breakfast')).toBe('TAKE 1 TABLET WITH WARM APPLESAUCE BEFORE BREAKFAST');
      expect(translateRecognizedPhrases('Crush 2 tablets and give via peg-tube daily')).toBe('CRUSH 2 TABLETS AND GIVE PEGT QD');
      expect(translateRecognizedPhrases('Swish 15 ml orally then spit out four times a day')).toBe('SWISH 15 ML PO THEN SPIT OUT QID');
    });

    it('handles empty strings and whitespace cleanly', () => {
      expect(translateRecognizedPhrases('')).toBe('');
      expect(translateRecognizedPhrases('   ')).toBe('');
      expect(translateRecognizedPhrases('  Take  1  tablet  by  mouth  daily  ')).toBe('TAKE 1 TABLET PO QD');
    });
  });
});
