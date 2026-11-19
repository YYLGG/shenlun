/* ============ 交互逻辑 ============ */

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

const LEVEL_NAME = { 1: '一级·中央', 2: '二级·部委', 3: '三级·省级', 4: '参考·媒体' };
const LEVEL_SHORT = { 1: '中共中央/国务院', 2: '中央部委', 3: '省级政府', 4: '权威媒体话题' };

const state = {
  domain: 'all',
  level: 'all',
  type: 'all',
  keyword: '',
  prioritySort: true,
  quoteIndex: 0,
  favQuotes: new Set(),
  studyTab: 'outline',
  selectedDay: new Date().getDate(),
  wordCat: '全部',
  affairsCat: 'all',
  themeSel: null,
  spiritSel: null
};

/* 合并原热点词与扩充关键词（按名称去重，扩充词补入） */
const ALL_WORDS = (() => {
  const map = new Map();
  HOTWORDS.forEach(w => map.set(w.name, { ...w, weight: w.weight || 6 }));
  EXTRA_KEYWORDS.forEach(w => { if (!map.has(w.name)) map.set(w.name, w); });
  return Array.from(map.values());
})();

/* ---------- 日期 ---------- */
function dateInfo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const week = ['日','一','二','三','四','五','六'][now.getDay()];
  return { now, y, m, d, week, full: `${y}年${m}月${d}日 星期${week}` };
}

/* ---------- 视图切换 ---------- */
function switchView(view, record = true) {
  // 校验视图合法性，非法则回退到导航中心
  if (!document.getElementById('view-' + view)) view = 'nav';
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
  // 返回上层面包屑：导航中心页隐藏，其余显示当前栏目名
  const crumb = $('#crumbBar');
  if (crumb) {
    crumb.classList.toggle('show', view !== 'nav');
    const cur = $('#crumbCurrent');
    if (cur) cur.textContent = VIEW_NAME[view] || '当前栏目';
  }
  // 让移动端顶栏标题显示当前栏目
  const mt = $('#mtTitle');
  if (mt) mt.textContent = VIEW_NAME[view] || '军转申论研学';
  // 关闭移动端菜单
  $('#sidebar').classList.remove('open');
  $('#overlay').classList.remove('show');
  document.body.classList.remove('nav-open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // 把当前栏目写入地址栏，便于从原文链接返回或刷新后仍停留在本栏目
  if (record && typeof history !== 'undefined' && history.pushState) {
    const hash = '#/' + view;
    if (location.hash !== hash) {
      history.pushState({ view }, '', hash);
    }
  }
}

/* ---------- 从地址栏恢复视图（支持刷新/返回/外链回来） ---------- */
function viewFromHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  return document.getElementById('view-' + raw) ? raw : 'nav';
}
function initHashNav() {
  // 首次进入：按地址栏 hash 定位栏目
  switchView(viewFromHash(), false);
  // 浏览器前进/后退
  window.addEventListener('popstate', () => switchView(viewFromHash(), false));
}

function initNav() {
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => switchView(item.dataset.view));
  });
  // 返回上层面包屑按钮
  const crumbBack = $('#crumbBack');
  if (crumbBack) crumbBack.addEventListener('click', () => switchView('nav'));
  $$('[data-goto]').forEach(el => {
    el.addEventListener('click', () => switchView(el.dataset.goto));
  });
  // 移动端菜单：打开抽屉并锁定背景滚动
  const openNav = () => {
    $('#sidebar').classList.add('open');
    $('#overlay').classList.add('show');
    document.body.classList.add('nav-open');
  };
  const closeNav = () => {
    $('#sidebar').classList.remove('open');
    $('#overlay').classList.remove('show');
    document.body.classList.remove('nav-open');
  };
  $('#menuBtn').addEventListener('click', openNav);
  $('#overlay').addEventListener('click', closeNav);
  const navClose = $('#navClose');
  if (navClose) navClose.addEventListener('click', closeNav);
  // Esc 关闭抽屉
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('#sidebar').classList.contains('open')) closeNav();
  });
  // 横竖屏切换时若回到宽屏，复位抽屉状态
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024 && $('#sidebar').classList.contains('open')) closeNav();
  });
}

/* ---------- 首页 ---------- */
function initHome() {
  const di = dateInfo();
  $('#sideDate').textContent = di.full;
  $('#homeDateChip').textContent = di.full;
  $('#homeGreeting').textContent = '欢迎回来，今天是' + di.m + '月' + di.d + '日，坚持学习，离目标更近一步。';

  $('#statMaterial').textContent = MATERIALS.length;
  $('#statQuote').textContent = QUOTES.length;
  $('#statWord').textContent = ALL_WORDS.length;
  $('#statDay').textContent = di.d;

  // 今日金句（按日期偏移）
  const idx = (di.d - 1) % QUOTES.length;
  renderQuote(idx, '#homeQuoteText', '#homeQuoteSource', '#homeQuoteUse');
  $('#homeQuoteRefresh').addEventListener('click', () => {
    state.quoteIndex = (state.quoteIndex + 1) % QUOTES.length;
    renderQuote(state.quoteIndex, '#homeQuoteText', '#homeQuoteSource', '#homeQuoteUse');
  });
  state.quoteIndex = idx;

  // 今日日课
  const oi = (di.d - 1) % OUTLINE_DAYS.length;
  const qi = (di.d - 1) % QA_DAYS.length;
  $('#homeOutlineTitle').textContent = OUTLINE_DAYS[oi].title;
  $('#homeOutlineDesc').textContent = OUTLINE_DAYS[oi].badge + ' · ' + OUTLINE_DAYS[oi].points[0];
  $('#homeQATitle').textContent = QA_DAYS[qi].title;
  $('#homeQADesc').textContent = QA_DAYS[qi].badge + ' · ' + QA_DAYS[qi].points[0];

  renderFiveOverview();
}

function renderQuote(idx, textSel, srcSel, useSel) {
  const q = QUOTES[idx];
  $(textSel).textContent = q.text;
  $(srcSel).textContent = '—— ' + q.source;
  $(useSel).textContent = '申论应用：' + q.use;
}

function renderFiveOverview() {
  const container = $('#fiveOverview');
  container.innerHTML = '';
  DOMAINS.filter(d => d.key !== 'all').forEach(d => {
    const count = MATERIALS.filter(m => m.domain === d.key).length;
    const card = document.createElement('div');
    card.className = 'five-card';
    card.innerHTML = `
      <div class="five-icon" style="background:${d.color}">${d.icon}</div>
      <div class="five-name">${d.name}</div>
      <div class="five-count">${count} 份材料</div>`;
    card.addEventListener('click', () => {
      state.domain = d.key;
      switchView('library');
      renderDomainTabs();
      renderMaterials();
    });
    container.appendChild(card);
  });
}

