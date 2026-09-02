#!/usr/bin/env python3
"""NovelAI等の画像をゲーム用スプライトに加工する。
使い方:
  ドット絵:   python3 tools/pixelate.py 入力.png 出力.png --mode pixel --height 52 --colors 16
  描き込み:   python3 tools/pixelate.py 入力.png 出力.png --mode smooth --height 105 --outline
  セル調:     python3 tools/pixelate.py 入力.png 出力.png --mode cel --height 90 --outline
  (透過PNG推奨。自動で余白を切り詰め、指定高さへ縮小する)
"""
import argparse
from PIL import Image, ImageFilter, ImageOps, ImageEnhance

def _binar(a, th):
    return a.point(lambda v: 255 if v >= th else 0)

def _outline(im, col=(40, 20, 60, 255)):
    # シルエットの外側に1pxの暗い縁取り(小さく描いても輪郭が沈まない)
    a = im.getchannel('A'); grown = a.filter(ImageFilter.MaxFilter(3))
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ol = Image.new('RGBA', im.size, col); ol.putalpha(grown)
    out.alpha_composite(ol); out.alpha_composite(im)
    return out

def convert(src, dst, mode='pixel', height=52, colors=16, outline=False):
    im = Image.open(src).convert('RGBA')
    bbox = im.getchannel('A').getbbox()
    if bbox: im = im.crop(bbox)
    w = max(1, round(im.width * height / im.height))
    if mode == 'pixel':
        small = im.resize((w, height), Image.BOX)
        a = _binar(small.getchannel('A'), 110)
        rgb = small.convert('RGB').quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
        out = rgb.convert('RGBA'); out.putalpha(a)
    elif mode == 'cel':
        small = im.resize((w, height), Image.LANCZOS)
        a = _binar(small.getchannel('A'), 100)
        rgb = ImageOps.posterize(small.convert('RGB'), 4)
        out = rgb.convert('RGBA'); out.putalpha(a)
    else:  # smooth: 縮小+軽いシャープで描き込みを残す
        small = im.resize((w, height), Image.LANCZOS)
        small = ImageEnhance.Sharpness(small).enhance(1.4)
        a = _binar(small.getchannel('A'), 90)
        out = small.copy(); out.putalpha(a)
    if outline: out = _outline(out)
    out.save(dst)
    print(f"{dst}: {out.width}x{out.height} mode={mode}" + (f" {colors}色" if mode == 'pixel' else ''))

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--mode', choices=['pixel', 'smooth', 'cel'], default='pixel')
    ap.add_argument('--height', type=int, default=52)
    ap.add_argument('--colors', type=int, default=16)
    ap.add_argument('--outline', action='store_true')
    a = ap.parse_args()
    convert(a.src, a.dst, a.mode, a.height, a.colors, a.outline)
