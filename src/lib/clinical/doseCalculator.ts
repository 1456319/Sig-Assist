import { AbnormalityFinding } from './types';

export interface DoseCalculationResult {
  readonly doseToken: string;
  readonly routeToken: string;
  readonly abnormalities: AbnormalityFinding[];
  readonly isApap: boolean;
  readonly apapLimitToken?: string;
}

export function calculateDoseAndVolume(drugName: string, rawProse: string): DoseCalculationResult {
  const upperDrug = drugName.toUpperCase();
  const upperProse = rawProse.toUpperCase();
  const abnormalities: AbnormalityFinding[] = [];

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

    const volStr = vol > 0 ? (Number.isInteger(vol) ? `${vol}ML` : `${vol.toFixed(1)}ML`) : (mlMatch ? `${mlMatch[1]}ML` : '');
    const mgStr = mg > 0 ? (Number.isInteger(mg) ? `${mg}MG` : `${mg.toFixed(1)}MG`) : '';
    const doseToken = volStr && mgStr ? `INJ ${volStr} (${mgStr})` : (volStr ? `INJ ${volStr}` : `INJ ${mgStr}`);

    return {
      doseToken,
      routeToken: upperProse.includes('INTRAMUSCULAR') || upperProse.includes('IM') ? 'IM' : 'SQ',
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

  // Oral liquid / syrup / elixir / solution
  if (upperDrug.includes('SYR') || upperDrug.includes('SOLN') || upperDrug.includes('ELIX') || upperDrug.includes('LIQ') || upperProse.includes(' ML ') || upperProse.includes(' MILLILITER')) {
    const mlMatch = upperProse.match(/(\d+(?:\.\d+)?)\s*(?:ML|MILLILITER)/);
    const vol = mlMatch ? parseFloat(mlMatch[1]) : 0;
    const strengthMatch = upperDrug.match(/(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?\s*MG\s*\/\s*(\d+(?:\.\d+)?)\s*ML/);

    let doseToken = `ADM ${vol}ML`;
    if (strengthMatch && vol > 0) {
      const concMg = parseFloat(strengthMatch[1]);
      const concMl = parseFloat(strengthMatch[3] || '1');
      const calculatedDose = (vol * concMg) / concMl;
      const roundedDose = Number.isInteger(calculatedDose) ? calculatedDose.toString() : calculatedDose.toFixed(1);
      doseToken = `ADM ${vol}ML (${roundedDose}MG)`;
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

  const halfMatch = upperProse.match(/(?:0\.5|1\/2|HALF)\s*(?:TABLET|TAB|CAPSULE|CAP)/);
  if (halfMatch) {
    const strengthMatch = upperDrug.match(/(\d+(?:\.\d+)?)\s*(MG|MCG|GM)/);
    let targetDoseStr = '';
    if (strengthMatch) {
      const fullVal = parseFloat(strengthMatch[1]);
      const unit = strengthMatch[2];
      const halfVal = fullVal / 2;
      targetDoseStr = ` (${halfVal}${unit})`;
    }
    return {
      doseToken: `1/2${unitChar}${targetDoseStr}`,
      routeToken: 'PO',
      abnormalities,
      isApap,
      apapLimitToken
    };
  }

  const countMatch = upperProse.match(/(\d+)\s*(?:TABLET|TAB|CAPSULE|CAP)/);
  const count = countMatch ? parseInt(countMatch[1], 10) : 1;

  if (count > 1) {
    const strengthMatch = upperDrug.match(/(\d+(?:\.\d+)?)\s*(MG|MCG|GM)/);
    let targetDoseStr = '';
    if (strengthMatch && !upperDrug.includes('/') && !upperDrug.includes('-')) {
      const singleVal = parseFloat(strengthMatch[1]);
      const unit = strengthMatch[2];
      const totalVal = singleVal * count;
      const roundedTotal = Number.isInteger(totalVal) ? totalVal.toString() : totalVal.toFixed(1);
      targetDoseStr = ` (${roundedTotal}${unit})`;
    }
    return {
      doseToken: `${count}${unitChar}${targetDoseStr}`,
      routeToken: 'PO',
      abnormalities,
      isApap,
      apapLimitToken
    };
  }

  return {
    doseToken: `1${unitChar}`,
    routeToken: 'PO',
    abnormalities,
    isApap,
    apapLimitToken
  };
}
