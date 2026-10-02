import { describe, expect, it, vi } from 'vitest';
import { diagnosticPayload, parseApiQuery, parseHar, parseScriptLog } from '../src/lib/iguana/payload';
import { ingestScriptEvents } from '../src/lib/iguana/intake';
import { ConnectorDiagnostics } from '../src/lib/iguana/diagnostics';
import { nextAfter } from '../src/lib/iguana/client';
import { attributeExport, fourLogHar, newRx, escapeXml } from './iguanaFixtures';
import { initialConnectorConfig, yesterdayMidnight } from '../src/lib/iguana/config';

const emit = vi.fn();
const event = (xml = newRx()) => parseScriptLog({ payload: xml }, emit)[0];

describe('Iguana read-only intake', () => {
  it('imports four captured responses as one order; does not replay requests or execute log JS', () => {
    const har = fourLogHar();
    har.log.entries[0].response.content.text += '\nthrow new Error("must never execute");';
    const logs = parseHar(JSON.stringify(har), emit);
    expect(logs).toHaveLength(4);
    expect(logs[0]).toMatchObject({ channel: 'MessageBroker', logType: 'Info', logId: '20261002-101' });
    const events = logs.flatMap(log => parseScriptLog(log, emit));
    expect(events.map(e => e.kind)).toEqual(['NewRx', 'NewRx', 'RxFill']);
    expect(events[0]).toMatchObject({ pon: 'DEMO-PON-1', patientRef: 'DEMO-RESIDENT', facility: 'DEMO-SITE', metadata: { dose: '1', route: 'oral route', frequency: '2 per day', administrationTimes: ['0900', '2100'], ndc: '11111222233', startDate: '2026-10-02T13:00:00Z' } });
    const result = ingestScriptEvents([], events, () => '1T PO BID', emit);
    expect(result.orders).toHaveLength(1);
    expect(result.summary).toMatchObject({ added: 1, duplicates: 1, ignored: 1, quarantined: 0 });
    expect(result.orders[0].directions).toBe('Give 1 tablet by mouth two times a day for example symptoms');
    expect(events[2].drug).toBe('Example 0.5 MG Tablet');
  });
  it('keeps technician draft and approval on a repeated incoming log', () => {
    const first = ingestScriptEvents([], [event()], () => '1T PO BID', emit);
    first.orders[0].draft = 'TECHNICIAN DRAFT'; first.orders[0].approved = 'approval';
    const replay = ingestScriptEvents(first.orders, [event()], () => 'OTHER', emit);
    expect(replay.orders[0]).toMatchObject({ revision: 1, draft: 'TECHNICIAN DRAFT', approved: 'approval' });
    expect(replay.summary.duplicates).toBe(1);
  });
  it('clears single/split approvals when structured times change with a newer source', () => {
    const first = ingestScriptEvents([], [event()], () => '1T PO BID', emit);
    Object.assign(first.orders[0], { approved: 'old', copied: 'old', subOrderApprovals: { a: 'old' }, subOrderCopied: { a: 'old' } });
    const revised = event(newRx({ id: 'synthetic-msg-2', sentTime: '2026-10-02T05:00:00Z', times: ['0800', '2000'] }));
    const result = ingestScriptEvents(first.orders, [revised], () => '1T PO BID', emit);
    expect(result.orders[0]).toMatchObject({ revision: 2, iguana: { administrationTimes: ['0800', '2000'], messageIds: ['synthetic-msg-1', 'synthetic-msg-2'] } });
    expect(result.orders[0].approved).toBeUndefined(); expect(result.orders[0].subOrderApprovals).toBeUndefined();
    const replay = ingestScriptEvents(result.orders, [event()], () => 'NEVER', emit);
    expect(replay.summary.duplicates).toBe(1); expect(replay.orders[0].intakeHold).toBeUndefined();
  });
  it('does not regress source when an older NewRx is replayed', () => {
    const first = ingestScriptEvents([], [event(newRx({ id: 'new', sentTime: '2026-10-02T05:00:00Z', directions: 'Give 2 tablets by mouth daily' }))], () => '2T PO QD', emit);
    const result = ingestScriptEvents(first.orders, [event()], () => '1T PO BID', emit);
    expect(result.orders[0].draft).toBe('2T PO QD'); expect(result.summary.quarantined).toBe(1);
  });
  it('quarantines both conflicting logs in a batch and holds a previously reviewed matching order', () => {
    const original = event();
    const conflict = event(newRx({ directions: 'Give 2 tablets by mouth daily' }));
    expect(ingestScriptEvents([], [original, conflict], () => 'NEVER', emit).orders).toHaveLength(0);
    const first = ingestScriptEvents([], [original], () => '1T PO BID', emit);
    first.orders[0].approved = 'approval';
    const changed = ingestScriptEvents(first.orders, [conflict], () => 'NEVER', emit);
    expect(changed.orders[0].intakeHold).toContain('changed content');
    expect(changed.orders[0].approved).toBeUndefined();
  });
  it('quarantines missing PON/resident identifiers instead of guessing from names or SSN', () => {
    const incomplete = newRx().replace(/<MedicalRecordIdentificationNumberEHR>[\s\S]*?<\/MedicalRecordIdentificationNumberEHR>/, '').replace(/<PrescriberOrderNumber>[\s\S]*?<\/PrescriberOrderNumber>/, '');
    const parsed = event(incomplete);
    expect(parsed.patientRef).toBeUndefined();
    expect(ingestScriptEvents([], [parsed], () => 'NEVER', emit).summary.quarantined).toBe(1);
  });
  it('matches CancelRx by original message reference without creating another order', () => {
    const original = event();
    const cancellation = event(`<Message><Header><From>DEMO-SENDER</From><MessageID>cancel-1</MessageID><SentTime>2026-10-02T06:00:00Z</SentTime><RelatesToMessageID>synthetic-msg-1</RelatesToMessageID></Header><Body><CancelRx/></Body></Message>`);
    const result = ingestScriptEvents([], [cancellation, original], () => '1T PO BID', emit);
    expect(result.orders).toHaveLength(1); expect(result.orders[0].cancelled).toBe(true);
    expect(ingestScriptEvents(result.orders, [original], () => 'REOPEN', emit).orders[0].cancelled).toBe(true);
  });
  it('rejects truncated HAR details and warns when details were never captured', () => {
    const har = fourLogHar();
    har.log.entries[1].response.content.text = btoa(JSON.stringify({ Message: escapeXml(newRx()), CountOfLines: 1, TotalCountOfLines: 5 }));
    expect(parseHar(JSON.stringify(har), emit)).toHaveLength(3);
    expect(parseHar(JSON.stringify({ log: { entries: [] } }), emit)).toHaveLength(0);
  });
  it('accepts namespaced SCRIPT and preserves ampersands and literal entity text', () => {
    const xml = newRx({ directions: 'Apply &amp; rinse; literal &amp;lt; text' }).replace('<Message ', '<s:Message xmlns:s="urn:script" ').replace('</Message>', '</s:Message>');
    expect(event(xml).directions).toBe('Apply & rinse; literal &lt; text');
  });
  it('parses empty and populated export XML and reports unknown response profiles', () => {
    expect(parseApiQuery('<export/>', emit)).toEqual([]);
    const logs = parseApiQuery(`<export><message source="MessageBroker" type="Info" time="2026/10/02 01:00:00" message_id="log-1"><data>${escapeXml(newRx())}</data></message></export>`, emit);
    expect(logs[0]).toMatchObject({ channel: 'MessageBroker', timestamp: '2026/10/02 01:00:00', logId: 'log-1' });
    expect(event(logs[0].payload).kind).toBe('NewRx');
    expect(() => parseApiQuery('<html>Login</html>', emit)).toThrow('Unexpected log API root');
    expect(() => parseApiQuery('<export><message/></export>', emit)).toThrow('lacks a data attribute or <data> element');
  });
  it('accepts live attribute exports, empty markers and HTTP/SOAP payloads without changing the SIG', () => {
    const directions = 'Apply &amp; rinse; literal &amp;lt; text';
    const xml = newRx({ directions });
    const response = attributeExport([
      { type: 'Message', payload: '' },
      { payload: 'Message committed to queue.' },
      { payload: `Raw incoming data: POST /ProcessMessage HTTP/1.1\r\nSOAPAction: "urn:demo"\r\n\r\n<soap:Envelope xmlns:soap="urn:soap"><xmlMessage>${escapeXml(xml)}</xmlMessage></soap:Envelope>` },
      { payload: `Request Message: <soap:Envelope xmlns:soap="urn:soap"><xmlMessage><![CDATA[${xml}]]></xmlMessage></soap:Envelope>` },
    ]);
    const logs = parseApiQuery(response, emit);
    expect(logs).toHaveLength(4);
    expect(logs[0]).toMatchObject({ payload: '', channel: 'MessageBroker', logType: 'Message', timestamp: '2026-10-02 01:00:04.236', refLogId: 'parent-log', logId: 'synthetic-log-0' });
    expect(logs[2].payload).toContain('SOAPAction: "urn:demo"\r\n');
    const events = logs.flatMap(log => parseScriptLog(log, emit));
    expect(events).toHaveLength(2);
    expect(events.map(e => e.directions)).toEqual(['Apply & rinse; literal &lt; text', 'Apply & rinse; literal &lt; text']);
    expect(ingestScriptEvents([], events, () => 'SYNTHETIC SIG', emit).summary).toMatchObject({ added: 1, duplicates: 1, quarantined: 0 });
    expect(nextAfter(logs.map(log => log.timestamp))).toBe('2026/10/02 01:00:02');
  });
  it('rejects failed API responses and conflicting body representations instead of treating them as an empty queue', () => {
    expect(() => parseApiQuery('<export success="false"><error>Login rejected</error></export>', emit)).toThrow('success=false');
    expect(() => parseApiQuery('<export><message data="first"><data>second</data></message></export>', emit)).toThrow('conflicting data');
    expect(parseApiQuery('<export><message><data/></message></export>', emit)[0].payload).toBe('');
  });
  it('keeps diagnostic exports parseable and preserves SIG entities while removing nested authentication', () => {
    const xml = newRx({ directions: 'Apply &amp; rinse; literal &amp;lt; text' });
    const payload = `Authorization: Basic do-not-export\r\n<soap:Envelope xmlns:soap="urn:soap"><xmlMessage>${escapeXml(xml)}</xmlMessage></soap:Envelope>`;
    const body = attributeExport([{ payload }]);
    const snapshot = diagnosticPayload(body);
    expect(snapshot).not.toContain('do-not-export'); expect(snapshot).not.toContain('never-export-this');
    const logs = parseApiQuery(snapshot, emit);
    expect(logs).toHaveLength(1);
    expect(parseScriptLog(logs[0], emit)[0].directions).toBe('Apply & rinse; literal &lt; text');
    expect(parseScriptLog({ payload: diagnosticPayload(xml) }, emit)[0].messageId).toBe('synthetic-msg-1');
  });
  it('prefills the requested shared account and recalculates yesterday at calendar midnight', () => {
    expect(initialConnectorConfig(new Date(2026, 9, 2, 6, 38))).toMatchObject({ serverUrl: 'http://iguanabalt01v:6543', username: 'admin', password: 'password', channel: 'MessageBroker', after: '2026/10/01 00:00:00', before: '', authMode: 'parameters' });
    expect(yesterdayMidnight(new Date(2026, 0, 1, 0, 5))).toBe('2025/12/31 00:00:00');
    expect(yesterdayMidnight(new Date(2024, 2, 1, 12))).toBe('2024/02/29 00:00:00');
    expect(yesterdayMidnight(new Date(2026, 2, 9, 0, 30))).toBe('2026/03/08 00:00:00');
  });
  it('counts dropped diagnostic events and removes credentials from optional payload evidence', () => {
    const diagnostics = new ConnectorDiagnostics(2);
    for (let i = 0; i < 3; i++) diagnostics.emit('debug', 'test', 'test', { i });
    expect(diagnostics.export({})).toMatchObject({ droppedEvents: 1, stageCounts: { test: 3 } });
    const snapshot = diagnosticPayload(`Authorization: Basic secret\n${escapeXml(escapeXml(newRx()))}`);
    expect(snapshot).not.toContain('never-export-this'); expect(snapshot).not.toContain('Basic secret');
    expect(snapshot).toContain('DEMO-PON-1');
  });
  it('uses a server-clock overlap across midnight and declines unknown formats', () => {
    expect(nextAfter(['2026/10/02 00:00:01'])).toBe('2026/10/01 23:59:59');
    expect(nextAfter(['October 2 1am'])).toBeUndefined();
    expect(nextAfter(['2026/10/02 00:00:01', undefined])).toBeUndefined();
    expect(nextAfter(['2026-10-02 00:00:01.123', '2026/10/01 23:59:58'])).toBe('2026/10/01 23:59:59');
    expect(nextAfter(['2026-02-30 00:00:01'])).toBeUndefined();
  });
});
