#!/bin/bash
# 每日同步：把 WorkBuddy 沙箱的材料库/推送文件，镜像到 GitHub 仓库 YYLGG/shenlun，
# 保证 GitHub Pages 与 WorkBuddy 站点内容完全一致。
# 由 gen_daily.js 在每日生成推送末尾自动调用；令牌每次动态获取，无需人工。
# 采用 GitHub Contents API（令牌对 git 传输有限制，但对 REST API 有完整权限）。
set -e

TOKEN_SCRIPT="/root/.codebuddy/skills/github-connector/scripts/get_token.sh"
REPO_OWNER="YYLGG"
REPO_NAME="shenlun"
BRANCH="main"
SRC="/workspace/juanguan-shenlun"
API="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents"

# 1) 动态获取 GitHub 令牌（连接器授权的 OAuth token）
if [ ! -f "$TOKEN_SCRIPT" ]; then
  echo "同步失败：找不到令牌获取脚本 $TOKEN_SCRIPT" >&2
  exit 1
fi
source "$TOKEN_SCRIPT" github >/dev/null 2>&1 || {
  echo "同步失败：GitHub 令牌获取失败，请在 WorkBuddy 设置-连接器中重新授权 GitHub" >&2
  exit 1
}
if [ -z "$GITHUB_TOKEN" ]; then
  echo "同步失败：GitHub 令牌为空" >&2
  exit 1
fi

AUTH="Authorization: Bearer ${GITHUB_TOKEN}"
ACCEPT="Accept: application/vnd.github+json"

# 2) 逐文件通过 Contents API 上传（已存在则带 sha 更新）
push_file(){
  local f="$1"
  local api_path="$API/$f"
  local b64=$(base64 -w0 "$SRC/$f")
  # 查现有 sha
  local meta=$(curl -s -H "$AUTH" -H "$ACCEPT" "${api_path}?ref=${BRANCH}")
  local sha=$(echo "$meta" | python3 -c "import sys,json
try:
  d=json.load(sys.stdin); print(d.get('sha','') if isinstance(d,dict) else '')
except: print('')" 2>/dev/null || true)
  local payload=$(python3 -c "
import json,sys
msg,content,sha=sys.argv[1],sys.argv[2],sys.argv[3]
obj={'message':msg,'content':content,'branch':'$BRANCH'}
if sha: obj['sha']=sha
print(json.dumps(obj))" "每日自动同步 $(date +%F\ %H:%M)" "$b64" "$sha")
  local resp=$(curl -s -X PUT -H "$AUTH" -H "$ACCEPT" -H "X-GitHub-Api-Version: 2022-11-28" "$api_path" -d "$payload")
  local ok=$(echo "$resp" | python3 -c "import sys,json
try:
  d=json.load(sys.stdin); print('OK' if d.get('content') else 'FAIL:'+str(d.get('message',''))[:80])
except Exception as e: print('FAIL:'+str(e)[:60])" 2>/dev/null)
  echo "  $f -> $ok"
  case "$ok" in OK*) return 0;; *) return 1;; esac
}

# 3) 站点运行必需文件（PDF 体积大且非必需，暂不纳入自动同步）
FILES="index.html app.js style.css data.js push_archive.js gen_daily.js update_policy.js build_offline.js 今日推送_2026-11-18.html 今日推送_2026-11-19.html 今日推送_2026-11-20.html"

# 自动纳入目录内所有「今日推送_*.html」（按文件名）
for f in "$SRC"/今日推送_*.html; do
  [ -f "$f" ] || continue
  b=$(basename "$f")
  echo "$FILES" | grep -qwF "$b" || FILES="$FILES $b"
done

echo "开始同步到 GitHub Pages (${REPO_OWNER}/${REPO_NAME}):"
fail=0
for f in $FILES; do
  if [ -f "$SRC/$f" ]; then
    push_file "$f" || fail=$((fail+1))
  else
    echo "  跳过（本地不存在）: $f"
  fi
done

if [ "$fail" -gt 0 ]; then
  echo "同步完成，但有 $fail 个文件上传失败" >&2
  exit 1
fi
echo "GitHub Pages 同步成功：data.js + 推送 + 归档 + 全部脚本（共 $(echo $FILES | wc -w) 个文件）"
echo "等待约 1-2 分钟 GitHub Pages 生效；如浏览器缓存，请加 ?v=时间戳 强制刷新"
