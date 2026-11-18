import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputs = [
  'package.json', 'package-lock.json', 'index.html', 'vite.config.ts', 'tsconfig.app.json',
  'scripts/build-identity.mjs', 'scripts/build-demo.mjs', 'scripts/package-demo.py',
  'scripts/iguana-bridge.mjs', 'scripts/framework-desktop.mjs', 'scripts/pilot-journal.mjs',
  'windows/FrameworkDesktop.cs', 'windows/Start-Sig-Assist.cmd', 'windows/Start-Sig-Assist-LAN.cmd',
  'windows-demo/Start-Sig-Assist.bat', 'windows-demo/Start-Iguana-Connector.bat',
  'docs/TECHNICIAN-FEEDBACK.md', 'docs/TEMPORARY-INTENSIFIED-LOGGING.md',
];

export function buildInputPaths(root = projectRoot) {
  const files = [...inputs];
  function visit(directory) {
    for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const filename = `${directory}/${entry.name}`;
      if (entry.isDirectory()) visit(filename);
      else files.push(filename);
    }
  }
  visit('src');
  if (existsSync(path.join(root, 'public'))) visit('public');
  return files.sort();
}

export function getBuildIdentity(root = projectRoot) {
  const hash = createHash('sha256');
  for (const filename of buildInputPaths(root)) {
    hash.update(filename); hash.update('\0');
    const data = readFileSync(path.join(root, filename));
    hash.update(/\.(?:tsx?|[cm]?js|json|html|css|svg|md|cs|cmd|bat|py|ps1|txt)$/.test(filename) ? data.toString('utf8').replace(/\r\n/g, '\n') : data);
    hash.update('\0');
  }
  return { schemaVersion: 1, version: JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version, buildId: hash.digest('hex') };
}

export function verifyBuildHtml(html, identity) {
  for (const [name, expected] of [['version', identity.version], ['build', identity.buildId]]) {
    const value = html.match(new RegExp(`<meta\\s+name="sig-assist-${name}"\\s+content="([^"]+)"`))?.[1];
    if (value !== expected) throw new Error(`Prebuilt page ${name} is stale. Run npm run prototype:package before publishing.`);
  }
}

export function verifyPortableBuild(root = projectRoot) {
  const expected = getBuildIdentity(root);
  const recorded = JSON.parse(readFileSync(path.join(root, 'windows-demo/BUILD.json'), 'utf8'));
  if (JSON.stringify(recorded) !== JSON.stringify(expected)) throw new Error('Prototype BUILD.json is stale. Run npm run prototype:package.');
  verifyBuildHtml(readFileSync(path.join(root, 'windows-demo/index.html'), 'utf8'), expected);
  return expected;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const identity = verifyPortableBuild();
  console.log(`Prototype v${identity.version} build ${identity.buildId.slice(0, 12)} matches current source.`);
}
