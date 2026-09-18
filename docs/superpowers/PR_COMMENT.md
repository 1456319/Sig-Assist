# Sig-Assist: Clinical Pharmacy Workflow Accelerator & Inbound Review Architecture

## 1. Intended Function & Operational Context

**Sig-Assist** is purpose-built for high-volume institutional and long-term care (LTC) pharmacy operations utilizing **FrameworkLTC** and **DocuTrack** in Citrix XenApp / Remote Desktop environments.

### Core Problem Solved:
In institutional pharmacy data entry, technicians manually translate disparate, freeform, or electronic prescription prose (EMAR/E-Rx messages, PointClickCare orders, nurse notes) into standardized FrameworkLTC SIG codes. This manual process is vulnerable to:
1. **Dose & Volume Calculation Errors:** Converting non-standard liquid volumes to doses, single-ingredient non-whole-tablet target doses, or injectable volume-to-mg ratios.
2. **Packaging Rule Violations:** Multi-dose pouch packaging machines (**Paxit**) cannot process split SIGs on a single Framework order for oral solid tablets/capsules. Regimens with varying doses (e.g. 2 tabs morning and 1 tab night) or step-down titrations must be entered as separate, discrete orders in FrameworkLTC.
3. **Data Loss in Volatile Citrix Sessions:** Citrix remote desktop browsers flush local browser storage on logout. Technicians require persistent storage redirected to their network profile (`Documents/storage/`).
4. **Clinical Safety & Transcription Nuances:** Prescribers frequently omit sliding scale coverage brackets, write "take 1 capsule" for dry powder inhalers (e.g. Advair Diskus), or omit topical application sites for Diclofenac gel.

### Intended Application Workflow:
1. **Intake:** Ingests raw electronic orders via PointClickCare NCPDP SCRIPT Standard 20170715 `NewRx` XML or technician freeform pasted text.
2. **Algorithmic Clinical Translation:** Deconstructs the clinical prose into formulation, dosage/volume math, frequency, duration, hold conditions, and indications without brittle if/then trees.
3. **Packaging Engine:** Automatically detects oral solid regimens requiring discrete Framework orders and generates linked sub-order cards (`Order 1 of 2`, `Order 2 of 2`) with independent verification tracking.
4. **3-Tier Abnormality Screening:** Flags clinical gaps and modifications directly above the draft SIG in high-visibility alert tiers (uncorrected gaps, applied corrections, potential route/formulation errors).
5. **Enforced Clinical Review & Clipboard Guard:** Gating mechanism that strictly prevents copying to the clipboard until the technician explicitly checks the review approval checkbox. All copied SIGs are strictly uppercase.
6. **Continuous Edge Case Learning & Discrepancy Logging:** Technicians can flag uncaught edge cases, notes, or preferred facility codes directly to `Documents/storage/discrepancies.json`.

---

## 2. Comprehensive Breakdown of Added Capabilities

### A. Dual-Mode Inbound Order Ingestion (`src/lib/clinical/inboundParser.ts`)
* **NCPDP SCRIPT 20170715 XML Support:** Directly parses electronic `NewRx` messages, extracting:
  * Prescriber Order Number (`<Header><PrescriberOrderNumber>`)
  * Drug Name & Strength (`<MedicationPrescribed><DrugDescription>`)
  * Nurse Prose / Directions (`<MedicationPrescribed><Sig><SigText>`)
  * Clarifying Indications (`<Instruction><IndicationClarifyingFreeText>`)
