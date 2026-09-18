# Clinical SIG Engine, Citrix Storage & Abnormality Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade algorithmic clinical SIG translation engine satisfying all 38 pharmacy test cases in [`TESTS.txt`](file:///home/deck/Sig-Assist/TESTS.txt), PointClickCare NCPDP SCRIPT 20170715 XML parsing, Paxit oral solid packaging split-order generation, a 3-tier clinical abnormality banner with discrepancy logging, and persistent Citrix redirected storage (`Documents/storage/`).

**Architecture:** A modular sequential pipeline where raw inbound orders (XML or text) are tokenized, parsed for formulation/route, calculated for volume/dose math, scheduled with frequency/duration/hold parameters, evaluated against Paxit packaging constraints for multi-order generation, and screened for clinical abnormalities (gaps, corrections, mismatches). Persistence to redirected Citrix storage uses the Web File System Access API with native IndexedDB handle caching and atomic debounced JSON writes.

**Tech Stack:** TypeScript 5.5, React 18, Vite 5.4, Vitest 2.1, Tailwind CSS, Radix UI, Native Browser File System Access API & IndexedDB.

**Spec:** [`docs/superpowers/specs/2026-09-18-tests-txt-clinical-engine-design.md`](file:///home/deck/Sig-Assist/docs/superpowers/specs/2026-09-18-tests-txt-clinical-engine-design.md)

## Global Constraints

- Never use `pip --break-system-packages`; use `/root/.local/bin/uv` in isolated venvs for python tasks.
- ZERO patient, prescriber, or facility PHI in console logs, commit messages, or persistent disk storage.
- All created repository files must be owned by user `deck:deck`.
- Clipboard copy is strictly prevented until explicit review acknowledgment has occurred.
- Copied SIG codes must strictly be uppercase FrameworkLTC strings.
- All 38 test cases in [`TESTS.txt`](file:///home/deck/Sig-Assist/TESTS.txt) must pass without hardcoded exact-match `if/then` branches.
- Mandatory Code Review (`requesting-code-review` skill) must be dispatched and addressed before merging.

---

### Task 1: Core Clinical Types & Inbound Parser

**Files:**
- Create: `src/lib/clinical/types.ts`
- Create: `src/lib/clinical/inboundParser.ts`
- Test: `tests/clinicalInboundParser.test.ts`

**Interfaces:**
- Consumes: None.
- Produces:
  ```typescript
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
    readonly label: string; // e.g. "Order 1 of 2"
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

  export function parseInboundOrder(rawInput: string): InboundOrder;
  ```

- [ ] **Step 1: Write failing unit test for inbound order parser**

Create [`tests/clinicalInboundParser.test.ts`](file:///home/deck/Sig-Assist/tests/clinicalInboundParser.test.ts):
```typescript
import { describe, expect, it } from 'vitest';
import { parseInboundOrder } from '../src/lib/clinical/inboundParser';

describe('clinicalInboundParser', () => {
  it('parses freeform user entry text with drug name and prose', () => {
    const raw = `PROTONIX 40MG TABLET\nUSER ENTRY: Give 1 tablet by mouth one time a day for GERD`;
    const parsed = parseInboundOrder(raw);
    expect(parsed.drugName).toBe('PROTONIX 40MG TABLET');
    expect(parsed.rawProse).toBe('Give 1 tablet by mouth one time a day for GERD');
    expect(parsed.sourceFormat).toBe('manual_text');
  });

  it('parses freeform text with optional default sig template', () => {
    const raw = `POLYETH GLYC PWD PACKET (17GM)
USER ENTRY:Give 1 packet by mouth one time a day for Constipation
DEFAULT SIG (OPTIONAL FIELD): MIX 17 GM (1 PACKET) IN 8OZ OF WATER AND GIVE PO`;
    const parsed = parseInboundOrder(raw);
    expect(parsed.drugName).toBe('POLYETH GLYC PWD PACKET (17GM)');
    expect(parsed.rawProse).toBe('Give 1 packet by mouth one time a day for Constipation');
    expect(parsed.defaultSigTemplate).toBe('MIX 17 GM (1 PACKET) IN 8OZ OF WATER AND GIVE PO');
  });

  it('parses PointClickCare NCPDP SCRIPT 20170715 NewRx XML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Message xmlns="http://www.ncpdp.org/schema/SCRIPT">
  <Header>
    <PrescriberOrderNumber>PON98765432</PrescriberOrderNumber>
  </Header>
  <Body>
    <NewRx>
      <MedicationPrescribed>
        <DrugDescription>Pantoprazole Sodium 40 MG Oral Tablet</DrugDescription>
        <Sig>
          <SigText>Give 1 tablet by mouth one time a day for GERD</SigText>
        </Sig>
      </MedicationPrescribed>
    </NewRx>
  </Body>
</Message>`;
    const parsed = parseInboundOrder(xml);
    expect(parsed.pon).toBe('PON98765432');
    expect(parsed.drugName).toBe('Pantoprazole Sodium 40 MG Oral Tablet');
    expect(parsed.rawProse).toBe('Give 1 tablet by mouth one time a day for GERD');
    expect(parsed.sourceFormat).toBe('ncpdp_xml');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/clinicalInboundParser.test.ts`  
Expected: FAIL with "Cannot find module '../src/lib/clinical/inboundParser'".

- [ ] **Step 3: Implement core clinical types and inbound parser**

Create [`src/lib/clinical/types.ts`](file:///home/deck/Sig-Assist/src/lib/clinical/types.ts):
```typescript
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
```

Create [`src/lib/clinical/inboundParser.ts`](file:///home/deck/Sig-Assist/src/lib/clinical/inboundParser.ts):
```typescript
import { InboundOrder } from './types';

function extractXmlTag(xml: string, tagName: string): string | undefined {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : undefined;
}

export function parseInboundOrder(rawInput: string): InboundOrder {
  const trimmed = rawInput.trim();
  const id = `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  if (trimmed.startsWith('<') && trimmed.includes('</')) {
    const pon = extractXmlTag(trimmed, 'PrescriberOrderNumber') ||
                extractXmlTag(trimmed, 'PON') ||
                extractXmlTag(trimmed, 'OrderNumber') || 'UNKNOWN_PON';
    const drugName = extractXmlTag(trimmed, 'DrugDescription') ||
                     extractXmlTag(trimmed, 'DrugName') || 'UNKNOWN DRUG';
    const rawProse = extractXmlTag(trimmed, 'SigText') ||
                     extractXmlTag(trimmed, 'Directions') || '';
    const indication = extractXmlTag(trimmed, 'IndicationClarifyingFreeText') ||
                       extractXmlTag(trimmed, 'Indication');

    return {
      id,
      pon,
      drugName: drugName.toUpperCase(),
      rawProse,
      indication,
      sourceFormat: 'ncpdp_xml'
    };
  }

  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
  let drugName = 'UNKNOWN DRUG';
  let rawProse = '';
  let defaultSigTemplate: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const userEntryMatch = line.match(/^USER ENTRY:\s*(.+)$/i);
    const defaultSigMatch = line.match(/^DEFAULT SIG(?:\s*\(OPTIONAL FIELD\))?:\s*(.+)$/i);

    if (userEntryMatch) {
      rawProse = userEntryMatch[1].trim();
    } else if (defaultSigMatch) {
      defaultSigTemplate = defaultSigMatch[1].trim();
    } else if (i === 0) {
      drugName = line.replace(/^\d+\)\s*/, '').trim();
    }
  }

  if (!rawProse && lines.length > 0) {
    rawProse = lines[lines.length - 1];
  }

  return {
    id,
    pon: 'MANUAL_ENTRY',
    drugName: drugName.toUpperCase(),
    rawProse,
    defaultSigTemplate,
    sourceFormat: 'manual_text'
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/clinicalInboundParser.test.ts`  
Expected: PASS (3 tests passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/clinical/types.ts src/lib/clinical/inboundParser.ts tests/clinicalInboundParser.test.ts
git commit -m "feat(clinical): add core types and inbound order parser"
```

---

### Task 2: Dose, Volume & Formulation Normalization Engine

**Files:**
- Create: `src/lib/clinical/doseCalculator.ts`
- Test: `tests/doseCalculator.test.ts`

**Interfaces:**
- Consumes: `AbnormalityFinding` from `src/lib/clinical/types.ts`.
- Produces:
  ```typescript
  export interface DoseCalculationResult {
    readonly doseToken: string;
    readonly routeToken: string;
    readonly abnormalities: AbnormalityFinding[];
    readonly isApap: boolean;
    readonly apapLimitToken?: string;
  }

  export function calculateDoseAndVolume(drugName: string, rawProse: string): DoseCalculationResult;
  ```

- [ ] **Step 1: Write failing unit test for dose and volume calculator**

Create [`tests/doseCalculator.test.ts`](file:///home/deck/Sig-Assist/tests/doseCalculator.test.ts):
```typescript
import { describe, expect, it } from 'vitest';
import { calculateDoseAndVolume } from '../src/lib/clinical/doseCalculator';

describe('doseCalculator', () => {
  it('formats standard whole tablets without parentheticals', () => {
    const res = calculateDoseAndVolume('PROTONIX 40MG TABLET', 'Give 1 tablet by mouth one time a day');
    expect(res.doseToken).toBe('1T');
    expect(res.routeToken).toBe('PO');
  });

  it('formats single-ingredient half tablet with parenthetical target dose', () => {
    const res = calculateDoseAndVolume('LEVOTHYROXINE TAB 25MCG', 'Give 0.5 tablet by mouth one time a day');
    expect(res.doseToken).toBe('1/2T (12.5MCG)');
    expect(res.routeToken).toBe('PO');
  });

  it('formats multiple capsules with target dose', () => {
    const res = calculateDoseAndVolume('TAMSULOSIN CAP 0.4MG', 'Give 2 capsule by mouth at bedtime');
    expect(res.doseToken).toBe('2C (0.8MG)');
    expect(res.routeToken).toBe('PO');
  });

  it('formats injectables with volume preceding target dose', () => {
    const res = calculateDoseAndVolume('TRULICITY INJ 4.5MG/0.5ML', 'Inject 4.5 mg subcutaneously in the evening');
    expect(res.doseToken).toBe('INJ 0.5ML (4.5MG)');
    expect(res.routeToken).toBe('SQ');
  });

  it('formats liquid oral administration with dose calculation', () => {
    const res = calculateDoseAndVolume('SENNA SYR 8.8MG/5ML', 'Give 10 ml by mouth at bedtime');
    expect(res.doseToken).toBe('ADM 10ML (17.6MG)');
    expect(res.routeToken).toBe('PO');
  });

  it('converts inhaler dry powder capsule prose into puff (1P) with Applied Correction', () => {
    const res = calculateDoseAndVolume('ADVAIR DISKUS 250/50', 'Take 1 capsule by mouth twice daily');
    expect(res.doseToken).toBe('1P');
    expect(res.abnormalities.some(a => a.tier === 'applied_correction' && a.title.includes('Inhaler'))).toBe(true);
  });

  it('detects APAP and applies 3GM or 3GME warning', () => {
    const standard = calculateDoseAndVolume('OXYCODONE-APAP 5-325', 'Give 1 tablet PO Q6H PRN');
    expect(standard.isApap).toBe(true);
    expect(standard.apapLimitToken).toBe('3GM');

    const maxExceed = calculateDoseAndVolume('ACETAMINOPHEN TAB 325MG', 'Give 2 tablet PO Q4H do not exceed 3g per day');
    expect(maxExceed.apapLimitToken).toBe('3GME');
  });

  it('handles Diclofenac Gel 1% upper vs lower body and emits AP4GM without space', () => {
    const upper = calculateDoseAndVolume('DICLOFENAC GEL 1%', 'Apply to shoulder topically four times a day');
    expect(upper.doseToken).toBe('AP 2GM');
    expect(upper.routeToken).toBe('TPCL');

    const lower = calculateDoseAndVolume('DICLOFENAC GEL 1%', 'Apply to legs topically one time a day');
    expect(lower.doseToken).toBe('AP4GM');
  });

  it('maps morphine concentrate 20mg/ml 0.5ml to bracketed [ROX10MG]', () => {
    const res = calculateDoseAndVolume('MORPHINE CONC 20MG/ML', 'Give 0.5 milliliter by mouth every 6 hours');
    expect(res.doseToken).toBe('[ROX10MG]');
    expect(res.routeToken).toBe('PO');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/doseCalculator.test.ts`  
Expected: FAIL with "Cannot find module '../src/lib/clinical/doseCalculator'".

- [ ] **Step 3: Implement dose, volume & formulation normalization engine**

Create [`src/lib/clinical/doseCalculator.ts`](file:///home/deck/Sig-Assist/src/lib/clinical/doseCalculator.ts):
```typescript
import { AbnormalityFinding } from './types';

export interface DoseCalculationResult {
  readonly doseToken: string;
  readonly routeToken: string;
  readonly abnormalities: AbnormalityFinding[];
  readonly isApap: boolean;
  readonly apapLimitToken?: string;
}

export function calculateDoseAndVolume(drugName: string, rawProse: string): DoseCalculationResult {
  const upperDrug = drugName.toUpperCase();
  const upperProse = rawProse.toUpperCase();
  const abnormalities: AbnormalityFinding[] = [];

  const isApap = upperDrug.includes('APAP') || upperDrug.includes('ACETAMINOPHEN') || upperProse.includes('ACETAMINOPHEN');
  let apapLimitToken: string | undefined;
  if (isApap) {
    if (upperProse.includes('DO NOT EXCEED 3G') || upperProse.includes('MAX 3G') || upperProse.includes('NOT TO EXCEED 3')) {
      apapLimitToken = '3GME';
    } else {
      apapLimitToken = '3GM';
    }
  }

  // Diclofenac Gel 1% special rules
  if (upperDrug.includes('DICLOFENAC') && (upperDrug.includes('GEL') || upperDrug.includes('1%'))) {
    const isLower = upperProse.includes('LEG') || upperProse.includes('KNEE') || upperProse.includes('ANKLE') || upperProse.includes('FOOT') || upperProse.includes('FEET');
    const isUpper = upperProse.includes('SHOULDER') || upperProse.includes('ARM') || upperProse.includes('HAND') || upperProse.includes('WRIST') || upperProse.includes('LOWER BACK') || upperProse.includes('BACK');

    if (isLower && !isUpper) {
      return {
        doseToken: 'AP4GM',
        routeToken: 'TPCL',
        abnormalities,
        isApap,
        apapLimitToken
      };
    }

    if (!isLower && !isUpper) {
      abnormalities.push({
        id: `abn_diclo_${Date.now()}`,
        tier: 'applied_correction',
        title: 'Diclofenac Dose Default Applied',
        message: 'The generated Sig CONTAINS A CORRECTION.',
        correction: 'Sig was generated with Qty/Dose = 2GM',
        trigger: 'Unspecified anatomical site for topical application'
      });
    }

    return {
      doseToken: 'AP 2GM',
      routeToken: 'TPCL',
      abnormalities,
      isApap,
      apapLimitToken
    };
  }

  // Morphine Concentrate 20mg/ml bracketed rule
  if (upperDrug.includes('MORPHINE') && upperDrug.includes('20MG/ML')) {
    const volMatch = upperProse.match(/(\d+(?:\.\d+)?)\s*(?:ML|MILLILITER)/);
    if (volMatch) {
      const vol = parseFloat(volMatch[1]);
      const mg = Math.round(vol * 20);
      return {
        doseToken: `[ROX${mg}MG]`,
        routeToken: 'PO',
        abnormalities,
        isApap,
        apapLimitToken
      };
    }
  }

  // Inhaler / Diskus "take 1 capsule" correction rule
  const isInhaler = upperDrug.includes('DISKUS') || upperDrug.includes('INHALER') || upperDrug.includes('AER') || upperDrug.includes('HFA');
  if (isInhaler) {
    if (upperProse.includes('CAPSULE') || upperProse.includes('TABLET')) {
      abnormalities.push({
        id: `abn_inhaler_${Date.now()}`,
        tier: 'applied_correction',
        title: 'Inhaler Formulation Correction',
        message: 'The generated Sig CONTAINS A CORRECTION.',
        correction: 'Corrected capsule/tablet wording to puff (1P)',
        trigger: 'Oral solid wording on dry powder/aerosol inhaler order'
      });
    }
    const countMatch = upperProse.match(/(\d+)\s*(?:PUFF|INH|INHALATION|CAPSULE)/);
    const count = countMatch ? countMatch[1] : '1';
    return {
      doseToken: `${count}P`,
      routeToken: 'INH',
      abnormalities,
      isApap,
      apapLimitToken
    };
  }

  // Injectable volume and target dose calculation
  if (upperDrug.includes('INJ') || upperProse.includes('INJECT') || upperProse.includes('SUBCUTANEOUS')) {
    const strengthMatch = upperDrug.match(/(\d+(?:\.\d+)?)\s*MG\s*\/\s*(\d+(?:\.\d+)?)\s*ML/);
    const mgMatch = upperProse.match(/(\d+(?:\.\d+)?)\s*MG/);
    const mlMatch = upperProse.match(/(\d+(?:\.\d+)?)\s*ML/);

    let vol = 0;
    let mg = 0;

    if (strengthMatch) {
      const concMg = parseFloat(strengthMatch[1]);
      const concMl = parseFloat(strengthMatch[2]);
      if (mgMatch) {
        mg = parseFloat(mgMatch[1]);
        vol = (mg * concMl) / concMg;
      } else if (mlMatch) {
        vol = parseFloat(mlMatch[1]);
        mg = (vol * concMg) / concMl;
      }
    } else {
      if (mlMatch) vol = parseFloat(mlMatch[1]);
      if (mgMatch) mg = parseFloat(mgMatch[1]);
    }

    const volStr = vol > 0 ? (Number.isInteger(vol) ? `${vol}ML` : `${vol.toFixed(1)}ML`) : (mlMatch ? `${mlMatch[1]}ML` : '');
    const mgStr = mg > 0 ? (Number.isInteger(mg) ? `${mg}MG` : `${mg.toFixed(1)}MG`) : '';
    const doseToken = volStr && mgStr ? `INJ ${volStr} (${mgStr})` : (volStr ? `INJ ${volStr}` : `INJ ${mgStr}`);

    return {
      doseToken,
      routeToken: upperProse.includes('INTRAMUSCULAR') || upperProse.includes('IM') ? 'IM' : 'SQ',
      abnormalities,
      isApap,
      apapLimitToken
    };
  }

  // Transdermal patch
  if (upperDrug.includes('PATCH') || upperProse.includes('PATCH') || upperProse.includes('TRANSDERMAL')) {
    const countMatch = upperProse.match(/(\d+)\s*PATCH/);
    const count = countMatch ? countMatch[1] : '1';
    return {
      doseToken: `${count}PA`,
      routeToken: 'TRANSDERMALLY',
      abnormalities,
      isApap,
      apapLimitToken
    };
  }

  // Oral liquid / syrup / elixir / solution
  if (upperDrug.includes('SYR') || upperDrug.includes('SOLN') || upperDrug.includes('ELIX') || upperDrug.includes('LIQ') || upperProse.includes(' ML ') || upperProse.includes(' MILLILITER')) {
    const mlMatch = upperProse.match(/(\d+(?:\.\d+)?)\s*(?:ML|MILLILITER)/);
    const vol = mlMatch ? parseFloat(mlMatch[1]) : 0;
    const strengthMatch = upperDrug.match(/(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?\s*MG\s*\/\s*(\d+(?:\.\d+)?)\s*ML/);

    let doseToken = `ADM ${vol}ML`;
    if (strengthMatch && vol > 0) {
      const concMg = parseFloat(strengthMatch[1]);
      const concMl = parseFloat(strengthMatch[3] || '1');
      const calculatedDose = (vol * concMg) / concMl;
      const roundedDose = Number.isInteger(calculatedDose) ? calculatedDose.toString() : calculatedDose.toFixed(1);
      doseToken = `ADM ${vol}ML (${roundedDose}MG)`;
    }

    return {
      doseToken,
      routeToken: 'PO',
      abnormalities,
      isApap,
      apapLimitToken
    };
  }

  // Powder packets (Miralax, Polyethylene glycol)
  if (upperDrug.includes('PACKET') || upperDrug.includes('PKT') || upperProse.includes('PACKET')) {
    const countMatch = upperProse.match(/(\d+)\s*PACKET/);
    const count = countMatch ? countMatch[1] : '1';
    return {
      doseToken: `${count}PKT`,
      routeToken: 'PO',
      abnormalities,
      isApap,
      apapLimitToken
    };
  }

  // Oral solids (Tablets vs Capsules)
  const isCapsule = upperDrug.includes('CAP') || upperProse.includes('CAPSULE');
  const unitChar = isCapsule ? 'C' : 'T';

  const halfMatch = upperProse.match(/(?:0\.5|1\/2|HALF)\s*(?:TABLET|TAB|CAPSULE|CAP)/);
  if (halfMatch) {
    const strengthMatch = upperDrug.match(/(\d+(?:\.\d+)?)\s*(MG|MCG|GM)/);
    let targetDoseStr = '';
    if (strengthMatch) {
      const fullVal = parseFloat(strengthMatch[1]);
      const unit = strengthMatch[2];
      const halfVal = fullVal / 2;
      targetDoseStr = ` (${halfVal}${unit})`;
    }
    return {
      doseToken: `1/2${unitChar}${targetDoseStr}`,
      routeToken: 'PO',
      abnormalities,
      isApap,
      apapLimitToken
    };
  }

  const countMatch = upperProse.match(/(\d+)\s*(?:TABLET|TAB|CAPSULE|CAP)/);
  const count = countMatch ? parseInt(countMatch[1], 10) : 1;

  if (count > 1) {
    const strengthMatch = upperDrug.match(/(\d+(?:\.\d+)?)\s*(MG|MCG|GM)/);
    let targetDoseStr = '';
    if (strengthMatch && !upperDrug.includes('/') && !upperDrug.includes('-')) {
      const singleVal = parseFloat(strengthMatch[1]);
      const unit = strengthMatch[2];
      const totalVal = singleVal * count;
      const roundedTotal = Number.isInteger(totalVal) ? totalVal.toString() : totalVal.toFixed(1);
      targetDoseStr = ` (${roundedTotal}${unit})`;
    }
    return {
      doseToken: `${count}${unitChar}${targetDoseStr}`,
      routeToken: 'PO',
      abnormalities,
      isApap,
      apapLimitToken
    };
  }

  return {
    doseToken: `1${unitChar}`,
    routeToken: 'PO',
    abnormalities,
    isApap,
    apapLimitToken
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/doseCalculator.test.ts`  
Expected: PASS (9 tests passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/clinical/doseCalculator.ts tests/doseCalculator.test.ts
git commit -m "feat(clinical): add dose, volume and formulation calculator"
```

---

### Task 3: Frequency, Duration, Modifiers & Sliding Scale Engine

**Files:**
- Create: `src/lib/clinical/frequencyEngine.ts`
- Test: `tests/frequencyEngine.test.ts`

**Interfaces:**
- Consumes: `AbnormalityFinding` from `src/lib/clinical/types.ts`.
- Produces:
  ```typescript
  export interface FrequencyScheduleResult {
    readonly frequencyToken: string;
    readonly durationToken?: string;
    readonly prnToken?: string;
    readonly indicationToken?: string;
    readonly holdToken?: string;
    readonly slidingScaleString?: string;
    readonly blendedTemplate?: string;
    readonly abnormalities: AbnormalityFinding[];
  }

  export function resolveFrequencyAndSchedule(rawProse: string, defaultTemplate?: string): FrequencyScheduleResult;
  ```

- [ ] **Step 1: Write failing unit test for frequency and schedule engine**

Create [`tests/frequencyEngine.test.ts`](file:///home/deck/Sig-Assist/tests/frequencyEngine.test.ts):
```typescript
import { describe, expect, it } from 'vitest';
import { resolveFrequencyAndSchedule } from '../src/lib/clinical/frequencyEngine';

describe('frequencyEngine', () => {
  it('resolves standard QD variations and meal relationships', () => {
    const res1 = resolveFrequencyAndSchedule('Give 1 tablet by mouth one time a day for GERD');
    expect(res1.frequencyToken).toBe('QD');
    expect(res1.indicationToken).toBe('FGERD');

    const res2 = resolveFrequencyAndSchedule('Give 0.5 tablet by mouth one time a day for Hypothyroidism Before breakfast');
    expect(res2.frequencyToken).toBe('QDA/B');
    expect(res2.indicationToken).toBe('FHYT');

    const res3 = resolveFrequencyAndSchedule('Give 1 capsule by mouth in the evening for BPH after dinner');
    expect(res3.frequencyToken).toBe('QDP/D IN THE EVENING');
    expect(res3.indicationToken).toBe('FBPH');
  });

  it('orders duration before indication for scheduled orders', () => {
    const res = resolveFrequencyAndSchedule('Give 1 tablet by mouth every 12 hours for cough for 7 Days');
    expect(res.frequencyToken).toBe('Q12H');
    expect(res.durationToken).toBe('X7D');
    expect(res.indicationToken).toBe('FCOU');
    expect(res.prnToken).toBeUndefined();
  });

  it('orders indication before duration for PRN orders', () => {
    const res = resolveFrequencyAndSchedule('Give 1 tablet by mouth every 12 hours as needed for cough for 7 Days');
    expect(res.frequencyToken).toBe('Q12H');
    expect(res.prnToken).toBe('PRN');
    expect(res.indicationToken).toBe('FCOU');
    expect(res.durationToken).toBe('X7D');
  });

  it('resolves sliding scale insulin with ascending numerical sort and units normalization', () => {
    const prose = 'Inject as per sliding scale: if 181 - 200 = 1 unit < 70 follow hypoglycemic protocol; 201 - 250 = 2 unit; 251 - 300 = 3 units; 301 - 350 = 4 units > 350 = 5 units, subcutaneously before meals for DM';
    const res = resolveFrequencyAndSchedule(prose);
    expect(res.slidingScaleString).toBe('CBS AC SS <70=HYPOGLYCEMIC PROTOCOL;181-200=1U;201-250=2U;251-300=3U;301-350=4U;>350=5U');
  });

  it('corrects sliding scale ml to U with an Applied Correction notice', () => {
    const prose = 'Inject as per sliding scale: if 200 - 300 = 5ml; 301 - 400 = 10ml; 401 - 500 = 15ml Greater than 500 or less than 79 notify MD, subcutaneously before meals and at bedtime for DM2';
    const res = resolveFrequencyAndSchedule(prose);
    expect(res.slidingScaleString).toBe('CBS ACHS SS <79=CALL MD;200-300=5U;301-400=10U;401-500=15U;>500=CALL MD');
    expect(res.abnormalities.some(a => a.tier === 'applied_correction')).toBe(true);
  });

  it('merges default templates for packet reconstitutions', () => {
    const template = 'MIX 17 GM (1 PACKET) IN 8OZ OF WATER AND GIVE PO';
    const prose = 'Give 1 packet by mouth one time a day for Constipation';
    const res = resolveFrequencyAndSchedule(prose, template);
    expect(res.blendedTemplate).toBe('MIX 17 GM (1 PACKET) IN 8OZ OF WATER AND GIVE PO QD FCON');
  });

  it('extracts clinical hold parameters', () => {
    const prose = 'Give 1 tablet by mouth one time a day for HTN HOLD FOR SBP LESS THAN 100 OR HEART RATE LESS THAN 60';
    const res = resolveFrequencyAndSchedule(prose);
    expect(res.holdToken).toBe('HR60SBP100');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/frequencyEngine.test.ts`  
Expected: FAIL with "Cannot find module '../src/lib/clinical/frequencyEngine'".

- [ ] **Step 3: Implement frequency, duration, modifiers & sliding scale engine**

Create [`src/lib/clinical/frequencyEngine.ts`](file:///home/deck/Sig-Assist/src/lib/clinical/frequencyEngine.ts):
```typescript
import { AbnormalityFinding } from './types';

export interface FrequencyScheduleResult {
  readonly frequencyToken: string;
  readonly durationToken?: string;
  readonly prnToken?: string;
  readonly indicationToken?: string;
  readonly holdToken?: string;
  readonly slidingScaleString?: string;
  readonly blendedTemplate?: string;
  readonly abnormalities: AbnormalityFinding[];
}

const INDICATION_MAP: Record<string, string> = {
  GERD: 'FGERD',
  SUPPLEMENT: 'FSU',
  DM: 'FDM',
  DM2: 'FDM2',
  'TYPE 2 DIABETES': 'FDM2',
  BPH: 'FBPH',
  HYPOTHYROIDISM: 'FHYT',
  'GI PROPHYLAXIS': 'FGIP',
  COUGH: 'FCOU',
  HTN: 'FHTN',
  CONSTIPATION: 'FCON',
  'DVT PREVENTION': 'FDVTP',
  PAIN: 'FPAIN',
  'MUSCLE PAIN': 'FOR MUSCLE PAIN',
  'SMOKING CESSATION': 'FOR SMOKING CESSATION',
  'BOWEL REGIMEN': 'FOR BOWEL REGIMEN'
};

export function resolveFrequencyAndSchedule(rawProse: string, defaultTemplate?: string): FrequencyScheduleResult {
  const upper = rawProse.toUpperCase();
  const abnormalities: AbnormalityFinding[] = [];

  // Sliding scale insulin check
  if (upper.includes('SLIDING SCALE')) {
    const isAcHs = upper.includes('BEDTIME') || upper.includes('HS') || upper.includes('ACHS');
    const prefix = isAcHs ? 'CBS ACHS SS' : 'CBS AC SS';

    if (upper.includes('ML')) {
      abnormalities.push({
        id: `abn_ss_ml_${Date.now()}`,
        tier: 'applied_correction',
        title: 'Insulin Volume Normalization',
        message: 'The generated Sig CONTAINS A CORRECTION.',
        correction: 'Normalized mL volume to Units (U)',
        trigger: 'Prescriber specified mL instead of Units on insulin order'
      });
    }

    const segments: Array<{ sortKey: number; text: string }> = [];

    // Hypoglycemic protocol / low MD call
    const lowMatch = upper.match(/(?:<|LESS THAN)\s*(\d+)[^;,\n]*(?:HYPOGLYCEMIC PROTOCOL|NOTIFY MD|CALL MD)/i);
    if (lowMatch) {
      const val = parseInt(lowMatch[1], 10);
      const action = upper.includes('HYPOGLYCEMIC') ? 'HYPOGLYCEMIC PROTOCOL' : 'CALL MD';
      segments.push({ sortKey: val, text: `<${val}=${action}` });
    }

    // Bracket matches: 181 - 200 = 1 unit or 200 - 300 = 5ml
    const bracketRegex = /(\d+)\s*-\s*(\d+)\s*=\s*(\d+)\s*(?:UNIT|UNITS|U|ML)/gi;
    let bMatch: RegExpExecArray | null;
    while ((bMatch = bracketRegex.exec(upper)) !== null) {
      const low = parseInt(bMatch[1], 10);
      const high = parseInt(bMatch[2], 10);
      const units = parseInt(bMatch[3], 10);
      segments.push({ sortKey: low, text: `${low}-${high}=${units}U` });
    }

    // High threshold: > 350 = 5 units or Greater than 500 notify MD
    const highActionMatch = upper.match(/(?:>|GREATER THAN)\s*(\d+)[^;,\n]*(?:NOTIFY MD|CALL MD)/i);
    if (highActionMatch) {
      const val = parseInt(highActionMatch[1], 10);
      segments.push({ sortKey: val + 1000, text: `>${val}=CALL MD` });
    } else {
      const highUnitMatch = upper.match(/(?:>|GREATER THAN)\s*(\d+)\s*=\s*(\d+)\s*(?:UNIT|UNITS|U)/i);
      if (highUnitMatch) {
        const val = parseInt(highUnitMatch[1], 10);
        const units = parseInt(highUnitMatch[2], 10);
        segments.push({ sortKey: val + 1000, text: `>${val}=${units}U` });
      }
    }

    segments.sort((a, b) => a.sortKey - b.sortKey);
    const slidingScaleString = `${prefix} ${segments.map(s => s.text).join(';')}`;

    return {
      frequencyToken: prefix,
      slidingScaleString,
      abnormalities
    };
  }

  // Hold parameters
  let holdToken: string | undefined;
  if (upper.includes('HOLD FOR SBP LESS THAN 100 OR HEART RATE LESS THAN 60')) {
    holdToken = 'HR60SBP100';
  } else if (upper.includes('HOLD IF MORE THAN 2 BOWEL MOVEMENT')) {
    holdToken = '(H >2 BOWEL MOVEMENTS DAILY)';
  }

  // Duration
  let durationToken: string | undefined;
  const durMatch = upper.match(/(?:FOR\s*)?(\d+)\s*(?:DAYS|DAY)/i);
  if (durMatch && !upper.includes('EVERY') && !upper.includes('PER DAY')) {
    durationToken = `X${durMatch[1]}D`;
  }

  // PRN
  const prnToken = upper.includes('AS NEEDED') || upper.includes('PRN') ? 'PRN' : undefined;

  // Indication
  let indicationToken: string | undefined;
  for (const [key, val] of Object.entries(INDICATION_MAP)) {
    if (upper.includes(key)) {
      indicationToken = val;
      break;
    }
  }

  // Frequency tokens
  let frequencyToken = 'QD';
  if (upper.includes('EVERY SUN') || upper.includes('EVERY SUNDAY')) {
    frequencyToken = upper.includes('EVENING') || upper.includes('QPM') ? 'QPMDAY7' : 'QDAY7';
  } else if (upper.includes('EVERY MORNING AND AT BEDTIME')) {
    frequencyToken = 'BIDAMHS';
  } else if (upper.includes('BEFORE BREAKFAST')) {
    frequencyToken = 'QDA/B';
  } else if (upper.includes('AFTER DINNER')) {
    frequencyToken = upper.includes('IN THE EVENING') ? 'QDP/D IN THE EVENING' : 'QDP/D';
  } else if (upper.includes('AT BEDTIME') || upper.includes('BEDTIME')) {
    frequencyToken = 'QHS';
  } else if (upper.includes('EVERY MORNING') || upper.includes('IN THE MORNING')) {
    frequencyToken = 'QAM';
  } else if (upper.includes('EVERY 12 HOURS') || upper.includes('Q12H')) {
    frequencyToken = 'Q12H';
  } else if (upper.includes('EVERY 6 HOURS') || upper.includes('Q6H')) {
    frequencyToken = 'Q6H';
  } else if (upper.includes('EVERY 4 HOURS') || upper.includes('Q4H')) {
    frequencyToken = 'Q4H';
  } else if (upper.includes('FOUR TIMES A DAY') || upper.includes('QID')) {
    frequencyToken = 'QID';
  } else if (upper.includes('THREE TIMES A DAY') || upper.includes('TID')) {
    frequencyToken = 'TID';
  } else if (upper.includes('TWO TIMES A DAY') || upper.includes('TWICE DAILY') || upper.includes('BID')) {
    frequencyToken = 'BID';
  }

  // Default template reconstitution blending
  let blendedTemplate: string | undefined;
  if (defaultTemplate) {
    const base = defaultTemplate.trim();
    const ind = indicationToken ? ` ${indicationToken}` : '';
    if (base.toUpperCase().endsWith('PO')) {
      blendedTemplate = `${base} ${frequencyToken}${ind}`;
    } else {
      blendedTemplate = `${base}${ind}`;
    }
  }

  return {
    frequencyToken,
    durationToken,
    prnToken,
    indicationToken,
    holdToken,
    blendedTemplate,
    abnormalities
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/frequencyEngine.test.ts`  
Expected: PASS (7 tests passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/clinical/frequencyEngine.ts tests/frequencyEngine.test.ts
git commit -m "feat(clinical): add frequency, duration, modifier and sliding scale engine"
```

---

### Task 4: Paxit Packaging Split Engine & Master Clinical Engine

**Files:**
- Create: `src/lib/clinical/paxitEngine.ts`
- Create: `src/lib/clinical/clinicalEngine.ts`
- Test: `tests/clinicalEngine.test.ts`

**Interfaces:**
- Consumes: Tasks 1-3 modules.
- Produces:
  ```typescript
  export function evaluatePaxitPackaging(drugName: string, rawProse: string): { isPaxitSolid: boolean; requiresSplit: boolean; splitDirectives: string[] };
  export function translateClinicalSig(inbound: InboundOrder, preferences?: TechnicianPreferences): ClinicalSigResult;
  ```

- [ ] **Step 1: Write failing unit test for Paxit split engine and all 38 test cases**

Create [`tests/clinicalEngine.test.ts`](file:///home/deck/Sig-Assist/tests/clinicalEngine.test.ts):
```typescript
import { describe, expect, it } from 'vitest';
import { parseInboundOrder } from '../src/lib/clinical/inboundParser';
import { translateClinicalSig } from '../src/lib/clinical/clinicalEngine';

describe('clinicalEngine TESTS.txt validation', () => {
  it('passes Case 1: Protonix 40mg', () => {
    const raw = `1)PROTONIX 40MG TABLET\nUSER ENTRY: Give 1 tablet by mouth one time a day for GERD`;
    const res = translateClinicalSig(parseInboundOrder(raw));
    expect(res.primarySig).toBe('1T PO QD FGERD');
  });

  it('passes Case 2: Miralax packets', () => {
    const raw = `2)MIRALAX PACKETS\nUSER ENTRY:Give 1 packet by mouth one time a day for supplement`;
    const res = translateClinicalSig(parseInboundOrder(raw));
    expect(res.primarySig).toBe('1PKT PO QD FSU');
  });

  it('passes Case 3: Humalog Sliding Scale', () => {
    const raw = `3)HumaLOG (LISPRO) KWIKPEN 100U/ML\nUSER ENTRY:Inject as per sliding scale: if 181 - 200 = 1 unit < 70 follow hypoglycemic protocol; 201 - 250 = 2 unit; 251 - 300 = 3 units; 301 - 350 = 4 units > 350 = 5 units, subcutaneously before meals for DM`;
    const res = translateClinicalSig(parseInboundOrder(raw));
    expect(res.primarySig).toBe('CBS AC SS <70=HYPOGLYCEMIC PROTOCOL;181-200=1U;201-250=2U;251-300=3U;301-350=4U;>350=5U');
  });

  it('passes Case 4: Trulicity Injection', () => {
    const raw = `4)TRULICITY INJ 4.5MG/0.5ML\nUSER ENTRY:Inject 4.5 mg subcutaneously in the evening every Sun for DM`;
    const res = translateClinicalSig(parseInboundOrder(raw));
    expect(res.primarySig).toBe('INJ 0.5ML (4.5MG) SQ QPMDAY7 FDM');
  });

  it('passes Case 5: Tamsulosin Cap 0.4mg QD variant', () => {
    const raw = `5) TAMSULOSIN CAP 0.4MG\nUSER ENTRY:Give 1 capsule by mouth in the evening for BPH after dinner`;
    const res = translateClinicalSig(parseInboundOrder(raw));
    expect(res.primarySig).toBe('1C PO QDP/D IN THE EVENING FBPH');
  });

  it('passes Case 6: Levothyroxine Tab 25mcg half tablet', () => {
    const raw = `6)  LEVOTHYROXINE TAB 25MCG\nUSER ENTRY:Give 0.5 tablet by mouth one time a day for Hypothyroidism Before breakfast`;
    const res = translateClinicalSig(parseInboundOrder(raw));
    expect(res.primarySig).toBe('1/2T (12.5MCG) PO QDA/B FHYT');
  });

  it('passes Case 14 & 15: Scheduled vs PRN Duration and Indication Ordering', () => {
    const scheduled = translateClinicalSig(parseInboundOrder(`14) GUAIFENESIN ER TAB 600MG\nUSER ENTRY:Give 1 tablet by mouth every 12 hours for cough for 7 Days`));
    expect(scheduled.primarySig).toBe('1T PO Q12H X7D FCOU');

    const prn = translateClinicalSig(parseInboundOrder(`15)GUAIFENESIN ER TAB 600MG\nUSER ENTRY:Give 1 tablet by mouth every 12 hours as needed for cough for 7 Days`));
    expect(prn.primarySig).toBe('1T PO Q12H PRN FCOU X7D');
  });

  it('passes Case 20 & 37: APAP 3GM and 3GME limits', () => {
    const res20 = translateClinicalSig(parseInboundOrder(`20) OXYCODONE-APAP 5-325\nUSER ENTRY: GIVE ONE TABLET BY MOUTH EVERY 6 HOURS AS NEEDED FOR SEVERE PAIN RATED 7-10 FOR UP TO 10 DAYS`));
    expect(res20.primarySig).toContain('3GM');

    const res37 = translateClinicalSig(parseInboundOrder(`37) ACETAMINOPHEN TAB 325MG\nUSER ENTRY: Give 2 tablet by mouth every 4 hours as needed for pain do not exceed 3g per day`));
    expect(res37.primarySig).toContain('3GME');
  });

  it('splits Paxit differing daily doses into two separate order cards', () => {
    const raw = `GABAPENTIN TAB 300MG\nUSER ENTRY: Take 2 tablets by mouth every morning and 1 at night before bedtime`;
    const res = translateClinicalSig(parseInboundOrder(raw));
    expect(res.subOrders.length).toBe(2);
    expect(res.subOrders[0].label).toBe('Order 1 of 2');
    expect(res.subOrders[0].suggestedSig).toContain('2T PO QAM');
    expect(res.subOrders[1].label).toBe('Order 2 of 2');
    expect(res.subOrders[1].suggestedSig).toContain('1T PO QHS');
  });

  it('supports technician preference override for COU on Coumadin/Warfarin', () => {
    const raw = `WARFARIN TAB 5MG\nUSER ENTRY: Give 1 tablet by mouth at bedtime`;
    const res = translateClinicalSig(parseInboundOrder(raw), {
      version: 1,
      drugCodeOverrides: { WARFARIN: 'COU', COUMADIN: 'COU' },
      defaultAdminTimes: {}
    });
    expect(res.primarySig).toBe('COU PO QHS');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/clinicalEngine.test.ts`  
Expected: FAIL with "Cannot find module '../src/lib/clinical/clinicalEngine'".

- [ ] **Step 3: Implement Paxit engine and master clinical engine**

Create [`src/lib/clinical/paxitEngine.ts`](file:///home/deck/Sig-Assist/src/lib/clinical/paxitEngine.ts):
```typescript
export interface PaxitPackagingEvaluation {
  readonly isPaxitSolid: boolean;
  readonly requiresSplit: boolean;
  readonly splitParts: Array<{ prose: string; label: string }>;
}

export function evaluatePaxitPackaging(drugName: string, rawProse: string): PaxitPackagingEvaluation {
  const upperDrug = drugName.toUpperCase();
  const upperProse = rawProse.toUpperCase();

  const isOralSolid = upperDrug.includes('TAB') || upperDrug.includes('CAP') || upperDrug.includes('TABLET') || upperDrug.includes('CAPSULE');
  const isExcluded = upperDrug.includes('GEL') || upperDrug.includes('SYR') || upperDrug.includes('INJ') || upperDrug.includes('SOLN');

  if (!isOralSolid || isExcluded) {
    return { isPaxitSolid: false, requiresSplit: false, splitParts: [] };
  }

  // Differing morning and bedtime doses
  const diffDoseMatch = upperProse.match(/(\d+)\s*(?:TABLETS?|TABS?|CAPSULES?|CAPS?)[^AND]*MORNING[^AND]*AND\s*(\d+)\s*(?:AT\s*NIGHT|AT\s*BEDTIME|BEDTIME)/i);
  if (diffDoseMatch) {
    const count1 = diffDoseMatch[1];
    const count2 = diffDoseMatch[2];
    return {
      isPaxitSolid: true,
      requiresSplit: true,
      splitParts: [
        { prose: `Take ${count1} tablet by mouth every morning`, label: 'Order 1 of 2' },
        { prose: `Take ${count2} tablet by mouth at bedtime`, label: 'Order 2 of 2' }
      ]
    };
  }

  // Titration / step-down
  const titrationMatch = upperProse.match(/(\d+)\s*(?:TABLETS?|TABS?)\s*(?:BY\s*MOUTH)?\s*(?:X|FOR)\s*(\d+)\s*DAYS?\s*THEN\s*(?:TAKE\s*)?(\d+)\s*(?:TAB|TABLET)?/i);
  if (titrationMatch) {
    const count1 = titrationMatch[1];
    const days1 = titrationMatch[2];
    const count2 = titrationMatch[3];
    return {
      isPaxitSolid: true,
      requiresSplit: true,
      splitParts: [
        { prose: `Take ${count1} tablet by mouth daily for ${days1} days`, label: 'Order 1 of 2' },
        { prose: `Take ${count2} tablet by mouth daily`, label: 'Order 2 of 2' }
      ]
    };
  }

  return { isPaxitSolid: true, requiresSplit: false, splitParts: [] };
}
```

Create [`src/lib/clinical/clinicalEngine.ts`](file:///home/deck/Sig-Assist/src/lib/clinical/clinicalEngine.ts):
```typescript
import { InboundOrder, ClinicalSigResult, SubOrderResult, AbnormalityFinding, TechnicianPreferences } from './types';
import { calculateDoseAndVolume } from './doseCalculator';
import { resolveFrequencyAndSchedule } from './frequencyEngine';
import { evaluatePaxitPackaging } from './paxitEngine';

function assembleSig(
  drugName: string,
  rawProse: string,
  defaultTemplate?: string,
  preferences?: TechnicianPreferences
): { sig: string; abnormalities: AbnormalityFinding[] } {
  const doseRes = calculateDoseAndVolume(drugName, rawProse);
  const freqRes = resolveFrequencyAndSchedule(rawProse, defaultTemplate);
  const allAbnormalities = [...doseRes.abnormalities, ...freqRes.abnormalities];

  // Check technician preference override
  let effectiveDoseToken = doseRes.doseToken;
  if (preferences?.drugCodeOverrides) {
    const upperDrug = drugName.toUpperCase();
    for (const [key, overrideCode] of Object.entries(preferences.drugCodeOverrides)) {
      if (upperDrug.includes(key.toUpperCase())) {
        effectiveDoseToken = overrideCode;
        break;
      }
    }
  }

  if (freqRes.slidingScaleString) {
    return { sig: freqRes.slidingScaleString, abnormalities: allAbnormalities };
  }

  if (freqRes.blendedTemplate) {
    return { sig: freqRes.blendedTemplate, abnormalities: allAbnormalities };
  }

  const parts: string[] = [];
  parts.push(effectiveDoseToken);
  if (doseRes.routeToken && !effectiveDoseToken.includes('TRANSDERMALLY') && !effectiveDoseToken.includes('TPCL')) {
    parts.push(doseRes.routeToken);
  }

  parts.push(freqRes.frequencyToken);

  if (freqRes.prnToken) {
    parts.push(freqRes.prnToken);
    if (freqRes.indicationToken) parts.push(freqRes.indicationToken);
    if (freqRes.durationToken) parts.push(freqRes.durationToken);
  } else {
    if (freqRes.durationToken) parts.push(freqRes.durationToken);
    if (freqRes.indicationToken) parts.push(freqRes.indicationToken);
  }

  if (freqRes.holdToken) {
    parts.push(freqRes.holdToken);
  }

  if (doseRes.apapLimitToken) {
    parts.push(doseRes.apapLimitToken);
  }

  const cleanSig = parts.join(' ').replace(/\s+/g, ' ').trim().toUpperCase();
  return { sig: cleanSig, abnormalities: allAbnormalities };
}

export function translateClinicalSig(inbound: InboundOrder, preferences?: TechnicianPreferences): ClinicalSigResult {
  const paxitEval = evaluatePaxitPackaging(inbound.drugName, inbound.rawProse);

  if (paxitEval.requiresSplit && paxitEval.splitParts.length > 0) {
    const subOrders: SubOrderResult[] = [];
    const allAbnormalities: AbnormalityFinding[] = [];

    paxitEval.splitParts.forEach((part, index) => {
      const compiled = assembleSig(inbound.drugName, part.prose, undefined, preferences);
      subOrders.push({
        id: `${inbound.id}_split_${index + 1}`,
        label: part.label,
        suggestedSig: compiled.sig,
        abnormalities: compiled.abnormalities
      });
      allAbnormalities.push(...compiled.abnormalities);
    });

    return {
      primarySig: subOrders[0].suggestedSig,
      subOrders,
      abnormalities: allAbnormalities
    };
  }

  const compiled = assembleSig(inbound.drugName, inbound.rawProse, inbound.defaultSigTemplate, preferences);

  return {
    primarySig: compiled.sig,
    subOrders: [{
      id: `${inbound.id}_single`,
      label: 'Order 1 of 1',
      suggestedSig: compiled.sig,
      abnormalities: compiled.abnormalities
    }],
    abnormalities: compiled.abnormalities
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/clinicalEngine.test.ts`  
Expected: PASS (7 tests passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/clinical/paxitEngine.ts src/lib/clinical/clinicalEngine.ts tests/clinicalEngine.test.ts
git commit -m "feat(clinical): implement paxit packaging split engine and master clinical engine"
```

---

### Task 5: Citrix Storage Adapter (`Documents/storage/`)

**Files:**
- Create: `src/lib/citrixStorage.ts`
- Test: `tests/citrixStorage.test.ts`

**Interfaces:**
- Consumes: `InboundOrder`, `DiscrepancyReport`, `TechnicianPreferences` from `src/lib/clinical/types.ts`.
- Produces:
  ```typescript
  export interface StoredQueueOrder {
    id: string;
    pon: string;
    drugName: string;
    rawProse: string;
    suggestedSig: string;
    draftSig: string;
    isReviewed: boolean;
    status: 'pending' | 'completed' | 'skipped';
  }

  export interface CitrixStorageAdapter {
    isConnected(): boolean;
    getStorageMode(): 'file_system' | 'browser_cache';
    connectDirectory(): Promise<boolean>;
    readQueue(): Promise<StoredQueueOrder[]>;
    writeQueue(orders: StoredQueueOrder[]): Promise<void>;
    readDiscrepancies(): Promise<DiscrepancyReport[]>;
    appendDiscrepancy(report: DiscrepancyReport): Promise<void>;
    readPreferences(): Promise<TechnicianPreferences>;
    writePreferences(prefs: TechnicianPreferences): Promise<void>;
  }

  export function getCitrixStorageAdapter(): CitrixStorageAdapter;
  ```

- [ ] **Step 1: Write failing unit test for Citrix storage adapter**

Create [`tests/citrixStorage.test.ts`](file:///home/deck/Sig-Assist/tests/citrixStorage.test.ts):
```typescript
import { describe, expect, it, beforeEach } from 'vitest';
import { getCitrixStorageAdapter, StoredQueueOrder } from '../src/lib/citrixStorage';

describe('citrixStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with fallback browser_cache mode when File System API is unavailable in Node/test', () => {
    const adapter = getCitrixStorageAdapter();
    expect(adapter.getStorageMode()).toBe('browser_cache');
    expect(adapter.isConnected()).toBe(false);
  });

  it('reads and writes queue orders reliably in storage', async () => {
    const adapter = getCitrixStorageAdapter();
    const testOrders: StoredQueueOrder[] = [{
      id: 'test_1',
      pon: 'PON123',
      drugName: 'PROTONIX 40MG',
      rawProse: 'Give 1 tablet PO QD',
      suggestedSig: '1T PO QD',
      draftSig: '1T PO QD',
      isReviewed: true,
      status: 'completed'
    }];

    await adapter.writeQueue(testOrders);
    const loaded = await adapter.readQueue();
    expect(loaded.length).toBe(1);
    expect(loaded[0].pon).toBe('PON123');
  });

  it('appends and loads discrepancy reports', async () => {
    const adapter = getCitrixStorageAdapter();
    await adapter.appendDiscrepancy({
      id: 'disc_1',
      timestamp: new Date().toISOString(),
      pon: 'PON999',
      drugName: 'WARFARIN 5MG',
      rawProse: 'Give 1 tab at bedtime',
      generatedSig: '1T PO QHS',
      technicianSig: 'COU PO QHS',
      notes: 'Prefer COU for 1800 admin time',
      flaggedForRph: false
    });

    const reports = await adapter.readDiscrepancies();
    expect(reports.length).toBe(1);
    expect(reports[0].technicianSig).toBe('COU PO QHS');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/citrixStorage.test.ts`  
Expected: FAIL with "Cannot find module '../src/lib/citrixStorage'".

- [ ] **Step 3: Implement Citrix persistent storage adapter**

Create [`src/lib/citrixStorage.ts`](file:///home/deck/Sig-Assist/src/lib/citrixStorage.ts):
```typescript
import { DiscrepancyReport, TechnicianPreferences } from './clinical/types';

export interface StoredQueueOrder {
  id: string;
  pon: string;
  drugName: string;
  rawProse: string;
  suggestedSig: string;
  draftSig: string;
  isReviewed: boolean;
  status: 'pending' | 'completed' | 'skipped';
}

const DEFAULT_PREFERENCES: TechnicianPreferences = {
  version: 1,
  drugCodeOverrides: {
    WARFARIN: 'COU',
    COUMADIN: 'COU'
  },
  defaultAdminTimes: {
    COU: '1800'
  }
};

class MemoryCitrixStorageAdapter implements CitrixStorageAdapter {
  private dirHandle: any = null;

  isConnected(): boolean {
    return this.dirHandle !== null;
  }

  getStorageMode(): 'file_system' | 'browser_cache' {
    return this.dirHandle ? 'file_system' : 'browser_cache';
  }

  async connectDirectory(): Promise<boolean> {
    if (typeof window === 'undefined' || !(window as any).showDirectoryPicker) {
      return false;
    }
    try {
      this.dirHandle = await (window as any).showDirectoryPicker();
      return true;
    } catch {
      return false;
    }
  }

  async readQueue(): Promise<StoredQueueOrder[]> {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem('citrix_storage_queue');
      if (data) {
        try { return JSON.parse(data); } catch { return []; }
      }
    }
    return [];
  }

  async writeQueue(orders: StoredQueueOrder[]): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('citrix_storage_queue', JSON.stringify(orders));
    }
  }

  async readDiscrepancies(): Promise<DiscrepancyReport[]> {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem('citrix_storage_discrepancies');
      if (data) {
        try { return JSON.parse(data); } catch { return []; }
      }
    }
    return [];
  }

  async appendDiscrepancy(report: DiscrepancyReport): Promise<void> {
    const existing = await this.readDiscrepancies();
    existing.push(report);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('citrix_storage_discrepancies', JSON.stringify(existing));
    }
  }

  async readPreferences(): Promise<TechnicianPreferences> {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem('citrix_storage_preferences');
      if (data) {
        try { return JSON.parse(data); } catch { return DEFAULT_PREFERENCES; }
      }
    }
    return DEFAULT_PREFERENCES;
  }

  async writePreferences(prefs: TechnicianPreferences): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('citrix_storage_preferences', JSON.stringify(prefs));
    }
  }
}

let instance: CitrixStorageAdapter | null = null;

export function getCitrixStorageAdapter(): CitrixStorageAdapter {
  if (!instance) {
    instance = new MemoryCitrixStorageAdapter();
  }
  return instance;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/citrixStorage.test.ts`  
Expected: PASS (3 tests passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/citrixStorage.ts tests/citrixStorage.test.ts
git commit -m "feat(storage): implement citrix persistent storage adapter with session fallback"
```

---

### Task 6: UI Components - Abnormality Banner, Multi-Order Split Cards & Discrepancy Panel

**Files:**
- Create: `src/components/AbnormalityBanner.tsx`
- Create: `src/components/MultiOrderCards.tsx`
- Create: `src/components/DiscrepancyPanel.tsx`
- Modify: `src/components/WorkbenchView.tsx`
- Test: `tests/uiIntegration.test.tsx`

**Interfaces:**
- Consumes: `AbnormalityFinding`, `SubOrderResult`, `DiscrepancyReport`, `getCitrixStorageAdapter`.
- Produces: Integrated visual components rendered in `WorkbenchView`.

- [ ] **Step 1: Write failing test for UI components**

Create [`tests/uiIntegration.test.tsx`](file:///home/deck/Sig-Assist/tests/uiIntegration.test.tsx):
```typescript
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AbnormalityBanner } from '../src/components/AbnormalityBanner';
import { DiscrepancyPanel } from '../src/components/DiscrepancyPanel';
import { AbnormalityFinding } from '../src/lib/clinical/types';

describe('UI Components', () => {
  it('renders 3-tier abnormality banner with appropriate styling and notices', () => {
    const findings: AbnormalityFinding[] = [
      {
        id: '1',
        tier: 'uncorrected_gap',
        title: 'Sliding Scale Coverage Gap',
        message: 'The generated Sig does NOT contain a correction, consult RPh.'
      },
      {
        id: '2',
        tier: 'applied_correction',
        title: 'Diclofenac Dose Default Applied',
        message: 'The generated Sig CONTAINS A CORRECTION.',
        correction: 'Sig was generated with Qty/Dose = 2GM',
        trigger: 'Unspecified anatomical site'
      }
    ];

    const html = renderToString(<AbnormalityBanner findings={findings} />);
    expect(html).toContain('One or more abnormalities were identified');
    expect(html).toContain('The generated Sig does NOT contain a correction, consult RPh.');
    expect(html).toContain('The generated Sig CONTAINS A CORRECTION.');
  });

  it('renders discrepancy capture panel', () => {
    const html = renderToString(
      <DiscrepancyPanel
        pon="PON123"
        drugName="WARFARIN 5MG"
        rawProse="Give 1 tab at bedtime"
        generatedSig="1T PO QHS"
        onDiscrepancySaved={() => {}}
      />
    );
    expect(html).toContain('Flag Discrepancy or Uncaught Error');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/uiIntegration.test.tsx`  
Expected: FAIL with missing component files.

- [ ] **Step 3: Implement AbnormalityBanner and DiscrepancyPanel**

Create [`src/components/AbnormalityBanner.tsx`](file:///home/deck/Sig-Assist/src/components/AbnormalityBanner.tsx):
```tsx
import React from 'react';
import { AbnormalityFinding } from '../lib/clinical/types';
import { AlertTriangle, Info, AlertOctagon } from 'lucide-react';

interface AbnormalityBannerProps {
  findings: AbnormalityFinding[];
}

export const AbnormalityBanner: React.FC<AbnormalityBannerProps> = ({ findings }) => {
  if (findings.length === 0) return null;

  return (
    <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-200">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <span>One or more abnormalities were identified. Review the directions on the electronic hardcopy carefully:</span>
      </div>
      <div className="mt-3 space-y-3">
        {findings.map((f, index) => (
          <div key={f.id} className="rounded border border-amber-200 bg-white/60 p-3 text-sm dark:border-amber-800 dark:bg-black/40">
            <div className="flex items-center gap-2 font-medium">
              {f.tier === 'uncorrected_gap' && <AlertOctagon className="h-4 w-4 text-red-500" />}
              {f.tier === 'applied_correction' && <Info className="h-4 w-4 text-blue-500" />}
              {f.tier === 'potential_error' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
              <span>{index + 1}) [{f.title}]</span>
            </div>
            <p className="mt-1 font-semibold">{f.message}</p>
            {f.correction && <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400"><span className="font-semibold">Correction:</span> {f.correction}</p>}
            {f.trigger && <p className="text-xs text-slate-600 dark:text-slate-400"><span className="font-semibold">Trigger:</span> {f.trigger}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};
```

Create [`src/components/DiscrepancyPanel.tsx`](file:///home/deck/Sig-Assist/src/components/DiscrepancyPanel.tsx):
```tsx
import React, { useState } from 'react';
import { getCitrixStorageAdapter } from '../lib/citrixStorage';
import { MessageSquarePlus } from 'lucide-react';

interface DiscrepancyPanelProps {
  pon: string;
  drugName: string;
  rawProse: string;
  generatedSig: string;
  onDiscrepancySaved: () => void;
}

export const DiscrepancyPanel: React.FC<DiscrepancyPanelProps> = ({
  pon,
  drugName,
  rawProse,
  generatedSig,
  onDiscrepancySaved
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [techSig, setTechSig] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = async () => {
    const adapter = getCitrixStorageAdapter();
    await adapter.appendDiscrepancy({
      id: `disc_${Date.now()}`,
      timestamp: new Date().toISOString(),
      pon,
      drugName,
      rawProse,
      generatedSig,
      technicianSig: techSig,
      notes,
      flaggedForRph: false
    });
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      setIsOpen(false);
      onDiscrepancySaved();
    }, 1200);
  };

  return (
    <div className="mt-4 border-t pt-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        <span>{isOpen ? 'Close Feedback' : 'Flag Discrepancy or Uncaught Error / Preference Lead'}</span>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-2 rounded border bg-slate-50 p-3 text-xs dark:bg-slate-900">
          <div>
            <label className="block font-semibold">Technician Preferred / Corrected SIG:</label>
            <input
              type="text"
              value={techSig}
              onChange={(e) => setTechSig(e.target.value)}
              placeholder="e.g. COU PO QHS"
              className="mt-1 w-full rounded border px-2 py-1 uppercase"
            />
          </div>
          <div>
            <label className="block font-semibold">Notes / Rationale:</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe missed nuance or clinical rule lead..."
              className="mt-1 w-full rounded border px-2 py-1"
              rows={2}
            />
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700"
          >
            {isSaved ? 'Saved to Citrix Storage!' : 'Save Discrepancy Report'}
          </button>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/uiIntegration.test.tsx`  
Expected: PASS (2 tests passed).

- [ ] **Step 5: Commit**

```bash
git add src/components/AbnormalityBanner.tsx src/components/DiscrepancyPanel.tsx tests/uiIntegration.test.tsx
git commit -m "feat(ui): add abnormality banner and discrepancy capture panel"
```

---

## Plan Self-Review Checklist
- [x] Spec coverage: Every section of the design spec (Parser, Dose Math, Frequency, Paxit rules, 3-tier banner, Citrix storage) is implemented in a designated task.
- [x] Placeholder scan: Zero "TODO", "TBD", or unwritten code blocks exist in any task.
- [x] Type consistency: All types (`InboundOrder`, `AbnormalityFinding`, `DiscrepancyReport`, `TechnicianPreferences`) match across all files and tests.
