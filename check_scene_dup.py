# -*- coding: utf-8 -*-
"""場面本文(SCENES*.pin / .capture)の「黙って上書きされる鍵」を数える。

  scenes*.js は「最初のリテラルブロック」のあとに Object.assign(SCENES*.pin, {...}) が
  何本も続く。index.html の読み込み順に走るので、**同じ鍵は後から書いた方が勝つ**。
  v7.1 でこれを踏んだ: 先頭ブロックへ丁寧に書き足した 8件が、
  js/scenes_v20.js の同じ鍵に上書きされて、一度も画面に出ないまま残っていた。
  BAL のキー重複(check_bal_dup.py)と同じ罠なので、同じように毎回数える。
"""
import io, re, sys

def blocks(path):
    """(種別, 表名, 鍵の集合, 行番号) を、ファイル内の出現順に返す"""
    s = io.open(path, encoding='utf-8').read()
    out = []
    def span(j):
        d = 0; k = j
        while k < len(s):
            if s[k] == '{': d += 1
            elif s[k] == '}':
                d -= 1
                if d == 0: return k
            k += 1
        return len(s) - 1
    tbl = (re.search(r'const\s+(SCENES\w*)\s*=', s) or [None, None])[1]
    for m in re.finditer(r'(?:^|\n)\s*(?:"(pin|capture)"|(pin|capture))\s*:\s*\{', s):
        kind = m.group(1) or m.group(2)
        j = s.index('{', m.end() - 1); k = span(j)
        keys = set(re.findall(r'["\']?(\w+)["\']?\s*:\s*\{', s[j:k + 1]))
        out.append((kind, tbl, keys, s[:m.start()].count('\n') + 2))
    for m in re.finditer(r'Object\.assign\((SCENES\w*)\.(pin|capture),\s*\{', s):
        j = s.index('{', m.end() - 1); k = span(j)
        keys = set(re.findall(r'["\']?(\w+)["\']?\s*:\s*\{', s[j:k + 1]))
        out.append((m.group(2), m.group(1), keys, s[:m.start()].count('\n') + 1))
    return out

html = io.open('index.html', encoding='utf-8').read()
order = re.findall(r'src="(js/scenes[a-z0-9_]*\.js)"', html)
seen = {}          # (表, 種別, 鍵) -> (ファイル, 行)
dead = []
for f in order:
    for kind, tbl, keys, ln in blocks(f):
        if not tbl: continue
        for k in sorted(keys):
            key = (tbl, kind, k)
            if key in seen:
                pf, pl = seen[key]
                dead.append('%s.%s["%s"]  %s:%d が %s:%d に上書きされる' % (tbl, kind, k, pf, pl, f, ln))
            seen[key] = (f, ln)

print('場面本文の鍵 %d 件 / 読み込み順 %s' % (len(seen), ' → '.join(order)))
if dead:
    print('  ★黙って上書きされている(前の方は死んでいる) %d 件:' % len(dead))
    for d in dead: print('    ' + d)
    sys.exit(1)
print('  上書きされて死んでいる鍵: (なし)')
