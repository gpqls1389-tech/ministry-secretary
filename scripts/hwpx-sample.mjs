// 개발용: 서식마다 한글(HWPX) 견본 파일을 만든다(가상 내용). node scripts/hwpx-sample.mjs <출력 폴더>
import fs from 'node:fs'; import path from 'node:path';
import { buildHwpx, sectionXml, HWPX_BASE_FILES } from '../public/js/hwpx.js';
import { ADMIN_FORMS, formBlocks, blankValues, blocksText } from '../public/js/admin.js';
const out = process.argv[2] || '.'; fs.mkdirSync(out, { recursive: true });
const base = Object.fromEntries(HWPX_BASE_FILES.map(f => [f, fs.readFileSync(new URL('../public/vendor/hwpx/' + f, import.meta.url), 'utf8')]));
for (const f of ADMIN_FORMS) {
  const v = blankValues(f); for (const x of f.fields) { if (x.type === 'text' || x.type === 'date') v[x.k] = `(가상) ${x.label}`; if (x.type === 'area') v[x.k] = `(가상) ${x.label} 첫 줄\n둘째 줄 & <특수문자>`; if (x.type === 'table') v[x.k][0] = x.cols.map(c => `(가상) ${c}`); if (x.type === 'check') v[x.k] = [0]; }
  const B = formBlocks(f, v, { sub: '가상 교회 아동부' }); const bytes = buildHwpx(B, { title: f.name, text: blocksText(B), base });
  fs.writeFileSync(path.join(out, `${f.key}.hwpx`), bytes); fs.writeFileSync(path.join(out, `${f.key}.section0.xml`), sectionXml(B));
}
console.log('ok', ADMIN_FORMS.length);
