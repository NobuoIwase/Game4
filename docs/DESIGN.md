# 設計仕様 — ルミナ・サバイバーズ v1.4「侵蝕デッキ」

システム面の設計メモ。数値はすべて暫定で、`js/data.js` の `BAL` / 各定義テーブルに集約してある。

## 1. コンセプト(確定事項)

- ヒロイン(ルミナ)は**ゲーム内AIが完全制御**。プレイヤーは操作しない
- プレイヤーは**モンスター側**。ただし直接操作ではなく、**事前に組んだデッキから設置・召喚**して差し向ける
- ヒロインはヴァンサバ同様、武器/パッシブをレベルアップ・宝箱で獲得し、**融合**で強化される
- プレイヤー側に戦闘中のレベルアップはない。**モンスターと出現方法(陣形)を選んでコストを支払う**
- ヒロインに魔物が倒されるとエネルギーが増える。彼女の成長(Lv)に応じてEN上限も上がり、
  強い魔物・大きな出し方が戦闘中に可能になる
- ヒロインは非常に強力(高い護り+回復)。**初期状態ではダメージがほぼ通らない**。
  プレイヤーは周回でエッセンス→解放/強化/融合、オーブ→初期状態の書き換えを進める
- **数戦(GEN_LEN=4)ごとにヒロインの戦闘経験はリセット**され、常に新鮮な状態と戦える。
  例外として**オーブによる書き換えだけが世代を跨いで永続**する
- オートプレイあり(既定ON)。放置観戦でも進む

## 2. ループ構造

```
[ホーム] → 出撃 → [5分戦闘] → リザルト → 研究所/祭壇/編成 → 出撃 …
                     │
                     ├ 彼女が魔物を倒す → EN還元 + エッセンス + 彼女のXP(リスク)
                     ├ 与ダメ90ごと/異常付与ごと → オーブ片
                     └ HP0 → 捕獲(オーブ大) / 5:00生存 → 彼女の勝ち(エッセンスボーナス)
世代: 4戦で経験リセット(世代内は装備・HP・護りを継承して強くなる)
```

飼い慣らしのジレンマ: 魔物を撒くほど経済は回るが、彼女に経験値を与えて育ててしまう。

## 3. 状態系(機構仕様)

idは汎用カタログ準拠。効果はすべて数値・挙動レベルで表現する。

### 3-1. 四肢拘束・スタミナ・押し倒し(v0.3の芯)

- 拘束役(地上ワーム=絡みつき / 触手花・大触手=蔦の繋留)が接触すると、
  **空いている四肢スロット(armL/armR/legL/legR)に個別に付く**。腕=攻撃レート×0.75/本、
  脚=移動×0.72/本、護り-1/箇所、被ダメ×1.3。蔦は半径内へ引き戻す繋留付き
- **抵抗ゲージ**: 移動距離と攻撃で蓄積(発情中×0.7)。満了で最古の1体を引き剥がす
  (**スタミナ-14**、剥がされた個体は弾き飛ばされ35%損耗)。ノヴァ等で直接倒しても外れる
- **スタミナ**: 100(祭壇で減少)。拘束なしで回復3.5/s(発情中1/s)。2箇所以上拘束で1.5/sじわ削り
- **押し倒し**: スタミナ35未満で新たに拘束されると発生。移動・攻撃不能、
  0.8sごとにもがき(スタミナ-6/脱出+18)、脱出100で全て振りほどき復帰(無敵1.2s)
- **敗北=捕獲**: HP0 または スタミナ0(拘束・押し倒し中)。敗因はリザルトに表示
- 遅く弱い敵(ナメクジ/ワーム/ガス玉)は**警戒半径が極小**——彼女は近づくまで脅威と見なさず、
  油断(回収・燭台破壊・交戦)に付け込んで取り付く

### 3-2. 敏感化・快感・発情(v0.4で三層に分離)

媚薬は即座に快感を生まない。**媚薬=敏感化 → 刺激=快感 → 快感100=絶頂 → 発情昇段** の四層(v0.6)。

**絶頂(v0.6)**: 快感100で3.4秒の絶頂硬直。移動・攻撃・抵抗蓄積・スタミナ回復が完全停止、
押し倒し/魅了拘束中なら脱出・正気ゲージの伸びが×0.25(身体が言うことを聞かない)。
魔物は駆け寄る(rush)。台詞は絶頂→痙攣→余韻の3段階+画面下のシーンテキスト巡回。
潮吹き率=35%+20%×発情Lv+12%×敏感Lv——吹くと**地面に染みが70秒残る**。
終了後に従来どおり発情レベル+1(快感40へ)。回数はリザルト・観測記録に記録される。

**台詞の優先度(v0.6)**: 0=平常のおしゃべり/1=状態変化/2=エロ状態/3=絶頂・拘束の核心。
高優先の台詞は言い終わるまで潰されず、エロ状態中は平常のおしゃべり自体を封じる。

| 層 | ゲージ | 源 | 機構 |
|---|---|---|---|
| **敏感化 sens** | 0-100(Ⅰ25/Ⅱ55/Ⅲ85)減衰1.1/s | ガス雲(+8/s)/霧香の跡/ナメクジ接触+6/祭壇(下限化) | **快感の入りを増幅**(+35%/Lv)。それ自体はデバフしない |
| **快感 aphro** | 0-100・減衰0.6/s | 吸液羽虫(+2.6/s/体)/小淫魔(+2.2/s)/絡みつき(+0.7/s/体)/押し倒し拍(+4)/魅了拘束(+5/s)/ガス雲微量 | 100到達で**発情レベル+1**、ゲージ40に戻る |
| **発情 heat** | Lv0-3・1段階20s(切れると1段降下) | 快感100 | 常時: 集中・速度・スタミナ回復・もがき低下(Lv比例)。**定期的に波**が来る(間隔9-1.5×Lv秒、持続2+0.8×Lv秒): 攻撃レート×0.55・速度×0.7・ふらつき。**Lv2+の波中は最寄りの魔物へ自分から寄っていく** |

### 3-3. 魅了(v0.4で種族別・レベル制に)

**魅了は「どの種族に」惚れているかを種族(モンスターid)ごとに持つ**。魅了役の接触(個体CD6s)でその種族への段階が上がり、**同じ種族ならどの個体にも効果が及ぶ**。持続16s(重ねがけで更新、切れると1段降下)。

| Lv | 機構 |
|---|---|
| Ⅰ | その種族への**与ダメ-25%**・狙い後回し・脅威認識低下 |
| Ⅱ | -50%。加えて**発作**: 6.5sごとに約2.4s、その種族の**最寄りの個体**へ無意識に歩み寄ってしまう(個体が倒れれば次の個体へ) |
| Ⅲ | -75%。発作中にその種族の個体へ触れると**魅了拘束**——自分から縋りつく特殊拘束。相手が一体でも成立。移動攻撃不能・被ダメ×1.3・快感+5/s・0.9sごとスタミナ-4/正気+15。正気100で我に返り振りほどく(**種族への魅了ごと消滅**)。**スタミナ0で敗北(敗因: 魅了)** |

- 縋りついていた個体が死ぬと拘束は解けるが、**種族への魅了は時間まで残る**(場に個体がいなくても状態は持続)
- 耐性: 拘束/魅了は受けるたび一時耐性(時間減衰)。祭壇「感応増幅」senseが全効果を深くする
- 蔦の締め上げ(dot)は護り貫通

- v1.5: 段階は接触で即時に上がるのではなく、種族ごとのゲージ(100)が閾値を越えたら一段上がる(3-10)

### 3-4. その他の状態

| id | 名 | 付与元 | 機構 |
|---|---|---|---|
| slow | 粘液 | スライムの跡 | 速度55% |
| suck | 吸い付き | 吸液羽虫の接触 | 下記3-5 |

### 3-5. 吸液羽虫の吸い付き(四肢拘束とは別枠)

- スロット3: **胸(左)/胸(右)/秘部**。**拘束状態を問わず**空きに取り付く(押し倒し中でも)
- 1体あたり: 快感+2.6/s(敏感化で増幅)・移動×0.93(最大3体で×0.80)
- 護り減・攻撃低下・押し倒し判定には**関与しない**(拘束ではなく「圧」)
- 引き離し: 通常の抵抗ゲージと同列(必要45・スタミナ-7)。ノヴァ等の直接撃破でも外れる

### 3-7. v1.2 状態異常拡張(『放置系エロトラップダンジョン』を着想元に再構成)

- **寸止め** `denyT`: applyPleasure が快感を99で止め、切れた瞬間 `releaseDeny()`。快感≥85なら `deepClimax`
  (硬直×DEEP_MULT・潮確定・スタミナ×1.8・終了時 heatUp 二回)。付与は寸止めの淫魔(8秒ごと・130px・快感35以上)。
- **疼き**: 寸止め中/発情Ⅲ中、ACHE_CD ごとに ACHE_PLEAS。
- **痺れ** `numbT`: 攻撃×0.5・移動×0.75。痺れ浮遊子の接触。
- **憑依**: attachMonster(kind 'possess', armsOnly)。腕だけに付く。condTick で 1.2/s×練度の快感、armCount で攻撃×0.75。
- **視姦** `watchedT`: 覗き目玉が視界内320px以内にいる間 0.3s ずつ延長。快感×1.2、絶頂時に `B.filmed`/`META.life.filmed`。
  目玉は170px以内なら離れ、260px以上なら寄る(撃ちにくい)。6秒ごとの凝視で敏感+5。
- **淫紋** `crestLv`(戦闘中持続・最大3): 快感×(1+0.15Lv)。淫紋の罠で+1。
- **時間停止** `freezeT`: 移動/攻撃/もがき停止、ifr=0で触られ放題。快感は `frozenAcc` に蓄積→解除で×1.3。
- **触手服** `suitT`: 25秒。SUIT_PULSE ごとに SUIT_PLEAS、敏感+1.2/s、移動×0.85。
- **おねだり** `begT`: 発情Ⅲ かつ(催眠中/淫紋Ⅱ+/絶頂直後)で、CD12秒。2.5秒間 攻撃0・最寄りの魔物へ操舵0.9。
- **淫糸の巣**(設置物 `web`): 接触で空いた四肢すべてを tether(r36)。HP160・40秒。壊せば解ける。

### 3-8. v1.3 回り込み・催眠Lv・強制絶頂・雄臭

- **回り込み**: enemiesUpdate で `spd>0 && d>REENTER_D(780)` の個体を、彼女の進行方向±1.1radの REENTER_R(560)へ移動
  (同一個体・seenTリセット・召喚FX)。本家の「画面外の敵が前方から再登場」の再現。動かない設置物は対象外。
- **ゲイザー種** `gazerEyes(e)` で単眼/多眼を同じ形に: 各眼 idle→aim(GAZE_AIM=1.6s・扇=GAZE_R×GAZE_ANG を表示・
  中心線は1.1rad/sで追従)→flash(0.28s・`inSector` なら `applyHypno`)→cd(GAZE_CD)。ボスは3眼を1.9s間隔でずらす。
  aiDecide は aim 中の扇と照射の照準線に避け力を足す(`dodge=foc×(1-0.25×hypnoLv)`)。
- **催眠Lv** `hypnoLv`(30sで-1): 集中×(1-0.12Lv)・思考間隔×(1+0.35Lv)。Ⅱ+ addStruggle×0.35・pinEscape×0.35・
  もがき操舵×0.15。Ⅲ addStruggle/pinEscape=0、`selfT`(SELF_DUR 3.2s、SELF_CD 9s)で移動/攻撃停止+快感2.6/s。
  本人は催眠を自覚しない(台詞は「光った」まで)。
- **強制絶頂** `forcedClimax(src)`: beamer が aim(BEAM_AIM 0.5s・照準3.2rad/s追従)→fire。光条(BEAM_LEN 300・BEAM_W 14)
  との点-線分距離で命中判定。命中で aphro=100→enterClimax(寸止め中でも)。
- **雄臭** MONSTERS.goblin.musk: statesTick で最寄りのゴブリンが MUSK_R(64)内なら `muskNear`。発情0かつ性癖0なら嫌悪台詞のみ。
  発情中/性癖ありなら `sniffT`(MUSK_SNIFF 1.6s×(1+0.2Lv)・移動/攻撃停止・快感1.2/s)。性癖Lvぶん近接快感0.8Lv/s。
  嗅いでいる間(または発情中の匂い圏)に快感が上がると `muskCond` に積み、25で `conditionMusk()`→ META.traits.musk+1(永続・最大3)。
  匂い圏での絶頂も即条件付け。観測記録の「身についた性癖」カードと称号に反映。

### 3-9. v1.4 描き込み(グラフィック。3案の審査パネル→統合案を実装)

- ルミナ原本: `assets/sprites/lumina_hd.png` 160×240(`tools/paint_sprite.py`。事前乗算LANCZOS縮小・アンシャープ・金色止め・
  瞳の濃紫化+キャッチライト・左上リム/右下AOの焼き込み・下45%の地明かり・0.75論理px相当の青み縁取り)。
  実行時は `luminaVariants()` が端末の実ピクセル寸(dpr×viewScale、0.25刻み)へ一度だけ縮め、normal/heat/climax/hurt の
  色変種を `source-atop`/`lighter` で焼き置く(毎フレームの `ctx.filter` は廃止)。約60px高で描画、光輪のにじみ `HALO_ST` を
  `lighter` で1回ブリット、二層の落ち影は歩きの浮きで内側が縮む。'pixel' は35×52ドット版(色変種も同じ仕組み)。
- 魔物の合成 `renderShaded`(焼き時のみ): 本体 → `source-atop` の縦AO(足元へ紫0.26) → 色トレス線(`OUTLINE_COL`=EN_COLORS[id][1]を
  #2a1a3e へ40%混ぜ輝度≤90、精鋭は金)を四方1px → 本体 → 影の帯2段(本体マスクから左上へずらした本体を `destination-out` で引く。
  広く淡い0.22/狭く硬い0.50、半透明種は半分)→ 左上のリム。ボスは `OUT_CV` へ毎フレーム同じパス。
- キャッシュ `SPR_CACHE`(上限900): キー=種族|半径|精鋭|個体差 `e.vari`(0..2、召喚時に決定)|状態|位相(16コマ/2秒)。
  1フレームの焼きは `BAKE_MAX=6` まで(超過分はその1フレームだけ素描き)。`startBattle` が `G.prebake`(デッキ種族×16位相×3個体差)を
  積み、`prebakeStep()` が毎フレーム消化。被弾フラッシュは焼いた絵の白シルエット(`flashOf`)。
- 生きた重ね `MON_OVER`(gfxLv 2 のみ): ゴーストの瞳(彼女の方向)、小淫魔/淫魔の頰と接近時のハート、目玉/ゲイザーの瞬き。
  `tq(e)` で焼いたコマの時刻に合わせる。
- 自動品質 `fpsGuard()`: 40fps未満が2秒続くと `G.gfxLv` を1段下げる(2 全部 / 1 重ね無し / 0 位相8コマ・個体差無し)。
  55fps超が8秒で戻す。`META.settings.gfxAuto=false` で固定。ベンチ(260体・全種・ウォーム)で v1.3 と同じ描画時間。
- 個体差の描き分け: ゴブリン(顔3種・腰布2色・頭の丸み・黄みの白目)、ナメクジ(色味3種・半眼・涎・背の光沢・足の濡れ帯・ハートの縁)、
  ゴースト(裾が溶けるグラデ・魂の芯)、媚蛾(翅脈・眼状紋の色3種・胴の毛)、目玉系(下瞼の陰・glow()で shadowBlur 廃止)。

### 3-10. v1.5 学習・魅了ゲージ・ゲイザー再調整・照準の可視化

- **学習** `META.gen.know[id]={met,cap}`(世代リセットで消える)。`learn(id,'met'|'cap')` は codexMet / 敗北(capturedBy)から呼ばれる。
  `knowLv(id)` = (met≥1)+(met≥KNOW_MET2 4)+(cap≥1 or met≥KNOW_MET3 8) + (codexStage≥2 なら+1)、上限3。KNOW_NAMES 未知/認識/理解/熟知。
- aiDecide の間合い: `base = kl===0 ? 120 : SPEC_DANGER[id]`、`danger=base×(kl3かつ脅威3なら1.35)+r`、重み `×(1+0.35×脅威)`(理解以上)。
  扇/照準線の回避 `dodge=foc×(1-0.25hypnoLv)×(kl1なら0.5、kl0なら0)`。理解以上の脅威3(SPEC_THREAT=3)が狙っている間は `strong`:
  周囲の脅威ベクトル×0.4、操舵を `dx×0.3+回避方向×1.2` で上書き(state 'dodge'・p.dodging 0.5s・ラベル「よける!(おぼえてる)」)。
  熟知した動く脅威3には260px以内で先回りの距離取り。`nearestEnemies` の優先度 `d-(kl≥2 ? 脅威×90 : 0)`。`nearKnownTrap` で理解以上の罠(TRAP_SPECIES)のそばのジェムを諦める。
- **魅了ゲージ** `applyCharm(mon, amount)`: 種族エントリ `{id,lv,g,t}`。`g += amount×sense÷res`(既定 CHARM_SLUG 45、女王 CHARM_QUEEN_PULSE 55 / TOUCH 40)。
  `g≥CHARM_GAUGE(100)` で `lv++`(旧来の段階効果・台詞・耐性)。charms tick で `g -= CHARM_DECAY(5)/s`、lv0 かつ g≤0 で消える。ナメクジ個体CD 6→2.5s。
- **ゲイザー** GAZE_R 180→240、GAZE_ANG 1.25→0.8、gazer は tier 'mid'(cost5, unlock420, hp70, spd32)。ボス眼: r=GAZE_R+GAZE_BOSS_EXTRA(130)、
  眼柄先端 `dx=cos·r·1.9, dy=sin·r·0.8-r·1.7`。`eyeCycle` の aim 開始時に `ey.off = scatter×rand(0.45,1.0)`(中央0・脇±)、追従は脇 0.5rad/s・中央 1.5rad/s。
- **照射触手** BEAM_AIM 0.5→1.0、追従 1.2rad/s、`bmT>0.25` の間だけ追従。照準線は drawBeamer から外し `drawSightSectors` でワールド座標に描く
  (BEAM_W の淡い帯+破線+最後0.25秒の白線)。焼き鍵から q8(bmAng) を除去。
