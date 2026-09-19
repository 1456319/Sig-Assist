import { useEffect, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import type { QueueOrder } from '../lib/orderQueue';
import type { SigExclusion } from '../lib/reviewPolicy';
import { ReviewContext } from '../hooks/use-review-session';
import { getCitrixStorageAdapter, StoredQueueOrder } from '../lib/citrixStorage';

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
        } as QueueOrder)));
      }
      if (prefs && (prefs.exclusions || prefs.policyRevision !== undefined)) {
        setPolicy({
          exclusions: prefs.exclusions || [],
          revision: prefs.policyRevision || 0,
        });
      }
      setIsHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    getCitrixStorageAdapter().readPreferences().then(prefs => {
      getCitrixStorageAdapter().writePreferences({
        ...prefs,
        exclusions: policy.exclusions,
        policyRevision: policy.revision,
      });
    });
  }, [policy, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    const storedOrders: StoredQueueOrder[] = orders.map(o => ({
      id: o.id,
      pon: o.pon,
      drugName: o.drug,
      rawProse: o.directions,
      suggestedSig: o.draft,
      draftSig: o.draft,
      isReviewed: !!o.approved,
      status: o.cancelled ? 'skipped' : (o.copied ? 'completed' : 'pending'),
      facility: o.facility,
      patientRef: o.patientRef,
      revision: o.revision,
      previousSources: o.previousSources,
      cancelled: o.cancelled,
      approved: o.approved,
      copied: o.copied,
      defaultSig: o.defaultSig,
    }));
    getCitrixStorageAdapter().writeQueue(storedOrders);
  }, [orders, isHydrated]);

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
  return <ReviewContext.Provider value={{ orders, setOrders, exclusions: policy.exclusions, policyRevision: policy.revision, setExclusions }}>{children}</ReviewContext.Provider>;
}
