import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyPortableBuild } from './build-identity.mjs';

export const generatedFiles = ['windows-demo/index.html', 'windows-demo/BUILD.json', 'windows-demo/Sig-Assist-Windows-Demo.zip'];

// Publish only a successfully checked build of the current branch head. A newer
// source push has its own CI run; an older job must never overwrite its package.
export function publishPrototype({ cwd = process.cwd(), sourceSha }) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha || '')) throw new Error('A full source commit SHA is required.');
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const refresh = () => { git('fetch', 'origin', 'prototype'); return git('rev-parse', 'refs/remotes/origin/prototype'); };
  if (refresh() !== sourceSha) return 'superseded';
  if (git('rev-parse', 'HEAD') !== sourceSha) throw new Error('Checkout does not match the validated source commit.');
  if (git('diff', '--cached', '--name-only')) throw new Error('Refusing to publish unrelated staged changes.');
  git('add', '--', ...generatedFiles);
  if (!git('diff', '--cached', '--name-only')) return 'unchanged';
  git('-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
    'commit', '-m', `Refresh prototype download for ${sourceSha.slice(0, 12)}`);
  try { git('push', 'origin', 'HEAD:refs/heads/prototype'); }
  catch (error) {
    // A concurrent source commit wins. Authentication/network failures at the
    // same head remain failures, rather than silently reporting publication.
    if (refresh() !== sourceSha) return 'superseded';
    throw error;
  }
  return 'published';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyPortableBuild();
  console.log(`Prototype download: ${publishPrototype({ sourceSha: process.env.GITHUB_SHA })}`);
}
