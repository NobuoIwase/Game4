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
  BOUND_DMG_MULT:1.6,      // 拘束中の被ダメ倍率
  BOUND_ARMOR_MULT:0.5,
  HEAT_DECAY:1.5,
  CHEST_TIMES:[35,95,155],
};

/* ---------------- モンスターカード ----------------
   dmgは接触ダメージ。armorで軽減される(状態異常のdotは貫通)。
   xp: ヒロインが倒したとき彼女に入る経験値 = プレイヤーが得るエッセンス。 */
const MONSTERS={
  bat:{
    name:'こうもり', role:'量産・翻弄', cost:2, unlock:0,
    hp:10, spd:96, r:9, dmg:4, xp:1,
    desc:'安価な群れ。ヒロインの注意とエネルギー循環を担う。',
  },
  slime:{
    name:'粘スライム', role:'粘液の跡', cost:3, unlock:0,
    hp:20, spd:52, r:11, dmg:5, xp:2,
    desc:'進んだ跡に粘液を残す。踏んだヒロインは移動が鈍る。',
    trait:'移動跡に粘液(スロウ)',
  },
  ghost:{
    name:'ゴースト', role:'漂う圧力', cost:3, unlock:0,
    hp:24, spd:64, r:11, dmg:7, xp:3,
    desc:'ゆらゆらと回り込む。数を並べると囲みが完成しやすい。',
  },
  zombie:{
    name:'ゾンビ', role:'重打', cost:4, unlock:120,
    hp:52, spd:40, r:12, dmg:11, xp:5,
    desc:'鈍いが一撃が重い。護りを上から叩ける数少ない初期戦力。',
  },
  worm:{
    name:'縛鎖ワーム', role:'拘束', cost:6, unlock:280,
    hp:44, spd:74, r:11, dmg:6, xp:6,
    desc:'地中を潜航し、至近で跳びかかって【拘束】する。拘束中の対象は被ダメージが増す。',
    trait:'潜航接近→跳びつき拘束',
  },
  imp:{
    name:'小淫魔', role:'状態異常(遠隔)', cost:6, unlock:280,
    hp:26, spd:78, r:9, dmg:1, xp:6,
    desc:'距離を保ち熱の矢を放つ。【発情】が蓄積すると集中が乱れ、抵抗も鈍る。時折【魅了】の視線。',
    trait:'発情ダート/まれに魅了',
  },
  flower:{
    name:'触手花', role:'設置罠', cost:5, unlock:450,
    hp:60, spd:0, r:13, dmg:0, xp:5,
    desc:'その場で待つ肉花。近づいた獲物を咲いて搦め捕り、【拘束】と持続ダメージを与える。',
    trait:'待ち伏せ開花(拘束+dot)',
  },
  nightbat:{
    name:'宵闇こうもり', role:'融合・強襲', cost:4, unlock:-1,
    hp:22, spd:132, r:10, dmg:7, xp:5,
    desc:'【融合】こうもり×ゴースト。残像を引いて急襲し、掠めるたび僅かに熱を残す。',
    trait:'高速+微発情', fusion:['bat','ghost'], fuseCost:320,
  },
  gtent:{
    name:'大触手', role:'融合・捕縛', cost:9, unlock:-1,
    hp:150, spd:34, r:16, dmg:8, xp:12,
    desc:'【融合】縛鎖ワーム×触手花。届く間合いから鞭で搦め、引き寄せて長く【拘束】する。',
    trait:'遠隔グラブ+引き寄せ', fusion:['worm','flower'], fuseCost:550,
  },
  vampi:{
    name:'ヴァンピロード', role:'ボス', cost:26, unlock:900,
    hp:950, spd:55, r:28, dmg:20, xp:60, boss:true,
    desc:'夜の統率者。突進で薙ぎ、捉えた相手を短く【拘束】する。召喚は1戦に1度。',
    trait:'突進/接触拘束(短)',
  },
};
const CARD_LV_MAX=5;
const cardLvMult=lv=>({ hp:1+0.25*(lv-1), dmg:1+0.2*(lv-1) });
const cardCost=(id,lv)=>{
  const b=MONSTERS[id].cost;
  return Math.max(1, b - (lv>=3?1:0) - (lv>=5?1:0));
};
const cardUpCost=(id,lv)=>Math.round((MONSTERS[id].cost*38)*(1+0.65*(lv-1)));

/* ---------------- 陣形(出現方法) ---------------- */
const FORMATIONS={
  scatter:{ name:'散開', count:3, factor:1.6, unlock:0,
    desc:'遠巻きの3方向から放つ。基本の出し方。' },
  single:{ name:'精鋭', count:1, factor:0.9, unlock:200, elite:1.5,
    desc:'1体だけを強化(HP/攻撃×1.5)して送り込む。' },
  wave:{ name:'突撃列', count:5, factor:2.4, unlock:160,
    desc:'一方向から横列で押し寄せる。' },
  ambush:{ name:'潜伏', count:2, factor:1.5, unlock:280,
    desc:'進行方向の先に伏せて置く。設置系と好相性。' },
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
    desc:'状態異常への感受性を高める。効きが深く、抜けにくくなる。', fx:'異常効果 +18%/段階' },
  { id:'heat', name:'微熱の種', max:2, costs:[16,32],
    desc:'戦闘開始時から熱が僅かに燻る。', fx:'初期発情 +18/段階' },
  { id:'focus', name:'朧の霞', max:2, costs:[16,32],
    desc:'集中の芯を曇らせる。判断と反応が僅かに遅れる。', fx:'反応 -12%/段階' },
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

/* ---------------- 状態異常(戦闘内・ヒロインに付与) ----------------
   カタログ準拠のid。効果はすべて機構レベル(数値)で表現する。 */
const AILMENTS={
  bound:{ name:'拘束', color:'#c98cff', icon:'⛓' },
  aphrodisia:{ name:'発情', color:'#ff86b3', icon:'♨' },
  slow:{ name:'粘液', color:'#8fe8c9', icon:'〰' },
  charm:{ name:'魅了', color:'#ffb3cf', icon:'✦' },
};

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
