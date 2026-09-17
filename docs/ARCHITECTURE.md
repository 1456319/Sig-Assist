# Sig-Assist Architecture & Integration Plans

## Current State: MVP 1 (Clipboard Fallback)
MVP 1 operates completely standalone. Since FrameworkLTC is hosted within a Citrix published application environment, standard local IPC or clipboard hooking is technically complex. Thus, MVP 1 relies on the user manually copying the "Free Text SIG" (User Entry) and pasting it into the Sig-Assist web application, which then uses `sigEngine` to parse and output an algorithmic optimal SIG.

## Future State: MVP 2 (Seamless Integration)
For MVP 2, the goal is to silently monitor incoming e-RX messages, translate the SIGs in the background, and store them indexed by the Prescription Order Number (PON). When a user opens a prescription in FrameworkLTC, they type the PON into Sig-Assist to immediately retrieve the translated SIG.

**Constraint:** The Iguana integration server is extremely fragile. All interactions must be strictly **READ-ONLY** and executed using standard **USER-LEVEL** (non-admin) permissions to prevent breaking existing integrations.

### Entry Point Options for MVP 2

We have identified three potential entry points for MVP 2, ranked in order of preference based on the user's operational constraints.

#### Plan A: Direct Log File Reading (Network Share) [TARGET OPTION]
Iguana writes all processed HL7/SCRIPT messages to log files on the host OS. 
- **Method:** The agent/app will mount or access the network share where Iguana logs are stored (e.g., `\\iguanabalt01v\iNTERFACEWARE\Iguana\logs` or similar directory). We will passively parse these text log files as they are appended to.
- **Pros:** 100% read-only. We do not talk to the Iguana web service or database, posing absolutely zero risk to the Iguana application itself.
- **Data Source:** We are looking for the NCPDP SCRIPT `NewRx` XML messages (similar to `RAW.txt`) or standard HL7 messages that contain the `<SigText>` block and the PON.

#### Plan B: Querying the FrameworkLTC Database Directly [FALLBACK 1]
If network share permissions (Plan A) cannot be granted or mapped into the local environment, the next best option is to query the destination.
- **Method:** Perform read-only SQL queries against the FrameworkLTC SQL Server database (often accessible via ODBC or standard SQL ports). We will poll the incoming e-RX queue tables where Iguana inserts these messages.
- **Pros:** Bypasses Iguana entirely, completely avoiding the fragile integration engine. Read-only queries can be executed safely with a limited-permission database user.
- **Cons:** Requires database credentials and network line-of-sight to the SQL server, which may also be locked down.

#### Plan C: Iguana's Built-In REST API (Log Querying) [FALLBACK 2]
If neither file shares nor SQL databases are accessible, we can query Iguana's web API.
- **Method:** Write a background worker that makes `HTTP GET` requests to Iguana's built-in log API (e.g., `/api_query` or `/log_export` at `http://iguanabalt01v:6543`). We fetch recent messages and parse the XML.
- **Pros:** Standard HTTP interface. Read-only by definition.
- **Cons:** Places (minor) additional load on the Iguana web server. Depending on the version, the API may require specific user-level permissions that we would need to verify.
