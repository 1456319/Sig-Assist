import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
let html = (await readFile(path.join(dist, 'index.html'), 'utf8')).replace(/\r\n/g, '\n');
const scriptTags = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)];
if (scriptTags.length !== 1) throw new Error('Expected exactly one bundled entry script.');
for (const [tag, src] of scriptTags) {
  const js = (await readFile(path.join(dist, src.replace(/^\//, '')), 'utf8')).replace(/\r\n/g, '\n');
  if (/\bimport\s*(?:\(|["'])/.test(js)) throw new Error('The portable build requires all modules in one bundle.');
  html = html.replace(tag, () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`);
}
for (const [tag, href] of [...html.matchAll(/<link\b[^>]*\bhref="([^"]+)"[^>]*>/g)]) {
  if (!tag.includes('stylesheet')) throw new Error(`Unexpected external link: ${tag}`);
  const css = (await readFile(path.join(dist, href.replace(/^\//, '')), 'utf8')).replace(/\r\n/g, '\n');
  html = html.replace(tag, () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
}
if (/<(?:script|link)\b[^>]*(?:src|href)=/.test(html)) throw new Error('Portable page still has external dependencies.');
await mkdir(path.join(root, 'windows-demo'), { recursive: true });
await writeFile(path.join(root, 'windows-demo', 'index.html'), html);
console.log(`Built offline Windows demo (${Buffer.byteLength(html)} bytes).`);
