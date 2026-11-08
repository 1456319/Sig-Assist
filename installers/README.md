# Installer and Decompiled Artifacts Audit Package

This directory contains vendor installers, uncompressed cabinet files, extracted application binaries, COM/DCI integration libraries, and decompiled C# source representations for **FrameworkLTC (SoftWriters)** and **DocuTrack 6.6 (Integra / SoftWriters)**.

These artifacts serve as the audit baseline and reference implementation for the automation subsystems in Sig-Assist (notably `windows/FrameworkDesktop.cs`, `src/utils/docutrackClient.ts`, and E-Rx intake pipelines).

---

## 1. Primary Installer Provenance & SHA-256 Digests

| Package Name | File Path | File Size | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| **FrameworkLTC 3.3.363 Installer** | `installers/SoftWriters.FrameworkLtc.Installer 3.3.363.msi` | 612,577,280 B (~585 MB) | `c957419adf675b68f1082356c9caaffcd8e56c209af006cf362c5ee0817436e6` |
| **FrameworkLTC Drive Sample Installer** | `docs/drive_samples/installer/FWLTCINST.msi` | 612,577,280 B (~585 MB) | `c957419adf675b68f1082356c9caaffcd8e56c209af006cf362c5ee0817436e6` |
| **DocuTrack 6.6.4 Server Installer** | `installers/DocuTrack6.6.4Server.exe` | 223,285,312 B (~213 MB) | `a12d5bb328c6a5e5b3d339b80ff3e2fbab1a24322869ffe36fb793bd59e1ad69` |
| **DocuTrack 6.6.4 Client Installer** | `installers/DocuTrack6.6.4Client.exe` | 105,090,944 B (~101 MB) | `b3de6f44126e67b1ef3e394641a54e5efaf254978ebdd69d01dd060f69065a4b` |

---

## 2. Directory Layout & Extracted Subsystems

### `FrameworkLtc_extracted/`
Contains the raw cabinet files (`cab1.cab` through `cab10.cab`) extracted from `SoftWriters.FrameworkLtc.Installer 3.3.363.msi` using 7-Zip (`7z_extract.log`).

### `FrameworkLtc_binaries/`
Contains the individual decompressed binary files extracted from the cabinet archives using `cabextract` (`cabextract.log`). Files retain their MSI internal sequence identifiers (`fil*`).

### `FrameworkLtc_named/`
Contains the resolved and identified .NET assemblies and native DLLs, including:
- `SoftWriters.FrameworkLtc.WpfHost.dll` &mdash; Host control architecture for WPF grid components.
- `Softwriters.SCRIPT.dll` &mdash; NCPDP SCRIPT standard message parser and validator.
- `Softwriters.FrameworkECM.ClientIntegration.dll` &mdash; Enterprise Content Management integration bridge.
- `SoftWriters.FrameworkEdp.Application.dll` &mdash; Electronic Data Processing application layer.
- `Framework.Claim.Transmitter.dll` &mdash; Adjudication and transmission coordinator.

### `FWPCInt/`
Contains the SoftWriters Framework PC Integration client utilities:
- `FWPCInt.exe` &mdash; Framework PC Integration service executable.
- `fwpcintconfig.exe` &mdash; Integration configuration utility.
- `SwiQry.exe` &mdash; Query utility for workstation-to-database communication.

### `Docutrack_bin_resources/` & `Docutrack_bin_resources.zip`
Contains client and server resources extracted from the DocuTrack 6.6.4 installers:
- **DCI & COM Interop:** `DCIDocument.dll`, `DCIServer.exe`, `DCIEntities.js`, and `Interop.DTClientInterfaceLib.dll`.
- **UI Automation & Screen Scraping:** `ScreenScrapeJavaSupport.exe`, `UIPathScreenScrapeHarness.exe`, `TCapture.dll`, `WHook_x64.dll`, `JavaAccessBridge-32.dll`, `JavaAccessBridge-64.dll`.
- **Imaging & PDF Rendering:** `Aspose.Pdf.dll`, `PDFXEditCore.x86.dll`, `ixclib40.dll`, `xccdx40.dll`, `fm40tiff.dll`.

### Decompiled C# Source Artifacts
Decompiled source files extracted for verifying E-Rx intake models and UI bottlenecks:
- `ERxWorkQueueViewModel.cs` & `ERxWorkQueueView.xaml`: Main view-model and XAML binding definitions for the FrameworkLTC E-Rx work queue.
- `ERxWorkQueueDirectionsViewModel.cs` & `ERxWorkQueueDirectionsView.xaml`: Prescription sig and direction parsing/editing workflow.
- `ERxMessageToViewModelService.cs`: Transformation pipeline converting incoming NCPDP SCRIPT messages into UI view models.
- `ERxWorkQueueWizardViewModel.cs` & `ERxWorkQueueWizardView.xaml`: Multi-step dispensing and clinical verification wizard.
- `ERxNewRxRequestMessageData.cs` & `NEWRXRequest.cs`: Schema structures for incoming `NewRx` requests.

---

## 3. Discrepancy Reports & PHI De-identification Audit

All accompanying clinical and discrepancy datasets stored under `docs/discrepancy reports/` have been processed to ensure complete de-identification in accordance with HIPAA standards:
- **Patient Identifiers:** Deterministically mapped to unique fictional character names (`MOUSE^MICKEY`, `DUCK^DONALD`, `BUNNY^BUGS`, etc.).
- **Addresses & Facilities:** Street addresses mapped to numbered synthetic addresses (`101 Fake Street`, `102 False Street`, `500 Fake Boulevard`, Toontown, CA 90210).
- **Telephone Numbers:** Standardized to synthetic exchange `(555) 555-xxxx`.
- **Social Security Numbers:** Standardized to synthetic format `000-00-xxxx`.
- **Prescriber Identifiers:** Prescriber names mapped to fictional clinicians with unique dummy DEA/NPI prefixes.

---

## 4. Git LFS Tracking Strategy

To conform to GitHub's 100 MB per-file size limitation, large binary packages (`*.msi`, `*.exe`, `*.cab`, `*.zip`, `installers/FrameworkLtc_binaries/*`) are tracked using **Git LFS** via `.gitattributes`.
