/* 生成"今日推送"HTML：从 data.js 读取内容，公文全量展示 */
const fs = require('fs');
const path = require('path');

const base = __dirname;
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

/* ==== 全部公文：按五位一体分组，组内按层级(上级在先)排序 ==== */
// 全量纳入材料库公文（用户要求每日推送包含全部公文，不做类型过滤）
const allDocs = MATERIALS.slice();
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
const affairsTop = affairsSorted.slice(0, 4);
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
</style>
</head>
<body>
<div class="wrap">
  <div class="hd">
    <div class="kicker">北京军转干部申论考核复习</div>
    <h1>今日研学推送</h1>
    <div class="date">${y}年${m}月${d}日 · ${week} · 第 ${d} 天</div>
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
    <h2>政策公文全览 · 官方原文</h2>
    <div class="doc-overview">共 ${allDocs.length} 份公文，按五位一体分组、来源层级排序，每日完整推送。全部为2026年6月以后中央/国务院公文；热点词由本批公文归纳，求是等文章仅作话题来源。</div>
    ${docGroupsHtml}
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
console.log('公文总数:', allDocs.length, '(全部推送)');
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