- **焼き解像度** `gfxK()=clamp(ceil(dpr×viewScale-0.1),1,2)`。renderShaded(cg,e,R,S,oy,k) は本体を k 倍で描き、合成(AO/トレス線/帯/リム)は実ピクセルで
  行う(ずらし量×k)。SHADE/SIL/OUT は 512²。焼き canvas は S·k、置くときに S へ縮める。鍵に k を含める。k=2 のとき SPR_CACHE 上限 900→520。
  `makeIconCanvas` は dpr 倍の canvas に描き、`drawEnemyShaded(g,e,k)` に拡大率ぶんの k を渡す。ガス玉(膨らみ4段)と女王(溜め4段)を鍵に追加。
  キャッシュは LRU(触った鍵を Map の末尾へ。FIFO だと2秒周期の位相が戻る前に消えて焼き直しが止まらなかった)。鍵の vari は個体差で絵が変わる
  3種(goblin/slug/moth)だけ(他種は3倍の無駄)。`thrashGuard()`: 焼き予算が45フレーム使い切られ続け、かつ満杯なら `G.kCap=1`(その戦闘は1倍焼き)。
  fps ガードで gfxLv≤1 のときも1倍。prebake は上限の85%で止める。
  目玉系(gazer/eye)の虹彩・瞳と照射触手の水晶は焼かずに `MON_IRIS` が毎フレーム生で重ねる(`NO_IRIS` フラグ・`drawIris`/`drawBeamerCrystal`)。
  視線 q8 が鍵から消えて鍵空間が1/8になり、瞳は8方向の量子化ではなく滑らかに彼女を追う。
- **手記の見た目** `noteHtml`: `~~x~~`→`<s class="scr">`(追記三は `.hard`)。CSS は SVG data-URI のループ線(26/22px周期)2層、hard は 14/11/17px の3層+斜線で塗り潰し。
  直後の文は `.scrawl`(Yomogi・rotate(-3.5deg) skewX(-7deg)・∧印)。`※`行は `.margin`(手書き・傾き)。`note.title` があれば手記の見出しに使う(ゲイザーは「目玉のやつ」——本人は催眠の語を書けない)。
- **客カードの帯** `UI.buildHand` が temp 札を `#guestrow`(`.gchip` 48×58・横スクロール・「客 N」ラベル)へ分け、`handEls()` で両帯を走査。
- **敗北の帰属** `beginCapture`: ボス個体に倒された時以外、直前6秒の `lastBeam`(forcedClimax)→ beamer、催眠Ⅱ以上かつ25秒内の `lastHypno` → gazer/bossgazer を capturedBy にする。
  `enterPin` も催眠Ⅱ以上なら催眠源の pin 場面を選ぶ(pinBy は実際の個体のまま)。これで SCENES.capture.gazer/beamer と pin.gazer/bossgazer に到達できる。
- **雄臭の条件付け(修正)** 嗅ぐ/性癖/自慰の applyPleasure は差分を `aphroPrev` に足して除外(他から受けた快感だけ muskCond に積む)。
  匂いの外では muskCond が 3/s で薄れる。絶頂経由の結びつきは `sniffT>0` または `muskCond≥12` を要求。

### 3-11. v1.6 催眠ゲージ・雄臭の雲・発情ゲージ・抵抗の意志・ボスの規則と呪い

- **催眠ゲージ** `h.hypnoG`: applyHypno は `HYPNO_GAIN[lv]=[100,55,34]×(1-0.015×意志)` を足し、100で `hypnoLv++`(残りは持ち越し)。
  Ⅰは一発、Ⅱは2回、Ⅲは3回。雲の外で `HYPNO_DECAY 4/s` 減衰。100未満は「……あ、ひかっ……」の小反応だけ。`SPECIES_MAX={gazer:4}`
  を canPlay/playCard で見る(頭数は上限まで丸める)。GAZE_ANG 0.65。
- **雲=発情ゲージ+敏感化** statesTick の雲判定: gas 種は `applySensit(rate)`+`addHeatG(HEAT_GAS 9/s)`、快感は直接足さない(PLEAS_GAS=0)。
  `addHeatG` は 100 で `heatUp(false)`(絶頂経由と違い aphro を動かさない)。雲の外では 1.5/s 抜ける。
- **雄臭の雲** MONSTERS.musk の個体は彼女から300px以内で `MUSK_CLOUD_CD 2.0s` ごとに `spawnCloud(...,'musk')`(r56・5.5s、場の雄臭雲は14まで)。
  雲の中(`h.inMusk`): 敏感化×(1+0.3Lv)、発情ゲージ `MUSK_HEAT 8/s×(1+0.35Lv)`、発情中なら `muskCond += MUSK_COND 1.7/s`、25で性癖+1。
  雲の外で muskCond は 2/s 薄れる。嗅ぐ発作(sniffT)は廃止(フィールドは残置)。ゴブリンの王の雲は r90・`c.boss` 付き(呪いの帰属)。
- **抵抗の意志** `META.lumina.will`(0..WILL_CAP 20): 敗北 +WILL_CAP_GAIN 2(+WILL_FAST_GAIN 1 if 60秒以内)、生存 -1。
  newHero: maxHp×(1+0.03will)×gsc、dmgMult×(1+0.02will)×gsc、staminaMax+1.5will(gsc=1+GEN_SCALE 0.03×min(10,世代-1))。
  addStruggle/pinEscape: 催眠Ⅲの係数 0→0.02will、Ⅱは 0.35→0.35+0.5×0.02will、全体×(1+0.02will)。applyCharm/applyHypno のゲージ入り×(1-0.015will)。
- **ボスの規則** canPlay: `bossPlayed[id]`(1戦1回)→ `bossCd`(BOSS_CD 60s)→ 場にボスが居れば不可。TIER_CAP.boss=2。手札は '出撃済'/'次まで○s'/'交代待ち' を表示。
- **ボス敗北の呪い** `B.bossMark={id,t}` をボスの hurtHero/applyHypno/applyDeny/雲/呑み込み/呪弾/伏せ紋で更新。endBattle: とどめがボス、または bossMark が直前8秒なら
  `META.curse={id,left:CURSE_DAYS 2}`。毎戦 left--。newHero で適用: dreamtree(敏感化下限+20・curseAmp 0.10) / bossgazer(hypnoG 40・思考×1.15) /
  vampi(スタミナ-15・振りほどき×0.85) / slimeking(下限+15・粘液の鈍足 0.55→0.42) / runemage(淫紋Ⅰ・curseAche=疼き常時) / succuqueen(発情Ⅰ・おねだりⅡから) / gobking(雲の効き×1.5)。
- **新ボス4種**: slimekingTick(粘液の帯 trails r20/6s、接触で tether×2 `needMul 1.6`+敏感化12+slow1.5、CD7)、runemageTick(170〜330の間合い、4.5sごと `B.ebullets` 呪弾 210px/s
  →runeHit: 淫紋+1・快感12・敏感化6、13sごと伏せ紋。呪弾は knowLv≥1 なら横へ避ける)、succuqueenTick(半径130を周回、6sごと pulse: `addHeatG(45)`+発情中 `applyDeny`、口づけ CD5: 敏感化10+発情20、15sごと小淫魔2)、
  gobkingTick(bossChargeTick+1.8sごと雄臭雲 r90+9sごとゴブリン3)。
- **包囲円陣** spawnCountFor: `ringMul = spd 0→1.6 / <30→1.35 / <45→1.0 / else 0.7`、半径 380/285。**ロージェム** `logemMul(n)`: LOGEM_CURVE を線形補間、値=`xp×0.8×mul`(下限0.4)。
  召喚(gemMul 0: 小淫魔・呼び笛・伏せ紋の手など)は従来の 0.5 のまま。**燭台** PROP_INIT 9 / PROP_RESPAWN 16 / PROP_MAX 12。
- レビュー修正(v1.6.1): detachLimb は同じ個体が別の肢を掴んでいる間は離さない(粘獣王の2本呑み)。ボスの振りほどき減HPは 35%→5%。
  種族上限は spawnCountFor 内で丸め、playCost も頭数比で削る(ゲイザーの包囲は表示も費用も実頭数)。呪い『残光』は Lv0 の間ゲージ40を下限に。

### 3-12. v1.6 地形マップ(実験)

- `genMap()`(startBattle): 種 `1000+世代×7919`。13サイト(moss×3, damp×2, water×2, flower×2, hotspring, ruin×2, nest)+中心の moss をボロノイ風に割り付け
  (境目を hash2 で±55px 揺らす。nest は中心から 0.78 の縁)。`G.map.zone`(Uint8Array 56×36)。POI: 祠3(中心から520px以上)、泉2(1つは温泉帯)、門1(巣)。
  `META.map={gen,known,visited,gateProg,gateDone}` は世代が変わると作り直す。
- 描画: `TILE_ATLAS`(地形7×3種、起動時に描く)を `drawTiles` が敷く。外は闇+岩壁。`drawPoi`(祠/泉/門・知っている場所には名札)、`drawMinimap`(左下、G.map.mini を1px/タイルで焼く)。
  カメラは main.js で ±MAP_HW-W/2 に clamp。彼女・魔物・燭台・宝箱は `clampMapX/Y`。召喚位置と回り込みは `placeNear`(端では内側へ折り返し、壁に丸めて彼女の真横に落とさない)。
  門の突破後の位置は `META.map.gatePos` に保ち genMap で再適用(巣に置けなければ遠い場所)。目的地の見直しは戦闘時刻ベース(6秒)、探索点は30秒。
  POI が置けない種は地形帯の中心へ(門=巣の中心、泉=温泉の中心)。
- AI: aiDecide の宝箱→(**目的地**)→ジェムの順。`pickDest`: 知っている(見えた)祠(未訪問)/泉(HP<70%)/門(gateAllowed: 2日目以降 or 理解3種)から最寄り、無ければ
  探索点(600〜1200px先・未知POIの近くほど高得点・30s or 到着で置き直し)。近く170pxにジェムがあればジェム優先。端150px以内は内側へ寄る力。
- `poiTick`: 見えたら `known`(「みつけた: 祠」)。祠 34px で自己強化1段+コイン30(`visited`)。泉 40px・HP<80%・CD60 → `bathT 3.5s`(停止・HP14%/s・敏感化5/s・発情10/s)。
  門 70px 内で `gateProg += dt`、3sごとに巣の守り2体、12sで突破(コイン80・意志+1・門は別の場所へ・known リセット)。
- 地形の恩恵: spawnUnit で `u.spd0` と `zoneMonHp`(damp: slug/leech/worm/slimeking ×1.25、nest ×1.15)、毎フレーム `e.spd=spd0×zoneMonSpd`(water: slime系×1.3、ruin ×1.06、nest ×1.1)。
  彼女: heroStat water×0.88 / ruin×1.06、statesTick flower 敏感化0.6/s、hotspring 敏感化1.2/s+発情2/s+回復×1.5。花園の gas 雲は rate×1.2・r×1.1。

### 3-13. v1.7 ダンジョン風マップ(js/map.js)

- 定数 MAP_T 32 / MAP_W 112 / MAP_H 72(世界は 3584×2304 のまま)。地形帯は v1.6 と同じボロノイ風(揺らぎ±55px)。
- **壁** `G.map.solid`(0 床 / 1 岩 / 2 崖): 外周2タイルの岩、塊30個(rx 2.5〜7.5・ry 2〜5.5タイル、中心から13タイルは空け、塊の間は4タイル以上、40%が崖)、
  崖の稜線6本(太さ2、9〜12タイルごとに5タイルの切れ目)。孤立1タイルは消す。中心からの到達性を floodReach で確かめ、届かない床は最寄りの届く床へ幅3で掘る(40回まで)。
  場所(祠/泉/門)は届く床に置き、周り5×5を空ける。門の保存位置は床であるときだけ採用。
- **通行** `passIJ(i,j,fly)`: 崖は FLYERS(ghost/moth/imp/succubus/succuqueen/eye/gas/spore/ghosthand)だけ通れる。`collideMap(o,r,fly)` は3×3の壁タイルから円を押し出す
  (中心が壁の中なら snapFloor)。彼女は毎フレーム `collideMap(p,p.r+2)`、魔物は tick 後と押し合いの後に `collideMap(e,e.r*0.75,canFly)`。
- **流れ場** `bfsField` を彼女のタイルが変わるたび(最短0.35s)に地上/飛行の2枚(8方向・角すり抜け禁止・0.3ms)。enemiesUpdate は `losClear` が偽なら dx,dy を
  `flowDir` の向きに置き換える(以降の追跡・照準はその向き)。遠く(320px超)で3秒動けない個体は `placeNear` で置き直す。
- **視線** `losClear(x1,y1,x2,y2,fly)`: 10px刻みで壁を見る。岩は視線を遮り崖は遮らない(fly=true)。inSector と照射の命中に適用。
- **経路** `findPath`(A*・8方向・壁際+0.9・地形コスト・7000展開まで・約2.5ms)。`steerTo(p,tx,ty)`: 見えていて地形コストが無ければ直進、
  そうでなければ経路を1.5秒キャッシュし、見える限り先の点へ(string pulling)。aiDecide の目的地(祠/泉/門/探索/宝箱/燭台/ハート/品/ジェム)に使う。
  壁から離れる力 `wallPush`(42px)を操舵に足す。詰まり(進みたいのに 0.25×速度未満が1.2秒)→ `unstickT 2.5s` の間は探索点へ経路で歩く。
- **配置** `placeNear(px,py,dx,dy,m,fly)`: 望む点が壁/届かない/近すぎ(0.6×距離未満)なら、同じ距離で角度を±0.45…±2.2,π とずらし、次に距離0.8倍、
  最後は届く床の遠い点。`spawnUnit` は snapFloor(4タイル)。燭台・宝箱も床に。
- **地形の学習** `META.gen.zoneKnow[z]`(3で1.0): 浅瀬 0.5/s、花園・温泉 0.35/s。`heroZoneCost` = water 2.4k / flower 1.3k / hotspring 1.8k を A* の
  タイルコストに足し、`zoneAvoided`(≥1.2)の地形のジェムは諦める。覚えた瞬間「学習: 浅瀬は避ける」。世代で忘れる。
- **描画** `TILE_ATLAS`(地形7×4変種+岩4+崖4、32px)。`renderChunk`(8×8タイル=256px)に基底チップ→境目の帯(浅瀬=砂+水際線、巣=肉+明るい縁、
  湿地=泥、温泉=石の縁、石畳=縁石、苔⇄花園=草)→壁の影(上の壁が濃く長い)→壁の面(下が床なら9px)と崖の縁の明かり。`drawTiles` は見えるチャンクを
  1フレーム2枚まで焼き(未焼きは地形色だけ)、`prewarmChunks` が開幕に彼女の周り5×3枚を先に焼く。ミニマップは1px/タイルで岩・崖も描く。
  地形帯に入ると「— 花園 —」の浮き文字(4秒に1回まで)。

### 3-14. v1.7 魔物同士の当たり判定・ボスの強化・オート指揮

- `separateEnemies`(enemiesUpdate の末尾で2回): 48pxの空間ハッシュで近い組だけ見て、`want=(r1+r2)×0.82` 未満なら重なりを質量比(r²、ボス r²×8、設置物と動かない種は∞=不動)で
  押し戻す。潜伏中・四肢に付いた個体は除く。押した後は壁の当たりを取り直す(押し合いで岩に入らない)。`heroSeparate`: 彼女の中心から `(e.r+p.r)×0.62` 未満には入れない(接触判定 r+r の内側なので接触は成立)。
  220体を密集させても 2.5ms/フレーム。
- ボス HP ×1.6(1300〜1750)、xp 90。killEnemy で `bossChest` を落とし、`openChest(true)`: 全回復・xp+0.9必要量・強化2つ(進化が揃えば進化+1つ)。
  TIER_CAP.boss=5(1分ごとに1体出せるので5体まで編成)。
- autoDirector: 開幕20秒以降、出せる条件(同時1体・60秒・未使用)が揃ったボスがあれば即出す。ENが足りないだけなら `saving` にして任意の小技(コンボ継続/ガス/羽虫/ナメクジ/目玉/小淫魔)を控える。
  大型は25秒以降、場の大型が手札の大型枚数(最大2)より少なければ精鋭/双璧で置く(EN余裕+2)。

### 3-15. v1.8 地形の意味(資源と場所)

- 地形帯ごとに「彼女がそこへ行きたくなる理由」を置く(`ZONES[z].her` に一行、地形帯に入った合図の下に出す)。
  - 資源(`B.picks`、`PICK_DEF`): 光茸(苔・初期4・30秒ごと上限5)、蜜の花(花園・初期3・25秒ごと上限4)、沈んだ宝(浅瀬・28秒ごと上限2)。`randZoneSpot` で地形帯の届く床に置く(彼女から 260〜1500px)。
    触れれば拾う。光茸: xp+必要量の6%、`revealAround(900)` で場所/資源/宝箱を「知っている」に。蜜の花: スタミナ+45・HP+10%・敏感化+8。沈んだ宝: xp+必要量の35%・コイン+25。
  - 場所(POI 追加): 清水×2(湿った洞)・石碑×2(石畳の回廊)。清水: `poolWant`(敏感化≥35 / 発情ゲージ≥45 / 粘液 / 快感≥40)のとき 2 秒浸かる(足が止まる・撃たない)
    → 敏感化-30・発情ゲージ-50・粘液消し・快感-15、その清水は 45 秒使えない。石碑: 2 秒読む → 出会った(`codexSeen`)種族の知識を1段進める(`learnStep`: met を次の閾値へ)+最寄りの知らない場所を1つ知る。1戦1度ずつ。
  - 巣は学習に関わらず `heroZoneCost` 0.8(門が目当てなら経路は通る)。宝箱(時限)は `randZoneSpot('ruin')` で回廊に落ちやすい。
- 見えた資源・宝箱・品は覚える(`known`)。離れても目当てにできる。

### 3-16. v1.8 目当て(updateGoal)と光の柱(イベント)

- `updateGoal(p)`: GOAL_RETHINK(3秒)ごと、または目当てが無くなった時(`goalValid`)に候補を採点。`score = worth / (1 + d/600)`。
  worth: 光の柱 3.2(宝箱)/3.0(流れ星)/2.0(光茸)/2.8(清水・欲しい時)/2.4(石碑)、落ちた品 3.0、宝箱 2.6(王の宝箱 3.0)、祠 2.2、泉 2.4(HP<45% で 3.2)、清水 2.6(敏感化≥60/粘液で 3.2)、
  石碑 1.7、門 1.3、光茸 1.1(+0.5 知らない場所が3つ超)、蜜の花 2.0(スタミナ<60% か HP<70%。それ以外 0.5)、沈んだ宝 1.6(浅瀬を避けると学習済なら 0.9)、探索 0.6(他が 0.35 未満の時だけ)。
  壁の中・知っている罠のそばは候補から外す。
