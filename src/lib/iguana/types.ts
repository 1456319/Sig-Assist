export interface IguanaLog {
  payload: string;
  channel?: string;
  logType?: string;
  logId?: string;
  refLogId?: string;
  position?: string;
  logDate?: string;
  timestamp?: string;
  captureIndex?: number;
  formatted?: boolean;
}

export interface IguanaOrderMetadata {
  messageId: string;
  messageIds: string[];
  sender: string;
  recipient?: string;
  sentTime?: string;
  scriptVersion?: string;
  patientRefType: string;
  ndc?: string;
  strength?: string;
  dose?: string;
  doseUnit?: string;
  route?: string;
  frequency?: string;
  administrationTimes: string[];
  startDate?: string;
  effectiveDate?: string;
  structuredIndication?: string;
  instructionFacts: Record<string, string[]>;
  channel?: string;
  logId?: string;
  position?: string;
}

export interface ScriptEvent {
  kind: string;
  messageId: string;
  relatesToMessageId?: string;
  sender: string;
  sentTime?: string;
  pon?: string;
  facility?: string;
  patientRef?: string;
  drug?: string;
  directions?: string;
  metadata: IguanaOrderMetadata;
  warnings: string[];
  log: Omit<IguanaLog, 'payload'>;
}

export interface DiagnosticEvent {
  seq: number;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  stage: string;
  message: string;
  details: Record<string, unknown>;
}

export type DiagnosticSink = (level: DiagnosticEvent['level'], stage: string, message: string, details?: Record<string, unknown>) => void;

export interface ConnectorConfig {
  serverUrl: string;
  username: string;
  password: string;
  authMode: 'parameters' | 'basic';
  channel: string;
  after: string;
  before: string;
  filter: string;
  limit: number;
}

export function clinicalMetadataStamp(metadata?: IguanaOrderMetadata): string {
  if (!metadata) return '';
  return JSON.stringify([metadata.ndc, metadata.strength, metadata.dose, metadata.doseUnit, metadata.route,
    metadata.frequency, metadata.administrationTimes, metadata.startDate, metadata.effectiveDate, metadata.instructionFacts]);
}