/* ---------- 时政要闻 ---------- */
const AFFAIRS_CAT_NAME = { speech: '最新讲话', meeting: '会议决议', media: '权威媒体', current: '时事热点' };
const AFFAIRS_LEVEL_NAME = { 1: '最高层', 2: '中央媒体' };

function initAffairs() {
  const container = $('#affairsFilter');
  container.innerHTML = '';
  AFFAIRS_CATS.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (state.affairsCat === c.key ? ' active' : '');
    btn.textContent = c.name;
    btn.style.setProperty('--fc', c.color);
    btn.addEventListener('click', () => { state.affairsCat = c.key; initAffairs(); });
    container.appendChild(btn);
  });
  renderAffairs();
  renderHomeAffairs();
}

function renderAffairs() {
  let list = AFFAIRS.slice().sort((a, b) => b.date.localeCompare(a.date));
  if (state.affairsCat !== 'all') list = list.filter(a => a.cat === state.affairsCat);
  $('#affairsMeta').textContent = `共 ${list.length} 条${state.affairsCat === 'all' ? '' : ' · ' + AFFAIRS_CAT_NAME[state.affairsCat]}`;
  const container = $('#affairsList');
  container.innerHTML = '';
  list.forEach(a => {
    const cat = AFFAIRS_CATS.find(c => c.key === a.cat);
    const card = document.createElement('div');
    card.className = 'affairs-card cat-' + a.cat;
    card.innerHTML = `
      <div class="mc-top">
        <span class="ac-badge cat-${a.cat}">${AFFAIRS_CAT_NAME[a.cat]}</span>
        <span class="ac-level">${AFFAIRS_LEVEL_NAME[a.level] || '权威来源'}</span>
        <span class="mc-date">${a.date}</span>
      </div>
      <div class="mc-title">${a.title}</div>
      <div class="mc-org">来源：<b>${a.org}</b></div>
      <div class="mc-points">
        <div class="mc-points-head">要点速记</div>
        <ul>${a.points.map(p => `<li>${p}</li>`).join('')}</ul>
      </div>
      <div class="mc-use"><b>申论应用：</b>${a.use}</div>
      <a class="mc-link" href="${a.link.url}" target="_blank" rel="noopener">${a.link.label} ↗</a>`;
    container.appendChild(card);
  });
}

function renderHomeAffairs() {
  const container = $('#homeAffairs');
  if (!container) return;
  container.innerHTML = '';
  const list = AFFAIRS.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  list.forEach(a => {
    const el = document.createElement('div');
    el.className = 'am-item';
    el.innerHTML = `
      <span class="am-tag cat-${a.cat}">${AFFAIRS_CAT_NAME[a.cat]}</span>
      <span class="am-title">${a.title}</span>
      <span class="am-date">${a.date}</span>`;
    el.addEventListener('click', () => switchView('affairs'));
    container.appendChild(el);
  });
}

/* ---------- 材料库 ---------- */
function initLibrary() {
  // 领域标签
  renderDomainTabs();
  // 筛选
  $('#levelFilter').addEventListener('change', e => { state.level = e.target.value; renderMaterials(); });
  $('#typeFilter').addEventListener('change', e => { state.type = e.target.value; renderMaterials(); });
  $('#searchInput').addEventListener('input', e => { state.keyword = e.target.value.trim(); renderMaterials(); });
  $('#prioritySort').addEventListener('change', e => { state.prioritySort = e.target.checked; renderMaterials(); });
  renderMaterials();
}

function renderDomainTabs() {
  const container = $('#domainTabs');
  container.innerHTML = '';
  DOMAINS.forEach(d => {
    const btn = document.createElement('button');
    btn.className = 'domain-tab' + (state.domain === d.key ? ' active' : '');
    btn.textContent = (d.key === 'all' ? '全部领域' : d.name) +
      (d.key === 'all' ? '' : ' (' + MATERIALS.filter(m => m.domain === d.key).length + ')');
    btn.addEventListener('click', () => { state.domain = d.key; renderDomainTabs(); renderMaterials(); });
    container.appendChild(btn);
  });
}

function renderMaterials() {
  let list = MATERIALS.filter(m => {
    if (state.domain !== 'all' && m.domain !== state.domain) return false;
    if (state.level !== 'all' && String(m.level) !== state.level) return false;
    if (state.type !== 'all' && m.type !== state.type) return false;
    if (state.keyword) {
      const text = (m.title + m.org + m.points.join('') + m.use).toLowerCase();
      if (!text.includes(state.keyword.toLowerCase())) return false;
    }
    return true;
  });

  if (state.prioritySort) {
    list.sort((a, b) => a.level - b.level || b.date.localeCompare(a.date));
  } else {
    list.sort((a, b) => b.date.localeCompare(a.date));
  }

  $('#resultMeta').textContent = `共 ${list.length} 份材料` +
    (state.prioritySort ? ' · 已按来源优先级排序（上级在先）' : ' · 按发布时间排序');

  const container = $('#materialList');
  container.innerHTML = '';
  if (list.length === 0) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:#888">没有符合条件的材料，请调整筛选条件。</div>';
    return;
  }

  list.forEach(m => {
    const dom = DOMAINS.find(d => d.key === m.domain);
    const card = document.createElement('div');
    card.className = `material-card lv${m.level}`;
    card.innerHTML = `
      <div class="mc-top">
        <span class="mc-badge lv${m.level}">${LEVEL_NAME[m.level]}</span>
        <span class="mc-domain">${dom.name}</span>
        <span class="mc-type">${m.type}</span>
        <span class="mc-date">${m.date}</span>
      </div>
      <div class="mc-title">${m.title}</div>
      <div class="mc-org">发文机关：<b>${m.org}</b></div>
      <div class="mc-points">
        <div class="mc-points-head">核心要点</div>
        <ul>${m.points.map(p => `<li>${p}</li>`).join('')}</ul>
      </div>
      <div class="mc-use"><b>申论应用：</b>${m.use}</div>
      <div class="mc-actions">
        <a class="mc-link" href="${m.link.url}" target="_blank" rel="noopener">${m.link.label} ↗</a>
        <button class="mc-read-btn${(progress.read || []).includes(m.id) ? ' done' : ''}" data-id="${m.id}">${(progress.read || []).includes(m.id) ? '✓ 已读' : '○ 标记已读'}</button>
      </div>`;
    const rb = $('.mc-read-btn', card);
    rb.addEventListener('click', () => { toggleProgress('read', m.id); renderMaterials(); });
    container.appendChild(card);
  });
}

/* ---------- 热点词 ---------- */
function initHotwords() {
  const cats = ['全部', ...new Set(ALL_WORDS.map(w => w.cat))];
  const totalEl = $('#wordTotalCount');
  if (totalEl) totalEl.textContent = ALL_WORDS.length;
  const container = $('#wordFilter');
  cats.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'domain-tab' + (state.wordCat === c ? ' active' : '');
    btn.textContent = c;
    btn.addEventListener('click', () => {
      state.wordCat = c;
      $$('#wordFilter .domain-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderWords();
    });
    container.appendChild(btn);
  });
  renderWords();
}

