import { describe, expect, it } from 'vitest';
import { edcMatch, readDocumentText, readPastedQueue, readQueueCapture } from '../src/lib/docutrackQueue';

const fields = ['Text 3', 'Doc. Type', 'Source', 'Text 4', 'List 2', 'Document #', 'Status'];
const row = ['00:A-1', 'E-DC Order', 'DEMO Example facility', 'Test, Resident', 'RT02 (AM)', '0012345', 'Process'];
const order = { pon: row[0], facility: 'DEMO', patientRef: 'A' };
const capture = (rows: string[][]) => readQueueCapture({ headers: fields, rows, unreadable: 1 }, 'desktop', 100);
const page = 'Prescriber Order Number: 00:A-1\nOrder Type: Discontinue Rx\nFacility Id: DEMO\nLast Name: Test\nFirst Name: Resident\nSource: Example  Original document #: 0012345 received on test date';

describe('Richmond E-DC intake', () => {
  it('reads exact identifiers in configurable column order and counts unreadable rows', () => {
    const result = capture([row, ['00:A-1', 'Order'], [...row.slice(0,-1),'PV1'], ['', ...row.slice(1)], ['x','E-DC…', ...row.slice(2)]]);
    expect(result.documents).toEqual([{ pon: '00:A-1', documentNumber: '0012345', numberSource: 'grid', facility: 'DEMO', resident: 'Test, Resident', route: 'RT02 (AM)' }]);
    expect(result.inspected).toBe(6); expect(result.unresolved).toBe(4);
  });
  it('rejects ambiguous headers, missing PON columns and incomplete copies', () => {
    expect(() => readPastedQueue('Text 3\tPON\tDocument Type\nA\tA\tE-DC')).toThrow(/Two columns/);
    expect(() => readPastedQueue('Document Type\tSource\nE-DC\tTEST')).toThrow(/Text 3/);
    expect(() => readPastedQueue('Document Type\tPON\nE-DC')).toThrow(/complete/);
    expect(readPastedQueue('Doc Type\tPON\tDocument #\nE-DC Order\t00012\t').documents[0].documentNumber).toBe('');
  });
  it('parses the Discontinue Rx body independently of the Received annotation', () => {
    expect(readDocumentText(page)).toMatchObject({ pon: row[0], documentNumber: row[5], facility: 'DEMO', resident: 'Test, Resident' });
    expect(readDocumentText(page.split('Source:')[0]).documentNumber).toBe('');
    expect(() => readDocumentText(page.replace('Discontinue Rx', 'Refill Request'))).toThrow(/Discontinue Rx/);
    expect(() => readDocumentText(page + '\nPrescriber Order Number: 00099')).toThrow(/complete/);
    expect(() => readDocumentText(page + '\nOriginal document #: 00099')).toThrow(/Multiple/);
    expect(() => readDocumentText(page.replace('00:A-1', ''))).toThrow(/complete/);
  });
  it('keeps distinct documents, checks facility and resident collisions and avoids substring matching', () => {
    const docs = capture([row]).documents;
    expect(edcMatch(docs, order, [order])?.unique).toBe(true);
    expect(edcMatch(docs, {...order, pon:'A-1'}, [order])).toBeUndefined();
    expect(edcMatch(docs, {...order, facility:'OTHER'}, [order])?.unique).toBe(false);
    expect(edcMatch(docs, order, [order, {...order, patientRef:'B'}])?.unique).toBe(false);
    expect(edcMatch(docs, order, [order, {...order, facility:'OTHER'}])?.unique).toBe(true);
    expect(edcMatch([{...docs[0], facility:''}], order, [order, {...order, facility:'OTHER'}])?.unique).toBe(false);
    expect(edcMatch(docs, {pon:order.pon}, [order, {...order, facility:'OTHER'}])?.unique).toBe(false);
    expect(edcMatch([...docs, ...docs], order, [order])?.unique).toBe(false);
  });
});
