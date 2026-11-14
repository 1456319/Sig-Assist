import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { edcMatch, readPastedQueue, readQueueCapture, type EdcSnapshot, type QueueCapture } from '../lib/docutrackQueue';
import { downloadDesktopDiagnostics } from '../lib/frameworkDesktop';
import { reviewButtonClass, reviewInputClass } from './SigReviewPanel';
import { edcEvidenceDescription, edcEvidenceKey, type EdcDispositionEvidence } from '../lib/iguana/edcDisposition';
import type { EdcDocument } from '../lib/docutrackQueue';

async function copy(value: string) {
  try { await navigator.clipboard.writeText(value); toast.success('Copied.'); }
  catch { toast.error('Clipboard unavailable. Select and copy the displayed value.'); }
}

export function EdcWarning({ match, snapshot, evidence = {} }: { match: NonNullable<ReturnType<typeof edcMatch>>; snapshot: EdcSnapshot; evidence?: Record<string, EdcDispositionEvidence> }) {
  return <div role="alert" className="rounded-md border-2 border-red-600 bg-red-50 text-red-950 p-4 space-y-2">
    <h4 className="font-bold text-lg">{match.unique ? 'This PON has a matching E-DC in DocuTrack!' : 'E-DC found for this PON — verify the order identity'}</h4>
    <p>{match.unique ? 'Find the E-DC and check the resident, facility and medication against the unprocessed NewRx in E-Rx Triage Manager. If they match and the medication is in scope, refuse this order.' : 'The identifiers do not resolve to one order and document. Compare the original records before acting.'}</p>
    <p className="text-sm">{snapshot.source === 'paste' ? 'Technician-provided' : 'Desktop'} snapshot at {new Date(snapshot.capturedAt).toLocaleTimeString()}. Refresh to check for changes. A historical E-Rx match does not establish a pending Framework request.</p>
    {match.candidates.map((doc,i) => <p key={'evidence-' + i} className="text-sm font-semibold">Iguana: {edcEvidenceDescription(evidence[edcEvidenceKey(doc)])}</p>)}
    {match.candidates.map((doc, i) => <p key={i} className="text-sm font-mono break-words">PON {doc.pon} · {doc.facility || 'Facility unavailable'} · {doc.resident || 'Resident unavailable'} · {doc.documentNumber ? (doc.numberSource === 'grid' ? 'Grid document # ' : 'Stamped document # ') + doc.documentNumber : 'Read document # from the bottom-right stamp'}</p>)}
  </div>;
}

