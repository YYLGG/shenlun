#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
每日同步：把 WorkBuddy 沙箱的最新文件镜像到 GitHub 仓库 YYLGG/shenlun，
保证 GitHub Pages 与 WorkBuddy 站点内容一致。

令牌来源优先级：环境变量 GITHUB_TOKEN > 私有目录 token 文件 > 连接器脚本。
用法：python3 sync_github.py
由 gen_daily.js 在每日生成推送末尾调用。
"""
import os, sys, json, base64, subprocess, time, urllib.request, urllib.error
from datetime import datetime

OWNER = "YYLGG"
REPO = "shenlun"
BRANCH = "main"
SRC = "/workspace/juanguan-shenlun"
TOKEN_SCRIPT = "/root/.codebuddy/skills/github-connector/scripts/get_token.sh"
TOKEN_FILE = "/workspace/juanguan-private/github_token.txt"
API = f"https://api.github.com/repos/{OWNER}/{REPO}/contents"
TREE_API = f"https://api.github.com/repos/{OWNER}/{REPO}/git/trees/{BRANCH}?recursive=1"

CORE = ["index.html", "app.js", "style.css", "data.js", "push_archive.js",
        "gen_daily.js", "update_policy.js", "build_offline.js", "sync_github.py", "sync_github.sh"]
PUSH = [f for f in os.listdir(SRC) if f.startswith("今日推送_") and f.endswith(".html")]
FILES = CORE + sorted(PUSH)


def get_token():
    t = os.environ.get("GITHUB_TOKEN", "").strip()
    if t:
        return t
    if os.path.exists(TOKEN_FILE):
        try:
            with open(TOKEN_FILE, "r", encoding="utf-8") as f:
                t = f.read().strip()
            if t:
                return t
        except Exception:
            pass
    if os.path.exists(TOKEN_SCRIPT):
        script = f'source "{TOKEN_SCRIPT}" github >/dev/null 2>&1; printf "%s" "$GITHUB_TOKEN"'
        try:
            return subprocess.run(["bash", "-c", script], capture_output=True, text=True, timeout=60).stdout.strip()
        except Exception:
            pass
    return ""


def api(method, url, token, body=None, retries=3):
    """带指数退避重试的 API 请求"""
    data = json.dumps(body).encode() if body is not None else None
    last = None
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("Accept", "application/vnd.github+json")
        req.add_header("X-GitHub-Api-Version", "2022-11-28")
        req.add_header("User-Agent", "shenlun-sync")
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.loads(e.read().decode())
            except Exception:
                return e.code, {}
        except Exception as e:
            last = e
            if attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
    return 0, {"message": str(last) if last else "network error"}


def main():
    token = get_token()
    if not token:
        print("同步失败：无法获取 GitHub 令牌", file=sys.stderr)
        return 1

    # 一次性拉取仓库文件树，得到 {path: sha}，避免逐文件 GET
    sha_map = {}
    code, tree = api("GET", TREE_API, token)
    if code == 200 and isinstance(tree, dict):
        for item in tree.get("tree", []):
            if item.get("type") == "blob":
                sha_map[item.get("path")] = item.get("sha")
    else:
        print("警告：无法获取文件树，将逐文件查询 SHA", file=sys.stderr)

    msg = f"每日自动同步 {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    ok, fail = 0, 0
    for name in FILES:
        path = os.path.join(SRC, name)
        if not os.path.isfile(path):
            continue
        with open(path, "rb") as f:
            content = base64.b64encode(f.read()).decode()
        sha = sha_map.get(name, "")
        if not sha:  # 文件树未覆盖时兜底单查
            code, meta = api("GET", f"{API}/{name}?ref={BRANCH}", token)
            if code == 200 and isinstance(meta, dict):
                sha = meta.get("sha", "")
        body = {"message": msg, "content": content, "branch": BRANCH}
        if sha:
            body["sha"] = sha
        code, resp = api("PUT", f"{API}/{name}", token, body)
        if code in (200, 201):
            print(f"  OK   {name}")
            ok += 1
        else:
            print(f"  FAIL {name} -> HTTP {code} {resp.get('message','')}", file=sys.stderr)
            fail += 1

    if fail:
        print(f"同步完成：{ok} 成功，{fail} 失败", file=sys.stderr)
        return 1
    print(f"GitHub Pages 同步成功：{ok} 个文件已镜像")
    return 0


if __name__ == "__main__":
    sys.exit(main())
