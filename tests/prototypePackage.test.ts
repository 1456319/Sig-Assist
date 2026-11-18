// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildInputPaths, getBuildIdentity, verifyPortableBuild } from '../scripts/build-identity.mjs';
import { generatedFiles, publishPrototype } from '../scripts/publish-prototype.mjs';

const folders: string[] = [];
function temporary() { const p = mkdtempSync(path.join(tmpdir(), 'sig-package-')); folders.push(p); return p; }
afterEach(() => { for (const p of folders.splice(0)) rmSync(p, { recursive: true, force: true }); });

function builtFixture() {
  const root = temporary();
  for (const file of buildInputPaths()) {
    const dest = path.join(root, file); mkdirSync(path.dirname(dest), { recursive: true }); copyFileSync(file, dest);
  }
  const identity = getBuildIdentity(root);
  writeFileSync(path.join(root, 'windows-demo/BUILD.json'), JSON.stringify(identity));
  writeFileSync(path.join(root, 'windows-demo/index.html'), `<meta name="sig-assist-version" content="${identity.version}"><meta name="sig-assist-build" content="${identity.buildId}">`);
  return { root, identity };
}

describe('prototype source/package identity', () => {
  it('accepts the matching portable build without needing a Git checkout', () => {
    const { root, identity } = builtFixture(); expect(verifyPortableBuild(root)).toEqual(identity);
  });
  it.each(['src/App.tsx', 'scripts/iguana-bridge.mjs', 'windows/FrameworkDesktop.cs', 'package.json'])('rejects stale packaging after %s changes', file => {
    const { root, identity } = builtFixture(); const target = path.join(root, file);
    if (file === 'package.json') {
      const pkg = JSON.parse(readFileSync(target, 'utf8')); pkg.version = '99.0.0'; writeFileSync(target, JSON.stringify(pkg));
    } else writeFileSync(target, readFileSync(target, 'utf8') + '\n// Synthetic change\n');
    expect(getBuildIdentity(root).buildId).not.toBe(identity.buildId);
    expect(() => verifyPortableBuild(root)).toThrow(/stale/);
  });
  it('rejects a stale HTML page even if its manifest was updated', () => {
    const { root, identity } = builtFixture();
    writeFileSync(path.join(root, 'windows-demo/index.html'), `<meta name="sig-assist-version" content="0.0.0"><meta name="sig-assist-build" content="${identity.buildId}">`);
    expect(() => verifyPortableBuild(root)).toThrow(/page version is stale/);
  });
  it('normalizes Windows text line endings and detects binary asset changes', () => {
    const { root, identity } = builtFixture(); const target = path.join(root, 'src/App.tsx');
    writeFileSync(target, readFileSync(target, 'utf8').replace(/\r?\n/g, '\r\n'));
    expect(getBuildIdentity(root)).toEqual(identity);
    mkdirSync(path.join(root, 'public')); writeFileSync(path.join(root, 'public/icon.ico'), Buffer.from([255]));
    const first = getBuildIdentity(root); writeFileSync(path.join(root, 'public/icon.ico'), Buffer.from([254]));
    expect(getBuildIdentity(root).buildId).not.toBe(first.buildId);
  });
});

function repository() {
  const root = temporary(), bare = path.join(root, 'remote.git'), cwd = path.join(root, 'checkout');
  const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  execFileSync('git', ['init', '--bare', bare], { stdio: 'ignore' }); mkdirSync(cwd);
  git('init'); git('config', 'user.name', 'Synthetic Test'); git('config', 'user.email', 'test@example.invalid');
  git('checkout', '-b', 'prototype'); git('remote', 'add', 'origin', bare);
  for (const file of generatedFiles) { mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true }); writeFileSync(path.join(cwd, file), 'original'); }
  writeFileSync(path.join(cwd, 'source.txt'), 'source'); git('add', '.'); git('commit', '-m', 'Synthetic source'); git('push', '-u', 'origin', 'prototype');
  return { root, cwd, git, sourceSha: git('rev-parse', 'HEAD') };
}

describe('prototype automatic publication', () => {
  it('publishes only generated downloads and leaves unrelated work out of the commit', () => {
    const { cwd, git, sourceSha } = repository();
    for (const file of generatedFiles) writeFileSync(path.join(cwd, file), 'new package');
    writeFileSync(path.join(cwd, 'source.txt'), 'uncommitted');
    expect(publishPrototype({ cwd, sourceSha })).toBe('published');
    const head = git('rev-parse', 'HEAD'); expect(head).not.toBe(sourceSha);
    expect(git('rev-parse', 'origin/prototype')).toBe(head);
    expect(git('diff-tree', '--no-commit-id', '--name-only', '-r', head).split(/\r?\n/).sort()).toEqual([...generatedFiles].sort());
    expect(git('show', 'HEAD:source.txt')).toBe('source');
    expect(git('show', 'origin/prototype:windows-demo/index.html')).toBe('new package');
  });
  it('does not add a commit when the downloads already match', () => {
    const { cwd, git, sourceSha } = repository(); expect(publishPrototype({ cwd, sourceSha })).toBe('unchanged');
    expect(git('rev-parse', 'origin/prototype')).toBe(sourceSha);
  });
  it('skips an older build if a newer source commit is on prototype', () => {
    const { cwd, git, sourceSha } = repository();
    writeFileSync(path.join(cwd, 'source.txt'), 'newer source'); git('add', 'source.txt'); git('commit', '-m', 'Newer source'); git('push');
    const newer = git('rev-parse', 'HEAD'); git('checkout', '--detach', sourceSha);
    writeFileSync(path.join(cwd, generatedFiles[0]), 'old build');
    expect(publishPrototype({ cwd, sourceSha })).toBe('superseded');
    expect(git('rev-parse', 'origin/prototype')).toBe(newer);
    expect(git('show', 'origin/prototype:windows-demo/index.html')).toBe('original');
  });
  it('refuses unrelated staged content instead of committing it with a package', () => {
    const { cwd, git, sourceSha } = repository();
    writeFileSync(path.join(cwd, 'source.txt'), 'unrelated staged'); git('add', 'source.txt');
    expect(() => publishPrototype({ cwd, sourceSha })).toThrow(/unrelated staged/);
    expect(git('rev-parse', 'origin/prototype')).toBe(sourceSha);
  });
});
