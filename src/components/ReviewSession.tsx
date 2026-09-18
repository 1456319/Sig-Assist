import { useEffect, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import type { QueueOrder } from '../lib/orderQueue';
import type { SigExclusion } from '../lib/reviewPolicy';
import { ReviewContext } from '../hooks/use-review-session';

export function ReviewSession({ children }: { children: ReactNode }) {
  // Deliberately memory-only: no patient history, drafts or preferences in browser storage.
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [policy, setPolicy] = useState({ exclusions: [] as SigExclusion[], revision: 0 });

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
