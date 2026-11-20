/* 生成"今日推送"HTML：每天一张新报纸——公文只展示当日新入库政策，历史公文由站内搜索查阅 */
const fs = require('fs');
const path = require('path');

const base = '/workspace/juanguan-shenlun';
// 在线完整版公网链接（分享码是访问凭据，必须完整保留）
const SHARE_LINK = 'https://a56f8f2d42187ca60.app.workbuddy.host/?sharecode=CO4NF42T3B';
let code = fs.readFileSync(path.join(base, 'data.js'), 'utf8').replace(/\bconst /g, 'var ');
(0, eval)(code);

const now = new Date();
const beijing = new Date(now.getTime() + 8 * 3600 * 1000);
const y = beijing.getUTCFullYear();
const m = beijing.getUTCMonth() + 1;
const d = beijing.getUTCDate();
const weekArr = ['日','一','二','三','四','五','六'];
const week = '星期' + weekArr[beijing.getUTCDay()];

const qi = (d - 1) % QUOTES.length;
const oi = (d - 1) % OUTLINE_DAYS.length;
const qai = (d - 1) % QA_DAYS.length;
const q = QUOTES[qi];
const o = OUTLINE_DAYS[oi];
const qa = QA_DAYS[qai];

/* ==== 当日新增公文：按"入库日期账本"筛选，实现"每天一张新报纸" ==== */
// 今日推送只展示当天新入库的政策；历史公文不再重复出现，改由站内搜索/材料库查阅。
let intakeLedger = {};
// 优先读项目目录内的账本（随文件同步到 GitHub，Actions 环境也能读到），回退私有目录
for (const ledgerPath of [path.join(base, '入库日期.json'), '/workspace/juanguan-private/入库日期.json']) {
  try { intakeLedger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')); break; } catch (e) {}
}
const todayStamp = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const allDocs = MATERIALS.filter(mm => intakeLedger[mm.id] === todayStamp);
const DOM_ORDER = ['economy','politics','culture','social','eco'];
const grouped = DOM_ORDER.map(key => ({
  key,
  name: DOMAINS.find(dd => dd.key === key).name,
  color: DOMAINS.find(dd => dd.key === key).color,
  docs: allDocs.filter(mm => mm.domain === key).sort((a,b) => a.level - b.level || b.date.localeCompare(a.date))
})).filter(g => g.docs.length > 0);

// 今日精选热点词：按日期偏移取3个
const words = [0,1,2].map(k => HOTWORDS[(d - 1 + k * 7) % HOTWORDS.length]);

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
/* ==== 时政要闻：最新时政按日期取前4条 ==== */
const affairsSorted = AFFAIRS.slice().sort((a,b) => b.date.localeCompare(a.date));
// 每天从最新 8 条里按日期滑动取 4 条，保证每日组合不同、内容换代不重复
const affairsPool = affairsSorted.slice(0, Math.min(8, affairsSorted.length));
const affairsStep = (d - 1) % Math.max(1, affairsPool.length - 3);
const affairsTop = [0,1,2,3].map(k => affairsPool[(affairsStep + k) % affairsPool.length]);
const AFFAIRS_CAT = { speech:'最新讲话', meeting:'会议决议', media:'权威媒体', current:'时事热点' };
const AFFAIRS_COLOR = { speech:'#9c1c1c', meeting:'#8e44ad', media:'#b8912f', current:'#2c5d8f' };
const affairsHtml = affairsTop.map(a => `
  <div class="affair-item" style="border-left-color:${AFFAIRS_COLOR[a.cat]}">
    <div class="af-meta">
      <span class="af-cat" style="background:${AFFAIRS_COLOR[a.cat]}">${AFFAIRS_CAT[a.cat]}</span>
      <span class="af-date">${esc(a.date)}</span>
    </div>
    <div class="af-title">${esc(a.title)}</div>
    <div class="af-pts">${a.points.map(p => '· ' + esc(p)).join('<br>')}</div>
    <div class="af-use"><b>申论应用：</b>${esc(a.use)}</div>
    <a class="doc-link" href="${esc(a.link.url)}" target="_blank" rel="noopener">${esc(a.link.label)} ↗</a>
  </div>`).join('');

const LEVEL_NAME = { 1: '一级·中共中央/国务院', 2: '二级·中央部委', 3: '三级·省级政府', 4: '参考·权威媒体' };

/* ==== 主题/精神分布统计（用于推送概览） ==== */
const themeStat = THEMES.map(t => ({
  name: t.name,
  value: MATERIALS.filter(mm => (MATERIAL_TAGS[mm.id]?.themes || []).includes(t.key)).length +
         AFFAIRS.filter(aa => (AFFAIR_TAGS[aa.id]?.themes || []).includes(t.key)).length
})).sort((a,b) => b.value - a.value);
const spiritStat = SPIRITS.map(sp => ({
  name: sp.name,
  value: MATERIALS.filter(mm => (MATERIAL_TAGS[mm.id]?.spirits || []).includes(sp.key)).length +
         AFFAIRS.filter(aa => (AFFAIR_TAGS[aa.id]?.spirits || []).includes(sp.key)).length
})).sort((a,b) => b.value - a.value);
const themeStatHtml = themeStat.map(t => `<span class="stat-chip">${esc(t.name)} <b>${t.value}</b></span>`).join('');
const spiritStatHtml = spiritStat.map(sp => `<span class="stat-chip purple">${esc(sp.name)} <b>${sp.value}</b></span>`).join('');

const docGroupsHtml = grouped.map(g => `
  <div class="doc-group">
    <div class="doc-group-hd" style="border-left-color:${g.color}">
      <span class="dg-name" style="color:${g.color}">${esc(g.name)}</span>
      <span class="dg-count">${g.docs.length} 份</span>
    </div>
    ${g.docs.map(mm => `
      <div class="doc-item" style="border-left-color:${g.color}">
        <div class="doc-meta">
          <span class="tag">${esc(LEVEL_NAME[mm.level])}</span>
          <span class="tag type">${esc(mm.type)}</span>
          <span class="tag date">${esc(mm.date)}</span>
        </div>
        <div class="doc-title">${esc(mm.title)}</div>
        <div class="doc-org">发文机关：<b>${esc(mm.org)}</b></div>
        <div class="doc-points">${mm.points.map(p => '· ' + esc(p)).join('<br>')}</div>
        <div class="doc-use"><b>申论应用：</b>${esc(mm.use)}</div>
        <a class="doc-link" href="${esc(mm.link.url)}" target="_blank" rel="noopener">${esc(mm.link.label)} ↗</a>
      </div>`).join('')}
  </div>`).join('');

const html = `<!DOCTYPE html>
<!-- 作者：宇宇爱高高，创建时间：2026-11-19，自主设计，AI辅助编码 -->
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="author" content="宇宇爱高高">
<meta name="copyright" content="© 2026 宇宇爱高高">
<meta name="generator" content="WorkBuddy，需求与设计由宇宇爱高高完成">
<title>军转申论·今日推送 ${m}月${d}日</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;background:#f5f2ec;color:#2b2b2b;line-height:1.8;padding:20px}
.wrap{max-width:720px;margin:0 auto}
.hd{background:linear-gradient(135deg,#9c1c1c,#7d1414);color:#fff;border-radius:14px;padding:26px 28px;margin-bottom:16px;position:relative;overflow:hidden}
.hd::after{content:"";position:absolute;right:-30px;top:-30px;width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,.06)}
.hd .kicker{font-size:12px;letter-spacing:3px;opacity:.8}
.hd h1{font-size:24px;margin:6px 0 4px;letter-spacing:1px}
.hd .date{font-size:13px;opacity:.85}
.card{background:#fffdf9;border:1px solid #e8e2d8;border-radius:12px;padding:22px 24px;margin-bottom:14px;box-shadow:0 2px 14px rgba(90,60,30,.07)}
.card h2{font-size:15px;color:#7d1414;display:flex;align-items:center;gap:8px;margin-bottom:14px}
.card h2::before{content:"";width:4px;height:16px;background:#b8912f;border-radius:2px}
.qmark{font-size:52px;color:#d9b64d;line-height:.5;font-family:Georgia,serif;opacity:.55}
.qtext{font-size:18px;line-height:2;font-weight:500;margin:8px 0 12px}
.qsrc{font-size:12px;color:#9c1c1c;border-left:2px solid #b8912f;padding-left:10px}
.quse{font-size:12px;color:#7a5c22;background:#fbf4e6;border-radius:6px;padding:8px 12px;margin-top:12px}
.badge{display:inline-block;font-size:11px;color:#fff;background:#9c1c1c;padding:2px 10px;border-radius:4px;margin-bottom:8px}
.badge.blue{background:#2c5d8f}
.stitle{font-size:16px;font-weight:700;line-height:1.5;margin-bottom:8px}
.sbody{font-size:13px;color:#555;line-height:1.9}
.pts{background:#faf8f3;border-radius:8px;padding:12px 16px;margin-top:12px}
.pts .h{font-size:12px;color:#7d1414;font-weight:700;margin-bottom:6px}
.pts ul{padding-left:18px;font-size:12.5px;color:#555;line-height:1.9}
.word{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px dashed #e8e2d8}
.word:last-child{border-bottom:none}
.word .n{font-size:14px;font-weight:700;color:#7d1414;min-width:96px}
.word .d{font-size:12.5px;color:#555}
.doc-overview{font-size:12px;color:#888;margin:-6px 0 14px}
.doc-group{margin-bottom:18px}
.doc-group-hd{display:flex;align-items:center;gap:10px;border-left:4px solid;padding-left:12px;margin-bottom:10px}
.dg-name{font-size:15px;font-weight:700}
.dg-count{font-size:12px;color:#999}
.doc-item{border:1px solid #ebe5db;border-left:3px solid;border-radius:8px;padding:14px 16px;margin-bottom:10px;background:#fff}
.doc-meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
.tag{font-size:10.5px;padding:2px 8px;border-radius:4px;color:#fff;background:#9c1c1c}
.tag.type{background:#eef2f7;color:#2c5d8f}
.tag.date{background:transparent;color:#999;padding-left:0}
.doc-title{font-size:14px;font-weight:700;line-height:1.5;color:#2b2b2b;margin-bottom:5px}
.doc-org{font-size:11.5px;color:#999;margin-bottom:8px}
.doc-org b{color:#9c1c1c}
.doc-points{font-size:11.8px;color:#555;line-height:1.9;background:#faf8f3;border-radius:6px;padding:8px 12px}
.doc-use{font-size:11.5px;color:#7a5c22;margin-top:7px}
.doc-use b{color:#9c1c1c}
.doc-link{display:inline-block;margin-top:8px;font-size:11.5px;color:#2c5d8f;border:1px solid #c9d6e4;border-radius:5px;padding:3px 10px;text-decoration:none}
.stat-chip{display:inline-block;font-size:11px;padding:3px 10px;border-radius:14px;background:#fbeeec;color:#9c1c1c;margin:0 6px 6px 0;border:1px solid #f0d5d2}
.stat-chip b{font-size:12px}
.stat-chip.purple{background:#f4eefa;color:#8e44ad;border-color:#e3d4f0}
.affair-item{border:1px solid #ebe5db;border-left:3px solid;border-radius:8px;padding:12px 15px;margin-bottom:10px;background:#fff}
.af-meta{display:flex;gap:8px;align-items:center;margin-bottom:6px}
.af-cat{font-size:10.5px;color:#fff;padding:2px 8px;border-radius:4px}
.af-date{font-size:10.5px;color:#999}
.af-title{font-size:13.5px;font-weight:700;line-height:1.5;color:#2b2b2b;margin-bottom:6px}
.af-pts{font-size:11.5px;color:#555;line-height:1.8;background:#faf8f3;border-radius:6px;padding:8px 11px}
.af-use{font-size:11.2px;color:#7a5c22;margin-top:6px}
.af-use b{color:#9c1c1c}
.foot{text-align:center;font-size:11.5px;color:#999;padding:16px 0}
.foot b{color:#9c1c1c}
.save-pdf-bar{text-align:center;margin:0 0 16px}
.save-pdf-btn{display:inline-block;background:#2c5d8f;color:#fff;border:none;border-radius:22px;padding:11px 26px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 3px 10px rgba(44,93,143,.25)}
.save-pdf-btn:hover{background:#1f4469}
@media print{
  @page{size:A4;margin:12mm 10mm}
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  body{background:#fff!important;padding:0!important;font-family:"Noto Sans CJK SC","PingFang SC","Microsoft YaHei",sans-serif!important}
  .wrap{max-width:100%!important}
  .save-pdf-bar{display:none!important}
  .card,.doc-item,.affair-item,.doc-group,.hd{break-inside:avoid;page-break-inside:avoid}
  .card{box-shadow:none!important}
}
</style>
</head>
<body>
<div class="wrap">
  <div class="hd">
    <div class="kicker">北京军转干部申论考核复习</div>
    <h1>今日研学推送</h1>
    <div class="date">${y}年${m}月${d}日 · ${week} · 第 ${d} 天</div>
  </div>

  <div class="save-pdf-bar">
    <button class="save-pdf-btn" onclick="window.print()">📄 保存本期为 PDF</button>
  </div>

  <div class="card">
    <h2>今日金句</h2>
    <div class="qmark">“</div>
    <div class="qtext">${esc(q.text)}</div>
    <div class="qsrc">—— ${esc(q.source)}</div>
    <div class="quse"><b>申论应用：</b>${esc(q.use)}</div>
  </div>

  <div class="card">
    <h2>时政要闻 · 最新讲话与会议精神</h2>
    <div class="doc-overview">按发布时间取最新4条，涵盖习近平最新讲话、中央全会/人大决议、《求是》等权威媒体文章与重大时事，均附原文链接。</div>
    ${affairsHtml}
  </div>

  <div class="card">
    <h2>主题 · 精神分类速览</h2>
    <div class="doc-overview">按8类政策主题与7类思想精神横向梳理，一份内容可兼具多个标签。</div>
    <div style="font-size:12px;color:#7d1414;font-weight:700;margin:6px 0 4px">政策主题覆盖</div>
    <div>${themeStatHtml}</div>
    <div style="font-size:12px;color:#8e44ad;font-weight:700;margin:12px 0 4px">思想精神频次</div>
    <div>${spiritStatHtml}</div>
  </div>

  <div class="card">
    <h2>今日新增政策 · 官方原文</h2>
    <div class="doc-overview">每天一张新报纸：本栏只展示<b>今日（${todayStamp}）新入库</b>的政策，共 ${allDocs.length} 份。往期公文不再重复推送，请在网页「站内搜索」或「五位一体材料库」中查阅全部历史文件。</div>
    ${allDocs.length ? docGroupsHtml : '<div class="doc-empty" style="text-align:center;padding:26px 12px;color:#888;font-size:13px;line-height:1.9">📭 今日暂无新入库政策。<br>金句、日课、时政、热点词照常更新；<br>全部历史公文请通过网页「站内搜索」或「材料库」查阅。</div>'}
  </div>

  <div class="card">
    <h2>今日理论日课 · 学习纲要（2023版）</h2>
    <span class="badge">${esc(o.badge)}</span>
    <div class="stitle">${esc(o.title)}</div>
    <div class="sbody">${esc(o.body)}</div>
    <div class="pts"><div class="h">要点速记</div><ul>${o.points.map(p => '<li>' + esc(p) + '</li>').join('')}</ul></div>
  </div>

  <div class="card">
    <h2>今日理论日课 · 学习问答</h2>
    <span class="badge blue">${esc(qa.badge)}</span>
    <div class="stitle">${esc(qa.title)}</div>
    <div class="sbody">${esc(qa.body)}</div>
    <div class="pts"><div class="h">要点速记</div><ul>${qa.points.map(p => '<li>' + esc(p) + '</li>').join('')}</ul></div>
  </div>

  <div class="card">
    <h2>今日热点词</h2>
    ${words.map(w => '<div class="word"><div class="n">' + esc(w.name) + '</div><div class="d">' + esc(w.def) + '</div></div>').join('')}
  </div>

  <div class="card" style="text-align:center;background:linear-gradient(135deg,#9c1c1c,#7d1414);color:#fff;border:none">
    <div style="font-size:15px;font-weight:700;margin-bottom:8px">在线完整版 · 手机电脑均可打开</div>
    <div style="font-size:12px;opacity:.9;line-height:1.7;margin-bottom:14px">全部栏目随时查阅 · 学习进度打卡 · 政策时间轴<br>请完整保留链接中的 sharecode 参数</div>
    <a href="${SHARE_LINK}" style="display:inline-block;background:#fff;color:#9c1c1c;padding:9px 20px;border-radius:22px;text-decoration:none;font-size:13px;font-weight:700">打开在线复习网页 →</a>
    <div style="font-size:10px;opacity:.8;margin-top:12px;word-break:break-all">${esc(SHARE_LINK)}</div>
  </div>

  <div class="foot">每日 <b>12:00</b> 准时推送 · 时政源自新华社/人民网/求是/中国政府网 · 日拱一卒 · 功不唐捐</div>
  <div style="text-align:center;margin-top:10px;font-size:11px;color:#999;line-height:1.8">© 2026 宇宇爱高高，本项目需求、方案设计由宇宇爱高高独立完成，WorkBuddy仅作为代码辅助生成工具，本人保留全部著作权。</div>
</div>
</body>
</html>`;

const out = path.join(base, '今日推送_' + y + '-' + String(m).padStart(2,'0') + '-' + String(d).padStart(2,'0') + '.html');
fs.writeFileSync(out, html, 'utf8');
console.log('已生成:', out);
console.log('今日新增政策:', allDocs.length, '份（其余历史公文改由站内搜索查阅）');
console.log('材料库总数:', MATERIALS.length, '份');
grouped.forEach(g => console.log('  ' + g.name + ': ' + g.docs.length + ' 份'));

/* ==== 重建推送归档清单：扫描目录内所有 今日推送_YYYY-MM-DD.html ==== */
const PUSH_PREFIX = '今日推送_';
const archives = fs.readdirSync(base)
  .filter(f => /^今日推送_\d{4}-\d{2}-\d{2}\.html$/.test(f))
  .map(f => {
    const ds = f.slice(PUSH_PREFIX.length, -5); // 去前缀与 .html
    const [yy, mm, dd] = ds.split('-').map(Number);
    const wd = ['日','一','二','三','四','五','六'][new Date(yy, mm - 1, dd).getDay()];
    return { date: ds, y: yy, m: mm, d: dd, label: `${yy}年${mm}月${dd}日 星期${wd}`, file: f };
  })
  .sort((a, b) => b.date.localeCompare(a.date)); // 日期倒序，最新在前
const archiveJs = '/* 由 gen_daily.js 自动生成：每日推送归档清单，勿手动编辑 */\n'
  + 'const PUSH_ARCHIVE = ' + JSON.stringify(archives, null, 2) + ';\n';
fs.writeFileSync(path.join(base, 'push_archive.js'), archiveJs, 'utf8');
console.log('归档清单已更新:', archives.length, '份推送');

/* ==== 每日修改日志：仅写入私有目录 /workspace/juanguan-private（不发布到线上） ==== */
const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const PRIVATE_DIR = '/workspace/juanguan-private';
if (!fs.existsSync(PRIVATE_DIR)) fs.mkdirSync(PRIVATE_DIR, { recursive: true });
const STATE_FILE = path.join(PRIVATE_DIR, '修改日志_state.json');
const LOG_FILE = path.join(PRIVATE_DIR, '修改日志.md');
const crypto2 = require('crypto');
const tracked = fs.readdirSync(base).filter(f => /\.(js|html|css|md)$/.test(f) && !f.startsWith('今日推送_') && !f.startsWith('修改日志') && !f.startsWith('预览_'));
const hashes = {};
tracked.forEach(f => { hashes[f] = crypto2.createHash('md5').update(fs.readFileSync(path.join(base, f))).digest('hex'); });
let prev = {};
try { prev = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) { prev = null; }
const changes = prev
  ? tracked.filter(f => !prev[f] || prev[f] !== hashes[f]).map(f => `- ${f}（${prev[f] ? '已修改' : '新增'}）`)
  : ['（首次运行，建立基线，无对比记录）'];
const todayPolicies = MATERIALS.filter(mm => mm.date === dateStr).map(mm => `- ${mm.title}`);
const logText = `\n## ${dateStr} 修改内容日志\n\n### 文件变更\n${changes.join('\n') || '- 无文件改动'}\n\n### 当日新增政策\n${todayPolicies.join('\n') || '- 无新增政策'}\n\n### 当日推送\n- 今日推送_${dateStr}.html（当日新增 ${todayPolicies.length} 份；材料库累计 ${MATERIALS.length} 份，历史公文改由站内搜索查阅）\n`;
let logAll = '';
try { logAll = fs.readFileSync(LOG_FILE, 'utf8'); } catch (e) { logAll = '# 修改内容日志\n'; }
if (!logAll.includes('## ' + dateStr)) { fs.writeFileSync(LOG_FILE, logAll + logText, 'utf8'); }
fs.writeFileSync(STATE_FILE, JSON.stringify(hashes, null, 2), 'utf8');
// 生成可网页查看的日志页（含目录内所有日志文件内容）
let logMd = '';
try { logMd = fs.readFileSync(LOG_FILE, 'utf8'); } catch (e) {}
const logHtml = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>修改内容日志</title><style>body{font-family:"PingFang SC",sans-serif;max-width:760px;margin:30px auto;padding:0 18px;color:#333;line-height:1.8}h1{font-size:22px;color:#9c1c1c}h2{font-size:17px;margin-top:28px;border-bottom:1px solid #eee;padding-bottom:6px}pre{white-space:pre-wrap;font-family:inherit;font-size:14px;color:#555}</style></head>\n<body><h1>修改内容日志</h1><pre>' + logMd.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</pre></body>\n</html>\n';
fs.writeFileSync(path.join(PRIVATE_DIR, '修改日志.html'), logHtml, 'utf8');
console.log('修改日志已更新:', dateStr);

/* ==== 每日自动重建离线单文件版（放 /workspace 供下载，永不依赖链接） ==== */
try {
  require('child_process').execSync('node "' + path.join(base, 'build_offline.js') + '"', { stdio: 'ignore' });
  console.log('离线单文件版已重建');
} catch (e) { console.error('离线版重建失败:', e.message); }

/* ==== 同步生成 PDF：把每份推送 HTML 转成 PDF，供网页端「下载PDF」按钮下载 ==== */
/* 已存在的跳过，仅当天新增的会生成；失败不影响主推送。PDF 与 HTML 同目录，网页按钮可直接访问 */
try {
  const { execFileSync } = require('child_process');
  const pdfDir = base;
  const chromePath = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', process.env.CHROME_PATH].filter(Boolean).find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
  if (chromePath) {
    for (const a of archives) {
      const pdfName = a.file.replace(/\.html$/, '.pdf');
      const pdfOut = path.join(pdfDir, pdfName);
      if (fs.existsSync(pdfOut)) continue; // 已存在跳过
      const html = fs.readFileSync(path.join(base, a.file), 'utf8');
      const tmp = path.join(base, '.__pdf_tmp.html');
      fs.writeFileSync(tmp, html, 'utf8'); // 模板已内置 @media print 样式
      try {
        execFileSync(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-pdf-header-footer', `--print-to-pdf=${pdfOut}`, 'file://' + tmp], { stdio: 'ignore', timeout: 60000 });
        console.log('PDF 已生成:', pdfName);
      } catch (e) {
        console.log('PDF 生成失败(不影响推送):', pdfName);
        try { fs.unlinkSync(pdfOut); } catch (e2) {}
      } finally {
        try { fs.unlinkSync(tmp); } catch (e2) {}
      }
    }
  } else {
    console.log('未找到 Chrome，跳过 PDF 生成（不影响推送）。');
  }
} catch (e) { console.log('PDF 环节跳过:', e.message); }

/* ==== 每日自动同步到 GitHub Pages（保证与 WorkBuddy 站点内容一致） ==== */
try {
  const { execFileSync } = require('child_process');
  const syncScript = path.join(base, 'sync_github.py');
  if (fs.existsSync(syncScript)) {
    console.log('正在同步到 GitHub Pages…');
    const out = execFileSync('python3', [syncScript], { encoding: 'utf8', timeout: 600000 });
    console.log(out.trim());
  } else {
    console.log('未找到 sync_github.py，跳过 GitHub 同步');
  }
} catch (e) {
  // 如实报告同步失败，但不影响当日推送与 publish.js
  const detail = (e.stderr || e.stdout || e.message || '').toString().trim();
  console.error('GitHub Pages 同步失败（如实报告）:', detail);
}
