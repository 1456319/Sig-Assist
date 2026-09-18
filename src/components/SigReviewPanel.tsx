import { useId, useState } from 'react';
import { toast } from 'sonner';
import { copyBlockReason, excludedMatches, finalSig, reviewStamp, type SigExclusion } from '../lib/reviewPolicy';
import { useReviewSession } from '../hooks/use-review-session';

export const reviewInputClass = 'w-full rounded-md border border-border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary';
export const reviewButtonClass = 'rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed';

interface Props {
  source: string;
  suggestion: string;
  draft: string;
  approved?: string;
  unavailable?: boolean;
  warnings: string[];
  onEdit: (draft: string) => void;
  onApprove: (stamp?: string) => void;
  onCopied?: (stamp: string) => void;
}

export function SigReviewPanel({ source, suggestion, draft, approved, unavailable = false, warnings, onEdit, onApprove, onCopied }: Props) {
  const { exclusions, setExclusions, policyRevision } = useReviewSession();
  const [code, setCode] = useState('');
  const [copying, setCopying] = useState(false);
  const id = useId();
  const stamp = reviewStamp(source, draft, exclusions, policyRevision);
  const reviewed = approved === stamp;
  const reason = copyBlockReason(source, draft, exclusions, approved, unavailable, policyRevision);
  const suggestionExcluded = excludedMatches(suggestion, exclusions).length > 0;

  function exclude(exclusion: SigExclusion) {
    const value = finalSig(exclusion.value).replace(/\s+/g, ' ');
    if (!value) return;
    setExclusions(items => items.some(item => item.kind === exclusion.kind && item.value === value)
      ? items : [...items, { ...exclusion, value }]);
    onApprove(undefined);
    setCode('');
  }

  async function copy() {
    // Recheck at the clipboard boundary; the disabled button is not the policy.
    if (copyBlockReason(source, draft, exclusions, approved, unavailable, policyRevision)) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(finalSig(draft));
      onCopied?.(stamp);
      toast.success('Reviewed SIG copied. Match the PON and preview it in Framework.');
    } catch {
      toast.error('Clipboard unavailable. Select the reviewed final SIG and copy it manually.');
    } finally {
      setCopying(false);
    }
  }

  return <div className="space-y-4">
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <h3 className="text-sm font-semibold">Draft suggestion · review required</h3>
      <p className="font-mono text-sm whitespace-pre-wrap">{suggestionExcluded ? 'Suggestion excluded for this session.' : finalSig(suggestion) || 'No complete suggestion. Enter a corrected SIG below.'}</p>
      <p className="text-xs text-muted-foreground">Compare every source clause. The parser can omit instructions; a suggestion is not a verified prescription.</p>
      {warnings.length > 0 && <ul className="list-disc pl-5 text-sm text-amber-600 dark:text-amber-400">{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
    </div>
    <div>
      <label htmlFor={`${id}-draft`} className="block text-sm font-medium mb-1">Final SIG · editable, uppercase</label>
      <textarea id={`${id}-draft`} rows={4} className={`${reviewInputClass} font-mono`} value={draft} disabled={unavailable} onChange={event => onEdit(event.target.value.toUpperCase())} />
    </div>
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1" checked={reviewed} disabled={unavailable || !draft.trim() || excludedMatches(draft, exclusions).length > 0} onChange={event => onApprove(event.target.checked ? stamp : undefined)} />
      I matched the order and checked all original directions, warnings and the final SIG. I will verify Framework Preview Sig and its quantity, schedule and days’ supply effects.
    </label>
    <div className="flex flex-wrap gap-2">
      <button className={`${reviewButtonClass} bg-primary text-primary-foreground`} disabled={!!reason || copying} onClick={copy}>Copy reviewed SIG</button>
      <button className={reviewButtonClass} disabled={!draft.trim()} onClick={() => exclude({ kind: 'sig', value: draft })}>Never use this SIG · session</button>
    </div>
    {reason && <p className="text-xs text-muted-foreground" role="status">{reason}</p>}
    <details className="rounded-lg border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">Session exclusions ({exclusions.length})</summary>
      <p className="text-xs text-muted-foreground my-2">Temporary preferences for this tab, shared by the queue and workbench. No substitutions are made. Reload clears them.</p>
      <div className="flex gap-2">
        <input aria-label="SIG code to exclude" value={code} onChange={event => setCode(event.target.value.toUpperCase())} className={reviewInputClass} placeholder="Code, e.g. QD" />
        <button className={reviewButtonClass} disabled={!code.trim() || /\s/.test(code.trim())} onClick={() => exclude({ kind: 'code', value: code })}>Exclude code</button>
      </div>
      <ul className="mt-2 space-y-2">{exclusions.map((item, index) => <li key={`${item.kind}:${item.value}`} className="flex items-center justify-between gap-3 text-sm">
        <span className="break-all">{item.kind === 'code' ? 'Code' : 'SIG'}: {item.value}</span>
        <button className={reviewButtonClass} onClick={() => setExclusions(items => items.filter((_, position) => position !== index))}>Undo</button>
      </li>)}</ul>
    </details>
  </div>;
}
