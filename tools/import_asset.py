#!/usr/bin/env python3
import argparse
import json
import os
import shutil
from pathlib import Path

META_PATH = Path("assets/generated/manifest.json")

def load_manifest():
    if META_PATH.exists():
        return json.loads(META_PATH.read_text(encoding="utf-8"))
    return {"version": 1, "assets": {}}

def save_manifest(m):
    META_PATH.parent.mkdir(parents=True, exist_ok=True)
    META_PATH.write_text(json.dumps(m, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def main():
    p = argparse.ArgumentParser()
    p.add_argument("source")
    p.add_argument("--id", required=True)
    p.add_argument("--kind", choices=["tile", "vfx", "monster", "ui"], required=True)
    p.add_argument("--target", default=None)
    p.add_argument("--notes", default="")
    a = p.parse_args()

    src = Path(a.source)
    if not src.exists():
        raise SystemExit(f"source file not found: {src}")

    ext = src.suffix.lower()
    if ext not in {".png", ".webp", ".jpg", ".jpeg"}:
        raise SystemExit("supported image formats: PNG/WEBP/JPEG")

    target = Path(a.target) if a.target else Path(f"assets/generated/{a.kind}/{a.id}{ext}")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, target)

    m = load_manifest()
    m["assets"][a.id] = {
        "kind": a.kind,
        "src": target.as_posix(),
        "notes": a.notes,
    }
    save_manifest(m)
    print(f"imported {a.id} -> {target}")

if __name__ == "__main__":
    main()
