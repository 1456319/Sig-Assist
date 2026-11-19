"""Inventory the selected installer C#/XAML sources without running vendor code."""
import argparse
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--source-root', type=Path, required=True)
parser.add_argument('--source-commit', required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
result = {'sourceCommit': args.source_commit, 'scope': 'selected decompiled E-Rx sources, not all installer assemblies',
          'evidence': 'static declarations/call sites only; no live calls or provider verification', 'files': []}
local = lambda tag: tag.rsplit('}', 1)[-1]
for path in sorted(args.source_root.iterdir()):
    if path.suffix not in ('.cs', '.xaml'):
        continue
    data = path.read_bytes()
    text = data.decode('utf-8-sig')
    item = {'path': 'installers/' + path.name, 'sha256': hashlib.sha256(data).hexdigest()}
    if path.suffix == '.xaml':
        controls = []
        for element in ET.fromstring(text).iter():
            names = {local(k): v for k, v in element.attrib.items()
                     if local(k) in ('Name', 'AutomationProperties.Name', 'AutomationProperties.AutomationId')}
            if not names:
                continue
            bindings = []
            for child in element:
                if local(child.tag).endswith(('.Resources', '.Triggers', '.InputBindings')):
                    continue
                for binding in child.iter():
                    if local(binding.tag) == 'Binding':
                        values = [binding.attrib['Path']] if 'Path' in binding.attrib else [
                            v.text.strip() for v in binding.iter() if local(v.tag) == 'Ctor' and v.text]
                        if values:
                            bindings.append({'property': local(child.tag), 'paths': values})
            selector = names.get('AutomationProperties.Name', names.get('Name'))
            line = next((n for n, line in enumerate(text.splitlines(), 1) if f'="{selector}"' in line), None)
            controls.append({'type': local(element.tag), 'declarations': names, 'line': line, 'bindings': bindings})
        item['controls'] = controls
    else:
        item['requestCallSites'] = [{'line': n, 'request': m.group(1)}
            for n, line in enumerate(text.splitlines(), 1)
            if 'ExecuteAsync' in line for m in re.finditer(r'new\s+(\w+)\s*\(', line)]
        item['serviceCallSites'] = [{'line': n, 'service': m.group(1), 'method': m.group(2)}
            for n, line in enumerate(text.splitlines(), 1)
            for m in re.finditer(r'(_(?:translateSigService|erxWorkQueueService|erxMessageService))\.(\w+)\(', line)]
    result['files'].append(item)
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'files': len(result['files']), 'controls': sum(len(f.get('controls', [])) for f in result['files']),
                  'requestCallSites': sum(len(f.get('requestCallSites', [])) for f in result['files'])}))
