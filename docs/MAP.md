# 触る場所の地図 — どこを編集すると何が変わるか

**このファイルの役目は「逆引き」です。** 何をしたいかは分かっているが、
どのファイルのどこを触ればいいのか分からない時に開きます。

- 「なぜそうなっているか」「何を守るべきか」は **`docs/BRIEFING.md`**(先にそちらを読むこと)
- 関数名・定数名つきの詳細仕様は **`docs/DESIGN.md`**(節を引く)
- 版ごとの実装と実測値は **`README.md`**

★**この索引の参照は `python3 check_map.py` で機械的に検証されます。**
書き換えたら必ず走らせること。存在しないファイル・関数・`BAL` キーを書くと落ちます。

---

## 1. 三十行のプロファイル

**R-18のブラウザゲーム。HTML + 素のJavaScript、フレームワーク無し。**
ヴァンパイアサバイバーズ風の見下ろし戦闘ですが、**操作するのは魔物(夜)の側**です。

- ヒロインは完全AI。**プレイヤーの入力は一切ヒロインに届きません**
- 夜側の勝利 = ヒロイン全員を捕獲する / 夜側の敗北 = ヒロインが深淵の底の「魔核」を討つ
- **1日 = 1階層**(全15階)。降り口に着けば次の階へ、捕まれば夜側の勝ち
- ループの芯: **忘れるのは倒した側**。詳細は BRIEFING §2(★ここを取り違えると全部ずれます)

```
ホーム → 編成 → 出撃 → [1日ぶんの戦闘] → 結果 → 研究所/祭壇で強化 → 翌日 …
```

**ヒロインは4人**: ルミナ(光・遠隔)/ フレイラ(火・近接)/ クウ(氷)/ ヤミコ(闇)。
最初はルミナ一人で、**巻き戻しのたびに仲間が増えます**(`js/data.js:PARTY_JOIN`)。

**読み込みは素の `<script>` を26本、`index.html` の順番どおり**。
モジュールではないので、**全部がグローバル変数を共有**します。順番は:

    core → data → scenes* → codex* → story* → lines* → map → game → render → ui → main

つまり `js/data.js` で定義したものは `js/game.js` から裸の名前で見えます。逆は見えません
(`js/data.js` の中で `G.B` を触る関数は、呼ばれる時点では存在しているので動きます)。

| ファイル | 行数 | 役割 |
| --- | --- | --- |
| `js/core.js` | 321 | 基盤。`G`(実行時状態)・`META`(セーブ)・音・小道具 |
| `js/data.js` | 1794 | **全定義データと `BAL`(バランス定数)** |
| `js/game.js` | 9142 | **戦闘の本体**。ヒロインAI・魔物・状態異常・パーティ・魔核 |
| `js/render.js` | 4471 | 描画(魔物の絵もここ) |
| `js/map.js` | 1261 | 地形生成・ゾーン・POI・ミニマップ |
| `js/ui.js` | 971 | DOM画面(ホーム/編成/研究所/祭壇/図鑑/物語) |
| `js/main.js` | — | 起動とメインループ |
| `js/scenes*.js` | 3712 | 押し倒し・敗北の本文(ヒロイン別) |
| `js/lines*.js` | 4273 | マップ上の台詞(ヒロイン別＋パーティ) |
| `js/story*.js` | 1456 | 物語(ADV形式 `{s,t}`) |
| `js/codex*.js` | 1871 | 図鑑・手記・称号・観測記録 |

---

## 2. ★逆引き — 「〜したい」→ 触る場所

### 2-1. バランスの数字を動かす

**ほぼ全ての数字は `js/data.js` の `BAL` にあります。** まずそこを探すこと。

