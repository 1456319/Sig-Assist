/**
 * DocuTrack 6.6 SP4 Client & Server Automation Bridge
 *
 * Implements:
 * 1. DCIEntities (DocuTrack Client Interface) XML packet construction and parsing conforming to Integra's DCI schema.
 * 2. DirectConnect COM and Web Service contracts for FrameworkLTC / PIS interoperability.
 * 3. Command-line invocation and macro automation parameters for DocuTrack.exe / DCIServer.exe.
 * 4. Reporting view query definitions (vwRPT_Documents, vwRPT_DocumentAssociations).
 */

export interface DocuTrackRxEntity {
  associate?: string;
  uniqueId: string;
  secondaryId?: string;
  medicationName: string;
  dateWritten?: string;
  dateDispensed?: string;
  status?: string;
  notes?: string;
  patientUniqueId?: string;
  firstName?: string;
  lastName?: string;
  facilityUniqueId?: string;
  physicianUniqueId?: string;
  pharmacyUniqueId?: string;
  refill?: string;
  licenseType?: string;
}

export interface DocuTrackPatientEntity {
  associate?: string;
  uniqueId: string;
  secondaryId?: string;
  firstName: string;
  lastName: string;
  location?: string;
  dob?: string;
  facilityUniqueId?: string;
  pharmacyUniqueId?: string;
}

export interface DocuTrackFacilityEntity {
  associate?: string;
  uniqueId: string;
  secondaryId?: string;
  name: string;
  pharmacyUniqueId?: string;
}

export interface DocuTrackPhysicianEntity {
  associate?: string;
  uniqueId: string;
  secondaryId?: string;
  firstName?: string;
  lastName?: string;
  pharmacyUniqueId?: string;
}

export interface DocuTrackManifestEntity {
  associate?: string;
  uniqueId: string;
  secondaryId?: string;
  signedByLastName?: string;
  signedByFirstName?: string;
  deliveryDateTime?: string;
  facilityUniqueId?: string;
  directDelivery?: '0' | '1';
  pharmacyUniqueId?: string;
}

export interface DocuTrackEntityPackage {
  rxs?: DocuTrackRxEntity[];
  patients?: DocuTrackPatientEntity[];
  facilities?: DocuTrackFacilityEntity[];
  physicians?: DocuTrackPhysicianEntity[];
  manifests?: DocuTrackManifestEntity[];
}

