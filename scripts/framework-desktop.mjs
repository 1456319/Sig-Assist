import { execFile } from 'node:child_process';
import { readFile, mkdir, access } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePaths = [path.join(here, 'FrameworkDesktop.cs'), path.join(here, '../windows/FrameworkDesktop.cs')];
async function sourceFile() {
  for (const filename of sourcePaths) { try { return { filename, source: await readFile(filename) }; } catch { /* try source checkout */ } }
  throw new Error('FrameworkDesktop.cs is missing. Extract the complete Sig-Assist ZIP.');
}
const loadedDesktopBuildId = (async () => {
  try {
    const { source } = await sourceFile();
    return createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).update(source).digest('hex');
  } catch { return 'unavailable'; }
})();
export async function desktopBuildId() { return loadedDesktopBuildId; }
const failureReasons = new Set(['HELPER_TIMEOUT', 'INVALID_OUTPUT', 'HELPER_PROCESS_EXIT', 'HELPER_STARTUP_FAILED', 'UNKNOWN_FAILURE']);
function helperDuration(value) { return Number.isFinite(value) && value >= 0 ? Math.min(60000, Math.round(value)) : undefined; }
function helperFailure(message, failureReason, helperDurationMs) {
  const error = new Error(message);
  error.failureReason = failureReasons.has(failureReason) ? failureReason : 'UNKNOWN_FAILURE';
  const duration = helperDuration(helperDurationMs);
  if (duration !== undefined) error.helperDurationMs = duration;
  return error;
}
export function executeDesktopHelper(file, args, input, timeout = 20000) {
  const started = performance.now();
  return new Promise((resolve, reject) => {
    const child = execFile(file, args, { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        // Classify process metadata at its origin, never exception prose. A
        // maxBuffer termination is invalid output rather than a helper timeout.
        const reason = error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ? 'INVALID_OUTPUT'
          : error.killed ? 'HELPER_TIMEOUT'
          : typeof error.code === 'number' || error.signal ? 'HELPER_PROCESS_EXIT'
          : ['ENOENT', 'EACCES', 'EPERM', 'ENOEXEC', 'ENOTDIR', 'EISDIR', 'E2BIG', 'ENOMEM', 'EMFILE', 'ENFILE', 'ETXTBSY'].includes(error.code) ? 'HELPER_STARTUP_FAILED'
          : 'UNKNOWN_FAILURE';
        reject(helperFailure(error.killed ? 'Desktop helper timed out. If sending, inspect Framework before retrying.' : `Desktop helper could not run (${error.code ?? 'PROCESS_ERROR'}). ${(stderr.trim() || (file.toLowerCase().endsWith('csc.exe') ? stdout.trim() : '')).slice(0, 1000)}`, reason, performance.now() - started));
      }
      else resolve(stdout.replace(/^\uFEFF/, ''));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input ?? '');
  });
}
let compiling;
export async function helperExecutable() {
  if (process.platform !== 'win32') throw new Error('Detect open E-Rx requires the Windows connector in the same Windows/Citrix session as Framework.');
  if (compiling) return compiling;
  compiling = (async () => {
    const { filename, source } = await sourceFile();
    const hash = createHash('sha256').update(source).digest('hex').slice(0, 20);
    const folder = path.join(process.env.LOCALAPPDATA || process.env.TEMP, 'Sig-Assist', 'desktop', hash);
    const exe = path.join(folder, 'SigAssist.FrameworkDesktop.exe');
    try { await access(exe); return exe; } catch { /* build for this source version */ }
    const framework = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework', 'v4.0.30319');
    const compiler = path.join(framework, 'csc.exe');
    try { await access(compiler); } catch { throw new Error('Windows .NET Framework 4 compiler is unavailable. Desktop detection needs .NET Framework 4; normal E-Rx search still works.'); }
    await mkdir(folder, { recursive: true });
    await executeDesktopHelper(compiler, ['/nologo', '/target:exe', '/platform:anycpu', `/out:${exe}`,
      `/reference:${path.join(framework, 'WPF', 'UIAutomationClient.dll')}`,
      `/reference:${path.join(framework, 'WPF', 'UIAutomationTypes.dll')}`,
      `/reference:${path.join(framework, 'WPF', 'WindowsBase.dll')}`,
      '/reference:System.Web.Extensions.dll', '/reference:Accessibility.dll', filename], '');
    return exe;
  })();
  try { return await compiling; } catch (error) { compiling = undefined; throw error; }
}
export async function runDesktopHelper(input, { getExecutable = helperExecutable, execute = executeDesktopHelper } = {}) {
  const started = performance.now();
  let exe;
  try { exe = await getExecutable(); }
  catch (error) { throw helperFailure(error?.message || 'Desktop helper could not start.', failureReasons.has(error?.failureReason) ? error.failureReason : 'HELPER_STARTUP_FAILED', error?.helperDurationMs ?? performance.now() - started); }
  let output;
  try { output = await execute(exe, [], JSON.stringify(input), input.action === 'observe' ? 8000 : input.action === 'window' ? 55000 : ['detect', 'inspect', 'docutrack'].includes(input.action) ? 45000 : 20000); }
  catch (error) { throw helperFailure(error?.message || 'Desktop helper could not run.', error?.failureReason, error?.helperDurationMs ?? performance.now() - started); }
  try {
    const result = JSON.parse(output);
    if (!result || typeof result !== 'object' || Array.isArray(result) || typeof result.ok !== 'boolean') throw new Error();
    return result;
  } catch { throw helperFailure('Desktop helper returned invalid output.', 'INVALID_OUTPUT', performance.now() - started); }
}

