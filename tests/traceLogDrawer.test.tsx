import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { cleanup } from '@testing-library/react';
import { TraceLogDrawer } from '../src/components/TraceLogDrawer';
import { traceLogger } from '../src/lib/diagnostics/traceLogger';

describe('TraceLogDrawer', () => {
  beforeEach(() => {
    traceLogger.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
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

  it('hydrates persisted trace history when opened and displays them in DOM', async () => {
    const { render, screen, waitFor } = await import('@testing-library/react');
    const { getCitrixStorageAdapter } = await import('../src/lib/citrixStorage');
    const adapter = getCitrixStorageAdapter();
    vi.spyOn(adapter, 'readTraceLogs').mockResolvedValue([
      {
        id: 'persisted_drawer_1',
        traceId: 'HIST_DRAWER',
        timestamp: new Date().toISOString(),
        layer: 'storage',
        level: 'INFO',
        component: 'citrixStorage',
        message: 'Loaded previous session trace from disk',
      },
    ]);

    render(<TraceLogDrawer isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Loaded previous session trace from disk')).toBeDefined();
    });
  });

  it('displays destination feedback on successful flush', async () => {
    const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
    traceLogger.info('clinical', 'doseCalculator', 'Unflushed event');

    vi.spyOn(traceLogger, 'flush').mockResolvedValue({
      flushedCount: 1,
      destination: 'file_system',
    });

    render(<TraceLogDrawer isOpen={true} onClose={vi.fn()} />);

    const flushBtn = screen.getByTitle(/Flush pending memory traces/i);
    fireEvent.click(flushBtn);

    await waitFor(() => {
      const banner = screen.getByTestId('flush-feedback-banner');
      expect(banner.textContent).toContain('Flushed 1 record to Citrix Share (sig-assist-trace.jsonl)');
    });
  });

  it('displays error feedback and retry button when flush fails', async () => {
    const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
    traceLogger.info('storage', 'citrixStorage', 'Unflushed event');

    vi.spyOn(traceLogger, 'flush').mockRejectedValue(new Error('Citrix drive disconnected'));

    render(<TraceLogDrawer isOpen={true} onClose={vi.fn()} />);

    const flushBtn = screen.getByTitle(/Flush pending memory traces/i);
    fireEvent.click(flushBtn);

    await waitFor(() => {
      const banner = screen.getByTestId('flush-feedback-banner');
      expect(banner.textContent).toContain('Flush failed: Citrix drive disconnected');
      expect(screen.getByText('Retry')).toBeDefined();
    });
  });
});

