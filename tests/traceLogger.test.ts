import { describe, expect, it, beforeEach } from 'vitest';
import {
  traceLogger,
  type TraceEvent,
} from '../src/lib/diagnostics/traceLogger';
import { parseInboundOrder } from '../src/lib/clinical/inboundParser';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';

describe('traceLogger', () => {
  beforeEach(() => {
    traceLogger.clear();
  });

  it('records trace events with timestamp, layer, level, and details', () => {
    const traceId = traceLogger.startTrace('TEST_ORD_1');
    traceLogger.info('clinical', 'doseCalculator', 'Calculated tablet dose', {
      drug: 'PROTONIX 40MG',
      doseToken: '1T',
      multiplier: 1,
    }, undefined, traceId);

    const events = traceLogger.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].traceId).toBe(traceId);
    expect(events[0].layer).toBe('clinical');
    expect(events[0].level).toBe('INFO');
    expect(events[0].component).toBe('doseCalculator');
    expect(events[0].message).toBe('Calculated tablet dose');
    expect(events[0].details?.drug).toBe('PROTONIX 40MG');
    expect(events[0].timestamp).toBeDefined();
  });

  it('enforces ring buffer max limit without memory leak', () => {
    const customLogger = traceLogger.createScoped('SCOPE_1', 5);
    for (let i = 0; i < 10; i++) {
      customLogger.debug('intake', 'test', `Message ${i}`);
    }
    const events = customLogger.getEvents();
    expect(events.length).toBe(5);
    expect(events[0].message).toBe('Message 5');
    expect(events[4].message).toBe('Message 9');
  });

  it('filters events by layer, level, and search keyword', () => {
    const traceId1 = traceLogger.startTrace('PON_100');
    const traceId2 = traceLogger.startTrace('PON_200');

    traceLogger.info('intake', 'inboundParser', 'Extracted HL7 message', { pon: 'PON_100' }, undefined, traceId1);
    traceLogger.warn('packaging', 'paxitEngine', 'Split required for oral solid', { drug: 'GABAPENTIN' }, undefined, traceId1);
    traceLogger.error('storage', 'citrixStorage', 'Disk share unreachable', undefined, { name: 'Error', message: 'EACCES' }, traceId2);

    expect(traceLogger.getEvents({ layer: 'intake' }).length).toBe(1);
    expect(traceLogger.getEvents({ level: 'WARN' }).length).toBe(1);
    expect(traceLogger.getEvents({ level: 'ERROR' }).length).toBe(1);
    expect(traceLogger.getEvents({ traceId: traceId1 }).length).toBe(2);
    expect(traceLogger.getEvents({ search: 'gabapentin' }).length).toBe(1);
    expect(traceLogger.getEvents({ search: 'unreachable' }).length).toBe(1);
  });

  it('exports structured JSON and JSONL bundles', () => {
    traceLogger.info('clinical', 'doseCalculator', 'Step 1');
    traceLogger.warn('packaging', 'paxitEngine', 'Step 2');

    const jsonExport = traceLogger.exportJson();
    const parsedJson = JSON.parse(jsonExport);
    expect(Array.isArray(parsedJson)).toBe(true);
    expect(parsedJson.length).toBe(2);

    const jsonlExport = traceLogger.exportJsonl();
    const lines = jsonlExport.trim().split('\n');
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).message).toBe('Step 1');
    expect(JSON.parse(lines[1]).message).toBe('Step 2');
  });

  it('notifies subscribers on new log entries', () => {
    const received: TraceEvent[] = [];
    const unsubscribe = traceLogger.subscribe((evt) => {
      received.push(evt);
    });

    traceLogger.info('ui', 'MultiOrderCards', 'User copied card');
    expect(received.length).toBe(1);
    expect(received[0].message).toBe('User copied card');

    unsubscribe();
    traceLogger.info('ui', 'MultiOrderCards', 'Another copy');
    expect(received.length).toBe(1);
  });

  it('instruments full clinical translation and emits multi-layer trace logs', () => {
    const raw = `OXYCODONE-APAP 5-325\nUSER ENTRY: Take 2 tablets by mouth in the morning and 1 tablet at night before bedtime for 7 days as needed for severe pain`;
    const inbound = parseInboundOrder(raw);
    const result = translateClinicalSig(inbound);

    expect(result.primarySig).toBe('2T PO QAM AND 1T PO QHS PRN FPAIN X7D 3GM');

    const events = traceLogger.getEvents();
    expect(events.length).toBeGreaterThan(0);

    const layers = new Set(events.map((e) => e.layer));
    expect(layers.has('intake') || layers.has('clinical') || layers.has('packaging')).toBe(true);
  });
});
