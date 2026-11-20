#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
每日同步（并发优化版）：把 WorkBuddy 沙箱的最新文件镜像到 GitHub 仓库 YYLGG/shenlun，
保证 GitHub Pages 与 WorkBuddy 站点内容一致。

优化：
  1) 并发上传（ThreadPoolExecutor），把串行数十分钟压缩到几十秒；
  2) 用本地 SHA 清单跳过内容未变的文件，日常只上传真正变化的文件；
  3) 单文件失败不阻断整体，内置指数退避重试。

令牌来源优先级：环境变量 GITHUB_TOKEN > 私有目录 token 文件 > 连接器脚本。
用法：python3 sync_github.py（部署时把本文件覆盖为 sync_github.py）
由 gen_daily.js 在每日生成推送末尾调用。
"""
import os, sys, json, base64, hashlib, subprocess, time, urllib.request, urllib.error
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

OWNER = "YYLGG"
REPO = "shenlun"
BRANCH = "main"
SRC = "/workspace/juanguan-shenlun"
TOKEN_SCRIPT = "/root/.codebuddy/skills/github-connector/scripts/get_token.sh"
TOKEN_FILE = "/workspace/juanguan-private/github_token.txt"
STATE_FILE = "/workspace/juanguan-private/sync_state.json"   # 记录已上传文件的本地哈希
API = f"https://api.github.com/repos/{OWNER}/{REPO}/contents"
TREE_API = f"https://api.github.com/repos/{OWNER}/{REPO}/git/trees/{BRANCH}?recursive=1"

CORE = ["index.html", "app.js", "style.css", "data.js", "push_archive.js",
        "gen_daily.js", "update_policy.js", "build_offline.js", "sync_github.py", "sync_github.sh",
        "入库日期.json"]
PUSH = [f for f in os.listdir(SRC) if f.startswith("今日推送_") and f.endswith(".html")]
FILES = CORE + sorted(PUSH)
MAX_WORKERS = 6


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


def api(method, url, token, body=None, retries=4, timeout=45):
    data = json.dumps(body).encode() if body is not None else None
    last = None
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("Accept", "application/vnd.github+json")
        req.add_header("X-GitHub-Api-Version", "2022-11-28")
        req.add_header("User-Agent", "shenlun-sync")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status, json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.loads(e.read().decode())
            except Exception:
                return e.code, {}
        except Exception as e:
            last = e
            if attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))
    return 0, {"message": str(last) if last else "network error"}


def load_state():
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_state(state):
    try:
        os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def main():
    token = get_token()
    if not token:
        print("同步失败：无法获取 GitHub 令牌", file=sys.stderr)
        return 1

    # 一次性拉取文件树得到 {path: sha}（关键：SHA 来源统一，避免并发逐文件 GET 造成竞态）
    sha_map = {}
    code, tree = 0, {}
    for _ in range(4):
        code, tree = api("GET", TREE_API, token, retries=2, timeout=60)
        if code == 200 and isinstance(tree, dict):
            break
        time.sleep(3)
    if code == 200 and isinstance(tree, dict):
        for item in tree.get("tree", []):
            if item.get("type") == "blob":
                sha_map[item.get("path")] = item.get("sha")
        print(f"文件树已加载：{len(sha_map)} 个文件")
    else:
        print("警告：文件树拉取失败，改为逐文件查询 SHA（可能较慢）", file=sys.stderr)

    state = load_state()
    msg = f"每日自动同步 {datetime.now().strftime('%Y-%m-%d %H:%M')}"

    # 预计算每个文件的哈希，过滤掉内容未变且仓库已存在的
    tasks = []          # (name, sha, content, hash)
    skipped = []
    for name in FILES:
        path = os.path.join(SRC, name)
        if not os.path.isfile(path):
            continue
        with open(path, "rb") as f:
            raw = f.read()
        h = hashlib.md5(raw).hexdigest()
        if state.get(name) == h and name in sha_map:
            skipped.append(name)
            continue
        content = base64.b64encode(raw).decode()
        sha = sha_map.get(name, "")
        tasks.append((name, sha, content, h))

    if skipped:
        print(f"跳过 {len(skipped)} 个未变化文件")

    results = {}
    def upload(item):
        name, sha, content, h = item
        enc_name = quote(name, safe="()_.~-")
        code, resp = 0, {}
        # 最多 4 轮：每轮都用最新 SHA，409/422 冲突后重新 GET SHA 再试
        for attempt in range(4):
            if not sha:
                gc, meta = api("GET", f"{API}/{enc_name}?ref={BRANCH}", token, retries=2)
                if gc == 200 and isinstance(meta, dict):
                    sha = meta.get("sha", "")
            body = {"message": msg, "content": content, "branch": BRANCH}
            if sha:
                body["sha"] = sha
            code, resp = api("PUT", f"{API}/{enc_name}", token, body, retries=2)
            if code in (200, 201):
                break
            if code in (409, 422):
                sha = ""   # 强制下一轮重新获取最新 SHA
                time.sleep(1 + attempt)
                continue
            if code == 0:
                time.sleep(2 + attempt)  # 网络超时，退避重试
                continue
            break
        return name, h, code, resp.get("message", "")

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futs = {ex.submit(upload, it): it[0] for it in tasks}
        for fut in as_completed(futs):
            name, h, code, errmsg = fut.result()
            if code in (200, 201):
                state[name] = h
                print(f"  OK   {name}")
            else:
                state[name] = ""   # 失败不记哈希，下次重试
                print(f"  FAIL {name} -> HTTP {code} {errmsg}", file=sys.stderr)

    save_state(state)
    ok = sum(1 for it in tasks if state.get(it[0]) == it[3])
    fail = len(tasks) - ok
    if fail:
        print(f"同步完成：{ok} 成功，{fail} 失败", file=sys.stderr)
        return 1
    print(f"GitHub Pages 同步成功：{ok} 个文件已更新（{len(skipped)} 个未变化已跳过）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