function renderWords() {
  const list = ALL_WORDS.filter(w => state.wordCat === '全部' || w.cat === state.wordCat);
  const container = $('#wordGrid');
  container.innerHTML = '';
  list.forEach(w => {
    const card = document.createElement('div');
    card.className = 'word-card';
    card.innerHTML = `
      <div class="word-name">${w.name}<span class="word-cat">${w.cat}</span></div>
      <div class="word-def">${w.def}</div>
      <div class="word-use"><b>应用角度：</b>${w.use}</div>`;
    container.appendChild(card);
  });
}

/* ---------- 每日金句 ---------- */
function initQuotes() {
  const di = dateInfo();
  state.quoteIndex = (di.d - 1) % QUOTES.length;
  // 从本地进度恢复收藏
  if (progress.fav && progress.fav.length) {
    state.favQuotes = new Set(progress.fav.map(i => Number(i)).filter(i => i >= 0 && i < QUOTES.length));
  }
  renderBigQuote();
  renderQuoteLibrary();

  $('#quoteRefresh').addEventListener('click', () => {
    state.quoteIndex = (state.quoteIndex + 1) % QUOTES.length;
    renderBigQuote();
  });
  $('#favQuote').addEventListener('click', () => {
    if (state.favQuotes.has(state.quoteIndex)) {
      state.favQuotes.delete(state.quoteIndex);
      $('#favQuote').textContent = '☆ 收藏本句';
    } else {
      state.favQuotes.add(state.quoteIndex);
      $('#favQuote').textContent = '★ 已收藏';
    }
    progress.fav = Array.from(state.favQuotes);
    saveProgress(progress);
    renderQuoteLibrary();
  });
}

function renderBigQuote() {
  const q = QUOTES[state.quoteIndex];
  $('#bigQuoteText').textContent = q.text;
  $('#bigQuoteSource').textContent = '—— ' + q.source;
  $('#bigQuoteUse').textContent = '申论应用：' + q.use;
  $('#favQuote').textContent = state.favQuotes.has(state.quoteIndex) ? '★ 已收藏' : '☆ 收藏本句';
}

function renderQuoteLibrary() {
  const container = $('#quoteLibrary');
  container.innerHTML = '';
  QUOTES.forEach((q, i) => {
    const item = document.createElement('div');
    item.className = 'ql-item' + (state.favQuotes.has(i) ? ' fav' : '');
    item.innerHTML = `
      ${state.favQuotes.has(i) ? '<span class="ql-star">★</span>' : ''}
      <div>${q.text}</div>
      <div class="ql-src">—— ${q.source}</div>`;
    item.addEventListener('click', () => { state.quoteIndex = i; renderBigQuote(); });
    container.appendChild(item);
  });
  $('#favCount').textContent = `共 ${QUOTES.length} 条 · 已收藏 ${state.favQuotes.size} 条`;
}

/* ---------- 理论学习日课 ---------- */
function initStudy() {
  const di = dateInfo();
  state.selectedDay = di.d;

  $$('#studySwitch .sw-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.studyTab = btn.dataset.tab;
      $$('#studySwitch .sw-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderStudy();
    });
  });

  $('#prevDay').addEventListener('click', () => {
    const days = daysInMonth(di.y, di.m);
    state.selectedDay = state.selectedDay > 1 ? state.selectedDay - 1 : days;
    renderStudy();
  });
  $('#nextDay').addEventListener('click', () => {
    const days = daysInMonth(di.y, di.m);
    state.selectedDay = state.selectedDay < days ? state.selectedDay + 1 : 1;
    renderStudy();
  });

  renderStudy();
}

function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

function renderStudy() {
  const di = dateInfo();
  const days = daysInMonth(di.y, di.m);
  const dataArr = state.studyTab === 'outline' ? OUTLINE_DAYS : QA_DAYS;
  const idx = (state.selectedDay - 1) % dataArr.length;
  const item = dataArr[idx];

  $('#studyDayNum').textContent = state.selectedDay;
  $('#studyBadge').textContent = item.badge;
  $('#studyTitle').textContent = item.title;
  $('#studyBody').textContent = item.body;
  $('#studyPoints').innerHTML = `
    <div class="study-points-head">要点速记</div>
    <ul>${item.points.map(p => `<li>${p}</li>`).join('')}</ul>`;

  // 标记已学（按 tab + 课程序号存唯一 id）
  const doneKey = (state.studyTab === 'outline' ? 'o-' : 'q-') + idx;
  const doneBtn = $('#studyDoneBtn');
  if (doneBtn) {
    const isDone = (progress.studied || []).includes(doneKey);
    doneBtn.textContent = isDone ? '● 本课已学（点击取消）' : '○ 标记本课已学';
    doneBtn.classList.toggle('done', isDone);
    doneBtn.onclick = () => {
      toggleProgress('studied', doneKey);
      renderStudy();
    };
  }

  renderCalendar(di, days);
}

function renderCalendar(di, days) {
  $('#calTitle').textContent = `${di.y}年${di.m}月 · 学习日历`;
  const firstWeek = new Date(di.y, di.m - 1, 1).getDay();
  const container = $('#calendar');
  container.innerHTML = '';
  ['日','一','二','三','四','五','六'].forEach(w => {
    const el = document.createElement('div');
    el.className = 'cal-week'; el.textContent = w;
    container.appendChild(el);
  });
  for (let i = 0; i < firstWeek; i++) {
    const el = document.createElement('div');
    el.className = 'cal-cell empty';
    container.appendChild(el);
  }
  for (let d = 1; d <= days; d++) {
    const el = document.createElement('div');
    let cls = 'cal-cell ';
    if (d === di.d) cls += 'today ';
    else if (d < di.d) cls += 'done ';
    else cls += 'future ';
    if (d === state.selectedDay) cls += 'selected';
    el.className = cls;
    el.textContent = d;
    el.addEventListener('click', () => { state.selectedDay = d; renderStudy(); });
    container.appendChild(el);
  }
}