| したいこと | 触る場所 |
| --- | --- |
| 魔物を強く/弱く | `js/data.js:MONSTERS` の `hp` `spd` `dmg` `r`。深さ倍率は `js/data.js:FLOORS` の `mon` |
| ヒロインを強く/弱く | `js/data.js:HEROES` の `hpMul` `spdMul` `dmgMul` `stamMul` / 階層側は `FLOORS[].hero` |
| 武器の火力・間隔・範囲 | `js/data.js:UPG`(定義)と `js/game.js:weaponsUpdate()`(実際の挙動)。Lv6〜8 の伸びは `js/game.js:wpOver()` |
| 拘束のされやすさ | `BAL.PIN_STAMINA_TH` `BAL.PIN_STAMINA_FRAC` と `js/game.js:attachMonster()` |
| 快感・絶頂の入り | `js/game.js:applyPleasure()` / `js/game.js:applySensit()` / `js/game.js:addHeatG()` |
| 夜側のEN(手札のコスト) | `BAL.EN_START` と `FLOORS[].en` |
| 階層ごとの顔つき | `js/data.js:FLOORS`。地形は `zoneW`、巣窟は `lewd.mix`、壁は `wall` |
| 深淵の圧(時間で増える) | `js/game.js:pressure()` と `BAL.EXIT_PRESS` |

★**新しい責めの定数を書いたら、必ず一度「立たせて増分を測る」**。
敏感化には自然減衰(`BAL.SENSIT_DECAY`)があり、これを下回る値は**丸ごと打ち消されて死にます**。
BRIEFING §5 に、同じ罠を三度踏んだ記録があります。

### 2-2. ヒロインの振る舞いを変える

**判断は `js/game.js:aiDecide()` の一本道です。**(約400行。ここが AI の全部)

    aiDecide()
      ├ 早い枝: 拘束・逃走・魔核戦 …… ここで抜けると目当ての所まで来ない
      ├ 直接の目標: ハート → 燭台 → 落ちた品 → 宝箱   ← updateGoal を通らない
      ├ updateGoal(p) → updateGoalSolo(p)             ← 目当ての採点
      ├ 迷い(境で立ち止まる)
      ├ ジェムの寄り道
      └ 舵の後段: 魅了・発情・催眠・むせ が向きを上書きする

★**`aiDecide()` は毎フレームは回りません。** `BAL.THINK_MIN`〜`BAL.THINK_MAX`(0.13〜0.34秒)に
一度で、催眠と朦朧でさらに伸びます。**判断の中に印を置いてフレームごとに読むと 85%が古い印**になります。

| したいこと | 触る場所 |
| --- | --- |
| 行き先の選び方(何を優先するか) | `js/game.js:updateGoalSolo()` の `add(kind,sub,x,y,worth,ref,key)` 呼び出し群 |
| ヒロインごとの好み | `js/data.js:HEROES` の `pref`(`{shrine:1.2, stairs:0.95, …}`) |
| 嫌な地形の避け方 | `js/map.js:zoneFear()` と `js/data.js:ZONES` の `fear` / `innate` |
| 境で迷う長さ・入る確率 | `BAL.HESIT_GO_BASE` `BAL.HESIT_GO_KNOW` `BAL.HESIT_KNOWN` `BAL.HESIT_NEW` |
| 媚薬沼の縁の逡巡 | `BAL.MIRE_LOOK` `BAL.MIRE_HESIT_T` `BAL.MIRE_BRAVE_T` |
| いつ降りる気になるか | `js/game.js:exitTick()`。理由は `press` / `hp` / `done` / `flee` / `worn` / `full` |
| 諦め・怖がりの持続 | `BAL.GIVEUP_CD`(40秒)`BAL.SCARED_T`(40秒) |
| 仲間をかばう条件 | `js/game.js:coverTarget()` と `BAL.COVER_TH` `BAL.COVER_HOLD` |
| 探索点の選び方 | `js/game.js:pickExplore()`。第二引数 `force` は「何も無い時の最後の受け皿」 |

★**目当てが「なし」に見えても、たいていは異常ではありません。**
`updateGoal()` は `if(!target && G.map)` の時しか呼ばれないので、
宝箱へ歩いている間は `p.goal` が古いまま(=null)になります。DESIGN §3-53 に実測があります。

### 2-3. 地形・マップ

