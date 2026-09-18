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