function escapeXmlAttr(value: string | undefined): string {
  if (value === undefined || value === null) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Builds the canonical DocuTrack DCI XML payload (<EntityRootData>).
 */
export function buildDciEntityXml(pkg: DocuTrackEntityPackage): string {
  const parts: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<EntityRootData>'];

  // Ancillaries node (empty by default)
  parts.push('  <Ancillaries/>');

  // Facilities
  parts.push('  <Facilities>');
  if (pkg.facilities) {
    for (const f of pkg.facilities) {
      parts.push(
        `    <Facility Associate="${escapeXmlAttr(f.associate)}" UniqueID="${escapeXmlAttr(f.uniqueId)}" SecondaryID="${escapeXmlAttr(f.secondaryId)}" Name="${escapeXmlAttr(f.name)}" PharmacyUniqueID="${escapeXmlAttr(f.pharmacyUniqueId)}"/>`
      );
    }
  }
  parts.push('  </Facilities>');

  // Manifests
  parts.push('  <Manifests>');
  if (pkg.manifests) {
    for (const m of pkg.manifests) {
      parts.push(
        `    <Manifest Associate="${escapeXmlAttr(m.associate)}" UniqueID="${escapeXmlAttr(m.uniqueId)}" SecondaryID="${escapeXmlAttr(m.secondaryId)}" SignedByLastName="${escapeXmlAttr(m.signedByLastName)}" SignedByFirstName="${escapeXmlAttr(m.signedByFirstName)}" DeliveryDateTime="${escapeXmlAttr(m.deliveryDateTime)}" FacilityUniqueID="${escapeXmlAttr(m.facilityUniqueId)}" DirectDelivery="${escapeXmlAttr(m.directDelivery ?? '0')}" PharmacyUniqueID="${escapeXmlAttr(m.pharmacyUniqueId)}"/>`
      );
    }
  }
  parts.push('  </Manifests>');

  // Patients
  parts.push('  <Patients>');
  if (pkg.patients) {
    for (const p of pkg.patients) {
      parts.push(
        `    <Patient Associate="${escapeXmlAttr(p.associate)}" UniqueID="${escapeXmlAttr(p.uniqueId)}" SecondaryID="${escapeXmlAttr(p.secondaryId)}" FirstName="${escapeXmlAttr(p.firstName)}" LastName="${escapeXmlAttr(p.lastName)}" Location="${escapeXmlAttr(p.location)}" DOB="${escapeXmlAttr(p.dob)}" FacilityUniqueID="${escapeXmlAttr(p.facilityUniqueId)}" PharmacyUniqueID="${escapeXmlAttr(p.pharmacyUniqueId)}"/>`
      );
    }
  }
  parts.push('  </Patients>');

  // Physicians
  parts.push('  <Physicians>');
  if (pkg.physicians) {
    for (const d of pkg.physicians) {
      parts.push(
        `    <Physician Associate="${escapeXmlAttr(d.associate)}" UniqueID="${escapeXmlAttr(d.uniqueId)}" SecondaryID="${escapeXmlAttr(d.secondaryId)}" FirstName="${escapeXmlAttr(d.firstName)}" LastName="${escapeXmlAttr(d.lastName)}" PharmacyUniqueID="${escapeXmlAttr(d.pharmacyUniqueId)}"/>`
      );
    }
  }
  parts.push('  </Physicians>');

  // RXs
  parts.push('  <RXs>');
  if (pkg.rxs) {
    for (const rx of pkg.rxs) {
      parts.push(
        `    <RX Associate="${escapeXmlAttr(rx.associate)}" UniqueID="${escapeXmlAttr(rx.uniqueId)}" SecondaryID="${escapeXmlAttr(rx.secondaryId)}" MedicationName="${escapeXmlAttr(rx.medicationName)}" DateWritten="${escapeXmlAttr(rx.dateWritten)}" DateDispensed="${escapeXmlAttr(rx.dateDispensed)}" Status="${escapeXmlAttr(rx.status)}" Notes="${escapeXmlAttr(rx.notes)}" PatientUniqueID="${escapeXmlAttr(rx.patientUniqueId)}" FirstName="${escapeXmlAttr(rx.firstName)}" LastName="${escapeXmlAttr(rx.lastName)}" FacilityUniqueID="${escapeXmlAttr(rx.facilityUniqueId)}" PhysicianUniqueID="${escapeXmlAttr(rx.physicianUniqueId)}" PharmacyUniqueID="${escapeXmlAttr(rx.pharmacyUniqueId)}" Refill="${escapeXmlAttr(rx.refill)}" LicenseType="${escapeXmlAttr(rx.licenseType)}"/>`
      );
    }
  }
  parts.push('  </RXs>');

  parts.push('</EntityRootData>');
  return parts.join('\n');
}

/**
 * Parses basic attributes from a DCI XML string.
 */
export function parseDciEntityXml(xml: string): DocuTrackEntityPackage {
  const pkg: DocuTrackEntityPackage = {
    rxs: [],
    patients: [],
    facilities: [],
    physicians: [],
    manifests: []
  };

  const rxRegex = /<RX\b([^>]*)\/>/gi;
  let match: RegExpExecArray | null;
  while ((match = rxRegex.exec(xml)) !== null) {
    const attrs = parseXmlAttributes(match[1]);
    if (attrs.uniqueid) {
      pkg.rxs!.push({
        associate: attrs.associate,
        uniqueId: attrs.uniqueid,
        secondaryId: attrs.secondaryid,
        medicationName: attrs.medicationname || '',
        dateWritten: attrs.datewritten,
        dateDispensed: attrs.datedispensed,
        status: attrs.status,
        notes: attrs.notes,
        patientUniqueId: attrs.patientuniqueid,
        firstName: attrs.firstname,
        lastName: attrs.lastname,
        facilityUniqueId: attrs.facilityuniqueid,
        physicianUniqueId: attrs.physicianuniqueid,
        pharmacyUniqueId: attrs.pharmacyuniqueid,
        refill: attrs.refill,
        licenseType: attrs.licensetype
      });
    }
  }

  const patientRegex = /<Patient\b([^>]*)\/>/gi;
  while ((match = patientRegex.exec(xml)) !== null) {
    const attrs = parseXmlAttributes(match[1]);
    if (attrs.uniqueid) {
      pkg.patients!.push({
        associate: attrs.associate,
        uniqueId: attrs.uniqueid,
        secondaryId: attrs.secondaryid,
        firstName: attrs.firstname || '',
        lastName: attrs.lastname || '',
        location: attrs.location,
        dob: attrs.dob,
        facilityUniqueId: attrs.facilityuniqueid,
        pharmacyUniqueId: attrs.pharmacyuniqueid
      });
    }
  }

  const facilityRegex = /<Facility\b([^>]*)\/>/gi;
  while ((match = facilityRegex.exec(xml)) !== null) {
    const attrs = parseXmlAttributes(match[1]);
    if (attrs.uniqueid) {
      pkg.facilities!.push({
        associate: attrs.associate,
        uniqueId: attrs.uniqueid,
        secondaryId: attrs.secondaryid,
        name: attrs.name || '',
        pharmacyUniqueId: attrs.pharmacyuniqueid
      });
    }
  }

  const physicianRegex = /<Physician\b([^>]*)\/>/gi;
  while ((match = physicianRegex.exec(xml)) !== null) {
    const attrs = parseXmlAttributes(match[1]);
    if (attrs.uniqueid) {
      pkg.physicians!.push({
        associate: attrs.associate,
        uniqueId: attrs.uniqueid,
        secondaryId: attrs.secondaryid,
        firstName: attrs.firstname,
        lastName: attrs.lastname,
        pharmacyUniqueId: attrs.pharmacyuniqueid
      });
    }
  }

  const manifestRegex = /<Manifest\b([^>]*)\/>/gi;
  while ((match = manifestRegex.exec(xml)) !== null) {
    const attrs = parseXmlAttributes(match[1]);
    if (attrs.uniqueid) {
      pkg.manifests!.push({
        associate: attrs.associate,
        uniqueId: attrs.uniqueid,
        secondaryId: attrs.secondaryid,
        signedByLastName: attrs.signedbylastname,
        signedByFirstName: attrs.signedbyfirstname,
        deliveryDateTime: attrs.deliverydatetime,
        facilityUniqueId: attrs.facilityuniqueid,
        directDelivery: attrs.directdelivery === '1' ? '1' : '0',
        pharmacyUniqueId: attrs.pharmacyuniqueid
      });
    }
  }

  return pkg;
}

function unescapeXmlAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parseXmlAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z0-9_]+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = attrRegex.exec(raw)) !== null) {
    attrs[m[1].toLowerCase()] = unescapeXmlAttr(m[2]);
  }
  return attrs;
}

