'use strict';
/* ============================================================
   data.js — 定義データ: モンスター / 陣形 / 研究 / 祭壇 / ヒロイン装備
   ※数値はすべて暫定バランス。BALに集約。
============================================================ */

const BAL={
  RUN_TIME:300,            // 1戦=5分(v0.5で試験延長)
  GEN_LEN:4,               // この戦数ごとにヒロインの経験がリセット
  FIELD_CAP:260,           // 場に出せる魔物の上限(超えると召喚不可)——画面を埋める
  EN_BASE:14, EN_PER_LV:3, EN_MAX:80,
  EN_REGEN:1.0, EN_REGEN_LV:0.08,      // v1.1: 初期回復を少し上げた
  EN_START:12,
  CARD_CD_BASE:1.2, CARD_CD_COST:0.09,   // カードCD = BASE + コスト×COST

  /* --- ヒロインの視界と思考(v0.4.1: 人間らしさ) --- */
  SIGHT_MARGIN:30,         // 画面端+これだけが視界。外の敵は存在に気づかない
  NOTICE_T:0.35,           // 視界に入ってから脅威と認識するまでの反応遅れ(集中低下で悪化)
  THINK_MIN:0.13, THINK_MAX:0.34, // 操舵の再評価間隔(この間は前の判断で動き続ける)
  DIVE_GEM_N:4,            // ガス溜まり内のジェムがこれ以上なら意を決して入る
  DIVE_GEM_V:8,            //   または合計価値がこれ以上
  DIVE_T:1.7,              // 意を決して入る時間(この間ガス回避を無視)

  /* --- コンボ(同一カード連打) --- */
  COMBO_WINDOW:10,         // この秒数内に同じカードを出すと連鎖
  COMBO_MAX:5,
  COMBO_STAT:0.12,         // 1連鎖ごとの召喚hp/dmgボーナス
  COMBO_UNIT_PER:1,        // 1連鎖ごとに多数陣形+1体(コンボ=数)

  /* --- 夜の深まり(ヒロインLv連動で夜側が強くなる) --- */
  NIGHT_UNIT_LV:4,         // 彼女のLvこれごとに多数陣形+1体(最大+4)
  NIGHT_UNIT_MAX:4,
  NIGHT_STAT_LV:0.04,      // 彼女のLv-1ごとの召喚hp/dmg加算
  NIGHT_STAT_CAP:0.8,
  EN_REFUND:0.6,           // ヒロインが倒したときのEN還元率(ユニット単価×係数)
  ESS_RATE:0.55,           // エッセンス=撃破xp×係数
  ORB_DMG_STEP:45,         // 与ダメこれごとにオーブ+1
  ORB_PER_AIL:1,           // 状態異常付与ごと
  ORB_CAPTURE:20,          // 捕獲ベース
  ORB_CAPTURE_GEN:5,       // ×世代内戦歴
  SURVIVE_ESS_BONUS:30,
  CAPTURE_ESS_BONUS:60,

  /* --- スタミナ / 抵抗 / 押し倒し --- */
  STAMINA_MAX:100,
  STAMINA_REGEN:3.5,       // 非拘束時 /s
  STAMINA_REGEN_HEAT:1,    // 発情中 /s
  STAMINA_RIP_COST:14,     // 引き剥がし1回
  STRUGGLE_MOVE_RATE:0.09, // 移動1pxあたりの抵抗ゲージ
  STRUGGLE_SHOT_GAIN:5,    // 攻撃1発あたり
  RIP_NEED_CLING:60,       // 絡みつき(ワーム)を剥がすのに必要な抵抗
  RIP_NEED_TETHER:85,      // 蔦(触手花/大触手)を剥がすのに必要な抵抗
  PIN_STAMINA_TH:35,       // これ未満のスタミナで拘束されると押し倒される
  PIN_PULSE_T:0.8,         // もがき1拍
  PIN_PULSE_COST:6,        // もがき1拍のスタミナ
  PIN_ESCAPE_GAIN:18,      // もがき1拍の脱出ゲージ
  ATTACH_DMG_MULT:1.3,     // 四肢拘束中の被ダメ倍率
  PIN_DMG_MULT:1.5,        // 押し倒し中の被ダメ倍率

  /* --- 媚薬=敏感化 / 快感 / 発情(v0.4) ---
     媚薬は即座に快感を生まず「敏感化」を積む。
     敏感化は快感の入りを増幅し、快感100で発情レベルが上がる。 */
  SENSIT_DECAY:1.1,        // 敏感化ゲージ自然減衰 /s
  SENSIT_GAS:8,            // ガス雲の中 /s(媚薬=敏感化源)
  SENSIT_SLUG:6,           // ナメクジ接触
  SENSIT_TH:[25,55,85],    // 敏感Ⅰ/Ⅱ/Ⅲ の閾値
  SENSIT_AMP:0.35,         // 快感増幅 /敏感Lv
  PLEAS_DECAY:0.6,         // 快感ゲージ自然減衰 /s
  PLEAS_IMP_BURST:4.5,     // 小淫魔の煽りアクション1回ぶんの快感(受動では上がらない)
  IMP_BURST_CD:1.0,        // 煽りバーストの全体クールダウン(数で強くなりすぎ防止)
  PLEAS_GAS:1.8,           // ガス雲は快感も僅かに直接生む /s
  PLEAS_BINDER:0.5,        // 絡みつき1体あたり /s(練度でスケール)
  PLEAS_PIN:4,             // 押し倒し1拍あたり
  SUCK_PLEAS:2.6,          // 吸い付き1体あたり /s
  HEAT_LV_DUR:20,          // 発情1段階の持続(s)。切れると1段下がる
  HEAT_AFTER:40,           // 発情昇段後の快感ゲージ
  WAVE_CD_BASE:9, WAVE_CD_LV:1.5,   // 発情の波の間隔 = BASE-LV×Lv
  WAVE_DUR_BASE:2.0, WAVE_DUR_LV:0.8, // 波の持続 = BASE+LV×Lv
  WAVE_ATK:0.55,           // 波の間の攻撃レート
  WAVE_SPD:0.7,            // 波の間の移動速度

  /* --- 魅了(v0.4: 対象別・レベル制) --- */
  CHARM_DUR:26,            // 1段階の持続(接触で更新)。簡単には解けない
  CHARM_GAUGE:100,         // 魅了は徐々に溜まり、ゲージが満ちると段階が上がる
  CHARM_DECAY:5,           // ゲージの自然減衰 /s
  CHARM_SLUG:45,           // ナメクジ接触1回ぶん
  CHARM_QUEEN_PULSE:55, CHARM_QUEEN_TOUCH:40,
  KNOW_MET2:4, KNOW_MET3:8,   // 学習: 何かされた回数で世代内の知識Lvが上がる
  CHARM_DMG_CUT:0.25,      // 魅了対象への与ダメ減 /Lv(Lv3=75%減)
  CHARM_DRIFT_CD:6.5,      // 無意識に寄っていく発作の間隔(Lv2+)
  CHARM_DRIFT_T:1.2,       // 発作の基本時間 ×Lv
  CHARM_BIND_PULSE:0.9,    // 魅了拘束の正気拍
  CHARM_BIND_STAM:4,       // 1拍のスタミナ
  CHARM_BIND_SANITY:15,    // 1拍の正気ゲージ
  CHARM_BIND_PLEAS:5,      // 魅了拘束中の快感 /s

  /* --- 吸液羽虫 --- */
  RIP_NEED_SUCK:45,        // 引き離しに必要な抵抗
  SUCK_RIP_COST:7,         // 引き離し1回のスタミナ
  SUCK_SLOW:0.93,          // 1体あたりの移動低下(最大3体)
  SUCK_STAM_DRAIN:0.5,     // 吸い付き1体あたりのスタミナ吸引 /s(吸"液"なので)

  STAMINA_DRAG:1.5,       // 2箇所以上絡みつかれている間のじわ削り /s

  /* --- 燭台(回復・アイテム) v1.0 ---
     アイテムは30%(幸運で増): 回復20% / 浄化(画面全消去)5% / 収集(全ジェム回収)3% / 星の審判(ボーナス攻撃)2% */
  PROP_HP:24,
  PROP_INIT:6,             // 初期配置数
  PROP_RESPAWN:26,         // 追加出現間隔(s)
  PROP_ITEM:0.30,          // アイテムが出る確率(基礎)
  PROP_HEAL:20, PROP_WIPE:5, PROP_VACUUM:3, PROP_BONUS:2,   // 30の内訳
  LOGEM_V:0.5,             // ロージェム(頭数ボーナス分の雑魚が落とす)の経験値
  LUMINA_DECAY:5,          // 世代の夜明けで薄れる自己強化の段数(ゼロには戻らない)
  /* v1.2 状態異常拡張(放置系エロトラップダンジョンの機構を参考に、独自に再構成) */
  DENY_DUR:7,              // 寸止め(絶頂禁止)の持続。快感は99で止められ、切れた瞬間に溜めた分が来る
  DENY_DEEP_TH:85,         // 切れた時に快感がこれ以上なら「深い絶頂」
  DEEP_MULT:1.6,           // 深い絶頂の硬直倍率
  NUMB_DUR:3,              // 痺れ: 攻撃速度半減・移動-25%
  FREEZE_DUR:4,            // 時間停止: 動けず撃てず、触られ放題。快感は蓄積して解除時に一気に
  FREEZE_MULT:1.3,
  SUIT_DUR:25, SUIT_PULSE:2.5, SUIT_PLEAS:5,   // 触手服: 着ている間ずっと脈動
  CREST_MAX:3, CREST_AMP:0.15,                 // 淫紋Lv: 快感の入り+15%/Lv(戦闘中持続)
  WATCH_R:320, WATCH_AMP:0.2,                  // 視姦: 覗き目玉に見られている間の快感増幅
  BEG_DUR:2.5, BEG_CD:12,                      // おねだり: 撃てず、最寄りの魔物へ寄っていく
  ACHE_CD:2.8, ACHE_PLEAS:6,                   // 疼き: 寸止め中/発情Ⅲ中の不意の突き上げ
  /* v1.3 */
  REENTER_D:780,           // 本家同様: これ以上離れた魔物は画面外の縁へ回り込んで再登場(同一個体)
  REENTER_R:560,           // 再登場時の距離(画面外すぐ)
  GAZE_R:240, GAZE_ANG:0.8,    // ゲイザーの視界(半径・角度rad): 狭く、長く。表示→閃光→催眠
  GAZE_BOSS_EXTRA:130,         // ボスゲイザーの視界はさらに長い(横幅は同じ)
  GAZE_AIM:1.4, GAZE_CD:5.5,
  HYPNO_LV_DUR:30,         // 催眠Lvが1段薄れるまでの秒数
  SELF_DUR:3.2, SELF_CD:9, // 催眠Ⅲ: その場で自慰を始める(秒)と再発の間隔
  BEAM_AIM:1.0, BEAM_CD:9, BEAM_LEN:300, BEAM_W:14,   // 絶頂照射: 照準1秒→発射。彼女が見て判断できる速さ(学習で避ける)
  MUSK_R:64,               // ゴブリンの雄臭が届く距離
  MUSK_SNIFF:1.6,          // 嗅ぐ発作の長さ
  GEM_CAP:600,

  CHEST_TIMES:[40,110,180,250],

  IMP_TEASE_CAP:2,         // 快感を注げる小淫魔は同時2体まで(数で強くなりすぎ防止)

  /* --- 絶頂(v0.6) --- */
  CLIMAX_DUR:3.4,          // 絶頂の硬直時間: 脚が止まり、痙攣し、動けない
  CLIMAX_STAM_COST:10,     // 絶頂1回のスタミナ消耗(連続絶頂はやがて力尽きる)
  REFRACT_T:6,             // 絶頂後の不応期(s)
  REFRACT_MULT:0.25,       // 不応期中の快感の入り
  SQUIRT_BASE:0.35,        // 潮吹き率 = BASE + 0.2×発情Lv + 0.12×敏感Lv
  STAIN_LIFE:70,           // 地面の染みの残留時間(s)
};

