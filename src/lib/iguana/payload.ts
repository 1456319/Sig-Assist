import type { DiagnosticSink, IguanaLog, ScriptEvent } from './types';

const local = (element: Element) => element.localName.toLowerCase();
const children = (element: Element, name: string) => Array.from(element.children).filter(e => local(e) === name.toLowerCase());
export function at(element: Element, path: string): Element | undefined {
  return path.split('/').reduce<Element | undefined>((parent, name) => parent && children(parent, name)[0], element);
}
const value = (element: Element, path: string) => at(element, path)?.textContent?.trim() || undefined;

function unescape(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, entity: string) => {
    const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? whole;
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

function parseXml(text: string): Document {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('Unexpected XML declaration (DOCTYPE/ENTITY).');
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const error = Array.from(doc.getElementsByTagName('*')).find(e => local(e) === 'parsererror');
  if (error) throw new Error(error.textContent?.slice(0, 240) ?? 'Malformed XML');
  return doc;
}

export function parseScriptLog(log: IguanaLog, emit: DiagnosticSink): ScriptEvent[] {
  const { payload, ...origin } = log;
  emit('debug', 'decode.begin', 'Inspecting captured log payload', { ...origin, characters: payload.length });
  let text = payload;
  if (log.formatted) {
    // These tags belong to Iguana's display formatter. Strip them BEFORE XML unescaping.
    text = text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/\u00a0/g, ' ');
    emit('debug', 'decode.formatting', 'Removed log display markup without running scripts');
  }
  let envelopes: RegExpMatchArray[] = [];
  let depth = 0;
  for (; depth <= 8; depth++) {
    envelopes = [...text.matchAll(/<(?:[\w.-]+:)?Message(?=\s|>)[\s\S]*?<\/(?:[\w.-]+:)?Message\s*>/g)];
    if (envelopes.length) break;
    const decoded = unescape(text);
    if (decoded === text) break;
    text = decoded;
  }
  emit('debug', 'decode.layers', 'SOAP/log entity decoding complete', { depth, scriptMessages: envelopes.length });
  if (!envelopes.length) {
    if (/<(?:[\w.-]+:)?(?:NewRx|CancelRx|Message)(?=\s|>|\/)/i.test(text)) {
      emit('error', 'decode.failed', 'SCRIPT content is present but no complete Message envelope was recovered', { ...origin, characters: text.length });
      return [];
    }
    const hl7 = /(?:^|\n)MSH\|/.test(text);
    emit('info', hl7 ? 'classify.hl7' : 'classify.other', hl7 ? 'Downstream HL7 recorded; not used as a new SCRIPT order' : 'No SCRIPT Message envelope in this log', { ...origin, characters: text.length });
    return [];
  }
  const results: ScriptEvent[] = [];
  for (const match of envelopes) {
    try {
      let xml = match[0];
      let doc: Document;
      let repairs = 0;
      try { doc = parseXml(xml); }
      catch (error) {
        if (!log.formatted) throw error;
        // Iguana's formatted log can decode a literal & or inject NBSP/URL semicolons.
        const repaired = xml.replace(/\u00a0/g, ' ').replace(/";(?=\s+[\w:.-]+\s*=|\s*\/?>)/g, '"')
          .replace(/&(?!#\d+;|#x[\da-f]+;|amp;|lt;|gt;|apos;|quot;)/gi, '&amp;');
        repairs = repaired === xml ? 0 : 1;
        xml = repaired;
        doc = parseXml(xml);
      }
      const root = doc.documentElement;
      const header = at(root, 'Header');
      const body = at(root, 'Body');
      const transaction = body?.children[0];
      if (!header || !transaction) throw new Error('SCRIPT Header or Body transaction is missing.');
      const kind = transaction.localName;
      const medication = at(transaction, 'MedicationPrescribed');
      const patient = at(transaction, 'Patient/HumanPatient/Identification');
      const patientRefType = ['MedicalRecordIdentificationNumberEHR', 'PatientAccountNumber'].find(name => patient && value(patient, name)) ?? '';
      const patientRef = patient && patientRefType ? value(patient, patientRefType) : undefined;
      const messageId = value(header, 'MessageID') ?? '';
      const sender = value(header, 'From') ?? '';
      const warnings: string[] = [];
      const sentTime = value(header, 'SentTime');
      if (!messageId) warnings.push('Header/MessageID missing');
      if (!sender) warnings.push('Header/From missing');
      if (!sentTime || !Number.isFinite(Date.parse(sentTime))) warnings.push('Header/SentTime missing or invalid');
      const facts: Record<string, string[]> = {};
      const paths: string[] = [];
      function inventory(node: Element, path: string) {
        paths.push(path);
        if (path.includes('/Sig/Instruction/') && !node.children.length) (facts[path] ??= []).push(node.textContent?.trim() ?? '');
        Array.from(node.children).forEach(child => inventory(child, `${path}/${child.localName}`));
      }
      inventory(transaction, `Body/${kind}`);
      const dosePath = 'Sig/Instruction/DoseAdministration/Dosage';
      const frequencyPath = 'Sig/Instruction/TimingAndDuration/Frequency';
      const dates = medication ? children(medication, 'OtherMedicationDate') : [];
      const dateFor = (qualifier: string) => {
        const date = dates.find(d => value(d, 'OtherMedicationDateQualifier') === qualifier);
        return date && (value(date, 'OtherMedicationDate/DateTime') ?? value(date, 'OtherMedicationDate/Date'));
      };
      const metadata = {
        messageId, messageIds: messageId ? [messageId] : [], sender, recipient: value(header, 'To'), sentTime,
        scriptVersion: root.getAttribute('TransactionVersion') ?? undefined, patientRefType,
        ndc: medication && value(medication, 'DrugCoded/ProductCode/Qualifier') === 'ND' ? value(medication, 'DrugCoded/ProductCode/Code') : undefined,
        strength: medication && value(medication, 'DrugCoded/Strength/StrengthValue'),
        dose: medication && value(medication, `${dosePath}/DoseQuantity`),
        doseUnit: medication && value(medication, `${dosePath}/DoseUnitOfMeasure/Text`),
        route: medication && value(medication, 'Sig/Instruction/DoseAdministration/RouteOfAdministration/Text'),
        frequency: medication ? [value(medication, `${frequencyPath}/FrequencyNumericValue`), value(medication, `${frequencyPath}/FrequencyUnits/Text`)].filter(Boolean).join(' per ') || undefined : undefined,
        administrationTimes: medication ? children(medication, 'FacilitySpecificHoursOfAdministrationTiming').map(t => value(t, 'HoursOfAdministrationValue')).filter((v): v is string => Boolean(v)) : [],
        startDate: dateFor('StartDate'), effectiveDate: dateFor('EffectiveDate'),
        structuredIndication: medication && value(medication, 'Sig/Instruction/IndicationForUse/Indication/Text'),
        instructionFacts: facts, channel: log.channel, logId: log.logId, position: log.position,
      };
      const event: ScriptEvent = {
        kind, messageId, sender, sentTime, relatesToMessageId: value(header, 'RelatesToMessageID'),
        pon: value(header, 'PrescriberOrderNumber'), facility: value(transaction, 'Facility/Identification/FacilityID'), patientRef,
        drug: medication && value(medication, 'DrugDescription'), directions: medication && value(medication, 'Sig/SigText'),
        metadata, warnings, log: origin,
      };
      emit('debug', 'schema.inventory', 'SCRIPT field paths and structured instructions', { kind, messageId, paths, instructionFacts: facts, displayRepairs: repairs });
      emit('info', 'script.mapped', 'Mapped SCRIPT transaction', { ...event, log: origin });
      if (metadata.structuredIndication === 'Unspecified') emit('warn', 'mapping.indication', 'Structured indication is Unspecified; original SigText is retained verbatim', { messageId });
      results.push(event);
    } catch (error) {
      emit('error', 'decode.failed', 'Unable to parse SCRIPT envelope', { ...origin, error: String(error), decodedCharacters: match[0].length });
    }
  }
  return results;
}

export function parseApiQuery(text: string, emit: DiagnosticSink): IguanaLog[] {
  const doc = parseXml(text);
  const root = doc.documentElement;
  emit('debug', 'api.schema', 'Log API response schema', { root: root.localName, attributes: Array.from(root.attributes).map(a => a.name), childNames: [...new Set(Array.from(root.children).map(c => c.localName))] });
  if (local(root) !== 'export') throw new Error(`Unexpected log API root <${root.localName}>; expected <export>. Save diagnostics to confirm this server's response profile.`);
  if (root.getAttribute('success')?.toLowerCase() === 'false') {
    emit('error', 'api.rejected', 'Iguana rejected the log query', { success: false, attributes: Array.from(root.attributes).map(a => a.name), childNames: Array.from(root.children).map(c => c.localName) });
    throw new Error('Iguana rejected the log query (success=false). Check the account, channel permissions and query settings.');
  }
  const nodes = children(root, 'message');
  const unknown = Array.from(root.children).filter(c => local(c) !== 'message');
  if (unknown.length) emit('warn', 'api.schema.extra', 'Additional log API elements', { names: unknown.map(n => n.localName) });
  let attributeBodies = 0; let elementBodies = 0; let emptyBodies = 0;
  const logs = nodes.map((node, index) => {
    const field = (...names: string[]) => names.map(name => node.getAttribute(name) || value(node, name)).find(Boolean) || undefined;
    const data = at(node, 'data');
    const attribute = node.getAttribute('data');
    if (attribute === null && !data) throw new Error(`Log entry ${index + 1} lacks a data attribute or <data> element; cannot assume its body is complete.`);
    // Some exports embed XML as elements; others use entity text or CDATA.
    const elementPayload = data ? data.children.length ? Array.from(data.childNodes).map(n => new XMLSerializer().serializeToString(n)).join('') : data.textContent ?? '' : undefined;
    if (attribute !== null && elementPayload !== undefined && attribute !== elementPayload) throw new Error(`Log entry ${index + 1} has conflicting data representations; export diagnostics.`);
    const payload = attribute ?? elementPayload!;
    if (attribute !== null) attributeBodies++; else elementBodies++;
    if (!payload) emptyBodies++;
    return { payload, channel: field('source_name', 'source', 'channel'), logType: field('type'), logId: field('message_id', 'messageid', 'id'), refLogId: field('reference_id', 'refmsgid', 'refid'), timestamp: field('time_stamp', 'time', 'timestamp', 'date'), position: field('position') };
  });
  emit('debug', 'api.schema.messages', 'Log entry representations decoded', { entries: logs.length, attributeBodies, elementBodies, emptyBodies, messageAttributes: [...new Set(nodes.flatMap(node => Array.from(node.attributes).map(a => a.name)))] });
  return logs;
}

function jsonWrapper(text: string): Record<string, unknown> {
  const wrapped = text.trim().replace(/^\(\s*/, '').replace(/\)\s*;?$/, '');
  return JSON.parse(wrapped);
}
function decodeContent(content: { text?: string; encoding?: string }): string {
  const text = content.text ?? '';
  if (content.encoding !== 'base64') return text;
  return new TextDecoder().decode(Uint8Array.from(atob(text), c => c.charCodeAt(0)));
}

/** Inspect only captured response bodies. Never replay URLs, forms, cookies or scripts. */
export function parseHar(text: string, emit: DiagnosticSink): IguanaLog[] {
  const har = JSON.parse(text);
  if (!Array.isArray(har?.log?.entries)) throw new Error('File has no HAR log.entries array.');
  const rows = new Map<string, Omit<IguanaLog, 'payload'>>();
  for (const entry of har.log.entries) {
    if (!entry.request?.url || new URL(entry.request.url).pathname !== '/log_entries') continue;
    const response = decodeContent(entry.response?.content ?? {});
    // Extract literal row metadata without evaluating the UI's JavaScript response.
    for (const match of response.matchAll(/addRow(?:Reverse)?\(\s*\{([\s\S]*?)\}\s*\);/g)) {
      const get = (name: string) => match[1].match(new RegExp(`(?:^|[\\r\\n])\\s*${name}:\\s*'([^']*)'`))?.[1];
      const position = get('Position'); const logDate = get('Date');
      if (position) rows.set(`${logDate}:${position}`, { position, logDate, channel: get('Channel'), logType: get('Type'), logId: get('MessageId'), refLogId: get('RefMsgId') });
    }
  }
  const logs: IguanaLog[] = [];
  let details = 0;
  har.log.entries.forEach((entry: { request?: { url?: string; postData?: { params?: { name: string; value: string }[]; text?: string } }; response?: { status?: number; content?: { text?: string; encoding?: string } } }, captureIndex: number) => {
    if (!entry.request?.url) return;
    const pathname = new URL(entry.request.url).pathname;
    if (pathname !== '/log_view_entry' && pathname !== '/api_query') return;
    details++;
    try {
      const response = decodeContent(entry.response?.content ?? {});
      if (entry.response?.status !== 200) throw new Error(`Captured HTTP status ${entry.response?.status}`);
      if (pathname === '/api_query') { logs.push(...parseApiQuery(response, emit)); return; }
      const params = new URLSearchParams(entry.request.postData?.text ?? '');
      entry.request.postData?.params?.forEach(p => params.set(p.name, p.value));
      const position = params.get('Position') ?? undefined; const logDate = params.get('Date') ?? undefined;
      const parsed = jsonWrapper(response);
      if (typeof parsed.Message !== 'string') throw new Error('Detail response has no string Message field.');
      if (typeof parsed.StartLineOffset === 'number' && parsed.StartLineOffset !== 0 || typeof parsed.TotalCountOfLines === 'number' && typeof parsed.CountOfLines === 'number' && parsed.CountOfLines < parsed.TotalCountOfLines) throw new Error('Only part of this log entry was captured; open/download the full entry.');
      const row = rows.get(`${logDate}:${position}`);
      if (!row) emit('warn', 'har.row.missing', 'Detail has no matching captured list row; channel/type unavailable', { captureIndex, position, logDate });
      logs.push({ ...row, payload: parsed.Message, position, logDate, captureIndex, formatted: parsed.DisplayMode !== 'Text' });
    } catch (error) { emit('error', 'har.detail.failed', 'Captured detail could not be imported', { captureIndex, pathname, error: String(error) }); }
  });
  emit('info', 'har.summary', 'HAR inspection complete; no network requests replayed', { entries: har.log.entries.length, detailResponses: details, readableLogs: logs.length, capturedListRows: rows.size });
  if (!details) emit('warn', 'har.details.missing', 'HAR contains no captured /log_view_entry or /api_query responses. Open each relevant detail before recapturing.');
  return logs;
}

/** Diagnostic copy only: omit transport/SCRIPT credentials, preserve order evidence. */
function omitAuthentication(text: string): string {
  // Match the SAME closing tag, including nested UsernameToken inside Security.
  // Keep entity layers intact so the diagnostic copy remains replayable XML.
  for (let depth = 0; depth <= 8; depth++) {
    const lt = depth ? `&${'amp;'.repeat(depth - 1)}lt;` : '<';
    const gt = depth ? `&${'amp;'.repeat(depth - 1)}gt;` : '>';
    text = text.replace(new RegExp(`${lt}(?:[\\w.-]+:)?(Security|UsernameToken)\\b[\\s\\S]*?${lt}\\/(?:[\\w.-]+:)?\\1\\s*${gt}`, 'gi'), '[SCRIPT authentication omitted]');
  }
  return text
    .replace(/^(?:Authorization|Proxy-Authorization|Cookie|Set-Cookie):[^\r\n]*/gim, '[HTTP authentication omitted]')
    .replace(/((?:password|username)=)[^&\s"<>]*/gi, '$1[omitted]');
}

export function diagnosticPayload(payload: string): string {
  try {
    const doc = parseXml(payload);
    if (local(doc.documentElement) === 'export') {
      for (const message of children(doc.documentElement, 'message')) {
        const data = message.getAttribute('data');
        if (data !== null) message.setAttribute('data', omitAuthentication(data));
      }
      return omitAuthentication(new XMLSerializer().serializeToString(doc));
    }
  } catch { /* A captured log can be HTTP text or display markup instead of XML. */ }
  return omitAuthentication(payload.replace(/<br\s*\/?>/gi, '\n').replace(/<(?:a|span|font)\b[^>]*>|<\/(?:a|span|font)>/gi, ''));
}