| したいこと | 触る場所 |
| --- | --- |
| 地形帯を足す/変える | `js/data.js:ZONES`(★`ZONE_IDS` は `Object.keys` の順なので**必ず末尾に足す**) |
| どの階にどの地形が出るか | `js/data.js:FLOORS` の `zoneW`(重み) |
| 巣窟(えちえちエリア)の中身 | `js/data.js:FLOORS` の `lewd`。仕掛けの数は `mix:{rune,flower,beam,grip,seed,seedN}` |
| 巣窟の効きの強さ | `js/game.js:denPower()` / `js/game.js:denDeepPower()` / `BAL.DEN_HEAT` `BAL.DEN_SENS` |
| 媚薬沼 | `js/game.js:mireAt()` `js/game.js:mireDepthAt()`。★**沼は地形ではなく重ね物**です |
| 場所(祠・清水・降り口…) | `js/data.js:POI_DEF` と `js/map.js` の配置、効きは `js/game.js:poiTick()` |
| 設計された地形(闘技場・崖の道) | `js/map.js:genMap()` の中のテンプレート |

### 2-4. 魔物

| したいこと | 触る場所 |
| --- | --- |
| 新しい魔物を足す | `js/data.js:MONSTERS` に定義 → `js/game.js:enemiesUpdate()` に挙動 → `js/render.js` に絵 → `js/codex.js` に図鑑文 → `js/scenes*.js` に敗北本文 |
| 挙動だけ変える | `js/game.js` の `〜Tick(e,dt,d,dx,dy)` 群(`js/game.js:sentinelTick()` など) |
| 掴み方 | `js/game.js:attachMonster()` が**全ての掴みの入口**。回避判定もここ |
| 動かない個体(据わり) | `js/data.js:isSeated()` と `js/data.js:SEATED_FORCE` |
| どの階に出るか | `js/data.js:FLOORS` の `affinity` |
| 解放費と深さの錠 | `MONSTERS[].unlock` と `js/data.js:deepOk()`(`DEEP_COST` の表) |
| 系統(ヌメリ/触手/淫魔/眼/胞子/霊) | `js/data.js:FAMS`(表示名)と `js/data.js:FAM_OF`(id→系統)。引くのは `js/data.js:famOf()` |
| 系統ボーナスの効き | `js/game.js:deckFam()` が `{fam,name,n,cap,cut}` を返す。`BAL.FAM_MIN`/`BAL.FAM_MAX` と、系統ごとの上限 `js/data.js:FAM_CAP`(MONSTERS から数える)・一枚あたり `js/data.js:famStep()`。戦闘開始時に `B.fam` へ焼き、`js/game.js:playCard()` の `slot.cdMax` に掛かる |
| 蒸発を吸ってむせる / 学習 | `js/game.js:evapBreathe()` → `js/game.js:chokeTick()`。学習の行を言うのは焚いた本人だけ(`h.chokeMine`)。DESIGN §3-73 |
| 焚いた円が巣窟・澱みに掛かるか | `js/game.js:denHazeNear()`。`dryAuraTick`(学習後は炎を落とす)と `dryEvapCheck` の両方から呼ぶ |
| 捕まった子に起きること | `js/game.js:captiveTick()`。責め手の入れ替え・振りほどき・快感は `BAL.CAP_*`。カメラは `js/main.js` の `!h.out||h.captive` |
| 捕まった仲間を助けに行く | `js/game.js:captiveFor()` が相手を返し、`aiDecide` の `p.capSave` の枝が向かう。距離を詰めた後は `js/game.js:rescueTick()`。DESIGN §3-67 |
| 一瞬の絶頂ビーム | `js/game.js:beamerTick()`(絶頂照射触手)。`BAL.BEAM_AIM`/`BAL.BEAM_CD` |
| 持続するレーザー | `js/game.js:raytentTick()` と `js/game.js:rayStep()`(レーザー触手)。`BAL.RAY_*`。避けと「元を断つ」は `aiDecide` の `p.raySrc` |
| クウが沼に橋を架ける | `js/game.js:iceBridge()` →`js/game.js:kuuIce()`。`BAL.ICE_BRIDGE_WET` |
| 休んでいる間に滑る | `js/game.js:aiUpdate()` の速度の積分で `poolT/readT/lantT2/bathT` を見て steer ごと殺す。DESIGN §3-70 |
| 系統ボーナスの天井を揃える | `js/data.js:FAM_CAP` が「その系統に詰められる枚数」。満枠でどの系統も `BAL.FAM_MAX`。DESIGN §3-64 |
| 研究所に並ぶ種の絞り込み | `js/ui.js:htmlLab()` の頭。`item`/`guardian`/`variant`/`field` を弾く(`js/game.js:ownedIds()` と同じ条件にすること) |
| 居ない子の台詞を落とす | `js/story.js:storyKeepFits()`(変奏なしの塊)/ `js/story.js:pickStoryFor()`(変奏あり)/ `js/story.js:storyIfFits()`(合わなければ使わない)。DESIGN §3-65 |
| 淫魔の指揮(一個下の階級を強化) | `BAL.DEMON_R`/`BAL.DEMON_PW`/`BAL.DEMON_SPD`/`BAL.DEMON_ACT`、`js/game.js:DEMON_CMD`(誰が何を指揮するか)と `js/game.js:demonCmdAt()`。★`e.spd` はフレームごとに戻す |
| 絶頂禁止(旧・寸止め) | `js/game.js:applyDeny()`/`js/game.js:releaseDeny()`、溜まりは `h.denyOver`、`BAL.DENY_OVER_STAM` |
| おあずけ(夢魔の女王) | `js/game.js:applyOmazuke()`(見張りの更新)と `js/game.js:omazukeEdge()`(寸前で止めた瞬間)。`BAL.OMAZUKE_NEED` |
| 眼の条(壁まで流れる光) | `js/game.js:rayStep()`/`js/game.js:rayLen()`/`js/game.js:rayDeep()`、`BAL.RAY_LEN`/`BAL.RAY_DEEP`/`BAL.BEAM_WAKE` |
| ハイと中毒 | `js/game.js:puffSpores()`/`js/game.js:inhaleSpore()`/`js/game.js:highTick()`/`js/game.js:addictSeek()`、`BAL.HIGH_T`/`BAL.CRASH_STAM`/`BAL.ADDICT_SEEK` |
| 魔物が増えすぎる | `js/data.js:SPECIES_MAX`(カードの同時上限)。★オート指揮は安いカードを連打するので、雑魚を足したらここも見る |
| ボスが深さで強くなる | `js/game.js:bossRank()` と `u.brank`(★熟れた個体の `u.rank` とは別物)、`BAL.BOSS_RANK_D` |
| オート指揮が特化デッキで黙る | `js/game.js:handOrder()`。`PRESSURE`/`FLUSH_ORDER`/`REFILL_ORDER` の名指しが尽きたら手札から継ぎ足す |

