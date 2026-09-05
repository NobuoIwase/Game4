#!/usr/bin/env python3
"""v3 構想の試算(docs/ROADMAP_v3.md の表を生成)。数値は js/data.js の BAL に合わせて手で写している。
使い方: python3 tools/balance_calc.py > /tmp/tables.md"""
import math
# --- 現行の定数(data.js) ---
EN_BASE,EN_PER_LV,EN_MAX=14,3,80
EN_REGEN,EN_REGEN_LV=1.0,0.08
FLOORS=[('入口の洞',1.0,1.0,1.0,1.0,1.0),('水鏡の洞',1.15,1.15,1.15,1.15,1.05),('蜜の花園',1.3,1.3,1.3,1.3,1.10),('沈んだ回廊',1.5,1.5,1.5,1.5,1.15),('肉の巣',1.75,1.75,1.75,1.75,1.25)]
PRESS_T0,PRESS_T1,PRESS_MAX=90,210,2.0
PRESS_EN_MAX,PRESS_EN_REGEN,PRESS_UNIT=0.35,0.5,0.3
NIGHT_STAT_LV,NIGHT_STAT_CAP=0.04,0.8
NEED=lambda l:(6+l*3.2+l*l*0.18)*(1+0.05*max(0,l-20))
XPSOFT=lambda l:1/(1+0.03*max(0,l-15))
CORE_HP,CORE_HP_LV,CORE_HP_LV_CAP,CORE_DEF=32000,0.06,3.5,0.4
ESS_RATE,DESCEND_ESS,CLEAR_ESS,CAPTURE_ESS=0.55,60,40,60
def en_max(lv,fl,t):
    base,regen,mx=FLOORS[fl][2],FLOORS[fl][3],FLOORS[fl][4]
    pr=min(PRESS_MAX,max(0,t-PRESS_T0)/PRESS_T1)
    return round(min(EN_MAX*mx, EN_BASE*base+EN_PER_LV*lv)*(1+PRESS_EN_MAX*pr))
def en_regen(lv,fl,t):
    pr=min(PRESS_MAX,max(0,t-PRESS_T0)/PRESS_T1)
    return (EN_REGEN+EN_REGEN_LV*lv)*FLOORS[fl][3]*(1+PRESS_EN_REGEN*pr)
print('## A. 現行(v2.2)の夜側EN — 彼女Lv×階層×経過時間')
print('| 階層 | Lv | EN上限 t=0 | t=200s | t=500s | 回復/s t=0 | t=500s |'); print('|---|---|---|---|---|---|---|')
for fl in range(5):
    for lv in (1,20,40,60):
        print(f'| {fl+1} {FLOORS[fl][0]} | {lv} | {en_max(lv,fl,0)} | {en_max(lv,fl,200)} | {en_max(lv,fl,500)} | {en_regen(lv,fl,0):.1f} | {en_regen(lv,fl,500):.1f} |')
print()
print('## B. 彼女の成長の飽和 — Lvごとの必要経験値とジェム効率(現行)')
print('| Lv | need(Lv) | ジェム効率 | 累積need(1→Lv) |'); print('|---|---|---|---|')
cum=0
for l in range(1,91):
    cum+=NEED(l)
    if l in (1,10,20,30,40,50,60,70,80,90): print(f'| {l} | {NEED(l):.0f} | {XPSOFT(l):.2f} | {cum:.0f} |')
print()
print('## C. 魔核の実効HP(現行) — 引き継いだLvごと')
print('| 彼女Lv | 魔核HP | 被ダメ0.4を割った実効 | 想定DPS(概算) | 討伐見込み秒 |'); print('|---|---|---|---|---|')
for lv in (20,35,45,60,75):
    hp=CORE_HP*(1+min(CORE_HP_LV_CAP,CORE_HP_LV*(lv-1))); eff=hp/CORE_DEF
    dps=180*(1+0.035*(lv-1))  # 実測(Lv44で1270raw≒570eff, Lv60で≒1100eff)に近い粗い直線
    print(f'| {lv} | {hp:,.0f} | {eff:,.0f} | {dps*2.5:,.0f} raw | {eff/(dps*2.5):.0f} |')
print()
print('## D. v3 構想: 階層解放と難度の案')
print('| 討伐回数(世代) | 開放階層 | 深さ倍率(HP/与ダメ) | 圧の上限 | EN上限係数 | 番兵の数(第1層→最深) |'); print('|---|---|---|---|---|---|')
for c in range(0,7):
    floors=min(5,2+c)  # 初回は2階層、討伐ごとに+1(5で打ち止め)
    depth=1+0.12*c      # 討伐ごとに全階層の魔物が+12%
    pmax=1.2+0.2*c      # 圧の上限 1.2→2.4
    enmul=1+0.08*c
    sent=f'{2+min(2,c//2)}→{3+min(3,c//2)}'
    print(f'| {c} | 1〜{floors} | ×{depth:.2f} | {min(2.6,pmax):.1f} | ×{enmul:.2f} | {sent} |')
print()
print('## E. v3 構想: 2人以上で潜る時の係数(案)')
print('| 人数 | 彼女側 火力合計 | 夜側 EN上限 | 召喚頭数 | 魔物HP | 捕獲条件 | 経験値の分配 |'); print('|---|---|---|---|---|---|---|')
for n in (1,2,3):
    print(f'| {n} | ×{1+0.85*(n-1):.2f}(2人目以降は85%) | ×{1+0.6*(n-1):.2f} | ×{1+0.5*(n-1):.2f} | ×{1+0.35*(n-1):.2f} | 全員捕獲でその日の敗北。1人捕まると残りは救出か降下を選ぶ | ジェムは拾った人、討伐xpは均等 |')
print()
print('## F. v3 構想: 経済(エッセンス/オーブ)の1日あたり収入の見込み(現行の係数)')
print('| 結果 | 撃破xp(概算) | エッセンス | オーブ | 備考 |'); print('|---|---|---|---|---|')
for name,kills,xpavg,bonus,orb in (('第1層 降下(205s)',1300,3.0,DESCEND_ESS,26),('第3層 降下(220s)',4000,5.0,DESCEND_ESS,40),('捕獲(第2層)',2500,4.0,CAPTURE_ESS,20+5*3+35),('魔核討伐',15000,6.0,CLEAR_ESS,90)):
    ess=kills*xpavg*ESS_RATE+bonus
    print(f'| {name} | {kills*xpavg:,.0f} | {ess:,.0f} | {orb} | 解放費用は 60〜1250(魔物)・12〜44(祭壇) |')
