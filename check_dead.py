#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""死んだ定義を静的に数える。

この作品では「定義はあるのに繋がっていない」穴を繰り返し踏んでいる:
  - musk … 性癖として読む側はあるのに、刻む場所が一つも無かった
  - hypnoObey … 刻む場所はあるのに、効きを読む場所が無かった
  - BAL の十数件 … 書いたまま誰も読んでいなかった
どれも走らせずに分かる。ここは結線だけを見る(値が打ち消されて効かない類は
実測でしか出ないので、そちらは docs/BRIEFING.md §5 と run_*.js の仕事)。

  python3 check_dead.py

★1行に複数の鍵がある行(`MIRE_R0:44, MIRE_R1:96,`)を落とさないよう、
  正規表現ではなく波括弧の深さを数えて拾う。最初に書いた版はこれで
  MIRE_R1 を見落としていた——検査する側も検査すること。
"""
import io, re, sys, os

ROOT = os.path.dirname(os.path.abspath(__file__))
JS = {}
for fn in sorted(os.listdir(os.path.join(ROOT, 'js'))):
    if fn.endswith('.js'):
        JS[fn] = io.open(os.path.join(ROOT, 'js', fn), encoding='utf-8').read()
ALL = '\n'.join(JS.values())
DATA = JS.get('data.js', '')


def strip_noise(src):
    """文字列とコメントを空白に潰す。中の { } や : に惑わされないため"""
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if c == '/' and i + 1 < n and src[i+1] == '*':
            j = src.find('*/', i + 2)
            j = n if j < 0 else j + 2
            out.append(' ' * (j - i)); i = j
        elif c == '/' and i + 1 < n and src[i+1] == '/':
            j = src.find('\n', i)
            j = n if j < 0 else j
            out.append(' ' * (j - i)); i = j
        elif c in '\'"`':
            j = i + 1
            while j < n and src[j] != c:
                j += 2 if src[j] == '\\' else 1
            j = min(j + 1, n)
            out.append(' ' * (j - i)); i = j
        else:
            out.append(c); i += 1
    return ''.join(out)


def top_keys(src, name):
    """const NAME={…} の、括弧の深さ1の鍵をすべて拾う"""
    clean = strip_noise(src)
    m = re.search(r'const\s+%s\s*=\s*\{' % name, clean)
    if not m:
        return [], 0, 0
    start = m.end()
    depth, i, n = 1, start, len(clean)
    keys = []
    while i < n and depth > 0:
        c = clean[i]
        if c in '{[(':
            depth += 1
        elif c in '}])':
            depth -= 1
            if depth == 0:
                break
        elif depth == 1:
            k = re.match(r'([A-Za-z_$][\w$]*)\s*:', clean[i:])
            if k and (i == start or not re.match(r'[\w$.]', clean[i-1])):
                keys.append(k.group(1))
                i += k.end() - 1
        i += 1
    return keys, start, i


problems = []

# ---- 1) 性癖: 刻む場所 / 効きを読む場所 ----
traits, _, _ = top_keys(DATA, 'TRAITS')
marked = set(re.findall(r"markTrait\([^,]+,\s*'(\w+)'", ALL))
secced = set(re.findall(r"sec\('(\w+)'", ALL))
# ★markTrait を通さずに traits に直接書く道もある(conditionMusk がそれ)。
#   これを見ていなかった最初の版は musk を「刻む場所が無い」と誤って挙げた
direct = set(re.findall(r"traits\.(\w+)\s*=[^=]", ALL))
marked |= direct
read_tr = set(re.findall(r"traitLv\([^,]+,\s*'(\w+)'", ALL)) | set(re.findall(r"traits\.(\w+)", ALL))

dead_tr = [k for k in traits if k not in marked and k not in secced]
mute_tr = [k for k in traits if k not in read_tr]
print('性癖 %d件' % len(traits))
print('  刻む場所が無い      : %s' % (', '.join(dead_tr) if dead_tr else '(なし)'))
print('  効きを読む場所が無い: %s' % (', '.join(mute_tr) if mute_tr else '(なし)'))
if dead_tr: problems.append('性癖に刻む場所が無い: ' + ', '.join(dead_tr))
if mute_tr: problems.append('性癖の効きを読む場所が無い: ' + ', '.join(mute_tr))

# ---- 2) BAL: data.js の外で一度も読まれない定数 ----
# 行のコメントに「未使用」と書いてあるものは、残すと決めたものとして見逃す
bal, s0, s1 = top_keys(DATA, 'BAL')
kept = set()
for line in DATA[s0:s1].split('\n'):
    if '未使用' in line:
        kept |= set(re.findall(r'([A-Za-z_$][\w$]*)\s*:', line))
# ★読む側は data.js の中にも居る(深さ倍率など、data.js の末尾に関数がある)。
#   除くのは BAL の定義ブロックそのものだけ。ここを data.js 丸ごと除外していたら、
#   実際には読まれている ERA_DEEP_FROM などを穴として挙げてしまった
OUTSIDE = ALL[:ALL.find(DATA[s0:s1])] + ALL[ALL.find(DATA[s0:s1]) + (s1 - s0):] if DATA[s0:s1] in ALL else ALL
# ★組み立てて引く書き方(BAL['CORE_SK_'+k])がある。前置きの文字列を集めて、
#   そこから始まる鍵は読まれているものとして扱う。これを見ていなかった最初の版は
#   CORE_SK_BIG/BEAM/RAGE を穴として挙げていた(実際は毎戦読まれている)
prefixes = re.findall(r"BAL\[\s*'([^']*)'\s*\+", OUTSIDE) + re.findall(r'BAL\[\s*"([^"]*)"\s*\+', OUTSIDE)
prefixes = [p for p in prefixes if p]
dyn = bool(re.search(r"BAL\[\s*[A-Za-z_$]", OUTSIDE))

def is_read(k):
    if re.search(r'BAL\.%s\b' % re.escape(k), OUTSIDE): return True
    if re.search(r"BAL\[\s*['\"]%s['\"]\s*\]" % re.escape(k), OUTSIDE): return True
    return any(k.startswith(p) for p in prefixes)

unused = [k for k in bal if k not in kept and not is_read(k)]
print('BAL %d件(うち「未使用」と明記 %d件)' % (len(bal), len(kept)))
print('  読まれない: %s' % (', '.join(unused) if unused else '(なし)'))
if dyn:
    print('  (注: 変数で引く BAL[...] があるので、上の一覧は多めに出る可能性がある)')
if unused: problems.append('読まれない BAL: ' + ', '.join(unused))

if problems:
    print('\n★ 穴 %d件' % len(problems))
    sys.exit(1)
print('\n穴なし')
