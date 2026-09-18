import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';
import type { QueueOrder } from '../lib/orderQueue';
import type { SigExclusion } from '../lib/reviewPolicy';

interface Session {
  orders: QueueOrder[];
  setOrders: Dispatch<SetStateAction<QueueOrder[]>>;
  exclusions: SigExclusion[];
  policyRevision: number;
  setExclusions: Dispatch<SetStateAction<SigExclusion[]>>;
}
export const ReviewContext = createContext<Session | null>(null);


export function useReviewSession() {
  const session = useContext(ReviewContext);
  if (!session) throw new Error('ReviewSession is required.');
  return session;
}
