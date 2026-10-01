import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'windows-demo');
await readFile(path.join(root, 'dist', 'index.html')); // Require a successful build first.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, 'dist'), path.join(output, 'app'), { recursive: true });
for (const filename of ['Start-Sig-Assist.cmd', 'serve.ps1']) {
  const content = await readFile(path.join(root, 'windows', filename), 'utf8');
  await writeFile(path.join(output, filename), content.replace(/\r?\n/g, '\r\n'));
}
await cp(path.join(root, 'docs', 'WINDOWS-DEMO.md'), path.join(output, 'README.md'));
console.log(`Windows demo packaged at ${output}`);