* **XML Entity Unescaping:** Full decoding for `&amp;` (&), `&lt;` (<), `&gt;` (>), `&quot;` ("), and `&apos;` (').
* **Manual / Freeform Entry:** Parses technician copy-pastes with list prefixes (`1)...`), `USER ENTRY:`, and optional `DEFAULT SIG:` templates.

### B. Algorithmic Clinical Translation Pipeline
Accurately solves the 38 clinical benchmark cases specified in `TESTS.txt`:
1. **Dose, Volume & Formulation Normalization (`src/lib/clinical/doseCalculator.ts`):**
   * **Single-Ingredient Target Dose Rule:** Any oral solid count other than 1 tablet/capsule automatically appends the calculated target dose in parentheses for single-ingredient medications (e.g. Levothyroxine 25mcg 0.5 tab $\rightarrow$ `1/2T (12.5MCG) PO QDA/B FHYT`, Tamsulosin 0.4mg 2 cap $\rightarrow$ `2C (0.8MG) PO QHS FBPH`). Multi-ingredient combination products (e.g. `SENNA-S 8.6/50MG` $\rightarrow$ `2T`) are safely guarded against appending partial single-ingredient doses.
   * **Inhaler / Diskus Puff Normalization:** Converts nurse prose stating "take 1 capsule" for dry powder inhalers (e.g. Advair Diskus) into puff notation (`1P`) and records an **Applied Correction** audit notice.
   * **Oral Liquids & Suspensions:** Standardized as `ADM <vol>ML (<dose>) PO`. Computes delivered mg/gm for single-ingredient solutions (e.g. Senna 10ml $\rightarrow$ `ADM 10ML (17.2MG)`, Enulose 15ml $\rightarrow$ `ADM 15ML (10GM)`), while suppressing parenthetical doses for combination liquids (e.g. Guaiasorb DM 100-10/5ml $\rightarrow$ `ADM 10ML PO`).
   * **Bracketed Liquid Concentrates:** Morphine concentrate 20mg/ml 0.5ml $\rightarrow$ maps to `[ROX10MG]` without duplicate parentheticals.
   * **Injectables:** Formatted as `INJ <vol>ML (<dose>) SQ/IM`. Volume strictly precedes dose (e.g. Trulicity 4.5mg/0.5ml $\rightarrow$ `INJ 0.5ML (4.5MG) SQ QPMDAY7 FDM`, Enoxaparin 30mg/0.3ml 3ml $\rightarrow$ `INJ 3ML (300MG) SQ Q12H X13D FDVTP`).
   * **Transdermal vs Topical:** Distinguishes patches (`1PA TRANSDERMALLY`) from topical applications (`AP <dose> TPCL`).
   * **Diclofenac Gel 1% Rules:** Upper body site $\rightarrow$ `AP 2GM TPCL`; Lower body/legs $\rightarrow$ `AP4GM TPCL` (without space to prevent APAP macro expansion); unspecified site defaults to `2GM` with an Applied Correction notice.
   * **APAP Limits:** Products containing acetaminophen automatically append `3GM` (or `3GME` if "do not exceed 3g/day" is stated).
2. **Frequency, Modifiers, Hold Parameters & Sliding Scales (`src/lib/clinical/frequencyEngine.ts`):**
   * **Word-Bounded Frequency Normalization:** Resolves `QD`, `QDA/B` (before breakfast), `QDP/D` (after dinner), `QAM`, `QHS`, `BID`, `BIDAMHS`, `TID`, `QID`, `Q12H`, `Q6H`, `Q4H`, `QPMDAY7` (Sunday evening). Word boundaries prevent false matches (e.g. "morbid" does not match BID; "3 months" does not match HS).
   * **PRN vs. Scheduled Duration Ordering:**
     * Scheduled: Duration precedes indication (`1T PO Q12H X7D FCOU`).
     * PRN: Indication precedes duration (`1T PO Q12H PRN FCOU X7D`).
   * **Clinical Hold Parameters:** Extracts cardiovascular and GI hold conditions (e.g. `HR60SBP100`, `(H >2 BOWEL MOVEMENTS DAILY)`).
   * **Sliding Scale Insulin:** Mandatory prefix `CBS AC SS` (before meals) or `CBS ACHS SS` (before meals and at bedtime), ascending numerical sort of all brackets (`<70=...;181-200=1U;...;>350=5U`), and automatic normalization of `ml` to `U` with Applied Correction. Regular scheduled insulin uses `UN`.
   * **Diagnostic Indications:** Pre-compiled regex lookup mapping `FGERD`, `FSU`, `FBPH`, `FDM2`, `FHYT`, `FGIP`, `FCOU`, `FHTN`, `FDVTP`, `FPAIN`, `FCON`. Single punctuation after tokens is preserved for Framework tokenization.
   * **Template Blending:** Reconstitution default templates (e.g. Miralax, Kristalose) are cleanly merged with user quantity, frequency, and indication.

### C. Paxit Oral Solid Packaging & Multi-Order Engine (`src/lib/clinical/paxitEngine.ts`)
* **Differential Dosing Split:** Different doses across the day (e.g. *Take 2 tablets in the morning and 1 at bedtime*) automatically generate two separate orders:
  * `Order 1 of 2: 2T PO QAM`
  * `Order 2 of 2: 1T PO QHS`
* **Titration Step-Down Split:** Sequential dosing across intervals (e.g. *Take 2 tablets daily x14 days then 1 tablet daily*) automatically generates two separate orders:
  * `Order 1 of 2: 2T (20MG) PO QD X14D`
  * `Order 2 of 2: 1T PO QD`
* **Identical Dose Consolidation:** Doses with identical quantities across meals (e.g. 1 tab morning and 1 tab bedtime) are consolidated into a single order (`1T PO BIDAMHS`).
* **Context Preservation:** Diagnostic indications and PRN conditions are propagated across split orders.

### D. Citrix Persistent Storage Adapter (`src/lib/citrixStorage.ts`)
* **File System Access API (`window.showDirectoryPicker`):** Prompts the technician once to select their redirected Citrix `Documents/storage/` folder (`file://ctxfilebalt01v.pharmacy.local/.../Documents/storage/`).
* **Direct JSON Persistence:** Reads and writes clean, formatted JSON:
  * `queue.json`: Active and processed orders, drafts, and split sub-orders.
  * `discrepancies.json`: Technician feedback and uncaught edge cases.
  * `preferences.json`: Personal/site macro overrides (e.g. `WARFARIN`/`COUMADIN` $\rightarrow$ `COU` to set 1800 admin time in FrameworkLTC).
* **Write Debouncing & Buffering:** 500ms debounce with pending in-memory write buffer to protect redirected network shares against rapid typing saturation.
* **Resilient Fallback:** Automatically falls back to `localStorage` when File System Access API is unavailable or blocked, with quota error handling.

### E. Technician UI & Safety Safeguards
* **Abnormality Banner (`src/components/AbnormalityBanner.tsx`):**
  * Displays high-visibility clinical notices:
    1. *Uncorrected Gap:* "The generated Sig does NOT contain a correction, consult RPh."
    2. *Applied Correction:* "The generated Sig CONTAINS A CORRECTION. Correction: ... Trigger: ..."
    3. *Potential Error / Mismatch:* "THIS ORDER CONTAINS A POTENTIAL ERROR. NO CORRECTION WAS APPLIED. CONSULT RPH. Error: ... Trigger: ..."
* **Multi-Order Split Cards (`src/components/MultiOrderCards.tsx`):** Stacked sub-cards for Paxit orders. Each card provides an independent draft editor, review approval checkbox, and dedicated copy button disabled until reviewed.
* **Discrepancy Feedback Panel (`src/components/DiscrepancyPanel.tsx`):** Feedback drawer with double-click guard and `Alt + N` shortcut, saving directly to `discrepancies.json`.
* **Clipboard Safeguard:** Copy button is locked until explicit review confirmation. All copied output is strictly uppercase.
* **Reload Protection:** Browser `beforeunload` warning prompts the user if unreviewed orders exist in the active queue.

---

## 3. Test & Verification Matrix
* **Unit & Integration Tests:** 117/117 passing across 14 test suites (`tests/clinicalEngine.test.ts`, `tests/doseCalculator.test.ts`, `tests/frequencyEngine.test.ts`, `tests/clinicalInboundParser.test.ts`, `tests/citrixStorage.test.ts`, `tests/uiIntegration.test.tsx`, etc.).
* **Type Safety:** 0 errors on `tsc --noEmit -p tsconfig.app.json`.
* **Production Build:** Vite production bundle passes cleanly with zero errors.
* **Privacy / PHI Compliance:** Strict HIPAA Safe Harbor de-identification; zero PHI in test fixtures, source code, or commit logs.
