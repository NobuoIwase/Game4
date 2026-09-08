#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""docs/MAP.md の参照が実在するかを機械的に確かめる。

索引は、間違っていると読む側を積極的に誤らせる。実際このリポジトリでは
BRIEFING §2 の表が逆に書かれていて、それを信じた作業が一度ずれている。
だから索引は「書いたら検証する」ものとして扱う。

見るもの:
  `js/foo.js`            … ファイルが在るか
  `js/foo.js:bar()`      … その名前が、そのファイルで定義されているか
  `BAL.KEY`              … data.js の BAL に在るか
  `js/data.js:NAME`      … その名前が data.js で定義されているか(定数表など)
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
MAP  = os.path.join(ROOT, 'docs', 'MAP.md')

def read(p):
    with io.open(p, encoding='utf-8') as f:
        return f.read()

def defined_names(src):
    """そのファイルが定義している名前(関数・const・let・class・オブジェクト表)"""
    names = set()
    for pat in (r'^\s*function\s+([A-Za-z_$][\w$]*)',
                r'^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)',
                r'^\s*class\s+([A-Za-z_$][\w$]*)',
                r'^\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{'):      # ui.js のメソッド記法
        names |= set(re.findall(pat, src, re.M))
    return names

def bal_keys(src):
    """const BAL={ … } の直下のキー"""
    i = src.find('const BAL')
    if i < 0:
        return set()
    depth, j, start = 0, src.index('{', i), None
    keys, k = set(), src.index('{', i)
    depth = 0
    for j in range(k, len(src)):
        c = src[j]
        if c == '{': depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                body = src[k+1:j]
                break
    else:
        return set()
    # 入れ子の中のキーは拾わない: 深さ1のものだけ
    depth = 0
    for m in re.finditer(r'[{}\[\]]|([A-Za-z_$][\w$]*)\s*:', body):
        if m.group(1) is not None:
            if depth == 0:
                keys.add(m.group(1))
            continue
        depth += 1 if m.group(0) in '{[' else -1
    return keys

def main():
    if not os.path.exists(MAP):
        print('docs/MAP.md が無い'); return 1
    doc = read(MAP)
    # ★三重バッククォートの囲いを先に落とす。残すとバッククォートのペアが
    #   そこからずれて、以降の参照を一つも拾えなくなる(実際に踏んだ)
    doc = re.sub(r'```.*?```', '', doc, flags=re.S)
    src_cache, bad = {}, []

    def src_of(rel):
        if rel not in src_cache:
            p = os.path.join(ROOT, rel)
            src_cache[rel] = read(p) if os.path.exists(p) else None
        return src_cache[rel]

    spans = re.findall(r'`([^`]+)`', doc)
    n_file = n_sym = n_bal = 0

    BAL = bal_keys(read(os.path.join(ROOT, 'js', 'data.js')))
    if not BAL:
        print('★ data.js から BAL のキーを読めなかった'); return 1

    for s in spans:
        m = re.fullmatch(r'(js/[a-z0-9_]+\.js):([A-Za-z_$][\w$]*)\(\)?', s)
        if m:
            rel, sym = m.group(1), m.group(2)
            n_sym += 1
            src = src_of(rel)
            if src is None:
                bad.append('%s … ファイルが無い' % s)
            elif sym not in defined_names(src):
                bad.append('%s … %s の中に定義が見つからない' % (s, rel))
            continue
        m = re.fullmatch(r'(js/[a-z0-9_]+\.js):([A-Za-z_$][\w$]*)', s)
        if m:
            rel, sym = m.group(1), m.group(2)
            n_sym += 1
            src = src_of(rel)
            if src is None:
                bad.append('%s … ファイルが無い' % s)
            elif sym not in defined_names(src):
                bad.append('%s … %s の中に定義が見つからない' % (s, rel))
            continue
        m = re.fullmatch(r'js/[a-z0-9_*]+\.js', s)
        if m:
            n_file += 1
            if '*' in s:
                pref = s.split('*')[0]
                if not any(f.startswith(os.path.basename(pref)) for f in os.listdir(os.path.join(ROOT, 'js'))):
                    bad.append('%s … 該当するファイルが無い' % s)
            elif src_of(s) is None:
                bad.append('%s … ファイルが無い' % s)
            continue
        m = re.fullmatch(r'BAL\.([A-Z_0-9]+)', s)
        if m:
            n_bal += 1
            if m.group(1) not in BAL:
                bad.append('%s … BAL に無い' % s)
            continue

    print('docs/MAP.md の参照: ファイル%d件 / 名前%d件 / BAL %d件' % (n_file, n_sym, n_bal))
    if bad:
        print('★ 実在しない参照 %d件:' % len(bad))
        for b in bad:
            print('   ' + b)
        return 1
    print('  実在しない参照: (なし)')
    return 0

sys.exit(main())
