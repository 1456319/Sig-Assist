import { doseForSolidQuantity, doseForVolume, toMedicationUnit, volumeForDose } from './sigMath';

/**
 * A structured foundation for free-text SIG translation. Extraction, safety
 * validation, and rendering are deliberately independent stages.
 */
export type Route = 'PO' | 'PO/SL' | 'SL' | 'SQ' | 'TPCL' | 'TRANSDERMALLY';
export type Frequency = 'QD' | 'BID' | 'TID' | 'QID' | 'Q4H' | 'Q6H' | 'Q12H' | 'QHS' | 'QAM' | 'AC' | 'ACHS' | 'QPMDAY7';
export type DoseUnit = 'tablet' | 'capsule' | 'packet' | 'ml' | 'mg' | 'mcg' | 'gm' | 'unit' | 'patch';

export interface SigIssue { code: string; severity: 'warning' | 'blocking'; message: string; }
export interface Concentration { amount: number; unit: 'MG' | 'MCG' | 'GM' | 'UN'; volumeMl?: number; }
export interface Dose { quantity: number; unit: DoseUnit; calculatedAmount?: Concentration; }
export interface SlidingScaleBand { lower?: number; upper?: number; dose?: number; action?: string; }
export interface ParsedSigOrder {
  raw: string; normalized: string; drug: string; dose?: Dose; route?: Route; frequency?: Frequency;
  prn: boolean; durationDays?: number; indication?: string; slidingScale?: SlidingScaleBand[];
  hold?: { systolicBelow?: number; heartRateBelow?: number }; dateStripped: boolean; issues: SigIssue[];
}
export interface SigParseOptions { drug: string; defaultSig?: string; }

const wordNumbers: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', half: '0.5', once: '1', twice: '2', thrice: '3' };
const indications: Array<[RegExp, string]> = [
  [/\bgerd\b/i, 'FGERD'], [/\bconstipation\b/i, 'FCON'], [/\b(?:dm2|type 2 diabetes)\b/i, 'FDM2'], [/\bdiabetes\b|\bdm\b/i, 'FDM'],
  [/\bbph\b/i, 'FBPH'], [/\bhypothyroidism\b/i, 'FHYT'], [/\bhtn\b/i, 'FHTN'], [/\bcough\b/i, 'FCOU'], [/\bdvt prevention\b/i, 'FDVTP'],
  [/\bcellulitis\b/i, 'FCEL'], [/\banxiety|agitation\b/i, 'FAA'], [/\bshortness of breath\b/i, 'FSOB'], [/\bpain\b/i, 'FPAIN'],
];

export function normalizeSigText(raw: string): string {
  let result = raw.toLowerCase().replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [word, digit] of Object.entries(wordNumbers)) result = result.replace(new RegExp(`\\b${word}\\b`, 'g'), digit);
  return result;
}

