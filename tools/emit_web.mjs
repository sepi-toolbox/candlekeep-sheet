// data/db/*.json → web/data.js (전역 window.DB 번들). 사용: node tools/emit_web.mjs
import fs from 'fs';
const DB = 'data/db';
const map = {
  spells: 'spell', weapons: 'weapon', armor: 'armor', gear: 'gear', feats: 'feat',
  magicItems: 'magic-item', monsters: 'monster', species: 'species',
  classes: 'class', subclasses: 'subclass', rules: 'rule', backgrounds: 'background',
};
const out = {};
for (const [key, kind] of Object.entries(map)) {
  try { out[key] = JSON.parse(fs.readFileSync(`${DB}/${kind}.json`, 'utf8')); }
  catch { out[key] = []; }
}
fs.mkdirSync('web', { recursive: true });
fs.writeFileSync('web/data.js', 'window.DB = ' + JSON.stringify(out) + ';\n');
const sz = (fs.statSync('web/data.js').size / 1024).toFixed(0);
console.log('web/data.js 생성:', sz, 'KB |', Object.entries(out).map(([k, v]) => `${k}:${v.length}`).join(' '));