### 2-5. 文章(台詞・本文・図鑑・物語)

**★4人ぶん揃えるのが原則です。** 対応表:

| 種類 | ルミナ | フレイラ | クウ | ヤミコ |
| --- | --- | --- | --- | --- |
| マップ台詞 | `js/lines.js`(`LINES`) | `js/lines_freila.js`(`LINES_F`) | `js/lines_kuu.js`(`LINES_K`) | `js/lines_yamiko.js`(`LINES_Y`) |
| 押し倒し・敗北 | `js/scenes.js` | `js/scenes_freila.js` | `js/scenes_kuu.js` | `js/scenes_yamiko.js` |
| 手記(図鑑) | `js/codex.js` | `js/codex_freila.js` | `js/codex_kuu.js` | `js/codex_yamiko.js` |
| 観測記録・自己評価 | `js/codex.js` | `js/codex_status.js` | `js/codex_status.js` | `js/codex_status.js` |

- 声の表を引くのは **`js/game.js:linesFor()`**。
  ★**ルミナだけ `null` を返します**(彼女は共通の `LINES` を見るため)。
  これを知らずに監査を書くと、彼女だけ全部穴に見えます(実際に踏みました)
- 鳴らすのは `js/game.js:sayLine(path,prio,cd,fallback)`。
  `prio<=1` は**エロ状態の間は鳴りません**(台詞の主導権はエロ側)。確実に出したいなら `prio>=2`
