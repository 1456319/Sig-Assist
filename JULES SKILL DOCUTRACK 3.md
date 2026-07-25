DESCRIPTION:
Skill guide for DocuTrack 6.6.SP4 core features, including Active Directory, document import rules, search folders, annotations, and system maintenance.

INSTRUCTIONS:
DocuTrack 6.6.SP4 Core Features Skill

1. System Overview & Active Directory

DocuTrack supports both Active Directory (AD) and non-AD single sign-on (SSO) login options[cite: 4].





LDAP Configuration: Configured in System Maintenance > Active Directory Interface[cite: 4]. Supports single or multiple domains separated by semicolons (e.g., LDAP://DOMAIN1; LDAP://DOMAIN2)[cite: 4].



Group Mapping: Mapped in Groups Workspace under the Active Directory Mapping section to automatically assign permissions based on OS login[cite: 4].

2. Address Book & Document Sources

Sources uniquely identify where incoming documents originate[cite: 4].





Source Types: Includes E-Form, DeliveryTrack, Facility ID, Interface, DIRECT (HL7), and Direct Printer[cite: 4]. Unidentified incoming documents default to (No Source ID)[cite: 4].



Processing Rules: Set up rules per source for confirmations (with or without thumbnails up to 9 pages), fax/email forwarding, auto-deletion on reception, or error notifications[cite: 4].



Merging & Deleting: Sources can be merged under a primary parent source[cite: 4]. Deleting a source with associated documents inactivates it (<[deleted] Source Name>), preserving readability[cite: 4].

3. Document Import & Drag & Drop

DocuTrack processes incoming documents asynchronously via the Document Import service[cite: 4].





Supported File Types: PDF, TIF/TIFF, JPG, PNG, BMP, GIF, TXT, LOG, DOCX/DOC, XLSX/XLS/XLSM, EML, and Audio files (MP3/WAV/WMA/AIFF)[cite: 4].



Drag and Drop: Documents can be dragged into the Viewer using "Immediately load" or "Not Immediately load" (processed via DirectConnectImport)[cite: 4].



Import Rules: Priority-based rules evaluated top-to-bottom[cite: 4]. Includes collation options, email body inclusion, page splitting, auto-rotation, and watermarking[cite: 4].

4. Viewer, Annotations, and Stamps





Stamps: Supports Global, Dynamic (populates User ID/Timestamp), Custom, and Business Unit specific PNG stamps[cite: 4].



Annotations: Includes Hand, Pencil, Highlighter, Text, Line, Typewriter, and Note/Reply tools[cite: 4]. Entity associations (Prescription, Patient, Physician) and Secure Messages can be dragged onto documents as structured color-coded text notes[cite: 4].



Watermarks: Applied upon replication (Print, Email, Fax) for documents imported under watermark-enabled rules[cite: 4].

5. Workflow & Search Folders

Search Folders structure the pharmacy workflow by categorizing documents according to metadata, status, date, or source[cite: 4].





Folder Types: Private (user-level), Public (business unit-level), and Global (spans multiple business units)[cite: 4].



Audit Assist: Accessible via Ctrl+Alt+R, allowing rapid review, export, or printing of up to 150 Rx IDs across all permitted business units[cite: 4].

6. Critical Keyboard Shortcuts





Ctrl+S: Save active document[cite: 4].



Ctrl+1 to Ctrl+4: Jump to Custom Lists 1–4[cite: 4].



Ctrl+Alt+S: Save / Next document in queue[cite: 4].



Ctrl+Alt+R: Open Audit Assist Workspace[cite: 4].



Ctrl+Alt+M: Launch Secure Messaging dialog[cite: 4].



Ctrl+Shift+R: Rotate document 180 degrees[cite: 4].



Ctrl+Shift+H: Toggle/Hide annotations[cite: 4].

