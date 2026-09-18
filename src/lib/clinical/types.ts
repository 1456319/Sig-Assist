export interface InboundOrder {
  readonly id: string;
  readonly pon: string;
  readonly drugName: string;
  readonly rawProse: string;
  readonly defaultSigTemplate?: string;
  readonly indication?: string;
  readonly sourceFormat: 'ncpdp_xml' | 'manual_text';
}

export type AbnormalityTier = 'uncorrected_gap' | 'applied_correction' | 'potential_error';

export interface AbnormalityFinding {
  readonly id: string;
  readonly tier: AbnormalityTier;
  readonly title: string;
  readonly message: string;
  readonly correction?: string;
  readonly trigger?: string;
}

export interface SubOrderResult {
  readonly id: string;
  readonly label: string;
  readonly suggestedSig: string;
  readonly abnormalities: AbnormalityFinding[];
}

export interface ClinicalSigResult {
  readonly primarySig: string;
  readonly subOrders: SubOrderResult[];
  readonly abnormalities: AbnormalityFinding[];
}

export interface DiscrepancyReport {
  readonly id: string;
  readonly timestamp: string;
  readonly pon: string;
  readonly drugName: string;
  readonly rawProse: string;
  readonly generatedSig: string;
  readonly technicianSig: string;
  readonly notes: string;
  readonly flaggedForRph: boolean;
}

export interface TechnicianPreferences {
  readonly version: 1;
  readonly drugCodeOverrides: Record<string, string>;
  readonly defaultAdminTimes: Record<string, string>;
}
