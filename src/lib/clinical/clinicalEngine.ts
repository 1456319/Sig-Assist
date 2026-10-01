import { InboundOrder, ClinicalSigResult, SubOrderResult, AbnormalityFinding, TechnicianPreferences } from './types';
import { calculateDoseAndVolume } from './doseCalculator';
import { resolveFrequencyAndSchedule } from './frequencyEngine';
import { resolveIndicationToken } from './indicationEngine';
import { evaluatePaxitPackaging } from './paxitEngine';
import { traceLogger } from '../diagnostics/traceLogger';
import { splitSupplementalDirections, uppercaseDirections } from './instructionClauses';

function assembleSig(
  drugName: string,
  rawProse: string,
  defaultTemplate?: string,
  preferences?: TechnicianPreferences,
  fallbackIndication?: string
): { sig: string; abnormalities: AbnormalityFinding[] } {
  const clauses = splitSupplementalDirections(rawProse);
  const doseRes = calculateDoseAndVolume(drugName, rawProse);
  const preparationTemplate = defaultTemplate?.trim() || doseRes.preparationTemplate;
  const freqRes = resolveFrequencyAndSchedule(clauses.primary, preparationTemplate);
  const allAbnormalities = [...doseRes.abnormalities, ...freqRes.abnormalities];

  if (/\b(?:PANTOPRAZOLE|PROTONIX)\b/i.test(drugName) && /\bDISSOLVE\b/i.test(preparationTemplate || '')) {
    allAbnormalities.push({ id: 'pantoprazole_preparation_wording', tier: 'potential_error', title: 'Pantoprazole Preparation Requires Review',
      message: 'The provided template says DISSOLVE. Product labeling states that the granules do not dissolve; verify the preparation wording with the pharmacist.', trigger: preparationTemplate });
  }

  if (!defaultTemplate?.trim() && doseRes.preparationTemplate) {
    allAbnormalities.push({ id: 'peg_packet_preparation', tier: 'applied_correction', title: 'PEG Packet Preparation Added',
      message: 'Preparation instructions were added from the PEG 17 g packet template. Verify the product and Framework Preview Sig before copying.',
      correction: doseRes.preparationTemplate,
      trigger: 'Recognized one-packet PEG 17 g oral dose; no source mixing instructions. Institutional 8 oz water template; PEG 3350 packet labeling permits 4–8 oz beverage.' });
  }

  if (!freqRes.slidingScaleString && (doseRes.requiresManualTranslation || freqRes.requiresManualTranslation || !doseRes.doseToken || (!freqRes.frequencyToken && !freqRes.blendedTemplate && !freqRes.prnToken))) {
    return { sig: uppercaseDirections(rawProse), abnormalities: allAbnormalities };
  }

  const finish = (sig: string) => {
    if (clauses.supplemental) {
      const repeat = clauses.supplemental.toUpperCase().trim();
      const simpleEyeRepeat = /^(?:APPLY|INSTILL)\s+(?:\d+|ONE|TWO)\s+DROPS?\s+(?:(?:EVERY MORNING|IN THE MORNING|DAILY)\s+(?:IN|TO)\s+(?:THE\s+)?(?:LEFT|RIGHT|BOTH|EACH)\s+EYES?|(?:IN|TO)\s+(?:THE\s+)?(?:LEFT|RIGHT|BOTH|EACH)\s+EYES?\s+(?:EVERY MORNING|IN THE MORNING|DAILY))[.;]?$/;
      if (simpleEyeRepeat.test(repeat)) {
        const repeatDose = calculateDoseAndVolume(drugName, repeat);
        const repeatFrequency = resolveFrequencyAndSchedule(repeat);
        if (repeatDose.doseToken === doseRes.doseToken && repeatDose.routeToken === doseRes.routeToken
            && repeatFrequency.frequencyToken === freqRes.frequencyToken && !freqRes.prnToken && !freqRes.durationToken && !freqRes.holdToken) {
          allAbnormalities.push({ id: 'duplicate_eye_direction', tier: 'applied_correction', title: 'Duplicate Direction Removed',
            message: 'An identical repeated eye dose, route and schedule was omitted. The original directions remain available for review.', trigger: clauses.supplemental });
          return sig;
        }
      }
      allAbnormalities.push({ id: 'retained_supplemental_instructions', tier: 'uncorrected_gap',
        title: 'Additional Instructions Require Review',
        message: 'Additional instructions were retained verbatim after the translated tokens. Verify every clause and Framework Preview Sig before copying.',
        trigger: clauses.supplemental });
      return `${sig.replace(/[.;]+$/, '')}. ${uppercaseDirections(clauses.supplemental)}`;
    }
    return sig;
  };

  // Resolve indication token: prefer inline indication from prose, fallback to inbound.indication from NCPDP XML
  const indicationToken = freqRes.indicationToken || resolveIndicationToken(fallbackIndication);

  // Check technician preference override
  let effectiveDoseToken = doseRes.doseToken;
  if (preferences?.drugCodeOverrides) {
    const upperDrug = drugName.toUpperCase();
    for (const [key, overrideCode] of Object.entries(preferences.drugCodeOverrides)) {
      if (upperDrug.includes(key.toUpperCase())) {
        effectiveDoseToken = overrideCode;
        break;
      }
    }
  }

  if (freqRes.slidingScaleString) {
    return { sig: finish(freqRes.slidingScaleString), abnormalities: allAbnormalities };
  }

  if (freqRes.blendedTemplate) {
    let blended = freqRes.blendedTemplate;
    if (indicationToken && !freqRes.indicationToken) {
      blended = `${blended} ${indicationToken}`;
    }
    return { sig: finish(blended), abnormalities: allAbnormalities };
  }

  const parts: string[] = [];
  parts.push(effectiveDoseToken);
  if (doseRes.routeToken && !effectiveDoseToken.includes('TRANSDERMALLY') && !effectiveDoseToken.includes('TPCL')) {
    parts.push(doseRes.routeToken);
  }
  if (doseRes.siteToken) parts.push(doseRes.siteToken);

  parts.push(freqRes.frequencyToken);

  if (freqRes.prnToken) {
    parts.push(freqRes.prnToken);
    if (indicationToken) parts.push(indicationToken);
    if (freqRes.durationToken) parts.push(freqRes.durationToken);
  } else {
    if (freqRes.durationToken) parts.push(freqRes.durationToken);
    if (indicationToken) parts.push(indicationToken);
  }

  if (freqRes.holdToken) {
    parts.push(freqRes.holdToken);
  }

  if (freqRes.stopToken) {
    parts.push(freqRes.stopToken);
  }

  if (doseRes.apapLimitToken) {
    parts.push(doseRes.apapLimitToken);
  }

  const cleanSig = parts.join(' ').replace(/\s+/g, ' ').trim().toUpperCase();
  return { sig: finish(cleanSig), abnormalities: allAbnormalities };
}

