import { InboundOrder } from './types';

function extractXmlTag(xml: string, tagName: string): string | undefined {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : undefined;
}

export function parseInboundOrder(rawInput: string): InboundOrder {
  const trimmed = rawInput.trim();
  const id = `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  if (trimmed.startsWith('<') && trimmed.includes('</')) {
    const pon = extractXmlTag(trimmed, 'PrescriberOrderNumber') ||
                extractXmlTag(trimmed, 'PON') ||
                extractXmlTag(trimmed, 'OrderNumber') || 'UNKNOWN_PON';
    const drugName = extractXmlTag(trimmed, 'DrugDescription') ||
                     extractXmlTag(trimmed, 'DrugName') || 'UNKNOWN DRUG';
    const rawProse = extractXmlTag(trimmed, 'SigText') ||
                     extractXmlTag(trimmed, 'Directions') || '';
    const indication = extractXmlTag(trimmed, 'IndicationClarifyingFreeText') ||
                       extractXmlTag(trimmed, 'Indication');

    return {
      id,
      pon,
      drugName,
      rawProse,
      indication,
      sourceFormat: 'ncpdp_xml'
    };
  }

  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
  let drugName = 'UNKNOWN DRUG';
  let rawProse = '';
  let defaultSigTemplate: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const userEntryMatch = line.match(/^USER ENTRY:\s*(.+)$/i);
    const defaultSigMatch = line.match(/^DEFAULT SIG(?:\s*\(OPTIONAL FIELD\))?:\s*(.+)$/i);

    if (userEntryMatch) {
      rawProse = userEntryMatch[1].trim();
    } else if (defaultSigMatch) {
      defaultSigTemplate = defaultSigMatch[1].trim();
    } else if (i === 0) {
      drugName = line.replace(/^\d+\)\s*/, '').trim();
    }
  }

  if (!rawProse && lines.length > 0) {
    rawProse = lines[lines.length - 1];
  }

  return {
    id,
    pon: 'MANUAL_ENTRY',
    drugName,
    rawProse,
    defaultSigTemplate,
    sourceFormat: 'manual_text'
  };
}
