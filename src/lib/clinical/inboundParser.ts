import { InboundOrder } from './types';

function unescapeXml(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|apos);/g, (_, entity) => {
    switch (entity) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
      default:
        return _;
    }
  });
}

function normalizeCharacters(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u00A0/g, ' ');
}

function extractXmlTag(xml: string, tagName: string): string | undefined {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? normalizeCharacters(unescapeXml(match[1].trim())) : undefined;
}

export function parseInboundOrder(rawInput: string): InboundOrder {
  const normalized = normalizeCharacters(rawInput);
  const trimmed = normalized.trim();
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