export function DocuTrackQueue({ snapshot, onCapture, onFind, onVerify, evidence: externalEvidence, onEvidenceChange }: {
  snapshot?: EdcSnapshot; onCapture: (value?: EdcSnapshot) => void; onFind: (pon: string) => void;
  onVerify?: (documents: EdcDocument[], signal: AbortSignal, onResult: (document: EdcDocument, evidence: EdcDispositionEvidence) => void) => Promise<void>;
  evidence?: Record<string, EdcDispositionEvidence>;
  onEvidenceChange?: Dispatch<SetStateAction<Record<string, EdcDispositionEvidence>>>;
}) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<unknown>();
  const [error, setError] = useState('');
  const [paste, setPaste] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [localEvidence, setLocalEvidence] = useState<Record<string, EdcDispositionEvidence>>({});
  const evidence = externalEvidence ?? localEvidence;
  const setEvidence = onEvidenceChange ?? setLocalEvidence;
  const [checking, setChecking] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const verification = useRef<AbortController>();
  useEffect(() => () => verification.current?.abort(), []);
  function resetVerification() {
    verification.current?.abort();
    setChecking(false); setVerificationError(''); setEvidence({});
  }
  async function verify(snap: EdcSnapshot) {
    if (!onVerify || !snap.documents.length) return;
    verification.current?.abort();
    const controller = new AbortController();
    verification.current = controller;
    setChecking(true); setVerificationError('');
    try {
      await onVerify(snap.documents, controller.signal, (doc, result) => {
        if (!controller.signal.aborted) setEvidence(previous => ({ ...previous, [edcEvidenceKey(doc)]: result }));
      });
    } catch {
      if (!controller.signal.aborted) setVerificationError('Iguana evidence check failed. Current Framework disposition is unknown.');
    } finally {
      if (verification.current === controller) setChecking(false);
    }
  }
  async function scan() {
    setBusy(true); setReport(undefined); setError(''); resetVerification(); onCapture(undefined);
    try {
      if (!['http:', 'https:'].includes(location.protocol)) throw new Error('Open the Windows connector in the same session as DocuTrack, or paste a copy below.');
      const response = await fetch('/connector/desktop/docutrack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error('Start the Windows connector from this version of the ZIP in the same session as DocuTrack.');
      const data: { ok: boolean; capture?: QueueCapture; diagnostics?: unknown; error?: string } = await response.json();
      setReport(data.diagnostics);
      if (!data.ok || !data.capture) throw new Error(data.error || 'The DocuTrack folder was unreadable.');
      const current = readQueueCapture(data.capture, 'desktop');
      onCapture(current);
      void verify(current);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }
  function importRows() {
    setError(''); resetVerification(); onCapture(undefined);
    try { const current = readPastedQueue(paste); onCapture(current); void verify(current); setPaste(''); setConfirmed(false); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  }
  return <section aria-label="Richmond DocuTrack E-DCs" className="rounded-lg border border-primary/50 bg-card p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-semibold">Richmond DocuTrack E-DCs</h3>
      <button type="button" className={reviewButtonClass + ' bg-primary text-primary-foreground'} disabled={busy} onClick={() => void scan()}>{busy ? 'Reading Process queue…' : 'Show E-DC PONs'}</button>
    </div>
    <p className="text-sm">Open Folders → Richmond Pharmacy → Order Processing → Process in DocuTrack. Show Document Type and Text 3. Clear any filters that hide E-DCs.</p>
    {error && <p role="alert" className="font-medium text-amber-600">{error} Queue coverage is unknown.</p>}
    {!!report && <button type="button" className={reviewButtonClass} onClick={() => downloadDesktopDiagnostics(report)}>Save E-DC reader report (counts only)</button>}
    {snapshot && <div className="space-y-2">
      {onVerify && <div className="flex items-center gap-3 flex-wrap"><p role="status" className="text-sm">{checking ? 'Checking MessageBroker and VA - Outbound now…' : 'Iguana evidence checked for ' + Object.keys(evidence).length + ' document identities.'} Checks do not prove Framework is pending.</p><button type="button" className={reviewButtonClass} disabled={checking || busy} onClick={() => { resetVerification(); void verify(snapshot); }}>Recheck Iguana evidence</button></div>}
      {verificationError && <p role="alert" className="text-amber-600">{verificationError}</p>}
      <p role="status" className="text-sm"><strong>{snapshot.documents.length} E-DC documents with a PON</strong> · {snapshot.source === 'desktop' ? 'Exposed folder grid' : 'Technician-provided copy'} · {new Date(snapshot.capturedAt).toLocaleTimeString()} · {snapshot.inspected} rows examined · {snapshot.unresolved} unresolved.</p>
      {snapshot.exposedRowsOnly && <p role="status">DocuTrack exposed these rows without a total. Compare the count with the Process list or use Copy All Rows to check coverage.</p>}
      {!!snapshot.unresolved && <p role="alert">Some rows could not be identified. Check them in DocuTrack.</p>}
      {!snapshot.documents.length && <p>No matching PON was readable in this snapshot. Check the current folder and filters.</p>}
      {!!snapshot.documents.length && <div className="overflow-auto max-h-80"><table className="text-sm text-left w-full"><thead><tr>{['PON', 'Document #', 'Facility / resident', 'Route', 'Iguana evidence', ''].map((h,i) => <th key={i} className="p-2">{h}</th>)}</tr></thead>
        <tbody>{snapshot.documents.map((doc, i) => <tr key={i} className="border-t"><td className="p-2 font-mono">{doc.pon}</td><td className="p-2">{doc.documentNumber || 'See stamped page'}</td><td className="p-2">{[doc.facility, doc.resident].filter(Boolean).join(' · ') || 'Check document'}</td><td className="p-2">{doc.route || '—'}</td><td className="p-2 min-w-56 text-amber-700">{edcEvidenceDescription(evidence[edcEvidenceKey(doc)])}</td><td className="p-2"><button className={reviewButtonClass} onClick={() => onFind(doc.pon)}>Find PON</button> {doc.documentNumber && <button className={reviewButtonClass} onClick={() => void copy(doc.documentNumber)}>{doc.numberSource === 'grid' ? 'Copy grid #' : 'Copy stamped #'}</button>}</td></tr>)}</tbody></table></div>}
      {!!snapshot.documents.length && <button className={reviewButtonClass} onClick={() => void copy([...new Set(snapshot.documents.map(d => d.pon))].join('\n'))}>Copy PON list</button>}
    </div>}
    <details><summary className="cursor-pointer text-sm">Use copied rows or document text</summary>
      <p className="text-sm my-2">Paste tab-separated rows with column headings, or select and copy the text of one Discontinue Rx. Use a copy from the current Richmond Process folder. Each import replaces the snapshot.</p>
      <textarea aria-label="Copied DocuTrack text" className={reviewInputClass} rows={3} value={paste} onChange={e => { setPaste(e.target.value); setConfirmed(false); }} />
      <label className="block text-sm my-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I checked that these documents are in Richmond Pharmacy → Order Processing → Process.</label>
      <button className={reviewButtonClass} disabled={busy || !paste.trim() || !confirmed} onClick={importRows}>Read copied documents</button>
    </details>
    <details><summary className="cursor-pointer text-sm">Technician refusal procedure</summary>
      <ol className="list-decimal pl-6 mt-2 space-y-1 text-sm">
        <li>In Framework, open Prescriptions → E-Rx Triage Manager. Locate the exact pending NewRx by PON. Verify facility, resident and medication. Refer controlled medications, uncertain matches and already-processed orders to the usual manual workflow.</li>
        <li>Associate the resident on the E-DC. To target a request out of sequence, move the verified NewRx to the empty ALF folder as demonstrated. The green button processes the next order in the selected folder. Recheck the open order.</li>
        <li>Choose Refuse Request and enter the original DocuTrack document number from the bottom-right stamp. Confirm the refusal in Framework.</li>
        <li>After confirmation, add a REFUSED note to the E-DC, change its status to PV1 and save. Refresh this list.</li>
      </ol>
    </details>
  </section>;
}
