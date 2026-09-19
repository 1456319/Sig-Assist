import React, { useState } from 'react';
import { SubOrderResult } from '../lib/clinical/types';
import { AbnormalityBanner } from './AbnormalityBanner';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useReviewSession } from '../hooks/use-review-session';
import { copyBlockReason, reviewStamp } from '../lib/reviewPolicy';
import { traceLogger } from '../lib/diagnostics/traceLogger';

export interface MultiOrderCardsProps {
  primarySig?: string;
  subOrders: SubOrderResult[];
  onCopySubOrder?: (subOrder: SubOrderResult, draftSig: string) => void;
}

export const MultiOrderCards: React.FC<MultiOrderCardsProps> = ({
  primarySig,
  subOrders,
  onCopySubOrder,
}) => {
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    subOrders.forEach((o) => {
      initial[o.id] = o.suggestedSig;
    });
    return initial;
  });

  const [reviewedMap, setReviewedMap] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { exclusions, policyRevision } = useReviewSession();

  const handleDraftChange = (id: string, value: string) => {
    traceLogger.debug('ui', 'MultiOrderCards', 'Technician edited draft Sig', { subOrderId: id, length: value.length });
    setDrafts((prev) => ({ ...prev, [id]: value.toUpperCase() }));
    setReviewedMap((prev) => ({ ...prev, [id]: false }));
  };

  const handleReviewToggle = (id: string, checked: boolean) => {
    traceLogger.info('ui', 'MultiOrderCards', 'Technician updated review checkbox', { subOrderId: id, reviewed: checked });
    setReviewedMap((prev) => ({ ...prev, [id]: checked }));
  };

  const handleCopy = async (subOrder: SubOrderResult) => {
    const draftSig = drafts[subOrder.id] ?? subOrder.suggestedSig;
    if (!reviewedMap[subOrder.id] || !draftSig.trim()) return;

    const isReviewed = !!reviewedMap[subOrder.id];
    const approved = isReviewed ? reviewStamp(subOrder.suggestedSig, draftSig, exclusions, policyRevision) : undefined;
    const blockReason = copyBlockReason(subOrder.suggestedSig, draftSig, exclusions, approved, false, policyRevision);
    if (blockReason) {
      traceLogger.warn('ui', 'MultiOrderCards', 'Clipboard copy blocked by review policy', { subOrderId: subOrder.id, blockReason });
      toast.error(blockReason);
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(draftSig);
        traceLogger.info('ui', 'MultiOrderCards', 'Copied sub-order Sig to clipboard', {
          subOrderId: subOrder.id,
          label: subOrder.label,
          draftSig
        });
        toast.success(`Copied ${subOrder.label} SIG to clipboard`);
        setCopiedId(subOrder.id);
        if (onCopySubOrder) {
          onCopySubOrder(subOrder, draftSig);
        }
        setTimeout(() => {
          setCopiedId(null);
        }, 2000);
      } else {
        traceLogger.warn('ui', 'MultiOrderCards', 'Clipboard API unavailable or denied', { subOrderId: subOrder.id });
        toast.error('Clipboard access denied or unavailable. Please copy manually.');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      traceLogger.error('ui', 'MultiOrderCards', 'Clipboard copy failed', { subOrderId: subOrder.id }, { name: 'ClipboardError', message: errMsg });
      toast.error('Clipboard copy failed. Please copy manually.');
    }
  };

  return (
    <div className="space-y-4">
      {primarySig && (
        <div data-testid="unified-primary-sig-card" className="rounded-lg border border-primary/30 bg-primary/5 p-3.5 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              Unified Prescription Regimen (Primary Clinical Record)
            </span>
            <span className="text-[11px] text-muted-foreground">Framework single-line summary</span>
          </div>
          <div className="font-mono text-sm font-bold text-foreground bg-background/90 rounded px-3 py-2 border border-border break-words">
            {primarySig}
          </div>
        </div>
      )}

      <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <span className="font-semibold">Paxit Multi-Order Requirement:</span>
        <p className="mt-0.5 text-slate-600 dark:text-slate-400">
          Paxit oral solids cannot have split SIGs on a single order. This medication must be entered into FrameworkLTC as separate orders (Order 1 of 2, Order 2 of 2) for automated pouch packaging. Review and copy each order card individually.
        </p>
      </div>

      {subOrders.map((subOrder) => {
        const draftSig = drafts[subOrder.id] ?? subOrder.suggestedSig;
        const isReviewed = !!reviewedMap[subOrder.id];
        const isCopied = copiedId === subOrder.id;
        const approved = isReviewed ? reviewStamp(subOrder.suggestedSig, draftSig, exclusions, policyRevision) : undefined;
        const blockReason = copyBlockReason(subOrder.suggestedSig, draftSig, exclusions, approved, false, policyRevision);

        return (
          <div
            key={subOrder.id}
            data-testid={`sub-order-card-${subOrder.id}`}
            className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {subOrder.label}
              </span>
              {isReviewed && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" /> Reviewed
                </span>
              )}
            </div>

            {subOrder.abnormalities && subOrder.abnormalities.length > 0 && (
              <AbnormalityBanner findings={subOrder.abnormalities} />
            )}

            <div>
              <label
                htmlFor={`draft-sig-${subOrder.id}`}
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                {`Draft SIG (${subOrder.label}) · editable, uppercase`}
              </label>
              <textarea
                id={`draft-sig-${subOrder.id}`}
                rows={2}
                className="w-full rounded-md border border-border bg-background p-2 font-mono text-sm uppercase focus:outline-none focus:ring-2 focus:ring-primary"
                value={draftSig}
                onChange={(e) => handleDraftChange(subOrder.id, e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`review-check-${subOrder.id}`}
                checked={isReviewed}
                onChange={(e) => handleReviewToggle(subOrder.id, e.target.checked)}
                className="rounded border-border"
              />
              <label
                htmlFor={`review-check-${subOrder.id}`}
                className="text-xs font-medium text-foreground cursor-pointer select-none"
              >
                Reviewed and approved for FrameworkLTC
              </label>
            </div>

            <div>
              {blockReason && (
                <p className="text-xs text-destructive mb-2">{blockReason}</p>
              )}
              <button
                type="button"
                disabled={!isReviewed || !draftSig.trim() || !!blockReason}
                onClick={() => handleCopy(subOrder)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
              >
                {isCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>{`Copy Reviewed SIG (${subOrder.label})`}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
