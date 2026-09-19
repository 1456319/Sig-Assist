import { InboundOrder, ClinicalSigResult, SubOrderResult, AbnormalityFinding, TechnicianPreferences } from './types';
import { calculateDoseAndVolume } from './doseCalculator';
import { resolveFrequencyAndSchedule, INDICATION_MAP, SORTED_INDICATION_KEYS } from './frequencyEngine';
import { evaluatePaxitPackaging } from './paxitEngine';

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

export function translateClinicalSig(inbound: InboundOrder, preferences?: TechnicianPreferences): ClinicalSigResult {
  const paxitEval = evaluatePaxitPackaging(inbound.drugName, inbound.rawProse);

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

    return {
      primarySig: subOrders[0].suggestedSig,
      subOrders,
      abnormalities: allAbnormalities
    };
  }

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

  return {
    primarySig: compiled.sig,
    subOrders: [{
      id: `${inbound.id}_single`,
      label: 'Order 1 of 1',
      suggestedSig: compiled.sig,
      abnormalities
    }],
    abnormalities
  };
}
