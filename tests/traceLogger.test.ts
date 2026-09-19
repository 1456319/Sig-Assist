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

  it('instruments full clinical translation and emits multi-layer trace logs with matching traceId', () => {
    const raw = `OXYCODONE-APAP 5-325\nUSER ENTRY: Take 2 tablets by mouth in the morning and 1 tablet at night before bedtime for 7 days as needed for severe pain`;
    const inbound = parseInboundOrder(raw);
    expect(inbound.traceId).toBeDefined();

    const result = translateClinicalSig(inbound);

    expect(result.primarySig).toBe('2T PO QAM AND 1T PO QHS PRN FPAIN X7D 3GM');
    expect(result.traceId).toBe(inbound.traceId);

    const events = traceLogger.getEvents();
    expect(events.length).toBeGreaterThan(0);

    const layers = new Set(events.map((e) => e.layer));
    expect(layers.has('intake') && layers.has('clinical') && layers.has('packaging')).toBe(true);

    const clinicalAndPackagingEvents = events.filter((e) => e.layer === 'clinical' || e.layer === 'packaging');
    expect(clinicalAndPackagingEvents.length).toBeGreaterThan(0);
    expect(clinicalAndPackagingEvents.every((e) => e.traceId === inbound.traceId)).toBe(true);
  });

  it('flush cursor tracks flushed events and avoids duplicate emits on repeated flush', async () => {
    const flushedBatches: TraceEvent[][] = [];
    traceLogger.setOnFlushHook(async (batch) => {
      flushedBatches.push(batch);
    });

    traceLogger.info('clinical', 'doseCalculator', 'Event 1');
    traceLogger.info('clinical', 'doseCalculator', 'Event 2');

    await traceLogger.flush();
    expect(flushedBatches.length).toBe(1);
    expect(flushedBatches[0].length).toBe(2);

    // Repeated flush without new events should NOT emit anything
    await traceLogger.flush();
    expect(flushedBatches.length).toBe(1);

    // After logging a 3rd event, flush only emits the 3rd event
    traceLogger.info('clinical', 'doseCalculator', 'Event 3');
    await traceLogger.flush();
    expect(flushedBatches.length).toBe(2);
    expect(flushedBatches[1].length).toBe(1);
    expect(flushedBatches[1][0].message).toBe('Event 3');
  });

  it('retains unacknowledged batches for retry if onFlushHook fails, advancing cursor only on success', async () => {
    let shouldFail = true;
    const flushedBatches: TraceEvent[][] = [];

    traceLogger.setOnFlushHook(async (batch) => {
      if (shouldFail) {
        throw new Error('Network timeout during Citrix share flush');
      }
      flushedBatches.push(batch);
      return { destination: 'file_system', recordsSaved: batch.length };
    });

    traceLogger.info('clinical', 'doseCalculator', 'Event A');
    traceLogger.info('clinical', 'doseCalculator', 'Event B');

    // First flush fails
    await expect(traceLogger.flush()).rejects.toThrow('Network timeout during Citrix share flush');
    expect(flushedBatches.length).toBe(0);

    // After failure, unacknowledged records must be retried on next flush
    shouldFail = false;
    const res = await traceLogger.flush();
    expect(res.flushedCount).toBe(2);
    expect(res.destination).toBe('file_system');
    expect(flushedBatches.length).toBe(1);
    expect(flushedBatches[0].map(e => e.message)).toEqual(['Event A', 'Event B']);

    // Subsequent flush does not re-emit
    const emptyRes = await traceLogger.flush();
    expect(emptyRes.flushedCount).toBe(0);
  });

  it('hydrates persisted trace history, deduplicating IDs and surfacing in exports without re-flushing', async () => {
    const persisted: TraceEvent[] = [
      {
        id: 'persisted_1',
        traceId: 'HIST_1',
        timestamp: new Date().toISOString(),
        layer: 'intake',
        level: 'INFO',
        component: 'inboundParser',
        message: 'Persisted past session message',
      },
    ];

    const added = traceLogger.hydratePersistedEvents(persisted);
    expect(added).toBe(1);

    // Duplicate hydration ignores existing event
    const duplicateAdded = traceLogger.hydratePersistedEvents(persisted);
    expect(duplicateAdded).toBe(0);

    // Surfaced in exports
    expect(traceLogger.exportJsonl()).toContain('Persisted past session message');

    // Flush hook does not re-emit already persisted events
    const flushedBatches: TraceEvent[][] = [];
    traceLogger.setOnFlushHook(async (batch) => {
      flushedBatches.push(batch);
    });

    await traceLogger.flush();
    expect(flushedBatches.length).toBe(0);
  });

  it('isolates trace IDs between intake parsing and subsequent queue/clinical translations', () => {
    const initialTrace = traceLogger.getActiveTraceId();
    expect(initialTrace).toBe('GLOBAL');

    // 1. Parsing inbound order generates unique traceId without contaminating global activeTraceId
    const inbound = parseInboundOrder('WARFARIN 5MG\nUSER ENTRY: Take 1 tablet daily');
    expect(inbound.traceId).toBeDefined();
    expect(inbound.traceId).toMatch(/^ORD_/);
    expect(traceLogger.getActiveTraceId()).toBe('GLOBAL');

    // 2. Queue translation with order-specific traceId executes cleanly with that traceId
    const queueOrderResult = translateClinicalSig({
      id: 'queue_order_99',
      pon: 'PON_99',
      drugName: 'LISINOPRIL 10MG',
      rawProse: 'Take 1 tablet by mouth daily',
      sourceFormat: 'manual_text',
      traceId: 'ORD_queue_order_99_R1',
    });
    expect(queueOrderResult.traceId).toBe('ORD_queue_order_99_R1');
    expect(traceLogger.getActiveTraceId()).toBe('GLOBAL');

    // 3. Translation without explicit traceId generates its own TRC_ prefix and does not inherit prior intake
    const fallbackResult = translateClinicalSig({
      id: 'order_fallback',
      pon: 'PON_FB',
      drugName: 'METFORMIN 500MG',
      rawProse: 'Take 1 tablet twice daily',
      sourceFormat: 'manual_text',
    });
    expect(fallbackResult.traceId).toBe('TRC_order_fallback');
    expect(fallbackResult.traceId).not.toBe(inbound.traceId);
    expect(traceLogger.getActiveTraceId()).toBe('GLOBAL');
  });
});