- パーティの掛け合いは `js/lines_party.js` と `js/game.js:sayPartyAs()`
- 物語(ADV)は `js/story.js` / `js/story_v30.js`。`{s:話者, t:本文, f:表情}` の配列。
  ★**`js/story.js:storyNorm()` が、合流していないヒロインの台詞を自動で落とします**

★**フォーマットが二種類あります。** `js/lines.js` は1行配列
(`"key": ["a", "b"],`)、他の3人は複数行配列です。
機械的に差し込む時は、**必ずそのファイルの既存の書き方に合わせること**(混ぜると構文が壊れます)。

### 2-6. 画面

| したいこと | 触る場所 |
| --- | --- |
| 戦闘中のHUD | `js/render.js` |
| ホーム/編成/研究所/祭壇/図鑑 | `js/ui.js` |
| 結果画面 | `js/ui.js:showResult()` |
| 物語のADV箱 | `js/ui.js:showStory()` |
| 魔物・ヒロインの絵 | `js/render.js`(全部コードで描いています) |

---

## 3. データの形(ハーネスを書く時に要る)

### `META` — セーブ(`js/core.js:defaultMeta()`)

    META.essence / .orbs                夜側の通貨
    META.era                            ★ヒロインが魔核を討った回数。開く階層 = 2 + era
    META.gen  { idx, battle, know{}, marks, fed }
                                        世代。know は種族ごとの学習 {id:{met,cap}}
                                        marks は石段の線(二連敗の回数。巻き戻しでも消えない)
    META.run  { floor, fails, day, hero, heroes{}, seen{}, bossSeen }
                                        いまの潜行。floor が階層(★era でクランプされる)
    META.party{ roster[], joined{}, resets }   出撃するヒロイン
    META.cards{ id:{owned,lv} } / META.deck[]  手札
    META.map  { gen, floor, known{}, visited{}, seen }   地形の記憶
    META.lumina{ coins, will, upg{} }   ルミナの自己強化
    META.codex / META.codexH{ヒロインid}  図鑑(総体 / その子の頁)
    META.lifeH{} / META.rotH{}          ヒロインごとの通算 / 世代内の帳簿

★`META.run.floor` に深い階を入れても、**`META.era` が低ければクランプされます**
(`js/data.js:curFloorIdx` は `openFloors()-1` で頭を抑える)。深い階を測る時は era も上げること。

★`wipeMeta()` で測ると `META.gen.marks` が 0 になり、**ありえないほど弱いパーティ**を測ることになります
(線は最大で HP+48%・与ダメ+36%)。

### `G.B` — 戦闘状態(`js/game.js:startBattle()`)

    B.time                      その戦闘の経過秒(★戦闘ごとに 0 へ戻る)
    B.heroes[] / B.ci / B.hero  ★B.hero は「いま処理しているヒロイン」。B.ci が文脈
    B.enemies[] B.gems[] B.chests[] B.picks[] B.props[] B.items[] B.clouds[]
    B.mires[]                   媚薬沼 / B.dryAura フレイラの乾燥オーラ
    B.floor                     その日の階層(curFloor() の写し)
    B.wantExit / B.wantExitWhy  降りる気と、その理由
    B.exitLocked                封印石の階だけ true
    B.giveUp                    Map(諦めた目標 → いつまで外すか)
    B.party{ goal, turn, … }    パーティの相談

★`addHeatG()` `applySensit()` などは **`B.ci` のヒロインに効きます**。
別の子に効かせる時は `const ci0=B.ci; B.ci=h.hi; …; B.ci=ci0;` で挟むこと。

### ヒロイン(`js/game.js:newHero()`)

    h.id h.name h.hi h.level h.hp h.maxHp h.stamina h.staminaMax
    h.wp{} h.ps{} h.evo{}       武器 / パッシブ / 進化のレベル
    h.limbs{} h.suckers{}       四肢の拘束 / 吸い付き
    h.heatG h.heatLv h.sensit h.aphro h.hypnoLv h.climaxT h.pinned
    h.zone h.goal h.explore     いる地形 / 目当て / 探索点
    h.scared{} h.brave{} h.hesitN{}   地形ごとの怖がり / 度胸 / 迷った回数
    h.sticky h.chokeT           媚薬のベタベタ / むせている時間

