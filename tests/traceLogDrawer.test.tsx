import { describe, expect, it, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TraceLogDrawer } from '../src/components/TraceLogDrawer';
import { traceLogger } from '../src/lib/diagnostics/traceLogger';

describe('TraceLogDrawer', () => {
  beforeEach(() => {
    traceLogger.clear();
    vi.restoreAllMocks();
  });

  it('renders drawer when open and lists recorded trace events', () => {
    traceLogger.info('clinical', 'doseCalculator', 'Dose calculated 1T', { drug: 'LISINOPRIL' });
    traceLogger.warn('packaging', 'paxitEngine', 'Paxit split required');

    const html = renderToString(<TraceLogDrawer isOpen={true} onClose={vi.fn()} />);

    expect(html).toContain('Diagnostic Trace Logs');
    expect(html).toContain('Dose calculated 1T');
    expect(html).toContain('Paxit split required');
    expect(html).toContain('doseCalculator');
    expect(html).toContain('paxitEngine');
  });

  it('does not render drawer markup when isOpen is false', () => {
    traceLogger.info('clinical', 'doseCalculator', 'Hidden event');

    const html = renderToString(<TraceLogDrawer isOpen={false} onClose={vi.fn()} />);
    expect(html).toBe('');
  });

  it('renders layer and level filter controls and action buttons', () => {
    const html = renderToString(<TraceLogDrawer isOpen={true} onClose={vi.fn()} />);

    expect(html).toContain('Flush to Share');
    expect(html).toContain('Export Bundle');
    expect(html).toContain('Copy JSONL');
    expect(html).toContain('Clear');
    expect(html).toContain('Search trace logs');
  });
});

