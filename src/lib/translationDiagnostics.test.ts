import { describe, expect, it } from 'vitest';
import { createTranslationDiagnostic, generateUUID, redactDirections, SessionDiagnosticSink, toGitHubIssueDraft } from './translationDiagnostics';
import { translateFreeTextSig } from './sigEngine';

describe('translation diagnostics', () => {
  it('redacts long identifiers and dates by default', () => {
    expect(redactDirections('Give 1 tablet until 07/30/2026 for order 123456')).toContain('[DATE]');
    expect(redactDirections('Give 1 tablet until 07/30/2026 for order 123456')).toContain('[NUMBER]');
  });

  it('generates a valid UUID string even if crypto.randomUUID is absent', () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('creates a GitHub-ready redacted issue draft', () => {
    const parsed = translateFreeTextSig('Give 1 tablet by mouth every 12 hours for cellulitis until 07/30/2026 20:59', { drug: 'CEPHALEXIN 500MG' });
    const event = createTranslationDiagnostic('parser-warning', 'manual', parsed.order.raw, parsed.order.drug, parsed.sig, parsed.order);
    const draft = toGitHubIssueDraft(event);
    expect(draft.title).toContain('translation');
    expect(draft.body).toContain('Automated redacted translation diagnostic');
    expect(draft.body).not.toContain('07/30/2026');
  });

  it('keeps only redacted context in a session diagnostic', () => {
    const parsed = translateFreeTextSig('Give 1 tablet by mouth every 12 hours for cellulitis until 07/30/2026 20:59', { drug: 'CEPHALEXIN 500MG' });
    const event = createTranslationDiagnostic('parser-warning', 'manual', parsed.order.raw, parsed.order.drug, parsed.sig, parsed.order);
    const sink = new SessionDiagnosticSink();
    sink.record(event);
    expect(sink.list()).toHaveLength(1);
    expect(JSON.stringify(sink.list())).not.toContain('07/30/2026');
  });
});
