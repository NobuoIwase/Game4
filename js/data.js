'use strict';
/* ============================================================
   data.js — 定義データ: モンスター / 陣形 / 研究 / 祭壇 / ヒロイン装備
   ※数値はすべて暫定バランス。BALに集約。
============================================================ */

const BAL={
  RUN_TIME:300,            // 1戦=5分(v0.5で試験延長)
  GEN_LEN:4,               // この戦数ごとにヒロインの経験がリセット
  FIELD_CAP:160,           // 場に出せる魔物の上限(超えると召喚不可)
  EN_BASE:12, EN_PER_LV:3, EN_MAX:60,
  EN_REGEN:0.78, EN_REGEN_LV:0.07,
  EN_START:10,
  CARD_CD_BASE:1.5, CARD_CD_COST:0.11,   // カードCD = BASE + コスト×COST

  /* --- ヒロインの視界と思考(v0.4.1: 人間らしさ) --- */
  SIGHT_MARGIN:30,         // 画面端+これだけが視界。外の敵は存在に気づかない
  NOTICE_T:0.35,           // 視界に入ってから脅威と認識するまでの反応遅れ(集中低下で悪化)
  THINK_MIN:0.13, THINK_MAX:0.34, // 操舵の再評価間隔(この間は前の判断で動き続ける)
  DIVE_GEM_N:4,            // ガス溜まり内のジェムがこれ以上なら意を決して入る
  DIVE_GEM_V:8,            //   または合計価値がこれ以上
  DIVE_T:1.7,              // 意を決して入る時間(この間ガス回避を無視)

  /* --- コンボ(同一カード連打) --- */
  COMBO_WINDOW:9,          // この秒数内に同じカードを出すと連鎖
  COMBO_MAX:5,
  COMBO_STAT:0.12,         // 1連鎖ごとの召喚hp/dmgボーナス
  COMBO_UNIT_PER:2,        // 2連鎖ごとに多数陣形+1体

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

  /* --- 燭台(回復) --- */
  PROP_HP:24,
  PROP_INIT:6,             // 初期配置数
  PROP_RESPAWN:26,         // 追加出現間隔(s)

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
    name:'ナメクジ', role:'接触魅了', cost:2, unlock:0,
    hp:14, spd:34, r:10, dmg:2, xp:2, swarm:2,
    desc:'のろく弱いが、触れるたび「ナメクジという種族」への魅了が一段深まる。魅了された種族への攻撃は鈍り、深まるとどの個体にでも自分から寄っていってしまう。',
    trait:'接触で【魅了】段階UP(種族別)。Lv2+で群れ倍化',
  },
  goblin:{
    name:'ゴブリン', role:'群れ', cost:2, unlock:80,
    hp:13, spd:66, r:9, dmg:4, xp:2, swarm:2,
    desc:'緑色のチビ。一匹では何もできず、群れて囲んで小突くしか能がない。数だけは湧く。',
    trait:'Lv2+で群れ倍化',
  },
  leech:{
    name:'吸液羽虫', role:'吸い付き', cost:3, unlock:120,
    hp:8, spd:105, r:7, dmg:0, xp:2,
    desc:'肉質の小さな羽虫。素早く掠めるように飛び、触れた瞬間に胸の先や脚の間へ吸い付いて快感を注ぎ続ける。拘束の有無を問わず取り付く。',
    trait:'接触で吸い付き(快感+微スロウ、3箇所まで)',
  },
  worm:{
    name:'地上ワーム', role:'四肢拘束', cost:3, unlock:0,
    hp:18, spd:38, r:10, dmg:2, xp:2, swarm:2,
    desc:'のろく弱いが、触れると腕や脚に絡みつく。絡まれた分だけ彼女は鈍り、引き剥がしはスタミナを削る。',
    trait:'接触で四肢に絡みつく【拘束】。Lv2+で群れ倍化',
  },
  ghost:{
    name:'ゴースト', role:'主力・圧', cost:3, unlock:0,
    hp:24, spd:64, r:11, dmg:7, xp:3,
    desc:'ゆらゆらと回り込む主力打点。拘束で鈍った相手に群がらせる。',
  },
  slime:{
    name:'粘スライム', role:'粘液の跡', cost:3, unlock:60,
    hp:20, spd:52, r:11, dmg:5, xp:2,
    desc:'進んだ跡に粘液を残す。踏んだヒロインは移動が鈍る。',
    trait:'移動跡に粘液(スロウ)',
  },
  gas:{
    name:'ガス玉', role:'媚薬ガス', cost:4, unlock:200,
    hp:16, spd:22, r:11, dmg:0, xp:3, solo:true,
    desc:'ふわふわと漂い、桃色の媚薬ガスを吹き出してその場に滞留させる。吸えば媚薬ゲージがじわりと溜まる。倒すと最後に大きく弾ける。',
    trait:'媚薬ガス滞留(吸うと蓄積)',
  },
  imp:{
    name:'小淫魔', role:'煽り・じらし', cost:5, unlock:280,
    hp:20, spd:120, r:8, dmg:0, xp:5, solo:true,
    desc:'攻撃はしない。ヒロインの周りをパタパタと飛び回って煽り、集中を乱し、媚薬を薫らせる。すばしこく撃ち落としにくい。',
    trait:'まとわり煽り(媚薬+集中低下)',
  },
  flower:{
    name:'触手花', role:'設置罠・蔦', cost:5, unlock:450,
    hp:60, spd:0, r:13, dmg:0, xp:5,
    desc:'その場で待つ肉花。近づいた獲物の脚に蔦を絡め、その場に繋ぎ止めて締め上げる。',
    trait:'待ち伏せ→脚に蔦(繋留拘束+dot)',
  },
  mistslime:{
    name:'霧香スライム', role:'融合・ガスの跡', cost:6, unlock:-1,
    hp:34, spd:48, r:12, dmg:4, xp:6,
    desc:'【融合】粘スライム×ガス玉。進んだ跡が媚薬の霧になる。逃げ道そのものを桃色に染める。',
    trait:'移動跡が媚薬ガスに', fusion:['slime','gas'], fuseCost:400,
  },
  gtent:{
    name:'大触手', role:'融合・捕縛', cost:9, unlock:-1,
    hp:115, spd:30, r:16, dmg:6.5, xp:12,
    desc:'【融合】地上ワーム×触手花。届く間合いから鞭を伸ばして四肢に絡め、その場から逃さない。',
    trait:'遠隔で四肢に蔦(繋留拘束)', fusion:['worm','flower'], fuseCost:550,
  },
  vampi:{
    name:'ヴァンピロード', role:'ボス', cost:26, unlock:900,
    hp:950, spd:55, r:28, dmg:20, xp:60, boss:true,
    desc:'夜の統率者。突進で薙ぎ払い、掠めた相手をよろめかせる。召喚は1戦に1度。',
    trait:'突進/接触よろめき',
  },
};
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
  scatter:{ name:'散開', count:3, factor:1.6, unlock:0,
    desc:'遠巻きの3方向から放つ。基本の出し方。' },
  single:{ name:'精鋭', count:1, factor:0.9, unlock:200, elite:1.5,
    desc:'1体だけを強化(HP/攻撃×1.5)して送り込む。' },
  wave:{ name:'突撃列', count:5, factor:2.4, unlock:160,
    desc:'一方向から横列で押し寄せる。' },
  ambush:{ name:'潜伏', count:2, factor:1.5, unlock:280,
    desc:'進行方向の先に伏せて置く。設置系・鈍足と好相性。' },
  ring:{ name:'包囲円陣', count:8, factor:3.8, unlock:380,
    desc:'楕円の円陣で取り囲み、輪を締める。' },
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