/**
 * Standard keyboard shortcuts and navigation macros for DocuTrack 6.6 Client.
 */
export const DocuTrackShortcuts = {
  SAVE_DOCUMENT: '^s',          // Ctrl+S
  CUSTOM_LIST_1: '^1',          // Ctrl+1
  CUSTOM_LIST_2: '^2',          // Ctrl+2
  CUSTOM_LIST_3: '^3',          // Ctrl+3
  CUSTOM_LIST_4: '^4',          // Ctrl+4
  AUDIT_ASSIST: '^%r',          // Ctrl+Alt+R (Rapid review of up to 150 Rx IDs)
  REFRESH_REPORT: '{F5}'
} as const;

/**
 * Generates command line parameters to launch DocuTrack.exe targeting a specific Rx or document.
 */
export function buildDocuTrackLaunchArgs(options: {
  documentId?: string;
  rxNumber?: string;
  patientId?: string;
  folderId?: string;
}): string[] {
  const args: string[] = [];
  if (options.documentId) {
    args.push(`/docid:${options.documentId}`);
  }
  if (options.rxNumber) {
    args.push(`/rx:${options.rxNumber}`);
  }
  if (options.patientId) {
    args.push(`/patient:${options.patientId}`);
  }
  if (options.folderId) {
    args.push(`/folder:${options.folderId}`);
  }
  return args;
}

/**
 * Standard SQL queries for querying DocuTrack 6.6's SSRS / Reporting Views directly.
 */
export const DocuTrackReportQueries = {
  /**
   * Find documents matching an Rx number or Prescriber Order Number.
   */
  findDocumentsByRx(rxNumber: string): string {
    const clean = rxNumber.replace(/[';\\]/g, '').replace(/[%_[\]]/g, '[$&]');
    return `SELECT DocumentID, DocumentType, ReceivedDateTime, Status, AssociatedEntities FROM vwRPT_Documents WHERE AssociatedEntities LIKE '%${clean}%' ORDER BY ReceivedDateTime DESC;`;
  },

  /**
   * Check active associations for a document.
   */
  findAssociations(documentId: string): string {
    const clean = documentId.replace(/[';\\]/g, '');
    return `SELECT DocumentID, EntityType, EntityUniqueID, AssociatedDate FROM vwRPT_DocumentAssociations WHERE DocumentID = '${clean}';`;
  }
};
