import { AbnormalityFinding } from './types';
import { traceLogger } from '../diagnostics/traceLogger';
import { splitSupplementalDirections } from './instructionClauses';
import { normalizeNumericDirections } from './numericDirections';
import { SIG_CODE_REFERENCE } from './sigCodeReference';

export interface DoseCalculationResult {
  readonly doseToken: string;
  readonly routeToken: string;
  readonly abnormalities: AbnormalityFinding[];
  readonly isApap: boolean;
  readonly apapLimitToken?: string;
  readonly siteToken?: string;
  readonly requiresManualTranslation?: boolean;
  readonly preparationTemplate?: string;
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
  return Number(upper);
}

function quantityFromStrength(drug: string, prose: string): { count: number; label: string; total: string } | undefined {
  if (/[-/+]/.test(drug) || !/\b(?:BY MOUTH|ORALLY|PO)\b/.test(prose)) return undefined;
  const strengths = [...drug.matchAll(/(?<![\d.])(\d+(?:\.\d+)?)\s*(MCG|MEQ|MG|GM|G)\b/g)];
  const dose = prose.match(/\b(?:GIVE|TAKE|ADMINISTER)\s+(\d+(?:\.\d+)?)\s*(MCG|MEQ|MG|GM|G)\b/);
  if (strengths.length !== 1 || !dose) return undefined;
  const strength = strengths[0];
  const factors: Record<string, number> = { MCG: 0.001, MG: 1, GM: 1000, G: 1000, MEQ: 1 };
  if ((strength[2] === 'MEQ') !== (dose[2] === 'MEQ') || Number(strength[1]) <= 0) return undefined;
  const count = Number(dose[1]) * factors[dose[2]] / (Number(strength[1]) * factors[strength[2]]);
  const fractions: Record<string, string> = { '0.25': '1/4', '0.5': '1/2', '0.75': '3/4' };
  if (count <= 0 || count > 10 || (!Number.isInteger(count) && !fractions[String(count)])) return undefined;
  return { count, label: fractions[String(count)] || String(count), total: `${Number(dose[1])}${dose[2] === 'G' ? 'GM' : dose[2]}` };
}

