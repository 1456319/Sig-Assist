/**
 * Read-only parser for the Framework eRx Queue Dashboard SSRS CSV export.
 * A queue row is NOT an electronic disposition. No network or persistence.
 * PHI fields may appear in the source CSV; never export rows in diagnostics.
 */
export interface ErxQueueRow {
  folder: string;
  messageType: string;
  priority: string;
  facility: string;
  pon: string;
  patient: string;
  medication: string;
  deaClass: string;
  enteredAtText: string;
}

export interface ErxQueueCsvSnapshot {
  source: 'ssrs-csv-import';
  importedAt: number;
  /** Original report generation time is NOT provided in this export. */
  reportGeneratedAt: null;
  /** Whether the exported rows agree with SSRS's declared total. */
  structurallyComplete: boolean;
  /** Does not claim that any report filters cover all possible orders. */
  coverageVerified: false;
  reportedTotal?: number;
  placeholderRows: number;
  rows: ErxQueueRow[];
  warnings: string[];
}

export type ErxQueueMatch =
  | { kind: 'not-in-snapshot'; candidates: [] }
  | { kind: 'facility-unknown' | 'facility-conflict' | 'ambiguous'; candidates: ErxQueueRow[] }
  | { kind: 'located'; candidates: [ErxQueueRow]; reviewHold: boolean; pharmacistReviewRequired: boolean };

const COLUMNS = [
  'Descr1', 'CC1', 'EntryDt1', 'MsgType1', 'Priority1', 'FacID',
  'Patient1', 'PrescriberOrderNumber', 'Physician1', 'DEAClass',
  'Drug', 'Directions', 'Sendername', 'CC2',
] as const;

function csvCells(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closedQuote = true; }
      } else { field += ch; }
      continue;
    }
    if (ch === '"' && field === '' && !closedQuote) {
      quoted = true;
    } else if (ch === ',') {
      row.push(field); field = ''; closedQuote = false;
    } else if (ch === '\r' || ch === '\n') {
      row.push(field); field = ''; closedQuote = false;
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else {
      if (closedQuote && ch !== ' ' && ch !== '\t') throw new Error('Unexpected text after a quoted CSV field.');
      if (!closedQuote) field += ch;
    }
  }
  if (quoted) throw new Error('Unterminated quoted field in SSRS CSV.');
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some(value => value !== '')) rows.push(row);
  }
  return rows;
}

export function parseErxQueueCsv(text: string, importedAt = Date.now()): ErxQueueCsvSnapshot {
  if (text.length > 8_000_000) throw new Error('SSRS CSV exceeds the 8 MB import limit.');
  const raw = csvCells(text.replace(/^\uFEFF/, ''));
  const [header, ...entries] = raw;
  if (!header || header.length !== COLUMNS.length || COLUMNS.some((name, i) => header[i]?.trim() !== name)) {
    throw new Error('Unexpected SSRS queue CSV columns. Export ErxQueueDashboard using CSV.');
  }

  const warnings: string[] = [];
  const rows: ErxQueueRow[] = [];
  let placeholderRows = 0;
  const reportTotals = new Set<number>();
  for (const [index, cells] of entries.entries()) {
    if (cells.length !== COLUMNS.length) {
      throw new Error('Malformed SSRS CSV: row ' + (index + 2) + ' has the wrong number of columns.');
    }
    const reported = cells[13].trim();
    if (reported) {
      if (!/^\d+$/.test(reported)) throw new Error('Invalid SSRS reported total.');
      reportTotals.add(Number(reported));
    }
    const messageType = cells[3].trim();
    if (!messageType) { placeholderRows++; continue; }
    const pon = cells[7].trim();
    if (!pon) { warnings.push('A queue entry has no PON.'); }
    rows.push({
      folder: cells[0].trim(),
      messageType, priority: cells[4].trim(),
      facility: cells[5].trim().toUpperCase(),
      pon, patient: cells[6].trim(), medication: cells[10].trim(),
      deaClass: cells[9].trim(), enteredAtText: cells[2].trim(),
    });
  }
  const total = reportTotals.size === 1 ? [...reportTotals][0] : undefined;
  if (reportTotals.size > 1) warnings.push('SSRS reported totals disagree across rows.');
  if (total === undefined) warnings.push('SSRS total could not be verified.');
  else if (total !== rows.length) warnings.push('SSRS declared total differs from imported queue rows.');
  return {
    source: 'ssrs-csv-import', importedAt, reportGeneratedAt: null,
    structurallyComplete: total !== undefined && rows.length === total && reportTotals.size === 1,
    coverageVerified: false, reportedTotal: total, placeholderRows, rows, warnings,
  };
}

/**
 * An exact PON alone is never sufficient to select an order. The SSRS
 * 'Refusals' folder means review-hold, not an actual refusal.
 */
export function locateEdcInErxQueue(
  edc: { pon: string; facility?: string }, snapshot: ErxQueueCsvSnapshot,
): ErxQueueMatch {
  const pon = edc.pon.trim();
  const ponRows = snapshot.rows.filter(row => row.pon === pon);
  if (!ponRows.length) return { kind: 'not-in-snapshot', candidates: [] };
  const facility = edc.facility?.trim().toUpperCase();
  if (!facility) return { kind: 'facility-unknown', candidates: ponRows };
  const matches = ponRows.filter(row => row.facility === facility);
  if (!matches.length) return { kind: 'facility-conflict', candidates: ponRows };
  if (matches.length !== 1) return { kind: 'ambiguous', candidates: matches };
  const row = matches[0];
  return {
    kind: 'located', candidates: [row],
    reviewHold: row.folder.trim().toLowerCase() === 'refusals',
    // Unverified DEA data is not clearance for automatic clinical action.
    pharmacistReviewRequired: Boolean(row.deaClass.trim()),
  };
}
