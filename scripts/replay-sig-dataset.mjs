import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { getBuildIdentity } from './build-identity.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), inputs = [];
let output;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out' && args[i + 1] && !output) output = path.resolve(args[++i]);
  else if (args[i].startsWith('-')) throw new Error('Usage: npm run dataset:replay -- [--out PRIVATE-REPORT.jsonl] batch.jsonl [batch2.jsonl ...]');
  else inputs.push(path.resolve(args[i]));
}
if (!inputs.length || output && inputs.includes(output)) throw new Error('Supply input batches and a separate optional output path.');
// Load the shipped TypeScript engine with its normal Vite build constants.
// Middleware mode opens no listener and performs no uploads or app storage writes.
const server = await createServer({ root, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { parseSigDatasetBatches, replaySigDataset } = await server.ssrLoadModule('/src/lib/sigDatasetReplay.ts');
  const parsed = parseSigDatasetBatches(await Promise.all(inputs.map(p => readFile(p, 'utf8'))));
  // TraceLogger normally mirrors clinical details to the console. Keep this
  // command's console aggregate-only; the explicitly requested file has detail.
  const originalConsole = { log: console.log, warn: console.warn, error: console.error };
  let replay;
  try {
    console.log = console.warn = console.error = () => {};
    replay = replaySigDataset(parsed);
  } finally { Object.assign(console, originalConsole); }
  const { summary, results } = replay;
  if (output) {
    await mkdir(path.dirname(output), { recursive: true });
    const header = { type: 'sig_dataset_replay', ...getBuildIdentity(root), summary, issues: parsed.issues };
    // Full output can contain clinical prose. Refuse to overwrite another run.
    await writeFile(output, [header, ...results].map(row => JSON.stringify(row)).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  }
  console.log(JSON.stringify(summary, null, 2));
  if (parsed.issues.length) console.error(JSON.stringify({ issues: parsed.issues }));
  if (parsed.issues.length || summary.errors) process.exitCode = 1;
} finally { await server.close(); }
