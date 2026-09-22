#!/usr/bin/env python3
import json
from pathlib import Path

BASE = Path("assets/generated")
OUT = BASE / "manifest.json"
EXTS = {".png", ".webp", ".jpg", ".jpeg"}

def main():
    assets = {}
    if BASE.exists():
        for p in sorted(BASE.rglob("*")):
            if not p.is_file() or p.name == "manifest.json" or p.suffix.lower() not in EXTS:
                continue
            rel = p.relative_to(BASE).as_posix()
            parts = p.relative_to(BASE).parts
            kind = parts[0] if len(parts) > 1 else "misc"
            key = f"{kind}.{p.stem}"
            assets[key] = {"kind": kind, "src": f"assets/generated/{rel}"}
    out = {"version": 1, "assets": assets}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT} with {len(assets)} assets")

if __name__ == "__main__":
    main()
