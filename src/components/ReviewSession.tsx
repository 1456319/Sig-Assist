import { useEffect, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import type { QueueOrder } from '../lib/orderQueue';
import type { SigExclusion } from '../lib/reviewPolicy';
import { ReviewContext } from '../hooks/use-review-session';
import { getCitrixStorageAdapter, StoredQueueOrder } from '../lib/citrixStorage';
import { getCachedClinicalSig } from '../lib/clinical/clinicalEngine';
import { toast } from 'sonner';

export function ReviewSession({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [policy, setPolicy] = useState({ exclusions: [] as SigExclusion[], revision: 0 });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    Promise.all([
      getCitrixStorageAdapter().readQueue(),
      getCitrixStorageAdapter().readPreferences(),
    ]).then(([stored, prefs]) => {
      if (stored && stored.length > 0) {
        setOrders(stored.map(o => ({
          ...o,
          facility: o.facility || 'UNKNOWN',
          patientRef: o.patientRef || 'UNKNOWN',
          directions: o.rawProse,
          drug: o.drugName,
          revision: o.revision || 1,
          previousSources: o.previousSources || [],
          cancelled: o.cancelled || false,
          draft: o.draftSig,
          approved: o.approved,
          copied: o.copied,
          defaultSig: o.defaultSig,
          subOrderDrafts: o.subOrderDrafts,
          subOrderApprovals: o.subOrderApprovals,
          subOrderCopied: o.subOrderCopied,
        } as QueueOrder)));
      }
      if (prefs) {
        setPolicy({
          exclusions: prefs.exclusions || [],
          revision: prefs.policyRevision || 0,
        });
      }
      setIsHydrated(true);
    }).catch(err => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to initialize session storage: ${msg}`);
      setIsHydrated(true);
    });
  }, []);

  useEffect(() => {
    const reconcileStorage = async () => {
      try {
        const [stored, prefs] = await Promise.all([
          getCitrixStorageAdapter().readQueue({ bypassPending: true }),
          getCitrixStorageAdapter().readPreferences({ bypassPending: true }),
        ]);
        if (stored && stored.length > 0) {
          setOrders(currentOrders => {
            const orderMap = new Map<string, QueueOrder>();
            stored.forEach(o => {
              orderMap.set(o.id, {
                ...o,
                facility: o.facility || 'UNKNOWN',
                patientRef: o.patientRef || 'UNKNOWN',
                directions: o.rawProse,
                drug: o.drugName,
                revision: o.revision || 1,
                previousSources: o.previousSources || [],
                cancelled: o.cancelled || false,
                draft: o.draftSig,
                approved: o.approved,
                copied: o.copied,
                defaultSig: o.defaultSig,
                subOrderDrafts: o.subOrderDrafts,
                subOrderApprovals: o.subOrderApprovals,
                subOrderCopied: o.subOrderCopied,
              } as QueueOrder);
            });
            currentOrders.forEach(local => {
              const remote = orderMap.get(local.id);
              if (!remote) {
                orderMap.set(local.id, local);
              } else {
                // Cancellation precedence: cancellation is a terminal lifecycle state
                const isCancelled = Boolean(remote.cancelled || local.cancelled);
                if (local.revision > remote.revision) {
                  orderMap.set(local.id, {
                    ...local,
                    cancelled: isCancelled
                  });
                } else {
                  const hasLocalSplitEdits = Boolean(
                    (local.subOrderDrafts && Object.keys(local.subOrderDrafts).length > 0) ||
                    (local.subOrderApprovals && Object.keys(local.subOrderApprovals).length > 0) ||
                    (local.subOrderCopied && Object.keys(local.subOrderCopied).length > 0)
                  );
                  if (local.revision === remote.revision && (local.approved || local.copied || local.draft !== remote.draft || hasLocalSplitEdits)) {
                    orderMap.set(local.id, {
                      ...local,
                      cancelled: isCancelled
                    });
                  } else {
                    orderMap.set(local.id, {
                      ...remote,
                      cancelled: isCancelled
                    });
                  }
                }
              }
            });
            return Array.from(orderMap.values());
          });
        }
        if (prefs && (prefs.exclusions || prefs.policyRevision !== undefined)) {
          setPolicy(prev => ({
            exclusions: prefs.exclusions || prev.exclusions,
            revision: Math.max(prefs.policyRevision || 0, prev.revision)
          }));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Storage reconciliation error: ${msg}`);
      }
    };

    const unsub = getCitrixStorageAdapter().onDirectoryConnected?.(reconcileStorage);
    return () => {
      unsub?.();
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    getCitrixStorageAdapter().readPreferences().then(prefs => {
      getCitrixStorageAdapter().writePreferences({
        ...prefs,
        exclusions: policy.exclusions,
        policyRevision: policy.revision,
      }).catch(err => {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Failed to save preferences to storage: ${msg}`);
      });
    }).catch(err => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to read preferences from storage: ${msg}`);
    });
  }, [policy, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    const storedOrders: StoredQueueOrder[] = orders.map(o => {
      let isReviewed = Boolean(o.approved);
      let isCompleted = Boolean(o.copied);

      try {
        const clinical = getCachedClinicalSig({
          id: o.id,
          pon: o.pon,
          drugName: o.drug,
          rawProse: o.directions,
          defaultSigTemplate: o.defaultSig,
          sourceFormat: 'manual_text',
        }, { exclusions: policy.exclusions });
        if (clinical.subOrders.length > 1) {
          const allApproved = clinical.subOrders.every(sub => Boolean(o.subOrderApprovals?.[sub.id]));
          const allCopied = allApproved && clinical.subOrders.every(sub => Boolean(o.subOrderCopied?.[sub.id]));
          isReviewed = allApproved;
          isCompleted = allCopied;
        }
      } catch {
        const subOrderDraftKeys = o.subOrderDrafts ? Object.keys(o.subOrderDrafts) : [];
        const subOrderApprovalKeys = o.subOrderApprovals ? Object.keys(o.subOrderApprovals) : [];
        const subOrderCopiedKeys = o.subOrderCopied ? Object.keys(o.subOrderCopied) : [];

        if (subOrderDraftKeys.length > 1 || subOrderApprovalKeys.length > 1 || subOrderCopiedKeys.length > 1) {
          const allIds = Array.from(new Set([...subOrderDraftKeys, ...subOrderApprovalKeys, ...subOrderCopiedKeys]));
          if (allIds.length > 0) {
            const allApproved = allIds.every(id => Boolean(o.subOrderApprovals?.[id]));
            const allCopied = allApproved && allIds.every(id => Boolean(o.subOrderCopied?.[id]));
            isReviewed = allApproved;
            isCompleted = allCopied;
          }
        }
      }

      const status: 'pending' | 'completed' | 'skipped' = o.cancelled ? 'skipped' : (isCompleted ? 'completed' : 'pending');

      return {
        id: o.id,
        pon: o.pon,
        drugName: o.drug,
        rawProse: o.directions,
        suggestedSig: o.draft,
        draftSig: o.draft,
        isReviewed,
        status,
        facility: o.facility,
        patientRef: o.patientRef,
        revision: o.revision,
        previousSources: o.previousSources,
        cancelled: o.cancelled,
        intakeHold: o.intakeHold,
        approved: o.approved,
        copied: o.copied,
        defaultSig: o.defaultSig,
        iguana: o.iguana,
        subOrderDrafts: o.subOrderDrafts,
        subOrderApprovals: o.subOrderApprovals,
        subOrderCopied: o.subOrderCopied,
      };
    });

    getCitrixStorageAdapter().writeQueue(storedOrders).catch(err => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to save order queue to storage: ${msg}`);
    });
  }, [orders, isHydrated, policy.exclusions]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (orders.length > 0) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [orders.length]);

  const setExclusions: Dispatch<SetStateAction<SigExclusion[]>> = action => setPolicy(previous => ({
    exclusions: typeof action === 'function' ? action(previous.exclusions) : action, revision: previous.revision + 1,
  }));
  return <ReviewContext.Provider value={{ ready: isHydrated, orders, setOrders, exclusions: policy.exclusions, policyRevision: policy.revision, setExclusions }}>{children}</ReviewContext.Provider>;
}