---

## 4. 検証の雛形(そのまま動く)

    const {chromium}=require('playwright');
    (async()=>{
      const b=await chromium.launch({
        executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
        args:['--allow-file-access-from-files']});
      const p=await b.newPage();
      p.on('pageerror',e=>console.log('PAGEERR',e.message));
      await p.goto('file:///home/user/Game4/index.html');
      await p.waitForTimeout(900);
      const out=await p.evaluate(()=>{
        const L=[];
        wipeMeta(); META.settings.autoplay=true;
        META.era=6; META.party={roster:['lumina'], joined:{}, resets:0};
        for(let day=1; day<=30; day++){
          const pool=Object.keys(MONSTERS).filter(id=>
            !MONSTERS[id].item && !MONSTERS[id].variant && !MONSTERS[id].guardian
            && (MONSTERS[id].unlock||0)>=0 && deepOk(id));
          for(const id of pool) META.cards[id]={owned:true, lv:3};
          META.deck=[]; for(let k=0;k<5;k++) META.deck.push(pool[(day*7+k*13)%pool.length]);
          META.map.gen=(META.map.gen|0)+1;
          UI.hideAll(); startBattle(); UI.hideStory();
          let guard=0;
          /* ★一日は G.mode!=='battle' では終わらない。levelup / captured / survived も回すこと */
          while(['battle','levelup','captured','survived'].includes(G.mode) && guard++<600*30){
            if(G.mode==='levelup'){ lvTick(1/30); continue; }
            if(G.mode==='captured'){ capturedTick(1/30); continue; }
            if(G.mode==='survived'){ survivedTick(1/30); continue; }
            battleTick(1/30);
          }
          /* ここで数える */
        }
        return L;
      });
      console.log(out.join('\n'));
      await b.close();
    })();

- `page.evaluate` の中では `G` `META` `BAL` `UI` `MONSTERS` などを**裸の名前**で触れます
- 実行は `NODE_PATH=/home/user/Game4/node_modules node run_xxx.js`
- `run_*.js` は `.git/info/exclude` で git 管理外です(コミットされません)
- **単発の計測は無意味。必ず中央値で、n を大きく**(BRIEFING §6)

★**計測が期待と違ったら、まず計測側を疑うこと。**
このリポジトリの記録では、**器の誤りの方が game の誤りより多く見つかっています**。

---

## 5. 触ると壊れやすい所

- **`//` の行コメントを行の途中に置かない。** 後ろが全部消えます。`/* … */` を使う
- **`BAL` のキー重複は黙って上書きされる。** `python3 check_bal_dup.py` を毎回
- **定義だけあって繋がっていないものは、走らせても出ない。** `python3 check_dead.py` を毎回
- **`node --check` は構文しか見ない。** 関数を別の場所へ抜き出すと、
  そこのローカル変数を参照したまま**実行時に落ちます**(実際に踏みました)
- **`ZONE_IDS` は `Object.keys(ZONES)` の順。** 地形を途中に挿すと既存の帯の番号がずれます
- **`B.time` は戦闘ごとに 0 へ戻る。** 戦闘を跨いで時刻を持ち越すと誤検出します
- **四人いる盤で「肢」だけを鍵に数えると他人の腕と混ざる。** 鍵は「ヒロインid + 肢」

---

## 6. コミット前に必ず

    for f in js/*.js; do node --check "$f"; done   # 構文
    python3 check_bal_dup.py                        # BAL のキー重複
    python3 check_dead.py                           # 繋がっていない定義
    python3 check_map.py                            # ★この索引の参照が実在するか
    # キリル文字などの混入スキャン(過去に複数回混入)

- push は `claude/ai-girl-deck-battle-game-1k94l5` へ。他のブランチへは押さない
- **モデル名をコード・コミット・PRに書かない**
- 版を出したら `docs/BRIEFING.md` の履歴と「既知の課題」を更新する
