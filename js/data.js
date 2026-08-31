'use strict';
/* ============================================================
   data.js — 定義データ: モンスター / 陣形 / 研究 / 祭壇 / ヒロイン装備
   ※数値はすべて暫定バランス。BALに集約。
============================================================ */

const BAL={
  RUN_TIME:180,            // 1戦=3分
  GEN_LEN:4,               // この戦数ごとにヒロインの経験がリセット
  EN_BASE:10, EN_PER_LV:2, EN_MAX:44,
  EN_REGEN:0.62, EN_REGEN_LV:0.05,
  EN_START:8,
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

  /* --- 媚薬 / 発情 --- */
  APHRO_DECAY:0.6,         // 媚薬ゲージ自然減衰 /s
  APHRO_GAS:9,             // ガス雲の中 /s
  APHRO_IMP:2.2,           // 小淫魔が近くにいる /s
  HEAT_DUR:10,             // 発情状態の持続
  HEAT_AFTER:35,           // 発情終了後の媚薬ゲージ

  STAMINA_DRAG:1.5,       // 2箇所以上絡みつかれている間のじわ削り /s

  /* --- 燭台(回復) --- */
  PROP_HP:24,
  PROP_INIT:6,             // 初期配置数
  PROP_RESPAWN:26,         // 追加出現間隔(s)

  CHEST_TIMES:[35,95,155],
};

/* ---------------- モンスターカード ----------------
   dmgは接触ダメージ。armorで軽減される(dot・特殊は貫通あり)。
   xp: ヒロインが倒したとき彼女に入る経験値 = プレイヤーが得るエッセンス。 */
const MONSTERS={
  slug:{
    name:'ナメクジ', role:'接触魅了', cost:2, unlock:0,
    hp:14, spd:34, r:10, dmg:2, xp:2,
    desc:'のろく弱いが、触れられると目が離せなくなる。魅了された相手を彼女は撃てない。',
    trait:'接触で【魅了】+微媚薬',
  },
  worm:{
    name:'地上ワーム', role:'四肢拘束', cost:3, unlock:0,
    hp:18, spd:38, r:10, dmg:2, xp:2,
    desc:'のろく弱いが、触れると腕や脚に絡みつく。絡まれた分だけ彼女は鈍り、引き剥がしはスタミナを削る。',
    trait:'接触で四肢に絡みつく【拘束】',
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
    hp:16, spd:22, r:11, dmg:0, xp:3,
    desc:'ふわふわと漂い、桃色の媚薬ガスを吹き出してその場に滞留させる。吸えば媚薬ゲージがじわりと溜まる。倒すと最後に大きく弾ける。',
    trait:'媚薬ガス滞留(吸うと蓄積)',
  },
  imp:{
    name:'小淫魔', role:'煽り・じらし', cost:5, unlock:280,
    hp:20, spd:120, r:8, dmg:0, xp:5,
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
    hp:150, spd:34, r:16, dmg:8, xp:12,
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
const cardLvMult=lv=>({ hp:1+0.25*(lv-1), dmg:1+0.2*(lv-1) });
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
    desc:'戦闘開始時から媚薬ゲージが僅かに溜まっている。', fx:'初期媚薬 +18/段階' },
  { id:'focus', name:'朧の霞', max:2, costs:[16,32],
    desc:'集中の芯を曇らせる。判断と反応が僅かに遅れる。', fx:'反応 -12%/段階' },
  { id:'stamina', name:'倦怠の澱', max:3, costs:[14,26,44],
    desc:'身体の芯に疲労を澱ませる。スタミナの上限と回復が落ちる。', fx:'スタミナ上限 -12/段階' },
];
const altarLv=id=>META.altar[id]||0;

/* ---------------- ヒロインの武器/パッシブ ---------------- */
const UPG={
  bolt:  {name:'ホーリーボルト',   d1:'ひかりの矢で',    d2:'じどうこうげき',  max:5, kind:'wp'},
  orb:   {name:'セイントオーブ',   d1:'まもりの光球が',  d2:'まわりをかいてん', max:5, kind:'wp'},
  nova:  {name:'ピュアノヴァ',     d1:'じょうかの波動で', d2:'まわりをいっそう', max:5, kind:'wp'},
  speed: {name:'スピードシューズ', d1:'いどう速度',      d2:'+10%',            max:3, kind:'ps'},
  vital: {name:'マックスハート',   d1:'さいだいHP+25',   d2:'いまも回復する',   max:3, kind:'ps'},
  magnet:{name:'ジェムマグネット', d1:'ジェムの回収',    d2:'はんいUP',        max:3, kind:'ps'},
};
/* 融合進化(本家の進化に相当): baseがLv最大+ペアパッシブLv2以上で解禁 */
const EVOS={
  sstar:{ name:'シューティングスター', base:'bolt', pair:'speed',
    d1:'星の矢が6連で', d2:'つらぬいていく' },
  sring:{ name:'セイクリッドリング', base:'orb', pair:'vital',
    d1:'大きな聖環が', d2:'まもって癒す' },
  sburst:{ name:'スターバースト', base:'nova', pair:'magnet',
    d1:'大浄化がジェムを', d2:'ひきよせる' },
};
const need=l=>Math.floor(6 + l*3.2 + l*l*0.18);

/* ---------------- 状態表示(ヒロイン) ----------------
   カタログ準拠のid。効果はすべて機構レベル(数値)で表現する。 */
const AILMENTS={
  bound:{ name:'拘束', color:'#c98cff', icon:'⛓' },
  pinned:{ name:'押し倒し', color:'#ff5d7a', icon:'✖' },
  aphro:{ name:'媚薬', color:'#ff9ec2', icon:'✿' },
  heat:{ name:'発情', color:'#ff5d9e', icon:'♨' },
  slow:{ name:'粘液', color:'#8fe8c9', icon:'〰' },
  charm:{ name:'魅了', color:'#ffb3cf', icon:'✦' },
};
const LIMBS=['armL','armR','legL','legR'];
const LIMB_NAMES={armL:'左腕', armR:'右腕', legL:'左脚', legR:'右脚'};

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