function calculateDoseAndVolumeInternal(drugName: string, rawProse: string): DoseCalculationResult {
  const upperDrug = drugName.toUpperCase();
  const fullProse = normalizeNumericDirections(rawProse);
  const upperProse = normalizeNumericDirections(splitSupplementalDirections(rawProse).primary);
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

  const isApap = /\b(?:APAP|ACETAMINOPHEN|TYLENOL)\b/.test(`${upperDrug} ${fullProse}`);
  let apapLimitToken: string | undefined;
  if (isApap) {
    const explicitLimit = fullProse.match(/\b(?:DO\s+NOT\s+EXCEED|NOT\s+TO\s+EXCEED|MAX(?:IMUM)?(?:\s+(?:DAILY\s+)?DOSE)?(?:\s+OF)?)\s*(?:MORE\s+THAN\s*)?(\d[\d,]*(?:\.\d+)?)\s*(MG|GMS?|GRAMS?|G)\b/);
    if (explicitLimit) {
      const amount = Number(explicitLimit[1].replace(/,/g, ''));
      const milligrams = explicitLimit[2] === 'MG' ? amount : amount * 1000;
      // 3GME is a daily APAP limit; never substitute it for another amount/time period.
      if (milligrams === 3000 && /\b(?:PER\s+DAY|DAILY|(?:IN|PER)\s+(?:A\s+)?24\s*(?:HOURS?|HRS?|HR|H)\b)/.test(fullProse.slice(explicitLimit.index))) apapLimitToken = '3GME';
    } else apapLimitToken = '3GM';
  }

  const manualResult = (title: string): DoseCalculationResult => ({
    doseToken: '', routeToken: '', isApap, apapLimitToken, requiresManualTranslation: true,
    abnormalities: [...abnormalities, { id: `abn_manual_${Date.now()}`, tier: 'uncorrected_gap', title,
      message: 'Dose or formulation needs review. Recognized directions may be abbreviated; unrecognized wording is retained without guessing a dose or dosage form.', trigger: rawProse.trim() }],
  });
  if (/^(?:(?:GIVE|TAKE|ADMINISTER|INSTILL|INSERT|APPLY|INHALE|USE)\s+)?-\s*\d/.test(upperProse)) return manualResult('Invalid Negative Dose');

  // A measured liquid is not necessarily oral. Resolve explicit inhalation first.
  const nebulizer = /\b(?:NEB|NEBULI[ZS]ER|NEBULI[ZS]E)\b/.test(upperProse);
  const inhaledVolume = /\bINHAL(?:E|ATION|ED)\b/.test(upperProse) && /\b\d+(?:\.\d+)?\s*(?:ML|MILLILITERS?)\b/.test(upperProse);
  if (nebulizer || inhaledVolume) {
    if (/\b(?:DO\s+NOT|NOT\s+TO|AVOID|WITHOUT)\b[^.;]{0,35}\b(?:NEB|NEBULI[ZS]ER|NEBULI[ZS]E)\b/.test(upperProse)) return manualResult('Unverified Nebulizer Route');
    if (/\b\d+(?:\.\d+)?\s*(?:-|TO|OR|\/)\s*\d+(?:\.\d+)?\s*(?:ML|MILLILITERS?|VIALS?)\b|\b(?:MIX|DILUTE|ADD)\b/.test(upperProse)) return manualResult('Variable Nebulizer Dose or Preparation');
    if (nebulizer && /(?<![\d./-])\b1\s+VIAL\b/.test(upperProse)) return { doseToken: '1V', routeToken: 'NEB', abnormalities, isApap, apapLimitToken };
    const volume = upperProse.match(/(?<![\d./-])\b(\d+(?:\.\d+)?)\s*(?:ML|MILLILITERS?)\b/);
    const verifiedCombinationVial = /\b(?:47335075649|47335075652|47335-756-(?:49|52))\b/.test(upperDrug)
      && /\bIPRATROPIUM\b/.test(upperDrug) && /\bALBUTEROL\b/.test(upperDrug);
    const albuterolUnitDose = /\bALBUTEROL\b/.test(upperDrug) && /\b(?:INH|INHALATION)\b/.test(upperDrug)
      && /(?<![\d.])0\.083\s*%/.test(upperDrug) && !/\b(?:IPRATROPIUM|WITH|AND)\b|[+/]/.test(upperDrug);
    const verified3mlVial = verifiedCombinationVial || albuterolUnitDose;
    if (volume && Number(volume[1]) === 3 && verified3mlVial) {
      abnormalities.push({ id: 'nebulizer_vial_conversion', tier: 'applied_correction', title: 'Nebulizer Vial Quantity Calculated',
        message: 'The source volume was converted to one vial using the verified product presentation. Verify the selected NDC before copying.',
        correction: '3ML = 1V; route NEB', trigger: albuterolUnitDose ? 'Albuterol 0.083% inhalation solution: labeled 3 mL unit-dose presentation; verify selected product' : 'NDC 47335-756-49/52: 3 mL unit-dose vial for nebulizer use' });
      return { doseToken: '1V', routeToken: 'NEB', abnormalities, isApap, apapLimitToken };
    }
    if (volume && Number(volume[1]) > 0 && nebulizer && !/\b(?:MIX|DILUTE|ADD)\b/.test(upperProse)) {
      abnormalities.push({ id: 'nebulizer_volume_retained', tier: 'uncorrected_gap', title: 'Nebulizer Volume Retained',
        message: 'The prescribed mL dose was retained. No vial count was assumed; verify the product presentation.', trigger: volume[0] });
      return { doseToken: `ADM ${Number(volume[1])}ML`, routeToken: 'NEB', abnormalities, isApap, apapLimitToken };
    }
    return manualResult('Unverified Nebulizer Vial Quantity');
  }

  // Eye drops require an explicit eye destination. Never infer an oral solid,
  // eye laterality, quantity range, or schedule from an unknown product name.
  if (/\b(?:DROPS?|GTT)\b/.test(upperProse)) {
    const count = upperProse.match(/(?<![\d./-])(\d+|ONE|TWO)\s*(?:DROPS?|GTT)\b/);
    const eye = upperProse.match(/\b(LEFT|RIGHT|BOTH|EACH)\s+(EYES?|EARS?)\b|\b(OS|OD|OU|AL|AD|AU)\b/);
    const conflictingRoute = /\b(?:NOSE|NASAL|BY\s+MOUTH|ORALLY|PO)\b/.test(upperProse);
    const ambiguous = /\b\d+\s*(?:-|TO|\/|OR)\s*\d+\s*DROPS?\b|\b(?:DO\s+NOT|NOT\s+IN|EXCEPT)\b/.test(upperProse)
      || [...upperProse.matchAll(/\b(?:LEFT|RIGHT|BOTH|EACH)\s+(?:EYES?|EARS?)\b|\b(?:OS|OD|OU|AL|AD|AU)\b/g)].length > 1;
    if (!count || !eye || conflictingRoute || ambiguous || parseCountToken(count[1]) <= 0) return manualResult('Unverified Eye Drop Dose or Site');
    const quantity = parseCountToken(count[1]);
    const routes: Record<string, string> = eye[2]?.startsWith('EAR')
      ? { LEFT: 'AL', RIGHT: 'AD', BOTH: 'AU', EACH: 'AU' } : { LEFT: 'OS', RIGHT: 'OD', BOTH: 'OU', EACH: 'OU' };
    return { doseToken: quantity <= 2 || SIG_CODE_REFERENCE[`${quantity}G`] ? `${quantity}G` : `INSTILL ${quantity} DROPS`,
      routeToken: eye[3] || routes[eye[1]], abnormalities, isApap, apapLimitToken };
  }

  // Explicit routes outrank product-name words such as Oral Tablet or Vaginal Cream.
  const sublingual = /\b(?:SUBLINGUAL(?:LY)?|SL)\b/.test(upperProse);
  const oral = /\b(?:BY\s+MOUTH|ORALLY|PO)\b/.test(upperProse);
  if (sublingual && oral && !/\b(?:BY MOUTH|ORALLY|PO)\s+(?:OR|\/)\s*(?:SUBLINGUALLY|SL)\b|\bPO\/SL\b/.test(upperProse)) return manualResult('Conflicting Oral and Sublingual Routes');
  const solidRoute = sublingual ? oral ? 'PO/SL' : 'SL' : 'PO';

  if (/\b(?:VAGINALLY|PV)\b/.test(upperProse)) {
    const amount = upperProse.match(/^INSERT\s+(\d+(?:\.\d+)?)\s*(?:GRAMS?|GMS?|G)\b/);
    if (!amount || Number(amount[1]) <= 0 || oral || /\b(?:TOPICALLY|RECTALLY)\b/.test(upperProse)) return manualResult('Unverified Vaginal Dose or Route');
    return { doseToken: `INSERT ${Number(amount[1])}GM`, routeToken: 'PV', abnormalities, isApap, apapLimitToken };
  }
  if (/\bSUPPOSITOR(?:Y|IES)\b/.test(upperProse)) {
    const count = upperProse.match(/^(?:INSERT|GIVE|ADMINISTER)\s+(\d+)\s+SUPPOSITOR(?:Y|IES)\b/);
    if (!count || Number(count[1]) <= 0 || !/\b(?:RECTALLY|PR)\b/.test(upperProse) || oral) return manualResult('Unverified Suppository Dose or Route');
    const code = `${Number(count[1])}RS`;
    return { doseToken: SIG_CODE_REFERENCE[code] ? code : `INSERT ${count[1]} SUPPOSITORIES`,
      routeToken: SIG_CODE_REFERENCE[code] ? '' : 'PR', abnormalities, isApap, apapLimitToken };
  }
  if (/\bLOZENGES?\b/.test(upperProse)) {
    const count = upperProse.match(/^(?:GIVE|TAKE|DISSOLVE)\s+(\d+)\s+LOZENGES?\b/);
    if (!count || Number(count[1]) <= 0 || !oral) return manualResult('Unverified Lozenge Dose or Route');
    return { doseToken: count[1] === '1' ? '1LOZ' : `ADMINISTER ${count[1]} LOZENGES`, routeToken: 'PO', abnormalities, isApap, apapLimitToken };
  }

  const topicalAmount = upperProse.match(/\b(?:APPLY|AP)\s+(?:TO\s+)?(\d+(?:\.\d+)?)\s*(?:GMS?|GRAMS?|G)\b/);
  const siteProse = topicalAmount ? upperProse.slice(topicalAmount.index! + topicalAmount[0].length) : upperProse;
  const topicalSite = siteProse.match(/\bTO\s+(?:THE\s+)?([\s\S]+?)(?=\s+(?:TOPICALLY|TPCL|EVERY|EACH|DAILY|TWICE|THREE|FOUR|\d+\s+TIMES|BID|TID|QID|QD|FOR|AS\s+NEEDED)\b|[.;]|$)/);
  const siteToken = topicalSite ? `TO ${topicalSite[1].trim().replace(/\bLEFT\b/g, 'LT').replace(/\bRIGHT\b/g, 'RT')}` : undefined;

  // Existing institutional diclofenac 1% defaults remain visible as additions.
  // Explicit quantities always win; preserve the complete anatomical site.
  if (/\bDICLOFENAC\b/.test(upperDrug) && /\bGEL\b/.test(upperDrug) && /(?<![\d.])\b1\s*%/.test(upperDrug)) {
    if (/\b(?:BY\s+MOUTH|PO|ORALLY)\b/.test(upperProse)) return manualResult('Conflicting Topical Route');
    const site = siteToken || upperProse;
    const isLower = /\b(?:LEGS?|KNEES?|ANKLES?|FOOT|FEET)\b/.test(site);
    const isUpper = /\b(?:SHOULDERS?|ARMS?|HANDS?|WRISTS?|ELBOWS?|BACK)\b/.test(site);
    const inferredDose = isLower && !isUpper ? 'AP4GM' : 'AP 2GM';
    if (!topicalAmount) {
      abnormalities.push({ id: `abn_diclo_${Date.now()}`, tier: 'applied_correction', title: 'Diclofenac Dose Default Applied',
        message: 'The generated Sig CONTAINS A CORRECTION. Verify the added quantity before copying.',
        correction: `Added institutional dose default: ${inferredDose}`,
        trigger: siteToken || 'Unspecified anatomical site for topical application' });
    }
    if (!siteToken || /\b(?:NECK|EARS?|BACK|SHOULDERS?|LEGS?|ARMS?)\b/.test(site)
      || (!isLower && !isUpper) || (isLower && isUpper)) {
      abnormalities.push({ id: 'diclofenac_unverified_site', tier: 'potential_error', title: 'Diclofenac Site/Dose Requires Verification',
        message: `The application site is outside a single verified diclofenac dose category. Have the pharmacist verify the amount for each site. ${topicalAmount ? 'The source amount was kept.' : 'The institutional dose default is a proposal requiring review.'} No per-site amount was invented.`,
        trigger: siteToken || 'Missing application site' });
    }
    return { doseToken: topicalAmount ? (Number(topicalAmount[1]) === 4 ? 'AP4GM' : `AP ${topicalAmount[1]}GM`) : inferredDose, routeToken: 'TPCL', siteToken, abnormalities, isApap, apapLimitToken };
  }

  // Generic topical products keep application/site and never fall through to oral tablets.
  const isTopical = /\b(?:TOPICAL(?:LY)?|TPCL)\b/.test(upperProse) || /\b(?:SHAMPOO|CREAM|CRM|OINTMENT|OINT|LOTION|GEL)\b/.test(upperDrug);
  if (isTopical) {
    if (/\b(?:BY\s+MOUTH|PO|ORALLY)\b/.test(upperProse)) return manualResult('Conflicting Topical Route');
    if (!topicalAmount && /\b(?:SMALL AMOUNT|THIN LAYER|SPARINGLY|PEA[- ]SIZED|FINGERTIP)\b/.test(upperProse)) return manualResult('Topical Amount Retained');
    return { doseToken: topicalAmount ? `AP ${topicalAmount[1]}GM` : 'AP', routeToken: 'TPCL',
      siteToken, abnormalities, isApap, apapLimitToken };
  }

  // Unsupported explicit non-oral instructions must be retained, not forced into the oral fallback.
  if (/\b(?:INSTILL|INSERT|APPLY|DROPS?|OPHTHALMIC|OTIC|NASAL|RECTAL(?:LY)?|VAGINAL(?:LY)?|SUPPOSITORY)\b/.test(`${upperDrug} ${upperProse}`)) {
    return manualResult('Unsupported Non-oral Formulation');
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

  // Powder packets precede liquid detection so mixing volumes cannot become
  // an oral liquid dose. Explicit preparation remains intact for manual review.
  if (/\b(?:PACKETS?|PKT)\b/.test(`${upperDrug} ${upperProse}`)) {
    if (/\b(?:MIX(?:ED|ING)?|DISSOLV(?:E|ED|ING)|RECONSTITUT(?:E|ED|ION)|STIR(?:RED)?|WATER|JUICE|BEVERAGE|OZ|OUNCES?|ML|MILLILITERS?)\b/.test(fullProse)) return manualResult('Explicit Packet Preparation Requires Review');
    const countMatch = upperProse.match(/(?<![\d./-])(\d+|ONE|TWO|THREE)\s*(?:PACKETS?|PKT)\b/);
    const calculated = !countMatch ? quantityFromStrength(upperDrug, upperProse) : undefined;
    if ((!countMatch && (!calculated || !Number.isInteger(calculated.count))) || /\b\d+\s*(?:-|TO|\/)\s*\d+\s*PACKETS?\b/.test(upperProse) || !/\b(?:ORALLY|BY\s+MOUTH|PO)\b/.test(upperProse)) return manualResult('Unspecified Packet Dose or Route');
    const count = countMatch ? parseCountToken(countMatch[1]) : calculated!.count;
    if (count <= 0) return manualResult('Invalid Packet Dose');
    if (calculated) abnormalities.push({ id: 'packet_quantity_from_strength', tier: 'applied_correction', title: 'Packet Quantity Calculated',
      message: 'Packet quantity was calculated from the stated product strength and prescribed dose. Verify the product before copying.', correction: `${calculated.total} = ${count} packet(s)`, trigger: drugName });
    const isPeg17g = /\b(?:POLYETH\s+GLYC|POLYETHYLENE\s+GLYCOL|MIRALAX)\b/.test(upperDrug)
      && /\b17(?:\.0+)?\s*(?:GM|GRAMS?|G)\b/.test(upperDrug)
      && !/\b(?:ELECTROLYTES?|SODIUM|POTASSIUM|SULFATE|CHLORIDE|ASCORBIC|WITH|AND)\b|[-+/]/.test(upperDrug);
    return { doseToken: `${count}PKT`, routeToken: 'PO', abnormalities, isApap, apapLimitToken,
      preparationTemplate: isPeg17g && count === 1 ? 'MIX 17 GM (1 PACKET) IN 8OZ OF WATER AND GIVE PO' : undefined };
  }

  // Bulk powder quantities are mass, never a tablet count. Preserve source preparation.
  if (/\b(?:POWDER|PWD)\b/.test(upperDrug) || (/\b\d+(?:\.\d+)?\s*(?:GRAMS?|GMS?)\b/.test(upperProse)
      && !/\b(?:TABLETS?|TABS?|CAPSULES?|CAPS?)\b/.test(upperDrug))) {
    const amount = upperProse.match(/^(?:GIVE|TAKE|ADMINISTER)\s+(\d+(?:\.\d+)?)\s*(?:GRAMS?|GMS?|G)\b/);
    if (!amount || Number(amount[1]) <= 0 || !oral) return manualResult('Unverified Powder Dose or Route');
    if (/\b(?:MIX|DISSOLVE|STIR|WATER|JUICE|BEVERAGE|OZ|OUNCES?|ML)\b/.test(fullProse)) return manualResult('Explicit Powder Preparation Requires Review');
    const peg = /\b(?:GLYCOLAX|MIRALAX|POLYETH\s+GLYC|POLYETHYLENE\s+GLYCOL)\b/.test(upperDrug)
      && !/\b(?:ELECTROLYTES?|SODIUM|POTASSIUM|SULFATE|CHLORIDE|ASCORBIC|WITH|AND)\b|[-+/]/.test(upperDrug);
    return { doseToken: `ADM ${Number(amount[1])}GM`, routeToken: 'PO', abnormalities, isApap, apapLimitToken,
      preparationTemplate: peg && Number(amount[1]) === 17 ? 'MIX 17 GM (SEE INSIDE CAP) IN 8OZ OF WATER AND GIVE PO' : undefined };
  }

  // Oral liquid / syrup / elixir / solution / suspension
  const isLiquid = /\b(?:SYR(?:UP)?|SOLN|SOLUTION|ELIX(?:IR)?|LIQ(?:UID)?|SUSP(?:ENSION)?)\b/.test(upperDrug) ||
    /\b\d+(?:\.\d+)?\s*ML\b/i.test(upperProse) ||
    upperProse.includes('MILLILITER');

  if (isLiquid) {
    const mlMatch = upperProse.match(/(?<![\d./-])\b(\d+(?:\.\d+)?)\s*(?:ML|MILLILITERS?)\b/);
    if (!mlMatch || !/\b(?:BY\s+MOUTH|PO|ORALLY|ORAL)\b/.test(upperProse)) return manualResult('Unspecified Liquid Dose or Route');
    const vol = mlMatch ? parseFloat(mlMatch[1]) : 0;
    if (vol <= 0 || /\b\d+(?:\.\d+)?\s*(?:-|TO|OR)\s*\d+(?:\.\d+)?\s*ML\b/.test(upperProse)) return manualResult('Invalid or Variable Liquid Dose');
    const strengthMatch = upperDrug.match(/(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?\s*(MEQ|MG|GM|MCG)\s*\/\s*(\d+(?:\.\d+)?)?\s*ML/);

    const drugWithoutConc = upperDrug.replace(/\/\s*\d*(?:\.\d+)?\s*ML.*/, '');
    const isMultiIngredient = upperDrug.includes('-') || (upperDrug.match(/\//g) || []).length > 1 || drugWithoutConc.includes('/') || Boolean(strengthMatch?.[2]);

    const swishSwallow = /\bSWISH\s+AND\s+SWALLOW\b/.test(fullProse);
    const swishSpit = /\bSWISH\s+AND\s+SPIT\b/.test(fullProse);
    if (swishSwallow && swishSpit) return manualResult('Conflicting Oral Rinse Instructions');
    const action = swishSwallow ? 'SSW' : swishSpit ? 'SSP' : 'ADM';
    let doseToken = `${action} ${vol}ML`;
    if (strengthMatch && vol > 0 && !isMultiIngredient) {
      const concVal = parseFloat(strengthMatch[1]);
      const unit = strengthMatch[3];
      const concMl = parseFloat(strengthMatch[4] || '1');
      if (concVal <= 0 || concMl <= 0) return manualResult('Invalid Liquid Concentration');
      const calculatedDose = (vol * concVal) / concMl;
      const roundedDose = Number.isInteger(calculatedDose) ? calculatedDose.toString() : parseFloat(calculatedDose.toFixed(3)).toString();
      doseToken = `${action} ${vol}ML (${roundedDose}${unit})`;
      if (action === 'ADM' && vol === 0.5 && unit === 'MG' && calculatedDose === 1
          && SIG_CODE_REFERENCE.LOR1MG === 'ADMINISTER 0.5 ML (1 MG)') doseToken = 'LOR1MG';
    }
    if (!strengthMatch && /\bMAGNESIUM HYDROXIDE\b/.test(upperDrug)) abnormalities.push({
      id: 'missing_liquid_concentration', tier: 'uncorrected_gap', title: 'Liquid Concentration Missing',
      message: 'The prescribed mL dose was translated. Add or verify product strength to calculate mg; magnesium hydroxide concentrations differ.', trigger: drugName });

    return {
      doseToken,
      routeToken: 'PO',
      abnormalities,
      isApap,
      apapLimitToken
    };
  }

  // Oral solids (Tablets vs Capsules)
  const isCapsule = /\b(?:CAPS?|CAPSULES?)\b/.test(`${upperDrug} ${upperProse}`);
  const unitChar = isCapsule ? 'C' : 'T';
  const explicitSolid = /\b(?:TABLETS?|TABS?|CPLT|CAPLETS?|CAPS?|CAPSULES?)\b/.test(`${upperDrug} ${upperProse}`);
  if (!explicitSolid) return manualResult('Unrecognized Formulation');
  if (/\b\d+(?:\.\d+)?\s*(?:TO|OR|-)\s*\d+(?:\.\d+)?\s*(?:TABLETS?|TABS?|CAPSULES?|CAPS?)\b/.test(upperProse)) return manualResult('Dose Range Requires Review');

  if (/\b(?:TABLETS?|TABS?|CPLT|CAPLETS?|CAPS?|CAPSULES?)\b/.test(upperDrug)
      && /\b(?:GIVE|TAKE|ADMINISTER)\s+\d+(?:\.\d+)?\s*(?:MCG|MEQ|MG|GM|G)\b/.test(upperProse)) {
    const calculated = quantityFromStrength(upperDrug, upperProse);
    if (!calculated || (isCapsule && !Number.isInteger(calculated.count)) || (!Number.isInteger(calculated.count) && /\b(?:ER|DR|EC)\b/.test(upperDrug))) return manualResult('Unverified Oral Solid Quantity');
    abnormalities.push({ id: 'solid_quantity_from_strength', tier: 'applied_correction', title: 'Oral Solid Quantity Calculated',
      message: 'Dose quantity was calculated from the stated product strength. Verify the product and quantity before copying.', correction: `${calculated.total} = ${calculated.label}${unitChar}`, trigger: drugName });
    return { doseToken: `${calculated.label}${unitChar}${calculated.count === 1 ? '' : ` (${calculated.total})`}`, routeToken: solidRoute, abnormalities, isApap, apapLimitToken };
  }

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
          routeToken: solidRoute,
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
          routeToken: solidRoute,
          abnormalities,
          isApap,
          apapLimitToken
        };
      } else {
        multiplier = num / den;
      }
    }
    if (multiplier <= 0) return manualResult('Invalid Dose Quantity');
    const targetDoseStr = getTargetDose(multiplier);
    return {
      doseToken: `${label}${unitChar}${targetDoseStr}`,
      routeToken: solidRoute,
      abnormalities,
      isApap,
      apapLimitToken
    };
  }

  // 2. Decimals (e.g. 1.5, 0.5, 2.5)
  const decimalMatch = upperProse.match(/\b(\d+\.\d+)\s*(?:TABLETS?|TABS?|CAPSULES?|CAPS?)\b/);
  if (decimalMatch) {
    const decVal = parseFloat(decimalMatch[1]);
    if (decVal <= 0) return manualResult('Invalid Dose Quantity');
    const multiplier = decVal;
    const label = decVal === 0.5 ? '1/2' : decVal.toString();
    const targetDoseStr = getTargetDose(multiplier);
    return {
      doseToken: `${label}${unitChar}${targetDoseStr}`,
      routeToken: solidRoute,
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
        /\b(?:TAKE|GIVE|ADM(?:INISTER)?|INGEST)\s+(\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\b(?=\s*(?:BY\s+MOUTH|PO|ORALLY|SUBLINGUALLY|SL|DAILY|EVERY|Q\d+H|QD|BID|TID|QID|AT\s+BEDTIME)\b|$)/
      )
    : null;

  // Pattern C: Followed by oral route indicators (e.g. 2 PO, 2 BY MOUTH)
  const routeCountMatch = (!explicitCountMatch && !verbCountMatch)
    ? upperProse.match(
        /(?<![\d./])(\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\s*(?:PO|BY\s+MOUTH|ORALLY)\b/
      )
    : null;

  const countRaw = explicitCountMatch?.[1] || verbCountMatch?.[1] || routeCountMatch?.[1];
  if (!countRaw) return manualResult('Unspecified Dose Quantity');
  const count = parseCountToken(countRaw);
  if (count <= 0) return manualResult('Invalid Dose Quantity');

  if (count > 1) {
    const targetDoseStr = getTargetDose(count);
    return {
      doseToken: `${count}${unitChar}${targetDoseStr}`,
      routeToken: solidRoute,
      abnormalities,
      isApap,
      apapLimitToken,
    };
  }

  return {
    doseToken: `1${unitChar}`,
    routeToken: solidRoute,
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
