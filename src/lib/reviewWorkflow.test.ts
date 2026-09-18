import { describe, expect, it } from 'vitest';
import { cancelOrder, editDraft, orderKey, saveOrder, sourceStamp, type OrderSource } from './orderQueue';
import { copyBlockReason, excludedMatches, finalSig, reviewStamp, type SigExclusion } from './reviewPolicy';
import { extractHl7DirectionsField, runParser } from './parser';
import { translateFreeTextSig } from './sigEngine';

const source: OrderSource = { facility: 'DEMO', patientRef: 'PERSON-A', pon: 'PON-1', drug: 'Example tablets', directions: 'Take 1 tablet by mouth twice daily.\nKeep this line unchanged.' };

describe('local order review lifecycle', () => {
  it('keeps exact source text and separates identical PONs across facilities and patients', () => {
    let orders = saveOrder([], source, '1t po bid');
    orders = saveOrder(orders, { ...source, facility: 'OTHER' }, '1T PO BID');
    orders = saveOrder(orders, { ...source, patientRef: 'PERSON-B' }, '1T PO BID');
    expect(orders).toHaveLength(3);
    expect(orders[0].directions).toBe(source.directions);
    expect(orders[0].draft).toBe('1T PO BID');
  });

  it('deduplicates re-entry without discarding a correction or review', () => {
    const orders = saveOrder([], source, '1T PO BID');
    orders[0].draft = 'CORRECTED SIG';
    orders[0].approved = 'approval';
    expect(saveOrder(orders, { ...source }, 'NEW SUGGESTION')).toBe(orders);
  });

  it('requires an explicit revision and preserves old source while invalidating approval and copy state', () => {
    const orders = saveOrder([], source, '1T PO BID');
    orders[0].approved = 'approval'; orders[0].copied = 'copied';
    const change = { ...source, directions: 'Take 2 tablets by mouth twice daily.' };
    expect(() => saveOrder(orders, change, '2T PO BID')).toThrow('Revise source');
    const [next] = saveOrder(orders, change, '2T PO BID', orderKey(source));
    expect(next.revision).toBe(2);
    expect(next.previousSources[0].directions).toBe(source.directions);
    expect(next.approved).toBeUndefined(); expect(next.copied).toBeUndefined();
  });

  it('refuses revisions to cancelled orders or missing identities', () => {
    const order = cancelOrder(saveOrder([], source, 'SIG')[0]);
    expect(() => saveOrder([order], source, 'SIG', order.id)).toThrow('Cancelled');
    expect(() => saveOrder([], { ...source, patientRef: ' ' }, 'SIG')).toThrow('required');
  });

  it('invalidates approval on draft edits and preserves typing spaces', () => {
    const order = saveOrder([], source, 'SIG')[0]; order.approved = 'approval';
    const edited = editDraft(order, 'take ');
    expect(edited.draft).toBe('TAKE '); expect(edited.approved).toBeUndefined();
    expect(edited.directions).toBe(source.directions);
  });
});

describe('shared clipboard policy', () => {
  const order = saveOrder([], source, '1T PO BID')[0];
  const identity = sourceStamp(order);
  const exclusions: SigExclusion[] = [{ kind: 'code', value: 'QD' }];

  it('requires review and checks the current source, not only rendered output', () => {
    const approved = reviewStamp(identity, order.draft, []);
    expect(copyBlockReason(identity, order.draft, [])).toBeDefined();
    expect(copyBlockReason(identity, order.draft, [], approved)).toBeUndefined();
    expect(copyBlockReason(identity + 'revision', order.draft, [], approved)).toBeDefined();
    expect(copyBlockReason(identity, '2T PO BID', [], approved)).toBeDefined();
    expect(copyBlockReason(identity, order.draft, [], approved, true)).toContain('cancelled');
  });

  it('invalidates approval after adding AND undoing an exclusion', () => {
    const approved = reviewStamp(identity, order.draft, [], 0);
    expect(copyBlockReason(identity, order.draft, exclusions, approved, false, 1)).toBeDefined();
    expect(copyBlockReason(identity, order.draft, [], approved, false, 2)).toBeDefined();
  });

  it('matches whole codes including punctuation without matching longer codes', () => {
    expect(excludedMatches('1T PO (qd);', exclusions)).toHaveLength(1);
    expect(excludedMatches('1T PO QDAY7', exclusions)).toHaveLength(0);
    expect(excludedMatches('PO/SL', [{ kind: 'code', value: 'PO' }])).toHaveLength(0);
  });

  it('blocks exact excluded SIGs with case/whitespace normalization, without substituting', () => {
    const excluded: SigExclusion[] = [{ kind: 'sig', value: '1t po bid' }];
    const draft = ' 1T   PO BID ';
    expect(copyBlockReason(identity, draft, excluded, reviewStamp(identity, draft, excluded))).toContain('exclusion');
    expect(finalSig(draft)).toBe('1T   PO BID');
  });

  it('rejects empty output even when its review stamp matches', () => {
    expect(copyBlockReason(identity, ' ', [], reviewStamp(identity, ' ', []))).toContain('Enter a final SIG');
  });

  it.each(['freetext', 'hl7'] as const)('applies the same final policy to %s output', mode => {
    const raw = mode === 'freetext' ? 'Take 1 tablet by mouth daily' : 'MSH|^~\\&|SRC|||||||||2.5\rRXO||||||QD';
    const result = runParser(raw, mode, [], []);
    expect(excludedMatches(result.finalSig, exclusions)).toHaveLength(1);
  });
});

describe('HL7 input uncertainty', () => {
  const msh = 'MSH|^~\\&|SOURCE|||||||||2.5';
  it.each(['\r', '\n', '\r\n'])('handles segment ending %j and marks an unverified profile', newline => {
    const result = extractHl7DirectionsField(`${msh}${newline}RXO||||||Original directions`);
    expect(result.extracted).toBe('Original directions');
    expect(result.warning).toContain('Unverified');
  });
  it('does not interpret ORC-7 or a whole message as directions', () => {
    expect(extractHl7DirectionsField(`${msh}\rORC|||||||1^BID`).extracted).toBe('');
    expect(extractHl7DirectionsField('not a message').extracted).toBe('');
  });
  it('does not silently select one of multiple directions or orders', () => {
    expect(extractHl7DirectionsField(`${msh}\rRXO||||||first\rRXO||||||second`).extracted).toBe('');
    expect(extractHl7DirectionsField(`${msh}\rORC|NW\rORC|NW\rRXO||||||text`).extracted).toBe('');
  });
});

describe('daily frequency regression', () => {
  it('does not duplicate a duration as an indication', () => {
    const raw = 'Take 1 tablet by mouth twice daily for 7 days.';
    const { order, sig } = translateFreeTextSig(raw, { drug: '' });
    expect(sig).toBe('1T PO BID X7D');
    expect(order.indication).toBeUndefined();
    expect(order.raw).toBe(raw);
  });
  it('preserves an indication following a duration', () => {
    const { sig } = translateFreeTextSig('Take 1 tablet by mouth twice daily for 7 days for pain', { drug: '' });
    expect(sig).toBe('1T PO BID X7D FPAIN');
  });
  it.each([['once daily', 'QD'], ['twice daily', 'BID'], ['three times daily', 'TID'], ['four times daily', 'QID'], ['BID', 'BID']])('preserves %s as %s', (phrase, frequency) => {
    const { order, sig } = translateFreeTextSig(`Take 1 tablet by mouth ${phrase}`, { drug: '' });
    expect(order.frequency).toBe(frequency);
    expect(sig).toBe(`1T PO ${frequency}`);
  });
});