/* ---------- 主题·精神分类 ---------- */
function initTopics() {
  // 主题卡片
  const tg = $('#themeGrid');
  tg.innerHTML = '';
  THEMES.forEach(t => {
    const docCount = MATERIALS.filter(m => (MATERIAL_TAGS[m.id]?.themes || []).includes(t.key)).length;
    const affCount = AFFAIRS.filter(a => (AFFAIR_TAGS[a.id]?.themes || []).includes(t.key)).length;
    const total = docCount + affCount;
    const max = 12;
    const card = document.createElement('div');
    card.className = 'theme-card' + (state.themeSel === t.key ? ' selected' : '');
    card.innerHTML = `
      <div class="tc-icon" style="background:${t.color}">${t.icon}</div>
      <div class="tc-name">${t.name}</div>
      <div class="tc-count">材料 ${docCount} 份 · 时政 ${affCount} 条</div>
      <div class="tc-bar"><i style="width:${Math.min(100, total / max * 100)}%;background:${t.color}"></i></div>`;
    card.addEventListener('click', () => {
      state.themeSel = state.themeSel === t.key ? null : t.key;
      state.spiritSel = null;
      renderTopicSelection();
    });
    tg.appendChild(card);
  });

  // 精神卡片
  const sg = $('#spiritGrid');
  sg.innerHTML = '';
  SPIRITS.forEach(s => {
    const docCount = MATERIALS.filter(m => (MATERIAL_TAGS[m.id]?.spirits || []).includes(s.key)).length;
    const affCount = AFFAIRS.filter(a => (AFFAIR_TAGS[a.id]?.spirits || []).includes(s.key)).length;
    const card = document.createElement('div');
    card.className = 'spirit-card' + (state.spiritSel === s.key ? ' selected' : '');
    card.style.borderLeftColor = s.color;
    card.innerHTML = `
      <div class="sp-card-name">${s.name}</div>
      <div class="sp-card-desc">${s.desc}</div>
      <div class="sp-card-count">关联材料 ${docCount} 份 · 时政 ${affCount} 条</div>`;
    card.addEventListener('click', () => {
      state.spiritSel = state.spiritSel === s.key ? null : s.key;
      state.themeSel = null;
      renderTopicSelection();
    });
    sg.appendChild(card);
  });

  $('#topicDetailClose').addEventListener('click', () => {
    state.themeSel = null; state.spiritSel = null; renderTopicSelection();
  });
}

function renderTopicSelection() {
  $$('#themeGrid .theme-card').forEach((el, i) => el.classList.toggle('selected', THEMES[i].key === state.themeSel));
  $$('#spiritGrid .spirit-card').forEach((el, i) => el.classList.toggle('selected', SPIRITS[i].key === state.spiritSel));
  const panel = $('#topicDetailPanel');
  const key = state.themeSel || state.spiritSel;
  if (!key) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  const isTheme = !!state.themeSel;
  const obj = isTheme ? THEMES.find(t => t.key === key) : SPIRITS.find(s => s.key === key);
  $('#topicDetailTitle').textContent = `${obj.name} · 关联内容`;
  const field = isTheme ? 'themes' : 'spirits';
  const docs = MATERIALS.filter(m => (MATERIAL_TAGS[m.id]?.[field] || []).includes(key));
  const affs = AFFAIRS.filter(a => (AFFAIR_TAGS[a.id]?.[field] || []).includes(key)).sort((a,b)=>b.date.localeCompare(a.date));
  let html = '';
  affs.forEach(a => {
    html += `<div class="td-item"><span class="td-kind">时政·${AFFAIRS_CAT_NAME_T[catOfA(a)] || ''}</span><span class="td-title">${a.title}</span><span class="td-date">${a.date}</span><a href="${a.link.url}" target="_blank" rel="noopener">原文↗</a></div>`;
  });
  docs.forEach(m => {
    const dom = DOMAINS.find(d => d.key === m.domain);
    html += `<div class="td-item"><span class="td-kind doc">${dom ? dom.name : '材料'}</span><span class="td-title">${m.title}</span><span class="td-date">${m.date}</span><a href="${m.link.url}" target="_blank" rel="noopener">原文↗</a></div>`;
  });
  $('#topicDetailList').innerHTML = html || '<p class="muted">暂无关联内容</p>';
}
function catOfA(a) { return a.cat; }
const AFFAIRS_CAT_NAME_T = { speech: '讲话', meeting: '决议', media: '媒体', current: '时事' };

/* ---------- 数据统计看板 ---------- */
function barChart(el, data, max) {
  el.innerHTML = data.map(d => `
    <div class="bar-row">
      <div class="bar-label" title="${d.name}">${d.name}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${max ? (d.value / max * 100) : 0}%;background:${d.color}"><span>${d.value}</span></div></div>
      <div class="bar-num">${d.suffix || ''}</div>
    </div>`).join('');
}

function donutChart(el, data) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = 54, c = 2 * Math.PI * r;
  let offset = 0;
  const circles = data.map(d => {
    const len = d.value / total * c;
    const seg = `<circle cx="75" cy="75" r="${r}" fill="none" stroke="${d.color}" stroke-width="18"
      stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 75 75)"></circle>`;
    offset += len;
    return seg;
  }).join('');
  const legend = data.map(d => `
    <div class="dl-row"><span class="dl-dot" style="background:${d.color}"></span><span class="dl-name">${d.name}</span><span class="dl-val">${d.value} (${Math.round(d.value/total*100)}%)</span></div>`).join('');
  el.innerHTML = `<div class="donut-wrap"><svg class="donut" viewBox="0 0 150 150">
    <circle cx="75" cy="75" r="${r}" fill="none" stroke="#eee" stroke-width="18"></circle>
    ${circles}
    <text x="75" y="70" text-anchor="middle" font-size="20" font-weight="700" fill="#7d1414">${total}</text>
    <text x="75" y="88" text-anchor="middle" font-size="10" fill="#888">条目</text>
  </svg><div class="donut-legend">${legend}</div></div>`;
}