- aiDecide: ハート/燭台(HP<60%)→品(480px)→箱(520px)の後、目当てを取る。`walk` = 脅威 < (急ぎなら 0.6、それ以外 0.3) かつ (歩く時間中 / 急ぎ / 170px 内にジェム無し)。
  急ぎ = 光の柱・落ちた品・score≥1.2。歩く時はジェムを「150px 内かつ進む先(内積 ≥ -0.3)」に限る。目当てがあるのにジェム拾いを 6 秒続けたら(`farmT`)、5 秒は歩く(`walkT`)。
- 光の柱(`B.event`): 30 秒後から 50〜75 秒ごと。種類は重み付き(宝箱3・流れ星2・光茸2・清水1(欲しい時3)・石碑2)。位置は彼女から 500〜1100px(宝箱は回廊、光茸は苔)。
  60 秒で光は消える(物は残る)。達成(箱を開ける/品を拾う/光茸を全部拾う/清水を使う/石碑を読む)で `eventsDone`。
- 夜側の可視化: HUD の目当てチップ(名前・八方位・距離)、画面外なら端の矢印(目当てと光の柱)、ミニマップに目当てへの点線・知っている資源・光の柱。結果画面に使った資源と光の柱の回数。

### 3-17. v1.9 画面レイアウト(縦持ち)と武器レベル上限

- レイアウト(`core.js resize`): `innerHeight > innerWidth×1.05` を縦持ちとし `body.portrait` を付ける。縦持ちでは `#stage` を縦並びにして、キャンバスを上・戦闘バー(`#battlebar`、`position:static`)を下に置く。
  キャンバスは `innerHeight − バーの高さ − 12` に収める(`ResizeObserver` でバーの高さが変わるたび合わせ直す。客札の増減・表示/非表示)。札は 46×58 の一列(横スクロール)、アイテム列・陣形列+ボタンも一列。
- 横持ち: 従来どおりバーを世界の下端に重ねるが、幅を `min(1100, キャンバス幅−24)` に広げ、札 10 枚以上は `#handrow.dense`(56×74)で一列に。アイテム列・陣形列は一列(`justify-content:safe center`+横スクロール)。
  `barCover`(バーが覆う世界px)を render/map が参照し、ミニマップはバーの上へ、拘束シーンの文章はバーの上(バーが世界の 30% を超える小窓なら上端 y=104)へ。
- 武器: `UPG[wp].max` 5→8。式の Lv は `min(5, Lv)` で止め、`wpOver(Lv)` = {dmg: 1+0.15×(Lv−5), cd: 0.93^(Lv−5), area: 1+0.05×(Lv−5)} を火力・間隔・範囲に掛ける(進化後も効く。オーブは個数=Lv、火力に覚醒)。
  進化条件は `BAL.WP_EVO_LV`(5)。全部が上限で候補が無いレベルアップは `applyPray`: dmgMult×1.04・最大HP+3%・速度+1%・回復 40。

### 3-18. v2.0 深淵(階層・一日一階層・リセット)

- `FLOORS`(data.js): 5階層。`zoneW`(地形帯の重み=ボロノイの母点数)、`wall`(rock/brick/flesh → TILE_ATLAS の行)、`en`(EN 開始/基礎/回復/上限の倍率)、`mon`(HP/攻の倍率)、`affinity`(HP×1.2 の種)、`puzzle:'seals'`、`final`。
  `META.run={floor,fails,day,clears,deepest}`。`genMap()` の種は 世代×階層(`1000+gi*7919+fl*104729`)。場所の鍵は `f<階層>:<種類><番号>`、`META.map` は世代か階層が変わると捨てる(再挑戦では保つ)。
- 一日の終わり: 捕獲 / 降り口(`stairs` POI。そばに `EXIT_STAND` 秒で `startDescend` → mode survived → `endBattle('descend')`) / 魔核討伐(`killEnemy` で `B.cleared` → `endBattle('clear')`)。時間制限(RUN_TIME)は使わない。
  `endBattle`: capture → `run.fails++`、`RUN_FAILS_RESET`(2)で `runReset()`(入口・世代+1・know/zoneKnow/trapKnow を捨てる・加護の減衰)。descend → `run.floor++`。clear → `run.clears++`・`runReset()`。夜側の報酬: 降りられた日 +60、討たれた日 +40。
- 降り口の目当て: 価値 `EXIT_WORTH + EXIT_WORTH_PER_MIN×分`(時間が経つほど降りたくなる)。HP<45% では降りない。封印の階層は3つの `seal` を灯す(各 2.5 秒)まで `exitLocked`。
- EN: `enMax = min(EN_MAX×F.en.max, EN_BASE×F.en.base + …)`、回復 ×F.en.regen、開始 ×F.en.start。魔物: `spawnUnit` で HP×F.mon.hp(得意種はさらに ×1.2)、攻×F.mon.dmg。魔核(guardian)は除く。
- 魔核 `core`(MONSTERS、guardian・カードではない): 最終階層の `core` POI に据わる。`coreTick`: 210px 内で根の鞭(0.6 秒の予兆 → 繋留 r210)、420px 内で 7 秒ごとの脈動(快感 8〜18・発情 14・敏感 4・よろめき)、520px 内で 9 秒ごとに手/ワーム(HP<50% で大触手も)を彼女の周りに生やす。被ダメ ×0.55。
- 編成: `buildDeck('random'|'auto')`(階級ごとに TIER_CAP まで。auto は得意種+10・練度で並べる)。`META.settings.deckMode` で出撃直前に `applyDeckMode()`。ホームに「ランダム編成で出撃」。
- オート指揮: ボスは `shuffle` してから出せるものを出す(固定順にならない)。
- 淫紋の知識 `crestKnow()` = max(刻印師の知識, 紋の罠に掛かった回数 1/3/6 → 認識/理解/熟知)。認識: 見える紋の罠(`B.traps`)を避ける・目当てにしない。理解: 呪弾を ×1.6 で外す。熟知: 40% で紋を払う(`runeHit`/`trapsTick`)。

### 3-19. v2.0 新種・新武器・設計された地形

- 新種(data.js MONSTERS / game.js *Tick / render.js draw*): 淫翼 `inyoku`(FLYERS。旋回 R150、swoopCd 3〜5 秒で 1.2 秒の急降下。命中で `attachMonster('cling',{armsOnly})`、holdT 1.8 秒で自ら離れる=attached 分岐で detachLimb)。
  水妖 `suiyou`(`sub`=水面下: 描画は波紋のみ・当たりなし。300px で浮上、脚に cling、絡んでいる間 p.slow 0.6 を維持。420px 以上離れ水場なら再び潜る)。肉壁の口 `mouth`(spd 0。r+p.r+14 で脚に cling(needMul 1.6)。attached 分岐で快感 5.5/s・発情 4/s・敏感 0.8/s)。
  遺跡の番人 `guardian`(spd 0。420px・視線ありで aimT 1.2 秒 → 呪弾 rune ×3(±0.22rad, 190px/s, src guardian)。`crestKnow` は guardian の知識も数える)。接触判定の除外に4種を追加。
- 新武器: 聖鎖 `chain`(1.15 秒×0.92^Lv、Lv4 で 2 本・進化 4 本。線分±16px の敵に 12+5(Lv−1)、非ボスに stun 0.55。fx kind chain)。導きの精霊 `spirit`(弾 kind spirit: 520px 内の最寄りへ turn 4/6 で曲がる、命中で splash 40/54)。
  光の盾 `shield`(向き=速度方向、弧 π(0.9+0.1Lv)、進化で全周。0.5 秒ごとに触れた敵へ 5+2(Lv−1)・呪弾は弧に入れば消える)。進化 hchain/twinspirit/aegis(ペア pierce/reach/regen)。
- 新パッシブ: reach(`nearestEnemies` の maxD ×(1+0.12Lv))、pierce(ボルト/刃の pierce +Lv)、regen(`p.regen` +0.15)。既存パッシブの max 3→5(dup 3)。
- 設計された地形(map.js genMap 内、稜線の後・孤立壁の掃除の前): `ridgePath`(幅3の床+両側幅3の崖、L 22〜27、先に半径3.2の袋小路→ `feat.shrines`)、`causeway`(浅瀬の楕円 rx8〜11×ry5〜7 と1タイルの床の道、島中心の3×3を湿地→ `feat.pools`)、
  `arena(ci,cj,r,ring)`(半径 r の床+幅2の輪、角 0.3/3.4 rad に切れ目)、`mazePocket`(9×9、偶数格子を 75% 岩、外周 78% 岩→ `feat.seals`)、`throat(endI,endJ)`(L26 の曲がる道、幅3床+両側岩)。
  型の位置は `freeSpot`(出発点から 16〜26 タイル以上、型同士は重ねない)。降り口/魔核の間は `feat.exit` の闘技場中心に `place(kind,null,0,at)` で置く。到達性の掘削は従来どおり後段で保証。

### 3-20. v2.0 物語の器(js/story.js)

- 本文は `docs/STORY.md`(『眠らない灯 ― 街の夢の病』)に基づき、提案3案→審査2名→統合→執筆2名→校閲のワークフローで書いた。`STORY={prologue, floors[5]{intro,enter,descend}, retry, finalEncounter, ending, reset}`。
- 出し方: 初回出撃=序章+第1層導入(`META.run.storySeen.prologue`)。階層の導入は潜行中1度(`storySeen['f'+depth]`、`runReset` で消える)。敗北の翌朝(`run.fails>0`)は再挑戦の変奏(`§` 区切りから1つ)。
  `storyTick`: 落ち着いている時(拘束・発情・魔物30体超でない)に 38〜58 秒ごと、その階層の独り言を吹き出しで。降り口で `descend`、魔核の間を見つけた時に `finalEncounter`(1戦1度)。結果画面: clear=`ending`、reset=`reset`。
- 表示: `#storybox`(盤面の上、タップか時間で閉じる)。ホームの「物語」画面は序章と到達済みの階層の導入、魔核討伐後は結末を載せる。

### 3-30. v4.0 (C) 強化魔核

- **素の体力**: `CORE_HP` 28000 → 22400。世代の倍率(`CORE_ERA_HP0 + CORE_ERA_HP_K*era`)と Lv 補正はそのまま。
- **技の解禁** (`coreSkill(e,k)`): 個体が生まれた時の世代 `e.era` と `BAL.CORE_SK_<技>` を比べる。1 落とし子 / 2 大型 / 3 光線 / 4 発狂。
- **落とし子** (`coreling`, `coreSpawnMinions`, `corelingTick`): カードではない専用種(`guardian:true`)。`CORE_MINION_CD`(12秒、発狂中は 0.72 倍、体力4割以下で 0.8 倍)ごとに `CORE_MINION_N`(世代で 3→5、体力4割以下で +1)体。速く(spd158)脆い(hp34)。触れると `cling` で巻きつく(`needMul` 0.75 = 振りほどきやすい)。**吸い上げは親の側でまとめて処理**する: 巻きついている数 n に対し `min(CORE_MINION_HEAL_MAX(0.33%/s), CORE_MINION_HEAL(0.11%/s)*n)` を親の HP へ。絵は `drawCoreling`(焼き絵)+ `MON_IRIS.coreling`(巻きついている輪だけ生描き。状態を焼かない)。
- **大型の眷属** (`coreSpawnBig`): `CORE_BIG_CD`(30秒)ごとに、その階層の `affinity` のうち `boss||tier==='large'` から一体。`fromCore` を立てて `CORE_BIG_MAX`(2)まで。HP 1.15 倍。バナーで告げる。
- **広範囲絶頂光線** (`coreBeamAim`/`coreBeamFire`): `CORE_BEAM_CD`(20秒)ごとに `CORE_BEAM_CHARGE`(2.6秒)の溜めへ。溜めている間、狙い `e.beamA` は**毎秒 0.5 ラジアンまで**しか近い方のヒロインを追えない(帯から歩いて出れば避けられる)。発射で `corebeam` の fx、帯の半幅 `CORE_BEAM_W`(82)、長さは壁まで(最大 1100)。命中で快感 +44・敏感 +12・発情ゲージ +30・よろけ 1.1 秒・貫通ダメージ。溜めの見た目は `drawCore` の中(局所座標)で、濃さが `k=1-beamT/CHARGE` で上がる。
- **発狂** (`coreRageEnter`/`coreRageTick`): `hp/maxHp <= CORE_RAGE_PH`(0.5)で一度だけ。バナー・画面揺れ・`corerage` の輪、両者に `feat.coreRage`。以後 `CORE_RAGE_GAS_CD`(8秒)ごとに半径 `CORE_RAGE_GAS_R`(300)の媚薬雲(通常の 1.35 倍の濃さ)、`CORE_RAGE_SLAM_CD`(6秒)ごとに半径 300 の薙ぎ(`dmg*1.5`・敏感 +4・よろけ・吹き飛ばし)。落とし子・大型・光線の間隔も `CORE_RAGE_CD`(0.72)倍。根が逆立つ絵と赤い脈。
- **図鑑**: `js/codex_v20.js` の末尾に `coreling`(lore / note.base / add×3 / after)。場面文は `SCENES.default` に落ちる。

### 3-29. v4.0 (B) 魔核戦の専念

- **入る条件** (`coreWarTick`): 最終階層に魔核が生きていて、誰かが `CORE_WAR_R`(540)以内に入るか、魔核の HP が満タンを割った瞬間に `B.coreWar=true`。以後その戦闘の間は解けない。入った時に全員の目当てと探索点を捨て、バナーと台詞(`feat.coreWar`)。
- **鎖** (`coreLeashOk`): 目当ての採点 `add()` の入口で、`CORE_LEASH`(600)より遠い候補を落とす。例外は `rescue`/`wait`/`gather`、`poi:core|spring|pool`、`pick:nectar`、`event:pool`。`forceProp`(体力半分で燭台へ強行)も魔核から 600 以内の燭台だけ。
- **戻る力**: `poi:core` の価値が `CORE_WORTH`(6.5)に上がる。さらに移動の最後で、魔核から `CORE_PULL_R`(300)より離れていれば距離に応じて `CORE_PULL_K`(0.5)まで魔核へ向く成分を混ぜる(拘束・迷い・回復・救出の最中は除く)。600 を超えていれば `feat.coreBack`。
- **攻め方**: 戦闘モードの決定で、`coreWar && hp>maxHp*CORE_FIGHT_HP(0.34) && !exhausted` なら `want='fight'` に上書き(囲まれても引かない)。体力を割れば通常の `flee`/`kite` 判定に戻る。
- **狙い**: `nearestEnemies` の優先度に `CORE_FOCUS_D`(900)を足す(距離から差し引く形)。射程内に魔核があれば、取り巻きより先に撃つ。射程の判定は素の距離で行うので、届かない魔核を撃とうとはしない。

### 3-28. v4.0 (A) 暗闇

- **暗さ**: `FLOORS[].dark` (f1 0.34 → f8 0.88)。`darkLevel()` がそれを返し、`lightAt(x,y)` が「その点の明るさ 0..1」を返す。素の明るさは `1 - darkLevel()`。
- **光源** (`lightAt` が max を取る): ヒロイン(`heroLightR`)/催淫灯篭(`BAL.LANTERN_R` 210)/残る灯り(`B.lights`、寿命で減衰)/光の柱(300)/炎の帯(`z.fire` の 1.3倍)。
- **ヒロインの光**: `HEROES[].lightR`(ルミナ330・フレイラ215)× `floorLight()`(その階で集めた灯り 1.0〜1.75)。相方が `DARK_PAIR_R`(230)以内なら `×1.3`。絶頂中・`hypnoLv>=2` で `×0.85`。`lightK` は光の質(フレイラ0.85)。
- **残る灯り** (`pushLight/lightsTick`): `{x,y,r,t,life,k}` を最大 `DARK_MEM_MAX`(44)。`damageEnemy` が18%の確率で、フレイラの炎の帯が生成時に積む。寿命で線形に褪せる。
- **その階の灯り** (`gainFloorLight`): 祠に着いた時 `+DARK_SHRINE`(0.30)/燭台を壊した時 `+DARK_CANDLE`(0.035)/光茸を取った時 `+DARK_SHROOM`(0.16)、上限 `DARK_FLOOR_MAX`(0.75)。光茸はさらに**二人の間を5点に分けて照らす**(寿命2.2倍)。取った場所にも灯りを積む。
- **催淫灯篭**: `POI_DEF.lantern`。`map.js` の `place('lantern',null,560)` を `BAL.LANTERN_N[depth-1]`(2〜4)基。`startBattle` で `B.lanterns` に写す。`lanternTick` が `LANTERN_R*0.62`(130px)以内で近さに比例して `addHeatG(3.4)` / `applySensit(0.9)`。`LANTERN_STAY`(5.5秒)温もると自分で切り上げ、`LANTERN_CD`(26秒)は `lanternWant` が false。`lanternWant` は「暗さ>0.3 かつ `heatLv<1` かつ `aphro<50` かつ冷却中でない」。目当ての価値は `LANTERN_WANT × darkLevel()`。
- **遠くから見える**: `M.known` の判定に「灯篭と祠は `DARK_FAR_SEE`(900px)以内なら画面外でも気づく」を足した。
- **暗い方へ行きたがらない**: 目当ての採点 `add()` に `lm = DARK_GOAL_K + (1-DARK_GOAL_K)*lightAt(x,y)` を掛ける(救出・待機は除く)。
- **対処が遅れる**: `darkSense(x,y) = DARK_LAG + (1-DARK_LAG)*min(1, lightAt*1.35)`(0.5〜1)。`nearKnownTrap` の半径・地形の先読み距離・雲の回避距離・淫紋の罠の回避距離に掛かる。
- **地図の記憶**: `seenTick` は `lightAt < DARK_SEEN`(0.3)のタイルを覚えない。暗い階ほど探索率が伸びない。
- **描画** (`drawDark`): 画面の 1/3 の裏画布に、① 光の地図を `lighter` で足し合わせ ② 暗幕(`DARK_CAP × darkLevel()`)から `destination-out` で一度だけ抜き ③ 引き伸ばして重ねる。抜き合成は1回だけなので約2ms。`gfxLv()<=1` の端末では 1/5 の粗さにし、雑魚の微光を省く。世界の上・UIの下に落とすので、HUD とミニマップは常に読める。

### 3-27. v3.2 洞の外形・意味のある壁・甘い褥の巣窟・入るか待つか