/* ---------------- ヒロインの武器/パッシブ ---------------- */
const UPG={
  bolt:  {name:'ホーリーボルト',   d1:'ひかりの矢で',    d2:'じどうこうげき',  max:5, kind:'wp'},
  orb:   {name:'セイントオーブ',   d1:'まもりの光球が',  d2:'まわりをかいてん', max:5, kind:'wp'},
  nova:  {name:'ピュアノヴァ',     d1:'じょうかの波動で', d2:'まわりをいっそう', max:5, kind:'wp'},
  whip:  {name:'プリズムウィップ', d1:'ひかりのムチが',  d2:'まえをなぎはらう', max:5, kind:'wp'},
  rain:  {name:'スターレイン',     d1:'ながれ星が',      d2:'ふりそそぐ',      max:5, kind:'wp'},
  cross: {name:'クロスブーメラン', d1:'ひかりの十字が',  d2:'いって、もどる',  max:5, kind:'wp'},
  speed: {name:'スピードシューズ', d1:'いどう速度',      d2:'+10%',            max:3, kind:'ps'},
  vital: {name:'マックスハート',   d1:'さいだいHP+25',   d2:'いまも回復する',   max:3, kind:'ps'},
  magnet:{name:'ジェムマグネット', d1:'ジェムの回収',    d2:'はんいUP',        max:3, kind:'ps'},
  haste: {name:'クイックリボン',   d1:'こうげき速度',    d2:'+8%',             max:3, kind:'ps'},
  ward:  {name:'プチバリア',       d1:'まもり',          d2:'+1',              max:3, kind:'ps'},
  growth:{name:'ラーニングピアス', d1:'けいけんち',      d2:'+12%',            max:3, kind:'ps'},
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
