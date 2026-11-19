/* 每日政策更新辅助脚本
 * 用法：node update_policy.js '<政策JSON>'
 * 作用：把一条经核实的新政策安全追加到 data.js 的 MATERIALS 与 MATERIAL_TAGS。
 * 去重口径：仅同级（同为中央级 level=1 / 同为省级 level=2）且核心关键词(keyword)相同才跳过；
 *           跨级相同关键词各自保留。
 * 政策 JSON 字段：
 *   title, org, date(YYYY-MM-DD), type, domain(economy|politics|culture|social|eco),
 *   level(1|2), keyword(核心关键词), points(字符串数组), use, url, label,
 *   themes(数组), spirits(数组)
 */
const fs = require('fs');
const path = require('path');

const base = __dirname;
const dataPath = path.join(base, 'data.js');

// ---- 读取参数 ----
const raw = process.argv[2];
if (!raw) { console.error('错误：缺少政策 JSON 参数。用法：node update_policy.js \'<政策JSON>\''); process.exit(1); }
let p;
try { p = JSON.parse(raw); }
catch (e) { console.error('错误：政策 JSON 解析失败 - ' + e.message); process.exit(1); }

// ---- 字段校验 ----
const required = ['title', 'org', 'date', 'type', 'domain', 'level', 'keyword', 'points', 'use', 'url'];
const missing = required.filter(k => p[k] === undefined || p[k] === '');
if (missing.length) { console.error('错误：缺少字段 ' + missing.join(', ')); process.exit(1); }
if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) { console.error('错误：date 需为 YYYY-MM-DD'); process.exit(1); }
if (p.date < '2026-06-01') { console.error('错误：政策日期早于 2026-06，不予收录'); process.exit(1); }
if (!Array.isArray(p.points) || !p.points.length) { console.error('错误：points 需为非空数组'); process.exit(1); }
if (!/^https?:\/\//.test(p.url)) { console.error('错误：url 需为完整 http(s) 链接'); process.exit(1); }
const validDomains = ['economy', 'politics', 'culture', 'social', 'eco'];
if (!validDomains.includes(p.domain)) { console.error('错误：domain 必须为 ' + validDomains.join('/')); process.exit(1); }
p.level = Number(p.level);
if (p.level !== 1 && p.level !== 2) { console.error('错误：level 必须为 1(中央) 或 2(省级)'); process.exit(1); }

// ---- 读取 data.js 并解析现有 MATERIALS ----
let src = fs.readFileSync(dataPath, 'utf8');
const mStart = src.indexOf('const MATERIALS = [');
const mEnd = src.indexOf('const HOTWORDS', mStart);
if (mStart < 0 || mEnd < 0) { console.error('错误：无法定位 MATERIALS 区块'); process.exit(1); }
const arrMatch = src.slice(mStart, mEnd).match(/\[[\s\S]*?\];/);
if (!arrMatch) { console.error('错误：无法解析 MATERIALS 数组'); process.exit(1); }
let MATERIALS;
try { MATERIALS = eval('(' + arrMatch[0].replace(/;\s*$/, '') + ')'); }
catch (e) { console.error('错误：MATERIALS 解析失败 - ' + e.message); process.exit(1); }

// ---- 同级同关键词去重 ----
const dup = MATERIALS.find(m => Number(m.level) === p.level && (
  (m.keyword && m.keyword === p.keyword) || (m.title === p.title)
));
if (dup) {
  console.log(JSON.stringify({ status: 'skipped', reason: '同级已存在相同关键词或同名政策', existing: dup.id, keyword: p.keyword }));
  process.exit(0);
}

// ---- 分配新 id ----
const prefix = { economy: 'e', politics: 'p', culture: 'c', social: 's', eco: 'w' }[p.domain];
const usedIds = new Set(MATERIALS.map(m => m.id));
let n = 1;
while (usedIds.has(prefix + String(n).padStart(2, '0'))) n++;
const newId = prefix + String(n).padStart(2, '0');

const themes = Array.isArray(p.themes) && p.themes.length ? p.themes : ['people'];
const spirits = Array.isArray(p.spirits) && p.spirits.length ? p.spirits : ['system'];

// ---- 构造条目文本（单行 points 以匹配现有风格）----
const pts = p.points.map(s => JSON.stringify(s)).join(',\n      ');
const entry =
`  {
    id: ${JSON.stringify(newId)}, domain: ${JSON.stringify(p.domain)}, level: ${p.level}, type: ${JSON.stringify(p.type)},
    keyword: ${JSON.stringify(p.keyword)},
    title: ${JSON.stringify(p.title)},
    org: ${JSON.stringify(p.org)}, date: ${JSON.stringify(p.date)},
    points: [
      ${pts}
    ],
    use: ${JSON.stringify(p.use)},
    link: { url: ${JSON.stringify(p.url)}, label: ${JSON.stringify(p.label || '官方原文')} }
  }`;

// ---- 插入 MATERIALS：定位数组内最后一个 '  }' 之后、'\n];' 之前 ----
const arrStartAbs = mStart + arrMatch.index;
const arrAbs = arrMatch[0].replace(/;\s*$/, ''); // 去掉结尾分号，形如 '[...]'
const lastBrace = arrAbs.lastIndexOf('}');
const newArr = arrAbs.slice(0, lastBrace + 1) + ',\n' + entry + '\n' + arrAbs.slice(lastBrace + 1) + ';';
src = src.slice(0, arrStartAbs) + newArr + src.slice(arrStartAbs + arrMatch[0].length);

// ---- 插入 MATERIAL_TAGS：定位对象内最后一个 '  }' 之后、'\n};' 之前 ----
const tStart = src.indexOf('const MATERIAL_TAGS = {');
const tObjMatch = src.slice(tStart).match(/\{[\s\S]*?\n\};/);
if (tStart >= 0 && tObjMatch) {
  const tAbs = tObjMatch[0].replace(/;\s*$/, ''); // '{...\n}'
  const tLastBrace = tAbs.lastIndexOf('}');
  const q = a => "'" + String(a).replace(/'/g, "\\'") + "'";
  const tagLine = `\n  ${newId}: { themes:[${themes.map(q).join(',')}], spirits:[${spirits.map(q).join(',')}] }`;
  const newTObj = tAbs.slice(0, tLastBrace) + ',' + tagLine + '\n' + tAbs.slice(tLastBrace) + ';';
  const tStartAbs = tStart + 'const MATERIAL_TAGS = '.length;
  src = src.slice(0, tStartAbs) + newTObj + src.slice(tStartAbs + tObjMatch[0].length);
}

fs.writeFileSync(dataPath, src, 'utf8');
console.log(JSON.stringify({ status: 'added', id: newId, title: p.title, date: p.date, level: p.level, keyword: p.keyword }));