/* ---------------- モンスターカード ----------------
   dmgは接触ダメージ。armorで軽減される(dot・特殊は貫通あり)。
   xp: ヒロインが倒したとき彼女に入る経験値 = プレイヤーが得るエッセンス。 */
const MONSTERS={
  slug:{
    name:'ナメクジ', role:'接触魅了', cost:2, unlock:0, tier:'fodder',
    hp:14, spd:34, r:10, dmg:2, xp:2, swarm:2,
    desc:'のろく弱いが、触れるたび「ナメクジという種族」への魅了が一段深まる。魅了された種族への攻撃は鈍り、深まるとどの個体にでも自分から寄っていってしまう。',
    trait:'接触で【魅了】段階UP(種族別)。Lv2+で群れ倍化',
  },
  goblin:{
    name:'ゴブリン', role:'群れ・雄臭', cost:2, unlock:80, tier:'fodder',
    hp:13, spd:66, r:9, dmg:4, xp:2, swarm:2, musk:true,
    desc:'緑色のチビ。一匹では何もできず、群れて囲んで小突くしか能がない。数だけは湧く。強い雄の臭いがあり、普段はただ嫌なだけだが、発情した彼女はそれを執拗に嗅いでしまう。嗅いでいる間に他で快感を受けると、匂いと快感が結びつく。',
    trait:'【雄臭】発情中は嗅いでしまう(足が止まる)。条件が揃うと次戦以降、匂いだけで発情する性癖がつく。Lv2+で群れ倍化',
  },
  leech:{
    name:'吸液羽虫', role:'吸い付き', cost:3, unlock:120, tier:'fodder',
    hp:8, spd:105, r:7, dmg:0, xp:2,
    desc:'肉質の小さな羽虫。素早く掠めるように飛び、触れた瞬間に胸の先や脚の間へ吸い付いて快感を注ぎ続ける。拘束の有無を問わず取り付く。',
    trait:'接触で吸い付き(快感+微スロウ、3箇所まで)',
  },
  worm:{
    name:'地上ワーム', role:'四肢拘束', cost:3, unlock:0, tier:'fodder',
    hp:18, spd:38, r:10, dmg:2, xp:2, swarm:2,
    desc:'のろく弱いが、触れると腕や脚に絡みつく。絡まれた分だけ彼女は鈍り、引き剥がしはスタミナを削る。',
    trait:'接触で四肢に絡みつく【拘束】。Lv2+で群れ倍化',
  },
  ghost:{
    name:'ゴースト', role:'主力・圧', cost:3, unlock:0, tier:'mid',
    hp:24, spd:64, r:11, dmg:7, xp:3,
    desc:'ゆらゆらと回り込む主力打点。拘束で鈍った相手に群がらせる。',
  },
  slime:{
    name:'粘スライム', role:'粘液の跡', cost:3, unlock:60, tier:'fodder',
    hp:20, spd:52, r:11, dmg:5, xp:2,
    desc:'進んだ跡に粘液を残す。踏んだヒロインは移動が鈍る。',
    trait:'移動跡に粘液(スロウ)',
  },
  gas:{
    name:'ガス玉', role:'媚薬ガス', cost:4, unlock:200, tier:'mid',
    hp:16, spd:22, r:11, dmg:0, xp:3, solo:true,
    desc:'ふわふわと漂い、桃色の媚薬ガスを吹き出してその場に滞留させる。吸えば媚薬ゲージがじわりと溜まる。倒すと最後に大きく弾ける。',
    trait:'媚薬ガス滞留(吸うと蓄積)',
  },
  imp:{
    name:'小淫魔', role:'煽り・じらし', cost:5, unlock:280, tier:'mid',
    hp:20, spd:120, r:8, dmg:0, xp:5, solo:true,
    desc:'攻撃はしない。ヒロインの周りをパタパタと飛び回って煽り、集中を乱し、媚薬を薫らせる。すばしこく撃ち落としにくい。',
    trait:'まとわり煽り(媚薬+集中低下)',
  },
  flower:{
    name:'触手花', role:'設置罠・蔦', cost:5, unlock:450, tier:'mid',
    hp:60, spd:0, r:13, dmg:0, xp:5,
    desc:'その場で待つ肉花。近づいた獲物の脚に蔦を絡め、その場に繋ぎ止めて締め上げる。',
    trait:'待ち伏せ→脚に蔦(繋留拘束+dot)',
  },
  mistslime:{
    name:'霧香スライム', role:'融合・ガスの跡', cost:6, unlock:-1, tier:'mid',
    hp:34, spd:48, r:12, dmg:4, xp:6,
    desc:'【融合】粘スライム×ガス玉。進んだ跡が媚薬の霧になる。逃げ道そのものを桃色に染める。',
    trait:'移動跡が媚薬ガスに', fusion:['slime','gas'], fuseCost:400,
  },
  gtent:{
    name:'大触手', role:'融合・捕縛', cost:9, unlock:-1, tier:'large',
    hp:115, spd:30, r:16, dmg:6.5, xp:12,
    desc:'【融合】地上ワーム×触手花。届く間合いから鞭を伸ばして四肢に絡め、その場から逃さない。',
    trait:'遠隔で四肢に蔦(繋留拘束)', fusion:['worm','flower'], fuseCost:550,
  },
  /* ---- v1.0 追加: 雑魚 ---- */
  hand:{
    name:'這い寄る手', role:'まさぐり', cost:2, unlock:100, tier:'fodder',
    hp:10, spd:58, r:8, dmg:0, xp:1, swarm:2,
    desc:'手首から先だけの、青白い手。地面を這って寄り、触れた場所をひとしきりまさぐって満足すると、少し離れてまた這い寄る。',
    trait:'接触でまさぐり(快感バースト・ダメージなし)。Lv2+で群れ倍化',
  },
  /* ---- v1.0 追加: 中型 ---- */
  serpent:{
    name:'淫蛇', role:'脚絡み', cost:4, unlock:260, tier:'mid',
    hp:30, spd:72, r:11, dmg:4, xp:4,
    desc:'紫の鱗のぬめる蛇。素早く滑り寄り、まず脚から巻きついて歩みを奪う。空きが無ければ噛む。',
    trait:'接触で脚優先の【拘束】(絡みつき)。空きなら噛みつき',
  },
  /* ---- v1.0 追加: 大型(精鋭型) ---- */
  moth:{
    name:'媚蛾', role:'鱗粉の雨', cost:8, unlock:520, tier:'large',
    hp:140, spd:44, r:15, dmg:3, xp:10,
    desc:'翼幅の広い桃色の大蛾。彼女の周りを大きく旋回しながら媚薬の鱗粉を撒き続け、擦れた翼で肌を撫でていく。',
    trait:'旋回しながら媚薬雲を連続散布',
  },
  pot:{
    name:'触手壺', role:'ジェム喰い', cost:7, unlock:480, tier:'large',
    hp:160, spd:0, r:16, dmg:0, xp:10,
    desc:'口を開けた肉の壺。周囲のジェムを吸い込んで喰い、夜側のエネルギーに変える。取り返しに近づいた脚を、壺の縁から伸びた触手が繋ぐ。',
    trait:'ジェム吸収→EN還元。近寄ると脚に触手(繋留拘束)',
  },
  slugqueen:{
    name:'ナメクジ女王', role:'魅了の脈動', cost:8, unlock:560, tier:'large',
    hp:150, spd:26, r:17, dmg:3, xp:10,
    desc:'背に王冠めいた襞を持つ大ナメクジ。数秒ごとに甘い脈動を放ち、届く範囲の彼女を種族ごと魅了していく。',
    trait:'定期的な魅了パルス(範囲)+接触魅了',
  },
  /* ---- v1.0 追加: ボス ---- */
  dreamtree:{
    name:'淫夢の樹', role:'ボス・巣', cost:24, unlock:1100, tier:'boss',
    hp:800, spd:0, r:30, dmg:0, xp:55, boss:true,
    desc:'桃色の花を咲かせた黒い樹。根を伸ばして近づく者の脚を繋ぎ、幹の洞から地上ワームを生み続ける。花の香は甘く、近いほど身体が熱を覚える。召喚は1戦に1度。',
    trait:'根の繋留/ワーム生成/甘香の領域',
  },
  /* ---- v1.2 追加(状態異常拡張) ---- */
  spore:{
    name:'痺れ浮遊子', role:'痺れ', cost:2, unlock:140, tier:'fodder',
    hp:12, spd:40, r:9, dmg:1, xp:2, swarm:2,
    desc:'半透明の傘を持つ、くらげのような胞子。ふわふわと寄ってきて触れると微弱な電気を流す。痛くはないが、指先が痺れて武器が鈍り、脚がもたつく。',
    trait:'接触で【痺れ】(攻撃速度半減・移動-25%・3秒)+微快感。Lv2+で群れ倍化',
  },
  ghosthand:{
    name:'手霊', role:'憑依', cost:4, unlock:300, tier:'mid',
    hp:26, spd:70, r:9, dmg:0, xp:4,
    desc:'夜気が手の形に凝った霊。触れると彼女の腕に憑き、その腕は彼女の意志を離れて彼女自身を撫ではじめる。腕が奪われた分だけ攻撃は乱れる。',
    trait:'接触で腕に【憑依】(自分の手で快感・攻撃低下)。空きが無ければまさぐり',
  },
  eye:{
    name:'覗き目玉', role:'視姦', cost:4, unlock:320, tier:'mid',
    hp:30, spd:50, r:10, dmg:0, xp:4, solo:true,
    desc:'瞼のない大きな眼球が翼で浮いている。近づかず、離れず、ただ見ている。見られている間は肌の熱が逃げず、見られながらの絶頂は記録される。',
    trait:'距離を保って【視姦】(快感+20%)。6秒ごとの凝視で羞恥・敏感化。絶頂を「撮影」',
  },
  succubus:{
    name:'寸止めの淫魔', role:'寸止め', cost:8, unlock:600, tier:'large',
    hp:150, spd:60, r:13, dmg:3, xp:10,
    desc:'指先ひとつで快感の栓を閉める淫魔。近くにいる彼女の絶頂を7秒だけ禁じ、溜まりきったところで栓を抜く。抜かれた瞬間の絶頂は深く、長い。',
    trait:'8秒ごとに【寸止め】(絶頂禁止7秒→切れた時に深い絶頂)。接触で快感',
  },
  gazer:{
    name:'催眠ゲイザー', role:'催眠・視界', cost:5, unlock:420, tier:'mid',
    hp:70, spd:32, r:14, dmg:0, xp:5,
    desc:'触手の胴に据わった巨大な一つ目。瞳は常に彼女を追う。視界を紫に照らして狙いを定め、閃光で視界の中の者を催眠にかける。重ねられた催眠は判断を鈍らせ、抵抗を忘れさせ、その場で自分を慰めさせる。',
    trait:'視界(扇)を表示→閃光→【催眠Lv+1】。Ⅰ判断鈍化 / Ⅱ拘束に抵抗しない / Ⅲ自慰を始める',
  },
  beamer:{
    name:'絶頂照射触手', role:'強制絶頂', cost:8, unlock:620, tier:'large',
    hp:120, spd:20, r:13, dmg:0, xp:10,
    desc:'先端に水晶の眼を持つ細長い触手。照準線が彼女に触れてから発射までが速く、細い光条に当たった者は身体の準備を待たずに達してしまう。',
    trait:'照準1.0秒(最後の0.25秒は固定)→細い光条(射程300)。命中で【強制絶頂】。CD9秒',
  },
  bossgazer:{
    name:'ボスゲイザー', role:'ボス・多眼', cost:26, unlock:1200, tier:'boss',
    hp:900, spd:30, r:30, dmg:6, xp:60, boss:true,
    desc:'三つの眼柄を持つゲイザーの王。三つの視界がそれぞれ別の拍で彼女を探し、閃光を重ねる。彼女は視界を見て避けるが、三つ同時には避けきれない。召喚は1戦に1度。',
    trait:'三つの視界が交互に閃光(催眠Lv+1)。接触で殴打',
  },
  /* ---- 設置物(デッキには入らない。夜側のアイテムで建てる) ---- */
  web:{
    name:'淫糸の巣', role:'設置物', cost:0, unlock:-1, tier:'item', item:true,
    hp:160, spd:0, r:18, dmg:0, xp:0,
    desc:'桃色に濡れた糸の巣。走り込んだ四肢を糸が取り、巣の中心へ繋ぐ。もがくか、巣そのものを壊すかしないと抜けられない。',
    trait:'接触で空いた四肢すべてを繋留(r36)。壊せば解ける',
  },
  tower:{
    name:'催眠電波の塔', role:'設置物', cost:0, unlock:-1, tier:'item', item:true,
    hp:420, spd:0, r:14, dmg:0, xp:0,
    desc:'骨と肉で組まれた小さな塔。頂の眼球が数秒ごとに紫の電波を放ち、浴びた者の思考をざらつかせて塔のほうへ足を向けさせる。',
    trait:'3.5秒ごとに催眠電波(思考鈍化+引き寄せ)',
  },
  vampi:{
    name:'ヴァンピロード', role:'ボス', cost:26, unlock:900, tier:'boss',
    hp:950, spd:55, r:28, dmg:20, xp:60, boss:true,
    desc:'夜の統率者。突進で薙ぎ払い、掠めた相手をよろめかせる。召喚は1戦に1度。',
    trait:'突進/接触よろめき',
  },
};
/* 階級: 雑魚/中型は全陣形、大型は精鋭型のみ、ボスは単騎 */
const TIERS=['fodder','mid','large','boss'];
const TIER_NAMES={fodder:'雑魚', mid:'中型', large:'大型', boss:'ボス'};
const TIER_CAP={fodder:3, mid:3, large:2, boss:1};          // デッキ枠(計9)
const DECK_CAP=Object.values(TIER_CAP).reduce((a,b)=>a+b,0);
const TIER_FORMS={fodder:null, mid:null, large:['single','duo'], boss:['single']};  // null=全陣形
const tierOf=id=>MONSTERS[id].tier||(MONSTERS[id].boss?'boss':'mid');
/* ヒロインの学習(v1.5): 種族の脅威度(0-3)と、知ったあとの警戒半径。未知の相手は一律120で扱う */
const SPEC_THREAT={
  slug:1, goblin:0, leech:1, worm:1, ghost:0, slime:0, gas:1, imp:1, flower:2, mistslime:1, gtent:2,
  hand:1, serpent:2, moth:1, pot:2, slugqueen:2, dreamtree:2, vampi:2,
  spore:1, ghosthand:2, eye:1, succubus:3, gazer:3, beamer:3, bossgazer:3, web:2, tower:2,
};
const SPEC_DANGER={ flower:130, gtent:90, slug:55, worm:55, gas:60, slime:110, leech:60,
  hand:50, serpent:120, moth:70, pot:95, slugqueen:80, dreamtree:125,
  gazer:70, beamer:60, bossgazer:130, succubus:110, ghosthand:90, spore:60, eye:40, web:90, tower:60 };