function unit(value: string): Concentration['unit'] { return toMedicationUnit(value) ?? 'MG'; }
function drugStrength(drug: string): Concentration | undefined {
  const concentration = drug.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|gm|g|u)\s*\/\s*(\d+(?:\.\d+)?)\s*ml/i);
  if (concentration) return { amount: Number(concentration[1]), unit: unit(concentration[2]), volumeMl: Number(concentration[3]) };
  const strength = drug.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|gm|g)\b/i);
  return strength ? { amount: Number(strength[1]), unit: unit(strength[2]) } : undefined;
}
function parseDose(text: string, strength?: Concentration): Dose | undefined {
  const match = text.match(/(?:give|take|inject|apply|administer|adm)?\s*(\d+(?:\.\d+)?|\d+\/\d+)\s*(tablets?|capsules?|packets?|milliliters?|ml|mg|mcg|grams?|gm|units?|patch(?:es)?)/i);
  if (!match) return undefined;
  const quantity = match[1].includes('/') ? Number(match[1].split('/')[0]) / Number(match[1].split('/')[1]) : Number(match[1]);
  const label = match[2].toLowerCase();
  const doseUnit: DoseUnit = label.startsWith('tablet') ? 'tablet' : label.startsWith('capsule') ? 'capsule' : label.startsWith('packet') ? 'packet' : label.startsWith('mill') || label === 'ml' ? 'ml' : label === 'mg' ? 'mg' : label === 'mcg' ? 'mcg' : label.startsWith('gram') || label === 'gm' ? 'gm' : label.startsWith('unit') ? 'unit' : 'patch';
  const requestedUnit = doseUnit === 'mg' ? 'MG' : doseUnit === 'mcg' ? 'MCG' : doseUnit === 'gm' ? 'GM' : undefined;
  if (strength?.volumeMl && requestedUnit) {
    const concentration = { ...strength, volumeMl: strength.volumeMl };
    const volume = volumeForDose({ amount: quantity, unit: requestedUnit }, concentration);
    if (volume !== undefined) return { quantity: volume, unit: 'ml', calculatedAmount: { amount: quantity, unit: requestedUnit } };
  }
  const calculatedAmount = strength?.volumeMl && doseUnit === 'ml' ? doseForVolume(quantity, { ...strength, volumeMl: strength.volumeMl }) : strength && !strength.volumeMl && (doseUnit === 'tablet' || doseUnit === 'capsule') && quantity !== 1 ? doseForSolidQuantity(quantity, strength) : undefined;
  return { quantity, unit: doseUnit, calculatedAmount };
}
function route(text: string): Route | undefined {
  if (/(?:by mouth|oral).*(?:under the tongue|sublingual)|(?:under the tongue|sublingual).*(?:by mouth|oral)/.test(text)) return 'PO/SL';
  if (/under the tongue|sublingual/.test(text)) return 'SL'; if (/subcutaneously|subcutaneous/.test(text)) return 'SQ';
  if (/transdermally/.test(text)) return 'TRANSDERMALLY'; if (/topically/.test(text)) return 'TPCL'; if (/by mouth|oral/.test(text)) return 'PO';
  return undefined;
}
function frequency(text: string): Frequency | undefined {
  if (/before meals and at bedtime/.test(text)) return 'ACHS'; if (/before meals/.test(text)) return 'AC'; if (/every\s+(?:sun|sunday)/.test(text)) return 'QPMDAY7';
  if (/at bedtime/.test(text)) return 'QHS'; if (/every morning|in the morning/.test(text)) return 'QAM';
  return [[/\b(?:1 time|daily|once daily)\b/, 'QD'], [/\b(?:2 times|twice daily)\b/, 'BID'], [/\b(?:3 times|three times)\b/, 'TID'], [/\b(?:4 times|four times)\b/, 'QID'], [/every 4 hours/, 'Q4H'], [/every 6 hours/, 'Q6H'], [/every 12 hours/, 'Q12H']].find(([pattern]) => (pattern as RegExp).test(text))?.[1] as Frequency | undefined;
}
function scale(text: string): SlidingScaleBand[] | undefined {
  if (!/sliding scale/.test(text)) return undefined;
  const bands: SlidingScaleBand[] = [];
  for (const item of text.matchAll(/(\d+)\s*(?:-|to)\s*(\d+)\s*=\s*(\d+(?:\.\d+)?)\s*(?:u|un(?:its?)?|ml)?/gi)) bands.push({ lower: Number(item[1]), upper: Number(item[2]), dose: Number(item[3]) });
  for (const item of text.matchAll(/(?:<|less than)\s*(\d+)\s*(?:=)?\s*(follow hypoglycemic protocol|notify (?:md|doctor)|call (?:md|doctor))/gi)) bands.push({ upper: Number(item[1]) - 1, action: /hypoglycemic/.test(item[2]) ? 'HYPOGLYCEMIC PROTOCOL' : 'CALL MD' });
  for (const item of text.matchAll(/(?:>|greater than)\s*(\d+)\s*(?:=\s*(\d+(?:\.\d+)?)\s*(?:u|un(?:its?)?|ml)?|(notify (?:md|doctor)|call (?:md|doctor)))/gi)) bands.push({ lower: Number(item[1]) + 1, dose: item[2] ? Number(item[2]) : undefined, action: item[3] ? 'CALL MD' : undefined });
  return bands.length ? bands.sort((a, b) => (a.lower ?? -Infinity) - (b.lower ?? -Infinity)) : undefined;
}
function indication(text: string): string | undefined {
  const value = text.match(/(?:for|indications?:)\s+(.+?)(?:\s+for\s+\d+\s+days?|\s+until\s+\d|\s+hold\b|$)/i)?.[1]?.trim();
  return value ? indications.find(([matcher]) => matcher.test(value))?.[1] ?? `FOR ${value.toUpperCase()}` : undefined;
}
function validateScale(bands: SlidingScaleBand[], issues: SigIssue[]): void {
  const ranges = bands.filter((band) => band.lower !== undefined && band.upper !== undefined);
  for (let i = 0; i < ranges.length - 1; i += 1) if (ranges[i].upper! + 1 < ranges[i + 1].lower!) issues.push({ code: 'sliding-scale-gap', severity: 'blocking', message: `Sliding scale has no coverage for ${ranges[i].upper! + 1}-${ranges[i + 1].lower! - 1}.` });
}