function initStats() {
  // 概览数字
  const lvCount = { 1: MATERIALS.filter(m=>m.level===1).length, 2: MATERIALS.filter(m=>m.level===2).length, 3: MATERIALS.filter(m=>m.level===3).length };
  const cards = [
    { num: MATERIALS.length + AFFAIRS.length, lbl: '总条目' },
    { num: MATERIALS.length, lbl: '政策公文' },
    { num: AFFAIRS.length, lbl: '时政要闻' },
    { num: THEMES.length, lbl: '政策主题' },
    { num: ALL_WORDS.length, lbl: '关键词' },
    { num: SPIRITS.length, lbl: '思想精神' }
  ];
  $('#statCards').innerHTML = cards.map(c => `<div class="stat-box"><div class="num">${c.num}</div><div class="lbl">${c.lbl}</div></div>`).join('');

  // 五位一体分布
  const domData = DOMAINS.filter(d=>d.key!=='all').map(d => ({
    name: d.name, value: MATERIALS.filter(m=>m.domain===d.key).length, color: d.color
  }));
  barChart($('#chartDomain'), domData, Math.max(...domData.map(d=>d.value)));

  // 来源层级
  const levelData = [
    { name: '中共中央/国务院', value: lvCount[1], color: '#9c1c1c' },
    { name: '中央部委', value: lvCount[2], color: '#2c5d8f' },
    { name: '省级政府', value: lvCount[3], color: '#3a7d55' }
  ].filter(d=>d.value>0);
  donutChart($('#chartLevel'), levelData);

  // 主题覆盖
  const themeData = THEMES.map(t => ({
    name: t.name,
    value: MATERIALS.filter(m=>(MATERIAL_TAGS[m.id]?.themes||[]).includes(t.key)).length +
           AFFAIRS.filter(a=>(AFFAIR_TAGS[a.id]?.themes||[]).includes(t.key)).length,
    color: t.color
  })).sort((a,b)=>b.value-a.value);
  barChart($('#chartTheme'), themeData, Math.max(...themeData.map(d=>d.value)));

  // 精神频次
  const spiritData = SPIRITS.map(s => ({
    name: s.name,
    value: MATERIALS.filter(m=>(MATERIAL_TAGS[m.id]?.spirits||[]).includes(s.key)).length +
           AFFAIRS.filter(a=>(AFFAIR_TAGS[a.id]?.spirits||[]).includes(s.key)).length,
    color: s.color
  })).sort((a,b)=>b.value-a.value);
  barChart($('#chartSpirit'), spiritData, Math.max(...spiritData.map(d=>d.value)));

  // 时政分类占比
  const affData = AFFAIRS_CATS.filter(c=>c.key!=='all').map(c => ({
    name: c.name, value: AFFAIRS.filter(a=>a.cat===c.key).length, color: c.color
  }));
  donutChart($('#chartAffair'), affData);

  // 文种结构
  const typeMap = {};
  MATERIALS.forEach(m => typeMap[m.type] = (typeMap[m.type]||0)+1);
  const typeData = Object.entries(typeMap).map(([name,value],i) => ({
    name, value, color: ['#9c1c1c','#2c5d8f','#3a7d55','#d68910','#8e44ad','#c0392b','#5d6d7e','#b8912f'][i%8]
  })).sort((a,b)=>b.value-a.value);
  barChart($('#chartType'), typeData, Math.max(...typeData.map(d=>d.value)));

  // 词云
  const catColor = { '经济':'#c0392b','理论':'#9c1c1c','社会':'#2c5d8f','政治':'#8e44ad','生态':'#3a7d55','安全':'#5d6d7e','文化':'#d68910' };
  const cloud = ALL_WORDS.slice().sort((a,b)=>b.weight-a.weight);
  $('#wordCloud').innerHTML = cloud.map(w => {
    const size = 12 + w.weight * 2.2;
    return `<span class="wc-word" style="font-size:${size}px;color:${catColor[w.cat]||'#7d1414'}" title="${w.def.slice(0,60)}…">${w.name}</span>`;
  }).join('');

  // 排行 TOP15
  const ranked = ALL_WORDS.slice().sort((a,b)=>b.weight-a.weight).slice(0,15);
  $('#wordRank').innerHTML = ranked.map((w,i) => `
    <div class="wr-row"><span class="wr-rank">${i+1}</span><span class="wr-name">${w.name}</span><span class="wr-cat">${w.cat}</span><span class="wr-w">${w.weight}</span></div>`).join('');
}

/* ---------- 导航中心 ---------- */
const NAV_GROUPS = [
  { el: '#navGroup1', items: [
    { view: 'home', name: '今日概览', icon: '◎', color: '#9c1c1c', count: '', desc: '每日金句、当日理论日课与五位一体入口，快速进入学习状态。' },
    { view: 'push', name: '每日推送存档', icon: '▦', color: '#c0392b', count: (typeof PUSH_ARCHIVE !== 'undefined' ? PUSH_ARCHIVE.length : 0) + ' 份', desc: '每天12:00的复习卡片按日期倒序存档，随时回看任意一天的完整推送。' },
    { view: 'progress', name: '学习进度打卡', icon: '◐', color: '#16a085', count: '', desc: '自动记录已学日课、已读材料与收藏金句，本机保存，形成复习闭环。' }
  ]},
  { el: '#navGroup2', items: [
    { view: 'affairs', name: '时政要闻速览', icon: '◉', color: '#c0392b', count: AFFAIRS.length + ' 条', desc: '习近平最新讲话、中央全会与人大决议、权威媒体文章、APEC等时事。' },
    { view: 'library', name: '五位一体材料库', icon: '▤', color: '#2c5d8f', count: MATERIALS.length + ' 份', desc: '经济/政治/文化/社会/生态五类公文，支持层级、文种筛选与搜索。' },
    { view: 'topics', name: '主题·精神分类', icon: '◈', color: '#8e44ad', count: THEMES.length + '主题·' + SPIRITS.length + '精神', desc: '按政策主题与思想精神两条主线横向梳理，点击卡片看关联内容。' },
    { view: 'stats', name: '数据统计看板', icon: '▧', color: '#d68910', count: '6 图表', desc: '领域/层级/主题/精神/时政/文种分布图，关键词词云与热度排行。' },
    { view: 'timeline', name: '政策时间轴', icon: '⌁', color: '#2980b9', count: (MATERIALS.length + AFFAIRS.length) + ' 条', desc: '公文与时政按发布时间倒序排列，看清政策演进脉络与最新动向。' },
    { view: 'hotwords', name: '申论热点词', icon: '✦', color: '#c0392b', count: ALL_WORDS.length + ' 词', desc: '高频考点词的内涵释义与作答应用角度，助力规范表达。' },
    { view: 'quotes', name: '每日金句', icon: '❝', color: '#b8912f', count: QUOTES.length + ' 条', desc: '按日轮换的经典论述，可收藏，用于开头结尾与论证。' }
  ]},
  { el: '#navGroup4', items: [
    { view: 'mil', name: '军转特色专题', icon: '✦', color: '#9c1c1c', count: MIL_DATA.length + ' 条', desc: '退役军人保障、强军思想、双拥与国防，普通公考资料中没有的加分点。' },
    { view: 'bj', name: '北京市情专题', icon: '▣', color: '#2c5d8f', count: BJ_DATA.length + ' 条', desc: '四个中心、十五五规划、接诉即办、七有五性、京津冀协同。' },
    { view: 'skills', name: '申论技法与真题', icon: '✎', color: '#b8912f', count: SKILLS_DATA.length + ' 讲', desc: '五大题型答题框架、真题特点与范文研读，从素材到分数的桥。' },
    { view: 'express', name: '规范表达句式库', icon: '❞', color: '#8e44ad', count: EXPRESS_DATA.length + ' 类', desc: '开头/过渡/对策/结尾句式、口语转公文，军转与北京专属表达。' }
  ]},
  { el: '#navGroup3', items: [
    { view: 'study', name: '纲要·问答日课', icon: '◷', color: '#3a7d55', count: (OUTLINE_DAYS.length + QA_DAYS.length) + ' 课', desc: '《学习纲要2023版》与《学习问答》按月循环，每天学一点。' },
    { view: 'about', name: '使用说明', icon: 'ⓘ', color: '#5d6d7e', count: '', desc: '资料定位、来源与优先级规则、军转申论重点掌握清单。' }
  ]}
];

