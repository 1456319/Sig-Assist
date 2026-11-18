// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error Native Node module is deliberately dependency-free.
import { createDesktopSession, runDesktopHelper } from '../scripts/framework-desktop.mjs';

const entryWindow = { pid: 41, started: '111', id: 'root-a', handle: 401, title: 'Entry' };
const detected = { ok: true, pon: 'SYNTHETIC:001', pons: ['SYNTHETIC:001'], entryWindow, fields: { sig: { id: 'sig-1', value: 'OLD', label: 'SIG' } } };
const snapshot = { ok: true, code: 'OK', pon: 'SYNTHETIC:001', sig: 'Human directions observed', partial: false };

describe('separate local Framework SIG dataset reader', () => {
  it('requires the remembered entry and ignores every page-supplied selector', async () => {
    const run = vi.fn(async input => input.action === 'dataset-snapshot' ? snapshot : detected);
    const desktop = createDesktopSession({ run, now: () => 1000 });
    expect(await desktop('dataset-snapshot', { entryWindow: { pid: 99 } })).toEqual({ ok: false, code: 'SELECTION_REQUIRED' });
    expect(run).not.toHaveBeenCalled();
    await desktop('detect');
    expect(await desktop('dataset-snapshot', { entryWindow: { pid: 99 }, pon: 'INJECTED', field: 'times', value: 'INJECTED', approved: true })).toEqual({ ...snapshot, observedAt: '1970-01-01T00:00:01.000Z' });
    expect(run).toHaveBeenLastCalledWith({ action: 'dataset-snapshot', entryWindow });
  });

  it('does not consume a reviewed transfer token or discover/detect each order', async () => {
    const run = vi.fn(async input => input.action === 'dataset-snapshot' ? snapshot : input.action === 'send' ? { ok: true, verified: true, detected } : detected);
    const desktop = createDesktopSession({ run });
    const first = await desktop('detect');
    await desktop('dataset-snapshot'); await desktop('dataset-snapshot');
    expect(await desktop('send', { token: first.token, pon: first.pon, approved: true, matched: true, field: 'sig', value: 'REVIEWED' })).toMatchObject({ ok: true, verified: true });
    expect(run.mock.calls.map(([input]) => input.action)).toEqual(['detect', 'dataset-snapshot', 'dataset-snapshot', 'send']);
  });

  it.each(['CURRENT_ORDER_UNAVAILABLE', 'CURRENT_ORDER_AMBIGUOUS', 'PON_UNAVAILABLE', 'PON_AMBIGUOUS', 'SIG_UNAVAILABLE', 'SIG_AMBIGUOUS', 'ORDER_CHANGED', 'WINDOW_UNAVAILABLE', 'READ_LIMIT'])('keeps %s distinct and drops all failed capture text', async code => {
    const run = vi.fn().mockResolvedValueOnce(detected).mockResolvedValueOnce({ ...snapshot, ok: false, code, partial: true, sig: 'PRIVATE FAILED SIG', pon: 'PRIVATE-PON', diagnostics: { patient: 'PRIVATE-NAME' } });
    const desktop = createDesktopSession({ run }); await desktop('detect');
    expect(await desktop('dataset-snapshot')).toEqual({ ok: false, code, partial: true });
  });

  it.each([
    { partial: true }, { pon: 'PON' }, { pon: '' }, { pon: 'PON WITH SPACES' }, { sig: '' }, { sig: 'x'.repeat(4001) }, { code: 'PRIVATE-PON' },
  ])('rejects malformed or partial success without forwarding text: %j', async override => {
    const run = vi.fn().mockResolvedValueOnce(detected).mockResolvedValueOnce({ ...snapshot, ...override });
    const desktop = createDesktopSession({ run }); await desktop('detect');
    expect(await desktop('dataset-snapshot')).toMatchObject({ ok: false, code: 'DATASET_SNAPSHOT_FAILED' });
  });

  it('returns only the minimal current observation, without audit or completion claims', async () => {
    const run = vi.fn().mockResolvedValueOnce(detected).mockResolvedValueOnce({ ...snapshot, token: 'PRIVATE', diagnostics: 'PRIVATE', drug: 'PRIVATE', verified: true, saved: true, entryWindow, controls: ['PRIVATE'] });
    const desktop = createDesktopSession({ run, now: () => 0 }); await desktop('detect');
    expect(await desktop('dataset-snapshot')).toEqual({ ...snapshot, observedAt: '1970-01-01T00:00:00.000Z' });
  });

  it('redacts native failures and releases the helper for later clinical work', async () => {
    const run = vi.fn().mockResolvedValueOnce(detected).mockRejectedValueOnce(new Error('PRIVATE PATH AND PON')).mockResolvedValueOnce(detected);
    const desktop = createDesktopSession({ run }); await desktop('detect');
    expect(await desktop('dataset-snapshot')).toEqual({ ok: false, code: 'DATASET_SNAPSHOT_FAILED' });
    expect(await desktop('detect')).toMatchObject({ ok: true });
  });

  it('lets active clinical work finish and makes a clinical request wait for a passive dataset read', async () => {
    let finish: (value: unknown) => void = () => {};
    const run = vi.fn(async input => input.action === 'dataset-snapshot' ? new Promise(resolve => { finish = resolve; }) : detected);
    const desktop = createDesktopSession({ run }); await desktop('detect');
    const pending = desktop('dataset-snapshot');
    expect(await desktop('observe')).toMatchObject({ ok: false, code: 'BUSY' });
    const clinical = desktop('detect');
    expect(run).toHaveBeenCalledTimes(2);
    finish(snapshot); expect(await pending).toMatchObject({ ok: true });
    expect(await clinical).toMatchObject({ ok: true });
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('uses the bounded passive helper timeout', async () => {
    const execute = vi.fn(async () => JSON.stringify(snapshot));
    await runDesktopHelper({ action: 'dataset-snapshot', entryWindow }, { getExecutable: async () => 'synthetic-helper', execute });
    expect(execute).toHaveBeenCalledWith('synthetic-helper', [], JSON.stringify({ action: 'dataset-snapshot', entryWindow }), 8000);
  });
});
