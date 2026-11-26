// 서비스 워커가 처음 설치될 때 미리 저장해 둘 파일 목록(public/precache.json)을 만든다: node scripts/make-precache.js
// 화면을 이루는 파일(index·css·js·img·가벼운 vendor·기본 글꼴 CSS)만 담는다. 글꼴 파일(kr)과 큰 라이브러리(pdfjs)는 쓸 때 저장된다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const walk = (dir, out = []) => { for (const n of fs.readdirSync(path.join(PUB, dir)).sort()) { const p = `${dir}/${n}`; if (fs.statSync(path.join(PUB, p)).isDirectory()) walk(p, out); else out.push(p); } return out; };
export function precacheList() {
  const list = ['index.html', 'style.css', 'manifest.webmanifest', ...walk('js'), ...walk('img'), 'fonts/pretendard/pretendardvariable-dynamic-subset.css'];
  for (const v of fs.readdirSync(path.join(PUB, 'vendor')).sort()) if (v !== 'pdfjs') list.push(...walk(`vendor/${v}`));
  return list.filter(f => !/\.(md|txt)$/i.test(f));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { const l = precacheList(); fs.writeFileSync(path.join(PUB, 'precache.json'), JSON.stringify(l, null, 1) + '\n'); console.log(`precache.json ${l.length}개`); }