- **外周(genMap)**: `edgeProf(n)` が三つの正弦を重ねた厚み(2.2〜6.2タイル)を四辺ぶん作り、`coveAt` が6か所の入り江(最大 +7.5)を足す。合計は `BORD_MAX`(12)で頭打ち。最外周2タイルは必ず岩なので外へは抜けられない。`bordT/bordB/bordL/bordR(i|j)` は後続(袋小路・巣窟の位置決め)からも呼ぶ。
- **壁の形(formations)**: `pillarHall`(柱を5〜9本、r1.1〜2.1)/`escarp`(曲率を持つ崖線16〜27タイル、2か所に坂)/`rockfall`(半径 3.0→1.0 と落ちる5つの塊)/`spine`(同軸に3〜5個の細長い塊)/`chambers`(4〜7×3〜5の部屋を2〜3個、四辺の中央に扉)/`constriction`(向かい合う膨らみ)。`F.wall` が 'brick' なら部屋主体、'flesh' なら狭窄主体、'rock' なら柱と崖と崩落。生えた場所は `formSpots` として `usedF` に半径2で登録し(通路は切り拓いてよい)、名前のある形(pillars/escarp/chamber)は `feat.list` にも入れ、そこへ入った時に一言こぼす(`storyTick` の隣、`feat.<kind>` を `js/lines.js`/`js/lines_freila.js` に用意した)。
- **袋小路(ridgePath)**: 四辺のどれかを選び、外周の厚み +4.4 タイルの位置に半径3.2の円を掘り、半径5.4の崖の輪で囲う。輪の切れ目は内側へ向かう幅3の通路の口だけ。`protectRing` で保護し、到達性の掘削(`carveTo`)と場所の整地(POI の5×5)がこの輪に穴を開けないようにした。祠はこの円の中心。
- **巣窟(lewdDen)**: 左右いずれかの外周に食い込む楕円(rx 6〜7 × ry 7〜9タイル)。**奥行きは浅く幅は広い**——これはカメラの拘束(`PARTY_MAXDX/DY` 740/360)に収めるため。外周から2タイルは岩を残す。囲いは岩(q≤1.6)、入口は幅3・長さ4〜6の喉道ひとつ。`protectRect` で保護。口の外に半径7の澱み(zone `haze`)を撒き、**この塗りだけは genMap の最後**に行う(掘削や整地で消えるため)。`feat.denPool` に清水、`den` には `mouth/apron/deep/runes[3]/flowers[3]/beams[3]/guard` の位置を持たせる。光線の口は縁から中心へ向かって進み**最初に床になった所**を起点(`ox,oy`)にする(壁の中から線を引くと自分の壁で遮られるため)。
- **段と効き(`denStage`)**: 楕円の正規化距離 q で -1=外 / 0=前室(q≤1.04)/ 1=沼(q<0.70)/ 2=最奥(q<0.34)。喉道は zone が lewd なら前室扱い。`statesTick` は段ごとに `BAL.DEN_HEAT/DEN_SENS/DEN_GROPE` を使い、前室でだけ `DEN_ABORT`(0.35)で引き返す。zone が `haze` なら `HAZE_HEAT/HAZE_SENS`。`h.zone!=='lewd'→'lewd'` の瞬間に `denEnterBurst`(発情+22・敏感+14・よろめき・「——むわっ」)。
- **仕掛け(`denTick`、代表の文脈で1フレームに1回)**: 魔法陣は半径34に入った子へ `denRuneHit`(淫紋Lv+1・快感14・敏感8・発情8、CD 7.5秒)。媚薬の花は 6.5秒ごとに `spawnCloud`(誰も560px以内に居なければ咲かない)。光線は idle→aim(1.0秒、細い線が伸びる)→fire(`denBeamFire`: 起点から幅26・長さ560の線に居る子へ、催眠なら `applyHypno`、絶頂なら快感26)。番人は誰かが最奥に踏み込むと `spawnDenGuard`(`F.lewd.guard` の種を HP×2.4(最低320×階層×世代)・与ダメ×1.3・xp×2.2 にして据える)。
- **入るか待つか(`denAssignRole`/`denWaitGoal`/`denRoleTick`)**: 共有の目当てが巣窟の中(`denGoalIn`)なら役割を決める。相方の `HEROES[id].braveAdd>0.1`(フレイラ)なら一緒に入り、そうでなければ `P.denRole={in,wait}` を立てて外で待つ。ただし入る子の HP が6割未満・番人が起きている・すでに危ない時は必ず一緒に入る。待つ側は `denWaitGoal` が返す点(既定は澱みの中の `apron`。中の子との差が `PARTY_MAXDX/DY×0.68` を超えたぶんだけ口の内側へ寄る)を目当てにし、`aiDecide` のパーティ引き寄せ(leash)からは除外する。`denRoleTick`(partyTick から毎フレーム)が、目当てが離れた/中の子が出てきた/`denPeril`(捕獲・押し倒し・拘束・魅了拘束・HP<55%・発情Lv2以上)を見て役割を解く——解かれた待ち役は共有の目当て(巣窟の中)に戻るので、そのまま踏み込む。
- **立ち往生・堂々巡りの脱出(v3.2 追補)**: これまでの「つっかえ」判定(`p.stuckT`)は**ほぼ静止している**時しか働かないので、通れない隙間や届かない物の前を**歩き回っている**状態を拾えなかった(実測でも 5分×6回の自動プレイで 2〜6 回、同じ所で回り続けていた)。位置の履歴で見る脱出を足した: 拘束・押し倒し・相談・待機・救出・迷いの最中を除き、`ORBIT_T`(11秒)のあいだ `ORBIT_R`(105px)の枠から出られていなければ、いまの目当てと目標を諦めて(`GIVEUP_CD` 40秒)別を選び、「……ここ、とおれない。べつのとこ いこ」と言う。`ORBIT_CD`(16秒)は連発を防ぐ。加えて、つっかえ判定が同じ目当てで2度続いた時も、その目当てを捨てる。実測 2〜6回 → **0回**。
- **仲間の救出まわりの修正(v3.2 で回帰から出たもの)**: (1) 「諦めの見張り」(同じ目当てへ `GIVEUP_T`(5秒)近づけなければ外す)が、**着いてから立っている間**にも働いていた——救出は3秒その場に立つのが仕事なので、救おうとしている相手を目当てから外していた。目当てまで90px を切ったら見張らないようにした(封印石・清水・祠など「その場に立つ」目当ても同じ)。(2) 嫌な地形の縁で足がすくむと `giveUpOn` が呼ばれ、**捕まった仲間を40秒間あきらめて**いた。`giveUpOn` は救出(と巣窟の待機)だけは記録しないようにした。(2b) その「着いたら見張らない」は救出・封印石・清水・祠・泉・降り口・巣窟の待機だけに限り(`standKind`)、しかも `GIVEUP_NEAR_T`(18秒)を超えたら諦める——全種類に広げたままだと、届かない箱や資源のそばで永久に回り続けた。(3) 救出の価値を 3.4→`RESCUE_WORTH`(6.5)にし、仲間が捕まっている間は救出以外の目当ての価値に `RESCUE_FOCUS`(0.45)を掛ける——木の実を拾いに寄り道しない。修正前は救出の再現が 6回中2回、修正後は 6回中6回(5.6〜10.4秒)。
- **検証(run_v32.js)**: `map`(全8階層: 外周の輪郭は 2.2〜12タイル(`BORD_MAX` 止まり)で場所ごとに違う——縁に地続きの岩の形や巣窟の囲いが付くと、縁から数えた実測は 30 タイルに達することもある・外への漏れ0・到達できない床0・床率0.69〜0.72・階層ごとの形の顔ぶれ・袋小路は口を塞ぐと祠へ到達不能=一方通行・巣窟は口を塞ぐと最奥へ到達不能=入口ひとつ・口から奥まで480〜608px)、`den`(役割はフレイラが入りルミナが待つ・待ち役は301フレームすべて澱みの中・二人の最大距離 横394/縦287・最奥到達・番人起床・踏み込み: 押し倒された瞬間に役割が解けて「もう むり! いくね!」、544px→143px まで詰める)。

### 3-26. v3.1 一人で始まる潜行と参戦・経済・微弱体化・近寄って相談

- **出撃の並び(`META.party`)**: `{roster:['lumina'], joined:{}, resets:0}`。`partyIds()`(data.js)が roster を HEROES で濾して `PARTY_MAX`(4)で切り、`startBattle` はこれで `newHero` を作る。`loadMeta` の移行: `party` の無い保存で `run.storySeen.join` が立っていれば(v3.0 で二人で潜っていた)フレイラを残す。v2.x の保存は一人。
- **参戦の判定(`partyJoinCheck(runNote)`, endBattle の潜行の進みの直後)**: `PARTY_JOIN=[{id:'freila', minEra:1, resets:3, lateEra:5}]`(lateEra=4 は「一人で第6層に降りさせない」で決まる: 開放階層 `2+era` なので世代4で第6層が開き、第6〜8層の物語・降下文は二人用に書かれている。`joinLate` の文の線の数もこれに合わせて三本/四本目にした) の並びで、まだ居ない最初の規則について——`reset` の朝は `META.party.resets++` し、`era>=minEra || resets>=rule.resets` で `partyJoin(id,'reset')`。`clear` の朝は `era>=lateEra` で `partyJoin(id,'late')`。`partyJoin` は roster に足し、`joined[id]={era,gen,runs,why}`、`resets=0`、`storySeen.join` を消し `run.joinWhy` を置く。結果画面へ `join`(名前)と `joinWhy` を渡す(赤い帯)。二連敗の文(reset)の後に `party.joinHint`(3行)を継ぐ。
- **朝の文の選び方(startBattle)**: 序章は一人なら `STORY.prologue`(`storySeen.join` は二人の時だけ立てる)。`!storySeen.join && heroes>1` で `party.join`、`joinWhy==='late'` なら `party.joinLate`(その世代の `loop<era>` も既読に)。組み替わりの朝は `storyLoopIntro(n)`: 二人なら `era.loopIntro`、一人なら `era.loopIntroSolo.first`(世代1)/`again`。魔核を討った日は `storyClearLines(twoP)`: 二人なら `era.coreDown[era-1]`+二人版 ending、一人なら `era.coreDownSolo.first/again` + 結び(初回は `STORY.ending.slice(1)`、二度目以降は `era.endingSoloAgain` の5行。一人版の冒頭は結末の1行目を置き換える形で書かれている)。図鑑のフレイラの赤ペン(`CODEX_F`)は `partyIds().includes('freila')` で門をかけ、合流するまで出さない(ui.js)。魔核の対峙・再挑戦・リセットは v3.0 の人数分岐のまま。
- **経済(endBattle)**: `essGain = round(essSoft(B.essence)·(1+ESS_ERA_K·era)) + 結果の加算`、`essSoft(x)=ESS_SOFT·ln(1+x/ESS_SOFT)`(700)。`B.essence` は撃破 xp×`ESS_RATE`(0.30)。加算: capture 45 / survive 25 / descend `40+15·(depth−1)` / clear `120+60·era`。`orbGain = round(essSoft(B.orbFrag, ORB_SOFT(80))·(1+ORB_ERA_K·era))`+捕獲 `14+4·gb`。`ORB_DMG_STEP` 90。**逓減の基準はその日の長さに比例**(`S=ESS_SOFT×(B.time/ESS_SOFT_T(200))`、オーブは `ORB_SOFT` で同じ比)——量ではなく毎秒の勢いを抑える形なので、早々に撤退して短い日を積んでも実入りは変わらない(実測: 同じ勢いなら240秒の日も40秒の日も 7.9/秒、短い日6回=長い日1回の0.999倍)。表は `tools/balance_calc.py` の F。
- **ルミナの係数(`newHero`)**: `HD.dmgMul`(dmgMult に掛ける)/`HD.regenMul`(regen に掛ける)を追加。lumina: hpMul 0.92 / armor −1 / dmgMul 0.94 / regenMul 0.9。フレイラは 1.0。
- **世代0の魔核と世代の強化**: `CORE_ERA_HP0` 0.30(0.45から)、`coreDef()=max(0.4, CORE_ERA_DEF0(0.75)−0.05·era)`、世代0だけ Lv 補正を `CORE_ERA0_LV_K`(0.5倍)・上限 `CORE_ERA0_LV_CAP`(+50%)に。`ERA_DEPTH_K0` 0.10(魔物の HP/与ダメ・EN 天井が毎世代 +10%。階層が増えなくなった後はさらに +10%)。
- **近寄って相談(`updateGoal`)**: 決め直しで `talkable`(台詞の間隔 `PARTY_TALK_CD` が明け、探索以外の案がある)かつ `!partyGathered()`(誰かが重心から `GATHER_R` 48 より外)かつ `!partyDanger()`(拘束・押し倒し・HP40%未満・`p.threatV`≥0.5・`GATHER_DANGER_R` 150 内に動く魔物、のどれも無い)なら、`P.gather={until:+GATHER_T(3.2), x,y(重心)}` を置き、全員の目当てを `{kind:'gather', score:1.3}` に(aiDecide は gather を 30px まで歩く。`goalValid` は集合中・脅威なし・未集合のあいだ有効)。優先権(`P.turn`)の子が `gather.call`。次の決め直しで `P.gather` を畳み、揃っていれば `gathered`: 呼ばれた子の `gather.arrive`(0.2秒)→ 勝った案の `propose`(0.9秒)→ 返事(1.8秒)、`talkUntil=+GATHER_TALK_T`(2.6秒)。探索の決定でも集まったなら一言交わす。`aiDecide` の talk 中は `p.face` を相手へ向け、移動側の向き更新は talk 中は止める。`aiDecide` は `p.threatV` に脅威の見積もりを残す。`GATHER_CD`(8秒)で連発を防ぐ。
- **集合まわりの審査修正(6件)**: 歩いてきた子がそのまま言い出す時、`gather.arrive` と `propose` が同じ子の続けざまの吹き出しになって後者が潰れていた(同優先度の吹き出しは前のが0.5秒以上残っていると捨てられる)ので、その場合だけ提案を +1.7 秒にずらし、向き合う時間も言い終わるまで伸ばす。誰かが捕まっている間は `partyDanger()` を真にして集合そのものを起こさない(3〜4人の時に救出の案を潰さないため)。流れた集合(捕獲・戦いが長引いて期限+1秒)は捨て、後から「いま集まった」と数えない。捕獲時は `B.party` の `pending`/`talkUntil`/`gather` も畳む(言いかけの台詞と足止めが残っていた)。表に無い操舵状態(`g_gather`)で空の吹き出しが1.7秒スロットを占めていたので `BBL[state]` があるときだけ出し、HUD 用に `LBL.g_gather`(集まって相談)を足した。集合の到着判定は普通の90pxに戻した(30pxは重心が動くぶん届かず、狙いと逆に働いていた)。
- **階層の独り言(`storyTick`)**: 話者ごとの表から引く(ルミナ `LINES.floor` は0基点の配列、フレイラ `LINES_F.floor` は階層番号のキー)。ルミナの第6〜8層を書き足した。表に無い時は物語の `enter` から**その話者の台詞だけ**を拾う(以前は第6層以降で `LINES.floor` を外れ、`{s,t}` の物語行がそのまま吹き出しに入って `[object Object]` になっていた。フレイラもルミナの台詞を喋っていた)。
- **検証(run_v31.js)**: join(一人開始→世代0の二連敗では来ない→世代1の二連敗で合流・翌朝二人・二重に来ない・保険2種・移行3種)、gather(180秒で集合5回・**5回とも揃って成立**、話す間の向き合い 12.9/13.8秒、話し始めの距離は 70〜92px、呼びかけ/到着/提案/返事が揃う。離れたまま集合できなかった時は声だけで足は止めない)、econ(逓減表と結果別の収入)、solo(一人の通し: 一日ごとの結果・Lv・収入・購入を記録するキャンペーン。新規セーブ・おまかせ編成・オート指揮・毎朝の貪欲な購入で 4本: 世代0の魔核討伐 2/2/3/6日目、合流 8/8/13/14日目(世代1で1本・世代2で3本)、捕獲は日の 40〜57%、一日の収入 400〜2,900 エッセンス)。弱体化なし(hpMul 1.0 等)の対照では 世代0討伐 5日目・世代1討伐 9日目・合流 11日目。

### 3-25. v3.0 多ヒロイン基盤・フレイラ・パーティAI・深淵のループ

