// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error Native Node module is deliberately dependency-free.
import { createDesktopSession } from '../scripts/framework-desktop.mjs';

const detection = () => ({ ok: true, pon: 'SYNTHETIC-PON', fields: { sig: { id: 'edit-1', value: 'OLD', label: 'SIG' }, times: { id: 'edit-2', value: '0800', label: 'Administration times' } }, binding: { pid: 7, started: '123', window: 'window-1', pon: 'SYNTHETIC-PON' } });
describe('Framework desktop transfer binding', () => {
  it('remembers the entry window beyond field-token expiry and ignores client-supplied selectors', async () => {
    let time = 0;
    const entry = { pid: 41, started: '111', id: 'root-a', handle: 401, title: 'Framework entry' };
    const run = vi.fn().mockResolvedValue({ ...detection(), entryWindow: entry, scanMode: 'remembered-entry' });
    const desktop = createDesktopSession({ run, now: () => time });
    const first = await desktop('detect');
    expect(first.entryWindow).toEqual({ pid: 41, title: 'Framework entry' });
    time = 600000;
    await desktop('detect', { entryWindow: { pid: 99, handle: 999 } });
    expect(run).toHaveBeenLastCalledWith({ action: 'detect', positionReview: false, entryWindow: entry });
    await desktop('inspect'); expect(run).toHaveBeenLastCalledWith({ action: 'inspect', entryWindow: entry });
  });
  it('keeps a missing window selected until an explicit successful window choice', async () => {
    const entry = { pid: 41, started: '111', id: 'root-a', handle: 401, title: 'Framework entry' };
    const other = { pid: 42, started: '222', id: 'root-b', handle: 402, title: 'New entry' };
    const run = vi.fn().mockResolvedValueOnce({ ...detection(), entryWindow: entry })
      .mockResolvedValueOnce({ ok: false, windowSelectionRequired: true, error: 'Entry window closed' })
      .mockResolvedValueOnce({ ok: false, error: 'No Framework window chosen' })
      .mockResolvedValueOnce({ ...detection(), entryWindow: entry })
      .mockResolvedValueOnce({ ...detection(), entryWindow: other }).mockResolvedValue({ ...detection(), entryWindow: other });
    const desktop = createDesktopSession({ run });
    await desktop('detect');
    expect(await desktop('detect')).toMatchObject({ ok: false, windowSelectionRequired: true });
    await desktop('detect', { chooseWindow: true });
    expect(run).toHaveBeenLastCalledWith({ action: 'window', positionReview: false });
    await desktop('detect'); expect(run).toHaveBeenLastCalledWith({ action: 'detect', positionReview: false, entryWindow: entry });
    const changed = await desktop('detect', { chooseWindow: true });
    expect(changed.entryWindow).toEqual({ pid: 42, title: 'New entry' });
    await desktop('detect'); expect(run).toHaveBeenLastCalledWith({ action: 'detect', positionReview: false, entryWindow: other });
  });
  it('allows an explicitly chosen send destination without changing the remembered entry window', async () => {
    const entry = { pid: 41, started: '111', id: 'root-a', handle: 401, title: 'Entry' };
    const other = { pid: 42, started: '222', id: 'root-b', handle: 402, title: 'Destination' };
    const run = vi.fn().mockResolvedValueOnce({ ...detection(), entryWindow: entry })
      .mockResolvedValueOnce({ ...detection(), entryWindow: other }).mockResolvedValue({ ...detection(), entryWindow: entry });
    const desktop = createDesktopSession({ run });
    await desktop('detect'); await desktop('target', { field: 'sig' }); await desktop('detect');
    expect(run).toHaveBeenLastCalledWith({ action: 'detect', positionReview: false, entryWindow: entry });
  });
  it('uses PON-only detection by default and positions the review section only when requested', async () => {
    const run = vi.fn().mockResolvedValue({ ...detection(), viewportStatus: 'Framework details left at RxFill Indicator / All Fill Statuses.' });
    const desktop = createDesktopSession({ run });
    await desktop('detect');
    expect(run).toHaveBeenLastCalledWith({ action: 'detect', positionReview: false });
    expect(await desktop('detect', { positionReview: true })).toMatchObject({ viewportStatus: expect.stringContaining('RxFill Indicator') });
    expect(run).toHaveBeenLastCalledWith({ action: 'detect', positionReview: true });
  });
  it('preserves multiple-instance detection status across the bridge', async () => {
    const desktop = createDesktopSession({ run: vi.fn().mockResolvedValue({ ...detection(), instances: 5, openErxWindows: 1 }) });
    expect(await desktop('detect')).toMatchObject({ instances: 5, openErxWindows: 1, pon: 'SYNTHETIC-PON' });
  });
  it('keeps selectors on the server and consumes an approved matched binding once', async () => {
    const run = vi.fn().mockResolvedValueOnce(detection()).mockResolvedValueOnce({ ok: true, verified: true, detected: detection() });
    const desktop = createDesktopSession({ run });
    const found = await desktop('detect');
    expect(found).toMatchObject({ pon: 'SYNTHETIC-PON', fields: { sig: { currentValue: 'OLD' } } });
    expect(found.binding).toBeUndefined(); expect(found.fields.sig.id).toBeUndefined();
    const body = { token: found.token, pon: found.pon, field: 'sig', value: 'REVIEWED', approved: true, matched: true, expected: { pid: 9000 } };
    expect(await desktop('send', body)).toMatchObject({ ok: true, verified: true });
    expect(run.mock.calls[1][0]).toMatchObject({ expected: detection(), value: 'REVIEWED', field: 'sig' });
    expect(await desktop('send', body)).toMatchObject({ ok: false });
    expect(run).toHaveBeenCalledTimes(2);
  });
  it.each([
    { approved: false }, { matched: false }, { pon: '' }, { field: 'other' }, { value: '' },
  ])('rejects invalid approval, identity, field or text: %j', async override => {
    const run = vi.fn().mockResolvedValue(detection()); const desktop = createDesktopSession({ run });
    const found = await desktop('detect');
    expect(await desktop('send', { token: found.token, pon: found.pon, approved: true, matched: true, field: 'sig', value: 'TEST', ...override })).toMatchObject({ ok: false });
    expect(run).toHaveBeenCalledTimes(1);
  });
  it('expires bindings, invalidates them on a fresh detection and refuses absent targets', async () => {
    let time = 0; const run = vi.fn().mockResolvedValue(detection()); const desktop = createDesktopSession({ run, now: () => time });
    const first = await desktop('detect'); time = 300001;
    const body = { pon: first.pon, approved: true, matched: true, field: 'sig', value: 'TEST' };
    expect(await desktop('send', { ...body, token: first.token })).toMatchObject({ ok: false });
    const second = await desktop('detect'); await desktop('detect');
    expect(await desktop('send', { ...body, token: second.token })).toMatchObject({ ok: false });
    run.mockResolvedValueOnce({ ...detection(), fields: {} });
    const missing = await desktop('detect');
    expect(await desktop('send', { ...body, token: missing.token })).toMatchObject({ ok: false });
    expect(run.mock.calls.every(([arg]) => arg.action === 'detect')).toBe(true);
  });
  it('allows technician-approved sending with multiple or differing PONs', async () => {
    const multi = { ...detection(), pon: null, pons: ['PON-A', 'PON-B'], warnings: ['Multiple PONs detected'] };
    const run = vi.fn().mockResolvedValueOnce(multi).mockResolvedValueOnce({ ok: true, verified: true, detected: multi, warnings: multi.warnings });
    const desktop = createDesktopSession({ run }); const found = await desktop('detect');
    expect(found.pons).toEqual(['PON-A', 'PON-B']);
    expect(await desktop('send', { token: found.token, pon: 'PON-B', approved: true, matched: true, field: 'sig', value: 'APPROVED' })).toMatchObject({ ok: true, verified: true, warnings: ['Multiple PONs detected'] });
  });
  it('does not report success or offer a retry after an uncertain write', async () => {
    const run = vi.fn().mockResolvedValueOnce(detection()).mockRejectedValueOnce(new Error('Timed out'));
    const desktop = createDesktopSession({ run }); const found = await desktop('detect');
    const body = { token: found.token, pon: found.pon, approved: true, matched: true, field: 'sig', value: 'TEST' };
    expect(await desktop('send', body)).toMatchObject({ ok: false, uncertain: true });
    expect(await desktop('send', body)).toMatchObject({ ok: false }); expect(run).toHaveBeenCalledTimes(2);
  });
});
