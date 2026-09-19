import { InboundOrder, ClinicalSigResult, SubOrderResult, AbnormalityFinding, TechnicianPreferences } from './types';
import { calculateDoseAndVolume } from './doseCalculator';
import { resolveFrequencyAndSchedule, INDICATION_MAP, SORTED_INDICATION_KEYS } from './frequencyEngine';
import { evaluatePaxitPackaging } from './paxitEngine';
import { traceLogger } from '../diagnostics/traceLogger';

function resolveIndicationToken(fallbackIndication?: string): string | undefined {
  if (!fallbackIndication) return undefined;
  const upper = fallbackIndication.trim().toUpperCase();
  for (const key of SORTED_INDICATION_KEYS) {
    if (new RegExp(`\\b${key}\\b`, 'i').test(upper)) {
      return INDICATION_MAP[key];
    }
  }
  if (upper.startsWith('FOR ') || upper.startsWith('F')) {
    return upper;
  }
  return `F${upper}`;
}

function assembleSig(
  drugName: string,
  rawProse: string,
  defaultTemplate?: string,
  preferences?: TechnicianPreferences,
  fallbackIndication?: string
): { sig: string; abnormalities: AbnormalityFinding[] } {
  const doseRes = calculateDoseAndVolume(drugName, rawProse);
  const freqRes = resolveFrequencyAndSchedule(rawProse, defaultTemplate);
  const allAbnormalities = [...doseRes.abnormalities, ...freqRes.abnormalities];

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
    return { sig: freqRes.slidingScaleString, abnormalities: allAbnormalities };
  }

  if (freqRes.blendedTemplate) {
    let blended = freqRes.blendedTemplate;
    if (indicationToken && !freqRes.indicationToken) {
      blended = `${blended} ${indicationToken}`;
    }
    return { sig: blended, abnormalities: allAbnormalities };
  }

  const parts: string[] = [];
  parts.push(effectiveDoseToken);
  if (doseRes.routeToken && !effectiveDoseToken.includes('TRANSDERMALLY') && !effectiveDoseToken.includes('TPCL')) {
    parts.push(doseRes.routeToken);
  }

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

  if (doseRes.apapLimitToken) {
    parts.push(doseRes.apapLimitToken);
  }

  const cleanSig = parts.join(' ').replace(/\s+/g, ' ').trim().toUpperCase();
  return { sig: cleanSig, abnormalities: allAbnormalities };
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
      .trim();
    if (!isTitration) {
      cleaned = cleaned.replace(/\s+(?:X\d+D|FOR\s+\d+\s+DAYS?)$/i, '').trim();
    }
  }
  return cleaned;
}

export function translateClinicalSig(inbound: InboundOrder, preferences?: TechnicianPreferences): ClinicalSigResult {
  const traceId = inbound.traceId || traceLogger.getActiveTraceId();
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
    traceLogger.setActiveTraceId(prevTraceId);
  }
}
