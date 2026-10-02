import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { StartupBoundary, StartupReady } from '../src/components/StartupBoundary';

afterEach(() => { cleanup(); delete window.sigAssistStartup; vi.restoreAllMocks(); });

describe('startup reporting', () => {
  it('reports successful React mounting to the independent startup panel', () => {
    const ready = vi.fn(); window.sigAssistStartup = { ready, failed: vi.fn(), report: () => ({}) };
    render(<StartupBoundary><span>Mounted</span><StartupReady /></StartupBoundary>);
    expect(ready).toHaveBeenCalledOnce(); expect(ready.mock.calls[0][0]).toBeTypeOf('string');
  });
  it('captures a render crash with its component stack and keeps the diagnostic panel outside React intact', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failed = vi.fn(); window.sigAssistStartup = { ready: vi.fn(), failed, report: () => ({}) };
    const panel = document.createElement('section'); panel.textContent = 'Save startup diagnostics'; document.body.append(panel);
    function Broken(): never { throw new Error('Synthetic render failure'); }
    render(<StartupBoundary><Broken /><StartupReady /></StartupBoundary>);
    expect(failed).toHaveBeenCalledWith('react-render', expect.objectContaining({ message: 'Synthetic render failure' }), expect.objectContaining({ componentStack: expect.stringContaining('Broken') }));
    expect(panel.isConnected).toBe(true); expect(window.sigAssistStartup.ready).not.toHaveBeenCalled(); panel.remove();
  });
});
