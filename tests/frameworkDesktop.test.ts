// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error Native Node module is deliberately dependency-free.
import { createDesktopSession } from '../scripts/framework-desktop.mjs';

const detection = () => ({ ok: true, pon: 'SYNTHETIC-PON', fields: { sig: { id: 'edit-1', value: 'OLD', label: 'SIG' }, times: { id: 'edit-2', value: '0800', label: 'Administration times' } }, binding: { pid: 7, started: '123', window: 'window-1', pon: 'SYNTHETIC-PON' } });
describe('Framework desktop transfer binding', () => {
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