const TRAP_SPECIES=new Set(['flower','pot','web','dreamtree']);   // 知っていれば、そばのジェムは諦める
const KNOW_NAMES=['未知','認識','理解','熟知'];
const CARD_LV_MAX=5;
const cardLvMult=lv=>({ hp:1+0.08*(lv-1), dmg:1+0.10*(lv-1) });   // Lvは主に頭数で強くなる
const cardCost=(id,lv)=>{
  const b=MONSTERS[id].cost;
  return Math.max(1, b - (lv>=3?1:0) - (lv>=5?1:0));
};
const cardUpCost=(id,lv)=>Math.round((MONSTERS[id].cost*38)*(1+0.65*(lv-1)));
const FUSION_IDS=['mistslime','gtent'];

/* ---------------- 陣形(出現方法) ---------------- */
const FORMATIONS={
  scatter:{ name:'散開', count:4, factor:1.7, unlock:0,
    desc:'遠巻きの4方向から放つ。基本の出し方。' },
  single:{ name:'精鋭', count:1, factor:0.9, unlock:200, elite:1.6,
    desc:'1体だけを強化(HP/攻撃×1.6)して送り込む。' },
  wave:{ name:'突撃列', count:7, factor:2.6, unlock:160,
    desc:'一方向から横列で押し寄せる。' },
  ambush:{ name:'潜伏', count:3, factor:1.6, unlock:280,
    desc:'進行方向の先に伏せて置く。設置系・鈍足と好相性。' },
  ring:{ name:'包囲円陣', count:10, factor:4.0, unlock:380,
    desc:'楕円の円陣で取り囲み、輪を締める。' },
  duo:{ name:'双璧', count:2, factor:1.8, unlock:300, elite:1.25,
    desc:'2体を強化(×1.25)して並べる。大型向きの少数精鋭。' },
  burst:{ name:'大散開', count:7, factor:2.5, unlock:260,
    desc:'散開の強化版。7方向から一斉に放ち、輪を一気に狭める。' },
};

