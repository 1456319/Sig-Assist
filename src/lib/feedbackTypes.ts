import type { FeedbackDiagnostics } from './pilotDiagnostics';

export interface TechnicianFeedback {
  schemaVersion: 1;
  id: string;
  timestamp: string;
  observedAt: string;
  appVersion: string;
  buildId: string;
  screen: 'queue' | 'workbench' | 'dictionary' | 'rules' | 'expansions' | 'settings';
  category: 'general' | 'translation' | 'edc' | 'customizations' | 'connection' | 'performance';
  acceptable: 'yes' | 'no' | 'not-rated';
  quality?: 'as-shown' | 'after-correction';
  impact: 'not-rated' | 'none' | 'annoyance' | 'slowed-work' | 'blocked-work' | 'potential-order-error';
  comment: string;
  minutesLost?: number;
  diagnostics?: FeedbackDiagnostics;
}
