import { useState } from 'react';
import { toast } from 'sonner';
import { downloadDesktopDiagnostics, frameworkDesktop, type FrameworkDetection } from '../lib/frameworkDesktop';
import { reviewButtonClass, reviewInputClass } from './SigReviewPanel';

export function FrameworkDetect({ disabled, onStart, onDetected }: { disabled: boolean; onStart: () => void; onDetected: (result: FrameworkDetection) => void }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Open the E-Rx in Framework, then detect it here.');
  const [evidence, setEvidence] = useState<unknown>();
  const [found, setFound] = useState<FrameworkDetection>();
  async function detect(inspect = false) {
    setBusy(true); setEvidence(undefined); setFound(undefined);
    if (!inspect) onStart();
    setStatus('Reading Framework in this Windows session…');
    try {
      const result = await frameworkDesktop(inspect ? 'inspect' : 'detect');
      setEvidence(result.diagnostics);
      if (!result.ok) { setStatus(result.error || 'Framework could not be detected.'); return; }
      if (inspect) { downloadDesktopDiagnostics(result.diagnostics); setStatus('Desktop diagnostics saved. They contain visible order information.'); }
      else {
        setFound(result); onDetected(result);
        setStatus(result.pon ? `Detected PON ${result.pon}. Select the matching E-Rx below.` : result.pons?.length ? `${result.pons.length} PONs detected. Choose which one to find; sending remains available after review.` : 'No labelled PON was exposed. Use the search below; you can still choose a Framework field and send after review.');
      }
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  return <div className="rounded-md border border-primary/40 p-3 space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={`${reviewButtonClass} bg-primary text-primary-foreground`} disabled={disabled || busy} onClick={() => void detect()}>Detect open E-Rx</button>
      <span className="text-xs text-muted-foreground">Windows desktop integration · pilot</span>
    </div>
    <p className="text-sm" role="status">{status}</p>
    {(found?.pons?.length ?? 0) > 1 && <div role="alert" className="text-sm text-amber-600 dark:text-amber-400 space-y-2"><p>Multiple PONs detected. Check the intended order.</p><div className="flex flex-wrap gap-2">{found!.pons!.map(pon => <button type="button" className={reviewButtonClass} key={pon} disabled={disabled || busy} onClick={() => onDetected({ ...found!, pon })}>Find PON {pon}</button>)}</div></div>}
    <details><summary className="text-xs cursor-pointer">Framework detection help</summary>
      <p className="text-xs text-muted-foreground my-2">Run the connector inside the same Windows/Citrix session as Framework. Detection depends on the fields that this Framework screen exposes. If it cannot find the order, keep that screen open and export desktop diagnostics. The export includes order text; share it with your diagnostic report.</p>
      <button type="button" className={reviewButtonClass} disabled={disabled || busy} onClick={() => evidence ? downloadDesktopDiagnostics(evidence) : void detect(true)}>Export desktop diagnostics</button>
    </details>
  </div>;
}

export function AdministrationTimes({ times }: { times: string[] }) {
  const text = times.join(', ');
  return <aside aria-label="Incoming E-Rx administration times" className="rounded-lg border-2 border-primary/50 bg-primary/5 p-4 space-y-2">
    <h4 className="font-semibold">E-Rx administration times</h4>
    <p className="text-xl font-mono font-semibold whitespace-pre-wrap">{text || 'Not supplied in the E-Rx'}</p>
    <p className="text-xs text-muted-foreground">{text ? 'Exact incoming schedule. Compare it with Framework’s administration schedule when reviewing the SIG.' : 'No administration time was supplied in the structured E-Rx fields. Check the original directions; no time has been inferred.'}</p>
    {!!text && <button type="button" className={reviewButtonClass} onClick={async () => {
      try { await navigator.clipboard.writeText(text); toast.success('Incoming administration times copied.'); }
      catch { toast.error('Clipboard unavailable. Select the displayed times and copy them manually.'); }
    }}>Copy incoming times</button>}
  </aside>;
}

export function FrameworkTransfer({ detected, pon, sig, blocked, parts = [], times, onDetected }: {
  detected?: FrameworkDetection; pon: string; sig: string; blocked: string | undefined;
  parts?: { id: string; label: string; sig: string; blocked?: string }[]; times: string[];
  onDetected: (result?: FrameworkDetection) => void;
}) {
  const [matched, setMatched] = useState(false);
  const [partId, setPartId] = useState('');
  const [timeDraft, setTimeDraft] = useState(times.join(', '));
  const [timesApproved, setTimesApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const part = parts.find(item => item.id === partId) ?? parts[0];
  const effectiveSig = part?.sig ?? sig;
  const blockReason = part ? part.blocked : blocked;
  const canLive = ['http:', 'https:'].includes(location.protocol);
  const pons = detected?.pons ?? (detected?.pon ? [detected.pon] : []);
  async function choose(field: 'sig' | 'times') {
    setBusy(true); setStatus(`Click directly inside Framework’s ${field === 'sig' ? 'SIG' : 'administration-times'} field within 8 seconds. This only identifies the field; come back here to send.`);
    try {
      const result = await frameworkDesktop('target', { field });
      if (!result.ok) { setStatus(result.error || 'The field could not be identified.'); return; }
      onDetected(result);
      toast.success('Destination identified. Check its current text, then send.');
    } catch (error) { setStatus(String(error)); }
    finally { setBusy(false); }
  }
  async function send(field: 'sig' | 'times') {
    if (busy || !matched || !!blockReason || (field === 'times' && (!timesApproved || !timeDraft.trim()))) return;
    // A missing/expired mapping starts a read-only field selection. It does not
    // silently choose another window or write into the current global focus.
    if (!detected?.token || !detected.fields?.[field] || !detected.expiresAt || detected.expiresAt < Date.now()) { await choose(field); return; }
    setBusy(true); setStatus('Sending to the identified Framework field…');
    try {
      const result = await frameworkDesktop('send', { token: detected.token, pon, field, value: field === 'sig' ? effectiveSig : timeDraft, approved: true, matched });
      if (!result.ok || !result.verified) {
        onDetected(undefined);
        toast.error(`${result.error || 'Transfer could not be verified.'}${result.uncertain ? ' Inspect Framework before retrying.' : ''}`);
        return;
      }
      onDetected(result.next);
      toast.success(`${field === 'sig' ? 'SIG' : 'Administration times'} entered and read back. Verify Framework Preview Sig and schedule; the prescription has not been saved.`);
      for (const warning of result.warnings ?? []) toast.warning(warning);
      setStatus('Text entered and read back. Verify Framework Preview Sig and schedule before saving.');
    } catch (error) { onDetected(undefined); toast.error(`${String(error)} Inspect Framework before retrying; the result is unknown.`); }
    finally { setBusy(false); }
  }
  return <section aria-label="Send to Framework" className="rounded-lg border border-primary/40 p-3 space-y-3">
    <h4 className="font-semibold">Send to Framework</h4>
    {pons.length > 1 && <p role="alert" className="text-sm text-amber-600 dark:text-amber-400">Multiple PONs detected: {pons.join(', ')}. Check the intended order. Sending remains available.</p>}
    {pons.length === 1 && pons[0] !== pon && <p role="alert" className="text-sm text-amber-600 dark:text-amber-400">Detected PON {pons[0]} differs from selected PON {pon}. Verify the intended order before sending.</p>}
    {parts.length > 0 && <label className="block text-sm">Order part to send<select className={reviewInputClass} disabled={busy} value={part?.id ?? ''} onChange={event => setPartId(event.target.value)}>{parts.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><span className="block font-mono text-xs mt-1">{effectiveSig}</span></label>}
    <label className="flex gap-2 items-start text-sm"><input type="checkbox" role="switch" checked={matched} disabled={busy} onChange={event => setMatched(event.target.checked)} />I matched this patient, drug and PON with the intended Framework order and destination.</label>
    {detected?.fields?.sig && <p className="text-xs text-muted-foreground whitespace-pre-wrap">Destination: {detected.fields.sig.label || 'Technician-selected text field'} · Current Framework SIG: {detected.fields.sig.currentValue || '(empty)'}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className={reviewButtonClass} disabled={!canLive || busy || !matched || !!blockReason} onClick={() => void send('sig')}>Send approved SIG to Framework</button>
      <button type="button" className={reviewButtonClass} disabled={!canLive || busy} onClick={() => void choose('sig')}>Choose Framework SIG field</button>
    </div>
    {blockReason && <p className="text-xs text-muted-foreground">{blockReason}</p>}
    {!detected?.fields?.sig && <p className="text-xs text-muted-foreground">Sending is available after review. If the field is not identified automatically, choose it once by clicking inside Framework’s SIG field, then return here to send.</p>}
    <details><summary className="cursor-pointer text-sm">Transfer administration times</summary>
      <div className="space-y-2 mt-2">
        {detected?.fields?.times && <p className="text-xs">Current Framework times: {detected.fields.times.currentValue || '(empty)'}</p>}
        <label className="block text-sm">Administration times to send<input className={reviewInputClass} value={timeDraft} disabled={busy} onChange={event => { setTimeDraft(event.target.value); setTimesApproved(false); }} /></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" role="switch" checked={timesApproved} disabled={busy || !timeDraft.trim()} onChange={event => setTimesApproved(event.target.checked)} />I checked these times against the E-Rx and Framework’s schedule format.</label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={reviewButtonClass} disabled={!canLive || busy || !matched || !!blockReason || !timesApproved || !timeDraft.trim()} onClick={() => void send('times')}>Send approved times to Framework</button>
          <button type="button" className={reviewButtonClass} disabled={!canLive || busy} onClick={() => void choose('times')}>Choose Framework times field</button>
        </div>
        <p className="text-xs text-muted-foreground">Choose an editable times text field. Grid schedules may require entry in Framework.</p>
      </div>
    </details>
    {!canLive && <p className="text-sm">Launch Start-Iguana-Connector.bat to send to Framework.</p>}
    <p className="text-xs text-muted-foreground">The technician decides which order receives the approved text. Transfer verifies the destination text; preview and save in Framework.</p>
    {!!status && <p className="text-sm" role="status">{status}</p>}
  </section>;
}
