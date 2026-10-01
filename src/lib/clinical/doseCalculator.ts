import { AbnormalityFinding } from './types';
import { traceLogger } from '../diagnostics/traceLogger';

export interface DoseCalculationResult {
  readonly doseToken: string;
  readonly routeToken: string;
  readonly abnormalities: AbnormalityFinding[];
  readonly isApap: boolean;
  readonly apapLimitToken?: string;
}

const WORD_TO_NUM: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
  SIX: 6,
  SEVEN: 7,
  EIGHT: 8,
  NINE: 9,
  TEN: 10,
};

function parseCountToken(token: string): number {
  const upper = token.trim().toUpperCase();
  if (WORD_TO_NUM[upper] !== undefined) {
    return WORD_TO_NUM[upper];
  }
  return parseInt(upper, 10);
}

function calculateDoseAndVolumeInternal(drugName: string, rawProse: string): DoseCalculationResult {
  const upperDrug = drugName.toUpperCase();
  const upperProse = rawProse.toUpperCase();
  const abnormalities: AbnormalityFinding[] = [];

  if (!rawProse.trim()) {
    abnormalities.push({
      id: `abn_dose_empty_${Date.now()}`,
      tier: 'potential_error',
      title: 'Missing Directions',
      message: 'Original directions are empty or missing. Dosing calculation cannot proceed.',
      trigger: 'Empty directions'
    });
    return {
      doseToken: '',
      routeToken: '',
      abnormalities,
      isApap: false
    };
  }

  const isApap = upperDrug.includes('APAP') || upperDrug.includes('ACETAMINOPHEN') || upperProse.includes('ACETAMINOPHEN');
  let apapLimitToken: string | undefined;
  if (isApap) {
    if (upperProse.includes('DO NOT EXCEED 3G') || upperProse.includes('MAX 3G') || upperProse.includes('NOT TO EXCEED 3')) {
      apapLimitToken = '3GME';
    } else {
      apapLimitToken = '3GM';
    }
  }

  // Diclofenac Gel 1% special rules
  if (upperDrug.includes('DICLOFENAC') && (upperDrug.includes('GEL') || upperDrug.includes('1%'))) {
    const isLower = upperProse.includes('LEG') || upperProse.includes('KNEE') || upperProse.includes('ANKLE') || upperProse.includes('FOOT') || upperProse.includes('FEET');
    const isUpper = upperProse.includes('SHOULDER') || upperProse.includes('ARM') || upperProse.includes('HAND') || upperProse.includes('WRIST') || upperProse.includes('LOWER BACK') || upperProse.includes('BACK');

    if (isLower && !isUpper) {
      return {
        doseToken: 'AP4GM',
        routeToken: 'TPCL',
        abnormalities,
        isApap,
        apapLimitToken
      };
    }

    if (!isLower && !isUpper) {
      abnormalities.push({
        id: `abn_diclo_${Date.now()}`,
        tier: 'applied_correction',
        title: 'Diclofenac Dose Default Applied',
        message: 'The generated Sig CONTAINS A CORRECTION.',
        correction: 'Sig was generated with Qty/Dose = 2GM',
        trigger: 'Unspecified anatomical site for topical application'
      });
    }

    return {
      doseToken: 'AP 2GM',
      routeToken: 'TPCL',
      abnormalities,
      isApap,
      apapLimitToken
    };
  }

  // Morphine Concentrate 20mg/ml bracketed rule
  if (upperDrug.includes('MORPHINE') && upperDrug.includes('20MG/ML')) {
    const volMatch = upperProse.match(/(\d+(?:\.\d+)?)\s*(?:ML|MILLILITER)/);
    if (volMatch) {
      const vol = parseFloat(volMatch[1]);
      const mg = Math.round(vol * 20);
      return {
        doseToken: `[ROX${mg}MG]`,
        routeToken: 'PO',
        abnormalities,
        isApap,
        apapLimitToken
      };
    }
  }

  // Inhaler / Diskus "take 1 capsule" correction rule
  const isInhaler = upperDrug.includes('DISKUS') || upperDrug.includes('INHALER') || upperDrug.includes('AER') || upperDrug.includes('HFA');
  if (isInhaler) {
    if (upperProse.includes('CAPSULE') || upperProse.includes('TABLET')) {
      abnormalities.push({
        id: `abn_inhaler_${Date.now()}`,
        tier: 'applied_correction',
        title: 'Inhaler Formulation Correction',
        message: 'The generated Sig CONTAINS A CORRECTION.',
        correction: 'Corrected capsule/tablet wording to puff (1P)',
        trigger: 'Oral solid wording on dry powder/aerosol inhaler order'
      });
    }
    const countMatch = upperProse.match(/(\d+)\s*(?:PUFF|INH|INHALATION|CAPSULE)/);
    const count = countMatch ? countMatch[1] : '1';
    return {
      doseToken: `${count}P`,
      routeToken: 'INH',
      abnormalities,
      isApap,
      apapLimitToken
    };
  }

  // Injectable volume and target dose calculation
  if (upperDrug.includes('INJ') || upperProse.includes('INJECT') || upperProse.includes('SUBCUTANEOUS')) {
    const strengthMatch = upperDrug.match(/(\d+(?:\.\d+)?)\s*MG\s*\/\s*(\d+(?:\.\d+)?)\s*ML/);
    const mgMatch = upperProse.match(/(\d+(?:\.\d+)?)\s*MG/);
    const mlMatch = upperProse.match(/(\d+(?:\.\d+)?)\s*ML/);

    let vol = 0;
    let mg = 0;

    if (strengthMatch) {
      const concMg = parseFloat(strengthMatch[1]);
      const concMl = parseFloat(strengthMatch[2]);
      if (mgMatch) {
        mg = parseFloat(mgMatch[1]);
        vol = (mg * concMl) / concMg;
      } else if (mlMatch) {
        vol = parseFloat(mlMatch[1]);
        mg = (vol * concMg) / concMl;
      }
    } else {
      if (mlMatch) vol = parseFloat(mlMatch[1]);
      if (mgMatch) mg = parseFloat(mgMatch[1]);
    }

    const volStr = vol > 0 ? (Number.isInteger(vol) ? `${vol}ML` : `${parseFloat(vol.toFixed(3))}ML`) : (mlMatch ? `${mlMatch[1]}ML` : '');
    const mgStr = mg > 0 ? (Number.isInteger(mg) ? `${mg}MG` : `${parseFloat(mg.toFixed(3))}MG`) : '';
    const doseToken = volStr && mgStr ? `INJ ${volStr} (${mgStr})` : (volStr ? `INJ ${volStr}` : `INJ ${mgStr}`);

    return {
      doseToken,
      routeToken: /\b(?:INTRAMUSCULAR|IM)\b/i.test(upperProse) ? 'IM' : 'SQ',
      abnormalities,
      isApap,
      apapLimitToken
    };
  }

  // Transdermal patch
  if (upperDrug.includes('PATCH') || upperProse.includes('PATCH') || upperProse.includes('TRANSDERMAL')) {
    const countMatch = upperProse.match(/(\d+)\s*PATCH/);
    const count = countMatch ? countMatch[1] : '1';
    return {
      doseToken: `${count}PA`,
      routeToken: 'TRANSDERMALLY',
      abnormalities,
      isApap,
      apapLimitToken
    };
  }

  // Oral liquid / syrup / elixir / solution / suspension
  const isLiquid = upperDrug.includes('SYR') ||
    upperDrug.includes('SOLN') ||
    upperDrug.includes('ELIX') ||
    upperDrug.includes('LIQ') ||
    upperDrug.includes('SUSP') ||
    /\b\d+(?:\.\d+)?\s*ML\b/i.test(upperProse) ||
    upperProse.includes('MILLILITER');

  if (isLiquid) {
    const mlMatch = upperProse.match(/\b(\d+(?:\.\d+)?)\s*(?:ML|MILLILITER)\b/);
    const vol = mlMatch ? parseFloat(mlMatch[1]) : 0;
    const strengthMatch = upperDrug.match(/(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?\s*(MG|GM|MCG)\s*\/\s*(\d+(?:\.\d+)?)\s*ML/);

    const drugWithoutConc = upperDrug.replace(/\/\s*\d*(?:\.\d+)?\s*ML.*/, '');
    const isMultiIngredient = upperDrug.includes('-') || (upperDrug.match(/\//g) || []).length > 1 || drugWithoutConc.includes('/') || Boolean(strengthMatch?.[2]);

    let doseToken = `ADM ${vol}ML`;
    if (strengthMatch && vol > 0 && !isMultiIngredient) {
      const concVal = parseFloat(strengthMatch[1]);
      const unit = strengthMatch[3];
      const concMl = parseFloat(strengthMatch[4] || '1');
      const calculatedDose = (vol * concVal) / concMl;
      const roundedDose = Number.isInteger(calculatedDose) ? calculatedDose.toString() : parseFloat(calculatedDose.toFixed(3)).toString();
      doseToken = `ADM ${vol}ML (${roundedDose}${unit})`;
    }

    return {
      doseToken,
      routeToken: 'PO',
      abnormalities,
      isApap,
      apapLimitToken
    };
  }

  // Powder packets (Miralax, Polyethylene glycol)
  if (upperDrug.includes('PACKET') || upperDrug.includes('PKT') || upperProse.includes('PACKET')) {
    const countMatch = upperProse.match(/(\d+)\s*PACKET/);
    const count = countMatch ? countMatch[1] : '1';
    return {
      doseToken: `${count}PKT`,
      routeToken: 'PO',
      abnormalities,
      isApap,
      apapLimitToken
    };
  }

  // Oral solids (Tablets vs Capsules)
  const isCapsule = upperDrug.includes('CAP') || upperProse.includes('CAPSULE');
  const unitChar = isCapsule ? 'C' : 'T';

  const strengthMatch = upperDrug.match(/(\d+(?:\.\d+)?)\s*(MG|MCG|GM)/);
  const getTargetDose = (multiplier: number): string => {
    if (multiplier <= 0) return '';
    if (strengthMatch && !upperDrug.includes('/') && !upperDrug.includes('-')) {
      const singleVal = parseFloat(strengthMatch[1]);
      const unit = strengthMatch[2];
      const totalVal = singleVal * multiplier;
      const roundedTotal = Number.isInteger(totalVal) ? totalVal.toString() : parseFloat(totalVal.toFixed(3)).toString();
      return ` (${roundedTotal}${unit})`;
    }
    return '';
  };

  // 1. Fractions & mixed numbers (e.g. 1/2, 3/4, 1/4, 1 1/2, HALF)
  const fractionMatch = upperProse.match(/\b(?:(HALF)|(\d+)\s*[- ]\s*(\d+)\/(\d+)|(\d+)\/(\d+))\s*(?:TABLETS?|TABS?|CAPSULES?|CAPS?)\b/);
  if (fractionMatch) {
    let multiplier = 0.5;
    let label = '1/2';
    if (fractionMatch[1]) {
      // HALF
      multiplier = 0.5;
      label = '1/2';
    } else if (fractionMatch[2]) {
      // Mixed number e.g. 1 1/2
      const whole = parseInt(fractionMatch[2], 10);
      const num = parseInt(fractionMatch[3], 10);
      const den = parseInt(fractionMatch[4], 10);
      if (den === 0) {
        abnormalities.push({
          id: `abn_fraction_zero_den_${Date.now()}`,
          tier: 'potential_error',
          title: 'Invalid Fraction Denominator',
          message: `Dose expression '${fractionMatch[0]}' contains a zero denominator, resulting in an undefined dose quantity.`,
          trigger: fractionMatch[0]
        });
        return {
          doseToken: '',
          routeToken: 'PO',
          abnormalities,
          isApap,
          apapLimitToken
        };
      } else {
        multiplier = whole + num / den;
        label = `${whole}-${num}/${den}`;
      }
    } else if (fractionMatch[5]) {
      // Fraction e.g. 1/2, 3/4
      const num = parseInt(fractionMatch[5], 10);
      const den = parseInt(fractionMatch[6], 10);
      label = `${num}/${den}`;
      if (den === 0) {
        abnormalities.push({
          id: `abn_fraction_zero_den_${Date.now()}`,
          tier: 'potential_error',
          title: 'Invalid Fraction Denominator',
          message: `Dose expression '${fractionMatch[0]}' contains a zero denominator, resulting in an undefined dose quantity.`,
          trigger: fractionMatch[0]
        });
        return {
          doseToken: '',
          routeToken: 'PO',
          abnormalities,
          isApap,
          apapLimitToken
        };
      } else {
        multiplier = num / den;
      }
    }
    const targetDoseStr = getTargetDose(multiplier);
    return {
      doseToken: `${label}${unitChar}${targetDoseStr}`,
      routeToken: 'PO',
      abnormalities,
      isApap,
      apapLimitToken
    };
  }

  // 2. Decimals (e.g. 1.5, 0.5, 2.5)
  const decimalMatch = upperProse.match(/\b(\d+\.\d+)\s*(?:TABLETS?|TABS?|CAPSULES?|CAPS?)\b/);
  if (decimalMatch) {
    const decVal = parseFloat(decimalMatch[1]);
    const multiplier = decVal;
    const label = decVal === 0.5 ? '1/2' : decVal.toString();
    const targetDoseStr = getTargetDose(multiplier);
    return {
      doseToken: `${label}${unitChar}${targetDoseStr}`,
      routeToken: 'PO',
      abnormalities,
      isApap,
      apapLimitToken
    };
  }

  // 3. Whole integers and number words
  // Pattern A: Explicit tablet/capsule keywords
  const explicitCountMatch = upperProse.match(
    /(?<![\d./])(\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)(?!\s*[\d./])\s*(?:TABLETS?|TABS?|CAPSULES?|CAPS?)\b/
  );

  // Pattern B: Preceded by action verb (e.g. TAKE 2 BY MOUTH, GIVE 2 PO, ADM 2)
  const verbCountMatch = !explicitCountMatch
    ? upperProse.match(
        /\b(?:TAKE|GIVE|ADM(?:INISTER)?|INGEST)\s+(\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\b(?!\s*[\d./])(?!\s*(?:MG|MCG|GM|G\b|ML|MILLILITER|L\b|OZ|HOUR|HR|DAY|D\b|WEEK|WK|MONTH|MIN|MINUTES?)\b)/
      )
    : null;

  // Pattern C: Followed by oral route indicators (e.g. 2 PO, 2 BY MOUTH)
  const routeCountMatch = (!explicitCountMatch && !verbCountMatch)
    ? upperProse.match(
        /(?<![\d./])(\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\s*(?:PO|BY\s+MOUTH|ORALLY)\b/
      )
    : null;

  const countRaw = explicitCountMatch?.[1] || verbCountMatch?.[1] || routeCountMatch?.[1];
  let count = 1;

  if (countRaw) {
    count = parseCountToken(countRaw);
  } else {
    // If directions omit any quantity and any standard word
    if (!/\b(?:TABLETS?|TABS?|CAPSULES?|CAPS?|1|ONE)\b/.test(upperProse)) {
      abnormalities.push({
        id: `abn_dose_unspecified_${Date.now()}`,
        tier: 'potential_error',
        title: 'Unspecified Dose Quantity',
        message: 'Original directions omit a dosage count. Defaulted to 1 tablet/capsule for safety review.',
        trigger: rawProse.trim(),
      });
    }
  }

  if (count > 1) {
    const targetDoseStr = getTargetDose(count);
    return {
      doseToken: `${count}${unitChar}${targetDoseStr}`,
      routeToken: 'PO',
      abnormalities,
      isApap,
      apapLimitToken,
    };
  }

  return {
    doseToken: `1${unitChar}`,
    routeToken: 'PO',
    abnormalities,
    isApap,
    apapLimitToken,
  };
}

export function calculateDoseAndVolume(drugName: string, rawProse: string): DoseCalculationResult {
  const result = calculateDoseAndVolumeInternal(drugName, rawProse);
  traceLogger.debug('clinical', 'doseCalculator', 'Calculated dose and route tokens', {
    drugName,
    doseToken: result.doseToken,
    routeToken: result.routeToken,
    isApap: result.isApap,
    apapLimitToken: result.apapLimitToken,
    abnormalitiesCount: result.abnormalities.length
  });
  return result;
}