- **多ヒロイン(`B.heroes[]`, 文脈 `B.ci`)**: `B.hero` は getter で `B.heroes[B.ci]`。ヒロインごとの処理は `eachHero(fn)` が文脈を切り替えて回し、終わりに `leaderIdx()`(最初の離脱していない子)へ戻す。battleTick の頭(タイマー・回復・状態・絶頂・押し倒し)、ebullets の当たり、poiTick/trapsTick/aiUpdate+weaponsUpdate(+撃った弾に `hi`)/picksTick/linesTick/skillTick/seenTick、rescueTick はヒロインごと。`bulletsUpdate` は弾の `hi` で文脈。`enemiesUpdate` は魔物ごとに `e.ti`(標的)を選ぶ: 掴んでいる/押し倒している/縋りつかれている相手は固定、それ以外は 0.5〜0.9 秒ごとに最も近い(離脱していない)子。`attachMonster/attachSucker` は `mon.ti=B.ci`。`killEnemy` は全員の四肢/吸い付き/押し倒し/魅了拘束を見る。`heroSeparate` は全員、`separateEnemies` も全員。
- **経験値とLv**: `gainXpAll(v)` が全員の xp に足し、`maybeLevelup` は heroes[0] で判定して全員の Lv を上げる。ジェムは最も近い子へ寄る(`pickupsUpdate` 書き直し。ハート/資源/品/箱/粘液の帯も全員で判定)。`curLv(k)` は武器なら `heroOf(k)`(UPG[k].owner)、パッシブなら heroes[0]。`offerLevelup` は武器を持ち主の枠(4つ)で数え、持ち主ごとの候補数で重みを正規化し、育ちが遅い方を ×1.3。`applyUpg` は武器=持ち主、パッシブ=全員、進化=base の持ち主。`applyPray` は全員。引き継ぎは `META.run.heroes[id]`(`hero` は互換)。
- **カメラと拘束**: main.js は離脱していない子の重心を追う。`partyClamp()` が `PARTY_MAXDX/DY`(740/360)を超えた分を寄せる(拘束中の子は動かさず自由な子だけ動く)。aiDecide の末尾で `PARTY_LEASH`(380)を超えると相手へ寄る力、`PARTY_SEP`(34)未満は少し離れる。`B.party.talkUntil` の間は脅威が薄ければ足を止める(state 'talk')。
- **捕獲(`beginCapture`)**: `B.captures` に {hi,id,by,cause,t}。他に自由な子が居れば `h.out=true; h.captive={x,y,by,rescue}`、四肢/吸い付き/魅了拘束を解き、その子の弾を消し、相手の `captured.watch`。全員なら従来の 'captured' へ(帯「全員捕獲」)。`rescueTick`: 自由な子が `RESCUE_R`(60) 内に `RESCUE_T`(3秒)→`rescueHero`(HP50%・スタミナ60%・無敵1.5秒、`rescue.done`→1.3秒後 `rescue.thanks`、初回は ADV party.rescue)。救出は `updateGoalSolo` の候補 'rescue'(価値3.4)。降りた時に離脱者が居れば `META.run.leftBehind` → 翌朝 party.reunion。結果画面は `sum.captures` から捕まった子ごとの本文(`sceneForHero`: フレイラは `SCENES_F`、無ければ SCENES)。
- **フレイラ**: `HEROES.freila`(hpMul 1.12, armor+1, fearMul 0.6, braveAdd 0.2, kiteMul 1.35, pref)。武器は `UPG` に owner:'freila'(fsword/fring/fburst/fpillar/fwing)、進化 inferno/corona/eruption。`freilaWeapons(p,dt,atkMult)` が weaponsUpdate の頭で呼ばれる(炎の剣は whipAnim/whipDir/whipR + `whipFire`、爆炎は novaAnim + `novaFire`、火柱は zones に `fire:true`、焔の翼は突進+残像 `fwingAnim/fwingX/Y`、煉獄の剣の燃焼は `e.burnT`)。奥義は `heroSkills(p)` で、blaze/ember/phoenix を skillTick に追加(既存の blink/purge/bulwark は skillReady が無い奥義を false にするのでルミナ専用のまま)。台詞は `LINES_F`(sayLine が話者で表を切り替え、クールダウンも話者別)。
- **パーティAI(`updateGoal` → `updateGoalSolo`)**: 共有の目当て `B.party.goal/owner/until`。有効なうちは全員がそれを持つ。決め直しでは全員の `updateGoalSolo`(候補の価値に `goalPref(p,kind,sub)` = HEROES.pref を掛ける)を集め、同じ(kind/ref/60px)なら即決、割れたら `P.turn` の子の案。ただし 'rescue' か価値1.8倍超なら高い方。負けた子が次の `P.turn`。`PARTY_TALK_CD`(10秒)ごとに `propose.<kind>` → 相手は `same/agree/yield`(0.9秒後、`pendingLine`)、割れた時は `talkUntil=+TALK_T`。カバー: `p.assist`=掴まれた/押し倒された相手(自分が自由な時)。分岐 'assist' で `ASSIST_R`(120) までは寄り、`nearestEnemies` は相手を掴んでいる個体(attached で `ti` が相手、または相手の pinBy)を狙える上に距離×0.25 で優先。ハートは相手の体力比が `HEART_YIELD`(0.15) 以上薄く 260px 内なら譲る。共有: `partyShare(p,kind,x,y,force)` は相手の画面外(W/2,H/2)の物、ボスは必ず → `share.<kind>` と相手の `share.ack`。`partyTick`(0.5秒): pending 行、階層に入って3秒で `banter.floor[depth]`、圧0.35で `banter.pressure`、二人とも魔物が見えない6秒×28秒間隔で `banter.idle`。`killEnemy` のボスで `banter.bossDown`。
- **深淵のループ**: `META.era`(魔核を討たれた回数。runReset で消えない)。`openFloors()=min(FLOORS.length, ERA_FLOORS0(2)+era)`、`curFloor()` は複製に `final:(depth>=openFloors())` を付ける(FLOORS 側の final は撤去)。genMap の種に era。`eraMul()=1+0.06·era+0.10·max(0,era−(FLOORS.length−2))` を魔物 HP/与ダメ(guardian 以外)と EN 天井に掛ける。魔核: HP×(0.45+0.28·era)、半径×(0.68+0.08·min(4,era))、`coreDef()=max(0.4, 0.7−0.05·era)`、drawCore は `e.era` で色(淡い桃→深紅→黒赤)・根の数(5→15)・世代3以上で周りの目。番兵 `SENT_ERA`、圧の上限 `pressMax()=min(2.6,1.2+0.2·era)`。降りた先は `openFloors()` で頭打ち。討伐で `META.era++`(endBattle 'clear')、結末は `STORY_V30.era.coreDown[min(2,era−1)]`+従来の ending。`storyFloor(depth)` は 6 以降を `STORY_V30.floors`。
- **審査修正(12件)**: 降り口/封印石のタイマーは最も近い子だけが進め、相手がそばに居れば減らさない(二人で呼ばれる poiTick が互いに打ち消していた)。押し倒し/絶頂の場面テキストと切り抜きは `B.pinSceneHi` の子で描き、`B.pinScene=null`・`B.pinSceneT+=dt` はその子の文脈だけ。流れ場はヒロインごと(`G.map.flows[hi]`、`flowDir(x,y,fly,e.ti)`)。共有タイマー(資源の湧き・清水のCD・罠の寿命・静けさ・逃げ続け)は代表の文脈だけで進める。runReset は `join`/`loop*` の既読を残す。再会の場面は導入の前に連結。弾の当たりは「撃った子に付いている個体」だけを除く(相手を掴んでいる個体は撃てる)。チップの段は人数で下がる。燃え尽きた個体はそのフレームの行動をしない。救出で捕獲記録を消す。捕まって残っている子に脱出ゲージを出さない。フレイラの立ち絵は `freila_stand.png` を直接読む。
- **二人版の物語(v3.0 追補)**: `STORY_V30.retry`(4変奏)・`finalEncounter`・`ending`・`reset`。`storyRetry()` は `G.B.heroes.length>1` なら二人版を返し、魔核の対峙(`poiTick` の core 発見)と `endBattle` の `storyLines`(clear/reset)も二人なら二人版を使う。世代の結末は `era.coreDown[era-1]` + 二人版 ending。
- **二人の手記(`CODEX_F`, js/codex_freila.js)**: `{base, add[0..2], after}` を全37種。図鑑の各段(`ui.js` の notebook)にルミナの手記の直後、赤ペンの欄外書き込み `.mnote` として差し込む(段の開放条件はルミナと同じ `codexStage`)。末尾(`.after` 内)だけは「余白の様子」の描写なので手書き体ではなく地の文の調子(`.notebook .after .mnote`)。
- **フレイラの絵**: 手描きの原画 `assets/ref/freila.png`(832×1216)。`tools/make_freila.py` の生成物は原画から起こした `assets/sprites/freila.png`(34×52)/`freila_hd.png`(159×240)に置き換え済み。ADV の立ち絵は `ui.js` が話者で切り替える。
- **文章の器**: `js/lines_party.js`(LINES_P)、`js/lines_freila.js`(LINES_F)、`js/scenes_freila.js`(SCENES_F)、`js/story_v30.js`(STORY_V30)、`js/codex_freila.js`(CODEX_F)。仕様は `docs/TEXT_SPEC_v30.md`。取り込み時に禁止語尾・NG語・♡の位置を機械検査(問題0件)。

### 3-24. v2.4 視界の記憶・ボス級の強化・不動の大ボス・対ボスの武器選び

- **視界の記憶(`G.map.seen`)**: `Uint8Array(MAP_W*MAP_H)`。`initSeen()`(startBattle の genMap 直後)が `gi:floor` の鍵で作り、`META.run.seen[鍵]`(ビット詰め base64、約1.3KB/階層)があれば戻す。`seenTick`(0.25秒ごと)が彼女の周り `SEEN_R`×`SEEN_RY`(560×400)の楕円のタイルを 1 にし、床の数 `passN` に対する `seenN` を持つ。`endBattle` の頭で `saveSeen()`。run リセットで `META.run.seen={}`。
- **探索点(`pickExplore`)**: 候補=従来の 12 点(600〜1200px)+未探索の床から直接 8 点(200px より遠い、到達可、fear≥2 の地形は除く)。得点=`unseenAround(q,7)`(±7タイルの床のうち未探索の割合)×`EXPLORE_UNSEEN_W`(2.5)−距離/1200×`EXPLORE_DIST_W`(0.4)+従来の「見つけていない場所の近さ」。`seenFrac()≥0.97` か `SEEN_EXPLORE=0` なら従来の得点(遠い所ほど高い)。`EXPLORE_DONE`(0.96)で `exploreDone` の台詞、未探索の濃い候補を選んだ時は 35% で `exploreNew`。
- **ミニマップの霧(map.js drawMinimap)**: `G.map.fog` を 0.5 秒ごとに作り直し(未探索の床 α200、岩 α120)、地形の上・場所の印の下に描く。右上に「探索 NN%」。
- **ボス級の強化**: `spawnUnit` で `boss && !guardian` の HP に `bossm=1+min(BOSS_HP_LV_CAP 2.5, BOSS_HP_LV 0.05×(彼女Lv−1))`、`damageEnemy` で `BOSS_DEF`(0.8)。data.js の hp/dmg/trait と各 tick。樹: `pollenCd`(初回6秒→12秒ごと、220px、敏感化6・発情12)、根 170px/5.5秒、繋いでいる間 `nk=2`(子は10まで)、領域 150px・快感 2.4/s。ボスゲイザー: `bossEyeSpec` の tmax ×1.1→×0.95、cd ×1.2→×1.0、`hypnoLv≥1` で移動 1.5倍。突進ボス: 370px/s、vampi は `e.dash2` で 45% の二段目(tele 0.35秒)。粘獣王: 帯 r24/8秒、`p.slow>0 && d<300` で 1.5倍速。刻印師: castCd 3.8、HP<50% で fan [-0.28,0,0.28] と罠2つ。女王: pulse 5.2、口づけで `heatLv≥1` なら `applyDeny`、小淫魔 3体/8体。ゴブリンの王: musk 1.5秒・r110、笛 8秒、号令で 320px 内の goblin に `hasteT=4`(汎用更新で `spd=spd0×zone×1.35`)。魔核: `CORE_HP` 26000→28000、鞭 250px。
- **不動の据わった個体(`heroSeparate`)**: `MONSTERS[id].spd<=0` なら彼女側を `over` ぶん押し戻す(魔物は動かさない)。ピュアノヴァの押し(30px)と盾の弾き(10px)も `spd>0` に限る。魔物同士(`separateEnemies`)は元から質量∞。
- **対ボスの武器選び(`offerLevelup`)**: `bossExpected()`=最終階層 / `B.bossSeen`(linesTick で見えたボスが居れば真、endBattle で `META.run.bossSeen` へ) / `B.bossMark` から `BOSS_MEMORY_T`(60秒)以内 / 見えているボス。真なら重みに `UPG[k].bossW`(武器: bolt/blade 1.5、chain/spirit 1.3、cross/thunder 1.2、whip 1.0、holy/shield 0.9、orb 0.8、rain 0.7、sanct 0.6、nova 0.55。パッシブ: pierce 1.6、haste/dup 1.3、reach 1.1、area/magnet 0.8)、進化は base の bossW≥1.2 で ×1.35(<0.8 で ×0.75)。bossW≥1.2 の物を選ぶと `bossPick` の台詞(`B.nBossPick`)。`BOSS_PICK=0` で無効。
- **検証(Playwright)**: 探索の網羅(第1層・敵なし・240秒・2回): 記憶あり 30s 30%→60s 44〜54%→120s 78〜90%→180s 97〜99%→**240s 98.8%**(場所 10/10、「だいたい みたかも」あり)、旧探索 30s 27%→120s 62〜84%→**240s 83〜88%で頭打ち**(うろつきが同じ所を回る)。ビット詰めの往復一致(1344文字/階層)。不動: 魔核・樹に彼女を4秒押し込んでも移動 0px、彼女は (r+r)×0.62 の外へ押し戻される。動けるボス(ゴブリンの王)は従来どおり押される(92px)。武器選び 400回: bossW≥1.2 の物を選ぶ割合 0.43(ボス無し)→**0.59**(ボス有り)、上位 bolt/blade/spirit。最終階層は `bossExpected()` 真。ボス戦(第3層・Lv25・中堅ビルド・夜側スケール無し): 討伐 ボスゲイザー 54s / 刻印師 34s(三方向弾を確認) / 粘獣王 26s / ゴブリンの王 18s(号令を確認) / ヴァンピロード 16s / 女王 15s(強化前は 4〜7 秒で全滅)。樹は根で 1 度捕まえた後、彼女が離れて他の目当てへ(HP 56% 残し)。実戦では夜側の Lv スケール(+80%)がさらに掛かる。

### 3-23. v2.3 奥義・戦闘モードAI・図鑑の消し字

