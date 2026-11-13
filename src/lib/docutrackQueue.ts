export interface EdcDocument {
  pon: string;
  documentNumber: string;
  numberSource: 'grid' | 'stamp';
  facility: string;
  resident: string;
  route: string;
}

export interface QueueCapture {
  headers: string[];
  rows: string[][];
  unreadable: number;
  exposedRowsOnly?: boolean;
}

export interface EdcSnapshot {
  source: 'desktop' | 'paste';
  capturedAt: number;
  documents: EdcDocument[];
  inspected: number;
  unresolved: number;
  exposedRowsOnly?: boolean;
}

const headerAliases = {
  type: ['document type', 'doc type', 'doc. type'],
  pon: ['text 3', 'custom field 3', 'e-prescriber order number', 'prescriber order number', 'pon'],
  documentNumber: ['document number', 'document #', 'document id', 'documentid', 'doc #', 'doc. #'],
  facility: ['facility id', 'facility'],
  source: ['source'],
  resident: ['text 4', 'custom field 4', 'resident name'],
  route: ['list 2', 'priority', 'route'],
  status: ['status'],
};

function cleanHeader(value: string) {
  return value.trim().toLowerCase().replace(/:$/, '').replace(/\s+/g, ' ');
}

function identifier(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value) && !value.includes('...') && !/^(?:PON|N\/A|UNKNOWN|NONE|NULL)$/i.test(value) ? value : '';
}

function documentId(value: string) {
  return /^\d+$/.test(value) ? value : '';
}

export function readQueueCapture(capture: QueueCapture, source: EdcSnapshot['source'], capturedAt = Date.now()): EdcSnapshot {
  const headers = capture.headers.map(cleanHeader);
  function column(key: keyof typeof headerAliases) {
    const indexes = headers.map((name, i) => headerAliases[key].includes(name) ? i : -1).filter(i => i >= 0);
    if (indexes.length > 1) throw new Error('Two columns identify the same field. Use one column per field.');
    return indexes[0] ?? -1;
  }
  const type = column('type'), pon = column('pon'), doc = column('documentNumber');
  const facility = column('facility'), sourceCol = column('source'), resident = column('resident'), route = column('route'), status = column('status');
  if (type < 0 || pon < 0) throw new Error('Show Document Type and Text 3 (PON) in the DocuTrack folder grid using Column Chooser.');
  const snapshot: EdcSnapshot = { source, capturedAt, inspected: capture.rows.length + capture.unreadable, unresolved: capture.unreadable, documents: [] };
  if (capture.exposedRowsOnly) snapshot.exposedRowsOnly = true;
  for (const row of capture.rows) {
    const value = (i: number) => row[i]?.trim() ?? '';
    const kind = value(type);
    if (!kind || /(?:\.\.\.|…)$/.test(kind) || (status >= 0 && (!value(status) || /(?:\.\.\.|…)$/.test(value(status))))) { snapshot.unresolved++; continue; }
    if (status >= 0 && value(status).toLowerCase() !== 'process') continue;
    if (!/^e-dc(?: order)?$/i.test(kind)) continue;
    const orderNumber = identifier(value(pon));
    if (!orderNumber) { snapshot.unresolved++; continue; }
    // A truncated source cannot identify a facility. The site source starts with its shortcode.
    const sourceFacility = /^([A-Z][A-Z0-9]+)\s+\S/.exec(value(sourceCol))?.[1];
    snapshot.documents.push({ pon: orderNumber, documentNumber: documentId(value(doc)), numberSource: 'grid', facility: value(facility) || sourceFacility || '', resident: value(resident), route: value(route) });
  }
  return snapshot;
}

export function readDocumentText(text: string): EdcDocument {
  const field = (label: string) => {
    const matches = [...text.matchAll(new RegExp('^[ \\t]*' + label + ':[ \\t]*([^\\r\\n]*)', 'gim'))];
    return matches.length === 1 ? matches[0][1].trim() : '';
  };
  if (!/^discontinue rx$/i.test(field('Order Type'))) throw new Error('The copied document must contain one Order Type field reading Discontinue Rx.');
  const pon = identifier(field('Prescriber Order Number'));
  if (!pon) throw new Error('Copy one document with a complete Prescriber Order Number.');
  const footers = [...new Set(Array.from(text.matchAll(/Original document\s*#\s*:\s*(\d+)(?=\s|$)/gi), m => m[1]))];
  if (footers.length > 1) throw new Error('Multiple original document numbers were found. Check the individual E-DC page.');
  return { pon, documentNumber: footers[0] ?? '', numberSource: 'stamp', facility: field('Facility Id'), resident: [field('Last Name'), field('First Name')].filter(Boolean).join(', '), route: '' };
}

export function readPastedQueue(text: string): EdcSnapshot {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) throw new Error('Paste folder rows with column headings or the text of one E-DC document.');
  if (lines.some(line => /^\s*Order Type:/i.test(line)) || !lines[0].includes('\t')) {
    return { source: 'paste', capturedAt: Date.now(), inspected: 1, unresolved: 0, documents: [readDocumentText(text)] };
  }
  const [headers, ...rows] = lines.map(line => line.split('\t'));
  if (!rows.length || rows.some(row => row.length !== headers.length)) throw new Error('Include the complete tab-separated header and rows. Check for wrapped or missing cells.');
  return readQueueCapture({ headers, rows, unreadable: 0 }, 'paste');
}

export function edcMatch(documents: EdcDocument[], order: { pon: string; facility?: string }, knownOrders: { pon: string; facility: string; patientRef: string }[]) {
  const matches = documents.filter(doc => doc.pon === order.pon.trim());
  if (!matches.length) return;
  const facility = order.facility?.trim().toUpperCase();
  const candidates = matches.filter(doc => !facility || !doc.facility || doc.facility.toUpperCase() === facility);
  // A PON can be reused across facilities/residents. Do not choose among them.
  const candidateFacility = candidates.length === 1 ? candidates[0].facility.trim().toUpperCase() : '';
  const orders = knownOrders.filter(item => item.pon === order.pon && (!facility || !candidateFacility || item.facility.trim().toUpperCase() === candidateFacility));
  const unique = candidates.length === 1 && orders.length <= 1 && (matches.length === 1 || Boolean(facility && candidates[0].facility));
  return { candidates: unique ? candidates : matches, unique };
}