/* ---------------- 夜側のアイテム(戦闘中、場に直接置く) ----------------
   オート指揮がカードを回す間、プレイヤーが手を動かす場所。研究所でエッセンス解放 */
const NIGHT_ITEMS={
  mist:  { name:'媚薬の霧壺',   icon:'🌫', cost:6,  cd:14, unlock:0,
    desc:'指した場所に媚薬の霧を大きく滞留させる(9秒)。吸えば敏感化が進む。' },
  pool:  { name:'粘沼',         icon:'〰', cost:5,  cd:12, unlock:120,
    desc:'指した場所に粘液の沼を敷く(14秒)。踏んだ彼女の足が鈍る。' },
  rune:  { name:'淫紋の罠',     icon:'✧', cost:7,  cd:16, unlock:250,
    desc:'見えない淫紋を伏せる(45秒)。踏むと快感が弾けてよろめき、這い寄る手が3体湧く。' },
  tower: { name:'催眠電波の塔', icon:'📡', cost:12, cd:30, unlock:350,
    desc:'塔を建てる(壊されるか40秒)。3.5秒ごとの電波で彼女の思考を鈍らせ、足を塔へ引き寄せる。彼女は塔を攻撃できる。' },
  fake:  { name:'偽りの宝箱',   icon:'🎁', cost:9,  cd:40, unlock:450,
    desc:'宝箱の偽物を置く。彼女は宝箱に目がない——開けると媚薬の霧と手の群れが噴き出す。' },
  /* v1.2 */
  suit:  { name:'触手服の魔法陣', icon:'🎀', cost:8,  cd:30, unlock:300,
    desc:'踏むと触手が服の内側に纏わりつく(25秒)。着ている間、2.5秒ごとに脈動して快感を注ぎ、足が鈍る。' },
  freeze:{ name:'時間停止の魔法陣', icon:'⏳', cost:10, cd:35, unlock:400,
    desc:'踏むと4秒間、彼女だけ時間が止まる。動けず撃てず、触られ放題。止まっている間の快感は蓄積し、解除の瞬間に一気に来る。' },
  web:   { name:'淫糸の巣',     icon:'🕸', cost:9,  cd:30, unlock:520,
    desc:'桃色の糸の巣を張る(壊されるか40秒)。走り込んだ四肢を全部繋ぎ止める。もがくか巣を壊すまで抜けられない。' },
};

