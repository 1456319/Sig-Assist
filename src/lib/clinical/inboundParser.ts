import { InboundOrder } from './types';
import { traceLogger } from '../diagnostics/traceLogger';

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
  const traceId = traceLogger.generateTraceId('ORD');

  traceLogger.debug('intake', 'inboundParser', 'Beginning order intake parsing', {
    rawLength: rawInput.length,
    isXmlCandidate: trimmed.startsWith('<') && trimmed.includes('</')
  }, traceId);

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

    traceLogger.info('intake', 'inboundParser', 'Parsed NCPDP XML inbound payload', {
      pon,
      drugName,
      hasIndication: Boolean(indication),
      rawProseLength: rawProse.length
    }, undefined, traceId);

    return {
      id,
      pon,
      drugName,
      rawProse,
      indication,
      sourceFormat: 'ncpdp_xml',
      traceId
    };
  }

  const isHl7Candidate = trimmed.startsWith('MSH|') || /^MSH\|/m.test(trimmed);
  if (isHl7Candidate) {
    const hl7Lines = trimmed.split(/\r\n|\r|\n/).map(l => l.trim()).filter(Boolean);
    let pon = 'UNKNOWN_PON';
    let drugName = 'UNKNOWN DRUG';
    let rawProse = '';

    const orcLine = hl7Lines.find(l => l.startsWith('ORC|'));
    if (orcLine) {
      const parts = orcLine.split('|');
      pon = parts[2]?.trim() || parts[3]?.trim() || 'UNKNOWN_PON';
    }

    const rxoLine = hl7Lines.find(l => l.startsWith('RXO|'));
    if (rxoLine) {
      const parts = rxoLine.split('|');
      if (parts[1]) {
        const drugField = parts[1].trim();
        drugName = drugField.includes('^') ? (drugField.split('^')[1] || drugField.split('^')[0]).trim() : drugField;
      }
      rawProse = parts[6]?.trim() || parts[7]?.trim() || parts[24]?.trim() || '';
    }

    if (!rawProse) {
      const rxeLine = hl7Lines.find(l => l.startsWith('RXE|'));
      if (rxeLine) {
        const parts = rxeLine.split('|');
        rawProse = parts[7]?.trim() || '';
      }
    }

    traceLogger.info('intake', 'inboundParser', 'Parsed HL7 inbound payload', {
      pon,
      drugName,
      rawProseLength: rawProse.length
    }, undefined, traceId);

    return {
      id,
      pon,
      drugName,
      rawProse,
      sourceFormat: 'hl7',
      traceId
    };
  }

  const lines = trimmed.split(/\r\n|\r|\n/).map(l => l.trim()).filter(Boolean);
  let drugName = 'UNKNOWN DRUG';
  let rawProse = '';
  let defaultSigTemplate: string | undefined;
  let hasUserEntry = false;
  const remainingLines: string[] = [];

  const isDirectionProse = (text: string): boolean => {
    const upper = text.trim().toUpperCase();
    return /^(?:TAKE|GIVE|INJECT|INHALE|APPLY|INSTILL|USE|INSERT|PLACE|CHEW|SWALLOW|DISSOLVE|ADM|ADMINISTER|1|2|3|4|5|0\.\d+|\d+\/\d+|HALF)\b/i.test(upper);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const userEntryMatch = line.match(/^USER ENTRY:\s*(.*)$/i);
    const defaultSigMatch = line.match(/^DEFAULT SIG(?:\s*\(OPTIONAL FIELD\))?:\s*(.*)$/i);

    if (userEntryMatch) {
      hasUserEntry = true;
      rawProse = userEntryMatch[1].trim();
    } else if (defaultSigMatch) {
      defaultSigTemplate = defaultSigMatch[1].trim();
    } else if (i === 0) {
      if (isDirectionProse(line)) {
        remainingLines.push(line);
      } else {
        drugName = line.replace(/^\d+\)\s*/, '').trim();
      }
    } else {
      remainingLines.push(line);
    }
  }

  if (!hasUserEntry && !rawProse) {
    if (remainingLines.length > 0) {
      rawProse = remainingLines.join(' ').trim();
    } else if (lines.length === 1) {
      rawProse = lines[0].trim();
    }
  } else if (remainingLines.length > 0) {
    rawProse = `${rawProse} ${remainingLines.join(' ')}`.trim();
  }

  traceLogger.info('intake', 'inboundParser', 'Parsed manual text order', {
    drugName,
    rawProse,
    hasDefaultTemplate: Boolean(defaultSigTemplate),
    lineCount: lines.length
  }, undefined, traceId);

  return {
    id,
    pon: 'MANUAL_ENTRY',
    drugName,
    rawProse,
    defaultSigTemplate,
    sourceFormat: 'manual_text',
    traceId
  };
}