function cleanFirstClause(sig: string, isTitration: boolean): string {
  let cleaned = sig;
  let prev = '';
  while (cleaned !== prev) {
    prev = cleaned;
    cleaned = cleaned
      .replace(/\s+(?:3GME?|3GM)$/i, '')
      .replace(/\s+(?:F[A-Z0-9]+|FOR\s+[\s\S]+)$/i, '')
      .replace(/\s+PRN\b.*$/i, '')
      .replace(/\s+(?:SBP100|HR60SBP100|\(H\b[^)]+\)|\(HOLD\b[^)]+\)|HOLD\b.*)$/i, '')
      .trim();
    if (!isTitration) {
      cleaned = cleaned.replace(/\s+(?:X\d+(?:D|WK|W|M|H)|FOR\s+\d+\s+(?:DAYS?|WEEKS?|MONTHS?|HOURS?))$/i, '').trim();
    }
  }
  return cleaned;
}

export function translateClinicalSig(inbound: InboundOrder, preferences?: TechnicianPreferences): ClinicalSigResult {
  const traceId =
    inbound.traceId ||
    (inbound.id ? `TRC_${inbound.id}` : undefined) ||
    (inbound.pon && inbound.pon !== 'UNKNOWN_PON' && inbound.pon !== 'MANUAL_ENTRY' ? `TRC_${inbound.pon}` : undefined) ||
    traceLogger.generateTraceId('TRC');
  const prevTraceId = traceLogger.getActiveTraceId();
  traceLogger.setActiveTraceId(traceId);

  try {
    traceLogger.info('clinical', 'clinicalEngine', 'Translating clinical Sig for inbound order', {
      id: inbound.id,
      pon: inbound.pon,
      drugName: inbound.drugName,
      rawProseLength: inbound.rawProse.length
    }, undefined, traceId);

    const paxitEval = evaluatePaxitPackaging(inbound.drugName, inbound.rawProse);

    // Case A: Controlled substance with differential dosing or titration -> Compound SIG on single order
    if (paxitEval.isControlled && paxitEval.splitParts.length > 0) {
      const isTitration = paxitEval.splitParts.some(p => p.prose.toLowerCase().includes('then')) || inbound.rawProse.toLowerCase().includes('then');
      const part1 = assembleSig(inbound.drugName, paxitEval.splitParts[0].prose, undefined, preferences, inbound.indication);
      const part2 = assembleSig(inbound.drugName, paxitEval.splitParts[1].prose, undefined, preferences, inbound.indication);
      const part1Clean = cleanFirstClause(part1.sig, isTitration);
      const joiner = isTitration ? ' THEN ' : ' AND ';
      const compoundSig = `${part1Clean}${joiner}${part2.sig}`;

      const allAbnormalities: AbnormalityFinding[] = [
        ...part1.abnormalities,
        ...part2.abnormalities,
        {
          id: `controlled_substance_single_order_${inbound.id}`,
          tier: 'applied_correction',
          title: 'Controlled Substance — Single Order Required',
          message: 'The generated Sig CONTAINS A PACKAGING & ORDER RESTRICTION.',
          correction: 'Controlled substances cannot be split into multiple orders in FrameworkLTC. Regimen formatted as a compound SIG on a single order line. If quantity exceeds card capacity (60 count), FrameworkLTC will generate multiple labels/cards for this single order.',
          trigger: 'Controlled substance (CII-CV) single order regulatory and packaging constraint'
        }
      ];

      traceLogger.info('clinical', 'clinicalEngine', 'Formulated compound SIG for controlled substance', {
        primarySig: compoundSig,
        subOrdersCount: 1,
        abnormalitiesCount: allAbnormalities.length
      }, undefined, traceId);

      return {
        primarySig: compoundSig,
        subOrders: [{
          id: `${inbound.id}_single`,
          label: 'Order 1 of 1',
          suggestedSig: compoundSig,
          abnormalities: allAbnormalities
        }],
        abnormalities: allAbnormalities,
        traceId
      };
    }

    // Case B: Non-controlled Paxit oral solid requiring multi-order split
    if (paxitEval.requiresSplit && paxitEval.splitParts.length > 0) {
      const subOrders: SubOrderResult[] = [];
      const allAbnormalities: AbnormalityFinding[] = [];

      paxitEval.splitParts.forEach((part, index) => {
        const compiled = assembleSig(inbound.drugName, part.prose, undefined, preferences, inbound.indication);
        subOrders.push({
          id: `${inbound.id}_split_${index + 1}`,
          label: part.label,
          suggestedSig: compiled.sig,
          abnormalities: compiled.abnormalities
        });
        allAbnormalities.push(...compiled.abnormalities);
      });

      allAbnormalities.push({
        id: `paxit_split_req_${inbound.id}`,
        tier: 'applied_correction',
        title: 'Paxit Multi-Order Split Required',
        message: 'The generated Sig CONTAINS A CORRECTION.',
        correction: 'Paxit oral solid packaging cannot accept split SIGs on a single order. Separated into independent orders for FrameworkLTC entry.',
        trigger: 'Paxit oral solid differential daily dosing / titration constraint'
      });

      const isTitration = paxitEval.splitParts.some(p => p.prose.toLowerCase().includes('then')) || inbound.rawProse.toLowerCase().includes('then');
      const firstWithoutInd = cleanFirstClause(subOrders[0].suggestedSig, isTitration);
      const joiner = isTitration ? ' THEN ' : ' AND ';
      const unifiedSig = subOrders.length >= 2 ? `${firstWithoutInd}${joiner}${subOrders[1].suggestedSig}` : subOrders[0].suggestedSig;

      traceLogger.info('clinical', 'clinicalEngine', 'Formulated split sub-orders for Paxit oral solid', {
        primarySig: unifiedSig,
        subOrdersCount: subOrders.length,
        abnormalitiesCount: allAbnormalities.length
      }, undefined, traceId);

      return {
        primarySig: unifiedSig,
        subOrders,
        abnormalities: allAbnormalities,
        traceId
      };
    }

    // Case C: Standard single order (including non-split controlled substances)
    const compiled = assembleSig(inbound.drugName, inbound.rawProse, inbound.defaultSigTemplate, preferences, inbound.indication);
    const abnormalities = [...compiled.abnormalities];

    if (paxitEval.isControlled) {
      abnormalities.push({
        id: `controlled_substance_single_order_${inbound.id}`,
        tier: 'applied_correction',
        title: 'Controlled Substance — Single Order Required',
        message: 'The generated Sig CONTAINS A PACKAGING & ORDER RESTRICTION.',
        correction: 'Controlled substances cannot be split into multiple orders in FrameworkLTC. If quantity exceeds card capacity (60 count), FrameworkLTC will generate multiple labels/cards for this single order.',
        trigger: 'Controlled substance (CII-CV) single order regulatory and packaging constraint'
      });
    }

    traceLogger.info('clinical', 'clinicalEngine', 'Formulated standard single order clinical SIG', {
      primarySig: compiled.sig,
      abnormalitiesCount: abnormalities.length
    }, undefined, traceId);

    return {
      primarySig: compiled.sig,
      subOrders: [{
        id: `${inbound.id}_single`,
        label: 'Order 1 of 1',
        suggestedSig: compiled.sig,
        abnormalities
      }],
      abnormalities,
      traceId
    };
  } finally {
    traceLogger.setActiveTraceId(prevTraceId === 'GLOBAL' ? null : prevTraceId);
  }
}

const clinicalSigCache = new Map<string, ClinicalSigResult>();

export function getCachedClinicalSig(inbound: InboundOrder, preferences?: TechnicianPreferences): ClinicalSigResult {
  const key = JSON.stringify([inbound, preferences]);
  const cached = clinicalSigCache.get(key);
  if (cached) {
    return cached;
  }
  const result = translateClinicalSig(inbound, preferences);
  if (clinicalSigCache.size >= 500) clinicalSigCache.delete(clinicalSigCache.keys().next().value!);
  clinicalSigCache.set(key, result);
  return result;
}

export function clearClinicalSigCache(): void {
  clinicalSigCache.clear();
}
