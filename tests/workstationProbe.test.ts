import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

const html = readFileSync('pilot/workstation-probe/HAR-Preview.html', 'utf8');
const script = html.split('<script>')[1].split('const file=document')[0];
const project = runInNewContext(script + '\nsummarizeHar', { URL }) as (har: unknown, parse: (s:string)=>Element | null)=> {
  records: Array<{ origin: string;route: string;request: {fields?: Array<{field:string;example:string}>};response:{state:string} }>;partial:boolean
};
const parse = (xml: string) => new DOMParser().parseFromString(xml,'application/xml').documentElement;

it('exports only the structural projection, including consistent distinct made-up identifiers', () => {
  const residents = ['Fictional Canary Alpha', 'Fictional Canary Beta', 'Fictional Canary Alpha'];
  const entries = residents.map((name,i) => ({ time: 7.6, startedDateTime:'secret-time', _vendor:'secret-vendor',
    request:{ method:'POST',url:'https://user:pw@canary.invalid/cases/'+(i%2)+'?identity=secret-query#secret-fragment',
      headers:[{name:'Authorization',value:'secret-header'}],cookies:[{value:'secret-cookie'}],
      postData:{text:JSON.stringify({patientName:name,phone:'secret-phone'+(i%2),street:'secret-address'+(i%2),pon:'000'+(i%2),
        password:{name:'secret-pass'},notes:'secret-prose',otherKey:'secret-key',base64:'secret-encoding'})}},
    response:{status:200,statusText:'secret-text',content:{text:'<Rx><PrescriberOrderNumber>000'+(i%2)+'</PrescriberOrderNumber><FirstName>'+name+'</FirstName></Rx>'}}
  }));
  const report=project({log:{entries}},parse),out=JSON.stringify(report);
  for (const marker of ['Canary','canary','secret','0000','0001','@','cases/']) expect(out).not.toContain(marker);
  expect(report.records.map(r=>r.request.fields?.find(v=>v.field==='name')?.example)).toEqual(['Comet-1','Comet-2','Comet-1']);
  for(const field of ['phone','address','pon']) {
    const values=report.records.map(r=>r.request.fields?.find(v=>v.field===field)?.example);
    expect(values[0]).toBeTruthy();expect(values[0]).toEqual(values[2]);expect(values[0]).not.toEqual(values[1]);
  }
  expect(report.records[0].response.state).toBe('xml');
  expect(report.records[0].route).toBe(report.records[2].route);
  expect(report.records[0].route).not.toBe(report.records[1].route);
  expect(project({log:{entries:[entries[1]]}},parse).records[0].request.fields?.[0].example).toBe('Comet-1');
});

it('omits opaque bodies, isolates HTML/DTD, rejects wrong formats and bounds the report',()=>{
  for(const content of [{text:'secret-freetext'}, {text:'<!DOCTYPE x><x/>',mimeType:'text/xml'},
    {text:'<html><name>secret</name></html>'}, {text:'secret-base64',encoding:'base64'}, {text:'x'.repeat(250001)}]){
    const report=project({log:{entries:[{request:{method:'secret-method',url:'file:///secret-file'},response:{content}}]}},parse);
    expect(report.records[0].response).toEqual({state:'opaque'});expect(JSON.stringify(report)).not.toContain('secret');
  }
  expect(project({log:{entries:Array(401).fill({})}},parse).partial).toBe(true);
  expect(()=>project({},parse)).toThrow();
  expect(html).toContain("connect-src 'none'");
  expect(html).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|indexedDB)\b/);
});

it('keeps pilot code outside the application entry points and allowlisted production package',()=>{
  const packer=readFileSync('scripts/package-demo.py','utf8');
  expect(packer).not.toMatch(/workstation-probe|WorkstationProbe\.cs|HAR-Preview\.html|Start-Probe\.cmd/i);
  const scan=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?scan(path.join(dir,x.name)):[path.join(dir,x.name)]);
  for(const file of [...scan('src'), 'scripts/framework-desktop.mjs','scripts/iguana-bridge.mjs','windows/FrameworkDesktop.cs']){
    expect(readFileSync(file,'utf8')).not.toMatch(/pilot\/workstation-probe|WorkstationProbe\.cs|HAR-Preview\.html|Start-Probe\.cmd/i);
  }
});