/* ---------------- 祭壇(オーブによる初期状態の書き換え) ----------------
   世代リセット後も維持される永続改変。levelごとにcost。 */
const ALTAR=[
  { id:'armor', name:'加護侵蝕', max:3, costs:[12,24,40],
    desc:'光の護り(アーマー)を弱める。-1/段階。', fx:'護り -1' },
  { id:'regen', name:'祝福遅滞', max:3, costs:[10,20,34],
    desc:'自然回復の巡りを鈍らせる。', fx:'回復 -30%/段階' },
  { id:'speed', name:'足枷の残滓', max:3, costs:[10,20,34],
    desc:'脚の軽さを僅かに奪う。', fx:'速度 -6%/段階' },
  { id:'sense', name:'感応増幅', max:3, costs:[14,26,44],
    desc:'媚薬・魅了・拘束への感受性を高める。効きが深く、抜けにくくなる。', fx:'異常効果 +18%/段階' },
  { id:'heat', name:'媚薬の残滓', max:2, costs:[16,32],
    desc:'戦闘開始時から肌が僅かに敏感になっている(敏感化の下限が上がり、減衰しきらない)。', fx:'初期敏感 +26/段階' },
  { id:'focus', name:'朧の霞', max:2, costs:[16,32],
    desc:'集中の芯を曇らせる。判断と反応が僅かに遅れる。', fx:'反応 -12%/段階' },
  { id:'stamina', name:'倦怠の澱', max:3, costs:[14,26,44],
    desc:'身体の芯に疲労を澱ませる。スタミナの上限と回復が落ちる。', fx:'スタミナ上限 -12/段階' },
  /* --- 夜側の軍備(プレイヤー側の強化) --- */
  { id:'encap', name:'夜気の器', max:3, costs:[12,24,40], side:'night',
    desc:'夜の気を蓄える器を広げる。', fx:'EN上限 +6/段階' },
  { id:'enregen', name:'湧き出る瘴気', max:3, costs:[12,24,40], side:'night',
    desc:'夜の気の湧きを速める。', fx:'EN回復 +0.12/s/段階' },
  { id:'cdcut', name:'素早き喚起', max:3, costs:[14,26,44], side:'night',
    desc:'召喚の詠唱が短くなる。', fx:'カードCD -12%/段階' },
  { id:'legion', name:'夜の軍団旗', max:2, costs:[20,40], side:'night',
    desc:'多数陣形の基礎頭数が増える。', fx:'陣形+1体/段階' },
  { id:'mhp', name:'魔性の肉', max:3, costs:[14,26,44], side:'night',
    desc:'召喚される魔物の肉体が強靭になる。', fx:'魔物HP +10%/段階' },
];
const altarLv=id=>META.altar[id]||0;

