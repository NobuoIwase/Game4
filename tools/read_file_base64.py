#!/usr/bin/env python3
"""
Read any local file and print Base64 to stdout.

Usage:
  python tools/read_file_base64.py /path/to/file.png > file.b64
"""
import argparse
import base64
from pathlib import Path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    args = ap.parse_args()
    p = Path(args.path)
    if not p.is_file():
        raise SystemExit(f"file not found: {p}")
    print(base64.b64encode(p.read_bytes()).decode("ascii"))

if __name__ == "__main__":
    main()
