'use strict';
/* ============================================================
   game.js — 戦闘ロジック
   ヒロイン(AI自動操縦) / 四肢拘束・スタミナ / モンスター / EN・カード
============================================================ */

/* ================= ヒロイン生成 ================= */
function newHero(id){
  const HD=HEROES[id]||HEROES.lumina; id=HEROES[id]?id:'lumina';   // v3.0 ヒロインの素性
  const gb=Math.min(3,META.gen.battle||0);   // 潜行の日数(0..3 で頭打ち。v2.0 で日数は増え続けるため)
  const aArmor=altarLv('armor'), aRegen=altarLv('regen'), aSpeed=altarLv('speed');
  const aSense=altarLv('sense'), aHeat=altarLv('heat'), aFocus=altarLv('focus');
  const aStam=altarLv('stamina');
  const LU=(META.lumina&&META.lumina.upg)||{};
  // 抵抗の意志(敗北で固くなる・生き延びると少し緩む)と、世代ごとの素の成長。夜側の強化が行き着いても「全く抵抗できない」には落ちない
  const will=Math.min(BAL.WILL_CAP,(META.lumina&&META.lumina.will)||0);
  const gsc=1+BAL.GEN_SCALE*Math.min(10,Math.max(0,(META.gen.idx||1)-1));
  const h={
    x:0, y:0, vx:0, vy:0, r:10,
    maxHp:Math.round(175*(1+0.18*gb)*(1+0.08*(LU.vital||0))*(1+0.03*will)*gsc*HD.hpMul), hp:0,
    armor:Math.max(0, 7 + gb - aArmor + Math.floor((LU.guard||0)*0.5) + HD.armor),
    regen:(0.9+0.15*gb+0.08*(LU.bless||0))*(1-0.3*aRegen)*(HD.regenMul||1),   // v3.1 素性の回復係数
    baseSpeed:154*(1-0.06*aSpeed)*(1+0.02*(LU.swift||0))*HD.spdMul,
    dmgMult:(1+0.06*(LU.zeal||0))*(1+0.02*will)*gsc*(HD.dmgMul||1),   // v3.1 素性の火力係数
    will, curse:null, curseAmp:0, curseAche:false,     // v1.6 抵抗の意志 / ボス敗北の呪い
    hypnoG:0, hypnoFloor:0, heatG:0, inMusk:false,     // v1.6 催眠ゲージ(呪いの下限) / 発情ゲージ(雲から) / 雄臭の雲の中
    id, name:HD.name, hi:0, out:false, captive:null, assist:null, thanksT:0, seenT:0, lineT:0, lowSaid:false,   // v3.0 素性 / 離脱(捕獲) / 救援 / 個別の台詞タイマー
    zone:'moss', bathT:0, springCd:0, dest:null, destUntil:0, explore:null, exploreUntil:0,   // v1.6 地形マップ
    poolT:0, readT:0, poolKey:null, readKey:null, goal:null, goalT:0, farmT:0, walkT:0,        // v1.8 清水/石碑/目当て
    tgtKey:null, tgtBest:0, tgtT:0,                                                              // v2.1 諦めの見張り
    skillCd:(()=>{ const o={}; for(const k in HD.skills) o[k]=0; return o; })(), guardT:0, emberT:0, aiMode:'fight', modeUntil:0, escape:null, dpsEst:20, hesitN:{},   // v2.3 奥義 / 戦闘モード / 地形ごとの迷った回数
    stuckT:0, unstickT:0, path:null, zoneLast:undefined,                                       // v1.7 壁・経路
    level:1, xp:0, xpNeed:need(1),
    wp:(()=>{ const o={}; for(const k in UPG) if(UPG[k].kind==='wp') o[k]=0; for(const k in HD.start) o[k]=HD.start[k]; return o; })(),   // v3.0 全武器の枠を持ち、自分の武器だけ育つ
    ps:{speed:0, vital:0, magnet:0, haste:0, ward:0, growth:0, area:0, dup:0, luck:0, endure:0, reach:0, pierce:0, regen:0},
    evo:(()=>{ const o={}; for(const k in EVOS) o[k]=0; return o; })(),
    boltT:0.6, novaT:2.5, orbAng:0, novaAnim:0, novaR:0,
    chainT:1.0, spiritT:1.2, shieldPulse:0, shieldR:0, shieldArc:0, shieldAng:0,   // v2.0 新武器
    whipT:1.1, whipAnim:0, whipDir:1, whipSide:1, whipR:0, rainT:2.2, crossT:1.6,
    sanctT:0, sanctPulse:0, bladeT:1.0, thunderT:2.0, holyT:2.4,
    fswordT:1.0, fswordSide:1, fringT:0, fringAng:0, fburstT:3.0, fpillarT:2.2, fwingT:4.5, fwingAnim:0, fwingX:0, fwingY:0,   // v3.0 フレイラの武器
    dazeT:0, hypno:null,                 // 催眠電波(v1.1)
    denyT:0, denySrc:null, deepClimax:false, acheCd:2, numbT:0, watchedT:0, gazeCd:6,
    crestLv:0, freezeT:0, frozenAcc:0, suitT:0, suitPulse:0, begT:0, begCd:6, possessCd:0,   // v1.2 状態異常拡張
    hypnoLv:0, hypnoT:0, selfT:0, selfCd:4, selfPhase:0, dodging:0,                          // v1.3 催眠Lv・自慰
    sniffT:0, sniffCd:0, sniffAt:null, muskCd:0, muskNear:false, muskCond:0, muskDone:false, aphroPrev:0,   // 雄臭
    lastHypno:null, lastBeam:null,       // 直前の催眠/強制絶頂の源 {id,t}: 敗北・押し倒しの場面の帰属に使う
    /* 今夜の好み: ビルド選択の癖(戦闘ごとにランダム)。
       噛み合わない好みを引いた夜は、シナジー不足でDPSが枯れる */
    taste:(()=>{
      const t={}; for(const k in UPG) t[k]=rand(0.55,1.65);
      for(const k in HD.start) t[k]=Math.max(t[k]||1,1.15);   // 初期武器には最低限の愛着(1戦目のDPS床)
      return t;
    })(),
    ifr:0, face:1, moving:false, anim:rand(10),
    strafeDir:Math.random()<0.5?-1:1, strafeT:2,
    bubble:'', bubbleT:0, bubbleCd:0, aiLabel:'けいかい中', aiState:'',
    /* --- スタミナ / 四肢拘束 / 押し倒し --- */
    staminaMax:BAL.STAMINA_MAX-12*aStam+6*(LU.grit||0)+1.5*will,
    stamina:0,
    limbs:{armL:null, armR:null, legL:null, legR:null},
    suckers:{nipL:null, nipR:null, clit:null},   // 吸液羽虫の吸い付き
    struggle:0,
    pinned:false, pinBy:null, pinT:0, pinEscape:0,
    exhausted:false,               // スタミナ0で四肢が自由だった場合の疲弊
    /* --- 敏感化 / 快感 / 発情(v0.4) --- */
    sensit:26*aHeat, sensitFloor:26*aHeat,   // 敏感化ゲージ(祭壇分は下限)
    aphro:0,                                  // 快感ゲージ 0-100
    heatLv:0, heatT:0,                        // 発情レベル(0-3)と残り時間
    waveT:0, waveDur:0,                       // 発情の波
    /* --- 魅了(対象別) / その他状態 --- */
    charms:[],                                // {mon,lv,t,driftCd}
    charmDrift:null,                          // {mon,t} 無意識に寄る発作
    charmBind:null,                           // {mon} 魅了拘束
    charmBindT:0, charmSanity:0,
    slow:0,
    teaseN:0,                      // 近くの小淫魔の数(集中低下)
    resist:{bound:0, charm:0},
    sense:1+0.18*aSense,
    focusPen:0.12*aFocus,
    stumbleT:rand(2,3), stumbleDur:0,
    propTarget:null,
    prevX:0, prevY:0,
    /* --- 思考の拍 / 意を決した突入(v0.4.1) --- */
    thinkT:0, steerX:0, steerY:0, steerState:'wait',
    diveT:0,
    /* --- 絶頂(v0.6) --- */
    climaxT:0, climaxPhase:0, squirted:false, refractT:0,
    bubblePrio:0,
  };
  // 戦闘経験の継承(世代内で強くなる)
  { const gw=HD.grow; if(gb>=1) h.wp[gw[0]]=Math.max(h.wp[gw[0]],3); if(gb>=2){ h.wp[gw[1]]=Math.max(h.wp[gw[1]],2); h.wp[gw[2]]=Math.max(h.wp[gw[2]],1); } }
  if(gb>=3){ h.ps.speed=1; h.ps.haste=1; }
  h.hp=h.maxHp;
  h.stamina=h.staminaMax;
  // ボス敗北の呪い(日を跨ぐ): 前の日にボスに負けていれば、その痕が残った身体で始まる
  const cu=(META.curse&&META.curse.left>0&&BOSS_CURSES[META.curse.id])?META.curse.id:null;
  h.curse=cu;
  if(cu==='dreamtree'){ h.sensitFloor+=20; h.sensit=Math.max(h.sensit,h.sensitFloor); h.curseAmp=0.10; }
  if(cu==='bossgazer'){ h.hypnoG=40; h.hypnoFloor=40; }   // 催眠Ⅰが入るまで、ゲージは40より下がらない
  if(cu==='vampi'){ h.staminaMax=Math.max(30,h.staminaMax-15); }
  if(cu==='slimeking'){ h.sensitFloor+=15; h.sensit=Math.max(h.sensit,h.sensitFloor); }
  if(cu==='runemage'){ h.crestLv=1; h.curseAche=true; }
  if(cu==='succuqueen'){ h.heatLv=1; h.heatT=9999; }
  applyRunHero(h);   // v2.1 引き継ぎ: リセットまで、階層を跨いでも Lv・武器・パッシブ・進化は残る(HP・スタミナは朝に戻る)
  return h;
}
/* ================= v2.1 引き継ぎ(リセットまで残る彼女の強さ) =================
   降りた日・捕まった日の終わりに Lv/経験値/武器/パッシブ/進化/今夜の好み を META.run.hero に写す。二連敗か魔核討伐(runReset)で消える。
   夜側もこれに連動する: 夜の深まり(彼女のLv連動の魔物強化・頭数)と EN上限(Lv連動)が階層を経るごとに積み上がる */
function applyRunHero(h){
  const R=META.run&&((META.run.heroes&&META.run.heroes[h.id])||(h.id==='lumina'?META.run.hero:null)); if(!R||!R.level) return;   // v3.0 ヒロインごと
  for(const k in h.wp) h.wp[k]=0; for(const k in h.ps) h.ps[k]=0;
  h.level=R.level; h.xp=R.xp||0; h.xpNeed=need(h.level);
  if(R.taste) Object.assign(h.taste,R.taste);
  for(const k in R.wp){ if(h.wp[k]!==undefined) for(let i=0;i<(R.wp[k]|0);i++) applyUpgStat(h,k); }
  for(const k in R.ps){ if(h.ps[k]!==undefined) for(let i=0;i<(R.ps[k]|0);i++) applyUpgStat(h,k); }
  for(const k in R.evo){ if(h.evo[k]!==undefined && R.evo[k]) h.evo[k]=1; }
  for(let i=0;i<Math.min(BAL.PRAY_MAX,R.pray|0);i++) applyPrayStat(h);   // 祈りの積み上げも残る
  if(!Object.values(h.wp).some(v=>v>0)) h.wp[(HEROES[h.id]||HEROES.lumina).grow[0]]=1;   // 念のため: 武器ゼロにはしない
  h.hp=h.maxHp; h.stamina=h.staminaMax;
}
function snapRunHero(p){
  if(!META.run) return;
  const snap={ level:p.level, xp:p.xp, pray:p.pray||0, wp:Object.assign({},p.wp), ps:Object.assign({},p.ps), evo:Object.assign({},p.evo), taste:Object.assign({},p.taste) };
  META.run.heroes=META.run.heroes||{}; META.run.heroes[p.id]=snap; if(p.id==='lumina') META.run.hero=snap;   // v3.0 ヒロインごとに写す(hero は互換用)
}
/* 強化の数値だけを積む(演出なし。applyUpg と引き継ぎの復元で共用) */
function applyUpgStat(p,k){
  if(UPG[k].kind==='wp') p.wp[k]++; else p.ps[k]++;
  if(k==='vital'){ p.maxHp=Math.round(p.maxHp)+25; }
  if(k==='ward'){ p.armor++; }
  if(k==='regen'){ p.regen+=0.15; }   // v2.0 いのりの露
  if(k==='endure'){ const add=Math.round(p.staminaMax*0.1); p.staminaMax+=add; p.stamina=Math.min(p.staminaMax,p.stamina+add); }
  return true;
}
const attachedSlots=h=>LIMBS.filter(k=>h.limbs[k]);
const attachCount=h=>attachedSlots(h).length;
const armCount=h=>['armL','armR'].filter(k=>h.limbs[k]).length;
const legCount=h=>['legL','legR'].filter(k=>h.limbs[k]).length;
const suckSlots=h=>SUCKS.filter(k=>h.suckers[k]);
const suckCount=h=>suckSlots(h).length;
const restraintCount=h=>attachCount(h)+suckCount(h);
function sensLvOf(h){
  const g=h.sensit;
  return g>=BAL.SENSIT_TH[2]?3 : g>=BAL.SENSIT_TH[1]?2 : g>=BAL.SENSIT_TH[0]?1 : 0;
}
/* 魅了は「種族(モンスターid)ごと」に持つ。同じ種族ならどの個体にも効く */
/* 練度による快感フィード係数: Lv1=35% / Lv2=67% / Lv3+=100%
   (育っていない魔物は、触れても拙くて感じさせられない) */
function unitPmul(mon){
  const lv=(mon&&mon.lv)||1;
  return 0.35+0.65*Math.min(1,(lv-1)/2);
}
function charmEntry(h,id){ return h.charms.find(c=>c.id===id); }
function charmLvFor(h,mon){ const c=charmEntry(h,mon.id); return c?c.lv:0; }
function charmMaxLv(h){ return h.charms.reduce((m,c)=>Math.max(m,c.lv),0); }
function nearestOfId(id){
  const B=G.B, p=B.hero;
  let best=null, bd=1e9;
  for(const e of B.enemies){
    if(e.dead||e.dormant||e.state==='attached'||e.id!==id) continue;
    const d=Math.hypot(e.x-p.x,e.y-p.y);
    if(d<bd){ bd=d; best=e; }
  }
  return best;
}

function heroFocus(h){
  const aph=h.heatLv>0 ? 0.2+0.1*h.heatLv+(h.waveDur>0?0.1:0) : h.aphro/100*0.2;
  return clamp(1 - aph - h.focusPen - 0.08*Math.min(2,h.teaseN), 0.25, 1);
}
function heroStat(h){
  let spd=h.baseSpeed*(1+0.10*h.ps.speed);
  spd*=Math.pow(0.72, legCount(h));
  spd*=Math.pow(BAL.SUCK_SLOW, suckCount(h));
  if(h.slow>0) spd*=(h.curse==='slimeking'?0.42:0.55);   // 呪い『粘膜の記憶』: 粘液で更に鈍る
  if(h.zone==='water') spd*=0.88;   // 浅瀬
  if(h.zone==='ruin') spd*=1.06;    // 石畳
  if(h.heatLv>0) spd*=1-0.04*h.heatLv;
  if(h.waveDur>0) spd*=BAL.WAVE_SPD;
  if(h.exhausted) spd*=0.7;
  if(h.numbT>0) spd*=0.75;        // 痺れ
  if(h.suitT>0) spd*=0.85;        // 触手服
  return { speed:spd, magnet:90+45*h.ps.magnet };
}
const curLv=k=>UPG[k].kind==='wp' ? heroOf(k).wp[k] : G.B.heroes[0].ps[k];   // v3.0 武器は持ち主のヒロイン、パッシブは共通
const areaMult=h=>1+0.10*(h.ps.area||0);      // ひろがるろうそく
const dupN=h=>(h.ps.dup||0);                   // ふたごの鏡(投射+1)

/* ================= v2.0 編成: ランダム / おまかせ(階層の得意種とカード練度を優先) ================= */
function ownedIds(){ return Object.keys(MONSTERS).filter(id=>!MONSTERS[id].item && !MONSTERS[id].guardian && META.cards[id] && META.cards[id].owned); }
function buildDeck(mode){
  const F=curFloor(), owned=ownedIds(), deck=[]; const byTier={};
  for(const id of owned){ const t=tierOf(id); (byTier[t]=byTier[t]||[]).push(id); }
  for(const t in TIER_CAP){
    let pool=(byTier[t]||[]).slice(); if(!pool.length) continue;
    if(mode==='auto') pool.sort((a,b)=>((F.affinity.includes(b)?10:0)+(META.cards[b].lv||1)+Math.random()*0.8)-((F.affinity.includes(a)?10:0)+(META.cards[a].lv||1)+Math.random()*0.8));
    else pool=shuffle(pool);
    for(const id of pool.slice(0,TIER_CAP[t])) deck.push(id);
  }
  if(!deck.length) deck.push('slug');
  return deck;
}
function applyDeckMode(){ const mode=(META.settings&&META.settings.deckMode)||'manual'; if(mode==='manual') return null; META.deck=buildDeck(mode); saveMeta(); return mode; }
/* ================= 戦闘開始/終了 ================= */
function startBattle(){
  const heroes=partyIds().map((id,i)=>{ const h=newHero(id); h.hi=i; return h; }); const hero=heroes[0];   // v3.1 出撃するのは META.party.roster(最初はルミナ一人)
  { const top=heroes.reduce((a,h)=>h.level>a.level?h:a,heroes[0]); for(const h of heroes){ if(h!==top){ h.level=top.level; h.xp=top.xp; h.xpNeed=top.xpNeed; } } }   // v3.0 Lv はパーティ共通(片方だけ引き継ぎが残っていても揃える)
  G.B={
    time:0, over:false,
    heroes, ci:0, get hero(){ return this.heroes[this.ci]; },   // v3.0 パーティ。B.hero は「いま処理しているヒロイン」(文脈 B.ci)
    party:{goal:null, turn:1, talkUntil:0, leader:0, lastLoser:-1, decidedT:-99}, captures:[],
    enemies:[], bullets:[], gems:[], hearts:[], trails:[], clouds:[], props:[], chests:[],
    en:BAL.EN_START*curFloor().en.start, spawnFx:[],
    floor:curFloor(), seals:{}, exitLocked:false, exitT:0, cleared:false, descending:false,   // v2.0 階層
    hand:META.deck.map(id=>({id, cdT:0, cdMax:1})),
    auto:META.settings.autoplay, autoT:1.2,
    kills:0, dmgDealt:0, dmgCarry:0, ailCount:0, orbFrag:0, essence:0,
    bossUsed:false, bossPlayed:{}, bossCd:0, bossMark:null, ebullets:[], shrineGot:[], gateT:0, poiCd:0, capturedBy:null, captureCause:'', captureT:0, winT:0,
    ailRateT:{}, chestIdx:0, propT:BAL.PROP_RESPAWN,
    lvCards:null, pinScene:null, pinSceneIdx:0, pinSceneT:0,
    combo:{}, lastPlay:null,
    climaxN:0, stains:[],
    heroCoins:0, impBurstCd:0,
    zones:[], fx:[], items:[], whiteFlash:0, gifts:0, gropeCd:0,
    itemCd:{}, traps:[], itemsUsed:0,                 // 夜側のアイテム(v1.1)
    filmed:0,                                         // 見られながらの絶頂(v1.2)
    codexSeen:{}, metCd:{}, recentMet:{},             // 図鑑の記録用
    picks:[], pickT:{shroom:BAL.PICK_SHROOM_RESPAWN, nectar:BAL.PICK_NECTAR_RESPAWN, treasure:BAL.PICK_TREASURE_CD},   // v1.8 地形の資源
    poolCd:{}, steleRead:{}, used:{shroom:0,nectar:0,treasure:0,pool:0,stele:0}, seeToastT:-9,
    event:null, eventT:BAL.EVENT_FIRST, eventsN:0, eventsDone:0,                                   // v1.8 イベント(光の柱)
    wantExit:false, wantExitWhy:'', idleGoalT:0, sentRing:null, metLine:{}, lineCd:{}, featSaid:{}, pressSaid:0, lowSaid:false, calmT:0,   // v2.1 降りる判断 / 番兵の輪 / 台詞の記録
    giveUp:new Map(),                                                                              // v2.1 諦めた目標(ref → いつまで外すか)
    placed:[], itemT:9, ringCd:0, lewdSeen:false,                                                  // v2.2 夜側の設置物 / 包囲円陣の間隔 / えちえちエリアの初見
    seenT:0, bossSeen:!!(META.run&&META.run.bossSeen), exploreSaid:false,                          // v2.4 視界の記憶 / この run でボスを見た(武器選びに使う)
  };
  genMap();               // 地形(世代×階層で変わる)
  initSeen();             // v2.4 見た範囲の記憶(同じ階層への再挑戦は覚えている)
  for(let i=1;i<heroes.length;i++){ const q=snapFloor(44*i,8*i,false,4)||{x:44*i,y:8*i}; heroes[i].x=q.x; heroes[i].y=q.y; }   // v3.0 二人目以降は横に並ぶ
  { const F=G.B.floor; G.B.exitLocked=(F.puzzle==='seals');
    if(F.final){ const q=G.map.pois.find(o=>o.kind==='core'); if(q){ spawnUnit('core',q.x,q.y,{}); } }   // v2.0 最終階層: 魔核が待つ
    else spawnSentinels(); }   // v2.1 降り口は石の番兵が守る
  prewarmChunks(0,0);     // 出発点の周りのマップチップを先に焼く
  spawnInitialProps();
  spawnInitialPicks();    // v1.8 地形の資源(光茸・蜜の花・沈んだ宝)
  spawnDen();             // v3.2 巣窟の報酬と仕掛け
  // 描き込みスプライトの事前焼き(デッキの種族×位相を最初の数十フレームで焼いておく)
  G.gfxLv=2; G.kCap=2; G.prebake=[];
  if(typeof resetSpriteCache==='function') resetSpriteCache();   // 前の戦闘の焼き絵(別デッキ・別倍率)は捨てる
  for(const id of new Set(META.deck.concat(['hand','worm']))){ if(MONSTERS[id]&&!MONSTERS[id].boss&&!MONSTERS[id].item){ for(let k=0;k<16;k++) for(let v=0;v<3;v++) G.prebake.push({id, t:k/8, vari:v}); } }
  G.mode='battle';
  G.cam.x=0; G.cam.y=0;
  { const F=G.B.floor; setBanner('第'+F.depth+'層 '+F.name+(META.run.fails>0?'(再挑戦)':'')+(hero.level>1?' — Lv'+hero.level+'を引き継ぎ':''), F.sub, F.col); }
  heroBubble(hero,'今日も、まもりぬくよ!',true);
  if(heroes[1]) heroBubble(heroes[1],'……行く。付いてきなさい',true);
  UI.enterBattle();
  bgmStart('battle');
  // v2.0 物語: 初めての出撃は序章、階層に降り立った導入(潜行ごとに1度)、敗北の翌朝は再挑戦の文
  { const F=G.B.floor, sf=storyFloor(F.depth); let lines=null;
    const V30=(typeof STORY_V30!=='undefined')?STORY_V30:null, PRO=(V30&&V30.prologue&&V30.prologue.length&&G.B.heroes.length>1)?V30.prologue:STORY.prologue;   // v3.0 二人の序章
    const fIntro=(!META.run.storySeen['f'+F.depth]&&sf.intro.length)?['' ].concat(sf.intro):[];
    const loopI=((META.era|0)>0 && !META.run.storySeen['loop'+META.era])?storyLoopIntro(G.B.heroes.length):null;   // v3.1 組み替わった後の朝(一人版/二人版)
    if(!META.run.storySeen.prologue && PRO.length){ lines=PRO.concat(fIntro); META.run.storySeen.prologue=1; if(G.B.heroes.length>1) META.run.storySeen.join=1; META.run.storySeen['f'+F.depth]=1; saveMeta(); }   // v3.1 一人で始めたなら合流の朝はまだ
    else if(!META.run.storySeen.join && G.B.heroes.length>1 && V30 && V30.party && V30.party.join && V30.party.join.length){ const late=(META.run.joinWhy==='late' && V30.party.joinLate && V30.party.joinLate.length); lines=(late?V30.party.joinLate:V30.party.join).concat(fIntro); META.run.storySeen.join=1; if(late) META.run.storySeen['loop'+META.era]=1; META.run.storySeen['f'+F.depth]=1; META.run.joinWhy=''; saveMeta(); }   // v3.1 合流の朝(二連敗の後 / 一人で討ち続けた後の変奏)
    else if(loopI){ lines=loopI.concat(fIntro); META.run.storySeen['loop'+META.era]=1; META.run.storySeen['f'+F.depth]=1; saveMeta(); }   // v3.0 組み替わった後の朝
    else if(META.run.fails>0 && STORY.retry.length){ lines=storyRetry(); }
    else if(sf.intro.length && !META.run.storySeen['f'+F.depth]){ lines=sf.intro; META.run.storySeen['f'+F.depth]=1; saveMeta(); }
    if(META.run.leftBehind && V30 && V30.party && V30.party.reunion && V30.party.reunion.length){ META.run.leftBehind=false; lines=V30.party.reunion.concat(lines&&lines.length?['']:[]).concat(lines||[]); saveMeta(); }   // v3.0 置いていかれた子が戻った朝(導入の前に)
    if(lines&&lines.length) UI.showStory(lines,{dur:8+lines.length*1.3});
    G.B.storyLineT=22+rand(10); }
}
function enMax(){ const F=(G.B&&G.B.floor)||curFloor(); return Math.round(Math.min(BAL.EN_MAX*F.en.max*eraMul(), BAL.EN_BASE*F.en.base + 6*altarLv('encap') + BAL.EN_PER_LV*(G.B?G.B.hero.level:1))*(1+BAL.PRESS_EN_MAX*pressure())); }   // v3.0 世代で天井が上がる   // v2.0 深いほど多い / v2.1 長居するほど多い
/* v2.1 深淵の圧: 同じ階層に長く居るほど夜側が強くなる(EN上限・EN回復・召喚頭数・場の上限)。階層を跨ぐと時間は戻る */
const pressMax=()=>Math.min(BAL.PRESS_MAX+0.6, 1.2+0.2*eraNow());   // v3.0 圧の上限は世代で上がる(1.2→2.6)
const coreDef=()=>Math.max(BAL.CORE_DEF, (BAL.CORE_ERA_DEF0||0.7)-BAL.CORE_ERA_DEF_K*eraNow());   // v3.1 世代0は 0.75
function pressure(){ const B=G.B; if(!B) return 0; return Math.min(pressMax(), Math.max(0,B.time-BAL.PRESS_T0)/BAL.PRESS_T1); }
function fieldCap(){ return Math.round(BAL.FIELD_CAP*(1+BAL.PRESS_CAP*pressure())); }

function endBattle(outcome){
  const B=G.B;
  if(B.over) return;
  B.over=true;
  saveSeen(); if(B.bossSeen){ META.run.bossSeen=true; }   // v2.4 見た範囲とボスの記憶を run に残す
  const gb=Math.min(3,META.gen.battle||0);
  // v3.1 収入: 一日の撃破ぶんは逓減(essSoft)し、世代の係数を掛ける。結果ごとの加算は深さ・世代で少し伸びる
  const eraK=1+BAL.ESS_ERA_K*eraNow(), orbK=1+BAL.ORB_ERA_K*eraNow();
  const softK=Math.max(0.05,(B.time||0)/BAL.ESS_SOFT_T);   // v3.1 逓減の基準をその日の長さに比例させる(短い日を積んでも得しない)
  let orbGain=Math.round(essSoft(B.orbFrag,BAL.ORB_SOFT*softK)*orbK), essGain=Math.round(essSoft(B.essence,BAL.ESS_SOFT*softK)*eraK);
  if(outcome==='capture'){ orbGain+=BAL.ORB_CAPTURE + BAL.ORB_CAPTURE_GEN*gb; essGain+=BAL.CAPTURE_ESS_BONUS; }
  if(outcome==='survive'){ essGain+=BAL.SURVIVE_ESS_BONUS; }
  if(outcome==='descend'){ essGain+=BAL.DESCEND_ESS+BAL.DESCEND_ESS_DEPTH*Math.max(0,B.floor.depth-1); }   // v2.0 降りられた日(v3.1 深いほど)
  if(outcome==='clear'){ essGain+=BAL.CLEAR_ESS+BAL.CLEAR_ESS_ERA*eraNow(); }                            // v2.0 魔核を討たれた日(v3.1 世代ほど)
  META.essence+=essGain; META.orbs+=orbGain;
  META.runs++;
  META.life.dmg+=Math.round(B.dmgDealt); META.life.ail+=B.ailCount; META.life.kills+=B.kills;
  META.life.climax=(META.life.climax||0)+B.climaxN;
  META.life.bestClimax=Math.max(META.life.bestClimax||0, B.climaxN);
  if(outcome!=='capture'){ META.life.survive=(META.life.survive||0)+1; META.streak=(META.streak||0)+1; }
  // 呪いは一日ごとに薄れる(今日新たに受けた呪いは下で上書き)
  let newCurse=null;
  const oldCurse=META.curse?Object.assign({},META.curse):null;
  if(META.curse){ META.curse.left--; if(META.curse.left<=0) META.curse=null; }
  if(outcome==='capture'){
    META.streak=0;
    const by=B.capturedBy||'default', cz=B.captureCause||'hp';
    META.life.capBy[by]=(META.life.capBy[by]||0)+1;
    META.life.capCause[cz]=(META.life.capCause[cz]||0)+1;
    codexMark(by,'capture');
    learn(by,'cap');
    // 抵抗の意志: 負けるたびに固くなる(60秒以内の早い敗北ほど)
    META.lumina.will=Math.min(BAL.WILL_CAP,(META.lumina.will||0)+BAL.WILL_CAP_GAIN+(B.time<60?BAL.WILL_FAST_GAIN:0));
    // ボス敗北の呪い: とどめがボス、またはボスの影響(直前8秒)の中で倒れた
    const bm=B.bossMark;
    const bossId=(MONSTERS[by]&&MONSTERS[by].boss)?by:((bm&&B.time-bm.t<8&&MONSTERS[bm.id]&&MONSTERS[bm.id].boss)?bm.id:null);
    if(bossId && BOSS_CURSES[bossId]) newCurse={id:bossId, left:BAL.CURSE_DAYS};
  }
  if(outcome!=='capture') META.lumina.will=Math.max(0,(META.lumina.will||0)-BAL.WILL_SURVIVE_LOSS);
  if(newCurse) META.curse=newCurse;
  // 夜明け: ルミナはコインを数え、自分を強化する(ヴァンサバのコイン強化に相当)
  const coinGain=Math.round(B.heroCoins+(outcome!=='capture'?40:10));
  META.lumina.coins+=coinGain;
  const shopped=luminaShop();
  META.rot.dmg+=Math.round(B.dmgDealt); META.rot.ail+=B.ailCount; META.rot.battles++;
  if(outcome==='capture'){ META.captures++; META.rot.captures++; }
  if(outcome==='capture' && (!META.best || B.time<META.best.time)){
    META.best={time:B.time, gen:META.gen.idx, battle:gb+1};
  }
  META.gen.battle++;   // 潜行の日数
  META.run.day=(META.run.day||1)+1;
  for(const h of B.heroes) snapRunHero(h);   // v2.1 引き継ぎ(下のリセットで消えることがある) / v3.0 全員
  // v2.0 潜行の進み: 捕まれば同じ階層に再挑戦、二連敗で入口へ(世代が変わる)。降りれば次の階層。魔核を討てば目的達成→組み替わる
  let rotReset=false, decay=null, runNote='';
  const twoP=B.heroes.length>1, V30E=(typeof STORY_V30!=='undefined')?STORY_V30:{};   // v3.0 二人版の結末・リセット
  const floorBefore=META.run.floor||1;
  if(outcome==='capture'){
    META.run.fails=(META.run.fails||0)+1;
    if(META.run.fails>=BAL.RUN_FAILS_RESET){ runReset(); rotReset=true; decay=luminaDecay(); runNote='reset'; }
    else runNote='retry';
  }else if(outcome==='descend'){
    META.run.fails=0; META.run.floor=Math.min(openFloors(),floorBefore+1); META.run.deepest=Math.max(META.run.deepest||1,META.run.floor); runNote='descend';
    if(B.heroes.some(h=>h.out)) META.run.leftBehind=true;   // v3.0 一人を置いて降りた
  }else if(outcome==='clear'){
    META.run.clears=(META.run.clears||0)+1; META.era=(META.era|0)+1; runReset(); rotReset=true; decay=luminaDecay(); runNote='clear';   // v3.0 深淵が組み替わる(世代+1: 階層が増え、魔核が太る)
  }
  // v3.1 参戦の判定: 深淵が一度組み替わった後(世代≥1)に二連敗で入口へ戻された朝、次のヒロインが来る(保険: リセット3回 / 一人のまま世代4)
  const joinId=partyJoinCheck(runNote);
  saveMeta();
  bgmStop();
  G.mode='result';
  UI.showResult({outcome, essGain, orbGain, rotReset,
    time:B.time, kills:B.kills, dmg:Math.round(B.dmgDealt), ail:B.ailCount,
    heroLv:B.hero.level, capturedBy:B.capturedBy, cause:B.captureCause, climax:B.climaxN,
    coins:coinGain, shop:shopped, decay,
    will:META.lumina.will||0, willUp:outcome==='capture', shrines:B.shrineGot, gateT:B.gateT, used:B.used, eventsN:B.eventsN, eventsDone:B.eventsDone,
    floor:B.floor, floorBefore, runNote, fails:META.run.fails, nextFloor:META.run.floor, seals:Object.keys(B.seals).length,
    storyLines: outcome==='clear'?storyClearLines(twoP)
      :(runNote==='reset'?(((twoP&&V30E.reset)?V30E.reset:STORY.reset).concat((joinId&&V30E.party&&V30E.party.joinHint&&V30E.party.joinHint.length)?[''].concat(V30E.party.joinHint):[])):(outcome==='capture'&&B.captures&&B.captures.length>1&&typeof STORY_V30!=='undefined'&&STORY_V30.party&&STORY_V30.party.bothCaptured?STORY_V30.party.bothCaptured:(outcome==='descend'&&B.heroes.some(h=>h.out)&&typeof STORY_V30!=='undefined'&&STORY_V30.party&&STORY_V30.party.leftBehind?STORY_V30.party.leftBehind:null))), newCurse:newCurse?BOSS_CURSES[newCurse.id]:null,   // v3.1 一人版の結末 / 合流の予兆
    join:joinId?HEROES[joinId].name:null, joinWhy:META.run.joinWhy||'',
    captures:B.captures, leftBehind:B.heroes.filter(h=>h.out).map(h=>h.name),
    carryLv:(META.run.hero&&META.run.hero.level)||0,
    curseGone:(oldCurse&&!META.curse&&!newCurse)?BOSS_CURSES[oldCurse.id]:null});
}

/* v2.0 潜行のリセット: 入口へ戻り、世代が変わる(経験・知識を失う。手記と永続強化は残る) */
function runReset(){
  META.run.floor=1; META.run.fails=0; META.run.day=1; META.run.hero=null; META.run.heroes={}; META.run.seen={}; META.run.bossSeen=false;   // v2.1 引き継ぎも消える / v2.4 見た範囲とボスの記憶も
  META.gen.battle=0; META.gen.idx++;
  META.rot={dmg:0, ail:0, captures:0, battles:0};
  META.gen.know={}; META.gen.zoneKnow={}; META.gen.trapKnow={};   // 世代が変わると、覚えたことも忘れる(手記に書いた分だけ残る)
  { const o=META.run.storySeen||{}; const n={prologue:o.prologue, join:o.join}; for(const k in o) if(k.startsWith('loop')) n[k]=o[k]; META.run.storySeen=n; }   // 階層の導入はまた出る(序章・合流・世代の朝は出ない)
}
/* v3.1 一日のエッセンスの逓減: 素の合計 x → SOFT·ln(1+x/SOFT)。少ない日はほぼそのまま、多い日は頭打ち気味 */
function essSoft(x,soft){ const S=(soft===undefined?BAL.ESS_SOFT:soft)||0; x=Math.max(0,x||0); return S>0?S*Math.log(1+x/S):x; }   // soft を渡せばオーブにも使える
/* v3.1 参戦: 出撃の並びにヒロインを加え、翌朝の合流の場面(party.join / joinLate)を出す。META.party.joined に記録 */
function partyJoin(id,why){
  if(!HEROES[id]) return false; META.party=META.party||{roster:['lumina'],joined:{},resets:0};
  if(META.party.roster.includes(id) || META.party.roster.length>=PARTY_MAX) return false;
  META.party.roster.push(id); META.party.joined[id]={era:eraNow(), gen:META.gen.idx, runs:META.runs, why:why||''}; META.party.resets=0;
  delete META.run.storySeen.join; META.run.joinWhy=why||'';   // 合流の朝はまだ出ていない
  return true;
}
/* v3.1 参戦の判定(夜明けの処理)。PARTY_JOIN の並びで、まだ居ない最初のヒロインについて:
   二連敗リセットの朝 → 世代≥minEra なら来る(保険: 前の合流からのリセット回数≥resets)。魔核を討った朝 → 世代≥lateEra なら来る(一人で討ち続けた変奏) */
function partyJoinCheck(runNote){
  if(typeof PARTY_JOIN==='undefined') return null; META.party=META.party||{roster:['lumina'],joined:{},resets:0};
  const rule=PARTY_JOIN.find(j=>HEROES[j.id]&&!META.party.roster.includes(j.id)); if(!rule) return null;
  if(runNote==='reset'){ META.party.resets=(META.party.resets||0)+1; if((META.era|0)>=rule.minEra || META.party.resets>=rule.resets){ if(partyJoin(rule.id,'reset')) return rule.id; } }
  else if(runNote==='clear' && (META.era|0)>=rule.lateEra){ if(partyJoin(rule.id,'late')) return rule.id; }
  return null;
}
/* v3.1 魔核を討った日の物語: 二人なら世代ごとの結末(coreDown)+二人版の結末、一人なら一人版(coreDownSolo: 初回/再び)+従来の結末の続き */
function storyClearLines(twoP){
  const V=(typeof STORY_V30!=='undefined')?STORY_V30:null, k=Math.max(0,(META.era|0)-1);   // era はもう +1 されている
  if(twoP){ const cd=(V&&V.era&&V.era.coreDown&&V.era.coreDown.length)?V.era.coreDown[Math.min(V.era.coreDown.length-1,k)]:[]; return cd.concat((V&&V.ending)?V.ending:STORY.ending); }
  const solo=V&&V.era&&V.era.coreDownSolo; const cs=solo?(k===0?solo.first:(solo.again||solo.first)):null;
  if(cs&&cs.length){ const tail=(k>0 && V.era.endingSoloAgain && V.era.endingSoloAgain.length)?V.era.endingSoloAgain:STORY.ending.slice(1); return cs.concat(tail); }   // 一人版は結末の1行目(光が届いた…)を置き換える。二度目以降は短い結び(街の朝の場面は一度きり)
  return STORY.ending;
}
/* v3.1 組み替わった後の朝: 二人版 loopIntro / 一人版 loopIntroSolo(初回/再び)。無ければ null */
function storyLoopIntro(n){
  const V=(typeof STORY_V30!=='undefined')?STORY_V30:null; if(!V||!V.era) return null;
  if(n>1) return (V.era.loopIntro&&V.era.loopIntro.length)?V.era.loopIntro:null;
  const s=V.era.loopIntroSolo; if(!s) return null; const a=((META.era|0)<=1)?s.first:(s.again||s.first); return (a&&a.length)?a:null;
}
/* 世代の夜明け: 彼女の自己強化は BAL.LUMINA_DECAY 段ぶん薄れる。高い系統から1段ずつ。
   初期値に戻るわけではない——世代を跨ぐごとに、土台が少しずつ上がっていく */
function luminaDecay(){
  const U=META.lumina.upg, out=[];
  for(let i=0;i<BAL.LUMINA_DECAY;i++){
    let best=null, br=0;
    for(const id in LUMINA_UPG){ if((U[id]||0)>br){ br=U[id]; best=id; } }
    if(!best) break;
    U[best]--; out.push(LUMINA_UPG[best].name);
  }
  return out;
}

/* ================= 図鑑の記録(彼女の手記が増えていく条件) =================
   seen=見かけた / met=その種族に何かされた / climax=その種族が絡んだ絶頂 / capture=その種族に敗北 */
function codexOf(id){
  if(!META.codex[id]) META.codex[id]={seen:0,met:0,climax:0,capture:0,kills:0};
  return META.codex[id];
}
function codexMark(id,key,n){
  if(!id||!MONSTERS[id]||MONSTERS[id].item) return;
  const c=codexOf(id); c[key]=(c[key]||0)+(n||1);
  if(key==='met'&&G.B) G.B.recentMet[id]=G.B.time;
}
/* 「何かされた」は種族ごとに1.5秒に1回まで数える */
function codexMet(id){
  const B=G.B; if(!B||!id) return;
  const last=B.metCd[id]; if(last!==undefined && B.time-last<1.5) return;
  B.metCd[id]=B.time; codexMark(id,'met');
  learn(id,'met');
}
/* v2.1 マップ台詞: LINES(lines.js) から1行選んで吹き出しに。同じ種類は cd 秒あける。無ければ fallback。
   エロ状態が乗っている間は平常の台詞(prio<=1)は出さない(台詞の主導権はエロ側) */
function sayLine(path,prio,cd,fallback){
  const B=G.B; if(!B) return false; const p=B.hero; prio=prio||0; cd=(cd===undefined)?6:cd;
  B.lineCd=B.lineCd||{}; const ck=p.id+':'+path; const last=B.lineCd[ck]; if(last!==undefined && B.time-last<cd) return false;
  // v3.0 話者の声の表: フレイラは LINES_F(無いキーは fallback)。ルミナは LINES
  const T=(p.id==='freila'&&typeof LINES_F!=='undefined')?LINES_F:null;
  const txt=(T?lineOf(path,T):lineOf(path))||fallback; if(!txt) return false;
  if(prio<=1){ const ero=p.heatLv>0||p.aphro>=45||restraintCount(p)>0||p.climaxT>0||p.pinned||!!p.charmBind||p.charms.some(c=>c.lv>0); if(ero) return false; }
  B.lineCd[ck]=B.time; heroBubble(p,txt,prio>=2,prio); return true;
}
/* v2.1 諦め: 目標(品・箱・ハート・ジェム・場所・資源。目当ての ref か、その物自体)を GIVEUP_CD 秒のあいだ候補から外す */
const giveUpKey=t=>(t&&typeof t==='object')?(t.ref||t):t;
function gaveUp(t){ const B=G.B; if(!B||!B.giveUp||!t) return false; const u=B.giveUp.get(giveUpKey(t)); return u!==undefined && B.time<u; }
function giveUpOn(t){ const B=G.B; if(!B||!B.giveUp||!t) return;
  if(t.kind==='rescue' || t.kind==='wait' || (t.out && t.captive)) return;   // v3.2 捕まった仲間だけは諦めない(嫌な地形で足がすくんでも、目当てからは外さない)
  B.giveUp.set(giveUpKey(t),B.time+BAL.GIVEUP_CD); }
/* ================= 学習(世代内の知識) =================
   何かされた回数(met)と敗北(cap)で 未知→認識→理解→熟知。世代リセットで忘れる。
   手記を二度書いた種族(図鑑の追記二以上)は、次の世代でも一段だけ覚えている */
function genKnow(id){ const K=META.gen.know||(META.gen.know={}); return K[id]||(K[id]={met:0,cap:0}); }
function knowLv(id){
  if(!MONSTERS[id]) return 0;
  const k=(META.gen.know||{})[id]||{met:0,cap:0};
  let lv=(k.met>=1?1:0)+(k.met>=BAL.KNOW_MET2?1:0)+((k.cap>=1||k.met>=BAL.KNOW_MET3)?1:0);
  if(typeof codexStage==='function' && codexStage(id)>=2) lv+=1;
  return Math.min(3,lv);
}
function learn(id,kind){
  if(!MONSTERS[id]) return;
  const before=knowLv(id); const k=genKnow(id);
  if(kind==='cap') k.cap++; else k.met++;
  const after=knowLv(id);
  if(after>before && G.B && G.mode==='battle'){
    const h=G.B.hero, m=MONSTERS[id];
    const nm=(typeof CODEX!=='undefined'&&CODEX[id]&&CODEX[id].note&&CODEX[id].note.title)||m.name;   // 手記の見出し名(ゲイザーは「目玉のやつ」)
    floatTxt(h.x,h.y-84,'学習: '+nm+' → '+KNOW_NAMES[after],'#8fd3ff',11,1.6);
    if(after>=2 && (SPEC_THREAT[id]||0)>=3) heroBubble(h,pickRand(['あれは……ぜったい、よける','つぎは、あれから、さきに……']),false,1);
  }
}
/* 絶頂に絡んだ種族: 今ついている/直前5秒に何かしてきた種族 */
function codexClimax(){
  const B=G.B, h=B.hero, ids=new Set();
  for(const sl of attachedSlots(h)){ const m=h.limbs[sl].mon; if(m) ids.add(m.id); }
  for(const sl of suckSlots(h)){ const m=h.suckers[sl].mon; if(m) ids.add(m.id); }
  if(h.pinBy) ids.add(h.pinBy.id);
  if(h.charmBind&&h.charmBind.mon) ids.add(h.charmBind.mon.id);
  for(const id in B.recentMet){ if(B.time-B.recentMet[id]<5) ids.add(id); }
  let n=0;
  for(const id of ids){ if(n++>=4) break; codexMark(id,'climax'); }
}

/* 夜明けの自己強化: 安い順に最大4件まで自動購入 */
function luminaShop(){
  const out=[];
  const U=META.lumina.upg;
  for(let i=0;i<4;i++){
    let best=null, bc=1e9;
    for(const id in LUMINA_UPG){
      const r=U[id]||0;
      if(r>=LUMINA_UPG[id].max) continue;
      const c=luminaUpCost(id,r);
      if(c<bc){ bc=c; best=id; }
    }
    if(!best || META.lumina.coins<bc) break;
    META.lumina.coins-=bc;
    U[best]=(U[best]||0)+1;
    out.push(LUMINA_UPG[best].name+' '+genNum(U[best]));
  }
  return out;
}

/* ================= 状態付与 ================= */
/* 台詞の優先度:
   0=平常のおしゃべり / 1=状態の変化 / 2=エロ状態の台詞 / 3=絶頂・拘束の核心台詞。
   高優先の台詞は言い終わるまで低優先に潰されない(あっちこっち切り替わらない) */
function heroBubble(h,txt,force,prio){
  prio=prio||0;
  const cur=h.bubbleT>0?(h.bubblePrio||0):-1;
  if(prio<cur) return;
  if(prio===cur && !force && h.bubbleT>0.5) return;
  if(!force && prio===0 && h.bubbleCd>0) return;
  h.bubble=txt;
  h.bubbleT=prio>=2?2.6:1.7;
  h.bubbleCd=0.9;
  h.bubblePrio=prio;
}
function awardAil(type){
  const B=G.B;
  const rt=B.ailRateT[type]||0;
  if(B.time-rt>2){
    B.ailRateT[type]=B.time; B.orbFrag+=BAL.ORB_PER_AIL; B.ailCount++;
    META.life.ailBy[type]=(META.life.ailBy[type]||0)+1;
  }
}
/* 魅了(v0.4): 種族別・レベル制。接触のたびその種族への段階が上がる。
   同じ種族ならどの個体にも効果が及ぶ。
   Lv1=与ダメ減 / Lv2=+無意識に寄る発作 / Lv3=+接触で魅了拘束 */
/* 魅了(v1.5): 触れるたび即段階、ではなく、ゲージが溜まって閾値を越えたら一段上がる */
function applyCharm(mon, amount){
  const h=G.B.hero;
  if(!mon||mon.dead) return;
  const res=1+0.22*(h.resist.charm||0);
  let c=charmEntry(h,mon.id);
  if(!c){
    c={id:mon.id, lv:0, g:0, t:0, driftCd:BAL.CHARM_DRIFT_CD*rand(0.5,0.9)};
    h.charms.push(c);
  }
  const add=(amount===undefined?BAL.CHARM_SLUG:amount)*h.sense/res*(1-0.015*(h.will||0));
  c.g=(c.g||0)+add;
  c.t=BAL.CHARM_DUR*h.sense/res;
  codexMet(mon.id);
  if(c.g>=BAL.CHARM_GAUGE && c.lv<3){
    c.g-=BAL.CHARM_GAUGE; c.lv++;
    h.resist.charm=(h.resist.charm||0)+1;
    heroBubble(h,[
      '','え…なんで、めが…はなせな…',
      'だめ…みちゃだめ、なのに…',
      'このこ達の、そばに…いたい……',
    ][c.lv],true,2);
    S.charm();
    awardAil('charm');
  }else{
    if(Math.random()<0.5) heroBubble(h,pickRand(['……あ。いま、ちょっと、めが……','なんだろ、この、かんじ……','みつめちゃ、だめ……']),false,1);
    parts(h.x,h.y-30,3,['#ffb3cf','#fff'],50,0.5);
  }
  if(c.lv>=3) c.g=Math.min(c.g,BAL.CHARM_GAUGE*0.99);
}
function removeCharm(h,id){
  const i=h.charms.findIndex(c=>c.id===id);
  if(i>=0) h.charms.splice(i,1);
  if(h.charmDrift&&h.charmDrift.id===id) h.charmDrift=null;
}
/* 媚薬=敏感化: 快感の入りを増幅する下地 */
function applySensit(amount){
  const h=G.B.hero;
  const before=sensLvOf(h);
  h.sensit=clamp(h.sensit+amount*h.sense,0,100);
  const after=sensLvOf(h);
  if(after>before){
    heroBubble(h,['','なんか、あまいにおい…','はだが、ひりひりする…','ふれられただけで、こんな…'][after],false,1);
    awardAil('sens');
  }
}
/* 快感: 敏感化で増幅され、100で発情レベルが上がる */
function applyPleasure(amount){
  const h=G.B.hero;
  if(h.refractT>0) amount*=BAL.REFRACT_MULT;   // 不応期: 達した直後は入りが鈍い
  amount*=1+BAL.CREST_AMP*(h.crestLv||0);      // 淫紋: 入りが増す
  amount*=1+(h.curseAmp||0);                    // 呪い『樹液の余熱』
  if(h.watchedT>0) amount*=1+BAL.WATCH_AMP;    // 視姦: 見られていると熱が逃げない
  if(h.freezeT>0){ h.frozenAcc+=amount; return; }   // 時間停止: 止まっている間は溜まるだけ
  const before=h.aphro;
  h.aphro=clamp(h.aphro+amount*h.sense*(1+BAL.SENSIT_AMP*sensLvOf(h)),0,100);
  if(h.denyT>0){
    // 寸止め: 99で栓をされる。溢れた分は身体に溜まる
    if(h.aphro>=99){ h.aphro=99; if(before>=99 && amount>0 && Math.random()<0.25) heroBubble(h,pickRand(['いか、せて……ちがう、いかせないで……','とまってる、のに……あつい、のが……','ぬけない……なんで、いけな……']),false,3); }
    return;
  }
  if(h.aphro>=100 && h.climaxT<=0) enterClimax();
}
/* 寸止め(絶頂禁止): 切れた瞬間、快感が高ければ深い絶頂が来る */
function applyDeny(src){
  const h=G.B.hero;
  if(h.climaxT>0) return;
  if(src&&src.boss) G.B.bossMark={id:src.id, t:G.B.time};
  h.denyT=BAL.DENY_DUR; h.denySrc=src?src.id:null;
  heroBubble(h,pickRand(['……あ、れ。なんで、とまっ……','からだの、なかで……せんを、され……','いきそう、なのに……いけな……い……?']),true,3);
  parts(h.x,h.y-8,10,['#ff5d9e','#fff'],90,0.6);
  sfx(700,300,0.3,'sine',0.05);
  awardAil('deny');
  if(src) codexMet(src.id);
}
function releaseDeny(){
  const h=G.B.hero;
  h.denyT=0;
  if(h.denySrc) codexMet(h.denySrc);
  if(h.aphro>=BAL.DENY_DEEP_TH && h.climaxT<=0){
    h.deepClimax=true;
    h.aphro=100;
    heroBubble(h,'——ぬ、けた……あ、あ、まって、これ、ふかい——っ!',true,3);
    enterClimax();
  }else heroBubble(h,'……はぁ、はぁ……なに、いまの……',false,2);
  h.denySrc=null;
}
/* ================= 絶頂 =================
   快感100で絶頂。脚が止まり、痙攣して動けない。終わると発情が一段深まる */
function enterClimax(){
  const B=G.B, h=B.hero;
  if(h.climaxT>0) return;
  h.climaxT=BAL.CLIMAX_DUR*(h.deepClimax?BAL.DEEP_MULT:1);
  h.climaxPhase=0;
  h.vx=0; h.vy=0;
  h.squirted=h.deepClimax||Math.random()<Math.min(0.95, BAL.SQUIRT_BASE+0.2*h.heatLv+0.12*sensLvOf(h));
  // 見られながらの絶頂は「撮影」される
  if(h.watchedT>0){ B.filmed++; META.life.filmed=(META.life.filmed||0)+1; codexMark('eye','climax'); floatTxt(h.x,h.y-70,'撮影された','#c98cff',11,1.4); }
  B.climaxN++;
  codexClimax();
  if(h.inMusk && h.heatLv>0 && h.muskCond>=8) conditionMusk();   // 雄臭の雲の中、発情したまま達すると匂いと結びつく
  heroBubble(h,'や、だめ、いま……きちゃ……あ、ぁあああっ——!',true,3);
  if(B.climaxN===1) setBanner('絶頂','ルミナは立っていられない','#ff5d9e');
  if(!h.pinned && !h.charmBind){
    B.pinScene=sceneForHero(B.hero,'climax','default'); B.pinSceneHi=B.ci;
    B.pinSceneIdx=0; B.pinSceneT=0;
  }
  parts(h.x,h.y-18,20,['#ff9ec2','#ff5d9e','#fff'],150,0.8);
  sfx(620,980,0.5,'sine',0.08);
  S.charm();
  G.shake=Math.min(8,G.shake+4);
  awardAil('climax');
}
function climaxTick(dt){
  const B=G.B, h=B.hero;
  h.climaxT-=dt;
  if(!h.pinned && !h.charmBind){
    if(B.pinSceneHi===B.ci) B.pinSceneT+=dt;
    if(B.pinScene && B.pinSceneT>2.6){ B.pinSceneT=0; B.pinSceneIdx++; }
  }
  const el=BAL.CLIMAX_DUR*(h.deepClimax?BAL.DEEP_MULT:1)-h.climaxT;
  if(h.climaxPhase===0 && el>0.7){
    h.climaxPhase=1;
    // 絶頂はスタミナを大きく持っていく——連続絶頂はやがて力尽きる(深い絶頂はさらに)
    h.stamina=Math.max(0,h.stamina-BAL.CLIMAX_STAM_COST*(h.deepClimax?1.8:1));
    checkStaminaCollapse();
    if(G.mode!=='battle'&&G.mode!=='levelup') return;
    if(h.squirted){
      spawnStain(h.x, h.y+2);
      heroBubble(h,'やだ、でて……とまんない……ぁ……っ',true,3);
      parts(h.x,h.y-4,16,['#bcd4ff','#e8f0ff'],130,0.6);
      sfx(500,180,0.3,'sine',0.05);
    }else{
      heroBubble(h,'びくっ、びくって……とまら、な……っ',true,3);
    }
  }
  if(h.climaxPhase===1 && el>2.3){
    h.climaxPhase=2;
    heroBubble(h,'……は……ぁ……あし、ちから……はいらな……',true,3);
  }
  if(Math.random()<dt*6) parts(h.x+rand(-12,12),h.y-rand(4,26),1,['#ffb3cf','#fff'],60,0.6);
  if(h.climaxT<=0){
    h.climaxT=0;
    h.refractT=BAL.REFRACT_T;
    if(!h.pinned && !h.charmBind) if(B.pinSceneHi===B.ci) B.pinScene=null;
    heatUp();
    if(h.deepClimax){ h.deepClimax=false; heatUp(); }   // 深い絶頂は発情を二段深める
  }
}
/* 潮の染み: 地面にしばらく残る */
function spawnStain(x,y){
  const B=G.B;
  if(B.stains.length>30) B.stains.shift();
  B.stains.push({x,y,r:rand(11,16),t:0,life:BAL.STAIN_LIFE,rot:rand(TAU),
    r2:rand(0.55,0.8)});
}
function heatUp(fromClimax){
  const h=G.B.hero;
  h.heatLv=Math.min(3,h.heatLv+1);
  h.heatT=BAL.HEAT_LV_DUR;
  if(fromClimax!==false) h.aphro=BAL.HEAT_AFTER;   // 絶頂経由の発情だけ快感の位置を戻す(雲・波からの発情は快感を動かさない)
  h.waveT=rand(2,4); h.waveDur=0;
  heroBubble(h,[
    '','あつい……へんに、なりそ…っ',
    'だめ、あたまの奥、とけ…ちゃ…',
    'もう…がまん、できな……っ',
  ][h.heatLv],true,2);
  if(h.heatLv>=2) setBanner('発情 Lv'+h.heatLv,'波が来るたび、彼女の脚が止まる','#ff5d9e');
  parts(h.x,h.y-20,14,['#ff9ec2','#ff5d9e'],120,0.7);
  sfx(520,860,0.4,'sine',0.07);
  awardAil('heat');
}

/* ================= 四肢拘束 ================= */
function freeSlotFor(kind, legFirst, armsOnly){
  const h=G.B.hero;
  const order = armsOnly ? shuffle(['armL','armR']) : ((kind==='tether'||legFirst) ? ['legL','legR','armL','armR'] : shuffle(LIMBS.slice()));
  for(const s of order){ if(!h.limbs[s]) return s; }
  return null;
}
function attachMonster(mon, kind, opt){
  const B=G.B, h=B.hero;
  opt=opt||{};
  const slot=freeSlotFor(kind, opt.legFirst, opt.armsOnly);
  if(!slot) return false;
  const needBase=(kind==='tether'?BAL.RIP_NEED_TETHER:BAL.RIP_NEED_CLING)*(opt.needMul||1);
  const need=needBase/(1+0.12*(h.resist.bound||0));
  h.limbs[slot]={mon, kind, need, r:opt.r||0, t:B.time};
  mon.state='attached'; mon.ti=G.B.ci; mon.limb=slot; mon.stun=0;
  codexMet(mon.id);
  h.resist.bound=(h.resist.bound||0)+1;
  heroBubble(h, pickRand(['からみついてる…っ!','はなれてっ…!','やだ、脚に…っ!']), true, 2);
  S.bind();
  parts(h.x,h.y-14,10,['#c98cff','#8458d8'],110,0.5);
  awardAil('bound');
  // スタミナが削れた状態での拘束 → 押し倒し
  if(!h.pinned && h.stamina<BAL.PIN_STAMINA_TH){
    enterPin(mon);
  }
  return true;
}
function detachLimb(slot, opt){
  const B=G.B, h=B.hero;
  const at=h.limbs[slot];
  if(!at) return;
  opt=opt||{};
  h.limbs[slot]=null;
  const mon=at.mon;
  if(mon && !mon.dead){
    // 同じ個体が別の肢も掴んでいる(粘獣王の呑み込みなど)なら、まだ離れない
    const heldSlot=LIMBS.find(sl=>sl!==slot && h.limbs[sl] && h.limbs[sl].mon===mon);
    if(heldSlot){ mon.limb=heldSlot; }
    else{
      mon.state = mon.id==='flower' ? 'open' : ((mon.id==='gtent'||mon.id==='core'||mon.id==='mouth'||mon.id==='sentinel') ? 'idle' : 'chase');
      mon.limb=null;
      const p=limbAnchor(h,slot);
      if(mon.id!=='flower' && mon.id!=='gtent' && mon.id!=='web' && mon.id!=='core' && mon.id!=='mouth' && mon.id!=='sentinel'){   // 据わった個体はその場から動かない
        mon.x=p.x+rand(-8,8); mon.y=p.y+rand(-4,4);
      }
    }
    if(opt.fling){
      mon.stun=1.2;
      mon.hp-=mon.maxHp*(mon.id==='core'?BAL.CORE_FLING:(mon.id==='sentinel'?0.08:(mon.boss?0.05:0.35)));   // ボスは振りほどかれても大きくは削れない(呑み込みで自滅しない)。v2.2 魔核は0.5%(根を千切っても心臓は削れない)、番兵は8%
      const a=rand(TAU);
      if(MONSTERS[mon.id].spd>0){ mon.x+=Math.cos(a)*30; mon.y+=Math.sin(a)*30; collideMap(mon,mon.r*0.75,canFly(mon.id)); }   // 据わった個体(魔核・口)は飛ばされない
      parts(mon.x,mon.y,8,['#fff','#c98cff'],140,0.5);
      if(mon.hp<=0) killEnemy(mon);
    }
  }
}
function limbAnchor(h,slot){
  const s=1.15;
  const off={armL:[-8,-21], armR:[8,-21], legL:[-3.5,-5], legR:[3.5,-5]}[slot];
  return { x:h.x+off[0]*s, y:h.y+off[1]*s };
}
function suckAnchor(h,slot){
  const s=1.15;
  const off={nipL:[-4.5,-23], nipR:[4.5,-23], clit:[0,-7]}[slot];
  return { x:h.x+off[0]*s, y:h.y+off[1]*s };
}
/* --- 吸液羽虫の吸い付き(四肢拘束とは別枠。拘束レベルを問わず付く) --- */
function attachSucker(mon){
  const B=G.B, h=B.hero;
  const free=SUCKS.filter(s=>!h.suckers[s]);
  if(!free.length) return false;
  const slot=free[(Math.random()*free.length)|0];
  h.suckers[slot]={mon, t:B.time, need:BAL.RIP_NEED_SUCK/(1+0.1*(h.resist.bound||0))};
  mon.state='attached'; mon.ti=G.B.ci; mon.suck=slot; mon.stun=0;
  codexMet(mon.id);
  heroBubble(h, pickRand(['ひゃんっ!? す、吸わないでっ…!','やっ、そんなとこ…っ!','はねおと…どこ——ひゃうっ!?']), true, 2);
  S.bind();
  parts(h.x,h.y-16,8,['#ff9d8a','#ffc2b0'],100,0.5);
  awardAil('suck');
  return true;
}
function detachSucker(slot, opt){
  const h=G.B.hero;
  const at=h.suckers[slot];
  if(!at) return;
  opt=opt||{};
  h.suckers[slot]=null;
  const mon=at.mon;
  if(mon && !mon.dead){
    mon.state='chase'; mon.suck=null;
    const p=suckAnchor(h,slot);
    mon.x=p.x+rand(-8,8); mon.y=p.y+rand(-4,4);
    mon.lvx=null; mon.lvy=null;
    if(opt.fling){
      mon.stun=1.2;
      mon.hp-=mon.maxHp*0.35;
      const a=rand(TAU);
      mon.x+=Math.cos(a)*34; mon.y+=Math.sin(a)*34; collideMap(mon,mon.r*0.75,canFly(mon.id));
      parts(mon.x,mon.y,6,['#fff','#ff9d8a'],130,0.5);
      if(mon.hp<=0) killEnemy(mon);
    }
  }
}
/* 最も古い拘束(四肢+吸い付きを通しで見る)。抵抗ゲージはこれを剥がす */
function oldestRestraint(h){
  let best=null, bs=null, bkind=null;
  for(const sl of LIMBS){
    const at=h.limbs[sl];
    if(at && (!best || at.t<best.t)){ best=at; bs=sl; bkind='limb'; }
  }
  for(const sl of SUCKS){
    const at=h.suckers[sl];
    if(at && (!best || at.t<best.t)){ best=at; bs=sl; bkind='suck'; }
  }
  return bs?{kind:bkind, slot:bs, at:best}:null;
}
function addStruggle(amount){
  const hh=G.B.hero;
  if(hh.freezeT>0) return;   // 時間停止中はもがけない
  const wf=0.02*(hh.will||0);                       // 抵抗の意志: 負けを重ねた分だけ、催眠の底でも手が動く
  if(hh.hypnoLv>=3){ if(wf<=0) return; amount*=wf; } // 催眠Ⅲ: 抵抗という考えが浮かばない(意志の分だけ残る)
  else if(hh.hypnoLv>=2) amount*=0.35+wf*0.5;
  amount*=(1+0.02*(hh.will||0))*(hh.curse==='vampi'?0.85:1);
  const h=G.B.hero;
  if(restraintCount(h)===0||h.pinned||h.charmBind) return;
  if(h.stamina<=0||h.climaxT>0) return;
  h.struggle+=amount*(h.heatLv>0?1-0.1*h.heatLv:1);
  const o=oldestRestraint(h);
  if(o && h.struggle>=o.at.need){
    h.struggle=0;
    const ease=1+0.09*(h.resist.bound||0);   // 振りほどきに慣れるほどスタミナ消費が軽くなる
    if(o.kind==='limb'){
      detachLimb(o.slot,{fling:true});
      h.stamina-=BAL.STAMINA_RIP_COST/ease;
    }else{
      detachSucker(o.slot,{fling:true});
      h.stamina-=BAL.SUCK_RIP_COST/ease;
    }
    heroBubble(h,'えいっ…!');
    sfx(300,700,0.15,'triangle',0.07);
    floatTxt(h.x,h.y-52,o.kind==='limb'?'ふりほどいた!':'ひきはがした!','#8fd3ff',11,1);
    checkStaminaCollapse();
  }
}
function checkStaminaCollapse(){
  const h=G.B.hero;
  if(h.stamina>0) return;
  h.stamina=0;
  if(h.charmBind){
    beginCapture(h.charmBind.mon,'charm');
  }else if(attachCount(h)>0||h.pinned||suckCount(h)>0){
    const o=oldestRestraint(h);
    beginCapture(h.pinBy||(o&&o.at.mon)||null,'stamina');
  }else{
    h.exhausted=true;
    heroBubble(h,'はぁ……はぁ……',true,2);
  }
}
/* --- 押し倒し --- */
function enterPin(mon){
  const B=G.B, h=B.hero;
  if(h.charmBind) releaseCharmBind(false);   // 押し倒しは魅了拘束を上書きする
  h.pinned=true; h.pinBy=mon||null;
  h.pinT=BAL.PIN_PULSE_T; h.pinEscape=0;
  h.vx=0; h.vy=0;
  let sid=mon?mon.id:'default';
  { const lh=h.lastHypno;   // 催眠Ⅱ以上で押し倒された時は、催眠の源(ゲイザー)の場面——抵抗しなかった理由はそこにある
    if(h.hypnoLv>=2 && lh && B.time-lh.t<25 && SCENES.pin[lh.id] && !(mon&&mon.boss)) sid=lh.id; }
  B.pinScene=sceneForHero(h,'pin', sid); B.pinSceneHi=B.ci;   // v3.0 押し倒された子の声で
  B.pinSceneIdx=0; B.pinSceneT=0;
  setBanner(h.name+'が押し倒された!','もがいて逃れろ——スタミナかHPが尽きれば敗北','#ff5d7a');
  heroBubble(h,h.id==='freila'?'……っ、どけ!':'はなれて……っ!',true,2);
  S.capture();
  G.shake=Math.min(9,G.shake+5);
  awardAil('pinned');
}
function pinTick(dt){
  const B=G.B, h=B.hero;
  h.pinT-=dt;
  if(B.pinSceneHi===B.ci) B.pinSceneT+=dt;
  if(B.pinScene && B.pinSceneT>2.6){ B.pinSceneT=0; B.pinSceneIdx++; }
  if(h.pinT<=0){
    h.pinT=BAL.PIN_PULSE_T;
    h.stamina-=BAL.PIN_PULSE_COST;
    h.pinEscape+=BAL.PIN_ESCAPE_GAIN*(h.heatLv>0?1-0.1*h.heatLv:1)*(h.climaxT>0?0.25:1)*(h.hypnoLv>=3?0.02*(h.will||0):(h.hypnoLv>=2?0.35+0.01*(h.will||0):1))*(1+0.02*(h.will||0))*(h.curse==='vampi'?0.85:1)*rand(0.85,1.15);   // 催眠Ⅱ+: もがかない(意志の分だけ残る)
    applyPleasure(BAL.PLEAS_PIN);
    parts(h.x+rand(-10,10),h.y-rand(4,22),3,['#fff','#c98cff'],90,0.4);
    // 絡みつき中のモンスターがじわじわ削る(貫通)
    for(const sl of attachedSlots(h)){
      const m=h.limbs[sl].mon;
      if(m&&!m.dead) hurtHero(Math.max(0.6,m.dmg*0.3), m, {pierce:true, quiet:true, noKb:true});
    }
    checkStaminaCollapse();
    if(G.mode!=='battle'&&G.mode!=='levelup') return;
    if(h.pinEscape>=100){
      h.pinned=false; h.pinBy=null; h.pinEscape=0; h.struggle=0;
      for(const sl of attachedSlots(h)) detachLimb(sl,{fling:true});
      h.ifr=1.2;
      heroBubble(h,'まだ……まけないっ!',true,2);
      setBanner('振りほどいた!',h.name+'は立ち上がった','#8fd3ff');
      if(B.pinSceneHi===B.ci) B.pinScene=null;
    }
  }
}
/* --- 魅了拘束(魅了Lv3で自分から縋りつく特殊拘束) --- */
function enterCharmBind(mon){
  const B=G.B, h=B.hero;
  if(h.pinned||h.charmBind) return;
  h.charmBind={mon};
  h.charmBindT=BAL.CHARM_BIND_PULSE;
  h.charmSanity=0;
  h.charmDrift=null;
  h.vx=0; h.vy=0;
  mon.stun=0;
  B.pinScene=sceneForHero(B.hero,'charmbind', mon.id); B.pinSceneHi=B.ci;
  B.pinSceneIdx=0; B.pinSceneT=0;
  setBanner('魅了拘束!','ルミナは自分から縋りついた——正気に戻れば振りほどける','#ff86b3');
  heroBubble(h,'あったかい……ちがう、これ、ちがうのに……',true,3);
  S.capture();
  awardAil('charmbind');
}
function releaseCharmBind(sane){
  const B=G.B, h=B.hero;
  if(!h.charmBind) return;
  const mon=h.charmBind.mon;
  h.charmBind=null; h.charmSanity=0;
  if(B.pinSceneHi===B.ci) B.pinScene=null;
  if(sane && mon && !mon.dead){
    // 我に返っても、惚れた記憶は一段しか薄れない(魅了は簡単には解けない)
    const c=charmEntry(h,mon.id);
    if(c){ c.lv--; c.t=BAL.CHARM_DUR*0.8; if(c.lv<=0) removeCharm(h,mon.id); }
    h.resist.charm=(h.resist.charm||0)+1;
    mon.stun=1.2;
    mon.hp-=mon.maxHp*0.35;
    const a=rand(TAU);
    mon.x+=Math.cos(a)*30; mon.y+=Math.sin(a)*30; collideMap(mon,mon.r*0.75,canFly(mon.id));
    parts(mon.x,mon.y,8,['#fff','#ffb3cf'],140,0.5);
    if(mon.hp<=0) killEnemy(mon);
    h.ifr=1.2;
    heroBubble(h,'——はっ!? わ、わたし、なにをっ…!?',true,3);
    setBanner('正気に戻った!','ルミナは我に返り、振りほどいた','#8fd3ff');
  }
}
function charmBindTick(dt){
  const B=G.B, h=B.hero;
  const mon=h.charmBind.mon;
  if(B.pinSceneHi===B.ci) B.pinSceneT+=dt;
  if(B.pinScene && B.pinSceneT>2.6){ B.pinSceneT=0; B.pinSceneIdx++; }
  if(!mon||mon.dead||mon.dormant){
    releaseCharmBind(false);
    heroBubble(h,'……はっ!? いまの、なに…',true);
    return;
  }
  applyPleasure(BAL.CHARM_BIND_PLEAS*dt);
  if(Math.random()<dt*3) parts(h.x+rand(-14,14),h.y-rand(8,30),1,['#ffb3cf','#ff86b3'],50,0.7);
  h.charmBindT-=dt;
  if(h.charmBindT<=0){
    h.charmBindT=BAL.CHARM_BIND_PULSE;
    h.stamina-=BAL.CHARM_BIND_STAM;
    h.charmSanity+=BAL.CHARM_BIND_SANITY*(h.heatLv>0?0.75:1)*(h.climaxT>0?0.25:1)*rand(0.85,1.15);
    checkStaminaCollapse();
    if(G.mode!=='battle'&&G.mode!=='levelup') return;
    if(h.charmSanity>=100) releaseCharmBind(true);
  }
}

/* ================= 状態tick ================= */
/* ================= v1.3: 催眠Lv・自慰・雄臭 ================= */
function applyHypno(src){
  if(src&&G.B) G.B.hero.lastHypno={id:src.id, t:G.B.time};
  const h=G.B.hero, B=G.B;
  if(src&&src.boss) B.bossMark={id:src.id, t:B.time};
  if(src) codexMet(src.id);
  h.dazeT=Math.max(h.dazeT,1.2);
  if(h.hypnoLv>=3){ h.hypnoT=BAL.HYPNO_LV_DUR; parts(h.x,h.y-20,8,['#b46cff','#fff'],90,0.5); return; }
  // 催眠ゲージ: Ⅰは一発で入り、Ⅱは2回、Ⅲは3回の閃光が要る。抵抗の意志の分だけ入りが鈍る
  const gain=BAL.HYPNO_GAIN[Math.min(2,h.hypnoLv)]*(1-0.015*(h.will||0));
  h.hypnoG=(h.hypnoG||0)+gain;
  if(h.hypnoG<100){
    heroBubble(h,pickRand(['……あ、ひかっ……','……いま、なにか……','……なんだろ、め、が……']),false,2);
    parts(h.x,h.y-20,8,['#b46cff','#fff'],90,0.5);
    sfx(1200,600,0.3,'sine',0.04);
    return;
  }
  h.hypnoG-=100;
  h.hypnoLv=Math.min(3,h.hypnoLv+1); h.hypnoT=BAL.HYPNO_LV_DUR;
  h.dazeT=Math.max(h.dazeT,2.0);
  applyPleasure(4);
  // 催眠は本人に自覚されない——「何かが光った」以上のことは言えない
  heroBubble(h,['','……あ。いま、なにか、ひかっ……','……なんだっけ。なにを、してたんだっけ……','……'][h.hypnoLv]||'……',true,3);
  parts(h.x,h.y-20,14,['#b46cff','#fff'],120,0.6);
  sfx(1200,300,0.5,'sine',0.06);
  G.shake=Math.min(6,G.shake+2);
  setBanner('催眠 '+ROMANS[h.hypnoLv], ['','判断が鈍る','拘束に抵抗しなくなる','その場で自分を慰めはじめる'][h.hypnoLv], '#b46cff');
  awardAil('hypnolv');
}
/* 照射触手: 身体の準備を待たずに達してしまう */
function forcedClimax(src){
  const h=G.B.hero;
  if(h.climaxT>0) return;
  if(src) h.lastBeam={id:src.id, t:G.B.time};   // 効いた照射だけを敗北の帰属に使う
  h.denyT=0; h.aphro=100;
  heroBubble(h,'——っ!? なに、いま、あたっ……ぁ、あ、うそ、いく、いっ——',true,3);
  awardAil('beam');
  if(src) codexMet(src.id);
  enterClimax();
}
/* 雄臭への発情: 匂いと快感が結びつく(永続の性癖) */
function conditionMusk(){
  const B=G.B, h=B.hero;
  if(h.muskDone) return;
  h.muskDone=true;
  const lv=Math.min(TRAITS.musk.max,(META.traits.musk||0)+1);
  if(lv===(META.traits.musk||0)) return;
  META.traits.musk=lv;
  setBanner('性癖が刻まれた — '+TRAITS.musk.name+' '+ROMANS[lv], '雄の臭いと快感が、結びついてしまった', '#8fd36a');
  heroBubble(h,pickRand(['……くさい。くさい、はず、なのに……','この、におい……なんで、あつく……']),true,3);
  awardAil('musk');
  codexMark('goblin','met');
}
/* ゲイザー種の「眼」を列挙(単眼/多眼を同じ形で扱う) */
function gazerEyes(e){
  if(e.id==='gazer') return [{x:e.x, y:e.y-e.r, ang:e.gzAng||0, r:BAL.GAZE_R, spread:BAL.GAZE_ANG, state:e.gzState, t:e.gzT, tmax:BAL.GAZE_AIM}];
  if(e.id==='bossgazer' && e.eyes){
    return e.eyes.map((ey,i)=>bossEyeSpec(e,ey,i));
  }
  return [];
}
/* ボスの眼の扇: 描画(drawSightSectors)・回避(aiDecide)・当たり(eyeCycle)が同じ幾何を使う——半径は GAZE_R+GAZE_BOSS_EXTRA、横幅は通常ゲイザーと同じ */
function bossEyeSpec(e,ey,i){
  return {x:e.x+ey.dx, y:e.y+ey.dy, ang:ey.ang, r:BAL.GAZE_R+BAL.GAZE_BOSS_EXTRA, spread:BAL.GAZE_ANG, state:ey.state, t:ey.t, tmax:BAL.GAZE_AIM*0.95,   // v2.4 照準が速く、間隔が短い
          cd:BAL.GAZE_CD*1.0, scatter:i===1?0:(i===0?-1:1), off:ey.off||0};
}
function inSector(ey,p){
  const dx=p.x-ey.x, dy=(p.y-10)-ey.y, d=Math.hypot(dx,dy);
  if(d>ey.r) return false;
  if(!losClear(ey.x,ey.y,p.x,p.y-10,true)) return false;   // 岩は視線を遮る
  const da=Math.abs(((Math.atan2(dy,dx)-ey.ang+Math.PI*3)%TAU)-Math.PI);
  return da<ey.spread/2;
}
/* v1.2 状態異常: 寸止め/疼き/痺れ/視姦/時間停止/触手服/おねだり */
function statesTick(h,dt){
  // 地形: 花園の花粉、温泉の湯気(回復するが火照る)
  h.zone=zoneAt(h.x,h.y);
  if(h.zone!==h.zoneLast){   // 地形帯に入った合図(見て「ここは○○」と分かるように)
    const zname=(h.zone==='lewd'&&G.B.floor&&G.B.floor.lewd)?G.B.floor.lewd.name:ZONES[h.zone].name;   // v2.2 えちえちエリアは階層ごとの名前
    if(h.zoneLast!==undefined && G.B.time-(h.zoneToastT||-9)>4){ const tag=fearTag(zoneFear(h.zone)); floatTxt(h.x,h.y-100,'— '+zname+' —'+(tag?'('+tag+')':''),h.zone==='lewd'?'#ff9ec2':'#cbd5ff',13,2.4); floatTxt(h.x,h.y-86,ZONES[h.zone].her,'#9fb4d8',9,2.4); h.zoneToastT=G.B.time; }   // v1.8 地形の意味も一行 / v2.2 嫌い方
    if(h.zone==='lewd' && !G.B.lewdSeen && G.B.floor&&G.B.floor.lewd){ G.B.lewdSeen=true; setBanner(G.B.floor.lewd.name,G.B.floor.lewd.sub,'#ff86b3'); sayLine('feat.lewd',1,0,'ここ……あまいにおいが、すごい'); }
    if(h.zone==='lewd' && h.zoneLast!=='lewd') denEnterBurst(h);   // v3.2 敷居をまたいだ瞬間
    if(h.zone==='haze' && h.zoneLast!=='haze' && h.zoneLast!=='lewd') sayLine('feat.haze',1,25,'このにおい……おくに、なにかある');
    if(zoneFear(h.zone)>=2){ h.zoneEnter={x:h.x,y:h.y}; h.zoneHeat0=h.heatG||0; h.zoneSens0=h.sensit||0; h.zoneAbortTried=false; } else h.zoneEnter=null;   // v2.2 嫌な地形に入った位置と、入った時の火照り
    h.zoneLast=h.zone;
  }
  if(h.zone==='water') learnZone('water',dt*0.5);        // 足を取られる
  if(h.zone==='flower') learnZone('flower',dt*0.35);     // 花粉
  if(h.zone==='hotspring') learnZone('hotspring',dt*0.35);
  if(h.zone==='flower') applySensit(0.6*dt);
  if(h.zone==='hotspring'){ applySensit(1.2*dt); addHeatG(2*dt); h.hp=Math.min(h.maxHp,h.hp+h.regen*0.5*dt); }
  if(h.zone==='flesh') addHeatG(BAL.FLESH_HEAT*dt);   // v2.0 肉の床: 脈がうつる
  if(h.zone==='lewd'){   // v3.2 巣窟: 前室→沼→最奥と、奥ほど効きが強い。奥まで来たら引き返さない(前室でだけ「やっぱ無理」が出る)
    const dst=Math.max(0,Math.min(2,denStage(h.x,h.y)));
    learnZone('lewd',dt*0.45); addHeatG(BAL.DEN_HEAT[dst]*dt); applySensit(BAL.DEN_SENS[dst]*dt);
    h.lewdT=(h.lewdT||0)+dt;
    if(h.lewdT>=BAL.DEN_GROPE[dst]){ h.lewdT=rand(-1.5,0); floorGrope(h); if(dst===0 && Math.random()<BAL.DEN_ABORT) zoneAbort(h); }
  }else if(h.zone==='haze'){ learnZone('haze',dt*0.3); addHeatG(BAL.HAZE_HEAT*dt); applySensit(BAL.HAZE_SENS*dt); h.lewdT=0; }   // v3.2 口の外の澱み
  else h.lewdT=0;
  if(h.zoneEnter && !h.zoneAbortTried && zoneFear(h.zone)>=2 && denStage(h.x,h.y)<=0 && ((h.heatG||0)-(h.zoneHeat0||0)>=15 || (h.sensit||0)-(h.zoneSens0||0)>=10)){ if(Math.random()<0.45) zoneAbort(h); else h.zoneAbortTried=true; }   // 火照りが急に進んだら、半分弱は逃げ出す(v3.2 巣窟の沼・最奥まで来ていたら引き返さない——前室と外だけ)
  const B=G.B;
  // ---- v1.3 催眠Lv: 時間で薄れる。Ⅲでは、その場で自分を慰めはじめる
  if(h.hypnoLv>0){
    h.hypnoT-=dt;
    if(h.hypnoT<=0){ h.hypnoLv--; h.hypnoT=BAL.HYPNO_LV_DUR*0.7; if(h.hypnoLv===0) heroBubble(h,'……あれ。いま、なにを……',false,1); }
  }
  if(h.selfCd>0) h.selfCd-=dt;
  if(h.selfT>0){
    h.selfT-=dt;
    applyPleasure(2.6*dt);
    const el=BAL.SELF_DUR-h.selfT;
    if(h.selfPhase===0 && el>0.8){ h.selfPhase=1; heroBubble(h,pickRand(['……て、が……なんで、ここ……','ちがう、これは、その……たしかめてる、だけ……']),true,3); }
    if(h.selfPhase===1 && el>2.2){ h.selfPhase=2; heroBubble(h,pickRand(['ぁ……っ、だれか、みてる……? みてない……よね……','とまら、な……あと、すこし、だけ……']),true,3); }
    if(Math.random()<dt*6) parts(h.x+rand(-8,8),h.y-rand(6,24),1,['#ff9ec2','#fff'],40,0.6);
    if(h.selfT<=0){ h.selfT=0; heroBubble(h,'……! な、なにして……わたし、いま……',true,2); }
  }else if(h.hypnoLv>=3 && h.selfCd<=0 && h.climaxT<=0 && !h.pinned && !h.charmBind && h.freezeT<=0 && attachCount(h)===0){
    h.selfT=BAL.SELF_DUR; h.selfCd=BAL.SELF_CD; h.selfPhase=0; h.vx=0; h.vy=0;
    awardAil('self');
  }
  // ---- 雄臭(v1.6): 嗅ぐ発作はなくなった。ゴブリンが歩きながら残す「雄臭の雲」の中で発情・敏感化が進む(処理は上の雲の判定)
  h.muskNear=h.inMusk;
  // 時間停止: 触られ放題。解除の瞬間に溜めた快感が一気に来る
  if(h.freezeT>0){
    h.freezeT-=dt; h.ifr=0; h.vx=0; h.vy=0;
    if(h.freezeT<=0){
      h.freezeT=0;
      const acc=h.frozenAcc*BAL.FREEZE_MULT; h.frozenAcc=0;
      if(acc>0){
        heroBubble(h,'——っ、いま、ぜんぶ、いっしょに……ぁあっ!?',true,3);
        applyPleasure(acc);
      }else heroBubble(h,'……うごける。いま、なにが……',false,2);
    }
  }
  // 寸止め
  if(h.denyT>0){ h.denyT-=dt; if(h.denyT<=0) releaseDeny(); }
  // 疼き: 寸止め中/発情Ⅲ中に不意の突き上げ
  if(h.denyT>0 || h.heatLv>=3 || h.curseAche){   // 呪い『淫紋焼き付け』: 焼けるような快感が常に来る
    h.acheCd-=dt;
    if(h.acheCd<=0){
      h.acheCd=BAL.ACHE_CD*rand(0.8,1.3);
      applyPleasure(BAL.ACHE_PLEAS);
      floatTxt(h.x+rand(-10,10),h.y-44,'ずきん','#ff86b3',10,0.8);
      if(Math.random()<0.5) heroBubble(h,pickRand(['っ……! いま、なにも、してない、のに……','うずい、て……','ぁ、っ、また……']),false,2);
      awardAil('ache');
    }
  }
  if(h.numbT>0) h.numbT-=dt;
  // 視姦: 覗き目玉が視界内で見ている間
  h.watchedT=Math.max(0,h.watchedT-dt);
  for(const e of B.enemies){
    if(e.dead||e.dormant||e.id!=='eye') continue;
    if(inSight(e,h) && Math.hypot(e.x-h.x,e.y-h.y)<BAL.WATCH_R){ h.watchedT=0.3; break; }
  }
  // 触手服: 着ている間、脈動して快感を注ぐ
  if(h.suitT>0){
    h.suitT-=dt; h.suitPulse-=dt;
    applySensit(1.2*dt);
    if(h.suitPulse<=0){
      h.suitPulse=BAL.SUIT_PULSE;
      applyPleasure(BAL.SUIT_PLEAS);
      parts(h.x+rand(-8,8),h.y-rand(6,24),4,['#ff9ec2','#ffb3cf'],60,0.5);
      if(Math.random()<0.6) heroBubble(h,pickRand(['ふくの、なかで……うごいて……','ぬるって、はだを……や、そこ……','ぬげない……ぬげない、の……']),false,2);
    }
    if(h.suitT<=0){ h.suitT=0; heroBubble(h,'……とれた。ぜんぶ、ぬめぬめ……',false,2); }
  }
  // おねだり: 発情Ⅲ+(催眠/淫紋Ⅱ+/寸止め明け)で、撃つのをやめて寄っていってしまう
  if(h.begCd>0) h.begCd-=dt;
  if(h.begT>0){ h.begT-=dt; }
  else if(h.begCd<=0 && h.heatLv>=(h.curse==='succuqueen'?2:3) && h.climaxT<=0 && !h.pinned && !h.charmBind && (h.dazeT>0 || h.crestLv>=2 || h.refractT>BAL.REFRACT_T-0.5)){
    if(B.enemies.some(e=>!e.dead&&!e.dormant&&Math.hypot(e.x-h.x,e.y-h.y)<260)){
      h.begT=BAL.BEG_DUR; h.begCd=BAL.BEG_CD;
      heroBubble(h,pickRand(['……や、やめ……て、ほし……くない……','こないで……こっち、きて……ちがう……','もう、いい、から……いいって、なに……']),true,3);
      awardAil('beg');
    }
  }
}
function condTick(h,dt){
  const B=G.B;
  statesTick(h,dt);
  if(G.mode!=='battle'&&G.mode!=='levelup') return;
  // 快感の自然減衰
  if(h.aphro>0) h.aphro=Math.max(0,h.aphro-BAL.PLEAS_DECAY*dt);
  // 敏感化の自然減衰(祭壇分は下限として残る)
  if(h.sensit>h.sensitFloor) h.sensit=Math.max(h.sensitFloor,h.sensit-BAL.SENSIT_DECAY*dt);
  // 発情: レベル制+定期的な波
  if(h.heatLv>0){
    h.heatT-=dt;
    if(h.heatT<=0){
      h.heatLv--;
      if(h.heatLv>0){ h.heatT=BAL.HEAT_LV_DUR*0.7; }
      else{ h.waveDur=0; heroBubble(h,'……いまの、なに…'); }
    }
    if(h.waveDur>0){ h.waveDur-=dt; }
    else{
      h.waveT-=dt;
      if(h.waveT<=0){
        h.waveDur=BAL.WAVE_DUR_BASE+BAL.WAVE_DUR_LV*h.heatLv;
        h.waveT=Math.max(3,BAL.WAVE_CD_BASE-BAL.WAVE_CD_LV*h.heatLv)+rand(-0.8,0.8);
        if(!h.pinned&&!h.charmBind&&h.climaxT<=0) heroBubble(h,pickRand(['……っ、また、きて…っ','あついの…きちゃ…っ','ひざ、ふるえ…っ']),false,2);
      }
    }
  }
  if(h.slow>0) h.slow-=dt;
  // 魅了: 種族別の持続と発作(個体が死んでも種族への魅了は時間まで残る)
  for(let i=h.charms.length-1;i>=0;i--){
    const c=h.charms[i];
    c.t-=dt;
    c.g=Math.max(0,(c.g||0)-BAL.CHARM_DECAY*dt);   // 溜まりは徐々に抜ける
    if(c.lv<=0 && c.g<=0){ h.charms.splice(i,1); continue; }
    if(c.t<=0){
      if(c.lv>0){ c.lv--; if(c.lv<=0 && c.g<=0){ h.charms.splice(i,1); heroBubble(h,'…あれ? わたし、なにを…'); continue; } }
      c.t=BAL.CHARM_DUR*0.8;
    }
    // Lv2+: 無意識に寄っていく発作(その種族の最寄り個体が場にいる時だけ)
    if(c.lv>=2 && !h.charmDrift && !h.pinned && !h.charmBind && attachCount(h)===0){
      c.driftCd-=dt;
      if(c.driftCd<=0){
        c.driftCd=BAL.CHARM_DRIFT_CD*rand(0.85,1.2);
        if(nearestOfId(c.id)){
          h.charmDrift={id:c.id, t:BAL.CHARM_DRIFT_T*c.lv+(c.lv>=3?0.8:0)};
          heroBubble(h,pickRand(['……あのこ達、どこ…','ちがう、いま戦ってる、のに…','あし、が…かってに…']),true,2);
        }
      }
    }
  }
  if(h.charmDrift){
    h.charmDrift.t-=dt;
    if(h.charmDrift.t<=0) h.charmDrift=null;
  }
  for(const k in h.resist) h.resist[k]=Math.max(0,h.resist[k]-dt*0.04);
  if(h.refractT>0) h.refractT-=dt;
  // 吸い付き: 快感を注ぎ続け、体液=スタミナも吸っていく(死んだ個体は外す)
  for(const sl of suckSlots(h)){
    const at=h.suckers[sl];
    if(!at.mon||at.mon.dead){ h.suckers[sl]=null; continue; }
    applyPleasure(BAL.SUCK_PLEAS*unitPmul(at.mon)*dt);
  }
  if(!h.pinned && suckCount(h)>0){
    h.stamina=Math.max(0,h.stamina-BAL.SUCK_STAM_DRAIN*suckCount(h)*dt);
    checkStaminaCollapse();
    if(G.mode!=='battle'&&G.mode!=='levelup') return;
  }
  // 絡みつき中の微快感(拘束役の練度でスケール)。憑依された腕は自分で自分を撫でる
  for(const sl of attachedSlots(h)){
    const at=h.limbs[sl], m=at.mon;
    if(!m||m.dead) continue;
    if(at.kind==='possess'){
      applyPleasure(1.2*unitPmul(m)*dt);
      if(h.possessCd<=0){ h.possessCd=4; heroBubble(h,pickRand(['て、が……かってに……','やめて、わたしの、て……','ちがう、じぶんで、なんて……っ']),false,2); }
    }else applyPleasure(BAL.PLEAS_BINDER*unitPmul(m)*dt);
  }
  if(h.possessCd>0) h.possessCd-=dt;
  // 2箇所以上絡みつかれていると体力がじわじわ奪われる
  if(!h.pinned && attachCount(h)>=2){
    h.stamina=Math.max(0,h.stamina-BAL.STAMINA_DRAG*dt);
    checkStaminaCollapse();
    if(G.mode!=='battle'&&G.mode!=='levelup') return;
  }
  // スタミナ回復
  if(!h.pinned && !h.charmBind && h.climaxT<=0 && attachCount(h)===0){
    const rg=h.heatLv>0?BAL.STAMINA_REGEN_HEAT:BAL.STAMINA_REGEN;
    h.stamina=Math.min(h.staminaMax,h.stamina+rg*dt);
    if(h.exhausted && h.stamina>25){ h.exhausted=false; heroBubble(h,'……よし、いける'); }
  }
  // 発情の波のふらつき
  if(h.stumbleDur>0) h.stumbleDur-=dt;
  h.stumbleT-=dt;
  if(h.waveDur>0 && h.stumbleT<=0 && !h.pinned && !h.charmBind && h.climaxT<=0){
    h.stumbleT=rand(1.8,3.0); h.stumbleDur=0.35;
    heroBubble(h,'あしが…もつれ…っ');
  }
  // ガス雲=媚薬: 敏感化と発情ゲージが上がる(快感は直接生まない)。雄臭の雲は加えて、発情したまま居続けると匂いと結びつく
  h.inMusk=false; let inCloud=false;
  { const mk=META.traits.musk||0, cm=(h.curse==='gobking'?1.5:1);
    for(const c of B.clouds){
      if(Math.hypot(h.x-c.x,(h.y-12)-c.y)<c.r){
        inCloud=true;
        if(c.kind==='musk'){
          h.inMusk=true;
          applySensit(c.rate*(1+0.3*mk)*cm*dt);
          addHeatG(BAL.MUSK_HEAT*(1+0.35*mk)*cm*dt);
          if(h.heatLv>0){ h.muskCond+=BAL.MUSK_COND*dt; if(h.muskCond>=25) conditionMusk(); }
          if(h.muskCd<=0){ h.muskCd=6; heroBubble(h,(h.heatLv>0||mk>0)?pickRand(['……っ、この、におい……','くさい、のに……なんで、からだが……','けものの、におい……あつ……']):pickRand(['くさ……なにこれ、けものみたいな……','う、においが……ちかづかないで……']),h.heatLv>0,1); }
          if(c.boss) B.bossMark={id:c.boss, t:B.time};
          codexMet('goblin');
        }else{
          applySensit(c.rate*dt);
          addHeatG(BAL.HEAT_GAS*dt);
          if(c.src) codexMet(c.src);
        }
        break;
      }
    }
  }
  if(h.muskCd>0) h.muskCd-=dt;
  if(!h.inMusk) h.muskCond=Math.max(0,h.muskCond-2*dt);          // 匂いから離れると結びつきは薄れる
  if(!inCloud) h.heatG=Math.max(0,(h.heatG||0)-1.5*dt);           // 雲の外では発情ゲージは徐々に抜ける
  if(h.hypnoG>0) h.hypnoG=Math.max(h.hypnoLv===0?(h.hypnoFloor||0):0,h.hypnoG-BAL.HYPNO_DECAY*dt); // 催眠ゲージも抜ける(呪い『残光』の下限まで)
}
/* 発情ゲージ(雲・波・口づけ): 100で発情Lvが一段上がる。絶頂経由の発情と違い、快感の位置は動かさない */
function addHeatG(x){
  const h=G.B.hero;
  if(h.heatLv>=3) return;
  h.heatG=(h.heatG||0)+x*h.sense;
  if(h.heatG>=100){ h.heatG=0; heatUp(false); awardAil('heatg'); }
}

/* ================= ヒロインAI ================= */
function aiUpdate(dt){
  const B=G.B, p=B.hero, st=heroStat(p);
  p.prevX=p.x; p.prevY=p.y;

  if(p.pinned || p.charmBind || p.climaxT>0 || p.stumbleDur>0 || p.freezeT>0 || p.selfT>0 || p.sniffT>0 || p.bathT>0 || p.poolT>0 || p.readT>0){
    p.vx*=Math.pow(0.001,dt); p.vy*=Math.pow(0.001,dt);
    p.moving=false;
    p.aiLabel=p.freezeT>0?'じかんが、とまって……'
      :p.climaxT>0?'ぜっちょう……!!'
      :p.selfT>0?'……(その場で、じぶんを)……'
      :p.bathT>0?'おゆに、つかってる……'
      :p.poolT>0?'清水で、あらってる……'
      :p.readT>0?'石碑を、よんでいる……'
      :p.sniffT>0?'……におい、を……'
      :(p.pinned?'おさえこまれている!!':(p.charmBind?'みりょうされて、はなれない…!!':'ふらつき…'));
    return;
  }

  if(p.diveT>0) p.diveT-=dt;
  if(p.dazeT>0) p.dazeT-=dt;

  const foc=heroFocus(p)*(p.dazeT>0?0.6:1)*(1-0.12*p.hypnoLv);   // 催眠電波/催眠Lv: 思考がざらつく

  p.strafeT-=dt;
  if(p.strafeT<=0){ p.strafeDir*=-1; p.strafeT=rand(2,4.5); }

  // 魅了拘束の接触だけは毎フレーム判定(発作中に触れた瞬間へ反応)
  if(p.charmDrift){
    const cm=nearestOfId(p.charmDrift.id);
    if(cm && charmLvFor(p,cm)>=3 && Math.hypot(cm.x-p.x,cm.y-p.y)<cm.r+p.r+6){
      enterCharmBind(cm);
      return;
    }
  }

  // ---- 思考の拍 ----
  // 一定間隔でしか判断を更新しない。集中が低いほど判断が遅れ、
  // 判断の合間は前の判断のまま動き続ける(境界でのガクガクを消し、考えている風の間を作る)
  p.thinkT-=dt;
  if(p.thinkT<=0){
    p.thinkT=(BAL.THINK_MIN+(BAL.THINK_MAX-BAL.THINK_MIN)*(1-foc)+rand(0,0.06))*(p.dazeT>0?2.2:1)*(1+0.35*p.hypnoLv)*(p.curse==='bossgazer'?1.15:1);
    aiDecide(foc);
  }

  let dx=p.steerX, dy=p.steerY;
  let state=p.steerState;
  // おねだり: 撃つのをやめて、いちばん近い魔物へ寄っていく
  if(p.begT>0){
    let ne=null, nd=1e9;
    for(const e of B.enemies){
      if(e.dead||e.dormant||e.state==='attached') continue;
      const d=Math.hypot(e.x-p.x,e.y-p.y); if(d<nd){ nd=d; ne=e; }
    }
    if(ne && nd>18){ dx=(ne.x-p.x)/nd*0.9; dy=(ne.y-p.y)/nd*0.9; state='beg'; }
  }
  // 催眠電波の引き寄せ: 足が塔のほうへ向く(操舵を7割乗っ取る)
  if(p.hypno){
    p.hypno.t-=dt;
    if(p.hypno.t<=0) p.hypno=null;
    else{
      const hx=p.hypno.x-p.x, hy=p.hypno.y-p.y, hd=Math.hypot(hx,hy)||1;
      if(hd>30){ dx=dx*0.3+hx/hd*0.7; dy=dy*0.3+hy/hd*0.7; state='hypno'; }
    }
  }

  // 媚薬・煽りによるノイズ(思考の乱れ)
  if(foc<1){
    const n=(1-foc)*1.1*((p.path&&p.path.length)?0.4:1);   // v2.1 経路を辿っている(狭い所)ときは乱れを小さく
    dx+=Math.sin(B.time*3.1+p.anim*7)*n;
    dy+=Math.cos(B.time*2.7+p.anim*5)*n;
  }

  // v2.1 壁ぞい滑り: 壁へ向かう成分を落として、隙間では軸方向だけ進む。横に動けない(牽制の横歩き)なら向きを反転
  if(G.map && BAL.WALL_SLIDE_R>0 && (dx||dy)){
    const m0=Math.hypot(dx,dy), sl=wallSlide(p.x,p.y,dx,dy,BAL.WALL_SLIDE_R,false); dx=sl.x; dy=sl.y;
    if(Math.hypot(dx,dy)<m0*0.35){ p.blockT=(p.blockT||0)+dt; if(p.blockT>0.25){ p.blockT=0; p.strafeDir*=-1; } } else p.blockT=0;
  }
  const m=Math.hypot(dx,dy);
  const tvx=m>0.001?dx/m*st.speed:0;
  const tvy=m>0.001?dy/m*st.speed:0;
  const k=Math.min(1,dt*6.5*foc);
  p.vx+=(tvx-p.vx)*k; p.vy+=(tvy-p.vy)*k;
  p.x+=p.vx*dt; p.y+=p.vy*dt;
  { const cx=p.x, cy=p.y; collideMap(p,p.r+2,false); if(Math.hypot(p.x-cx,p.y-cy)>0.5){ B.nWallHit=(B.nWallHit||0)+1; const vd=p.vx*(p.x-cx)+p.vy*(p.y-cy); if(vd<0){ p.vx*=0.5; p.vy*=0.5; } } }   // 壁・崖・マップの端(押し戻されたら勢いを殺す=跳ね返りで震えない)
  // 詰まり検知: 進みたいのに進めていない(壁の角など)→ 探索点へ経路で抜ける
  { const want=Math.hypot(p.steerX||0,p.steerY||0), moved=Math.hypot(p.x-p.prevX,p.y-p.prevY);
    if(want>0.3 && moved<st.speed*dt*0.25 && attachCount(p)===0 && !p.pinned && !p.charmBind) p.stuckT=(p.stuckT||0)+dt; else p.stuckT=Math.max(0,(p.stuckT||0)-dt*2);
    if(p.stuckT>1.2){ p.stuckT=0; p.unstickT=2.5; B.nUnstick=(B.nUnstick||0)+1; p.explore=null; p.exploreUntil=0; p.dest=null; p.destUntil=0; p.path=null;
      // v3.2 同じ目当てで二度つっかえたら、その目当ては諦める。通れない隙間の前でいつまでも回らないように
      //      (救出と巣窟の待機だけは諦めない——そこに立つのが仕事なので)
      const gk=p.goal?goalKindKey(p.goal):'', keep=(gk==='rescue'||gk==='wait'||(p.goal&&(p.goal.kind==='rescue'||p.goal.kind==='wait')));
      const k=p.tgtKey||(p.goal&&giveUpKey(p.goal))||null;
      if(k && p.unstickKey===k && B.time-(p.unstickT0||-99)<14) p.unstickN=(p.unstickN||0)+1;
      else { p.unstickKey=k; p.unstickN=1; p.unstickT0=B.time; }
      if(k && !keep && p.unstickN>=2){
        if(p.goal) giveUpOn(p.goal);
        if(B.giveUp && typeof k==='object') B.giveUp.set(k,B.time+BAL.GIVEUP_CD);
        p.goal=null; p.goalT=0; p.tgtKey=null; p.tgtNear=0; p.unstickN=0;
        B.nStuckDrop=(B.nStuckDrop||0)+1; sayLine('giveUp',0,20,'……とおれない。べつのとこ、いこ');
      } }
    if(p.unstickT>0) p.unstickT-=dt;
    // v3.2 堂々巡りの脱出: つっかえ判定(ほぼ静止)では捕まえられない「歩いてはいるのに同じ所を回っている」を、位置の履歴で見る。
    //      通れない隙間の前や、届かない物の周りで延々と回るのを止める(拘束・押し倒し・相談・待機・救出の最中は数えない)
    { const busy=attachCount(p)>0||p.pinned||p.charmBind||p.climaxT>0||p.freezeT>0||p.out;
      const intent=p.aiState==='talk'||p.aiState==='g_wait'||p.aiState==='g_rescue'||p.aiState==='hesitate'||p.aiState==='think';
      const gk=p.goal?goalKindKey(p.goal):'';
      if(busy||intent||gk==='rescue'||gk==='wait'||B.time<(p.orbitCd||0)){ p.orbit=null; }
      else{
        if(!p.orbit) p.orbit={t:B.time, sx:p.x, sy:p.y, r:0, s:0};
        const o=p.orbit; o.s-=dt;
        if(o.s<=0){ o.s=0.25; o.r=Math.max(o.r, Math.hypot(p.x-o.sx,p.y-o.sy)); }
        if(B.time-o.t>BAL.ORBIT_T){
          if(o.r<BAL.ORBIT_R){
            if(p.goal) giveUpOn(p.goal);
            if(p.tgtKey && B.giveUp && typeof p.tgtKey==='object') B.giveUp.set(p.tgtKey,B.time+BAL.GIVEUP_CD);
            p.goal=null; p.goalT=0; p.tgtKey=null; p.tgtNear=0; p.path=null; p.explore=null; p.exploreUntil=0; p.dest=null; p.destUntil=0;
            p.orbitCd=B.time+BAL.ORBIT_CD; B.nOrbit=(B.nOrbit||0)+1;
            sayLine('giveUp',0,20,'……ここ、とおれない。べつのとこ いこ');
          }
          p.orbit=null;
        }
      } } }
  // v1.8 ジェム畑に留まった時間(目当てがあるのに拾い続けている)→ FARM_T を超えたら FARM_BREAK 秒は歩く
  // (v1.8 の FARM_T/FARM_BREAK による「拾う/歩く」の交代は v2.1 の道すがら回収と群れの時間割で置き換えた)

  // 繋留(蔦)による引き戻し
  for(const sl of attachedSlots(p)){
    const at=p.limbs[sl];
    if(at.kind!=='tether'||!at.mon||at.mon.dead) continue;
    const anch=at.mon;
    const dx2=p.x-anch.x, dy2=p.y-anch.y;
    const d2=Math.hypot(dx2,dy2)||0.001;
    if(d2>at.r){
      p.x=anch.x+dx2/d2*at.r;
      p.y=anch.y+dy2/d2*at.r;
    }
  }

  // 抵抗ゲージ: 移動量で蓄積
  const moved=Math.hypot(p.x-p.prevX,p.y-p.prevY);
  if(restraintCount(p)>0) addStruggle(moved*BAL.STRUGGLE_MOVE_RATE);

  if(Math.abs(p.vx)>12 && p.steerState!=='talk') p.face=p.vx>0?1:-1;   // v3.1 話している間は相手の方を向いたまま
  p.moving=Math.hypot(p.vx,p.vy)>30;

  const LBL={g_gather:'集まって相談', g_wait:'外で待つ', flee:'かいひ行動!', boss:'ボスかいひ!!', dodge:'よける!(おぼえてる)', gem:'ジェム回収', poi:'めざす場所へ', explore:'たんさく中', heart:'ハートへ!',
    prop:'燭台をこわして回復!', chest:'たからばこへ!', kite:'まちうけ・けん制', wait:'けいかい中',
    struggle:'ふりほどこうともがいている!',
    charmwalk:'ふらふらと、ちかづいていく…', heatwalk:'熱にまけて、よろめき寄る…',
    hypno:'……電波に、あしが……', item:'おちてる品へ!', beg:'……おねだり、なんて……してない……',
    g_event:'光の柱へ!', g_chest:'たからばこへ!', g_boss:'おうさまの箱へ!', g_item:'おちてる品へ!', g_shrine:'祠へ', g_spring:'泉で休みに', g_pool:'清水であらいに',
    g_stele:'石碑をよみに', g_stairs:'降り口へ', g_seal:'封印石を灯しに', g_core:'魔核へ——', g_shroom:'光茸をとりに', g_nectar:'蜜の花へ', g_treasure:'沈んだ宝へ', g_explore:'たんさく中', g_gems:'ジェムをあつめる', hesitate:'まよっている……', think:'かんがえ中……', abort:'にげだす!', retreat:'逃げに徹する!', kite2:'引き撃ち', talk:'相談中……', assist:'仲間を助ける!', rescue:'救出する!', g_rescue:'仲間を救いに'};
  const BBL={flee:'にげなきゃ〜!', boss:'おっきいのこわい!!', dodge:'あれは…だめ、よけなきゃ!', gem:'キラキラかいしゅう♪', poi:'あそこまで、いってみる', explore:'こっちは、まだ見てない',
    heart:'ハートみっけ!', prop:'燭台こわして回復しなきゃ', chest:'たからばこだ〜!',
    kite:'このきょりキープ…', wait:'つぎはどこから…?', struggle:'はなれてよ〜っ!',
    charmwalk:'…なんで、あしが…', heatwalk:'…あつくて、なにも…',
    hypno:'……あっち、いかなきゃ……', item:'なにか、おちてる!', beg:'……ちがう……',
    g_event:'あのひかり、いってみる', g_chest:'たからばこだ〜!', g_boss:'おうさまの、たからばこ……!', g_item:'なにか、おちてる!', g_shrine:'ほこら、いこう', g_spring:'ちょっと、やすみたい……',
    g_pool:'あらいたい……べたべた', g_stele:'なにか、かいてある', g_stairs:'……おりる。つぎへ', g_seal:'あれ、ともさなきゃ', g_core:'……あれが、しんぞう', g_shroom:'あのひかり、とろう', g_nectar:'はな……あまいにおい', g_treasure:'みずのなかに、なにか……', g_explore:'こっちは、まだ見てない', g_gems:'キラキラ、ぜんぶひろう♪', hesitate:'……どうしよ', think:'……うーん', abort:'やっぱ、むり!', retreat:'ぜんぶ、にげるっ!', kite2:'さがりながら、うつ!', talk:'どっち、いく?', assist:'いま、たすける!', rescue:'まって、いくから!', g_rescue:'いま、いく!'};
  if(p.dodging>0){ p.dodging-=dt; }
  p.aiLabel=LBL[state]||LBL.wait;
  if(state!==p.aiState){
    p.aiState=state;
    // エロ状態が乗っている間は、のんきなおしゃべりを封じる(台詞の主導権はエロ側)
    const ero=p.heatLv>0||p.aphro>=45||restraintCount(p)>0||p.climaxT>0||p.charms.some(c=>c.lv>0);   // ゲージだけの魅了エントリ(lv0)は数えない
    if(!ero && BBL[state]) heroBubble(p,BBL[state]);   // v3.1 表に無い状態(g_gather など)で空の吹き出しを置かない
  }
}

/* 視界: 画面(カメラは彼女を追う)内+マージンだけが見えている */
function inSight(e,p){
  return Math.abs(e.x-p.x)<W/2+BAL.SIGHT_MARGIN && Math.abs(e.y-p.y)<H/2+BAL.SIGHT_MARGIN;
}
function cloudAt(x,y){
  for(const c of G.B.clouds){ if(Math.hypot(x-c.x,y-c.y)<c.r) return c; }
  return null;
}
function cloudWorth(cl){
  let n=0,v=0;
  for(const gm of G.B.gems){ if(Math.hypot(gm.x-cl.x,gm.y-cl.y)<cl.r+8){ n++; v+=gm.v; } }
  return {n,v};
}
/* 判断本体: 「見えている」敵だけを材料に進路と行動を決め、p.steer* に書き込む。
   思考の拍(aiUpdate)からのみ呼ばれる */
function aiDecide(foc){
  const B=G.B, p=B.hero;
  // 詰まりからの脱出: しばらく探索点へ経路で歩く
  if(p.unstickT>0){
    if(!p.explore || B.time>p.exploreUntil) pickExplore(p);
    if(p.explore){ const sv=steerTo(p,p.explore.x,p.explore.y); p.steerX=sv.x; p.steerY=sv.y; p.steerState='explore'; return; }
  }
  let ax=0, ay=0, threat=0, bossNear=false;
  // 壁・崖: 近いほど離れる力(角に追い詰められない)
  const wpush=wallPush(p.x,p.y,42,false); const wpx=wpush.x*1.3, wpy=wpush.y*1.3; ax+=wpx; ay+=wpy;   // v2.1 目標へ歩く時は「進路を押し戻す」成分だけ後で外す
  // マップの端: 壁に追い詰められないよう、端に近いほど内側へ寄る
  { const wm=150;
    if(p.x<-MAP_HW+wm) ax+=(1-(p.x+MAP_HW)/wm)*1.4; if(p.x>MAP_HW-wm) ax-=(1-(MAP_HW-p.x)/wm)*1.4;
    if(p.y<-MAP_HH+wm) ay+=(1-(p.y+MAP_HH)/wm)*1.4; if(p.y>MAP_HH-wm) ay-=(1-(MAP_HH-p.y)/wm)*1.4; }
  for(const e of B.enemies){
    if(e.dead||e.dormant||e.state==='attached') continue;
    if(e.id==='flower' && !e.revealed) continue;
    if(e.id==='imp') continue;                                 // 小淫魔からは逃げない(脅威と認識しない)
    // 画面外の敵は存在に気づかない。視界に入ってからも反応までの遅れがある
    if(!inSight(e,p) || e.seenT < BAL.NOTICE_T*(1.4-0.4*foc)) continue;
    const dx=p.x-e.x, dy=p.y-e.y;
    const d=Math.hypot(dx,dy)||0.001;
    const mobileBoss=e.boss && MONSTERS[e.id].spd>0 && e.id!=='bossgazer';   // 動かないボス/多眼のボスからは逃げ回らない(視界を見て避ける)
    // 学習: 知らない相手は一律の距離感。知るほど種族ごとの間合いになり、脅威3の相手は熟知で広く避ける
    const kl=knowLv(e.id), th=SPEC_THREAT[e.id]||0;
    const base=mobileBoss?280:(kl===0?120:(SPEC_DANGER[e.id]!==undefined?SPEC_DANGER[e.id]:150));
    const danger=base*(kl>=3&&th>=3?1.35:1)+e.r;
    if(d<danger){
      let w=1-d/danger; w=w*w*(mobileBoss?3:1)*(kl>=2?1+0.35*th:1);
      w*=1-0.28*charmLvFor(p,e);                               // 魅了された種族は脅威と思えない
      threat+=w; ax+=dx/d*w; ay+=dy/d*w;
      if(mobileBoss) bossNear=true;
    }
  }
  // 粘液・ガス雲の回避(集中が低いと避けきれない。意を決した間は避けない)
  for(const tr of B.trails){
    const dx=p.x-tr.x, dy=p.y-tr.y, d=Math.hypot(dx,dy)||0.001;
    if(d<40){ ax+=dx/d*0.35; ay+=dy/d*0.35; }
  }
  if(p.diveT<=0){
    for(const c of B.clouds){
      const dx=p.x-c.x, dy=p.y-c.y, d=Math.hypot(dx,dy)||0.001;
      if(d<c.r+30){ ax+=dx/d*0.35*foc; ay+=dy/d*0.35*foc; }
    }
  }
  // v2.0 淫紋の罠(見える): 知っていれば踏まない(認識で避け、熟知で強く避ける)
  { const ck=crestKnow(); if(ck>=1){ for(const tr of B.traps){ if(!tr.armed) continue; const tdx=p.x-tr.x, tdy=p.y-tr.y, td=Math.hypot(tdx,tdy)||0.001; if(td<tr.r+46){ const w=(ck>=3?0.9:0.55)*foc; ax+=tdx/td*w; ay+=tdy/td*w; } } } }
  // ゲイザーの視界(紫に照らされた扇)と照射触手の照準線は見えるので避ける——
  // ただし「それが危ない」と知っていなければ避けない(学習: 未知0 / 認識0.5 / 理解以上1)。催眠が深いほど避けられない。
  // 理解以上の脅威3の相手には、周りの敵に殴られるのを覚悟で避ける(周囲への警戒を4割に落とす)
  let ddx=0, ddy=0, strong=false;
  const baseDodge=foc*(1-0.25*p.hypnoLv);
  if(baseDodge>0.1){
    for(const e of B.enemies){
      if(e.dead||e.dormant||!inSight(e,p)) continue;
      const kl=knowLv(e.id); if(kl===0) continue;
      const dodge=baseDodge*(kl===1?0.5:1), th=SPEC_THREAT[e.id]||0;
      const eyes=gazerEyes(e);
      for(const ey of eyes){
        if(ey.state!=='aim') continue;
        const dx=p.x-ey.x, dy=(p.y-10)-ey.y, d=Math.hypot(dx,dy)||0.001;
        if(d>ey.r+40) continue;
        const da=((Math.atan2(dy,dx)-ey.ang+Math.PI*3)%TAU)-Math.PI;
        if(Math.abs(da)>ey.spread/2+0.35) continue;
        const side=da>=0?1:-1;
        ddx+=(-Math.sin(ey.ang)*side)*0.7*dodge + dx/d*0.25*dodge;
        ddy+=( Math.cos(ey.ang)*side)*0.7*dodge + dy/d*0.25*dodge;
        if(kl>=2 && th>=3) strong=true;
      }
      if(e.id==='beamer' && e.bmState==='aim'){
        const ox=e.x, oy=e.y-e.r*1.4;
        const ux=Math.cos(e.bmAng), uy=Math.sin(e.bmAng);
        const rx=p.x-ox, ry=(p.y-14)-oy;
        const along=rx*ux+ry*uy;
        if(along>0 && along<BAL.BEAM_LEN){
          const px=rx-ux*along, py=ry-uy*along, pd=Math.hypot(px,py)||0.001;
          if(pd<60){ ddx+=px/pd*1.6*dodge; ddy+=py/pd*1.6*dodge; if(kl>=2) strong=true; }
        }
      }
      // 熟知した脅威3の相手からは、狙われる前から距離を取る(下に続く)
      if(kl>=3 && th>=3 && MONSTERS[e.id].spd>0){
        const dx=p.x-e.x, dy=p.y-e.y, d=Math.hypot(dx,dy)||0.001;
        if(d<260){ ddx+=dx/d*0.35*dodge; ddy+=dy/d*0.35*dodge; }
      }
    }
  }
  // 呪弾(刻印師)は見えるので、危ないと知っていれば横へ外す
  if(baseDodge>0.1){
    for(const b of B.ebullets){
      const ck=crestKnow(); if(ck===0) continue;   // v2.0 紋の知識で外す(理解以上は強く)
      const sp=Math.hypot(b.vx,b.vy)||1, ux=b.vx/sp, uy=b.vy/sp, rx=p.x-b.x, ry=(p.y-14)-b.y;
      const along=rx*ux+ry*uy; if(along<0||along>240) continue;
      const px=rx-ux*along, py=ry-uy*along, pd=Math.hypot(px,py)||0.001;
      if(pd<52){ const kk=ck>=2?1.6:1.0; ddx+=px/pd*1.3*kk*baseDodge; ddy+=py/pd*1.3*kk*baseDodge; }
    }
  }
  if(strong){ ax*=0.4; ay*=0.4; }
  ax+=ddx; ay+=ddy;

  // v2.3 戦闘モード: 近くの魔物を倒し切る見込み秒(ttk)と密度で決める。fight → kite(引き撃ち) → flee(逃げに徹する)。切り替えは MODE_HOLD 秒は保つ
  let nNear=0, hpNear=0, awx=0, awy=0; p.dpsEst=heroDpsEst(p);
  { let cx=0, cy=0, cn=0;
    for(const e of B.enemies){ if(e.dead||e.dormant||e.item||e.state==='attached'||e.id==='imp') continue; if(e.id==='flower' && !e.revealed) continue; if(MONSTERS[e.id].spd<=0) continue; if(!inSight(e,p) || e.seenT < BAL.NOTICE_T*(1.4-0.4*foc)) continue; const d=Math.hypot(e.x-p.x,e.y-p.y); if(d<260){ hpNear+=e.hp*(e.boss?0.35:1); const w=1-d/260; cx+=e.x*w; cy+=e.y*w; cn+=w; } if(d<120) nNear++; }   // 据わった個体(魔核・夢の樹・番人・口・壺)は数えない(近づけなくなる)
    if(cn>0){ cx/=cn; cy/=cn; const d=Math.hypot(p.x-cx,p.y-cy)||1; awx=(p.x-cx)/d; awy=(p.y-cy)/d; } }   // awx/awy: 群れの重心から離れる向き
  const ttk=hpNear/Math.max(1,p.dpsEst); p.press=ttk/BAL.FLEE_TTK+nNear/BAL.FLEE_N; p.ttkEst=ttk; p.nNear=nNear;
  if(BAL.SMART_AI && B.time>=p.modeUntil){
    const lvK=1+BAL.MODE_LV_K*Math.max(0,BAL.MODE_LV-p.level);   // 低Lvは武器が弱く何でも「倒し切れない」に見える→秒の閾値を緩める(Lv15で等倍)
    const want=(ttk>BAL.FLEE_TTK*lvK||nNear>=BAL.FLEE_N)?'flee':((ttk>BAL.KITE_TTK*lvK||nNear>=BAL.KITE_N)?'kite':'fight');
    if(want!==p.aiMode){ p.aiMode=want; p.modeUntil=B.time+BAL.MODE_HOLD; p.escape=null; if(want==='flee') sayLine('retreat',1,8,'むり、にげる!'); else if(want==='kite') sayLine('kite',0,12); }
  }
  // v3.0 仲間のカバー: 掴まれている/押し倒されている相手へ寄り、その魔物を優先して撃つ(自分が自由な時)
  { const o=partnerOf(p); const need=!!(o && (attachCount(o)>0 || o.pinned || o.charmBind) && attachCount(p)===0 && !p.pinned && !p.charmBind); if(need && !p.assist) sayPartyAs(B.ci, o.pinned?'assist.pin':'assist.grab',2,8); p.assist=need?o:null; }
  let dx=0, dy=0, state='wait';
  // v2.1 降りる気になったら: 知っている降り口(開いていて、番兵が居ない)へ向かう力が、逃げ・牽制に混ざる。そばまで来たら踏みとどまって降りる
  const exitQ=(B.wantExit&&G.map&&!B.exitLocked)?G.map.pois.find(q=>q.kind==='stairs'&&META.map.known[q.key]):null;
  const exitGuard=!!exitQ && exitGuarded();
  const exitOpen=!!exitQ && !exitGuard;
  // 向かう先: 開いていれば降り口そのもの。番兵が居るなら、その警戒半径のすぐ外(自分側)——そこからなら光が輪に届く(包囲戦)
  let exX=0, exY=0, exitD=1e9;
  if(exitQ){ const ddx=p.x-exitQ.x, ddy=p.y-exitQ.y, dd=Math.hypot(ddx,ddy)||1;
    if(exitGuard){ const rr=BAL.SENTINEL_ALERT-20; exX=exitQ.x+ddx/dd*rr; exY=exitQ.y+ddy/dd*rr*0.8; } else { exX=exitQ.x; exY=exitQ.y; }   // 警戒半径の縁: 番兵を引き出して撃つ
    exitD=Math.hypot(exX-p.x,exY-p.y)||1; }
  let exitGo=!!exitQ && (exitOpen || exitD>40);
  // v2.2 降りたいのに降り口をまだ知らない: 探索点を「逃げる先」にして、群れに押されても地図を進む(その場で牽制し続けない)
  if(B.wantExit && !exitQ && !B.floor.final && (!p.explore || B.time>p.exploreUntil || Math.hypot(p.explore.x-p.x,p.explore.y-p.y)<70)) pickExplore(p);   // v2.3 逃げに徹していても探索点は切らさない(降り口を探す)
  if(B.wantExit && !exitQ && p.explore && !B.floor.final){ exX=p.explore.x; exY=p.explore.y; exitD=Math.hypot(exX-p.x,exY-p.y)||1; exitGo=exitD>60; }

  // HPが危険域なら、多少の脅威があっても燭台へ強行する(回復の隙=攻めどころ)
  let forceProp=null;
  if(p.hp<p.maxHp*0.5 && !bossNear && B.hearts.length===0){
    let pd=520;
    for(const pr of B.props){
      const d=Math.hypot(pr.x-p.x,pr.y-p.y);
      if(d<pd){ pd=d; forceProp=pr; }
    }
  }

  if(attachCount(p)>0){
    // もがき: 進行方向を細かく振って引き剥がしゲージを稼ぐ
    state='struggle';
    const jerk=Math.sin(B.time*13)>0?1:-1;
    const will=p.hypnoLv>=2?0.15:1;   // 催眠Ⅱ+: もがく気が起きない
    dx=(Math.cos(B.time*7)*0.8*jerk + ax*1.2)*will;
    dy=(Math.sin(B.time*9)*0.8*jerk + ay*1.2)*will;
  }else if(p.fleeOut && B.time<p.fleeOut.until && !p.charmBind){
    // v2.2 「やっぱ無理」: 入った地形から、入ってきた所へ逃げ戻る
    const fo=p.fleeOut, fd=Math.hypot(fo.x-p.x,fo.y-p.y); if(fd<30 || zoneFear(p.zone)<2) p.fleeOut=null;
    const sv=steerTo(p,fo.x,fo.y); dx=sv.x+ax*0.6; dy=sv.y+ay*0.6; state='abort';
  }else if(exitOpen && exitD<70 && threat<1.8 && !p.charmBind){
    // 降り口の上: 多少殴られても立ち続ける(2.5秒で降りる)
    dx=(exitQ.x-p.x)/exitD*0.6+ax*0.4; dy=(exitQ.y-p.y)/exitD*0.6+ay*0.4; state='g_stairs';
  }else if(forceProp){
    p.propTarget=forceProp;
    const d=Math.hypot(forceProp.x-p.x,forceProp.y-p.y)||1;
    dx=(forceProp.x-p.x)/d; dy=(forceProp.y-p.y)/d;
    if(d<150){ dx*=0.12; dy*=0.12; }
    dx+=ax*1.1; dy+=ay*1.1;
    state='prop';
  }else if(BAL.SMART_AI && p.aiMode==='flee'){
    p.propTarget=null;
    // 逃げに徹する: 体力が薄ければ届くハートへ。降り口が開いていればそこへ、降りたいなら探索点へ、無ければ8方向の中で群れから遠く魔物の薄い床へ。細かい目当ては見ない
    let heart=null; if(p.hp<p.maxHp*0.7){ let td=300; for(const h2 of B.hearts){ if(G.map && (!passAt(h2.x,h2.y,false) || !reachableAt(h2.x,h2.y,false))) continue; if(gaveUp(h2)) continue; const d=Math.hypot(h2.x-p.x,h2.y-p.y); if(d<td){ td=d; heart=h2; } } }
    if(heart){ const sv=steerTo(p,heart.x,heart.y); dx=sv.x+ax*0.4; dy=sv.y+ay*0.4; state='heart'; }
    else{
      if(!p.escape || B.time>p.escape.until || Math.hypot(p.escape.x-p.x,p.escape.y-p.y)<50){
        let best=null, bs=-1e9;
        if(exitGo){ best={x:exX,y:exY}; }
        else for(let k=0;k<8;k++){ const a=k*TAU/8+Math.sin(B.time)*0.2, ca=Math.cos(a), sa=Math.sin(a); const q=snapFloor(clampMapX(p.x+ca*420,80),clampMapY(p.y+sa*320,80),false,6); if(!q||!reachableAt(q.x,q.y,false)) continue; const sc=-nearEnemyCount(q.x,q.y,220,true)*1.0-nearEnemyCount((p.x+q.x)/2,(p.y+q.y)/2,140,true)*0.7+(awx*ca+awy*sa)*2.5-(zoneFear(zoneAt(q.x,q.y))>=2?3:0); if(sc>bs){ bs=sc; best=q; } }
        p.escape=best?{x:best.x,y:best.y,until:B.time+2.5}:null;
      }
      if(p.escape){ const sv=steerTo(p,p.escape.x,p.escape.y); dx=sv.x+ax*0.5; dy=sv.y+ay*0.5; }
      else { const m=Math.hypot(ax,ay)||1; dx=ax/m; dy=ay/m; }
      state='retreat';
    }
  }else if(BAL.SMART_AI && p.aiMode==='kite' && threat<1.6){
    p.propTarget=null;
    // 引き撃ち: 群れの重心から離れつつ、空いている側へ寄る(武器は自動で撃つ)。下がる側のジェム・ハートだけ拾う(群れの方へは戻らない)
    let ox=0, oy=0, bs=-1e9; for(let k=0;k<8;k++){ const a=k*TAU/8; const qx=p.x+Math.cos(a)*200, qy=p.y+Math.sin(a)*150; if(!passAt(qx,qy,false)) continue; const sc=-nearEnemyCount(qx,qy,170,true)+(awx*Math.cos(a)+awy*Math.sin(a))*2; if(sc>bs){ bs=sc; ox=Math.cos(a); oy=Math.sin(a); } }
    dx=awx*0.55+ox*0.45+ax*0.6; dy=awy*0.55+oy*0.45+ay*0.6; state='kite2';
    if(exitGo){ dx=dx*0.7+(exX-p.x)/exitD*0.4; dy=dy*0.7+(exY-p.y)/exitD*0.4; }
    { const m0=Math.hypot(dx,dy)||1, ux=dx/m0, uy=dy/m0; let pick=null, pd=1e9, pk='';
      if(p.hp<p.maxHp*0.7){ for(const h2 of B.hearts){ if(G.map && (!passAt(h2.x,h2.y,false) || !reachableAt(h2.x,h2.y,false))) continue; if(gaveUp(h2)) continue; const hx=h2.x-p.x, hy=h2.y-p.y, d=Math.hypot(hx,hy)||1; if(d<260 && (hx*ux+hy*uy)/d>-0.2 && d<pd){ pd=d; pick=h2; pk='heart'; } } }
      if(!pick){ const mag=heroStat(p).magnet; for(const gm of B.gems){ const gx=gm.x-p.x, gy=gm.y-p.y, d=Math.hypot(gx,gy)||1; if(d<mag*0.9 || d>BAL.KITE_GEM_R) continue; if((gx*ux+gy*uy)/d<-0.25) continue; if(G.map && !passAt(gm.x,gm.y,false)) continue; if(d<pd){ pd=d; pick=gm; pk='gem'; } } }
      if(pick){ const sv=steerTo(p,pick.x,pick.y), wgt=pk==='heart'?0.75:0.65; dx=sv.x*wgt+ux*(1-wgt); dy=sv.y*wgt+uy*(1-wgt); if(pk==='heart') state='heart'; } }
  }else if(p.assist && Math.hypot(p.assist.x-p.x,p.assist.y-p.y)>BAL.ASSIST_R && threat<1.4){
    const sv=steerTo(p,p.assist.x,p.assist.y); dx=sv.x+ax*0.6; dy=sv.y+ay*0.6; state='assist';   // v3.0 仲間のそばへ
  }else if(threat>0.9){
    const m=Math.hypot(ax,ay)||1;
    dx=ax/m - (ay/m)*0.35*p.strafeDir;
    dy=ay/m + (ax/m)*0.35*p.strafeDir;
    state=bossNear?'boss':'flee';
    if(exitGo){ const k=exitOpen?0.5:0.35; dx=dx*0.65+(exX-p.x)/exitD*k; dy=dy*0.65+(exY-p.y)/exitD*k; }   // v2.1 逃げるなら降り口(か包囲位置)の方へ
  }else{
    let target=null, kind='';
    const allyCaptive=B.heroes.some(c=>c.out&&c.captive&&c!==p);   // v3.2 仲間が捕まっている間は、寄り道の直接目標(品・宝箱)を取らない(価値の割引だけでは足りなかった)
    p.propTarget=null;
    if(p.hp < p.maxHp*0.6){
      let td=420;
      for(const h2 of B.hearts){
        if(G.map && (!passAt(h2.x,h2.y,false) || !reachableAt(h2.x,h2.y,false))) continue;   // v2.1 届かない所の物は狙わない
        if(gaveUp(h2)) continue;
        const d=Math.hypot(h2.x-p.x,h2.y-p.y);
        if(d<td){ td=d; target=h2; kind='heart'; }
      }
      if(!target){
        let pd=480;
        for(const pr of B.props){
          const d=Math.hypot(pr.x-p.x,pr.y-p.y);
          if(d<pd){ pd=d; target=pr; kind='prop'; }
        }
        if(target) p.propTarget=target;
      }
    }
    if(!target && threat<0.6 && !allyCaptive){
      // 燭台からこぼれた品(全消去/全回収/流星群)は多少の脅威があっても拾いに行く
      let td=480;
      for(const it of B.items){
        if(G.map && (!passAt(it.x,it.y,false) || !reachableAt(it.x,it.y,false))) continue;   // v2.1 壁の向こうの品は諦める
        if(gaveUp(it)) continue;
        const d=Math.hypot(it.x-p.x,it.y-p.y);
        if(exitOpen && d>220) continue;   // v2.1 降りると決めたら、遠い品は追わない
        if(d<td){ td=d; target=it; kind='item'; }
      }
    }
    if(!target && threat<0.3 && !allyCaptive){
      let td=520;
      for(const c of B.chests){
        if(c.lewd && !c.known) continue;   // v2.2 えちえちエリアの箱は見つけてから
        if(G.map && (!passAt(c.x,c.y,false) || !reachableAt(c.x,c.y,false))) continue;   // 壁の中/届かない箱は狙わない(壁に貼りつかない)
        if(gaveUp(c)) continue;
        const d=Math.hypot(c.x-p.x,c.y-p.y);
        if(exitOpen && d>220) continue;   // v2.1 降りると決めたら、遠い箱は追わない
        if(d<td){ td=d; target=c; kind='chest'; }
      }
    }
    // v1.8 目当て: 行きたい先(光の柱・宝箱・落ちた品・場所・資源・探索)を選ぶ。
    // 脅威が薄ければそこへ歩き、ジェムは進む先の近いものだけ拾う。ジェム畑に長く留まったら(FARM_T)いったん歩き出す
    const goal=(!target && G.map) ? updateGoal(p) : null;
    let walk=false, goalOk=false, atGoal=false;
    if(goal){
      const leaving=!!B.wantExit;
      const urgent=goal.kind==='event'||goal.kind==='item'||goal.score>=1.2||(goal.kind==='poi'&&goal.sub==='stairs')||(leaving&&goal.kind==='explore');   // v2.1 降り口(と、降り口を探す探索)は急ぎ
      goalOk = threat<(urgent?0.6:0.3);                                   // 脅威が濃いときは目当てへ歩かない(牽制/回避に戻る)
      // v2.1 目当てがあるなら歩く。ジェムは進む先の「道すがら」だけ拾う(ジェム畑と目当ての間を往復しない)。ジェムの群れそのものが目当てなら普通に拾い集める
      walk = goalOk && goal.kind!=='gems' && (goal.kind!=='explore' || leaving);
      atGoal = walk && Math.hypot(goal.x-p.x,goal.y-p.y)<90;
      // v2.1 ジェムに足を取られない: 目当てへ歩いているのに GOAL_STALL_T 秒で60px も近づけなければ(降り続けるジェムを拾い続けている)、GEM_FAST_T 秒は足元以外のジェムを拾わない
      if(walk){ const gd=Math.hypot(goal.x-p.x,goal.y-p.y), gk=giveUpKey(goal);
        if(p.gKey!==gk){ p.gKey=gk; p.gBest=gd; p.gT=B.time; }
        else if(gd<p.gBest-60){ p.gBest=gd; p.gT=B.time; }
        else if(B.time-p.gT>BAL.GOAL_STALL_T){ p.noGemUntil=B.time+BAL.GEM_FAST_T; p.gT=B.time; p.gBest=gd; B.nGemFast=(B.nGemFast||0)+1; sayLine('gemFast',0,30,'キラキラは、あとで! すすむ!'); }
      } else p.gKey=null;
    }
    if(!target){
      // ジェム回収。ガス溜まりの中のジェムは基本見送る——
      // ただし中のジェムが多ければ、意を決して取りに入る
      const gemFast=B.time<(p.noGemUntil||0), mag=heroStat(p).magnet;
      let bestGm=null, bd=gemFast?0:(walk?((B.wantExit||pressure()>=1.5)?BAL.GEM_WALK_R_LEAVE:BAL.GEM_WALK_R):430), bestCl=null;   // v2.1 ジェム断ち中は狙わない。降りると決めた後・圧が高い時は、道すがらの半径を狭く
      const gx=goal?goal.x-p.x:0, gy=goal?goal.y-p.y:0, gdn=Math.hypot(gx,gy)||1;
      for(const gm of B.gems){
        const d=Math.hypot(gm.x-p.x,gm.y-p.y);
        if(d>=bd) continue;
        if(atGoal && d>40) continue;   // v2.1 目当てに着いたら、足元のジェム以外は後で(降り口で立ち続けられる)
        if(walk && d<mag*0.9) continue;   // v2.1 歩いている時、磁石が拾ってくれる距離のジェムは追わない(飛んでくるジェムを追い回して足が止まらない)
        if(walk && d>44 && (((gm.x-p.x)*gx+(gm.y-p.y)*gy)/(gdn*(d||1))<-0.1 || d+Math.hypot(goal.x-gm.x,goal.y-gm.y)>gdn+120)) continue;   // v2.1 歩くときは進む先の、寄り道120px以内のジェムだけ
        if(nearKnownTrap(gm.x,gm.y)) continue;   // 知っている罠のそばのジェムは諦める
        { const gz=zoneAt(gm.x,gm.y); if(zoneFear(gz)>=2.5 && !(p.brave&&p.brave[gz]>B.time)) continue; }   // v2.2 「入りたくない」地形(甘い褥など)のジェムだけ諦める。浅瀬や花園は拾いに行く
        if(G.map && (!passAt(gm.x,gm.y,false) || !reachableAt(gm.x,gm.y,false))) continue;   // 壁に埋まった/届かないジェムは諦める
        if(gaveUp(gm)) continue;
        const cl=cloudAt(gm.x,gm.y);
        if(cl && p.diveT<=0){
          const w=cloudWorth(cl);
          if(w.n<BAL.DIVE_GEM_N && w.v<BAL.DIVE_GEM_V) continue;   // 割に合わない: 諦める
        }
        bd=d; bestGm=gm; bestCl=cl;
      }
      if(bestGm){
        target=bestGm; kind='gem';
        if(walk) sayLine('gemWalk',0,40);   // v2.1 道すがらの回収
        if(bestCl && p.diveT<=0){
          p.diveT=BAL.DIVE_T;
          heroBubble(p,'……すぅ。ちょっとだけ、だからっ');
        }
      }
    }
    if(!target && goalOk){ target=goal; kind='g_'+(goal.kind==='event'?'event':(goal.kind==='item'?'item':goal.sub)); }
    if(target && kind==='g_stairs' && exitGuard) target={x:exX,y:exY};   // v2.1 番兵が居るうちは輪の外側から撃つ
    // v2.1 諦めの見張り: 同じ目標へ向かって GIVEUP_T 秒近づけなければ(壁の向こう・入口で弾かれる・押し合い)、その目標を外して他へ。燭台(撃つ間は止まる)と降り口の上は除く
    if(target && kind!=='prop' && !(kind==='g_stairs' && exitGuard)){
      const key=giveUpKey(target), d0=Math.hypot(target.x-p.x,target.y-p.y);
      // v3.2 「その場に立つ」のが仕事の目当て(救出・封印石・清水・祠・泉・降り口・巣窟の待機)は、着いて立っている間だけ見張りを止める。
      //      それ以外(箱・品・資源・探索)は元どおり見張る——止めてしまうと、届かない物のそばで壁ぞいに回り続けた
      const standKind=(kind==='g_rescue'||kind==='g_wait'||kind==='g_seal'||kind==='g_pool'||kind==='g_stele'||kind==='g_shrine'||kind==='g_spring'||kind==='g_stairs');
      if(p.tgtKey!==key){ p.tgtKey=key; p.tgtBest=d0; p.tgtT=B.time; p.tgtNear=0; }
      else{
        if(d0<90 && !p.tgtNear) p.tgtNear=B.time;
        const standing=standKind && d0<90 && (kind==='g_wait' || B.time-(p.tgtNear||B.time)<BAL.GIVEUP_NEAR_T);
        if(standing || d0<p.tgtBest-14){ p.tgtBest=Math.min(p.tgtBest,d0); p.tgtT=B.time; }
        else if(B.time-p.tgtT>BAL.GIVEUP_T){
          giveUpOn(target); B.nGiveUp=(B.nGiveUp||0)+1;
          if(p.goal && (giveUpKey(p.goal)===key || p.goal===target)){ if(p.goal.kind==='explore'){ p.explore=null; p.exploreUntil=0; } p.goal=null; p.goalT=0; }
          p.path=null; p.tgtKey=null; p.tgtNear=0; target=null; kind='';
          sayLine('giveUp',0,20,'……とれない。あとで!');
        }
      }
    } else p.tgtKey=null;
    if(target){
      const d=Math.hypot(target.x-p.x,target.y-p.y)||1;
      const sv=steerTo(p,target.x,target.y);   // 見えていれば直進、壁があれば経路
      dx=sv.x; dy=sv.y;
      state=kind;
      if(B.time<(p.pauseUntil||0) && threat<0.3 && kind!=='g_stairs' && attachCount(p)===0){ dx=0; dy=0; state='think'; }   // v2.2 目当てを変えた直後の一拍
      else if(kind!=='g_stairs' && kind!=='heart' && kind!=='prop' && kind!=='g_wait' && kind!=='g_rescue' && !B.wantExit && threat<0.5 && attachCount(p)===0){   // v3.2 外で待つ・救出は迷いに掛けない(待つだけで巣窟を「怖い所」と覚えて、踏み込めなくなっていた)
        // v2.2 迷い: 進む先が嫌な地形(学習済み)かえちえちエリアなら、境で足を止めて迷う。報酬と体調で入るか諦めるか決める
        if(p.hesit && p.hesit.key!==giveUpKey(target)) p.hesit=null;   // 目標が変わったら迷いも仕切り直し
        if(p.hesit){
          // 迷っている最中: 境から半歩下がって左右に揺れる。時間が来たら必ず決める(入る/諦める)
          if(B.time<p.hesit.until){ const sw=Math.sin(B.time*2.6), ux=dx, uy=dy; dx=-ux*0.3-uy*sw*0.25; dy=-uy*0.3+ux*sw*0.25; state='hesitate'; }
          else{
            const nz=p.hesit.zone, worth=p.hesit.worth||(p.goal&&p.goal.worth)||1.5, hpR=p.hp/p.maxHp, aroused=p.aphro>=45||p.heatLv>0||p.sensit>=60;
            const hn=(p.hesitN&&p.hesitN[nz])||0;   // v2.3 同じ地形で何度も迷った回数(迷うたびに入る確率が上がる→迷い続けない)
            const pe=((p.hesit.fear||2)>=3?0.35:0.65)+(worth>=2.6?0.3:(worth>=2?0.15:0))+(hpR>0.7?0.15:-0.1)+(aroused?0.25:0)+BAL.HESIT_ESC*hn;   // v2.2 段が高いほど入りにくい。媚薬まみれなら「もういいや」
            if(Math.random()<pe){ p.brave=p.brave||{}; p.brave[nz]=B.time+60; B.nBrave=(B.nBrave||0)+1; if(p.hesitN) p.hesitN[nz]=0; sayLine(aroused?'resign':(hn>=2?'braveFinally':'brave'),1,0,'……いく! ちょっとだけ!'); }
            else{ p.scared=p.scared||{}; p.scared[nz]=B.time+BAL.SCARED_T; p.hesitN=p.hesitN||{}; p.hesitN[nz]=hn+1; B.nChicken=(B.nChicken||0)+1; giveUpOn(target); if(p.goal && (giveUpKey(p.goal)===giveUpKey(target)||p.goal===target)){ if(p.goal.kind==='explore'){ p.explore=null; p.exploreUntil=0; } p.goal=null; p.goalT=0; } sayLine('chicken',1,0,'やめとく……こわいし'); dx=0; dy=0; state='hesitate'; }
            p.hesit=null;
          }
        }else{
          const nz=zoneAt(p.x+dx*44,p.y+dy*44);
          if(nz!==p.zone && p.scared && p.scared[nz]>B.time){ giveUpOn(target); if(p.goal && (giveUpKey(p.goal)===giveUpKey(target)||p.goal===target)){ if(p.goal.kind==='explore'){ p.explore=null; p.exploreUntil=0; } p.goal=null; p.goalT=0; } dx=-dx*0.5; dy=-dy*0.5; state='hesitate'; }   // 諦めた地形へは、しばらく入らない(探索点なら捨てて別の点を選ぶ)
          const nf=(nz!==p.zone)?zoneFear(nz):0;   // v2.2 嫌い方の段: <2 は気にせず入る / 2 は短く迷う / 3 は価値が無ければ入らず、あれば長く迷う
          const scary=nf>=2 && !(p.brave&&p.brave[nz]>B.time) && !(p.scared&&p.scared[nz]>B.time);
          if(scary){
            const worth=(p.goal&&p.goal.worth)?p.goal.worth:(kind==='chest'?(target.bossChest?3.0:2.6):(kind==='item'?3.0:(kind==='heart'?3.2:1.5)));   // 目当てが無い直接の目標(箱・品)は種類から価値を見る
            const aroused=p.aphro>=45||p.heatLv>0||p.sensit>=60;   // v2.2 媚薬まみれなら「もういいや」で腰が軽い
            const hn=(p.hesitN&&p.hesitN[nz])||0;
            if(nf>=3 && worth<BAL.FEAR3_WORTH*(aroused?0.5:1)*Math.max(0.4,1-0.25*hn)){   // 入りたくない地形に、それほどの用は無い→迷わず引き返す(v2.3 引き返した回数だけ敷居が下がり、やがて迷い始める)
              p.scared=p.scared||{}; p.scared[nz]=B.time+BAL.SCARED_T; p.hesitN=p.hesitN||{}; p.hesitN[nz]=hn+1; B.nChicken=(B.nChicken||0)+1; giveUpOn(target); if(p.goal && (giveUpKey(p.goal)===giveUpKey(target)||p.goal===target)){ if(p.goal.kind==='explore'){ p.explore=null; p.exploreUntil=0; } p.goal=null; p.goalT=0; } sayLine('chicken',1,0,'そこは、いかない!'); dx=0; dy=0; state='hesitate';
            }else{
              p.hesit={zone:nz, fear:nf, worth, until:B.time+(nf>=3?2.0+Math.random()*1.6:1.0+Math.random()*1.0)*(aroused?0.6:1), key:giveUpKey(target)}; B.nHesit=(B.nHesit||0)+1; sayLine(aroused?'resign':(hn>=1?'hesitateAgain':'hesitate'),1,0,'……はいる? はいらない?'); const sw=Math.sin(B.time*2.6), ux=dx, uy=dy; dx=-ux*0.3-uy*sw*0.25; dy=-uy*0.3+ux*sw*0.25; state='hesitate';
            }
          }
        }
      }
      else if(p.hesit) p.hesit=null;   // 迷いの条件が外れた(脅威・拘束・降り口など)なら仕切り直し
      if(kind==='prop' && d<150){ dx*=0.12; dy*=0.12; }   // 燭台を撃ち壊す間は足を止める
      // v2.1 壁の反発のうち、進路(dx,dy)と逆向きの成分は外す(細い入口で押し戻されて回らない)。横へ寄せる成分(通路の真ん中へ)は残す
      { let cx=wpx, cy=wpy; const sm=Math.hypot(dx,dy)||1, ux=dx/sm, uy=dy/sm, dot=cx*ux+cy*uy; if(dot<0){ cx-=ux*dot; cy-=uy*dot; }
        const wf=(p.path&&p.path.length)?0.6:1.0;
        dx+=(ax-wpx+cx*wf); dy+=(ay-wpy+cy*wf); }
    }else{
      let ne=null, nd=1e9;
      for(const e of B.enemies){
        if(e.dead||e.dormant||e.state==='attached'||e.id==='imp') continue;
        if(!inSight(e,p)) continue;
        const d=Math.hypot(e.x-p.x,e.y-p.y);
        if(d<nd){ nd=d; ne=e; }
      }
      if(exitGo){
        const sv=steerTo(p,exX,exY); dx=sv.x*0.9; dy=sv.y*0.9; state='g_stairs';   // v2.1 牽制するより、降り口(か包囲位置)へ歩く
      }else if(ne){
        const ex=(ne.x-p.x)/nd, ey=(ne.y-p.y)/nd;
        if(nd>260){ dx=ex*0.7; dy=ey*0.7; }
        else if(nd<130){ dx=-ex; dy=-ey; }
        else { dx=-ey*p.strafeDir; dy=ex*p.strafeDir; }
        state='kite';
      }else{
        dx=Math.cos(B.time*0.6)*0.3; dy=Math.sin(B.time*0.43)*0.3;
        state='wait';
      }
      dx+=ax*1.5; dy+=ay*1.5;
    }
  }
  // 学習した強敵の狙いを見たら、いま何をしていても横へ跳ぶのを優先する(捕まっている時以外)
  if(strong && state!=='struggle'){
    const m=Math.hypot(ddx,ddy)||1;
    dx=dx*0.3+ddx/m*1.2; dy=dy*0.3+ddy/m*1.2;
    state='dodge'; p.dodging=0.5;
  }
  // 魅了の発作: 無意識にその種族の最寄り個体へ寄っていく(Lv2+)
  if(p.charmDrift){
    const cm=nearestOfId(p.charmDrift.id);
    if(!cm){ p.charmDrift=null; }
    else{
      const cd=Math.hypot(cm.x-p.x,cm.y-p.y)||1;
      dx=(cm.x-p.x)/cd; dy=(cm.y-p.y)/cd;
      dx+=Math.sin(B.time*2.4)*0.15; dy+=Math.cos(B.time*2.1)*0.15;
      state='charmwalk';
    }
  }
  // 発情の波(Lv2+): 熱に負けて、いちばん近い魔物へふらふらと寄ってしまう
  if(state!=='charmwalk' && p.waveDur>0 && p.heatLv>=2 && attachCount(p)===0){
    let ne=null, nd=1e9;
    for(const e of B.enemies){
      if(e.dead||e.dormant||e.state==='attached') continue;
      const d=Math.hypot(e.x-p.x,e.y-p.y);
      if(d<nd){ nd=d; ne=e; }
    }
    if(ne && nd<260){
      const k2=p.heatLv>=3?0.9:0.5;
      const ex=(ne.x-p.x)/nd, ey=(ne.y-p.y)/nd;
      dx=dx*(1-k2)+ex*k2; dy=dy*(1-k2)+ey*k2;
      state='heatwalk';
    }
  }
  // v3.0 パーティ: 相手から離れすぎない(PARTY_LEASH を超えるほど強く寄る)。重なりすぎたら少し離れる。相談の間は足を止める
  { const waiting=!!(B.party&&B.party.denRole&&B.party.denRole.wait===p.hi);   // v3.2 外で待つ役は引っぱられない(自分で口の前を歩いて間合いを取る)
    const o=waiting?null:partnerOf(p); if(o){ const ddx=o.x-p.x, ddy=o.y-p.y, dd=Math.hypot(ddx,ddy)||1;
      if(dd>BAL.PARTY_LEASH){ const w=Math.min(1.4,(dd-BAL.PARTY_LEASH)/200); dx+=ddx/dd*w; dy+=ddy/dd*w; }
      else if(dd<BAL.PARTY_SEP && attachCount(p)===0){ dx-=ddx/dd*0.45; dy-=ddy/dd*0.45; } } }
  if(B.party && B.time<B.party.talkUntil && attachCount(p)===0 && threat<0.6){ dx*=0.05; dy*=0.05; state='talk'; const o=partnerOf(p); if(o && Math.abs(o.x-p.x)>6) p.face=o.x>p.x?1:-1; }   // v3.1 話す間は相手の方を向く
  p.steerX=dx; p.steerY=dy; p.steerState=state; p.threatV=threat;   // v3.1 脅威の見積もりを残す(集合の判定に使う)
}

/* 知っている(理解以上)罠のそば */
/* v2.0 淫紋への知識: 刻印師の知識か、紋の罠に掛かった回数(1=認識 / 3=理解 / 6=熟知)。認識で罠を避け、理解で呪弾を強く外し、熟知なら4割で紋を払う */
function crestKnow(){ const k=((META.gen.trapKnow||{}).rune)||0; return Math.max(knowLv('runemage'), knowLv('guardian'), k>=6?3:(k>=3?2:(k>=1?1:0))); }
function learnTrap(kind){ META.gen.trapKnow=META.gen.trapKnow||{}; META.gen.trapKnow[kind]=(META.gen.trapKnow[kind]||0)+1; }
function nearKnownTrap(x,y){
  const B=G.B;
  for(const e of B.enemies){
    if(e.dead||!TRAP_SPECIES.has(e.id)) continue;
    if(knowLv(e.id)<2) continue;
    if(Math.hypot(e.x-x,e.y-y)<95) return true;
  }
  return false;
}
/* ================= ヒロイン武器 ================= */
function nearestEnemies(n,maxD){
  maxD*=1+0.12*((G.B&&G.B.hero.ps.reach)||0);   // v2.0 とおくの手
  const B=G.B, p=B.hero;
  const arr=[];
  for(const e of B.enemies){
    const grabber=!!(p.assist && ((e.state==='attached' && e.ti===p.assist.hi) || p.assist.pinBy===e));   // v3.0 仲間を掴んでいる魔物
    if(e.dead||e.dormant||(e.state==='attached'&&!grabber)) continue;
    if(!inSight(e,p)) continue;                       // 見えていない敵は撃てない
    let d=Math.hypot(e.x-p.x,e.y-p.y); if(grabber) d*=0.25;
    // 魅了された相手は狙いが後回し(距離に下駄)。理解した脅威は優先討伐(距離を差し引く)
    const prio=knowLv(e.id)>=2?(SPEC_THREAT[e.id]||0)*90:0;
    arr.push({e, d:d+charmLvFor(p,e)*140-prio});
    if(d>=maxD) arr.pop();
  }
  arr.sort((a,b)=>a.d-b.d);
  return arr.slice(0,n).map(o=>o.e);
}
/* v1.9 武器の覚醒(Lv6〜8): 従来の式は Lv5 で止め、超えた段ぶんを火力・間隔・範囲に掛ける(進化後も効く) */
function wpOver(lv){ const ov=Math.max(0,lv-BAL.WP_EVO_LV); return {dmg:1+BAL.WP_OVER_DMG*ov, cd:Math.pow(BAL.WP_OVER_CD,ov), area:1+BAL.WP_OVER_AREA*ov}; }
function weaponsUpdate(dt){
  const B=G.B, p=B.hero;
  const atkMult=((p.pinned||p.charmBind||p.climaxT>0||p.freezeT>0||p.begT>0||p.selfT>0||p.sniffT>0||p.bathT>0||p.poolT>0||p.readT>0)?0:1)*Math.pow(0.75,armCount(p))   // 腕を拘束されるほど攻撃が乱れる
    *(p.waveDur>0?BAL.WAVE_ATK:1)                                           // 発情の波の間は手が止まりがち
    *(p.numbT>0?0.5:1)                                                      // 痺れ: 指が動かない
    *(1+0.08*p.ps.haste);                                                   // クイックリボン
  if(atkMult<=0) return;
  if(p.id==='freila') freilaWeapons(p,dt,atkMult);   // v3.0 火の武器
  if(p.wp.bolt>0){
    p.boltT-=dt*atkMult;
    if(p.boltT<=0){
      const evo=p.evo.sstar>0;
      const lvR=p.wp.bolt, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR);
      const shots=(evo?7:Math.min(5,1+Math.ceil(lv*0.8)))+dupN(p);   // 手数で強くなる
      // 回復が要るときは燭台を狙う
      const wantProp=p.propTarget && !p.propTarget.dead &&
        (p.hp<p.maxHp*0.55 || nearestEnemies(1,300).length===0);
      if(wantProp){
        const t=p.propTarget;
        const d=Math.hypot(t.x-p.x,t.y-p.y);
        if(d<460 && B.bullets.length<150){
          p.boltT=0.55;
          const a=Math.atan2((t.y-10)-(p.y-14), t.x-p.x);
          B.bullets.push({x:p.x,y:p.y-14,vx:Math.cos(a)*460,vy:Math.sin(a)*460,
            dmg:(15+5*(lv-1))*ov.dmg, pierce:0, life:1.2, last:null, evo:false});
          S.pew();
          if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN);
        }else p.boltT=0.15;
      }else{
        const ts=nearestEnemies(shots,evo?640:560);
        if(ts.length && B.bullets.length<150){
          p.boltT=(evo?0.55:0.7)*Math.pow(0.87,lv-1)*ov.cd;
          for(let i=0;i<shots;i++){
            const t=ts[Math.min(i,ts.length-1)];
            const dx=t.x-p.x, dy=(t.y-t.r)-(p.y-14);
            const sp=evo?520:460, spread=(i-(shots-1)/2)*0.06;
            const a=Math.atan2(dy,dx)+spread;
            B.bullets.push({x:p.x,y:p.y-14,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,
              dmg:(evo?21:15+5*(lv-1))*ov.dmg, pierce:(evo?2:(lv>=4?1:0))+(p.ps.pierce||0), life:1.3, last:null, evo});
          }
          S.pew();
          if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN);
        }else if(!ts.length){ p.boltT=0.12; }
      }
    }
  }
  if(p.wp.orb>0){
    p.orbAng += (2.0+0.15*p.wp.orb)*dt;
  }
  if(p.wp.nova>0){
    p.novaT-=dt*atkMult;
    if(p.novaT<=0){
      const evo=p.evo.sburst>0;
      const lvR=p.wp.nova, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR);
      p.novaT=((evo?4.0:4.3)-0.4*(lv-1))*ov.cd;
      const R=(evo?180:100+20*(lv-1))*areaMult(p)*ov.area, dmg=(evo?34:16+7*(lv-1))*ov.dmg;
      p.novaAnim=0.5; p.novaR=R;
      G.shake=Math.min(7,G.shake+3);
      S.nova();
      for(const e of B.enemies){
        if(e.dead||e.dormant) continue;
        const dx=e.x-p.x, dy=e.y-p.y, d=Math.hypot(dx,dy);
        if(d<R+e.r){
          damageEnemy(e,dmg);                        // 絡みついた個体もノヴァでは剥がし得る
          if(d>0.01 && !e.boss && e.state!=='attached' && MONSTERS[e.id].spd>0){ e.x+=dx/d*30; e.y+=dy/d*30; e.stun=Math.max(e.stun,evo?0.6:0.35); }
        }
      }
      for(const pr of B.props){
        if(Math.hypot(pr.x-p.x,pr.y-p.y)<R+12) damageProp(pr,dmg);
      }
      if(evo){ for(const gm of B.gems){ if(Math.hypot(gm.x-p.x,gm.y-p.y)<R*2) gm.sp=Math.max(gm.sp,700); } }
      parts(p.x,p.y-10,evo?24:14,['#fff','#ffd76a','#8fd3ff'],evo?200:140,0.5);
      if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN);
    }
  }
  /* --- プリズムウィップ: 前方(交互に前後)を薙ぎ払う。進化=全方位 --- */
  if(p.wp.whip>0){
    p.whipT-=dt*atkMult;
    if(p.whipT<=0){
      const evo=p.evo.srush>0, lvR=p.wp.whip, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR);
      p.whipT=(evo?0.65:1.0)*Math.pow(0.9,lv-1)*ov.cd;
      p.whipSide*=-1;
      const range=(evo?165:105+11*lv)*areaMult(p)*ov.area, half=(evo?165:46+5*lv)*areaMult(p)*ov.area;
      const dmg=(evo?22:10+4*(lv-1))*ov.dmg;
      p.whipAnim=0.16;
      p.whipDir=evo?0:(p.whipSide>0?p.face:-p.face);   // 0=全方位
      p.whipR=range;
      let hit=false;
      for(const e of B.enemies){
        if(e.dead||e.dormant) continue;
        const ex=e.x-p.x, ey=e.y-(p.y-10);
        const inArc=evo ? Math.hypot(ex,ey)<range+e.r
                        : (ex*p.whipDir>0 && Math.abs(ex)<range+e.r && Math.abs(ey)<half+e.r);
        if(inArc){ damageEnemy(e,dmg); hit=true; }
      }
      for(const pr of B.props){
        const ex=pr.x-p.x, ey=pr.y-(p.y-10);
        const inArc=evo ? Math.hypot(ex,ey)<range
                        : (ex*p.whipDir>0 && Math.abs(ex)<range && Math.abs(ey)<half);
        if(inArc) damageProp(pr,dmg);
      }
      if(hit){ sfx(240,520,0.08,'sawtooth',0.04); if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN); }
    }
  }
  /* --- スターレイン: 敵の頭上へ流れ星を降らせる(着弾で小範囲) --- */
  if(p.wp.rain>0){
    p.rainT-=dt*atkMult;
    if(p.rainT<=0){
      const evo=p.evo.scomet>0, lvR=p.wp.rain, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR);
      p.rainT=(evo?1.5:2.3)*Math.pow(0.88,lv-1)*ov.cd;
      const drops=(evo?6:1+Math.ceil(lv/2))+dupN(p);
      const ts=nearestEnemies(drops*2,540);
      let fired=false;
      for(let i=0;i<drops;i++){
        const t=ts.length?ts[(Math.random()*ts.length)|0]:null;
        if(!t) break;
        const tx=t.x+rand(-26,26), ty=t.y+rand(-16,16);
        if(B.bullets.length<170){
          B.bullets.push({kind:'rain', x:tx+rand(-40,40), y:ty-300, tx, ty,
            vx:0, vy:540, dmg:(evo?26:12+5*(lv-1))*ov.dmg, splash:(evo?76:48)*areaMult(p)*ov.area, life:1.0, last:null, evo});
          fired=true;
        }
      }
      if(fired) sfx(880,380,0.14,'sine',0.03);
      else p.rainT=0.2;
    }
  }
  /* --- クロスブーメラン: 貫通して飛び、手元へ帰ってくる --- */
  if(p.wp.cross>0){
    p.crossT-=dt*atkMult;
    if(p.crossT<=0){
      const evo=p.evo.sjudge>0, lvR=p.wp.cross, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR);
      const ts=nearestEnemies(1,500);
      if(ts.length && B.bullets.length<170){
        p.crossT=(evo?1.3:1.7)*Math.pow(0.9,lv-1)*ov.cd;
        const a=Math.atan2((ts[0].y-ts[0].r)-(p.y-12), ts[0].x-p.x);
        const sp=evo?430:360;
        const nC=1+dupN(p);
        for(let i=0;i<nC;i++){
          const a2=a+(i-(nC-1)/2)*0.4;
          B.bullets.push({kind:'cross', x:p.x, y:p.y-12, vx:Math.cos(a2)*sp, vy:Math.sin(a2)*sp,
            spd:sp, dmg:(evo?20:9+4*(lv-1))*ov.dmg, retT:evo?0.55:0.42, ret:false, life:2.4, last:null, evo});
        }
        sfx(320,180,0.12,'square',0.04);
        if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN);
      }else p.crossT=0.15;
    }
  }
  /* --- せいいき: 常時の光の領域。触れた敵を焼き続ける。進化=広域+自己回復 --- */
  if(p.wp.sanct>0){
    const evo=p.evo.gsanct>0, lvR=p.wp.sanct, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR);
    p.sanctPulse+=dt*atkMult;
    p.sanctR=((evo?130:70+8*lv))*areaMult(p)*ov.area;
    if(p.sanctPulse>=0.5){
      p.sanctPulse-=0.5;
      const dmg=(evo?14:6+3*(lv-1))*ov.dmg;
      let hit=false;
      for(const e of B.enemies){
        if(e.dead||e.dormant) continue;
        if(Math.hypot(e.x-p.x,e.y-(p.y-8))<p.sanctR+e.r){ damageEnemy(e,dmg); hit=true; }
      }
      if(evo) p.hp=Math.min(p.maxHp,p.hp+0.6);
      if(hit && restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN*0.5);
    }
  }
  /* --- ひかりの刃: 向いている方向へ刃を投げる(貫通1)。進化=前後に嵐 --- */
  if(p.wp.blade>0){
    p.bladeT-=dt*atkMult;
    if(p.bladeT<=0){
      const evo=p.evo.kblade>0, lvR=p.wp.blade, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR);
      p.bladeT=(evo?0.42:0.85)*Math.pow(0.9,lv-1)*ov.cd;
      const n=(evo?4:1+Math.floor(lv/2))+dupN(p);
      const dirs=evo?[p.face,-p.face]:[p.face];
      for(const dir of dirs){
        for(let i=0;i<n;i++){
          if(B.bullets.length>=170) break;
          const spread=(i-(n-1)/2)*0.07;
          const sp=580;
          B.bullets.push({kind:'blade', x:p.x+dir*8, y:p.y-14+(i-(n-1)/2)*4, vx:Math.cos(spread)*sp*dir, vy:Math.sin(spread)*sp,
            dmg:(evo?16:10+3*(lv-1))*ov.dmg, pierce:(evo?3:1)+(p.ps.pierce||0), life:0.9, last:null, evo});
        }
      }
      sfx(700,300,0.06,'square',0.03);
      if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN*0.6);
    }
  }
  /* --- てんらい: 見えている敵の頭上に雷を落とす(ランダム)。進化=一斉 --- */
  if(p.wp.thunder>0){
    p.thunderT-=dt*atkMult;
    if(p.thunderT<=0){
      const evo=p.evo.judgment>0, lvR=p.wp.thunder, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR);
      const n=(evo?6:1+Math.floor((lv+1)/2))+dupN(p);
      const ts=nearestEnemies(n*3,440);
      if(ts.length){
        p.thunderT=(evo?2.0:2.6)*Math.pow(0.9,lv-1)*ov.cd;
        const splash=(evo?52:34)*areaMult(p)*ov.area, dmg=(evo?30:18+6*(lv-1))*ov.dmg;
        const picked=shuffle(ts.slice()).slice(0,n);
        for(const t of picked){
          for(const e of B.enemies){
            if(e.dead||e.dormant) continue;
            if(Math.hypot(e.x-t.x,e.y-t.y)<splash+e.r) damageEnemy(e,dmg);
          }
          B.fx.push({kind:'bolt', x:t.x, y:t.y-t.r, t:0, life:0.22});
          parts(t.x,t.y-t.r,7,['#fff','#8fd3ff','#ffd76a'],120,0.4);
        }
        sfx(900,120,0.14,'sawtooth',0.05);
        G.shake=Math.min(6,G.shake+2);
        if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN*0.8);
      }else p.thunderT=0.2;
    }
  }
  /* --- v2.0 せいさ(聖鎖): いちばん近い敵へ鎖を打ち、線上の敵を薙いで短く縛る。進化=三条 --- */
  if(p.wp.chain>0){
    p.chainT-=dt*atkMult;
    if(p.chainT<=0){
      const evo=p.evo.hchain>0, lvR=p.wp.chain, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR);
      const ts=nearestEnemies(evo?4:(lv>=4?2:1),(evo?300:240)*areaMult(p));
      if(ts.length){
        p.chainT=(evo?0.9:1.15)*Math.pow(0.92,lv-1)*ov.cd;
        const dmg=(evo?26:12+5*(lv-1))*ov.dmg, wdt=(evo?20:16)*areaMult(p)*ov.area;
        for(const t of ts){
          const x1=p.x, y1=p.y-14, x2=t.x, y2=t.y-t.r*0.6, L=Math.hypot(x2-x1,y2-y1)||1, ux=(x2-x1)/L, uy=(y2-y1)/L;
          for(const e of B.enemies){
            if(e.dead||e.dormant) continue;
            const rx=e.x-x1, ry=(e.y-e.r*0.6)-y1, al=rx*ux+ry*uy; if(al<0||al>L+e.r) continue;
            const px=rx-ux*al, py=ry-uy*al; if(Math.hypot(px,py)<wdt+e.r*0.6){ damageEnemy(e,dmg); if(!e.boss) e.stun=Math.max(e.stun,evo?0.9:0.55); }
          }
          B.fx.push({kind:'chain',x:x1,y:y1,x2,y2,t:0,life:0.28,evo});
        }
        sfx(700,260,0.12,'square',0.04);
        if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN);
      }else p.chainT=0.15;
    }
  }
  /* --- v2.0 みちびきの精霊: 敵を追う小さな光。当たれば小範囲ではぜる。進化=四つ --- */
  if(p.wp.spirit>0){
    p.spiritT-=dt*atkMult;
    if(p.spiritT<=0){
      const evo=p.evo.twinspirit>0, lvR=p.wp.spirit, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR);
      const ts=nearestEnemies(1,520);
      if(ts.length && B.bullets.length<170){
        p.spiritT=(evo?1.1:1.7)*Math.pow(0.9,lv-1)*ov.cd;
        const n=(evo?4:1+Math.floor(lv/3))+dupN(p);
        for(let i=0;i<n;i++){ const a=rand(TAU); B.bullets.push({kind:'spirit', x:p.x+Math.cos(a)*18, y:p.y-14+Math.sin(a)*12, vx:Math.cos(a)*120, vy:Math.sin(a)*120, spd:evo?300:240, turn:evo?6:4, dmg:(evo?24:14+5*(lv-1))*ov.dmg, splash:(evo?54:40)*areaMult(p)*ov.area, life:3.0, target:null, last:null, evo}); }
        sfx(900,1300,0.15,'sine',0.03);
      }else p.spiritT=0.2;
    }
  }
  /* --- v2.0 ひかりの盾: 向いている側に光の弧。触れた敵を焼き、敵弾(呪弾)を弾く。進化=全方位 --- */
  if(p.wp.shield>0){
    const evo=p.evo.aegis>0, lvR=p.wp.shield, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR);
    p.shieldPulse+=dt*atkMult; p.shieldR=(evo?52:38+3*lv)*areaMult(p)*ov.area; p.shieldArc=evo?TAU:Math.PI*(0.9+0.1*lv);
    if(Math.hypot(p.vx,p.vy)>20) p.shieldAng=Math.atan2(p.vy,p.vx); else if(!p.shieldArc||p.shieldAng===0) p.shieldAng=p.face>0?0:Math.PI;
    const inArc=(a)=>{ let da=((a-p.shieldAng+Math.PI*3)%TAU)-Math.PI; return Math.abs(da)<=p.shieldArc/2; };
    for(const b of B.ebullets){ if(b.dead) continue; const dx=b.x-p.x, dy=b.y-(p.y-10), d=Math.hypot(dx,dy); if(d<p.shieldR+b.r && inArc(Math.atan2(dy,dx))){ b.dead=true; parts(b.x,b.y,8,['#fff','#8fd3ff'],120,0.4); sfx(1200,600,0.08,'square',0.04); } }
    if(p.shieldPulse>=0.5){
      p.shieldPulse-=0.5; const dmg=(evo?12:5+2*(lv-1))*ov.dmg; let hit=false;
      for(const e of B.enemies){ if(e.dead||e.dormant||e.state==='attached') continue; const dx=e.x-p.x, dy=e.y-(p.y-10), d=Math.hypot(dx,dy)||0.001; if(d<p.shieldR+e.r && inArc(Math.atan2(dy,dx))){ damageEnemy(e,dmg); hit=true; if(!e.boss && MONSTERS[e.id].spd>0){ e.x+=dx/d*10; e.y+=dy/d*10; } } }
      if(hit && restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN*0.5);
    }
  }
  /* --- せいすい: 聖水を投げ、地面に清めの水溜まりを残す(継続ダメージ) --- */
  if(p.wp.holy>0){
    p.holyT-=dt*atkMult;
    if(p.holyT<=0){
      // v1.1: 本家の聖水どおり、投げる先は【ランダム】。彼女が敵を誘導しないと当たらない。
      // 進化(きよめの泉)で初めて敵の足元を狙うようになり、Lvを積んでようやく使い物になる
      const evo=p.evo.spring>0, lvR=p.wp.holy, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR);
      const n=(evo?3:1+Math.floor((lv-1)/2))+dupN(p);
      const ts=evo?nearestEnemies(n*2,420):[];
      if(!evo || ts.length){
        p.holyT=(evo?2.4:3.0)*Math.pow(0.92,lv-1)*ov.cd;
        for(let i=0;i<n;i++){
          let tx,ty;
          if(evo){ const t=ts[(Math.random()*ts.length)|0]; tx=t.x+rand(-20,20); ty=t.y+rand(-12,12); }
          else{ const a=rand(TAU), d2=rand(40,170); tx=p.x+Math.cos(a)*d2; ty=p.y-10+Math.sin(a)*d2*0.8; }
          if(B.zones.length>24) B.zones.shift();
          B.zones.push({x:tx, y:ty, r:(evo?72:34+3*lv)*areaMult(p)*ov.area,
            t:0, life:evo?6:3.0, dmg:(evo?9:3+1*(lv-1))*ov.dmg, tick:0, evo});
          parts(tx,ty,6,['#8fd3ff','#e8f4ff'],90,0.4);
        }
        sfx(520,700,0.1,'sine',0.04);
      }else p.holyT=0.2;
    }
  }
}
/* ================= v3.0 フレイラの武器(火・近接) =================
   炎の剣=前方の弧(進化 煉獄の剣=全方位+燃焼) / 火の輪=周回する火の帯(進化 太陽環=大きく、触れた魔物が止まる) /
   爆炎=自分中心の爆発と押し返し(進化 大噴火) / 火柱=近い魔物の足元に炎の領域 / 焔の翼=近くの群れへの短い突進 */
function nearEnemiesR(p,n,r){ const B=G.B, arr=[]; for(const e of B.enemies){ if(e.dead||e.dormant||e.state==='attached'||e.item) continue; const d=Math.hypot(e.x-p.x,e.y-p.y); if(d<r) arr.push({e,d}); } arr.sort((a,b)=>a.d-b.d); return arr.slice(0,n).map(o=>o.e); }
function freilaWeapons(p,dt,atkMult){
  const B=G.B;
  if(p.wp.fsword>0){
    p.fswordT-=dt*atkMult;
    if(p.fswordT<=0){
      const evo=p.evo.inferno>0, lvR=p.wp.fsword, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR);
      p.fswordT=(evo?0.6:0.85)*Math.pow(0.91,lv-1)*ov.cd;
      p.fswordSide*=-1;
      const range=(evo?150:90+10*lv)*areaMult(p)*ov.area, half=(evo?150:50+5*lv)*areaMult(p)*ov.area, dmg=(evo?26:12+5*(lv-1))*ov.dmg;
      p.whipAnim=0.16; p.whipDir=evo?0:(p.fswordSide>0?p.face:-p.face); p.whipR=range; p.whipFire=true;
      let hit=false;
      for(const e of B.enemies){ if(e.dead||e.dormant) continue; const ex=e.x-p.x, ey=e.y-(p.y-10); const inArc=evo?Math.hypot(ex,ey)<range+e.r:(ex*p.whipDir>0 && Math.abs(ex)<range+e.r && Math.abs(ey)<half+e.r); if(inArc){ damageEnemy(e,dmg); hit=true; if(evo) e.burnT=Math.max(e.burnT||0,2.5); } }
      for(const pr of B.props){ const ex=pr.x-p.x, ey=pr.y-(p.y-10); const inArc=evo?Math.hypot(ex,ey)<range:(ex*p.whipDir>0&&Math.abs(ex)<range&&Math.abs(ey)<half); if(inArc) damageProp(pr,dmg); }
      if(hit){ sfx(200,90,0.1,'sawtooth',0.05); parts(p.x+(p.whipDir||1)*range*0.5,p.y-10,6,['#ff7a3a','#ffd76a'],120,0.4); if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN); }
    }
  }
  if(p.wp.fring>0){
    const evo=p.evo.corona>0, lvR=p.wp.fring, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR);
    p.fringAng+=dt*(evo?2.6:2.2);
    const R=(evo?96:52+7*lv)*areaMult(p)*ov.area, band=(evo?22:14)+2*lv, dmg=(evo?9:4+1.5*(lv-1))*ov.dmg;
    p.fringR=R; p.fringT-=dt*atkMult;
    if(p.fringT<=0){ p.fringT=0.3*ov.cd; for(const e of B.enemies){ if(e.dead||e.dormant) continue; const d=Math.hypot(e.x-p.x,e.y-(p.y-10)); if(Math.abs(d-R)<band+e.r*0.5){ damageEnemy(e,dmg); if(evo) e.stun=Math.max(e.stun||0,0.35); } } }
  } else p.fringR=0;
  if(p.wp.fburst>0){
    p.fburstT-=dt*atkMult;
    if(p.fburstT<=0){
      const evo=p.evo.eruption>0, lvR=p.wp.fburst, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR);
      p.fburstT=((evo?3.4:3.8)-0.3*(lv-1))*ov.cd;
      const R=(evo?170:90+16*(lv-1))*areaMult(p)*ov.area, dmg=(evo?36:14+6*(lv-1))*ov.dmg;
      p.novaAnim=0.5; p.novaR=R; p.novaFire=true; G.shake=Math.min(7,G.shake+3); sfx(160,40,0.25,'sawtooth',0.08);
      for(const e of B.enemies){ if(e.dead||e.dormant) continue; const dx=e.x-p.x, dy=e.y-p.y, d=Math.hypot(dx,dy); if(d<R+e.r){ damageEnemy(e,dmg); if(d>0.01 && !e.boss && e.state!=='attached' && MONSTERS[e.id].spd>0){ e.x+=dx/d*(evo?46:34); e.y+=dy/d*(evo?46:34); e.stun=Math.max(e.stun,evo?0.7:0.4); } } }
      for(const pr of B.props){ if(Math.hypot(pr.x-p.x,pr.y-p.y)<R+12) damageProp(pr,dmg); }
      parts(p.x,p.y-10,evo?30:16,['#ff7a3a','#ffd76a','#fff'],evo?220:150,0.5);
      if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN);
    }
  }
  if(p.wp.fpillar>0){
    p.fpillarT-=dt*atkMult;
    if(p.fpillarT<=0){
      const lvR=p.wp.fpillar, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR);
      p.fpillarT=(2.6-0.2*(lv-1))*ov.cd;
      const n=1+(p.ps.dup||0)+(lv>=4?1:0), ts=nearEnemiesR(p,n,(170+12*lv)*(1+0.12*(p.ps.reach||0)));
      for(const e of ts){ if(B.zones.length>24) B.zones.shift(); B.zones.push({x:e.x, y:e.y, r:(30+4*lv)*areaMult(p)*ov.area, t:0, life:2.2, dmg:(6+2.5*(lv-1))*ov.dmg, tick:0, fire:true}); parts(e.x,e.y-10,10,['#ff7a3a','#ffd76a','#fff'],140,0.5); }
      if(ts.length) sfx(300,120,0.2,'square',0.04);
    }
  }
  if(p.wp.fwing>0){
    p.fwingT-=dt*atkMult;
    if(p.fwingT<=0 && attachCount(p)===0 && !p.pinned){
      const lvR=p.wp.fwing, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR);
      const ts=nearEnemiesR(p,1,150+15*lv);
      if(ts.length){ p.fwingT=(4.5-0.35*(lv-1))*ov.cd; const e0=ts[0]; const dxv=e0.x-p.x, dyv=e0.y-p.y, L=Math.hypot(dxv,dyv)||1; const len=Math.min(L+40,120+10*lv); const q=snapFloor(clampMapX(p.x+dxv/L*len,30),clampMapY(p.y+dyv/L*len,30),false,3);
        if(q && reachableAt(q.x,q.y,false)){ const x0=p.x, y0=p.y, vx=q.x-x0, vy=q.y-y0, LL=Math.hypot(vx,vy)||1, dmg=(10+4*(lv-1))*ov.dmg;
          for(const e of B.enemies){ if(e.dead||e.dormant) continue; const t=Math.max(0,Math.min(1,((e.x-x0)*vx+(e.y-y0)*vy)/(LL*LL))); const px=x0+vx*t, py=y0+vy*t; if(Math.hypot(e.x-px,e.y-py)<(30+3*lv)*areaMult(p)+e.r*0.5){ damageEnemy(e,dmg); e.stun=Math.max(e.stun||0,0.3); } }
          for(let k=0;k<8;k++) parts(x0+vx*k/8,y0+vy*k/8-14,2,['#ff7a3a','#ffd76a'],100,0.4);
          p.fwingAnim=0.25; p.fwingX=x0; p.fwingY=y0; p.x=q.x; p.y=q.y; p.vx=0; p.vy=0; p.path=null; p.ifr=Math.max(p.ifr,0.25); p.face=vx>=0?1:-1; sfx(500,200,0.15,'sawtooth',0.05);
          if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN); }
      } else p.fwingT=0.5;
    }
  }
}
function orbPos(i,n){
  const p=G.B.hero;
  const evo=p.evo.sring>0;
  const R=((evo?70:56)+4*Math.max(1,p.wp.orb))*areaMult(p);
  const a=p.orbAng + i*TAU/n;
  return {x:p.x+Math.cos(a)*R, y:p.y-10+Math.sin(a)*R*0.9};
}

/* ================= レベルアップ ================= */
function readyEvos(){
  const p=G.B.hero, out=[];
  for(const k in EVOS){
    const e=EVOS[k];
    const h=heroOf(e.base); if(!h||!G.B.heroes.includes(h)) continue;   // v3.0 その武器の持ち主が居る時だけ
    if(!h.evo[k] && h.wp[e.base]>=BAL.WP_EVO_LV && h.ps[e.pair]>=2) out.push(k);   // 進化は Lv5 で解禁(上限 8 でも待たせない)
  }
  return out;
}
function maybeLevelup(){
  const B=G.B, p=B.heroes[0];
  if(G.mode!=='battle') return;
  if(p.xp>=p.xpNeed){
    for(const h of B.heroes){ h.xp-=h.xpNeed; h.level++; h.xpNeed=need(h.level); }   // v3.0 Lv と経験値はパーティ共通
    offerLevelup();
  }
}
function offerLevelup(){
  const B=G.B, p=B.hero;
  const inParty=id=>B.heroes.some(h=>h.id===id);
  const wpCountOf=h=>Object.keys(h.wp).filter(k=>h.wp[k]>0).length;
  const psCount=Object.values(B.heroes[0].ps).filter(v=>v>0).length;
  const avail=Object.keys(UPG).filter(k=>{
    if(UPG[k].kind==='wp'){ const own=UPG[k].owner||'lumina'; if(!inParty(own)) return false; const h=heroOf(k); if(h.wp[k]>=UPG[k].max) return false; if(h.wp[k]===0 && wpCountOf(h)>=4) return false; return true; }   // v3.0 武器はそのヒロインの枠(4つ)
    if(curLv(k)>=UPG[k].max) return false;
    if(UPG[k].kind==='ps' && curLv(k)===0 && psCount>=4) return false;   // パッシブ枠も4つ(共通)
    return true;
  });
  const evos=readyEvos();
  const pool=avail.concat(evos.map(k=>'EVO:'+k));
  // v3.0 持ち主ごとの候補数で重みを正規化(武器の数が多いルミナばかり選ばれない)
  const ownCnt={}; for(const k of avail){ if(UPG[k].kind==='wp'){ const o=UPG[k].owner||'lumina'; ownCnt[o]=(ownCnt[o]||0)+1; } } const ownN=Object.keys(ownCnt).length||1, wpAvail=Object.values(ownCnt).reduce((a,b)=>a+b,0);
  if(!pool.length){ applyPray(); return; }   // v1.9 全部が上限: レベルを無駄にしない
  const opts=shuffle(pool.slice()).slice(0,3);
  const bossy=BAL.BOSS_PICK && bossExpected();   // v2.4 ボスが居る/居た・最終階層: 単体火力・貫通・手数を選び、広範囲は後回し
  let pick=0, bw=-1;
  opts.forEach((k,i)=>{
    let w=1;
    if(k.startsWith('EVO:')){ w=6; if(bossy){ const bwv=(UPG[EVOS[k.slice(4)].base]||{}).bossW||1; w*=bwv>=1.2?1.35:(bwv<0.8?0.75:1); } }
    else{
      if(UPG[k].kind==='wp') w=curLv(k)===0?3:2.2;
      if(UPG[k].kind==='wp' && curLv(k)>0) w*=1.5;   // 手持ちの武器を伸ばしたがる
      if(k==='vital' && p.hp<p.maxHp*0.5) w=4;
      w*=p.taste[k]||1;   // 今夜の好み: 噛み合わない夜はビルドが散る
      if(bossy) w*=UPG[k].bossW||1;
      if(UPG[k].kind==='wp' && ownN>1){ const o=UPG[k].owner||'lumina'; w*=(wpAvail/ownCnt[o])/ownN; }
      if(UPG[k].kind==='wp' && B.heroes.length>1){ const h=heroOf(k); const tot=B.heroes.map(x=>Object.values(x.wp).reduce((a,b)=>a+b,0)); const mine=Object.values(h.wp).reduce((a,b)=>a+b,0), avg=tot.reduce((a,b)=>a+b,0)/tot.length; if(mine<avg-1) w*=1.3; else if(mine>avg+1) w*=0.75; }   // v3.0 二人の武器の育ちを揃える(どちらか一人しか強化できない)
    }
    w*=rand(0.9,1.1);
    if(w>bw){ bw=w; pick=i; }
  });
  { const k=opts[pick]; const base=k.startsWith('EVO:')?EVOS[k.slice(4)].base:k; if(bossy && (UPG[base]&&(UPG[base].bossW||1)>=1.2)){ B.nBossPick=(B.nBossPick||0)+1; sayLine('bossPick',0,25); } }
  B.lvCards={opts,pick,t:0,revealed:false};
  G.mode='levelup';
  S.lvup();
}
/* v1.9 ルミナの祈り: 取れる強化が無いレベルアップの受け皿。火力+4%・最大HP+3%・速度+1%(その戦闘の間)、少し回復 */
const xpSoft=p=>1/(1+BAL.XP_SOFT_K*Math.max(0,(p.level||1)-BAL.XP_SOFT_LV));   // v2.1 成長の飽和
function applyPrayStat(p){ p.pray=(p.pray||0)+1; p.dmgMult=(p.dmgMult||1)*(1+BAL.PRAY_DMG); const addHp=Math.round(p.maxHp*BAL.PRAY_HP); p.maxHp+=addHp; p.baseSpeed*=1+BAL.PRAY_SPD; return addHp; }
function applyPray(){
  const B=G.B; let shown=false;
  for(const p of B.heroes){   // v3.0 祈りは全員に
    if((p.pray||0)>=BAL.PRAY_MAX){ p.hp=Math.min(p.maxHp,p.hp+BAL.PRAY_HEAL*2); if(!shown){ floatTxt(p.x,p.y-64,'祈り — 回復','#ffd76a',12,1.4); shown=true; } parts(p.x,p.y-16,12,['#fff','#ffd76a'],120,0.5); continue; }   // v2.1 祈りも上限: 以後は回復だけ
    const addHp=applyPrayStat(p); p.hp=Math.min(p.maxHp,p.hp+addHp+BAL.PRAY_HEAL);
    if(!shown){ floatTxt(p.x,p.y-64,'祈り '+p.pray+' — 火力+'+Math.round(BAL.PRAY_DMG*100)+'%・HP+'+Math.round(BAL.PRAY_HP*100)+'%','#ffd76a',12,1.6); heroBubble(p,pickRand(['……まだ、つよくなれる','ひかり、こたえて']),true,1); shown=true; }
    parts(p.x,p.y-16,18,['#fff','#ffd76a'],160,0.6);
  }
  S.lvup();
}
function applyUpg(k){
  const B=G.B;
  if(k.startsWith('EVO:')){
    const id=k.slice(4); const p=heroOf(EVOS[id].base);
    p.evo[id]=1;
    setBanner('★ 武器融合!', p.name+' — '+EVOS[id].name, '#ffd76a');
    heroBubble(p,p.id==='freila'?'……熱い。いい火':'ちからが、あふれてくる…!',true);
    parts(p.x,p.y-16,30,['#fff','#ffd76a','#8fd3ff'],220,0.8);
    return;
  }
  if(UPG[k].kind==='wp'){   // v3.0 武器は持ち主だけ
    const p=heroOf(k); applyUpgStat(p,k);
    floatTxt(p.x,p.y-64,UPG[k].name+' Lv'+curLv(k)+(curLv(k)>BAL.WP_EVO_LV?' 覚醒!':'!'),'#ffd76a',13,1.5);
    heroBubble(p,p.id==='freila'?'……よし':'つよくなった♪',true);
  } else {                  // パッシブは全員に効く
    for(const h of B.heroes){ applyUpgStat(h,k); if(k==='vital'){ h.hp=Math.min(h.maxHp,h.hp+25); } }
    const p=B.heroes[leaderIdx()]; floatTxt(p.x,p.y-64,UPG[k].name+' Lv'+curLv(k)+'!','#ffd76a',13,1.5);
    heroBubble(p,p.id==='freila'?'……全員、少し強くなった':'みんな、つよくなった♪',true);
  }
}
function lvTick(dt){
  const B=G.B, c=B.lvCards;
  if(!c){ G.mode='battle'; return; }
  c.t+=dt;
  if(!c.revealed && c.t>=0.4){ c.revealed=true; S.pick(); }
  if(c.t>=1.0){
    applyUpg(c.opts[c.pick]);
    B.lvCards=null;
    G.mode='battle';
    maybeLevelup();
  }
}

/* ================= モンスター ================= */
function unitDef(id){
  const base=MONSTERS[id];
  const lv=(META.cards[id]&&META.cards[id].lv)||1;
  const m=cardLvMult(lv);
  return {base, lv, hp:base.hp*m.hp, dmg:base.dmg*m.dmg};
}
function spawnUnit(id, x, y, o){
  o=o||{};
  x=clampMapX(x,20); y=clampMapY(y,20);
  { const q=snapFloor(x,y,canFly(id),4); if(q){ x=q.x; y=q.y; } }   // 壁の中には出ない
  const B=G.B, d=unitDef(id);
  const elite=o.elite||1;
  // 夜の深まり: 彼女が育つほど、召喚される魔物も強くなる(カード練度でスケール)
  const heroLv=(B.hero&&B.hero.level)||1;
  const nscale=Math.min(1,(d.lv-1)/2);
  const night=MONSTERS[id].boss?1:1+Math.min(BAL.NIGHT_STAT_CAP, BAL.NIGHT_STAT_LV*Math.max(0,heroLv-1))*nscale;
  const flesh=1+0.10*altarLv('mhp');           // 魔性の肉(オーブ・HPのみ)
  const pm=(o.mult||1)*night;
  const bossm=(MONSTERS[id].boss&&!MONSTERS[id].guardian)?(1+Math.min(BAL.BOSS_HP_LV_CAP,BAL.BOSS_HP_LV*Math.max(0,(B.hero?B.hero.level:1)-1))):1;   // v2.4 ボス級は彼女の Lv で厚くなる(魔核・番兵は各自)
  const F=B.floor||curFloor();   // v2.0 階層: 深いほど硬い。得意種はさらに硬い
  const fhp=MONSTERS[id].guardian?1:F.mon.hp*(F.affinity.includes(id)?BAL.FLOOR_AFFINITY:1)*eraMul(), fdm=MONSTERS[id].guardian?1:F.mon.dmg*eraMul();   // v3.0 世代の深さ倍率
  const u={
    id, x, y,
    hp:d.hp*elite*pm*flesh*fhp*bossm, maxHp:d.hp*elite*pm*flesh*fhp*bossm, spd:MONSTERS[id].spd, r:MONSTERS[id].r*(elite>1?1.2:1),
    dmg:d.dmg*elite*pm*fdm, xp:Math.round(MONSTERS[id].xp*(1+0.1*(d.lv-1))*(elite>1?1.6:1)),
    enVal:o.enVal||0, gemMul:o.gemMul!==undefined?o.gemMul:1,
    boss:!!MONSTERS[id].boss, lv:d.lv, elite:elite>1,
    t:rand(10), joff:rand(TAU), hitFlash:0, orbCd:0, stun:0, dead:false,
    dormant:!!o.dormant, dormT:0, state:'chase', limb:null, seenT:0,
    vari:(Math.random()*3)|0,                 // 描き込みの個体差(顔・色)
  };
  if(id==='worm'){ u.pounceCd=rand(1,2); u.pounceT=0; }
  if(id==='slug'){ u.charmCd=0; }
  if(id==='leech'){ u.lvx=null; u.lvy=null; u.suck=null; }
  if(id==='gas'){ u.puffT=rand(0.8,1.6); }
  if(id==='imp'){ u.orbitA=rand(TAU); u.orbitDir=Math.random()<0.5?-1:1; u.dodgeCd=0; u.teaseT=rand(1,3); }
  if(id==='flower'){ u.state='bud'; u.revealed=false; u.dotAcc=0; u.openT=0; }
  if(id==='gtent'){ u.grabCd=2.5; u.whipT=0; u.state='idle'; }
  if(id==='slime'||id==='mistslime'){ u.trailT=0; }
  if(u.boss){ u.bstate='chase'; u.bt=3.2; u.cdx=0; u.cdy=0; }
  /* v1.0 追加種 */
  if(id==='hand'){ u.gropeCd=0; u.retreatT=0; }
  if(id==='serpent'){ u.biteCd=0; }
  if(id==='moth'){ u.orbitA=rand(TAU); u.orbitDir=Math.random()<0.5?-1:1; u.dustT=rand(0.6,1.6); u.swoopCd=rand(3,5); u.swoopT=0; u.cdx=0; u.cdy=0; }
  if(id==='pot'){ u.grabCd=1.5; u.eatN=0; }
  if(id==='slugqueen'){ u.charmCd=0; u.pulseCd=rand(3,5); }
  if(id==='dreamtree'){ u.spawnCd=2.5; u.rootCd=3; }
  if(id==='ghosthand'){ u.gropeCd=0; }
  if(id==='eye'){ u.gazeCd=rand(2,4); u.driftA=rand(TAU); }
  if(id==='succubus'){ u.orbitA=rand(TAU); u.orbitDir=Math.random()<0.5?-1:1; u.denyCd=rand(2,4); }
  if(id==='web'){ u.grabCd=0; u.life=40; }
  if(id==='gazer'){ u.gzState='idle'; u.gzT=rand(1.5,3); u.gzAng=rand(TAU); u.lookA=0; }
  if(id==='beamer'){ u.bmState='idle'; u.bmT=rand(2,4); u.bmAng=0; u.lookA=0; }
  if(id==='bossgazer'){
    u.bstate='chase'; u.bt=99; u.lookA=0;
    u.eyes=[0,1,2].map(i=>({ base:(-Math.PI/2)+(i-1)*1.05, dx:0, dy:0, ang:rand(TAU), state:'idle', t:1.2+i*1.9 }));
  }
  if(id==='slimeking'){ u.trailT=0; u.grabCd=4; }
  if(id==='runemage'){ u.castCd=2.5; u.runeCd=6; u.lookA=0; }
  if(id==='succuqueen'){ u.orbitA=rand(TAU); u.orbitDir=Math.random()<0.5?-1:1; u.pulseCd=3; u.spawnCd=8; u.kissCd=2; }
  if(id==='gobking'){ u.muskCd=0.5; u.hornCd=4; }
  if(id==='inyoku'){ u.orbitA=rand(TAU); u.orbitDir=Math.random()<0.5?-1:1; u.swoopCd=rand(2,4); u.swoopT=0; u.holdT=0; }
  if(id==='suiyou'){ u.sub=false; u.grabCd=0; }
  if(id==='mouth'){ u.grabCd=1.5; u.lickT=0; }
  if(id==='guardian'){ u.castCd=3; u.aimT=0; u.lookA=0; }
  if(id==='core'){ u.whipCd=2; u.whipT=0; u.pulseCd=5; u.pulseT=0; u.spawnCd=4; u.lookA=0; { const e0=eraNow()===0, lvK=BAL.CORE_HP_LV*(e0?BAL.CORE_ERA0_LV_K:1), lvCap=e0?BAL.CORE_ERA0_LV_CAP:BAL.CORE_HP_LV_CAP; u.hp=u.maxHp=Math.round(BAL.CORE_HP*(BAL.CORE_ERA_HP0+BAL.CORE_ERA_HP_K*eraNow())*(1+0.08*Math.max(0,(META.gen.idx||1)-1))*(1+Math.min(lvCap,lvK*Math.max(0,heroLv-1)))); } u.era=eraNow(); /* v3.1 世代0は Lv 補正も半分 */ u.r=Math.round(MONSTERS.core.r*(0.68+0.08*Math.min(4,u.era))); }   // v3.0 世代0は薄く小さく(見た目も弱く)、討たれるごとに厚く大きく   // v2.2 引き継いだLvが高いほど厚い(最大×4.5)
  // 地形の恩恵: 湿地で粘る種のHP、巣の魔物のHP。速度は毎フレーム今いる地形で決まる(spd0 が素の速度)
  u.spd0=u.spd; u.zone=zoneAt(x,y); u.item=!!MONSTERS[id].item;   // 設置物は押し合いで動かない
  if(id==='suiyou') u.sub=(u.zone==='water'||u.zone==='damp');   // v2.0 水妖は水の中で待つ
  { const hm=zoneMonHp(u.zone,id); if(hm!==1){ u.hp*=hm; u.maxHp*=hm; } }
  u.parent=o.parent||null;
  if(!B.codexSeen[id] && !MONSTERS[id].item){ B.codexSeen[id]=1; codexMark(id,'seen'); }
  B.enemies.push(u);
  B.spawnFx.push({x,y,t:0,r:MONSTERS[id].r+8, dormant:u.dormant});
  return u;
}
function damageEnemy(e,dmg){
  if(e.dead||e.dormant) return;
  if(G.B&&G.B.hero.dmgMult) dmg*=G.B.hero.dmgMult;   // せいなる火力(自己強化)
  if(e.id==='flower') dmg*=(e.state==='bud'?0.5:1.3);
  if(e.id==='tower') dmg*=0.3;                        // 催眠電波の塔: 骨の骨組みは光を通しにくい
  if(e.id==='core') dmg*=coreDef();                   // 魔核: 厚い肉(v3.0 世代0は薄く 0.7、世代ごとに 0.05 ずつ厚く、下限 CORE_DEF)
  if(e.id==='sentinel') dmg*=BAL.SENTINEL_DEF;        // v2.1 石の番兵: 光が通りにくい
  else if(e.boss && !MONSTERS[e.id].guardian) dmg*=BAL.BOSS_DEF;   // v2.4 ボス級: 被ダメ 80%
  // 魅了: その個体への攻撃は無意識に鈍る(Lvごとに与ダメ減)
  const cl=G.B?charmLvFor(G.B.hero,e):0;
  if(cl>0){
    dmg*=Math.max(0.1,1-BAL.CHARM_DMG_CUT*cl);
    if(Math.random()<0.15) floatTxt(e.x,e.y-e.r-14,'……てかげん?','#ffb3cf',9,0.8);
  }
  e.hp-=dmg; e.hitFlash=0.12;
  floatDmg(e.x,e.y-e.r-4,dmg);
  if(e.hp<=0) killEnemy(e);
}
function killEnemy(e){
  if(e.dead) return;
  const B=G.B, h=B.hero;
  e.dead=true; B.kills++;
  if(!MONSTERS[e.id].item) codexOf(e.id).kills++;
  // v3.0 誰かの四肢に付いていたら解放(全員を見る)
  for(let i=0;i<B.heroes.length;i++){ const hh=B.heroes[i];
    if(e.limb && hh.limbs[e.limb] && hh.limbs[e.limb].mon===e){ hh.limbs[e.limb]=null; heroBubble(hh,hh.id==='freila'?'……離れた':'とれたっ!'); }
    for(const sl of attachedSlots(hh)){ if(hh.limbs[sl].mon===e) hh.limbs[sl]=null; }
    for(const sl of suckSlots(hh)){ if(hh.suckers[sl].mon===e) hh.suckers[sl]=null; }
    if(hh.pinBy===e) hh.pinBy=null;
    if(hh.charmBind && hh.charmBind.mon===e){ const ci0=B.ci; B.ci=i; releaseCharmBind(false); B.ci=ci0; } }   // 縋りついていた個体が消えれば拘束は解ける
  const col=EN_COLORS[e.id]||['#fff','#aaa'];
  parts(e.x,e.y-e.r,e.boss?42:8,col,e.boss?220:110,0.55);
  if(e.boss && e.id!=='core') partyExchange('bossDown');   // v3.0 ボスを倒した二人のやりとり
  S.hit();
  if(e.id==='gas'){ // 断末魔の大放出
    spawnCloud(e.x,e.y,70,7,BAL.SENSIT_GAS*1.2,'gas');
  }
  B.en=Math.min(enMax(), B.en+e.enVal*BAL.EN_REFUND);
  B.essence+=e.xp*BAL.ESS_RATE;
  if(e.id==='sentinel' && !B.enemies.some(o=>o.id==='sentinel'&&!o.dead&&o!==e)){   // v2.1 番兵が全員沈黙: 降り口が使える
    setBanner('番兵が沈黙した','降り口が使えるようになった','#8fd3ff'); sayLine('sentinel.cleared',2,0,'いし、ぜんぶ止まった! ……おりられる');
    parts(e.x,e.y-10,30,['#cfd6ff','#fff','#8fd3ff'],160,0.9);
  }
  if(e.id==='core'){   // v2.0 魔核が討たれた: 目的達成。その日はここで終わる
    B.cleared=true;
    for(let i=0;i<60;i++){ const a=rand(TAU), d2=rand(10,140); parts(e.x+Math.cos(a)*d2,e.y+Math.sin(a)*d2*0.6,3,['#ffd76a','#fff','#ff86b3'],220,1.2); }
    setBanner('魔核、討たれる','深淵の心臓が止まった——彼女は目的を果たした','#ffd76a');
    heroBubble(h,'……おわった。おわった、よ',true,3);
    META.life.herBoss++;
    G.mode='survived'; B.winT=3.2; G.shake=Math.min(14,G.shake+10); S.boss();
    return;
  }
  if(e.boss){
    for(let i=0;i<22;i++){
      const a=rand(TAU), d2=rand(10,70);
      dropGem(e.x+Math.cos(a)*d2, e.y+Math.sin(a)*d2, 4);
    }
    setBanner('ボスが討たれた…','大量のエッセンスが残された','#b46cff');
    META.life.herBoss++;
    B.essence+=30;
    { const q=snapFloor(e.x,e.y,false,6)||{x:e.x,y:e.y}; B.chests.push({x:q.x,y:q.y,t:0,taken:false,bossChest:true,known:true}); }   // 王の宝箱: 強くて面倒な相手を倒した報酬(彼女側)。歩ける床に置く
    G.shake=Math.min(10,G.shake+7);
    S.clear();
  }else if(!MONSTERS[e.id].item){
    // 基礎頭数ぶんは通常ジェム、頭数ボーナスぶんは【ロージェム】(光るが経験値は薄い)。
    // 大量に拾う気持ちよさは残しつつ、物量が彼女の経験値の泉にはならない
    const gm=e.gemMul!==undefined?e.gemMul:1;
    if(Math.random()<gm) dropGem(e.x,e.y,Math.max(1,Math.round(e.xp*0.8)));
    else dropGem(e.x,e.y, gm<=0?BAL.LOGEM_V:Math.max(0.4,e.xp*0.8*logemMul(B.enemies.length)), true);   // 頭数ボーナス分は魔物数で 100%→…→50% へ漸減。召喚(gemMul 0)は薄いまま
  }
}
/* ロージェムの経験値倍率: 場の魔物数に応じて 100%→90→80→75→70→…→50% と滑らかに下がる */
function logemMul(n){
  const T=BAL.LOGEM_CURVE;
  if(n<=T[0][0]) return T[0][1];
  for(let i=1;i<T.length;i++){ if(n<=T[i][0]){ const a=T[i-1], b=T[i]; return a[1]+(b[1]-a[1])*(n-a[0])/(b[0]-a[0]); } }
  return T[T.length-1][1];
}
function dropGem(x,y,v,lo){
  const B=G.B;
  if(G.map && !passAt(x,y,false)){ const q=snapFloor(x,y,false,3); if(q){ x=q.x; y=q.y; } }   // 崖の上で倒れた飛ぶ魔物のジェムは、彼女が届く床に落とす
  if(B.gems.length>BAL.GEM_CAP){ B.gems[(Math.random()*B.gems.length)|0].v+=v; return; }
  B.gems.push({x,y,v,t:rand(10),sp:0,lo:!!lo});
}
function spawnCloud(x,y,r,life,rate,src){
  const B=G.B;
  if(B.clouds.length>44) B.clouds.shift();
  const kind=src==='musk'?'musk':'gas';
  if(kind==='gas' && zoneAt(x,y)==='flower'){ rate*=1.2; r*=1.1; }   // 花園では媚薬の雲が濃く広い
  const c={x,y,r,t:0,life,rate,src:src||null,kind};
  B.clouds.push(c);
  parts(x,y,kind==='musk'?4:8,kind==='musk'?['#a8c86a','#8fb05a']:['#ff9ec2','#ffc2d8'],60,0.8);
  return c;
}

function enemiesUpdate(dt){
  const B=G.B; let p=B.hero;
  for(const e of B.enemies){
    if(e.dead) continue;
    e.t+=dt;
    // v3.0 標的のヒロイン: 掴んでいる/押し倒している/縋りつかれている相手は固定。それ以外はときどき最も近い(離脱していない)子へ
    { const th=(e.ti!==undefined)?B.heroes[e.ti]:null; const locked=e.state==='attached' || (th && !th.out && (th.pinBy===e || (th.charmBind&&th.charmBind.mon===e)));
      if(!locked){ e.retgT=(e.retgT||0)-dt; if(e.ti===undefined || e.retgT<=0 || !th || th.out){ e.ti=nearestHeroIdx(e.x,e.y); e.retgT=0.5+Math.random()*0.4; } } }
    B.ci=e.ti; p=B.hero;
    if(e.hitFlash>0) e.hitFlash-=dt;
    if(e.orbCd>0) e.orbCd-=dt;
    if(e.crossCd>0) e.crossCd-=dt;
    if(e.nuzzleCd>0) e.nuzzleCd-=dt;
    e.seenT=inSight(e,p)?e.seenT+dt:0;   // 彼女の視界に入っている時間(反応遅れの基準)
    if(e.seenT>0.45 && !e.dormant && !B.metLine[e.id]){ B.metLine[e.id]=1; sayLine('mon.'+e.id+'.'+(knowLv(e.id)>=2?'know':'see'),1,2.5); if(e.boss) partyShare(p,'boss',e.x,e.y,true); }   // v2.1 初めて目にした種族への一言 / v3.0 ボスは相手に伝える

    // 四肢に絡みつき/吸い付き中: ヒロインに追従するだけ
    if(e.state==='attached'){
      const anch=e.suck?suckAnchor(p,e.suck):limbAnchor(p,e.limb);
      e.x=anch.x; e.y=anch.y;
      if(e.id==='inyoku'){ e.holdT=(e.holdT||0)-dt; if(e.holdT<=0 && e.limb){ detachLimb(e.limb,{}); e.swoopCd=rand(3,5); e.orbitA=rand(TAU); e.y-=40; } }   // v2.0 淫翼は数秒で離れて舞い戻る
      if(e.id==='suiyou') p.slow=Math.max(p.slow,0.6);                                                                                              // v2.0 水妖に絡まれている間は足が鈍い
      continue;
    }
    // 魅了拘束の相手: 彼女に縋りつかれてその場を動かない
    if(p.charmBind && p.charmBind.mon===e){
      e.x+=Math.sin(e.t*3)*2*dt; e.y+=Math.cos(e.t*2.6)*2*dt;
      continue;
    }

    let dx=p.x-e.x, dy=p.y-e.y;
    const d=Math.hypot(dx,dy)||0.001;
    const fly=canFly(e.id);
    // 壁で彼女が見えないときは、流れ場(BFS)に沿って回り込む(以降の追跡・照準はその向きを使う)
    e.blocked=false;
    if(d>36 && G.map && !losClear(e.x,e.y,p.x,p.y,fly)){ const f=flowDir(e.x,e.y,fly,e.ti); if(f){ dx=f.x*d; dy=f.y*d; e.blocked=true; } }   // v3.0 標的のヒロインの流れ場で回り込む

    if(e.dormant){
      e.dormT+=dt;
      if(d<170 || e.dormT>25){
        e.dormant=false;
        parts(e.x,e.y,10,['#6a5a9c','#3a3158'],120,0.5);
      }else continue;
    }

    // 本家同様: 遠く離れた魔物は画面外の縁へ回り込み、同じ個体として再登場する(動ける個体のみ)
    if(MONSTERS[e.id].spd>0 && d>BAL.REENTER_D && e.id!=='sentinel'){   // v2.1 番兵は穴から離れない
      const vd=Math.hypot(p.vx,p.vy);
      const base=vd>20?Math.atan2(p.vy,p.vx):rand(TAU);
      const a=base+rand(-1.1,1.1);
      { const q=placeNear(p.x,p.y,Math.cos(a)*BAL.REENTER_R,Math.sin(a)*BAL.REENTER_R*0.8,e.r,fly); e.x=q.x; e.y=q.y; }
      e.seenT=0; e.lvx=null; e.lvy=null;
      B.spawnFx.push({x:e.x,y:e.y,t:0,r:e.r+8});
      if(e.boss){ floatTxt(e.x,e.y-e.r-20,'まわりこんできた!','#ff6b81',11,1.2); }
      continue;
    }
    e.zone=zoneAt(e.x,e.y); if(e.spd0!==undefined) e.spd=e.spd0*zoneMonSpd(e.zone,e.id)*((e.hasteT||0)>0?1.35:1); if((e.hasteT||0)>0) e.hasteT-=dt;   // v2.4 王の号令で一時的に速い
    if((e.burnT||0)>0){ e.burnT-=dt; e.burnTick=(e.burnTick||0)-dt; if(e.burnTick<=0){ e.burnTick=0.4; damageEnemy(e,3+0.08*p.level); if(Math.random()<0.5) parts(e.x,e.y-e.r*0.5,1,['#ff7a3a','#ffd76a'],40,0.4); } }   // v3.0 煉獄の剣の燃焼
    if(e.dead) continue;   // 燃え尽きた個体はこのフレームの行動をしない
    e.x=clampMapX(e.x,e.r); e.y=clampMapY(e.y,e.r);
    if(e.stun>0){ e.stun-=dt; }
    else if(e.id==='inyoku'){
      inyokuTick(e,dt,d,dx,dy);
    }else if(e.id==='suiyou'){
      suiyouTick(e,dt,d,dx,dy);
    }else if(e.id==='mouth'){
      mouthTick(e,dt,d);
    }else if(e.id==='guardian'){
      guardianTick(e,dt,d,dx,dy);
    }else if(e.id==='core'){
      coreTick(e,dt,d,dx,dy);
    }else if(e.id==='sentinel'){
      sentinelTick(e,dt,d,dx,dy);
    }else if(e.id==='dreamtree'){
      dreamtreeTick(e,dt,d);
    }else if(e.id==='tower'){
      towerTick(e,dt,d);
    }else if(e.id==='bossgazer'){
      bossgazerTick(e,dt,d,dx,dy);
    }else if(e.id==='gazer'){
      gazerTick(e,dt,d,dx,dy);
    }else if(e.id==='beamer'){
      beamerTick(e,dt,d,dx,dy);
    }else if(e.id==='slimeking'){
      slimekingTick(e,dt,d,dx,dy);
    }else if(e.id==='runemage'){
      runemageTick(e,dt,d,dx,dy);
    }else if(e.id==='succuqueen'){
      succuqueenTick(e,dt,d,dx,dy);
    }else if(e.id==='gobking'){
      gobkingTick(e,dt,d,dx,dy);
    }else if(e.boss){
      e.bt-=dt;
      if(e.bstate==='chase'){
        e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt;
        if(e.bt<=0){ e.bstate='tele'; e.bt=0.6; }
      }else if(e.bstate==='tele'){
        if(e.bt<=0){ e.bstate='charge'; e.bt=0.6; e.cdx=dx/d; e.cdy=dy/d; sfx(300,900,0.3,'sawtooth',0.1); }
      }else{
        e.x+=e.cdx*340*dt; e.y+=e.cdy*340*dt;
        parts(e.x,e.y,1,['#c04a6a','#7a2a4a'],40,0.3);
        if(e.bt<=0){ e.bstate='chase'; e.bt=rand(3.2,4.7); }
      }
    }else if(e.id==='worm'){
      wormTick(e,dt,d,dx,dy);
    }else if(e.id==='gas'){
      gasTick(e,dt,d,dx,dy);
    }else if(e.id==='imp'){
      impTick(e,dt,d,dx,dy);
    }else if(e.id==='flower'){
      flowerTick(e,dt,d);
    }else if(e.id==='gtent'){
      gtentTick(e,dt,d,dx,dy);
    }else if(e.id==='leech'){
      leechTick(e,dt,d,dx,dy);
    }else if(e.id==='hand'){
      handTick(e,dt,d,dx,dy);
    }else if(e.id==='serpent'){
      serpentTick(e,dt,d,dx,dy);
    }else if(e.id==='moth'){
      mothTick(e,dt,d,dx,dy);
    }else if(e.id==='pot'){
      potTick(e,dt,d);
    }else if(e.id==='slugqueen'){
      queenTick(e,dt,d,dx,dy);
    }else if(e.id==='spore'){
      sporeTick(e,dt,d,dx,dy);
    }else if(e.id==='ghosthand'){
      ghosthandTick(e,dt,d,dx,dy);
    }else if(e.id==='eye'){
      eyeTick(e,dt,d,dx,dy);
    }else if(e.id==='succubus'){
      succubusTick(e,dt,d,dx,dy);
    }else if(e.id==='web'){
      webTick(e,dt,d);
    }else{
      // slug / goblin / ghost / slime / mistslime: 通常追跡
      const rush=(attachCount(p)>0||p.pinned||p.charmBind||p.climaxT>0) && d<300 ? 1.9 : 1;
      const ox=Math.cos(e.joff)*14, oy=Math.sin(e.joff)*14;
      const tx=dx+ox, ty=dy+oy;   // dx/dy は壁で視線が切れると流れ場の向きに置き換わっている
      const td=Math.hypot(tx,ty)||0.001;
      e.x+=tx/td*e.spd*rush*dt; e.y+=ty/td*e.spd*rush*dt;
      if(e.id==='ghost'){ e.x+=-ty/td*Math.sin(e.t*2+e.joff)*22*dt; e.y+=tx/td*Math.sin(e.t*2+e.joff)*22*dt; }
      if(MONSTERS[e.id].musk){   // 雄臭: 歩きながら臭いの雲を残す(彼女の近くでだけ・場の雄臭雲は14まで)
        e.muskCd=(e.muskCd||0)-dt;
        if(e.muskCd<=0 && d<300){ e.muskCd=BAL.MUSK_CLOUD_CD*rand(0.8,1.2); let nm=0; for(const c of B.clouds) if(c.kind==='musk') nm++; if(nm<14) spawnCloud(e.x,e.y+2,BAL.MUSK_CLOUD_R,BAL.MUSK_CLOUD_LIFE,BAL.SENSIT_GAS*0.45,'musk'); }
      }
      if(e.id==='slime'){
        e.trailT-=dt;
        if(e.trailT<=0){
          e.trailT=0.28;
          if(B.trails.length<90) B.trails.push({x:e.x,y:e.y,r:11,t:0,life:4.5});
        }
      }
      if(e.id==='mistslime'){
        e.trailT-=dt;
        if(e.trailT<=0){
          e.trailT=0.75;
          spawnCloud(e.x,e.y,26,3.5,BAL.SENSIT_GAS*0.6,'mistslime');
        }
      }
    }
    if((e.id==='slug'||e.id==='slugqueen') && e.charmCd>0) e.charmCd-=dt;

    // オーブ被弾
    if(p.wp.orb>0 && e.orbCd<=0){
      const evo=p.evo.sring>0;
      const n=p.wp.orb;
      for(let i=0;i<n;i++){
        const o=orbPos(i,n);
        if(Math.hypot(e.x-o.x,(e.y-e.r)-o.y)<e.r+(evo?14:11)){
          damageEnemy(e,(evo?16:11+4*(Math.min(BAL.WP_EVO_LV,p.wp.orb)-1))*wpOver(p.wp.orb).dmg);
          if(evo) p.hp=Math.min(p.maxHp,p.hp+1);
          e.orbCd=0.4;
          parts(o.x,o.y,3,['#fff','#ffd76a'],90,0.3);
          break;
        }
      }
    }

    // 壁との当たり。壁で視線が切れたまま3秒動けない個体は、届く床へ置き直す(壁の裏で固まらない。距離を保つ個体は対象外)
    if(!e.dead && !e.dormant && e.state!=='attached' && MONSTERS[e.id].spd>0){
      collideMap(e,e.r*0.75,fly);
      if(e.blocked && d>320 && e.id!=='sentinel'){
        if(Math.hypot(e.x-(e.stX||0),e.y-(e.stY||0))<4) e.stT=(e.stT||0)+dt; else { e.stT=0; e.stX=e.x; e.stY=e.y; }
        if(e.stT>3){ e.stT=0; B.nReloc=(B.nReloc||0)+1; const a=rand(TAU); const q=placeNear(p.x,p.y,Math.cos(a)*BAL.REENTER_R,Math.sin(a)*BAL.REENTER_R*0.8,e.r,fly); e.x=q.x; e.y=q.y; e.stX=e.x; e.stY=e.y; B.spawnFx.push({x:e.x,y:e.y,t:0,r:e.r+8}); }
      }
    }
    // 接触
    if(!e.dead && !e.dormant && e.state!=='attached' && p.ifr<=0
       && e.id!=='flower' && e.id!=='imp' && e.id!=='gas' && e.id!=='pot' && e.id!=='tower' && e.id!=='web' && e.id!=='eye'
       && e.id!=='gazer' && e.id!=='beamer' && e.id!=='mouth' && e.id!=='guardian' && e.id!=='suiyou' && e.id!=='inyoku' && e.id!=='sentinel'
       && Math.hypot(e.x-p.x,e.y-p.y)<e.r+p.r){
      contactHit(e);
    }
  }
  separateEnemies(dt); separateEnemies(dt);   // 魔物同士の押し合い(v1.7): 2回緩和して、重ならずぎゅうぎゅうに詰まる
  for(const e of B.enemies){ if(!e.dead&&!e.dormant&&e.state!=='attached'&&!e.item) collideMap(e,e.r*0.75,canFly(e.id)); }   // 押し合いで壁に入らない
  B.ci=leaderIdx();
  B.enemies=B.enemies.filter(e=>!e.dead);
}
/* ================= 魔物同士の当たり判定(v1.7) =================
   本家同様に魔物は互いを押し合う。空間ハッシュで近い組だけを見て、重なりの半分ずつ押し戻す(大きい/ボスは重い)。
   四肢に付いた個体・潜伏中・設置物は動かない(押す側にはなる)。彼女の周りも密に囲む(中心には入らない) */
const SEP_CELL=48;
function separateEnemies(dt){
  const B=G.B, p=B.hero;
  const list=[]; for(const e of B.enemies){ if(e.dead||e.dormant||e.state==='attached') continue; list.push(e); }
  if(list.length<2) { for(const h of B.heroes) if(!h.out) heroSeparate(list,h); return; }
  const grid=new Map();
  const key=(cx,cy)=>cx*100003+cy;
  for(const e of list){ const cx=Math.floor(e.x/SEP_CELL), cy=Math.floor(e.y/SEP_CELL); const k=key(cx,cy); let a=grid.get(k); if(!a){ a=[]; grid.set(k,a); } a.push(e); }
  const mass=e=>(e.item||MONSTERS[e.id].spd===0||(e.id==='sentinel'&&e.state==='idle'))?1e9:(e.boss?e.r*e.r*8:e.r*e.r);   // 設置物/動かない種/抱え込んでいる番兵は不動。ボスは重い
  for(const e of list){
    const cx=Math.floor(e.x/SEP_CELL), cy=Math.floor(e.y/SEP_CELL);
    for(let ox=-1;ox<=1;ox++) for(let oy=-1;oy<=1;oy++){
      const a=grid.get(key(cx+ox,cy+oy)); if(!a) continue;
      for(const f of a){
        if(f===e || f.sepTag===e) continue;   // 同じ組を二度見ない(f 側で e を処理済み)
        const dx=f.x-e.x, dy=f.y-e.y; const d2=dx*dx+dy*dy;
        const want=(e.r+f.r)*0.82; if(d2>=want*want || d2===0) { if(d2===0){ f.x+=rand(-1,1); f.y+=rand(-1,1); } continue; }
        const d=Math.sqrt(d2), over=(want-d);
        const me=mass(e), mf=mass(f), tot=me+mf;
        const ke=mf/tot, kf=me/tot;                 // 軽いほうが多く動く
        const ux=dx/d, uy=dy/d;
        if(me<1e9){ e.x-=ux*over*ke; e.y-=uy*over*ke*0.85; }
        if(mf<1e9){ f.x+=ux*over*kf; f.y+=uy*over*kf*0.85; }
      }
    }
    e.sepTag=null;
  }
  // 次フレーム用の印はここでは不要(毎フレーム作り直す)。彼女の周りは輪になって詰まる
  for(const h of B.heroes) if(!h.out) heroSeparate(list,h);   // v3.0 全員
}
function heroSeparate(list,p){
  for(const e of list){
    if(e.item||e.boss&&e.bstate==='charge') continue;
    const dx=e.x-p.x, dy=e.y-p.y, d=Math.hypot(dx,dy)||0.001;
    const want=(e.r+p.r)*0.62;   // 接触判定(r+r)の内側までは寄れる——中心には入らない
    if(d<want){ const ux=dx/d, uy=dy/d, over=want-d;
      if(MONSTERS[e.id].spd<=0){ p.x-=ux*over; p.y-=uy*over; }   // v2.4 据わった個体(魔核・夢の樹・番人・口・壺)は押されない。彼女が押し戻される
      else { e.x+=ux*over*0.9; e.y+=uy*over*0.9; } }
  }
}
function wormTick(e,dt,d,dx,dy){
  const p=G.B.hero;
  const rush=(attachCount(p)>0||p.pinned||p.charmBind||p.climaxT>0) && d<300 ? 1.7 : 1;
  if(e.pounceT>0){
    e.pounceT-=dt;
    e.x+=e.cdx*240*dt; e.y+=e.cdy*240*dt;
  }else{
    e.pounceCd-=dt;
    e.x+=dx/d*e.spd*rush*dt; e.y+=dy/d*e.spd*rush*dt;
    if(e.pounceCd<=0 && d<110){
      e.pounceCd=2.2; e.pounceT=0.4;
      e.cdx=dx/d; e.cdy=dy/d;
      sfx(220,460,0.12,'triangle',0.05);
    }
  }
}
function gasTick(e,dt,d,dx,dy){
  // ゆっくり寄って、適度な距離で漂いながらガスを吐く
  if(d>150){ e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt; }
  else{ e.x+=Math.cos(e.t*1.1+e.joff)*8*dt; e.y+=Math.sin(e.t*0.9+e.joff)*8*dt; }
  e.puffT-=dt;
  if(e.puffT<=0){
    e.puffT=3.2;
    spawnCloud(e.x,e.y-4,62,6.5,BAL.SENSIT_GAS,'gas');
    sfx(200,90,0.3,'sine',0.03);
  }
}
function impTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  if(e.blocked){ e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt; return; }   // 壁で視線が切れている: 旋回せず流れ場に沿って回り込む
  // ヒロインの周りをパタパタと旋回
  e.orbitA+=e.orbitDir*(2.2+Math.sin(e.t*1.7)*0.5)*dt;
  const R=62+Math.sin(e.t*2.3+e.joff)*20;
  const tx=p.x+Math.cos(e.orbitA)*R, ty=p.y-14+Math.sin(e.orbitA)*R*0.8;
  const md=Math.hypot(tx-e.x,ty-e.y)||0.001;
  e.x+=(tx-e.x)/md*Math.min(md,e.spd*dt);
  e.y+=(ty-e.y)/md*Math.min(md,e.spd*dt);
  if(Math.random()<dt*0.5) e.orbitDir*=-1;
  // 弾を素早くかわす
  if(e.dodgeCd>0) e.dodgeCd-=dt;
  else{
    for(const b of B.bullets){
      if(Math.hypot(b.x-e.x,b.y-e.y)<44){
        const a=Math.atan2(b.vy,b.vx)+Math.PI/2*(Math.random()<0.5?1:-1);
        e.x+=Math.cos(a)*26; e.y+=Math.sin(a)*26;
        e.dodgeCd=0.7;
        break;
      }
    }
  }
  // 煽り(近くにいるだけで媚薬と集中低下)
  if(d<120){
    e.teaseT-=dt;
    if(e.teaseT<=0){
      e.teaseT=rand(1.8,3.2);
      // 煽りのアクション(投げキッス・耳打ち)をした時だけ快感が入る。
      // 全体で1秒に1回まで——数を並べても強くなりすぎない
      if(B.impBurstCd<=0){
        B.impBurstCd=BAL.IMP_BURST_CD;
        applyPleasure(BAL.PLEAS_IMP_BURST*unitPmul(e));
        codexMet('imp');
        // 投げキッスの軌跡
        const n=5;
        for(let i=0;i<n;i++){
          const f=i/n;
          parts(e.x+(p.x-e.x)*f, e.y-e.r+(p.y-14-(e.y-e.r))*f, 1, ['#ffb3cf','#ff86b3'], 30, 0.5);
        }
        floatTxt(e.x,e.y-e.r-12,pickRand(['ちゅ♡','ふーっ♡','ざぁこ♡']),'#ffb3cf',10,1);
        if(Math.random()<0.5) heroBubble(p,pickRand(['ひゃっ…!? みみ、に……','や、いきを吹きかけ……っ','か、からかわないでっ…!']),false,2);
      }else{
        floatTxt(e.x,e.y-e.r-12,pickRand(['♪','ふふっ','こっちこっち♪']),'#ffb3cf',10,1);
      }
    }
  }
}
function flowerTick(e,dt,d){
  const B=G.B, p=B.hero;
  if(e.state==='bud'){
    if(d<58){
      e.revealed=true;
      if(attachMonster(e,'tether',{r:82})){
        e.state='hold'; e.openT=0;
        parts(e.x,e.y-8,16,['#e86a9c','#8fe8c9'],150,0.6);
        sfx(160,90,0.3,'sawtooth',0.08);
      }else{
        e.state='open'; e.openT=8;
      }
    }
  }else if(e.state==='hold'){
    // 蔦で繋いでいる間、締め上げ(貫通dot)
    e.dotAcc+=dt;
    if(e.dotAcc>=0.5){
      e.dotAcc-=0.5;
      hurtHero(1.1,e,{pierce:true,quiet:true,noKb:true});
    }
    if(!e.limb){ e.state='open'; e.openT=8; }   // 引き剥がされた
  }else{ // open(剥がされ後の隙)
    e.openT-=dt;
    if(e.openT<=0) e.state='bud';
  }
}
function gtentTick(e,dt,d,dx,dy){
  const p=G.B.hero;
  const holding=attachedSlots(p).some(sl=>p.limbs[sl].mon===e);
  if(holding){
    // 掴んでいる間はその場で締める
    e.grabCd=3.5;
    return;
  }
  e.grabCd-=dt;
  if(e.whipT>0){
    e.whipT-=dt;
    if(e.whipT<=0 && Math.hypot(p.x-e.x,p.y-e.y)<118){
      if(attachMonster(e,'tether',{r:110})){
        hurtHero(e.dmg*0.5,e,{noKb:true});
      }
      e.grabCd=6.5;
    }
    return;
  }
  e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt;
  // 溜めを長くして、彼女が反応して抜けられる余地を作る
  if(d<105 && e.grabCd<=0){ e.whipT=0.5; sfx(140,60,0.2,'sawtooth',0.07); }
}
function leechTick(e,dt,d,dx,dy){
  // 素早く、緩く追尾——曲がりきれずに通り過ぎ、旋回してまた戻ってくる
  if(e.lvx===undefined||e.lvx===null){ e.lvx=dx/d*e.spd; e.lvy=dy/d*e.spd; }
  const turn=2.2;
  e.lvx+=((dx/d)*e.spd-e.lvx)*Math.min(1,turn*dt);
  e.lvy+=((dy/d)*e.spd-e.lvy)*Math.min(1,turn*dt);
  const v=Math.hypot(e.lvx,e.lvy)||1;
  e.lvx*=e.spd/v; e.lvy*=e.spd/v;
  e.x+=e.lvx*dt+Math.sin(e.t*9+e.joff)*14*dt;
  e.y+=e.lvy*dt+Math.cos(e.t*8+e.joff)*14*dt;
}
/* ---- v1.0 追加種 ---- */
function handTick(e,dt,d,dx,dy){
  const p=G.B.hero;
  if(e.gropeCd>0) e.gropeCd-=dt;
  if(e.retreatT>0){
    // まさぐって満足→少し離れて、また這い寄る
    e.retreatT-=dt;
    e.x-=dx/d*e.spd*0.9*dt; e.y-=dy/d*e.spd*0.9*dt;
    return;
  }
  const rush=(attachCount(p)>0||p.pinned||p.charmBind||p.climaxT>0) && d<300 ? 1.8 : 1;
  const crawl=0.65+0.35*Math.abs(Math.sin(e.t*9+e.joff));   // 指を動かすような小刻みな前進
  const ox=Math.cos(e.joff)*10, oy=Math.sin(e.joff)*10;
  const tx=dx+ox, ty=dy+oy, td=Math.hypot(tx,ty)||0.001;
  e.x+=tx/td*e.spd*rush*crawl*dt; e.y+=ty/td*e.spd*rush*crawl*dt;
}
function serpentTick(e,dt,d,dx,dy){
  const p=G.B.hero;
  if(e.biteCd>0) e.biteCd-=dt;
  const rush=(attachCount(p)>0||p.pinned||p.charmBind||p.climaxT>0) && d<300 ? 1.6 : 1;
  const sw=Math.sin(e.t*7+e.joff)*34;                         // 蛇行
  e.x+=(dx/d*e.spd*rush + (-dy/d)*sw)*dt;
  e.y+=(dy/d*e.spd*rush + (dx/d)*sw)*dt;
}
function mothTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  if(e.blocked){ e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt; return; }   // 壁で視線が切れている: 旋回せず流れ場に沿って回り込む
  if(e.swoopT>0){
    // 翼で肌を撫でる急降下: 彼女を通り抜ける
    e.swoopT-=dt;
    e.x+=e.cdx*e.spd*3.2*dt; e.y+=e.cdy*e.spd*3.2*dt;
    if(Math.random()<0.6) parts(e.x,e.y-e.r,1,['#ffb3cf','#ffd6e6'],30,0.7);
  }else{
    e.swoopCd-=dt;
    e.orbitA+=e.orbitDir*0.9*dt;
    const R=120+Math.sin(e.t*1.3+e.joff)*18;
    const tx=p.x+Math.cos(e.orbitA)*R, ty=p.y-10+Math.sin(e.orbitA)*R*0.75;
    const md=Math.hypot(tx-e.x,ty-e.y)||0.001;
    const sp=Math.min(md, e.spd*1.6*dt);
    e.x+=(tx-e.x)/md*sp; e.y+=(ty-e.y)/md*sp;
    if(e.swoopCd<=0 && d<200){
      e.swoopCd=rand(4,6); e.swoopT=Math.min(1.1,(d+60)/(e.spd*3.2));
      e.cdx=dx/d; e.cdy=dy/d;
      sfx(500,300,0.2,'sine',0.04);
    }
  }
  // 鱗粉: 旋回しながら媚薬雲を撒き続ける
  e.dustT-=dt;
  if(e.dustT<=0){
    e.dustT=1.6;
    spawnCloud(e.x,e.y+4,36,3.4,BAL.SENSIT_GAS*0.7,'moth');
  }
}
function potTick(e,dt,d){
  const B=G.B, p=B.hero;
  const holding=attachedSlots(p).some(sl=>p.limbs[sl].mon===e);
  if(e.grabCd>0) e.grabCd-=dt;
  // ジェムを吸い込んで喰う(彼女の磁力に捕まっていないものだけ)→ 夜側のENに
  let ate=0;
  for(const gm of B.gems){
    if(gm.dead||gm.sp>0) continue;
    const gx=e.x-gm.x, gy=(e.y-6)-gm.y, gd=Math.hypot(gx,gy)||0.001;
    if(gd>170) continue;
    const mv=Math.min(gd, 140*dt);
    gm.x+=gx/gd*mv; gm.y+=gy/gd*mv;
    if(gd<10){
      gm.dead=true; ate++; e.eatN++;
      B.en=Math.min(enMax(), B.en+(gm.lo?0.15:0.4));
    }
  }
  if(ate>0){
    B.gems=B.gems.filter(g=>!g.dead);
    parts(e.x,e.y-14,3,['#8fd3ff','#c98cff'],60,0.4);
    if(Math.random()<0.35) floatTxt(e.x,e.y-e.r-14,'+EN','#c98cff',9,0.6);
  }
  if(holding){ e.grabCd=4; return; }
  // 取り返しに近づいた脚を、壺の縁から伸びた触手が繋ぐ
  if(d<74 && e.grabCd<=0){
    if(attachMonster(e,'tether',{r:90})){
      heroBubble(p,pickRand(['ジェム、かえして……って、あし、が!?','つぼ、から……なにか、のびて……','やだ、ひっぱら……はなし、て……っ']),true,2);
    }
    e.grabCd=7;
  }
}
function queenTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  const rush=(attachCount(p)>0||p.pinned||p.charmBind||p.climaxT>0) && d<300 ? 1.5 : 1;
  e.x+=dx/d*e.spd*rush*dt; e.y+=dy/d*e.spd*rush*dt;
  // 甘い脈動: 届く範囲なら「ナメクジ女王という種族」への魅了が一段深まる
  e.pulseCd-=dt;
  if(e.pulseCd<=0){
    e.pulseCd=7;
    B.fx.push({kind:'pulse', x:e.x, y:e.y-e.r*0.6, t:0, life:0.8, r:110, col:'#ffb3cf'});
    sfx(180,420,0.5,'sine',0.05);
    if(d<110 && !p.pinned){
      applyCharm(e,BAL.CHARM_QUEEN_PULSE);
      applySensit(BAL.SENSIT_SLUG);
    }
  }
}
function dreamtreeTick(e,dt,d){
  const B=G.B, p=B.hero;
  if(e.rootCd>0) e.rootCd-=dt;
  e.spawnCd-=dt;
  const holding=attachedSlots(p).some(sl=>p.limbs[sl].mon===e);
  // 幹の洞からワームを産み続ける(自前の子は10体まで。無償なのでロージェムしか落とさない)
  if(e.spawnCd<=0){
    e.spawnCd=5;
    const kids=B.enemies.filter(k=>!k.dead&&k.parent===e).length;
    const nk=holding?2:1;   // v2.4 繋いでいる間は2体ずつ
    for(let i=0;i<nk;i++){ if(kids+i>=10 || B.enemies.length>=fieldCap()) break;
      const a=rand(TAU);
      spawnUnit('worm', e.x+Math.cos(a)*26, e.y+Math.sin(a)*14, {enVal:0, gemMul:0, mult:1.2, parent:e});
      parts(e.x,e.y-e.r,8,['#e86a9c','#5a3a7a'],90,0.5);
    }
  }
  // v2.4 花粉の雨: 12秒ごとに 220px へ(敏感化・発情)
  e.pollenCd=(e.pollenCd===undefined?6:e.pollenCd)-dt;
  if(e.pollenCd<=0){ e.pollenCd=12; B.fx.push({kind:'pulse', x:e.x, y:e.y-e.r, t:0, life:1.0, r:220, col:'#ffb3cf'}); sfx(700,300,0.5,'sine',0.04);
    if(d<220 && !p.pinned && p.freezeT<=0){ applySensit(6); addHeatG(12); heroBubble(p,pickRand(['はなの、こな……っ','けほ……あまい……','からだが、ぽかぽか、して……']),true,2); codexMet('dreamtree'); B.bossMark={id:'dreamtree',t:B.time}; } }
  // 根の繋留(v2.4 170px・5.5秒)
  if(!holding && d<170 && e.rootCd<=0){
    if(attachMonster(e,'tether',{r:130})){
      heroBubble(p,pickRand(['ね、が……あし、に……っ','うごか、ない……ひっぱられ……','やだ、木に、ひきずられ……っ']),true,2);
    }
    e.rootCd=5.5;
  }
  // 甘香の領域: 近いほど身体が熱を覚える(v2.4 150px)
  if(d<150 && !p.pinned){
    applySensit(3*dt);
    applyPleasure(2.4*dt*(holding?1.6:1));
    codexMet('dreamtree');
    if(Math.random()<dt*0.25) heroBubble(p,pickRand(['はな、の、においが……','ちかづくと、あつく……','こんな、におい、で……っ']),false,1);
  }
}
/* ---- v1.2 追加種 ---- */
function sporeTick(e,dt,d,dx,dy){
  // ふわふわ漂いながら寄る
  const bob=Math.sin(e.t*2.1+e.joff)*10;
  e.x+=(dx/d*e.spd + (-dy/d)*bob)*dt; e.y+=(dy/d*e.spd + (dx/d)*bob)*dt;
}
function ghosthandTick(e,dt,d,dx,dy){
  const p=G.B.hero;
  if(e.gropeCd>0) e.gropeCd-=dt;
  const rush=(attachCount(p)>0||p.pinned||p.charmBind||p.climaxT>0) && d<300 ? 1.7 : 1;
  const ox=Math.cos(e.joff)*12, oy=Math.sin(e.joff)*12;
  const tx=dx+ox, ty=dy-14+oy, td=Math.hypot(tx,ty)||0.001;
  e.x+=tx/td*e.spd*rush*dt; e.y+=ty/td*e.spd*rush*dt;
}
function eyeTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  // 近づかず、離れず。彼女が寄れば逃げ、離れれば追う
  if(d<170){ e.x-=dx/d*e.spd*1.3*dt; e.y-=dy/d*e.spd*1.3*dt; }
  else if(d>260){ e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt; }
  else{ e.driftA+=dt*0.6; e.x+=Math.cos(e.driftA)*14*dt; e.y+=Math.sin(e.driftA)*10*dt; }
  // 凝視: 羞恥と敏感化(条件が揃うまで待つ)
  e.gazeCd=Math.max(0,e.gazeCd-dt);
  if(e.gazeCd<=0 && inSight(e,p) && d<BAL.WATCH_R && !p.pinned){
    e.gazeCd=6;
    applySensit(5); applyPleasure(2*unitPmul(e));
    B.fx.push({kind:'gaze', x:e.x, y:e.y-e.r, tx:p.x, ty:p.y-20, t:0, life:0.5});
    heroBubble(p,pickRand(['み、みないで……っ','なんで、そんな、じっと……','めを、そらして……よ……']),false,2);
    codexMet('eye');
    awardAil('watched');
  }
}
function succubusTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  if(e.blocked){ e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt; return; }   // 壁で視線が切れている: 旋回せず流れ場に沿って回り込む
  // 彼女の周りをゆったり回る(小淫魔より大きく、ゆっくり)
  e.orbitA+=e.orbitDir*0.7*dt;
  const R=90+Math.sin(e.t*1.1+e.joff)*16;
  const tx=p.x+Math.cos(e.orbitA)*R, ty=p.y-16+Math.sin(e.orbitA)*R*0.7;
  const md=Math.hypot(tx-e.x,ty-e.y)||0.001;
  const sp=Math.min(md,e.spd*1.4*dt);
  e.x+=(tx-e.x)/md*sp; e.y+=(ty-e.y)/md*sp;
  if(Math.random()<dt*0.3) e.orbitDir*=-1;
  // 寸止め: 指先ひとつで栓をする
  e.denyCd-=dt;
  if(e.denyCd<=0){
    e.denyCd=8;
    if(d<130 && p.denyT<=0 && p.climaxT<=0 && p.aphro>=35){
      applyDeny(e);
      B.fx.push({kind:'pulse', x:e.x, y:e.y-e.r, t:0, life:0.6, r:60, col:'#ff5d9e'});
      floatTxt(e.x,e.y-e.r-12,pickRand(['まだ、だめ♡','とめてあげる♡','おあずけ♡']),'#ff86b3',10,1.1);
    }
  }
}
function webTick(e,dt,d){
  const B=G.B, p=B.hero;
  e.life-=dt;
  if(e.life<=0){ e.dead=true; parts(e.x,e.y-6,10,['#ffb3cf','#fff'],80,0.6); return; }
  if(e.grabCd>0) e.grabCd-=dt;
  const holding=attachedSlots(p).some(sl=>p.limbs[sl].mon===e);
  if(holding){ e.grabCd=2; return; }
  if(e.grabCd<=0 && d<e.r+p.r+4){
    let n=0;
    for(let i=0;i<4;i++){ if(attachMonster(e,'tether',{r:36})) n++; else break; }
    if(n>0){
      heroBubble(p,pickRand(['いと、が……ぜんぶ、からま……っ','ぬけない……ねばって……','あし、うで、うごかな……!?']),true,2);
      sfx(400,120,0.3,'sawtooth',0.06);
      awardAil('web'); learn('web');
    }
    e.grabCd=6;
  }
}

/* ---- v1.3: ゲイザー種・照射触手 ---- */
function eyeCycle(e,ey,dt,d,dx,dy,src){
  // 一つの眼: idle→(視界を照らして)aim→flash→cd。瞳は常に彼女を追う
  const B=G.B, p=B.hero;
  ey.t-=dt;
  const want=Math.atan2((p.y-10)-ey.y, p.x-ey.x);
  if(ey.state==='idle'){
    ey.ang=want+(ey.off||0);
    if(ey.t<=0 && d<ey.r+60 && inSight(e,p) && p.freezeT<=0){
      ey.state='aim'; ey.t=ey.tmax; sfx(180,520,0.4,'sine',0.04);
      ey.off=ey.scatter?ey.scatter*rand(0.45,1.0):0;   // 脇の眼は本人から少しずらした角度に固定して狙う
      ey.ang=want+ey.off;
    }
  }else if(ey.state==='aim'){
    let da=((want+(ey.off||0)-ey.ang+Math.PI*3)%TAU)-Math.PI;
    ey.ang+=clamp(da,-(ey.scatter?0.5:1.5)*dt,(ey.scatter?0.5:1.5)*dt);
    if(ey.t<=0){
      ey.state='flash'; ey.t=0.28;
      B.fx.push({kind:'flash', x:ey.x, y:ey.y, ang:ey.ang, r:ey.r, spread:ey.spread, t:0, life:0.32});
      sfx(1400,900,0.25,'square',0.05);
      if(inSector({x:ey.x,y:ey.y,ang:ey.ang,r:ey.r,spread:ey.spread},p) && !p.pinned) applyHypno(src);
      else floatTxt(ey.x,ey.y-14,'……外れた','#c98cff',9,0.8);
    }
  }else if(ey.state==='flash'){
    if(ey.t<=0){ ey.state='cd'; ey.t=ey.cd; }
  }else{ if(ey.t<=0) ey.state='idle'; }
}
function gazerTick(e,dt,d,dx,dy){
  const p=G.B.hero;
  e.lookA=Math.atan2(dy,dx);
  if(e.gzState==='idle' && d>150){ e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt; }
  const ey={x:e.x, y:e.y-e.r, ang:e.gzAng, r:BAL.GAZE_R, spread:BAL.GAZE_ANG, state:e.gzState, t:e.gzT, tmax:BAL.GAZE_AIM, cd:BAL.GAZE_CD};
  eyeCycle(e,ey,dt,d,dx,dy,e);
  e.gzAng=ey.ang; e.gzState=ey.state; e.gzT=ey.t;
}
function bossgazerTick(e,dt,d,dx,dy){
  const p=G.B.hero;
  e.lookA=Math.atan2(dy,dx);
  { const sp=e.spd*(p.hypnoLv>=1?1.5:1); if(d>120){ e.x+=dx/d*sp*dt; e.y+=dy/d*sp*dt; } }   // v2.4 催眠にかかった彼女へは速く迫る
  for(const ey of e.eyes){
    // 眼柄の位置(胴の周りに三つ)
    // 触手の先端に眼球。真ん中は本人を狙い、両脇は本人の周りをばらばらに狙う(逃げ先を潰す)
    const a=ey.base+Math.sin(e.t*0.8+ey.base)*0.12;
    ey.dx=Math.cos(a)*e.r*1.9; ey.dy=Math.sin(a)*e.r*0.8-e.r*1.7;
    const eo=bossEyeSpec(e,ey,e.eyes.indexOf(ey));
    eyeCycle(e,eo,dt,d,dx,dy,e);
    ey.ang=eo.ang; ey.state=eo.state; ey.t=eo.t; ey.off=eo.off;
  }
}
function beamerTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  e.lookA=Math.atan2(dy,dx);
  e.bmT-=dt;
  const ox=e.x, oy=e.y-e.r*1.4;
  const want=Math.atan2((p.y-14)-oy, p.x-ox);
  if(e.bmState==='idle'){
    if(d>200){ e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt; }
    if(e.bmT<=0 && d<BAL.BEAM_LEN-30 && inSight(e,p) && p.climaxT<=0 && p.refractT<=0 && p.freezeT<=0){ e.bmState='aim'; e.bmT=BAL.BEAM_AIM; e.bmAng=want; sfx(900,1400,0.15,'sine',0.04); }
  }else if(e.bmState==='aim'){
    let da=((want-e.bmAng+Math.PI*3)%TAU)-Math.PI;
    if(e.bmT>0.25) e.bmAng+=clamp(da,-1.2*dt,1.2*dt);   // 照準は1秒。最後の0.25秒は固定——見て横へ跳べば外れる
    if(e.bmT<=0){
      e.bmState='fire'; e.bmT=0.22;
      const ux=Math.cos(e.bmAng), uy=Math.sin(e.bmAng);
      const rx=p.x-ox, ry=(p.y-14)-oy, along=clamp(rx*ux+ry*uy,0,BAL.BEAM_LEN);
      const pd=Math.hypot(rx-ux*along, ry-uy*along);
      B.fx.push({kind:'beam', x:ox, y:oy, ang:e.bmAng, len:BAL.BEAM_LEN, t:0, life:0.3});
      sfx(1600,400,0.3,'sawtooth',0.07);
      if(pd<BAL.BEAM_W/2+p.r*0.7 && !p.pinned && losClear(ox,oy,p.x,p.y-14,true)) forcedClimax(e);
      else floatTxt(p.x,p.y-60,'かわした!','#ffd76a',10,0.9);
    }
  }else if(e.bmState==='fire'){
    if(e.bmT<=0){ e.bmState='cd'; e.bmT=BAL.BEAM_CD; }
  }else{ if(e.bmT<=0) e.bmState='idle'; }
}

/* ================= 地形マップ: 生成・当たり・経路は js/map.js。ここは彼女の目的地と場所の効果 ================= */
function nearGem(p,r){ for(const gm of G.B.gems){ if(Math.hypot(gm.x-p.x,gm.y-p.y)<r) return true; } return false; }
/* 門に挑むのは、2日目以降か、3種以上を理解してから(初日の初見では巣の奥まで行こうとしない) */
function gateAllowed(){ return true; }   // (v2.0: 門は降り口に置き換わった。互換のため残す)
/* 彼女の目的地: 知っている(見たことのある)場所から選ぶ。何も無ければ、まだ見ていない方向へ探索に歩く */
/* ================= v1.8 目当て(彼女が能動的に向かう先) =================
   候補: 光の柱(イベント)・落ちた品・知っている宝箱・知っている場所(祠/泉/清水/石碑/門)・知っている資源(光茸/蜜の花/沈んだ宝)・探索。
   価値÷(1+距離/600) で採点し、GOAL_RETHINK 秒ごと、または目当てが無くなった時に見直す。必要(HP・スタミナ・汚れ)で価値が変わる */
function goalValid(p,g){
  const B=G.B, M=META.map; if(!g) return false;
  if(g.kind==='rescue') return !!(g.ref && g.ref.out);   // v3.0 まだ捕まっている間
  if(g.kind==='gather'){ const P=B.party; return !!(P && P.gather && B.time<P.gather.until && !partyGathered() && !partyDanger()); }   // v3.1 集合の途中
  if(g.kind==='wait') return !!(B.party && B.party.denRole);   // v3.2 外で待っている間
  if(g.kind==='event') return B.event===g.ref;
  if(g.kind==='chest') return B.chests.includes(g.ref) && !g.ref.taken;
  if(g.kind==='item') return B.items.includes(g.ref);
  if(g.kind==='pick') return B.picks.includes(g.ref) && !g.ref.dead;
  if(g.kind==='poi'){ const q=g.ref; if(!M.known[q.key]) return false;
    if(q.kind==='shrine') return !M.visited[q.key];
    if(q.kind==='spring') return p.hp<p.maxHp*0.7 && p.springCd<=0;
    if(q.kind==='pool') return poolWant(p) && !(B.poolCd[q.key]>0);
    if(q.kind==='stele') return !B.steleRead[q.key];
    if(q.kind==='stairs') return !B.exitLocked && B.wantExit;   // v2.1 降りる気になってから
    if(q.kind==='seal') return !B.seals[q.key];
    if(q.kind==='core') return true;
    return true; }
  if(g.kind==='explore') return B.time<g.until && Math.hypot(g.x-p.x,g.y-p.y)>70;
  if(g.kind==='gems'){ let n=0; for(const gm of B.gems){ if(Math.abs(gm.x-g.x)<BAL.GEM_CLUSTER_R && Math.abs(gm.y-g.y)<BAL.GEM_CLUSTER_R) n++; } return n>=2; }   // v2.1 ジェムの群れが残っている
  return false;
}
/* ================= v3.0 パーティAI: 相談して決める・カバーし合う・伝え合う =================
   目当ては共有(B.party.goal)。決め直しの時は全員が自分の案(個人の好み goalPref 込み)を出し、
   同じなら即決、割れたら優先権(P.turn)の子の案に従う(負けた子が次の優先)。ただし救出や大差なら価値の高い案。
   決めた直後は TALK_T 秒、脅威が薄ければ足を止めて言い合う(aiDecide の talk) */
function goalPref(p,kind,sub){ const HD=HEROES[p.id]; if(!HD||!HD.pref) return 1; return HD.pref[sub]||HD.pref[kind]||1; }
function goalKindKey(g){ if(!g) return 'explore'; if(g.kind==='poi'||g.kind==='pick') return g.sub; if(g.kind==='chest') return g.sub==='boss'?'boss':'chest'; return g.kind; }
function pendingLine(hi,path,delay,prio){ const P=G.B&&G.B.party; if(!P) return; P.pending=P.pending||[]; P.pending.push({hi,path,at:G.B.time+(delay||0.9),prio:prio||1}); }
function partyShare(p,kind,x,y,force){
  const B=G.B, o=partnerOf(p); if(!o) return false;
  const far=Math.abs(x-o.x)>W/2 || Math.abs(y-o.y)>H/2;   // 相手の画面外の物だけ伝える(ボスは必ず)
  if(!far && !force) return false;
  if(sayPartyAs(p.hi,'share.'+kind,kind==='boss'?2:1,10)){ pendingLine(o.hi,'share.ack',0.9,1); return true; } return false;
}
function partyExchange(key,sub){
  const B=G.B, P=B.party; if(!P||typeof LINES_P==='undefined'||!LINES_P.banter) return false;
  let pool=LINES_P.banter[key]; if(sub!==undefined && pool && !Array.isArray(pool)) pool=pool[sub]; if(!Array.isArray(pool)||!pool.length) return false;
  const ex=pool[(Math.random()*pool.length)|0]; if(!Array.isArray(ex)) return false; let t=0; P.pending=P.pending||[];
  for(const ln of ex){ const h=B.heroes.find(x=>x.id===ln.s); if(!h||h.out) continue; if(t===0) heroBubble(h,ln.t,true,1); else P.pending.push({hi:h.hi,txt:ln.t,at:B.time+t,prio:1}); t+=1.3; }
  return true;
}
function partyTick(dt){
  const B=G.B, P=B.party; if(!P) return;
  if(P.pending&&P.pending.length){ const keep=[]; for(const q of P.pending){ if(B.time>=q.at){ const h=B.heroes[q.hi]; if(h&&!h.out){ if(q.path) sayPartyAs(q.hi,q.path,q.prio||1,0); else heroBubble(h,q.txt,true,q.prio||1); } } else keep.push(q); } P.pending=keep; }
  denRoleTick();   // v3.2 待つ/踏み込むの見張り
  P.tickT=(P.tickT||0)-dt; if(P.tickT>0) return; P.tickT=0.5;
  const active=B.heroes.filter(h=>!h.out); if(active.length<2) return;
  if(!P.floorSaid && B.time>3){ P.floorSaid=true; partyExchange('floor',String(B.floor.depth)); }
  if(!P.pressSaid && pressure()>=0.35){ P.pressSaid=true; partyExchange('pressure'); }
  let near=0; for(const e of B.enemies){ if(!e.dead&&!e.dormant&&active.some(h=>inSight(e,h))) near++; }
  P.calm=near===0?(P.calm||0)+0.5:0;
  if(P.calm>=6 && B.time-(P.lastBanter||-99)>28){ P.lastBanter=B.time; P.calm=0; partyExchange('idle'); }
}
/* v3.1 集合の判定: 皆が重心から GATHER_R 以内か / 近くに脅威(魔物・拘束・押し倒し・薄い体力)があるか */
function partyCenter(){ const B=G.B; let cx=0,cy=0,n=0; for(const h of B.heroes){ if(h.out) continue; cx+=h.x; cy+=h.y; n++; } return n?{x:cx/n,y:cy/n,n}:null; }
function partyGathered(){ const B=G.B, c=partyCenter(); if(!c||c.n<2) return true; for(const h of B.heroes){ if(h.out) continue; if(Math.hypot(h.x-c.x,h.y-c.y)>BAL.GATHER_R) return false; } return true; }
function partyDanger(){ const B=G.B; if(B.heroes.some(h=>h.out)) return true;   // v3.1 誰かが捕まっているなら相談どころではない(救出が先。3人以上でも救出の案を潰さない)
  for(const h of B.heroes){ if(h.out) continue; if(attachCount(h)>0 || h.pinned || h.hp<h.maxHp*0.4 || (h.threatV||0)>=BAL.GATHER_DANGER_THREAT || nearEnemyCount(h.x,h.y,BAL.GATHER_DANGER_R,false)>0) return true; } return false; }
function updateGoal(p){
  const B=G.B, P=B.party, active=B.heroes.filter(h=>!h.out);
  if(P && P.gather && (active.length<2 || B.time>P.gather.until+1)){ P.gather=null; P.gatherDone=0; }   // v3.1 流れた集合(誰かが捕まった・戦いが長引いた)は、後で「いま集まった」と数えない
  if(!P || active.length<2) return updateGoalSolo(p);
  if(P.denRole && p.hi===P.denRole.wait && denOf()) return denWaitGoal(p);   // v3.2 外で待つ役は、自分の立ち位置を持つ
  if(P.goal && P.owner && !P.owner.out && goalValid(P.owner,P.goal) && B.time<P.until){
    if(p.goal!==P.goal){ p.goal=P.goal; p.goalT=B.time+BAL.GOAL_RETHINK; }
    else if(P.goal.ref && P.goal.kind!=='explore' && P.goal.kind!=='event'){ P.goal.x=P.goal.ref.x; P.goal.y=P.goal.ref.y; }
    return p.goal;
  }
  // v3.1 集合が終わった(揃った・時間切れ・脅威で打ち切り): このあと決めて、向き合って話す
  let gathered=false;
  if(P.gather){ gathered=partyGathered() && !partyDanger(); P.gather=null; P.gatherDone=B.time; B.nGatherDone=(B.nGatherDone||0)+(gathered?1:0); }
  const ci0=B.ci, props=[];
  for(const h of active){ B.ci=h.hi; const g=updateGoalSolo(h); if(g) props.push({h,g}); }
  B.ci=ci0;
  if(!props.length){ P.goal=null; P.owner=null; return null; }
  const g0=props[0].g;
  const same=props.every(x=>x.g.kind===g0.kind && x.g.ref===g0.ref && Math.hypot(x.g.x-g0.x,x.g.y-g0.y)<60);
  // v3.1 相談は近寄ってから: 話す価値のある決め直し(探索以外・台詞の間隔が明けている)で、離れていて脅威が薄ければ、まず互いに歩み寄る
  const talkable=B.time-P.decidedT>BAL.PARTY_TALK_CD && props.some(x=>x.g.kind!=='explore');
  if(talkable && !P.gatherDone && B.time-(P.gatherT||-99)>BAL.GATHER_CD && !partyGathered() && !partyDanger()){
    const c=partyCenter(); P.gather={until:B.time+BAL.GATHER_T, x:c.x, y:c.y}; P.gatherT=B.time;
    const gg={kind:'gather', sub:'gather', x:c.x, y:c.y, ref:null, key:'gather', d:0, worth:1.3, score:1.3};
    P.goal=gg; P.owner=active[0]; P.until=P.gather.until;
    for(const h of active){ h.goal=gg; h.goalT=B.time+BAL.GOAL_RETHINK; }
    const caller=active.find(h=>h.hi===P.turn)||active[0];   // 優先権の子が呼ぶ
    if(sayPartyAs(caller.hi,'gather.call',1,0)){ P.gatherCaller=caller.hi; } else P.gatherCaller=-1;
    B.nGather=(B.nGather||0)+1;
    return p.goal;
  }
  let win=props[0];
  if(!same){
    win=props.find(x=>x.h.hi===P.turn)||props[0];
    const best=props.reduce((a,b)=>b.g.score>a.g.score?b:a);
    if(best!==win && (best.g.kind==='rescue' || best.g.score>win.g.score*1.8)) win=best;   // 救出と大差は優先権より先
    const losers=props.filter(x=>x!==win); if(losers.length){ P.turn=losers[0].h.hi; P.lastLoser=losers[0].h.hi; }
  }
  P.goal=win.g; P.owner=win.h; P.until=B.time+(same?BAL.GOAL_RETHINK:BAL.PARTY_HOLD);
  denAssignRole(win,active);   // v3.2 巣窟が目当てなら、入る役と待つ役を決める
  for(const x of props){ if(P.denRole && x.h.hi===P.denRole.wait) continue; x.h.goal=P.goal; x.h.goalT=B.time+BAL.GOAL_RETHINK; }
  B.nDecide=(B.nDecide||0)+1; if(!same) B.nSplit=(B.nSplit||0)+1;
  if((B.time-P.decidedT>BAL.PARTY_TALK_CD && P.goal.kind!=='explore') || gathered){   // 集まったのなら(探索でも)必ず一言交わす
    P.decidedT=B.time; const kind=goalKindKey(P.goal);
    let t0=0;
    if(gathered){ const arr=active.find(h=>h.hi!==(P.gatherCaller>=0?P.gatherCaller:win.h.hi));   // 呼ばれて歩いてきた子が着いて一言
      if(arr){ pendingLine(arr.hi,'gather.arrive',0.2,1); t0=(arr.hi===win.h.hi)?1.7:0.9; } }   // 着いた子がそのまま言い出す時は、前の吹き出しが消えてから(同じ子の続けざまの台詞は潰れる)
    const said=t0>0?(pendingLine(win.h.hi,'propose.'+kind,t0,1),true):sayPartyAs(win.h.hi,'propose.'+kind,1,0);
    if(said){ for(const x of props){ if(x===win) continue; pendingLine(x.h.hi, same?'same':(x.g.score>win.g.score?'yield':'agree'), t0+0.9, 1); } if((!same || gathered) && (gathered || partyGathered())) P.talkUntil=B.time+(gathered?Math.max(BAL.GATHER_TALK_T,t0+1.6):BAL.TALK_T); }   // 集まって話した時は言い終わるまで向き合う。離れたまま(集合できなかった)なら声だけ掛けて足は止めない(v3.1)
  }
  P.gatherDone=0;
  return p.goal;
}
function updateGoalSolo(p){
  const B=G.B, M=META.map; if(!G.map||!M) return null;
  if(p.goal && goalValid(p,p.goal) && B.time<p.goalT){ if(p.goal.ref && p.goal.kind!=='explore' && p.goal.kind!=='event'){ p.goal.x=p.goal.ref.x; p.goal.y=p.goal.ref.y; } return p.goal; }
  p.goalT=B.time+BAL.GOAL_RETHINK;
  const cands=[];
  if(B.dbgCands) B.lastCands=null;   // 検証用: 目当ての候補を覗く(B.dbgCands=true の時だけ)
  const anyCaptive=B.heroes.some(c=>c.out&&c.captive&&c!==p);   // v3.2 仲間が捕まっている間は、寄り道の価値を落とす(木の実を拾いに行かない)
  const add=(kind,sub,x,y,worth,ref,key)=>{ worth*=goalPref(p,kind,sub); if(anyCaptive && kind!=='rescue') worth*=BAL.RESCUE_FOCUS; if(worth<=0 || !passAt(x,y,false) || nearKnownTrap(x,y)) return; if(ref && gaveUp(ref)) return; /* v2.1 諦めた目標は外す */ if(crestKnow()>=1 && B.traps.some(tr=>tr.armed && Math.hypot(tr.x-x,tr.y-y)<tr.r+40)) return; /* 知っている紋の罠の上は目当てにしない */ const d=Math.hypot(x-p.x,y-p.y); const fz=zoneFear(zoneAt(x,y)), fm=fz>=3?0.5:(fz>=2?0.7:(fz>=1?0.9:1)); cands.push({kind,sub,x,y,ref,key,d,worth,score:worth*fm/(1+d/600)}); };   // v2.2 嫌な地形の中の目当ては割り引く(価値そのものは入る判断に使うので残す)
  const hpR=p.hp/p.maxHp, stR=p.stamina/p.staminaMax;
  const leaving=!!B.wantExit;   // v2.1 降りる気(最終階層では魔核へ向かう気)になったら、寄り道の価値は薄く(拾うのは道すがらだけ)
  let unknownN=0; for(const q of G.map.pois) if(!M.known[q.key]) unknownN++;
  if(B.event){ const ev=B.event; let w=0;
    if(ev.kind==='chest') w=3.2; else if(ev.kind==='star') w=3.0; else if(ev.kind==='shroom') w=2.0;
    else if(ev.kind==='pool') w=poolWant(p)?2.8:0; else if(ev.kind==='stele') w=B.steleRead[ev.key]?0:2.4;
    let ex=ev.x, ey=ev.y;
    if(ev.kind==='shroom' && ev.refs){ let nd=1e9; for(const pk of ev.refs){ if(pk.dead) continue; const dd=Math.hypot(pk.x-p.x,pk.y-p.y); if(dd<nd){ nd=dd; ex=pk.x; ey=pk.y; } } }   // 群生は残っている光茸そのものへ
    add('event',ev.kind,ex,ey,w*(leaving?0.5:1),ev,ev.key); }
  for(const it of B.items){ if(it.known) add('item',it.kind,it.x,it.y,3.0,it); }
  for(const c of B.heroes){ if(c.out && c.captive && c!==p) add('rescue','rescue',c.x,c.y,BAL.RESCUE_WORTH,c,'rescue'+c.hi); }   // v3.0 捕まった仲間の救出は最優先の目当て(v3.2 価値を上げ、他を割り引く)
  for(const c of B.chests){ if(c.known && !c.taken) add('chest',c.bossChest?'boss':'chest',c.x,c.y,(c.bossChest?3.0:2.6)*(leaving?0.3:1),c); }   // v2.1 降りると決めたら箱は後回し
  for(const q of G.map.pois){
    if(!M.known[q.key]) continue; let w=0;
    if(q.kind==='shrine') w=M.visited[q.key]?0:2.2;
    else if(q.kind==='spring') w=(hpR<0.7 && p.springCd<=0)?(hpR<0.45?3.2:2.4):0;
    else if(q.kind==='pool') w=(poolWant(p) && !(B.poolCd[q.key]>0))?((p.sensit>=60||p.slow>0)?3.2:2.6):0;
    else if(q.kind==='stele') w=B.steleRead[q.key]?0:1.7;
    else if(q.kind==='stairs') w=(B.exitLocked||!B.wantExit)?0:BAL.EXIT_WORTH_WANT;   // v2.1 「降りよう」と決めてから(exitTick)。それまでは他を見て回る
    else if(q.kind==='seal') w=B.seals[q.key]?0:2.4;
    else if(q.kind==='core') w=B.wantExit?BAL.EXIT_WORTH_WANT:2.6;   // v2.2 向かう気になったら最優先
    if(leaving && q.kind!=='stairs' && q.kind!=='seal' && q.kind!=='core' && q.kind!=='spring') w*=0.3;
    add('poi',q.kind,q.x,q.y,w,q,q.key);
  }
  for(const pk of B.picks){
    if(pk.dead||!pk.known) continue; let w=0;
    if(pk.kind==='shroom') w=1.1+(unknownN>3?0.5:0);
    else if(pk.kind==='nectar') w=(stR<0.6||hpR<0.7)?2.0:0.5;
    else if(pk.kind==='treasure') w=zoneFear('water')>=2?0.9:1.6;
    if(leaving) w*=0.3;
    add('pick',pk.kind,pk.x,pk.y,w,pk);
  }
  // v2.1 ジェムの群れ: 近くにまとまって落ちているなら拾い集めるのも目当て(強化は階層を跨いで残るので、拾える物は拾う)
  if(p.goal && p.goal.kind==='gems'){ p.clusterT=(p.clusterT||0)+BAL.GOAL_RETHINK; if(p.clusterT>=BAL.GEM_FARM_T){ p.clusterT=0; p.noClusterUntil=B.time+BAL.GEM_FARM_CD; sayLine('gemFast',0,30,'キラキラは、あとで! すすむ!'); } } else p.clusterT=Math.max(0,(p.clusterT||0)-BAL.GOAL_RETHINK*0.5);   // v2.1 群れを拾うのは一度に GEM_FARM_T 秒まで、その後 GEM_FARM_CD 秒は他へ
  if(!leaving && !(B.time<(p.noClusterUntil||0))){ let bestG=null, bn=0;
    for(const gm of B.gems){ if(Math.abs(gm.x-p.x)>560||Math.abs(gm.y-p.y)>560) continue; if(G.map && !passAt(gm.x,gm.y,false)) continue; if(zoneFear(zoneAt(gm.x,gm.y))>=2.5) continue;
      let n=0; for(const g2 of B.gems){ if(Math.abs(g2.x-gm.x)<BAL.GEM_CLUSTER_R && Math.abs(g2.y-gm.y)<BAL.GEM_CLUSTER_R) n++; } if(n>bn){ bn=n; bestG=gm; } }
    if(bestG && bn>=3) add('gems','gems',bestG.x,bestG.y,Math.min(BAL.GEM_CLUSTER_MAX,BAL.GEM_CLUSTER_W*bn),null); }
  // 探索: 目立った目当てが無いとき、届く床の上の未踏の方向へ
  if(!cands.some(c=>c.score>=0.35)){
    if(!p.explore || B.time>p.exploreUntil || Math.hypot(p.explore.x-p.x,p.explore.y-p.y)<70) pickExplore(p);
    if(p.explore) add('explore','explore',p.explore.x,p.explore.y,0.6,null);
  }
  let best=null; for(const c of cands){ if(!best||c.score>best.score) best=c; }
  if(B.dbgCands) B.lastCands=cands.slice().sort((a,b)=>b.score-a.score).slice(0,6).map(c=>c.kind+'/'+(c.sub||'')+':'+c.score.toFixed(2)+'@'+Math.round(c.d));   // 検証用: 目当ての候補
  // v2.1 ふらつき防止: いまの目当てが有効なら、はっきり良い(GOAL_KEEP倍)候補が出るまで乗り換えない
  if(best && p.goal && p.goal.kind!=='explore' && goalValid(p,p.goal) && !(best.ref&&best.ref===p.goal.ref&&best.kind===p.goal.kind)){
    const same=p.goal.ref?cands.find(c=>c.ref===p.goal.ref&&c.kind===p.goal.kind):null;   // 価値は今の評価で(降りると決めた後に箱の価値が下がる等)。候補から外れていれば乗り換える
    if(same){ const cd=same.d, cs=same.score; if(best.score<cs*BAL.GOAL_KEEP){ p.goal.d=cd; p.goal.score=cs; p.goal.worth=same.worth; return p.goal; } }
  }
  if(best && best.kind==='explore') best.until=p.exploreUntil;
  if(best && p.goal && best!==p.goal && (best.kind!==p.goal.kind || best.ref!==p.goal.ref) && best.kind!=='explore' && Math.random()<0.25) p.pauseUntil=B.time+0.5+Math.random()*0.6;   // v2.2 目当てを変える時、ときどき一拍考える
  p.goal=best;
  return best;
}
function pickDest(p){
  const M=META.map, B=G.B; if(!G.map||!M) return null;
  if(p.dest && B.time<p.destUntil){ if(Math.hypot(p.dest.x-p.x,p.dest.y-p.y)>40) return p.dest; }
  p.destUntil=B.time+6;   // 6秒ごとに目的地を見直す
  let best=null, bd=1e9;
  for(const q of G.map.pois){
    if(!M.known[q.key]) continue;
    if(q.kind==='shrine' && M.visited[q.key]) continue;
    if(q.kind==='spring' && !(p.hp<p.maxHp*0.7 && p.springCd<=0)) continue;
    if(q.kind==='stairs' && B.exitLocked) continue;
    const d=Math.hypot(q.x-p.x,q.y-p.y);
    if(d<bd){ bd=d; best=q; }
  }
  if(best){ p.dest={x:best.x,y:best.y,kind:best.kind,key:best.key}; return p.dest; }
  if(!p.explore || B.time>p.exploreUntil || Math.hypot(p.explore.x-p.x,p.explore.y-p.y)<70) pickExplore(p);
  if(!p.explore) return null;
  p.dest={x:p.explore.x,y:p.explore.y,kind:'explore'};
  return p.dest;
}
/* 探索点: 届く床の上から、まだ見ていない場所のそばを選ぶ(詰まり脱出でも使う) */
/* ================= v2.4 視界の記憶 =================
   見えた範囲をタイル単位で覚える(G.map.seen)。同じ世代・同じ階層なら再挑戦でも覚えている(META.run.seen にビット詰めで保存)。
   探索点は「まだ見ていないタイルが多い所」を優先し、近い所から埋める。ミニマップには未探索の霧 */
function initSeen(){
  const M=G.map; if(!M) return; const key=M.gi+':'+M.floor;
  if(!M.seen || M.seenKey!==key){ M.seen=new Uint8Array(MAP_W*MAP_H); M.seenKey=key; const pk=META.run&&META.run.seen&&META.run.seen[key]; if(pk) unpackSeen(pk,M.seen); }
  let pn=0, sn=0; for(let k=0;k<M.seen.length;k++){ if(M.solid[k]===0){ pn++; if(M.seen[k]) sn++; } }
  M.passN=pn; M.seenN=sn; M.fog=null; M.fogT=-9;
}
function packSeen(a){ const b=new Uint8Array(Math.ceil(a.length/8)); for(let i=0;i<a.length;i++) if(a[i]) b[i>>3]|=1<<(i&7); let s=''; for(let i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); return btoa(s); }
function unpackSeen(str,a){ try{ const s=atob(str); for(let i=0;i<a.length;i++){ const c=s.charCodeAt(i>>3); if(c===c && ((c>>(i&7))&1)) a[i]=1; } }catch(e){} }
function saveSeen(){ const M=G.map; if(!M||!M.seen||!META.run) return; META.run.seen=META.run.seen||{}; META.run.seen[M.seenKey]=packSeen(M.seen); }
function seenFrac(){ const M=G.map; return (M&&M.passN)?M.seenN/M.passN:1; }
function seenTick(dt){
  const B=G.B, p=B.hero, M=G.map; if(!M||!M.seen) return;
  p.seenT=(p.seenT||0)-dt; if(p.seenT>0) return; p.seenT=BAL.SEEN_T;   // v3.0 ヒロインごとの視界
  const rx=BAL.SEEN_R, ry=BAL.SEEN_RY, i0=Math.max(0,tileI(p.x-rx)), i1=Math.min(MAP_W-1,tileI(p.x+rx)), j0=Math.max(0,tileJ(p.y-ry)), j1=Math.min(MAP_H-1,tileJ(p.y+ry));
  for(let j=j0;j<=j1;j++){ const yy=(tileCY(j)-p.y)/ry; for(let i=i0;i<=i1;i++){ const k=j*MAP_W+i; if(M.seen[k]) continue; const xx=(tileCX(i)-p.x)/rx; if(xx*xx+yy*yy>1) continue; M.seen[k]=1; if(M.solid[k]===0) M.seenN++; } }
  M.fogT=-9;   // ミニマップの霧を作り直す
  if(!B.exploreSaid && seenFrac()>=BAL.EXPLORE_DONE && B.time>30){ B.exploreSaid=true; sayLine('exploreDone',0,0,'ここ、だいたい みたかも'); }
}
/* その点の周り(±rt タイル)で、床のうちまだ見ていない割合 */
function unseenAround(x,y,rt){
  const M=G.map; if(!M||!M.seen) return 0; const ci=tileI(x), cj=tileJ(y); let n=0, u=0;
  for(let j=Math.max(0,cj-rt);j<=Math.min(MAP_H-1,cj+rt);j++) for(let i=Math.max(0,ci-rt);i<=Math.min(MAP_W-1,ci+rt);i++){ const k=j*MAP_W+i; if(M.solid[k]!==0) continue; n++; if(!M.seen[k]) u++; }
  return n?u/n:0;
}
/* v2.4 ボスを想定するか: 見えているボス / 最終階層(魔核) / 最近ボスに何かされた / この run でボスを見た */
function bossExpected(){
  const B=G.B; if(!B) return false; const p=B.hero;
  if(B.floor&&B.floor.final) return true;
  if(B.bossSeen || (META.run&&META.run.bossSeen)) return true;
  if(B.bossMark && B.time-B.bossMark.t<BAL.BOSS_MEMORY_T) return true;
  return B.enemies.some(e=>e.boss&&!e.dead&&inSight(e,p));
}
function pickExplore(p){
  const M=META.map, B=G.B; if(!G.map||!M) return null;
  const useSeen=BAL.SEEN_EXPLORE && G.map.seen && seenFrac()<0.97;   // ほぼ見尽くしたら旧来のうろつきへ
  const leaving=!!B.wantExit;   // v2.2 最終階層でも「魔核へ向かう気」になったら同じ
  const okZone=(q)=>{ const qz=zoneAt(q.x,q.y); return !(zoneFear(qz)>=2 || (p.scared&&p.scared[qz]>B.time)); };   // v2.2 「できれば避けたい」以上の地形の中は探索点にしない
  const cands=[];
  for(let k=0;k<12;k++){
    const a=rand(TAU), dd=rand(600,1200);
    const q=snapFloor(clampMapX(p.x+Math.cos(a)*dd,120), clampMapY(p.y+Math.sin(a)*dd,120), false, 6);
    if(!q || !reachableAt(q.x,q.y,false) || !okZone(q)) continue;
    cands.push(q);
  }
  if(useSeen){   // v2.4 まだ見ていない床から直接いくつか(近い所が選ばれやすい)
    let got=0; for(let t=0;t<48 && got<8;t++){ const i=(Math.random()*MAP_W)|0, j=(Math.random()*MAP_H)|0, k=j*MAP_W+i; if(G.map.solid[k]!==0 || G.map.seen[k]) continue; const q={x:tileCX(i),y:tileCY(j)}; if(Math.hypot(q.x-p.x,q.y-p.y)<200) continue; if(!reachableAt(q.x,q.y,false) || !okZone(q)) continue; cands.push(q); got++; }
  }
  let cand=null, cs=-1e9;
  for(const q of cands){
    const dist=Math.hypot(q.x-p.x,q.y-p.y);
    let sc=useSeen ? unseenAround(q.x,q.y,7)*BAL.EXPLORE_UNSEEN_W - dist/1200*BAL.EXPLORE_DIST_W : dist/1200;
    for(const po of G.map.pois){ if(!M.known[po.key]){ sc+=Math.max(0,1-Math.hypot(po.x-q.x,po.y-q.y)/700)*(leaving?2:1); if(leaving && (po.kind==='stairs'||po.kind==='core')) sc+=1.5*Math.max(0,1-Math.hypot(po.x-q.x,po.y-q.y)/1600); } }   // まだ見ていない場所の近くを優先
    if(sc>cs){ cs=sc; cand={x:q.x,y:q.y}; }
  }
  if(cand && useSeen && unseenAround(cand.x,cand.y,7)>0.5 && Math.random()<0.35) sayLine('exploreNew',0,20);
  p.explore=cand; p.exploreUntil=B.time+30;
  return cand;
}
/* 場所: 見えたら覚える。着いたら効く */
function poiTick(dt){
  const B=G.B, p=B.hero, M=META.map; if(!G.map||!M) return;
  if(p.springCd>0) p.springCd-=dt;
  if(p.bathT>0){
    p.bathT-=dt; p.vx=0; p.vy=0;
    p.hp=Math.min(p.maxHp,p.hp+p.maxHp*0.14*dt); applySensit(5*dt); addHeatG(10*dt);
    if(Math.random()<dt*3) parts(p.x+rand(-14,14),p.y-30,1,['#fff','#ffe0f0'],40,1.2);
  }
  // v1.8 清水で流す / 石碑を読む(足が止まる。掴まれたら中断)
  if(p.poolT>0||p.readT>0){
    if(attachCount(p)>0||p.pinned||p.charmBind){ p.poolT=0; p.readT=0; }
    else{
      p.vx=0; p.vy=0;
      if(p.poolT>0){ p.poolT-=dt; if(Math.random()<dt*4) parts(p.x+rand(-12,12),p.y-10,1,['#cffaff','#fff'],40,0.8); if(p.poolT<=0){ const q=G.map.pois.find(o=>o.key===p.poolKey); if(q) usePool(q); } }
      if(p.readT>0){ p.readT-=dt; if(p.readT<=0){ const q=G.map.pois.find(o=>o.key===p.readKey); if(q) readStele(q, !!(B.event&&B.event.key===q.key)); } }
    }
  }
  B.poiCd-=dt;
  for(const q of G.map.pois){
    if(!M.known[q.key] && inSight(q,p)){
      M.known[q.key]=1; M.seen=(M.seen||0)+1;
      floatTxt(q.x,q.y-40,'みつけた: '+POI_DEF[q.kind].name,'#8fd3ff',12,1.8);
      sayLine('poi.'+q.kind,1,0,q.kind==='stairs'?'おりぐち、みっけ! でも、まだ見てないとこあるし':pickRand(['あそこ、なにかある……','あれ、なんだろ','おぼえておこう']));   // v2.1 場所ごとの台詞
      partyShare(p,'poi',q.x,q.y);   // v3.0 相手に伝える
      if(q.kind==='stairs') setBanner('降り口を見つけた',exitGuarded()?'石の番兵が守っている。彼女は他を見てから降りる':'彼女は見るものを見てから降りる','#8fd3ff');
      if(q.kind==='core'){ setBanner('魔核の間','深淵の心臓。彼女は挑むだろう','#ff6b81'); { const two=B.heroes.length>1, V=(typeof STORY_V30!=='undefined')?STORY_V30:null; const fe=(two&&V&&V.finalEncounter&&V.finalEncounter.length)?V.finalEncounter:STORY.finalEncounter;   // v3.0 二人で魔核を見る
        if(fe.length && !B.storyCoreSeen){ B.storyCoreSeen=true; UI.showStory(fe,{dur:11}); } } }
      if(q.kind==='seal') setBanner('封印石','3つ全て灯すと降り口が開く','#c98cff');
    }
    const d=Math.hypot(q.x-p.x,q.y-p.y);
    if(q.kind==='shrine' && d<34 && !M.visited[q.key]){
      M.visited[q.key]=1;
      const ids=Object.keys(LUMINA_UPG).filter(id=>luminaRank(id)<LUMINA_UPG[id].max);
      let got='';
      if(ids.length){ const id=pickRand(ids); META.lumina.upg[id]=(META.lumina.upg[id]||0)+1; got=LUMINA_UPG[id].name; }
      META.lumina.coins+=30;
      B.shrineGot.push(got?(got+' +1'):'コイン+30');
      setBanner('祠の加護',got?(got+' +1(永続)'):'コイン+30','#ffd76a');
      heroBubble(p,pickRand(['……あたたかい。ありがとう','ちからが、わいてくる','ここ、おぼえた']),false,2);
      parts(q.x,q.y-20,30,['#ffd76a','#fff','#ffe9b0'],140,1.0); sfx(600,1200,0.6,'sine',0.06); S.pick();
      saveMeta();
    }
    if(q.kind==='spring' && d<40 && p.springCd<=0 && p.hp<p.maxHp*0.8 && attachCount(p)===0 && !p.pinned && p.climaxT<=0){
      p.springCd=60; p.bathT=3.5;
      setBanner('泉で休む','湯があつい。回復するが、身体も火照る','#8fd3ff');
      heroBubble(p,pickRand(['ちょっとだけ、やすも……','あつ……でも、きもちいい……','すぐ、もどるから……']),true,2);
      awardAil('heatg');
    }
    if(q.kind==='pool' && d<38 && !(B.poolCd[q.key]>0) && p.poolT<=0 && poolWant(p) && attachCount(p)===0 && !p.pinned && !p.charmBind && p.climaxT<=0){
      p.poolT=BAL.POOL_T; p.poolKey=q.key;
      setBanner('清水で流す','冷たい水。敏感化・発情・粘液が流れる——足が止まる','#8fd3ff');
      heroBubble(p,pickRand(['つめた……でも、ながさなきゃ','ちょっと、あらうだけ……']),true,2);
    }
    if(q.kind==='stele' && d<40 && !B.steleRead[q.key] && p.readT<=0 && attachCount(p)===0 && !p.pinned && !p.charmBind && p.climaxT<=0){
      p.readT=BAL.STELE_T; p.readKey=q.key;
      heroBubble(p,pickRand(['なにか、かいてある……','ふるい、もじ……よめる、かな']),true,1);
    }
    // v2.0 降り口: そばに立ち続けると次の階層へ(その日は終わり)。封印の階層では石を全部灯すまで閉じている
    if(q.kind==='stairs'){
      if(!B.wantExit && d<130 && M.known[q.key]) sayLine('stairsWait',0,30,'まだ、おりないよ。あとで!');   // v2.1 まだ降りない
      if(!B.exitLocked && !exitGuarded() && d<60 && !p.pinned && p.climaxT<=0 && attachCount(p)===0 && !p.charmBind){
        if(B.ci===nearestHeroIdx(q.x,q.y)) B.exitT+=dt;   // v3.0 いちばん近い子だけが進める(二人で倍速にならない) if(B.exitT>0.3 && B.exitT<0.3+dt) heroBubble(p,'……ここから、おりられる',false,2);
        if(B.exitT>=BAL.EXIT_STAND && G.mode==='battle') startDescend();
      }else if(d>=60 && !B.heroes.some(h=>!h.out&&h!==p&&Math.hypot(q.x-h.x,q.y-h.y)<60)) B.exitT=Math.max(0,B.exitT-dt*2);   // v3.0 相手が降り口に居るなら減らさない
    }
    if(q.kind==='seal'){
      if(!B.seals[q.key] && d<44 && !p.pinned && p.climaxT<=0 && attachCount(p)===0 && !p.charmBind){
        if(B.ci===nearestHeroIdx(q.x,q.y)) q.litT=(q.litT||0)+dt;   // v3.0 いちばん近い子だけが灯す
        if(q.litT>=BAL.EXIT_STAND){
          B.seals[q.key]=1; B.used.seal=(B.used.seal||0)+1;
          const n=Object.keys(B.seals).length, tot=G.map.pois.filter(o=>o.kind==='seal').length;
          setBanner('封印石が灯った '+n+'/'+tot, n>=tot?'降り口が開いた':'まだ閉じている','#ffd76a');
          heroBubble(p,n>=tot?'……ひらいた。いける':'あと、'+(tot-n)+'つ',false,2);
          parts(q.x,q.y-20,24,['#ffd76a','#fff'],140,0.9); S.pick();
          if(n>=tot){ B.exitLocked=false; p.goal=null; }
        }
      }else if(d>=44 && !B.heroes.some(h=>!h.out&&h!==p&&Math.hypot(q.x-h.x,q.y-h.y)<44)) q.litT=0;   // v3.0 相手が石のそばに居るなら消さない
    }
  }
}

/* v2.0 降りる: 数秒の余韻ののち、その日を終える */
function startDescend(){
  const B=G.B, p=B.hero; if(B.descending) return;
  B.descending=true; B.exitT=0;
  for(const sl of attachedSlots(p)) p.limbs[sl]=null; for(const sl of suckSlots(p)) p.suckers[sl]=null;
  setBanner('降り口へ','ルミナは次の階層へ降りていく……','#8fd3ff');
  { const sf=storyFloor(B.floor.depth); if(sf.descend.length) UI.showStory(sf.descend,{dur:6}); }
  heroBubble(p,pickRand(['……いくよ。まだ、おりられる','ここは、もういい。つぎ']),true,3);
  parts(p.x,p.y-10,26,['#8fd3ff','#fff','#cbd5ff'],160,1.0); S.clear();
  G.mode='survived'; B.winT=2.4;
}
/* ================= v2.1 石の番兵(降り口の守り手) =================
   降り口の周りに輪になって立ち、全員が共有の拍で動く。彼女が穴に近づくと彼女と穴の間に半円で並び、同じ速さで詰め、
   SENTINEL_STEP_CD ごとに一斉に踏み込む。触れれば石の腕で抱え込む(繋留・据わる)。残っている間は降り口が使えない。穴から SENTINEL_LEASH 以上は出ない */
function spawnSentinels(){
  const B=G.B, st=G.map&&G.map.pois.find(o=>o.kind==='stairs'); if(!st) return;
  const F=B.floor, n=Math.min(BAL.SENTINEL_N[Math.min(BAL.SENTINEL_N.length-1,Math.max(0,F.depth-1))], BAL.SENT_ERA[Math.min(BAL.SENT_ERA.length-1,eraNow())]);   // v3.0 世代が浅いうちは番兵が少ない
  B.sentRing={x:st.x,y:st.y,key:st.key,phase:rand(TAU),stepCd:BAL.SENTINEL_STEP_CD,stepT:0,alert:false,n};
  for(let i=0;i<n;i++){
    const a=B.sentRing.phase+i*TAU/n;
    const e=spawnUnit('sentinel',st.x+Math.cos(a)*BAL.SENTINEL_RING,st.y+Math.sin(a)*BAL.SENTINEL_RING*0.7,{});
    e.slotA=i*TAU/n; e.hp=e.maxHp=Math.round(BAL.SENTINEL_HP*(1+0.35*(F.depth-1))*(1+0.08*Math.max(0,(META.gen.idx||1)-1)));
  }
}
function exitGuarded(){ const B=G.B; return !!B && B.enemies.some(e=>e.id==='sentinel'&&!e.dead); }
function sentinelTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero, R=B.sentRing; if(!R) return;
  const holding=attachedSlots(p).some(sl=>p.limbs[sl].mon===e);
  const hd=Math.hypot(p.x-R.x,p.y-R.y);
  const alert=hd<BAL.SENTINEL_ALERT && !p.pinned;
  // 共有の拍: 生きている先頭の個体だけが輪の状態を進める(抱え込んでいる個体でも進める——止まると踏み込みが解けない)
  if(e===B.enemies.find(o=>o.id==='sentinel'&&!o.dead)){
    R.phase+=dt*(alert?0.04:0.22); R.alert=alert;
    if(R.stepT>0) R.stepT-=dt;
    if(alert){ R.stepCd-=dt; if(R.stepCd<=0 && R.stepT<=0){ R.stepCd=BAL.SENTINEL_STEP_CD; R.stepT=BAL.SENTINEL_STEP_T; sfx(90,60,0.25,'square',0.08); G.shake=Math.min(6,G.shake+3); sayLine('sentinel.close',1,12,'いっせいに、きた……!'); } }
    else R.stepCd=Math.max(R.stepCd,1.2);
    if(alert && !B.guardSaid && META.map.known[R.key]){ B.guardSaid=true; sayLine('guarded',1,0,'あの石の人たち、あなを守ってる……'); }
  }
  if(holding){ e.state='idle'; return; }   // 抱え込んでいる間は据わる(繋留が彼女を留める)
  if(e.state==='idle') e.state='chase';
  let tx,ty,spd=e.spd;
  if(alert){
    // 彼女と穴の間に半円で並び、同じ速さで詰める。踏み込みの間は一斉に速い
    const ang=Math.atan2(p.y-R.y,p.x-R.x), k=e.slotA/TAU-0.5+0.5/R.n;
    const a=ang+k*Math.PI*0.9, rr=Math.min(BAL.SENTINEL_LEASH,Math.max(40,hd-34));
    tx=R.x+Math.cos(a)*rr; ty=R.y+Math.sin(a)*rr*0.7;
    if(R.stepT>0){ tx=p.x; ty=p.y; spd=BAL.SENTINEL_STEP_SPD; }
  }else{
    const a=R.phase+e.slotA; tx=R.x+Math.cos(a)*BAL.SENTINEL_RING; ty=R.y+Math.sin(a)*BAL.SENTINEL_RING*0.7;
  }
  const mx=tx-e.x, my=ty-e.y, md=Math.hypot(mx,my)||0.001, mv=Math.min(md,spd*dt);
  e.x+=mx/md*mv; e.y+=my/md*mv;
  if(Math.hypot(e.x-R.x,e.y-R.y)>BAL.SENTINEL_LEASH){ const a=Math.atan2(e.y-R.y,e.x-R.x); e.x=R.x+Math.cos(a)*BAL.SENTINEL_LEASH; e.y=R.y+Math.sin(a)*BAL.SENTINEL_LEASH; }
  // 接触: 石の腕で背後から両腕ごと抱え込む(腕が空いていなければ脚)。据わって繋留する
  if(d<e.r+p.r+4 && p.ifr<=0 && !p.pinned && (e.grabCd||0)<=0){
    const arms=!!freeSlotFor('tether',false,true);
    if(attachMonster(e,'tether',{r:36,needMul:1.5,armsOnly:arms})){ e.state='idle'; e.grabCd=4; hurtHero(e.dmg*0.5,e,{noKb:true}); codexMet('sentinel'); heroBubble(p,pickRand(['つめた……うで、うごかない……!','いしの、うで……はなして……っ']),true,2); }   // 振りほどかれた後は少し間を置く
    else e.grabCd=1.0;
  }
  if((e.grabCd||0)>0) e.grabCd-=dt;
}
/* ================= v2.3 奥義(彼女の後半の強化) =================
   Lvで解放され、AIが状況で使う。跳躍=囲まれた時に空いている方へ、浄化=拘束を千切って弾く、壁=瀕死で被ダメ-70% */
function skillReady(p,id){ const s=heroSkills(p)[id]; return !!s && p.level>=s.lv && (p.skillCd[id]||0)<=0; }   // v3.0 ヒロインごとの奥義
function useSkill(p,id){ const B=G.B, s=heroSkills(p)[id]; p.skillCd[id]=s.cd; B.nSkill=B.nSkill||{}; B.nSkill[id]=(B.nSkill[id]||0)+1; setBanner('奥義 '+s.name,s.desc.split('。')[0],'#ffd76a'); sayLine('skill.'+id,2,0,s.name+'!'); S.lvup(); }
function nearEnemyCount(x,y,r,all){ let n=0; for(const e of G.B.enemies){ if(e.dead||e.dormant||e.item||e.state==='attached'||e.id==='imp') continue; if(e.id==='flower' && !e.revealed) continue; if(!all && MONSTERS[e.id].spd<=0) continue; if(Math.hypot(e.x-x,e.y-y)<r) n++; } return n; }   // all=true で据わった個体も数える(逃げ先・跳び先の採点)
function skillTick(dt){
  const B=G.B, p=B.hero;
  for(const k in p.skillCd) if(p.skillCd[k]>0) p.skillCd[k]-=dt;
  if(BAL.SMART_AI && B.ci===leaderIdx()){ const anyFlee=B.heroes.some(h=>!h.out&&h.aiMode==='flee'); if(anyFlee) B.fleeT=(B.fleeT||0)+dt; else B.fleeT=Math.max(0,(B.fleeT||0)-dt*0.5); }   // 逃げ続けた秒数(誰かが逃げに徹している間。exitTick が「降り口を探す」に使う)
  if(p.guardT>0){ p.guardT-=dt; if(Math.random()<dt*10) parts(p.x+rand(-16,16),p.y-rand(0,30),1,['#ffd76a','#fff'],30,0.6); }
  if(G.mode!=='battle') return;
  if(p.freezeT>0 || (p.stumbleDur||0)>0 || p.bathT>0 || p.poolT>0 || p.readT>0) return;   // 時間停止・よろめき・湯/清水/石碑の間は奥義も出ない
  // 聖光の壁: 瀕死
  if(skillReady(p,'bulwark') && p.hp<p.maxHp*0.35 && !p.pinned){ p.guardT=4; useSkill(p,'bulwark'); parts(p.x,p.y-14,30,['#ffd76a','#fff','#ffe9b0'],200,0.8); }
  // 浄化の脈: 二肢以上を掴まれた／押し倒された
  if(skillReady(p,'purge') && (attachCount(p)>=2 || p.pinned) && !p.charmBind && p.hypnoLv<2){   // 催眠Ⅱ+では振り払う気が起きない
    for(const sl of attachedSlots(p)) detachLimb(sl,{fling:true});
    for(const sl of suckSlots(p)) detachSucker(sl,{fling:true});
    if(p.pinned){ p.pinned=false; p.pinBy=null; p.pinEscape=0; p.struggle=0; if(B.pinSceneHi===B.ci) B.pinScene=null; }
    for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue; const dx=e.x-p.x, dy=e.y-p.y, d=Math.hypot(dx,dy)||0.001; if(d<120){ if(MONSTERS[e.id].spd>0 && !MONSTERS[e.id].guardian){ e.x+=dx/d*90; e.y+=dy/d*90; collideMap(e,e.r*0.75,canFly(e.id)); } e.stun=Math.max(e.stun||0,e.boss?0.6:1.2); } }
    p.ifr=Math.max(p.ifr,1.0); p.stamina=Math.min(p.staminaMax,p.stamina+20); useSkill(p,'purge'); parts(p.x,p.y-14,40,['#fff','#8fd3ff','#ffd76a'],260,0.9); G.shake=Math.min(8,G.shake+5);
  }
  if(p.id==='freila'){
    // 不死鳥: 瀕死で炎とともに立ち上がる(回復・無敵・周りを焼く)
    if(skillReady(p,'phoenix') && p.hp<p.maxHp*0.30){ p.hp=Math.min(p.maxHp,p.hp+Math.round(p.maxHp*0.35)); p.ifr=Math.max(p.ifr,2.0);
      for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue; const d=Math.hypot(e.x-p.x,e.y-p.y); if(d<200){ damageEnemy(e,40*(1+0.06*p.level)); e.stun=Math.max(e.stun||0,e.boss?0.5:1.0); } }
      useSkill(p,'phoenix'); parts(p.x,p.y-14,50,['#ff7a3a','#ffd76a','#fff'],260,0.9); G.shake=Math.min(8,G.shake+5); }
    // 熾火の壁: 拘束を焼き切り、4秒間 近づく魔物を焦がす
    if(skillReady(p,'ember') && (attachCount(p)>=2 || p.pinned) && !p.charmBind && p.hypnoLv<2){
      for(const sl of attachedSlots(p)) detachLimb(sl,{fling:true});
      for(const sl of suckSlots(p)) detachSucker(sl,{fling:true});
      if(p.pinned){ p.pinned=false; p.pinBy=null; p.pinEscape=0; p.struggle=0; if(B.pinSceneHi===B.ci) B.pinScene=null; }
      for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue; const dx=e.x-p.x, dy=e.y-p.y, d=Math.hypot(dx,dy)||0.001; if(d<120){ if(MONSTERS[e.id].spd>0 && !MONSTERS[e.id].guardian){ e.x+=dx/d*90; e.y+=dy/d*90; collideMap(e,e.r*0.75,canFly(e.id)); } e.stun=Math.max(e.stun||0,e.boss?0.6:1.2); damageEnemy(e,18*(1+0.05*p.level)); } }
      p.ifr=Math.max(p.ifr,1.0); p.stamina=Math.min(p.staminaMax,p.stamina+20); p.emberT=4; useSkill(p,'ember'); parts(p.x,p.y-14,40,['#ff7a3a','#ffd76a','#fff'],260,0.9); G.shake=Math.min(8,G.shake+5);
    }
    if(p.emberT>0){ p.emberT-=dt; if(Math.random()<dt*14) parts(p.x+rand(-30,30),p.y-rand(0,30),1,['#ff7a3a','#ffd76a'],40,0.5);
      for(const e of B.enemies){ if(e.dead||e.dormant||e.item||e.state==='attached') continue; const dx=e.x-p.x, dy=e.y-p.y, d=Math.hypot(dx,dy)||0.001; if(d<80){ damageEnemy(e,14*dt*(1+0.05*p.level)); if(MONSTERS[e.id].spd>0 && !MONSTERS[e.id].guardian){ e.x+=dx/d*40*dt; e.y+=dy/d*40*dt; } } } }
    // 焔の突進: 囲まれたら空いている方へ突き抜け、通り道を焼く
    if(skillReady(p,'blaze') && B.time>=(p.blinkRetry||0) && attachCount(p)===0 && !p.pinned && !p.charmBind && p.climaxT<=0 && (nearEnemyCount(p.x,p.y,130)>=6 || (p.press||0)>=1.4)){
      let best=null, bs=1e9; for(let k=0;k<12;k++){ const a=k*TAU/12; const q=snapFloor(clampMapX(p.x+Math.cos(a)*180,40),clampMapY(p.y+Math.sin(a)*180,40),false,3); if(!q||!reachableAt(q.x,q.y,false)) continue; const sc=nearEnemyCount(q.x,q.y,150,true)+nearEnemyCount(q.x,q.y,60,true)*2; if(sc<bs){ bs=sc; best=q; } }
      p.blinkRetry=B.time+0.5;
      if(best && bs<nearEnemyCount(p.x,p.y,150,true)){ const x0=p.x, y0=p.y, vx=best.x-x0, vy=best.y-y0, L=Math.hypot(vx,vy)||1;
        for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue; const t=Math.max(0,Math.min(1,((e.x-x0)*vx+(e.y-y0)*vy)/(L*L))); const px=x0+vx*t, py=y0+vy*t; if(Math.hypot(e.x-px,e.y-py)<44+e.r*0.5){ damageEnemy(e,30*(1+0.06*p.level)); e.stun=Math.max(e.stun||0,e.boss?0.4:0.8); } }
        for(let k=0;k<10;k++) parts(x0+vx*k/10,y0+vy*k/10-14,3,['#ff7a3a','#ffd76a'],120,0.5);
        p.x=best.x; p.y=best.y; p.vx=p.vy=0; p.path=null; p.ifr=Math.max(p.ifr,0.6); p.fwingAnim=0.3; p.fwingX=x0; p.fwingY=y0; useSkill(p,'blaze'); }
    }
  }
  // 光の跳躍: 囲まれた
  if(skillReady(p,'blink') && B.time>=(p.blinkRetry||0) && attachCount(p)===0 && !p.pinned && !p.charmBind && p.climaxT<=0 && (nearEnemyCount(p.x,p.y,130)>=6 || (p.press||0)>=1.4)){
    let best=null, bs=1e9; for(let k=0;k<12;k++){ const a=k*TAU/12; const q=snapFloor(clampMapX(p.x+Math.cos(a)*180,40),clampMapY(p.y+Math.sin(a)*180,40),false,3); if(!q||!reachableAt(q.x,q.y,false)) continue; const sc=nearEnemyCount(q.x,q.y,150,true)+nearEnemyCount(q.x,q.y,60,true)*2; if(sc<bs){ bs=sc; best=q; } }
    p.blinkRetry=B.time+0.5;   // 跳べる先が無ければ0.5秒は探し直さない(毎フレームの走査を避ける)
    if(best && bs<nearEnemyCount(p.x,p.y,150,true)){ parts(p.x,p.y-14,24,['#fff','#8fd3ff'],200,0.6); p.x=best.x; p.y=best.y; p.vx=p.vy=0; p.path=null; p.ifr=Math.max(p.ifr,0.6); parts(p.x,p.y-14,24,['#fff','#ffd76a'],200,0.6); useSkill(p,'blink'); }
  }
}
/* v2.3 いまの武器から見た、おおまかな秒間火力(戦う/引き撃ち/逃げるの判断に使う) */
function heroDpsEst(p){
  const BASE={bolt:14,orb:10,nova:16,whip:14,rain:13,cross:13,sanct:15,blade:14,thunder:14,holy:9,chain:13,spirit:12,shield:9, fsword:17,fring:12,fburst:15,fpillar:14,fwing:13};
  let d=0; for(const k in BASE){ const lv=p.wp[k]||0; if(lv<=0) continue; const ov=wpOver(lv); const evo=Object.keys(EVOS).some(e=>EVOS[e].base===k && p.evo[e]>0); d+=BASE[k]*(1+0.35*(Math.min(BAL.WP_EVO_LV,lv)-1))*ov.dmg/ov.cd*(evo?1.8:1); }
  return Math.max(8, d*(p.dmgMult||1)*(1+0.08*(p.ps.haste||0))*(1+0.4*(p.ps.dup||0)));
}
/* ================= v2.1 降りる判断 =================
   降り口を知っていても、まだ見ていない所や拾える物があるうちは降りない。深淵の圧が高まる / HPが薄い / 目当てが探索しか無くなって久しい
   のどれかで「降りよう」に切り替わる(戻らない)。最終階層(降り口なし)では働かない */
function exitTick(dt){
  const B=G.B, p=B.hero; if(B.wantExit||!G.map) return;   // v2.2 最終階層では「魔核へ向かう気」になる
  const g=p.goal; let unknownN=0; for(const q of G.map.pois) if(!META.map.known[q.key]) unknownN++;
  if((!g || g.kind==='explore') && unknownN===0) B.idleGoalT=(B.idleGoalT||0)+dt; else B.idleGoalT=Math.max(0,(B.idleGoalT||0)-dt*0.5);   // v2.2 まだ知らない場所があるうちは「探索し尽くした」にならない
  const pr=pressure(), hpR=Math.min(...B.heroes.filter(h=>!h.out).map(h=>h.hp/h.maxHp)); let why=null;   // v3.0 いちばん薄い子の体力で判断
  if(pr>=BAL.EXIT_PRESS) why='press';
  else if(hpR<BAL.EXIT_HP && B.time>40) why='hp';
  else if(B.idleGoalT>=BAL.EXIT_IDLE_T && B.time>90) why='done';
  else if(BAL.SMART_AI && (B.fleeT||0)>=BAL.FLEE_EXIT_T && B.time>40 && !B.floor.final) why='flee';   // v2.3 逃げ続けても終わらない → 降り口を探して降りる
  if(!why) return;
  const fin=!!B.floor.final; const st=G.map.pois.find(o=>o.kind===(fin?'core':'stairs')); if(!st) return;
  B.wantExit=true; B.wantExitWhy=why; p.goal=null; p.goalT=0;
  const SUB={press:'魔物が増えてきた——長居はまずい', hp:fin?'体力が薄い——決めに行く':'体力が薄い——ここは離れる', done:fin?'見るところは見た——魔核へ':'見るところは見た——次へ', flee:'逃げ続けても終わらない——降り口を探す'};
  if(fin){ setBanner('彼女は魔核へ向かう気になった', SUB[why],'#ff6b81'); sayLine('wantExit',1,0,'……いこう。まかくの、ところへ'); }
  else{ setBanner('彼女は降りる気になった', SUB[why],'#8fd3ff'); if(why==='flee') sayLine('fleeExit',1,0,'にげながら、おりぐちさがす!'); else sayLine('wantExit',1,0,why==='done'?'もう、みるとこないし。おりよ!':'……そろそろ、おりなきゃ'); }
}
/* v2.1 場面に合わせた台詞: 地形に入った / 圧が高まった / 体力が薄い / 一息 */
function linesTick(dt){
  const B=G.B, p=B.hero;
  p.lineT=(p.lineT||0)-dt; if(p.lineT>0) return; p.lineT=0.5;   // v3.0 ヒロインごと
  if(G.map&&G.map.feats){ for(let i=0;i<G.map.feats.length;i++){ const f=G.map.feats[i]; if(B.featSaid[i]) continue; if(Math.hypot(f.x-p.x,f.y-p.y)<f.r){ B.featSaid[i]=1; sayLine('feat.'+f.kind,0,4); } } }
  const pr=pressure();
  if(pr>=0.35 && B.pressSaid<1){ B.pressSaid=1; setBanner('深淵の圧が高まる','魔物が増え、夜側のENが伸びる','#ff86b3'); sayLine('pressure.mid',0,0,'なんか、ふえてきた……?'); }
  if(pr>=0.9 && B.pressSaid<2){ B.pressSaid=2; setBanner('深淵の圧','ここに長く居すぎた','#ff5d7a'); sayLine('pressure.high',1,0,'ここ、ながくいたらまずい……!'); }
  if(p.hp<p.maxHp*0.5 && !p.lowSaid){ p.lowSaid=true; sayLine('hurtLow',1,0); const o=partnerOf(p); if(o) sayPartyAs(o.hi,'assist.low',2,10); } else if(p.hp>p.maxHp*0.72) p.lowSaid=false;
  let near=0; for(const e of B.enemies){ if(!e.dead&&!e.dormant&&inSight(e,p)){ near++; if(e.boss) B.bossSeen=true; } }   // v2.4 ボスを見た(以後の武器選びはボスを想定)
  if(B.ci===leaderIdx()){ B.calmT=near===0?(B.calmT||0)+0.5:0; if(B.calmT>=4 && B.time>30){ B.calmT=0; sayLine('calm',0,45); } }   // v3.0 共有タイマーは代表だけ
}
/* ================= v2.0 新種 ================= */
/* 淫翼: 頭上を旋回し、急降下して両腕に抱きつく(数秒で離れて舞い戻る)。翼の粉で敏感に */
function inyokuTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  if(e.blocked){ e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt; return; }
  e.swoopCd-=dt;
  if(e.swoopT>0){
    e.swoopT-=dt;
    const tx=p.x, ty=p.y-30, ddx=tx-e.x, ddy=ty-e.y, dd=Math.hypot(ddx,ddy)||0.001;
    e.x+=ddx/dd*e.spd*1.9*dt; e.y+=ddy/dd*e.spd*1.9*dt;
    if(dd<p.r+e.r+6 && p.ifr<=0){
      if(attachMonster(e,'cling',{armsOnly:true,needMul:0.6})){ e.holdT=1.8; applySensit(4); spawnCloud(p.x,p.y-10,30,1.6,BAL.SENSIT_GAS*0.4,'moth'); }
      else{ applySensit(3); applyPleasure(2); }
      e.swoopT=0; e.swoopCd=rand(3,5);
    }
    return;
  }
  e.orbitA+=e.orbitDir*1.6*dt;
  const R=150, tx=p.x+Math.cos(e.orbitA)*R, ty=p.y-70+Math.sin(e.orbitA)*R*0.45;
  const ddx=tx-e.x, ddy=ty-e.y, dd=Math.hypot(ddx,ddy)||0.001, sp=Math.min(e.spd*1.3, dd*4);
  e.x+=ddx/dd*sp*dt; e.y+=ddy/dd*sp*dt;
  if(e.swoopCd<=0 && d<260 && attachedSlots(p).length<3){ e.swoopT=1.2; sfx(900,500,0.15,'triangle',0.04); }
}
/* 水妖: 水面下に潜み、近づくと浮かんで脚に絡み、水へ引く(足が鈍る) */
function suiyouTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  const wet=(e.zone==='water'||e.zone==='damp');
  if(e.sub){ if(d<300 || !wet){ e.sub=false; B.spawnFx.push({x:e.x,y:e.y,t:0,r:e.r+6}); } else return; }
  if(e.grabCd>0) e.grabCd-=dt;
  if(d<p.r+e.r+4 && e.grabCd<=0 && p.ifr<=0){
    if(attachMonster(e,'cling',{legFirst:true})){ p.slow=Math.max(p.slow,1.2); return; }
    e.grabCd=1.2;
  }
  e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt;
  if(d>420 && wet) e.sub=true;
}
/* 肉壁の口: 動かない。近づいた脚を吸い、粘膜で舐めながら快感を送り続ける */
function mouthTick(e,dt,d){
  const B=G.B, p=B.hero;
  const holding=attachedSlots(p).some(sl=>p.limbs[sl].mon===e);
  if(e.grabCd>0) e.grabCd-=dt;
  if(holding){ e.lickT+=dt; applyPleasure(6*unitPmul(e)*dt); addHeatG(4*dt); applySensit(0.8*dt); if(e.lickT>0.9){ e.lickT=0; parts(p.x+rand(-10,10),p.y+rand(4,16),3,['#ffb3cf','#fff'],60,0.4); } return; }
  if(d<e.r+p.r+14 && e.grabCd<=0 && p.ifr<=0){ if(attachMonster(e,'tether',{r:40,legFirst:true,needMul:1.6})){ e.grabCd=4; e.state='idle'; } else e.grabCd=1.5; }   // 口は床から動かず、脚を 40px の内に繋ぐ
}
/* 遺跡の番人: 動かない石像。額の紋が光り、淫紋の光弾を扇状に放つ(1.2秒の予兆) */
function guardianTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  e.lookA=Math.atan2(dy,dx);
  if(e.castCd>0) e.castCd-=dt;
  if(e.aimT>0){
    e.aimT-=dt;
    if(e.aimT<=0){ const a0=e.lookA; for(let i=-1;i<=1;i++){ const a=a0+i*0.22; B.ebullets.push({kind:'rune', x:e.x, y:e.y-e.r*1.1, vx:Math.cos(a)*190, vy:Math.sin(a)*190, t:0, life:3.0, r:8, src:'guardian'}); } sfx(500,900,0.25,'sine',0.05); e.castCd=5.5; }
    return;
  }
  if(d<420 && e.castCd<=0 && losClear(e.x,e.y,p.x,p.y,true)) e.aimT=1.2;
}
/* ================= v2.0 魔核(最深部の大ボス) =================
   動かない。根の鞭で四肢を繋ぎ(大触手と同じ繋留)、脈動で快感・発情・敏感化を送り、床から手を生やす。HPが減るほど脈が速い */
function coreTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  e.lookA=Math.atan2(dy,dx);
  const holding=attachedSlots(p).some(sl=>p.limbs[sl].mon===e);
  const ph=e.hp/e.maxHp;
  e.whipCd-=dt; e.pulseCd-=dt; e.spawnCd-=dt; if(e.pulseT>0) e.pulseT-=dt;
  if(e.whipT>0){
    e.whipT-=dt;
    if(e.whipT<=0){ if(d<260 && attachMonster(e,'tether',{r:210,needMul:1.3})){ e.state='idle'; hurtHero(e.dmg*0.6,e,{noKb:true}); B.bossMark={id:'core',t:B.time}; codexMet('core'); if(ph<BAL.CORE_TWO_PH) attachMonster(e,'tether',{r:210,needMul:1.3}); e.state='idle'; } e.whipCd=BAL.CORE_WHIP_CD*(holding?1.6:1)*(ph<0.3?0.75:1); }   // 魔核は据わったまま根で繋ぐ(attached にせず、脈動も続く)。v2.2 弱ると根が二本
  }else if(d<250 && e.whipCd<=0 && !holding){ e.whipT=0.55; sfx(120,50,0.3,'sawtooth',0.08); }   // v2.4 230→250
  if(d<BAL.CORE_AURA_R){ addHeatG(4*dt); applySensit(1.0*dt); e.auraT=(e.auraT||0)+dt; if(e.auraT>=1){ e.auraT-=1; hurtHero(2,e,{quiet:true,noKb:true,pierce:true}); } }   // v2.2 脈の圏内: 熱と敏感化、じわじわ削る
  if(d<420 && e.pulseCd<=0){
    e.pulseCd=BAL.CORE_PULSE_CD*(ph<0.5?0.7:1)*(ph<0.3?0.8:1); e.pulseT=0.7;
    applyPleasure(10+14*(1-ph)); addHeatG(16); applySensit(5); p.stumbleDur=Math.max(p.stumbleDur,ph<0.5?0.8:0.5);
    heroBubble(p,pickRand(['……っ、みゃく、が……','からだの、おくに、ひびく……','や、めて……とまって……']),true,2);
    B.bossMark={id:'core',t:B.time}; codexMet('core'); sfx(60,40,0.6,'sine',0.1); G.shake=Math.min(8,G.shake+4);
  }
  if(d<520 && e.spawnCd<=0 && B.enemies.length<fieldCap()-6){
    e.spawnCd=BAL.CORE_SPAWN_CD*(ph<0.3?0.55:1); const n=ph<0.3?5:(ph<0.6?4:3), pool=ph<0.3?['hand','worm','gtent','mouth']:(ph<0.6?['hand','worm','gtent']:['hand','worm']);   // v2.2 弱るほど多く、口も生える
    for(let i=0;i<n;i++){ const a=rand(TAU); spawnUnit(pickRand(pool), p.x+Math.cos(a)*110, p.y+Math.sin(a)*80, {enVal:0, gemMul:0.3}); }
    B.spawnFx.push({x:p.x,y:p.y,t:0,r:60});
  }
}
/* ================= v1.6 ボス4種 ================= */
/* 汎用ボスの追跡→予兆→突進(ヴァンピロードと同じ) */
function bossChargeTick(e,dt,d,dx,dy){
  e.bt-=dt;
  if(e.bstate==='chase'){
    e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt;
    if(e.bt<=0){ e.bstate='tele'; e.bt=0.6; }
  }else if(e.bstate==='tele'){
    if(e.bt<=0){ e.bstate='charge'; e.bt=0.6; e.cdx=dx/d; e.cdy=dy/d; sfx(300,900,0.3,'sawtooth',0.1); }
  }else{
    e.x+=e.cdx*370*dt; e.y+=e.cdy*370*dt;   // v2.4 340→370
    parts(e.x,e.y,1,['#c04a6a','#7a2a4a'],40,0.3);
    if(e.bt<=0){
      if(e.id==='vampi' && !e.dash2 && d<420 && Math.random()<0.45){ e.dash2=true; e.bstate='tele'; e.bt=0.35; floatTxt(e.x,e.y-e.r-16,'二段突進!','#ff6b81',11,1.0); }   // v2.4 ヴァンピロード: 45%で二段目
      else { e.dash2=false; e.bstate='chase'; e.bt=rand(3.2,4.7); }
    }
  }
}
/* 粘獣王: 粘液の帯を残しながら迫り、追いつけば脚を呑む(粘液の繋留2本+敏感化+鈍足) */
function slimekingTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  if(e.state==='attached') return;
  e.lookA=Math.atan2(dy,dx);
  { const sp=e.spd*((p.slow>0 && d<300)?1.5:1); e.x+=dx/d*sp*dt; e.y+=dy/d*sp*dt; }   // v2.4 粘液に足を取られている彼女へは1.5倍速
  e.trailT-=dt;
  if(e.trailT<=0){ e.trailT=0.22; if(B.trails.length<90) B.trails.push({x:e.x+rand(-10,10),y:e.y+rand(-6,6),r:24,t:0,life:8}); }   // v2.4 広く長く残る
  e.grabCd-=dt;
  if(e.grabCd<=0 && d<e.r+p.r+6 && !p.pinned && p.climaxT<=0 && p.freezeT<=0){
    let n=0; for(let i=0;i<2;i++){ if(attachMonster(e,'tether',{r:26, legFirst:true, needMul:1.6})) n++; else break; }
    if(n>0){
      heroBubble(p,pickRand(['ぬる……っ、のまれ……!','あし、が……とけて、ない、のに……','はいって、くる……ふくの、なかに……']),true,3);
      applySensit(12); p.slow=Math.max(p.slow,1.5);
      B.bossMark={id:'slimeking',t:B.time};
      setBanner('呑み込み','粘液が脚を取り、服の内側へ染みてくる','#8fe0d0');
    }
    e.grabCd=7;
  }
}
/* 淫紋の刻印師: 間合いを保って呪弾を放ち、足元に淫紋を伏せる */
function runemageTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  e.lookA=Math.atan2(dy,dx);
  if(d<170){ e.x-=dx/d*e.spd*1.4*dt; e.y-=dy/d*e.spd*1.4*dt; }
  else if(d>330){ e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt; }
  e.castCd-=dt; e.runeCd-=dt;
  if(e.castCd<=0 && d<520 && inSight(e,p) && p.climaxT<=0){
    e.castCd=3.8;   // v2.4 4.5→3.8
    const a=Math.atan2((p.y-14)-(e.y-e.r*1.2), p.x-e.x);
    const fan=e.hp<e.maxHp*0.5?[-0.28,0,0.28]:[0];   // v2.4 HP半分を切ると三方向
    for(const da of fan) B.ebullets.push({kind:'rune', x:e.x, y:e.y-e.r*1.2, vx:Math.cos(a+da)*210, vy:Math.sin(a+da)*210, t:0, life:3.2, r:9, src:'runemage'});
    sfx(500,900,0.25,'sine',0.05);
  }
  if(e.runeCd<=0 && d<400 && B.traps.length<12){ e.runeCd=13; const nt=e.hp<e.maxHp*0.5?2:1; for(let i=0;i<nt;i++) B.traps.push({kind:'rune',x:p.x+rand(-70,70),y:p.y+rand(-50,50),t:0,life:45,r:26,armed:true,src:'runemage'}); }   // v2.4 弱ると2つずつ
}
/* 呪弾の命中: 淫紋Lv+1(最大3)・快感・よろめき */
function runeHit(b){
  const B=G.B, p=B.hero;
  learnTrap('rune');
  if(crestKnow()>=3 && Math.random()<0.4){   // 熟知: 紋を払う
    floatTxt(p.x,p.y-70,'紋を、はらった','#8fd3ff',12,1.2); heroBubble(p,pickRand(['……しってる。それは、うけない','ひかりで、はらう……!']),false,1);
    parts(p.x,p.y-20,10,['#8fd3ff','#fff'],120,0.6); return;
  }
  p.crestLv=Math.min(BAL.CREST_MAX,(p.crestLv||0)+1);
  applyPleasure(12); applySensit(6);
  p.stumbleDur=Math.max(p.stumbleDur,0.6);
  parts(p.x,p.y-20,18,['#c98cff','#ff86b3','#fff'],140,0.7);
  sfx(300,900,0.3,'sawtooth',0.07);
  heroBubble(p,pickRand(['あつ……っ!? やけ、る……','からだに、なにか、きざま……','ひか、って……や、あつい、あついっ']),true,2);
  setBanner('淫紋 '+ROMANS[p.crestLv],'焼き付いた紋が、快感の入りを増す','#ff86b3');
  awardAil('crest');
  B.bossMark={id:b.src||'runemage', t:B.time}; codexMet(b.src||'runemage');
}
/* 夢魔の女王: 周りを舞い、甘い夢の波(発情ゲージ・発情中なら寸止め)、口づけ、小淫魔の召喚 */
function succuqueenTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  if(e.blocked){ e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt; return; }   // 壁で視線が切れている: 旋回せず流れ場に沿って回り込む
  e.orbitA+=e.orbitDir*1.1*dt;
  const R=130, tx=p.x+Math.cos(e.orbitA)*R, ty=p.y+Math.sin(e.orbitA)*R*0.7;
  const tdx=tx-e.x, tdy=ty-e.y, td=Math.hypot(tdx,tdy)||1;
  const mv=Math.min(td, e.spd*dt*1.6); e.x+=tdx/td*mv; e.y+=tdy/td*mv;
  e.lookA=Math.atan2(dy,dx);
  e.pulseCd-=dt; e.spawnCd-=dt; e.kissCd-=dt;
  if(e.pulseCd<=0){
    e.pulseCd=5.2;   // v2.4 6→5.2
    B.fx.push({kind:'pulse', x:e.x, y:e.y-e.r, t:0, life:1.0, r:170, col:'#ff9ec2'});
    sfx(600,300,0.5,'sine',0.05);
    if(d<170 && p.climaxT<=0 && p.freezeT<=0){
      addHeatG(45);
      if(p.heatLv>=1) applyDeny(e);
      heroBubble(p,pickRand(['あま、い……ゆめ、みたいな……','だめ、これ、ゆだんしたら……','あたま、とろ、けそ……']),true,2);
      B.bossMark={id:'succuqueen',t:B.time}; codexMet('succuqueen');
    }
  }
  if(e.kissCd<=0 && d<e.r+p.r+8 && p.climaxT<=0){
    e.kissCd=5; applySensit(10); addHeatG(20); if(p.heatLv>=1) applyDeny(e);   // v2.4 火照っていれば口づけでも寸止め
    heroBubble(p,'んっ……!? くち、に……',true,2);
    B.bossMark={id:'succuqueen',t:B.time}; codexMet('succuqueen');
  }
  if(e.spawnCd<=0){
    e.spawnCd=15;
    if(aliveOf('imp')<8 && B.enemies.length<fieldCap()-3){
      for(let i=0;i<3 && aliveOf('imp')<8;i++){ const a=rand(TAU); spawnUnit('imp', e.x+Math.cos(a)*30, e.y+Math.sin(a)*30, {parent:e, enVal:0, gemMul:0}); }   // v2.4 3体ずつ・8体まで(超えない)
      setBanner('女王の呼び声','小淫魔が集う','#ff9ec2');
    }
  }
}
/* ゴブリンの王: 濃い雄臭の雲を撒き、呼び笛で手下を呼び、突進する */
function gobkingTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  bossChargeTick(e,dt,d,dx,dy);
  e.muskCd-=dt; e.hornCd-=dt;
  if(e.muskCd<=0 && d<520){ e.muskCd=1.5; const c=spawnCloud(e.x,e.y+2,110,5,BAL.SENSIT_GAS*0.6,'musk'); if(c) c.boss='gobking'; }   // v2.4 濃く広く
  if(e.hornCd<=0 && d<480){
    e.hornCd=8; let n=0, hasted=0;
    for(let i=0;i<3;i++){ if(aliveOf('goblin')>=12||B.enemies.length>=fieldCap()) break; const a=rand(TAU); spawnUnit('goblin', e.x+Math.cos(a)*40, e.y+Math.sin(a)*40, {parent:e, enVal:0, gemMul:0}); n++; }
    for(const g2 of B.enemies){ if(!g2.dead && g2.id==='goblin' && Math.hypot(g2.x-e.x,g2.y-e.y)<320){ g2.hasteT=4; hasted++; } }   // v2.4 号令: 近くの手下が4秒間速くなる
    if(n){ setBanner('呼び笛と号令','ゴブリンの王が手下を呼び、駆り立てた','#8fd36a'); sfx(180,420,0.4,'square',0.06); } else if(hasted && Math.random()<0.5){ floatTxt(e.x,e.y-e.r-16,'号令!','#8fd36a',11,1.0); }   // 手下が上限でも号令は掛かる(帯は呼んだ時だけ)
  }
}

/* ================= 夜側のアイテム(v1.1) ================= */
function towerTick(e,dt,d){
  const B=G.B, p=B.hero;
  e.life-=dt;
  if(e.life<=0){ e.dead=true; parts(e.x,e.y-10,10,['#c98cff','#5a3a7a'],80,0.6); return; }
  e.pulseCd-=dt;
  if(e.pulseCd<=0){
    e.pulseCd=3.5;
    B.fx.push({kind:'pulse', x:e.x, y:e.y-e.r, t:0, life:1.0, r:190, col:'#c98cff'});
    sfx(90,140,0.6,'sine',0.05);
    if(d<190 && !p.pinned && !p.charmBind && p.climaxT<=0){
      // 催眠電波: 思考が鈍り、足が塔へ向く
      p.dazeT=Math.max(p.dazeT,2.6);
      p.hypno={x:e.x, y:e.y, t:1.3};
      applyPleasure(3); learn('tower');
      heroBubble(p,pickRand(['……あ、れ。いま、なにを……','あたま、が……ざらざら、する……','……あっちに、なにか……']),true,2);
      awardAil('hypno');
    }
  }
}
function canPlaceItem(id){
  const B=G.B, it=NIGHT_ITEMS[id];
  if(!B||G.mode!=='battle'||!it) return {ok:false};
  if(!META.nightItems[id]) return {ok:false, why:'lock'};
  if((B.itemCd[id]||0)>0) return {ok:false, why:'cd'};
  if(B.en<it.cost) return {ok:false, why:'en'};
  return {ok:true, cost:it.cost};
}
/* 場の座標(x,y)にアイテムを置く。彼女の真上には置けない(最低40px離す) */
const NIGHT_ITEM_LIFE={mist:9,pool:14,rune:45,suit:45,freeze:45,web:40,tower:40,fake:9999};
function placeItem(id,x,y,opt){
  const B=G.B, p=B.hero; opt=opt||{};
  const chk=canPlaceItem(id);
  if(!chk.ok){ if(chk.why==='en') S.deny(); return false; }
  const it=NIGHT_ITEMS[id];
  const d=Math.hypot(x-p.x,y-p.y);
  if(d<40){ const a=Math.atan2(y-p.y,x-p.x)||0; x=p.x+Math.cos(a)*40; y=p.y+Math.sin(a)*40; }
  B.en-=it.cost;
  B.itemCd[id]=it.cd*(1-0.12*altarLv('cdcut'));
  B.itemsUsed++;
  S.summon();
  if(id==='mist'){
    spawnCloud(x,y,80,9,BAL.SENSIT_GAS*1.1,'mist');
    parts(x,y,14,['#ff9ec2','#ffc2d8'],90,0.8);
  }else if(id==='pool'){
    for(let i=0;i<14;i++){
      const a=rand(TAU), r=rand(0,58);
      if(B.trails.length<140) B.trails.push({x:x+Math.cos(a)*r, y:y+Math.sin(a)*r*0.7, r:14, t:0, life:14});
    }
    parts(x,y,10,['#8fe8c9','#3fae86'],80,0.6);
  }else if(id==='rune'){
    B.traps.push({kind:'rune',x,y,t:0,life:45,r:26,armed:true,night:true});
    parts(x,y,6,['#c98cff','#5a3a7a'],40,0.5);
  }else if(id==='suit'){
    B.traps.push({kind:'suit',x,y,t:0,life:45,r:26,armed:true,night:true});
    parts(x,y,6,['#ff9ec2','#5a3a7a'],40,0.5);
  }else if(id==='freeze'){
    B.traps.push({kind:'freeze',x,y,t:0,life:45,r:26,armed:true,night:true});
    parts(x,y,6,['#8fd3ff','#5a3a7a'],40,0.5);
  }else if(id==='web'){
    const u=spawnUnit('web',x,y,{enVal:0,gemMul:0});
    u.life=40; u.night=true;
  }else if(id==='tower'){
    const u=spawnUnit('tower',x,y,{enVal:0,gemMul:0});
    u.life=40; u.pulseCd=0.8; u.night=true;
  }else if(id==='fake'){
    B.chests.push({x,y,t:0,taken:false,fake:true,night:true});
  }
  B.placed.push({id,x,y,t:B.time,until:B.time+(NIGHT_ITEM_LIFE[id]||30),auto:!!opt.auto});   // v2.2 設置の記録(HUDの一覧)
  floatTxt(x,y-20,(opt.auto?'AI設置: ':'設置: ')+it.icon+' '+it.name,'#c98cff',10,1.3);
  return true;
}
/* v2.2 オート指揮の設置: 状況で品を選ぶ。歩いているなら進路の先に罠(粘沼/淫紋/触手服/時間停止/淫糸)、止まっている・捕まっているなら足元に霧壺、
   目当ての箱が無ければ視界の先に偽りの宝箱、ENが潤沢なら塔。解放済みで置ける品だけ。戻り値 {id,x,y} か null */
function chooseNightItem(p,held){
  const B=G.B, cands=[]; const ok=id=>canPlaceItem(id).ok; const add=(id,x,y,w)=>{ if(!ok(id)||w<=0) return; const q=snapFloor(x,y,false,4); if(!q) return; cands.push({id,x:q.x,y:q.y,w}); };
  const spd=Math.hypot(p.vx,p.vy), walking=spd>60 && !held;
  if(walking){ const ax=p.x+p.vx*1.1, ay=p.y+p.vy*1.1;   // 進路の先
    add('pool',ax,ay,3); add('rune',ax,ay,2.5); add('suit',ax,ay,2); add('freeze',ax,ay,2.5); if(p.path&&p.path.length) add('web',p.x+p.vx*1.6,p.y+p.vy*1.6,2); }
  if(held){ add('mist',p.x,p.y,4); }
  else if(!walking){ add('mist',p.x+rand(-20,20),p.y+rand(-20,20),3); if(B.en>enMax()*0.6){ const a=rand(TAU); add('tower',p.x+Math.cos(a)*240,p.y+Math.sin(a)*180,1.2); } }
  if(B.time>40 && !B.chests.some(c=>c.fake&&!c.taken) && !(p.goal&&p.goal.kind==='chest')){ const a=Math.atan2(p.vy,p.vx)||rand(TAU); const dd=rand(420,560); add('fake',p.x+Math.cos(a)*dd,p.y+Math.sin(a)*dd*0.8,1.5); }
  if(!cands.length) return null;
  let tot=0; for(const c of cands) tot+=c.w; let r=Math.random()*tot; for(const c of cands){ r-=c.w; if(r<=0) return c; } return cands[cands.length-1];
}
/* 淫紋の罠: 踏むと快感が弾け、這い寄る手が湧く */
function trapsTick(dt){
  const B=G.B, p=B.hero;
  for(const tr of B.traps){
    if(B.ci===leaderIdx()) tr.t+=dt;   // v3.0 寿命は一度だけ進める(ヒロインごとに呼ばれる)
    if(tr.armed && !p.pinned && p.freezeT<=0 && Math.hypot(p.x-tr.x,p.y-tr.y)<tr.r){
      tr.armed=false; tr.t=Math.max(tr.t,tr.life-0.8);
      const kind=tr.kind||'rune';
      if(kind==='rune'){
        learnTrap('rune');
        if(crestKnow()>=3 && Math.random()<0.4){ floatTxt(p.x,p.y-70,'紋を、はらった','#8fd3ff',12,1.2); heroBubble(p,'……しってる。それは、うけない',false,1); parts(tr.x,tr.y,10,['#8fd3ff','#fff'],120,0.6); continue; }   // v2.0 熟知: 紋を払う
        // 淫紋: 弾けて、刻まれる(Lvは戦闘中持続。快感の入り+15%/Lv)
        applyPleasure(18); applySensit(10);
        p.crestLv=Math.min(BAL.CREST_MAX,(p.crestLv||0)+1);
        p.stumbleDur=Math.max(p.stumbleDur,1.0);
        for(let i=0;i<3;i++){ const a=rand(TAU); spawnUnit('hand', tr.x+Math.cos(a)*30, tr.y+Math.sin(a)*18, {enVal:0, gemMul:0}); }
        parts(tr.x,tr.y,22,['#c98cff','#ff86b3','#fff'],160,0.8);
        sfx(300,900,0.4,'sawtooth',0.08);
        heroBubble(p,pickRand(['ひゃっ!? な、なに、これ、ひかっ……','あし、もと、が……あ、あつ……っ','いんもん……!? や、からだに、きざまれ……']),true,2);
        setBanner('淫紋 '+ROMANS[p.crestLv],'刻まれた紋が、快感の入りを増す','#ff86b3');
        awardAil('rune'); awardAil('crest');
        if(tr.src&&MONSTERS[tr.src]&&MONSTERS[tr.src].boss){ B.bossMark={id:tr.src,t:B.time}; codexMet(tr.src); }   // 刻印師の伏せた紋
      }else if(kind==='suit'){
        p.suitT=BAL.SUIT_DUR; p.suitPulse=0.8;
        parts(tr.x,tr.y,20,['#ff9ec2','#ffb3cf','#fff'],150,0.8);
        sfx(260,520,0.4,'sine',0.07);
        heroBubble(p,pickRand(['ひゃっ、ふくの、なかに……なにか……!?','や、はいって、くる……ぬる、って……','ぬげ……ない……!? くっついて……']),true,2);
        setBanner('触手服','服の内側に触手が纏わりついた——25秒','#ff9ec2');
        awardAil('suit');
      }else if(kind==='freeze'){
        p.freezeT=BAL.FREEZE_DUR; p.frozenAcc=0; p.vx=0; p.vy=0;
        parts(tr.x,tr.y,24,['#8fd3ff','#fff','#c9ecff'],170,0.9);
        sfx(900,200,0.6,'sine',0.08);
        heroBubble(p,'——え。うご……か……',true,3);
        setBanner('時間停止','彼女だけの時間が止まった——4秒間、触られ放題','#8fd3ff');
        B.fx.push({kind:'pulse', x:tr.x, y:tr.y, t:0, life:0.8, r:120, col:'#8fd3ff'});
        awardAil('freeze');
      }
      G.shake=Math.min(8,G.shake+4);
    }
  }
  B.traps=B.traps.filter(tr=>tr.t<tr.life);
}
/* 偽りの宝箱: 開けると媚薬の霧と手の群れ */
function fakeChestTrap(c){
  const B=G.B, p=B.hero;
  spawnCloud(c.x,c.y,90,8,BAL.SENSIT_GAS*1.2,'fake');
  applyPleasure(12);
  for(let i=0;i<6;i++){ const a=rand(TAU); spawnUnit('hand', c.x+Math.cos(a)*34, c.y+Math.sin(a)*24, {enVal:0, gemMul:0}); }
  parts(c.x,c.y-8,24,['#ff9ec2','#c98cff','#8a5a2a'],170,0.9);
  sfx(200,60,0.5,'sawtooth',0.08);
  setBanner('偽りの宝箱','中身は媚薬の霧と、無数の手','#c98cff');
  heroBubble(p,'え……なか、なにも……っ、きゃあっ!?',true,2);
  awardAil('fake');
  G.shake=Math.min(8,G.shake+4);
}

function contactHit(e){
  const p=G.B.hero;
  if(e.id==='worm'){
    if(attachMonster(e,'cling')) return;   // 絡みつき成功時はダメージなし
    // 空きが無い=先客が愉しんでいる間、順番待ちのワームは噛まずに
    // 肌を這い回って気持ちよくさせるだけ(ダメージなし)
    if(!(e.nuzzleCd>0)){
      e.nuzzleCd=1.4;
      applyPleasure(2.4*unitPmul(e));
      parts(p.x+rand(-8,8),p.y-rand(4,18),3,['#c9a06a','#ffb3cf'],70,0.4);
      if(Math.random()<0.3) heroBubble(p,pickRand(['ま、まだ増え……ひゃっ','はって、のぼって……っ','やだ、くすぐった……ぁ']),false,2);
    }
    return;
  }
  if(e.id==='leech'){
    // 拘束レベルを問わず、空いた場所に吸い付く。満員なら掠めるだけ
    if(!attachSucker(e)) applyPleasure(3);
    return;
  }
  if(e.id==='hand'){
    // まさぐり: ダメージは無い。ひとしきり触って満足すると少し離れる(全体で0.3秒に1回まで)
    if(e.gropeCd>0 || G.B.gropeCd>0) return;
    e.gropeCd=2.4; e.retreatT=0.7; G.B.gropeCd=0.3;
    applyPleasure(2.2*unitPmul(e));
    codexMet('hand');
    parts(p.x+rand(-8,8),p.y-rand(6,22),4,['#d8c8ff','#ffb3cf'],70,0.4);
    floatTxt(p.x+rand(-12,12),p.y-40,pickRand(['さわ…','にぎ…','もぞ…']),'#d8c8ff',9,0.7);
    if(Math.random()<0.3) heroBubble(p,pickRand(['ひゃっ、て、手が……どこ、さわって……っ','やっ、そこ、つかまないで……っ','なんで、手だけ……ぬるって……っ']),false,2);
    return;
  }
  if(e.id==='serpent'){
    // まず脚に巻きつく。空きが無ければ噛む
    if(attachMonster(e,'cling',{legFirst:true, needMul:1.2})){
      heroBubble(p,pickRand(['やっ、あし、に……まきつ……っ','ぬるって……へび!? や、のぼって……','はなれ、て……あし、うごかな……っ']),true,2);
      return;
    }
    if(e.biteCd<=0){ e.biteCd=1.2; hurtHero(e.dmg,e,{}); }
    return;
  }
  if(e.id==='moth'){
    // 翼が擦れる: 鱗粉を直接浴びる
    applySensit(7); applyPleasure(3*unitPmul(e));
    p.slow=Math.max(p.slow,0.5);
    codexMet('moth');
    hurtHero(e.dmg,e,{noKb:true});
    if(Math.random()<0.5) heroBubble(p,pickRand(['ふわ……っ、はねが、こすれ……','こな、が……すっちゃ……けほっ','あまい……あたま、ぼうっと……']),false,2);
    return;
  }
  if(e.id==='slugqueen'){
    if(e.charmCd<=0){ e.charmCd=3; applyCharm(e,BAL.CHARM_QUEEN_TOUCH); applySensit(BAL.SENSIT_SLUG); }
    hurtHero(e.dmg,e,{});
    return;
  }
  if(e.id==='dreamtree'){
    if(e.rootCd<=0 && attachMonster(e,'tether',{r:130})) e.rootCd=7;
    return;
  }
  if(e.id==='spore'){
    // 痺れ: 指先が動かず、脚がもたつく。痛くはない
    p.numbT=Math.max(p.numbT,BAL.NUMB_DUR);
    applyPleasure(2*unitPmul(e));
    hurtHero(e.dmg,e,{noKb:true,quiet:true});
    p.ifr=Math.max(p.ifr,0.5);
    parts(p.x+rand(-8,8),p.y-rand(4,22),5,['#ffe066','#fff'],90,0.35);
    if(Math.random()<0.4) heroBubble(p,pickRand(['びりって……ゆびが……','しびれ、て……うてな……','あし、もつれ……っ']),false,2);
    codexMet('spore');
    awardAil('numb');
    return;
  }
  if(e.id==='ghosthand'){
    // 腕に憑く。空きが無ければまさぐるだけ
    if(attachMonster(e,'possess',{armsOnly:true, needMul:0.9})){
      heroBubble(p,pickRand(['て、が……つめた……!? うご、かせ……','わたしの、うで……なにが……','や、この手、わたしの……じゃ……']),true,2);
      awardAil('possess');
      return;
    }
    if(e.gropeCd<=0){ e.gropeCd=2.2; applyPleasure(3*unitPmul(e)); codexMet('ghosthand'); parts(p.x,p.y-16,4,['#dfe4ff','#aab4e8'],70,0.4); }
    return;
  }
  if(e.id==='succubus'){
    applyPleasure(4*unitPmul(e));
    hurtHero(e.dmg,e,{noKb:true});
    codexMet('succubus');
    return;
  }
  if(e.id==='slug'){
    if(e.charmCd<=0){
      e.charmCd=2.5;
      applyCharm(e,BAL.CHARM_SLUG);
      applySensit(BAL.SENSIT_SLUG);
    }
    hurtHero(e.dmg,e,{});
    return;
  }
  hurtHero(e.dmg,e,{});
  if(e.boss && e.bstate==='charge'){ p.stumbleDur=Math.max(p.stumbleDur,0.7); heroBubble(p,'きゃあっ!?'); }
  if(e.id==='slime') p.slow=Math.max(p.slow,0.8);
}
function hurtHero(dmg,src,opt){
  const B=G.B, p=B.hero;
  opt=opt||{};
  if(src&&src.boss) B.bossMark={id:src.id, t:B.time};   // ボスの影響の中で倒れれば、ボス敗北(呪い)
  const atk=attachCount(p);
  const mult=p.pinned?BAL.PIN_DMG_MULT:((atk>0||p.charmBind)?BAL.ATTACH_DMG_MULT:1);
  const armor=opt.pierce?0:Math.max(0,p.armor-atk);
  const net=Math.max(0, dmg*mult-armor)*(p.guardT>0?0.3:1);   // v2.3 聖光の壁: 護りを引いた後の被ダメ-70%(小さな当たりまで無効にはしない)
  if(net<=0){
    if(!opt.quiet){
      parts(p.x,p.y-14,3,['#cfe0ff','#8fd3ff'],70,0.3);
      floatTxt(p.x+rand(-8,8),p.y-30,'カキン','#8fd3ff',9,0.5);
    }
    if(!opt.noKb) p.ifr=Math.max(p.ifr,0.3);
    return;
  }
  p.hp-=net;
  B.dmgDealt+=net;
  B.dmgCarry+=net;
  if(src&&src.id) codexMet(src.id);
  while(B.dmgCarry>=BAL.ORB_DMG_STEP){ B.dmgCarry-=BAL.ORB_DMG_STEP; B.orbFrag++; S.coin(); }
  if(!opt.quiet){
    p.ifr=p.pinned?0.3:(atk>0?0.35:0.55);
    G.hurtFlash=0.3; G.shake=Math.min(8,G.shake+3);
    if(!opt.noKb && src && !p.pinned){
      const dx=p.x-src.x, dy=p.y-src.y, d=Math.hypot(dx,dy)||1;
      p.x+=dx/d*16; p.y+=dy/d*16; if(G.map) collideMap(p,p.r+2,false);
    }
    heroBubble(p,'いたっ…!');
    S.hurt();
    parts(p.x,p.y-12,6,['#ff86b3','#fff'],120,0.4);
    floatTxt(p.x+rand(-8,8),p.y-34,'-'+Math.round(net),'#ff9db4',11,0.7);
  }
  if(p.hp<=0){ p.hp=0; beginCapture(src,'hp'); }
}
function beginCapture(src,cause){
  const B=G.B, h=B.hero;
  if(G.mode!=='battle'&&G.mode!=='levelup') return;
  if(h.out) return;
  let by=src?src.id:'default';
  // 帰属: 直前6秒の強制絶頂、または催眠Ⅱ以上での敗北は、その源(照射触手/ゲイザー)の仕業として記録する(ボス個体に倒された時は除く)
  { const lb=h.lastBeam, lh=h.lastHypno;
    if(!(src&&src.boss)){
      if(lb && B.time-lb.t<6 && MONSTERS[lb.id]) by=lb.id;
      else if(h.hypnoLv>=2 && lh && B.time-lh.t<25 && MONSTERS[lh.id]) by=lh.id;
    } }
  cause=cause||'hp';
  B.captures=B.captures||[]; B.captures.push({hi:B.ci, id:h.id, by, cause, t:B.time});
  B.capturedBy=by; B.captureCause=cause;
  const bubL={stamina:'ちから、が……はいらな……', charm:'だって……はなれたく、な……', hp:'そんな……っ'};
  const bubF={stamina:'……っ、火が、出な……い……', charm:'……離れ、られ……ない', hp:'こんな、の……っ'};
  const bub=h.id==='freila'?bubF:bubL;
  heroBubble(h, bub[cause]||bub.hp, true, 3);
  S.capture(); G.shake=Math.min(10,G.shake+6);
  const others=B.heroes.filter(x=>x!==h && !x.out);
  if(others.length){
    // v3.0 一人が捕まっても日は終わらない: その場に捕まったまま残る(そばに立てば救出できる)。魔物は残った子へ向かう
    for(const sl of attachedSlots(h)) detachLimb(sl,{});
    for(const sl of suckSlots(h)) detachSucker(sl,{});
    if(h.charmBind) releaseCharmBind(false);
    h.out=true; h.pinned=true; h.pinBy=null; h.climaxT=0; h.vx=0; h.vy=0; h.captive={x:h.x,y:h.y,by,cause,t:B.time,rescue:0};
    if(B.pinScene && B.pinSceneHi===B.ci) B.pinScene=null;
    B.bullets=B.bullets.filter(b=>b.hi!==B.ci);
    setBanner(h.name+'、捕まった!', others[0].name+'は救い出すか、置いて降りるか','#c98cff');
    for(const o of others) sayPartyAs(o.hi,'captured.watch',3,0);
    B.party.goal=null; B.party.pending=[]; B.party.talkUntil=0; B.party.gather=null; B.party.gatherDone=0; B.party.denRole=null;   // v3.1 相談は中断(言いかけの台詞と足止めを捨てる) / v3.2 待つ役も解く
    return;
  }
  G.mode='captured'; B.captureT=2.8; h.pinned=true;
  const sub={stamina:h.name+'は力尽き、組み伏せられた', charm:h.name+'は魅了に蕩けたまま、力尽きた', hp:h.name+'は魔物たちに捕らえられた'};
  setBanner(B.captures.length>1?'全員捕獲 — 観測終了':'敗北 — 観測終了', sub[cause]||sub.hp,'#c98cff');
}

/* ================= 弾/回収物/燭台 ================= */
function bulletsUpdate(dt){
  const B=G.B; let p=B.hero;
  for(const b of B.bullets){
    if(b.hi!==undefined && B.heroes[b.hi]){ B.ci=b.hi; p=B.hero; }   // v3.0 弾の持ち主の文脈
    /* --- スターレイン: 落下→着弾で小範囲 --- */
    if(b.kind==='rain'){
      b.y+=b.vy*dt; b.life-=dt;
      if(Math.random()<0.5) parts(b.x,b.y,1,['#8fd3ff','#fff'],20,0.3);
      if(b.y>=b.ty||b.life<=0){
        b.life=0;
        parts(b.tx,b.ty,b.evo?12:7,['#8fd3ff','#fff','#ffd76a'],b.evo?150:110,0.4);
        sfx(180,60,0.1,'square',0.04);
        for(const e of B.enemies){
          if(e.dead||e.dormant) continue;
          if(Math.hypot(e.x-b.tx,e.y-b.ty)<b.splash+e.r) damageEnemy(e,b.dmg);
        }
        for(const pr of B.props){
          if(Math.hypot(pr.x-b.tx,pr.y-b.ty)<b.splash+12) damageProp(pr,b.dmg);
        }
        if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN*0.6);
      }
      continue;
    }
    /* --- v2.0 みちびきの精霊: いちばん近い敵へ曲がりながら追い、当たれば小範囲ではぜる --- */
    if(b.kind==='spirit'){
      b.life-=dt;
      if(!b.target||b.target.dead||b.target.dormant){ let bt=null, bd=520; for(const e of B.enemies){ if(e.dead||e.dormant||(e.state==='attached'&&e.ti===b.hi)) continue; const dd=Math.hypot(e.x-b.x,e.y-b.y); if(dd<bd){ bd=dd; bt=e; } } b.target=bt; }
      if(b.target){ const dx=b.target.x-b.x, dy=(b.target.y-b.target.r*0.6)-b.y, d=Math.hypot(dx,dy)||1; b.vx+=(dx/d*b.spd-b.vx)*Math.min(1,dt*b.turn); b.vy+=(dy/d*b.spd-b.vy)*Math.min(1,dt*b.turn); }
      b.x+=b.vx*dt; b.y+=b.vy*dt;
      if(Math.random()<0.6) parts(b.x,b.y,1,[b.evo?'#ffe3ef':'#e8f4ff','#fff'],16,0.3);
      let hitE=null;
      for(const e of B.enemies){ if(e.dead||e.dormant||(e.state==='attached'&&e.ti===b.hi)) continue; if(Math.hypot(e.x-b.x,(e.y-e.r*0.6)-b.y)<e.r+8){ hitE=e; break; } }
      if(hitE||b.life<=0){
        if(hitE){ for(const e of B.enemies){ if(e.dead||e.dormant) continue; if(Math.hypot(e.x-b.x,(e.y-e.r*0.6)-b.y)<b.splash+e.r) damageEnemy(e,b.dmg); } parts(b.x,b.y,b.evo?12:8,['#e8f4ff','#fff','#ffd76a'],130,0.4); sfx(1000,300,0.1,'sine',0.04); if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN*0.6); }
        b.life=0;
      }
      continue;
    }
    /* --- クロスブーメラン: 貫通往復。敵ごとに短い多段CD --- */
    if(b.kind==='cross'){
      b.retT-=dt;
      if(b.retT<=0){
        b.ret=true;
        const dx=p.x-b.x, dy=(p.y-12)-b.y, d=Math.hypot(dx,dy)||1;
        b.vx+=(dx/d*b.spd-b.vx)*Math.min(1,dt*4);
        b.vy+=(dy/d*b.spd-b.vy)*Math.min(1,dt*4);
        if(b.ret && d<22) b.life=0;
      }
      b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
      if(Math.random()<0.4) parts(b.x,b.y,1,['#fff3c4','#fff'],20,0.25);
      for(const e of B.enemies){
        if(e.dead||e.dormant||(e.state==='attached'&&e.ti===b.hi)||(e.crossCd||0)>0) continue;
        if(Math.hypot(e.x-b.x,(e.y-e.r*0.6)-b.y)<e.r+7){
          damageEnemy(e,b.dmg);
          e.crossCd=0.45;
          parts(b.x,b.y,3,['#fff3c4','#fff'],90,0.25);
        }
      }
      continue;
    }
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
    if(b.life<=0) continue;
    if(Math.random()<0.3) parts(b.x,b.y,1,['#ffd76a','#fff'],20,0.25);
    let hit=false;
    for(const e of B.enemies){
      if(e.dead||e.dormant||e===b.last||(e.state==='attached'&&e.ti===b.hi)) continue;
      if(Math.hypot(e.x-b.x,(e.y-e.r*0.6)-b.y)<e.r+5){
        damageEnemy(e,b.dmg);
        parts(b.x,b.y,4,['#ffd76a','#fff'],100,0.3);
        if(b.pierce>0){ b.pierce--; b.last=e; }
        else b.life=0;
        hit=true;
        break;
      }
    }
    if(hit||b.life<=0) continue;
    for(const pr of B.props){
      if(Math.hypot(pr.x-b.x,(pr.y-10)-b.y)<14){
        damageProp(pr,b.dmg);
        parts(b.x,b.y,4,['#ffd76a','#fff'],100,0.3);
        b.life=0;
        break;
      }
    }
  }
  B.bullets=B.bullets.filter(b=>b.life>0);
  B.ci=leaderIdx();
}
function spawnInitialProps(){
  const B=G.B;
  for(let i=0;i<BAL.PROP_INIT;i++){
    const a=i*TAU/BAL.PROP_INIT+rand(-0.4,0.4), d=rand(200,480);
    const q=snapFloor(Math.cos(a)*d, Math.sin(a)*d, false, 4); if(!q) continue;
    B.props.push({x:q.x, y:q.y, hp:BAL.PROP_HP, max:BAL.PROP_HP, t:rand(10)});
  }
}
/* ================= v3.2 甘い褥の巣窟 =================
   壁際に食い込んだ大きな窪地。入口は喉道ひとつで、いちばん奥に王の宝箱がある。
   前室→沼→最奥と進むほど発情と敏感化の効きが強く、床から伸びる手も早くなる。
   中には魔法陣(踏むと紋が灯る)・媚薬の花(甘いガスを吐く)・壁に埋まった光線(催眠/絶頂)・番人(奥へ踏み込むと起きる)。
   入口の外には媚薬の澱み(haze)が漂い、その手前に清水が湧く——覚悟を決める場所 */
function denOf(){ return (G.map&&G.map.lewd)||null; }
/* 段: -1=外 / 0=前室 / 1=沼 / 2=最奥。喉道(zone lewd だが楕円の外)は前室と同じ */
function denStage(x,y){
  const L=denOf(); if(!L) return -1;
  const u=(x-L.x)/L.rx, w=(y-L.y)/L.ry, q=u*u+w*w;
  if(q>1.04) return (zoneAt(x,y)==='lewd')?0:-1;
  return q<0.34?2:(q<0.70?1:0);
}
/* 敷居をまたいだ瞬間: 匂いに殴られる */
function denEnterBurst(h){
  const B=G.B, ci0=B.ci; B.ci=h.hi;
  addHeatG(BAL.DEN_ENTER_HEAT); applySensit(BAL.DEN_ENTER_SENS);
  h.stumbleDur=Math.max(h.stumbleDur,0.5);
  B.ci=ci0;
  floatTxt(h.x,h.y-72,'——むわっ','#ff9ec2',14,1.4);
  parts(h.x,h.y-10,14,['#ff9ec2','#c98cff','#ffd0e4'],90,0.9); sfx(180,120,0.3,'sine',0.05);
  sayPartyOrLine(h,'feat.denEnter','……っ、いきなり、あつ……!');
}
/* ヒロインの声の表から一行(パーティ台詞と同じ流儀で、話者ごとに) */
function sayPartyOrLine(h,path,fallback){
  const B=G.B, ci0=B.ci; B.ci=h.hi; const r=sayLine(path,2,8,fallback); B.ci=ci0; return r;
}
/* 巣窟の中身を仕込む(startBattle から)。報酬はいちばん奥 */
function spawnDen(){
  const B=G.B, L=denOf(); if(!L) return;
  const F=B.floor, at=(x,y,m)=>snapFloor(x,y,false,m||3)||{x,y};
  const deep=at(L.deep.x,L.deep.y,4);
  { B.chests.push({x:deep.x,y:deep.y,t:0,taken:false,bossChest:true,known:false,lewd:true}); }                        // 王の宝箱は最奥
  { const q=at(L.x+(L.deep.x-L.x)*0.35, L.y+L.ry*0.45); B.chests.push({x:q.x,y:q.y,t:0,taken:false,known:false,lewd:true}); }   // 宝箱は沼のあたり
  { const q=at(L.x-(L.deep.x-L.x)*0.2, L.y-L.ry*0.5); spawnPick('treasure',q.x,q.y,false); }
  { const q=at(L.x+L.rx*0.1, L.y+L.ry*0.72); spawnPick('nectar',q.x,q.y,false); const q2=at(L.x-L.rx*0.15,L.y-L.ry*0.75); spawnPick('nectar',q2.x,q2.y,false); }
  const beamKind=(F.lewd&&F.lewd.beam)||'hypno', other=beamKind==='hypno'?'climax':'hypno';
  B.den={
    runes:L.runes.map(q=>{ const s=at(q.x,q.y,3); return {x:s.x,y:s.y,cd:rand(0,3),glow:0}; }),
    flowers:L.flowers.map(q=>{ const s=at(q.x,q.y,3); return {x:s.x,y:s.y,cd:rand(1,4),bloom:0}; }),
    beams:L.beams.map((q,k)=>({x:q.x,y:q.y,ox:q.ox,oy:q.oy,ang:q.ang,type:(k%2===0)?beamKind:other,cd:rand(2,6),state:'idle',t:0,aimA:q.ang})),
    guardUp:false, seen:false, deepSaid:false, rewardSaid:false,
  };
}
/* 魔法陣: 踏んだところに紋が灯る(淫紋Lv+1・快感・よろめき) */
function denRuneHit(h,r){
  const B=G.B, ci0=B.ci; B.ci=h.hi;
  learnTrap('rune');
  if(crestKnow()>=3 && Math.random()<0.4){ floatTxt(h.x,h.y-70,'紋を、はらった','#8fd3ff',12,1.2); B.ci=ci0; return; }
  applyPleasure(14); applySensit(8); addHeatG(8);
  h.crestLv=Math.min(BAL.CREST_MAX,(h.crestLv||0)+1);
  h.stumbleDur=Math.max(h.stumbleDur,0.9);
  B.ci=ci0;
  parts(r.x,r.y,18,['#c98cff','#ff86b3','#fff'],150,0.8); sfx(300,900,0.35,'sawtooth',0.07);
  sayPartyOrLine(h,'feat.denRune','ゆかの、もよう……ひかって……っ');
  setBanner('淫紋 '+ROMANS[h.crestLv],'褥に敷かれた紋が、彼女に灯った','#ff86b3');
  awardAil('rune'); awardAil('crest');
}
/* 壁の光線: 狙いをつけてから、線で撃つ */
/* 光線が届く長さ: 最初の壁まで(岩は光も通さない) */
function denBeamLen(x,y,a){ const dx=Math.cos(a), dy=Math.sin(a); for(let s=10;s<=BAL.DEN_BEAM_LEN;s+=10){ if(!passAt(x+dx*s,y+dy*s,true)) return s-10; } return BAL.DEN_BEAM_LEN; }
function denBeamFire(bm){
  const B=G.B, len=denBeamLen(bm.ox,bm.oy,bm.aimA), dx=Math.cos(bm.aimA), dy=Math.sin(bm.aimA);
  B.fx.push({kind:'denbeam', x:bm.ox, y:bm.oy, ang:bm.aimA, len, t:0, life:0.32, col:bm.type==='hypno'?'#b46cff':'#ff86b3'});   // v3.2 描くのも当たるのも、撃つ起点(壁の内側の面)から同じ線で
  for(const h of B.heroes){
    if(h.out) continue;
    if(denStage(h.x,h.y)<0) continue;   // v3.2 巣窟の外(澱みで待つ相方)は、中の罠には撃たれない
    const rx=h.x-bm.ox, ry=(h.y-12)-bm.oy, along=rx*dx+ry*dy;
    if(along<0||along>len) continue;
    if(Math.abs(rx*dy-ry*dx)>BAL.DEN_BEAM_W) continue;
    if(!losClear(bm.ox,bm.oy,h.x,h.y-12,true)) continue;
    const ci0=B.ci; B.ci=h.hi;
    if(bm.type==='hypno'){ applyHypno(null); floatTxt(h.x,h.y-64,'催眠光線','#b46cff',12,1.2); }
    else { applyPleasure(26); applySensit(6); h.stumbleDur=Math.max(h.stumbleDur,0.5); floatTxt(h.x,h.y-64,'絶頂光線','#ff86b3',12,1.2); sayPartyOrLine(h,'feat.denBeam','ひかりが、あたって……からだ、が……っ'); }
    B.ci=ci0;
    parts(h.x,h.y-12,10,[bm.type==='hypno'?'#b46cff':'#ff86b3','#fff'],110,0.6);
  }
  sfx(bm.type==='hypno'?1200:420, bm.type==='hypno'?600:900, 0.28,'sine',0.05);
}
/* 番人: 最奥へ踏み込むと起きる。その階層の顔ぶれから一体、太らせて据える */
function spawnDenGuard(){
  const B=G.B, L=denOf(), F=B.floor; if(!B.den||B.den.guardUp||!L) return;
  B.den.guardUp=true;
  const id=(F.lewd&&F.lewd.guard)||'slugqueen'; if(!MONSTERS[id]) return;
  const q=snapFloor(L.guard.x,L.guard.y,false,5)||{x:L.guard.x,y:L.guard.y};
  const u=spawnUnit(id,q.x,q.y,{enVal:0,gemMul:2.2});
  if(!u) return;
  u.denGuard=true;
  u.maxHp=u.hp=Math.round(Math.max(u.maxHp*BAL.DEN_GUARD_HP, BAL.DEN_GUARD_MIN*F.mon.hp*(typeof eraMul==='function'?eraMul():1)));
  u.dmg=(u.dmg||0)*BAL.DEN_GUARD_DMG; u.xp=(u.xp||0)*2.2;
  setBanner('褥の番人 — '+MONSTERS[id].name, (F.lewd&&F.lewd.guardSub)||'奥の主が、身を起こした','#ff6b81');
  const near=B.heroes.filter(h=>!h.out).sort((a,b)=>Math.hypot(a.x-q.x,a.y-q.y)-Math.hypot(b.x-q.x,b.y-q.y))[0];
  if(near) sayPartyOrLine(near,'feat.denGuard','おく、なにか……いる……!');
  parts(q.x,q.y,26,['#ff6b81','#c98cff','#fff'],180,1.0); G.shake=Math.min(9,G.shake+5);
}
/* ================= v3.2 巣窟の前で: 入るか、待つか =================
   片方が巣窟へ入る時、もう片方は性格と状況で「一緒に入る」か「外で待つ」かを決める。
   待つ側は口の外に立ち、中の子が画面から出ないように口の内側(澱み)まで出入りして距離を詰める——
   カメラは二人の重心を追い、離れすぎた分は引き戻されるので、待つ役がこの幅を吸収する。
   中の子が掴まれた/押し倒された/体力が薄い/熱が上がりきったら、待つのをやめて踏み込む */
function denGoalIn(g){ return !!g && denStage(g.x,g.y)>=0; }
function denPeril(h){ return !!(h && (h.out||h.pinned||attachCount(h)>0||h.charmBind||h.hp<h.maxHp*0.55||h.heatLv>=2)); }
function denRoleTick(){
  const B=G.B, P=B.party; if(!P||!P.denRole) return;
  const R=P.denRole, ex=B.heroes[R.in], wt=B.heroes[R.wait];
  if(!ex||!wt||ex.out||wt.out){ P.denRole=null; return; }
  if(!denGoalIn(P.goal) && B.time-R.since>3){ P.denRole=null; return; }              // 目当てが巣窟から離れた
  if(denStage(ex.x,ex.y)>=0) R.lastIn=B.time;                                         // 中に居る間は時計を進めない
  else if(R.lastIn && B.time-R.lastIn>5){ P.denRole=null; return; }                    // 中の子が出てきた(入る前の道中では解かない)
  if(denPeril(ex)){ sayPartyAs(wt.hi,'den.rush',2,0); P.denRole=null; }               // 危ない: 待つのをやめる
}
/* 待つ側の立ち位置: 口の外。中の子が画面の端に近づいた分だけ、口の内側へ踏み込んで詰める */
function denWaitGoal(p){
  const B=G.B, P=B.party, L=denOf(), R=P.denRole, ex=B.heroes[R.in];
  let x=L.apron.x, y=L.apron.y;
  if(ex){
    const bx=BAL.PARTY_MAXDX*0.68, by=BAL.PARTY_MAXDY*0.68, dx=ex.x-x, dy=ex.y-y;
    const t=Math.max(Math.abs(dx)/bx, Math.abs(dy)/by);
    if(t>1){ x+=dx*(1-1/t)*1.08; y+=dy*(1-1/t)*1.08; const q=snapFloor(x,y,false,4); if(q){ x=q.x; y=q.y; } }
  }
  const g={kind:'wait', sub:'wait', x, y, ref:null, key:'denwait', d:0, worth:1.6, score:1.6};
  p.goal=g; p.goalT=B.time+0.35;
  return g;
}
/* 役割を決める: 目当てが巣窟の中で、二人以上いる時。臆病な方が外に残り、気の強い方は付いていく */
function denAssignRole(win,active){
  const B=G.B, P=B.party;
  if(P.denRole || active.length<2 || !denGoalIn(P.goal)) return;
  const other=active.find(h=>h!==win.h); if(!other) return;
  const HD=HEROES[other.id]||{}, brave=(HD.braveAdd||0)>0.1;
  const together = brave || win.h.hp<win.h.maxHp*0.6 || (B.den&&B.den.guardUp) || denPeril(win.h);
  if(together){ sayPartyAs(other.hi,'den.together',1,0); return; }
  P.denRole={in:win.h.hi, wait:other.hi, since:B.time, lastIn:0};
  B.nDenWait=(B.nDenWait||0)+1;
  if(sayPartyAs(other.hi,'den.wait',1,0)) pendingLine(win.h.hi,'den.goIn',1.1,1);
}
/* 巣窟の毎フレーム(代表の文脈で1回だけ呼ぶ。効果はヒロインごとに当てる) */
function denTick(dt){
  const B=G.B, D=B.den; if(!D) return;
  const act=B.heroes.filter(h=>!h.out); if(!act.length) return;
  for(const r of D.runes){
    r.cd-=dt; r.glow=Math.max(0,(r.glow||0)-dt*1.6);
    if(r.cd>0) continue;
    for(const h of act){ if(h.pinned||h.freezeT>0) continue; if(Math.hypot(h.x-r.x,h.y-r.y)<BAL.DEN_RUNE_R){ r.cd=BAL.DEN_RUNE_CD; r.glow=1; denRuneHit(h,r); break; } }
  }
  for(const f of D.flowers){
    f.bloom=Math.max(0,(f.bloom||0)-dt*1.2); f.cd-=dt;
    if(f.cd>0) continue;
    f.cd=BAL.DEN_FLOWER_CD*rand(0.8,1.3);
    if(!act.some(h=>Math.hypot(h.x-f.x,h.y-f.y)<560)) continue;   // 誰も居ない所では咲かない(雲の無駄打ちを避ける)
    f.bloom=1; spawnCloud(f.x,f.y,BAL.DEN_FLOWER_R,BAL.DEN_FLOWER_LIFE,BAL.DEN_FLOWER_RATE,'denflower');   // v3.2 種族名を借りない(居ない魔物の学習が進んでしまう)
  }
  for(const bm of D.beams){
    bm.t+=dt;
    if(bm.state==='idle'){
      bm.cd-=dt; if(bm.cd>0) continue;
      const tgt=act.find(h=>denStage(h.x,h.y)>=0 && Math.hypot(h.x-bm.ox,h.y-bm.oy)<BAL.DEN_BEAM_LEN && losClear(bm.ox,bm.oy,h.x,h.y-12,true));
      if(!tgt) continue;
      bm.state='aim'; bm.t=0; bm.aimA=Math.atan2((tgt.y-12)-bm.oy, tgt.x-bm.ox);
      sfx(900,1300,0.12,'sine',0.03);
    }else if(bm.state==='aim'){
      if(bm.t>=BAL.DEN_BEAM_AIM){ bm.state='fire'; bm.t=0; denBeamFire(bm); }
    }else{
      if(bm.t>=BAL.DEN_BEAM_FIRE){ bm.state='idle'; bm.t=0; bm.cd=BAL.DEN_BEAM_CD*rand(0.85,1.2); }
    }
  }
  if(!D.guardUp && act.some(h=>denStage(h.x,h.y)>=2)) spawnDenGuard();
  if(!D.deepSaid && act.some(h=>denStage(h.x,h.y)>=1)){ D.deepSaid=true; const h=act.find(x=>denStage(x.x,x.y)>=1); sayPartyOrLine(h,'feat.denDeep','おくに、いくほど……あたま、ぼうっと……'); }
}
/* v2.2 床から手: 甘い褥に居続けると、床から手が伸びて撫でる(快感と一瞬のよろめき) */
function floorGrope(h){
  applyPleasure(6+4*sensLvOf(h)); addHeatG(6); h.stumbleDur=Math.max(h.stumbleDur,0.45);
  parts(h.x+rand(-10,10),h.y-6,10,['#ff9ec2','#c98cff'],90,0.6); sfx(160,90,0.2,'sine',0.05);
  heroBubble(h,pickRand(['ゆかから、て……!?','やっ、さわらないで……っ','ここ、はやくでなきゃ……']),false,2); awardAil('grope');
}
/* v2.2 「やっぱ無理」: 嫌な地形の中で参ってきたら、その地形を40秒怖がり、中の目当てを捨て、入ってきた所へ逃げ戻る。媚薬まみれ(もういいや)の時は起きない */
function zoneAbort(h){
  const B=G.B, z=h.zone; if(!h.zoneEnter || h.zoneAbortTried) return;
  h.zoneAbortTried=true;
  if(h.aphro>=45||h.heatLv>0||h.sensit>=60) return;
  h.scared=h.scared||{}; h.scared[z]=B.time+40; if(h.brave) delete h.brave[z];
  if(h.goal && zoneAt(h.goal.x,h.goal.y)===z){ giveUpOn(h.goal); if(h.goal.kind==='explore'){ h.explore=null; h.exploreUntil=0; } h.goal=null; h.goalT=0; }
  h.fleeOut={x:h.zoneEnter.x,y:h.zoneEnter.y,until:B.time+4}; h.path=null; B.nAbort=(B.nAbort||0)+1;
  sayLine('abort',2,0,'やっぱ、むりーっ!');
}
/* 燭台の品(回復ハート以外)。彼女が拾った瞬間に発動する */
const ITEM_DEF={
  wipe:  {name:'聖光の閃き', col:'#fff6d8', sub:'視界の魔物を一掃した'},
  vacuum:{name:'星の吸引',   col:'#8fd3ff', sub:'場のジェムを全部引き寄せた'},
  bonus: {name:'流星群',     col:'#ffd76a', sub:'ボーナス攻撃!'},
};
function damageProp(pr,dmg){
  const B=G.B, p=B.hero;
  pr.hp-=dmg;
  parts(pr.x,pr.y-14,3,['#ffd76a','#c9a06a'],80,0.35);
  if(pr.hp<=0 && !pr.dead){
    pr.dead=true;
    parts(pr.x,pr.y-10,14,['#ffd76a','#fff','#c9a06a'],160,0.6);
    sfx(320,120,0.2,'square',0.07);
    B.props=B.props.filter(q=>q!==pr);
    // 品が出るのは30%(+よつばのクローバー4%/Lv)。内訳: 回復20 / 全消去5 / 全回収3 / ボーナス攻撃2。外れは小ジェム
    const itemP=BAL.PROP_ITEM+0.04*(p.ps.luck||0);
    if(Math.random()<itemP){
      const tot=BAL.PROP_HEAL+BAL.PROP_WIPE+BAL.PROP_VACUUM+BAL.PROP_BONUS;
      const r=Math.random()*tot;
      if(r<BAL.PROP_HEAL) B.hearts.push({x:pr.x,y:pr.y,t:0});
      else{
        const kind=r<BAL.PROP_HEAL+BAL.PROP_WIPE?'wipe':(r<BAL.PROP_HEAL+BAL.PROP_WIPE+BAL.PROP_VACUUM?'vacuum':'bonus');
        B.items.push({kind, x:pr.x, y:pr.y, t:0});
        setBanner('燭台から '+ITEM_DEF[kind].name+' が こぼれた','ルミナが拾うと発動する','#8fd3ff');
      }
    }else{
      const n=1+((Math.random()*3)|0);
      for(let i=0;i<n;i++) dropGem(pr.x+rand(-16,16),pr.y+rand(-10,10),2);
    }
  }
}
function applyItem(kind){
  const B=G.B, p=B.hero;
  const def=ITEM_DEF[kind];
  setBanner(def.name, def.sub, def.col);
  if(kind==='wipe'){
    // 画面全消去(ボスは残る)
    B.whiteFlash=0.45;
    let n=0;
    for(const e of B.enemies){
      if(e.dead||e.boss) continue;
      if(!inSight(e,p) && Math.hypot(e.x-p.x,e.y-p.y)>520) continue;
      killEnemy(e); n++;
    }
    B.enemies=B.enemies.filter(e=>!e.dead);
    heroBubble(p,'ひかり、はらって——!',true,2);
    S.clear(); G.shake=Math.min(10,G.shake+6);
    floatTxt(p.x,p.y-70,n+'体 消滅','#fff6d8',13,1.2);
  }else if(kind==='vacuum'){
    // 全エネルギー回収: 場の全ジェムが彼女へ飛ぶ
    for(const gm of B.gems) gm.sp=Math.max(gm.sp,900);
    heroBubble(p,'ぜんぶ、あたしのっ!',true,2);
    S.gem();
  }else if(kind==='bonus'){
    // 流星群: 視界内の魔物の上へ大粒のスターレインを連続で落とす
    const tg=B.enemies.filter(e=>!e.dead&&!e.dormant&&inSight(e,p));
    const n=14;
    for(let i=0;i<n;i++){
      const t=tg.length?tg[(Math.random()*tg.length)|0]:null;
      const tx=t?t.x+rand(-24,24):p.x+rand(-220,220), ty=t?t.y+rand(-14,14):p.y+rand(-140,140);
      B.bullets.push({kind:'rain', x:tx+rand(-40,40), y:ty-300-i*40, tx, ty,
        vx:0, vy:520, dmg:30, splash:60, life:1.0+i*0.08, last:null, evo:true});
    }
    heroBubble(p,'ほし、ふって——!',true,2);
    S.boss();
  }
}
/* v2.0 物語: 落ち着いている時に、その階層の独り言を零す */
function storyTick(dt){
  const B=G.B, p=B.hero; if(B.storyLineT===undefined) B.storyLineT=25;
  B.storyLineT-=dt; if(B.storyLineT>0) return;
  B.storyLineT=38+rand(20);
  // v3.1 階層の独り言は話者ごとの表から(ルミナ=LINES.floor は0基点の配列、フレイラ=LINES_F.floor は階層番号のキー)。無ければ物語の行から本人の台詞だけを拾う(地の文や相手の台詞を吹き出しに出さない)
  const T=(p.id==='freila'&&typeof LINES_F!=='undefined')?LINES_F:LINES;
  let pool=T.floor?(Array.isArray(T.floor)?T.floor[B.floor.depth-1]:T.floor[String(B.floor.depth)]):null;
  if(!pool||!pool.length){ const sf=storyFloor(B.floor.depth); pool=(sf.enter||[]).map(l=>(typeof l==='string')?l:((l&&l.s===p.id)?l.t:null)).filter(Boolean); }
  if(!pool||!pool.length) return;   // v2.1 階層の独り言は lines.js
  if(p.pinned||p.charmBind||p.climaxT>0||attachCount(p)>0||p.heatLv>0||B.enemies.length>30) return;
  heroBubble(p,pickRand(pool),false,0);
}
/* ================= v1.8 地形の資源(光茸・蜜の花・沈んだ宝) =================
   地形帯ごとに生える/沈んでいる拾い物。彼女は見えたものを覚え、必要に応じて目当てにする */
function spawnPick(kind,x,y,known){
  const B=G.B; if(!G.map) return null;
  let q=null;
  if(x===undefined){ const p=B.hero; q=randZoneSpot(PICK_DEF[kind].zone,p.x,p.y,260,1500)||randZoneSpot(PICK_DEF[kind].zone,p.x,p.y,260,9999); if(!q) return null; }
  else q=snapFloor(x,y,false,3)||{x,y};
  const pk={kind,x:q.x,y:q.y,t:0,known:!!known,dead:false};
  B.picks.push(pk); return pk;
}
function spawnInitialPicks(){
  for(let i=0;i<BAL.PICK_SHROOM_N;i++) spawnPick('shroom');
  for(let i=0;i<BAL.PICK_NECTAR_N;i++) spawnPick('nectar');
  spawnPick('treasure');
}
function picksTick(dt){
  const B=G.B, T=B.pickT, p=B.hero;
  const n={shroom:0,nectar:0,treasure:0}; for(const pk of B.picks) if(!pk.dead) n[pk.kind]++;
  if(B.ci===leaderIdx()){   // v3.0 湧きのタイマーは一度だけ進める(ヒロインごとに呼ばれる)
  T.shroom-=dt;   if(T.shroom<=0){   T.shroom=BAL.PICK_SHROOM_RESPAWN;  if(n.shroom<BAL.PICK_SHROOM_MAX) spawnPick('shroom'); }
  T.nectar-=dt;   if(T.nectar<=0){   T.nectar=BAL.PICK_NECTAR_RESPAWN;  if(n.nectar<BAL.PICK_NECTAR_MAX) spawnPick('nectar'); }
  T.treasure-=dt; if(T.treasure<=0){ T.treasure=BAL.PICK_TREASURE_CD;   if(n.treasure<BAL.PICK_TREASURE_MAX) spawnPick('treasure'); }
  }
  // 見えたものは覚える(あとで目当てにできる)
  for(const pk of B.picks){ if(!pk.dead && !pk.known && inSight(pk,p)){ pk.known=true; if(B.time-B.seeToastT>2.5){ B.seeToastT=B.time; floatTxt(pk.x,pk.y-30,'みつけた: '+PICK_DEF[pk.kind].name,'#8fd3ff',11,1.5); sayLine('pick.'+pk.kind,0,14); } } }   // v2.1 資源ごとの台詞
  for(const c of B.chests){ if(!c.known && inSight(c,p)){ c.known=true; floatTxt(c.x,c.y-30,'みつけた: 宝箱','#ffd76a',11,1.5); } }
  for(const it of B.items){ if(!it.known && inSight(it,p)) it.known=true; }
  if(B.ci===leaderIdx()) for(const k in B.poolCd){ if(B.poolCd[k]>0) B.poolCd[k]-=dt; }   // v3.0 一度だけ
}
function applyPick(pk){
  const B=G.B, p=B.hero; pk.dead=true; B.used[pk.kind]++;
  if(pk.kind==='shroom'){
    gainXpAll(p.xpNeed*BAL.SHROOM_XP);
    const n=revealAround(pk.x,pk.y,BAL.SHROOM_REVEAL);
    parts(pk.x,pk.y-10,16,['#9fe8c8','#fff','#cfffe8'],140,0.8); sfx(700,1100,0.3,'sine',0.05);
    floatTxt(p.x,p.y-58,'光茸'+(n?' — '+n+'か所 見えた':''),'#9fe8c8',12,1.4);
    heroBubble(p,n?'……ひかりで、みえた。あっちに、なにかある':'ひかってる……きれい',false,1);
    maybeLevelup();
  }else if(pk.kind==='nectar'){
    p.stamina=Math.min(p.staminaMax,p.stamina+45); p.hp=Math.min(p.maxHp,p.hp+p.maxHp*0.10); applySensit(8);
    if(p.exhausted && p.stamina>25) p.exhausted=false;
    parts(pk.x,pk.y-10,14,['#ffd6e6','#fff','#ffe9b0'],120,0.7); S.heart();
    floatTxt(p.x,p.y-58,'蜜の花 スタミナ+45','#ffb3cf',12,1.4);
    heroBubble(p,pickRand(['あまい……げんき、でてきた','はな、いいにおい……くしゅん']),false,1);
  }else if(pk.kind==='treasure'){
    gainXpAll(p.xpNeed*BAL.TREASURE_XP); B.heroCoins+=25;
    parts(pk.x,pk.y-10,24,['#ffd76a','#8fd3ff','#fff'],180,0.9); S.chest();
    floatTxt(p.x,p.y-58,'沈んだ宝!','#ffd76a',13,1.5);
    heroBubble(p,pickRand(['とれた……! つめたい……','みずのなか、おもかった……']),false,1);
    maybeLevelup();
  }
}
/* 光茸の見通し: 半径内の場所と資源・宝箱を「知っている」に */
function revealAround(x,y,r){
  const M=META.map, B=G.B; let n=0;
  for(const q of G.map.pois){ if(!M.known[q.key] && Math.hypot(q.x-x,q.y-y)<r){ M.known[q.key]=1; M.seen=(M.seen||0)+1; n++; } }
  for(const pk of B.picks){ if(!pk.dead && !pk.known && Math.hypot(pk.x-x,pk.y-y)<r){ pk.known=true; n++; } }
  for(const c of B.chests){ if(!c.known && Math.hypot(c.x-x,c.y-y)<r){ c.known=true; n++; } }
  if(n) saveMeta();
  return n;
}
/* 清水が欲しい状態: 敏感化・発情ゲージ・粘液・快感のどれかがひどい */
function poolWant(p){ return p.sensit>=Math.max(35,(p.sensitFloor||0)+10) || (p.heatG||0)>=45 || p.slow>0 || p.aphro>=40; }   // 下限ぶんの敏感化では欲しがらない
function usePool(q){
  const B=G.B, p=B.hero; B.poolCd[q.key]=BAL.POOL_CD; B.used.pool++;
  p.sensit=Math.max(p.sensitFloor||0,p.sensit-30); p.heatG=Math.max(0,(p.heatG||0)-50); p.slow=0; p.aphro=Math.max(0,p.aphro-15);   // 祭壇/呪いの下限は割らない
  parts(q.x,q.y-6,20,['#cffaff','#fff','#8fd3ff'],120,0.9); sfx(900,500,0.4,'sine',0.05);
  floatTxt(p.x,p.y-58,'清水 — 敏感化-30・発情-50','#8fd3ff',12,1.6);
  heroBubble(p,pickRand(['……つめたい。あたま、すっきりした','ぬるぬる、ながれた……よし']),false,1);
}
/* 石碑: 出会った種族の知識を1段(イベント中は2段)進め、知らない場所を1つ示す */
function learnStep(id){
  const before=knowLv(id); if(before>=3) return false; const k=genKnow(id);
  if(before<1) k.met=Math.max(k.met,1); else if(before<2) k.met=Math.max(k.met,BAL.KNOW_MET2); else k.met=Math.max(k.met,BAL.KNOW_MET3);
  const after=knowLv(id); if(after<=before) return false;
  const h=G.B.hero, m=MONSTERS[id];
  const nm=(typeof CODEX!=='undefined'&&CODEX[id]&&CODEX[id].note&&CODEX[id].note.title)||m.name;
  floatTxt(h.x,h.y-84,'碑文: '+nm+' → '+KNOW_NAMES[after],'#cbd5ff',11,1.8);
  return true;
}
function readStele(q,boost){
  const B=G.B, p=B.hero, M=META.map; B.steleRead[q.key]=1; B.used.stele++;
  const ids=Object.keys(B.codexSeen).filter(id=>MONSTERS[id]&&!MONSTERS[id].item&&knowLv(id)<3);
  let steps=boost?2:1; const got=[];
  while(steps>0 && ids.length){ const i=(Math.random()*ids.length)|0; const id=ids[i]; if(learnStep(id)){ steps--; got.push(id); if(knowLv(id)>=3) ids.splice(i,1); } else ids.splice(i,1); }
  let best=null, bd=1e9; for(const o of G.map.pois){ if(M.known[o.key]) continue; const d=Math.hypot(o.x-q.x,o.y-q.y); if(d<bd){ bd=d; best=o; } }
  if(best){ M.known[best.key]=1; M.seen=(M.seen||0)+1; floatTxt(best.x,best.y-40,'碑文が示す: '+POI_DEF[best.kind].name,'#cbd5ff',12,2.0); }
  setBanner('石碑を読んだ',(got.length?'魔物の知識が'+got.length+'段進んだ':'知っていることばかりだった')+(best?'。'+POI_DEF[best.kind].name+'の場所が分かった':''),'#cbd5ff');
  heroBubble(p,got.length?pickRand(['……そういうことか。おぼえた','これ、あのこたちのこと……']):'……しってることばかり',false,1);
  sfx(500,900,0.5,'sine',0.05); saveMeta();
}
/* ================= v1.8 イベント(光の柱) =================
   一定間隔で「光の柱」が立ち、彼女はそこへ向かう。夜側は先回りして待ち伏せできる */
function eventTick(dt){
  const B=G.B;
  if(B.event){
    const ev=B.event; ev.t+=dt; let done=false;
    if(ev.kind==='chest') done=!B.chests.includes(ev.ref);
    else if(ev.kind==='star') done=!B.items.includes(ev.ref);
    else if(ev.kind==='shroom') done=ev.refs.every(pk=>pk.dead);
    else if(ev.kind==='pool') done=(B.poolCd[ev.key]||0)>0;
    else if(ev.kind==='stele') done=!!B.steleRead[ev.key];
    if(done){ B.eventsDone++; B.event=null; B.eventT=rand(BAL.EVENT_CD_MIN,BAL.EVENT_CD_MAX); }
    else if(B.time>ev.until){ B.event=null; B.eventT=rand(BAL.EVENT_CD_MIN,BAL.EVENT_CD_MAX); }   // 光は消える(物は残る)
    return;
  }
  B.eventT-=dt;
  if(B.eventT<=0) startEvent();
}
function startEvent(){
  const B=G.B, p=B.hero, M=META.map; if(!G.map) return;
  const pools=G.map.pois.filter(q=>q.kind==='pool'), steles=G.map.pois.filter(q=>q.kind==='stele'&&!B.steleRead[q.key]);
  const w=[['chest',3],['star',2]];
  if(G.map.zoneTiles.moss.length) w.push(['shroom',2]);
  if(pools.length) w.push(['pool',poolWant(p)?3:1]);
  if(steles.length) w.push(['stele',2]);
  let tot=0; for(const [,x] of w) tot+=x; let r=Math.random()*tot, kind='chest'; for(const [k,x] of w){ r-=x; if(r<=0){ kind=k; break; } }
  const far=(z)=>{ let q=z?randZoneSpot(z,p.x,p.y,500,1100):null; if(!q){ const a=rand(TAU); q=placeNear(p.x,p.y,Math.cos(a)*800,Math.sin(a)*600,40,false); } return q; };
  const ev={kind,t:0,until:B.time+BAL.EVENT_LIFE,x:0,y:0,key:null,ref:null,refs:null,boost:false};
  if(kind==='chest'){ const q=far('ruin'); const c={x:q.x,y:q.y,t:0,taken:false,known:true,event:true}; B.chests.push(c); ev.ref=c; ev.x=q.x; ev.y=q.y; }
  else if(kind==='star'){ const q=far(null); const r2=Math.random()*10, ik=r2<5?'wipe':(r2<8?'vacuum':'bonus'); const it={kind:ik,x:q.x,y:q.y,t:0,known:true,event:true}; B.items.push(it); ev.ref=it; ev.x=q.x; ev.y=q.y; }
  else if(kind==='shroom'){ const q=far('moss'); ev.refs=[]; for(let i=0;i<4;i++){ const a=i*TAU/4+rand(0.4); const pk=spawnPick('shroom',q.x+Math.cos(a)*14,q.y+Math.sin(a)*10,true); if(pk) ev.refs.push(pk); } ev.x=q.x; ev.y=q.y; if(!ev.refs.length){ B.eventT=5; return; } }
  else if(kind==='pool'){ const q=pools.find(o=>(B.poolCd[o.key]||0)>0)||pickRand(pools); B.poolCd[q.key]=0; ev.key=q.key; ev.x=q.x; ev.y=q.y; M.known[q.key]=1; }
  else if(kind==='stele'){ const q=pickRand(steles); ev.key=q.key; ev.x=q.x; ev.y=q.y; ev.boost=true; M.known[q.key]=1; }
  B.event=ev; B.eventsN++;
  setBanner('イベント: '+EVENT_DEF[kind].name, EVENT_DEF[kind].sub, EVENT_DEF[kind].col);
  sayLine('event.'+kind,1,0,pickRand(['……ひかりの、はしら? いってみる','あっち、なにかおきてる']));   // v2.1 イベントごとの台詞
  if(B.event) partyShare(B.hero,'event',B.event.x,B.event.y);
  sfx(520,1040,0.6,'sine',0.05);
}
function pickupsUpdate(dt){
  const B=G.B, hs=B.heroes.filter(h=>!h.out); if(!hs.length) return;
  for(const gm of B.gems){
    gm.t+=dt;
    // v3.0 ジェムはいちばん近いヒロインへ寄る。経験値はパーティ共通
    let p=hs[0], bd=1e9; for(const h of hs){ const d=Math.hypot(h.x-gm.x,(h.y-10)-gm.y); if(d<bd){ bd=d; p=h; } }
    const st=heroStat(p), dx=p.x-gm.x, dy=(p.y-10)-gm.y, d=bd||0.001;
    if(d<st.magnet) gm.sp+=1400*dt;
    if(gm.sp>0){ const mv=Math.min(gm.sp*dt,d); gm.x+=dx/d*mv; gm.y+=dy/d*mv; }
    if(d<16){
      gm.dead=true; B.ci=p.hi;
      gainXpAll(gm.v*(1+0.12*p.ps.growth)*xpSoft(p));   // ラーニングピアス / v2.1 高Lvほどジェムの経験値が薄い(引き継ぎの飽和)
      B.heroCoins+=gm.v*0.5;             // 彼女はコインも貯えている(夜明けの自己強化)
      S.gem();
      parts(p.x,p.y-14,3,['#8fd3ff','#fff'],70,0.3);
      maybeLevelup();
      if(G.mode!=='battle') break;
    }
  }
  B.ci=leaderIdx();
  B.gems=B.gems.filter(g=>!g.dead);
  for(const h2 of B.hearts){
    h2.t+=dt;
    // v3.0 ハートは触れた子が取る。ただし相手の体力がずっと薄いなら譲る(HEART_YIELD)
    for(const p of hs){ if(Math.hypot(h2.x-p.x,h2.y-(p.y-10))<20){ const o=partnerOf(p); if(o && p.hp/p.maxHp>o.hp/o.maxHp+BAL.HEART_YIELD && p.hp/p.maxHp>0.6 && Math.hypot(o.x-h2.x,o.y-h2.y)<260){ sayPartyAs(p.hi,'heartYield',1,12); continue; }
      h2.dead=true; p.hp=Math.min(p.maxHp,p.hp+30); floatTxt(p.x,p.y-58,'+30','#7ee89a',13,1); heroBubble(p,p.id==='freila'?'……助かる':'かいふく♪'); S.heart(); break; } }
  }
  B.hearts=B.hearts.filter(h=>!h.dead);
  for(const pk of B.picks){   // v1.8 地形の資源: 触れれば拾う
    pk.t+=dt;
    for(const p of hs){ if(!pk.dead && Math.hypot(pk.x-p.x,pk.y-(p.y-6))<22){ B.ci=p.hi; applyPick(pk); break; } }
    if(G.mode!=='battle') break;
  }
  B.ci=leaderIdx();
  B.picks=B.picks.filter(pk=>!pk.dead);
  for(const it of B.items){
    it.t+=dt;
    let p=hs[0], bd=1e9; for(const h of hs){ const d=Math.hypot(h.x-it.x,(h.y-10)-it.y); if(d<bd){ bd=d; p=h; } }
    const st=heroStat(p), dx=p.x-it.x, dy=(p.y-10)-it.y, d=bd||0.001;
    if(d<st.magnet*1.2){ const mv=Math.min(d,420*dt); it.x+=dx/d*mv; it.y+=dy/d*mv; }
    if(d<18){ it.dead=true; B.ci=p.hi; applyItem(it.kind); if(G.mode!=='battle') break; }
  }
  B.ci=leaderIdx();
  B.items=B.items.filter(it=>!it.dead);
  for(const c of B.chests){
    c.t+=dt;
    if(c.taken) continue;
    for(const p of hs){ if(Math.hypot(c.x-p.x,c.y-(p.y-6))<22){ c.taken=true; B.ci=p.hi; if(c.fake) fakeChestTrap(c); else openChest(!!c.bossChest); break; } }
  }
  B.ci=leaderIdx();
  B.chests=B.chests.filter(c=>!c.taken);
  for(const tr of B.trails){
    tr.t+=dt;
    for(const p of hs){ if(Math.hypot(tr.x-p.x,tr.y-p.y)<tr.r+p.r-2) p.slow=Math.max(p.slow,0.3); }
  }
  B.trails=B.trails.filter(tr=>tr.t<tr.life);
  for(const c of B.clouds){ c.t+=dt; }
  B.clouds=B.clouds.filter(c=>c.t<c.life);
}
function openChest(boss){
  const B=G.B, p=B.hero;
  S.chest();
  parts(p.x,p.y-10,boss?40:20,['#ffd76a','#fff','#8fd3ff'],boss?220:180,0.9);
  if(boss){
    // 王の宝箱: 全回復・経験値・強化2つ(進化が揃っていれば進化を優先)
    p.hp=p.maxHp; gainXpAll(p.xpNeed*0.9); maybeLevelup();
    heroBubble(p,'おうさまの、たからばこ……!',false,2);
    const evos=readyEvos();
    if(evos.length){ applyUpg('EVO:'+evos[0]); }
    let n=evos.length?1:2;
    while(n-->0){
      const wpC=Object.values(p.wp).filter(v=>v>0).length, psC=Object.values(p.ps).filter(v=>v>0).length;
      const av=Object.keys(UPG).filter(k=>curLv(k)<UPG[k].max && !(UPG[k].kind==='wp'&&curLv(k)===0&&wpC>=4) && !(UPG[k].kind==='ps'&&curLv(k)===0&&psC>=4));
      if(!av.length) break;
      applyUpg(pickRand(av));
    }
    setBanner('王の宝箱!','全回復・経験値・強化——王を倒した報酬','#ffd76a');
    return;
  }
  const evos=readyEvos();
  if(evos.length){ applyUpg('EVO:'+evos[0]); return; }
  const wpCount=Object.values(p.wp).filter(v=>v>0).length;
  const psCount=Object.values(p.ps).filter(v=>v>0).length;
  const avail=Object.keys(UPG).filter(k=>{
    if(curLv(k)>=UPG[k].max) return false;
    if(UPG[k].kind==='wp' && curLv(k)===0 && wpCount>=4) return false;
    if(UPG[k].kind==='ps' && curLv(k)===0 && psCount>=4) return false;
    return true;
  });
  chestGift();   // 宝箱の裏側: 夜側にもランダムな魔物が加勢する
  if(avail.length){
    const k=pickRand(avail);
    applyUpg(k);
    setBanner('宝箱!', UPG[k].name+' を入手', '#ffd76a');
  }else{
    p.hp=p.maxHp;
    setBanner('宝箱!', '全回復した', '#ffd76a');
  }
}

/* 宝箱の裏側: 彼女が宝箱を開けるたび、夜側にもランダムな魔物が加勢する。
   この戦闘に限り編成枚数を超えて手札に加わる(temp)。
   手札に素材が揃っていれば、融合体へ【進化】して現れることもある */
function chestGift(){
  const B=G.B;
  const inHand=id=>B.hand.some(h=>h.id===id);
  let pick=null, evolved=false;
  if(Math.random()<0.5){
    const fus=FUSION_IDS.filter(id=>!inHand(id) && MONSTERS[id].fusion.every(f=>inHand(f)));
    if(fus.length){ pick=pickRand(fus); evolved=true; }
  }
  if(!pick){
    const pool=Object.keys(MONSTERS).filter(id=>!MONSTERS[id].boss && !MONSTERS[id].fusion && !MONSTERS[id].item && !inHand(id));
    if(!pool.length) return;
    pick=pickRand(pool);
  }
  B.hand.push({id:pick, cdT:0, cdMax:1, temp:true});
  B.gifts++;
  if(typeof UI!=='undefined') UI.buildHand();
  const m=MONSTERS[pick];
  setBanner(evolved?'進化!  '+m.name:'加勢!  '+m.name,
    (evolved?'宝箱の闇で素材が融合した':'宝箱の底から這い出た')+' — この戦闘のみ手札に加わる', '#c98cff');
  S.summon();
}

/* ================= カードプレイ(プレイヤー側) ================= */
function handSlot(id){ return G.B.hand.find(h=>h.id===id); }
function aliveOf(id){ let n=0; for(const e of G.B.enemies){ if(!e.dead&&e.id===id) n++; } return n; }
/* 階級による陣形の制限: 大型は精鋭/双璧のみ、ボスは単騎。許されない陣形は許可陣形へ丸める */
function resolveForm(id, formId){
  const allow=TIER_FORMS[tierOf(id)];
  const ft=FORMATIONS[formId]&&FORMATIONS[formId].tiers;   // v2.2 陣形側の制限(包囲円陣は雑魚だけ)
  if(ft && !ft.includes(tierOf(id))){ for(const f of ['burst','wave','scatter']){ if(META.formations.includes(f) && (!allow||allow.includes(f))) return f; } formId='scatter'; }
  if(!allow || allow.includes(formId)) return formId;
  for(const f of allow){ if(META.formations.includes(f)) return f; }
  return allow[0];
}
/* 1キャストの頭数(コンボ・夜の深まり・練度・群れ倍化・軍団旗を全部込みで) */
function spawnCountFor(id, formId, comboN, raw){
  formId=resolveForm(id,formId);
  const B=G.B, f=FORMATIONS[formId], m0=MONSTERS[id];
  if(m0.boss) return 1;
  const capN=n=>(raw||SPECIES_MAX[id]===undefined||!B)?n:Math.max(1,Math.min(n,SPECIES_MAX[id]-aliveOf(id)));   // 種族の同時上限(表示・費用も揃える)
  if(m0.solo) return capN(Math.min(f.count,4));   // solo(小淫魔/ガス玉)は最大4体まで
  const multi=(formId!=='single' && formId!=='duo');   // 精鋭型は頭数ボーナスが乗らない(少数精鋭)
  if(!multi || tierOf(id)==='large') return capN(f.count);
  const clv=(META.cards[id]&&META.cards[id].lv)||1;
  const pscale=Math.min(1,(clv-1)/2);
  const comboExtra=Math.floor(((comboN||1)-1)/BAL.COMBO_UNIT_PER);
  const nightExtra=Math.min(BAL.NIGHT_UNIT_MAX, Math.floor(B.hero.level/BAL.NIGHT_UNIT_LV));
  const lvExtra=Math.floor((clv-1)/2);
  const legion=altarLv('legion');              // 夜の軍団旗(オーブ・永続)
  const extra=Math.floor((comboExtra+nightExtra)*pscale)+lvExtra+legion;
  const sw=(m0.swarm||1)>1 && clv>=2 ? m0.swarm : 1;
  // 包囲円陣: 速い魔物は少なく、遅いほど多く、動かない魔物が最も多い(行動を縛りつつ、早く倒さないと囲まれる陣)
  const ringMul=formId==='ring'?(m0.spd===0?1.6:(m0.spd<30?1.35:(m0.spd<45?1.0:0.7))):1;
  return capN(Math.ceil((f.count+extra)*sw*ringMul*(1+BAL.PRESS_UNIT*pressure())));   // v2.1 深淵の圧で頭数が増える
}
function playCost(id, formId){
  formId=resolveForm(id,formId);
  const lv=(META.cards[id]&&META.cards[id].lv)||1;
  const f=FORMATIONS[formId];
  if(MONSTERS[id].boss) return cardCost(id,lv);
  let cost=Math.max(1, Math.ceil(cardCost(id,lv)*f.factor));
  if(SPECIES_MAX[id]!==undefined && G.B){ const nom=spawnCountFor(id,formId,1,true), n=spawnCountFor(id,formId,1); if(n<nom) cost=Math.max(1,Math.ceil(cost*n/nom)); }   // 上限で頭数が削れる分、費用も削る
  return cost;
}
function canPlay(id, formId){
  const B=G.B;
  if(!B || G.mode!=='battle') return {ok:false};
  formId=resolveForm(id,formId);
  const slot=handSlot(id);
  if(!slot) return {ok:false};
  if(slot.cdT>0) return {ok:false, why:'cd'};
  if(MONSTERS[id].boss){
    if(B.bossPlayed[id]) return {ok:false, why:'bossused'};                 // 同じボスは1戦に1度
    if(B.bossCd>0) return {ok:false, why:'bosscd'};                         // 次のボスまで BOSS_CD 秒
    if(B.enemies.some(e=>e.boss&&!e.dead&&!MONSTERS[e.id].guardian)) return {ok:false, why:'boss1'};  // 同時に1体(最深部の魔核は数えない)
  }
  if(B.enemies.length>=fieldCap()) return {ok:false, why:'cap'};   // v2.1 圧で上限も増える
  if(SPECIES_MAX[id]!==undefined && aliveOf(id)>=SPECIES_MAX[id]) return {ok:false, why:'species'};   // 種族の同時上限(ゲイザー4)
  const cost=playCost(id,formId);
  if(B.en<cost) return {ok:false, why:'en'};
  return {ok:true, cost};
}
function playCard(id, formId){
  const B=G.B;
  formId=resolveForm(id,formId);
  const chk=canPlay(id,formId);
  if(!chk.ok){ if(chk.why==='en') S.deny(); return false; }
  const p=B.hero, f=FORMATIONS[formId], cost=chk.cost;
  B.en-=cost;
  const slot=handSlot(id);
  slot.cdMax=(BAL.CARD_CD_BASE+cost*BAL.CARD_CD_COST)*(1-0.12*altarLv('cdcut'));
  slot.cdT=slot.cdMax;
  S.summon();

  if(MONSTERS[id].boss){
    B.bossUsed=true; B.bossPlayed[id]=true; B.bossCd=BAL.BOSS_CD;
    const a=rand(TAU);
    const dist=MONSTERS[id].spd>0?620:320;   // 動かないボス(淫夢の樹)は近くに根を張る
    spawnUnit(id, p.x+Math.cos(a)*dist, p.y+Math.sin(a)*dist, {enVal:cost});
    setBanner('⚠ ボス召喚!', MONSTERS[id].name, '#ff6b81');
    heroBubble(p,'おおきいの きた…!?',true);
    S.boss();
    G.shake=Math.min(8,G.shake+5);
    return true;
  }

  // ==== 物量ボーナスはカードの練度で解放される ====
  // Lv1=乗らない / Lv2=半分 / Lv3+=フル。「研究所で群れ運用を覚える」
  const clv=(META.cards[id]&&META.cards[id].lv)||1;
  const pscale=Math.min(1,(clv-1)/2);
  // コンボ: 同じカードを窓内に重ねるほど、召喚が強く・多くなる
  const cb=B.combo[id];
  const comboN=(cb && B.time-cb.t<=BAL.COMBO_WINDOW)?Math.min(BAL.COMBO_MAX,cb.n+1):1;
  B.combo[id]={n:comboN, t:B.time};
  B.lastPlay={id, t:B.time};
  const comboMult=1+BAL.COMBO_STAT*(comboN-1)*pscale;
  if(comboN>=2){
    floatTxt(p.x, p.y-92, 'コンボ×'+comboN+'!', '#ffd76a', 12, 1.2);
    sfx(420+60*comboN, 700, 0.12, 'triangle', 0.05);
  }
  // 頭数はコンボ・夜の深まり・練度・群れ倍化・軍団旗を全部込みで決まる
  let n=spawnCountFor(id, formId, comboN);
  if(SPECIES_MAX[id]!==undefined) n=Math.max(1,Math.min(n,SPECIES_MAX[id]-aliveOf(id)));
  const per=cost/n;
  // ボーナス頭数ぶんのジェムは薄める——群れの雑魚は彼女の経験値の泉にならない
  const gemMul=Math.min(1, f.count/n);
  const so={enVal:per, mult:comboMult, gemMul};

  if(formId==='scatter'||formId==='burst'||formId==='single'||formId==='duo'){
    for(let i=0;i<n;i++){
      const a=rand(TAU);
      const q=placeNear(p.x,p.y,Math.cos(a)*560,Math.sin(a)*560,24,canFly(id));
      spawnUnit(id, q.x, q.y,
        Object.assign({elite:f.elite||1}, so));
    }
  }else if(formId==='wave'){
    const a=rand(TAU);
    const q0=placeNear(p.x,p.y,Math.cos(a)*580,Math.sin(a)*580,24,canFly(id)); const cx=q0.x, cy=q0.y;
    const px=-Math.sin(a), py=Math.cos(a);
    for(let i=0;i<n;i++){
      const off=(i-(n-1)/2)*55;
      spawnUnit(id, cx+px*off, cy+py*off, so);
    }
  }else if(formId==='ambush'){
    const vd=Math.hypot(p.vx,p.vy);
    const ang=vd>20?Math.atan2(p.vy,p.vx):rand(TAU);
    for(let i=0;i<n;i++){
      const d2=rand(240,380), spread=rand(-0.5,0.5);
      const q=placeNear(p.x,p.y,Math.cos(ang+spread)*d2,Math.sin(ang+spread)*d2,24,canFly(id));
      spawnUnit(id, q.x, q.y,
        Object.assign({dormant:id!=='flower'}, so));
    }
  }else if(formId==='ring'){
    const rot=rand(TAU); B.ringCd=BAL.RING_CD;
    for(let i=0;i<n;i++){
      const a=rot+i*TAU/n+rand(-0.12,0.12);
      const q=placeNear(p.x,p.y,Math.cos(a)*BAL.RING_R,Math.sin(a)*BAL.RING_R*0.75,24,canFly(id));
      const u=spawnUnit(id, q.x, q.y, so); if(u) u.stun=Math.max(u.stun||0,BAL.RING_STUN);   // v2.2 遠い輪から締める。現れた直後は動けない(彼女が反応できる)
    }
  }
  return true;
}

/* ================= オート指揮 ================= */
const BINDERS=['worm','serpent','gtent','flower','pot','dreamtree','ghosthand'];
const PRESSURE=['ghost','goblin','hand','spore','ghosthand','serpent','mistslime','slime','slug'];
function bestForm(prefer){
  for(const f of prefer){ if(META.formations.includes(f)) return f; }
  return META.formations[0];
}
function autoDirector(dt){
  const B=G.B;
  if(B.ringCd>0) B.ringCd-=dt;
  if(!B.auto) return;
  B.autoT-=dt;
  if(B.autoT>0) return;
  B.autoT=0.42;
  const p=B.hero;
  const alive=B.enemies.filter(e=>!e.dead);
  const hpRatio=p.hp/p.maxHp;
  const stamRatio=p.stamina/p.staminaMax;
  const held=attachCount(p)>0||p.pinned||!!p.charmBind||p.climaxT>0;
  const has=id=>B.hand.some(h=>h.id===id);
  const ready=(id,f)=>canPlay(id,f).ok;

  // EN方針: いちばん重いカードを出せるだけの残高は温存しつつ、
  // 溢れそうなら惜しまず全力で吐き出して画面を埋める
  const costsArr=B.hand.filter(sl=>!MONSTERS[sl.id].boss).map(sl=>playCost(sl.id,bestForm(['burst','wave','scatter'])));
  const reserve=costsArr.length?Math.max(...costsArr):0;
  const flush=B.en>enMax()*0.8;
  // ボスを出し惜しみしない: 出せる条件(同時1体・60秒・未使用)が揃ったボスがあれば、ENを溜めて出す。溜めている間は任意の小技を控える
  let bossWant=null, saving=false;
  if(B.time>20){
    const bosses=shuffle(B.hand.filter(sl=>MONSTERS[sl.id].boss).slice());   // v2.0 出す順は固定しない(毎回シャッフル)
    for(const sl of bosses){
      const chk=canPlay(sl.id,'single');
      if(chk.ok){ playCard(sl.id,'single'); return; }
      if(chk.why==='en'){ bossWant=sl.id; saving=true; break; }
    }
  }

  // v2.2 設置: 4〜6秒に1度、状況で品を選んで置く(大物ぶんのENは残す)
  B.itemT-=0.42;
  if(B.itemT<=0 && B.time>12){
    B.itemT=4+rand(2);
    const pick=chooseNightItem(p,held);
    if(pick && B.en>=NIGHT_ITEMS[pick.id].cost+Math.min(reserve*0.5,10)){ if(placeItem(pick.id,pick.x,pick.y,{auto:true})){ B.itemT=5+rand(3); return; } }
  }
  // 0) 開幕の物量: 序盤は安い群れを惜しまず撒いて、最初からモンスターまみれにする
  if(B.time<50 && alive.length<44){
    let cheap=null, cc=1e9;
    for(const sl of B.hand){
      if(MONSTERS[sl.id].boss||MONSTERS[sl.id].solo) continue;
      const c=playCost(sl.id,'scatter');
      if(c<cc){ cc=c; cheap=sl.id; }
    }
    if(cheap){
      const f=bestForm(['burst','wave','scatter']);
      if(ready(cheap,f)){ playCard(cheap,f); return; }
      if(ready(cheap,'scatter')){ playCard(cheap,'scatter'); return; }
    }
  }

  // 1) 拘束中・押し倒し中は畳みかける(最大2プレイ)
  if(held){
    let plays=0;
    for(const id of PRESSURE.concat(['worm'])){
      if(plays>=2) break;
      if(!has(id)) continue;
      for(const f of [bestForm((B.ringCd||0)<=0?['ring','burst','wave','scatter']:['burst','wave','scatter']), 'scatter']){   // v2.2 包囲円陣は RING_CD 秒に1度だけ
        if(ready(id,f)){ playCard(id,f); plays++; break; }
      }
    }
    if(plays>0) return;
  }

  // 2) 好機に拘束役を追加投入: スタミナ薄・ガス溜まりへの突入中・発情の波
  //    (足が止まる/鈍る瞬間 = 拘束の差し込み所)
  const binderN=alive.filter(e=>BINDERS.includes(e.id)).length;
  const distracted=!!cloudAt(p.x,p.y-12)||p.diveT>0||p.waveDur>0;
  if((stamRatio<0.45||distracted) && binderN<4){
    for(const id of ['worm','serpent','gtent','flower']){
      if(!has(id)) continue;
      const f=id==='flower'?bestForm(['ambush','scatter']):bestForm(['wave','scatter']);
      if(ready(id,f)){ playCard(id,f); return; }
    }
  }

  // 3) 拘束役の維持(常に4体以上。物量の海でも拘束の圧を絶やさない)
  if(binderN<4){
    for(const id of ['gtent','serpent','worm','flower']){
      if(!has(id)) continue;
      const f=id==='flower'?bestForm(['ambush','scatter']):bestForm(['wave','scatter']);
      const chk=canPlay(id,f);
      if(chk.ok && B.en>=chk.cost+(binderN===0?0:4)){ playCard(id,f); return; }
    }
  }

  // 3.5) コンボ継続: 直前カードの連鎖が生きていて余裕があれば重ねる(ボスを溜めている間は控える)
  const lp=B.lastPlay;
  if(!saving && lp && !MONSTERS[lp.id].boss && B.combo[lp.id]){
    const cb=B.combo[lp.id];
    if(B.time-cb.t<=BAL.COMBO_WINDOW-1.5 && cb.n<BAL.COMBO_MAX && has(lp.id)){
      const f=bestForm(['burst','wave','scatter']);
      const chk=canPlay(lp.id,f);
      if(chk.ok && B.en>=chk.cost+6){ playCard(lp.id,f); return; }
    }
  }

  // 4) ガスの維持(場に無ければ)——媚薬=敏感化の下地を作る
  if(!saving && has('gas') && !alive.some(e=>e.id==='gas') && sensLvOf(p)<2){
    const f=bestForm(['single','scatter']);
    const chk=canPlay('gas',f);
    if(chk.ok && B.en>=chk.cost+4){ playCard('gas',f); return; }
  }

  // 4.5) 敏感化が乗っているなら吸液羽虫で快感を注ぐ
  if(!saving && has('leech') && (sensLvOf(p)>=1||p.aphro>30) && alive.filter(e=>e.id==='leech').length<3){
    const f=bestForm(['wave','scatter']);
    const chk=canPlay('leech',f);
    if(chk.ok && B.en>=chk.cost+3){ playCard('leech',f); return; }
  }

  // 4.6) 魅了の種まき: ナメクジが場に薄ければ足す(段階UPは接触の積み重ね)
  if(!saving && has('slug') && alive.filter(e=>e.id==='slug').length<2 && charmMaxLv(p)<3 && B.time>15){
    const chk=canPlay('slug','scatter');
    if(chk.ok && B.en>=chk.cost+5){ playCard('slug','scatter'); return; }
  }

  // 4.8) 覗き目玉を1体、見張りに
  if(!saving && has('eye') && !alive.some(e=>e.id==='eye') && B.time>20){
    const f=bestForm(['single','scatter']);
    const chk=canPlay('eye',f);
    if(chk.ok && B.en>=chk.cost+4){ playCard('eye',f); return; }
  }
  // 5) 小淫魔を1体まとわりつかせる
  if(!saving && has('imp') && !alive.some(e=>e.id==='imp')){
    const f=bestForm(['single','scatter']);
    const chk=canPlay('imp',f);
    if(chk.ok && B.en>=chk.cost+4){ playCard('imp',f); return; }
  }

  // 5.5) 大型: 積極的に。場の大型が手札の大型枚数(最大2)より少なければ精鋭/双璧で置く
  if(!saving && B.time>25){
    const largeHand=B.hand.filter(sl=>tierOf(sl.id)==='large').length;
    const largeAlive=alive.filter(e=>tierOf(e.id)==='large').length;
    if(largeAlive<Math.min(2,largeHand)){
      for(const slot of B.hand){
        if(tierOf(slot.id)!=='large') continue;
        if(alive.some(e=>e.id===slot.id)) continue;
        const f=resolveForm(slot.id, bestForm(['duo','single']));
        const chk=canPlay(slot.id,f);
        if(chk.ok && B.en>=chk.cost+2){ playCard(slot.id,f); return; }
      }
    }
  }
  // 6) ボスは上(EN方針)で、出せる条件が揃えば即出す

  // 7) ENが溢れそうなら全力放出(1tickで最大4プレイ・半分まで使い切る)
  if(flush){
    let plays=0;
    for(const id of ['gtent','ghost','serpent','ghosthand','goblin','hand','spore','mistslime','slime','worm','slug','leech','slugqueen','moth','succubus','gazer','beamer']){
      if(plays>=4 || B.en<enMax()*0.5) break;
      if(!has(id)) continue;
      const f=bestForm(['burst','wave','scatter']);   // v2.2 放出時は包囲円陣を使わない
      if(ready(id,f)){ playCard(id,f); plays++; }
    }
    if(plays>0) return;
  }

  // 8) 圧が切れているなら安価に補充(ただし大物ぶんのENは温存)
  if(alive.length<10){
    for(const id of ['goblin','hand','spore','slug','worm','ghost','slime','serpent','ghosthand']){
      if(!has(id)) continue;
      const chk=canPlay(id,'scatter');
      if(chk.ok && B.en-chk.cost>=Math.min(reserve*0.7,14)){ playCard(id,'scatter'); return; }
    }
  }
}

/* ================= 戦闘tick ================= */
/* ================= v3.0 パーティ(多ヒロイン)の基盤 =================
   B.heroes[] に全員、B.hero は文脈(B.ci)のヒロイン。ヒロインごとの処理は eachHero で文脈を切り替えながら回す。
   魔物は e.ti(標的)の文脈で動く。離脱(out=捕まってその場に残っている)中の子は処理も標的からも外れる */
function leaderIdx(){ const B=G.B; if(!B||!B.heroes) return 0; const i=B.heroes.findIndex(h=>!h.out); return i<0?0:i; }
function eachHero(fn){ const B=G.B; for(let i=0;i<B.heroes.length;i++){ const h=B.heroes[i]; if(h.out) continue; B.ci=i; fn(h,i); if(G.mode!=='battle'&&G.mode!=='levelup') break; } B.ci=leaderIdx(); }
function nearestHeroIdx(x,y){ const B=G.B; let bi=-1, bd=1e9; B.heroes.forEach((h,i)=>{ if(h.out) return; const d=Math.hypot(h.x-x,h.y-y); if(d<bd){ bd=d; bi=i; } }); return bi<0?leaderIdx():bi; }
function partnerOf(p){ const B=G.B; let best=null, bd=1e9; for(const h of B.heroes){ if(h===p||h.out) continue; const d=Math.hypot(h.x-p.x,h.y-p.y); if(d<bd){ bd=d; best=h; } } return best; }
function heroOf(k){ const B=G.B; const own=(UPG[k]&&UPG[k].owner)||'lumina'; return (B&&B.heroes&&B.heroes.find(h=>h.id===own))||(B&&B.hero); }
function heroSkills(p){ return (HEROES[p.id]||HEROES.lumina).skills; }
function sceneForHero(h,kind,id){ if(h&&h.id==='freila'&&typeof SCENES_F!=='undefined'){ const t=SCENES_F[kind]||{}; const r=t[id]||t.default; if(r) return r; } return sceneFor(kind,id); }
function gainXpAll(v){ const B=G.B; for(const h of B.heroes) h.xp+=v; }
/* パーティの台詞(js/lines_party.js の LINES_P)。path の先が {lumina:[..],freila:[..]} なら話者の声で、配列ならそのまま */
function sayPartyAs(hi,path,prio,cd){
  const B=G.B; if(!B||typeof LINES_P==='undefined') return false; const h=B.heroes[hi]; if(!h) return false;
  let o=LINES_P; for(const k of path.split('.')){ if(o==null) return false; o=o[k]; }
  const arr=o&&(Array.isArray(o)?o:o[h.id]); if(!Array.isArray(arr)||!arr.length) return false;
  cd=(cd===undefined)?6:cd; const key='P'+hi+':'+path; B.lineCd=B.lineCd||{}; if(B.lineCd[key]!==undefined && B.time-B.lineCd[key]<cd) return false;
  B.lineCd[key]=B.time; heroBubble(h,arr[(Math.random()*arr.length)|0],(prio||0)>=2,prio||0); return true;
}
/* 二人が画面に収まる距離に保つ(離れすぎた分を寄せる。拘束されている子は動かさない) */
function partyClamp(){
  const B=G.B, hs=B.heroes.filter(h=>!h.out); if(hs.length<2) return;
  for(let i=0;i<hs.length;i++) for(let j=i+1;j<hs.length;j++){ const a=hs[i], b=hs[j]; const fa=!(a.pinned||attachCount(a)>0||a.charmBind), fb=!(b.pinned||attachCount(b)>0||b.charmBind);
    const dx=b.x-a.x, dy=b.y-a.y;
    if(Math.abs(dx)>BAL.PARTY_MAXDX){ const ex=(Math.abs(dx)-BAL.PARTY_MAXDX)*Math.sign(dx); if(fa&&fb){ a.x+=ex/2; b.x-=ex/2; } else if(fa) a.x+=ex; else if(fb) b.x-=ex; }
    if(Math.abs(dy)>BAL.PARTY_MAXDY){ const ey=(Math.abs(dy)-BAL.PARTY_MAXDY)*Math.sign(dy); if(fa&&fb){ a.y+=ey/2; b.y-=ey/2; } else if(fa) a.y+=ey; else if(fb) b.y-=ey; } }
  for(const h of hs) collideMap(h,h.r+2,false);
}
/* 救出: 捕まってその場に残っている子のそばに RESCUE_T 秒立つ */
function rescueTick(dt){
  const B=G.B, p=B.hero; if(p.out) return;
  if(p.thanksT>0){ p.thanksT-=dt; if(p.thanksT<=0) sayPartyAs(B.ci,'rescue.thanks',3,0); }
  for(const c of B.heroes){ if(!c.out||!c.captive) continue; const d=Math.hypot(c.x-p.x,c.y-p.y);
    if(d<BAL.RESCUE_R && attachCount(p)===0 && !p.pinned && !p.charmBind && p.climaxT<=0){ if(c.captive.rescue<=0) sayPartyAs(B.ci,'rescue.start',2,15); c.captive.rescue+=dt; if(c.captive.rescue>=BAL.RESCUE_T) rescueHero(c,p); }
    else c.captive.rescue=Math.max(0,c.captive.rescue-dt*0.7); }
}
function rescueHero(c,by){
  const B=G.B; c.out=false; c.pinned=false; c.pinBy=null; c.pinEscape=0; c.struggle=0; c.captive=null; B.captures=(B.captures||[]).filter(x=>x.hi!==c.hi); /* 救い出した子の捕獲記録は消す */ c.hp=Math.max(c.hp,Math.round(c.maxHp*0.5)); c.stamina=Math.max(c.stamina,Math.round(c.staminaMax*0.6)); c.ifr=1.5; c.aiMode='fight'; c.goal=null; c.path=null; c.exhausted=false; c.thanksT=1.3;
  B.rescues=(B.rescues||0)+1; setBanner(c.name+'を救い出した!', by.name+'が縛めを解いた','#8fd3ff'); parts(c.x,c.y-14,30,['#fff','#8fd3ff','#ffd76a'],200,0.8); S.lvup();
  sayPartyAs(by.hi,'rescue.done',3,0); B.party.goal=null;
  if(typeof STORY_V30!=='undefined' && STORY_V30.party && STORY_V30.party.rescue && !B.rescueStorySeen){ B.rescueStorySeen=true; UI.showStory(STORY_V30.party.rescue,{dur:5}); }
}
function battleTick(dt){
  const B=G.B;
  B.time+=dt;

  // v2.0 時間制限は無い。その日は「降り口に着く」「魔核を討つ」「捕まる」で終わる
  // v3.0 ヒロインごとの更新(文脈 B.ci を切り替えながら)。捕まってその場に残っている子は飛ばす
  for(let i=0;i<B.heroes.length;i++){
    B.ci=i; const p=B.hero; if(p.out){ p.anim+=dt; continue; }
    p.anim+=dt;
    if(p.ifr>0) p.ifr-=dt;
    if(p.bubbleT>0) p.bubbleT-=dt;
    if(p.bubbleCd>0) p.bubbleCd-=dt;
    if(p.novaAnim>0) p.novaAnim-=dt;
    if(p.whipAnim>0) p.whipAnim-=dt;
    if(p.fwingAnim>0) p.fwingAnim-=dt;
    p.hp=Math.min(p.maxHp,p.hp+p.regen*(p.guardT>0?4:1)*dt);   // 清廉のご加護 / v2.3 聖光の壁で×4

    condTick(p,dt);
    if(p.climaxT>0){ climaxTick(dt); }
    if(p.pinned){ pinTick(dt); if(G.mode!=='battle') return; }
    else if(p.charmBind){ charmBindTick(dt); if(G.mode!=='battle') return; }
  }
  B.ci=leaderIdx(); const p=B.hero;
  for(const st of B.stains) st.t+=dt;
  B.stains=B.stains.filter(st=>st.t<st.life);
  // きよめの泉(聖水の領域)・演出FX・閃光・まさぐりの全体ゲート
  for(const z of B.zones){
    z.t+=dt; z.tick-=dt;
    if(z.tick<=0){
      z.tick=0.4;
      for(const e of B.enemies){
        if(e.dead||e.dormant||e.state==='attached') continue;
        if(Math.hypot(e.x-z.x,e.y-z.y)<z.r+e.r*0.5) damageEnemy(e,z.dmg);
      }
    }
  }
  B.zones=B.zones.filter(z=>z.t<z.life);
  for(const f of B.fx) f.t+=dt;
  B.fx=B.fx.filter(f=>f.t<f.life);
  if(B.whiteFlash>0) B.whiteFlash-=dt;
  if(B.gropeCd>0) B.gropeCd-=dt;
  updateFlow();   // 魔物の回り込み用の流れ場(彼女のタイルが変わったら作り直す)
  if(B.bossCd>0) B.bossCd-=dt;
  // 敵弾(刻印師の呪弾): 直進し、彼女に当たれば淫紋
  for(const b of B.ebullets){
    b.t+=dt; b.x+=b.vx*dt; b.y+=b.vy*dt;
    for(let i=0;i<B.heroes.length;i++){ const h=B.heroes[i]; if(h.out||b.dead) continue; if(Math.hypot(b.x-h.x,b.y-(h.y-14))<b.r+h.r*0.8 && h.freezeT<=0){ B.ci=i; b.dead=true; runeHit(b); } }   // v3.0 誰に当たったか
  }
  B.ci=leaderIdx();
  if(B.ebullets.length) B.ebullets=B.ebullets.filter(b=>!b.dead&&b.t<b.life);
  eachHero(()=>poiTick(dt));   // 祠・泉・門(v3.0 ヒロインごと)
  denTick(dt);                 // v3.2 巣窟の魔法陣・媚薬の花・壁の光線・番人(1フレームに1度)
  for(const k in B.itemCd){ if(B.itemCd[k]>0) B.itemCd[k]-=dt; }
  eachHero(()=>trapsTick(dt));
  // 小淫魔: 近くの数を数える(集中低下)。快感は煽りアクション時のみ(バーストCD持ち)
  if(B.impBurstCd>0) B.impBurstCd-=dt;
  for(const h of B.heroes){ h.teaseN=0; if(h.out) continue; for(const e of B.enemies){ if(!e.dead&&e.id==='imp'&&Math.hypot(e.x-h.x,e.y-h.y)<120) h.teaseN++; } }
  eachHero(()=>{ aiUpdate(dt); const n0=B.bullets.length; weaponsUpdate(dt); for(let k=n0;k<B.bullets.length;k++) B.bullets[k].hi=B.ci; rescueTick(dt); });   // v3.0 一人ずつ考えて撃つ。撃った弾は持ち主を覚える
  bulletsUpdate(dt);
  enemiesUpdate(dt);
  partyClamp();   // v3.0 二人が画面に収まる距離に保つ(魔物の押し合い・跳躍の後に)
  if(G.mode!=='battle') return;
  pickupsUpdate(dt);
  if(G.mode!=='battle') return;
  eachHero(()=>picksTick(dt)); eventTick(dt);   // v1.8 地形の資源とイベント
  storyTick(dt);                   // v2.0 階層の独り言
  exitTick(dt); eachHero(()=>linesTick(dt));     // v2.1 降りる判断 / 場面に合わせた台詞
  partyTick(dt);                   // v3.0 二人のやりとり(相談の台詞・共有・雑談)
  eachHero(()=>skillTick(dt));     // v2.3 奥義
  eachHero(()=>seenTick(dt));      // v2.4 見た範囲を覚える(二人ぶんの視界)

  // EN回復
  B.en=Math.min(enMax(), B.en+(BAL.EN_REGEN+0.12*altarLv('enregen')+BAL.EN_REGEN_LV*p.level)*B.floor.en.regen*(1+BAL.PRESS_EN_REGEN*pressure())*dt);   // v2.0 深いほど速く溜まる / v2.1 長居するほど速い
  for(const slot of B.hand){ if(slot.cdT>0) slot.cdT-=dt; }

  // 燭台の追加出現
  B.propT-=dt;
  if(B.propT<=0 && B.props.length<BAL.PROP_MAX){
    B.propT=BAL.PROP_RESPAWN;
    const a=rand(TAU), d=rand(200,460);
    const q=placeNear(p.x,p.y,Math.cos(a)*d,Math.sin(a)*d,40,false);
    B.props.push({x:q.x, y:q.y, hp:BAL.PROP_HP, max:BAL.PROP_HP, t:0});
  }

  // 宝箱
  if(B.chestIdx<BAL.CHEST_TIMES.length && B.time>=BAL.CHEST_TIMES[B.chestIdx]){
    B.chestIdx++;
    const a=rand(TAU), d=rand(300,460);
    const q=randZoneSpot('ruin',p.x,p.y,300,900)||placeNear(p.x,p.y,Math.cos(a)*d,Math.sin(a)*d,40,false);   // 遺物の箱: 石畳の回廊に落ちやすい
    B.chests.push({x:q.x, y:q.y, t:0, taken:false, known:false});
    setBanner('宝箱が どこかに おちた','石畳の回廊に多い。ルミナが見つけると強化されてしまう…','#8fd3ff');
  }

  for(const s of B.spawnFx){ s.t+=dt; }
  B.spawnFx=B.spawnFx.filter(s=>s.t<0.6);

  autoDirector(dt);
}
function capturedTick(dt){
  const B=G.B, p=B.hero;
  B.captureT-=dt;
  p.anim+=dt;
  for(const e of B.enemies){
    if(e.dead||e.state==='attached') continue;
    const dx=p.x-e.x, dy=p.y-e.y, d=Math.hypot(dx,dy)||1;
    if(d>36 && MONSTERS[e.id].spd>0){ e.x+=dx/d*60*dt; e.y+=dy/d*60*dt; }
    e.t+=dt;
  }
  if(Math.random()<dt*10) parts(p.x+rand(-20,20),p.y-rand(0,26),1,['#c98cff','#8458d8','#ff86b3'],40,0.8);
  if(B.captureT<=0) endBattle('capture');
}
function survivedTick(dt){
  const B=G.B, p=B.hero;
  B.winT-=dt;
  p.anim+=dt; p.orbAng+=2.5*dt;
  if(Math.random()<dt*14) parts(p.x+rand(-160,160),p.y-rand(-20,160),1,['#fff','#ffd76a','#8fd3ff','#ff86b3'],26,1.3);
  if(B.winT<=0) endBattle(B.descending?'descend':(B.cleared?'clear':'survive'));
}

/* ================= ロビー(ホーム画面の装飾) ================= */
function newLobby(){
  return { anim:rand(10), orbAng:0, bubble:'', bubbleT:0, t:0 };
}
function lobbyTick(dt){
  if(!G.lobby) G.lobby=newLobby();
  const L=G.lobby;
  L.anim+=dt; L.orbAng+=1.2*dt; L.t+=dt;
  if(L.bubbleT>0) L.bubbleT-=dt;
  if(L.t>4){
    L.t=0;
    L.bubble=pickRand(['今夜も、まもってみせる!','じゅんびは いつでもOK!','なんだか、いやな気配…','この光は、みんなの光だから']);
    L.bubbleT=2.2;
  }
  if(Math.random()<dt*2) parts(rand(-380,380),rand(-240,180),1,['#fff','#8fd3ff','#b46cff'],14,1.6);
  G.cam.x=0; G.cam.y=150;
}
