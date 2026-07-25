Skill guide for DocuTrack 6.6.SP4 SQL Reporting Services (SSRS) reports, system audits, and custom reporting database views.

INSTRUCTIONS:
DocuTrack 6.6.SP4 Reports and Report Views Skill

1. SQL Reporting Service Requirements

DocuTrack reports run on SQL Server 2008 or higher using SQL Server Reporting Services (SSRS)[cite: 3].





Browser Compatibility: Designed primarily for Internet Explorer[cite: 3]. 



Data Refreshing: Use the explicitly provided refresh button or re-navigate to the report menu rather than relying solely on standard browser controls[cite: 3].



Reinstallation/Repair: Issues with report generation should be resolved by uninstalling and reinstalling RDL files via DocuTrack Install.exe rather than using the Repair option[cite: 3].

2. Predefined SSRS Management & Audit Reports





Administration and System Audits (vwRPT_AuditSummary): Summarizes changes made to Doc Data, Groups, Users, Archives, etc., within a date range[cite: 3].



Association Count by User / Doc Type: Tracks total associations and disassociations per user and categories, including average open processing times[cite: 3].



Average Completion Time to List Item: Measures the time elapsed from document reception to status list assignment[cite: 3].



Average Documents Received per Hour: Histogram display showing incoming document throughput broken down by hour[cite: 3].



Custom List 1 Exception by Time and User: Identifies documents exceeding threshold processing times in specific custom statuses and identifies the user who transitioned them[cite: 3].



Document Work Done by User: Logs every document opened by a user and the precise work performed[cite: 3].



Fax Activity Summary / Detail: Summarizes fax activity, statuses, and delivery metrics (etherFAX and FaxCore providers)[cite: 3].



Manifest Reconciliation Report: Lists printed pharmacy manifests not yet received back into DocuTrack[cite: 3].



Top Fax Numbers that Fail: Identifies recipient fax numbers generating the highest failure rates (requires etherFAX)[cite: 3].



Workflow Omissions Report: Audits Business Unit document data not covered by search folder criteria or group permissions[cite: 3].

3. Custom Database Views (vwRPT_*)

DocuTrack exposes standardized custom SQL views for external SQL reporting, BI tools, and custom dashboards[cite: 3]:





vwRPT_AssociationAudits: Complete historical record of all document associations and disassociations[cite: 3].



vwRPT_AuditSummary: Summary of user actions with a CountOfActions tally[cite: 3].



vwRPT_CustomListAudits & vwRPT_CustomList1Audits: Audit trail for custom list and status changes grouped by AuditDate[cite: 3].



vwRPT_CustomValueAudits: Logs custom text/value entries and audit session metadata[cite: 3].



vwRPT_DocumentAssociations: Displays active, currently associated entities[cite: 3].



vwRPT_Documents: Primary view for document metadata, dates, and core attributes[cite: 3].



vwRPT_DocumentTypes: Reference mapping of Document Types, Departments, and Business Units[cite: 3].



vwRPT_DocumentStamps: Exposes information related to applied document stamps[cite: 3].



vwRPT_FaxAudits: Logs inbound/outbound fax events (returns latest status per fax)[cite: 3].



vwRPT_StapledDocumentMap: Maps historical relationships between parent and child document IDs after staple/unstaple operations[cite: 3].