const VIEW_NAME = {
  home: '今日概览', nav: '导航中心', push: '每日推送存档', affairs: '时政要闻', library: '材料库',
  topics: '主题分类', stats: '统计看板', timeline: '政策时间轴', hotwords: '热点词',
  quotes: '金句', mil: '军转特色', bj: '北京市情', skills: '申论技法',
  express: '规范表达', progress: '学习进度', study: '理论日课', about: '使用说明'
};

function initNavCenter() {
  const di = dateInfo();
  const chip = $('#navDateChip');
  if (chip) chip.textContent = di.full;

  NAV_GROUPS.forEach(g => {
    const container = $(g.el);
    if (!container) return;
    container.innerHTML = '';
    g.items.forEach(it => {
      const card = document.createElement('div');
      card.className = 'nav-card';
      card.innerHTML = `
        <div class="nc-icon" style="background:${it.color}">${it.icon}</div>
        <div class="nc-body">
          <div class="nc-name">${it.name}${it.count ? `<span class="nc-count">${it.count}</span>` : ''}</div>
          <div class="nc-desc">${it.desc}</div>
        </div>
        <span class="nc-arrow">→</span>`;
      card.addEventListener('click', () => switchView(it.view));
      container.appendChild(card);
    });
  });

  // 全站搜索
  const input = $('#globalSearch');
  const results = $('#globalSearchResults');
  const clearBtn = $('#nsClear');
  const buildIndex = () => {
    const idx = [];
    NAV_GROUPS.forEach(g => g.items.forEach(it => idx.push({ kind: 'view', label: '栏目', name: it.name, view: it.view, kw: it.name + it.desc })));
    ALL_WORDS.forEach(w => idx.push({ kind: 'word', label: '热点词', name: w.name, view: 'hotwords', kw: w.name + w.def, def: w.def }));
    MATERIALS.forEach(m => idx.push({ kind: 'material', label: '公文', name: m.title, view: 'library', domain: m.domain, kw: m.title + m.org + m.points.join('') }));
    AFFAIRS.forEach(a => idx.push({ kind: 'affair', label: '时政', name: a.title, view: 'affairs', kw: a.title + a.points.join('') }));
    QUOTES.forEach(q => idx.push({ kind: 'quote', label: '金句', name: q.text.slice(0, 40), view: 'quotes', kw: q.text + q.source }));
    return idx;
  };
  const index = buildIndex();
  const escHtml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const highlight = (text, kw) => {
    const t = escHtml(text);
    if (!kw) return t;
    const safe = escHtml(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return t.replace(new RegExp(safe, 'gi'), m => `<mark>${m}</mark>`);
  };
  const kindClass = { view: 'k-view', word: 'k-word', material: 'k-material', affair: 'k-affair', quote: 'k-view' };

  // 搜索模式：site=站内（搜本网页已发布内容），web=全网（跳转到搜索引擎）
  let searchMode = 'site';
  const modeBox = $('#nsMode');
  const webTip = $('#nsWebTip');
  if (modeBox) {
    modeBox.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        modeBox.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        searchMode = btn.dataset.mode;
        input.placeholder = searchMode === 'site'
          ? '搜索本网页已发布的内容：栏目、热点词、政策文件、时政要闻…（如：新质生产力、APEC、就业）'
          : '输入关键词，按回车全网搜索（如：2026年北京市军转安置政策）';
        if (webTip) webTip.classList.toggle('show', searchMode === 'web');
        results.classList.remove('show'); results.innerHTML = '';
        if (kwVal()) doSearch();
      });
    });
  }
  const kwVal = () => input.value.trim();

  const doSearch = () => {
    const kw = input.value.trim();
    clearBtn.classList.toggle('show', !!kw);
    if (!kw) { results.classList.remove('show'); results.innerHTML = ''; return; }
    if (searchMode === 'web') { results.classList.remove('show'); return; }
    const lower = kw.toLowerCase();
    let matches = index.filter(it => it.kw.toLowerCase().includes(lower));
    // 栏目优先，其余按相关度（名称命中靠前）
    matches.sort((a, b) => {
      const an = a.name.toLowerCase().includes(lower) ? 0 : 1;
      const bn = b.name.toLowerCase().includes(lower) ? 0 : 1;
      return an - bn;
    });
    matches = matches.slice(0, 30);
    if (!matches.length) {
      results.innerHTML = '<div class="nsr-empty">未找到相关内容，换个关键词试试</div>';
    } else {
      results.innerHTML = matches.map((it, i) => `
        <div class="nsr-item" data-i="${i}">
          <span class="nsr-kind ${kindClass[it.kind]}">${it.label}</span>
          <span class="nsr-title">${highlight(it.name, kw)}</span>
          <span class="nsr-hint">${VIEW_NAME[it.view] || ''} →</span>
        </div>`).join('');
      results.querySelectorAll('.nsr-item').forEach(el => {
        el.addEventListener('click', () => {
          const it = matches[Number(el.dataset.i)];
          if (it.domain) { state.domain = it.domain; }
          switchView(it.view);
          if (it.view === 'library') { renderDomainTabs(); renderMaterials(); }
          input.value = ''; results.classList.remove('show'); clearBtn.classList.remove('show');
        });
      });
    }
    results.classList.add('show');
  };
  input.addEventListener('input', doSearch);
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { input.value = ''; doSearch(); input.blur(); }
    if (e.key === 'Enter') {
      const kw = input.value.trim();
      if (!kw) return;
      if (searchMode === 'web') {
        window.open('https://www.bing.com/search?q=' + encodeURIComponent(kw), '_blank', 'noopener');
      } else if (results.classList.contains('show') && results.querySelector('.nsr-item')) {
        results.querySelector('.nsr-item').click();
      }
    }
  });
  clearBtn.addEventListener('click', () => { input.value = ''; doSearch(); input.focus(); });
}

