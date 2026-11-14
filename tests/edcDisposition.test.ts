import { describe, expect, it, vi } from 'vitest';
import { verifyEdcDispositions, edcEvidenceKey, edcEvidenceDescription } from '../src/lib/iguana/edcDisposition';
import { initialConnectorConfig } from '../src/lib/iguana/config';
import { newRx } from './iguanaFixtures';
import type { EdcDocument } from '../src/lib/docutrackQueue';
import type { IguanaLog } from '../src/lib/iguana/types';

const doc = (pon: string): EdcDocument => ({
  pon, facility: 'DEMO-SITE', resident: '', route: '', documentNumber: '101', numberSource: 'grid',
});
const records = (...payloads: string[]): IguanaLog[] => payloads.map(payload => ({payload}));

describe('E-DC evidence checks (PILOT ONLY)', () => {
  it('polls both actual channels immediately and does not equate NewRx history with pending', async () => {
    const calls: {channel: string; filter: string; after: string}[] = [];
    const found = new Map<string, string>();
    const result = await verifyEdcDispositions(
      [doc('DEMO-PON-1'), doc('DEMO-PON-1')],
      initialConnectorConfig(), new AbortController().signal,
      (d, evidence) => found.set(edcEvidenceKey(d), edcEvidenceDescription(evidence)),
      async (config) => {
        calls.push({channel: config.channel, filter: config.filter, after: config.after});
        return {logs: config.channel === 'MessageBroker' ? records(newRx()) : [], saturated: false};
      },
    );
    expect(result).toBeUndefined();
    expect(calls).toHaveLength(2);
    expect(calls.map(v => v.channel).sort()).toEqual(['MessageBroker','Paxit: VA - FW Outbound'].sort());
    expect(calls.every(v => v.filter === 'DEMO-PON-1')).toBe(true);
    expect(found.get(edcEvidenceKey(doc('DEMO-PON-1')))).toMatch(/Historical NewRx.*current status unknown/);
  });

  it('recognizes outbound PON as unclassified activity, never as a completed refusal', async () => {
    const statuses: string[] = [];
    await verifyEdcDispositions([doc('DEMO-PON-1')], initialConnectorConfig(), new AbortController().signal,
      (_, evidence) => statuses.push(edcEvidenceDescription(evidence)),
      async cfg => ({
        logs: cfg.channel === 'MessageBroker' ? records(newRx()) : records('MSH|^~\\&|TEST\nZXX|PON=DEMO-PON-1'),
        saturated: false,
      }));
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toMatch(/activity found.*not yet verified as a refusal/i);
    expect(statuses[0]).not.toMatch(/completed|processed|refused/i);
  });

  it('keeps a failed channel or saturated query incomplete instead of inferring no status', async () => {
    for (const failure of ['throw', 'saturated']) {
      const found: string[] = [];
      await verifyEdcDispositions([doc('DEMO-PON-1')], initialConnectorConfig(), new AbortController().signal,
        (_, evidence) => found.push(edcEvidenceDescription(evidence)),
        async cfg => {
          if (cfg.channel !== 'MessageBroker' && failure === 'throw') throw Error('offline');
          return {logs: [], saturated: cfg.channel !== 'MessageBroker' && failure === 'saturated'};
        });
      expect(found[0]).toMatch(/Incomplete check/);
    }
  });

  it('does not include nearby but different PONs', async () => {
    const statuses: string[] = [];
    await verifyEdcDispositions([doc('PON-123')], initialConnectorConfig(), new AbortController().signal,
      (_, evidence) => statuses.push(edcEvidenceDescription(evidence)),
      async cfg => ({logs: cfg.channel === 'MessageBroker' ? [] : records('PON-1234 and X-PON-123'), saturated: false}));
    expect(statuses[0]).toMatch(/No matching logs found/);
  });

  it('does not issue requests after cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    const read = vi.fn();
    await verifyEdcDispositions([doc('DEMO-PON-1')], initialConnectorConfig(), controller.signal, () => {}, read);
    expect(read).not.toHaveBeenCalled();
  });
});
