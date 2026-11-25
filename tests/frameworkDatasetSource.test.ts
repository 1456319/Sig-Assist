import { afterEach, describe, expect, it, vi } from 'vitest';
import { attributeExport, newRx } from './iguanaFixtures';
import { findDatasetSource, frameworkSnapshotStatus } from '../src/lib/frameworkSigDataset';
afterEach(() => vi.unstubAllGlobals());
const response = (body: string) => new Response(JSON.stringify({ ok: true, status: 200, body }), { headers: { 'content-type': 'application/json' } });
describe('passive dataset source lookup', () => {
  it.each(['READ_TIMEOUT', 'FRAMEWORK_NOT_RESPONDING', 'PASSIVE_PAUSED', 'BUSY'])('explains %s without incorrectly asking for window selection', code => {
    const message = frameworkSnapshotStatus({ ok: false, code, retryAfterMs: 20000 });
    expect(message).not.toContain('Choose');
    expect(message.length).toBeGreaterThan(20);
    if (code === 'PASSIVE_PAUSED') expect(message).toContain('20 seconds');
  });
  it('requires exact PON identity and retries the wider window for a suffix sibling', async () => {
    const pon = 'SYNTHETIC:01_A';
    const fetcher = vi.fn().mockResolvedValueOnce(response(attributeExport([{ payload: newRx({ pon: pon + '0' }) }])))
      .mockResolvedValueOnce(response(attributeExport([{ payload: newRx({ pon }) }])));
    vi.stubGlobal('fetch', fetcher);
    const source = await findDatasetSource(pon, new AbortController().signal);
    expect(source?.pon).toBe(pon);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetcher.mock.calls[1][1].body).filter).toBe(pon);
  });
  it('does not turn a zero-result source lookup into a made-up source', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response(attributeExport([])))));
    expect(await findDatasetSource('SYNTHETIC-NOT-FOUND', new AbortController().signal)).toBeUndefined();
  });
  it('checks the wider window before returning a recent candidate', async () => {
    const pon = 'SYNTHETIC-REUSED';
    const fetcher = vi.fn().mockResolvedValueOnce(response(attributeExport([{ payload: newRx({ pon }) }])))
      .mockResolvedValueOnce(response(attributeExport([{ payload: newRx({ pon }) }, { payload: newRx({ pon, id: 'synthetic-msg-2' }).replace('DEMO-SITE', 'OTHER-FACILITY') }])));
    vi.stubGlobal('fetch', fetcher);
    expect(await findDatasetSource(pon, new AbortController().signal)).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
