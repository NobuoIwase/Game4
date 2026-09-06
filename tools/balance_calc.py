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
CORE_HP,CORE_HP_LV,CORE_HP_LV_CAP,CORE_DEF=28000,0.04,3.0,0.4   # v2.4: 26000→28000
ESS_RATE,DESCEND_ESS,CLEAR_ESS,CAPTURE_ESS=0.30,40,120,45   # v3.1: 0.55→0.30 / 降下 40+15·(深さ-1) / 討伐 120+60·世代 / 捕獲 45
ESS_SOFT,ESS_ERA_K,ORB_ERA_K,ORB_SOFT=700,0.12,0.10,80     # v3.1: 一日の撃破ぶんは SOFT·ln(1+x/SOFT) で逓減、世代ごとに +12%(オーブ +10%、オーブの逓減は 80)
DESCEND_ESS_DEPTH,CLEAR_ESS_ERA=15,60
def ess_soft(x): return ESS_SOFT*math.log(1+x/ESS_SOFT) if ESS_SOFT>0 else x
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
print('## D. 世代(討伐回数)ごとの階層解放と難度(v3.1 実装値)')
print('| 討伐回数(世代) | 開放階層 | 深さ倍率(魔物HP/与ダメ・EN天井) | 圧の上限 | 番兵の上限 | 魔核HP係数 | 魔核の被ダメ |'); print('|---|---|---|---|---|---|---|')
NFLOORS,ERA_FLOORS0,ERA_DEPTH_K0,ERA_DEPTH_K=8,2,0.10,0.10
CORE_ERA_HP0,CORE_ERA_HP_K,CORE_ERA_DEF0,CORE_ERA_DEF_K=0.30,0.28,0.75,0.05
SENT_ERA=[2,3,3,4,4,5,6]
for c in range(0,9):
    floors=min(NFLOORS,ERA_FLOORS0+c)
    depth=1+ERA_DEPTH_K0*c+ERA_DEPTH_K*max(0,c-(NFLOORS-ERA_FLOORS0))
    pmax=min(2.6,1.2+0.2*c)
    sent=SENT_ERA[min(len(SENT_ERA)-1,c)]
    corehp=CORE_ERA_HP0+CORE_ERA_HP_K*c
    coredef=max(0.4,CORE_ERA_DEF0-CORE_ERA_DEF_K*c)
    print(f'| {c} | 1〜{floors} | ×{depth:.2f} | {pmax:.1f} | {sent} | ×{corehp:.2f}{"(Lv補正は半分・上限+50%)" if c==0 else ""} | {coredef:.2f} |')
print()
print('## E. v3 構想: 2人以上で潜る時の係数(案)')
print('| 人数 | 彼女側 火力合計 | 夜側 EN上限 | 召喚頭数 | 魔物HP | 捕獲条件 | 経験値の分配 |'); print('|---|---|---|---|---|---|---|')
for n in (1,2,3):
    print(f'| {n} | ×{1+0.85*(n-1):.2f}(2人目以降は85%) | ×{1+0.6*(n-1):.2f} | ×{1+0.5*(n-1):.2f} | ×{1+0.35*(n-1):.2f} | 全員捕獲でその日の敗北。1人捕まると残りは救出か降下を選ぶ | ジェムは拾った人、討伐xpは均等 |')
print()
print('## F. v3.1 経済(エッセンス/オーブ)の1日あたり収入(逓減と世代係数込み)')
print('| 結果 | 世代 | 撃破xp(概算) | 素のエッセンス(xp×0.30) | 逓減後 | +結果の加算 | 一日の合計 | オーブ(概算) |'); print('|---|---|---|---|---|---|---|---|')
for name,era,kills,xpavg,kind,depth,orb in (('第1層 降下(205s)',0,600,3.2,'descend',1,12),('第2層 捕獲',0,1500,4.0,'capture',2,45),('第2層 魔核討伐',0,1500,4.5,'clear',2,30),('第3層 降下',1,3000,5.0,'descend',3,20),('第3層 魔核討伐',1,4000,5.5,'clear',3,60),('第5層 降下',3,6000,6.5,'descend',5,40),('第7層 魔核討伐',5,12000,8.0,'clear',7,120)):
    raw=kills*xpavg*ESS_RATE; soft=ess_soft(raw)*(1+ESS_ERA_K*era)
    bonus={'descend':DESCEND_ESS+DESCEND_ESS_DEPTH*(depth-1),'capture':CAPTURE_ESS,'clear':CLEAR_ESS+CLEAR_ESS_ERA*era}[kind]
    osoft=ORB_SOFT*math.log(1+orb/ORB_SOFT)
    print(f'| {name} | {era} | {kills*xpavg:,.0f} | {raw:,.0f} | {soft:,.0f} | +{bonus} | **{soft+bonus:,.0f}** | {round(osoft*(1+ORB_ERA_K*era))} |')
print()
print('読み方: 解放の総額は 魔物 15,294 + 陣形 1,580 + 夜側アイテム 2,390 + カード強化 約25,000 ≒ 44k。一日 460(第1層)〜4,600(世代5の討伐)なので、浅いうちは 40日分・深くなると 10日分の勘定になり、ならすと 30日前後。祭壇は全段で 848 オーブ(一日 12〜180)。')
print()
print('注: 逓減の S は「その日の長さ」に比例する(S=ESS_SOFT×秒/200)。上の表は 200 秒の一日を基準にした値で、早々に撤退して短い日を積んでも毎秒あたりの実入りは変わらない。')
