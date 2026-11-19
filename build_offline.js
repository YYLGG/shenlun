/* 打包成自包含单文件 HTML：内联 CSS + 全部 JS 数据 + 推送归档页（base64 内嵌，Blob 打开） */
const fs = require('fs');
const path = require('path');
const base = __dirname;
const read = f => fs.readFileSync(path.join(base, f), 'utf8');
const escScript = s => s.replace(/<\/script>/gi, '<\\/script>');
// 用函数形式替换，避免 $& $1 $` 等特殊替换符被解释
const repl = (html, needle, replacement) => html.replace(needle, () => replacement);

let html = read('index.html');
// 内联一个空 favicon，消除 file:// 下的 404 请求
html = html.replace('</head>', '<link rel="icon" href="data:,">\n</head>');

// 1) 内联 CSS
html = repl(html, '<link rel="stylesheet" href="style.css">', '<style>\n' + read('style.css') + '\n</style>');

// 2) 内联三个 JS
html = repl(html, '<script src="data.js"></script>', '<script>\n' + escScript(read('data.js')) + '\n</script>');
html = repl(html, '<script src="push_archive.js"></script>', '<script>\n' + escScript(read('push_archive.js')) + '\n</script>');
html = repl(html, '<script src="app.js"></script>', '<script>\n' + escScript(read('app.js')) + '\n</script>');

// 3) 内嵌所有推送归档页（base64），并用 Blob URL 让卡片可点开
const pushFiles = fs.readdirSync(base).filter(f => /^今日推送_\d{4}-\d{2}-\d{2}\.html$/.test(f));
const pushDocs = { __hasData: true };
pushFiles.forEach(f => { pushDocs[f] = Buffer.from(read(f), 'utf8').toString('base64'); });
const embed = `
<script>
window.__PUSH_DOCS = ${JSON.stringify(pushDocs)};
function __openPushBlob(filename) {
  const b64 = window.__PUSH_DOCS[filename];
  if (!b64) { alert('该期推送未随本文件打包'); return; }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
document.addEventListener('DOMContentLoaded', function () {
  if (!window.__PUSH_DOCS.__hasData) return;
  setTimeout(function () {
    document.querySelectorAll('.push-card').forEach(function (card) {
      const href = card.getAttribute('href') || '';
      const m = href.match(/([^/?]*今日推送_[^?]*\\.html)/);
      if (m && window.__PUSH_DOCS[m[1]]) {
        card.setAttribute('href', 'javascript:void(0)');
        card.addEventListener('click', function (e) { e.preventDefault(); __openPushBlob(m[1]); });
      }
    });
  }, 50);
});
</script>
`;
html = repl(html, '</body>', embed + '</body>');

const out = '/workspace/军转申论研学_完整离线版.html';
fs.writeFileSync(out, html, 'utf8');
console.log('已生成:', out);
console.log('文件大小:', (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1) + ' KB');
console.log('内嵌推送:', pushFiles.length, '期');
