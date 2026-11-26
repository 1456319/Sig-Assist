import { useEffect } from 'react';
import { datasetCaptureState, queueSigSample } from '../lib/sigDatasetCapture';
import { publishWorkflowObservation, readWorkflowUpdates, workflowFrameSamples } from '../lib/workflowObservation';

// Reads the connector's saved-frame ring, never initiates native field scans.
// The connector's local journal continues while the page is closed or reloading.
export function AutomaticObservationSamples() {
  useEffect(() => {
    if (!document.querySelector('meta[name="sig-assist-local-connector"][content="pilot-v1"]')) return;
    let stopped = false, sessionId: string | undefined, cursor = 0, gaps = 0, count = 0;
    let timer: ReturnType<typeof setTimeout>;
    const abort = new AbortController();
    async function poll() {
      try {
        const update = await readWorkflowUpdates(cursor, sessionId, abort.signal);
        if (stopped) return;
        if (sessionId !== update.sessionId) { sessionId = update.sessionId; cursor = 0; gaps = 0; count = 0; }
        gaps += update.gaps;
        for (const frame of update.frames) {
          if (frame.sessionId !== sessionId || frame.id <= cursor) continue;
          // Dataset capture is optional and separate from the complete local journal.
          if (datasetCaptureState().enabled) for (const input of workflowFrameSamples(frame)) { void queueSigSample(input); }
          cursor = frame.id; count++;
        }
        cursor = Math.max(cursor, update.cursor);
        publishWorkflowObservation({ active: update.active, sessionId: sessionId || '', status: update.status, eventSource: update.eventSource, gaps, dropped: update.dropped, frames: count, error: '' });
      } catch (error) {
        if (!stopped) publishWorkflowObservation({ error: error instanceof Error ? error.message : 'Automatic recording connection unavailable.' });
      } finally { if (!stopped) timer = setTimeout(() => void poll(), 1500); }
    }
    void poll();
    return () => { stopped = true; abort.abort(); clearTimeout(timer); };
  }, []);
  return null;
}
