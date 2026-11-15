import { beforeEach, expect, it } from 'vitest';
import { captureFeedbackDiagnostics, observeCustomizationCounts, readPilotEvents, recordPilotEvent, type PilotFields } from '../src/lib/pilotDiagnostics';

beforeEach(() => localStorage.clear());

it('reports an observed customization count loss without copying codes, text or patient fields', () => {
  localStorage.setItem('sig_assist_local_sig_dictionary', JSON.stringify(Array.from({ length: 80 }, (_, i) => ({ sig_code: 'SECRET-' + i, translation: 'Sensitive text' }))));
  observeCustomizationCounts();
  localStorage.setItem('sig_assist_local_sig_dictionary', '[]');
  const snapshot = captureFeedbackDiagnostics('dictionary', 'browser_cache');
  expect(snapshot.events).toContainEqual(expect.objectContaining({ code: 'customization.count', fields: { metric: 'dictionary', beforeCount: 80, afterCount: 0, outcome: 'changed' } }));
  expect(JSON.stringify(snapshot)).not.toMatch(/SECRET-|Sensitive text/);
});

it('allowlists recorder inputs and saved metadata at export, bounds retention, and distinguishes invalid storage from no entries', () => {
  const injected = { outcome: 'failed', count: 2, durationMs: 23, reason: 'patient secret', screen: 'private PON', rawMessage: 'private XML', serverUrl: 'http://private', password: 'secret' } as unknown as PilotFields;
  recordPilotEvent('connector.response', injected);
  expect(readPilotEvents()[0].fields).toEqual({ outcome: 'failed', count: 2, durationMs: 23 });
  for (let i = 0; i < 90; i++) recordPilotEvent('connector.request');
  expect(readPilotEvents()).toHaveLength(80);
  localStorage.setItem('sig_assist_local_sig_dictionary', '{broken');
  expect(captureFeedbackDiagnostics('queue', 'browser_cache').customizations.dictionary).toEqual({ state: 'unavailable', count: null });
  localStorage.setItem('sig_assist_local_sig_dictionary', '{}');
  expect(captureFeedbackDiagnostics('queue', 'browser_cache').customizations.dictionary).toEqual({ state: 'invalid', count: null });
});
