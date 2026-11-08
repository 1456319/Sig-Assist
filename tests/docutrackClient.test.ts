import { describe, expect, it } from 'vitest';
import {
  buildDciEntityXml,
  parseDciEntityXml,
  buildDocuTrackLaunchArgs,
  DocuTrackReportQueries,
  DocuTrackShortcuts
} from '../src/lib/docutrackClient';

describe('DocuTrack 6.6 Client Automation', () => {
  it('builds a valid DCI XML entity packet with escaped attributes', () => {
    const xml = buildDciEntityXml({
      facilities: [
        { uniqueId: 'FAC01', name: 'Pinecrest & Co <Senior Living>' }
      ],
      patients: [
        { uniqueId: 'PAT100', firstName: 'Jane "Janie"', lastName: 'Doe', dob: '1945-05-12' }
      ],
      rxs: [
        {
          uniqueId: 'RX123456',
          medicationName: 'Lisinopril 10mg Tab',
          dateWritten: '2026-11-01',
          status: 'Active',
          notes: 'Take 1 PO QD & monitor BP'
        }
      ]
    });

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<EntityRootData>');
    expect(xml).toContain('Name="Pinecrest &amp; Co &lt;Senior Living&gt;"');
    expect(xml).toContain('FirstName="Jane &quot;Janie&quot;"');
    expect(xml).toContain('Notes="Take 1 PO QD &amp; monitor BP"');
    expect(xml).toContain('UniqueID="RX123456"');
  });

  it('parses DCI XML packets back into entity objects', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<EntityRootData>
  <Facilities>
    <Facility UniqueID="FAC01" Name="Sunrise Manor &amp; Villas" PharmacyUniqueID="PHARM1"/>
  </Facilities>
  <Manifests>
    <Manifest UniqueID="MAN01" SignedByLastName="Smith" DeliveryDateTime="2026-11-08 09:00:00" DirectDelivery="1"/>
  </Manifests>
  <Patients>
    <Patient UniqueID="PAT999" FirstName="Robert &quot;Bob&quot;" LastName="Smith" DOB="1950-01-01" Location="Room 102"/>
  </Patients>
  <Physicians>
    <Physician UniqueID="DOC1" FirstName="Gregory" LastName="House"/>
  </Physicians>
  <RXs>
    <RX UniqueID="RX888" MedicationName="Metformin &lt;500mg&gt;" Status="Submitted" Refill="1"/>
  </RXs>
</EntityRootData>`;

    const parsed = parseDciEntityXml(xml);
    expect(parsed.facilities).toHaveLength(1);
    expect(parsed.facilities![0].uniqueId).toBe('FAC01');
    expect(parsed.facilities![0].name).toBe('Sunrise Manor & Villas');
    expect(parsed.facilities![0].pharmacyUniqueId).toBe('PHARM1');

    expect(parsed.manifests).toHaveLength(1);
    expect(parsed.manifests![0].uniqueId).toBe('MAN01');
    expect(parsed.manifests![0].directDelivery).toBe('1');
    expect(parsed.manifests![0].signedByLastName).toBe('Smith');

    expect(parsed.patients).toHaveLength(1);
    expect(parsed.patients![0].uniqueId).toBe('PAT999');
    expect(parsed.patients![0].firstName).toBe('Robert "Bob"');
    expect(parsed.patients![0].location).toBe('Room 102');

    expect(parsed.physicians).toHaveLength(1);
    expect(parsed.physicians![0].uniqueId).toBe('DOC1');
    expect(parsed.physicians![0].lastName).toBe('House');

    expect(parsed.rxs).toHaveLength(1);
    expect(parsed.rxs![0].uniqueId).toBe('RX888');
    expect(parsed.rxs![0].medicationName).toBe('Metformin <500mg>');
    expect(parsed.rxs![0].refill).toBe('1');
  });

  it('generates command line launch arguments for DocuTrack.exe', () => {
    const args = buildDocuTrackLaunchArgs({
      documentId: 'DOC9090',
      rxNumber: '1234567',
      patientId: 'P001',
      folderId: 'FLD_INBOX'
    });

    expect(args).toEqual([
      '/docid:DOC9090',
      '/rx:1234567',
      '/patient:P001',
      '/folder:FLD_INBOX'
    ]);
  });

  it('generates sanitized SQL queries for DocuTrack SSRS reporting views', () => {
    const rxQuery = DocuTrackReportQueries.findDocumentsByRx("12345'; DROP TABLE vwRPT_Documents;--");
    expect(rxQuery).not.toContain("';");
    expect(rxQuery).toContain('12345 DROP TABLE vwRPT[_]Documents--');
    expect(rxQuery).toContain('FROM vwRPT_Documents WHERE AssociatedEntities LIKE');

    const wildcardQuery = DocuTrackReportQueries.findDocumentsByRx('RX%123_45[A]');
    expect(wildcardQuery).toContain("LIKE '%RX[%]123[_]45[[]A[]]%'");

    const assocQuery = DocuTrackReportQueries.findAssociations('DOC123');
    expect(assocQuery).toBe(
      "SELECT DocumentID, EntityType, EntityUniqueID, AssociatedDate FROM vwRPT_DocumentAssociations WHERE DocumentID = 'DOC123';"
    );
  });

  it('exposes standard DocuTrack navigation keyboard shortcuts', () => {
    expect(DocuTrackShortcuts.SAVE_DOCUMENT).toBe('^s');
    expect(DocuTrackShortcuts.CUSTOM_LIST_1).toBe('^1');
    expect(DocuTrackShortcuts.AUDIT_ASSIST).toBe('^%r');
  });
});