/* ---------- 每日推送存档 ---------- */
function initPush() {
  const list = $('#pushArchiveList');
  const meta = $('#pushMeta');
  if (!list) return;
  const archive = (typeof PUSH_ARCHIVE !== 'undefined' && Array.isArray(PUSH_ARCHIVE)) ? PUSH_ARCHIVE : [];
  // 动态提取当前页面的分享码，拼到推送链接；本地打开时无分享码则留空
  const sc = new URLSearchParams(location.search).get('sharecode');
  const suffix = sc ? ('?sharecode=' + encodeURIComponent(sc)) : '';
  if (meta) meta.innerHTML = `共 <b>${archive.length}</b> 份存档 · 每天 12:00 自动新增 · 点击卡片查看当日完整推送`;
  if (!archive.length) {
    list.innerHTML = '<div class="notice-bar" style="margin-top:14px">暂无存档，明天 12:00 首份推送生成后将自动出现在这里。</div>';
    return;
  }
  list.innerHTML = archive.map((a, i) => {
    const tag = i === 0 ? '<span class="pa-new">最新</span>' : '';
    const today = (typeof dateInfo === 'function') ? dateInfo() : null;
    const isToday = today && `${today.y}-${String(today.m).padStart(2,'0')}-${String(today.d).padStart(2,'0')}` === a.date;
    return `<a class="push-card${isToday ? ' is-today' : ''}" href="${a.file}${suffix}" target="_blank" rel="noopener">
      <div class="pa-date">
        <div class="pa-day">${a.d}</div>
        <div class="pa-ym">${a.y}.${String(a.m).padStart(2,'0')}</div>
      </div>
      <div class="pa-body">
        <div class="pa-title">${a.label}${tag}${isToday ? '<span class="pa-today">今天</span>' : ''}</div>
        <div class="pa-desc">当日金句 · 理论日课 · 时政要闻 · 全量公文 · 热点词，一键回顾</div>
      </div>
      <div class="pa-open">查看推送 ↗</div>
    </a>`;
  }).join('');
}

