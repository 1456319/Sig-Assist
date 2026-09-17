DESCRIPTION:
Skill guide for DocuTrack 6.6.SP4 integrations, including document transmission servers, Direct Connect, and Pharmacy Information Systems (PIS).


INSTRUCTIONS:
DocuTrack 6.6.SP4 Interfaces Skill

1. Transmission & Fax Providers

DocuTrack integrates with multiple transmission architectures[cite: 5]. Any configuration change requires restarting the DocuTrack Fax Service[cite: 5].





DIRECT (HL7 / SES Connect): Encrypted email exchange utilizing TLS 1.1/1.2 and client certificates for HIPAA-compliant clinical messaging[cite: 5].



etherFAX: Cloud-based REST 2.0 API faxing operating with TLS 1.1/1.2[cite: 5]. Supports status callbacks, getnext queue processing, and automated retry logic[cite: 5].



FaxCore: Web-service HTTP/HTTPS connection using server inboxes (Inbox, Failed)[cite: 5].



FACSys / RightFax / WeFax / Generic Email: Supported legacy and enterprise fax server engines[cite: 5].

2. Pharmacy Information Systems (PIS) Integrations

DocuTrack connects to PIS solutions via Direct Connect (COM/Web Service), file monitoring, or screen scraping/keyboard wedges[cite: 5]:

FrameworkLTC





Integration: Direct Connect COM (clients run on same machine) and Web Services[cite: 5].



Features: Supports Prescriptions, Patients, Facilities, Physicians, Ancillaries, and Manifests[cite: 5].



Macro Buttons: Native support to open Rx edit screens, review screens, patient profiles, or load eRx messages into the FrameworkLTC eRx Triage Manager[cite: 5].



Refill Statuses: Barcode highlighting changes dynamically according to refill submission responses (e.g., Aqua = OK/Submitted, Yellow = Inactive/Expired, Red = Failed)[cite: 5].

QS/1 (PrimeCare & NRx)





Integration: Direct Connect COM, HL7 refill feed, and FileReader for manifests[cite: 5].



Features: Supports temporary Rx numbers (03########) transitioning to permanent IDs[cite: 5]. Direct print integration via Direct Print Driver[cite: 5].



eRx Tickler Scan: Macro buttons auto-navigate QS/1's Tickler Scan using the [E-RX Data QHD].Ctrl/Reference# saved report filter[cite: 5].

Other Supported PIS Platforms





HBS: Direct Connect Web Services; supports 7- or 8-digit Rx numbers, manifest caching, and verification queue macros[cite: 5].



Oasis: Web service integration (Document_Info_Get, Document_Return_Send_To_User) with OnSave and OnAssociate scripting validation hooks[cite: 5].



Compounder Rx / CPR+ / FRED / FSI: Keyboard wedge and UIPath automation workflows[cite: 5].



Rescot & RNA: File Reader manifest integration combined with directory-monitored refill submission flat files[cite: 5].

3. Specialized Integration Modules





FileReader Service: Monitors directory shares to process incoming ASCII/CSV flat-file manifests (supports files up to 25 MB)[cite: 5].



Direct ID: Hardware badge reader module (e.g., PcProx) enforcing user presence to save changes[cite: 5].



DeliveryTrack: Integrates via Direct Connect calls (InsertDocument, QueryEntity) for delivery proof and manifest data[cite: 5].



Logix Interface: Automates complex background document workflows, custom macros, and automated task execution[cite: 5].