/* ---------------- ルミナの自己強化(ヴァンサバのコイン強化に相当) ----------------
   彼女は戦闘で拾ったジェムをコインとして貯え、夜明けに自分を強化する。
   世代リセットの影響を受けず永続——放っておくと1〜5日で大幅に強くなる。 */
const LUMINA_UPG={
  vital:{ name:'いのちの祝福', max:8, base:30, fx:'最大HP +8%' },
  guard:{ name:'ひかりの護り', max:6, base:40, fx:'護り +0.5' },
  bless:{ name:'いやしの加護', max:8, base:34, fx:'回復 +0.08/s' },
  swift:{ name:'かぜの靴',     max:6, base:34, fx:'速度 +2%' },
  grit: {name:'ねばりの心',    max:8, base:30, fx:'スタミナ上限 +6' },
  zeal: {name:'せいなる火力',  max:8, base:36, fx:'与ダメ +6%' },
};
const luminaUpCost=(id,rank)=>Math.round(LUMINA_UPG[id].base*Math.pow(1.5,rank));
const luminaRank=id=>((META.lumina&&META.lumina.upg)||{})[id]||0;
const shaveCost=rank=>Math.round(6+3*rank);   // 自己強化を1段削ぐオーブ費用

/* ---------------- ヒロインの武器/パッシブ ---------------- */
const UPG={
  bolt:  {name:'ホーリーボルト',   d1:'ひかりの矢で',    d2:'じどうこうげき',  max:5, kind:'wp'},
  orb:   {name:'セイントオーブ',   d1:'まもりの光球が',  d2:'まわりをかいてん', max:5, kind:'wp'},
  nova:  {name:'ピュアノヴァ',     d1:'じょうかの波動で', d2:'まわりをいっそう', max:5, kind:'wp'},
  whip:  {name:'プリズムウィップ', d1:'ひかりのムチが',  d2:'まえをなぎはらう', max:5, kind:'wp'},
  rain:  {name:'スターレイン',     d1:'ながれ星が',      d2:'ふりそそぐ',      max:5, kind:'wp'},
  cross: {name:'クロスブーメラン', d1:'ひかりの十字が',  d2:'いって、もどる',  max:5, kind:'wp'},
  sanct: {name:'せいいき',         d1:'まわりの光が',    d2:'ふれた敵をやく',  max:5, kind:'wp'},
  blade: {name:'ひかりの刃',       d1:'むいた方向へ',    d2:'刃をとばす',      max:5, kind:'wp'},
  thunder:{name:'てんらい',        d1:'いかずちが',      d2:'ランダムにおちる', max:5, kind:'wp'},
  holy:  {name:'せいすい',         d1:'なげた聖水が',    d2:'地面をきよめる',  max:5, kind:'wp'},
  speed: {name:'スピードシューズ', d1:'いどう速度',      d2:'+10%',            max:3, kind:'ps'},
  vital: {name:'マックスハート',   d1:'さいだいHP+25',   d2:'いまも回復する',   max:3, kind:'ps'},
  magnet:{name:'ジェムマグネット', d1:'ジェムの回収',    d2:'はんいUP',        max:3, kind:'ps'},
  haste: {name:'クイックリボン',   d1:'こうげき速度',    d2:'+8%',             max:3, kind:'ps'},
  ward:  {name:'プチバリア',       d1:'まもり',          d2:'+1',              max:3, kind:'ps'},
  growth:{name:'ラーニングピアス', d1:'けいけんち',      d2:'+12%',            max:3, kind:'ps'},
  area:  {name:'ひろがるろうそく', d1:'こうげき範囲',    d2:'+10%',            max:3, kind:'ps'},
  dup:   {name:'ふたごの鏡',       d1:'とうしゃ数',      d2:'+1',              max:2, kind:'ps'},
  luck:  {name:'よつばのクローバー', d1:'燭台のアイテム', d2:'でやすく',        max:3, kind:'ps'},
  endure:{name:'ねばりのリボン',   d1:'スタミナ上限',    d2:'+10%',            max:3, kind:'ps'},
};
/* 融合進化(本家の進化に相当): baseがLv最大+ペアパッシブLv2以上で解禁 */
const EVOS={
  sstar:{ name:'シューティングスター', base:'bolt', pair:'speed',
    d1:'星の矢が6連で', d2:'つらぬいていく' },
  sring:{ name:'セイクリッドリング', base:'orb', pair:'vital',
    d1:'大きな聖環が', d2:'まもって癒す' },
  sburst:{ name:'スターバースト', base:'nova', pair:'magnet',
    d1:'大浄化がジェムを', d2:'ひきよせる' },
  srush:{ name:'シャインラッシュ', base:'whip', pair:'haste',
    d1:'連撃のムチが', d2:'ぜんほういをはらう' },
  scomet:{ name:'コメットフォール', base:'rain', pair:'growth',
    d1:'すい星のむれを', d2:'ふらせる' },
  sjudge:{ name:'ジャッジメントクロス', base:'cross', pair:'ward',
    d1:'大十字が何度も', d2:'つらぬきかえす' },
  gsanct:{ name:'だいせいいき', base:'sanct', pair:'endure',
    d1:'ひろい聖域が', d2:'やきながら癒す' },
  kblade:{ name:'せんじん', base:'blade', pair:'dup',
    d1:'刃のあらしが', d2:'前後にはしる' },
  judgment:{ name:'しんばつ', base:'thunder', pair:'luck',
    d1:'雷の柱が', d2:'いっせいにおちる' },
  spring:{ name:'きよめの泉', base:'holy', pair:'area',
    d1:'ひろい聖なる泉が', d2:'ながく残る' },
};
const need=l=>Math.floor(6 + l*3.2 + l*l*0.18);