/* ---------- 返回顶部 ---------- */
function initBackTop() {
  const btn = $('#backTop');
  const main = $('.main');
  const onScroll = () => {
    const top = main && main.scrollTop !== undefined ? main.scrollTop : (document.documentElement.scrollTop || window.scrollY);
    btn.classList.toggle('show', top > 240);
  };
  if (main) main.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  btn.addEventListener('click', () => {
    if (main && main.scrollTop !== undefined) main.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  onScroll();
}

/* ---------- 进度存储（localStorage） ---------- */
const PROG_KEY = 'juanguan_shenlun_progress_v1';
function loadProgress() {
  try {
    return Object.assign({ studied: [], read: [], fav: [] }, JSON.parse(localStorage.getItem(PROG_KEY) || '{}'));
  } catch (e) { return { studied: [], read: [], fav: [] }; }
}
function saveProgress(p) {
  try { localStorage.setItem(PROG_KEY, JSON.stringify(p)); } catch (e) {}
}
let progress = loadProgress();
function toggleProgress(kind, id) {
  const arr = progress[kind] || (progress[kind] = []);
  const i = arr.indexOf(id);
  if (i >= 0) arr.splice(i, 1); else arr.push(id);
  saveProgress(progress);
  if (typeof renderProgress === 'function') renderProgress();
  return i < 0;
}

/* ---------- 军转特色 & 北京市情 ---------- */
function renderSpecialList(container, items, isBJ) {
  const box = $(container);
  if (!box) return;
  box.className = 'panel mt special-list';
  box.innerHTML = items.map(x => `
    <div class="special-card${isBJ ? ' bj' : ''}" data-id="${x.id}">
      <div class="sc-head">
        <span class="sc-level">${x.level}</span>
        <span class="sc-tag">${x.tag}</span>
        <span class="sc-date">${x.date}</span>
      </div>
      <div class="sc-title">${x.title}</div>
      <div class="mc-points executive">${x.points.map(p => '· ' + p).join('<br>')}</div>
      <div class="sc-use"><b>申论应用：</b>${x.use}</div>
      <a class="sc-link" href="${x.link.url}" target="_blank" rel="noopener">${x.link.label} ↗</a>
    </div>`).join('');
}
/* ---------- 栏目限时提示（到 2026-11-20 24点自动消失） ---------- */
const PAGE_NOTICE = {
  start: '2026-11-19',
  end: '2026-11-20',
  mil: '🆕 更新提示：<b>军转特色专题</b>已新增"北京军转考核考情"系列内容（统考笔试 · 直通安置 · 双选与面试 · 历年名额岗位 · 各区成绩公示，共5条，含官方公告原文链接），下拉即可查看。本提示展示2天。',
  skills: '⏸ 更新提示：<b>申论技法与真题</b>栏目暂停更新（现有7讲内容可正常学习），恢复时间另行通知。本提示展示2天。'
};
function pageNoticeHtml(key) {
  if (!PAGE_NOTICE[key]) return '';
  const d = dateInfo();
  const ymd = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  return (ymd >= PAGE_NOTICE.start && ymd <= PAGE_NOTICE.end)
    ? `<div class="notice-bar" style="margin-bottom:14px"><span>${PAGE_NOTICE[key]}</span></div>` : '';
}
function initMil() { renderSpecialList('#milList', MIL_DATA, false); const box = $('#milList'); if (box) box.insertAdjacentHTML('beforebegin', pageNoticeHtml('mil')); }
function initBj() { renderSpecialList('#bjList', BJ_DATA, true); }

/* ---------- 申论技法 ---------- */
function initSkills() {
  const box = $('#skillsList');
  if (!box) return;
  box.insertAdjacentHTML('beforebegin', pageNoticeHtml('skills'));
  box.className = 'panel mt';
  box.innerHTML = SKILLS_DATA.map(s => `
    <div class="skill-card">
      <div class="sk-head"><span class="sk-type">${s.type}</span><span class="sk-title">${s.title}</span></div>
      <div class="sk-desc">${s.desc}</div>
      <div class="sk-steps">${s.framework.map((f, i) => `<div class="sk-step"><span class="n">${i + 1}</span><div><b>${f.step}：</b>${f.detail}</div></div>`).join('')}</div>
      <div class="sk-template"><b>参考句式：</b>${s.template}</div>
      <div class="sk-tips"><b>提分提示</b><ul>${s.tips.map(t => `<li>${t}</li>`).join('')}</ul></div>
    </div>`).join('');
}

/* ---------- 规范表达 ---------- */
function initExpress() {
  const box = $('#expressList');
  if (!box) return;
  box.className = 'panel mt';
  box.innerHTML = EXPRESS_DATA.map(e => `
    <div class="expr-card">
      <div class="ex-head"><span class="ex-scene">${e.scene}</span><span class="ex-title">${e.title}</span></div>
      <div class="ex-rows">${e.items.map(it => `<div class="ex-row"><span class="lb">${it.label}</span><span class="tx">${it.text}</span></div>`).join('')}</div>
      <div class="ex-note">${e.note}</div>
    </div>`).join('');
}

/* ---------- 政策时间轴 ---------- */
function initTimeline() {
  const box = $('#timelineList');
  if (!box) return;
  box.className = 'panel mt';
  const items = [];
  MATERIALS.forEach(m => items.push({ date: m.date, kind: '公文', title: m.title, org: m.org, url: m.link && m.link.url, cls: '' }));
  AFFAIRS.forEach(a => items.push({ date: a.date, kind: AFFAIRS_CAT_NAME[a.cat] || '时政', title: a.title, org: a.org, url: a.link && a.link.url, cls: 'tl-affair' }));
  items.sort((a, b) => b.date.localeCompare(a.date));
  box.innerHTML = `<div class="timeline-wrap">${items.map(it => `
    <div class="tl-item ${it.cls}">
      <div class="tl-meta"><span class="tl-kind">${it.kind}</span><span class="tl-date">${it.date}</span><span class="tl-org">${it.org}</span></div>
      <div class="tl-title">${it.url ? `<a href="${it.url}" target="_blank" rel="noopener">${it.title} ↗</a>` : it.title}</div>
    </div>`).join('')}</div>`;
}

/* ---------- 进度看板 ---------- */
function ringSvg(done, total, color) {
  const pct = total ? Math.round(done / total * 100) : 0;
  const r = 32, c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return `<svg class="pg-ring" viewBox="0 0 80 80">
    <circle cx="40" cy="40" r="${r}" fill="none" stroke="#eee" stroke-width="7"/>
    <circle cx="40" cy="40" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 40 40)"/>
    <text x="40" y="45" text-anchor="middle" font-size="16" font-weight="700" fill="#2b2b2b">${pct}%</text>
  </svg>`;
}
function renderProgress() {
  const box = $('#progressPanel');
  if (!box) return;
  box.className = 'panel mt';
  const outlineTotal = OUTLINE_DAYS.length, qaTotal = QA_DAYS.length, quoteTotal = QUOTES.length, matTotal = MATERIALS.length;
  const studiedO = progress.studied.filter(x => x.startsWith('o-')).length;
  const studiedQ = progress.studied.filter(x => x.startsWith('q-')).length;
  box.innerHTML = `
    <div class="progress-grid">
      <div class="pg-box">${ringSvg(studiedO, outlineTotal, '#9c1c1c')}<div class="pg-label">纲要日课</div><div class="pg-sub">已学 ${studiedO} / ${outlineTotal} 课</div></div>
      <div class="pg-box">${ringSvg(studiedQ, qaTotal, '#8e44ad')}<div class="pg-label">问答日课</div><div class="pg-sub">已学 ${studiedQ} / ${qaTotal} 课</div></div>
      <div class="pg-box">${ringSvg(progress.fav.length, quoteTotal, '#b8912f')}<div class="pg-label">金句收藏</div><div class="pg-sub">已收藏 ${progress.fav.length} / ${quoteTotal} 条</div></div>
      <div class="pg-box">${ringSvg(progress.read.length, matTotal, '#2c5d8f')}<div class="pg-label">公文已读</div><div class="pg-sub">已读 ${progress.read.length} / ${matTotal} 份</div></div>
    </div>
    <div class="pg-detail">
      <p>学习记录保存在<b>本机浏览器</b>，刷新或离线打开都不丢失，换设备不共享。</p>
      <p>在<b>每日金句</b>页点击收藏、在<b>材料库</b>点击"标记已读"、在<b>理论日课</b>点击"标记已学"，进度会自动同步到这里。</p>
    </div>
    <div class="pg-actions">
      <button class="pg-btn" id="pgGoStudy">去学习日课</button>
      <button class="pg-btn" id="pgGoQuotes">去金句页</button>
      <button class="pg-btn" id="pgGoLib">去材料库</button>
      <button class="pg-btn danger" id="pgReset">清空进度</button>
    </div>`;
  $('#pgGoStudy').addEventListener('click', () => switchView('study'));
  $('#pgGoQuotes').addEventListener('click', () => switchView('quotes'));
  $('#pgGoLib').addEventListener('click', () => switchView('library'));
  $('#pgReset').addEventListener('click', () => {
    progress = { studied: [], read: [], fav: [] };
    saveProgress(progress);
    renderProgress();
  });
}
function initProgress() { renderProgress(); }

/* ---------- 启动 ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initNavCenter();
  initPush();
  initBackTop();
  initHome();
  initAffairs();
  initLibrary();
  initTopics();
  initStats();
  initTimeline();
  initMil();
  initBj();
  initSkills();
  initExpress();
  initProgress();
  initHotwords();
  initQuotes();
  initStudy();
  // 本机访问计数（静态网页无服务器，本地浏览器统计）
  (function initHitCount() {
    const el = document.getElementById('hitCount');
    if (!el) return;
    try {
      const n = (Number(localStorage.getItem('jy_sm_hits')) || 0) + 1;
      localStorage.setItem('jy_sm_hits', String(n));
      el.textContent = n;
    } catch (e) { el.textContent = '—'; }
  })();
  // 进页弹出更新提示对话框：7秒自动关闭或手动关闭（仅提示期内显示）
  initNoticeModal();
  // 最后按地址栏恢复视图（刷新/从原文链接返回时停留在原栏目）
  initHashNav();
});

/* ---------- 进页弹出对话框（更新提示，7秒自动关闭/手动关闭） ---------- */
function initNoticeModal() {
  if (!pageNoticeHtml('mil')) return; // 不在提示期内则不弹
  const overlay = document.createElement('div');
  overlay.id = 'noticeModalOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  const content = [PAGE_NOTICE.mil, PAGE_NOTICE.skills].filter(Boolean).map(t => `<div style="font-size:13.5px;line-height:1.9;color:#4a3a20;background:#fbf4e6;border:1px solid #ead9b4;border-radius:10px;padding:14px 16px;margin-top:10px"><span>${t}</span></div>`).join('');
  overlay.innerHTML = `
    <div id="noticeModalBox" style="max-width:460px;width:100%;background:#fff;border-radius:14px;padding:22px 22px 18px;box-shadow:0 12px 40px rgba(0,0,0,.25);position:relative">
      <div style="font-size:16px;font-weight:700;color:#9c1c1c">📢 更新提示</div>
      ${content}
      <div style="margin-top:16px;display:flex;align-items:center;justify-content:space-between">
        <span id="noticeCountdown" style="font-size:12px;color:#999">7 秒后自动关闭</span>
        <button id="noticeModalClose" style="background:#9c1c1c;color:#fff;border:none;border-radius:20px;padding:8px 26px;font-size:13px;font-weight:700;cursor:pointer">我知道了</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  let left = 7;
  const timer = setInterval(() => {
    left -= 1;
    const cd = document.getElementById('noticeCountdown');
    if (!cd) { clearInterval(timer); return; }
    if (left <= 0) { clearInterval(timer); closeNoticeModal(); }
    else cd.textContent = left + ' 秒后自动关闭';
  }, 1000);
  function closeNoticeModal() {
    clearInterval(timer);
    const el = document.getElementById('noticeModalOverlay');
    if (el) el.remove();
  }
  overlay.__closeNotice = closeNoticeModal;
  document.getElementById('noticeModalClose').addEventListener('click', closeNoticeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeNoticeModal(); });
}
