#!/usr/bin/env python3
"""NovelAI等の画像をゲーム用ドット絵に加工する。
使い方:
  python3 tools/pixelate.py 入力.png 出力.png --height 52 --colors 16
  (透過PNG推奨。自動で余白を切り詰め、指定高さへ縮小し、色数を絞る)
"""
import argparse
from PIL import Image

def pixelate(src, dst, height=52, colors=16):
    im = Image.open(src).convert('RGBA')
    bbox = im.getchannel('A').getbbox()
    if bbox: im = im.crop(bbox)
    w = max(1, round(im.width * height / im.height))
    small = im.resize((w, height), Image.BOX)
    # 半透明のフチを二値化(ドット絵はエッジがパキッとしている)
    a = small.getchannel('A').point(lambda v: 255 if v >= 110 else 0)
    rgb = small.convert('RGB').quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
    out = rgb.convert('RGBA'); out.putalpha(a)
    out.save(dst)
    print(f"{dst}: {out.width}x{out.height}, {colors}色")

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--height', type=int, default=52)
    ap.add_argument('--colors', type=int, default=16)
    a = ap.parse_args()
    pixelate(a.src, a.dst, a.height, a.colors)