export function parseSigOrder(raw: string, options: SigParseOptions): ParsedSigOrder {
  const dateStripped = /until\s+\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2})?/i.test(raw);
  const normalized = normalizeSigText(raw).replace(/until\s+\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2})?/i, '').trim();
  const issues: SigIssue[] = []; const slidingScale = scale(normalized);
  const order: ParsedSigOrder = { raw, normalized, drug: options.drug, dose: parseDose(normalized, drugStrength(options.drug)), route: route(normalized), frequency: frequency(normalized), prn: /as needed|\bprn\b/.test(normalized), durationDays: Number(normalized.match(/for\s+(\d+)\s+days?/)?.[1]) || undefined, indication: indication(normalized), slidingScale, dateStripped, issues };
  const hold = normalized.match(/hold\s+(?:if|for)\s+(?:sbp|systolic(?: blood pressure)?)\s+(?:less than|below)\s+(\d+).*?(?:heart rate|hr)\s+(?:less than|below)\s+(\d+)/i);
  if (hold) order.hold = { systolicBelow: Number(hold[1]), heartRateBelow: Number(hold[2]) };
  if (dateStripped) issues.push({ code: 'cut-date', severity: 'warning', message: 'A cut date was removed; verify it in the order date field.' });
  if (slidingScale) validateScale(slidingScale, issues); else { if (!order.dose) issues.push({ code: 'missing-dose', severity: 'blocking', message: 'Could not identify a dose.' }); if (!order.route) issues.push({ code: 'missing-route', severity: 'warning', message: 'Could not identify a route.' }); if (!order.frequency) issues.push({ code: 'missing-frequency', severity: 'warning', message: 'Could not identify a frequency.' }); }
  return order;
}
function number(value: number): string { return String(Number(value.toFixed(3))); }
function doseToken(dose: Dose, deliveryRoute?: Route): string {
  const quantity = dose.quantity === 0.5 && ['tablet', 'capsule'].includes(dose.unit) ? '1/2' : number(dose.quantity);
  const base: Record<DoseUnit, string> = { tablet: `${quantity}T`, capsule: `${quantity}C`, packet: `${quantity}PKT`, ml: `${deliveryRoute === 'SQ' ? 'INJ' : 'ADM'} ${quantity}ML`, mg: `INJ ${quantity}MG`, mcg: `INJ ${quantity}MCG`, gm: `ADM ${quantity}GM`, unit: `INJ ${quantity} UN`, patch: `${quantity}PA` };
  return dose.calculatedAmount ? `${base[dose.unit]} (${number(dose.calculatedAmount.amount)}${dose.calculatedAmount.unit})` : base[dose.unit];
}
export function renderSig(order: ParsedSigOrder): string {
  if (order.slidingScale) return `CBS ${order.frequency === 'ACHS' ? 'ACHS' : 'AC'} SS ${order.slidingScale.map((band) => band.lower === undefined ? `<${band.upper! + 1}=${band.action}` : band.upper === undefined ? `>${band.lower - 1}=${band.action ?? `${number(band.dose ?? 0)}U`}` : `${band.lower}-${band.upper}=${number(band.dose ?? 0)}U`).join(';')}`;
  const tokens: Array<string | undefined> = [order.dose && doseToken(order.dose, order.route), order.route, order.frequency, order.prn ? 'PRN' : undefined];
  if (order.prn) { tokens.push(order.indication); if (order.durationDays) tokens.push(`X${order.durationDays}D`); } else { if (order.durationDays) tokens.push(`X${order.durationDays}D`); tokens.push(order.indication); }
  if (order.hold) tokens.push(`HR${order.hold.heartRateBelow}SBP${order.hold.systolicBelow}`);
  return tokens.filter(Boolean).join(' ').toUpperCase();
}
export function translateFreeTextSig(raw: string, options: SigParseOptions): { order: ParsedSigOrder; sig: string } { const order = parseSigOrder(raw, options); return { order, sig: renderSig(order) }; }
