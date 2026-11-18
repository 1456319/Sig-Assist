import { afterEach, describe, expect, it, vi } from 'vitest';
import { attributeExport, newRx } from './iguanaFixtures';
import { findDatasetSource } from '../src/lib/frameworkSigDataset';
afterEach(() => vi.unstubAllGlobals());
const response = (body: string) => new Response(JSON.stringify({ ok: true, status: 200, body }), { headers: { 'content-type': 'application/json' } });
describe('passive dataset source lookup', () => {
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
});
