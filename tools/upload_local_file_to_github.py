#!/usr/bin/env python3
"""
Upload a local binary file (PNG/WebP/JPEG/etc.) directly to a GitHub repository
using the GitHub Contents API.

Usage:
  python tools/upload_local_file_to_github.py \
    /path/to/image.png \
    --owner NobuoIwase \
    --repo Game4 \
    --repo-path assets/generated/tile/moonstone.png \
    --branch claude/ai-girl-deck-battle-game-1k94l5 \
    --message "Add generated moonstone tile"

Auth:
  export GITHUB_TOKEN=ghp_...
"""
import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


API = "https://api.github.com"


def request_json(method, url, token, payload=None):
    data = None
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Game4-Asset-Uploader",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            raw = res.read().decode("utf-8")
            return res.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            body = json.loads(raw)
        except Exception:
            body = {"message": raw}
        return e.code, body


def get_existing_sha(owner, repo, repo_path, branch, token):
    encoded = urllib.parse.quote(repo_path)
    url = f"{API}/repos/{owner}/{repo}/contents/{encoded}?ref={urllib.parse.quote(branch)}"
    status, body = request_json("GET", url, token)
    if status == 200:
        return body.get("sha")
    if status == 404:
        return None
    raise RuntimeError(f"GitHub read failed ({status}): {body}")


def upload(owner, repo, repo_path, branch, message, local_path, token):
    p = Path(local_path)
    if not p.is_file():
        raise FileNotFoundError(f"Local file not found: {p}")

    content = base64.b64encode(p.read_bytes()).decode("ascii")
    sha = get_existing_sha(owner, repo, repo_path, branch, token)

    payload = {
        "message": message,
        "content": content,
        "branch": branch,
    }
    if sha:
        payload["sha"] = sha

    encoded = urllib.parse.quote(repo_path)
    url = f"{API}/repos/{owner}/{repo}/contents/{encoded}"
    status, body = request_json("PUT", url, token, payload)
    if status not in (200, 201):
        raise RuntimeError(f"GitHub write failed ({status}): {body}")

    commit = (body.get("commit") or {}).get("sha", "")
    print(json.dumps({
        "ok": True,
        "local_path": str(p),
        "repo_path": repo_path,
        "branch": branch,
        "commit": commit,
        "updated": bool(sha),
    }, ensure_ascii=False, indent=2))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("local_path")
    ap.add_argument("--owner", required=True)
    ap.add_argument("--repo", required=True)
    ap.add_argument("--repo-path", required=True)
    ap.add_argument("--branch", required=True)
    ap.add_argument("--message", default="Upload generated asset")
    ap.add_argument("--token-env", default="GITHUB_TOKEN")
    args = ap.parse_args()

    token = os.environ.get(args.token_env)
    if not token:
        print(
            f"Missing GitHub token. Set environment variable {args.token_env}.",
            file=sys.stderr,
        )
        sys.exit(2)

    upload(
        args.owner,
        args.repo,
        args.repo_path,
        args.branch,
        args.message,
        args.local_path,
        token,
    )


if __name__ == "__main__":
    main()
