# -*- coding: utf-8 -*-
"""ChatGPT が一枚に結合して出した立ち絵シートを、キャラごとのスプライトに切り分ける。
   使い方: python3 tools/split_sheet.py "<シートのpng>"
   出力: assets/sprites/<id>.png (小) と <id>_hd.png (高さ240)、assets/ref/<id>.png (立ち絵)"""
import sys, os
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else 'ChatGPT Image 2026年9月7日 12_08_13.png'
# シート上の区画(上段=天使3人 / 下段=ヤミコと小淫魔)。谷の位置は alpha の列ヒストグラムから求めた
CELLS = [
    ('lumina_sheet', 0,   347, 68,  727),
    ('freila_sheet', 347, 691, 68,  727),
    ('kuu',          691, 1037,68,  727),
    ('yamiko',       60,  510, 756, 1459),
    ('imp',          510, 980, 756, 1459),
]
OUT_SPR = 'assets/sprites'
OUT_REF = 'assets/ref'
HD_H  = 240      # 焼き絵の原本の高さ(既存の lumina_hd.png と同じ)
PX_H  = 52       # ドット絵の高さ(既存の lumina.png と同じ)
REF_H = 1216     # 立ち絵の高さ(既存の ref と同じ)

def bbox_alpha(im, th=24):
    px = im.load(); w, h = im.size
    x0, y0, x1, y1 = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > th:
                if x < x0: x0 = x
                if y < y0: y0 = y
                if x > x1: x1 = x
                if y > y1: y1 = y
    return None if x1 < 0 else (x0, y0, x1 + 1, y1 + 1)

def clean_edges(im, th=24):
    """薄いにじみ(グロー)を落として、輪郭をはっきりさせる"""
    px = im.load(); w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a <= th: px[x, y] = (0, 0, 0, 0)
            elif a < 200: px[x, y] = (r, g, b, 255 if a > 120 else 0)
    return im

def fit(im, hh, smooth):
    w, h = im.size
    ww = max(1, round(w * hh / h))
    return im.resize((ww, hh), Image.LANCZOS if smooth else Image.NEAREST)

def main():
    os.makedirs(OUT_SPR, exist_ok=True); os.makedirs(OUT_REF, exist_ok=True)
    sheet = Image.open(SRC).convert('RGBA')
    for cid, x0, x1, y0, y1 in CELLS:
        cell = sheet.crop((x0, y0, min(x1, sheet.size[0]), min(y1, sheet.size[1])))
        cell = clean_edges(cell)
        bb = bbox_alpha(cell)
        if not bb:
            print('  skip (empty):', cid); continue
        cut = cell.crop(bb)
        print('%-14s cell=%s bbox=%s -> %s' % (cid, (x0, y0, x1, y1), bb, cut.size))
        if cid.endswith('_sheet'):
            cut.save(os.path.join(OUT_REF, cid + '.png'))   # 参考用に残すだけ(既存の絵は差し替えない)
            continue
        fit(cut, HD_H, True ).save(os.path.join(OUT_SPR, cid + '_hd.png'))
        fit(cut, PX_H, True ).save(os.path.join(OUT_SPR, cid + '.png'))
        fit(cut, REF_H, True).save(os.path.join(OUT_REF, cid + '.png'))
    print('done')

main()