/* ---------------- 状態表示(ヒロイン) ----------------
   カタログ準拠のid。効果はすべて機構レベル(数値)で表現する。 */
const AILMENTS={
  bound:{ name:'拘束', color:'#c98cff', icon:'⛓' },
  pinned:{ name:'押し倒し', color:'#ff5d7a', icon:'✖' },
  aphro:{ name:'快感', color:'#ff9ec2', icon:'✿' },
  sens:{ name:'敏感化', color:'#ffb3cf', icon:'✿' },
  heat:{ name:'発情', color:'#ff5d9e', icon:'♨' },
  slow:{ name:'粘液', color:'#8fe8c9', icon:'〰' },
  charm:{ name:'魅了', color:'#ffb3cf', icon:'✦' },
  charmbind:{ name:'魅了拘束', color:'#ff86b3', icon:'✦' },
  suck:{ name:'吸い付き', color:'#ff9d8a', icon:'♡' },
  climax:{ name:'絶頂', color:'#ff5d9e', icon:'♡' },
  /* v1.1-1.2 */
  hypno:{ name:'催眠', color:'#c98cff', icon:'📡' },
  rune:{ name:'淫紋の罠', color:'#c98cff', icon:'✧' },
  fake:{ name:'偽宝箱', color:'#ffd76a', icon:'🎁' },
  deny:{ name:'寸止め', color:'#ff5d9e', icon:'✋' },
  ache:{ name:'疼き', color:'#ff86b3', icon:'✿' },
  numb:{ name:'痺れ', color:'#ffe066', icon:'⚡' },
  possess:{ name:'憑依', color:'#dfe4ff', icon:'👻' },
  watched:{ name:'視姦', color:'#c98cff', icon:'👁' },
  crest:{ name:'淫紋', color:'#ff86b3', icon:'✧' },
  freeze:{ name:'時間停止', color:'#8fd3ff', icon:'⏳' },
  suit:{ name:'触手服', color:'#ff9ec2', icon:'🎀' },
  beg:{ name:'おねだり', color:'#ff5d9e', icon:'♡' },
  web:{ name:'淫糸', color:'#ffb3cf', icon:'🕸' },
  hypnolv:{ name:'催眠', color:'#b46cff', icon:'◉' },
  self:{ name:'自慰', color:'#ff5d9e', icon:'♡' },
  beam:{ name:'強制絶頂', color:'#ffd76a', icon:'✦' },
  musk:{ name:'雄臭', color:'#8fd36a', icon:'♨' },
  sniff:{ name:'嗅ぐ', color:'#8fd36a', icon:'♨' },
};
/* 身についた性癖(永続・世代を跨ぐ)。通常の処置では抜けない */
const TRAITS={
  musk:{ name:'雄臭への発情', max:3,
    desc:'ゴブリンの雄の臭いと快感が結びついた。以後、発情していなくても臭いを嗅ぐと身体が熱を覚え、Lvが上がるほど嗅ぐ足が止まりやすい。',
    how:'発情中にゴブリンの臭いを嗅ぎながら、他の魔物から快感を受ける' },
};
const LIMBS=['armL','armR','legL','legR'];
const LIMB_NAMES={armL:'左腕', armR:'右腕', legL:'左脚', legR:'右脚'};
const SUCKS=['nipL','nipR','clit'];
const SUCK_NAMES={nipL:'胸(左)', nipR:'胸(右)', clit:'秘部'};
const ROMANS=['','Ⅰ','Ⅱ','Ⅲ'];

/* ---------------- 堕ち二軸(観測記録用・世代内でリセット) ---------------- */
const FALL_BODY_STAGES=[[0,'不惑'],[25,'綻び'],[50,'馴染み'],[72,'熟れ'],[90,'崩れ']];
const FALL_MIND_STAGES=[[0,'不動'],[22,'揺らぎ'],[42,'罅'],[62,'傾き'],[84,'明け渡し']];
function stageName(v,table){
  let n=table[0][1];
  for(const [th,nm] of table){ if(v>=th) n=nm; }
  return n;
}
function fallBody(){ return clamp(META.rot.dmg/8 + META.rot.ail*2, 0, 100); }
function fallMind(){ return clamp(META.rot.captures*22 + META.rot.ail*0.5, 0, 100); }