- **奥義(`SKILLS`, `skillTick`)**: `p.skillCd{blink,purge,bulwark}` を毎フレーム減らす。`skillReady(p,id)`=Lv到達かつCD0。**bulwark**: HP<35%・非押し倒しで `p.guardT=4`(`hurtHero` で net=dmg×mult×0.3−armor、`battleTick` の自然回復×4)。**purge**: `attachCount>=2||p.pinned`(魅了拘束中は不可)で全 `detachLimb(sl,{fling:true})`、押し倒しを解除(`pinned/pinBy/pinEscape/struggle/B.pinScene`)、半径120の魔物を90px押して `stun`(ボス0.6/他1.2)、`ifr` 1.0、スタミナ+20。**blink**: 非拘束・非絶頂で `nearEnemyCount(130)>=6 || p.press>=1.4` なら12方向×180pxの床(`snapFloor`+`reachableAt`)のうち周囲150/60の頭数が最少の点へ瞬間移動、`ifr` 0.6。発動は `useSkill`(CD・`B.nSkill`・帯・台詞 `skill.*`・音)。
- **戦闘モード(aiDecide 先頭)**: 見えていて気づいた魔物(`inSight` かつ `seenT>=NOTICE_T` 相当)について、260px 内の HP 合計(ボスは 0.35 倍)と 120px 内の頭数 `nNear`、群れの重心から離れる向き `awx/awy` を求める。`p.dpsEst=heroDpsEst(p)`(武器ごとの基礎DPS×Lv×覚醒×進化×dmgMult×俊足×連弾)。`ttk=hpNear/dpsEst`、`p.press=ttk/FLEE_TTK+nNear/FLEE_N`。`B.time>=p.modeUntil` の時だけ `want`=flee(ttk>`FLEE_TTK`9 or nNear>=`FLEE_N`12)/kite(ttk>`KITE_TTK`4 or nNear>=`KITE_N`6)/fight を決め、変わったら `MODE_HOLD`(1.2s)保つ。
- **分岐の位置**: struggle → fleeOut → 降り口に着いた → forceProp(瀕死の燭台) → **retreat(flee)** → **kite2(kite, threat<1.6)** → 旧 flee(threat>0.9) → 目当て/ジェム。retreat は HP<70% で届くハート(300px)を最優先、次に `exitGo` なら `exX/exY`、無ければ 8 方向×420px の床を「頭数(220)+中間点(140)×0.7−重心から離れる向き×2.5−fear≥2 の地形」で採点して `p.escape`(2.5秒/50px で更新)。kite2 は `awx/awy`×0.55+8方向の空き×0.45+脅威ベクトル×0.6、`exitGo` なら 0.4 混ぜ、下がる向きと内積≥0 のジェム(磁石外〜`KITE_GEM_R`160)・ハート(HP<70%、260px)へ寄る。
- **審査修正(7件)**: 据わった個体(`MONSTERS[id].spd<=0`: 魔核・夢の樹・番人・口・壺)は ttk/nNear/重心に数えない(魔核の260px境で逃げ続けていた)。秒の閾値に `lvK=1+MODE_LV_K(0.12)×max(0,MODE_LV(15)−Lv)`(Lv1 ×2.7、初期武器では何でも遅く見えて経験値が枯れる)。`why='flee'` で降り口未知なら `pickExplore` を切らさない(探索点に着いた/期限切れで再選択)。retreat/kite2 の頭で `p.propTarget=null`(引き撃ち中に燭台へ撃たない)。`nearEnemyCount(x,y,r,all)` は小淫魔・未開花の花・(all でなければ)据わった個体を数えない。跳躍は `p.blinkRetry`(0.5秒)で走査を間引く。奥義は `freezeT/stumbleDur/bathT/poolT/readT` の間は出ず、浄化は `hypnoLv<2` かつ吸い付き(`detachSucker`)も千切る。壁は護りを引いた後に ×0.3(小さな当たりを全部無効にしない)。
- **逃げ続け→降りる**: `skillTick` が flee の間 `B.fleeT` を積み(他モードで半速で減る)、`exitTick` は `fleeT>=FLEE_EXIT_T`(8)・非最終階層で `why='flee'`(帯「逃げ続けても終わらない——降り口を探す」、台詞 `fleeExit`)。
- **迷いの積み上げ(`p.hesitN[zone]`)**: 迷いの決着で「やめとく」を選ぶか、fear3 で価値不足のまま引き返すと +1。入る確率 `pe` に `HESIT_ESC`(0.22)×回数を足す。fear3 の即時引き返しの敷居 `FEAR3_WORTH×(1−0.25×回数)`(下限 0.4)。入った(brave)時に 0 に戻す。`scared` の長さは `SCARED_T`(40)。台詞: 2回目以降の迷いは `hesitateAgain`、3回目以降に入る時は `braveFinally`。
- **表示**: `AILMENTS.heal/skill/flee`。奥義チップは解放済みの記号とCD秒、モードチップは kite/flee の時だけ。`draw()` で `guardT>0` の間は金色の glow と楕円の輪。
- **図鑑の消し字**: `.notebook s{color:inherit; text-decoration:none}`、`.scr`/`.scr.hard` の背景SVGの線を墨色(#3a2f2a)・太さ1.4〜1.8・不透明度0.8〜0.9に。字は同じ墨色のまま、線だけが上に重なる。
- **検証(Playwright)**: 奥義3種の発動(壁: 40ダメ→3、回復4.2/s。浄化: 二肢→0、周囲2体停止。跳躍: 180px移動、周囲6→1)。A/B(`BAL.SMART_AI` 0/1、オート指揮、上限300秒): 閾値の調整を3回。初期(KITE 2.5s/5体・FLEE 7s/10体)は第3層 Lv30 で引き撃ちが多くジェムが減り 171→124 秒と悪化。4s/6体・9s/12体で第5層 Lv45 圧0.76 → 旧AI 224/155/138/257(平均194、全捕獲)、新AI 300/81/300/300(平均245、3回生存、Lv+4.8→6.8)。最終値 **5s/7体・9s/12体**(引き撃ち中のジェムは下がる向きと内積≥−0.25、200px)で第3層 Lv30 6回 → 旧 平均164秒(1回生存)、新 平均148秒(1回生存、21秒・42秒の早い捕獲2回を含む)——差は誤差の範囲、第5層の利得は維持。第4層 EN強制50%(場が上限) → 差なし(63 vs 69 秒)。迷いの積み上げ(`SCARED_T`/`GIVEUP_CD` を8秒に縮めて8回): 全回で入り、迷い1〜4回・やめとく0〜2回、「また、ここ……」「もう! いく!」が出た。

### 3-22. v2.2 包囲の調整・設置するオート指揮・迷うヒロイン・えちえちエリア・魔核

- **包囲円陣**: `FORMATIONS.ring.tiers=['fodder']` を `resolveForm` が見る(中型は burst→wave→scatter へ)。`RING_R`=470(縦0.75)、出た個体に `stun=RING_STUN`(0.9)。`playCard` が `B.ringCd=RING_CD`(25)を立て、`autoDirector` は `held` の時だけ、かつ `ringCd<=0` の時だけ ring を候補にする。放出(flush)では使わない。
- **魔核**: `spawnUnit` で HP=`CORE_HP`(26000)×(1+0.08·(世代-1))×(1+min(CORE_HP_LV_CAP=3.0, CORE_HP_LV=0.04·(彼女Lv-1)))。`damageEnemy`×`CORE_DEF`(0.4)。`coreTick`: 鞭は d<230 で予兆0.55秒→`attachMonster(tether r210)`、HP<`CORE_TWO_PH`(40%) なら二本目、CD は `CORE_WHIP_CD`(2.2)×(抱えていれば1.6)×(HP<30%で0.75)。脈の圏内は熱+4/s・敏感化+1/s。調整の試行(Lv60 完成形×2・Lv45×2、オート指揮相手、600秒上限): 捕獲482s(魔核33%)/捕獲36s(幽霊)/討伐384s/捕獲455s(17%)。脈動 5.5×(HP<50%で0.7)×(HP<30%で0.8)、快感 10+14·(1-HP比)。召喚 7×(HP<30%で0.55)、3/4/5体、HP<30% で口(mouth)も。半径 `CORE_AURA_R`=140 で熱+6/s・敏感化+1.2/s・毎秒2(護り無視)。**振りほどきの削り**(`detachLimb fling`)は魔核 `CORE_FLING`=2.5%(以前はボス一律5%=根を千切るたび5000超が入り、Lv45 の彼女が87秒で討てた原因。0.5% では Lv60 の完成した彼女が146秒で捕まった)、番兵 8%(以前 35%)。
- **設置するオート指揮(`chooseNightItem`)**: `B.itemT` を 0.42 秒刻みで減らし、12秒以降 4〜6秒ごとに候補を重み付き抽選: 歩いている(速度>60・非拘束)なら 1.1秒先に pool 3 / rune 2.5 / suit 2 / freeze 2.5、経路中なら 1.6秒先に web 2。拘束中は足元に mist 4。止まっていれば mist 3、EN>上限60% で 240px 先に tower 1.2。40秒以降、偽りの宝箱が場に無く目当てが箱でなければ向いている方 420〜560px に fake 1.5。`canPlaceItem` で解放/CD/EN を確認、`B.en>=cost+min(reserve/2,10)`。`placeItem(id,x,y,{auto})` は罠・偽箱・巣・塔に `night:true`、`B.placed` に {id,x,y,t,until,auto} を残す(HUDの一覧、`NIGHT_ITEM_LIFE`)。
- **設置の印(`drawNightMark`)**: 紫のひし形+記号。罠は armed の間、偽箱は取られるまで、巣/塔は生きている間。えちえちエリアの報酬箱は桃色に光る(`c.lewd`)。
- **えちえちエリア**: `ZONES.lewd`(col #7a2a5a)。genMap: `freeSpot(15,7)`→(13,6)→(11,5)→used を避けた farSpot の順で必ず1か所。半径4.2タイルの床を `lewd` にし、その外側1.6タイルを岩の輪(切れ目2、角0.9/3.9rad)に。`feat.lewd`→`G.map.lewd`、`feats` に kind 'lewd'。祠は輪の内側(+1.5,-1)に。`spawnLewdRewards`: 王の宝箱・宝箱(`lewd:true`, known:false)・沈んだ宝・蜜の花2。`statesTick`: `learnZone('lewd',0.45/s)`(3秒で学習=避ける)、熱+2.4/s、敏感化+1.6/s、5秒ごと `floorGrope`(快感 6+4·敏感段、熱+6、よろめき0.45、`awardAil('grope')`)。帯の名前は `FLOORS[k].lewd.name`(初回に帯も)。`heroZoneCost('lewd')=0.3+2.0k`。
- **迷い(aiDecide 目当て分岐)**: `p.pauseUntil`(updateGoal で目当てが変わった時25%で0.5〜1.1秒)→ state 'think'。`p.hesit={zone,until}`: 次の一歩(44px先)の地形が `zoneAvoided` か lewd で、`brave[zone]`/`scared[zone]` が切れていれば開始(1.4〜3.2秒)。迷っている間は境から半歩下がって左右に揺れる(state 'hesitate')。時間が来たら必ず決める: 入る確率 = 0.45 +0.3(価値≥2.6 / +0.15 ≥2) +0.15(HP>70%、以下なら-0.1) -0.25(敏感化≥60) -0.2(発情) -0.1(lewd を学習済み)。入る→`brave[zone]`=60秒。やめる→`scared[zone]`=40秒、目標を `giveUpOn`、`heroZoneCost` が 4 を返して経路も避け、次の一歩が scared の地形なら目標を捨てて半歩戻る。降り口/燭台/ハート/脱出中は迷わない。
- **地形の嫌い方(`zoneFear`)**: `ZONES[z].fear`(0〜3)×max(`innate`, `zoneKnow`)。moss/damp/ruin 0、water/flower 1(学んで)、hotspring 2(学んで)、nest/flesh 2×innate0.5=1(学習なし→1のまま)、lewd 3×innate1=3。`heroZoneCost`=`FEAR_COST[段]`(0/0.5/1.5/3.0、scared は4)、`zoneAvoided`=fear≥2。ジェムは fear≥2.5 の中だけ諦める(brave 中は拾う)。探索点は fear≥2 の中に置かない。目当ての採点は fear1 ×0.9 / 2 ×0.7 / 3 ×0.5(価値そのものは残す)。迷い: fear<2 は迷わない、2 は 1〜2秒・入る基礎65%、3 は価値<`FEAR3_WORTH`(2.4)なら迷わず引き返し(scared 40秒)、以上なら 2〜3.6秒・基礎35%。地形の帯に `fearTag`。直接の目標(箱・品・ハート)は種類から価値(2.6/3.0/3.0/3.2)。`hazard:'slow'`(浅瀬)は `heroStat(speed)/154` の逆数(0.3〜1.2)を掛ける。媚薬まみれ(`aphro≥45||heatLv>0||sensit≥60`)なら入る確率+0.25・迷い×0.6・fear3 の価値閾値×0.5、台詞は `resign`。**やっぱ無理(`zoneAbort`)**: fear≥2 の地形に入った位置と火照りを記録し、火照り+15/敏感化+10 で45%、床の手で50%、1入場1回だけ判定。発火すると scared 40秒・中の目当てを捨て・`fleeOut`(入った位置へ4秒、state 'abort')。媚薬まみれなら起きない。
- **最終階層**: `exitTick` は final でも働き、`wantExit` で「魔核へ向かう気」(帯と台詞)。`updateGoal` の core の価値は `EXIT_WORTH_WANT`、`pickExplore` は未知の core へ当たりをつける。

### 3-21. v2.1 ADV演出・引き継ぎ・深淵の圧・石の番兵・AIの降りる判断・マップ台詞

- **ADV(ui.js `UI.adv`)**: `showStory(lines,{onEnd})` は文字列でも `{s,t,f}` でも受け(`storyNorm`)、`#adv`(立ち絵 `assets/ref/lumina_novelai.png`→無ければ `assets/cg/defeat.png`、名前札、文字送り 26字/秒、自動送り 1.8s+0.09s/字、とばす)に1行ずつ出す。**表示中は main.js が tick を回さず描画だけ**(`UI.advOpen()`)、`UI.tickAdv(rdt)` で文字送り。話者: n=地の文(立ち絵は暗く)/lumina(立ち絵が揺れる、`f-heat`/`f-shy` で頬の紅潮)/town/voice。結末・リセットは `showResult` の描画後に流し、台本は `<details>`。物語画面(`htmlStory`)と結果画面は `storyLineHtml` で話者札付き。
- **引き継ぎ(game.js `applyRunHero/snapRunHero`)**: `endBattle` の冒頭で `META.run.hero={level,xp,pray,wp,ps,evo,taste}` を写し、`runReset` で消す。`newHero` の最後に復元: wp/ps を0にしてから `applyUpgStat` を段数ぶん積む(vital/ward/regen/endure の数値も揃う)、`applyPrayStat` で祈りも積む、HP/スタミナは満タン。夜側は `heroLv` 連動の夜の深まり(+4%/Lv・上限+80%、頭数+1/6Lv)と `enMax`(3/Lv・階層上限で頭打ち)が自動的に積み上がる。飽和: `need(l)` に `(1+NEED_SOFT_K·max(0,l-20))`、ジェム経験値に `xpSoft=1/(1+0.03·max(0,Lv-15))`、`PRAY_MAX 30`。
- **深淵の圧(`pressure()`)**: `min(PRESS_MAX, max(0,B.time-PRESS_T0)/PRESS_T1)`(90秒→210秒で1.0、上限2.0)。`enMax()`×(1+0.35p)、EN回復×(1+0.5p)、`spawnCountFor`×(1+0.3p)、`fieldCap()`=260×(1+0.4p)。HUDに数値、0.35/0.9 で帯と台詞。`B.time` は戦闘ごとに戻るので階層を跨げば圧は消える。
- **石の番兵(`spawnSentinels/sentinelTick/exitGuarded`)**: 降り口 POI の周り半径78(縦0.7)に `SENTINEL_N[depth-1]` 体。`B.sentRing={x,y,key,phase,stepCd,stepT,alert,n}` を**生きている先頭の個体だけが進める**(共有の拍)。彼女と穴の距離<250 で警戒: 各個体は彼女の方向±0.45π に均等な角度で、穴から `max(40,hd-34)` の点(=彼女の手前)へ同じ速度で寄り、`stepT>0` の0.45秒は全員が彼女へ300px/s。警戒外は輪を回る(位相0.22rad/s、警戒中0.04)。穴から330以上は出ない。接触で `attachMonster(e,'tether',{r:36,needMul:1.5,armsOnly})`→`state='idle'`(据わる。attached にはしない: 描画・脈が続く)。抱えている間は動かない。`damageEnemy`×0.5。再登場(REENTER)・壁裏の置き直し・汎用接触から除外、`detachLimb` で据わったまま。最後の1体が死ぬと帯「番兵が沈黙した」。`poiTick` の降り口は `!exitGuarded()` が条件。
- **降りる判断(`exitTick`)**: `B.wantExit` は戻らないフラグ。圧≥`EXIT_PRESS`(0.5) / HP<42%(40秒以降) / 目当てが無いか探索だけの累積 `idleGoalT`≥40秒(90秒以降)。切り替わると帯と台詞、`goal` を捨てて `updateGoal` が降り口(価値3.2、`goalValid` は wantExit)を選ぶ。`aiDecide` の「脱出バイアス」: 知っている降り口が開いていれば、逃げ(threat>0.9)にも0.5、牽制の代わりにも0.9で降り口方向を混ぜ、70px内では `threat<1.8` まで踏みとどまる。番兵が居る間は目標点を警戒半径-20(彼女側)に置いて番兵を引き出し、逃げながら撃つ。`leaving`(wantExit)中は `updateGoal` のジェムの群れを外し、降り口以外の場所・資源の価値を×0.3(降り口は6.0)。
- **往復の解消**: `walk = goalOk && goal.kind∉{gems,explore}`(以前は「近くにジェムが無いとき」だけ歩き、FARM_T/FARM_BREAK で往復していた)。歩くときのジェムは `d<170` かつ前方(cos≥-0.1)かつ `d+dist(gem,goal) ≤ dist(goal)+120`。目当てから90px内(`atGoal`)は足元40px以外を拾わない。`updateGoal` に「ジェムの群れ」(半径130内の個数×0.22、上限2.6、3個以上)を候補に追加し、`goalValid` は残り2個以上。乗り換えヒステリシス `GOAL_KEEP 1.25`。
- **諦めの見張り(`giveUpOn/gaveUp`、aiDecide)**: 目標(`target.ref||target`)ごとに最短距離 `tgtBest` を持ち、14px 以上縮まらないまま `GIVEUP_T`=5 秒経てば `B.giveUp`(Map: ref→期限)に `GIVEUP_CD`=40 秒登録し、目当て/経路/探索点を捨てて他へ。品・箱・ハート・ジェムの候補と `updateGoal` の `add()` は登録済みを外す。届かない床(`reachableAt`=彼女の居る領域の流れ場に無い)の物は候補にしない。燭台(撃つ間は足を止める)と降り口の上(`exitD<90`)・番兵の包囲点は対象外。実機報告(石畳の柱の間で「おちてる品へ」のまま回り続けた)への対処。合わせて、経路を辿っている間の壁の反発は 0.6 倍、降りると決めた後は 220px より遠い品・箱を追わない。
- **壁ぞい滑り(`wallSlide`、aiUpdate 毎フレーム)**: 操舵 (dx,dy) から、周囲9タイルの壁のうち `WALL_SLIDE_R`=24px 内のものへ向かう成分(法線との内積が負)を落とす。幅1タイル(32px)の通路では両側が 16px なので横成分が全て消え、軸方向だけ残る=`collideMap` に押し戻されて震えない。滑った結果が元の35%未満なら 0.25 秒で `strafeDir` を反転(牽制の横歩きが塞がれた時)。`collideMap` で 0.5px 以上押し戻されたら速度を半分に(跳ね返りの震え止め。`B.nWallHit` に計数)。経路を辿る間は媚薬の乱れを 0.4 倍、思考の拍では壁の反発(`wallPush` 42px)のうち進路と逆向きの成分を外す(細い入口で押し戻されない)。実機報告(「狭い所を通ろうとするとガクガク」)への対処。A/B(L字1タイル通路・追手5体): 壁衝突 173〜217→5、停止フレーム 163〜167→0、通過 8.3〜12.7s→5.2s。
- **ジェムに足を取られない(aiDecide/updateGoal)**: 実機報告(14:48、Lv66、撃破5.5万、目当て「宝箱 1055px」のまま「ジェム回収」で永遠に留まる)。原因は撃破で降り続けるジェムが道すがらの半径(170px)内に常にあり、磁石(90px)へ飛んでくるジェムまで追っていたこと。対処: (1) 歩いている時は `d<magnet×0.9` のジェムを狙わない(磁石が拾う)、(2) 目当てへ `GOAL_STALL_T`=10 秒で 60px 近づけなければ `noGemUntil`=8 秒のジェム断ち(狙わない)、(3) 群れ目当ては `clusterT` が `GEM_FARM_T`=12 秒に達すると `noClusterUntil`=25 秒、(4) 降りると決めた後は道すがら半径 `GEM_WALK_R_LEAVE`=60、箱×0.3・光の柱×0.5、乗り換えヒステリシスは**今の評価**で比べる(候補から外れた目当ては捨てる)、圧≥1.5 でも半径60。v1.8 の FARM_T/FARM_BREAK は撤去。ジェムの雨(毎フレーム3個・半径30〜150)の再現テスト: 降りる時 45秒で到達せず(−830〜−170px)→ 9秒で降下、箱 45秒で到達せず→ 23〜41秒で到達。`PRESS_CAP` 0.4→0.2(場の上限 最大 364。実機 fps21/敵422 の負荷)。
- **マップ台詞(`sayLine(path,prio,cd,fallback)`)**: `LINES`(lines.js)から1行、同じ path は cd 秒あける、prio≤1 はエロ状態中は出さない(`heroBubble` の優先度に乗せる)。フック: 種族の初見(`seenT>0.45`、1戦1種1回、`knowLv≥2` なら know)、`startEvent`、POI/資源の発見、`storyTick`(階層の独り言)、`linesTick`(0.5秒ごと: 地形 `G.map.feats` の中心+半径、圧0.35/0.9、HP50%、敵が見えない4秒)、`exitTick`、降り口そば(30秒cd)、番兵(守っている/一斉/沈黙)、道すがらの回収(40秒cd)。

### 3-6. 回復=燭台

回復ハートは撃破ドロップしない。マップの**燭台(HP24)を彼女が能動的に撃ち壊した時だけ**
75%でハートが落ちる(残りはジェム)。HP50%未満なら多少の脅威下でも燭台へ強行し、
至近では足を止めて撃つ——**この停止が拘束役の差し込み所**。初期6基+26sごとに補充(最大8)

## 4. 経済(v0.4.1で物量寄りに拡張)

| 資源 | 入手 | 用途 |
|---|---|---|
| EN(戦闘内) | 自然回復0.78+0.07×Lv。上限=12+3×彼女Lv(最大60)+彼女の撃破還元(単価×0.6) | カード召喚(コスト=カード基礎×陣形係数)。CD=1.5+コスト×0.11 |
| エッセンス | 彼女が倒した魔物のxp×0.30 →その日の逓減(S·ln(1+x/S)、S はその日の長さに比例)→×(1+0.12×世代)+勝敗ボーナス(捕獲45/生存25/降下40+15×(深さ−1)/討伐120+60×世代) | 解放・強化(Lv5まで)・融合・陣形解放 |
| オーブ | 与ダメ90ごと+異常付与ごと(2sレート制限)→同じ逓減(S=80×長さ比)→×(1+0.10×世代)+捕獲14+世代内戦歴×4 | 祭壇(初期状態の書き換え・永続) |

### 4-1. コンボ(同一カード連打)

9秒以内に同じカードを重ねると連鎖(最大×5)。1連鎖ごとに召喚体のhp/dmg+12%、
2連鎖ごとに多数陣形(散開/突撃列/包囲/潜伏)の頭数+1。戦闘バーのカードに×Nバッジ表示。

### 4-2. 夜の深まり(ヒロインLv連動)

彼女が育つほど夜側も強くなる: 召喚体のhp/dmg+4%×(彼女Lv-1)(上限+80%)、
彼女Lv4ごとに多数陣形の頭数+1(最大+4)。「育てるリスク」が「物量」で還ってくる。
HUD右上に「夜の深まり +n% / +m体」を常時表示。

### 4-3. 群れ倍化(鈍足の物量)

swarm持ち(ナメクジ/地上ワーム/ゴブリン)は多数陣形の頭数が**2倍**——
突撃列10体・包囲16体級の「押し込み」が基本形になる。
solo持ち(小淫魔/ガス玉)は数が一切増えない(数で強くなりすぎるため。
小淫魔の快感注入も同時2体まで)。

### 4-4. 練度ゲート(物量はカードLvで解放)

コンボ強化・夜の深まり・頭数ボーナス・群れ倍化は**カードLvでスケール**する:
Lv1=乗らない / Lv2=半分(倍化は解放) / Lv3+=フル。
Lv1カードの初戦は素の3体散開のまま——「最初は勝てない壁」はここで守られる。

### 4-5. 場の上限とチャフ経済

同時に存在できる魔物は260体まで(超過中は召喚不可)。
**頭数ボーナス分(基礎頭数を超えた雑魚)はジェムを1/nしか落とさない**——
物量は彼女の経験値・コインの泉にならない(エッセンス・EN還元は満額)。

### 4-5b. 夜側の軍備(オーブ・永続)

夜気の器(EN上限+6×3)/湧き出る瘴気(EN回復+0.12×3)/素早き喚起(CD-12%×3)/
夜の軍団旗(多数陣形+1体×2)/魔性の肉(魔物HP+10%×3)。
また祭壇で**ルミナの自己強化を1段ずつ削げる**(費用=6+3×現ランク)。

### 4-6. ルミナの自己強化(v0.7・ヴァンサバのコイン強化に相当)

彼女は戦闘中に拾ったジェムの50%をコインとして貯え(+生存40/敗北10)、
夜明けに安い順で最大4件まで自動購入する。**世代リセットの影響を受けず永続**。
系統: いのちの祝福(HP+8%×8)/ひかりの護り(護り+0.5×6)/いやしの加護(回復+0.08×8)/
かぜの靴(速度+2%×6)/ねばりの心(スタミナ+6×8)/せいなる火力(与ダメ+6%×8)。
コスト=基礎×1.5^ランク。放置すると1〜5日で大幅に強化される——
プレイヤーの研究所・祭壇との軍拡競争が周回の芯になる。

### 4-7. 階級とデッキ枠(v1.0)

魔物は**雑魚 / 中型 / 大型 / ボス**の4階級。デッキ枠は雑魚2・中型2・大型1・ボス1(計6)。
雑魚・中型は全陣形で出せる。**大型は精鋭(×1.6)か双璧(2体×1.25)のみ、ボスは単騎**。
許されない陣形を選んでいる時は `resolveForm` が許可陣形へ丸め、カードの頭数表示に陣形名を添える。
精鋭型には頭数ボーナス(コンボ/夜の深まり/練度/軍団旗)が乗らない——少数精鋭はコンボの
**強化倍率**だけで育つ。

### 4-8. 燭台のドロップ表(v1.0)

品が出る確率 30%(+よつばのクローバー4%/Lv)。内訳 回復20 / 全消去5 / 全回収3 / ボーナス攻撃2。
外れは小ジェム1〜3個。回復以外の品は床に落ち、彼女が拾って発動する
(AIは脅威0.6未満なら480px以内の品を拾いに行く)。
- 聖光の閃き: 視界内(+520px)の非ボスを全滅。白い閃光。ジェムは通常どおり落ちる
- 星の吸引: 場の全ジェムが彼女へ飛ぶ
- 流星群: 視界内の敵の上へ大粒のスターレイン14発(威力30/範囲60)

### 4-9. ロージェム(v1.0)

基礎頭数を超えたぶんの雑魚は、確率 gemMul で通常ジェム、外れると**経験値0.5のロージェム**を落とす
(v0.9の「たまに1」から「必ず光る」へ)。淫夢の樹が産むワーム(gemMul 0)は常にロージェム。
場のジェム上限は600(超過分は既存ジェムへ合算)。

### 4-10. 宝箱の加勢(v1.0)

彼女が宝箱を開けるたび `chestGift()`: 50%で手札に素材が揃った融合体へ**進化**(未所持でも)、
さもなくば手札に無い非ボス・非融合の魔物をランダムに1枚。`temp:true` でこの戦闘限り、
編成枚数を超えて手札に加わる(表示は「客」)。オート指揮も加勢カードを運用する。

### 4-11. 夜側のアイテム(v1.1)

オート指揮がカードを回す前提で、プレイヤーが直接手を動かす場所。`NIGHT_ITEMS` に定義、
研究所でエッセンス解放、戦闘中はチップで選んで**キャンバスをタップした座標**に置く
(`UI.worldPos` で画面→場の座標。彼女の真上40px以内には置けない)。ENとCDを消費、`cdcut` が乗る。
媚薬の霧壺=大きな媚薬雲 / 粘沼=粘液の跡14個 / 淫紋の罠=`B.traps`(踏むと快感18+敏感10+よろめき、這い寄る手3体) /
催眠電波の塔=`MONSTERS.tower`(tier:item・デッキ不可・HP420・被ダメ30%)を召喚。3.5秒ごとに半径190へ電波、
彼女の `dazeT`(思考の拍×2.2・集中×0.6)と `hypno`(操舵を7割乗っ取り塔へ)を与える。彼女は塔を攻撃できる /
偽りの宝箱=`B.chests` に fake:true。彼女のAIは宝箱を優先して拾う——開けると媚薬雲+手6体。

### 4-12. 自己強化の減衰(v1.1)

世代の夜明け(4戦ごと)に `luminaDecay()` が自己強化を **BAL.LUMINA_DECAY=5段** 減らす(高い系統から1段ずつ)。
1世代で買えるのは最大16段なので差分は正——**初期値には戻らず、土台が少しずつ上がる**。

## 5. ヒロイン仕様

- 基礎(v0.8で高度化): HP175 / スタミナ100 / 護り7 / 回復0.9/s / 速度154。
  **初期装備: ボルトLv2+オーブLv1**。武器基礎威力もUP(ボルト15+5/Lv・オーブ11+4/Lv・ノヴァ16+7/Lv)。
  **世代内戦歴で** HP+18%n・護り+n・回復+0.15n、戦歴1:ボルト3 / 2:オーブ2+ノヴァ1 / 3:速度+攻速。
  対価として陣形の基礎頭数が増加(散開4/突撃列7/潜伏3/包囲10)——「高度なヒロインを物量で沈める」構図
- **視界(v0.4.1)**: 画面(カメラ=彼女中心960×540)+マージン30pxが視界。**画面外の敵は
  存在に気づかず、狙えない**。視界に入ってからも反応まで0.35s前後の遅れ(集中低下で悪化)
- **思考の拍(v0.4.1)**: 進路の判断は0.13〜0.34s間隔でしか更新されない(集中が低いほど遅い)。
  合間は前の判断のまま動く——境界での小刻みな往復(ガクガク)を構造的に排除
- **ガス溜まりの意思決定(v0.4.1)**: 溜まり内のジェムは基本見送る。ただし中のジェムが
  4個以上 or 価値8以上なら「意を決して」1.7秒だけ回避を切って取りに入る(この隙が攻めどころ)
- AI: 脅威回避(潜航中ワーム・未発見の花は見えない)/ジェム・ハート・宝箱回収/カイト。
  発情で操舵にノイズ、拘束・ふらつきで停止
- **武器10種+パッシブ10種+融合進化10種(v1.0)**。武器枠4・**パッシブ枠4**
  - 武器: ボルト/オーブ/ノヴァ/ウィップ(前方薙ぎ)/スターレイン(落下AoE)/クロスブーメラン(貫通往復)/
    **せいいき(自分周りの輪・0.5s脈動)**/**ひかりの刃(向いた方向へ直進)**/**てんらい(視界内ランダム落雷)**/
    **せいすい(地面に聖なる領域=zones。v1.1でランダム落下・低威力に。進化で狙うようになる)**
  - パッシブ: 速度/HP/マグネット/攻撃速度/護り+1/経験値+12%/**範囲+10%(area)**/**投射+1(dup)**/
    **燭台の運+4%(luck)**/**スタミナ上限+10%(endure)**
  - 融合: bolt×speed→シューティングスター / orb×vital→セイクリッドリング / nova×magnet→スターバースト /
    whip×haste→シャインラッシュ(全方位) / rain×growth→コメットフォール / cross×ward→ジャッジメントクロス /
    **sanct×endure→だいせいいき(癒しつき) / blade×dup→せんじん(前後4本・貫通3) /
    thunder×luck→しんばつ(6本一斉) / holy×area→きよめの泉(半径72・6秒)**
  - 範囲パッシブはノヴァ・ウィップ・レイン着弾・せいいき・せいすい・オーブ軌道に、投射パッシブは
    ボルト・レイン・クロス・刃・雷に乗る。一覧は README 末尾
- **今夜の好み(taste)**: 戦闘ごとに各強化への好みがランダムに決まり、AIのビルド選択が偏る。
  手持ち武器を伸ばす傾向はあるが、**噛み合わない夜はDPSが枯れて物量に押し込まれる**
  (ヴァンサバの「ビルド事故」の再現)
- 捕獲=HP0(死亡ではなく制圧)。捕獲シークエンス→リザルト

### 5-1. 称号・総評・自己評価・図鑑(v1.1・js/codex.js)

- **称号**: 誉れ(honor)と裏の記録(ero)。ero は「良い語×悪い語」の対置で s1=一線 / s2=身体 / s3=心、
  系統(拘束=屈辱、魅了・催眠=無自覚、身体、吸い付き、罠、敗北)を持つ。条件は `META.life.ailBy/capBy/capCause`
  等の通算値(厳しく・追加のみ)。種族別敗北称号は2回以上でつく。説明は2〜3文+取得条件。
- **反応段階**: 汎用カタログ第四章どおり `mind≥62→crave / body≥50→yield / body≥25→strain / else resist`。
- **総評**=観測者の筆(記録調・段階が進むほど侮蔑)/**自己評価**=本人の台詞のみ(だよ/じゃん/だし→崩れると幼く)/
  **心の声**=本人も口にしない一行。同じ状態を三つの距離から。催眠経験があると「塔？なかったよ」と本人は認識できない。
- **図鑑**: `CODEX[id]={lore, note:{base, add[3], after}}`。手記は台詞なし・だ・である調・`~~自己検閲~~`・`{{字の乱れ}}`・
  `※欄外注記`。解禁は `META.codex[id]` の seen/met/climax/capture(`codexMark/codexMet/codexClimax` が戦闘中に刻む)。
  追記三は途切れ、その後の地の文(after)で締める——「求めるもの.txt」の記録欄に準拠。

## 6. テキストパイプラインとの分業

**システム側(本リポジトリのコード)は機構・数値・非明示的な演出のみを扱う。**
本文テキスト(捕獲シーン、称号、総評など)は別途の執筆パイプラインが担当し、
以下のフックに差し込む:

- `js/scenes.js` — `SCENES.pin[<id>]={beats:[]}`(押し倒し中に画面下へ順次表示)、
  `SCENES.charmbind[<id>]={beats:[]}`(魅了拘束中・同じ表示枠)、
  `SCENES.capture[<id>]={title,beats:[]}`(敗北リザルト)。未定義時は機構的表示のみ。
  **本文は流し込み済み**(嗜好プロファイル準拠。pin=単一行×巡回、captureは\n改行可)
- `assets/cg/defeat_<id>.png` / `defeat.png` — 敗北スチル画像スロット(defeat.pngはドット化済みルミナを配置)
- `assets/cg/pin_<id>.png`→`pin.png` / `charmbind_<id>.png`→`charmbind.png` / `climax.png` —
  戦闘中カットインCG(画面右のウィンドウ)。置くだけで表示、無ければ非表示
- `assets/sprites/lumina.png` — 戦闘スプライト(35×52ドット絵)。`tools/pixelate.py` で生成
- 観測記録画面 — 称号/総評カードは将来の拡張ポイント(汎用カタログ第五章の並び順に準拠予定)
- 堕ち二軸(肉体/精神)の段階名はカタログ準拠(不惑→…→崩れ / 不動→…→明け渡し)。
  世代リセットで戻る(=「堕ちきらない」設計)

### 運用上の前提

- 登場キャラクターは**全員成人**(汎用カタログの前提と同一)。ルミナは成人として扱う
- 幼さ・未成年性を性的文脈で示唆する要素(学齢表記・体格記号等)は、
  システム側・テキスト側とも**実装対象外**

## 7. バランス調整メモ(v0.4.1テストプレイ結果)

- 素の初期デッキ(ナメクジ/ワーム/ゴースト Lv1・祭壇なし)は3分間ほぼ無傷で生存
  (minHp 139/140)——「最初は勝てない壁」を維持
- 育成後(カードLv3-4+祭壇2段)はオート指揮で1:20前後の捕獲。押し倒し・全四肢拘束・
  発情Ⅲ・コンボ×5が自然発生。場に50体超でも60fps
- オート指揮は「拘束役の維持→拘束が入った瞬間に重打連打→コンボ継続→彼女が
  ガス溜まりに突入した瞬間の差し込み」を優先する
- 尾引き(翌戦への影響)系は次版候補: 捕獲後の次戦デバフ持ち越し、モンスター側の「学習」など

### v1.0 検証結果

- 初期デッキ(Lv1・祭壇なし)は無傷で生存(彼女Lv21〜23、絶頂0)——「最初は勝てない壁」維持
- Lv5デッキ+夜側祭壇: 旧構成(ワーム/羽虫/ゴースト/ガス/大触手/ヴァンピ)は20秒前後で捕獲、
  新構成(手/ワーム/淫蛇/ガス/壺/淫夢の樹)は40〜100秒で捕獲(淫蛇HP・ワームスタミナ)
- Lv3中堅デッキ(ナメクジ/ワーム/ゴースト/淫蛇/媚蛾・5陣形)は場288体まで埋めるが彼女Lv35で生存。
  ロージェム込みの経験値供給が v0.9 より約1.25倍——中盤の壁は次版で調整

### v1.5.1 レビュー修正(v1.5 差分の審査ワークフロー: 17件中 確定8件・自己判定8件)

- ボスゲイザーの扇の幾何が描画/回避(gazerEyes: 270px・0.68rad)と当たり(eyeCycle: 370px・0.8rad)でずれていた → `bossEyeSpec()` を単一の出典に。
- web/tower が学習表にあるのに knowLv/learn が item を弾いていた → item も学習可、巣に捕まる/塔の電波を浴びると learn。
- forcedClimax が効かなかった照射でも lastBeam を記録し、敗北が照射触手に帰属し得た → 早期 return の後で記録。
- lv0(ゲージのみ)の魅了エントリが台詞ゲート(ero)と魅了の糸に効いていた → lv>0 のみ。
- 焼き倍率 gfxK が gfxLv に依存し、fps ガードの段が動くたび全焼き直し → kCap のみに依存(最下段まで落ちたら片道で1倍)。
- thrashGuard が別倍率の古い絵も「満杯」に数えていた/prebake が前戦闘の残りで止まっていた → startBattle で `resetSpriteCache()`、現倍率の枚数で判定。
- 学習の浮き文字「おぼえた: 催眠ゲイザーは認識」が彼女の声で催眠を名指ししていた → 「学習: 目玉のやつ → 認識」(手記の見出し名・システム表記)。
- もがき中も「よける!(おぼえてる)」ラベルが出ていた → state が dodge のときだけ。
- 図鑑カードの「・学習Ⅲ」がアイコンに重なっていた → カード下部の別行(.lrn)。客の帯の「客 N」ラベルがスクロールで隠れていた → ラベル固定+札だけスクロール(#guestscroll)、右端にいた時だけ追従。
- 照射触手の trait 文「照準0.5秒」を1.0秒に。nearKnownTrap の未開花の花(認識不能)については審査で否決(据え置き)。

### v2.1 検証結果

- **ADV**: 出撃直後に序章が開き、開いている間 `G.B.time` が進まない(0.7秒待って同値)。タップで文字送り→次行、閉じると再開。結末は結果画面の上で流れ(`<details>` に台本)、再挑戦の朝・二連敗のリセット・降下(mode=survived で停止→閉じると結果)も確認。縦持ちでは立ち絵を中央、箱を下に。
- **引き継ぎ**: Lv14・武器/パッシブ/進化/祈りの写しを持って次の日を始めると Lv14・ボルト5・オーブ3・マックスハート3・護り9・回復1.2・進化あり・HP満タン、EN上限58(第2層)。二連敗のリセットで `run.hero=null`、第1層へ。
- **深淵の圧**: t=200s で 0.52、EN上限 17→21、場の上限 260→322、散開の頭数 4→5。t=600s で 2.0、EN 29、頭数 7。
- **石の番兵**: 第1層に3体(穴から57〜77px)。彼女が穴の150px内に居ると警戒し、20秒で一斉踏み込み3回、繋留フレーム1323/1200(複数の腕)、番兵が居る間は降り口の `exitT` が進まない。全滅させると6秒で降下。
- **往復**: 236秒の自動戦闘で、目当てへ向かう途中に80px以上戻る「後退」は0回(29の目当て)。降りる決断は圧で195秒、番兵を倒して213秒で降下(新規の彼女)。
- **通し(オート指揮 vs 彼女、1戦600秒上限)**: 第1層 209s降下(Lv24) → 第2層 211s(Lv31) → 第3層 600s時間切れ(降り口未発見・番兵4体健在) → 第3層 98s(前の戦闘で降り口を知っていた) → 第4層 224s(Lv55) → 第5層 451s 魔核撃破(Lv62)。Lvの飽和が効き(飽和前は Lv160超)、夜側の EN上限は 96→111→177→147→224 と階層で積み上がる。降り口が見つからない階層が長引くのを受けて、降りたい時は探索を急ぎ(脅威0.6まで歩く)、石の輪の方向へ当たりをつけるようにした。
  調整後の通し: 第1層 219s(Lv23) → 第2層 204s(Lv33) → 第3層 171s で**石の番兵に捕獲**(降りる前に輪へ入った) → 第3層 217s 降下 → 第4層 231s → 第5層 591s 魔核撃破(Lv53)。時間切れなし。番兵は夜側の捕獲手段として働き、彼女の Lv は 60 前後で飽和する。

### v2.2 検証結果とレビュー修正(8件・全て確定)

- 検証: 包囲円陣は雑魚だけ(ghost→大散開、大触手→精鋭)、輪の平均距離 409px、出現硬直 0.9秒、オート指揮150秒で ring 0〜1回。設置は150秒で15〜17個(淫紋4・霧壺2〜3・粘沼・触手服・時間停止・巣・塔・偽箱)、全てに夜側の印。えちえちエリアは全5階層に生成(床56タイル、祠1・王の宝箱1・宝箱1・宝1・蜜2、到達可)。中に12秒立つと熱+23・敏感化+6、学習で回避対象に。境の迷いは6/6で発生し、入る/やめるが分かれる。魔核は Lv60 完成形でも捕獲(226〜482秒)と討伐(384秒/Lv45)が混じる。
1. 魔核の二本目の根で `state='attached'` のままになり、魔核が彼女の肢へ瞬間移動して止まっていた → 二本目の後にも `idle`。
2. 探索点・ジェムの群れ(ref 無し)を「やめる」で諦めても、同じ探索点が再選択されて境で震え続けた → 探索点を捨てる。`pickExplore` は嫌な地形・えちえちエリア・怖がっている地形の中を候補にしない。
3. 条件が外れたあと `p.hesit` が残り、後で無関係な目標に対して「決めて」いた → 目標が変われば仕切り直し、条件が外れたら消す。
4. 祠の周りの床ならしが岩の輪を破って第3の口を開けていた → 祠は窪地の真ん中。
5. 直接の宝箱狙いが `known` を無視し、見つける前に王の宝箱へ向かっていた → えちえちエリアの箱は見つけてから。
6. 最終階層で喉道の上に窪地が彫られ得た → 喉道の中心線と予備の出口位置を `usedF` に登録。
7. 祠を先に置くと既存の場所の鍵が1つずつずれ、途中セーブの既知/訪問が別の場所に付いた → 最後に置く。
8. HUDの設置一覧が発動済みの罠や壊れた巣/塔を寿命いっぱい数えていた → 実物(armed の罠・生きている巣/塔・残っている偽箱)で数える。
9. (追補) 降りたいのに降り口をまだ知らないと、群れの圧で牽制し続けて地図を進めず、第3層が600秒に及ぶことがあった → 探索点を「逃げる先」(`exX/exY`)にして、逃げ・牽制の操舵にも混ぜる。

### v2.1 レビュー修正(v2.1 差分の審査: 4件・全て確定)

1. 番兵の共有の拍が「抱え込んでいる個体が先頭」のとき止まり、他の番兵が300px/sで突っ込み続けた → 先頭の判定と拍の更新を `holding` の早期returnより前へ。
2. 番兵が振りほどかれた直後に同じ個体が即つかみ直していた → つかみ成功時に `grabCd=4`(据わっている間は減らない)。
3. 物語(ADV)で時間停止中に `fxTick` が止まり、画面の揺れが収まらなかった → 停止中も `G.shake` だけ減衰。
4. 抱え込んでいる番兵が魔物同士の押し合いで動かされ、繋留された彼女ごと引きずられた → `state==='idle'` の番兵は押し合いで不動。

### v2.0 検証結果

- 階層: 2世代×5階層を生成し、全ての場所(祠・泉・清水・石碑・降り口/魔核の間・封印石)が到達可能。壁様式 岩/岩/岩/煉瓦/肉。EN 上限 17→19→21→24→27.5(Lv1)、ゴブリン HP 16→15→17→20→23。
- ループ: 降り口のそばに立って 4.9 秒で次の階層へ(run.floor 1→2)。同じ階層で二連敗 → 入口・世代+1。魔核を討つ(HP 17280・被ダメ 63%)→ clear・世代+1。魔核は根で 881 フレーム繋ぎ、脈動 6 回/25 秒、据わったまま。
- 編成: random/auto とも階級上限を守る(auto は得意種 5/13)。オート指揮のボス初手は 14 戦で 5 種に散る(4/2/3/2/3)。紋の熟知で 40〜46% 払う、認識で見える罠から離れる。
- 新種: 淫翼は 1.8 秒抱いて離れる(敏感化 22)、水妖は水面下→浮上→脚に絡み足を鈍らせる(899 フレーム)、肉壁の口は 8.5 秒吸って快感+14・発情 35、番人は呪弾 3 発で淫紋 1。新武器の 6 秒 DPS: 聖鎖 Lv3 28 / Lv8 進化 322、精霊 64 / 572、盾は触れた敵のみ。盾は呪弾 20/20 を弾く。新進化 3 つが Lv5+相方 Lv2 で解禁。
- 物語: 序章 10 行・各階層 導入4/独り言4/降下3・再挑戦 12 行(4 変奏)・対峙 8・結末 12・リセット 6。独り言は全て 22 字以内。
- 不変量(第1層): 初期デッキは 165 秒で降り口へ(Lv17・絶頂 0)、Lv5 新構成は 106 秒で捕獲(1戦)。

### v2.0 レビュー修正(第1回: 5件)

- 新武器/パッシブ/進化の鍵が newHero の wp/ps/evo に無く、取ると NaN になって撃てず、枝の上限も無視していた → 鍵を追加。
- 魔核・肉壁の口が繋ぐと彼女の四肢に吸い付いて動き、振りほどきで飛ばされ、繋いでいる間は脈動も止まっていた → attached にせず据わったまま繋ぐ(根 210px / 口 40px の繋留が本当に効く)。detachLimb でも動かさない。
- 最終階層でカードのボスが「同時1体」に弾かれていた(魔核が数えられていた) → guardian は数えない。HUD はカードのボスを優先。
- 潜行の日数(gen.battle)が増え続けるのに newHero の HP/護りが日数に比例していた → 3 で頭打ち。
- 結果画面の「もう一度出撃」が編成モードを無視していた → applyDeckMode。

### v1.9 検証結果

- 縦持ち 720×800(スマホ横幅相当): キャンバス 709×399 を上に、バー 224px を下に、重なり 0。412×860 でも重なり 0(キャンバス 406×228)。横持ち 1400×800: 札 13 枚+客 2 でバーは 375→242px(一列化)、ミニマップと文章はバーの上。
- 武器: 上限 8 の 4 武器(進化1つ)は Lv5 の同構成に対して 8 秒の与ダメ 886→2024/s(約 2.3 倍。覚醒 3 段=火力+45%・間隔×0.80・オーブ 8 個)。進化は Lv5 で解禁。全部が上限のレベルアップでルミナの祈り(火力 ×1.04・HP 175→180)。Lv8 の武器は候補に出ない。

### v1.8 検証結果

- 地形の資源は全て地形帯の中の床に置かれる(光茸4・蜜の花3・沈んだ宝1)。場所は 10(祠3・泉2・門1・清水2・石碑2)。
- 魔物なしで 115 秒歩かせると、移動 15,800px(平均 137px/s)、目当ての切り替え 18 回(探索→光茸→石碑→祠→沈んだ宝→…)、光茸 10・沈んだ宝 2・石碑 2・蜜の花 1 を使い、光の柱 2 回とも辿り着いた。知っている場所 9/10。詰まり脱出 0。
- 光の柱(宝箱): 3.1 秒で目当てに、9.3 秒で開けた。清水: 敏感化 70・粘液の状態で 945px 先の清水へ 13.5 秒、敏感化 70→25・発情 0・粘液消し。石碑: 6.4 秒で読み、知識 0→1、場所+1。蜜の花: スタミナ 20 で 1344px 先へ(他の目当ての後、68 秒)。
- 宝箱は画面に入ると覚える。目当ての計算は 0.033ms/tick。
- 不変量: 初期デッキ(Lv1)は生存(彼女 Lv24〜27・絶頂 0)、Lv5 新構成は 62〜64 秒で捕獲(歩き回る分だけ v1.7.1 の中央値 42 秒より遅い。夜側が目当てを見て先回りすれば縮む——オート指揮は待ち伏せをしない)。

### v1.8.1 レビュー修正(v1.8 差分の審査: 7件)

- 清水が祭壇『感応増幅』/呪いの敏感化の下限を割っていた(下限≥35なら毎回欲しがり続けもする) → 下限までしか流さない。`poolWant` は下限+10 以上で欲しがる。
- 目当てへの歩きが脅威の門(急ぎ 0.6 / それ以外 0.3)を素通りしていた(ジェムの範囲だけ縮めていた) → 脅威が濃いときは目当てを取らず牽制/回避へ戻る。
- 光茸の群生: 中心へ歩くと拾えない距離(26〜34px)に生えていた → 10〜14px に。目当ては残っている光茸そのものへ向ける。
- 清水/石碑の開始条件に魅了拘束の除外が無く、毎フレーム開始し直していた(バナー固定・台詞連打) → `!p.charmBind`。
- 門の移設後も「知らない場所」を目当てに持ち続け、HUD に方角と距離が出ていた → `goalValid` は知っている場所のみ、移設時に目当てを捨てる。
- `randZoneSpot` が範囲外でもその地形帯のどこかを返し、呼び側の `placeNear` への切り替えが死んでいた(小さな回廊に立つと宝箱/光の柱が足元に出た) → 範囲内に無ければ null。資源は範囲を広げて再試行。
- 清水の時間: 定数 2.2 秒と文言 2 秒がずれていた → 2.0 秒。
- 修正後の確認: 光の柱(石碑)3.2 秒で目当て・16.8 秒で達成、清水 13.4 秒、石碑 6.4 秒、蜜の花 11.8 秒。初期デッキ生存(Lv25・絶頂0)、Lv5 新構成 47 秒で捕獲(脅威の門が戻り v1.7.1 の中央値 42 秒に近づいた)。

### v1.7 検証結果

- ダンジョン地形: 112×72 タイル(32px)。岩壁 30 塊(4割は崖)+崖の稜線 6 本、通路は幅3以上に掘って全床が繋がる(floodReach→carveTo)。A* 2.5ms、BFS 流れ場 0.29ms。
  区画(8×8タイル)ごとに1枚に焼いて描く。初回は 5×3 区画を先に焼き、以後は1フレーム2区画まで。
- 回り込み: 壁の裏 350〜700px のゴブリンは 10〜17 秒で到着。壁に触れた状態で包囲を出しても最短 492px、全て床の上で届く場所(彼女の真横に落ちない)。
- 地形の学習: 浅瀬に 0.5/秒、花園・温泉に 0.35/秒で `zoneKnow` が溜まり、1.2 以上で回避(ジェムも諦める)。世代が変わると忘れる。
- 押し合い: 220 体を密集させて 2.5ms/フレーム、重なり 0、彼女の中心には入らない(拘束中の「ぎゅうぎゅう」)。
- オート指揮: 開幕 2 秒で大触手、45 秒でゴブリンの王を出す(EN が足りない間は小技を控える)。
- 初期デッキ(Lv1)は生存(彼女 Lv21〜22)、Lv5 新構成は 30〜35 秒で捕獲——ダンジョン地形でも不変量を維持。

### v1.7.1 レビュー修正(v1.7 差分の審査: 7件・うち高4件)

- 流れ場の向きが、彼女の座標を直接追う種(通常追跡・手・幽鬼手・旋回する小淫魔/媚蛾/淫魔/女王)で使われていなかった → 追跡は流れ場で置き換えた dx/dy を使い、
  旋回組は `e.blocked`(視線が壁で切れた)の間は旋回せず流れに沿って歩く。150〜320px の壁越しから 8 種すべて 2.5〜5.5 秒で到着、置き直し(瞬間移動)0 回。
- 置き直し条件を「320px より遠くで3秒不動」から「壁で視線が切れたまま 320px より遠くで3秒不動」に。距離を保つ刻印師(330px)が 12 秒で置き直されないことを確認。
  修正前は壁に押し当たった個体が1戦で 14〜94 回も彼女の近く(336〜560px)へ飛んでいた(実質の瞬間移動)。修正後は 0〜3 回。
  その分 Lv5 新構成の捕獲は中央値 36 秒 → 42 秒(6 戦: 35/45/38/45/59/40)と少し遅くなるが、壁を正直に回り込む挙動の代価として受け入れる(不変量は維持)。
- 崖の上で倒れた飛ぶ魔物のジェムは、届く床へ落とす(`dropGem` で snapFloor)。
- 流れ場が同じ世代の次の出撃に残っていた(前戦の最後の位置へ流れる) → genMap の早期 return で `flowT/heroTile` を捨て、初フレームで作り直す。
- 王の宝箱が壁の中に落ちると彼女が取りに行って壁に貼りつく → `snapFloor` で床に置く。彼女は壁の中の箱・ハート・ジェムを狙わない。
- 門の移設が壁を見ていなかった → 床かつ届く場所に限り、タイル中心に置き、周囲 5×5 を開ける(`clearAround`: 区画の絵・縮小図・流れ場を捨てる)。
- 押し合いの質量: ボスが 12(最軽量)だった → r²×8。設置物(`u.item` が未設定だった)と動かない種は不動。押した後の壁補正を全個体に。
  振りほどきで 30px 飛ばされた個体・被弾ノックバックの彼女も壁の当たりを取り直す(岩に入らない: 40/40・30/30)。
- 詰まり脱出の目的地: 目的地(壁に貼りついた原因)ではなく、届く床の上の探索点(`pickExplore`)へ。

### v1.6 検証結果

- 催眠ゲージ: 閃光の列 1:0 → 1:55 → 2:10 → 2:44 → 2:78 → 3(Ⅰ一発・Ⅱ二発・Ⅲ三発)。ゲイザー4体で canPlay=species、5体目は出ない。
- 雄臭の雲: 彼女を留めて8秒で発情ゲージ64・敏感化+20・快感0(足止めなし)。発情中20秒で性癖Ⅰ。ガス雲6秒で発情ゲージ54・敏感化41・快感0。
- 意志20: HP175→280、火力×1.4、スタミナ130。敗北(30秒)で意志+3、生存で-1。呪い: 刻印師の影響下で敗北→『淫紋焼き付け』2日、次戦は淫紋Ⅰ・疼き常時、2戦で消える。
- 包囲: 花16/ナメクジ10/ゴブリン7、半径比1.0。ロージェム 1,0.9,0.8,0.75,0.7,0.6,0.5。燭台初期9。ボス: 出撃で bossCd 60、他ボスは bosscd→boss1、同ボスは出撃済。
- 新ボス: 粘獣王の呑み込みで脚2本繋留+slow1.5、刻印師の伏せ紋で淫紋、女王の波で発情ゲージ28/20秒、王の雲3(boss付き)。全て例外なし。
- 地形: 世代1と2で地形が変わり、同世代は同一。中心は苔。端で彼女/魔物が clamp。湿地のナメクジHP 14→17.5、浅瀬でスライム52→67.6・彼女154→136、石畳163。
  祠: 見えて known、着いて自己強化+1。泉: HP50%で入浴→全快・発情ゲージ37。門: 13秒で突破(コイン+80・意志+1・移動)。
  知っている祠へ 726→35px を5秒で歩き、訪問後は探索へ。探索は8秒で1097px移動。
- 初期デッキ(Lv1)生存(彼女Lv23〜25)、Lv5新構成 32〜37秒で捕獲(有限マップでも不変量を維持)。
- 敗北シーン: 既存27種を各4拍延長(8→12拍。壊れの中盤を厚く、最終行はそのまま)。新ボス4種は12拍+押し倒し6拍。NG語・語尾・♡の位置・催眠の自覚を機械チェック。

### v1.5 検証結果

- 魅了ゲージ: ナメクジ接触 45→90→(135)Ⅰ残35→72→(109)Ⅱ残9。20秒放置で0まで減衰(段階は残る)。
- 学習: met1→認識、met4→理解、met8→熟知、敗北1→+1。世代交代で know が空になる。
- 回避(学習を固定・4戦×60秒を3回・ゲイザー2+照射1): 未知 光条命中45〜60%/閃光41〜52%・回避行動0秒 → 熟知 12〜29%/2〜5%・回避行動74〜85秒(認識は中間で分散が大きい)。
- ボスゲイザー: 脇の眼の off ≈ ±0.46〜1.0rad で固定、中央0。三眼は交互に aim。
- 初期デッキ(Lv1)生存(彼女Lv23-24)、MID 44-147秒・Lv5新構成 34-40秒で捕獲。実戦デッキ(9種)49秒・最大295体でキャッシュ194枚(2倍焼き・溢れなし)。
  22種同時の描画ベンチは鍵空間が上限を超えて焼き直しが続くが、thrashGuard が約5秒で1倍へ落とす(ヘッドレスのソフト描画で 113→86ms/フレーム)。
- レビュー修正: 照準線がワールド座標で299px届く、焼き canvas は S×2、ガス/女王の鍵が溜めで変わる、強制絶頂6秒内の敗北→beamer、
  催眠Ⅱでの敗北/押し倒し→gazer、雄臭は性癖Ⅰのまま60秒嗅いでも昇格せず(自前の快感を除外)、他から快感を受けながら嗅ぐと結びつく。

### v1.3 検証結果

- 回り込み: 1500px先の個体が1tickで560px圏へ移動。ゲイザー aim→flash→催眠Ⅰ、抵抗ゲージ0、催眠Ⅲの自慰発火、
  照射触手 aim→fire→強制絶頂、ボスゲイザー3眼、雄臭(嫌悪→嗅ぐ→条件付け→性癖Ⅰ→発情0で快感上昇)をヘッドレスで確認。
- 初期デッキ(Lv1)は回り込みが入っても生存(彼女Lv21・絶頂3)。Lv5新構成は35秒で捕獲。

### v1.2 検証結果

- 初期デッキ(Lv1)は無傷で生存(彼女Lv23)。Lv5新構成+夜側祭壇は30秒で捕獲、Lv3中堅は1:03で捕獲(魅了)。
- 寸止め→深い絶頂(硬直5.4秒・発情二段)、憑依、視姦→撮影、淫糸の四肢繋留、触手服、淫紋Lv、時間停止の蓄積解放、おねだりの発火をヘッドレスで確認。

### v1.1 検証結果

- 初期デッキ(Lv1)は無傷で生存(彼女Lv23)。Lv5+夜側祭壇は16〜30秒で捕獲。
- Lv3中堅デッキ(5陣形・祭壇なし)は2:08で捕獲——せいすい弱体・大散開・EN回復1.0で中盤の壁が締まった。
- 催眠電波の塔・淫紋の罠・偽りの宝箱の発動、図鑑の解禁段階、称号の条件判定をヘッドレスで確認。

## 8. v0.4以降の候補

- 称号システム(良い語×悪い語の対置、観測記録に表示)
- 出現方法の追加(渦巻き、時間差包囲)、ステージ・時間帯バリエーション
- ヒロイン側の新武器/新パッシブ、ヒロイン追加の骨組み
- モンスター側のシナジー明示(タグ: 拘束/熱/粘/重打)とデッキ検証UI
