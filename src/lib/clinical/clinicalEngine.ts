import { InboundOrder, ClinicalSigResult, SubOrderResult, AbnormalityFinding, TechnicianPreferences } from './types';
import { calculateDoseAndVolume } from './doseCalculator';
import { resolveFrequencyAndSchedule } from './frequencyEngine';
import { evaluatePaxitPackaging } from './paxitEngine';

function assembleSig(
  drugName: string,
  rawProse: string,
  defaultTemplate?: string,
  preferences?: TechnicianPreferences
): { sig: string; abnormalities: AbnormalityFinding[] } {
  const doseRes = calculateDoseAndVolume(drugName, rawProse);
  const freqRes = resolveFrequencyAndSchedule(rawProse, defaultTemplate);
  const allAbnormalities = [...doseRes.abnormalities, ...freqRes.abnormalities];

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
    return { sig: freqRes.blendedTemplate, abnormalities: allAbnormalities };
  }

  const parts: string[] = [];
  parts.push(effectiveDoseToken);
  if (doseRes.routeToken && !effectiveDoseToken.includes('TRANSDERMALLY') && !effectiveDoseToken.includes('TPCL')) {
    parts.push(doseRes.routeToken);
  }

  parts.push(freqRes.frequencyToken);

  if (freqRes.prnToken) {
    parts.push(freqRes.prnToken);
    if (freqRes.indicationToken) parts.push(freqRes.indicationToken);
    if (freqRes.durationToken) parts.push(freqRes.durationToken);
  } else {
    if (freqRes.durationToken) parts.push(freqRes.durationToken);
    if (freqRes.indicationToken) parts.push(freqRes.indicationToken);
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
      const compiled = assembleSig(inbound.drugName, part.prose, undefined, preferences);
      subOrders.push({
        id: `${inbound.id}_split_${index + 1}`,
        label: part.label,
        suggestedSig: compiled.sig,
        abnormalities: compiled.abnormalities
      });
      allAbnormalities.push(...compiled.abnormalities);
    });

    return {
      primarySig: subOrders[0].suggestedSig,
      subOrders,
      abnormalities: allAbnormalities
    };
  }

  const compiled = assembleSig(inbound.drugName, inbound.rawProse, inbound.defaultSigTemplate, preferences);

  return {
    primarySig: compiled.sig,
    subOrders: [{
      id: `${inbound.id}_single`,
      label: 'Order 1 of 1',
      suggestedSig: compiled.sig,
      abnormalities: compiled.abnormalities
    }],
    abnormalities: compiled.abnormalities
  };
}