// Bindings stay in this process, expire and are consumed before a write. The page
// receives an opaque token, never a client-editable process/control selector.
export function createDesktopSession({ run = runDesktopHelper, now = Date.now } = {}) {
  const bindings = new Map(); let busy = false; let entryWindow, observationDone, finishObservation;
  // The helper is short lived. Keep passive traversal progress here, never in a
  // page-supplied selector or in the native helper's static state.
  let observationScanOffset = 0;
  function remember(result, selectEntry = false) {
    if (!result.ok) return result;
    if (selectEntry && result.entryWindow) {
      if (!entryWindow || ['pid', 'started', 'id', 'handle'].some(k => entryWindow[k] !== result.entryWindow[k])) observationScanOffset = 0;
      entryWindow = { ...result.entryWindow };
    }
    const token = randomUUID(); const expiresAt = now() + 5 * 60 * 1000;
    bindings.set(token, { detected: result, expiresAt });
    for (const [key, item] of bindings) if (item.expiresAt < now() || bindings.size > 20) bindings.delete(key);
    return { ok: true, token, expiresAt, pon: result.pon, pons: result.pons ?? [], warnings: result.warnings ?? [],
      instances: result.instances, openErxWindows: result.openErxWindows, viewportStatus: result.viewportStatus,
      entryWindow: entryWindow ? { title: entryWindow.title, pid: entryWindow.pid } : undefined, scanMode: result.scanMode,
      fields: Object.fromEntries(Object.entries(result.fields ?? {}).map(([key, value]) => [key, { label: value.label, currentValue: value.value }])),
      diagnostics: result.diagnostics };
  }
  return async function desktop(action, body = {}) {
    // A clinical request waits for the bounded passive read already in flight;
    // it must not fail merely because the recorder briefly owns the helper.
    if (action !== 'observe' && observationDone) await observationDone;
    if (busy) return { ok: false, code: 'BUSY', error: 'A Framework desktop operation is already running.' };
    busy = true;
    if (action === 'observe') observationDone = new Promise(resolve => { finishObservation = resolve; });
    let writeStarted = false;
    try {
      // TEMPORARY_INTENSIFIED_LOGGING_REMOVAL_PRIORITY_HIGH. Server-only caller;
      // no discovery/recovery and never accepts a browser-supplied window selector.
      if (action === 'observe') {
        if (!entryWindow) return { ok: false, code: 'SELECTION_REQUIRED' };
        const scanOffset = observationScanOffset;
        observationScanOffset = (observationScanOffset + 173) % 1600;
        try { return await run({ action: 'observe', entryWindow, key: body.key, scanOffset }); }
        catch (error) {
          const result = { ok: false, code: 'OBSERVATION_FAILED', failureReason: failureReasons.has(error?.failureReason) ? error.failureReason : 'UNKNOWN_FAILURE' };
          const duration = helperDuration(error?.helperDurationMs);
          if (duration !== undefined) result.helperDurationMs = duration;
          return result;
        }
      }
      if (action === 'docutrack') return await run({ action: 'docutrack' });
      if (action === 'detect') {
        bindings.clear();
        const input = { action: body.chooseWindow === true ? 'window' : 'detect', positionReview: body.positionReview === true };
        if (input.action === 'detect' && entryWindow) input.entryWindow = entryWindow;
        return remember(await run(input), true);
      }
      if (action === 'target') {
        if (!['sig', 'times'].includes(body.field)) throw new Error('Unknown destination field.');
        bindings.clear(); return remember(await run({ action: 'target', field: body.field }));
      }
      if (action === 'inspect') return await run({ action: 'inspect', ...(entryWindow ? { entryWindow } : {}) });
      if (action !== 'send') return { ok: false, error: 'Unknown desktop action.' };
      const bound = bindings.get(body.token);
      bindings.delete(body.token);
      if (!bound || bound.expiresAt < now()) throw new Error('Detection expired or was already used. Detect the open E-Rx again.');
      if (body.approved !== true || body.matched !== true || typeof body.pon !== 'string' || !body.pon.trim()) throw new Error('Match the intended order and approve the exact text before sending.');
      if (!['sig', 'times'].includes(body.field) || !bound.detected.fields?.[body.field]) throw new Error('Choose the destination field in Framework first.');
      if (typeof body.value !== 'string' || !body.value.trim() || body.value.length > (body.field === 'sig' ? 4000 : 500)) throw new Error('Invalid field text.');
      writeStarted = true;
      const result = await run({ action: 'send', expected: bound.detected, field: body.field, value: body.value });
      if (result.ok && result.verified && result.detected?.ok) return { ok: true, verified: true, field: body.field, warnings: result.warnings ?? [], next: remember(result.detected) };
      return { ...result, ok: false };
    } catch (error) { return { ok: false, uncertain: writeStarted, error: error.message }; }
    finally { busy = false; if (action === 'observe') { const finish = finishObservation; observationDone = undefined; finishObservation = undefined; finish?.(); } }
  };
}
