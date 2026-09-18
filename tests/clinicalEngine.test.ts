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
    expect(res.subOrders[0].suggestedSig).toContain('2T (600MG) PO QAM');
    expect(res.subOrders[1].label).toBe('Order 2 of 2');
    expect(res.subOrders[1].suggestedSig).toContain('1T PO QHS');
  });

  it('splits Paxit titration step-down into two separate order cards', () => {
    const raw = `PREDNISONE TAB 10MG\nUSER ENTRY: Take 2 tablets by mouth for 5 days then take 1 tablet daily`;
    const res = translateClinicalSig(parseInboundOrder(raw));
    expect(res.subOrders.length).toBe(2);
    expect(res.subOrders[0].label).toBe('Order 1 of 2');
    expect(res.subOrders[0].suggestedSig).toBe('2T (20MG) PO QD X5D');
    expect(res.subOrders[1].label).toBe('Order 2 of 2');
    expect(res.subOrders[1].suggestedSig).toBe('1T PO QD');
  });

  it('does not split non-oral-solid formulations in Paxit evaluation', () => {
    const raw = `VOLTAREN GEL 1%\nUSER ENTRY: Apply 2GM to right knee four times a day as needed for pain`;
    const res = translateClinicalSig(parseInboundOrder(raw));
    expect(res.subOrders.length).toBe(1);
    expect(res.subOrders[0].label).toBe('Order 1 of 1');
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

  it('splits Paxit differing daily doses with natural phrasing containing letters A/N/D', () => {
    const raw = `GABAPENTIN TAB 300MG\nUSER ENTRY: Take 2 tablets by mouth in the morning and 1 tablet at night before bedtime with food`;
    const res = translateClinicalSig(parseInboundOrder(raw));
    expect(res.primarySig).toBe('2T (600MG) PO QAM AND 1T PO QHS');
    expect(res.subOrders.length).toBe(2);
    expect(res.subOrders[0].label).toBe('Order 1 of 2');
    expect(res.subOrders[0].suggestedSig).toContain('2T (600MG) PO QAM');
    expect(res.subOrders[1].label).toBe('Order 2 of 2');
    expect(res.subOrders[1].suggestedSig).toContain('1T PO QHS');
    expect(res.abnormalities.some(a => a.title.includes('Paxit Packaging'))).toBe(true);
  });

  it('does not split Paxit orders when morning and bedtime doses are identical, consolidating into BIDAMHS', () => {
    const raw = `GABAPENTIN TAB 300MG\nUSER ENTRY: Take 1 tablet every morning and 1 at bedtime`;
    const res = translateClinicalSig(parseInboundOrder(raw));
    expect(res.subOrders.length).toBe(1);
    expect(res.subOrders[0].label).toBe('Order 1 of 1');
    expect(res.primarySig).toBe('1T PO BIDAMHS');
  });

  it('supports titration step-down with frequency phrases like daily x14 days', () => {
    const raw = `PREDNISONE TAB 10MG\nUSER ENTRY: Take 2 tablets daily x14 days then 1 tablet daily`;
    const res = translateClinicalSig(parseInboundOrder(raw));
    expect(res.primarySig).toBe('2T (20MG) PO QD X14D THEN 1T PO QD');
    expect(res.subOrders.length).toBe(2);
    expect(res.subOrders[0].label).toBe('Order 1 of 2');
    expect(res.subOrders[0].suggestedSig).toBe('2T (20MG) PO QD X14D');
    expect(res.subOrders[1].label).toBe('Order 2 of 2');
    expect(res.subOrders[1].suggestedSig).toBe('1T PO QD');
    expect(res.abnormalities.some(a => a.title.includes('Paxit Packaging'))).toBe(true);
  });

  it('preserves trailing indication across synthesized Paxit split sub-orders and in primarySig', () => {
    const raw = `GABAPENTIN TAB 300MG\nUSER ENTRY: Take 2 tablets by mouth every morning and 1 at night before bedtime for pain`;
    const res = translateClinicalSig(parseInboundOrder(raw));
    expect(res.primarySig).toBe('2T (600MG) PO QAM AND 1T PO QHS FPAIN');
    expect(res.subOrders.length).toBe(2);
    expect(res.subOrders[0].suggestedSig).toBe('2T (600MG) PO QAM FPAIN');
    expect(res.subOrders[1].suggestedSig).toBe('1T PO QHS FPAIN');
  });

  it('preserves freeform trailing indication across synthesized Paxit titration sub-orders and in primarySig', () => {
    const raw = `PREDNISONE TAB 10MG\nUSER ENTRY: Take 2 tablets daily x14 days then 1 tablet daily for neuropathy`;
    const res = translateClinicalSig(parseInboundOrder(raw));
    expect(res.primarySig).toBe('2T (20MG) PO QD X14D THEN 1T PO QD FOR NEUROPATHY');
    expect(res.subOrders.length).toBe(2);
    expect(res.subOrders[0].suggestedSig).toBe('2T (20MG) PO QD X14D FOR NEUROPATHY');
    expect(res.subOrders[1].suggestedSig).toBe('1T PO QD FOR NEUROPATHY');
  });

  it('utilizes inbound.indication as fallback when prose lacks inline indication', () => {
    const order = {
      id: 'test_ncpdp_1',
      pon: 'PON12345',
      drugName: 'PROTONIX 40MG TABLET',
      rawProse: 'Give 1 tablet by mouth one time a day',
      indication: 'GERD',
      sourceFormat: 'ncpdp_xml' as const
    };
    const res = translateClinicalSig(order);
    expect(res.primarySig).toBe('1T PO QD FGERD');
  });

  it('propagates inbound.indication fallback to split sub-orders when prose lacks inline indication', () => {
    const order = {
      id: 'test_ncpdp_paxit',
      pon: 'PON12346',
      drugName: 'GABAPENTIN TAB 300MG',
      rawProse: 'Take 2 tablets by mouth in the morning and 1 at bedtime',
      indication: 'Pain',
      sourceFormat: 'ncpdp_xml' as const
    };
    const res = translateClinicalSig(order);
    expect(res.subOrders.length).toBe(2);
    expect(res.subOrders[0].suggestedSig).toBe('2T (600MG) PO QAM FPAIN');
    expect(res.subOrders[1].suggestedSig).toBe('1T PO QHS FPAIN');
  });
});
