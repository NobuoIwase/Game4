'use strict';
/* ============================================================
   game.js — 戦闘ロジック
   ヒロイン(AI自動操縦) / 四肢拘束・スタミナ / モンスター / EN・カード
============================================================ */

/* ================= ヒロイン生成 ================= */
function newHero(id){
  const HD=HEROES[id]||HEROES.lumina; id=HEROES[id]?id:'lumina';   // v3.0 ヒロインの素性
  const gb=Math.min(3,META.gen.battle||0);   // 潜行の日数(0..3 で頭打ち。v2.0 で日数は増え続けるため)
  /* v5.8 弱体化はヒロインごとに積む。ここは生成中で G.B.hero がまだ居ないので、明示的に引く */
  const aArmor=altarLvH('armor',id), aRegen=altarLvH('regen',id), aSpeed=altarLvH('speed',id);
  const aSense=altarLvH('sense',id), aHeat=altarLvH('heat',id), aFocus=altarLvH('focus',id);
  const aStam=altarLvH('stamina',id);
  const LU=(META.lumina&&META.lumina.upg)||{};
  // 抵抗の意志(敗北で固くなる・生き延びると少し緩む)と、世代ごとの素の成長。夜側の強化が行き着いても「全く抵抗できない」には落ちない
  const will=Math.min(BAL.WILL_CAP,(META.lumina&&META.lumina.will)||0);
  const gsc=1+BAL.GEN_SCALE*Math.min(BAL.GEN_CAP,Math.max(0,(META.gen.idx||1)-1));   /* v6.0 頭打ちを世代10→22へ */
  /* v6.0 ★階層ごとのヒロイン倍率。FLOORS には敵側の mon/en しか無く、彼女たちの側の階層倍率が
     一つも無かった——これが「世代が進むと魔核が討てなくなる」の直接の原因(実測: 世代4で49.5%、
     世代12で10.0%しか削れない)。深さは敵味方の両方に掛ける。
     さらに、石段に刻んだ線(二連敗の回数)ぶんだけ、彼女たちは強くなって戻ってくる——
     巻き戻しの外に残る痕が、そのまま強化になる。心臓の側からは、この帳簿は読めない */
  /* ★ここは curFloor() を直に引く。newHero は startBattle が G.B を作る前に走るので、
     G.B.floor を先に見ると「前の戦闘の階」を読んでしまい、階層倍率が一階ぶん遅れる。
     実測で 8階に降りたのに1階の値、15階で8階の値になっていた */
  const HF=(function(){ const F=(typeof curFloor==='function'?curFloor():null); return (F&&F.hero)||{hp:1,dmg:1,stam:1}; })();
  const marks=Math.min(BAL.MARK_CAP,(META.gen&&META.gen.marks)|0);
  const mkHp=1+BAL.MARK_HP*marks, mkDmg=1+BAL.MARK_DMG*marks;
  const h={
    x:0, y:0, vx:0, vy:0, r:10,
    maxHp:Math.round(175*(1+0.18*gb)*(1+0.08*(LU.vital||0))*(1+0.03*will)*gsc*HD.hpMul*HF.hp*mkHp), hp:0,
    armor:Math.max(0, 7 + gb - aArmor + Math.floor((LU.guard||0)*0.5) + HD.armor),
    regen:(0.9+0.15*gb+0.08*(LU.bless||0))*(1-0.3*aRegen)*(HD.regenMul||1),   // v3.1 素性の回復係数
    baseSpeed:154*(1-0.06*aSpeed)*(1+0.02*(LU.swift||0))*HD.spdMul,
    dmgMult:(1+0.06*(LU.zeal||0))*(1+0.02*will)*gsc*(HD.dmgMul||1)*HF.dmg*mkDmg,   // v3.1 素性の火力係数(v6.0 階層倍率と石段の線)
    will, curse:null, curseAmp:0, curseAche:false,     // v1.6 抵抗の意志 / ボス敗北の呪い
    hypnoG:0, hypnoFloor:0, heatG:0, inMusk:false,     // v1.6 催眠ゲージ(呪いの下限) / 発情ゲージ(雲から) / 雄臭の雲の中
    id, name:HD.name, hi:0, out:false, captive:null, assist:null, thanksT:0, seenT:0, lineT:0, lowSaid:false,   // v3.0 素性 / 離脱(捕獲) / 救援 / 個別の台詞タイマー
    zone:'moss', bathT:0, springCd:0, dest:null, destUntil:0, explore:null, exploreUntil:0,   // v1.6 地形マップ
    poolT:0, readT:0, poolKey:null, readKey:null, goal:null, goalT:0, farmT:0, walkT:0,        // v1.8 清水/石碑/目当て
    lantT2:0, lantHeat:0,                                                                     /* v6.6 催淫灯篭で休んでいる時間と、この滞在で溜まった熱 */
    tgtKey:null, tgtBest:0, tgtT:0,                                                              // v2.1 諦めの見張り
    skillCd:(()=>{ const o={}; for(const k in HD.skills) o[k]=0; return o; })(), guardT:0, emberT:0, aiMode:'fight', modeUntil:0, escape:null, dpsEst:20, hesitN:{},   // v2.3 奥義 / 戦闘モード / 地形ごとの迷った回数
    stuckT:0, unstickT:0, path:null, zoneLast:undefined,                                       // v1.7 壁・経路
    level:1, xp:0, xpNeed:need(1),
    wp:(()=>{ const o={}; for(const k in UPG) if(UPG[k].kind==='wp') o[k]=0; for(const k in HD.start) o[k]=Math.min(UPG[k]?UPG[k].max:8, HD.start[k]); return o; })(),   // v3.0 全武器の枠を持ち、自分の武器だけ育つ
    ps:(()=>{ const o={speed:0, vital:0, magnet:0, haste:0, ward:0, growth:0, area:0, dup:0, luck:0, endure:0, reach:0, pierce:0, regen:0};
      for(const k in (HD.startPs||{})) if(o[k]!==undefined) o[k]=HD.startPs[k]; return o; })(),   // v5.0 素性ごとの初期パッシブ(ヤミコは最初から育っている)
    evo:(()=>{ const o={}; for(const k in EVOS) o[k]=0; return o; })(),
    boltT:0.6, novaT:2.5, orbAng:0, novaAnim:0, novaR:0,
    chainT:1.0, spiritT:1.2, shieldPulse:0, shieldR:0, shieldArc:0, shieldAng:0,   // v2.0 新武器
    whipT:1.1, whipAnim:0, whipDir:1, whipSide:1, whipR:0, rainT:2.2, crossT:1.6,
    sanctT:0, sanctPulse:0, bladeT:1.0, thunderT:2.0, holyT:2.4,
    fswordT:1.0, fswordSide:1, fringT:0, fringAng:0, fburstT:3.0, fpillarT:2.2, fwingT:4.5, fwingAnim:0, fwingX:0, fwingY:0,   // v3.0 フレイラの武器
    flameHeat:0, flameT:0,   /* v6.3 前に出て斬り続けるほど溜まる熱。炎の剣と火の輪の両方がこれを読む */
    sticky:0, wipeT:0, wipeCd:0,   /* v6.3b 媚薬のベタベタ。洗うか拭うまで身体に残る */
    ineedleT:0.9, ifieldT:0, ifieldR:0, ibloomT:2.4, iorbitT:0, iorbAng:0,   // v5.0 クウの武器
    iceCd:0, iceBias:null, iceOrb:null, iceEcho:null, echoCd:0, iceBless:0, iceOn:0,
    hype:0, hypeT:0, meltT:0, meltSaid:0, hoarT:0,
    dazeT:0, hypno:null,                 // 催眠電波(v1.1)
    denyT:0, denySrc:null, deepClimax:false, acheCd:2, numbT:0, watchedT:0, gazeCd:6,
    crestLv:0, freezeT:0, frozenAcc:0, suitT:0, suitPulse:0, begT:0, begCd:6, possessCd:0,   // v1.2 状態異常拡張
    denyOver:0, omazuke:0, omazukeT:0, omazukeHold:0, whisperT:0,   /* v6.6 絶頂禁止で溜まった分 / おあずけの回数と停止 / 耳元の囁き */
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
    staminaMax:(BAL.STAMINA_MAX-12*aStam+6*(LU.grit||0)+0.6*will+BAL.MARK_STAM*marks)*(HD.stamMul||1)*HF.stam,   // v5.0 素性のスタミナ倍率(クウは低い)   // v5.7 意志の寄与 1.5→0.6 / v6.0 階層倍率と石段の線
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
  /* v5.8 一夜ぶんの、その子だけの記録。夜明けに META.lifeH[id] へ畳む。
     観測記録も図鑑も「ルミナの帳簿に他の子が書き足す」形だったのを、各人の帳簿に分ける */
  h.recDmg=0; h.recAil=0; h.recKills=0; h.recClimax=0; h.recFilmed=0; h.recBoss=0;
  h.recAilBy={}; h.recCapBy=null; h.recCapCause=null;
  // ボス敗北の呪い(日を跨ぐ): 前の日にボスに負けていれば、その痕が残った身体で始まる
  const cu=(META.curse&&META.curse.left>0&&BOSS_CURSES[META.curse.id])?META.curse.id:null;
  h.curse=cu;
  if(cu==='dreamtree'){ h.sensitFloor+=20; h.sensit=Math.max(h.sensit,h.sensitFloor); h.curseAmp=0.10; }
  if(cu==='bossgazer'){ h.hypnoG=40; h.hypnoFloor=40; }   // 催眠Ⅰが入るまで、ゲージは40より下がらない
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
  /* v6.1 囃されたがり: 気が散らなくなる / 見られ熱: 見られていても手元が狂わない */
  const tz=0.08*Math.min(BAL.IMP_TEASE_CAP,h.teaseN)*(1-0.25*traitLv(h,'impLove'));   /* v6.2 上限が literal の 2 に二重化していて、BAL 側を動かしても効かなかった */
  const fp=h.focusPen*(h.watchedT>0?(1-0.12*traitLv(h,'publicHeat')):1);
  return clamp(1 - aph - fp - tz, 0.25, 1);
}
function heroStat(h){
  let spd=h.baseSpeed*(1+0.10*h.ps.speed);
  spd*=Math.pow(0.72, legCount(h));
  spd*=Math.pow(BAL.SUCK_SLOW, suckCount(h));
  if(h.slow>0) spd*=(h.curse==='slimeking'?0.42:0.55)*(1+0.10*traitLv(h,'slimeMelt'));   /* v6.1 溶ける安堵: 沈んでも足取りが鈍らない */
  if(h.zone==='water' && !onIce(h)) spd*=0.88;   // 浅瀬(v5.0 氷の上なら足を取られない)
  if(h.zone==='ruin') spd*=1.06;    // 石畳
  /* v6.0 新しい床。糸は絡み、胎は沈み、絡めとられている間はほとんど進めない */
  if(h.zone==='silk'  && !onIce(h)) spd*=0.86*(1+0.04*traitLv(h,'attachCalm'));
  if(h.zone==='womb'  && !onIce(h)) spd*=BAL.WOMB_SPD*(1+0.05*traitLv(h,'sinkCalm'));
  if((h.silkHold||0)>0) spd*=0.30;
  if((h.frostHold||0)>0) spd*=0.12;   /* 装束が床に凍りついている間は、ほとんど動けない */
  if(h.zone==='frost' && !onIce(h) && h.id!=='kuu') spd*=1-0.012*Math.min(BAL.FRO_CHILL_CAP,(h.chill||0))*(1-0.25*traitLv(h,'grindhabit'));
  if(onIce(h)) spd*=1+BAL.ICE_ALLY_SPD;   // v5.0 氷の道は速い(ただし曲がりきれない)
  if(h.iceBless>0) spd*=1.30;             // v5.0 静止の一点の加護
  if(h.heatLv>0) spd*=1-0.04*h.heatLv;
  if(h.waveDur>0) spd*=BAL.WAVE_SPD;
  if((h.chokeT||0)>0) spd*=BAL.EVAP_CHOKE_SPD;
  if((h.highT||0)>0) spd*=BAL.HIGH_SPD;        /* v6.6 ハイの間は足が速い(そのぶん危ない所へ踏み込む) */
  if((h.crashT||0)>0) spd*=0.72;              /*      抜けた直後は足がもつれる */   /* ★v6.4b むせながら歩く */
  if(h.exhausted) spd*=0.7;
  if(h.numbT>0) spd*=0.75;        // 痺れ
  if((h.squeeze||0)>0) spd*=1-(1-BAL.BREATH_SPD)*h.squeeze;   /* v6.0f 14階: 壁が寄っている間は走れない */
  if(h.suitT>0) spd*=0.85;        // 触手服
  return { speed:spd, magnet:90+45*h.ps.magnet };
}
const curLv=k=>UPG[k].kind==='wp' ? heroOf(k).wp[k] : G.B.heroes[0].ps[k];   // v3.0 武器は持ち主のヒロイン、パッシブは共通
/* v6.0 その項目のいまの上限。武器だけは深さで開く——★開放が「降りる理由」になる。
   浅い階で Lv9 以上の札を出さないので、育ちすぎも起きない */
function upgMax(k){
  const U=UPG[k]; if(!U) return 8;
  if(U.kind!=='wp') return U.max;
  const F=(G.B&&G.B.floor)||(typeof curFloor==='function'?curFloor():null), d=(F&&F.depth)||1;
  let cap=U.max;
  for(const [need,v] of (BAL.WP_CAP_DEPTH||[])) if(d>=need){ cap=Math.max(cap,v); break; }
  return cap;
}
const areaMult=h=>1+0.10*(h.ps.area||0);      // ひろがるろうそく
const dupN=h=>(h.ps.dup||0)+((h.iceBless>0)?1:0);   // ふたごの鏡(投射+1) / v5.0 静止の一点の加護でもう1発

/* ================= v2.0 編成: ランダム / おまかせ(階層の得意種とカード練度を優先) ================= */
function ownedIds(){ return Object.keys(MONSTERS).filter(id=>!MONSTERS[id].item && !MONSTERS[id].guardian && !MONSTERS[id].variant && !MONSTERS[id].field && META.cards[id] && META.cards[id].owned); }   /* v6.0 熟れた個体と地形産はカードにならない(場にだけ湧く) */
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
/* v6.5 系統の特化。デッキの最多系統を数え、その系統のカードだけCDを縮める。
   deck を渡さなければ META.deck を見る(編成画面の下見と、戦闘中の適用で同じ関数を使う)。
   戻り: {fam, name, n, cut}。fam が null なら効いていない */
function deckFam(deck){
  const d=deck||META.deck||[];
  const cnt={};
  for(const id of d){ const f=famOf(id); if(f) cnt[f]=(cnt[f]||0)+1; }
  let fam=null, n=0;
  for(const f in cnt){ if(cnt[f]>n){ fam=f; n=cnt[f]; } }
  if(!fam || n<BAL.FAM_MIN) return {fam:null, name:'', n:(fam?n:0), cut:0};
  const cut=Math.min(BAL.FAM_MAX, (n-BAL.FAM_MIN+1)*BAL.FAM_STEP);
  return {fam, name:FAMS[fam].name, n, cut};
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
    fam:deckFam(META.deck),   /* v6.5 この戦闘の系統ボーナス(デッキは戦闘中変わらないので一度だけ数える) */
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
    lights:[], lanterns:[], floorLight:0,                                                          // v4.0 暗闇: 残る灯り / 催淫灯篭 / その階で得た灯り
    coreWar:false, core:null,                                                                      // v4.0 魔核戦に入ったか / その個体
    wornSaid:false,                                                                                // v5.0 すり減りの弱音
    bond:false, bondT:0, rings:[],                                                                 // v4.1 家族茸の絆の灯り / 菌輪
    mires:[], dryAura:null, shades:[], yami:null, yamiCap:null,                                                                        // v5.0 媚薬沼 / フレイラの乾燥オーラ
    dry:[], evapT:-99, coreRoots:null,                                                             // v4.0 フレイラが焼いた床(日を跨いで残る) / 媚薬が蒸発した時刻 / 魔核の跡(根→渦)
  };
  genMap();               // 地形(世代×階層で変わる)
  G.B.lanterns=G.map.pois.filter(q=>q.kind==='lantern').map(q=>({x:q.x,y:q.y,key:q.key,said:false}));   // v4.0 催淫灯篭(光源であり罠でもある)
  initSeen();             // v2.4 見た範囲の記憶(同じ階層への再挑戦は覚えている)
  for(let i=1;i<heroes.length;i++){ const q=snapFloor(44*i,8*i,false,4)||{x:44*i,y:8*i}; heroes[i].x=q.x; heroes[i].y=q.y; }   // v3.0 二人目以降は横に並ぶ
  { const F=G.B.floor; G.B.exitLocked=(F.puzzle==='seals');
    if(F.final){ const q=G.map.pois.find(o=>o.kind==='core'); if(q){ spawnUnit('core',q.x,q.y,{}); } }   // v2.0 最終階層: 魔核が待つ
    else spawnSentinels(); }   // v2.1 降り口は石の番兵が守る
  prewarmChunks(0,0);     // 出発点の周りのマップチップを先に焼く
  spawnInitialProps();
  spawnInitialPicks();    // v1.8 地形の資源(光茸・蜜の花・沈んだ宝)
  spawnDen();             // v3.2 巣窟の報酬と仕掛け
  spawnWildShrooms();     // v4.1 洞そのものとして生えている茸(媚茸・抱き茸)
  spawnSeats();           // v6.0f 14階: 待ち手の道に据わるもの
  mimicSwap();            // v6.0f 15階: 一晩目と同じ場所に、同じではないもの
  spawnRings();           // v4.1 菌輪
  spawnMires();           // v5.0 媚薬沼(水溜まりのように点在)
  spawnYamiBoss();        // v5.0 前回の最下層(心臓がどいた後の窪み)で眠っている者(ヤミコの一段目)
  spawnYamiCaptive();     // v5.0 淫魔たちに囲まれている所(救出の一幕)
  dryInit();              // v5.0 焼けた床(タイル単位。前の日の分を復元)
  iceInit();              // v5.0 凍らせた床(前の日の分を復元)
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
    if(!META.run.storySeen.prologue && PRO.length){ lines=PRO.concat(fIntro); META.run.storySeen.prologue=1; if(G.B.heroes.length>1) for(const id of partyIds()) if(id!=='lumina') META.run.storySeen['join_'+id]=1; META.run.storySeen['f'+F.depth]=1; saveMeta(); }   // v3.1 一人で始めたなら合流の朝はまだ
    else if(joinMorning(V30,fIntro,F)){ lines=joinMorning(V30,fIntro,F,true); }   // v3.1 合流の朝(二連敗の後 / 一人で討ち続けた後の変奏)。v5.0 誰の合流かで場面を分ける
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
/* v6.0 深い階ほど場の上限が下がる。空いた枠のぶんは「熟れた個体」が埋める——
   同じ画面の重さで、頭数ではなく格が上がっていく */
function fieldCap(){ const F=(G.B&&G.B.floor)||curFloor(); return Math.round(BAL.FIELD_CAP*(1+BAL.PRESS_CAP*pressure())*fieldCapF(F?F.depth:1)); }

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
  /* v5.8 各人の帳簿へ畳む。誰が何をして、誰が何をされたかを、その子の記録として残す */
  for(const h of B.heroes){
    const L=heroLife(h.id), R=heroRot(h.id);
    L.runs++; R.battles++;
    L.dmg+=Math.round(h.recDmg||0); L.ail+=(h.recAil||0); L.kills+=(h.recKills||0);
    L.climax+=(h.recClimax||0); L.bestClimax=Math.max(L.bestClimax, h.recClimax||0);
    L.filmed+=(h.recFilmed||0); L.herBoss+=(h.recBoss||0);
    for(const k in (h.recAilBy||{})) L.ailBy[k]=(L.ailBy[k]||0)+h.recAilBy[k];
    R.dmg+=Math.round(h.recDmg||0); R.ail+=(h.recAil||0);
    if(h.recCapBy){
      L.captures++; R.captures++; L.streak=0;
      L.capBy[h.recCapBy]=(L.capBy[h.recCapBy]||0)+1;
      L.capCause[h.recCapCause||'hp']=(L.capCause[h.recCapCause||'hp']||0)+1;
      L.will=Math.min(BAL.WILL_CAP, L.will+BAL.WILL_CAP_GAIN+(B.time<60?BAL.WILL_FAST_GAIN:0));   /* 抵抗の意志も各人ぶん */
    }else{ L.survive++; L.streak++; }
  }
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
  iceSave();   // v5.0 焼かれて溶けた分を落として、残っている氷だけを台帳に書き直す
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
    if(META.run.fails>=BAL.RUN_FAILS_RESET){
      /* v6.0 石段に線が一本増える。彼女たちは自分でこれを数えられ、そのぶん強くなって戻ってくる。
         心臓の側からは読めない——巻き戻しの外に残る痕が、そのまま強化の帳簿になる */
      META.gen.marks=((META.gen.marks|0)+1);
      runReset(false); rotReset=true; decay=luminaDecay(); runNote='reset'; }   /* v5.0 彼女たちの側の巻き戻り: 覚えたことは残る */
    else runNote='retry';
  }else if(outcome==='descend'){
    META.run.fails=0; META.run.floor=Math.min(openFloors(),floorBefore+1); META.run.deepest=Math.max(META.run.deepest||1,META.run.floor); runNote='descend';
    if(B.heroes.some(h=>h.out)) META.run.leftBehind=true;   // v3.0 一人を置いて降りた
  }else if(outcome==='clear'){
    META.run.clears=(META.run.clears||0)+1; META.era=(META.era|0)+1; runReset(true); rotReset=true; decay=luminaDecay(); runNote='clear';   // v3.0 深淵が組み替わる(世代+1: 階層が増え、魔核が太る) / v5.0 魔核が巻き戻すので、彼女たちは何も知らない朝に立つ
  }
  // v3.1 参戦の判定: 深淵が一度組み替わった後(世代≥1)に二連敗で入口へ戻された朝、次のヒロインが来る(保険: リセット3回 / 一人のまま世代4)
  yamiAdvance(runNote);   // v5.0 ヤミコの段を進める(眠り → 救出 → 参戦)
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
      :(runNote==='reset'?(((twoP&&V30E.reset)?V30E.reset:STORY.reset).concat((joinId&&V30E.party&&V30E.party.joinHint&&V30E.party.joinHint.length)?[''].concat(V30E.party.joinHint):[])):(outcome==='capture'&&B.captures&&B.captures.length>1?storyIfFits(V30E.party&&V30E.party.bothCaptured):(outcome==='descend'&&B.heroes.some(h=>h.out)?storyIfFits(V30E.party&&V30E.party.leftBehind):null))), newCurse:newCurse?BOSS_CURSES[newCurse.id]:null,   // v3.1 一人版の結末 / 合流の予兆
    loopFx: outcome==='clear'?'vortex':(runNote==='reset'?'miracle':null),   // v4.0 結末の文の後に流す演出(赤黒い渦 / 白い奇跡の光)
    join:joinId?HEROES[joinId].name:null, joinWhy:META.run.joinWhy||'',
    captures:B.captures, leftBehind:B.heroes.filter(h=>h.out).map(h=>h.name),
    carryLv:(META.run.hero&&META.run.hero.level)||0,
    curseGone:(oldCurse&&!META.curse&&!newCurse)?BOSS_CURSES[oldCurse.id]:null});
}

/* v2.0 潜行のリセット: 入口へ戻り、世代が変わる(経験を失う。手記と永続強化は残る)
   v5.0 巻き戻りの向き: 魔核を討たれた時は魔核が時を巻き戻すので、彼女たちの覚えたことは書き換えられる(wipeKnow)。
        彼女たちが捕まって巻き戻る時、巻き戻すのは彼女たちの側——魔核は何も知らないままで、覚えたことはそのまま残る */
function runReset(wipeKnow){
  META.run.floor=1; META.run.fails=0; META.run.day=1; META.run.hero=null; META.run.heroes={}; META.run.seen={}; META.run.bossSeen=false;   // v2.1 引き継ぎも消える / v2.4 見た範囲とボスの記憶も
  META.gen.battle=0; META.gen.idx++;
  META.rot={dmg:0, ail:0, captures:0, battles:0};
  rotHClear();   /* v5.8 各人ぶんの世代内記録も一緒に流す */
  META.gen.fed=0;   /* v6.0 心根が送った身の厚みは、その潜行のあいだだけ */
  if(wipeKnow){ META.gen.know={}; META.gen.zoneKnow={}; META.gen.trapKnow={}; META.gen.dryLesson=0; }   // 魔核が巻き戻した時だけ、覚えたことも書き換えられる(手記に書いた分だけ残る)
  dryClearAll(); iceClearAll();   // v4.0/v5.0 焼いた床も凍らせた床も、巻き戻りで元の洞へ戻る
  { const o=META.run.storySeen||{}; const n={prologue:o.prologue}; for(const k in o) if(k.startsWith('loop')||k.startsWith('join')) n[k]=o[k]; META.run.storySeen=n; }   // 階層の導入はまた出る(序章・合流・世代の朝は出ない)
}
/* v3.1 一日のエッセンスの逓減: 素の合計 x → SOFT·ln(1+x/SOFT)。少ない日はほぼそのまま、多い日は頭打ち気味 */
function essSoft(x,soft){ const S=(soft===undefined?BAL.ESS_SOFT:soft)||0; x=Math.max(0,x||0); return S>0?S*Math.log(1+x/S):x; }   // soft を渡せばオーブにも使える
/* v3.1 参戦: 出撃の並びにヒロインを加え、翌朝の合流の場面(party.join / joinLate)を出す。META.party.joined に記録 */
function partyJoin(id,why){
  if(!HEROES[id]) return false; META.party=META.party||{roster:['lumina'],joined:{},resets:0};
  if(META.party.roster.includes(id) || META.party.roster.length>=PARTY_MAX) return false;
  META.party.roster.push(id); META.party.joined[id]={era:eraNow(), gen:META.gen.idx, runs:META.runs, why:why||''}; META.party.resets=0;
  delete META.run.storySeen['join_'+id]; META.run.joinWho=id; META.run.joinWhy=why||'';   // v5.0 その子の合流の朝は、まだ出ていない
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
  /* ★v6.2 結末は変奏が無いので、居ない子の行だけ落として通す。
     ルミナ＋フレイラで討った朝に、クウとヤミコが喋っていた */
  if(twoP){ const cd=(V&&V.era&&V.era.coreDown&&V.era.coreDown.length)?V.era.coreDown[Math.min(V.era.coreDown.length-1,k)]:[]; return storyKeepFits(cd.concat((V&&V.ending)?V.ending:STORY.ending)); }
  const solo=V&&V.era&&V.era.coreDownSolo; const cs=solo?(k===0?solo.first:(solo.again||solo.first)):null;
  if(cs&&cs.length){ const tail=(k>0 && V.era.endingSoloAgain && V.era.endingSoloAgain.length)?V.era.endingSoloAgain:STORY.ending.slice(1); return cs.concat(tail); }   // 一人版は結末の1行目(光が届いた…)を置き換える。二度目以降は短い結び(街の朝の場面は一度きり)
  return STORY.ending;
}
/* v3.1 組み替わった後の朝: 二人版 loopIntro / 一人版 loopIntroSolo(初回/再び)。無ければ null */
function storyLoopIntro(n){
  const V=(typeof STORY_V30!=='undefined')?STORY_V30:null; if(!V||!V.era) return null;
  if(n>1) return (V.era.loopIntro&&V.era.loopIntro.length)?storyKeepFits(V.era.loopIntro):null;
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
/* v5.8 手記はヒロインごと。誰の身に起きたかで、その子の頁だけが進む。
   META.codex は「party の誰かが知った」総体として残す(一覧の伏せ字と解禁条件に使う) */
function codexOfH(hero,id){
  META.codexH=META.codexH||{};
  const k=hero||'lumina';
  const H=(META.codexH[k]=META.codexH[k]||{});
  if(!H[id]) H[id]={seen:0,met:0,climax:0,capture:0,kills:0};
  return H[id];
}
function codexMark(id,key,n,hero){
  if(!id||!MONSTERS[id]||MONSTERS[id].item) return;
  /* v6.0 熟れた個体は base の欄に合流する。図鑑に「同じ種の濃い個体」が別項目で並ぶと、
     一種を知っていく手記という体裁が壊れる */
  if(MONSTERS[id].base) id=MONSTERS[id].base;
  const c=codexOf(id); c[key]=(c[key]||0)+(n||1);
  const who=hero||((G.B&&G.B.hero)?G.B.hero.id:'lumina');
  const h=codexOfH(who,id); h[key]=(h[key]||0)+(n||1);
  if(key==='met'&&G.B) G.B.recentMet[id]=G.B.time;
}
/* 「何かされた」は種族ごとに1.5秒に1回まで数える */
/* v5.0 話者ごとの声の表(無いキーはルミナの表へ落ちる) */
function linesFor(id){
  if(id==='freila' && typeof LINES_F!=='undefined') return LINES_F;
  if(id==='kuu'    && typeof LINES_K!=='undefined') return LINES_K;
  if(id==='yamiko' && typeof LINES_Y!=='undefined') return LINES_Y;
  return null;
}
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
  const T=linesFor(p.id);
  const txt=(T?lineOf(path,T):lineOf(path))||fallback; if(!txt) return false;
  if(prio<=1){ const ero=p.heatLv>0||p.aphro>=45||restraintCount(p)>0||p.climaxT>0||p.pinned||!!p.charmBind||p.charms.some(c=>c.lv>0); if(ero) return false; }
  B.lineCd[ck]=B.time; heroBubble(p,txt,prio>=2,prio); return true;
}
/* v2.1 諦め: 目標(品・箱・ハート・ジェム・場所・資源。目当ての ref か、その物自体)を GIVEUP_CD 秒のあいだ候補から外す */
const giveUpKey=t=>(t&&typeof t==='object')?(t.ref||t):t;
function gaveUp(t){ const B=G.B; if(!B||!B.giveUp||!t) return false; const u=B.giveUp.get(giveUpKey(t)); return u!==undefined && B.time<u; }
function giveUpOn(t){ const B=G.B; if(!B||!B.giveUp||!t) return;
  if(t.kind==='rescue' || t.kind==='wait' || t.kind==='cover' || (t.out && t.captive)) return;   // v3.2 捕まった仲間だけは諦めない(嫌な地形で足がすくんでも、目当てからは外さない)。v4.0 カバーも
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
  /* v6.2 忘れる従順の代償側。忘れ水で流された分を、覚え直す時に取り返しが早い。
     ★この性癖は刻む場所はあったのに、効きを読む場所が一つも無かった(check_dead.py) */
  const hh=(G.B&&G.B.hero)||null;
  const relearn=hh?0.35*traitLv(hh,'hypnoObey'):0;
  if(kind==='cap') k.cap++; else k.met+=1+relearn;
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
  /* v6.2 null を踏むと落ちる形。いまは輪の中で壊す物が無いので通るが、
     この形は三度落ちているので、参照する側で必ず確かめる */
  for(const sl of attachedSlots(h)){ const a=h.limbs[sl]; const m=a&&a.mon; if(m) ids.add(m.id); }
  for(const sl of suckSlots(h)){ const a=h.suckers[sl]; const m=a&&a.mon; if(m) ids.add(m.id); }
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
    const ap=B.hero; if(ap){ ap.recAil=(ap.recAil||0)+1; ap.recAilBy=ap.recAilBy||{}; ap.recAilBy[type]=(ap.recAilBy[type]||0)+1; }   /* v5.8 その子の帳簿にも */
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
  if((h.omazukeT||0)>0 && amount>0) return;    /* v6.6 女王のおあずけ: 責めそのものが一瞬止まる */
  if((h.whisperT||0)>0) amount*=BAL.DEMON_WHISPER;   /* v6.6 小淫魔が耳元で囁いている */
  if(h.refractT>0) amount*=BAL.REFRACT_MULT;   // 不応期: 達した直後は入りが鈍い
  amount*=1+BAL.CREST_AMP*(h.crestLv||0);      // 淫紋: 入りが増す
  /* v6.0 床に灯した紋は、そのまま淫紋の濃さとして全ての入りに効く */
  amount*=1+BAL.GLY_PLE*glyphStage();
  /* v6.0 刻まれた性癖のぶん。増えるのは入りだけで、戦力は減らない */
  amount*=1+0.06*(traitLv(h,'exhibit')+traitLv(h,'sigilJoy')+traitLv(h,'attachCalm')+traitLv(h,'bareHabit')+traitLv(h,'sinkCalm')+traitLv(h,'defyBliss'));
  /* v6.1 履歴が刻んだ性癖のうち、いまの場面に噛み合うものだけ */
  amount*=1+0.055*traitAmp(h);
  amount*=1+(h.curseAmp||0);                    // 呪い『樹液の余熱』
  amount*=1+(h.tallyAmp||0);                    /* v6.0 帳の番に刻まれた分だけ、次が効く */
  if(h.watchedT>0) amount*=1+BAL.WATCH_AMP;    // 視姦: 見られていると熱が逃げない
  if(h.freezeT>0){ h.frozenAcc+=amount; return; }   // 時間停止: 止まっている間は溜まるだけ
  const before=h.aphro;
  h.aphro=clamp(h.aphro+amount*h.sense*(1+BAL.SENSIT_AMP*sensLvOf(h)),0,100);
  /* v5.7 連続絶頂: 達している最中も弄られ続ければ、また100に届く。
     届くたびに硬直が伸び、重なるほどスタミナを持っていく。
     絶頂が「済んだこと」ではなく「まだ続いていること」になる */
  if(h.climaxT>0 && h.aphro>=100 && (h.chainN||0)<BAL.CHAIN_MAX && amount>0){
    h.chainN=(h.chainN||0)+1;
    h.aphro=BAL.CHAIN_RESET;
    h.climaxT+=BAL.CLIMAX_DUR*BAL.CHAIN_DUR_K;
    h.stamina=Math.max(0,h.stamina-BAL.CLIMAX_STAM_COST*(1+BAL.CHAIN_COST_K*h.chainN));
    h.worn=(h.worn||0)+BAL.WORN_CLIMAX*0.6;
    G.B.climaxN++; awardAil('climax');
    floatTxt(h.x,h.y-64,'連続絶頂 ×'+(h.chainN+1),'#ff5d9e',13,1.2);
    heroBubble(h,pickRand(['また、きて……とまって、とまってっ……','おわって、ない、のに……ぁ、ま、た……','むり、これ、むり……つづけて、こない、で……'])+'',true,3);
    parts(h.x,h.y-18,14,['#ff9ec2','#ff5d9e','#fff'],150,0.7);
    S.charm(); G.shake=Math.min(9,G.shake+3);
    checkStaminaCollapse();
    if(G.mode!=='battle'&&G.mode!=='levelup') return;
  }
  /* v6.6 おあずけ(状態): 女王が見張っている間は、100に届いても絶頂させてもらえない。
     届くたびに「おあずけ」が一つ増え、責めが一瞬止まり、彼女はねだるようになる。
     ★最初は「一回ごとの出来事」として書いたが、実測で aphro を戻した2秒後に達してしまい、
       回数が二つ以上積まれなかった。堰き止め続ける形でなければ成立しない。 */
  if((h.omazukeHold||0)>0 && h.climaxT<=0){
    if(h.aphro>=100){ h.aphro=99; omazukeEdge(); }
    return;
  }
  if(h.denyT>0){
    /* 絶頂禁止: 99で栓をされる。★溢れた分は身体に溜まる——v6.6 まで、この溜めは
       コメントに書いてあるだけで実装が無く、超過分はそのまま捨てられていた */
    if(h.aphro>=99){
      const over=Math.max(0,(before+amount*h.sense*(1+BAL.SENSIT_AMP*sensLvOf(h)))-99);
      h.aphro=99;
      h.denyOver=Math.min(BAL.DENY_OVER_MAX,(h.denyOver||0)+over);
      if(before>=99 && amount>0 && Math.random()<0.25) heroBubble(h,pickRand(['いか、せて……ちがう、いかせないで……','とまってる、のに……あつい、のが……','ぬけない……なんで、いけな……']),false,3);
    }
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
  markTrait(h,'edgeweak',1);   /* v6.1 栓をされた回数が『焦らし弱』になる */
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
  /* v6.6 栓を抜かれると、溜めた分がまとめて来る。★係数は控えめ(DENY_OVER_STAM 0.055)——
     いまでもスタミナは十分に削れやすいので、溜めた分をそのまま削りにすると即死する */
  const over=h.denyOver||0; h.denyOver=0;
  if(over>4){
    const cost=over*BAL.DENY_OVER_STAM;
    h.stamina=Math.max(0,h.stamina-cost);
    floatTxt(h.x,h.y-72,'溜まっていた分 −'+cost.toFixed(0),'#ff5d9e',12,1.3);
  }
  if(h.aphro>=BAL.DENY_DEEP_TH && h.climaxT<=0){
    h.deepClimax=true;
    h.aphro=100;
    heroBubble(h,'——ぬ、けた……あ、あ、まって、これ、ふかい——っ!',true,3);
    enterClimax();
  }else heroBubble(h,'……はぁ、はぁ……なに、いまの……',false,2);
  h.denySrc=null;
}
/* v6.6 おあずけ(夢魔の女王)。絶頂禁止(deny)とは別物:
   栓をして溜めさせるのではなく、責めを一瞬だけ止めて絶頂の寸前で引き戻す。
   繰り返されるほど彼女はねだるようになり、女王が満足したら——イかせてもらえる。 */
function applyOmazuke(src){
  const B=G.B, h=B.hero;
  if(h.climaxT>0 || h.denyT>0) return false;
  h.omazukeHold=BAL.OMAZUKE_HOLD_T;      /* 女王が見張っている間だけ続く(離れれば切れる) */
  if(src) codexMet(src.id);
  if(h.aphro>=100){ h.aphro=99; omazukeEdge(); return true; }
  return true;
}
/* 100に届いた瞬間、寸前で止められる */
function omazukeEdge(){
  const B=G.B, h=B.hero;
  h.omazuke=(h.omazuke||0)+1;
  h.omazukeT=BAL.OMAZUKE_HOLD;           /* 責めが一瞬止まる */
  awardAil('omazuke');
  markTrait(h,'edgeweak',1);             /* 焦らし弱は、おあずけでも刻まれる */
  h.begCd=0;                             /* 次のおねだりがすぐ来る */
  B.nOmazuke=(B.nOmazuke||0)+1;
  if(h.omazuke>=BAL.OMAZUKE_NEED){
    /* 三度ねだらせて、女王は満足した。許しが出る */
    h.omazuke=0; h.omazukeT=0; h.omazukeHold=0;
    heroBubble(h,pickRand(['い……いかせて、ください……っ','おねがい、もう……いかせて……','ゆるして……いかせて、ほし……']),true,3);
    floatTxt(h.x,h.y-78,'——許された','#ffd76a',13,1.5);
    h.aphro=100; enterClimax();
  }else{
    heroBubble(h,pickRand(['……なん、で……とめ、るの……','あと、すこし……だったのに……','やだ、やだ……とめない、で……']),true,3);
    floatTxt(h.x,h.y-72,'おあずけ ×'+h.omazuke,'#ffb3cf',12,1.3);
    parts(h.x,h.y-10,10,['#ffb3cf','#fff'],90,0.6);
    sfx(520,240,0.28,'sine',0.05);
  }
}
/* ================= 絶頂 =================
   快感100で絶頂。脚が止まり、痙攣して動けない。終わると発情が一段深まる */
function enterClimax(){
  const B=G.B, h=B.hero;
  if(h.climaxT>0) return;
  h.chainN=0;   /* v5.7 重なりの数え直し */
  h.climaxT=BAL.CLIMAX_DUR*(h.deepClimax?BAL.DEEP_MULT:1);
  h.climaxPhase=0;
  h.vx=0; h.vy=0;
  h.squirted=h.deepClimax||Math.random()<Math.min(0.95, BAL.SQUIRT_BASE+0.2*h.heatLv+0.12*sensLvOf(h));
  // 見られながらの絶頂は「撮影」される
  if(h.watchedT>0){ B.filmed++; META.life.filmed=(META.life.filmed||0)+1; h.recFilmed=(h.recFilmed||0)+1; codexMark('eye','climax'); floatTxt(h.x,h.y-70,'撮影された','#c98cff',11,1.4); }
  B.climaxN++; h.recClimax=(h.recClimax||0)+1; h.worn=(h.worn||0)+BAL.WORN_CLIMAX;   // v5.0 何度も達させられるほど、切り上げたくなる
  codexClimax();
  if(h.inMusk && h.heatLv>0 && h.muskCond>=8) conditionMusk();   // 雄臭の雲の中、発情したまま達すると匂いと結びつく
  heroBubble(h,'や、だめ、いま……きちゃ……あ、ぁあああっ——!',true,3);
  if(B.climaxN===1) setBanner('絶頂','ルミナは立っていられない','#ff5d9e');
  if(!h.pinned && !h.charmBind){
    B.pinScene=sceneForHero(B.hero,'climax','default'); B.pinSceneHi=B.ci;
    recordScene(B.hero.id,'climax','default');   /* v6.5 図鑑で読み返せるように */
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
    h.refractT=BAL.REFRACT_T*(1-0.12*traitLv(h,'squirthabit'));   /* v6.1 決壊癖: 立ち直りが速い */
    markTrait(h,'squirthabit',1);
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
  const h=G.B.hero, now=G.B.time;
  const order = armsOnly ? shuffle(['armL','armR']) : ((kind==='tether'||legFirst) ? ['legL','legR','armL','armR'] : shuffle(LIMBS.slice()));
  /* v6.2 振りほどいたばかりの肢は、猶予のあいだ取らせない。
     ★空いていても取らせない——ここを通すと再拘束の輪が戻る */
  const F=h.limbFree||{};
  for(const s of order){ if(!h.limbs[s] && !((F[s]||0)>now)) return s; }
  return null;
}
function attachMonster(mon, kind, opt){
  const B=G.B, h=B.hero;
  opt=opt||{};
  const slot=freeSlotFor(kind, opt.legFirst, opt.armsOnly);
  if(!slot) return false;
  /* v5.6 注意力が残っていれば、掴みをかわせる。
     発情・波・焦らしで heroFocus が落ちるほど掴まれる——「余裕が無いから取られる」を数値にする。
     加えて、一度やられて覚えた相手(knowLv)の手は見えるので、その分だけ余分にかわす。
     押し倒されている時と、絶頂・時間停止の最中はかわせない(そもそも余裕が無い)。 */
  if(!h.pinned && h.climaxT<=0 && h.freezeT<=0 && !opt.noDodge){
    const f=heroFocus(h);
    let ev=BAL.FOCUS_DODGE*Math.max(0,(f-0.45)/0.55) + BAL.KNOW_DODGE*knowLv(mon.id);
    ev=Math.min(BAL.DODGE_MAX, ev)*(1-0.25*h.hypnoLv);   /* 催眠が入っているほど、見えていても避けられない */
    if(ev>0 && Math.random()<ev){
      mon.stun=Math.max(mon.stun||0,0.45); mon.grabCd=Math.max(mon.grabCd||0,0.9);
      floatTxt(h.x,h.y-46,'かわした','#8fd3ff',11,0.7);
      learn(mon.id,'dodge');
      return false;
    }
  }
  const needBase=(kind==='tether'?BAL.RIP_NEED_TETHER:BAL.RIP_NEED_CLING)*(opt.needMul||1);
  const need=needBase/(1+0.12*(h.resist.bound||0));
  h.limbs[slot]={mon, kind, need, r:opt.r||0, t:B.time};
  mon.state='attached'; mon.ti=G.B.ci; mon.limb=slot; mon.stun=0;
  codexMet(mon.id);
  h.resist.bound=(h.resist.bound||0)+1;
  /* v6.1 覚えたはずの罠に、もう一度掛かった。忘れ潟(13階)はこれを量産する */
  if(TRAP_SPECIES.has(mon.id)){ const TK=(META.gen&&META.gen.trapKnow)||{};
    if(TK.ring||TK.rune||TK.hollow||TK.mire||knowLv(mon.id)>=1) markTrait(h,'anticip',1); }
  heroBubble(h, pickRand(['からみついてる…っ!','はなれてっ…!','やだ、脚に…っ!']), true, 2);
  S.bind();
  parts(h.x,h.y-14,10,['#c98cff','#8458d8'],110,0.5);
  awardAil('bound');
  // スタミナが削れた状態での拘束 → 押し倒し
  /* v6.3 押し倒しの敷居は「絶対値」と「最大値の割合」の低い方。浅い階だけが緩む(BAL の注記を参照) */
  if(!h.pinned && h.stamina<Math.min(BAL.PIN_STAMINA_TH, h.staminaMax*BAL.PIN_STAMINA_FRAC)){
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
  /* v6.2 振りほどいた肢は、しばらく取られない。これが無いと、触手が複数ある相手
     (沼の縁など)で「剥がす→即つく→剥がれない」の輪に入って抜けられなくなる */
  (h.limbFree=h.limbFree||{})[slot]=(G.B?G.B.time:0)+BAL.REGRAB_GRACE;
  const mon=at.mon;
  if(mon && !mon.dead){
    // 同じ個体が別の肢も掴んでいる(粘獣王の呑み込みなど)なら、まだ離れない
    const heldSlot=LIMBS.find(sl=>sl!==slot && h.limbs[sl] && h.limbs[sl].mon===mon);
    if(heldSlot){ mon.limb=heldSlot; }
    else{
      mon.state = mon.id==='flower' ? 'open' : (isSeated(mon.id) ? 'idle' : 'chase');
      mon.limb=null;
      const p=limbAnchor(h,slot);
      if(!isSeated(mon.id)){   // 据わった個体はその場から動かない(v5.0 沼の触手は沼から生えている)
        mon.x=p.x+rand(-8,8); mon.y=p.y+rand(-4,4);
      }
    }
    if(opt.fling){
      mon.stun=1.2;
      mon.hp-=mon.maxHp*(mon.id==='core'?BAL.CORE_FLING:(mon.id==='sentinel'?0.08:(mon.boss?0.05:0.35)));   // ボスは振りほどかれても大きくは削れない(呑み込みで自滅しない)。v2.2 魔核は0.5%(根を千切っても心臓は削れない)、番兵は8%
      const a=rand(TAU);
      if(MONSTERS[mon.id] && MONSTERS[mon.id].spd>0){ mon.x+=Math.cos(a)*30; mon.y+=Math.sin(a)*30; collideMap(mon,mon.r*0.75,canFly(mon.id)); }   // 据わった個体(魔核・口・沼の触手)は飛ばされない
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
  amount*=(1+0.02*(hh.will||0));
  /* v6.0 「抗いの悦び」は戦力を削らない。もがきの力そのものも上がる */
  amount*=1+0.06*traitLv(hh,'defyBliss')+0.05*traitLv(hh,'attachCalm');
  /* v6.1 されてきたことへの慣れ。入りが増えるぶん、抜ける手際も上がる */
  amount*=1+0.05*traitFree(hh);
  /* v6.0 苔(に見えるもの): 出した力を、そのぶんの快感に変える。抗うほど深く軋む */
  shamSoak(hh, amount*BAL.SHAM_STRUG);
  /* v6.0 時の澱: 手は動いているのに、届くのが半拍おそい。快感の側は一拍も遅れない */
  if(stallPush(hh, amount)) return;
  struggleRaw(hh, amount);
}
function struggleRaw(hh, amount){
  const h=G.B.hero;
  if(restraintCount(h)===0||h.pinned||h.charmBind) return;
  if(h.stamina<=0||h.climaxT>0) return;
  /* v6.0 灯した紋の段だけ、拘束が抜けにくくなる(淫紋が濃いほど手が離れない) */
  h.struggle+=amount*(h.heatLv>0?1-0.1*h.heatLv:1)*(1-BAL.GLY_HOLD*glyphStage())*(1-(h.silkRip||0));
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
/* ================= v6.2 「えいっ」= スタミナを払う脱出 =================
   全身を取られた時と、押し倒されて時間が経った時に、一度だけ大きく力を使う。
   ★成功が保証されない。失敗するとスタミナだけ失って、空振りした力が熱になって返る。
   成功率は「取られている本数」と「どこまで堕ちているか」で決まる——
   深いほど下がるが BURST_MIN より下がらない(どれだけ深くても、まだ望みはある) */
function burstChance(h){
  const fall=Math.min(1, (h.aphro/100)*0.45 + Math.min(1,(h.sensit||0)/100)*0.30 + (h.hypnoLv||0)/3*0.25);
  let c=BAL.BURST_BASE - BAL.BURST_PER_LIMB*restraintCount(h) - BAL.BURST_FALL*fall;
  c*=heroFocus(h);                       /* 余裕が無いほど、力の入れどころを外す */
  c*=1+0.02*(h.will||0);                 /* 負けを重ねた分だけ、底で手が動く */
  return clamp(c, BAL.BURST_MIN, 0.95);
}
/* 押し倒されている時は安く払える。高いままだと、押し倒しの条件(スタミナ35未満)と
   噛み合わずに一度も撃てない。実測で確かめた */
function burstCost(h){ return h.pinned ? BAL.BURST_STAM_PIN : BAL.BURST_STAM; }
function burstReady(h){
  const B=G.B; if(!B||h.out) return false;
  if((h.burstCd||0)>B.time) return false;
  if(h.stamina < h.staminaMax*burstCost(h)) return false;
  if(h.freezeT>0 || h.climaxT>0) return false;      /* 止まっている間・達している間は力が入らない */
  if(h.hypnoLv>=3) return false;                     /* 催眠Ⅲ: 抗うという考えが浮かばない */
  const held=restraintCount(h);
  return held>=BAL.BURST_LIMB_TH || (h.pinned && (B.time-(h.pinAt||B.time))>=BAL.BURST_HOLD_TH);
}
function tryBurst(h){
  const B=G.B;
  h.burstCd=B.time+BAL.BURST_CD;
  h.stamina=Math.max(0, h.stamina - h.staminaMax*burstCost(h));
  const ok=Math.random()<burstChance(h);
  if(ok){
    for(const sl of attachedSlots(h)) detachLimb(sl,{fling:true});
    for(const sl of suckSlots(h)) detachSucker(sl,{fling:true});
    if(h.pinned){ h.pinned=false; h.pinBy=null; h.pinEscape=0; h.struggle=0; if(B.pinSceneHi===B.ci) B.pinScene=null; }
    h.silkHold=0; h.frostHold=0;
    h.ifr=Math.max(h.ifr||0, 0.5);
    setBanner(h.name+'が振りほどいた','スタミナを使い切って、一息に','#8fd3ff');
    heroBubble(h,{lumina:'……えいっ!', freila:'——どけ!', kuu:'……いま', yamiko:'離れなっ!'}[h.id]||'えいっ!',true,1.6);
    parts(h.x,h.y-14,26,['#fff','#8fd3ff'],200,0.7); G.shake=Math.min(7,(G.shake||0)+4);
  }else{
    /* ★空振り。出した力はそのまま熱になって返る——苔もどきと同じ理屈 */
    applySensit(BAL.BURST_FAIL_SENS);
    if(typeof shamSoak==='function') shamSoak(h, 6);
    setBanner(h.name+'は振りほどけなかった','力だけが抜けていく','#ff7aa2');
    heroBubble(h,{lumina:'……っ、ぬけ、ない……!', freila:'……っ、外れない', kuu:'……足りない', yamiko:'……っ、まだ、か'}[h.id]||'……っ',true,1.6);
    parts(h.x,h.y-14,12,['#ff9ec2','#fff'],120,0.5);
  }
  checkStaminaCollapse();
  return ok;
}
function burstTick(h,dt){
  if(!burstReady(h)) return;
  tryBurst(h);
}
/* --- 押し倒し --- */
function enterPin(mon){
  const B=G.B, h=B.hero;
  if(h.charmBind) releaseCharmBind(false);   // 押し倒しは魅了拘束を上書きする
  h.pinned=true; h.pinBy=mon||null; h.worn=(h.worn||0)+BAL.WORN_PIN;   // v5.0 押し倒された分の摩耗
  h.pinT=BAL.PIN_PULSE_T; h.pinEscape=0;
  h.pinAt=B.time;   /* v6.2 いつ押し倒されたか(「えいっ」の長時間判定に使う) */
  markTrait(h,'loser',1);   /* v6.1 押し倒された回数が『負け癖』になる */
  h.vx=0; h.vy=0;
  let sid=mon?mon.id:'default';
  { const lh=h.lastHypno;   // 催眠Ⅱ以上で押し倒された時は、催眠の源(ゲイザー)の場面——抵抗しなかった理由はそこにある
    if(h.hypnoLv>=2 && lh && B.time-lh.t<25 && SCENES.pin[lh.id] && !(mon&&mon.boss)) sid=lh.id; }
  B.pinScene=sceneForHero(h,'pin', sid); B.pinSceneHi=B.ci;   // v3.0 押し倒された子の声で
  recordScene(h.id,'pin',sid);   /* v6.5 図鑑で読み返せるように */
  B.pinSceneIdx=0; B.pinSceneT=0;
  setBanner(h.name+'が押し倒された!','もがいて逃れろ——スタミナかHPが尽きれば敗北','#ff5d7a');
  heroBubble(h,{freila:'……っ、どけ!', kuu:'……のいて', yamiko:'……離れなさい。いま'}[h.id]||'はなれて……っ!',true,2);
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
    h.pinEscape+=BAL.PIN_ESCAPE_GAIN*(h.heatLv>0?1-0.1*h.heatLv:1)*(h.climaxT>0?0.25:1)*(h.hypnoLv>=3?0.02*(h.will||0):(h.hypnoLv>=2?0.35+0.01*(h.will||0):1))*(1+0.02*(h.will||0))*rand(0.85,1.15);   // 催眠Ⅱ+: もがかない(意志の分だけ残る)
    applyPleasure(BAL.PLEAS_PIN);
    parts(h.x+rand(-10,10),h.y-rand(4,22),3,['#fff','#c98cff'],90,0.4);
    // 絡みつき中のモンスターがじわじわ削る(貫通)
    /* v5.6 スロットの一覧は先に取るので、ループの途中で肢が外れることがある——
       hurtHero が捕獲を起こして limbs が空になる / 撃たれて剥がれる、など。
       その時に h.limbs[sl] が null になっていて落ちていた。毎回引き直して確かめる。
       dmg を持たない個体(沼の触手のような、地形から生えている物)は 0 として扱う */
    for(const sl of attachedSlots(h)){
      const at=h.limbs[sl]; if(!at) continue;
      const m=at.mon;
      if(m&&!m.dead) hurtHero(Math.max(0.6,(m.dmg||0)*0.3), m, {pierce:true, quiet:true, noKb:true});
      if(G.mode!=='battle'&&G.mode!=='levelup') return;
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
  recordScene(B.hero.id,'charmbind',mon.id);   /* v6.5 図鑑で読み返せるように */
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
  const gain=BAL.HYPNO_GAIN[Math.min(2,h.hypnoLv)]*Math.max(0.45,1-BAL.HYPNO_WILL_K*(h.will||0))
    *(1+0.12*traitLv(h,'hypnoObey'));   /* v5.7 意志で鈍るのは残すが、下限を置く(以前は意志50で×0.25まで落ち、Ⅲが原理上届かなかった) / v6.2 忘れる従順の分だけ深く入る */
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
/* v6.0 性癖の汎用の刻み口。musk と同じ作法(その子の手記に書き、共通の印も上げる)。
   n は「あと何ぶん積んだか」で、TRAITS[key].need に届くごとに一段上がる */
/* ================= v6.1 履歴が刻む性癖(16件) =================
   ★上の8件が「床が刻むもの」なのに対し、こちらは「されてきたことが刻むもの」。
   ★applyPleasure に一律で足さない。一律にすると「何に刻まれたか」が消えて、
     ただの快感倍率になる——traitAmp が、いまの場面に噛み合う性癖だけを拾う。
   ★どれも戦力を減らさない。入りが増え、同じ責めへの慣れ(振りほどき・立ち直り)も増える。 */
const TRAIT_ENGULF=new Set(['slime','slimeking','mistslime','hugcap','seatflesh']);
const TRAIT_MOUTH =new Set(['mouth','echoer','slugqueen']);
const TRAIT_URN   =new Set(['pot']);
const TRAIT_DRAIN =new Set(['leech','heartroot']);
/* v6.2 雄臭を放つ種。雲の中に居る時間だけを見ると、実測で 0.53秒/戦
   (しかも熱を持ったまま雲の中に居た時間は 0秒)で、条件が立たない。
   彼女は雲を避けるので当然だった。v6.1 で他の性癖に入れたのと同じ形——
   「その相手の間合いに居て、かつ熱がある」まで広げる */
const TRAIT_MUSK  =new Set(['goblin','gobking']);
/* いま四肢を取っている相手 */
function binderMons(h){
  const out=[];
  for(const sl of attachedSlots(h)){ const a=h.limbs[sl]; const m=a&&a.mon; if(m&&m.id) out.push(m); }
  return out;
}
/* いまの状況に噛み合う性癖の段の合計 */
function traitAmp(h){
  if(!h) return 0;
  let n=0;
  if(h.pinned)              n+=traitLv(h,'loser');
  if(attachCount(h)>=3)     n+=traitLv(h,'bindhabit');
  if(h.denyT>0)             n+=traitLv(h,'edgeweak');
  if(h.climaxT>0)           n+=traitLv(h,'squirthabit');
  if(h.watchedT>0)          n+=traitLv(h,'publicHeat');
  if(suckCount(h)>0)        n+=traitLv(h,'drainBliss');
  if(h.slow>0)              n+=traitLv(h,'slimeMelt');
  if((h.teaseN||0)>0)       n+=traitLv(h,'impLove');
  if(h.hp<h.maxHp*0.55)     n+=traitLv(h,'mazoCore');
  if(h.hypnoLv>=1||h.suitT>0||h.dazeT>0||h.freezeT>0) n+=traitLv(h,'rhythmSub');
  if(sensLvOf(h)>=2)        n+=traitLv(h,'nippleHeat');
  const B=binderMons(h);
  if(B.length){
    if(B.some(m=>MONSTERS[m.id]&&MONSTERS[m.id].spd<=0)) n+=traitLv(h,'waitfall');
    if(B.some(m=>TRAIT_ENGULF.has(m.id)))                n+=traitLv(h,'engulfCalm');
    if(B.some(m=>TRAIT_MOUTH.has(m.id)))                 n+=traitLv(h,'mouthhabit');
    if(B.some(m=>TRAIT_URN.has(m.id)))                   n+=traitLv(h,'urnHabit');
    const TK=(META.gen&&META.gen.trapKnow)||{};
    if(B.some(m=>TRAP_SPECIES.has(m.id)) && (TK.ring||TK.rune||TK.hollow||TK.mire)) n+=traitLv(h,'anticip');
  }
  return n;
}
/* 同じ責めへの慣れ。もがきの力に乗る(戦力は減らさない、という決まりの裏側) */
function traitFree(h){
  if(!h) return 0;
  let n=0;
  if(h.pinned)          n+=traitLv(h,'loser');
  if(attachCount(h)>=3) n+=traitLv(h,'bindhabit');
  const B=binderMons(h);
  if(B.length){
    if(B.some(m=>MONSTERS[m.id]&&MONSTERS[m.id].spd<=0)) n+=traitLv(h,'waitfall');
    if(B.some(m=>TRAIT_ENGULF.has(m.id)))                n+=traitLv(h,'engulfCalm');
    if(B.some(m=>TRAIT_MOUTH.has(m.id)))                 n+=traitLv(h,'mouthhabit');
    if(B.some(m=>TRAIT_URN.has(m.id)))                   n+=traitLv(h,'urnHabit');
    if(B.some(m=>TRAP_SPECIES.has(m.id)))                n+=traitLv(h,'anticip');
  }
  if(suckCount(h)>0) n+=traitLv(h,'drainBliss');
  return n;
}
/* 刻み口。秒で貯まるものはここ、出来事で貯まるものは起きた場所で刻む */
/* v6.2 雄臭を放つ相手が間合いに居るか。臭いの雲そのものより広く取る
   (雲は小さく短命で、彼女は避ける。それでも「臭いのする所に居た」ことは同じ) */
function nearMusk(h){
  const B=G.B; if(!B) return false;
  for(const e of B.enemies){ if(e.dead||e.dormant||!TRAIT_MUSK.has(e.id)) continue;
    if(Math.hypot(e.x-h.x,e.y-h.y) < BAL.MUSK_R*2.6) return true; }
  return false;
}
function traitTick(h,dt){
  const B=G.B; if(!B||!h||h.out) return;
  const T=h.trT=h.trT||{};
  const sec=(k,cond,per)=>{ if(!cond){ return; } T[k]=(T[k]||0)+dt; if(T[k]>=per){ T[k]-=per; markTrait(h,k,1); } };
  /* ★閾値は実測から。110戦で条件が何秒成立したかを測って決めてある(run_traitcond61.js):
     待ち堕ち 24.0秒/戦・尖りの熱 23.5・見られ熱 9.4・溶ける 9.0・拘束癖 6.7・囃され 2.0。
     測らずに書いた最初の版は 25件中11件しか刻まれなかった */
  const BD=binderMons(h);
  sec('publicHeat',  h.watchedT>0,                      7);
  sec('slimeMelt',   h.slow>0,                          8);
  sec('bindhabit',   attachCount(h)>=3,                 5);
  sec('waitfall',    BD.some(m=>MONSTERS[m.id]&&MONSTERS[m.id].spd<=0), 12);
  sec('nippleHeat',  sensLvOf(h)>=2,                   14);
  sec('impLove',     (h.teaseN||0)>0,                   3);
  /* ★v6.2 雄臭だけ、刻む場所が一つも無かった。25件のうちこれだけ、
     読む側(heroLife(h.id).traits.musk で効きが増す)はあるのに書く側が無く、
     一生 0 のままだった。定義を数えるだけでは見つからない——
     『刻む場所があるか』を鍵ごとに突き合わせて出た穴。
     条件は how のとおり「発情したまま、臭いの雲の中」 */
  sec('musk',        (h.inMusk || nearMusk(h)) && h.heatLv>0, 6);
  /* ★ここから下は「閾値が厳しい」のではなく、条件そのものが成立しなかった組。
     110戦で 0〜2秒しか立たなかったので、種を取られている時だけ、から
     「その相手の間合いに居て、かつ取られている」まで広げる */
  const near=(set,r)=>{ const B2=G.B; if(!B2) return false;
    for(const e of B2.enemies){ if(e.dead||!set.has(e.id)) continue;
      if(Math.hypot(e.x-h.x,e.y-h.y)<r) return true; } return false; };
  const held=attachCount(h)>0||suckCount(h)>0||h.pinned;
  sec('drainBliss',  suckCount(h)>0 || (held&&BD.some(m=>m.id==='heartroot')) || (held&&near(TRAIT_DRAIN,190)), 6);
  sec('engulfCalm',  BD.some(m=>TRAIT_ENGULF.has(m.id)) || (held&&near(TRAIT_ENGULF,190)),                     6);
  sec('mouthhabit',  BD.some(m=>TRAIT_MOUTH.has(m.id))  || (held&&near(TRAIT_MOUTH,190)),                      5);
  sec('urnHabit',    BD.some(m=>TRAIT_URN.has(m.id))    || (held&&near(TRAIT_URN,190)),                        5);
  /* ★体力4割は一度も成立しなかった(その前に押し倒されるか、健康なままか)。5割5分に緩める */
  sec('mazoCore',    h.hp<h.maxHp*0.55 && !h.pinned,    7);
  /* ★h.hypno は「電波の源」の入れ物で、掛かっている間の印ではなかった。掛かり具合を見る */
  sec('rhythmSub',   (h.hypnoLv>=1||h.suitT>0||h.dazeT>0||h.freezeT>0), 7);
}
function markTrait(h,key,n){
  const T=TRAITS[key]; if(!T||!h) return;
  const HL=heroLife(h.id); HL.traits=HL.traits||{};
  const need=T.need||3;
  HL.traitP=HL.traitP||{};
  HL.traitP[key]=(HL.traitP[key]||0)+(n||1);
  const lv=Math.min(T.max, Math.floor(HL.traitP[key]/need));
  if(lv<=(HL.traits[key]||0)) return;
  HL.traits[key]=lv;
  META.traits[key]=Math.max(META.traits[key]||0, lv);
  setBanner('性癖が刻まれた — '+T.name+' '+ROMANS[lv], T.desc.split('。')[0], '#ff9ec2');
  awardAil('trait');
}
/* 刻まれた段(その子のぶん)。快感の入りと、同じ責めへの慣れの両方に効く */
function traitLv(h,key){ if(!h) return 0; const HL=heroLife(h.id); return ((HL&&HL.traits)?HL.traits[key]:0)|0; }
function conditionMusk(){
  const B=G.B, h=B.hero;
  if(h.muskDone) return;
  h.muskDone=true;
  /* v5.8 性癖もその子のもの。共通の META.traits は「誰かに刻まれた」印として残す(表示の後方互換) */
  const HL=heroLife(h.id);
  const lv=Math.min(TRAITS.musk.max,(HL.traits.musk||0)+1);
  if(lv===(HL.traits.musk||0)) return;
  HL.traits.musk=lv;
  META.traits.musk=Math.max(META.traits.musk||0, lv);
  setBanner('性癖が刻まれた — '+TRAITS.musk.name+' '+ROMANS[lv], '雄の臭いと快感が、結びついてしまった', '#8fd36a');
  heroBubble(h,pickRand(['……くさい。くさい、はず、なのに……','この、におい……なんで、あつく……']),true,3);
  awardAil('musk');
  codexMark('goblin','met');
}
/* ゲイザー種の「眼」を列挙(単眼/多眼を同じ形で扱う) */
function gazerEyes(e){
  if(e.id==='gazer'){
    const one=(a)=>({x:e.x, y:e.y-e.r, ang:a, r:BAL.GAZE_R, spread:BAL.GAZE_ANG, state:e.gzState, t:e.gzT, tmax:BAL.GAZE_AIM});
    /* v6.0 双眼(熟れた個体): 扇が二枚。避けた先にもう一枚ある——逃げ場の角が減る */
    if((e.rFans||0)>=2) return [one(e.gzAng||0), one((e.gzAng||0)+Math.PI*0.62)];
    return [one(e.gzAng||0)];
  }
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
/* ================= v6.0 新しい地形の効き =================
   八つの床。どれも「行為」ではなく「まだ抗っている心が軋む速さ」の側を動かす。
   台帳(凪ぎ度・灯った紋)は G.map に持ち、状態が変わった瞬間だけチャンクを焼き直す
   ——毎フレーム焼き直す作りは一つも入れない(v5.8 で沼が踏んだ穴と同じ)。 */
function calmLedger(){ const M=G.map; if(!M) return null; if(!M.calmT) M.calmT=new Uint8Array(MAP_W*MAP_H).fill(255); return M.calmT; }
function glyphLedger(){ const M=G.map; if(!M) return null; if(!M.glyphT) M.glyphT=new Uint8Array(MAP_W*MAP_H); return M.glyphT; }
/* 灯した紋の段(0〜GLY_CAP)。全ての快感の入りと、拘束の抜けにくさに効く */
function glyphStage(){ const B=G.B; if(!B) return 0; return Math.min(BAL.GLY_CAP, Math.floor((B.glyphN||0)/BAL.GLY_STEP)); }

/* 凪ぎを割る: 速く通った跡は波立って、鏡が消える。誰が通っても割れる(魔物でも) */
function calmBreak(x,y,v){
  const C=calmLedger(); if(!C||v<BAL.MIR_CALM_V) return;
  const i0=tileI(x), j0=tileJ(y), r=Math.ceil(BAL.MIR_CALM_R/MAP_T);
  for(let dj=-r;dj<=r;dj++) for(let di=-r;di<=r;di++){
    const i=i0+di, j=j0+dj; if(!inMap(i,j)) continue;
    if(Math.hypot(di,dj)*MAP_T>BAL.MIR_CALM_R) continue;
    C[j*MAP_W+i]=0;
  }
}
/* 凪ぎが戻る。全面を毎フレーム舐めると重いので、彼女の周りの窓だけを見る */
function calmTick(dt){
  const B=G.B, C=calmLedger(); if(!C||!B) return;
  /* 波立てるのは「速く通ったもの」全部。彼女でも魔物でも同じように鏡が割れる */
  for(const h of B.heroes){ if(!h.out) calmBreak(h.x,h.y,Math.hypot(h.vx||0,h.vy||0)); }
  for(const e of B.enemies){ if(!e.dead && !e.item) calmBreak(e.x,e.y,Math.hypot(e.vx||0,e.vy||0)); }
  const add=Math.max(1,Math.round(BAL.MIR_CALM_BACK*255*dt));
  for(const h of B.heroes){ if(h.out) continue;
    const i0=tileI(h.x), j0=tileJ(h.y);
    for(let dj=-9;dj<=9;dj++) for(let di=-12;di<=12;di++){
      const i=i0+di, j=j0+dj; if(!inMap(i,j)) continue;
      const k=j*MAP_W+i; if(C[k]<255) C[k]=Math.min(255,C[k]+add);
    } }
}
function calmAt(x,y){ const C=G.map&&G.map.calmT; if(!C) return 1; const i=tileI(x), j=tileJ(y); return inMap(i,j)?C[j*MAP_W+i]/255:1; }

function zoneV6Tick(h,dt,ice){
  const B=G.B, z=h.zone; if(!B) return;
  const sp=Math.hypot(h.vx||0,h.vy||0);

  /* ---- 凪ぎの鏡: 静かな面に映った自分が、誰も見ていないのに視姦になる ---- */
  if(z==='mirror'){
    if(!ice && calmAt(h.x,h.y)>=BAL.MIR_ON){
      learnZone('mirror',dt*0.30);
      applyPleasure(BAL.MIR_PLE*dt); applySensit(BAL.MIR_SENS*dt);
      /* v6.2 糸の床と同じ形。実測で mirrorT の最大が **ちょうど 7.00**(閾値7)で
         止まり、150戦で刻まれたのは 1 回・次の150戦では 0 回だった。
         凪いだ鏡の上に立てている時間は 0.46秒/戦しか無く、間を空けて溜め直す形なので、
         届いている値の少し下に置く */
      h.mirrorT=(h.mirrorT||0)+dt;
      if(h.mirrorT>BAL.MIR_TRAIT_T){ h.mirrorT=0; markTrait(h,'exhibit',1); }
    }
  }else h.mirrorT=Math.max(0,(h.mirrorT||0)-dt*BAL.TRAIT_FADE);

  /* ---- 紋の敷石: 踏んだら灯る。灯った数がそのまま淫紋の濃さになる ---- */
  if(z==='glyph' && !ice){
    const G2=glyphLedger();
    if(G2){ const i=tileI(h.x), j=tileJ(h.y);
      if(inMap(i,j)){ const k=j*MAP_W+i;
        if(!G2[k]){
          G2[k]=(h.hi|0)+1; B.glyphN=(B.glyphN||0)+1;
          if(G.map.chunks) G.map.chunks.delete(chunkKey(Math.floor(i/CHUNK),Math.floor(j/CHUNK)));
          const st=glyphStage();
          if(st>(B.glyphSt||0)){ B.glyphSt=st; learnZone('glyph',1); markTrait(h,'sigilJoy',1);
            floatTxt(h.x,h.y-96,'紋が濃くなった('+st+'/'+BAL.GLY_CAP+')','#ff9ec2',12,2.0);
            sayLine('feat.glyph',1,20,'踏むと……光る。踏まないように、行かなきゃ'); }
        } } }
    learnZone('glyph',dt*0.25);
  }

  /* ---- 糸の床: ゆっくり行けば長く撫でられ、急げば絡む。どちらを選んでも損をする ---- */
  if(z==='silk' && !ice){
    learnZone('silk',dt*0.35);
    /* v6.2 閾値は 6 だったが、実測で silkT の最大が **ちょうど 6.00** で止まっていた
       (45戦×四人)。糸の床の上に居る時間は 6.53秒/戦あるのに、溜まるのは
       「SILK_V 未満で歩いている間」だけなので、越える手前で走り出してしまう。
       届いている値の少し下に置き直す */
    if(sp<BAL.SILK_V){ applySensit(BAL.SILK_SENS*dt); h.silkT=(h.silkT||0)+dt;
      if(h.silkT>BAL.SILK_TRAIT_T){ h.silkT=0; markTrait(h,'attachCalm',1); } }
    else { h.silkT=Math.max(0,(h.silkT||0)-dt*BAL.TRAIT_FADE);
      if((h.silkHold||0)<=0 && (h.silkCd||0)<=0 && Math.random()<dt*0.5){
        h.silkHold=BAL.SILK_TETHER; h.silkRip=BAL.SILK_RIP; h.silkCd=2.4; B.silkN=(B.silkN||0)+1;
        floatTxt(h.x,h.y-90,'糸に絡んだ!','#ffc8dc',12,1.4);
        heroBubble(h,'……っ、足が',false,1); } }
  }else h.silkT=Math.max(0,(h.silkT||0)-dt*BAL.TRAIT_FADE);
  if(h.silkHold>0){ h.silkHold=Math.max(0,h.silkHold-dt); if(h.silkHold<=0) h.silkRip=0; }
  if(h.silkCd>0) h.silkCd=Math.max(0,h.silkCd-dt);

  /* ---- 霜の面: 濡れたまま入れば貼りつき、剥がすたびに肌が出る。止まるほど縮こまる ---- */
  if(z==='frost' && !ice && h.id!=='kuu'){
    learnZone('frost',dt*0.40);
    if((h.wet||0)>=BAL.FRO_WET){
      h.frostT=(h.frostT||0)+dt;
      if(h.frostT>=BAL.FRO_STICK && (h.frostHold||0)<=0){
        h.frostStuck=true; h.frostT=-BAL.FRO_STICK*1.6; h.frostHold=BAL.FRO_HOLD;   /* 剥がしてしばらくは凍らない。そのあとまた貼りつく */
        h.expo=Math.min(BAL.FRO_EXPO_CAP,(h.expo||0)+1);
        applySensit(6); addHeatG(5);
        floatTxt(h.x,h.y-96,'装束が床に凍りついた('+h.expo+'/'+BAL.FRO_EXPO_CAP+')','#bfeaff',12,2.2);
        heroBubble(h,'い、いや……はがれ、ない',false,1.4);
        markTrait(h,'bareHabit',1);
      }
    }else h.frostT=0;
    const slowQ=0.35+0.65*(1-Math.min(1,sp/BAL.FRO_CHILL_V));
    h.chill=Math.min(BAL.FRO_CHILL_CAP,(h.chill||0)+BAL.FRO_CHILL_K*slowQ*dt);
    if((h.chill||0)>0.5){ applySensit((h.chill||0)*0.10*dt);
      h.chillSec=(h.chillSec||0)+dt; if(h.chillSec>9){ h.chillSec=0; markTrait(h,'grindhabit',1); } }
  }else{ h.frostT=0; h.frostStuck=false;
    /* 霜の芽の粒は、霜の床を出ても溶けきるまで残る */
    if((h.chillHold||0)>0) h.chillHold-=dt; else h.chill=Math.max(0,(h.chill||0)-dt); }
  if(h.frostHold>0) h.frostHold=Math.max(0,h.frostHold-dt);

  /* ---- 胎の肉: 沈んで走れない。踏んでいるだけで熱が上がる ---- */
  if(z==='womb' && !ice){ learnZone('womb',dt*0.45); addHeatG(BAL.WOMB_HEAT*dt);
    h.wombT=(h.wombT||0)+dt; if(h.wombT>8){ h.wombT=0; markTrait(h,'sinkCalm',1); } }
  else h.wombT=Math.max(0,(h.wombT||0)-dt*BAL.TRAIT_FADE);

  /* ---- 時の澱: 抵抗だけが遅れて届く。快感・発情・拘束の判定は少しも遅れない ---- */
  h.stallOn=(z==='stall'&&!ice);
  if(h.stallOn) learnZone('stall',dt*0.35);
  stallFlush(h,dt);

  /* ---- 忘れ水: 覚えたことだけが溶ける。身体が覚えたことは溶けない ---- */
  if(z==='lethe' && !ice){
    letheWash(h,dt);
    h.letheT=(h.letheT||0)+dt;
    if(h.letheT>5){ h.letheT=0; heroBubble(h,'……あったかい。ここ、はじめて来た',false,1.2); markTrait(h,'hypnoObey',1); }
  }else h.letheT=Math.max(0,(h.letheT||0)-dt*BAL.TRAIT_FADE);
}

/* 時の澱: もがき・攻撃・回避を BAL.STALL_LAG だけ遅らせる待ち行列。
   ★遅らせるのは彼女が出した力だけ。入ってくる快感は一拍も遅れない——それがこの階の芯 */
function stallPush(h,amt){
  if(!h) return false;
  /* 澱み手に憑かれた四肢と、時の澱の床。どちらも「抗いだけ」を遅らせる。重なればさらに遅い */
  let lag=0;
  if(h.stallOn) lag+=BAL.STALL_LAG;
  if((h.stallLimb||0)>0) lag+=0.5;
  if(lag<=0) return false;
  (h.stallQ=h.stallQ||[]).push({t:(G.B?G.B.time:0)+lag, a:amt});
  if(G.B) G.B.stallN=(G.B.stallN||0)+1;
  return true;
}
function stallFlush(h,dt){
  const q=h.stallQ; if(!q||!q.length) return;
  const now=G.B?G.B.time:0; let sum=0;
  while(q.length && q[0].t<=now){ sum+=q.shift().a; }
  if(sum>0) struggleRaw(h,sum);
}

/* 忘れ水: 種族の知識と罠の記憶だけを削る。
   ★敏感化・発情の下限・性癖・淫紋・地形の避け(zoneKnow)は削らない。
     記憶が消えて身体が残るから、同じ罠に何度でも掛かれる */
function letheWash(h,dt){
  const K=(META.gen&&META.gen.know)||null; if(!K) return;
  const ids=Object.keys(K); if(!ids.length) return;
  const id=ids[Math.floor(Math.random()*ids.length)], e=K[id];
  if(e && typeof e==='object'){
    if((e.met||0)>0) e.met=Math.max(0,e.met-BAL.LETHE_KNOW*dt);
  }
  const TK=(META.gen&&META.gen.trapKnow)||null;
  if(TK){ const tk=Object.keys(TK); if(tk.length){ const t=tk[Math.floor(Math.random()*tk.length)];
    TK[t]=Math.max(0,(TK[t]||0)-BAL.LETHE_TRAP*dt); if(TK[t]<=0) delete TK[t]; } }
}

/* 苔(に見えるもの): 彼女がその瞬間に出した力を吸って、そのぶんの快感に変える。
   ★正しく抗うほど深く軋む。fear:0/innate:0 なので最後まで警戒できない */
function shamSoak(h,force){
  if(!h||h.zone!=='sham'||onIce(h)) return;
  applyPleasure(force);
  if(G.B) G.B.shamN=(G.B.shamN||0)+force;
  h.shamT=(h.shamT||0)+force;
  if(h.shamT>26){ h.shamT=0; heroBubble(h,'……なんで。ちゃんと、やってるのに',false,1.3); markTrait(h,'defyBliss',1); }
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
  { const wasOn=(h.iceOn||0)>0;
    h.iceOn = iceAt(h.x,h.y)>0.5 ? 0.25 : Math.max(0,(h.iceOn||0)-dt);   // v5.0 半歩の踏み外しで点滅しないよう 0.25秒のラッチ
    /* v5.0 道が実際に助けた時も褒める。氷の本当の使い道(悪い床をまたぐ)が、
       それまで一度も褒められなかった——直撃と沼だけが引き金だった */
    if(!wasOn && h.iceOn>0 && h.id!=='kuu'){
      const bad=(h.zone==='lewd'||h.zone==='haze'||h.zone==='flesh'||!!mireAt(h.x,h.y));
      if(bad){ const K=G.B.heroes.find(x=>x.id==='kuu'&&!x.out); if(K) icePraise(K,'road'); } } }
  if(h.iceBless>0) h.iceBless-=dt;
  /* v5.0 クウの氷の道の上では、地形の効き(発情・敏感・足)がまるごと効かない。
     生き物と仕掛け(床の手・触手・魔法陣・壁の光線・撒かれたガス)は氷では止まらない */
  const ice=onIce(h);
  /* v6.0 濡れ具合(0〜1)。濡れる床で上がり、乾いた床でゆっくり引く。
     フレイラの乾燥オーラの中では一気に乾く。霜の面の「貼りつき」の入力になる */
  { const zw=(typeof ZONE_WET!=='undefined'&&ZONE_WET[h.zone]!==undefined)?ZONE_WET[h.zone]:0.2;
    const AU=G.B.dryAura, AH=AU?G.B.heroes.find(x=>x.hi===AU.hi):null;
    const dry=(AH && !AH.out && Math.hypot(h.x-AH.x,h.y-AH.y)<AU.r)?3.0:1;
    const tgt=zw*(dry>1?0:1);
    h.wet=(h.wet===undefined?tgt:h.wet)+(tgt-(h.wet||0))*Math.min(1,dt*(tgt>(h.wet||0)?0.55:0.18*dry)); }
  if(h.zone==='water' && !ice) learnZone('water',dt*0.5);        // 足を取られる
  if(h.zone==='flower' && !ice) learnZone('flower',dt*0.35);     // 花粉
  if(h.zone==='hotspring' && !ice) learnZone('hotspring',dt*0.35);
  if(h.zone==='flower' && !ice) applySensit(0.6*dt);
  if(h.zone==='hotspring' && !ice){ applySensit(1.2*dt); addHeatG(2*dt); h.hp=Math.min(h.maxHp,h.hp+h.regen*0.5*dt); }
  if(h.zone==='flesh' && !ice) addHeatG(BAL.FLESH_HEAT*dt);   // v2.0 肉の床: 脈がうつる
  zoneV6Tick(h,dt,ice);   /* v6.0 鏡・紋・糸・霜・胎・澱・忘れ水・苔もどき */
  breathHeroTick(h,dt);   /* v6.0f 14階: 狭まった壁に擦れる */
  traitTick(h,dt);        /* v6.1 履歴が刻む性癖 */
  burstTick(h,dt);        /* v6.2 全身を取られた時・長く押し倒された時の「えいっ」 */
  chokeTick(h,dt);        /* ★v6.4b 蒸発した媚薬を吸い込んで、むせている間 */
  if(h.zone==='lewd'){   // v3.2 巣窟: 前室→沼→最奥と、奥ほど効きが強い。奥まで来たら引き返さない(前室でだけ「やっぱ無理」が出る)
    const dst=Math.max(0,Math.min(2,denStage(h.x,h.y)));
    const pw=denPower();   /* v6.3 浅い階の巣窟は、効きそのものが薄い */
    if(!ice){ learnZone('lewd',dt*0.45); addHeatG(BAL.DEN_HEAT[dst]*pw*dt); applySensit(BAL.DEN_SENS[dst]*pw*dt); }
    /* ★v6.3b 最奥へ踏み込んだ瞬間(その日一度だけ)。奥はどの階でも奥 */
    if(dst>=2 && !h.denDeepHit){ h.denDeepHit=true;
      /* ★この関数の const B=G.B はもっと下にあるので、ここで B を触ると
         宣言前アクセスで落ちる。G.B を直に読む */
      const BB=G.B, dp=denDeepPower(), ci0=BB.ci; BB.ci=h.hi;
      addHeatG(BAL.DEN_DEEP_HEAT*dp); applySensit(BAL.DEN_DEEP_SENS*dp);
      h.stumbleDur=Math.max(h.stumbleDur,0.6);
      BB.ci=ci0;
      floatTxt(h.x,h.y-78,'——奥','#ff5d9e',15,1.5);
      parts(h.x,h.y-10,18,['#ff5d9e','#c98cff','#ffd0e4'],110,1.0); sfx(140,90,0.4,'sine',0.06);
      sayPartyOrLine(h,'feat.denDeepIn','おく……におい、ちがう……っ、こ、こまで、きたら…');
    }
    /* v6.3b 巣窟の沼(前室より奥)も媚薬沼のうち。身体に残る */
    if(dst>=1) h.sticky=Math.min(BAL.STICKY_MAX,(h.sticky||0)+BAL.STICKY_GAIN*0.7*pw*dt);
    h.lewdT=(h.lewdT||0)+dt;
    /* 床の手の間隔は、階ごとの多さ(grip)と効きで伸び縮みする。1階は倍以上あく */
    if(h.lewdT>=BAL.DEN_GROPE[dst]/Math.max(0.3,denGrip()*pw)){ h.lewdT=rand(-1.5,0); floorGrope(h); if(dst===0 && Math.random()<BAL.DEN_ABORT) zoneAbort(h); }   // 床から伸びる手は生き物なので、氷でも止まらない
  }else if(h.zone==='haze'){ if(!ice){ learnZone('haze',dt*0.3); addHeatG(BAL.HAZE_HEAT*dt); applySensit(BAL.HAZE_SENS*dt); } h.lewdT=0; }   // v3.2 口の外の澱み
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
  if((h.omazukeT||0)>0) h.omazukeT-=dt;       /* v6.6 責めが止まっている間 */
  highTick(h,dt);                            /* v6.6 ハイ → 疲れ → 中毒 */
  if((h.crashT||0)>0) h.crashT-=dt;
  if((h.omazukeHold||0)>0){ h.omazukeHold-=dt; if(h.omazukeHold<=0) h.omazuke=0; }   /* 女王が離れれば、堰も数えも解ける */
  if((h.whisperT||0)>0) h.whisperT-=dt;       /* v6.6 耳元の囁きが効いている間 */
  // おねだり: 発情Ⅲ+(催眠/淫紋Ⅱ+/寸止め明け)で、撃つのをやめて寄っていってしまう
  if(h.begCd>0) h.begCd-=dt;
  if(h.begT>0){ h.begT-=dt; }
  else if(h.begCd<=0 && h.heatLv>=(h.curse==='succuqueen'?2:3) && h.climaxT<=0 && !h.pinned && !h.charmBind && (h.dazeT>0 || h.crestLv>=2 || (h.omazuke||0)>0 || h.refractT>BAL.REFRACT_T-0.5)){   /* v6.6 おあずけされていると、ねだる */
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
  /* ★v6.2 applyPleasure が輪の途中で絶頂を起こすと、そこで別の吸盤が外れる。
     suckSlots が返した一覧は取った時点の写しなので、次の回で h.suckers[sl] が
     null になっていて落ちていた(通しを最後まで回せるようにして初めて出た)。
     肢では二度直してある同じ罠。毎回引き直して確かめる */
  for(const sl of suckSlots(h)){
    const at=h.suckers[sl];
    if(!at){ continue; }
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
    /* v6.0 1002行と同じ穴。この輪の中の applyPleasure が絶頂を起こすと四肢が解け、
       attachedSlots が返した直後の h.limbs[sl] が null になる。毎回引き直して確かめる */
    const at=h.limbs[sl]; if(!at) continue;
    const m=at.mon;
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
  /* ★v6.3b 媚薬のベタベタ: 沼に浸かると身体に残り、洗うか拭うまで火照りが上がり続ける。
     沼から出た瞬間に何も無かったことになるのは、この作品の芯(残る痕)と噛み合わない */
  { const mi=mireAt(h.x,h.y);
    if(mi && !h.out){
      const dep=(typeof mireDepthAt==='function')?Math.max(0.35,mireDepthAt(h.x,h.y)):(mi.depth||0.5);
      h.sticky=Math.min(BAL.STICKY_MAX,(h.sticky||0)+BAL.STICKY_GAIN*dep*dt);
      if(!h.stickySaid && h.sticky>=0.8){ h.stickySaid=true;
        sayPartyOrLine(h,'feat.sticky','ぬるぬるが、はだにのこって……とれない'); }
    }
    if((h.sticky||0)>0){
      /* 効き: 濃いほど火照りと敏感化が進む(沼の外でも) */
      addHeatG(BAL.STICKY_HEAT*h.sticky*dt); applySensit(BAL.STICKY_SENS*h.sticky*dt);
      /* 落ちかた: 何もしなければ乾くだけ。浅瀬を歩けば流れる。清水と泉で一気に落ちる(usePool/泉の側) */
      let off=BAL.STICKY_DRY;
      if(h.zone==='water') off+=BAL.STICKY_WADE;
      h.sticky=Math.max(0,h.sticky-off*dt);
      if(h.sticky<=0){ h.stickySaid=false; h.wipeCd=0; }
      /* 拭う: 濃くて手が空いていれば、その場で立ち止まって拭う */
      if(h.wipeT>0){ h.wipeT-=dt; h.vx=0; h.vy=0;
        if(h.wipeT<=0){ h.sticky=Math.max(0,h.sticky-BAL.STICKY_WIPE); h.wipeCd=BAL.STICKY_WIPE_CD;
          parts(h.x,h.y-14,8,['#ff9ec2','#ffd0e4','#fff'],70,0.5); } }
      else if((h.wipeCd||0)>0){ h.wipeCd-=dt; }
      else if(h.sticky>=BAL.STICKY_WIPE_TH && !h.pinned && !h.charmBind && h.climaxT<=0
              && attachCount(h)===0 && !mireAt(h.x,h.y) && nearEnemyCount(h.x,h.y,240)===0){
        h.wipeT=BAL.STICKY_WIPE_T;
        heroBubble(h,pickRand(['……ぬぐわなきゃ','べたべた、する……','はやく、おとさないと…']),false,2);
      }
    } }
  /* v6.3 フレイラの熱: 当てるのが途切れると冷める(退がると失う) */
  if((h.flameT||0)>0){ h.flameT-=dt; if(h.flameT<=0){ h.flameHeat=Math.max(0,(h.flameHeat||0)-1); if(h.flameHeat>0) h.flameT=BAL.FLAME_KEEP; } }
  /* v6.2 嗅ぐ発作の時間切れ(引き金は下の臭いの雲の所) */
  if(h.sniffT>0){ h.sniffT-=dt; h.vx=0; h.vy=0; if(h.sniffT<=0){ h.sniffT=0; h.sniffAt=null; } }
  if((h.sniffCd||0)>0) h.sniffCd-=dt;
  // 発情の波のふらつき
  if(h.stumbleDur>0) h.stumbleDur-=dt;
  h.stumbleT-=dt;
  if(h.waveDur>0 && h.stumbleT<=0 && !h.pinned && !h.charmBind && h.climaxT<=0){
    h.stumbleT=rand(1.8,3.0); h.stumbleDur=0.35;
    heroBubble(h,'あしが…もつれ…っ');
  }
  // ガス雲=媚薬: 敏感化と発情ゲージが上がる(快感は直接生まない)。雄臭の雲は加えて、発情したまま居続けると匂いと結びつく
  h.inMusk=false; let inCloud=false;
  { const mk=(heroLife(h.id).traits.musk)||0, cm=(h.curse==='gobking'?1.5:1);   /* v5.8 その子に刻まれた分だけ効く */
    for(const c of B.clouds){
      if(Math.hypot(h.x-c.x,(h.y-12)-c.y)<c.r){
        inCloud=true;
        if(c.kind==='musk'){
          h.inMusk=true;
          applySensit(c.rate*(1+0.3*mk)*cm*dt);
          addHeatG(BAL.MUSK_HEAT*(1+0.35*mk)*cm*dt);
          if(h.heatLv>0){ h.muskCond+=BAL.MUSK_COND*dt; if(h.muskCond>=25) conditionMusk(); }
          /* v6.2 嗅ぐ発作。熱があると、雲の中で足が止まって嗅いでしまう。
             その間は攻撃も奥義も出ない(反応は既に4箇所に書いてあった) */
          if(h.heatLv>=BAL.MUSK_SNIFF_HEAT && (h.sniffCd||0)<=0 && h.sniffT<=0
             && !h.pinned && !h.charmBind && h.climaxT<=0 && h.freezeT<=0 && attachCount(h)===0){
            h.sniffT=BAL.MUSK_SNIFF*(1+0.25*mk); h.sniffCd=BAL.MUSK_SNIFF_CD; h.sniffAt={x:c.x,y:c.y};
            h.vx=0; h.vy=0; h.path=null;
            heroBubble(h,{freila:'……っ、なんで、吸い込んで……', kuu:'……鼻が、動く', yamiko:'……嗅いで、しまった'}[h.id]||'……っ、すっ……ちゃっ……',true,1.4);
            awardAil('sniff');
          }
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

  if(p.pinned || p.charmBind || p.climaxT>0 || p.stumbleDur>0 || p.freezeT>0 || p.selfT>0 || p.sniffT>0 || p.bathT>0 || p.poolT>0 || p.readT>0 || p.wipeT>0){
    p.vx*=Math.pow(0.001,dt); p.vy*=Math.pow(0.001,dt);
    p.moving=false;
    p.aiLabel=p.freezeT>0?'じかんが、とまって……'
      :p.climaxT>0?'ぜっちょう……!!'
      :p.selfT>0?'……(その場で、じぶんを)……'
      :p.bathT>0?'おゆに、つかってる……'
      :p.wipeT>0?'ぬめりを、ぬぐってる……'
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

  /* v5.2 「近い所でグルグル」を断つ。よく歩いているのに狭い円から出ていない状態が続いたら、
     かばいのラッチと目当てを捨てて、円の外へ向き直す。
     詰まり検知(stuckT)は「進みたいのに進めない」を見るので、こちらは拾えない。
     ここは毎フレーム走る場所に置くこと——思考の拍(aiDecide)は 0.1〜0.3 秒に一度しか来ないので、
     あちらに置くと 12 秒の窓がいつまでも埋まらない */
  { p.grindT=p.grindT||0; p.trail=p.trail||[]; p.trailT=(p.trailT||0)-dt;
    if(p.trailT<=0){
      p.trailT=BAL.GRIND_SAMP; p.trail.push({x:p.x,y:p.y});
      if(p.trail.length>BAL.GRIND_N) p.trail.shift();
      if(p.trail.length>=BAL.GRIND_N){
        let len=0, cx=0, cy=0;
        for(let i=1;i<p.trail.length;i++) len+=Math.hypot(p.trail[i].x-p.trail[i-1].x, p.trail[i].y-p.trail[i-1].y);
        for(const q of p.trail){ cx+=q.x; cy+=q.y; }
        cx/=p.trail.length; cy/=p.trail.length;
        let rad=0; for(const q of p.trail) rad=Math.max(rad, Math.hypot(q.x-cx,q.y-cy));
        if(len>=BAL.GRIND_PATH && rad<=BAL.GRIND_RAD){ p.grindT+=BAL.GRIND_SAMP; p.grindCx=cx; p.grindCy=cy; }
        else p.grindT=Math.max(0,p.grindT-BAL.GRIND_SAMP*2);
      }
    }
    /* 戦っている最中は断たない(引き撃ちの円は正しい動き)。近くに敵が居らず、脅威も薄い時だけ */
    let quiet=(p.threatV||0)<BAL.GRIND_THREAT;
    if(quiet){ for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue;
      if(Math.hypot(e.x-p.x,e.y-p.y)<BAL.GRIND_QUIET_R){ quiet=false; break; } } }
    const canBreak=quiet && attachCount(p)===0 && !p.pinned && !p.charmBind && p.climaxT<=0;
    if(canBreak && p.grindT>=BAL.GRIND_T && B.time-(p.grindLast||-99)>BAL.GRIND_CD){
      p.grindT=0; p.grindLast=B.time; p.trail.length=0; B.nGrind=(B.nGrind||0)+1;
      p.coverUntil=0; p.coverOf=-1; p.assist=null;              // かばいのラッチを外す
      if(p.goal) giveUpOn(p.goal);
      p.goal=null; p.goalT=0; p.tgtKey=null; p.tgtNear=0; p.path=null;
      p.explore=null; p.exploreUntil=0; p.dest=null; p.destUntil=0; p.thinkT=0;
      const ox=p.x-(p.grindCx||p.x), oy=p.y-(p.grindCy||p.y), od=Math.hypot(ox,oy)||1;
      const q=snapFloor(clampMapX(p.x+ox/od*760,120), clampMapY(p.y+oy/od*760,120), false, 6);
      p.breakOut=(q&&reachableAt(q.x,q.y,false))?{x:q.x,y:q.y,until:B.time+BAL.GRIND_OUT}:null;
      sayLine('feat.grind',0,25,'……あれ? ここ、さっきも通った気がする');
    }
    if(p.breakOut && (B.time>p.breakOut.until || !canBreak)) p.breakOut=null;
  }
  // ---- 思考の拍 ----
  // 一定間隔でしか判断を更新しない。集中が低いほど判断が遅れ、
  // 判断の合間は前の判断のまま動き続ける(境界でのガクガクを消し、考えている風の間を作る)
  p.thinkT-=dt;
  if(p.thinkT<=0){
    p.thinkT=(BAL.THINK_MIN+(BAL.THINK_MAX-BAL.THINK_MIN)*(1-foc)+rand(0,0.06))*(p.dazeT>0?2.2:1)*(1+0.35*p.hypnoLv)*(p.curse==='bossgazer'?1.15:1);
    aiDecide(foc,dt);
  }

  let dx=p.steerX, dy=p.steerY;
  let state=p.steerState;
  /* v5.2 回っていた円の外へ、しばらく向き直す(舵は毎フレーム上書きする) */
  if(p.breakOut){
    const bx=p.breakOut.x-p.x, by=p.breakOut.y-p.y, bd=Math.hypot(bx,by)||1;
    if(bd<80) p.breakOut=null;
    else{ dx=dx*0.15+bx/bd*1.2; dy=dy*0.15+by/bd*1.2; state='breakout'; }
  }
  /* ★v6.4b むせている間は、噴き出した所から離れる方へ足が向く(息を吸える所まで) */
  if((p.chokeT||0)>0 && p.chokeFrom){
    const bx=p.x-p.chokeFrom.x, by=p.y-p.chokeFrom.y, bd=Math.hypot(bx,by)||1;
    dx=dx*0.15+bx/bd*1.2; dy=dy*0.15+by/bd*1.2; state='choke';
  }
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
  /* v6.0 霜の面は氷の道よりさらに滑る。加速も減速も鈍り、曲がりきれずに行き過ぎる。
     ★クウだけは滑走を制御できる(自分の領分なので、逆に速い) */
  const frost=(p.zone==='frost' && !onIce(p) && p.id!=='kuu');
  const k=Math.min(1,dt*6.5*foc*(onIce(p)?BAL.ICE_SLIDE_K:1)*(frost?BAL.FRO_ACC:1));   // v5.0 氷の上は速いが、曲がりきれずに少し流れる
  p.vx+=(tvx-p.vx)*k; p.vy+=(tvy-p.vy)*k;
  if(frost && m<=0.001){ const fk=Math.min(1,dt*6.5*BAL.FRO_FRIC); p.vx-=p.vx*fk; p.vy-=p.vy*fk; }   /* 止まろうとしても、止まりきれない */
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
    if(!at||at.kind!=='tether'||!at.mon||at.mon.dead) continue;
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
    choke:'むせながら、霧の外へ',
    addict:'……もう一回だけ、って足が','g_addict':'……もう一回だけ、って足が',   /* v6.6 中毒 */
    hypno:'……電波に、あしが……', item:'おちてる品へ!', beg:'……おねだり、なんて……してない……',
    g_event:'光の柱へ!', g_chest:'たからばこへ!', g_boss:'おうさまの箱へ!', g_item:'おちてる品へ!', g_shrine:'祠へ', g_spring:'泉で休みに', g_pool:'清水であらいに',
    g_stele:'石碑をよみに', g_stairs:'降り口へ', g_seal:'封印石を灯しに', g_core:'魔核へ——', g_lantern:'あかりへ', g_shroom:'光茸をとりに', g_nectar:'蜜の花へ', g_treasure:'沈んだ宝へ', g_explore:'たんさく中', g_gems:'ジェムをあつめる', hesitate:'まよっている……', think:'かんがえ中……', abort:'にげだす!', retreat:'逃げに徹する!', kite2:'引き撃ち', talk:'相談中……', assist:'仲間を助ける!', rescue:'救出する!', g_rescue:'仲間を救いに', g_cover:'仲間をかばう!', core:'心臓から離れない', breakout:'……行き直す'};
  const BBL={flee:'にげなきゃ〜!', boss:'おっきいのこわい!!', dodge:'あれは…だめ、よけなきゃ!', gem:'キラキラかいしゅう♪', poi:'あそこまで、いってみる', explore:'こっちは、まだ見てない',
    heart:'ハートみっけ!', prop:'燭台こわして回復しなきゃ', chest:'たからばこだ〜!',
    kite:'このきょりキープ…', wait:'つぎはどこから…?', struggle:'はなれてよ〜っ!',
    charmwalk:'…なんで、あしが…', heatwalk:'…あつくて、なにも…',
    choke:'けほっ……そと、そとに……',
    hypno:'……あっち、いかなきゃ……', item:'なにか、おちてる!', beg:'……ちがう……',
    g_event:'あのひかり、いってみる', g_chest:'たからばこだ〜!', g_boss:'おうさまの、たからばこ……!', g_item:'なにか、おちてる!', g_shrine:'ほこら、いこう', g_spring:'ちょっと、やすみたい……',
    g_pool:'あらいたい……べたべた', g_stele:'なにか、かいてある', g_stairs:'……おりる。つぎへ', g_seal:'あれ、ともさなきゃ', g_core:'……あれが、しんぞう', g_lantern:'あかり、あったかそう……', g_shroom:'あのひかり、とろう', g_nectar:'はな……あまいにおい', g_treasure:'みずのなかに、なにか……', g_explore:'こっちは、まだ見てない', g_gems:'キラキラ、ぜんぶひろう♪', hesitate:'……どうしよ', think:'……うーん', abort:'やっぱ、むり!', retreat:'ぜんぶ、にげるっ!', kite2:'さがりながら、うつ!', talk:'どっち、いく?', assist:'いま、たすける!', rescue:'まって、いくから!', g_rescue:'いま、いく!', g_cover:'そっち、やばそう! いく!', core:'はなれちゃ、だめ……', breakout:'……こっちじゃない'};
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
function aiDecide(foc,dt){
  const B=G.B, p=B.hero;
  if(B.dbgCands) p.dbgGoal='早い枝(目当ての所まで来ていない)@'+B.time.toFixed(2);   /* 検証用: 判断の拍ごとに訳を残す。思考は THINK_MIN〜MAX 秒に一度しか回らないので、フレームごとに見ると取りこぼす */
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
    if(e.id==='yamiboss' && (e.meltT||0)>0) continue;   // v5.0 闇に溶けている間は身構えようがない
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
    const ds=darkSense(p.x,p.y);   // v4.0 暗いと雲の縁に気づくのが遅れる(踏み込んでから避ける)
    for(const c of B.clouds){
      const dx=p.x-c.x, dy=p.y-c.y, d=Math.hypot(dx,dy)||0.001;
      if(d<c.r+30*ds){ ax+=dx/d*0.35*foc; ay+=dy/d*0.35*foc; }
    }
  }
  // v2.0 淫紋の罠(見える): 知っていれば踏まない(認識で避け、熟知で強く避ける)
  { const ck=crestKnow(), ds=darkSense(p.x,p.y); if(ck>=1){ for(const tr of B.traps){ if(!tr.armed) continue; const tdx=p.x-tr.x, tdy=p.y-tr.y, td=Math.hypot(tdx,tdy)||0.001; if(td<tr.r+46*ds){ const w=(ck>=3?0.9:0.55)*foc; ax+=tdx/td*w; ay+=tdy/td*w; } } } }   // v4.0 暗いと紋の光にも遅れて気づく
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
      /* v5.6 魔核の技も、覚えた分だけ避ける。心臓は据わっている(spd=0)ので
         下の「熟知した脅威からは距離を取る」の条件から外れており、
         2.6秒の溜めがある大光線を棒立ちで浴びていた。
         光線=軸から横へ / 鞭・脈=間合いの外へ一歩。どちらも短いので、すぐ削りに戻る */
      if(e.id==='core'){
        if((e.beamT||0)>0){
          const ux=Math.cos(e.beamA||0), uy=Math.sin(e.beamA||0);
          const rx=p.x-e.x, ry=p.y-e.y, along=rx*ux+ry*uy;
          if(along>0 && along<BAL.CORE_BEAM_LEN){
            const px=rx-ux*along, py=ry-uy*along, pd=Math.hypot(px,py)||0.001;
            if(pd<BAL.CORE_BEAM_W*0.9){ ddx+=px/pd*1.8*dodge; ddy+=py/pd*1.8*dodge; if(kl>=2) strong=true; }
          }
        }
        if((e.whipT||0)>0 || (e.pulseT||0)>0){
          const wx=p.x-e.x, wy=p.y-e.y, wd=Math.hypot(wx,wy)||0.001;
          if(wd<e.r+BAL.CORE_AURA_R){ ddx+=wx/wd*1.1*dodge; ddy+=wy/wd*1.1*dodge; if(kl>=2) strong=true; }
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
    let want=(ttk>BAL.FLEE_TTK*lvK||nNear>=BAL.FLEE_N)?'flee':((ttk>BAL.KITE_TTK*lvK||nNear>=BAL.KITE_N)?'kite':'fight');
    if(B.coreWar && p.hp>p.maxHp*BAL.CORE_FIGHT_HP && !p.exhausted) want='fight';   // v4.0 魔核戦: 体力があるうちは下がらない
    if(want!==p.aiMode){ p.aiMode=want; p.modeUntil=B.time+BAL.MODE_HOLD; p.escape=null; if(want==='flee') sayLine('retreat',1,8,'むり、にげる!'); else if(want==='kite') sayLine('kite',0,12); }
  }
  // v3.0 仲間のカバー: 掴まれている/押し倒されている相手へ寄り、その魔物を優先して撃つ(自分が自由な時)
  { const cv=coverTarget(p);   // v4.0 拘束だけでなく「調子の悪さ」でも寄る
    const need=!!cv;
    /* v5.3 助けに行く相手は cv。台詞の選び方も名指しも cv に合わせる
       (三人以上いると partnerOf の o とは別人のことがあり、別の子の状態で台詞を選んでいた) */
    if(need && !p.assist) sayPartyAs(B.ci, cv.pinned?'assist.pin':((attachCount(cv)>0||cv.charmBind)?'assist.grab':'assist.cover'),2,8,cv);
    p.assist=need?cv:null; }
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
      if(B.coreWar && B.core && Math.hypot(pr.x-B.core.x,pr.y-B.core.y)>BAL.CORE_LEASH) continue;   // v4.0 魔核戦: 遠い燭台までは走らない
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
  }else if(p.assist && Math.hypot(p.assist.x-p.x,p.assist.y-p.y)>BAL.ASSIST_R && threat<1.4+Math.min(1.0,distressOf(p.assist)*0.35)){   // v4.0 相方が悪いほど、多少の脅威でも踏み込む
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
    if(B.dbgCands) p.dbgGoal=(target?('直接:'+kind):(!G.map?'地図なし':(goal?'':(p.explore?'候補ゼロ・探索点あり':'候補ゼロ・探索点なし'))))+'@'+B.time.toFixed(2);   /* 検証用: 目当てが「なし」になる訳を残す(B.dbgCands=true の時だけ) */
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
      /* ★v6.3e 「狭くする」条件から walk を外した。前は目当てへ歩いている時だけ狭めていたので、
         目当てを失った(あるいは脅威で歩けない)瞬間に半径がいちばん広い 430 に戻り、
         降りる気のまま延々とジェムを拾って回ることになっていた */
      const leaveN=(B.wantExit||pressure()>=1.5);
      let bestGm=null, bd=gemFast?0:(leaveN?BAL.GEM_WALK_R_LEAVE:(walk?BAL.GEM_WALK_R:430)), bestCl=null;   // v2.1 ジェム断ち中は狙わない。降りると決めた後・圧が高い時は、道すがらの半径を狭く
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
      const standKind=(kind==='g_rescue'||kind==='g_wait'||kind==='g_cover'||kind==='g_seal'||kind==='g_pool'||kind==='g_stele'||kind==='g_shrine'||kind==='g_spring'||kind==='g_stairs');
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
        /* ★v6.4 沼の縁のためらいは「地形」に対するものなので、目標が変わっても続ける。
           前は目標が変わるたびに消えていて、177回ためらったうち 37回しか
           「言い訳して入る」まで届いていなかった */
        if(p.hesit && p.hesit.key!==giveUpKey(target)){ if(p.hesit.zone==='mire') p.hesit.key=giveUpKey(target); else p.hesit=null; }   // 目標が変わったら迷いも仕切り直し
        if(p.hesit){
          // 迷っている最中: 境から半歩下がって左右に揺れる。時間が来たら必ず決める(入る/諦める)
          if(B.time<p.hesit.until){ const sw=Math.sin(B.time*2.6), ux=dx, uy=dy; dx=-ux*0.3-uy*sw*0.25; dy=-uy*0.3+ux*sw*0.25; state='hesitate'; }
          /* ★v6.4 媚薬沼だけは「入らない」を選ばない。ひと呼吸おいて、言い訳して入る。
             ここで諦めさせると v6.3b で直した「沼の中の宝箱を取りに行けない」が戻ってくる */
          else if(p.hesit.zone==='mire'){
            const aroused=p.aphro>=45||p.heatLv>0||p.sensit>=60;
            p.brave=p.brave||{}; p.brave.mire=B.time+BAL.MIRE_BRAVE_T;
            B.nMireGo=(B.nMireGo||0)+1;
            sayLine(aroused?'mireResign':'mireGo',1,0,'……ちょっとだけ。すぐ、でるから');
            p.hesit=null;
          }
          else{
            const nz=p.hesit.zone, worth=p.hesit.worth||(p.goal&&p.goal.worth)||1.5, hpR=p.hp/p.maxHp, aroused=p.aphro>=45||p.heatLv>0||p.sensit>=60;
            const hn=(p.hesitN&&p.hesitN[nz])||0;   // v2.3 同じ地形で何度も迷った回数(迷うたびに入る確率が上がる→迷い続けない)
            /* ★v6.3 入るかどうかは「どれだけ知っているか」で決まる。段(fear)ではなく zoneKnow を直に読む。
               知らない所へは軽い気持ちで入り、覚えた所では宝の魅力も元気さも割り引かれる。
               媚薬まみれの「もういいや」だけは、知識に関わらず効く */
            const kn=zoneKnow(nz);
            const pe=(BAL.HESIT_GO_BASE-BAL.HESIT_GO_KNOW*kn)
              +(worth>=2.6?0.3:(worth>=2?0.15:0))*(1-0.5*kn)
              +(hpR>0.7?0.15:-0.1)*(1-kn)
              +(aroused?0.25:0)+BAL.HESIT_ESC*hn
              +(growthDone()?BAL.FULL_BRAVE:0);   // v2.2 媚薬まみれなら「もういいや」 / ★v6.4 伸びしろが尽きた=いまが最強、だから踏み込む
            if(Math.random()<pe){ p.brave=p.brave||{}; p.brave[nz]=B.time+60; B.nBrave=(B.nBrave||0)+1; if(p.hesitN) p.hesitN[nz]=0; sayLine(aroused?'resign':(growthDone()?'fullBrave':(hn>=2?'braveFinally':'brave')),1,0,'……いく! ちょっとだけ!'); }
            else{ p.scared=p.scared||{}; p.scared[nz]=B.time+BAL.SCARED_T; p.hesitN=p.hesitN||{}; p.hesitN[nz]=hn+1; B.nChicken=(B.nChicken||0)+1; giveUpOn(target); if(p.goal && (giveUpKey(p.goal)===giveUpKey(target)||p.goal===target)){ if(p.goal.kind==='explore'){ p.explore=null; p.exploreUntil=0; } p.goal=null; p.goalT=0; } sayLine('chicken',1,0,'やめとく……こわいし'); dx=0; dy=0; state='hesitate'; }
            p.hesit=null;
          }
        }else{
          const nz=zoneAt(p.x+dx*44*darkSense(p.x,p.y),p.y+dy*44*darkSense(p.x,p.y));   // v4.0 暗いと地形の境に気づくのが遅い
          /* ★v6.3f 迷うのは「いまより嫌な所へ踏み込む時」だけ。
             前は行き先の嫌さしか見ていなかったので、甘い褥(3.0)から媚薬の澱み(2.0)へ
             出ようとした時にも「はいる? はいらない?」が立った——巣窟の口は澱みで
             ぐるりと囲まれているので、出口が必ず「怖い地形」になる。
             実測(60夜): 迷い576回のうち9回が巣窟の中から。さらに、そこで怯むと
             澱みを SCARED_T(40秒)こわがるので、唯一の出口を自分で塞ぐ
             ——巣窟に居た995秒のうち132秒が「出口をこわがったまま中に居る」だった */
          const cf=zoneFear(p.zone);
          const worse=(nz!==p.zone && zoneFear(nz)>cf);
          if(worse && p.scared && p.scared[nz]>B.time){ giveUpOn(target); if(p.goal && (giveUpKey(p.goal)===giveUpKey(target)||p.goal===target)){ if(p.goal.kind==='explore'){ p.explore=null; p.exploreUntil=0; } p.goal=null; p.goalT=0; } dx=-dx*0.5; dy=-dy*0.5; state='hesitate'; }   // 諦めた地形へは、しばらく入らない(探索点なら捨てて別の点を選ぶ)
          const nf=worse?zoneFear(nz):0;   // v2.2 嫌い方の段: <2 は気にせず入る / 2 は短く迷う / 3 は価値が無ければ入らず、あれば長く迷う
          const scary=nf>=2 && !(p.brave&&p.brave[nz]>B.time) && !(p.scared&&p.scared[nz]>B.time);
          /* ★v6.4 媚薬沼の縁: 沼は地形ではなく重ね物(mireAt)なので、上の地形の迷いには一度も掛からない。
             だから彼女は素振りも無く、まっすぐ沼へ入っていた。縁の手前で気づいて、ためらう */
          if(!scary && !mireAt(p.x,p.y) && !(p.brave&&p.brave.mire>B.time)){
            const mx=p.x+dx*BAL.MIRE_LOOK*darkSense(p.x,p.y), my=p.y+dy*BAL.MIRE_LOOK*darkSense(p.x,p.y);
            if(mireAt(mx,my) && mireDepthAt(mx,my)>=BAL.MIRE_HESIT_DEEP){
              const arousedM=p.aphro>=45||p.heatLv>0||p.sensit>=60;
              p.hesit={zone:'mire', fear:2, worth:(p.goal&&p.goal.worth)||1.5, until:B.time+BAL.MIRE_HESIT_T*(0.8+Math.random()*0.4)*(arousedM?0.6:1), key:giveUpKey(target)};
              B.nMireHesit=(B.nMireHesit||0)+1;
              sayLine('mireHesit',1,0,'……これ、あの ぬるぬるの……');
              const sw=Math.sin(B.time*2.6), ux=dx, uy=dy; dx=-ux*0.3-uy*sw*0.25; dy=-uy*0.3+ux*sw*0.25; state='hesitate';
            }
          }
          if(scary){
            const worth=(p.goal&&p.goal.worth)?p.goal.worth:(kind==='chest'?(target.bossChest?3.0:2.6):(kind==='item'?3.0:(kind==='heart'?3.2:1.5)));   // 目当てが無い直接の目標(箱・品)は種類から価値を見る
            const aroused=p.aphro>=45||p.heatLv>0||p.sensit>=60;   // v2.2 媚薬まみれなら「もういいや」で腰が軽い
            const hn=(p.hesitN&&p.hesitN[nz])||0;
            if(nf>=3 && worth<BAL.FEAR3_WORTH*(aroused?0.5:1)*(growthDone()?BAL.FULL_FEAR3:1)*Math.max(0.4,1-0.25*hn)){   /* ★v6.4 強い夜は、入りたくない地形の敷居も下がる */   // 入りたくない地形に、それほどの用は無い→迷わず引き返す(v2.3 引き返した回数だけ敷居が下がり、やがて迷い始める)
              p.scared=p.scared||{}; p.scared[nz]=B.time+BAL.SCARED_T; p.hesitN=p.hesitN||{}; p.hesitN[nz]=hn+1; B.nChicken=(B.nChicken||0)+1; giveUpOn(target); if(p.goal && (giveUpKey(p.goal)===giveUpKey(target)||p.goal===target)){ if(p.goal.kind==='explore'){ p.explore=null; p.exploreUntil=0; } p.goal=null; p.goalT=0; } sayLine('chicken',1,0,'そこは、いかない!'); dx=0; dy=0; state='hesitate';
            }else{
              /* ★v6.3 迷いの長さを反転。よく知っている所ほど「見た瞬間に決まる」。
                 前は nf>=3 が最長(2.0〜3.6秒)で、覚えた巣窟の前でいちばん長く突っ立っていた */
              const hesT=(nf>=3?BAL.HESIT_KNOWN:BAL.HESIT_NEW)*(0.75+Math.random()*0.5)*(aroused?0.6:1);
              p.hesit={zone:nz, fear:nf, worth, until:B.time+hesT, key:giveUpKey(target)}; B.nHesit=(B.nHesit||0)+1; sayLine(aroused?'resign':(hn>=1?'hesitateAgain':'hesitate'),1,0,'……はいる? はいらない?'); const sw=Math.sin(B.time*2.6), ux=dx, uy=dy; dx=-ux*0.3-uy*sw*0.25; dy=-uy*0.3+ux*sw*0.25; state='hesitate';
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
  /* v4.0 魔核戦: 離れていたら詰め寄る(回復・救出・拘束・迷いの最中は除く)。
     v5.2 ここは **魅了と発情の波より後** に置くこと。前に置いていた頃は、
     charmwalk が向きを丸ごと差し替え、heatwalk が最大9割まで混ぜてしまうので、
     せっかくの引き寄せが毎回打ち消されていた(実測で中央値210px・最大808px)。
     近い内(PULL_R まで)は自由に揺らがせて、綱(LEASH)へ近づくほど引き戻す——
     ふらつく姿は残したまま、部屋を横切るところまでは行かせない */
  if(B.coreWar && B.core && state!=='struggle' && state!=='hesitate' && state!=='heart' && state!=='prop' && state!=='g_spring' && state!=='g_pool' && state!=='rescue' && state!=='g_rescue' && !p.charmBind){
    const cd=Math.hypot(B.core.x-p.x,B.core.y-p.y)||1;
    if(cd>BAL.CORE_PULL_R){
      const t=Math.min(1,(cd-BAL.CORE_PULL_R)/Math.max(1,BAL.CORE_LEASH-BAL.CORE_PULL_R));
      let k=BAL.CORE_PULL_K*t;
      if(cd>BAL.CORE_LEASH) k=Math.max(k,BAL.CORE_PULL_MAX);   // 綱の外では、ほぼ全部を引き戻しに使う
      dx=dx*(1-k)+(B.core.x-p.x)/cd*k; dy=dy*(1-k)+(B.core.y-p.y)/cd*k;
      if(k>0.6) state='core';                                   // 引き戻しが勝っている間は、そう表示する
      if(cd>BAL.CORE_LEASH) sayLine('feat.coreBack',0,20,'はなれちゃ、だめ……もどる');
    }
  }
  // v3.0 パーティ: 相手から離れすぎない(PARTY_LEASH を超えるほど強く寄る)。重なりすぎたら少し離れる。相談の間は足を止める
  let sepX=0, sepY=0;   /* v5.0 「くっつきすぎない」力は、足を止めて話している間も効かせる(重ならずに向き合って立つ) */
  { const waiting=!!(B.party&&B.party.denRole&&denWaits(B.party.denRole).includes(p.hi));   // v3.2 外で待つ役は引っぱられない(自分で口の前を歩いて間合いを取る)
    const o=waiting?null:partnerFor(p); if(o){ const ddx=o.x-p.x, ddy=o.y-p.y, dd=Math.hypot(ddx,ddy)||1;
      const sep=(HEROES[p.id]&&HEROES[p.id].heatShy&&HEROES[o.id]&&HEROES[o.id].hot)?BAL.KUU_SEP:BAL.PARTY_SEP;   // v5.0 熱い相方とだけは広く取る
      if(dd>BAL.PARTY_LEASH){ const w=Math.min(1.4,(dd-BAL.PARTY_LEASH)/200); dx+=ddx/dd*w; dy+=ddy/dd*w; }
      else if(dd<sep && attachCount(p)===0 && !p.assist){ const k=BAL.PARTY_SEP_K*(1-dd/sep); sepX=-ddx/dd*k; sepY=-ddy/dd*k; dx+=sepX; dy+=sepY; } } }   // v5.0 くっつきすぎない(かばう時は除く)
  /* v5.0 暑がりは、熱いヒロインが寄ってくると横へ滑って離れる(溶けるので) */
  if(HEROES[p.id]&&HEROES[p.id].heatShy && attachCount(p)===0 && !p.assist){
    const F=B.heroes.find(h=>(HEROES[h.id]||{}).hot&&!h.out);
    if(F){ const hx=p.x-F.x, hy=p.y-F.y, hd=Math.hypot(hx,hy)||1;
      if(hd<BAL.KUU_MELT_R*1.4){ const w=BAL.KUU_MELT_K*(1-hd/(BAL.KUU_MELT_R*1.4)); dx+=hx/hd*w; dy+=hy/hd*w; } } }
  if(B.party && B.time<B.party.talkUntil && attachCount(p)===0 && threat<0.6){ dx=dx*0.05+sepX; dy=dy*0.05+sepY; state='talk'; const o=partnerFor(p); if(o && Math.abs(o.x-p.x)>6) p.face=o.x>p.x?1:-1; }   // v3.1 話す間は相手の方を向く(v5.0 離れる力だけは残す)
  /* v5.2 覚えた菌輪は、歩く時も迂回する。目当てから外すだけでは、輪の上を通り抜けてしまっていた */
  if(ringKnown() && B.rings && B.rings.length && attachCount(p)===0 && !p.pinned){
    for(const R of B.rings){
      if(R.state==='cool') continue;
      const rx=p.x-R.x, ry=(p.y-R.y)/0.78, rd=Math.hypot(rx,ry)||1, near=R.r*BAL.MRING_AVOID_R;
      if(rd<near){
        const w=BAL.MRING_AVOID_K*(1-rd/near);
        /* 真正面から押し返すだけだと、行きたい向きと正面衝突してその場で止まる。
           縁に沿って回り込む成分(接線)を主にして、行きたい方に近い側へ流す */
        const tx=-ry/rd, ty=rx/rd, sgn=(tx*dx+ty*dy)>=0?1:-1;
        dx+=(rx/rd*0.5 + tx*sgn)*w;
        dy+=(ry/rd*0.5 + ty*sgn)*w*0.78;
      }
    }
  }
  /* v5.6 媚薬沼を避ける。BAL.MIRE_FEAR は定数だけあって一度も読まれておらず、
     沼を嫌う仕組みは「中に落ちている物の価値を割り引く」だけだった——
     だから縁を平気で歩き、触手に足首を取られていた。
     菌輪と同じく接線を主にして縁を回り込む。浸かってしまった時は、いちばん近い外へ。
     やむを得ない時(いま目当てがその沼の中にある/逃げている最中)は弱める。 */
  if(B.mires && B.mires.length && !p.pinned && state!=='struggle'){
    const fleeing=(state==='abort'||state==='retreat'||state==='flee');
    const burning=!!(B.dryAura && B.dryAura.hi===p.hi && (META.gen.dryLesson|0)>0);   /* v5.8 炎をまとって歩いている(一度こぼした後) */
    for(const m of B.mires){
      if(m.dry||m.iced) continue;
      const rx=p.x-m.x, ry=(p.y-m.y)/0.78, rd=Math.hypot(rx,ry)||1;
      /* ★v6.3 この判定を「浸かっている」より先に置く。
         後ろにあると、沼の中の宝箱へ向かう時だけ避けを切っておきながら、
         一歩でも浸かった瞬間に押し出しが働いて、縁で行ったり来たりになる。
         実測(沼の真ん中に宝箱を置く): 縁の出入り 15.4回・届いたのは 3/8・
         いちばん近づいて 101px。浅瀬(足が鈍る)と重なるとさらに悪い */
      if(p.goal && mireAt(p.goal.x,p.goal.y)===m) continue;   /* その沼の中に用がある時だけは避けない */
      if(rd<m.r){                                    /* もう浸かっている: 外へ出る */
        const w=BAL.MIRE_OUT_K*(0.55+0.45*m.depth);
        dx+=rx/rd*w; dy+=ry/rd*w*0.78;
        continue;
      }
      /* v5.8 炎をまとっている間は、触れただけで沼が蒸発して外まで撒き散らす。
         だから炎の届く距離ぶん、大きく回り込む。焚く判断のほうを直しても、
         焚いた後に沼のほうへ歩いて行けば同じことになる——足のほうも直す。 */
      let near=m.r*BAL.MIRE_AVOID_R, kk=BAL.MIRE_AVOID_K;
      if(burning){ near=Math.max(near,(BAL.DRY_AURA_R+m.r)*BAL.DRY_MIRE_AVOID); kk=BAL.DRY_MIRE_AVOID_K; }
      if(rd<near){
        const w=kk*(1-rd/near)*(0.6+0.4*m.depth)*(BAL.MIRE_FEAR*0.5)*(fleeing?BAL.MIRE_FLEE_MUL:1);
        const tx=-ry/rd, ty=rx/rd, sgn=(tx*dx+ty*dy)>=0?1:-1;
        dx+=(rx/rd*0.5 + tx*sgn)*w;
        dy+=(ry/rd*0.5 + ty*sgn)*w*0.78;
      }
    }
  }
  p.steerX=dx; p.steerY=dy; p.steerState=state; p.threatV=threat;   // v3.1 脅威の見積もりを残す(集合の判定に使う)
}

/* 知っている(理解以上)罠のそば */
/* v2.0 淫紋への知識: 刻印師の知識か、紋の罠に掛かった回数(1=認識 / 3=理解 / 6=熟知)。認識で罠を避け、理解で呪弾を強く外し、熟知なら4割で紋を払う */
function crestKnow(){ const k=((META.gen.trapKnow||{}).rune)||0; return Math.max(knowLv('runemage'), knowLv('guardian'), k>=6?3:(k>=3?2:(k>=1?1:0))); }
function learnTrap(kind){ META.gen.trapKnow=META.gen.trapKnow||{}; META.gen.trapKnow[kind]=(META.gen.trapKnow[kind]||0)+1; }
function nearKnownTrap(x,y){
  const B=G.B, ds=(typeof darkSense==='function')?darkSense(x,y):1;   // v4.0 暗いと気づくのが遅れる
  for(const e of B.enemies){
    if(e.dead||!TRAP_SPECIES.has(e.id)) continue;
    if(knowLv(e.id)<2) continue;
    if(Math.hypot(e.x-x,e.y-y)<95*ds) return true;
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
    const swarm=!grabber && !!(p.assist && Math.hypot(e.x-p.assist.x,e.y-p.assist.y)<BAL.COVER_ENEMY_R);   // v4.0 相方に群がっている魔物
    if(e.dead||e.dormant||(e.state==='attached'&&!grabber)) continue;
    if(e.id==='yamiboss' && (e.meltT||0)>0) continue;   // v5.0 闇に溶けている間は、そこに居ない
    if(!inSight(e,p)) continue;                       // 見えていない敵は撃てない
    let d=Math.hypot(e.x-p.x,e.y-p.y); if(grabber) d*=0.25;
    // 魅了された相手は狙いが後回し(距離に下駄)。理解した脅威は優先討伐(距離を差し引く)
    let prio=knowLv(e.id)>=2?(SPEC_THREAT[e.id]||0)*90:0;
    if(B.coreWar && e.id==='core') prio+=BAL.CORE_FOCUS_D;   // v4.0 魔核戦: 取り巻きより先に、心臓を削る
    if(swarm) prio+=BAL.COVER_FOCUS_D;                       // v4.0 カバー: 相方に群がっているものを先に散らす
    arr.push({e, d:d+charmLvFor(p,e)*140-prio});
    if(d>=maxD) arr.pop();
  }
  arr.sort((a,b)=>a.d-b.d);
  return arr.slice(0,n).map(o=>o.e);
}
/* v1.9 武器の覚醒(Lv6〜8): 従来の式は Lv5 で止め、超えた段ぶんを火力・間隔・範囲に掛ける(進化後も効く) */
/* Lv6〜8 の覚醒。★v6.4 持ち主に fullBloom があるなら、上限(FULL_LV)に届いた武器は更に一段跳ねる。
   ヤミコは Lv5 から始まって札が出にくいので、伸びしろが「上限に届くかどうか」の一点に寄っている */
function wpOver(lv,p){
  const ov=Math.max(0,lv-BAL.WP_EVO_LV);
  const o={dmg:1+BAL.WP_OVER_DMG*ov, cd:Math.pow(BAL.WP_OVER_CD,ov), area:1+BAL.WP_OVER_AREA*ov};
  if(p && lv>=BAL.FULL_LV && (HEROES[p.id]||{}).fullBloom){ o.dmg*=BAL.FULL_DMG; o.cd*=BAL.FULL_CD; o.area*=BAL.FULL_AREA; }
  return o;
}
function weaponsUpdate(dt){
  const B=G.B, p=B.hero;
  const atkMult=((p.pinned||p.charmBind||p.climaxT>0||p.freezeT>0||p.begT>0||p.selfT>0||p.sniffT>0||p.bathT>0||p.poolT>0||p.readT>0)?0:1)*Math.pow(0.75,armCount(p))   // 腕を拘束されるほど攻撃が乱れる
    *(p.waveDur>0?BAL.WAVE_ATK:1)                                           // 発情の波の間は手が止まりがち
    *(p.numbT>0?0.5:1)                                                      // 痺れ: 指が動かない
    *(1+0.08*p.ps.haste)                                                    // クイックリボン
    *(p.iceBless>0?1.10:1);                                                 // v5.0 静止の一点の加護
  if(atkMult<=0) return;
  if(p.id==='freila') freilaWeapons(p,dt,atkMult);   // v3.0 火の武器
  if(p.id==='kuu') kuuWeapons(p,dt,atkMult);          // v5.0 氷の武器
  if(p.id==='yamiko') yamiWeapons(p,dt,atkMult);      // v5.0 闇の武器
  if(p.wp.bolt>0){
    p.boltT-=dt*atkMult;
    if(p.boltT<=0){
      const evo=p.evo.sstar>0;
      const lvR=p.wp.bolt, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
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
      const lvR=p.wp.nova, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
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
      const evo=p.evo.srush>0, lvR=p.wp.whip, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
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
      const evo=p.evo.scomet>0, lvR=p.wp.rain, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
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
      const evo=p.evo.sjudge>0, lvR=p.wp.cross, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
      const ts=nearestEnemies(1,500);
      if(ts.length && B.bullets.length<170){
        p.crossT=(evo?1.3:1.7)*Math.pow(0.9,lv-1)*ov.cd;
        const a=Math.atan2((ts[0].y-ts[0].r)-(p.y-12), ts[0].x-p.x);
        const sp=evo?430:360;
        /* ★v6.3 相手は 500px まで探すのに、折り返しが 0.42秒固定だった。
           360px/s × 0.42s = 約150px しか飛べず、実測で 260px の的には一度も届いていない。
           狙った相手まで届く分だけ飛んでから折り返す(上限あり) */
        const td=Math.hypot(ts[0].x-p.x, (ts[0].y-ts[0].r)-(p.y-12));
        const retT=Math.max(evo?0.55:0.42, Math.min(BAL.CROSS_RET_MAX, td/sp));
        const nC=1+Math.floor(lv/3)+dupN(p);   /* 弾数: Lv3で2枚、Lv6以上で3枚 */
        /* ★v6.3 扇の開きが「角度の固定値 0.4rad」だったので、枚数が2枚以上になると
           どの一枚も狙った線に乗らない。260px 先では ±52px ずれて、実測で一度も当たらなかった。
           ★これは弾数を増やす前からの穴でもある——ふたごの鏡を取ると枚数が増えて、
           十字が当たらなくなっていた。ずらす量を「的の位置での横のずれ px」で決める */
        const fan=Math.atan2(BAL.CROSS_FAN_PX, Math.max(60,td));
        for(let i=0;i<nC;i++){
          const a2=a+(i-(nC-1)/2)*fan*2;
          B.bullets.push({kind:'cross', x:p.x, y:p.y-12, vx:Math.cos(a2)*sp, vy:Math.sin(a2)*sp,
            spd:sp, dmg:(evo?20:9+4*(lv-1))*ov.dmg, retT, ret:false, life:retT*2+0.9, last:null, evo});
        }
        sfx(320,180,0.12,'square',0.04);
        if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN);
      }else p.crossT=0.15;
    }
  }
  /* --- せいいき: 常時の光の領域。触れた敵を焼き続ける。進化=広域+自己回復 --- */
  if(p.wp.sanct>0){
    const evo=p.evo.gsanct>0, lvR=p.wp.sanct, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
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
      const evo=p.evo.kblade>0, lvR=p.wp.blade, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
      p.bladeT=(evo?0.42:0.85)*Math.pow(0.9,lv-1)*ov.cd;
      const n=(evo?4:1+Math.floor(lv/2))+dupN(p);
      /* ★v6.3 前は vx=±sp、vy≈0 の「真横」にしか飛ばず、少しでも斜めに居る相手には
         当たらなかった(実測 12秒で 103点。全29本中の最下位)。
         「むいた方向へ刃をとばす」の「むいた方向」を、狙う相手の方に取り直す */
      const tg=nearestEnemies(1, BAL.BLADE_R*(1+0.12*(p.ps.reach||0)))[0];
      const base=tg?Math.atan2(tg.y-(p.y-14), tg.x-p.x):(p.face>=0?0:Math.PI);
      /* 扇の開きは、的の位置での横のずれ px で決める(十字と同じ理由。角度固定だと遠いほど外れる) */
      const td2=tg?Math.max(60,Math.hypot(tg.x-p.x,tg.y-(p.y-14))):160;
      const fan=Math.atan2(BAL.BLADE_FAN_PX, td2);
      const dirs=evo?[base, base+Math.PI]:[base];
      for(const dir of dirs){
        for(let i=0;i<n;i++){
          if(B.bullets.length>=170) break;
          const a2=dir+(i-(n-1)/2)*fan*2;
          const sp=580;
          B.bullets.push({kind:'blade', x:p.x+Math.cos(dir)*8, y:p.y-14+Math.sin(dir)*8, vx:Math.cos(a2)*sp, vy:Math.sin(a2)*sp,
            dmg:(evo?16:10+3*(lv-1))*ov.dmg, pierce:(evo?3:1)+(p.ps.pierce||0), life:1.15, last:null, evo});
        }
      }
      if(tg) p.face=Math.cos(base)>=0?1:-1;
      sfx(700,300,0.06,'square',0.03);
      if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN*0.6);
    }
  }
  /* --- てんらい: 見えている敵の頭上に雷を落とす(ランダム)。進化=一斉 --- */
  if(p.wp.thunder>0){
    p.thunderT-=dt*atkMult;
    if(p.thunderT<=0){
      const evo=p.evo.judgment>0, lvR=p.wp.thunder, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
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
      const evo=p.evo.hchain>0, lvR=p.wp.chain, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
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
      const evo=p.evo.twinspirit>0, lvR=p.wp.spirit, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
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
    const evo=p.evo.aegis>0, lvR=p.wp.shield, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
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
      const evo=p.evo.spring>0, lvR=p.wp.holy, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
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
/* v5.0 クウの武器。彼女自身の火力は三人でいちばん低い代わりに、
   敵を鈍く・脆く・凍らせ、味方には回る氷と伴走弾を配る */
function kuuWeapons(p,dt,atkMult){
  const B=G.B;
  /* 氷の針: 追尾する細い針 */
  if(p.wp.ineedle>0){
    p.ineedleT-=dt*atkMult;
    if(p.ineedleT<=0){
      const lvR=p.wp.ineedle, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
      const shots=2+(lv>>1)+dupN(p);
      const ts=nearestEnemies(shots, 480*(1+0.12*(p.ps.reach||0)));
      if(!ts.length) p.ineedleT=0.12;
      else{
        p.ineedleT=0.80*Math.pow(0.90,lv-1)*ov.cd;
        const dmg=(8+3*(lv-1))*ov.dmg;
        for(const t of ts){ const a=Math.atan2(t.y-(p.y-14),t.x-p.x);
          B.bullets.push({x:p.x, y:p.y-14, vx:Math.cos(a)*430, vy:Math.sin(a)*430, dmg, pierce:(p.ps.pierce||0), life:1.3, last:null, kind:'ineedle', ice:true, chill:BAL.ICE_CHILL_T}); }
        S.pew(); if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN);
      }
    }
  }
  /* 冷気の帳: 常時オーラ。鈍らせ、脆くする。フレイラのそばでは縮む */
  if(p.wp.ifield>0){
    const evo=p.evo.blizzard>0, lvR=p.wp.ifield, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
    let R=(90+14*lv)*areaMult(p)*ov.area*(evo?1.45:1);
    R*=(1-0.45*kuuHeatAt(p.x,p.y));
    p.ifieldR=R;
    p.ifieldT-=dt*atkMult;
    if(p.ifieldT<=0){
      p.ifieldT=0.35*ov.cd;
      for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue;
        if(Math.hypot(e.x-p.x,e.y-p.y)<R+e.r){
          e.chillT=Math.max(e.chillT||0, evo?1.8:BAL.ICE_CHILL_T);
          e.vulnT=Math.max(e.vulnT||0,1.2);
          damageEnemy(e,(1.5+0.6*(lv-1))*ov.dmg);
          if(evo){ e.inFieldT=(e.inFieldT||0)+0.35;
            if(e.inFieldT>=2.5){ e.inFieldT=0; freezeEnemy(e,1.4);
              B.fx.push({kind:'iceshatter',x:e.x,y:e.y-e.r*0.5,r:e.r+8,t:0,life:0.5}); } }
        } else if(e.inFieldT) e.inFieldT=Math.max(0,e.inFieldT-0.35);
      }
    }
  } else p.ifieldR=0;
  /* 霜の華: 敵の足元に置く凍結ゾーン。進化すると床ごと凍って残る */
  if(p.wp.ibloom>0){
    p.ibloomT-=dt*atkMult;
    if(p.ibloomT<=0){
      const evo=p.evo.glacier>0, lvR=p.wp.ibloom, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
      p.ibloomT=(3.0-0.22*(lv-1))*ov.cd;
      const n=1+dupN(p)+(lv>=4?1:0);
      const ts=nearEnemiesR(p,n,(250+18*lv)*(1+0.12*(p.ps.reach||0)));   /* v6.3 実測で 260px に届いていなかった */
      for(const e of ts){
        if(B.zones.length>24) B.zones.shift();
        const zr=(34+5*lv)*areaMult(p)*ov.area*(evo?1.5:1);
        B.zones.push({x:e.x, y:e.y, r:zr, t:0, life:evo?6.5:4.0, dmg:(2.0+0.8*(lv-1))*ov.dmg, tick:0, ice:true, froze:[]});
        B.fx.push({kind:'icebloom', x:e.x, y:e.y, r:zr, t:0, life:0.6});
        pushLight(e.x,e.y,150,BAL.DARK_MEM_T*0.7,0.8);
        if(evo && iceList().length<BAL.ICE_MAX) icePaintDisc(e.x,e.y,zr*0.7);
      }
      if(ts.length) sfx(1200,420,0.18,'triangle',0.045);
    }
  }
  /* 氷衛: 味方全員の周りを回る氷。触れた敵を止めて割れる */
  if(p.wp.iorbit>0){
    const evo=p.evo.aurora>0, lvR=p.wp.iorbit, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
    const n=Math.min(8,(evo?4:2)+(lv>>1)+dupN(p)), R=(56+5*lv)*areaMult(p)*ov.area;
    p.iorbAng+=dt*1.5;
    for(const h of B.heroes){
      if(h.out){ h.iceOrb=null; continue; }
      if(!h.iceOrb || h.iceOrb.n!==n) h.iceOrb={n, cd:new Array(n).fill(0), r:R, ang:0, evo};
      const O=h.iceOrb; O.r=R; O.evo=evo; O.ang=p.iorbAng+h.hi*0.7;
      for(let i=0;i<n;i++) if(O.cd[i]>0) O.cd[i]-=dt;
    }
    p.iorbitT-=dt*atkMult;
    if(p.iorbitT<=0){
      p.iorbitT=0.25;
      const dmg=(6+2.2*(lv-1))*ov.dmg;
      for(const h of B.heroes){
        if(h.out||!h.iceOrb) continue;
        const O=h.iceOrb, reach=O.r+34, near=[];
        for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue;
          if(Math.abs(e.x-h.x)>reach+e.r||Math.abs(e.y-h.y)>reach+e.r) continue; near.push(e); }
        if(!near.length) continue;
        for(let i=0;i<O.n;i++){
          if(O.cd[i]>0) continue;
          const a=O.ang+i*TAU/O.n, sx=h.x+Math.cos(a)*O.r, sy=(h.y-10)+Math.sin(a)*O.r*0.78;
          for(const e of near){
            if(Math.hypot(e.x-sx,(e.y-e.r*0.4)-sy)<16+e.r*0.5){
              const ci0=B.ci; B.ci=p.hi; damageEnemy(e,dmg); B.ci=ci0;
              e.chillT=Math.max(e.chillT||0,BAL.ICE_CHILL_T);
              e.stun=Math.max(e.stun||0,0.25);
              if(O.evo){ freezeEnemy(e,0.6); h.ifr=Math.max(h.ifr,0.35); }   // 極光は一撃を代わりに受ける
              O.cd[i]=BAL.ICE_ORB_CD;
              parts(sx,sy,6,['#bfeaff','#fff','#7fe8dd'],120,0.45);
              B.fx.push({kind:'iceshatter',x:sx,y:sy,r:14,t:0,life:0.35});
              sfx(1500,700,0.07,'triangle',0.03);
              break;
            }
          }
        }
      }
    }
  } else { for(const h of B.heroes) h.iceOrb=null; }
  /* 氷の追い矢: 味方の直進弾に、淡い青の弾を並べる */
  if(p.wp.iecho>0){
    const lvR=p.wp.iecho, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
    const n=(lv>=5?2:1)+((p.ps.dup||0)>=2?1:0), dmg=(5+2.0*(lv-1))*ov.dmg;
    for(const h of B.heroes) h.iceEcho=(h===p||h.out)?null:{n, dmg, chill:BAL.ICE_CHILL_T};
  } else { for(const h of B.heroes) h.iceEcho=null; }
}
/* 味方の撃った弾に、氷の伴走弾を並べる(直進弾のみ) */
function iceEchoSpawn(h,n0,dt){
  const B=G.B, E=h.iceEcho; if(!E) return;
  if(h.echoCd>0){ h.echoCd-=dt; return; }
  const m=B.bullets.length-n0; if(m<=0||B.bullets.length>130) return;
  let made=0;
  for(let k=n0;k<B.bullets.length&&made<E.n;k++){
    const b=B.bullets[k];
    if(b.kind&&b.kind!=='ineedle') continue;   // 落下星・精霊・十字のような特殊軌道は真似しない
    if(b.iceEcho) continue;
    const s=(made%2)?0.18:-0.18, c=Math.cos(s), sn=Math.sin(s);
    B.bullets.push({x:b.x, y:b.y, vx:(b.vx*c-b.vy*sn)*0.9, vy:(b.vx*sn+b.vy*c)*0.9,
      dmg:E.dmg, pierce:0, life:b.life*0.9, last:null, hi:h.hi, ice:true, iceEcho:true, chill:E.chill});
    made++;
  }
  if(made) h.echoCd=BAL.ICE_ECHO_CD;
}
function freilaWeapons(p,dt,atkMult){
  const B=G.B;
  if(p.wp.fsword>0){
    p.fswordT-=dt*atkMult;
    if(p.fswordT<=0){
      const evo=p.evo.inferno>0, lvR=p.wp.fsword, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
      p.fswordT=(evo?0.6:0.85)*Math.pow(0.91,lv-1)*ov.cd;
      p.fswordSide*=-1;
      /* v6.3 熱: 前に出て当て続けるほど剣が熱くなる。切れると冷める。
         ★これが無いと、炎の剣はルミナのムチを橙色にしただけの札だった。
         「気が強く、前に出る」を数値にする——退がると失う、という形で */
      const heat=Math.min(1,(p.flameHeat||0)/BAL.FLAME_MAX);
      const range=(evo?150:90+10*lv)*areaMult(p)*ov.area, half=(evo?150:50+5*lv)*areaMult(p)*ov.area,
            dmg=(evo?26:12+5*(lv-1))*ov.dmg*(1+BAL.FLAME_DMG*heat);
      p.whipAnim=0.16; p.whipDir=evo?0:(p.fswordSide>0?p.face:-p.face); p.whipR=range; p.whipFire=true;
      let hit=false;
      for(const e of B.enemies){ if(e.dead||e.dormant) continue; const ex=e.x-p.x, ey=e.y-(p.y-10); const inArc=evo?Math.hypot(ex,ey)<range+e.r:(ex*p.whipDir>0 && Math.abs(ex)<range+e.r && Math.abs(ey)<half+e.r); if(inArc){ damageEnemy(e,dmg); hit=true; if(evo) e.burnT=Math.max(e.burnT||0,2.5); } }
      for(const pr of B.props){ const ex=pr.x-p.x, ey=pr.y-(p.y-10); const inArc=evo?Math.hypot(ex,ey)<range:(ex*p.whipDir>0&&Math.abs(ex)<range&&Math.abs(ey)<half); if(inArc) damageProp(pr,dmg); }
      if(hit){ sfx(200,90,0.1,'sawtooth',0.05); parts(p.x+(p.whipDir||1)*range*0.5,p.y-10,6,['#ff7a3a','#ffd76a'],120,0.4); if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN);
        p.flameHeat=Math.min(BAL.FLAME_MAX,(p.flameHeat||0)+1); p.flameT=BAL.FLAME_KEEP;
        /* 熱が満ちた一振りは、通った床を焼いて残す */
        if(p.flameHeat>=BAL.FLAME_MAX){
          if(B.zones.length>24) B.zones.shift();
          const fx2=p.x+(p.whipDir||1)*range*0.55;
          B.zones.push({x:fx2, y:p.y-6, r:(26+3*lv)*areaMult(p), t:0, life:BAL.FLAME_FLOOR_T, dmg:dmg*0.30, tick:0, fire:true});
          floatTxt(p.x,p.y-62,'焼ける','#ffb060',10,0.6);
        } }
    }
  }
  if(p.wp.fring>0){
    const evo=p.evo.corona>0, lvR=p.wp.fring, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
    /* v6.3 熱を分け合う: 剣で溜めた熱ぶん、輪が広がって速く回る。
       ★これが無いと、火の輪はルミナのオーブを線にしただけだった。
       二本を繋げることで「前に出るほど強い子」という一つの形になる */
    const fh=Math.min(1,(p.flameHeat||0)/BAL.FLAME_MAX);
    p.fringAng+=dt*(evo?2.6:2.2)*(1+0.5*fh);
    const R=(evo?96:52+7*lv)*areaMult(p)*ov.area*(1+BAL.FLAME_RING*fh), band=(evo?22:14)+2*lv, dmg=(evo?9:4+1.5*(lv-1))*ov.dmg*(1+0.35*fh);
    p.fringR=R; p.fringT-=dt*atkMult;
    if(p.fringT<=0){ p.fringT=0.3*ov.cd; for(const e of B.enemies){ if(e.dead||e.dormant) continue; const d=Math.hypot(e.x-p.x,e.y-(p.y-10)); if(Math.abs(d-R)<band+e.r*0.5){ damageEnemy(e,dmg); if(evo) e.stun=Math.max(e.stun||0,0.35); } } }
  } else p.fringR=0;
  if(p.wp.fburst>0){
    p.fburstT-=dt*atkMult;
    if(p.fburstT<=0){
      const evo=p.evo.eruption>0, lvR=p.wp.fburst, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
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
      const lvR=p.wp.fpillar, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
      p.fpillarT=(2.6-0.2*(lv-1))*ov.cd;
      const n=1+(p.ps.dup||0)+(lv>=4?1:0), ts=nearEnemiesR(p,n,(220+16*lv)*(1+0.12*(p.ps.reach||0)));   /* v6.3 実測で 260px に届いていなかった */
      for(const e of ts){ if(B.zones.length>24) B.zones.shift(); B.zones.push({x:e.x, y:e.y, r:(30+4*lv)*areaMult(p)*ov.area, t:0, life:2.2, dmg:(6+2.5*(lv-1))*ov.dmg, tick:0, fire:true}); parts(e.x,e.y-10,10,['#ff7a3a','#ffd76a','#fff'],140,0.5); pushLight(e.x,e.y,170,BAL.DARK_MEM_T*0.8,0.95); }   // v4.0 炎が通った所はしばらく見えている
      if(ts.length) sfx(300,120,0.2,'square',0.04);
    }
  }
  if(p.wp.fwing>0){
    p.fwingT-=dt*atkMult;
    if(p.fwingT<=0 && attachCount(p)===0 && !p.pinned){
      const lvR=p.wp.fwing, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
      const ts=nearEnemiesR(p,1,150+15*lv);
      if(ts.length){ p.fwingT=(4.5-0.35*(lv-1))*ov.cd; const e0=ts[0]; const dxv=e0.x-p.x, dyv=e0.y-p.y, L=Math.hypot(dxv,dyv)||1; const len=Math.min(L+40,120+10*lv); const q=snapFloor(clampMapX(p.x+dxv/L*len,30),clampMapY(p.y+dyv/L*len,30),false,3);
        /* v6.2 突進も瞬間移動と同じで、reachableAt だけでは壁の向こうへ抜ける。
           焔の線を引く相手でもあるので、途中に壁が無いことを確かめる */
        if(q && reachableAt(q.x,q.y,false) && losClear(p.x,p.y,q.x,q.y,false)){ const x0=p.x, y0=p.y, vx=q.x-x0, vy=q.y-y0, LL=Math.hypot(vx,vy)||1, dmg=(10+4*(lv-1))*ov.dmg;
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
/* v6.4 いま取れる強化の一覧。レベルアップの札の元でもあり、「伸びしろが尽きたか」の判定でもある */
function upgAvail(){
  const B=G.B; if(!B) return [];
  const inParty=id=>B.heroes.some(h=>h.id===id);
  const wpCountOf=h=>Object.keys(h.wp).filter(k=>h.wp[k]>0).length;
  const psCount=Object.values(B.heroes[0].ps).filter(v=>v>0).length;
  return Object.keys(UPG).filter(k=>{
    if(UPG[k].kind==='wp'){ const own=UPG[k].owner||'lumina'; if(!inParty(own)) return false; const h=heroOf(k); if(h.wp[k]>=upgMax(k)) return false; if(h.wp[k]===0 && wpCountOf(h)>=BAL.WP_SLOTS) return false; return true; }   // v3.0 武器はそのヒロインの枠(v6.0 枠は BAL.WP_SLOTS)
    if(curLv(k)>=upgMax(k)) return false;
    if(UPG[k].kind==='ps' && curLv(k)===0 && psCount>=BAL.PS_SLOTS) return false;   // パッシブ枠(v6.0 BAL.PS_SLOTS。共通)
    return true;
  });
}
function upgPool(){ return upgAvail().concat(readyEvos().map(k=>'EVO:'+k)); }
/* ★v6.4 伸びしろが尽きた = 武器もパッシブも進化も、取れるものが一つも無い。
   この時の彼女は「もう強くなれない代わりに、いまが最強」。だから
   降り口を見つけたら軽く見て降りるし、危ない所へも踏み込む */
function growthDone(){
  const B=G.B; if(!B) return false;
  if(B.growT!==undefined && B.time-B.growT<1.0) return !!B.growDone;   // 1秒に一度で足りる
  B.growT=B.time; B.growDone=(upgPool().length<=BAL.FULL_SLACK);
  return B.growDone;
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
  const avail=upgAvail();
  const pool=upgPool();
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
      if(UPG[k].kind==='wp'){ const HD=HEROES[UPG[k].owner||'lumina']||{}; if(HD.pickPenalty) w*=HD.pickPenalty; }   // v5.0 最初から育っている子の札は出にくい
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
/* v6.0 飽和の閾値は深さ連動。絶対値のままだと深い階ほど不利で、
   実測で「深層ほどレベルが伸びない」形になっていた。
   ★「その深さに対して育ちすぎている時だけ」効かせる */
const softDepth=()=>{ const F=(G.B&&G.B.floor)||(typeof curFloor==='function'?curFloor():null); return Math.max(0,((F&&F.depth)||1)-1); };
const xpSoftLv=()=>BAL.XP_SOFT_LV+BAL.XP_SOFT_DEPTH*softDepth();
const needSoftLv=()=>BAL.NEED_SOFT_LV+BAL.NEED_SOFT_DEPTH*softDepth();
const xpSoft=p=>1/(1+BAL.XP_SOFT_K*Math.max(0,(p.level||1)-xpSoftLv()));   // v2.1 成長の飽和(v6.0 深さ連動)
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
    heroBubble(p,{freila:'……熱い。いい火', kuu:'……かたちが、変わった', yamiko:'……ああ。これ、思い出した'}[p.id]||'ちからが、あふれてくる…!',true);
    parts(p.x,p.y-16,30,['#fff','#ffd76a','#8fd3ff'],220,0.8);
    return;
  }
  if(UPG[k].kind==='wp'){   // v3.0 武器は持ち主だけ
    const p=heroOf(k); applyUpgStat(p,k);
    /* ★v6.4 満ちた武器: 素性に fullBloom がある子(ヤミコ)が上限に届いた一段は、見た目も台詞も別にする */
    const full=!!(HEROES[p.id]||{}).fullBloom && curLv(k)>=BAL.FULL_LV;
    floatTxt(p.x,p.y-64,UPG[k].name+' Lv'+curLv(k)+(full?' 満ちた!!':(curLv(k)>BAL.WP_EVO_LV?' 覚醒!':'!')),full?'#c98cff':'#ffd76a',full?15:13,full?2.0:1.5);
    if(full){ setBanner('闇が満ちた', p.name+' — '+UPG[k].name+'。上限に届いた','#c98cff'); parts(p.x,p.y-16,34,['#c98cff','#2a1a3e','#fff'],240,1.0); }
    heroBubble(p,full?'……満ちた。ここまでは、何度も来ている':({freila:'……よし', kuu:'……ん', yamiko:'……悪くない'}[p.id]||'つよくなった♪'),true);
  } else {                  // パッシブは全員に効く
    for(const h of B.heroes){ applyUpgStat(h,k); if(k==='vital'){ h.hp=Math.min(h.maxHp,h.hp+25); } }
    const p=B.heroes[leaderIdx()]; floatTxt(p.x,p.y-64,UPG[k].name+' Lv'+curLv(k)+'!','#ffd76a',13,1.5);
    heroBubble(p,{freila:'……全員、少し強くなった', kuu:'……みんな、すこし', yamiko:'……全員ぶん。効いてる'}[p.id]||'みんな、つよくなった♪',true);
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
  /* v6.0f 14階「厚みの中」の法(待ち): この階に追ってくるものは一体も居ない。
     出された動く種は壁に吸われ、据わったものへ変わって、待ち手の道に並ぶ。
     ★ボスと魔核戦は除く——この法は「階を渡ること」に掛かるもので、
       心臓自身の戦いに掛かるものではない。骨兵の番人(v6.0e)と同じ線引き。
       ここを外すと、世代12の魔核戦(＝最深階が14階になる唯一の世代)だけが
       静かに無効試合になる。
     ★F0.final(＝この階が最深＝心臓がここに居る)でも法を止める。
       coreWar の番人だけでは足りなかった——魔核戦に入る前に湧いたぶんが
       据わったまま残り、戦いのあいだ何もしない傍観者になる。
       実測: 世代12 の毎秒が 270→395(線0)・307→456(線6)、余裕が 0.92→1.02 に跳ねた。
       深いほど苦しいはずの曲線で、最深の世代だけが一番楽になっていた。
       厚みの中は心臓の身の内側だ。心臓自身がそこに居る夜は、身も据わってはいない。
     ★ここは rankPick より前。あとの処理は全部この id で走らせる。
     ★石の番兵(guardian)も除く。番兵は「全員沈黙させるまで降り口が使えない」
       仕掛けそのものなので、据わらせると降り口が永久に開かなくなる——
       いまは !M0.guardian が偶然そこを守っているだけなので、理由をここに残す */
  { const B0=G.B, F0=B0&&B0.floor, M0=MONSTERS[id];
    if(F0&&F0.sit&&!F0.final&&!B0.coreWar&&!o.parent&&M0&&!M0.boss&&!M0.item&&!M0.guardian&&M0.spd>0){
      const L=SIT_SUBS[tierOf(id)];
      if(L&&L.length){ const sub=L[(Math.random()*L.length)|0]; if(MONSTERS[sub]){ id=sub; o=Object.assign({},o,{noRank:true}); } }
      const P=G.map&&G.map.seatPath;
      if(P&&P.length){ const q=P[(Math.random()*P.length)|0], g=snapFloor(q.x+rand(-46,46), q.y+rand(-46,46), false, 3); if(g){ x=g.x; y=g.y; } }
    } }
  /* v6.0 深いほど「熟れた個体」に差し替わる。★頭数ではなく格で押すのが深階の設計なので、
     ここは召喚コストを増やさない(EN は呼んだ側の id で既に払われている)。
     差し替えは種の同一性を壊さない——絵も本文も図鑑も base のまま */
  if(!o.noRank && !MONSTERS[id].variant && !MONSTERS[id].boss && !MONSTERS[id].guardian && !MONSTERS[id].item){
    const FD=(G.B&&G.B.floor)||curFloor(); id=rankPick(id, FD.depth);
  }
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
  const fhp=MONSTERS[id].guardian?1:F.mon.hp*(F.affinity.includes(id)?BAL.FLOOR_AFFINITY:1)*eraMul(F.depth), fdm=MONSTERS[id].guardian?1:F.mon.dmg*eraMul(F.depth);   // v3.0 世代の深さ倍率(v6.0 深い階では二重取りを緩める)
  /* ★熟れた個体は「別の種」にしない。数値だけ上の定義から取り、
     u.id には base を入れる——挙動の分岐(e.id==='gtent' 等)が数十箇所あるので、
     ここで id を変えると上位個体だけ挙動が既定に落ちる(見た目では気づけない)。
     段ぶんの差(四肢の本数・扇の枚数・寸止めの長さ)は u.rank と下の値で足す */
  const RV=MONSTERS[id].variant?RANK_BASE[id]:null;
  const baseId=RV?RV.base:id;
  const u={
    id:baseId, x, y,
    rid:RV?id:null,                     /* 熟れた個体の id(名札と観測記録だけが使う) */
    art:baseId,                         /* 絵は base で引く(熟れた個体でも骨格は同じ) */
    rank:RV?RV.rank:0,                  /* 段: 輪郭の発光と体色の沈みだけが変わる */
    brank:MONSTERS[id].boss?bossRank():0,   /* v6.6 ボスの段(会った深さで決まる)。★熟れた個体の rank とは別物 */
    rLimbs:RV&&RV.limbs||0, rFans:RV&&RV.fans||0, rBeams:RV&&RV.beams||0,
    rCaps:RV&&RV.caps||0, rDeny:RV&&RV.deny||0, rChoir:RV&&RV.choir||0,
    hp:d.hp*elite*pm*flesh*fhp*bossm*(MONSTERS[id].boss?1+BAL.BOSS_RANK_HP*bossRank():1),
    maxHp:d.hp*elite*pm*flesh*fhp*bossm*(MONSTERS[id].boss?1+BAL.BOSS_RANK_HP*bossRank():1), spd:MONSTERS[id].spd, r:MONSTERS[id].r*(elite>1?1.2:1),
    dmg:d.dmg*elite*pm*fdm, xp:Math.round(MONSTERS[id].xp*(1+0.1*(d.lv-1))*(elite>1?1.6:1)),
    enVal:o.enVal||0, gemMul:o.gemMul!==undefined?o.gemMul:1,
    boss:!!MONSTERS[id].boss, lv:d.lv, elite:elite>1,
    t:rand(10), joff:rand(TAU), hitFlash:0, orbCd:0, stun:0, dead:false,
    dormant:!!o.dormant, dormT:0, state:'chase', limb:null, seenT:0,
    vari:(Math.random()*3)|0,                 // 描き込みの個体差(顔・色)
  };
  /* ここから下の種ごとの初期化は base の id で走らせる。
     ★これを忘れると、熟れた個体だけが初期値を持たないまま場に出る */
  id=baseId;
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
  if(id==='lurecap'){ u.state='lure'; u.revealed=false; u.lureCd=0; u.openT=0; }   // v4.1 光茸のふり
  if(id==='hugcap'){ u.hugCd=2; u.bendT=0; u.hugT=0; u.homeX=u.x; u.homeY=u.y; }   // 根が張っているので動かない
  if(id==='hugcap' && (u.rCaps||0)>=2) u.hugCd=1.2;   /* v6.0 二重傘: 抜けた先にもう一枚。掴み直しが速い */
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
  if(id==='beamer'){ u.bmState='idle'; u.bmT=rand(2,4); u.bmAng=0; u.lookA=0; u.wakeT=BAL.BEAM_WAKE; u.rays=null; }   /* v6.6 湧いた直後は撃たない */
  if(id==='peeper'){ u.fanA=rand(TAU); u.driftA=rand(TAU); u.shyT=0; }
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
  if(id==='core'){ u.whipCd=2; u.whipT=0; u.pulseCd=5; u.pulseT=0; u.spawnCd=4; u.lookA=0; { const e0=eraNow()===0, lvK=BAL.CORE_HP_LV*(e0?BAL.CORE_ERA0_LV_K:1), lvCap=e0?BAL.CORE_ERA0_LV_CAP:BAL.CORE_HP_LV_CAP; u.hp=u.maxHp=Math.round(BAL.CORE_HP*(BAL.CORE_ERA_HP0+BAL.CORE_ERA_HP_K*eraNow())*(1+Math.min(lvCap,lvK*Math.max(0,heroLv-1)))*(1+((META.gen&&META.gen.fed)||0)));   /* v6.0 心根が壁伝いに送ったぶん、身が厚い */   /* v5.0 魔核が太るのは「自分が討たれた回数」だけ。彼女たちが捕まって時が戻っても、魔核は何も知らない */ } u.era=eraNow(); /* v3.1 世代0は Lv 補正も半分 */ u.r=Math.round(MONSTERS.core.r*(0.68+0.08*Math.min(4,u.era))); }   // v3.0 世代0は薄く小さく(見た目も弱く)、討たれるごとに厚く大きく   // v2.2 引き継いだLvが高いほど厚い(最大×4.5)
  // 地形の恩恵: 湿地で粘る種のHP、巣の魔物のHP。速度は毎フレーム今いる地形で決まる(spd0 が素の速度)
  /* v6.0f 14階「厚みの中」の法(待ち): この階に追ってくるものは一体も居ない。
     カードから出した動く種は、出た瞬間に壁へ吸われて据わる。
     ★ボスと魔核戦は除く——この法は「階を渡ること」に掛かるもので、
       心臓自身の戦いに掛かるものではない。骨兵の番人(v6.0e)と同じ線引き。
       ここを外すと、世代12の魔核戦(＝最深階が14階になる唯一の世代)だけが
       静かに無効試合になる */
  if(B.floor&&B.floor.sit&&!B.coreWar&&!MONSTERS[id].boss&&!o.parent) u.sat=true;   /* v6.0f 壁に吸われた印(絵と手記が読む) */
  u.spd0=u.spd; u.zone=zoneAt(x,y); u.item=!!MONSTERS[id].item;   // 設置物は押し合いで動かない
  if(id==='suiyou') u.sub=(u.zone==='water'||u.zone==='damp');   // v2.0 水妖は水の中で待つ
  { const hm=zoneMonHp(u.zone,id); if(hm!==1){ u.hp*=hm; u.maxHp*=hm; } }
  u.parent=o.parent||null;
  if(!B.codexSeen[id] && !MONSTERS[id].item){ B.codexSeen[id]=1; codexMark(id,'seen'); }
  B.enemies.push(u);
  B.spawnFx.push({x,y,t:0,r:MONSTERS[id].r+8, dormant:u.dormant});
  return u;
}
/* ================= v6.0 地形から湧く種 =================
   ★どれも夜の EN を使わない。床が勝手に産むもので、プレイヤーが呼ぶ札ではない。
   だから「深いほど場が勝手に厚くなる」——呼べる数を増やさずに、階そのものが重くなる */
function fieldSpawnTick(dt){
  const B=G.B, M=G.map; if(!B||!M||B.coreWar) return;
  B.fieldCd=(B.fieldCd||0)-dt; if(B.fieldCd>0) return;
  B.fieldCd=1.4;
  const F=B.floor||curFloor(), aff=F.affinity||[];
  const nOf=(id)=>B.enemies.reduce((n,e)=>n+((!e.dead&&e.id===id)?1:0),0);
  const near=(id,cap,pick)=>{
    if(!aff.includes(id) || nOf(id)>=cap) return;
    const q=pick(); if(!q) return;
    const u=spawnUnit(id,q.x,q.y,{noRank:true, enVal:0, gemMul:0.4});
    if(u) u.field=true;
  };
  /* いちばん近いヒロインの周りの、条件に合うタイルを一つ選ぶ */
  const tilePick=(test,minR,maxR)=>{
    const h=B.heroes.find(x=>!x.out); if(!h) return null;
    for(let k=0;k<26;k++){
      const a=Math.random()*TAU, r=minR+Math.random()*(maxR-minR);
      const x=clampMapX(h.x+Math.cos(a)*r,40), y=clampMapY(h.y+Math.sin(a)*r,40);
      const i=tileI(x), j=tileJ(y); if(!inMap(i,j)||M.solid[j*MAP_W+i]) continue;
      if(!test(i,j,x,y)) continue;
      return {x:tileCX(i), y:tileCY(j)};
    }
    return null;
  };
  const zi=(z)=>ZONE_IDS.indexOf(z);
  /* 映り身: 凪いだ鏡の上にだけ。彼女の足元寄りに湧く(映り込みの位置) */
  near('mirrorling',3,()=>tilePick((i,j,x,y)=>M.zone[j*MAP_W+i]===zi('mirror') && calmAt(x,y)>=BAL.MIR_ON, 60,240));
  /* 紋喰い: 灯った紋からのみ。灯した数が上限を決める */
  /* ★段の刻み(GLY_STEP=60)とは別の目盛りで数える。段に合わせると
     最初の一体が出るまでに60タイル要り、紋の階を歩き切っても一体も湧かないことがあった */
  { const lit=(B.glyphN||0); const cap=Math.min(5,Math.floor(lit/25));
    if(cap>0) near('glyphmite',cap,()=>tilePick((i,j)=>M.zone[j*MAP_W+i]===zi('glyph') && M.glyphT && M.glyphT[j*MAP_W+i], 70,300)); }
  /* 糸紡ぎ: 糸の床から */
  near('silkmite',4,()=>tilePick((i,j)=>M.zone[j*MAP_W+i]===zi('silk'), 90,320));
  /* 霜の芽: 霜の面から生える。動かないので少し多め */
  near('frostbud',7,()=>tilePick((i,j)=>M.zone[j*MAP_W+i]===zi('frost'), 100,340));
}
/* 骸の回廊: 倒れた魔物の骨が、しばらくして勝手に組み上がる */
function boneTick(dt){
  const B=G.B; if(!B||!B.bones||!B.bones.length) return;
  /* ★魔核戦の最中は組み上がらない。骨兵は EN を使わない「ただの体力」なので、
     心臓との戦いの最中に湧くと、彼女たちと心臓のあいだに立つ無料の壁になる。
     実測: 世代4(＝魔核戦が骸の回廊で起きる唯一の世代)だけ毎秒の削りが 85 に落ち、
     世代2の 120 を下回っていた。生存秒は他と変わらないので、削りだけが薄まっていた。
     設計でも骨兵は「凹みの上でスタミナを削る」役で、ボス戦の駒ではない */
  if(B.coreWar){ B.bones.length=0; return; }
  /* ★上限は人数で決める。実測で世代4(2人・骸の回廊)だけが谷になり(削れた29%・討伐0/5)、
     他の世代が 49〜60% だったのに対してここだけ突出して重かった。
     骨兵は EN を使わず、拘束もせず、体力とスタミナだけを削る——
     人数の少ない世代では、これが一方的な消耗戦になっていた */
  const F=B.floor||curFloor();
  const alive=B.heroes.reduce((a,h)=>a+(h.out?0:1),0);
  const cap=Math.min(14, 4+4*alive);
  let n=0; for(const e of B.enemies) if(!e.dead && e.id==='bonesoldier') n++;
  for(let k=B.bones.length-1;k>=0;k--){
    const b=B.bones[k]; b.t+=dt;
    if(b.t>=8){ B.bones.splice(k,1);
      if(n<cap && (F.affinity||[]).includes('bonesoldier')){
        const u=spawnUnit('bonesoldier',b.x,b.y,{noRank:true, enVal:0, gemMul:0.3}); if(u){ u.field=true; n++; } } }
  }
}
function dropBone(x,y){
  const B=G.B, F=B&&B.floor; if(!B||!F||B.coreWar||!(F.affinity||[]).includes('bonesoldier')) return;
  (B.bones=B.bones||[]).push({x,y,t:0});
  if(B.bones.length>40) B.bones.shift();
}

/* ================= v6.0 新しい種のふるまい ================= */
/* 映り身: 本体には決して触れない。映り込みだけを撫でる。波立つと自分も消える */
function mirrorlingTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  if(calmAt(e.x,e.y)<BAL.MIR_ON*0.7){ e.dead=true; parts(e.x,e.y,8,['#bcdcff','#fff'],70,0.5); return; }
  /* 彼女の足元(=映り込みの位置)へ寄る。触れる直前で止まる */
  const want=p.r+e.r+10, md=Math.max(0.001,d);
  if(d>want){ e.x+=dx/md*e.spd*dt; e.y+=dy/md*e.spd*dt; }
  if(d<want+40){
    e.strokeT=(e.strokeT||0)+dt;
    applyPleasure(2.4*dt); applySensit(1.9*dt);
    if(e.strokeT>3){ e.strokeT=0; codexMet('mirrorling');
      heroBubble(p,pickRand(['……さわられて、ない。さわられて、ないのに','うつってる、ほうが……なんで']),false,1); }
  }
}
/* 紋喰い: 灯った紋の上しか歩けない。触れると紋が濃くなる */
function glyphmiteTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero, M=G.map;
  const on=(x,y)=>{ const i=tileI(x), j=tileJ(y); return inMap(i,j)&&M.glyphT&&M.glyphT[j*MAP_W+i]; };
  const md=Math.max(0.001,d);
  const nx=e.x+dx/md*e.spd*dt, ny=e.y+dy/md*e.spd*dt;
  if(on(nx,ny)){ e.x=nx; e.y=ny; }
  else{ /* 紋の縁に沿って回る */ e.x+=-dy/md*e.spd*0.7*dt; e.y+=dx/md*e.spd*0.7*dt; }
  if(d<p.r+e.r+4 && (e.biteCd=(e.biteCd||0)-dt)<=0){
    e.biteCd=2.2; B.glyphN=(B.glyphN||0)+4;
    applyPleasure(6); codexMet('glyphmite');
    floatTxt(p.x,p.y-78,'紋が濃くなった','#ff9ec2',11,1.2);
  }
}
/* 糸紡ぎ: 歩いた跡に糸を渡す。二匹の間に線分が張られ、倒しても糸は残る */
function silkmiteTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  const md=Math.max(0.001,d);
  /* 彼女の周りをゆっくり回る(襲ってはこない) */
  e.orbitA=(e.orbitA||rand(TAU))+0.8*dt;
  const R=140+Math.sin(e.t*0.8+e.joff)*30;
  const tx=p.x+Math.cos(e.orbitA)*R, ty=p.y+Math.sin(e.orbitA)*R*0.75;
  const q=Math.hypot(tx-e.x,ty-e.y)||0.001, sp=Math.min(q,e.spd*dt);
  e.x+=(tx-e.x)/q*sp; e.y+=(ty-e.y)/q*sp;
  /* 近くの同族との間に糸を張る(場に最大18本) */
  e.weaveCd=(e.weaveCd||0)-dt;
  if(e.weaveCd<=0){ e.weaveCd=2.6;
    B.silks=B.silks||[];
    if(B.silks.length<18){
      for(const o of B.enemies){ if(o===e||o.dead||o.id!=='silkmite') continue;
        const dd=Math.hypot(o.x-e.x,o.y-e.y); if(dd<40||dd>260) continue;
        if(B.silks.some(s=>Math.hypot(s.x0-e.x,s.y0-e.y)<24&&Math.hypot(s.x1-o.x,s.y1-o.y)<24)) continue;
        B.silks.push({x0:e.x,y0:e.y,x1:o.x,y1:o.y,t:0}); break; }
    } }
}
/* 張られた糸に触れる: ゆっくりなら擦れ、走れば絡む */
function silksTick(dt){
  const B=G.B; if(!B||!B.silks||!B.silks.length) return;
  for(let k=B.silks.length-1;k>=0;k--){ const s=B.silks[k]; s.t+=dt; if(s.t>50){ B.silks.splice(k,1); continue; } }
  for(const h of B.heroes){ if(h.out) continue;
    const sp=Math.hypot(h.vx||0,h.vy||0);
    for(const s of B.silks){
      if(segDist(h.x,h.y,s.x0,s.y0,s.x1,s.y1)>h.r+5) continue;
      withHero(h,()=>{
        if(sp<BAL.SILK_V) applySensit(BAL.SILK_SENS*dt*0.7);
        else if((h.silkHold||0)<=0 && (h.silkCd||0)<=0){
          h.silkHold=BAL.SILK_TETHER; h.silkRip=BAL.SILK_RIP; h.silkCd=2.4; B.silkN=(B.silkN||0)+1;
          floatTxt(h.x,h.y-90,'糸に絡んだ!','#ffc8dc',12,1.4); }
      });
      break;
    } }
}
/* 霜の芽: 動かない。触れると割れて、冷たい粒が装束の内側へ入る */
function frostbudTick(e,dt,d){
  const B=G.B, p=B.hero;
  if(B.dryAura){ const A=B.heroes.find(x=>x.hi===B.dryAura.hi);
    if(A && !A.out && Math.hypot(e.x-A.x,e.y-A.y)<B.dryAura.r){ frostbudPop(e,null); return; } }
  if(d<p.r+e.r+2) frostbudPop(e,p);
}
function frostbudPop(e,p){
  e.dead=true; parts(e.x,e.y,12,['#d8f2ff','#fff','#8ec6e8'],120,0.7);
  if(!p) return;
  withHero(p,()=>{
    p.chill=Math.min(BAL.FRO_CHILL_CAP,(p.chill||0)+18*0.55);
    p.chillHold=18;
    applySensit(5);
    codexMet('frostbud');
    heroBubble(p,pickRand(['……つめた。中、はいった','ひやっ……とった、とらないと']),false,1.2);
  });
}
/* 澱み手: 憑いた四肢の抗いだけを遅らせる。掴んではいないので剥がしの対象にならない */
function stillerTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero, md=Math.max(0.001,d);
  if(e.rideT>0){ e.rideT-=dt; e.x=p.x+(e.rox||0); e.y=p.y+(e.roy||0);
    if(e.rideT<=0){ p.stallLimb=Math.max(0,(p.stallLimb||0)-1); }
    return; }
  e.x+=dx/md*e.spd*dt; e.y+=dy/md*e.spd*dt;
  if(d<p.r+e.r+4 && (e.rideCd=(e.rideCd||0)-dt)<=0){
    e.rideCd=6; e.rideT=14; e.rox=rand(-14,14); e.roy=rand(-18,-4);
    p.stallLimb=(p.stallLimb||0)+1;
    codexMet('stiller');
    floatTxt(p.x,p.y-84,'腕が遅れる','#b0a8d0',11,1.6);
    heroBubble(p,pickRand(['て、が……おくれて','いま、うごかしたのに……']),false,1.4);
  }
}
/* 忘れ蛾: 乳白の鱗粉。浴びた者の知識が削れる。★本人には伝わらない */
function lethemothTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero, md=Math.max(0.001,d);
  e.orbitA=(e.orbitA||rand(TAU))+(e.orbitDir||1)*1.1*dt;
  const fast=(zoneAt(e.x,e.y)==='lethe')?1.4:1;
  const R=110+Math.sin(e.t*1.3+e.joff)*26;
  const tx=p.x+Math.cos(e.orbitA)*R, ty=p.y-10+Math.sin(e.orbitA)*R*0.7;
  const q=Math.hypot(tx-e.x,ty-e.y)||0.001, sp=Math.min(q,e.spd*fast*dt);
  e.x+=(tx-e.x)/q*sp; e.y+=(ty-e.y)/q*sp;
  e.dustT=(e.dustT||0)-dt;
  if(e.dustT<=0){ e.dustT=1.5; B.fx.push({kind:'pulse',x:e.x,y:e.y,t:0,life:0.7,r:34,col:'#e8e0e4'}); }
  if(d<150){ letheWash(p, dt*0.6); codexMet('lethemoth'); }   /* ★HUD にも台詞にも出さない */
}
/* 三つ目の観客: 三体の視線が全部通っている間だけ効く。壁を背にすれば切れる */
function galleryTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  const kin=B.enemies.filter(o=>!o.dead&&o.id==='gallery');
  const idx=kin.indexOf(e), n=Math.max(1,kin.length);
  const a=(B.time*0.35)+idx*(TAU/3);
  const R=210;
  const tx=p.x+Math.cos(a)*R, ty=p.y-14+Math.sin(a)*R*0.72;
  const q=Math.hypot(tx-e.x,ty-e.y)||0.001, sp=Math.min(q,e.spd*1.5*dt);
  e.x+=(tx-e.x)/q*sp; e.y+=(ty-e.y)/q*sp;
  if(idx!==0) return;                         /* 判定は組の代表が一度だけ行う */
  const all = kin.length>=3 && kin.every(o=>inSight(o,p));
  B.galleryOn = all;
  if(all){ applyPleasure(3.2*dt); applySensit(2.9*dt);
    e.seenT=(e.seenT||0)+dt;
    if(e.seenT>4){ e.seenT=0; codexMet('gallery'); awardAil('watched');
      heroBubble(p,pickRand(['どこ、みても……ある','かべ。かべに、よらないと']),false,1.2); } }
}
/* 声移し: 録った声を鳴らす。鳴った所へ魔物の狙いが移り、仲間の足が一瞬それる */
function echoerTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero, md=Math.max(0.001,d);
  if(!e.voice){ const hs=B.heroes.filter(h=>!h.out); e.voice=(hs[(Math.random()*hs.length)|0]||p).id; }
  if(d>260){ e.x+=dx/md*e.spd*dt; e.y+=dy/md*e.spd*dt; }
  e.callCd=(e.callCd||rand(3,6))-dt;
  if(e.callCd<=0){ e.callCd=rand(6,9);
    B.fx.push({kind:'pulse',x:e.x,y:e.y,t:0,life:0.9,r:70,col:(HEROES[e.voice]&&HEROES[e.voice].col)||'#ffd0e4'});
    sfx(700,340,0.25,'sine',0.05);
    for(const o of B.enemies){ if(o.dead||o===e) continue; if(Math.hypot(o.x-e.x,o.y-e.y)>420) continue; o.lureX=e.x; o.lureY=e.y; o.lureT=2.2; }
    for(const h of B.heroes){ if(h.out) continue; if(Math.hypot(h.x-e.x,h.y-e.y)>520) continue;
      h.echoT=0.6; h.echoX=e.x; h.echoY=e.y; }
    codexMet('echoer');
    const nm=(HEROES[e.voice]&&HEROES[e.voice].name)||'';
    floatTxt(e.x,e.y-e.r-14,'——'+nm+'の声','#ffd0e4',11,1.6);
  }
}
/* 骨兵: 拘束しない。快感も与えない。体力とスタミナだけを削る */
function bonesoldierTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero, md=Math.max(0.001,d);
  e.x+=dx/md*e.spd*dt; e.y+=dy/md*e.spd*dt;
  if(d<p.r+e.r+2 && (e.hitCd=(e.hitCd||0)-dt)<=0){
    e.hitCd=1.1; hurtHero(e.dmg,e,{noKb:true});
    p.stamina=Math.max(0,p.stamina-3);
    codexMet('bonesoldier');
  }
}

/* ================= v6.0 階の主(f7 / f13 / f15) =================
   最終階層の魔核とは別に、その階だけに据わっている一体。
   降り口のそばで眠っていて、近づくと起きる。倒さなくても通り抜けられる——
   ★ただし三体とも「倒さないほうが困る」形をしている。 */
function spawnFloorBoss(){
  const B=G.B, F=B.floor; if(!B||!F||!F.floorBoss||B.fbossUp) return;
  if(F.final) return;                       /* 最終階層は魔核の場所。重ねない */
  const M=G.map, ex=M&&M.pois&&M.pois.find(o=>o.kind==='stairs');
  if(!ex) return;
  B.fbossUp=true;
  const a=Math.random()*TAU, q=snapFloor(clampMapX(ex.x+Math.cos(a)*220,60), clampMapY(ex.y+Math.sin(a)*220,60), false, 8);
  if(!q) return;
  const u=spawnUnit(F.floorBoss,q.x,q.y,{enVal:0,gemMul:2.6,noRank:true});
  if(!u) return;
  u.floorBoss=true; u.dormant=true; u.dormT=0;
  B.fboss=u;
}
/* 眠っている階の主が、近づかれて起きる */
function floorBossWake(dt){
  const B=G.B, u=B.fboss; if(!u||u.dead||!u.dormant) return;
  const h=B.heroes.find(x=>!x.out && Math.hypot(x.x-u.x,x.y-u.y)<340);
  if(!h) return;
  u.dormant=false;
  const M=MONSTERS[u.id];
  setBanner('階の主 — '+M.name, (B.floor&&B.floor.sub)||'', '#ff6b81');
  parts(u.x,u.y,26,['#ff6b81','#c98cff','#fff'],180,1.0); G.shake=Math.min(9,G.shake+5);
  if(u.id==='nevermet') nevermetGreet(u,h);
  else sayPartyOrLine(h,'feat.floorBoss','……なに。なにが、いるの');
}
/* ★はじめましての君の名乗り。何度倒しても、次に会う時もまったく同じ。
   本人が忘れているから——反復が仕様であることは、地の文だけが数える */
function nevermetGreet(u,h){
  const B=G.B;
  B.nevermetN=(B.nevermetN||0)+1;
  codexMark('nevermet','met');
  floatTxt(u.x,u.y-u.r-20,'「はじめまして。ここは、はじめて?」','#e8dce4',12,3.2);
  heroBubble(h,{
    lumina:'……はじめまして、じゃないと、思う',
    freila:'……その挨拶、前にも聞いた',
    kuu:'……二度目。二度目のはず',
    yamiko:'……あんた、あたしを覚えてないの',
  }[h.id]||'……はじめまして、じゃない',false,2);
}
/* 水鏡の女王: 周りの水面を凪がせ、映り身を無限に湧かせる。
   ★本体には攻撃が通らない。水面が割れている間だけ露出する */
function mirrorqueenTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero, C=calmLedger();
  e.x=e.homeX!==undefined?e.homeX:(e.homeX=e.x); e.y=e.homeY!==undefined?e.homeY:(e.homeY=e.y);
  /* 半径420の鏡を固定で凪がせる(走っても波立たない) */
  let calm=0, tot=0;
  if(C){ const i0=tileI(e.x), j0=tileJ(e.y), R=Math.ceil(420/MAP_T);
    for(let dj=-R;dj<=R;dj+=2) for(let di=-R;di<=R;di+=2){
      const i=i0+di, j=j0+dj; if(!inMap(i,j)) continue;
      if(Math.hypot(di,dj)*MAP_T>420) continue;
      const k=j*MAP_W+i; if(G.map.solid[k]) continue;
      if(G.map.zone[k]!==ZONE_IDS.indexOf('mirror')) continue;
      tot++;
      /* 炎で蒸発した床・氷で凍った床の上では凪がせられない=そこだけ鏡が割れる */
      const broken=(G.map.dryT&&G.map.dryT[k])||(G.map.iceT&&G.map.iceT[k]);
      if(broken){ C[k]=0; } else { C[k]=255; calm++; }
    } }
  e.exposed = tot>0 && (calm/tot)<0.55;      /* 半分以上が割れていれば本体が出る */
  /* 映り身を絶やさない */
  e.spawnCd=(e.spawnCd||0)-dt;
  if(e.spawnCd<=0){ e.spawnCd=2.4;
    const n=B.enemies.reduce((a,o)=>a+((!o.dead&&o.id==='mirrorling')?1:0),0);
    if(n<8){ const q=snapFloor(p.x+rand(-120,120), p.y+rand(-120,120), false, 4);
      if(q){ const m=spawnUnit('mirrorling',q.x,q.y,{noRank:true,enVal:0,gemMul:0.4}); if(m) m.field=true; } } }
}
/* はじめましての君: 忘れ水の霧を撒きながら戦う。彼女もまた毎回これを「初めて」見る */
function nevermetTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero, md=Math.max(0.001,d);
  if(d>90){ e.x+=dx/md*e.spd*dt; e.y+=dy/md*e.spd*dt; }
  e.mistCd=(e.mistCd||0)-dt;
  if(e.mistCd<=0){ e.mistCd=2.2;
    B.fx.push({kind:'pulse',x:e.x,y:e.y,t:0,life:1.1,r:150,col:'#e8dce4'});
    for(const h of B.heroes){ if(h.out||Math.hypot(h.x-e.x,h.y-e.y)>190) continue; letheWash(h,1.6); }
  }
  if(d<p.r+e.r+6 && (e.hitCd=(e.hitCd||0)-dt)<=0){ e.hitCd=1.4; hurtHero(e.dmg,e); applySensit(3); }
}
/* はじめの夜の主: 与えたダメージの累計に比例して濃くなる。
   ★大きくしない——強さを大きさで表現した瞬間、この一体の意味が消える */
function firstslugTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero, md=Math.max(0.001,d);
  e.x+=dx/md*e.spd*dt; e.y+=dy/md*e.spd*dt;
  if(d<p.r+e.r+3 && (e.charmCd=(e.charmCd||0)-dt)<=0){
    e.charmCd=1.0;
    applyCharm(e, BAL.CHARM_SLUG*(1+0.35*(e.thick||0)));
    hurtHero(e.dmg,e,{noKb:true});
  }
}
/* 抗った分だけ濃くなる。damageEnemy から呼ぶ */
function firstslugThicken(e,dmg){
  if(!e||e.id!=='firstslug') return;
  e.dmgAcc=(e.dmgAcc||0)+dmg;
  const th=Math.floor(e.dmgAcc/1000);
  if(th<=(e.thick||0)) return;
  e.thick=th;
  e.maxHp=Math.round(e.maxHp*1.40); e.hp=Math.min(e.maxHp, e.hp+e.maxHp*0.28);
  e.needMul=(e.needMul||1)+0.25;
  const p=G.B&&G.B.hero;
  floatTxt(e.x,e.y-e.r-16,'濃くなった','#c8e07a',12,1.8);
  if(p && th<=3) heroBubble(p,{
    lumina:'……なんで。ナメクジ、なのに',
    freila:'……硬い。さっきより、確実に',
    kuu:'……増えてる。中の、脈が',
    yamiko:'……こいつ、あたしの分を吸ってる',
  }[p.id]||'……なんで',false,1.6);
}
/* 窪みの主: 動かない。半径120で襞が開き、踏み込むと閉じる */
function nichelordTick(e,dt,d){
  const B=G.B, p=B.hero;
  e.open = d<120;
  if(d<p.r+e.r-4 && (e.shutCd=(e.shutCd||0)-dt)<=0){
    e.shutT=(e.shutT||0)+dt;
    if(e.shutT>=2.8){ e.shutT=0; e.shutCd=7;
      let n=0; for(let i=0;i<3;i++){ if(attachMonster(e,'tether',{r:44,needMul:1.35})) n++; else break; }
      if(n>0){ codexMet('nichelord');
        /* 溜めていたものが一度に来る——「達したければ、ここに入れ」 */
        applyPleasure(26); addHeatG(18); awardAil('bound');
        heroBubble(p,pickRand(['あ……あっ、いま、だめ……!','とじ、た……うごけ、な']),true,2); } }
  } else e.shutT=Math.max(0,(e.shutT||0)-dt);
}
/* 褥座: 追わない。近づくほど椅子の形になり、座れば三点を同時に取る */
function seatfleshTick(e,dt,d){
  const B=G.B, p=B.hero;
  e.form = d>200 ? 0 : (d>90 ? 1 : 2);       /* 塊 → 椅子 → その子の座高 */
  if(d<p.r+e.r-2 && (e.sitCd=(e.sitCd||0)-dt)<=0){
    e.sitCd=6;
    let n=0; for(let i=0;i<3;i++){ if(attachMonster(e,'tether',{r:40,needMul:1.25})) n++; else break; }
    if(n>0){ codexMet('seatflesh'); applySensit(9); addHeatG(10);
      heroBubble(p,pickRand(['……すわ、っちゃ……','せ、なか……とじ、て……!']),true,2); }
  }
}
/* 心根: 壁から生える。繋いでいる間、吸ったものを心臓へ送る——最終階層の魔核が厚くなる */
function heartrootTick(e,dt,d){
  const B=G.B, p=B.hero;
  if(d<170 && (e.rootCd=(e.rootCd||0)-dt)<=0){
    e.rootCd=4.5;
    if(attachMonster(e,'tether',{r:52,needMul:1.2})){ codexMet('heartroot'); }
  }
  const held=attachedSlots(p).some(sl=>p.limbs[sl]&&p.limbs[sl].mon===e);
  e.feeding=held;
  if(held){
    applyPleasure(3.4*dt); applySensit(1.8*dt);
    /* ★彼女はこれを知らない。吸われた光が壁を上っていくのは、夜の側からしか見えない */
    META.gen.fed=Math.min(BAL.HEARTROOT_CAP,(META.gen.fed||0)+BAL.HEARTROOT_K*dt);
  }
}
/* 帳の番: 動かない。周りで起きた責めを種類ごとに刻み、刻んだ分だけ次が効く */
function tallykeeperTick(e,dt,d){
  const B=G.B, p=B.hero;
  if(d>380){ e.on=false; return; }
  e.on=true;
  e.markCd=(e.markCd||0)-dt;
  if(e.markCd>0) return;
  e.markCd=2.6;
  const by=(p.recAilBy)||{};
  const keys=Object.keys(by); if(!keys.length) return;
  const k=keys[(Math.random()*keys.length)|0];
  e.tally=e.tally||{};
  if((e.tally[k]||0)>=4) return;
  e.tally[k]=(e.tally[k]||0)+1;
  p.tallyAmp=Math.min(0.72,(p.tallyAmp||0)+0.18);
  codexMet('tallykeeper');
  floatTxt(e.x,e.y-e.r-12,'刻まれた','#ffb3cf',11,1.6);
}

function damageEnemy(e,dmg){
  if(e.dead||e.dormant) return;
  { const B=G.B; if(B&&B.lights&&darkLevel()>0.05 && Math.random()<0.18) pushLight(e.x,e.y,150,BAL.DARK_MEM_T,0.85); }   // v4.0 光と炎が通った所は、しばらく見えている
  if(G.B&&G.B.hero.dmgMult) dmg*=G.B.hero.dmgMult;   // せいなる火力(自己強化)
  /* v5.7 ヒロイン側の底上げ(スタミナを削ったぶんの釣り合い)と、素性ごとの火力。
     フレイラは近いほど強い——火は届く所でしか働かない */
  dmg*=BAL.HERO_DMG_K;
  if(G.B&&(G.B.hero.highT||0)>0) dmg*=BAL.HIGH_DMG;   /* v6.6 ハイの間は攻めも強い */
  if(G.B){ const hh=G.B.hero, HD=HEROES[hh.id]||{};
    if(HD.dmgMul) dmg*=HD.dmgMul;
    if(HD.closeK){ const d0=Math.hypot(e.x-hh.x,e.y-hh.y); dmg*=1+HD.closeK*Math.max(0,1-d0/BAL.CLOSE_R); } }
  if(G.B&&G.B.hero.id==='freila') dmg*=freilaDmgMul(e);   // v4.0 火属性: 足元の湿り気と、相手の質
  { const dm=dryMonMul(e); if(dm) dmg/=dm.hp; }            // v4.0 焼いた床の上のヌルヌル系は、乾いて脆い
  if(iceAt(e.x,e.y)>0.5) dmg*=1+BAL.ICE_MON_VULN;         // v5.0 氷の上は脆い
  if((e.vulnT||0)>0)     dmg*=1+BAL.ICE_VULN;             //      冷気の帳の中
  if((e.frozT||0)>0)     dmg*=1+BAL.ICE_FROZ_VULN;        //      凍っている間
  if(e.id==='flower') dmg*=(e.state==='bud'?0.5:1.3);
  if(e.id==='tower') dmg*=0.3;                        // 催眠電波の塔: 骨の骨組みは光を通しにくい
  if(e.id==='core') dmg*=coreDef();                   // 魔核: 厚い肉(v3.0 世代0は薄く 0.7、世代ごとに 0.05 ずつ厚く、下限 CORE_DEF)
  if(e.id==='yamiboss'){
    if((e.meltT||0)>0) return;                        // v5.0 闇に溶けている間は当たらない
    if(e.asleep) dmg*=BAL.YAMI_SLEEP_DEF;             //      眠っている的は、起こさないと削れない
  }
  if(e.id==='sentinel') dmg*=BAL.SENTINEL_DEF;        // v2.1 石の番兵: 光が通りにくい
  else if(e.boss && !MONSTERS[e.id].guardian) dmg*=BAL.BOSS_DEF;   // v2.4 ボス級: 被ダメ 80%
  // 魅了: その個体への攻撃は無意識に鈍る(Lvごとに与ダメ減)
  const cl=G.B?charmLvFor(G.B.hero,e):0;
  if(cl>0){
    dmg*=Math.max(0.1,1-BAL.CHARM_DMG_CUT*cl);
    if(Math.random()<0.15) floatTxt(e.x,e.y-e.r-14,'……てかげん?','#ffb3cf',9,0.8);
  }
  /* v6.0 水鏡の女王: 水面が凪いでいる間は本体に届かない。割るしかない */
  if(e.id==='mirrorqueen' && !e.exposed){
    e.hitFlash=0.12; floatTxt(e.x,e.y-e.r-10,'——鏡に阻まれた','#cfe4ff',11,0.9); return;
  }
  /* v6.0 はじめの夜の主: 与えたダメージの累計で濃くなる。抗わなければ、ただのナメクジのまま */
  if(e.id==='firstslug') firstslugThicken(e,dmg);
  e.hp-=dmg; e.hitFlash=0.12;
  /* v6.0 苔(に見えるもの)の上では、与えた力そのものが快感に化けて返る。
     ★正しく戦えば戦うほど深く軋む——15階の芯はこの一行 */
  { const sh=G.B&&G.B.hero; if(sh&&!sh.out) shamSoak(sh, dmg*BAL.SHAM_DMG); }
  floatDmg(e.x,e.y-e.r-4,dmg);
  if(e.hp<=0){ killEnemy(e); return; }
  /* v5.6 仲間を掴んでいる魔物を撃つと、倒しきらなくても掴みが緩んで、やがて剥がれる。
     救出は「そばに立って待つ」だけではなく「撃って剥がす」でもできる。
     倒しきれない硬い相手(石の番兵など)から仲間を引き離す道でもある */
  if(e.state==='attached' && e.limb && e.ti!=null && G.B && G.B.heroes[e.ti]){
    const ho=G.B.heroes[e.ti], at=(!ho.out && ho.limbs) ? ho.limbs[e.limb] : null;
    if(at && at.mon===e){
      at.need-=dmg*BAL.PEEL_K;
      if(at.need<=0){
        const ci0=G.B.ci; G.B.ci=e.ti;
        detachLimb(e.limb,{fling:true});
        G.B.ci=ci0;
        floatTxt(ho.x,ho.y-52,'剥がした!','#8fd3ff',12,0.9);
        heroBubble(ho,{freila:'……助かる', kuu:'……ん。ありがと', yamiko:'……恩に着る'}[ho.id]||'ありがと! たすかった!',true,2);
      }
    }
  }
}
function killEnemy(e){
  if(e.dead) return;
  const B=G.B, h=B.hero;
  e.dead=true; B.kills++;
  /* v6.6 綿毛は倒しても撒く。★分かれるのは場が FLUFF_MAX 体未満の時だけ——
     上限を置かないと、自動戦闘では倒すたびに増えて際限がなくなる(作者の懸念どおり) */
  /* 咳き茸も、壊された時に粉を上げる。★実測で、中毒のヒロインは踏む手前(42px)で
     刃が届いてしまい、寄っていったのに一度も吸えていなかった */
  if(e.id==='coughcap') puffSpores(e.x,e.y,'coughcap');
  if(e.id==='fluff'){
    puffSpores(e.x,e.y,'fluff');
    const n=B.enemies.filter(q=>!q.dead&&q.id==='fluff').length;
    if(n<BAL.FLUFF_MAX && Math.random()<BAL.FLUFF_SPLIT && B.enemies.length<fieldCap()){
      spawnUnit('fluff', e.x+rand(-24,24), e.y+rand(-18,18), {enVal:0, gemMul:0});
      B.nFluffSplit=(B.nFluffSplit||0)+1;
    }
  }
  { const kp=G.B&&G.B.hero; if(kp) kp.recKills=(kp.recKills||0)+1; }   /* v5.8 討った数も、その時の文脈のヒロインの分として数える */
  /* v6.0 骸の回廊: 倒れたものが骨を落とす。8秒で勝手に組み上がるので、放っておくと増える */
  if(typeof dropBone==='function' && e.id!=='bonesoldier' && !MONSTERS[e.id].item && !e.field) dropBone(e.x,e.y);
  /* v6.0 紋喰いを倒すと、湧いた紋がひとつ消える——倒せば薄くなるが、倒すために走れば新しく灯る */
  if(e.id==='glyphmite') B.glyphN=Math.max(0,(B.glyphN||0)-BAL.GLY_STEP*0.5);
  /* v6.0 澱み手が落ちれば、憑いていた四肢の遅れも解ける */
  if(e.id==='stiller' && e.rideT>0){ for(const hh of B.heroes) hh.stallLimb=Math.max(0,(hh.stallLimb||0)-1); }
  if(!MONSTERS[e.id].item) codexOf(e.id).kills++;
  // v3.0 誰かの四肢に付いていたら解放(全員を見る)
  for(let i=0;i<B.heroes.length;i++){ const hh=B.heroes[i];
    if(e.limb && hh.limbs[e.limb] && hh.limbs[e.limb].mon===e){ hh.limbs[e.limb]=null; heroBubble(hh,{freila:'……離れた', kuu:'……とれた', yamiko:'……ようやく'}[hh.id]||'とれたっ!'); }
    for(const sl of attachedSlots(hh)){ const a=hh.limbs[sl]; if(a&&a.mon===e) hh.limbs[sl]=null; }
    for(const sl of suckSlots(hh)){ const a=hh.suckers[sl]; if(a&&a.mon===e) hh.suckers[sl]=null; }
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
    { const bp=G.B&&G.B.hero; if(bp) bp.recBoss=(bp.recBoss||0)+1; }   /* v5.8 誰が討ったかも、その子の帳簿に */
    B.coreRoots={x:e.x, y:e.y, r:e.r, t:0, era:e.era||0};   // v4.0 本体は消え、根だけが残る → 巻き上がって赤黒い渦へ
    G.mode='survived'; B.winT=BAL.LOOP_WIN_T; G.shake=Math.min(14,G.shake+10); S.boss();
    return;
  }
  if(e.boss){
    for(let i=0;i<22;i++){
      const a=rand(TAU), d2=rand(10,70);
      dropGem(e.x+Math.cos(a)*d2, e.y+Math.sin(a)*d2, 4);
    }
    setBanner('ボスが討たれた…','大量のエッセンスが残された','#b46cff');
    META.life.herBoss++;
    { const bp=G.B&&G.B.hero; if(bp) bp.recBoss=(bp.recBoss||0)+1; }   /* v5.8 誰が討ったかも、その子の帳簿に */
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

/* ================= v6.6 淫魔の指揮 =================
   淫魔は特化系統ではなく「現場指揮官」。自分の一個下の階級までを、届く距離のぶんだけ強化する。
   淫魔そのものは責めをほとんど持たない——強くなるのは、周りに居る他の魔物の方。
     小淫魔(中型)   → 雑魚を操る
     寸止めの淫魔(大型) → 中型まで
     夢魔の女王(ボス)   → 大型まで
   強化の中身は「速さ」と「手数」: 足が速くなり、掴み・責めの間合いが詰まる。
   ★ダメージや快感の係数には掛けない。掛けると盤面が壊れる(指揮官が居るだけで倍になる) */
const DEMON_CMD={imp:['fodder'], succubus:['fodder','mid'], succuhigh:['fodder','mid'], succuqueen:['fodder','mid','large']};
/* 指揮で早回しする待ち時間。★行動の間合いだけ。持続時間(life/burnT など)には触らない */
const CMD_CDS=['biteCd','bladeCd','callCd','castCd','charmCd','crossCd','gropeCd','grabCd','hornCd','kissCd',
               'meltCd','muskCd','nuzzleCd','orbCd','pounceCd','pulseCd','rootCd','runeCd','spawnCd','spearCd','swoopCd','whipCd','teaseT'];
function demonCmdAt(e){
  const B=G.B;
  if(!B.demons || !B.demons.length) return 0;
  if(MONSTERS[e.id].boss || MONSTERS[e.id].item) return 0;   /* ボスと設置物は指揮されない */
  const t=tierOf(e.id);
  let best=0;
  for(const c of B.demons){
    const tiers=DEMON_CMD[c.id]; if(!tiers || tiers.indexOf(t)<0) continue;
    const R=BAL.DEMON_R[c.id]||200, dd=Math.hypot(c.x-e.x, c.y-e.y);
    if(dd>R) continue;
    const w=(BAL.DEMON_PW[c.id]||0.4)*(1-dd/R*0.55);
    if(w>best) best=w;
  }
  return best;
}
function enemiesUpdate(dt){
  const B=G.B; let p=B.hero;
  B.demons=B.enemies.filter(q=>!q.dead && DEMON_CMD[q.id]);   /* v6.6 いま盤に居る指揮官 */
  for(const e of B.enemies){
    if(e.dead) continue;
    e.t+=dt;
    e.cmd=demonCmdAt(e);   /* v6.6 指揮の濃さ(0〜0.72)。速さと手数に乗る */
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
      if(e.id==='hugcap'){   // v4.1 抱き茸は根が張っているので動かない。傘の下へ彼女の方が引き寄せられる
        e.x=(e.homeX!==undefined?e.homeX:e.x); e.y=(e.homeY!==undefined?e.homeY:e.y);
        const dd=Math.hypot(p.x-e.x,p.y-e.y)||1;
        if(dd>e.r*1.1){ p.x+=(e.x-p.x)/dd*110*dt; p.y+=(e.y-p.y)/dd*110*dt; }
        addHeatG(BAL.HUG_HEAT*dt); applySensit(BAL.HUG_SENS*dt);
        e.dotAcc=(e.dotAcc||0)+dt;
        if(e.dotAcc>=0.5){ e.dotAcc-=0.5; hurtHero(BAL.HUG_DOT,e,{pierce:true,quiet:true,noKb:true}); }
        e.hugT=(e.hugT||0)+dt;
        if(e.hugT>3 && !e.puffed){ e.puffed=true; spawnCloud(e.x,e.y,150,8,BAL.SENSIT_GAS*1.1,'gas'); }
        if(Math.random()<dt*5) parts(p.x+rand(-16,16),p.y-rand(0,26),1,['#e8d4b0','#ffd0a0','#fff'],40,0.6);
        continue;
      }
      const anch=e.suck?suckAnchor(p,e.suck):limbAnchor(p,e.limb);
      /* v6.3 据わった個体は、掴んだまま連れ歩かれない。彼女の方が繋ぎの長さまで引き戻される。
         これが無いと番兵が輪から引きずり出され、離した後も足元に立っているので
         「何も無い床でもう一度掴まれる」ことになる(抱き茸と同じ作法) */
      if(isSeated(e.id)){
        const at=e.limb?p.limbs[e.limb]:null;
        const reach=Math.max(24,(at&&at.r?at.r:40));
        const ax=e.x-anch.x, ay=e.y-anch.y, ad=Math.hypot(ax,ay);
        if(ad>reach){
          const step=Math.min(ad-reach, BAL.SEAT_PULL*dt);
          const cx=p.x, cy=p.y;
          p.x+=ax/ad*step; p.y+=ay/ad*step;
          if(G.map) collideMap(p,p.r+2,false);
          if(Math.hypot(p.x-cx,p.y-cy)<step*0.25 && ad>reach+BAL.SEAT_SNAP) detachLimb(e.limb,{});   /* 壁を挟んで引けない時は、繋ぎが切れる */
        }
      }else{
        e.x=anch.x; e.y=anch.y;
      }
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
    /* v6.3 巣窟の住人は、巣窟から出ていかない。
       ★これが無いと「その階の巣窟に住み着いている顔ぶれ」がただの追加の雑魚になり、
         盤じゅうに散って巣窟の顔が消える。輪の外へ出たら、帰る向きへ歩かせる */
    if(e.denSeed){ const L=denOf();
      if(L){ const ddn=Math.hypot(e.x-L.x,e.y-L.y), lim=Math.max(L.rx,L.ry)+BAL.DEN_SEED_LEASH;
        /* 境で行ったり来たりしないよう、帰り始めたら 0.7倍の内へ入るまで帰り続ける */
        if(ddn>lim) e.denBack=true; else if(ddn<lim*0.7) e.denBack=false;
        if(e.denBack){ dx=L.x-e.x; dy=L.y-e.y; } } }
    const d=Math.hypot(dx,dy)||0.001;
    const fly=canFly(e.id);
    // 壁で彼女が見えないときは、流れ場(BFS)に沿って回り込む(以降の追跡・照準はその向きを使う)
    e.blocked=false;
    if(d>36 && G.map && !losClear(e.x,e.y,p.x,p.y,fly)){ const f=flowDir(e.x,e.y,fly,e.ti); if(f){ dx=f.x*d; dy=f.y*d; e.blocked=true; } }   // v3.0 標的のヒロインの流れ場で回り込む

    if(e.dormant){
      e.dormT+=dt;
      /* v5.0 渦の眠り手だけは別の眠り: 時間では起きず、近づかれた時だけ目を開ける。
         起きる合図(台詞・帯・闇の輪)は yamiBossTick が同じフレームで出す */
      const yami=e.id==='yamiboss';
      if(d < (yami?BAL.YAMI_WAKE:170) || (!yami && e.dormT>25)){
        e.dormant=false;
        if(!yami) parts(e.x,e.y,10,['#6a5a9c','#3a3158'],120,0.5);
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
      B.nReenter=(B.nReenter||0)+1;
      if(e.boss){ B.reenterT=B.reenterT||{};   /* ★v6.4 一体の大物のための文。群れで喋らせない */
        if(B.time-(B.reenterT[e.id]||-99)>BAL.REENTER_SAY_CD && B.time-(B.reenterSay||-99)>BAL.REENTER_SAY_GAP){
          B.reenterT[e.id]=B.time; B.reenterSay=B.time; B.nReenterSay=(B.nReenterSay||0)+1;
          floatTxt(e.x,e.y-e.r-20,'まわりこんできた!','#ff6b81',11,1.2);
        } }
      continue;
    }
    e.zone=zoneAt(e.x,e.y);
    const eIce=iceAt(e.x,e.y)>0.5;   /* v5.0 クウの氷の上 */
    if(e.spd0!==undefined){ const dm=dryMonMul(e);
      let m=zoneMonSpd(e.zone,e.id)*((e.hasteT||0)>0?1.35:1)*(dm?dm.spd:1);   /* v4.0 焼いた床のヌルヌル系は鈍る */
      if(eIce) m*=BAL.ICE_MON_SPD;
      if((e.chillT||0)>0) m*=BAL.ICE_CHILL_SPD;
      e.spd=e.spd0*Math.max(BAL.ICE_SPD_FLOOR,m); }
    if((e.hasteT||0)>0) e.hasteT-=dt;   // v2.4 王の号令で一時的に速い
    if((e.chillT||0)>0) e.chillT-=dt;
    if((e.vulnT||0)>0) e.vulnT-=dt;
    if((e.frozT||0)>0) e.frozT-=dt;
    if(eIce){ e.frostTick=(e.frostTick||0)-dt;   /* 凍傷 */
      if(e.frostTick<=0){ e.frostTick=BAL.ICE_DOT_CD;
        const K=B.heroes.find(h=>h.id==='kuu'&&!h.out);
        if(K){ const ci0=B.ci; B.ci=K.hi; damageEnemy(e,BAL.ICE_DOT*(1+0.03*K.level)); B.ci=ci0; }
        if(Math.random()<0.4) parts(e.x,e.y-e.r*0.5,1,['#bfeaff','#fff'],36,0.4); } }
    if((e.burnT||0)>0){ e.burnT-=dt; e.burnTick=(e.burnTick||0)-dt; if(e.burnTick<=0){ e.burnTick=0.4; damageEnemy(e,3+0.08*p.level); if(Math.random()<0.5) parts(e.x,e.y-e.r*0.5,1,['#ff7a3a','#ffd76a'],40,0.4); } }   // v3.0 煉獄の剣の燃焼
    if(e.dead) continue;   // 燃え尽きた個体はこのフレームの行動をしない
    e.x=clampMapX(e.x,e.r); e.y=clampMapY(e.y,e.r);
    const spd0=e.spd;
    if(e.cmd>0){
      e.spd*=1+e.cmd*BAL.DEMON_SPD;                          /* 足が速くなる */
      const ex=dt*e.cmd*BAL.DEMON_ACT;                        /* 待ちが縮む=手数が増える */
      for(const k of CMD_CDS) if(e[k]>0) e[k]=Math.max(0,e[k]-ex);
    }
    if(e.stun>0){ e.stun-=dt; }
    else if((e.frozT||0)>0){ /* v5.0 凍っている間は何もしない */ }
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
    }else if(e.id==='yamiboss'){
      yamiBossTick(e,dt,d,dx,dy);
    }else if(e.id==='coreling'){
      corelingTick(e,dt,d,dx,dy);
    }else if(e.id==='lurecap'){
      lurecapTick(e,dt,d,dx,dy);
    }else if(e.id==='hugcap'){
      hugcapTick(e,dt,d,dx,dy);
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
    }else if(e.id==='fluff'){
      fluffTick(e,dt,d,dx,dy);
    }else if(e.id==='coughcap'){
      coughcapTick(e,dt,d);
    }else if(e.id==='peeper'){
      peeperTick(e,dt,d,dx,dy);
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
    }else if(e.id==='mirrorqueen'){
      mirrorqueenTick(e,dt,d,dx,dy);
    }else if(e.id==='nevermet'){
      nevermetTick(e,dt,d,dx,dy);
    }else if(e.id==='firstslug'){
      firstslugTick(e,dt,d,dx,dy);
    }else if(e.id==='nichelord'){
      nichelordTick(e,dt,d);
    }else if(e.id==='seatflesh'){
      seatfleshTick(e,dt,d);
    }else if(e.id==='heartroot'){
      heartrootTick(e,dt,d);
    }else if(e.id==='tallykeeper'){
      tallykeeperTick(e,dt,d);
    }else if(e.id==='mirrorling'){
      mirrorlingTick(e,dt,d,dx,dy);
    }else if(e.id==='glyphmite'){
      glyphmiteTick(e,dt,d,dx,dy);
    }else if(e.id==='silkmite'){
      silkmiteTick(e,dt,d,dx,dy);
    }else if(e.id==='frostbud'){
      frostbudTick(e,dt,d);
    }else if(e.id==='stiller'){
      stillerTick(e,dt,d,dx,dy);
    }else if(e.id==='lethemoth'){
      lethemothTick(e,dt,d,dx,dy);
    }else if(e.id==='gallery'){
      galleryTick(e,dt,d,dx,dy);
    }else if(e.id==='echoer'){
      echoerTick(e,dt,d,dx,dy);
    }else if(e.id==='bonesoldier'){
      bonesoldierTick(e,dt,d,dx,dy);
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
    e.spd=spd0;   /* v6.6 指揮ぶんの速さは、このフレームだけ。戻さないと毎フレーム掛け算になる */
    if((e.id==='slug'||e.id==='slugqueen') && e.charmCd>0) e.charmCd-=dt;

    // オーブ被弾
    if(p.wp.orb>0 && e.orbCd<=0){
      const evo=p.evo.sring>0;
      const n=p.wp.orb;
      for(let i=0;i<n;i++){
        const o=orbPos(i,n);
        if(Math.hypot(e.x-o.x,(e.y-e.r)-o.y)<e.r+(evo?14:11)){
          damageEnemy(e,(evo?16:11+4*(Math.min(BAL.WP_EVO_LV,p.wp.orb)-1))*wpOver(p.wp.orb,p).dmg);
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
  /* v6.6 掴まれている・押し倒されている間は、耳元まで寄って囁く。
     小淫魔は責めを持たない(dmg 0)——増えるのは、他の魔物がしていることの「入り」の方 */
  const held=(p.pinned||p.charmBind||attachCount(p)>0||p.climaxT>0);
  if(held){
    const tx2=p.x+Math.cos(e.t*1.6)*22, ty2=p.y-18+Math.sin(e.t*1.6)*8;
    const md2=Math.hypot(tx2-e.x,ty2-e.y)||0.001;
    e.x+=(tx2-e.x)/md2*Math.min(md2,e.spd*1.5*dt);
    e.y+=(ty2-e.y)/md2*Math.min(md2,e.spd*1.5*dt);
    if(d<BAL.DEMON_WHISPER_R){
      p.whisperT=Math.max(p.whisperT||0, 0.35);
      e.whisCd=(e.whisCd||0)-dt;
      if(e.whisCd<=0){
        e.whisCd=rand(2.4,4.0);
        floatTxt(e.x,e.y-e.r-10,pickRand(['ほら、きこえてる♡','がんばってるね♡','もうすこしだよ♡','こえ、でてるよ♡']),'#ff86b3',10,1.3);
        heroBubble(p,pickRand(['みみもと、で……やめ、て……','きこえ、な……きこえて、る……','いわない、で……そんな、こと……']),false,3);
      }
    }
    return;
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
/* v6.6 覗き子(小型の目玉・雑魚)。責めも攻撃も持たない。
   扇形の視界に彼女が入っている間だけ、ほんの少しずつ快感が乗る。数が並べば重なる。
   近づかれると「戦いづらいな」と離れる——倒しにくいが、脅威でもない。 */
/* 綿毛: ただ漂う。触れれば弾け、倒されても弾ける。
   ★分かれるのは場に FLUFF_MAX 体未満の時だけ——上限が無いと自動戦闘で際限なく増える */
function fluffTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  e.driftA=(e.driftA||0)+dt*0.7;
  const w=0.55+Math.sin(e.t*0.9+e.joff)*0.2;
  e.x+=(dx/d*e.spd*w+Math.cos(e.driftA)*16)*dt;
  e.y+=(dy/d*e.spd*w+Math.sin(e.driftA)*11)*dt;
  if(d<e.r+p.r+3 && !e.dead){ e.dead=true; puffSpores(e.x,e.y,'fluff'); }
}
/* 咳き茸: 動かない。踏むと粉 */
function coughcapTick(e,dt,d){
  const B=G.B, p=B.hero;
  e.puffCd=(e.puffCd||0)-dt;
  if(d<e.r+p.r+8 && e.puffCd<=0){
    e.puffCd=5.5;
    puffSpores(e.x,e.y,'coughcap');
    heroBubble(p,pickRand(['け、ほっ……ふんだ……','わ、ぷ……こな、が……','けほっ、けほ……すって、しま……']),true,2);
  }
}
function peeperTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  /* 見ている向きはゆっくり彼女を追う */
  const want=Math.atan2(dy,dx);
  let da=((want-e.fanA+Math.PI*3)%TAU)-Math.PI;
  e.fanA+=clamp(da,-1.1*dt,1.1*dt);
  /* 間合い: 近すぎたら離れ、遠すぎたら寄る。彼女が刃を振るうと余計に下がる */
  const shy=(p.climaxT>0||p.pinned)?0:1;
  if(d<BAL.EYE_SHY_R*shy){ e.x-=dx/d*e.spd*1.25*dt; e.y-=dy/d*e.spd*1.25*dt; e.shyT=1.2; }
  else if(d>BAL.EYE_FAN_R*0.85){ e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt; }
  else{ e.driftA+=dt*0.9; e.x+=Math.cos(e.driftA)*12*dt; e.y+=Math.sin(e.driftA)*9*dt; }
  if(e.shyT>0) e.shyT-=dt;
  /* 扇の中に居るか */
  if(d<BAL.EYE_FAN_R && Math.abs(((want-e.fanA+Math.PI*3)%TAU)-Math.PI)<BAL.EYE_FAN_ANG && losClear(e.x,e.y-e.r,p.x,p.y-14,true)){
    e.watching=1;
    applyPleasure(BAL.EYE_FAN_PLE*dt);
    p.watchedT=Math.max(p.watchedT||0,0.3);       /* 既存の【視姦】と同じ扱い */
    e.seeT=(e.seeT||0)+dt;
    if(e.seeT>3.5){ e.seeT=0; awardAil('watched'); codexMet('peeper');
      heroBubble(p,pickRand(['み、みないで……','ずっと、みてる……なんで……','め、そらして……よ……']),false,2); }
  }else{ e.watching=0; e.seeT=0; }
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
  /* v6.6 ふだんは遠くから中型までを指揮している。彼女がえっちな目に遭っている時だけ、
     見物に(そして栓をしに)近寄ってくる */
  const lewd=(p.pinned||p.charmBind||attachCount(p)>0||p.aphro>=70||p.climaxT>0);
  e.orbitA+=e.orbitDir*0.7*dt;
  const R=(lewd?52:150)+Math.sin(e.t*1.1+e.joff)*16;
  const tx=p.x+Math.cos(e.orbitA)*R, ty=p.y-16+Math.sin(e.orbitA)*R*0.7;
  const md=Math.hypot(tx-e.x,ty-e.y)||0.001;
  const sp=Math.min(md,e.spd*1.4*dt);
  e.x+=(tx-e.x)/md*sp; e.y+=(ty-e.y)/md*sp;
  if(Math.random()<dt*0.3) e.orbitDir*=-1;
  // 寸止め: 指先ひとつで栓をする
  e.denyCd-=dt;
  if(e.denyCd<=0){
    e.denyCd=8;
    if(d<130 && p.denyT<=0 && p.climaxT<=0 && p.aphro>=35 && (p.omazukeT||0)<=0){
      applyDeny(e);
      B.fx.push({kind:'pulse', x:e.x, y:e.y-e.r, t:0, life:0.6, r:60, col:'#ff5d9e'});
      floatTxt(e.x,e.y-e.r-12,pickRand(['まだ、だめ♡','とめてあげる♡','おあずけ♡']),'#ff86b3',10,1.1);
      /* v6.0 焦らしの熟手: 寸止めが長い。三・二・一と数えて聞かせてから、また止める */
      if((e.rDeny||0)>0){ const p2=G.B.hero; if(p2){ p2.denyT=Math.max(p2.denyT||0, e.rDeny);
        floatTxt(e.x,e.y-e.r-26,'さん……に……いち……','#ffc0d8',10,1.6); } }
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
    const nWeb=4;
    for(let i=0;i<nWeb;i++){ if(attachMonster(e,'tether',{r:36})) n++; else break; }
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
  /* v6.6 深い階で会うほど、目が増える */
  if(e.eyes && (e.brank||0)>0 && e.eyes.length<3+e.brank){
    const n=e.eyes.length;
    e.eyes.push({base:(n/(3+e.brank))*TAU, ang:0, state:'idle', t:rand(0.5,2.0), dx:0, dy:0});
  }
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
/* ================= v6.6 ボスの段(深いところで会うほど技が増える) =================
   深層個体(熟れた個体)による一律の底上げとは別に、ボス自身が段を持つ。
   段は「いま何層で出したか」で決まるので、浅い階に連れ出しても強くならない。 */
function bossRank(){
  const d=curFloor().depth;
  let r=0; for(const th of BAL.BOSS_RANK_D) if(d>=th) r++;
  return Math.max(0,r-1);
}
/* ================= v6.6 胞子系: ハイ → 疲れ → 中毒 =================
   吸うと一時的に元気になる(足も攻めも上がる)。同時に発情が乗るので、
   「強くなったつもりで、いちばん危ない所へ踏み込む」形になる。
   抜けると疲れてスタミナが落ち、身体に中毒が一つ残る。中毒が進むと、
   自分からきのこ系の罠を踏みに行くようになる——時間で薄れるが、その日のうちは戻らない。 */
function puffSpores(x,y,src){
  const B=G.B;
  spawnCloud(x,y,BAL.FLUFF_PUFF_R,4.0,BAL.SENSIT_GAS*0.7,'mistslime');
  parts(x,y,10,['#c8e86a','#9fe8c8','#fff'],80,0.8);
  for(const h of B.heroes){
    if(h.out) continue;
    if(Math.hypot(h.x-x,h.y-y)>BAL.FLUFF_PUFF_R) continue;
    inhaleSpore(h,src);
  }
}
function inhaleSpore(h,src){
  const B=G.B, ci0=B.ci; B.ci=h.hi;
  const first=!(h.highT>0);
  h.highT=BAL.HIGH_T;
  addHeatG(BAL.HIGH_HEAT); applySensit(BAL.HIGH_SENS);
  if(first){
    awardAil('high');
    B.nHigh=(B.nHigh||0)+1;
    heroBubble(h,pickRand(['……あれ? からだ、かるい……','いける、いけるよ! なんか、すごく……','あたま、ふわって……でも、うごける……']),true,2);
    floatTxt(h.x,h.y-70,'ハイ','#9fe8c8',12,1.2);
    if(src) codexMet(src);
  }
  B.ci=ci0;
}
/* ハイの持続と、抜けたあとの疲れ */
function highTick(h,dt){
  const B=G.B;
  if((h.highT||0)<=0){ if((h.addict||0)>0) h.addict=Math.max(0,h.addict-BAL.ADDICT_DECAY*dt); return; }
  h.highT-=dt;
  if(h.highT<=0){
    /* 抜けた。疲れが来て、身体に一つ残る */
    const ci0=B.ci; B.ci=h.hi;
    h.stamina=Math.max(0,h.stamina-BAL.CRASH_STAM);
    h.crashT=BAL.CRASH_T;
    h.addict=Math.min(BAL.ADDICT_MAX,(h.addict||0)+1);
    awardAil('addict');
    B.nCrash=(B.nCrash||0)+1;
    heroBubble(h,pickRand(['……あ、れ……ちから、ぬけ……','はぁっ……はぁ……いま、の……なに……','もう、いっかい……ううん、ちがう、ちがう……']),true,3);
    floatTxt(h.x,h.y-70,'—— 疲れ  スタミナ −'+BAL.CRASH_STAM,'#c8e86a',12,1.4);
    B.ci=ci0;
  }
}
/* 中毒が進むと、きのこ系の罠が「目当て」になる。咳き茸が居ない階でも媚茸・抱き茸・菌輪を探す */
function addictSeek(p){ return (p.addict||0)>=BAL.ADDICT_SEEK; }
/* ================= v6.6 眼系の「条(すじ)」 =================
   見るのではなく、決めた方向へ壁に当たるまで光を流し続ける。
   ・向きの変わりは遅い(RAY_TURN)ので、歩けば抜けられる——立ち止まると浴び続ける
   ・浅いところの個体は「快感が溜まるだけ」。深いところ(RAY_DEEP 階〜)の個体は絶頂まで運び、
     そこから連続絶頂に入るので、仲間に引き剥がしてもらうしかない
   ・★湧いた瞬間に条が出て事故になるのを防ぐため、必ず BEAM_WAKE の硬直を置く */
function rayDeep(){ return curFloor().depth>=BAL.RAY_DEEP; }
/* 条の一本ぶん。ang は絶対角。壁で止まる長さを返す */
function rayLen(x,y,ang){
  const ux=Math.cos(ang), uy=Math.sin(ang);
  let L=0;
  while(L<BAL.RAY_LEN){
    const nx=x+ux*(L+16), ny=y+uy*(L+16);
    if(solidAt(nx,ny)) break;   /* 壁に当たったらそこで止まる */
    L+=16;
  }
  return Math.max(24,L);
}
/* 一本の条を進め、浴びている間の効きを入れる。ray は {ang,state,t} を持つ器 */
function rayStep(e,ray,dt,d,dx,dy,off){
  const B=G.B, p=B.hero;
  const ox=e.x, oy=e.y-e.r*1.2;
  const want=Math.atan2((p.y-14)-oy,(p.x)-ox)+(off||0);
  /* 向きの変わりは遅い。歩けば抜けられる */
  let da=((want-ray.ang+Math.PI*3)%TAU)-Math.PI;
  ray.ang+=clamp(da,-BAL.RAY_TURN*dt,BAL.RAY_TURN*dt);
  ray.t-=dt;
  if(ray.state==='off'){ if(ray.t<=0){ ray.state='warm'; ray.t=BAL.RAY_WARM; sfx(700,1200,0.2,'sine',0.03); } return; }
  if(ray.state==='warm'){ if(ray.t<=0){ ray.state='on'; ray.t=BAL.RAY_ON; sfx(1500,900,0.2,'sawtooth',0.05); } }
  const L=rayLen(ox,oy,ray.ang);
  ray.len=L;
  if(ray.state==='on'){
    if(ray.t<=0){ ray.state='off'; ray.t=BAL.RAY_OFF*rand(0.8,1.2); return; }
    /* 浴びているか: 条の線分と彼女の距離 */
    const ux=Math.cos(ray.ang), uy=Math.sin(ray.ang);
    const rx=p.x-ox, ry=(p.y-14)-oy, along=clamp(rx*ux+ry*uy,0,L);
    const pd=Math.hypot(rx-ux*along, ry-uy*along);
    if(pd<BAL.RAY_W/2+p.r*0.7 && !p.pinned && losClear(ox,oy,p.x,p.y-14,true)){
      const deep=rayDeep();
      applyPleasure(BAL.RAY_PLE*dt*(e.rBeams?1.25:1));
      /* ★浅いところの条は「溜まるだけ」。99で頭打ちにしないと、深さの差が消える
         (実測で第3層と第12層がまったく同じ挙動になっていた) */
      if(!deep && p.aphro>=99 && p.climaxT<=0) p.aphro=99;
      if(deep && p.aphro>=100 && p.climaxT<=0) forcedClimax(e);
      /* 深いところの条は、達しても照らし続ける——そのまま連続絶頂へ入る。
         剥がすには仲間が条を遮るか、彼女を運び出すしかない */
      if(Math.random()<dt*3) parts(p.x+rand(-8,8),p.y-rand(6,26),1,['#ffd76a','#fff'],60,0.5);
      e.rayHitT=(e.rayHitT||0)+dt;
      if(e.rayHitT>0.8){ e.rayHitT=0;
        heroBubble(p,pickRand(['ひ、かり、が……きえ、ない……','うご、かな……あたって、る……','そこ、ずっと……やめ、て……']),false,3); }
    }
  }
}
function beamerTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  e.lookA=Math.atan2(dy,dx);
  /* v6.6 「照準して撃つ」から「壁に当たるまで流し続ける」へ。大型は三方向。
     ★湧いた直後は撃たない(BEAM_WAKE)——出た瞬間に条が乗って即絶頂する事故を潰す */
  if((e.wakeT||0)>0){ e.wakeT-=dt; if(d>240){ e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt; } return; }
  if(!e.rays){
    const n=(e.rBeams||0)>=2?3:3;   /* 大型は三方向。双条(熟れた個体)は広がりが大きい */
    e.rays=[]; for(let k=0;k<n;k++) e.rays.push({ang:Math.atan2(dy,dx), state:'off', t:rand(0.2,1.6)+k*0.5, len:0});
  }
  if(d>240){ e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt; }
  const spread=(e.rBeams||0)>=2?0.62:0.40;
  e.rays.forEach((r,k)=>rayStep(e,r,dt,d,dx,dy,(k-1)*spread));
}

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
  if(g.kind==='cover'){ const o=g.ref; if(!o||o.out) return false; if(distressOf(o)<BAL.COVER_TH*0.7) return false; g.x=o.x; g.y=o.y; return true; }   // v4.0 相方が持ち直すまで
  if(g.kind==='gather'){ const P=B.party; return !!(P && P.gather && B.time<P.gather.until && !partyGathered() && !partyDanger()); }   // v3.1 集合の途中
  if(g.kind==='wait') return !!(B.party && B.party.denRole);   // v3.2 外で待っている間
  if(g.kind==='event') return B.event===g.ref;
  if(g.kind==='chest') return B.chests.includes(g.ref) && !g.ref.taken;
  if(g.kind==='item') return B.items.includes(g.ref);
  if(g.kind==='pick') return B.picks.includes(g.ref) && !g.ref.dead;
  if(g.kind==='lure') return !!(g.ref && !g.ref.dead && lureLooksReal(g.ref));   // v4.1 見破ったら用はない
  if(g.kind==='addict') return !!(g.ref && !g.ref.dead) && addictSeek(p) && (p.highT||0)<=0;   /* v6.6 粉が抜けている間だけ、きのこを探す */
  if(g.kind==='poi'){ const q=g.ref; if(!M.known[q.key]) return false;
    if(q.kind==='shrine') return !M.visited[q.key];
    if(q.kind==='spring') return p.hp<p.maxHp*0.7 && p.springCd<=0;
    if(q.kind==='pool') return poolWant(p) && !(B.poolCd[q.key]>0);
    if(q.kind==='stele') return !B.steleRead[q.key];
    if(q.kind==='stairs') return !B.exitLocked && B.wantExit;   // v2.1 降りる気になってから
    if(q.kind==='seal') return !B.seals[q.key];
    if(q.kind==='core') return true;
    if(q.kind==='lantern') return lanternWant(p);   // v4.0 火照ったら離れる
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
function pendingLine(hi,path,delay,prio,who){ const P=G.B&&G.B.party; if(!P) return; P.pending=P.pending||[]; P.pending.push({hi,path,at:G.B.time+(delay||0.9),prio:prio||1,who}); }
function partyShare(p,kind,x,y,force){
  const B=G.B, P=B.party, o=partnerOf(p); if(!o) return false;
  const far=Math.abs(x-o.x)>W/2 || Math.abs(y-o.y)>H/2;   // 相手の画面外の物だけ伝える(ボスは必ず)
  if(!far && !force) return false;
  // v4.0 行き先になる物(場所・宝箱・光の柱)を見つけたら「新しい報せ」として覚えておく。
  //      敵が薄ければ、次の決め直しで互いに歩み寄って相談する引き金になる
  if(P && kind!=='boss') P.sight={kind, x, y, at:B.time, by:p.hi};
  if(sayPartyAs(p.hi,'share.'+kind,kind==='boss'?2:1,10)){ pendingLine(o.hi,'share.ack',0.9,1); return true; } return false;
}
function partyExchange(key,sub){
  const B=G.B, P=B.party; if(!P||typeof LINES_P==='undefined'||!LINES_P.banter) return false;
  let pool=LINES_P.banter[key]; if(sub!==undefined && pool && !Array.isArray(pool)) pool=pool[sub]; if(!Array.isArray(pool)||!pool.length) return false;
  /* v5.3 話者が全員その場に居る掛け合いだけを使う。
     以前は「居ない子の行を飛ばして、残りは喋る」だったので、相手の名前を呼ぶ台詞——
     「フレイラ、いまの すごかった!」——が、フレイラが捕まって離脱した後にも出ていた。
     掛け合いで呼ぶ名前は必ずもう一方の話者のものなので、全員居ることを条件にすれば足りる。
     「フレイラの火、あったかいね〜」のような、その子でなければ意味のない台詞も、これで守れる */
  const usable=pool.filter(ex=>Array.isArray(ex)&&ex.length&&ex.every(ln=>{
    const h=B.heroes.find(x=>x.id===ln.s); return !!(h&&!h.out); }));
  if(!usable.length) return false;
  const ex=usable[(Math.random()*usable.length)|0]; let t=0; P.pending=P.pending||[];
  for(const ln of ex){ const h=B.heroes.find(x=>x.id===ln.s); if(t===0) heroBubble(h,ln.t,true,1); else P.pending.push({hi:h.hi,txt:ln.t,at:B.time+t,prio:1}); t+=1.3; }
  return true;
}
function partyTick(dt){
  const B=G.B, P=B.party; if(!P) return;
  if(P.pending&&P.pending.length){ const keep=[]; for(const q of P.pending){ if(B.time>=q.at){ const h=B.heroes[q.hi]; if(h&&!h.out){ if(q.path) sayPartyAs(q.hi,q.path,q.prio||1,0,q.who); else heroBubble(h,q.txt,true,q.prio||1); } } else keep.push(q); } P.pending=keep; }
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
/* ================= v5.0 ヤミコ =================
   渦の中心で、魔核の闇と天使の加護の両方を持って生まれた者。堕天使ではない。
   三段の筋: (1)前回の最下層で眠っている大ボス → (2)淫魔たちに囲まれている所を助けられる → (3)参戦。
   居場所は毎回ひとつ上へ繰り上がる。動いているのは深淵のほうで、彼女は生まれた場所から動かない。
   ヒロインとしての特徴: 発光を持たないどころか、周りの光を吸う。吸っているだけなので、
   えっちな目に遭うと漏れて光る。闇の中でだけ瞬間移動できる。武器とパッシブは最初からLv5 */
/* v5.0 合流の朝: 誰が来たかで場面を分ける(単一フラグのままだと、三人目の朝にフレイラとの出会いが再生される) */
function joinMorning(V30,fIntro,F,take){
  if(!(G.B.heroes.length>1) || !V30 || !V30.party) return null;
  const who=META.run.joinWho||'freila';
  if(META.run.storySeen['join_'+who]) return null;
  const J=(V30.party.joinBy&&V30.party.joinBy[who])||((who==='freila')?{join:V30.party.join, joinLate:V30.party.joinLate}:null);
  if(!J||!J.join||!J.join.length) return null;
  const late=(META.run.joinWhy==='late' && J.joinLate && J.joinLate.length);
  if(!take) return true;
  META.run.storySeen['join_'+who]=1;
  if(late) META.run.storySeen['loop'+META.era]=1;
  META.run.storySeen['f'+F.depth]=1; META.run.joinWhy=''; saveMeta();
  return (late?J.joinLate:J.join).concat(fIntro);
}
function yamiState(){ META.yami=META.yami||{st:0,era:-1,saved:0}; return META.yami; }
const yamiDmgK=e=>(e&&e.dmg?e.dmg/MONSTERS.yamiboss.dmg:1);
/* 一幕を出す(1戦に一度ずつ。ADV の間は時間が止まる) */
function yamiStory(key){
  const B=G.B; B.yamiSeen=B.yamiSeen||{}; if(B.yamiSeen[key]) return;
  B.yamiSeen[key]=1;
  const V=(typeof STORY_V30!=='undefined')?STORY_V30.yami:null;
  if(V && V[key] && V[key].length && typeof UI!=='undefined' && UI.showStory) UI.showStory(V[key]);
}   // 階層と世代のぶん(spawnUnit が e.dmg に掛けている)
function yamiStage(){ return yamiState().st|0; }
/* 段を進める(endBattle から)。クウが加わった後、最初に魔核を討った回の「次の回」から眠り始める */
function yamiAdvance(runNote){
  const Y=yamiState(), era=eraNow();
  if(Y.st===0){
    if(runNote==='clear' && META.party.roster.includes('kuu')){ Y.st=1; Y.era=era; }   // クウを迎えて最初に討った、その翌朝から。討った場所に横たわっている
  }else if(Y.st===1){
    if(runNote==='clear'){ Y.st=2; Y.era=era; }   // その回の魔核を討った次の回、淫魔たちに囲まれている
  }else if(Y.st===2){
    if(Y.saved && runNote==='clear'){ Y.st=3; Y.era=era; partyJoin('yamiko','rescued'); }   // 助けた回の魔核を討てば、次の回から参戦
  }
  saveMeta();
}
/* v5.1 ヤミコが現れる階 = 前の周回で最下層だった階。彼女たちが魔核を討った、まさにその場所。
   深淵が組み替わって下にもう一段生えたので、そこはもう底ではない。
   「深淵の底」という名の階が底でなくなる——ループの主題が、いちばん目に見える形で出る所 */
function yamiFloor(){ const B=G.B; return !!(B&&B.floor) && !B.floor.final && B.floor.depth===openFloors()-1; }
/* その階の「いちばん深い所」= 降り口。最終階層で魔核が座っていたのと同じ役どころ */
function yamiAnchor(){ const q=(G.map&&G.map.pois)?G.map.pois.find(o=>o.kind==='stairs'):null; return q||{x:0,y:0}; }
/* 前回の最下層に、眠っている者を置く */
function spawnYamiBoss(){
  const B=G.B; if(yamiStage()!==1 || !yamiFloor()) return;
  const c=yamiAnchor(), R=BAL.YAMI_ANCHOR_R;
  let q=null;
  for(let k=0;k<400&&!q;k++){ const a=rand(TAU), d=rand(R[0],R[1]);
    const x=c.x+Math.cos(a)*d, y=c.y+Math.sin(a)*d;
    const s=snapFloor(x,y,false,4); if(s&&reachableAt(s.x,s.y,false)) q=s; }
  if(!q) q=snapFloor(c.x+300, c.y, false, 6)||{x:c.x,y:c.y};
  const u=spawnUnit('yamiboss',q.x,q.y,{});
  if(!u) return;
  u.hp=u.maxHp=Math.round(MONSTERS.yamiboss.hp*(1+0.18*Math.max(0,eraNow()-6))*(1+0.05*Math.max(0,(B.hero.level||1)-1)));
  u.asleep=true; u.dormant=true; u.dormT=0;   // v5.0 眠っている間は動かない・狙われない(dormant が全部を止める)
  u.wakeT=0; u.bladeCd=1.2; u.ringCd=4; u.spearCd=3; u.callCd=6; u.meltCd=5; u.meltT=0;
  B.yami=u;
}
/* 淫魔三種に囲まれている(救出の一幕)。ここも「前回の最下層」——一段ずつ、上がってくる */
function spawnYamiCaptive(){
  const B=G.B; if(yamiStage()!==2 || !yamiFloor()) return;
  const c=yamiAnchor(), R=BAL.YAMI_CAP_R;
  let q=null;
  for(let k=0;k<400&&!q;k++){ const a=rand(TAU), d=rand(R[0],R[1]);
    const x=c.x+Math.cos(a)*d, y=c.y+Math.sin(a)*d;
    const s=snapFloor(x,y,false,5); if(s&&reachableAt(s.x,s.y,false)) q=s; }
  if(!q) q=snapFloor(c.x+400, c.y, false, 6)||{x:c.x,y:c.y};
  B.yamiCap={x:q.x, y:q.y, t:0, save:0, seen:false, freed:false, imps:[]};
  const kinds=['imp','succubus','succuqueen'];
  for(let i=0;i<BAL.YAMI_SAVE_IMPS;i++){
    const a=i*TAU/BAL.YAMI_SAVE_IMPS+0.4, e=spawnUnit(kinds[i%kinds.length], q.x+Math.cos(a)*34, q.y+Math.sin(a)*26, {});
    if(!e) continue;
    e.yamiHold=true; e.hp=e.maxHp=Math.round(e.maxHp*1.6); e.homeX=q.x; e.homeY=q.y; e.holdA=a;
    B.yamiCap.imps.push(e);
  }
  META.map.known['yamicap']=1;
  G.map.pois.push({kind:'yamicap', x:q.x, y:q.y, key:'yamicap'});
}
/* 眠り手の毎フレーム */
/* v5.0 眠り手はとどめを刺さない。削るだけ削って、飽きる。
   彼女には捕獲の場面が無い(あるべきでもない)ので、ここで下限を作る */
function yamiHurt(e,h,dmg,opt){
  const B=G.B, ci0=B.ci; B.ci=h.hi;
  const floor=h.maxHp*BAL.YAMI_MERCY;
  if(h.hp>floor) hurtHero(Math.min(dmg, h.hp-floor), e, opt||{});
  else if(!h.yamiSpared){ h.yamiSpared=1;
    floatTxt(e.x,e.y-e.r-30,pickRand(['……もういい','つまらない','立ちなさい']),'#c9a6ff',12,2.0); }
  B.ci=ci0;
}
function yamiBossTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  if(e.asleep){
    if(d<BAL.YAMI_WAKE){
      e.asleep=false; e.wakeT=1.2;
      yamiStory('wake');
      setBanner('渦の眠り手','横たわっていたものが、目を開けた。光を吸って、闇が濃くなる','#a77dff');
      sayLine('feat.yamiWake',1,0,'……なにか、おきた。ひかりが、すいこまれてる');
      G.shake=Math.min(14,G.shake+8); sfx(90,50,0.9,'sawtooth',0.11);
      B.fx.push({kind:'darkring', x:e.x, y:e.y, r:BAL.YAMI_DARK_R, t:0, life:1.2});
      codexMet('yamiboss');
    }
    return;
  }
  if(e.wakeT>0){ e.wakeT-=dt; return; }   // 起き上がる間
  if(e.meltT>0){   // 闇に溶けている間は当たらない
    e.meltT-=dt;
    if(e.meltT<=0){
      let q=null;
      for(let k=0;k<40&&!q;k++){ const a=rand(TAU), dd=rand(120,260);
        const s=snapFloor(p.x+Math.cos(a)*dd, p.y+Math.sin(a)*dd, false, 4);
        if(s&&reachableAt(s.x,s.y,false)) q=s; }
      if(q){ e.x=q.x; e.y=q.y; }
      B.fx.push({kind:'darkring', x:e.x, y:e.y, r:110, t:0, life:0.6});
      parts(e.x,e.y-10,18,['#2a1a3e','#a77dff','#5a3a7a'],150,0.6);
    }
    return;
  }
  e.meltCd-=dt; e.bladeCd-=dt; e.ringCd-=dt; e.spearCd-=dt; e.callCd-=dt;
  if(e.meltCd<=0 && d>280){ e.meltCd=BAL.YAMI_MELT_CD; e.meltT=BAL.YAMI_MELT_T; parts(e.x,e.y-10,14,['#2a1a3e','#a77dff'],110,0.5); return; }
  if(d>60){ e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt; }
  /* 闇の刃: 前を広く薙ぐ */
  if(e.bladeCd<=0 && d<BAL.YAMI_BLADE_R+40){
    e.bladeCd=BAL.YAMI_BLADE_CD; e.swing=0.3; e.swingA=Math.atan2(dy,dx);
    for(const h of B.heroes){ if(h.out) continue;
      const hx=h.x-e.x, hy=(h.y-10)-e.y, hd=Math.hypot(hx,hy);
      if(hd>BAL.YAMI_BLADE_R+12) continue;
      const da=Math.abs(((Math.atan2(hy,hx)-e.swingA+Math.PI*3)%TAU)-Math.PI);
      if(da<1.1) yamiHurt(e,h,BAL.YAMI_BLADE_DMG*yamiDmgK(e),{pierce:true}); }
    B.fx.push({kind:'darkslash', x:e.x, y:e.y, ang:e.swingA, r:BAL.YAMI_BLADE_R, t:0, life:0.4});
    sfx(180,70,0.3,'sawtooth',0.09);
  }
  /* 闇の輪: 自分の周りで弾ける */
  if(e.ringCd<=0 && d<BAL.YAMI_RING_R+60){
    e.ringCd=BAL.YAMI_RING_CD;
    for(const h of B.heroes){ if(h.out) continue;
      if(Math.hypot(h.x-e.x,h.y-e.y)<BAL.YAMI_RING_R+10) yamiHurt(e,h,BAL.YAMI_RING_DMG*yamiDmgK(e),{noKb:true}); }
    B.fx.push({kind:'darkring', x:e.x, y:e.y, r:BAL.YAMI_RING_R, t:0, life:0.7});
    G.shake=Math.min(9,G.shake+4); sfx(120,60,0.4,'square',0.08);
  }
  /* 闇の穿ち: 遠くの一体へ槍を放つ */
  if(e.spearCd<=0){
    e.spearCd=BAL.YAMI_SPEAR_CD;
    let t=null, td=-1; for(const h of B.heroes){ if(h.out) continue; const hd=Math.hypot(h.x-e.x,h.y-e.y); if(hd>td){ td=hd; t=h; } }
    if(t){ const a=Math.atan2((t.y-10)-e.y,t.x-e.x);
      B.ebullets.push({kind:'dark', x:e.x, y:e.y-8, vx:Math.cos(a)*BAL.YAMI_SPEAR_SPD, vy:Math.sin(a)*BAL.YAMI_SPEAR_SPD, t:0, life:1.6, r:9, dmg:BAL.YAMI_SPEAR_DMG*yamiDmgK(e), src:'yamiboss'});
      sfx(300,120,0.25,'triangle',0.06); }
  }
  /* 影の招き: その階層の相性種を呼ぶ */
  if(e.callCd<=0){
    e.callCd=BAL.YAMI_CALL_CD;
    const aff=(B.floor.affinity||['hand']).filter(id=>MONSTERS[id]&&!MONSTERS[id].boss&&!MONSTERS[id].guardian);
    for(let i=0;i<BAL.YAMI_CALL_N;i++){
      const id=pickRand(aff.length?aff:['hand']), a=rand(TAU), q=snapFloor(e.x+Math.cos(a)*rand(70,150), e.y+Math.sin(a)*rand(70,150), false, 3);
      if(q){ const u=spawnUnit(id,q.x,q.y,{}); if(u){ u.fromDark=true; parts(q.x,q.y-8,10,['#2a1a3e','#a77dff'],100,0.5); } }
    }
    B.fx.push({kind:'darkring', x:e.x, y:e.y, r:170, t:0, life:0.8});
    S.summon();
  }
}
/* 救出の一幕: 淫魔たちが彼女を離さない。そばに居続けると解ける */
function yamiCapTick(dt){
  const B=G.B, C=B.yamiCap; if(!C||C.freed) return;
  C.t+=dt;
  const act=B.heroes.filter(h=>!h.out);
  if(!C.seen && act.some(h=>Math.hypot(h.x-C.x,h.y-C.y)<520)){
    C.seen=true;
    yamiStory('see');
    setBanner('渦の縁の一幕','闇を纏った誰かが、三体に囲まれて、抵抗もできずにいる','#a77dff');
    sayLine('feat.yamiSee',1,0,'……あれ、だれ? っていうか、あれ、たすけないと!');
    codexMet('yamiboss');
  }
  /* 掴んでいる三体は、その場から離れない */
  for(const e of C.imps){
    if(e.dead) continue;
    e.x+=(C.x+Math.cos(e.holdA+C.t*0.4)*32-e.x)*Math.min(1,dt*4);
    e.y+=(C.y+Math.sin(e.holdA+C.t*0.4)*24-e.y)*Math.min(1,dt*4);
    e.state='idle';
  }
  const alive=C.imps.filter(e=>!e.dead).length;
  const near=act.filter(h=>Math.hypot(h.x-C.x,h.y-C.y)<BAL.YAMI_SAVE_R).length;
  if(alive===0 || near>0) C.save+=dt*(alive===0?2.2:near*0.8);
  else C.save=Math.max(0,C.save-dt*0.4);
  if(Math.random()<dt*5) parts(C.x+rand(-22,22), C.y-rand(0,22), 1, ['#ff9ec2','#a77dff','#fff'], 50, 0.7);
  if(C.save>=BAL.YAMI_SAVE_T){
    C.freed=true; yamiState().saved=1; saveMeta();
    for(const e of C.imps) if(!e.dead) killEnemy(e);
    B.fx.push({kind:'darkring', x:C.x, y:C.y, r:200, t:0, life:1.2});
    parts(C.x,C.y-14,40,['#a77dff','#fff','#ff9ec2'],220,0.9);
    yamiStory('free');
    setBanner('助け出した','闇の子はフラフラと浮かび上がり、腰の引けたまま、逃げるように奥へ消えた','#a77dff');
    sayLine('feat.yamiFree',1,0,'……あ、いっちゃった。おれい、くらい……');
    sayPartyOrLine(B.heroes[leaderIdx()],'feat.yamiFree','……あ、いっちゃった');
    B.nYamiSave=(B.nYamiSave||0)+1;
  }
}
/* ヒロインとしてのヤミコ ------------------------------------------------ */
/* 周りの光を吸う。ただし吸っているだけなので、えっちな目に遭っている間は漏れて光る */
function yamiLeak(h){
  if(!h||h.id!=='yamiko') return 0;
  let v=0;
  v+=Math.min(1,(h.heatLv||0)/3)*0.5;
  v+=Math.min(1,(h.sensit||0)/120)*0.3;
  if(h.climaxT>0) v=1;
  if(h.pinned||attachCount(h)>0) v=Math.max(v,0.55);
  if(h.charmBind) v=Math.max(v,0.7);
  return Math.min(1,v);
}
function yamiDarkAt(x,y){
  const B=G.B; if(!B||!B.heroes) return 0;
  let v=0;
  for(const h of B.heroes){
    if(h.out||!(HEROES[h.id]||{}).dark) continue;
    const d=Math.hypot(x-h.x,y-h.y); if(d>=BAL.YAMI_DARK_R) continue;
    v=Math.max(v,(1-d/BAL.YAMI_DARK_R)*BAL.YAMI_DARK_EAT*(1-yamiLeak(h)*BAL.YAMI_LEAK));
  }
  return v;
}
/* 闇渡り: 暗い所へなら跳べる。囲まれた時と、遠い目当てへ向かう時に使う */
function yamiStep(p){
  const B=G.B;
  let best=null, bs=1e9;
  for(let k=0;k<16;k++){
    const a=k*TAU/16, d=rand(BAL.YAMI_STEP_R*0.5,BAL.YAMI_STEP_R);
    const q=snapFloor(clampMapX(p.x+Math.cos(a)*d,40), clampMapY(p.y+Math.sin(a)*d,40), false, 3);
    /* ★壁を挟んだ先へは溶けない(分断を防ぐ)。§ blink と同じ理由 */
    if(!q||!reachableAt(q.x,q.y,false)||!losClear(p.x,p.y,q.x,q.y,false)) continue;
    if(lightAt(q.x,q.y)>BAL.YAMI_STEP_DARK) continue;   // 明るい所へは跳べない
    const sc=nearEnemyCount(q.x,q.y,150,true)+nearEnemyCount(q.x,q.y,60,true)*2;
    if(sc<bs){ bs=sc; best=q; }
  }
  if(!best) return false;
  parts(p.x,p.y-14,20,['#2a1a3e','#a77dff'],160,0.6);
  B.fx.push({kind:'darkring', x:p.x, y:p.y, r:70, t:0, life:0.5});
  p.x=best.x; p.y=best.y; p.vx=p.vy=0; p.path=null; p.ifr=Math.max(p.ifr,0.4);
  parts(p.x,p.y-14,20,['#a77dff','#fff'],160,0.6);
  sfx(260,90,0.22,'triangle',0.06);
  return true;
}
/* 強がりが崩れる: 追い詰められると、すぐ助けを乞う */
function yamiBegTick(p,dt){
  const B=G.B;
  const d=distressOf(p);
  if(d>=BAL.YAMI_BEG && B.time-(p.begSaid===undefined?-99:p.begSaid)>BAL.YAMI_BEG_CD){
    p.begSaid=B.time;
    sayLine('feat.yamiBeg',2,0,'……っ、たすけて。ほんとに、むり');
    floatTxt(p.x,p.y-56,'……たすけて','#a77dff',12,1.4);
  }
}
function yamiWeapons(p,dt,atkMult){
  const B=G.B;
  /* 闇の刃: 前を広く薙ぐ(敵だった頃と同じ形。ずっと小さい) */
  /* v6.3 闇の刃: 振った跡が、闇のまま宙に残る。
     ★前は「ルミナのムチを紫にしただけ」だった。彼女は斬った線を積み重ねて、
     自分の周りに通れない檻を組む——追われる側でいるほど強い、という形にする */
  if(p.wp.dblade>0){
    p.dbladeT=(p.dbladeT||0)-dt*atkMult;
    if(p.dbladeT<=0){
      const evo=p.evo.eclipse>0, lvR=p.wp.dblade, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
      p.dbladeT=(evo?0.78:1.05)*Math.pow(0.92,lv-1)*ov.cd;
      const range=(evo?150:96+9*lv)*areaMult(p)*ov.area, dmg=(evo?24:11+4.4*(lv-1))*ov.dmg;
      /* 斬る向き: 追ってくる者が居ればその線上、居なければ向いている方 */
      const t0=nearestEnemies(1, range*1.6)[0];
      const ang=t0?Math.atan2(t0.y-(p.y-10), t0.x-p.x):(p.face>=0?0:Math.PI);
      p.whipAnim=0.16; p.whipDir=Math.cos(ang)>=0?1:-1; p.whipR=range; p.whipDark=true;
      let hit=false;
      for(const e of B.enemies){ if(e.dead||e.dormant) continue;
        const ex=e.x-p.x, ey=e.y-(p.y-10);
        const inArc=evo?Math.hypot(ex,ey)<range+e.r:(ex*p.whipDir>0 && Math.hypot(ex,ey)<range+e.r);
        if(inArc){ damageEnemy(e,dmg); hit=true; if(evo) e.stun=Math.max(e.stun||0,0.25); } }
      /* 残る線: 彼女を横切る一本。振った方向に直交して引く(逃げ道を塞ぐ形) */
      { const na=ang+Math.PI/2, hx=Math.cos(na)*range*0.9, hy=Math.sin(na)*range*0.9;
        const seams=B.zones.filter(z=>z.seam);
        while(seams.length>=BAL.DSEAM_MAX){ const old=seams.shift(); const i=B.zones.indexOf(old); if(i>=0) B.zones.splice(i,1); }
        B.zones.push({seam:true, x:p.x-hx, y:(p.y-10)-hy, x2:p.x+hx, y2:(p.y-10)+hy,
          r:BAL.DSEAM_W, t:0, life:BAL.DSEAM_T*(evo?1.6:1), dmg:dmg*BAL.DSEAM_DMG, tick:0, dark:true}); }
      if(hit){ sfx(190,80,0.1,'sawtooth',0.05); parts(p.x+(p.whipDir||1)*range*0.5,p.y-10,6,['#a77dff','#2a1a3e'],120,0.4); if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN); }
    }
  }
  /* v6.3 闇の輪: 外からゆっくり締まって、触れた者を内側へ引き込む。
     ★前はフレイラの火の輪と同じ「一定半径を回る輪」だった。
     こちらは投網。輪が縮みきる頃には、囲った者が刃の間合いに集まっている */
  if(p.wp.dring>0){
    const evo=p.evo.umbra>0, lvR=p.wp.dring, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
    p.dringAng=(p.dringAng||0)+dt*2.0;
    p.dringPh=((p.dringPh||0)+dt/(BAL.DRING_CYCLE*(evo?0.78:1)))%1;
    const Rmax=(evo?128:74+9*lv)*areaMult(p)*ov.area;
    const R=Rmax-(Rmax-Rmax*BAL.DRING_MIN)*p.dringPh, dmg=(evo?8:3.6+1.4*(lv-1))*ov.dmg;
    p.dringR=R; p.dringPhase=p.dringPh; p.dringT=(p.dringT||0)-dt*atkMult;
    if(p.dringT<=0){
      p.dringT=0.3*ov.cd;
      for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue;
        const d2=Math.hypot(e.x-p.x,e.y-p.y);
        if(Math.abs(d2-R)<20+e.r){ damageEnemy(e,dmg);
          /* 引き込むのは、動ける小物だけ。据わった個体とボスは動かない */
          if(!e.boss && !isSeated(e.id) && e.state!=='attached'){
            const a=Math.atan2(p.y-e.y,p.x-e.x), k=BAL.DRING_PULL*(evo?1.5:1);
            e.x+=Math.cos(a)*k; e.y+=Math.sin(a)*k; collideMap(e,e.r*0.75,canFly(e.id)); } } }
    }
  } else { p.dringR=0; p.dringPh=0; }
  /* v6.3 闇の穿ち: いちばん「遠い」的を狙い、その的が暗がりに立っているほど深く貫く。
     ★前はルミナの刃と同じ「いちばん近い一体へ弾を撃つ」だった。
     全員が近くを撃つ中で、この子だけが奥の暗がりを撃つ——光を吸う子の役目にする */
  if(p.wp.dspear>0){
    p.dspearT=(p.dspearT||0)-dt*atkMult;
    if(p.dspearT<=0){
      const evo=p.evo.gloom>0, lvR=p.wp.dspear, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
      const maxD=(evo?760:520)*(1+0.12*(p.ps.reach||0));
      let t=null, bd=-1;
      for(const e of B.enemies){ if(e.dead||e.dormant||e.item||e.state==='attached') continue;
        const d=Math.hypot(e.x-p.x,e.y-p.y);
        if(d>maxD||d<40) continue;
        if(!losClear(p.x,p.y-14,e.x,e.y,true)) continue;
        /* 遠さと暗さの両方で選ぶ。同じくらい遠いなら、暗い方を撃つ */
        const sc=d*(1+BAL.DSPEAR_DARK*(1-lightAt(e.x,e.y)));
        if(sc>bd){ bd=sc; t=e; } }
      if(!t) p.dspearT=0.15;
      else{
        p.dspearT=(1.5-0.10*(lv-1))*ov.cd;
        const a=Math.atan2(t.y-(p.y-14),t.x-p.x);
        const dk=1-lightAt(t.x,t.y);
        const dmg=(14+6*(lv-1))*ov.dmg*(evo?1.4:1)*(1+BAL.DSPEAR_DARK*dk);
        B.bullets.push({x:p.x, y:p.y-14, vx:Math.cos(a)*560, vy:Math.sin(a)*560, dmg, pierce:(evo?3:1)+(p.ps.pierce||0)+(dk>0.6?1:0), life:1.6, last:null, dark:true});
        if(dk>0.6) floatTxt(p.x,p.y-58,'暗がりを穿つ','#a77dff',10,0.7);
        sfx(320,140,0.14,'triangle',0.05);
        if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN);
      }
    }
  }
  /* 影の招き: 闇から影を呼んで戦わせる(味方) */
  if(p.wp.dcall>0){
    p.dcallT=(p.dcallT||0)-dt*atkMult;
    if(p.dcallT<=0){
      const lvR=p.wp.dcall, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
      p.dcallT=(4.5-0.3*(lv-1))*ov.cd;
      B.shades=B.shades||[];
      if(B.shades.length<4+dupN(p)){
        const a=rand(TAU);
        B.shades.push({x:p.x+Math.cos(a)*40, y:p.y+Math.sin(a)*40, t:0, life:6+lv*0.6, dmg:(5+2.2*(lv-1))*ov.dmg, cd:0, hi:p.hi});
        parts(p.x,p.y-10,10,['#2a1a3e','#a77dff'],100,0.5);
      }
    }
  }
  /* 影渡りの余波: 跳んだ跡で闇が弾ける(パッシブ的に効く) */
  if(p.wp.dstep>0 && (p.stepFx||0)>0){
    const lvR=p.wp.dstep, lv=Math.min(BAL.WP_EVO_LV,lvR), ov=wpOver(lvR,p);
    const R=(70+9*lv)*areaMult(p)*ov.area, dmg=(12+5*(lv-1))*ov.dmg;
    for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue;
      if(Math.hypot(e.x-p.stepX,e.y-p.stepY)<R+e.r){ damageEnemy(e,dmg); e.stun=Math.max(e.stun||0,0.3); } }
    B.fx.push({kind:'darkring', x:p.stepX, y:p.stepY, r:R, t:0, life:0.5});
    p.stepFx=0;
  }
}
/* 影(味方)の毎フレーム */
function shadesTick(dt){
  const B=G.B; if(!B.shades||!B.shades.length) return;
  for(const s of B.shades){
    s.t+=dt; if(s.t>=s.life) continue;
    const ts=nearEnemiesR({x:s.x,y:s.y}, 1, 260);
    const t=ts[0];
    if(t){ const dx=t.x-s.x, dy=t.y-s.y, d=Math.hypot(dx,dy)||1;
      if(d>28){ s.x+=dx/d*150*dt; s.y+=dy/d*150*dt; }
      s.cd-=dt;
      if(s.cd<=0 && d<40){ s.cd=0.8; const ci0=B.ci; B.ci=s.hi; damageEnemy(t,s.dmg); B.ci=ci0;
        parts(s.x,s.y-6,4,['#a77dff','#2a1a3e'],80,0.3); } }
    else{ const h=B.heroes[s.hi]; if(h&&!h.out){ const dx=h.x-s.x, dy=h.y-s.y, d=Math.hypot(dx,dy)||1; if(d>60){ s.x+=dx/d*160*dt; s.y+=dy/d*160*dt; } } }
  }
  B.shades=B.shades.filter(s=>s.t<s.life);
}
/* v5.0 「基本ルミナ」: 素性に follow が書かれていれば、その子が近くにいる限り相方と見なす */
function partnerFor(p){
  const B=G.B, HD=HEROES[p.id]||{};
  if(HD.follow){ const L=B.heroes.find(h=>h.id===HD.follow&&!h.out&&h!==p);
    if(L && Math.hypot(L.x-p.x,L.y-p.y)<BAL.KUU_LUMI_R) return L; }
  return partnerOf(p);
}
/* v5.0 別々に行動してよいか: 互いの光が届く(壁を挟まない)・危なくない・魔核戦や巣窟の役分担の最中でない */
function partySplitOk(p){
  const B=G.B, o=partnerOf(p); if(!o||o.out) return false;
  if(B.coreWar || (B.party&&B.party.denRole) || B.wantExit) return false;   /* 魔核戦・巣窟の役・降りると決めた後は、離れずに動く */
  for(const h of [p,o]){ if(h.out||h.pinned||attachCount(h)>0||h.hp<h.maxHp*BAL.SPLIT_HP||(h.threatV||0)>=BAL.SPLIT_THREAT) return false; }   /* どちらかが苦しければ合流する */
  if(Math.hypot(p.x-o.x,p.y-o.y)>BAL.SPLIT_R) return false;
  return losClear(p.x,p.y-10,o.x,o.y-10,false);   /* 壁を挟むと互いの光が消える。そうなったら別行動はやめる */
}
function updateGoal(p){
  const B=G.B, P=B.party, active=B.heroes.filter(h=>!h.out);
  if(P && P.gather && (active.length<2 || B.time>P.gather.until+1)){ P.gather=null; P.gatherDone=0; }   // v3.1 流れた集合(誰かが捕まった・戦いが長引いた)は、後で「いま集まった」と数えない
  if(!P || active.length<2) return updateGoalSolo(p);
  if(P.denRole && denWaits(P.denRole).includes(p.hi) && denOf()) return denWaitGoal(p);   // v3.2 外で待つ役は、自分の立ち位置を持つ
  if(P.goal && P.owner && !P.owner.out && goalValid(P.owner,P.goal) && B.time<P.until){
    if(p!==P.owner && p.splitG && B.time<(p.splitUntil||0) && goalValid(p,p.splitG) && partySplitOk(p)){   /* v5.0 別行動の間は自分の目当てを続ける */
      if(p.splitG.ref && p.splitG.kind!=='explore' && p.splitG.kind!=='event'){ p.splitG.x=p.splitG.ref.x; p.splitG.y=p.splitG.ref.y; }
      p.goal=p.splitG; p.goalT=B.time+BAL.GOAL_RETHINK; return p.goal;
    }
    if(p.splitG){ p.splitG=null; p.splitUntil=0; }
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
  // v4.0 見えた物を伝えた直後は、いつもの間隔を待たずに「近くで相談」を呼ぶ(敵が薄い時だけ)
  const news=!!(P.sight && B.time-P.sight.at<BAL.SHARE_T && B.time-(P.sightT||-99)>BAL.SHARE_CD);
  if((talkable||news) && !P.gatherDone && (news || B.time-(P.gatherT||-99)>BAL.GATHER_CD) && !partyGathered() && !partyDanger()){
    if(news){ P.sightT=B.time; P.sightUse=P.sight; P.sightUseT=B.time; P.sight=null; B.nNewsGather=(B.nNewsGather||0)+1; }
    const c=partyCenter(); P.gather={until:B.time+BAL.GATHER_T, x:c.x, y:c.y}; P.gatherT=B.time;
    const gg={kind:'gather', sub:'gather', x:c.x, y:c.y, ref:null, key:'gather', d:0, worth:1.3, score:1.3};
    P.goal=gg; P.owner=active[0]; P.until=P.gather.until;
    for(const h of active){ h.goal=gg; h.goalT=B.time+BAL.GOAL_RETHINK; }
    const caller=active.find(h=>h.hi===P.turn)||active[0];   // 優先権の子が呼ぶ
    if(sayPartyAs(caller.hi,'gather.call',1,0)){ P.gatherCaller=caller.hi; } else P.gatherCaller=-1;
    B.nGather=(B.nGather||0)+1;
    return p.goal;
  }
  // v4.0 集まって相談: 報せた物が候補にあるなら、それを推す(伝えた甲斐がある)
  if(P.sightUse && B.time-(P.sightUseT||0)>BAL.SHARE_T*1.5) P.sightUse=null;   // 集まれなかった報せは古びる
  if(P.sightUse && gathered){
    const sg=P.sightUse; let pick=null, pd=1e9;
    for(const x of props){ const d=Math.hypot(x.g.x-sg.x,x.g.y-sg.y); if(d<200 && d<pd){ pd=d; pick=x; } }
    if(pick){ for(const x of props) if(x!==pick) x.g.score*=0.55; }
    P.sightUse=null;
  }
  let win=props[0];
  if(!same){
    win=props.find(x=>x.h.hi===P.turn)||props[0];
    const best=props.reduce((a,b)=>b.g.score>a.g.score?b:a);
    if(best!==win && (best.g.kind==='rescue' || best.g.score>win.g.score*1.8)) win=best;   // 救出と大差は優先権より先
    const losers=props.filter(x=>x!==win); if(losers.length){ P.turn=losers[0].h.hi; P.lastLoser=losers[0].h.hi; }
    for(const L of losers){ if(L.h.id==='kuu' && L.g) L.h.iceBias={x:L.g.x, y:L.g.y, t:B.time+8}; }   // v5.0 口では譲って、8秒後に自分の行きたかった方へ道を引く
  }
  P.goal=win.g; P.owner=win.h; P.until=B.time+(same?BAL.GOAL_RETHINK:BAL.PARTY_HOLD);
  denAssignRole(win,active);   // v3.2 巣窟が目当てなら、入る役と待つ役を決める
  for(const x of props){ if(P.denRole && denWaits(P.denRole).includes(x.h.hi)) continue;
    /* v5.0 互いが見えているなら、譲らず自分の目当てへ。壁を挟んだり危なくなれば、また一緒に動く */
    if(x!==win && !same) B.nSplitTry=(B.nSplitTry||0)+1;
    if(x!==win && !same && x.g.kind!=='rescue' && P.goal.kind!=='rescue' && x.g.score>=BAL.SPLIT_MIN
       && Math.hypot(x.g.x-P.goal.x,x.g.y-P.goal.y)>BAL.SPLIT_SEP && partySplitOk(x.h)){
      x.split=true; x.h.goal=x.g; x.h.goalT=B.time+BAL.GOAL_RETHINK; x.h.splitG=x.g; x.h.splitUntil=B.time+BAL.SPLIT_T;
      B.nSplitGo=(B.nSplitGo||0)+1; continue;
    }
    x.h.goal=P.goal; x.h.goalT=B.time+BAL.GOAL_RETHINK; x.h.splitG=null; x.h.splitUntil=0; }
  B.nDecide=(B.nDecide||0)+1; if(!same) B.nSplit=(B.nSplit||0)+1;
  if((B.time-P.decidedT>BAL.PARTY_TALK_CD && P.goal.kind!=='explore') || gathered){   // 集まったのなら(探索でも)必ず一言交わす
    P.decidedT=B.time; const kind=goalKindKey(P.goal);
    let t0=0;
    if(gathered){ const arr=active.find(h=>h.hi!==(P.gatherCaller>=0?P.gatherCaller:win.h.hi));   // 呼ばれて歩いてきた子が着いて一言
      if(arr){ pendingLine(arr.hi,'gather.arrive',0.2,1); t0=(arr.hi===win.h.hi)?1.7:0.9; } }   // 着いた子がそのまま言い出す時は、前の吹き出しが消えてから(同じ子の続けざまの台詞は潰れる)
    const said=t0>0?(pendingLine(win.h.hi,'propose.'+kind,t0,1),true):sayPartyAs(win.h.hi,'propose.'+kind,1,0);
    if(said){ for(const x of props){ if(x===win) continue; pendingLine(x.h.hi, x.split?'split':(same?'same':(x.g.score>win.g.score?'yield':'agree')), t0+0.9, 1, win.h); }   /* v5.3 「{o}が いうなら」の相手は、案が通った子 */ if((!same || gathered) && (gathered || partyGathered())) P.talkUntil=B.time+(gathered?Math.max(BAL.GATHER_TALK_T,t0+1.6):BAL.TALK_T); }   // 集まって話した時は言い終わるまで向き合う。離れたまま(集合できなかった)なら声だけ掛けて足は止めない(v3.1)
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
  const add=(kind,sub,x,y,worth,ref,key)=>{ worth*=goalPref(p,kind,sub); if(anyCaptive && kind!=='rescue') worth*=BAL.RESCUE_FOCUS; if(!coreLeashOk(kind,sub,x,y)) return; /* v4.0 魔核戦の間は寄り道しない */ if(worth<=0 || !passAt(x,y,false) || nearKnownTrap(x,y) || ringAvoid(x,y)) return;   /* v4.1 覚えた菌輪の中は目当てにしない */
    /* v5.0 媚薬沼の中の物は割り引く(深いほど嫌う)。
       ★v6.3 深い沼の 0.30 は厳しすぎた。宝箱(価値3.0)でも 0.9 まで落ちてジェムに負けるので、
       目当てとして選ばれるのが一瞬だけになり、浸かりかけては別の物へ乗り換える。
       実測: 沼の真ん中の宝箱を目当てにしていたのは 24秒のうち 2.0秒だけだった */
    { const mi=mireAt(x,y); if(mi) worth*=(mi.depth>0.75?BAL.MIRE_GOAL_DEEP:BAL.MIRE_GOAL_SHALLOW); }
    if(HEROES[p.id]&&HEROES[p.id].heatShy){ const kh=kuuHeatAt(x,y); if(kh>0.4) worth*=1-0.45*kh; }   /* v5.0 暑がりは、温泉・肉の床・焦げ跡の中の物を避ける */ if(ref && gaveUp(ref)) return; /* v2.1 諦めた目標は外す */
    /* ★v6.3 諦めた地形の中の物も、まるごと外す。これが無いと「宝箱を諦める→同じ巣窟の祠を選ぶ→
       また境で諦める→次はジェム」を繰り返して、口の前を行ったり来たりする(実測 6.6往復・19.8秒) */
    { const gz=zoneAt(x,y); if(gz!==p.zone && p.scared && p.scared[gz]>B.time) return; } if(crestKnow()>=1 && B.traps.some(tr=>tr.armed && Math.hypot(tr.x-x,tr.y-y)<tr.r+40)) return; /* 知っている紋の罠の上は目当てにしない */ const d=Math.hypot(x-p.x,y-p.y); const fz=zoneFear(zoneAt(x,y)), fm=fz>=3?0.5:(fz>=2?0.7:(fz>=1?0.9:1));
    const dk=BAL.DARK_GOAL_K*((HEROES[p.id]&&HEROES[p.id].lightR<180)?BAL.KUU_DARK_K:1);   // v5.0 発光の弱い子は、暗い所を人一倍嫌う
    const lm=(darkLevel()>0.05 && kind!=='rescue' && kind!=='wait')?(dk+(1-dk)*lightAt(x,y)):1;   // v4.0 暗い所は気が進まない(行かないわけではない)
    cands.push({kind,sub,x,y,ref,key,d,worth,score:worth*fm*lm/(1+d/600)}); };   // v2.2 嫌な地形の中の目当ては割り引く(価値そのものは入る判断に使うので残す)
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
  { const cv=coverTarget(p); if(cv) add('cover','cover',cv.x,cv.y,BAL.COVER_WORTH,cv,'cover'+cv.hi); }   // v4.0 調子の悪い相方のそばへ(探索に流れない)
  for(const c of B.chests){ if(c.known && !c.taken) add('chest',c.bossChest?'boss':'chest',c.x,c.y,(c.bossChest?3.0:2.6)*(leaving?0.3:1),c); }
  /* v6.6 中毒: 粉の味を憶えた身体は、きのこ系を見つけると自分から寄っていく。
     ★咳き茸が居ない階でも、媚茸・抱き茸を探して踏みに行く——これが「癖」の姿 */
  if(addictSeek(p) && (p.highT||0)<=0){
    for(const e of B.enemies){
      if(e.dead||e.dormant) continue;
      if(e.id!=='coughcap' && e.id!=='lurecap' && e.id!=='hugcap') continue;
      if(!inSight(e,p)) continue;
      add('addict','addict',e.x,e.y,BAL.ADDICT_WORTH*(1+0.25*((p.addict||0)-BAL.ADDICT_SEEK)),e,'ad'+e.id+((e.x/48)|0)+'_'+((e.y/48)|0));   /* uid は無いので、種と位置から鍵を作る */
    }
  }   // v2.1 降りると決めたら箱は後回し
  for(const q of G.map.pois){
    if(!M.known[q.key]) continue; let w=0;
    if(q.kind==='shrine') w=M.visited[q.key]?0:2.2;
    else if(q.kind==='spring') w=(hpR<0.7 && p.springCd<=0)?(hpR<0.45?3.2:2.4):0;
    else if(q.kind==='pool') w=(poolWant(p) && !(B.poolCd[q.key]>0))?((p.sensit>=60||p.slow>0)?3.2:2.6):0;
    else if(q.kind==='stele') w=B.steleRead[q.key]?0:1.7;
    else if(q.kind==='stairs') w=(B.exitLocked||!B.wantExit)?0:BAL.EXIT_WORTH_WANT;   // v2.1 「降りよう」と決めてから(exitTick)。それまでは他を見て回る
    else if(q.kind==='seal') w=B.seals[q.key]?0:2.4;
    else if(q.kind==='core') w=B.coreWar?BAL.CORE_WORTH:(B.wantExit?BAL.EXIT_WORTH_WANT:2.6);   // v2.2 向かう気になったら最優先 / v4.0 戦い始めたら戻る力
    else if(q.kind==='lantern') w=lanternWant(p)?BAL.LANTERN_WANT*darkLevel():0;   // v4.0 暗いほど灯りに寄りたい(そばに居ると発情が溜まると知っていても)
    else if(q.kind==='yamicap') w=(B.yamiCap&&!B.yamiCap.freed)?3.4:0;   // v5.0 見て見ぬふりはしない
    if(leaving && q.kind!=='stairs' && q.kind!=='seal' && q.kind!=='core' && q.kind!=='spring') w*=0.3;
    add('poi',q.kind,q.x,q.y,w,q,q.key);
  }
  for(const e of B.enemies){   // v4.1 媚茸: 見破るまでは光茸に見えている(暗い階ほど魅力的に映る)
    if(e.dead||e.id!=='lurecap'||!lureLooksReal(e)) continue;
    if(!e.seenPick && !inSight(e,p) && Math.hypot(e.x-p.x,e.y-p.y)>BAL.DARK_FAR_SEE) continue;
    e.seenPick=true;
    add('lure','shroom',e.x,e.y,BAL.LURE_WORTH*(leaving?0.3:1),e);
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
  /* ★v6.3d 降りる気が立っているのに、降り口の場所を知らない時は「探す」を最優先にする。
     exitTick は降り口を知っているかを条件にしていないので、
     「降りると決めたが、どこへ降りればいいか知らない」状態が成立する。
     ところが探索の価値は 0.6 しかなく、光茸(1.1)や清水(2.6)に負け続けるので、
     彼女は降りる気のまま延々と拾い物をして回る。
     実測(400秒を越えた夜): 降りる気が 184秒/195秒 で立っているのに、
     その時も夜の終わりも降り口を知らないまま。探索は 0〜1%、
     目当ては 光茸34% / 清水19% / 品16% / ジェム13% だった */
  { const stQ=(!B.floor.final && G.map && G.map.pois) ? G.map.pois.find(q=>q.kind==='stairs') : null;
    const lost = B.wantExit && !B.exitLocked && stQ && !META.map.known[stQ.key];
    if(lost){
      if(!p.explore || B.time>p.exploreUntil || Math.hypot(p.explore.x-p.x,p.explore.y-p.y)<70) pickExplore(p);
      if(p.explore) add('explore','findExit',p.explore.x,p.explore.y,BAL.EXIT_FIND_WORTH,null);
      if(!B.lostSaid){ B.lostSaid=true; sayLine('findExit',1,0,'おりぐち、どこ……? さがさなきゃ'); }
    } }
  if(!cands.some(c=>c.score>=0.35)){
    if(!p.explore || B.time>p.exploreUntil || Math.hypot(p.explore.x-p.x,p.explore.y-p.y)<70) pickExplore(p);
    if(p.explore) add('explore','explore',p.explore.x,p.explore.y,0.6,null);
  }
  /* ★v6.3e 最後の受け皿: 候補が一つも残らない夜がある。
     諦め(GIVEUP_CD)も怖がり(SCARED_T)も 40秒あるので、嫌な地形の中の物を続けて諦めた直後は、
     場所も資源も探索点も揃って落ちて cands が空になる。空のまま返すと p.goal は null になり、
     彼女は行き先を持たないまま足元のジェムだけ拾って夜を潰す
     (実測: 592秒の夜のうち 198秒が「目当てなし」。稀だが、起きた夜は必ず長い)。
     ここでは諦めも怖がりも効かせない——出口を諦めたままでは、その階から出られないから */
  if(!cands.length){
    const stQ=(!B.floor.final && G.map.pois) ? G.map.pois.find(q=>q.kind==='stairs') : null;
    if(stQ && M.known[stQ.key] && !B.exitLocked && B.wantExit){
      cands.push({kind:'poi', sub:'stairs', x:stQ.x, y:stQ.y, ref:stQ, key:stQ.key, d:Math.hypot(stQ.x-p.x,stQ.y-p.y), worth:BAL.EXIT_WORTH_WANT, score:1.0});
      B.nLastExit=(B.nLastExit||0)+1;
    }else if(pickExplore(p,true)){
      cands.push({kind:'explore', sub:'explore', x:p.explore.x, y:p.explore.y, ref:null, key:null, d:Math.hypot(p.explore.x-p.x,p.explore.y-p.y), worth:0.6, score:0.4});
      B.nLastWalk=(B.nLastWalk||0)+1;
    }
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
  /* ★v6.3 沼の中に用があると決めたら、渡りきるまで決め直さない。
     途中で乗り換えると、そのフレームから沼よけが働いて縁へ押し返される——
     「近づく」と「避ける」が交互に効いて、縁で行ったり来たりになる */
  if(best && mireAt(best.x,best.y)) p.goalT=B.time+BAL.GOAL_RETHINK*BAL.MIRE_GOAL_HOLD;
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
  const darkOn=darkLevel()>0.05;
  for(let j=j0;j<=j1;j++){ const yy=(tileCY(j)-p.y)/ry; for(let i=i0;i<=i1;i++){ const k=j*MAP_W+i; if(M.seen[k]) continue; const xx=(tileCX(i)-p.x)/rx; if(xx*xx+yy*yy>1) continue;
    if(darkOn && lightAt(tileCX(i),tileCY(j))<BAL.DARK_SEEN) continue;   // v4.0 暗い所は地図に残らない(灯りが届いた所だけ覚える)
    M.seen[k]=1; if(M.solid[k]===0) M.seenN++; } }
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
function pickExplore(p,force){
  const M=META.map, B=G.B; if(!G.map||!M) return null;
  /* ★v6.3e force: 何も無くなった時の最後の受け皿。嫌な地形も諦めた地形も問わず、足の届く床ならどこでもいい */
  const useSeen=BAL.SEEN_EXPLORE && G.map.seen && seenFrac()<0.97;   // ほぼ見尽くしたら旧来のうろつきへ
  const leaving=!!B.wantExit;   // v2.2 最終階層でも「魔核へ向かう気」になったら同じ
  const okZone=(q)=>{ if(force) return true; const qz=zoneAt(q.x,q.y); return !(zoneFear(qz)>=2 || (p.scared&&p.scared[qz]>B.time)); };   // v2.2 「できれば避けたい」以上の地形の中は探索点にしない
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
  /* ★v6.3e 受け皿の受け皿: 12方向がぜんぶ壁や崖に当たる隅では、上の候補が一つも残らない。
     距離をぐっと近くまで許して、届く床を拾えるまで探す */
  if(!cand && force){
    for(let k=0;k<40 && !cand;k++){
      const a=rand(TAU), dd=rand(180,900);
      const q=snapFloor(clampMapX(p.x+Math.cos(a)*dd,100), clampMapY(p.y+Math.sin(a)*dd,100), false, 8);
      if(q && Math.hypot(q.x-p.x,q.y-p.y)>90 && reachableAt(q.x,q.y,false)) cand={x:q.x,y:q.y};
    }
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
  if(p.poolT>0||p.readT>0||p.lantT2>0){
    if(attachCount(p)>0||p.pinned||p.charmBind){ p.poolT=0; p.readT=0; p.lantT2=0; }
    else{
      p.vx=0; p.vy=0;
      /* v6.6 灯篭で休む。★ここが無かったので「そばに居る時間」が 2.0秒/夜 しかなく、
         灯篭は一晩の発情の 1.2% しか作っていなかった。離れる判断は lanternTick(溜まった熱)が持つ */
      if(p.lantT2>0){ p.lantT2-=dt; if(Math.random()<dt*2) parts(p.x+rand(-14,14),p.y-24,1,['#ffd0e4','#ffe9a8'],40,1.0); }
      if(p.poolT>0){ p.poolT-=dt; if(Math.random()<dt*4) parts(p.x+rand(-12,12),p.y-10,1,['#cffaff','#fff'],40,0.8); if(p.poolT<=0){ const q=G.map.pois.find(o=>o.key===p.poolKey); if(q) usePool(q); } }
      if(p.readT>0){ p.readT-=dt; if(p.readT<=0){ const q=G.map.pois.find(o=>o.key===p.readKey); if(q) readStele(q, !!(B.event&&B.event.key===q.key)); } }
    }
  }
  B.poiCd-=dt;
  for(const q of G.map.pois){
    if(!M.known[q.key] && (inSight(q,p) || ((q.kind==='lantern'||q.kind==='shrine') && Math.hypot(q.x-p.x,q.y-p.y)<BAL.DARK_FAR_SEE))){   // v4.0 灯りものは遠くからでも見える
      M.known[q.key]=1; M.seen=(M.seen||0)+1;
      floatTxt(q.x,q.y-40,'みつけた: '+POI_DEF[q.kind].name,'#8fd3ff',12,1.8);
      sayLine('poi.'+q.kind,1,0,q.kind==='stairs'?'おりぐち、みっけ! でも、まだ見てないとこあるし':pickRand(['あそこ、なにかある……','あれ、なんだろ','おぼえておこう']));   // v2.1 場所ごとの台詞
      partyShare(p,'poi',q.x,q.y);   // v3.0 相手に伝える
      if(q.kind==='stairs') setBanner('降り口を見つけた',exitGuarded()?'石の番兵が守っている。彼女は他を見てから降りる':'彼女は見るものを見てから降りる','#8fd3ff');
      if(q.kind==='core'){ setBanner('魔核の間','深淵の心臓。彼女は挑むだろう','#ff6b81'); { const two=B.heroes.length>1, V=(typeof STORY_V30!=='undefined')?STORY_V30:null; let fe=(two&&V&&V.finalEncounter&&V.finalEncounter.length)?V.finalEncounter:STORY.finalEncounter;   // v3.0 二人で魔核を見る
        /* v5.2 二周目以降: 彼女たちは一日目のつもりで来ている。だから「弱いはず」の心臓の厚みに説明がつかない。
           そして心臓の側も、落としきる寸前だったはずが供が増えていることに説明がつかない。互いに、覚えていない */
        /* ★v6.4 認知は、ループの向きごとに出す。前は era>=1 で二つとも出していたので、
           供が一人も増えていない夜にも心臓が「増えている」と言っていた。
           忘れるのは倒した側。だから「説明がつかない」のも、いつも忘れた側になる。
           era(=ルミナが勝った回数) … 忘れたのは**ルミナ**。外に残ったのは魔核の厚み → ルミナが「思ってたより大きい」
           供の数(=魔核が勝った回数) … 忘れたのは**魔核**。外に残ったのは仲間     → 魔核が「増えている」 */
        if(V && V.era){
          if(eraNow()>=1) fe=fe.concat(V.era.coreStronger||[]);
          if(partyIds().length>=2) fe=fe.concat(V.era.coreVoice||[]);
        }
        if(fe.length && !B.storyCoreSeen){ B.storyCoreSeen=true; UI.showStory(fe,{dur:11}); } } }
      if(q.kind==='seal') setBanner('封印石','3つ全て灯すと降り口が開く','#c98cff');
    }
    const d=Math.hypot(q.x-p.x,q.y-p.y);
    if(q.kind==='shrine' && d<34 && !M.visited[q.key]){
      M.visited[q.key]=1;
      gainFloorLight('shrine',q.x,q.y);   // v4.0 祠の火を分けてもらう(この階のあいだ二人が明るい)
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
      p.sticky=0; p.stickySaid=false;   /* v6.3b 湯に浸かれば、ベタベタも落ちる */
      setBanner('泉で休む','湯があつい。回復するが、身体も火照る','#8fd3ff');
      heroBubble(p,pickRand(['ちょっとだけ、やすも……','あつ……でも、きもちいい……','すぐ、もどるから……']),true,2);
      awardAil('heatg');
    }
    if(q.kind==='pool' && d<38 && !(B.poolCd[q.key]>0) && p.poolT<=0 && poolWant(p) && attachCount(p)===0 && !p.pinned && !p.charmBind && p.climaxT<=0){
      p.poolT=BAL.POOL_T; p.poolKey=q.key;
      setBanner('清水で流す','冷たい水。敏感化・発情・粘液が流れる——足が止まる','#8fd3ff');
      heroBubble(p,pickRand(['つめた……でも、ながさなきゃ','ちょっと、あらうだけ……']),true,2);
    }
    /* v6.6 催淫灯篭のそばで腰を下ろす。危なくなければ、熱が溜まりきるまで動かない */
    if(q.kind==='lantern' && d<44 && p.lantT2<=0 && (p.lantCd||0)<B.time && lanternWant(p)
       && attachCount(p)===0 && !p.pinned && !p.charmBind && p.climaxT<=0 && (p.threatV||0)<BAL.GRIND_THREAT){
      p.lantT2=BAL.LANTERN_REST;
      heroBubble(p,pickRand(['ちょっとだけ、やすも……','あかるい……すこし、すわろ','ここなら、へいき']),true,2);
    }
    if(q.kind==='stele' && d<40 && !B.steleRead[q.key] && p.readT<=0 && attachCount(p)===0 && !p.pinned && !p.charmBind && p.climaxT<=0){
      p.readT=BAL.STELE_T; p.readKey=q.key;
      heroBubble(p,pickRand(['なにか、かいてある……','ふるい、もじ……よめる、かな']),true,1);
    }
    // v2.0 降り口: そばに立ち続けると次の階層へ(その日は終わり)。封印の階層では石を全部灯すまで閉じている
    if(q.kind==='stairs'){
      if(!B.wantExit && d<130 && M.known[q.key]) sayLine('stairsWait',0,30,'まだ、おりないよ。あとで!');   // v2.1 まだ降りない
      if(!B.exitLocked && !exitGuarded() && d<60 && !p.pinned && p.climaxT<=0 && attachCount(p)===0 && !p.charmBind){
        if(B.ci===nearestHeroIdx(q.x,q.y)) B.exitT+=dt;   /* v3.0 いちばん近い子だけが進める(二人で倍速にならない) */
        if(B.exitT>0.3 && B.exitT<0.3+dt) heroBubble(p,'……ここから、おりられる',false,2);
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
    e.slotA=i*TAU/n; e.hp=e.maxHp=Math.round(BAL.SENTINEL_HP*(1+0.35*(F.depth-1))*(1+0.08*eraNow()));   /* v5.0 深淵が硬くなるのは組み替わり(魔核の敗北)の分だけ */
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
/* v6.2 奥義にもスタミナが要る。足りなければ撃てない——
   「切り札はあるが、疲れていると出せない」を数字にする */
function skillReady(p,id){ const s=heroSkills(p)[id];
  if(!s || p.level<s.lv || (p.skillCd[id]||0)>0) return false;
  if((s.stam||0)>0 && p.stamina<s.stam) return false;
  return true; }
function useSkill(p,id){ const B=G.B, s=heroSkills(p)[id]; p.skillCd[id]=s.cd;
  if(s.stam) { p.stamina=Math.max(0,p.stamina-s.stam); checkStaminaCollapse(); }   /* v6.2 奥義のスタミナ消費 */ B.nSkill=B.nSkill||{}; B.nSkill[id]=(B.nSkill[id]||0)+1; setBanner('奥義 '+s.name,s.desc.split('。')[0],'#ffd76a'); sayLine('skill.'+id,2,0,s.name+'!'); S.lvup(); }
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
    p.ifr=Math.max(p.ifr,1.0); useSkill(p,'purge');   /* v6.2 以前あった +20 の回復は取った(消費と二重になる) */ parts(p.x,p.y-14,40,['#fff','#8fd3ff','#ffd76a'],260,0.9); G.shake=Math.min(8,G.shake+5);
  }
  /* ================= v6.0 四つ目の奥義(Lv70) =================
     ★どれも「地形の責め」への答えになっている。栓・凍り・忘れ水・視線に対して、
     その子だけが持つ外し方を一つずつ与える。10階の栓は、halo でしか外から外せない */
  if(skillReady(p,'halo') && (attachCount(p)>=2 || p.pinned || (p.plugT||0)>0 || nearEnemyCount(p.x,p.y,200)>=8)){
    for(const sl of attachedSlots(p)) detachLimb(sl,{fling:true});
    for(const sl of suckSlots(p)) detachSucker(sl,{fling:true});
    if(p.pinned){ p.pinned=false; p.pinBy=null; p.pinEscape=0; p.struggle=0; if(B.pinSceneHi===B.ci) B.pinScene=null; }
    p.plugT=0; p.silkHold=0; p.frostHold=0;
    for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue;
      if(Math.hypot(e.x-p.x,e.y-p.y)<260) e.stun=Math.max(e.stun||0, e.boss?2.0:6.0); }
    p.ifr=Math.max(p.ifr,1.4); useSkill(p,'halo');
    parts(p.x,p.y-14,54,['#fff','#ffd76a','#8fd3ff'],300,1.1); G.shake=Math.min(9,G.shake+6);
  }
  if(skillReady(p,'scorch') && (nearEnemyCount(p.x,p.y,300)>=5 || p.zone==='frost' || p.zone==='lethe' || (p.wet||0)>0.6)){
    /* 前方を一直線に焼き払い、通った床を乾かす。凍った面は水へ、忘れ水は薄くなる */
    /* 向きは「いちばん近い魔物」。居なければ進んでいる方向へ */
    let tx=p.vx||1, ty=p.vy||0, bd=1e9;
    for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue;
      const d2=Math.hypot(e.x-p.x,e.y-p.y); if(d2<bd){ bd=d2; tx=e.x-p.x; ty=e.y-p.y; } }
    const a0=Math.atan2(ty,tx), ux=Math.cos(a0), uy=Math.sin(a0);
    for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue;
      const rx=e.x-p.x, ry=e.y-p.y, al=rx*ux+ry*uy; if(al<0||al>520) continue;
      if(Math.hypot(rx-ux*al, ry-uy*al)>60) continue;
      damageEnemy(e,55*(1+0.06*p.level)); e.stun=Math.max(e.stun||0,e.boss?0.5:1.2); }
    /* 通った床を乾かす。dryPaint を線に沿って置いていく(凍った面は水へ、忘れ水は薄く) */
    if(typeof dryPaint==='function') for(let t2=0;t2<=520;t2+=48) dryPaint(p.x+ux*t2, p.y+uy*t2, 62);
    p.wet=0;
    useSkill(p,'scorch'); parts(p.x,p.y-14,46,['#ff7a3a','#ffd76a','#fff'],320,1.0); G.shake=Math.min(9,G.shake+6);
  }
  if(skillReady(p,'zero') && (nearEnemyCount(p.x,p.y,320)>=6 || p.pinned || attachCount(p)>=2)){
    /* 半径380を4秒すべて止め、床を霜に書き換える。書き換えた面の上では、彼女だけが滑らない */
    for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue;
      if(Math.hypot(e.x-p.x,e.y-p.y)<380) e.stun=Math.max(e.stun||0,e.boss?1.6:4.0); }
    { const M=G.map, zi=ZONE_IDS.indexOf('frost'), i0=tileI(p.x), j0=tileJ(p.y), R=Math.ceil(380/MAP_T), dirty=new Set();
      if(M&&M.zone&&zi>=0) for(let dj=-R;dj<=R;dj++) for(let di=-R;di<=R;di++){
        const i=i0+di, j=j0+dj; if(!inMap(i,j)) continue; if(Math.hypot(di,dj)*MAP_T>380) continue;
        const k=j*MAP_W+i; if(M.solid[k]) continue;
        if(M.zone[k]!==zi){ M.zone[k]=zi; dirty.add(chunkKey(Math.floor(i/CHUNK),Math.floor(j/CHUNK))); } }
      if(M&&M.chunks) for(const ck of dirty) M.chunks.delete(ck);
      if(M) M.mini=null; }
    p.iceBless=Math.max(p.iceBless||0,6);
    p.ifr=Math.max(p.ifr,1.2); useSkill(p,'zero');
    parts(p.x,p.y-14,54,['#d8f2ff','#fff','#8ec6e8'],320,1.1); G.shake=Math.min(9,G.shake+6);
  }
  if(skillReady(p,'devour') && (p.watchedT>0 || nearEnemyCount(p.x,p.y,240)>=5 || p.hp<p.maxHp*0.5)){
    /* 半径240の光を全部吸って、自分のHPに変える。見られること自体が責めになる階への答え */
    let got=0;
    if(B.lights) for(let k=B.lights.length-1;k>=0;k--){ const L=B.lights[k];
      if(Math.hypot(L.x-p.x,L.y-p.y)>240) continue; got+=8; B.lights.splice(k,1); }
    for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue;
      if(Math.hypot(e.x-p.x,e.y-p.y)>240) continue;
      if(e.id==='eye'||e.id==='gallery'||e.id==='gazer'||e.id==='beamer'||e.id==='bossgazer'){ damageEnemy(e,60*(1+0.06*p.level)); got+=24; }
      e.stun=Math.max(e.stun||0,e.boss?0.5:1.4); }
    p.watchedT=0; p.hp=Math.min(p.maxHp,p.hp+Math.round(Math.max(30,got)));
    useSkill(p,'devour'); parts(p.x,p.y-14,50,['#2a1a3a','#c98cff','#fff'],300,1.0); G.shake=Math.min(9,G.shake+5);
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
      let best=null, bs=1e9; for(let k=0;k<12;k++){ const a=k*TAU/12; const q=snapFloor(clampMapX(p.x+Math.cos(a)*180,40),clampMapY(p.y+Math.sin(a)*180,40),false,3);
        /* ★reachableAt は「マップの出発点から届くか」しか見ない。盤は一つに繋がっているので
           壁の向こうでも真になり、跳んだ先が壁越しになってパーティが分断されていた。
           いま居る場所から壁を挟んでいないことを losClear で確かめる */
        if(!q||!reachableAt(q.x,q.y,false)||!losClear(p.x,p.y,q.x,q.y,false)) continue; const sc=nearEnemyCount(q.x,q.y,150,true)+nearEnemyCount(q.x,q.y,60,true)*2; if(sc<bs){ bs=sc; best=q; } }
      p.blinkRetry=B.time+0.5;
      if(best && bs<nearEnemyCount(p.x,p.y,150,true)){ const x0=p.x, y0=p.y, vx=best.x-x0, vy=best.y-y0, L=Math.hypot(vx,vy)||1;
        for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue; const t=Math.max(0,Math.min(1,((e.x-x0)*vx+(e.y-y0)*vy)/(L*L))); const px=x0+vx*t, py=y0+vy*t; if(Math.hypot(e.x-px,e.y-py)<44+e.r*0.5){ damageEnemy(e,30*(1+0.06*p.level)); e.stun=Math.max(e.stun||0,e.boss?0.4:0.8); } }
        for(let k=0;k<10;k++) parts(x0+vx*k/10,y0+vy*k/10-14,3,['#ff7a3a','#ffd76a'],120,0.5);
        p.x=best.x; p.y=best.y; p.vx=p.vy=0; p.path=null; p.ifr=Math.max(p.ifr,0.6); p.fwingAnim=0.3; p.fwingX=x0; p.fwingY=y0; useSkill(p,'blaze'); }
    }
  }
  if(p.id==='yamiko'){
    // 黄昏の招き: 瀕死で闇から三体の影を呼び、肩代わりさせる
    if(skillReady(p,'duskcall') && p.hp<p.maxHp*0.35){
      B.shades=B.shades||[];
      for(let i=0;i<3;i++){ const a=i*TAU/3+rand(0.4);
        B.shades.push({x:p.x+Math.cos(a)*46, y:p.y+Math.sin(a)*46, t:0, life:6, dmg:16*(1+0.05*p.level), cd:0, hi:p.hi}); }
      p.ifr=Math.max(p.ifr,1.4);
      for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue; const dx=e.x-p.x, dy=e.y-p.y, d=Math.hypot(dx,dy)||0.001;
        if(d<180){ e.stun=Math.max(e.stun||0,e.boss?0.5:1.1); if(MONSTERS[e.id]&&MONSTERS[e.id].spd>0&&!MONSTERS[e.id].guardian){ e.x+=dx/d*60; e.y+=dy/d*60; collideMap(e,e.r*0.75,canFly(e.id)); } } }
      B.fx.push({kind:'darkring',x:p.x,y:p.y,r:180,t:0,life:1.0}); G.shake=Math.min(9,G.shake+5); sfx(140,60,0.7,'sawtooth',0.09);
      setBanner('黄昏の招き','闇から三つ、彼女の代わりに立つものが出てくる','#a77dff');
      useSkill(p,'duskcall'); parts(p.x,p.y-14,36,['#2a1a3e','#a77dff','#fff'],220,0.9);
    }
    // 夜の帳: 闇が弾けて拘束を断ち、周りの目を潰す
    if(skillReady(p,'nightveil') && (attachCount(p)>=2 || p.pinned) && !p.charmBind && p.hypnoLv<2){
      for(const sl of attachedSlots(p)) detachLimb(sl,{fling:true});
      for(const sl of suckSlots(p)) detachSucker(sl,{fling:true});
      if(p.pinned){ p.pinned=false; p.pinBy=null; p.pinEscape=0; p.struggle=0; if(B.pinSceneHi===B.ci) B.pinScene=null; }
      for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue; const dx=e.x-p.x, dy=e.y-p.y, d=Math.hypot(dx,dy)||0.001;
        if(d<140){ e.stun=Math.max(e.stun||0,e.boss?0.7:1.6); e.blindT=Math.max(e.blindT||0,3.0);
          if(MONSTERS[e.id]&&MONSTERS[e.id].spd>0&&!MONSTERS[e.id].guardian){ e.x+=dx/d*80; e.y+=dy/d*80; collideMap(e,e.r*0.75,canFly(e.id)); } } }
      p.ifr=Math.max(p.ifr,1.0); p.stamina=Math.min(p.staminaMax,p.stamina+18); useSkill(p,'nightveil');
      B.fx.push({kind:'darkring',x:p.x,y:p.y,r:140,t:0,life:0.8});
      parts(p.x,p.y-14,40,['#2a1a3e','#a77dff','#fff'],240,0.9); G.shake=Math.min(8,G.shake+5);
    }
    // 影渡り: 囲まれたら、闇の濃い所へ溶けて抜ける
    if(skillReady(p,'shadowstep') && B.time>=(p.blinkRetry||0) && attachCount(p)===0 && !p.pinned && !p.charmBind && p.climaxT<=0 && (nearEnemyCount(p.x,p.y,130)>=5 || (p.press||0)>=1.2)){
      p.blinkRetry=B.time+0.5;
      const x0=p.x, y0=p.y;
      if(yamiStep(p)){ p.stepFx=1; p.stepX=x0; p.stepY=y0; useSkill(p,'shadowstep'); }
    }
  }
  if(p.id==='kuu'){
    // 静止の一点: 瀕死で、周りをまるごと止める。自分の護りではなく、二人の足と弾を配る
    if(skillReady(p,'stasis') && p.hp<p.maxHp*0.32){
      p.hp=Math.min(p.maxHp,p.hp+Math.round(p.maxHp*0.22)); p.ifr=Math.max(p.ifr,2.4);
      for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue; if(Math.hypot(e.x-p.x,e.y-p.y)<260) freezeEnemy(e,3.2); }
      for(const h of B.heroes){ if(h.out) continue; if(Math.hypot(h.x-p.x,h.y-p.y)<300) h.iceBless=6.0; }
      B.fx.push({kind:'icering',x:p.x,y:p.y,r:260,t:0,life:1.4}); G.shake=Math.min(9,G.shake+6); sfx(300,1800,0.9,'triangle',0.09);
      setBanner('静止の一点','クウが息を止める。深淵が、そのぶんだけ止まる','#bfeaff');
      useSkill(p,'stasis'); parts(p.x,p.y-14,44,['#bfeaff','#fff','#7fe8dd'],240,0.9);
    }
    // 霜の枷: 氷の鞘が砕けて拘束を断ち、しばらく近づく魔物を凍てつかせる
    if(skillReady(p,'hoarfrost') && (attachCount(p)>=2 || p.pinned) && !p.charmBind && p.hypnoLv<2){
      for(const sl of attachedSlots(p)) detachLimb(sl,{fling:true});
      for(const sl of suckSlots(p)) detachSucker(sl,{fling:true});
      if(p.pinned){ p.pinned=false; p.pinBy=null; p.pinEscape=0; p.struggle=0; if(B.pinSceneHi===B.ci) B.pinScene=null; }
      for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue; const dx=e.x-p.x, dy=e.y-p.y, d=Math.hypot(dx,dy)||0.001;
        if(d<140){ freezeEnemy(e,2.2);
          if(MONSTERS[e.id] && MONSTERS[e.id].spd>0 && !MONSTERS[e.id].guardian){ e.x+=dx/d*70; e.y+=dy/d*70; collideMap(e,e.r*0.75,canFly(e.id)); } } }
      p.ifr=Math.max(p.ifr,1.0); p.stamina=Math.min(p.staminaMax,p.stamina+20); p.hoarT=4; useSkill(p,'hoarfrost');
      parts(p.x,p.y-14,40,['#bfeaff','#fff','#7fe8dd'],240,0.9); G.shake=Math.min(8,G.shake+5);
    }
    if(p.hoarT>0){ p.hoarT-=dt; if(Math.random()<dt*14) parts(p.x+rand(-30,30),p.y-rand(0,30),1,['#bfeaff','#fff'],40,0.5);
      p.hoarTick=(p.hoarTick||0)-dt;
      if(p.hoarTick<=0){ p.hoarTick=0.6;
        for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue; if(Math.hypot(e.x-p.x,e.y-p.y)<90){ e.chillT=Math.max(e.chillT||0,1.5); freezeEnemy(e,0.35); } } } }
    // 氷結の帳: 囲まれても逃げない。その場で世界を止めて、少しだけ滑って抜ける
    if(skillReady(p,'frostveil') && B.time>=(p.blinkRetry||0) && attachCount(p)===0 && !p.pinned && !p.charmBind && p.climaxT<=0 && (nearEnemyCount(p.x,p.y,130)>=6 || (p.press||0)>=1.4)){
      p.blinkRetry=B.time+0.5;
      for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue; if(Math.hypot(e.x-p.x,e.y-p.y)<170) freezeEnemy(e,1.6); }
      /* v6.2 短い滑りでも壁は越えさせない(90px は壁一枚ぶんより広い) */
      let best=null, bs=1e9; for(let k=0;k<12;k++){ const a=k*TAU/12; const q=snapFloor(clampMapX(p.x+Math.cos(a)*90,40),clampMapY(p.y+Math.sin(a)*90,40),false,3); if(!q||!reachableAt(q.x,q.y,false)||!losClear(p.x,p.y,q.x,q.y,false)) continue; const sc=nearEnemyCount(q.x,q.y,150,true); if(sc<bs){ bs=sc; best=q; } }
      if(best){ p.x=best.x; p.y=best.y; p.vx=p.vy=0; p.path=null; }
      p.ifr=Math.max(p.ifr,0.6);
      B.fx.push({kind:'icering',x:p.x,y:p.y,r:170,t:0,life:0.8});
      parts(p.x,p.y-14,36,['#bfeaff','#fff'],220,0.7); G.shake=Math.min(7,G.shake+4); sfx(1400,300,0.35,'triangle',0.07);
      useSkill(p,'frostveil');
    }
  }
  // 光の跳躍: 囲まれた
  if(skillReady(p,'blink') && B.time>=(p.blinkRetry||0) && attachCount(p)===0 && !p.pinned && !p.charmBind && p.climaxT<=0 && (nearEnemyCount(p.x,p.y,130)>=6 || (p.press||0)>=1.4)){
    let best=null, bs=1e9; for(let k=0;k<12;k++){ const a=k*TAU/12; const q=snapFloor(clampMapX(p.x+Math.cos(a)*180,40),clampMapY(p.y+Math.sin(a)*180,40),false,3);
        /* ★reachableAt は「マップの出発点から届くか」しか見ない。盤は一つに繋がっているので
           壁の向こうでも真になり、跳んだ先が壁越しになってパーティが分断されていた。
           いま居る場所から壁を挟んでいないことを losClear で確かめる */
        if(!q||!reachableAt(q.x,q.y,false)||!losClear(p.x,p.y,q.x,q.y,false)) continue; const sc=nearEnemyCount(q.x,q.y,150,true)+nearEnemyCount(q.x,q.y,60,true)*2; if(sc<bs){ bs=sc; best=q; } }
    p.blinkRetry=B.time+0.5;   // 跳べる先が無ければ0.5秒は探し直さない(毎フレームの走査を避ける)
    if(best && bs<nearEnemyCount(p.x,p.y,150,true)){ parts(p.x,p.y-14,24,['#fff','#8fd3ff'],200,0.6); p.x=best.x; p.y=best.y; p.vx=p.vy=0; p.path=null; p.ifr=Math.max(p.ifr,0.6); parts(p.x,p.y-14,24,['#fff','#ffd76a'],200,0.6); useSkill(p,'blink'); }
  }
}
/* v2.3 いまの武器から見た、おおまかな秒間火力(戦う/引き撃ち/逃げるの判断に使う) */
function heroDpsEst(p){
  const BASE={bolt:14,orb:10,nova:16,whip:14,rain:13,cross:13,sanct:15,blade:14,thunder:14,holy:9,chain:13,spirit:12,shield:9, fsword:17,fring:12,fburst:15,fpillar:14,fwing:13, ineedle:9,ifield:6,ibloom:10,iorbit:9,iecho:12, dblade:18,dring:11,dspear:19,dcall:10,dstep:8};
  let d=0; for(const k in BASE){ const lv=p.wp[k]||0; if(lv<=0) continue; const ov=wpOver(lv,p); const evo=Object.keys(EVOS).some(e=>EVOS[e].base===k && p.evo[e]>0); d+=BASE[k]*(1+0.35*(Math.min(BAL.WP_EVO_LV,lv)-1))*ov.dmg/ov.cd*(evo?1.8:1); }
  return Math.max(8, d*(p.dmgMult||1)*(1+0.08*(p.ps.haste||0))*(1+0.4*(p.ps.dup||0)));
}

/* ================= v5.0 摩耗(すり減り) =================
   軽くいじられたくらいでは動じないが、絶頂・押し倒し・拘束・催眠が積み重なって
   「動けない時間」が伸びてくると、宝箱を諦めて次の階層へ切り上げる。
   何もされない時間が続けば少しずつ戻る */
function wornOf(h){
  if(!h) return 0;
  let v=(h.worn||0);
  v+=(h.heatLv||0)*BAL.WORN_HEAT_LV;
  v+=(h.sensit||0)*BAL.WORN_SENSIT;
  v+=(h.hypnoLv||0)*BAL.WORN_HYPNO;
  v+=attachCount(h)*BAL.WORN_BOUND;
  if(h.pinned) v+=BAL.WORN_PIN;
  return v;
}
function partyWorn(){ const B=G.B; let m=0; for(const h of B.heroes){ if(h.out){ m+=BAL.WORN_CAPTURE; continue; } m=Math.max(m,wornOf(h)); } return m; }
function wornTick(dt){
  const B=G.B;
  for(const h of B.heroes){
    if(h.out) continue;
    const stuck=(h.pinned||attachCount(h)>0||h.climaxT>0||h.charmBind||h.freezeT>0);
    if(stuck) h.worn=(h.worn||0)+dt*BAL.WORN_IDLE_K;                 // 動けなかった時間そのものが摩耗になる
    else h.worn=Math.max(0,(h.worn||0)-dt*BAL.WORN_DECAY);
  }
  if(B.ci!==leaderIdx()) return;
  const w=partyWorn();
  if(w>=BAL.WORN_SAY && !B.wornSaid){ B.wornSaid=true; sayLine('feat.worn',1,0,'……ちょっと、きつくなってきた'); }
  else if(w<BAL.WORN_SAY*0.6) B.wornSaid=false;
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
  else if(partyWorn()>=BAL.WORN_EXIT && B.time>50) why='worn';   // v5.0 何度も絶頂させられ、動けない時間が伸びてきた → 宝箱は諦めて次へ
  /* ★v6.4 伸びしろが尽きた: 降り口を知っているなら、軽く見て降りる */
  else if(!B.floor.final && growthDone() && B.time>BAL.EXIT_FULL_T*0.35
          && (seenFrac()>=BAL.EXIT_FULL_SEEN || B.time>=BAL.EXIT_FULL_T)
          && G.map.pois.some(o=>o.kind==='stairs' && META.map.known[o.key])) why='full';
  if(!why) return;
  const fin=!!B.floor.final; const st=G.map.pois.find(o=>o.kind===(fin?'core':'stairs')); if(!st) return;
  B.wantExit=true; B.wantExitWhy=why; p.goal=null; p.goalT=0;
  const SUB={press:'魔物が増えてきた——長居はまずい', hp:fin?'体力が薄い——決めに行く':'体力が薄い——ここは離れる', done:fin?'見るところは見た——魔核へ':'見るところは見た——次へ', flee:'逃げ続けても終わらない——降り口を探す', worn:fin?'これ以上は保たない——決めに行く':'これ以上は保たない——切り上げる', full:'もう伸びしろが無い——ちょっとだけ見て、次へ'};
  if(fin){ setBanner('彼女は魔核へ向かう気になった', SUB[why],'#ff6b81'); sayLine('wantExit',1,0,'……いこう。まかくの、ところへ'); }
  else{ setBanner('彼女は降りる気になった', SUB[why],'#8fd3ff'); if(why==='flee') sayLine('fleeExit',1,0,'にげながら、おりぐちさがす!'); else if(why==='worn') sayLine('feat.wornExit',1,0,'もう、むり……たからばこは、いい。おりる'); else if(why==='full') sayLine('fullExit',1,0,'もう、とるものないし。ちょっとだけ見て、おりよ'); else sayLine('wantExit',1,0,why==='done'?'もう、みるとこないし。おりよ!':'……そろそろ、おりなきゃ'); }
}
/* v2.1 場面に合わせた台詞: 地形に入った / 圧が高まった / 体力が薄い / 一息 */
function linesTick(dt){
  const B=G.B, p=B.hero;
  p.lineT=(p.lineT||0)-dt; if(p.lineT>0) return; p.lineT=0.5;   // v3.0 ヒロインごと
  if(G.map&&G.map.feats){ for(let i=0;i<G.map.feats.length;i++){ const f=G.map.feats[i]; if(B.featSaid[i]) continue; if(Math.hypot(f.x-p.x,f.y-p.y)<f.r){ B.featSaid[i]=1; sayLine('feat.'+f.kind,0,4); } } }
  const pr=pressure();
  if(pr>=0.35 && B.pressSaid<1){ B.pressSaid=1; setBanner('深淵の圧が高まる','魔物が増え、夜側のENが伸びる','#ff86b3'); sayLine('pressure.mid',0,0,'なんか、ふえてきた……?'); }
  if(pr>=0.9 && B.pressSaid<2){ B.pressSaid=2; setBanner('深淵の圧','ここに長く居すぎた','#ff5d7a'); sayLine('pressure.high',1,0,'ここ、ながくいたらまずい……!'); }
  if(p.hp<p.maxHp*0.5 && !p.lowSaid){ p.lowSaid=true; sayLine('hurtLow',1,0); const o=partnerOf(p); if(o) sayPartyAs(o.hi,'assist.low',2,10,p); } else if(p.hp>p.maxHp*0.72) p.lowSaid=false;
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
    e.spawnCd=BAL.CORE_SPAWN_CD*(ph<0.3?0.55:1)*(e.rage?BAL.CORE_RAGE_CD:1); const n=ph<0.3?5:(ph<0.6?4:3), pool=ph<0.3?['hand','worm','gtent','mouth']:(ph<0.6?['hand','worm','gtent']:['hand','worm']);   // v2.2 弱るほど多く、口も生える
    for(let i=0;i<n;i++){ const a=rand(TAU); spawnUnit(pickRand(pool), p.x+Math.cos(a)*110, p.y+Math.sin(a)*80, {enVal:0, gemMul:0.3}); }
    B.spawnFx.push({x:p.x,y:p.y,t:0,r:60});
  }
  /* ---- v4.0 世代で覚えた技 ---- */
  if(coreSkill(e,'MINION')){   // 巻きついている落とし子が、吸い上げたものを根伝いに送り返す(合計に上限)
    let n=0; for(const q of B.enemies){ if(!q.dead && q.id==='coreling' && q.parent===e && q.state==='attached') n++; }
    if(n>0 && e.hp<e.maxHp){
      const rate=Math.min(BAL.CORE_MINION_HEAL_MAX, BAL.CORE_MINION_HEAL*n);
      e.hp=Math.min(e.maxHp, e.hp+e.maxHp*rate*dt); e.drainN=n; e.drainT=0.4;
      if(Math.random()<dt*2.5) floatTxt(e.x+rand(-30,30),e.y-e.r-10,'＋','#ff9ec2',11,0.7);
    } else e.drainN=0;
    if(e.drainT>0) e.drainT-=dt;
  }
  if(coreSkill(e,'RAGE') && !e.rage && ph<=BAL.CORE_RAGE_PH) coreRageEnter(e);
  if(e.rage) coreRageTick(e,dt);
  if(coreSkill(e,'MINION')){
    e.minionCd=(e.minionCd===undefined?4:e.minionCd)-dt;
    if(e.minionCd<=0 && d<620 && B.enemies.length<fieldCap()-4){ e.minionCd=BAL.CORE_MINION_CD*(e.rage?BAL.CORE_RAGE_CD:1)*(ph<0.4?0.8:1); coreSpawnMinions(e); }
  }
  if(coreSkill(e,'BIG')){
    e.bigCd=(e.bigCd===undefined?14:e.bigCd)-dt;
    let nb=0; for(const q of B.enemies){ if(!q.dead && q.fromCore) nb++; }
    if(e.bigCd<=0 && d<620 && nb<BAL.CORE_BIG_MAX && B.enemies.length<fieldCap()-2){ e.bigCd=BAL.CORE_BIG_CD*(e.rage?BAL.CORE_RAGE_CD:1); coreSpawnBig(e); }
  }
  if(coreSkill(e,'BEAM')){
    if(e.beamT>0){   // 溜めている間: 狙いはゆっくりしか動かない(避けられる)
      e.beamT-=dt;
      const want=coreBeamAim(e), da=((want-e.beamA+Math.PI*3)%(Math.PI*2))-Math.PI;
      e.beamA+=Math.max(-0.5*dt,Math.min(0.5*dt,da));
      if(e.beamT<=0){ coreBeamFire(e); e.beamCd=BAL.CORE_BEAM_CD*(e.rage?BAL.CORE_RAGE_CD:1); }
    }else{
      e.beamCd=(e.beamCd===undefined?9:e.beamCd)-dt;
      if(e.beamCd<=0 && d<BAL.CORE_BEAM_LEN){
        e.beamT=BAL.CORE_BEAM_CHARGE; e.beamA=coreBeamAim(e);
        floatTxt(e.x,e.y-e.r-30,'——溜めている','#ff86b3',13,1.6); sfx(200,900,BAL.CORE_BEAM_CHARGE,'sine',0.04);
        for(const h of B.heroes){ if(!h.out) sayPartyOrLine(h,'feat.coreCharge','なにか、ためてる……! よけて!'); }
      }
    }
  }
}
/* ================= v1.6 ボス4種 ================= */
/* 汎用ボスの追跡→予兆→突進 */
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
      e.dash2=false; e.bstate='chase'; e.bt=rand(3.2,4.7);
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
  /* v6.6 ★おあずけは「周期」では成立しない。5.2秒の波を待っている間に彼女が100へ届いてしまい、
     実測で一度も発火しなかった。絶頂の寸前を常に見張って、その瞬間に止める。 */
  if(d<BAL.OMAZUKE_R && p.climaxT<=0 && p.aphro>=BAL.OMAZUKE_TH){
    const n0=p.omazuke||0;
    applyOmazuke(e);
    if((p.omazuke||0)!==n0){ B.fx.push({kind:'pulse', x:e.x, y:e.y-e.r, t:0, life:0.7, r:110, col:'#ffb3cf'}); B.bossMark={id:'succuqueen',t:B.time}; }
  }
  if(e.pulseCd<=0){
    e.pulseCd=5.2;   // v2.4 6→5.2
    B.fx.push({kind:'pulse', x:e.x, y:e.y-e.r, t:0, life:1.0, r:170, col:'#ff9ec2'});
    sfx(600,300,0.5,'sine',0.05);
    if(d<170 && p.climaxT<=0 && p.freezeT<=0){
      addHeatG(45);
      /* v6.6 女王は栓をしない。責めを一瞬止めて、絶頂の寸前で引き戻す(おあずけ) */
      if(!applyOmazuke(e)) heroBubble(p,pickRand(['あま、い……ゆめ、みたいな……','だめ、これ、ゆだんしたら……','あたま、とろ、けそ……']),true,2);
      B.bossMark={id:'succuqueen',t:B.time}; codexMet('succuqueen');
    }
  }
  if(e.kissCd<=0 && d<e.r+p.r+8 && p.climaxT<=0){
    e.kissCd=5; applySensit(10); addHeatG(20);
    if(!applyOmazuke(e)) heroBubble(p,'んっ……!? くち、に……',true,2);   /* v6.6 口づけでもおあずけ */
    B.bossMark={id:'succuqueen',t:B.time}; codexMet('succuqueen');
  }
  if(e.spawnCd<=0){
    e.spawnCd=15;
    const cap=8+2*(e.brank||0), n=3+(e.brank||0);   /* v6.6 深い階の女王ほど、呼ぶ数が多い */
    if(aliveOf('imp')<cap && B.enemies.length<fieldCap()-3){
      for(let i=0;i<n && aliveOf('imp')<cap;i++){ const a=rand(TAU); spawnUnit('imp', e.x+Math.cos(a)*30, e.y+Math.sin(a)*30, {parent:e, enVal:0, gemMul:0}); }   // v2.4 3体ずつ・8体まで(超えない)
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
  if(p.id==='freila') dmg*=freilaDefMul(p);   // v4.0 水弱点: 濡れていると火の護りが薄い
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
  { const dp=G.B&&G.B.hero; if(dp) dp.recDmg=(dp.recDmg||0)+net; }   /* v5.8 与ダメも各人ぶん */
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
  h.recCapBy=by; h.recCapCause=cause;   /* v5.8 誰にどう負けたかを、その子の帳簿に */
  B.capturedBy=by; B.captureCause=cause;
  const CAP_BUB={
    lumina:{stamina:'ちから、が……はいらな……', charm:'だって……はなれたく、な……', hp:'そんな……っ'},
    freila:{stamina:'……っ、火が、出な……い……', charm:'……離れ、られ……ない', hp:'こんな、の……っ'},
    kuu:{stamina:'……こおら、ない……', charm:'……はなれ、たく、ない……', hp:'……とけ、る……'},
    yamiko:{stamina:'……闇が、うすい……', charm:'……いい。もう、いい……', hp:'……っ、待っ、て……'},
  };
  const bub=CAP_BUB[h.id]||CAP_BUB.lumina;
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
    for(const o of others) sayPartyAs(o.hi,'captured.watch',3,0,h);   /* v5.3 名指しは「捕まった子」。この時点でもう out なので、明示しないと名前が出せない */
    B.party.goal=null; B.party.pending=[]; B.party.talkUntil=0; B.party.gather=null; B.party.gatherDone=0; B.party.denRole=null;   // v3.1 相談は中断(言いかけの台詞と足止めを捨てる) / v3.2 待つ役も解く
    return;
  }
  G.mode='captured'; B.captureT=BAL.AFTER_FIRST; h.pinned=true;   /* v6.5 ここを過ぎたら観測フェーズへ */
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
/* ================= v4.0 暗闇 =================
   深淵は基本的に暗い。見えているのは、二人が纏う淡い光と、光・炎が通ったあとに残る灯り、
   そして催淫灯篭や光の柱のような置かれた光だけ。祠・燭台・光茸を得ると、その階のあいだ二人の光が増す。
   魔物のまわりは薄く光っているので、暗くても居場所は分かる(察知の距離は変えない)。
   彼女たちは暗い方へは行きたがらないが、行かないわけではない。暗い所では罠や雲や地形の境に気づくのが遅れる */
function darkLevel(){ const B=G.B; if(!B||!B.floor) return 0; return Math.max(0, Math.min(1, B.floor.dark||0)); }
/* その階で拾い集めた灯り(祠・燭台・光茸)。ヒロインの光の半径に掛かる */
function floorLight(){ const B=G.B; return 1+Math.min(BAL.DARK_FLOOR_MAX, B?(B.floorLight||0):0); }
/* ヒロインの光: 素性の半径 × 階の灯り × (相方が近ければ増光) */
function heroLightR(h){
  const B=G.B, HD=HEROES[h.id]||{}; let r=(HD.lightR||260)*floorLight();
  if(HD.dark) r*=yamiLeak(h);   // v5.0 闇の子は普段まったく光らない。えっちな目に遭っている間だけ、吸った分が漏れる
  if(B&&B.heroes.length>1){ let dm=1e9; for(const o of B.heroes){ if(o===h||o.out) continue; const d=Math.hypot(o.x-h.x,o.y-h.y); if(d<dm) dm=d; }
    if(dm<BAL.DARK_PAIR_R) r*=1+BAL.DARK_PAIR_K; }   // v5.0 いちばん近い仲間との距離で見る(三人でも正しく効く)
  if(h.climaxT>0||h.hypnoLv>=2) r*=0.85;   // 光が弱る
  return r;
}
/* v5.0 互いの姿は「壁を挟まなければ」見えている。距離で縛らないので、別々に歩ける。
   見えている相手の周りは、こちらからも薄く分かる(DARK_SEE_K) */
function partySeeAt(x,y){
  const B=G.B; if(!B||B.heroes.length<2) return 0;
  let v=0;
  for(const h of B.heroes){
    if(h.out) continue;
    const d=Math.hypot(x-h.x,y-h.y); if(d>=260) continue;
    for(const o of B.heroes){
      if(o===h||o.out) continue;
      if(!losClear(o.x,o.y-10,h.x,h.y-10,false)) continue;   // 壁の向こうなら見えない
      v=Math.max(v,(1-d/260)*BAL.DARK_SEE_K); break;
    }
  }
  return v;
}
/* 残す灯り: 光や炎が通った所は DARK_MEM_T 秒ほど見えている */
function pushLight(x,y,r,life,k){
  const B=G.B; if(!B||!B.lights) return;
  if(B.lights.length>BAL.DARK_MEM_MAX) B.lights.shift();
  B.lights.push({x,y,r:r||120,t:0,life:life||BAL.DARK_MEM_T,k:k||1});
}
function lightsTick(dt){
  const B=G.B, L=B.lights; if(!L) return;
  for(let i=L.length-1;i>=0;i--){ L[i].t+=dt; if(L[i].t>=L[i].life) L.splice(i,1); }
  if(darkLevel()<0.35) return;
  for(const h of B.heroes){   // 光の届かない所に居続けたら、こぼす
    if(h.out){ h.darkT=0; continue; }
    if(lightAt(h.x,h.y)<0.3){ h.darkT=(h.darkT||0)+dt; if(h.darkT>3.2){ h.darkT=0; const c0=B.ci; B.ci=h.hi; sayLine('feat.dark',0,24,'……なんも、みえない'); B.ci=c0; } }
    else h.darkT=0;
  }
}
/* 明るさ 0..1。1=昼のように見える。
   目当ての採点・ジェムの選別・視界の記憶から何百回も呼ぶので、1フレーム・1タイル単位で覚えておく */
let _laT=-1; const _laM=new Map();
function lightAt(x,y){
  const B=G.B; if(!B) return 1;
  if(B.time!==_laT){ _laT=B.time; _laM.clear(); }
  const k=(((x/32)|0)*4096)+((y/32)|0);
  let v=_laM.get(k);
  if(v===undefined){ v=lightAtRaw(x,y); _laM.set(k,v); }
  return v;
}
function lightAtRaw(x,y){
  const B=G.B; if(!B) return 1;
  let v=1-darkLevel();
  for(const h of B.heroes){ if(h.out) continue; const r=heroLightR(h)*(HEROES[h.id]&&HEROES[h.id].lightK||1); const d=Math.hypot(x-h.x,y-h.y); if(d<r) v=Math.max(v,1-d/r); }
  if(B.lanterns) for(const q of B.lanterns){ const d=Math.hypot(x-q.x,y-q.y); if(d<BAL.LANTERN_R) v=Math.max(v,(1-d/BAL.LANTERN_R)*0.95); }
  if(B.lights) for(const q of B.lights){ const d=Math.hypot(x-q.x,y-q.y); if(d<q.r){ const fade=1-q.t/q.life; v=Math.max(v,(1-d/q.r)*q.k*fade); } }
  { const pr=bondPair(); if(pr){ const d=segDist(x,y,pr[0].x,pr[0].y,pr[1].x,pr[1].y); if(d<BAL.BOND_R) v=Math.max(v,(1-d/BAL.BOND_R)*0.9); } }   // v4.1 絆の灯り
  v=Math.max(v,partySeeAt(x,y));   // v5.0 壁を挟まなければ、相手の居る所は見えている
  if(iceAt(x,y)>0.5) v=Math.max(v,BAL.ICE_LIGHT);   // v5.0 いちばん暗い子が引いた道だけ、夜が更けても薄く見えている
  { const eat=yamiDarkAt(x,y); if(eat>0) v*=1-eat; }   // v5.0 ヤミコは光を吸う(えっちな目に遭っている間だけ、漏れて光る)
  for(const q of B.enemies){ if(q.dead||q.id!=='lurecap'||q.revealed) continue; const d=Math.hypot(x-q.x,y-q.y); if(d<170) v=Math.max(v,(1-d/170)*0.82); }   // v4.1 媚茸は本当に光っている(だから釣られる)
  if(B.event){ const d=Math.hypot(x-B.event.x,y-B.event.y); if(d<260) v=Math.max(v,(1-d/260)*0.9); }
  for(const z of B.zones){ if(!z.fire) continue; const d=Math.hypot(x-z.x,y-z.y); if(d<z.r*1.3) v=Math.max(v,(1-d/(z.r*1.3))*0.8); }
  return Math.min(1,v);
}



/* ================= v5.0 媚薬沼 =================
   水溜まりのように点々と溜まった、桃色に濁った甘い沼。縁からえっちな触手が生えていて、
   そばを通れば脚を取りに来る。浸かるほど発情と敏感化が進み、足も重い。
   フレイラの炎が触れると、溜まっていたものが一気に蒸発して——広さと深さのぶんだけ、外まで噴き出す */
function spawnMires(){
  const B=G.B, dep=Math.max(1,Math.min(BAL.MIRE_N.length,(B.floor&&B.floor.depth)||1));
  const n=BAL.MIRE_N[dep-1]||3;
  B.mires=[];
  for(let i=0;i<n;i++){
    let q=null;
    for(let k=0;k<80&&!q;k++){
      const a=rand(TAU), d=rand(360,1600);
      const c=snapFloor(clampMapX(B.hero.x+Math.cos(a)*d,80), clampMapY(B.hero.y+Math.sin(a)*d,80), false, 3);
      if(!c||!reachableAt(c.x,c.y,false)) continue;
      if(B.mires.some(m=>Math.hypot(m.x-c.x,m.y-c.y)<260)) continue;
      q=c;
    }
    if(!q) continue;
    /* v5.8 大きさは三通りから引く。小さな溜まりは回り込めるが、
       大沼はまんなかまで触手が届かない——届かない所がいちばん深い、という形になる */
    const SZ=BAL.MIRE_SIZE, wSum=SZ.reduce((s,o)=>s+o.w,0);
    let pick=SZ[0], acc=rand(wSum);
    for(const o of SZ){ acc-=o.w; if(acc<=0){ pick=o; break; } }
    const r=rand(pick.r[0],pick.r[1]);
    const depth=pick.d[0]+(pick.d[1]-pick.d[0])*((r-pick.r[0])/Math.max(1,pick.r[1]-pick.r[0]));
    const tents=[];
    const nt=pick.t[0]+((Math.random()*(pick.t[1]-pick.t[0]+1))|0);
    /* ★v6.2 触手は角度だけで生やしていて、タイルを一度も見ていなかった。
       液面は mireTiles が solid を飛ばすので壁には入らないのに、触手だけが壁から生えていた
       (実測: 沼290個・触手655本のうち、根元か先が壁の中にあるもの 133本＝20.3%)。
       根元(r*0.82)と伸びた先(さらに r*0.85)の両方が床に乗る向きだけを使う。
       生やせる向きが足りない沼は、無理に生やさず本数を減らす——
       壁から生えるより、その沼が静かなほうがいい */
    { const okA=[];
      for(let k=0;k<48;k++){
        const a=k*TAU/48+rand(-0.03,0.03);
        const bx=q.x+Math.cos(a)*r*0.82, by=q.y+Math.sin(a)*r*0.6;
        if(!passAt(bx,by,false)) continue;
        const LL=r*0.85, ex=bx+Math.cos(a)*LL, ey=by+Math.sin(a)*LL*0.8-8;
        if(!passAt(ex,ey,false)) continue;
        okA.push(a);
      }
      shuffle(okA);
      for(const a of okA){
        if(tents.length>=nt) break;
        /* 同じ方角に固まらせない(前は一様乱数だったので、そこは元の見た目に寄せる) */
        if(tents.some(t=>Math.abs(Math.atan2(Math.sin(t.a-a),Math.cos(t.a-a)))<0.5)) continue;
        tents.push({a, ph:rand(TAU), cd:rand(0,3), reach:0});
      }
    }
    B.mires.push({x:q.x, y:q.y, r, depth, size:SZ.indexOf(pick), tents, seen:false, dry:false, iced:false, t:rand(9)});
  }
  mireInit();
  spawnFloorBoss();   /* v6.0 その階だけの主を、降り口のそばに眠らせておく */
}
/* v5.8 沼をマップチップに焼く。えちえちエリアと同じく地形として持たせる——
   絵と当たり判定が同じタイルを見るので、見えている縁がそのまま踏んではいけない縁になる。
   mireT=深さ(0〜255) / mireIdx=どの沼か(添字+1)。蒸発・氷結でタイルごと消える */
function mireInit(){
  const M=G.map, B=G.B; if(!M||!B) return;
  M.mireT=new Uint8Array(MAP_W*MAP_H);
  M.mireIdx=new Uint8Array(MAP_W*MAP_H);
  const dirty=new Set();
  if(B.mires) for(let n=0;n<B.mires.length;n++){
    mirePaint(B.mires[n],n);
    mireTiles(B.mires[n],(i,j)=>dirty.add(chunkKey(Math.floor(i/CHUNK),Math.floor(j/CHUNK))));
  }
  /* 先に焼いたチャンクのうち、沼が掛かった分だけ捨てる(出発点まわりの焼き置きは活かす) */
  if(M.chunks) for(const ck of dirty) M.chunks.delete(ck);
  M.mini=null;
}
function mireTiles(m,fn){
  const i0=tileI(m.x-m.r), i1=tileI(m.x+m.r), j0=tileJ(m.y-m.r*0.78), j1=tileJ(m.y+m.r*0.78);
  for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){
    if(!inMap(i,j)||solidIJ(i,j)) continue;
    const dx=tileCX(i)-m.x, dy=(tileCY(j)-m.y)/0.78;
    const d=Math.hypot(dx,dy); if(d>m.r) continue;
    fn(i,j,d/m.r);
  }
}
function mirePaint(m,n){
  const M=G.map; if(!M||!M.mireT) return;
  mireTiles(m,(i,j,q)=>{
    const k=j*MAP_W+i;
    /* 縁は浅く、まんなかが深い。踏み込むほど重くなるのが見た目でも分かる */
    const dep=m.depth*(0.45+0.55*(1-q*q));
    if(dep*255>M.mireT[k]){ M.mireT[k]=Math.max(1,Math.min(255,Math.round(dep*255))); M.mireIdx[k]=n+1; }
  });
}
/* 沼が消えた(蒸発・氷結)時にタイルを剥がす。掛かったチャンクだけ焼き直す */
function mireClear(m){
  const M=G.map, B=G.B; if(!M||!M.mireT) return;
  const dirty=new Set();
  mireTiles(m,(i,j)=>{
    const k=j*MAP_W+i;
    M.mireT[k]=0; M.mireIdx[k]=0;
    dirty.add(chunkKey(Math.floor(i/CHUNK),Math.floor(j/CHUNK)));
  });
  /* 重なっていた別の沼を塗り直す(重なりは滅多に無いが、消えた側だけ剥がす) */
  if(B.mires) for(let n=0;n<B.mires.length;n++){ const o=B.mires[n]; if(o===m||o.dry||o.iced) continue;
    if(Math.hypot(o.x-m.x,o.y-m.y)<o.r+m.r) mirePaint(o,n); }
  if(M.chunks) for(const ck of dirty) M.chunks.delete(ck);
  M.mini=null;
}
/* v5.8 沼の判定はマップチップを引く。描いている物と踏んでいる物が同じタイルになる */
function mireAt(x,y){
  const B=G.B, M=G.map; if(!B||!B.mires) return null;
  if(M&&M.mireIdx){
    const i=tileI(x), j=tileJ(y); if(!inMap(i,j)) return null;
    const n=M.mireIdx[j*MAP_W+i]; if(!n) return null;
    const m=B.mires[n-1];
    return (m&&!m.dry&&!m.iced)?m:null;   /* v5.0 凍った沼は静かに閉じている */
  }
  for(const m of B.mires){ if(m.dry||m.iced) continue; if(Math.hypot(x-m.x,(y-m.y)/0.78)<m.r) return m; }
  return null;
}
/* その場の沼の深さ(0〜1)。縁は浅く、まんなかが深い */
function mireDepthAt(x,y){
  const M=G.map; if(!M||!M.mireT) { const m=mireAt(x,y); return m?m.depth:0; }
  const i=tileI(x), j=tileJ(y); if(!inMap(i,j)) return 0;
  const n=M.mireIdx[j*MAP_W+i]; if(!n) return 0;
  const B=G.B, m=B&&B.mires&&B.mires[n-1];
  if(!m||m.dry||m.iced) return 0;
  return M.mireT[j*MAP_W+i]/255;
}
function miresTick(dt){
  const B=G.B; if(!B.mires||!B.mires.length) return;
  for(const m of B.mires){
    m.t+=dt; if(m.dry||m.iced) continue;
    for(const h of B.heroes){
      if(h.out) continue;
      const d=Math.hypot(h.x-m.x,(h.y-m.y)/0.78);
      const ci0=B.ci; B.ci=h.hi;
      const dep=(mireAt(h.x,h.y)===m)?mireDepthAt(h.x,h.y):0;   /* v5.8 マップチップの深さで効く。縁は浅く、まんなかが重い */
      if(dep>0 && !onIce(h)){   // 浸かっている(v5.0 氷の道の上なら沼に浸かっていない)
        addHeatG(BAL.MIRE_HEAT*dep*dt); applySensit(BAL.MIRE_SENS*dep*dt);
        h.slow=Math.max(h.slow||0, BAL.MIRE_SLOW*dep);
        if(Math.random()<dt*3) parts(h.x+rand(-12,12), h.y-rand(0,10), 1, ['#ff9ec2','#e08ac0','#fff'], 40, 0.7);
        if(!m.seen){ m.seen=true; sayLine('feat.mire',1,0,'うわ、ぬまだ……! あまい、においする'); }
      }
      // 縁の触手: 近づくと伸びてくる
      for(const tn of m.tents){
        tn.cd-=dt*(d<BAL.MIRE_TENT_R+m.r?1:0.3);
        const tx=m.x+Math.cos(tn.a)*m.r*0.82, ty=m.y+Math.sin(tn.a)*m.r*0.6;
        const td=Math.hypot(h.x-tx,h.y-ty);
        tn.reach=Math.max(0, tn.reach-dt*2.2);
        if(tn.cd<=0 && td<BAL.MIRE_TENT_R && !h.out){
          tn.cd=BAL.MIRE_TENT_CD; tn.reach=1;
          if(attachMonster({id:'miretent', x:tx, y:ty, r:10, hp:1, maxHp:1, dead:false, mire:true, dmg:0, xp:0},'tether',{r:BAL.MIRE_TENT_R,needMul:0.8,legFirst:true})){
            applySensit(4); addHeatG(9);
            parts(tx,ty,10,['#ff9ec2','#c85682','#fff'],110,0.7);
            sayLine('feat.mireTent',2,0,'ぬまから、て……っ、あし、つかま……!');
          }
        }
      }
      B.ci=ci0;
    }
  }
}
/* ★v6.4b 噴き出した甘い霧を吸い込む。うわっ、と息を詰めて、むせて、霧の外へ足が向く。
   heat/sens をここで全部入れずに EVAP_NOW ぶんだけ渡し、残りは chokeTick が少しずつ渡す */
function evapBreathe(h,cx,cy,heat,sens){
  const B=G.B, ci0=B.ci; B.ci=h.hi;
  addHeatG(heat*BAL.EVAP_NOW); applySensit(sens*BAL.EVAP_NOW);
  B.ci=ci0;
  h.chokeT=BAL.EVAP_CHOKE_T; h.chokeFrom={x:cx,y:cy};
  h.chokeHeat=heat*(1-BAL.EVAP_NOW); h.chokeSens=sens*(1-BAL.EVAP_NOW); h.chokeSaid=0;
  h.stumbleDur=Math.max(h.stumbleDur||0, BAL.EVAP_GASP_T);   /* まず、よろける */
  h.hesit=null;                                              /* 迷っている場合ではない */
  sayPartyOrLine(h,'feat.evap','しまった……! こんなに、ひろがって……!');
}
/* むせている間: 少しずつ吸い込み、途中で咳き込み、抜けたところで「覚えた」 */
function chokeTick(h,dt){
  if(!((h.chokeT||0)>0)) return;
  const B=G.B, ci0=B.ci; B.ci=h.hi;
  const k=dt/Math.max(0.1,BAL.EVAP_CHOKE_T-BAL.EVAP_GASP_T);
  if(h.chokeT<=BAL.EVAP_CHOKE_T-BAL.EVAP_GASP_T){
    addHeatG((h.chokeHeat||0)*k); applySensit((h.chokeSens||0)*k);
    if(!h.chokeSaid){ h.chokeSaid=1; sayLine('feat.evapCough',2,0,'けほっ……ごほっ、す、すって……'); }
    if(Math.random()<dt*7) parts(h.x+rand(-8,8), h.y-26, 1, ['#ff9ec2','#ffd0e4'], 40, 0.5);
  }
  h.chokeT-=dt;
  if(h.chokeT<=0){ h.chokeT=0; h.chokeFrom=null; h.chokeSaid=0;
    sayLine('feat.evapLearn',2,0,'……もう、ここでは やかない'); }
  B.ci=ci0;
}
/* 沼の蒸発: 溜まっていたものが一気に立ちのぼり、広さと深さに比例して外まで噴き出す */
function mireEvaporate(m){
  const B=G.B; if(m.dry) return;
  m.dry=true;
  if(typeof mireClear==='function') mireClear(m);   /* v5.8 マップチップからも剥がす(液面が消える) */
  const R=m.r*m.depth*BAL.MIRE_EVAP_K, n=Math.max(4,Math.round(BAL.MIRE_EVAP_N*m.depth));
  B.fx.push({kind:'evap', x:m.x, y:m.y, r:R, t:0, life:1.6});
  B.fx.push({kind:'mireburst', x:m.x, y:m.y, r:m.r, t:0, life:0.9});
  G.shake=Math.min(14,G.shake+7); sfx(320,110,1.0,'sine',0.09);
  setBanner('沼が蒸発した','溜まっていた甘い霧が、一気に外まで噴き出す','#ff5d9a');
  for(let i=0;i<n;i++){
    const a=i*TAU/n+rand(0.5), rr=R*(0.3+0.7*Math.random());
    const q=snapFloor(m.x+Math.cos(a)*rr, m.y+Math.sin(a)*rr, false, 3)||{x:m.x+Math.cos(a)*rr, y:m.y+Math.sin(a)*rr};
    spawnCloud(q.x, q.y, 150+120*m.depth, BAL.MIRE_EVAP_LIFE, BAL.SENSIT_GAS*BAL.MIRE_EVAP_RATE*m.depth, 'gas');
  }
  spawnCloud(m.x, m.y, m.r*2.2, BAL.MIRE_EVAP_LIFE, BAL.SENSIT_GAS*BAL.MIRE_EVAP_RATE*m.depth, 'gas');
  for(const h of B.heroes){
    if(h.out) continue;
    const d=Math.hypot(h.x-m.x,h.y-m.y); if(d>R) continue;
    evapBreathe(h, m.x, m.y, BAL.MIRE_EVAP_HEAT*m.depth*(1-d/R*0.5), 9*m.depth);
  }
  META.gen.dryLesson=(META.gen.dryLesson|0)+1; saveMeta();
}
/* ================= v4.1 菌輪(きんりん) =================
   床に小さな茸が輪になって生えている。踏み越えて中へ入ると一斉に胞子を噴き、
   傘がふくらんで数秒のあいだ柔らかい壁になる。押し出るまで濃い胞子の中。
   一度やられれば覚えて(trapKnow)、次からは輪を避けて歩く */
function spawnRings(){
  /* v6.0 ここが Math.min(8,depth) で止めていたので、配列の9番目以降が黙って死んでいた。
     spawnMires と同じ「配列の長さで止める」書き方に揃える */
  const B=G.B, dep=Math.max(1,Math.min(BAL.MRING_N.length,(B.floor&&B.floor.depth)||1));
  const n=(BAL.MRING_N[dep-1]||1);
  B.rings=[];
  for(let i=0;i<n;i++){
    let q=null;
    for(let k=0;k<90&&!q;k++){ const a=rand(TAU), d=rand(430,1500);
      const c=snapFloor(clampMapX(B.hero.x+Math.cos(a)*d,90), clampMapY(B.hero.y+Math.sin(a)*d,90), false, 4);
      if(!c||!reachableAt(c.x,c.y,false)) continue;
      let ok=true;   // 輪ぜんぶが床であること(壁に食い込ませない)
      for(let s=0;s<10;s++){ const t=s*TAU/10; if(!passAt(c.x+Math.cos(t)*BAL.MRING_R, c.y+Math.sin(t)*BAL.MRING_R*0.78, false)){ ok=false; break; } }
      if(ok) q=c;
    }
    if(!q) continue;
    B.rings.push({x:q.x, y:q.y, r:BAL.MRING_R, state:'open', t:0, cd:0, seen:false, caps:8+((Math.random()*4)|0)});
  }
}
function ringAt(x,y){ const B=G.B; if(!B.rings) return null; for(const R of B.rings){ if(Math.hypot(x-R.x,(y-R.y)/0.78)<R.r) return R; } return null; }
function ringsTick(dt){
  const B=G.B; if(!B.rings||!B.rings.length) return;
  for(const R of B.rings){
    if(R.state==='shut'){ R.t-=dt; if(R.t<=0){ R.state='cool'; R.cd=BAL.MRING_CD; } }
    else if(R.state==='cool'){ R.cd-=dt; if(R.cd<=0) R.state='open'; }
    for(const h of B.heroes){
      if(h.out) continue;
      const d=Math.hypot(h.x-R.x,(h.y-R.y)/0.78);
      const ci0=B.ci; B.ci=h.hi;
      if(R.state==='open' && d<R.r*0.72){   // 踏み込んだ: 一斉に噴いて、傘が閉じる
        R.state='shut'; R.t=BAL.MRING_T; R.seen=true;
        spawnCloud(R.x,R.y,R.r*1.35,BAL.MRING_T+5,BAL.SENSIT_GAS*BAL.MRING_RATE,'gas');
        B.fx.push({kind:'ringpuff', x:R.x, y:R.y, r:R.r, t:0, life:0.8});
        addHeatG(14); applySensit(5); h.stumbleDur=Math.max(h.stumbleDur,0.5);
        parts(R.x,R.y,26,['#e8d0f0','#ffd0e4','#fff'],150,0.9); sfx(200,90,0.4,'sine',0.07); G.shake=Math.min(7,G.shake+3);
        learnTrap('ring');
        sayLine('feat.ring',2,0,'わ、わっ……! きのこ、いっせいに……!');
        B.nRing=(B.nRing||0)+1;
      }
      if(R.state!=='cool' && ringKnown() && d>R.r*1.05 && d<R.r*2.1) sayLine('feat.ringKnown',0,30,'ここ、わっかになってる。まわろ');   // 覚えた輪は避けて通る
      if(R.state==='shut' && d<R.r*1.05){   // 中に居る間: 濃い胞子と、押し返してくる傘
        addHeatG(BAL.MRING_HEAT*dt); applySensit(BAL.MRING_SENS*dt);
        if(d>R.r*0.72){ const dd=Math.hypot(h.x-R.x,h.y-R.y)||1; h.vx-=(h.x-R.x)/dd*BAL.MRING_PUSH*dt; h.vy-=(h.y-R.y)/dd*BAL.MRING_PUSH*dt; }
        if(Math.random()<dt*3) parts(h.x+rand(-14,14),h.y-rand(0,24),1,['#e8d0f0','#ffd0e4'],40,0.7);
      }
      B.ci=ci0;
    }
  }
}
/* 覚えた輪は避けて歩く(踏んだことがあるか、知識が進んでいれば) */
function ringKnown(){ return (META.gen.trapKnow&&META.gen.trapKnow.ring)?1:0; }
function ringAvoid(x,y){
  const B=G.B; if(!B.rings||!ringKnown()) return false;
  for(const R of B.rings){ if(R.state==='cool') continue; if(Math.hypot(x-R.x,(y-R.y)/0.78)<R.r*0.95) return true; }
  return false;
}
/* ================= v4.1 きのこ =================
   媚茸: 光茸そっくりに光って待つ。暗いほどよく目立ち、彼女は灯りだと思って寄っていく。
         手が届く距離で傘が裏返り、粘つく襞が脚に巻きついて甘い胞子を吹く。
         一度「理解」すれば、光り方の違いで見破れるようになる。
   抱き茸: 動かない大型。近づくと柄がしなって傘をかぶせ、襞の中に閉じ込めて撫でつづける。 */
function lureLooksReal(e){ return !e.revealed && knowLv('lurecap')<2; }   // 見破られていない間だけ、光茸に見える
function lurecapTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  e.lureCd=(e.lureCd||0)-dt;
  if(!lureLooksReal(e) && d<170 && d>BAL.LURE_R) sayLine('feat.lureKnown',0,26,'……あれ、にせものだ。いろが ちがう');   // 見破っている(近寄らない)
  if(e.openT>0){ e.openT-=dt; if(e.openT<=0) e.state='lure'; }
  if(e.state==='lure' && d<BAL.LURE_R && e.lureCd<=0){
    e.revealed=true; e.state='open'; e.openT=2.2; e.lureCd=BAL.LURE_CD;
    codexMet('lurecap');
    const got=attachMonster(e,'cling',{legFirst:true,needMul:0.9});
    addHeatG(BAL.LURE_HEAT); applySensit(BAL.LURE_SENS);
    spawnCloud(e.x,e.y-6,BAL.LURE_CLOUD_R,BAL.LURE_CLOUD_LIFE,BAL.SENSIT_GAS*1.15,'gas');
    parts(e.x,e.y-8,20,['#ff9ec2','#9fe8c8','#fff'],150,0.8);
    sfx(240,120,0.35,'sawtooth',0.07); G.shake=Math.min(6,G.shake+3);
    floatTxt(e.x,e.y-30,'——にせもの','#ff9ec2',12,1.3);
    sayLine('feat.lure',2,0,got?'えっ、ひかり……!? ちが、これ きのこじゃ……っ':'にせもの……! ひかってたのに……!');
    B.nLure=(B.nLure||0)+1;
  }
}
function hugcapTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  e.hugCd=(e.hugCd||0)-dt;
  e.hugT=0; e.puffed=false;   // 傘の中の処理は「絡みつき中」の分岐で(こちらは狙う側)
  if(d<BAL.HUG_R && e.hugCd<=0 && !p.out){
    e.hugCd=BAL.HUG_CD; e.bendT=0.55;   // 柄がしなる予兆
    e.aimX=p.x; e.aimY=p.y;
  }
  if(e.bendT>0){
    e.bendT-=dt;
    if(e.bendT<=0){
      const dd=Math.hypot(p.x-e.aimX,p.y-e.aimY);
      if(dd<52 && d<BAL.HUG_R+30){   // 予兆の間に逃げていなければ、傘がかぶさる
        codexMet('hugcap');
        if(attachMonster(e,'cling',{needMul:BAL.HUG_NEED})){
          B.hugFx=B.hugFx||[]; B.fx.push({kind:'hugdrop', x:p.x, y:p.y, r:e.r*2.6, t:0, life:0.5});
          applySensit(5); p.stumbleDur=Math.max(p.stumbleDur,0.5);
          sfx(150,70,0.4,'sine',0.07); G.shake=Math.min(7,G.shake+4);
          sayLine('feat.hug',2,0,'うわ、かさ……! なか、あったかくて……っ');
          B.nHug=(B.nHug||0)+1;
        }
      }else{ parts(e.x,e.y-e.r,8,['#e8d4b0','#c8a878'],80,0.5); }
    }
  }
}
/* v4.1 絆の灯り: 家族茸を取ると、その階のあいだ二人を結ぶ道がずっと照らされる。
   一人の時は、通ってきた道に灯りが落ちる(帰り道が見える) */
function segDist(px,py,ax,ay,bx,by){
  const dx=bx-ax, dy=by-ay, L=dx*dx+dy*dy;
  if(L<1) return Math.hypot(px-ax,py-ay);
  let t=((px-ax)*dx+(py-ay)*dy)/L; t=t<0?0:(t>1?1:t);
  return Math.hypot(px-(ax+dx*t), py-(ay+dy*t));
}
function bondPair(){
  const B=G.B; if(!B||!B.bond) return null;
  const a=B.heroes.find(h=>!h.out); if(!a) return null;
  const b=B.heroes.find(h=>h!==a&&!h.out); if(!b) return null;
  return [a,b];
}
function bondTick(dt){   // 一人の時の落とし灯り
  const B=G.B; if(!B.bond) return;
  if(bondPair()) return;
  const p=B.heroes.find(h=>!h.out); if(!p) return;
  B.bondT=(B.bondT||0)-dt;
  if(B.bondT<=0){ B.bondT=BAL.BOND_SOLO_CD; pushLight(p.x,p.y,BAL.BOND_SOLO_R,BAL.BOND_SOLO_LIFE,0.8); }
}
/* 暗さで鈍る: 罠や雲や地形の境に気づく距離の係数(0.5〜1) */
function darkSense(x,y){ const l=lightAt(x,y); return BAL.DARK_LAG+(1-BAL.DARK_LAG)*Math.min(1,l*1.35); }
/* 催淫灯篭: 明るいが、そばに居ると発情と敏感化が進む */
/* v5.0 灯篭: 着いた時は「明るいから安心」。しばらく居て初めて「あれ、あつい……?」と気づく。
   誘蛾灯のように引っぱるのではなく、暗くて心細い時に休みに寄って、温まって離れる */
/* v6.6 切り上げの基準を「経った時間」から「溜まった熱」へ。
   実測(第5層・8夜)で、3.4秒の機械的な打ち切りと52秒のCDのせいで、灯篭は一晩の発情の
   1.2%・敏感化の 0.3% しか作っていなかった(寄るのは 1.3回・7.5秒/夜)。
   初めては気づくのが遅く、たっぷり温まる。焼かれるたび learnTrap('lantern') が積もり、
   気づく閾値も離れる閾値も下がって、LANTERN_KNOW_OFF 回で寄らなくなる。 */
function lanternKnow(){ return ((META.gen&&META.gen.trapKnow&&META.gen.trapKnow.lantern)||0); }
function lanternLimit(){ return Math.max(4, BAL.LANTERN_LEAVE*(1-BAL.LANTERN_KNOW_CUT*lanternKnow())); }
function lanternTick(dt){
  const B=G.B; if(!B.lanterns||!B.lanterns.length) return;
  for(const h of B.heroes){
    if(h.out){ h.lantT=0; h.lantHeat=0; continue; }
    let near=null, nd=1e9;
    for(const q of B.lanterns){ const d=Math.hypot(q.x-h.x,q.y-h.y); if(d<nd){ nd=d; near=q; } }
    if(!near||nd>BAL.LANTERN_R*0.62){ h.lantT=Math.max(0,(h.lantT||0)-dt*0.5); h.lantHeat=Math.max(0,(h.lantHeat||0)-dt*6); h.lantSaid=0; continue; }
    const k=1-nd/(BAL.LANTERN_R*0.62), ci0=B.ci; B.ci=h.hi;
    const add=BAL.LANTERN_HEAT*k*dt;
    addHeatG(add); applySensit(BAL.LANTERN_SENS*k*dt);
    h.lantT=(h.lantT||0)+dt;
    h.lantHeat=(h.lantHeat||0)+add;                                    /* この滞在で溜まった分 */
    const notice=Math.max(3, BAL.LANTERN_NOTICE*(1-BAL.LANTERN_KNOW_CUT*lanternKnow()));
    if(!h.lantSaid && nd<86){ h.lantSaid=1; sayLine('feat.lanternWarm',1,0,'あかるい……ここなら、だいじょうぶ'); }        /* 着いた: 安心 */
    else if(h.lantSaid===1 && h.lantHeat>=notice){ h.lantSaid=2; sayLine('feat.lantern',1,0,'……あれ? なんか、からだ、ぽかぽかして'); }   /* 温まって、やっと気づく */
    if(h.lantHeat>=lanternLimit()){   /* 熱が溜まりきったら切り上げる。覚えているほど早い */
      h.lantT=0; h.lantHeat=0; h.lantSaid=0; h.lantT2=0; h.lantCd=B.time+BAL.LANTERN_CD;
      learnTrap('lantern');           /* ★焼かれた回数を覚える(世代が巻き戻ると消える) */
      B.nLantBurn=(B.nLantBurn||0)+1;
      if(h.goal&&h.goal.kind==='poi'&&h.goal.sub==='lantern'){ h.goal=null; h.goalT=0; giveUpOn(h.goal); }
      sayLine(lanternKnow()>=BAL.LANTERN_KNOW_OFF?'feat.lanternKnown':'feat.lanternLeave',0,26,'……ここ、ながく居たら だめなやつだ');
    }
    B.ci=ci0;
  }
}
/* 灯篭へ寄りたいか: 暗い階で、まだ火照っていなくて、直前に離れたばかりでないとき */
/* v5.0 灯篭へ寄る条件を締めた: 「いま足元が暗くて心細い」時の休み場であって、灯りそのものが目的ではない。
   暗い階で、足元が実際に暗く、まだ火照っておらず、直前に離れたばかりでもない時だけ */
function lanternWant(p){
  const B=G.B;
  if(lanternKnow()>=BAL.LANTERN_KNOW_OFF) return false;   /* v6.6 何度か焼かれたら「あれは近づかない方がいい」 */
  if(darkLevel()<=0.3 || p.heatLv>=1) return false;
  if((p.aphro||0)>=BAL.LANTERN_HEAT_MAX || (p.sensit||0)>=70) return false;
  if(B.time<(p.lantCd||0)) return false;
  return (B.floorLight||0)<BAL.LANTERN_NEED_LIGHT;   /* v5.0 この階でまだ灯りを拾えていない時だけ寄りたくなる(拾った後は用がない)。目当てとしての重みも小さいので、宝箱や祠を差し置いて吸い寄せられはしない */
}
/* 灯りを得た(祠・燭台・光茸): その階のあいだ二人の光が増える */
function gainFloorLight(kind,x,y){
  const B=G.B; if(!B) return;
  const add=kind==='shrine'?BAL.DARK_SHRINE:(kind==='candle'?BAL.DARK_CANDLE:BAL.DARK_SHROOM);
  B.floorLight=Math.min(BAL.DARK_FLOOR_MAX,(B.floorLight||0)+add);
  if(kind==='shroom' && B.heroes.length>1){   // 光茸は二人の間を照らす
    const a=B.heroes[0], b=B.heroes.find(h=>h!==a&&!h.out);
    if(b&&!a.out){ for(let t=0;t<=4;t++) pushLight(a.x+(b.x-a.x)*t/4, a.y+(b.y-a.y)*t/4, 190, BAL.DARK_MEM_T*2.2, 0.9); }
  }
  if(x!==undefined) pushLight(x,y,260,BAL.DARK_MEM_T*2,1);
  if(darkLevel()>0.25){ floatTxt(x!==undefined?x:B.hero.x, (y!==undefined?y:B.hero.y)-96, '灯りが増えた','#ffe9a8',12,1.6); sayLine('feat.lightUp',0,14,'あかるく、なった……! これで、みえる'); }
}

/* ================= v4.0 強化魔核 =================
   厚みで押すのをやめ、技で押す。世代(討伐回数)ごとに一つずつ覚える:
     世代1 落とし子の群れ(巻きつくと親の傷が塞がる) / 世代2 大型の眷属を呼ぶ
     世代3 大溜めからの広範囲絶頂光線               / 世代4 半分で発狂(広範囲媚薬ガスと薙ぎ)
   代わりに素の体力は下げた(CORE_HP 28000 → 22400) */
function coreSkill(e,k){ const era=(e.era!==undefined?e.era:eraNow()); return era>=BAL['CORE_SK_'+k]; }
/* 落とし子: 親の根から千切れて生まれる。巻きついている間、親の傷が塞がる */
function coreMinions(e){ let n=0; for(const q of G.B.enemies){ if(!q.dead && q.id==='coreling' && q.parent===e) n++; } return n; }
function coreSpawnMinions(e){
  const B=G.B, p=B.hero, ph=e.hp/e.maxHp;
  const arr=BAL.CORE_MINION_N, n=arr[Math.min(arr.length-1, Math.max(0,((e.era||0)-BAL.CORE_SK_MINION)))]+(ph<0.4?1:0);
  for(let i=0;i<n;i++){
    if(B.enemies.length>=fieldCap()) break;
    const a=rand(TAU), q=spawnUnit('coreling', e.x+Math.cos(a)*(e.r+22), e.y+Math.sin(a)*(e.r*0.6+16), {enVal:0, gemMul:0.25});
    if(q){ q.parent=e; q.born=B.time; }
  }
  B.spawnFx.push({x:e.x,y:e.y,t:0,r:e.r+30});
  B.fx.push({kind:'corebirth', x:e.x, y:e.y, t:0, life:0.7});
  sfx(180,90,0.3,'sawtooth',0.06);
  floatTxt(e.x,e.y-e.r-26,'落とし子','#ff9ec2',12,1.2);
}
/* 大型の眷属: その階層の相性種から、大きいものを一体だけ呼ぶ */
function coreSpawnBig(e){
  const B=G.B, p=B.hero, F=B.floor;
  const pool=(F.affinity||[]).filter(id=>MONSTERS[id] && !MONSTERS[id].item && id!=='core' && (MONSTERS[id].boss||MONSTERS[id].tier==='large'));
  const id=pool.length?pickRand(pool):'gtent';
  const a=rand(TAU), q=spawnUnit(id, p.x+Math.cos(a)*230, p.y+Math.sin(a)*170, {enVal:0, gemMul:0.5});
  if(!q) return;
  q.fromCore=true; q.hp=q.maxHp=Math.round(q.maxHp*1.15);
  B.spawnFx.push({x:q.x,y:q.y,t:0,r:q.r+40});
  setBanner('魔核が'+MONSTERS[id].name+'を産み落とした','根がほどけて、形になる','#ff6b81');
  G.shake=Math.min(10,G.shake+5); sfx(90,50,0.5,'sawtooth',0.09);
}
/* 大溜め→広範囲絶頂光線: 2.6秒の予兆(線が伸びて濃くなる)の後、太い光が抜ける */
function coreBeamAim(e){
  const B=G.B; let t=null, td=1e9;
  for(const h of B.heroes){ if(h.out) continue; const d=Math.hypot(h.x-e.x,h.y-e.y); if(d<td){ td=d; t=h; } }
  return t?Math.atan2((t.y-12)-e.y, t.x-e.x):(e.lookA||0);
}
function coreBeamFire(e){
  const B=G.B, a=e.beamA, dx=Math.cos(a), dy=Math.sin(a);
  let len=BAL.CORE_BEAM_LEN; for(let s=20;s<=BAL.CORE_BEAM_LEN;s+=12){ if(!passAt(e.x+dx*s,e.y+dy*s,true)){ len=s-12; break; } }
  B.fx.push({kind:'corebeam', x:e.x, y:e.y, ang:a, len, w:BAL.CORE_BEAM_W, t:0, life:BAL.CORE_BEAM_FIRE});
  G.shake=Math.min(14,G.shake+8); sfx(300,1400,0.6,'sine',0.09); G.hurtFlash=Math.max(G.hurtFlash||0,0.5);
  for(const h of B.heroes){
    if(h.out) continue;
    const rx=h.x-e.x, ry=(h.y-12)-e.y, along=rx*dx+ry*dy;
    if(along<0||along>len) continue;
    if(Math.abs(rx*dy-ry*dx)>BAL.CORE_BEAM_W) continue;
    const ci0=B.ci; B.ci=h.hi;
    applyPleasure(BAL.CORE_BEAM_PLEA); applySensit(BAL.CORE_BEAM_SENS); addHeatG(30);
    h.stumbleDur=Math.max(h.stumbleDur,1.1);
    hurtHero(e.dmg*0.8,e,{noKb:true,pierce:true});
    floatTxt(h.x,h.y-64,'絶頂光線','#ff86b3',13,1.4);
    sayPartyOrLine(h,'feat.coreBeam','ひかりが……ぬける……っ、あ……');
    parts(h.x,h.y-12,16,['#ff86b3','#fff','#ffd0e4'],150,0.8);
    B.ci=ci0;
  }
}
/* 発狂: 体力が半分を切ると、根がほどけて暴れる */
function coreRageEnter(e){
  const B=G.B;
  e.rage=true; e.rageGasCd=1.2; e.rageSlamCd=2.4;
  setBanner('魔核が発狂した','根がほどけ、甘い霧を吐き、腕のように薙ぐ','#ff2e6a');
  G.shake=Math.min(16,G.shake+10); sfx(70,30,0.9,'sawtooth',0.12);
  B.fx.push({kind:'corerage', x:e.x, y:e.y, t:0, life:1.2});
  for(const h of B.heroes){ if(!h.out) sayPartyOrLine(h,'feat.coreRage','こわれた……!? まだ、うごくの……!'); }
}
function coreRageTick(e,dt){
  const B=G.B;
  e.rageGasCd-=dt; e.rageSlamCd-=dt;
  if(e.rageGasCd<=0){   // 広範囲の媚薬ガス: 魔核を中心に大きく吐き出す
    e.rageGasCd=BAL.CORE_RAGE_GAS_CD;
    spawnCloud(e.x,e.y,BAL.CORE_RAGE_GAS_R,BAL.CORE_RAGE_GAS_LIFE,BAL.SENSIT_GAS*1.35,'gas');
    B.fx.push({kind:'coregas', x:e.x, y:e.y, r:BAL.CORE_RAGE_GAS_R, t:0, life:0.9});
    floatTxt(e.x,e.y-e.r-26,'甘い霧','#ff9ec2',12,1.4); sfx(160,70,0.6,'sine',0.06);
  }
  if(e.rageSlamCd<=0){   // 広範囲の薙ぎ: 輪が広がり、触れたら弾かれる
    e.rageSlamCd=BAL.CORE_RAGE_SLAM_CD;
    B.fx.push({kind:'coreslam', x:e.x, y:e.y, r:BAL.CORE_RAGE_SLAM_R, t:0, life:0.5});
    G.shake=Math.min(12,G.shake+6); sfx(110,40,0.4,'square',0.08);
    for(const h of B.heroes){
      if(h.out) continue;
      const d=Math.hypot(h.x-e.x,h.y-e.y); if(d>BAL.CORE_RAGE_SLAM_R) continue;
      const ci0=B.ci; B.ci=h.hi;
      hurtHero(e.dmg*BAL.CORE_RAGE_SLAM_DMG,e,{});
      applySensit(4); h.stumbleDur=Math.max(h.stumbleDur,0.6);
      const dd=Math.hypot(h.x-e.x,h.y-e.y)||1; h.vx+=(h.x-e.x)/dd*260; h.vy+=(h.y-e.y)/dd*260;
      B.ci=ci0;
    }
  }
}
/* 落とし子の動き: まっすぐ這い寄って巻きつく。巻きついている間、親の傷が塞がる */
function corelingTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  if(e.state==='attached'){   // 吸い上げは親の側でまとめて(coreDrain)。ここでは絵だけ
    if(Math.random()<dt*3) parts(e.x+rand(-6,6),e.y-4,1,['#ff9ec2','#ffd0e4'],50,0.5);
    return;
  }
  const rush=(attachCount(p)>0||p.pinned||p.climaxT>0)?1.35:1;
  e.x+=dx/d*e.spd*rush*dt; e.y+=dy/d*e.spd*rush*dt;
  if(d<e.r+16 && (e.grabCd=(e.grabCd||0)-dt)<=0){
    e.grabCd=1.1;
    if(attachMonster(e,'cling',{r:0,needMul:0.75})){ codexMet('coreling'); }
  }
}

/* ================= v4.0 フレイラの火属性と水弱点 =================
   湿った所では火が立たず、乾いた所ではよく通る。ヌルヌルした相手には弱く、
   カラカラで薄っぺらい相手にはめっぽう強い。
   スタミナを 25% 使って周りを焼き、地形を「乾いた床」に反転できる。
   焼いた床は日を跨いでも残り、世代が組み替わる(ループ)まで消えない。
   ただし巣窟や澱みで焼くと、媚薬が蒸発して外まで広がる——通常より強い。彼女はそれを学ぶ */
function dryKey(){ return 'g'+((META.gen&&META.gen.idx)||1)+'f'+((META.run&&META.run.floor)||1); }
function dryList(){ META.dry=META.dry||{}; const k=dryKey(); return (META.dry[k]=META.dry[k]||[]); }
function dryClearAll(){ META.dry={}; }   // ループ(世代の組み替え)で焼き跡も消える
/* v5.0 焼けた床はタイル単位で持つ(G.map.dryT)。マップチップそのものが焦げるので、どこを焼いたか一目で分かる。
   META には焼けたタイルの番号だけを残すので、日を跨いでも同じ形で戻る */
function dryInit(){
  const M=G.map; if(!M) return;
  M.dryT=new Uint8Array(MAP_W*MAP_H);
  const L=dryList(); for(const k of L){ if(k>=0&&k<M.dryT.length) M.dryT[k]=255; }
}
function dryAt(x,y){
  const M=G.map; if(!M||!M.dryT) return 0;
  const i=tileI(x), j=tileJ(y); if(!inMap(i,j)) return 0;
  return M.dryT[j*MAP_W+i]/255;
}
/* 焼き付ける: 中心から半径 r のタイルを焦がす。塗れた所だけチャンクを焼き直す */
function dryPaint(x,y,r){
  const M=G.map; if(!M||!M.dryT) return 0;
  const L=dryList(), cap=BAL.DRY_MAX;
  const i0=tileI(x-r), i1=tileI(x+r), j0=tileJ(y-r), j1=tileJ(y+r);
  let n=0; const dirty=new Set();   /* v5.0 chunkKey は数値。オブジェクトの添字にすると文字列化して Map.delete が空振りする */
  for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){
    if(!inMap(i,j)) continue;
    const k=j*MAP_W+i; if(M.dryT[k]) continue;
    if(Math.hypot(tileCX(i)-x, tileCY(j)-y)>r) continue;
    if(solidIJ(i,j)) continue;   /* v5.0 壁は焼かない */
    if(M.iceT && M.iceT[k]){ M.iceT[k]=0; M.iceN=Math.max(0,(M.iceN||0)-1); }   /* v5.0 炎は氷を溶かす(道に穴が空く。台帳は iceSave が整理する) */
    M.dryT[k]=255; n++;
    if(L.length<cap) L.push(k);
    dirty.add(chunkKey(Math.floor(i/CHUNK),Math.floor(j/CHUNK)));
  }
  if(n){ for(const ck of dirty) M.chunks.delete(ck); M.mini=null; }
  return n;
}
/* その場の湿り気(0 乾いている 〜 1 濡れきっている)。焼いた床は湿り気を消す */
function wetAt(x,y){
  const z=zoneAt(x,y), w=(typeof ZONE_WET!=='undefined'&&ZONE_WET[z]!==undefined)?ZONE_WET[z]:0.2;
  const m=mireAt(x,y);
  return Math.max(0, Math.max(w, m?0.9:0)*(1-dryAt(x,y)));
}
/* フレイラの与ダメ倍率: 足元の湿り気 × 相手の質 */
function freilaDmgMul(e){
  const B=G.B, p=B.hero; if(!p||p.id!=='freila') return 1;
  const w=wetAt(p.x,p.y), dry=dryAt(p.x,p.y);
  let m=1+(BAL.WET_ATK-1)*w+(BAL.DRY_ATK-1)*dry*(1-w);
  const q=(typeof MON_WET!=='undefined'&&e&&MON_WET[e.id])||0;
  m*= q>0 ? (1-FREILA_WET_K*q) : (1+FREILA_DRY_K*(-q));   // ヌルヌルには弱く、カラカラにはめっぽう強い
  const ew=wetAt(e?e.x:p.x, e?e.y:p.y); if(ew>0.7) m*=0.94;   // 相手が水に浸かっていれば、もう少し通らない
  return m;
}
/* フレイラの被ダメ倍率: 濡れていると火の護りが薄い */
function freilaDefMul(p){
  if(!p||p.id!=='freila') return 1;
  const w=wetAt(p.x,p.y), dry=dryAt(p.x,p.y);
  return 1+(BAL.WET_DEF-1)*w+(BAL.DRY_DEF-1)*dry*(1-w);
}
/* 焼いた床の上のヌルヌル系は弱る(HPと速度) */
function dryMonMul(e){
  if(!e) return null; const q=(typeof MON_WET!=='undefined'&&MON_WET[e.id])||0; if(q<=0.3) return null;
  const d=dryAt(e.x,e.y); if(d<=0.05) return null;
  return {hp:1-(1-BAL.DRY_SLIME_HP)*d*q, spd:1-(1-BAL.DRY_SLIME_SPD)*d*q};
}
/* 周りの濡れ具合(乾かす気になるか) */
function wetAround(p){
  let s=0, n=0;
  for(let i=0;i<8;i++){ const a=i*TAU/8; for(const r of [70,170]){ s+=wetAt(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r); n++; } }
  return n?s/n:0;
}
/* v5.0 焼く: 炎のエリアを自分の周りに展開し、歩いた跡を乾かしていく。
   効果時間は使ったスタミナの割合で決まる(25%なら14秒)。焼けた床は日を跨いでも残る */
function freilaDry(p){
  const B=G.B;
  const want=p.staminaMax*BAL.DRY_STAM;
  const use=Math.min(want, Math.max(0, p.stamina-p.staminaMax*BAL.DRY_STAM_RES));   /* v5.0 残っている分だけ注ぎ込む: 元気なほど長く燃える */
  if(use<p.staminaMax*0.08) return false;
  p.stamina-=use; p.dryCd=B.time+BAL.DRY_CD;
  const dur=BAL.DRY_DUR_K*(use/p.staminaMax);
  B.dryAura={hi:p.hi, t:0, dur, r:BAL.DRY_AURA_R, paint:0, tiles:0};
  B.fx.push({kind:'dryburst', x:p.x, y:p.y, r:BAL.DRY_AURA_R, t:0, life:0.9});
  for(let i=0;i<24;i++){ const a=rand(TAU), rr=rand(BAL.DRY_AURA_R); parts(p.x+Math.cos(a)*rr, p.y+Math.sin(a)*rr, 1, ['#ff7a3a','#ffd76a','#ffb060'], 120, 0.7); }
  G.shake=Math.min(9,G.shake+4); sfx(220,700,0.5,'sawtooth',0.07);
  floatTxt(p.x,p.y-56,'——炎のエリア '+dur.toFixed(0)+'秒','#ffb060',13,1.6);
  setBanner('炎のエリア','フレイラの周りが乾く。歩いた跡が、そのまま彼女の土俵になる','#ffb060');
  const ci0=B.ci; B.ci=p.hi; sayLine('feat.dry',2,0,'……この床、乾かす'); B.ci=ci0;
  B.nDry=(B.nDry||0)+1;
  return true;
}
/* オーラの毎フレーム: 足元を焼き広げ、触れた媚薬沼と巣窟を蒸発させる */
function dryAuraTick(dt){
  const B=G.B, A=B.dryAura; if(!A) return;
  const p=B.heroes[A.hi];
  if(!p||p.out){ B.dryAura=null; return; }
  A.t+=dt;
  if(A.t>=A.dur){ B.dryAura=null; floatTxt(p.x,p.y-56,'炎が鎮まった','#c89050',11,1.2); return; }
  A.paint-=dt;
  if(A.paint<=0){
    A.paint=BAL.DRY_PAINT_CD;
    A.tiles+=dryPaint(p.x,p.y,A.r);
    if(Math.random()<0.5){ const a=rand(TAU), rr=rand(A.r*0.5,A.r); parts(p.x+Math.cos(a)*rr,p.y+Math.sin(a)*rr,1,['#ff7a3a','#ffb060'],70,0.6); }
    pushLight(p.x,p.y,A.r*1.1,BAL.DARK_MEM_T*0.7,0.9);
    /* 触れた沼は蒸発する。ただし一度こぼした後は、触れる前に自分で炎を落とす——
       v5.8 焚く判断と足の向きを直しても、追い詰められれば沼のそばに立たされる。
       その最後の一線で、彼女は残りの効果時間を捨てる。学習が必ず効く形にした */
    if(B.mires) for(const m of B.mires){
      if(m.dry||m.iced) continue;
      if(Math.hypot(p.x-m.x,p.y-m.y)>=A.r+m.r) continue;
      if((META.gen.dryLesson|0)>0){
        B.dryAura=null; p.dryCd=B.time+BAL.DRY_CD*0.5;
        floatTxt(p.x,p.y-56,'炎を落とした','#c89050',11,1.4);
        for(let i=0;i<10;i++){ const a=rand(TAU), rr=rand(A.r*0.6); parts(p.x+Math.cos(a)*rr,p.y+Math.sin(a)*rr,1,['#7a5a44','#c89050'],60,0.6); }
        const ci0=B.ci; B.ci=p.hi; sayLine('feat.dryDrop',2,10,'……沼だ。消す'); B.ci=ci0;
        return;
      }
      mireEvaporate(m);
    }
    if(!A.evap && dryEvapCheck(p,{x:p.x,y:p.y,r:A.r})) A.evap=true;   /* v5.0 巣窟・澱みに掛かっていれば、そこも蒸発。一つのエリアにつき一度だけ */
  }
}
/* 焼いた円が巣窟か澱みに掛かっていたら、媚薬が蒸発して外へ噴き出す(通常より強い) */
function dryEvapCheck(p,d){
  const B=G.B;
  if(B.time-(B.evapT||-99)<BAL.DRY_EVAP_CD) return false;   /* v5.0 続けざまには噴かない */
  let hit=false;
  for(let i=0;i<12&&!hit;i++){ const a=i*TAU/12; for(const rr of [0, d.r*0.5, d.r*0.9]){ const z=zoneAt(d.x+Math.cos(a)*rr, d.y+Math.sin(a)*rr); if(z==='lewd'||z==='haze'){ hit=true; break; } } }
  if(!hit) return false;
  B.evapT=B.time;
  setBanner('媚薬が蒸発した','熱で膨らんだ甘い霧が、褥の外まで噴き出す','#ff5d9a');
  B.fx.push({kind:'evap', x:d.x, y:d.y, r:BAL.DRY_EVAP_R, t:0, life:1.4});
  G.shake=Math.min(12,G.shake+6); sfx(300,120,0.9,'sine',0.09);
  for(let i=0;i<BAL.DRY_EVAP_N;i++){
    const a=i*TAU/BAL.DRY_EVAP_N+rand(0.4), rr=BAL.DRY_EVAP_R*(0.35+0.6*(i%2?0.6:1));
    const q=snapFloor(d.x+Math.cos(a)*rr, d.y+Math.sin(a)*rr, false, 3)||{x:d.x+Math.cos(a)*rr, y:d.y+Math.sin(a)*rr};
    spawnCloud(q.x, q.y, 190, BAL.DRY_EVAP_LIFE, BAL.SENSIT_GAS*BAL.DRY_EVAP_RATE, 'gas');
  }
  spawnCloud(d.x, d.y, 240, BAL.DRY_EVAP_LIFE, BAL.SENSIT_GAS*BAL.DRY_EVAP_RATE, 'gas');
  for(const h of B.heroes){
    if(h.out) continue;
    if(Math.hypot(h.x-d.x,h.y-d.y)>BAL.DRY_EVAP_R) continue;
    evapBreathe(h, d.x, d.y, BAL.DRY_EVAP_HEAT, 7);
  }
  // これも学習する: 次からは巣窟や澱みの近くで焼かない
  META.gen.dryLesson=(META.gen.dryLesson|0)+1; saveMeta();
  return true;
}
/* ================= v5.0 クウの氷の道 =================
   フレイラの「炎のエリア」と対になる地形の奥義。任意の方向へ一直線に床を凍らせる。
   氷の上では味方の足が速く(ただし曲がりきれない)、地形のデバフが一切効かない。
   魔物は鈍り、凍傷を負い、脆くなる。凍らせた床はループ(世代の組み替え)まで残る */
function iceKey(){ return 'g'+((META.gen&&META.gen.idx)||1)+'f'+((META.run&&META.run.floor)||1); }
function iceList(){ META.ice=META.ice||{}; const k=iceKey(); return (META.ice[k]=META.ice[k]||[]); }
function iceClearAll(){ META.ice={}; }   // ループで氷も溶ける
/* 戦闘の終わりに一度だけ、実際に残っている氷タイルへ台帳を書き直す(炎に溶かされた分を落とす) */
function iceSave(){
  const M=G.map; if(!M||!M.iceT) return;
  const out=[];
  for(let k=0;k<M.iceT.length && out.length<BAL.ICE_MAX;k++) if(M.iceT[k]) out.push(k);
  META.ice=META.ice||{}; META.ice[iceKey()]=out;
}
function iceInit(){
  const M=G.map; if(!M) return;
  M.iceT=new Uint8Array(MAP_W*MAP_H); M.iceN=0;
  for(const k of iceList()){ if(k>=0&&k<M.iceT.length && !M.iceT[k]){ M.iceT[k]=255; M.iceN++; } }
}
function iceAt(x,y){
  const M=G.map; if(!M||!M.iceT) return 0;
  const i=tileI(x), j=tileJ(y); if(!inMap(i,j)) return 0;
  return M.iceT[j*MAP_W+i]/255;
}
function onIce(h){ return (h.iceOn||0)>0; }   // 半歩の踏み外しで点滅しないよう 0.25秒のラッチ(condTick)
/* 氷を一枚塗る。焦げを打ち消し、チャンクを焼き直させる */
function iceSetTile(k,dirty){
  const M=G.map;
  if(M.iceT[k]) return false;
  M.iceT[k]=255; M.iceN=(M.iceN||0)+1;
  if(M.dryT && M.dryT[k]) M.dryT[k]=0;   // 焦げた床を氷が上書きする
  const L=iceList(); if(L.length<BAL.ICE_MAX) L.push(k);
  const i=k%MAP_W, j=(k/MAP_W)|0;
  dirty.add(chunkKey(Math.floor(i/CHUNK),Math.floor(j/CHUNK)));
  return true;
}
function iceFlush(dirty){ const M=G.map; if(!dirty.size) return; for(const ck of dirty) M.chunks.delete(ck); M.mini=null; }   // 地形チップとミニマップを焼き直す(毎フレームは走らせない)
/* 線を凍らせる。壁で止まり、壁は塗らない。触れた魔物と沼を返す */
function icePaintLine(x0,y0,ux,uy,len,halfW){
  const M=G.map, B=G.B; if(!M||!M.iceT) return null;
  let L=0;
  for(let t=12;t<=len;t+=12){ const x=x0+ux*t, y=y0+uy*t; if(!passAt(x,y,false)) break; L=t; }
  if(L<120) return null;
  const ex=x0+ux*L, ey=y0+uy*L;
  const dirty=new Set(); let n=0;
  const i0=tileI(Math.min(x0,ex)-halfW), i1=tileI(Math.max(x0,ex)+halfW);
  const j0=tileJ(Math.min(y0,ey)-halfW), j1=tileJ(Math.max(y0,ey)+halfW);
  const springs=(G.map.pois||[]).filter(q=>q.kind==='spring');
  for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){
    if(!inMap(i,j)||solidIJ(i,j)) continue;
    const cx=tileCX(i), cy=tileCY(j);
    if(segDist(cx,cy,x0,y0,ex,ey)>halfW) continue;
    if(springs.some(q=>Math.hypot(q.x-cx,q.y-cy)<120)) continue;   // 泉の上は凍らせない(仲間の回復を止めない)
    if(iceSetTile(j*MAP_W+i,dirty)) n++;
  }
  iceFlush(dirty);
  const hits=[]; for(const e of B.enemies){ if(e.dead||e.dormant||e.item) continue;
    if(segDist(e.x,e.y,x0,y0,ex,ey)<halfW+e.r) hits.push(e); }
  const mires=[]; if(B.mires) for(const m of B.mires){ if(m.dry||m.iced) continue;
    if(segDist(m.x,m.y,x0,y0,ex,ey)<halfW+m.r*0.35){ m.iced=true; mires.push(m); if(typeof mireClear==='function') mireClear(m); } }   /* v5.8 凍った液面はチップからも消える(氷の道が上書きする) */
  return {len:L, ex, ey, tiles:n, hits, mires};
}
function icePaintDisc(x,y,r){
  const M=G.map; if(!M||!M.iceT) return 0;
  const dirty=new Set(); let n=0;
  const i0=tileI(x-r), i1=tileI(x+r), j0=tileJ(y-r), j1=tileJ(y+r);
  for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){
    if(!inMap(i,j)||solidIJ(i,j)) continue;
    if(Math.hypot(tileCX(i)-x,tileCY(j)-y)>r) continue;
    if(iceSetTile(j*MAP_W+i,dirty)) n++;
  }
  iceFlush(dirty); return n;
}
/* 凍結を入れる。重ね掛けでハメにならないよう、直近 ICE_FROZ_WIN 秒の合計に上限を置く */
function freezeEnemy(e,sec){
  const B=G.B; if(!e||e.dead) return;
  if(MONSTERS[e.id]&&MONSTERS[e.id].boss) sec=Math.min(sec,1.2);
  if(B.time<(e.frozRest||0)) return;
  if(B.time-(e.frozWinT||-99)>BAL.ICE_FROZ_WIN){ e.frozWinT=B.time; e.frozBudget=0; }
  e.frozBudget=(e.frozBudget||0)+sec;
  if(e.frozBudget>BAL.ICE_FROZ_BUDGET){ e.frozRest=B.time+BAL.ICE_FROZ_REST; e.frozBudget=0; }
  e.frozT=Math.max(e.frozT||0,sec);
  e.chillT=Math.max(e.chillT||0,sec+1.5);
}
/* 方角を決める: 濡れた地形・沼・敵の数・皆の行き先を見て、フレイラの居る方は避ける */
function icePick(p){
  const B=G.B, DIRS=12, STEP=110, N=Math.ceil(BAL.ICE_LEN/STEP);
  const cand=[]; for(const e of B.enemies){ if(e.dead||e.dormant||e.item||e.id==='imp') continue;
    if(Math.hypot(e.x-p.x,e.y-p.y)<BAL.ICE_LEN+90) cand.push(e); }
  const fre=B.heroes.find(h=>(HEROES[h.id]||{}).hot&&!h.out);
  const lead=B.heroes[leaderIdx()];
  const goal=(lead&&lead.goal)||p.goal;
  let best=null;
  for(let k=0;k<DIRS;k++){
    const a=k*TAU/DIRS+(p.hypeT>0?rand(-0.42,0.42):0);   // 調子に乗っている間は方角が雑になる
    const ux=Math.cos(a), uy=Math.sin(a)*0.9;
    let sc=0, len=0;
    for(let s=1;s<=N;s++){
      const x=p.x+ux*STEP*s, y=p.y+uy*STEP*s;
      if(!passAt(x,y,false)) break;
      len=STEP*s;
      const z=zoneAt(x,y);
      if(z==='lewd'||z==='haze') sc+=1.8;
      else if(z==='flower'||z==='flesh'||z==='hotspring') sc+=1.1;
      else if(z==='water'||z==='damp') sc+=0.9;
      if(iceAt(x,y)>0.5) sc-=0.7;
      if(dryAt(x,y)>0.5) sc+=0.5;
      if(mireAt(x,y)) sc+=2.2;
      let n=0; for(const e of cand){ if(Math.hypot(e.x-x,e.y-y)<BAL.ICE_W+40){ n++; if(n>=8) break; } }
      sc+=n*0.55;
      if(fre && Math.hypot(x-fre.x,y-fre.y)<150) sc-=3.0;   // 熱い相方の方へは引かない
    }
    if(len<260) sc-=4.0;
    if(goal){ const gx=goal.x-p.x, gy=goal.y-p.y, gd=Math.hypot(gx,gy)||1;
      const dot=(gx/gd)*ux+(gy/gd)*uy; if(dot>0.5) sc+=1.4*dot; }
    if(p.iceBias && B.time<p.iceBias.t){ const gx=p.iceBias.x-p.x, gy=p.iceBias.y-p.y, gd=Math.hypot(gx,gy)||1;
      const dot=(gx/gd)*ux+(gy/gd)*uy; if(dot>0.5) sc+=2.5*dot; }   // 譲った提案の方へ、黙って道を伸ばす
    if(!best||sc>best.sc) best={a,sc,len};
  }
  return best;
}
/* 発動 */
function kuuIce(p,ang){
  const B=G.B;
  const use=p.staminaMax*BAL.ICE_STAM;
  if(p.stamina<use+p.staminaMax*0.04) return false;
  const ux=Math.cos(ang), uy=Math.sin(ang)*0.9;
  const R=icePaintLine(p.x,p.y,ux,uy,BAL.ICE_LEN,BAL.ICE_W);
  if(!R){ p.iceCd=B.time+1.5; return false; }   // 壁に阻まれた: すぐ引き直せる
  p.stamina-=use; p.iceCd=B.time+BAL.ICE_CD*(p.hypeT>0?BAL.ICE_HYPE_CD:1);
  const ci0=B.ci; B.ci=p.hi;
  for(const e of R.hits){
    freezeEnemy(e,BAL.ICE_HIT_FREEZE);
    damageEnemy(e,BAL.ICE_HIT_DMG*(1+0.05*p.level));
    B.fx.push({kind:'iceshatter', x:e.x, y:e.y-e.r*0.5, r:e.r+12, t:0, life:0.5});
  }
  B.fx.push({kind:'icepath', x:p.x, y:p.y, ang, len:R.len, w:BAL.ICE_W, t:0, life:1.1});
  for(let s=1;s*220<R.len;s++) pushLight(p.x+ux*220*s, p.y+uy*220*s, 190, BAL.DARK_MEM_T*1.4, 0.8);
  p.face=ux>=0?1:-1;
  for(let i=0;i<20;i++){ const t=rand(R.len); parts(p.x+ux*t,p.y+uy*t,1,['#bfeaff','#fff','#7fe8dd'],90,0.6); }
  G.shake=Math.min(7,G.shake+3); sfx(900,240,0.45,'triangle',0.06);
  floatTxt(p.x,p.y-56,'——氷の道','#bfeaff',13,1.5);
  setBanner('氷の道','クウの引いた線の上だけ、深淵が効かない','#bfeaff');
  sayLine('feat.ice',2,0,'……道、ひく');
  if(R.mires.length) sayLine('feat.mireIced',1,6,'ぬま、とじた');
  B.ci=ci0;
  B.nIce=(B.nIce||0)+1;
  if((M_iceFull(p))) { /* 上限に達した */ }
  if(R.hits.length>=3 || R.mires.length>0) icePraise(p, R.mires.length?'mire':'freeze');
  return true;
}
function M_iceFull(p){
  const M=G.map; if(!M) return false;
  if(iceList().length<BAL.ICE_MAX || p.iceFullSaid) return false;
  p.iceFullSaid=1; floatTxt(p.x,p.y-44,'……もう、凍らない','#9fc8dd',11,1.4); return true;
}
/* 褒められて調子に乗る */
function icePraise(p,why){
  const B=G.B;
  if((B.iceHypeN||0)>=BAL.ICE_HYPE_N) return;
  if(B.time-(B.icePraiseT||-99)<BAL.ICE_PRAISE_CD) return;
  const L=B.heroes.find(h=>h.id==='lumina'&&!h.out);
  if(!L || Math.hypot(L.x-p.x,L.y-p.y)>BAL.ICE_PRAISE_R) return;   // 見ていなければ褒められない
  B.icePraiseT=B.time; B.iceHypeN=(B.iceHypeN||0)+1;
  sayPartyAs(L.hi,'praise.ice',2,0);
  pendingLine(p.hi,'praise.reply',1.1,2);
  p.hype=1; p.hypeT=BAL.ICE_HYPE_T;
  floatTxt(p.x,p.y-58,'……ふふん','#bfeaff',12,1.5);
  parts(p.x,p.y-14,10,['#bfeaff','#fff'],80,0.6);
}
/* フレイラ(熱い相方)・炎のエリア・焦げた床・温泉のそばの「暑さ」 */
function kuuHeatAt(x,y){
  const B=G.B; let v=0;
  const F=B.heroes.find(h=>(HEROES[h.id]||{}).hot&&!h.out);
  if(F){ const d=Math.hypot(x-F.x,y-F.y); if(d<BAL.KUU_MELT_R) v=Math.max(v,1-d/BAL.KUU_MELT_R); }
  if(B.dryAura){ const O=B.heroes[B.dryAura.hi]; if(O && Math.hypot(x-O.x,y-O.y)<B.dryAura.r) v=1; }
  v=Math.max(v, dryAt(x,y)*0.55);
  const z=zoneAt(x,y); if(z==='hotspring') v=Math.max(v,0.7); else if(z==='flesh') v=Math.max(v,0.25);
  for(const z2 of B.zones){ if(!z2.fire) continue; const d=Math.hypot(x-z2.x,y-z2.y);
    if(d<z2.r*1.3) v=Math.max(v,(1-d/(z2.r*1.3))*0.8); }
  return Math.min(1,v);
}
/* 溶ける: 熱いところに居続けると、発情が溜まり、氷が回らなくなる */
function meltTick(p,dt){
  const B=G.B, h=kuuHeatAt(p.x,p.y);
  if(h>0.75) p.meltT=(p.meltT||0)+dt; else p.meltT=Math.max(0,(p.meltT||0)-dt*1.5);
  if(p.meltT>=BAL.KUU_MELT_T){
    addHeatG(BAL.KUU_MELT_HEAT*dt);
    p.iceCd=Math.max(p.iceCd||0, B.time+0.6);
    if(B.time-(p.meltSaid||-99)>12){ p.meltSaid=B.time;
      sayLine('feat.melt',1,0,'……あつい。はなれて');
      floatTxt(p.x,p.y-52,'……あつい','#bfe9ff',11,1.2); }
    if(Math.random()<dt*6) parts(p.x+rand(-10,10),p.y-rand(0,26),1,['#cfeeff','#ffffff'],26,0.5);
  }
}
/* 引く判断 */
function iceTick(p,dt){
  const B=G.B;
  if(p.hypeT>0){ p.hypeT-=dt; if(p.hypeT<=0){ p.hype=0;
    if(p.stamina<p.staminaMax*0.25) sayLine('feat.iceTired',2,0,'……ちょっと、やりすぎた'); } }
  meltTick(p,dt);
  if(nearEnemyCount(p.x,p.y,300,false)>0){
    if(onIce(p)) sayLine('feat.iceGood',0,40,'……ここなら、効かない');
    else if(kuuHeatAt(p.x,p.y)>0.6) sayLine('feat.melt',0,40,'……あつい。とける');
  }
  if(B.time<(p.iceCd||0)) return;
  if(p.stamina<p.staminaMax*(p.hypeT>0?0.12:BAL.ICE_STAM_MIN)) return;
  if(p.exhausted) return;
  if(attachCount(p)>0||p.pinned||p.charmBind||p.climaxT>0||p.hypnoLv>=2) return;
  if(B.dryAura){ const F=B.heroes[B.dryAura.hi];
    if(F && Math.hypot(p.x-F.x,p.y-F.y)<BAL.DRY_AURA_R*1.1){ sayLine('feat.iceNo',0,30,'……そこ、あついから。むり'); return; } }
  const b=icePick(p); if(!b) return;
  const want=p.hypeT>0?BAL.ICE_HYPE_WANT:BAL.ICE_WANT;
  if(b.sc<want && nearEnemyCount(p.x,p.y,240,false)<3) return;
  kuuIce(p,b.a);
}
/* 焼く判断(フレイラのAI): 濡れた所で戦っていて、スタミナに余裕があり、巣窟の近くでなければ */
function dryTick(p,dt){
  const B=G.B;
  if(p.id!=='freila'||p.out) return;
  if(nearEnemyCount(p.x,p.y,260,false)>0){   // 足元の質を口に出す(火が立つか、立たないか)
    if(wetAt(p.x,p.y)>0.7) sayLine('feat.wet',0,40,'濡れている。火が立たない');
    else if(dryAt(p.x,p.y)>0.5) sayLine('feat.dryGood',0,40,'乾いた。ここなら通る');
  }
  if(B.dryAura) return;   // 展開中はそのまま歩いて塗り広げる
  if(B.time<(p.dryCd||0)) return;
  if(p.stamina<p.staminaMax*BAL.DRY_STAM_MIN||p.exhausted) return;
  if(attachCount(p)>0||p.pinned||p.charmBind||p.climaxT>0||p.hypnoLv>=2) return;
  if(dryAt(p.x,p.y)>0.35) return;                       // もう乾かした所
  if(wetAround(p)<BAL.DRY_WANT_WET) return;             // 乾いているなら要らない
  const lesson=(META.gen.dryLesson|0)>0;                // 一度こぼしたら、褥のそばでは焼かない
  const L=denOf();
  if(L && lesson && Math.hypot(p.x-L.x,p.y-L.y)<Math.max(L.rx,L.ry)+BAL.DRY_EVAP_R*0.5) return;
  const z=zoneAt(p.x,p.y); if(lesson && (z==='lewd'||z==='haze')) return;
  /* v5.8 沼のそばでは焚かない。
     v5.0 の判定は「今いる場所から 炎の半径+沼の半径」だけを見ていた。
     炎のエリアは展開したあとも十数秒ついて回るので、少し離れた所で焚いて、
     そのまま歩いて沼を蒸発させる——という抜け道が残っていた。
     焚く前に広く見て、進んでいく先も一緒に見る。一度こぼしていれば、その距離をさらに広げる。 */
  if(B.mires && B.mires.length){
    const keep=lesson?BAL.DRY_MIRE_LEARN:BAL.DRY_MIRE_KEEP;
    const ax=p.x+(p.vx||0)*3.0, ay=p.y+(p.vy||0)*3.0;   /* 三秒ぶん先も見る */
    for(const m of B.mires){
      if(m.dry||m.iced) continue;
      const R=(BAL.DRY_AURA_R+m.r)*keep;
      if(Math.hypot(p.x-m.x,p.y-m.y)<R || Math.hypot(ax-m.x,ay-m.y)<R){
        if(lesson){ const ci0=B.ci; B.ci=p.hi; sayLine('feat.dryNoMire',0,26,'……沼がある。ここでは焚かない'); B.ci=ci0; }
        return;
      }
    }
  }
  if(nearEnemyCount(p.x,p.y,300,false)<2 && p.hp>p.maxHp*0.8) return;   // 戦う理由がある時に使う
  freilaDry(p);
}
/* ================= v4.0 カバーAI =================
   「発情しきって囲まれている相方を無視して探索する」をやめさせる。
   相方の調子の悪さ(拘束・押し倒し・絶頂・催眠・発情・敏感・遅さ・体力・囲まれ)を一つの数にして、
   自分よりはっきり悪ければ、寄って、群がっている魔物を先に撃つ */
function distressOf(h){
  if(!h||h.out) return 0;
  let v=0;
  v+=attachCount(h)*0.55;
  if(h.pinned) v+=1.7;
  if(h.charmBind) v+=1.0;
  if(h.climaxT>0) v+=1.2;
  v+=(h.hypnoLv||0)*0.35;
  v+=(h.heatLv||0)*0.30;
  v+=Math.max(0,(h.aphro||0)-55)/45*0.7;
  v+=Math.max(0,(h.sensit||0)-60)/40*0.4;
  if(h.slow>0) v+=0.3;
  if(h.exhausted) v+=0.35;
  v+=Math.max(0,(1-h.hp/h.maxHp)-0.45)/0.55*0.9;
  v+=Math.min(1,nearEnemyCount(h.x,h.y,BAL.COVER_ENEMY_R,false)/BAL.COVER_ENEMY_N)*0.8;
  return v;
}
/* いま相方をカバーすべきか(入ったら COVER_HOLD 秒は続ける) */
function coverTarget(p){
  const B=G.B;
  if(attachCount(p)>0||p.pinned||p.charmBind||p.climaxT>0) return null;   // 自分が動けないなら無理
  const my=distressOf(p), HD=HEROES[p.id]||{};
  let o=null, th=0;   // v5.0 三人以上: いちばん調子の悪い仲間を選ぶ(素性の follow 相手には少し早く飛ぶ)
  for(const h of B.heroes){
    if(h===p||h.out||h.captive) continue;   // 捕まっているなら救出(rescue)の担当
    let w=distressOf(h);
    if(HD.follow) w*=(h.id===HD.follow)?1.25:0.85;
    if(w>th){ th=w; o=h; }
  }
  if(!o) return null;
  /* v5.2 かばい合いを断つ。coverUntil のラッチは両側で立ちうるので、そうなると
     互いを目標にして寄り、PARTY_SEP に押し戻され、その場で回り続ける。
     助けが要るのは調子の悪い方なので、悪い方がかばうのをやめる */
  if(o.coverOf===p.hi && my>=distressOf(o)){ p.coverUntil=0; p.coverOf=-1; return null; }
  if(p.coverUntil>B.time && th>=BAL.COVER_TH*0.7){ p.coverOf=o.hi; return o; }    // ちらつかせない
  if(th>=BAL.COVER_TH && th>my+BAL.COVER_MARGIN){ p.coverUntil=B.time+BAL.COVER_HOLD; p.coverOf=o.hi; return o; }
  p.coverOf=-1;
  return null;
}
/* ================= v4.0 魔核戦の専念 =================
   魔核の間に踏み込んだら、彼女はもう魔核から離れない。離れてよいのは、
   体力とスタミナを取り戻す用(ハート・燭台・泉・清水・蜜の花)と、仲間の救出だけ。
   戦い方も変わる: 体力があるうちは引き撃ちも逃げも選ばず、狙いは魔核そのものへ向く */
function coreUnit(){ const B=G.B; if(!B||!B.floor||!B.floor.final) return null; for(const e of B.enemies){ if(e.id==='core'&&!e.dead) return e; } return null; }
function coreWarTick(dt){
  const B=G.B; if(!B) return;
  const C=coreUnit(); B.core=C;
  if(!C){ B.coreWar=false; return; }
  if(B.coreWar) return;
  let go=C.hp<C.maxHp*0.999;   // 一発でも入れたら、もう始まっている
  if(!go) for(const h of B.heroes){ if(!h.out && Math.hypot(h.x-C.x,h.y-C.y)<BAL.CORE_WAR_R){ go=true; break; } }
  if(!go) return;
  B.coreWar=true;
  for(const h of B.heroes){ h.goal=null; h.goalT=0; h.explore=null; h.exploreUntil=0; }
  setBanner('魔核戦','ここから離れない——削り切るまで','#ff6b81');
  const li=leaderIdx();
  { const c0=B.ci; B.ci=li; sayLine('feat.coreWar',2,0,'……にげない。ここで、おわらせる'); B.ci=c0; }
  for(const h of B.heroes){ if(h.out||h.hi===li) continue; pendingLine(h.hi,'feat.coreWar',1.2,2); }
}
/* 魔核戦の間、その位置まで足を伸ばしてよいか(回復の用と救出は例外) */
function coreLeashOk(kind,sub,x,y){
  const B=G.B; if(!B.coreWar||!B.core) return true;
  if(kind==='rescue'||kind==='wait'||kind==='gather'||kind==='cover') return true;
  if(kind==='poi'&&(sub==='core'||sub==='spring'||sub==='pool')) return true;
  if(kind==='pick'&&sub==='nectar') return true;
  if(kind==='event'&&sub==='pool') return true;
  const d=Math.hypot(x-B.core.x,y-B.core.y);
  /* v5.2 用のあるもの(体力・スタミナを取り戻す品)だけ、綱いっぱいまで許す。
     宝箱やジェムのような「後でいい」ものは、心臓のそばにある時しか目当てにしない——
     引き寄せだけ強くしても、目当てが遠ければ綱の先で行ったり来たりするだけになる */
  const need=(kind==='heart')||(kind==='prop')||(kind==='item')
           ||(kind==='pick'&&(sub==='shroom'||sub==='family'))
           ||(kind==='poi'&&sub==='shrine');
  return d < (need?BAL.CORE_LEASH:BAL.CORE_NEAR);
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
/* v6.3 その階の巣窟の効き。浅い階ほど弱い(1階=0.42 … 15階=1.22)。
   ★これが無いと、どの階の巣窟も同じ強さで殴ってくる */
function denPower(){
  const F=(G.B&&G.B.floor)||curFloor(); const d=(F&&F.depth)||1;
  return Math.min(BAL.DEN_POW_MAX, BAL.DEN_POW0+BAL.DEN_POW_K*(d-1));
}
/* v6.3b 最奥へ踏み込んだ一撃の倍率。浅い階でも重い(奥はどの階でも奥) */
function denDeepPower(){
  const F=(G.B&&G.B.floor)||curFloor(); const d=(F&&F.depth)||1;
  return Math.min(BAL.DEN_POW_MAX, BAL.DEN_DEEP0+BAL.DEN_DEEP_K*(d-1));
}
/* v6.3b 一撃のほうの倍率(敷居をまたいだ瞬間・番人の太さ)。積もりより浅い階で軽い */
function denBurstPower(){
  const F=(G.B&&G.B.floor)||curFloor(); const d=(F&&F.depth)||1;
  return Math.min(BAL.DEN_POW_MAX, BAL.DEN_BURST0+BAL.DEN_BURST_K*(d-1));
}
/* v6.3 その階の巣窟の床の手の多さ(FLOORS[].lewd.mix.grip) */
function denGrip(){ const L=denOf(); return (L&&L.grip!==undefined)?L.grip:1; }
/* 敷居をまたいだ瞬間: 匂いに殴られる */
function denEnterBurst(h){
  const B=G.B, ci0=B.ci, pw=denBurstPower(); B.ci=h.hi;   /* 一撃は別の倍率で */
  addHeatG(BAL.DEN_ENTER_HEAT*pw); applySensit(BAL.DEN_ENTER_SENS*pw);
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
  // v4.0 常設の宝箱を3つに: 沼のあたり・喉道寄り・奥の脇。高リスクだがハイリターン
  { const spots=[[0.35,0.45],[-0.10,-0.42],[0.62,-0.30]];
    for(let k=0;k<Math.min(BAL.DEN_CHESTS,spots.length);k++){ const q=at(L.x+(L.deep.x-L.x)*spots[k][0], L.y+L.ry*spots[k][1]); B.chests.push({x:q.x,y:q.y,t:0,taken:false,known:false,lewd:true}); } }
  // v4.0 赤ジェム: 黄より強い。奥ほど濃くまばらに散らす
  for(let k=0;k<BAL.DEN_REDGEM;k++){
    const u=(k+0.5)/BAL.DEN_REDGEM, a=u*TAU*1.6+0.7, rr=0.30+0.60*u;
    const q=at(L.x+(L.deep.x-L.x)*rr+Math.cos(a)*L.rx*0.22, L.y+Math.sin(a)*L.ry*0.55, 3);
    dropGem(q.x,q.y,BAL.DEN_REDGEM_V);
  }
  { const q=at(L.x-(L.deep.x-L.x)*0.2, L.y-L.ry*0.5); spawnPick('treasure',q.x,q.y,false); }
  { const q=at(L.x+L.rx*0.1, L.y+L.ry*0.72); spawnPick('nectar',q.x,q.y,false); const q2=at(L.x-L.rx*0.15,L.y-L.ry*0.75); spawnPick('nectar',q2.x,q2.y,false); }
  /* v6.3 その巣窟に住み着いている顔ぶれ。階ごとに違う一種を、輪の中に据える。
     絵も図鑑も敗北本文も既にある種から選ぶので、新しく書くものは無い */
  { const MX=(F.lewd&&F.lewd.mix)||{}, sid=MX.seed;
    if(sid && MONSTERS[sid]){
      const n=Math.max(0,Math.round((MX.seedN||0)*Math.min(1.4,0.6+0.5*denPower())));
      for(let k=0;k<n;k++){
        const a2=(k+0.5)/Math.max(1,n)*TAU+0.4, rr=0.45+0.4*((k%2)?1:0.5);
        const q=at(L.x+Math.cos(a2)*L.rx*rr, L.y+Math.sin(a2)*L.ry*rr, 4);
        const u=spawnUnit(sid,q.x,q.y,{enVal:0,gemMul:1.5});
        if(u) u.denSeed=true;
      }
    } }
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
  { const pw=denPower(); applyPleasure(14*pw); applySensit(8*pw); addHeatG(8*pw); }
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
  { const pw=denBurstPower();   /* v6.3 浅い階の番人は、そこまで太らない */
    u.maxHp=u.hp=Math.round(Math.max(u.maxHp*(1+(BAL.DEN_GUARD_HP-1)*pw), BAL.DEN_GUARD_MIN*pw*F.mon.hp*(typeof eraMul==='function'?eraMul(F.depth):1)));
    u.dmg=(u.dmg||0)*(1+(BAL.DEN_GUARD_DMG-1)*pw); u.xp=(u.xp||0)*2.2; }
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
function denWaits(R){ return (R&&R.waits)?R.waits:(R?[R.wait]:[]); }   // v5.0 待つ役は複数になりうる
function denWaitGoal(p){
  const B=G.B, P=B.party, L=denOf(), R=P.denRole, ex=B.heroes[R.in];
  let x=L.apron.x, y=L.apron.y;
  { const W=denWaits(R), i=Math.max(0,W.indexOf(p.hi)), n=W.length;   // 口の前に扇状に並ぶ
    if(n>1){ const a=(i-(n-1)/2)*0.5 + Math.atan2(y-L.y, x-L.x), r=Math.hypot(x-L.x,y-L.y)||1;
      const q=snapFloor(L.x+Math.cos(a)*r, L.y+Math.sin(a)*r, false, 4); if(q){ x=q.x; y=q.y; } } }
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
  const others=active.filter(h=>h!==win.h); if(!others.length) return;
  /* v5.0 三人以上: 度胸のない子から順に外で待つ。度胸のある子だけが付いて入る */
  const waits=others.filter(h=>((HEROES[h.id]||{}).braveAdd||0)<=0.1);
  const brave=waits.length<others.length;   // 一人でも度胸のある子が居れば、その子は一緒に入る
  const together = (brave && waits.length===0) || win.h.hp<win.h.maxHp*0.6 || (B.den&&B.den.guardUp) || denPeril(win.h);
  if(together || !waits.length){ sayPartyAs(others[0].hi,'den.together',1,0); return; }
  P.denRole={in:win.h.hi, wait:waits[0].hi, waits:waits.map(h=>h.hi), since:B.time, lastIn:0};
  B.nDenWait=(B.nDenWait||0)+1;
  if(sayPartyAs(waits[0].hi,'den.wait',1,0)) pendingLine(win.h.hi,'den.goIn',1.1,1);
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
    gainFloorLight('candle',pr.x,pr.y);   // v4.0 燭台の火が散る(この階のあいだ少し明るい)
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
  const T=linesFor(p.id)||((typeof LINES!=='undefined')?LINES:null);
  let pool=T.floor?(Array.isArray(T.floor)?T.floor[B.floor.depth-1]:T.floor[String(B.floor.depth)]):null;
  if(!pool||!pool.length){ const sf=storyFloor(B.floor.depth); pool=(sf.enter||[]).map(l=>(typeof l==='string')?l:((l&&l.s===p.id)?l.t:null)).filter(Boolean); }
  if(!pool||!pool.length) return;   // v2.1 階層の独り言は lines.js
  if(p.pinned||p.charmBind||p.climaxT>0||attachCount(p)>0||p.heatLv>0||B.enemies.length>30) return;
  heroBubble(p,pickRand(pool),false,0);
}
/* ================= v6.0f 13階「忘れ潟」: 世界だけが巻き戻る =================
   45秒ごとに、盤面の状態だけが12秒前へ戻る。
   戻るもの: 拾った資源 / 沼の乾き・氷結 / 菌輪の開閉 / 壊した設置物 / 魔物の立ち位置。
   ★戻らないもの: 快感・敏感化・発情・催眠・拘束・スタミナ・HP・経験値・レベル・ジェム。
     つまり彼女の側は何ひとつ戻らない。「記憶は消えて、身体だけが残る」——
     ここを取り違えると、この階の一行がまるごと消える。
   ★solid/zone には一切触らない。地形を焼き直す実装は落ちると分かっているし、
     この階に扉は無いので、動く状態だけを輪に貯めれば設計の意味は full に出る。
   ★白い一閃を必ず添える。添えないと、ただのバグに見える */
function rewindSnap(){
  const B=G.B; if(!B) return null;
  return {
    t:B.time,
    picks:(B.picks||[]).map(pk=>({o:pk, dead:!!pk.dead, known:!!pk.known, x:pk.x, y:pk.y})),
    mires:(B.mires||[]).map(m=>({o:m, dry:!!m.dry, iced:!!m.iced})),
    rings:(B.rings||[]).map(r=>({o:r, state:r.state, t:r.t, cd:r.cd, caps:r.caps})),
    props:(B.props||[]).map(pr=>({o:pr, hp:pr.hp})),
    foes:(B.enemies||[]).filter(e=>!e.dead&&!e.boss&&!e.item&&e.state!=='attached').map(e=>({o:e, x:e.x, y:e.y})),
  };
}
function rewindTick(dt){
  const B=G.B, F=B&&B.floor;
  if(!B||!F||!F.rewind||B.coreWar) return;
  B.rwQ=B.rwQ||[];
  B.rwSnapT=(B.rwSnapT||0)-dt;
  if(B.rwT===undefined) B.rwT=BAL.REWIND_EVERY;
  B.rwT-=dt;
  if(B.rwSnapT<=0){
    B.rwSnapT=BAL.REWIND_SNAP;
    const s=rewindSnap();
    if(s){ B.rwQ.push(s); const keep=Math.ceil(BAL.REWIND_BACK/BAL.REWIND_SNAP)+2; while(B.rwQ.length>keep) B.rwQ.shift(); }
  }
  if(B.rwT>0) return;
  B.rwT=BAL.REWIND_EVERY;
  /* 12秒前にいちばん近い焼き付けを選ぶ(無ければいちばん古いもの) */
  let s=null;
  for(const q of B.rwQ) if(B.time-q.t>=BAL.REWIND_BACK) s=q;
  if(!s) s=B.rwQ[0];
  if(s) rewindApply(s);
}
function rewindApply(s){
  const B=G.B; if(!B) return;
  /* 拾い物: 12秒のあいだに拾われたものだけが戻る。B.picks からは消えているので押し直す */
  for(const r of s.picks){
    r.o.known=r.known; r.o.x=r.x; r.o.y=r.y;
    if(B.picks.indexOf(r.o)>=0) r.o.dead=r.dead;
    else if(!r.dead){ r.o.dead=false; B.picks.push(r.o); }
  }
  /* 沼: 乾き・氷結が戻る。タイルに焼いてあるので焼き直しが要る */
  let repaint=false;
  for(const r of s.mires){ if(r.o.dry!==r.dry || r.o.iced!==r.iced){ r.o.dry=r.dry; r.o.iced=r.iced; repaint=true; } }
  if(repaint && typeof mireInit==='function') mireInit();
  /* 菌輪: 開いた輪が閉じ直す */
  for(const r of s.rings){ r.o.state=r.state; r.o.t=r.t; r.o.cd=r.cd; r.o.caps=r.caps; }
  /* 壊した設置物: 生き残っているものは体力が戻る(消えたものは戻さない——
     床から生えたのではなく置かれた物なので、無から湧くと嘘になる) */
  for(const r of s.props){ if(B.props.indexOf(r.o)>=0) r.o.hp=Math.max(r.o.hp,r.hp); }
  /* 魔物: 立ち位置だけ。死んだものは戻さない(彼女が削った分は彼女のもの) */
  for(const r of s.foes){
    const e=r.o; if(e.dead||e.state==='attached'||e.pin) continue;
    if(B.enemies.indexOf(e)<0) continue;
    e.x=r.x; e.y=r.y;
  }
  B.whiteFlash=0.30;
  B.rwN=(B.rwN||0)+1;
  if(typeof setBanner==='function') setBanner('潟が戻った','水面より上のものだけが、さっきの形へ','#d8c8d0');
}

/* ================= v6.0f 14階「厚みの中」: 呼吸 =================
   周期 BREATH_T で壁が内側へ寄り、また戻る。狭まっている BREATH_NARROW 秒のあいだ、
   壁ぎわに居ると走れず、擦れて敏感化が上がる。
   ★solid は書き換えない。設計側も「毎フレーム焼き直すと確実に落ちる/動いて見える部分は
     render のオーバーレイで描く」と釘を刺している。ここで要るのは
     「狭まった時、壁の間合いに居ると逃げ場が無い」という体感の方なので、
     壁までの距離を測って効かせれば、法としては同じものが立つ */
function breathPhase(){
  const B=G.B, F=B&&B.floor;
  if(!B||!F||!F.breath) return 0;
  const ph=(B.breathPh||0)%BAL.BREATH_T;
  return ph<BAL.BREATH_NARROW ? 1-Math.abs(ph/BAL.BREATH_NARROW*2-1) : 0;   /* 0→1→0 の山 */
}
function breathTick(dt){
  const B=G.B, F=B&&B.floor;
  if(!B||!F||!F.breath) return;
  B.breathPh=((B.breathPh||0)+dt)%BAL.BREATH_T;
}
/* 壁までの距離。BREATH_R より近ければ「壁ぎわ」 */
function nearWallD(x,y){
  let best=1e9;
  const i0=tileI(x), j0=tileJ(y), rad=2;
  for(let j=j0-rad;j<=j0+rad;j++) for(let i=i0-rad;i<=i0+rad;i++){
    if(!solidIJ(i,j)) continue;
    const d=Math.hypot(tileCX(i)-x,(tileCY(j)-y));
    if(d<best) best=d;
  }
  return best;
}
function breathHeroTick(h,dt){
  const B=G.B, F=B&&B.floor;
  if(!B||!F||!F.breath||h.out) return;
  const q=breathPhase(); if(q<=0.02){ h.squeeze=0; return; }
  const d=nearWallD(h.x,h.y);
  if(d>BAL.BREATH_R+MAP_T*q){ h.squeeze=0; return; }
  h.squeeze=q;
  h.sensit=(h.sensit||0)+BAL.BREATH_SENS*q*dt;
  markTrait(h,'bareHabit',0.30*q*dt);   /* 服の上からずっと擦れている */
}

/* ================= v6.0f 15階「はじめの夜」: 見覚え =================
   一晩目と同じ場所に、同じではないものが据わっている。
   祠の位置には抱き茸、光茸のそばには媚茸、清水の位置には忘れ水。
   ★地図は開いているので、彼女は探索せずまっすぐ向かう。それが罠 */
function mimicSwap(){
  const B=G.B, F=B&&B.floor, M=G.map;
  if(!B||!F||!F.mimic||!M) return;
  const den=M.lewd;
  for(const q of M.pois){
    if(q.kind==='shrine'){
      if(den && Math.hypot(q.x-den.x,q.y-den.y)<220) continue;   /* 巣窟の祠はそのまま(そこは元から罠) */
      const u=spawnUnit('hugcap',q.x,q.y-26,{enVal:0,gemMul:0.8}); if(u) u.wild=true;
    } else if(q.kind==='pool'||q.kind==='spring'){
      lethePatch(q.x,q.y,3);   /* 掬った水が忘れ水 */
    }
  }
  /* 光っているものの隣には、光っている振りのもの */
  for(const pk of B.picks){
    if(pk.kind!=='shroom'&&pk.kind!=='family') continue;
    const a=rand(TAU), g=snapFloor(pk.x+Math.cos(a)*54, pk.y+Math.sin(a)*54, false, 3);
    if(!g) continue;
    const u=spawnUnit('lurecap',g.x,g.y,{enVal:0,gemMul:0.6}); if(u) u.wild=true;
  }
}
/* 清水の周りを忘れ水に塗り替える(タイル半径 r) */
function lethePatch(x,y,r){
  const M=G.map; if(!M||!M.zone) return;
  const zi=ZONE_IDS.indexOf('lethe'); if(zi<0) return;
  const i0=tileI(x), j0=tileJ(y); const dirty=new Set();
  for(let j=j0-r;j<=j0+r;j++) for(let i=i0-r;i<=i0+r;i++){
    if(!inMap(i,j)||solidIJ(i,j)) continue;
    if(Math.hypot(i-i0,(j-j0)*1.25)>r) continue;
    M.zone[j*MAP_W+i]=zi;
    dirty.add(chunkKey(Math.floor(i/CHUNK),Math.floor(j/CHUNK)));
  }
  if(M.chunks) for(const ck of dirty) M.chunks.delete(ck);
  M.mini=null;
}

/* v6.0f 壁に吸われたものが手を伸ばす。
   14階の法は「追ってこない」であって「何もしない」ではない。
   据わったものは壁の一部になっているので、間合いに入った脚を壁が取る——
   ★動く種を据わらせただけでは階が無効試合になる(実測: 45秒 発情0→0)。
   この一手があって初めて「避けて通る経路が無い」が意味を持つ */
function seatGrabTick(dt){
  const B=G.B, F=B&&B.floor;
  if(!B||!F||!F.sit||B.coreWar) return;
  for(const e of B.enemies){
    if(!e.sat||e.dead||e.dormant) continue;
    e.seatCd=Math.max(0,(e.seatCd||0)-dt);
    if(e.satHold){
      e.satDot=(e.satDot||0)+dt;
      if(e.satDot>=0.5){ e.satDot-=0.5; withHero(e.satHold,()=>{ if(!e.satHold.out) hurtHero(BAL.SEAT_DOT,e,{pierce:true,quiet:true,noKb:true}); }); }
      if(e.state!=='attached'){ e.satHold=null; e.seatCd=BAL.SEAT_CD; }
      continue;
    }
    if(e.seatCd>0||e.spd>0) continue;
    for(const h of B.heroes){
      if(h.out||h.pinned) continue;
      if(Math.hypot(h.x-e.x,h.y-e.y)>e.r+BAL.SEAT_REACH) continue;
      let got=false;
      withHero(h,()=>{ got=attachMonster(e,'tether',{r:e.r+BAL.SEAT_REACH,legFirst:true}); });
      if(got){ e.satHold=h; e.satDot=0; parts(e.x,e.y-8,10,['#e86a9c','#ffb0c8'],120,0.5); }
      else e.seatCd=BAL.SEAT_CD;
      break;
    }
  }
}
/* v6.0f 14階「待ち手の道」に据わるものを置く。
   マップ側が引いた道の上の配置点に、追ってこないものだけを据える */
function spawnSeats(){
  const B=G.B, F=B&&B.floor, M=G.map;
  if(!B||!F||!F.seatway||!M||!M.seats||!M.seats.length) return;
  const kinds=['seatflesh','heartroot','nichelord','tallykeeper'];
  M.seats.forEach((q,k)=>{
    const id=kinds[k%kinds.length];
    if(!MONSTERS[id]) return;
    const g=snapFloor(q.x,q.y,false,3)||q;
    const u=spawnUnit(id,g.x,g.y,{enVal:0,gemMul:0.9});
    if(u){ u.wild=true; u.seat=true; }
  });
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
/* v4.1 洞に元から生えている茸。夜側のENは使わない(地形の一部)。
   媚茸は暗い所ほど効くので、光の届きにくい隅に。抱き茸は道の脇に据わる */
function spawnWildShrooms(){
  const B=G.B, dep=Math.max(1,Math.min(8,(B.floor&&B.floor.depth)||1));
  const nL=(BAL.WILD_LURE[dep-1]||1), nH=(BAL.WILD_HUG[dep-1]||0);
  const spot=(minD)=>{ for(let k=0;k<90;k++){ const a=rand(TAU), d=rand(minD,minD+1100);
      const q=snapFloor(clampMapX(B.hero.x+Math.cos(a)*d,60), clampMapY(B.hero.y+Math.sin(a)*d,60), false, 3);
      if(q && reachableAt(q.x,q.y,false) && Math.hypot(q.x-B.hero.x,q.y-B.hero.y)>=minD) return q; } return null; };
  for(let i=0;i<nL;i++){ const q=spot(420); if(!q) continue; const u=spawnUnit('lurecap',q.x,q.y,{enVal:0,gemMul:0.6}); if(u) u.wild=true; }
  for(let i=0;i<nH;i++){ const q=spot(520); if(!q) continue; const u=spawnUnit('hugcap',q.x,q.y,{enVal:0,gemMul:0.8}); if(u) u.wild=true; }
}
function spawnInitialPicks(){
  for(let i=0;i<BAL.PICK_SHROOM_N;i++) spawnPick('shroom');
  /* v4.1 家族茸(光茸の亜種)。v6.2 PICK_FAMILY_MAX が読まれておらず、
     「一階に1〜2株」と書いてあるのに常に1株だった */
  { const nf=BAL.PICK_FAMILY_N+((Math.random()*(BAL.PICK_FAMILY_MAX-BAL.PICK_FAMILY_N+1))|0);
    for(let i=0;i<nf;i++) spawnPick('family'); }
  for(let i=0;i<BAL.PICK_NECTAR_N;i++) spawnPick('nectar');
  spawnPick('treasure');
}
function picksTick(dt){
  const B=G.B, T=B.pickT, p=B.hero;
  const n={shroom:0,nectar:0,treasure:0,family:0}; for(const pk of B.picks) if(!pk.dead) n[pk.kind]++;
  if(B.ci===leaderIdx()){   // v3.0 湧きのタイマーは一度だけ進める(ヒロインごとに呼ばれる)
  T.shroom-=dt;   if(T.shroom<=0){   T.shroom=BAL.PICK_SHROOM_RESPAWN;  if(n.shroom<BAL.PICK_SHROOM_MAX) spawnPick('shroom'); }
  T.nectar-=dt;   if(T.nectar<=0){   T.nectar=BAL.PICK_NECTAR_RESPAWN;  if(n.nectar<BAL.PICK_NECTAR_MAX) spawnPick('nectar'); }
  T.treasure-=dt; if(T.treasure<=0){ T.treasure=BAL.PICK_TREASURE_CD;   if(n.treasure<BAL.PICK_TREASURE_MAX) spawnPick('treasure'); }
  }
  // 見えたものは覚える(あとで目当てにできる)
  for(const pk of B.picks){ if(!pk.dead && !pk.known && (inSight(pk,p) || ((pk.kind==='shroom'||pk.kind==='family') && Math.hypot(pk.x-p.x,pk.y-p.y)<BAL.DARK_FAR_SEE))){ pk.known=true;   /* v4.1 光る茸は遠くからでも見える */ if(B.time-B.seeToastT>2.5){ B.seeToastT=B.time; floatTxt(pk.x,pk.y-30,'みつけた: '+PICK_DEF[pk.kind].name,'#8fd3ff',11,1.5); sayLine('pick.'+pk.kind,0,14); } } }   // v2.1 資源ごとの台詞
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
    gainFloorLight('shroom',pk.x,pk.y);   // v4.0 光茸: この階のあいだ明るく、二人の間の道も照らす
    maybeLevelup();
  }else if(pk.kind==='family'){
    // v4.1 家族茸(光茸の亜種): 親茸と小さいのが寄り添って生えている。取ると二人を結ぶ道が、その階のあいだ照らされる
    gainXpAll(p.xpNeed*BAL.FAMILY_XP);
    B.bond=true; B.bondT=0;
    parts(pk.x,pk.y-10,22,['#ffe1a8','#9fe8c8','#fff','#ffd0a0'],150,1.0); sfx(560,1200,0.45,'sine',0.06);
    floatTxt(p.x,p.y-58,'家族茸 — 絆の灯り','#ffe1a8',13,1.8);
    { const pr=B.heroes.filter(h=>!h.out); if(pr.length>1){ const a=pr[0], b=pr[1];
        for(let t=0;t<=6;t++) pushLight(a.x+(b.x-a.x)*t/6, a.y+(b.y-a.y)*t/6, 190, BAL.DARK_MEM_T*2.4, 0.9); } }
    sayLine('feat.family',2,0,'ちいさいの、くっついて はえてる……かぞく、みたい');
    setBanner('絆の灯り','家族茸。二人を結ぶ道が、この階のあいだ照らされる','#ffe1a8');
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
function poolWant(p){ return p.sensit>=Math.max(35,(p.sensitFloor||0)+10) || (p.heatG||0)>=45 || p.slow>0 || p.aphro>=40 || (p.sticky||0)>=1.0; }   /* v6.3b ベタベタも洗いに行く理由になる */   // 下限ぶんの敏感化では欲しがらない
function usePool(q){
  const B=G.B, p=B.hero; B.poolCd[q.key]=BAL.POOL_CD; B.used.pool++;
  p.sensit=Math.max(p.sensitFloor||0,p.sensit-30); p.heatG=Math.max(0,(p.heatG||0)-50); p.slow=0; p.aphro=Math.max(0,p.aphro-15);   // 祭壇/呪いの下限は割らない
  p.sticky=0; p.stickySaid=false;   /* v6.3b 媚薬のベタベタは、水で洗えば落ちる */
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
      parts(p.x,p.y-14,gm.v>=9?9:3,gm.v>=9?['#ff5d7a','#fff','#ffb0c0']:['#8fd3ff','#fff'],gm.v>=9?120:70,gm.v>=9?0.6:0.3);
      if(gm.v>=9){ floatTxt(p.x,p.y-52,'赤ジェム +'+gm.v,'#ff5d7a',12,1.2); sayLine('feat.redgem',0,20,'あかいの、みっけ! きっと いいやつ!'); }   // v4.0 巣窟の奥の赤ジェム
      maybeLevelup();
      if(G.mode!=='battle') break;
    }
  }
  B.ci=leaderIdx();
  B.gems=B.gems.filter(g=>!g.dead);
  for(const h2 of B.hearts){
    h2.t+=dt;
    // v3.0 ハートは触れた子が取る。ただし相手の体力がずっと薄いなら譲る(HEART_YIELD)
    for(const p of hs){ if(Math.hypot(h2.x-p.x,h2.y-(p.y-10))<20){ const o=partnerOf(p); if(o && p.hp/p.maxHp>o.hp/o.maxHp+BAL.HEART_YIELD && p.hp/p.maxHp>0.6 && Math.hypot(o.x-h2.x,o.y-h2.y)<260){ sayPartyAs(p.hi,'heartYield',1,12,o); continue; }
      h2.dead=true; p.hp=Math.min(p.maxHp,p.hp+30); floatTxt(p.x,p.y-58,'+30','#7ee89a',13,1); heroBubble(p,{freila:'……助かる', kuu:'……ん', yamiko:'……もらう'}[p.id]||'かいふく♪'); S.heart(); break; } }
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
      const av=Object.keys(UPG).filter(k=>curLv(k)<upgMax(k) && !(UPG[k].kind==='wp'&&curLv(k)===0&&wpC>=BAL.WP_SLOTS) && !(UPG[k].kind==='ps'&&curLv(k)===0&&psC>=BAL.PS_SLOTS));
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
    if(curLv(k)>=upgMax(k)) return false;
    if(UPG[k].kind==='wp' && curLv(k)===0 && wpCount>=BAL.WP_SLOTS) return false;
    if(UPG[k].kind==='ps' && curLv(k)===0 && psCount>=BAL.PS_SLOTS) return false;
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
    const pool=Object.keys(MONSTERS).filter(id=>!MONSTERS[id].boss && !MONSTERS[id].fusion && !MONSTERS[id].item && !MONSTERS[id].variant && !MONSTERS[id].field && !inHand(id));
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
  const fb=B.fam||{fam:null,cut:0};   /* v6.5 同系統で固めたデッキは、その系統だけ続けて出せる */
  const famCut=(fb.fam && famOf(id)===fb.fam) ? fb.cut : 0;
  slot.cdMax=(BAL.CARD_CD_BASE+cost*BAL.CARD_CD_COST)*(1-0.12*altarLv('cdcut'))*(1-famCut);
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
const FLUSH_ORDER=['gtent','ghost','serpent','ghosthand','goblin','hand','spore','mistslime','slime','worm','slug','leech','slugqueen','moth','succubus','gazer','beamer'];
const REFILL_ORDER=['goblin','hand','spore','slug','worm','ghost','slime','serpent','ghosthand'];
/* v6.5 オート指揮は「魔物の名前」を直に見て手を選ぶ。だから特化デッキ——眼だけ、ヌメリだけ——を
   組むと、名指しのカードが手札に無く、指揮官が黙ってしまう。
   実測(同じデッキで効きだけ入切・8夜×3系統): CDを縮めても召喚回数は増えなかった(×0.94/0.97/0.94)。
   縮んだCDより先に、出す手そのものが無かった。
   そこで「何でもいいから出す」場面(畳みかけ・放出・補充)だけ、名指しが尽きたら手札から継ぎ足す。
   系統ボーナスが効いている時は、その系統を先に並べる——これが「特化階層」の中身。 */
function handOrder(names){
  const B=G.B, fb=B.fam||{fam:null};
  const named=names.filter(id=>B.hand.some(h=>h.id===id));
  const rest=B.hand.filter(sl=>!MONSTERS[sl.id].boss && !MONSTERS[sl.id].solo && names.indexOf(sl.id)<0).map(sl=>sl.id);
  const all=named.concat(rest);
  if(!fb.fam) return all;
  return all.filter(id=>famOf(id)===fb.fam).concat(all.filter(id=>famOf(id)!==fb.fam));
}
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
    for(const id of handOrder(PRESSURE.concat(['worm']))){
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
    for(const id of handOrder(FLUSH_ORDER)){
      if(plays>=4 || B.en<enMax()*0.5) break;
      if(!has(id)) continue;
      const f=bestForm(['burst','wave','scatter']);   // v2.2 放出時は包囲円陣を使わない
      if(ready(id,f)){ playCard(id,f); plays++; }
    }
    if(plays>0) return;
  }

  // 8) 圧が切れているなら安価に補充(ただし大物ぶんのENは温存)
  if(alive.length<10){
    for(const id of handOrder(REFILL_ORDER)){
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
/* v6.0 「その子の文脈で」一度だけ処理する。applyPleasure/applySensit などは
   B.hero(=B.ci が指す子)に効くので、ヒロインの列を回らない場所から一人だけ触る時に要る */
function withHero(h,fn){ const B=G.B; const o=B.ci; const i=B.heroes.indexOf(h); if(i>=0) B.ci=i; try{ fn(); } finally { B.ci=o; } }
function eachHero(fn){ const B=G.B; for(let i=0;i<B.heroes.length;i++){ const h=B.heroes[i]; if(h.out) continue; B.ci=i; fn(h,i); if(G.mode!=='battle'&&G.mode!=='levelup') break; } B.ci=leaderIdx(); }
function nearestHeroIdx(x,y){ const B=G.B; let bi=-1, bd=1e9; B.heroes.forEach((h,i)=>{ if(h.out) return; const d=Math.hypot(h.x-x,h.y-y); if(d<bd){ bd=d; bi=i; } }); return bi<0?leaderIdx():bi; }
function partnerOf(p){ const B=G.B; let best=null, bd=1e9; for(const h of B.heroes){ if(h===p||h.out) continue; const d=Math.hypot(h.x-p.x,h.y-p.y); if(d<bd){ bd=d; best=h; } } return best; }
function heroOf(k){ const B=G.B; const own=(UPG[k]&&UPG[k].owner)||'lumina'; return (B&&B.heroes&&B.heroes.find(h=>h.id===own))||(B&&B.hero); }
function heroSkills(p){ return (HEROES[p.id]||HEROES.lumina).skills; }
/* 場面は {title, beats:[…]} の形。素の配列で書かれたものも受け取る——
   v5.0 でクウとヤミコの表の一部が配列のまま入っていて、結果画面が sc.beats.map で落ち、
   押し倒しの本文は render 側の番人に弾かれて黙って出ていなかった。読む所で一度そろえる */
/* ★v6.5 目に触れた本文を控える。本文そのものではなく鍵だけを持ち、読み返す時に
   sceneForHero で組み直す——だから本文を書き換えても、控えは古びない */
function recordScene(heroId,kind,sid){
  if(!heroId||!kind) return;
  META.readScenes=META.readScenes||{};
  const R=META.readScenes[heroId]=META.readScenes[heroId]||{};
  const k=kind+'/'+(sid||'default');
  if(R[k]) return;
  R[k]=1; saveMeta();
}
/* 控えた鍵から本文を組み直す(図鑑の読み返し用) */
function sceneReplay(heroId,key){
  const i=String(key).indexOf('/'); if(i<0) return null;
  return sceneForHero({id:heroId}, key.slice(0,i), key.slice(i+1));
}
function sceneNorm(r){ return Array.isArray(r) ? {beats:r} : r; }
function sceneForHero(h,kind,id){
  if(id && MONSTERS[id] && MONSTERS[id].base) id=MONSTERS[id].base;   /* v6.0 本文は base をそのまま継ぐ */
  const T=(h&&h.id==='freila'&&typeof SCENES_F!=='undefined')?SCENES_F:((h&&h.id==='kuu'&&typeof SCENES_K!=='undefined')?SCENES_K:((h&&h.id==='yamiko'&&typeof SCENES_Y!=='undefined')?SCENES_Y:null));   // v5.0 話者ごとの場面
  let sc=null;
  if(T){ const t=T[kind]||{}; const r=t[id]||t.default; if(r) sc=sceneNorm(r); }
  if(!sc) sc=sceneFor(kind,id);
  /* v6.0 堕ち帯による差し替え。同じ相手に同じように負けても、その夜までにどこまで
     削られているかで締めの一行が変わる。★変わるのは行為ではなく、抗いの残り方 */
  if(sc && sc.beats && typeof fallCoda==='function'){
    const co=fallCoda((h&&h.id)||'lumina', kind, id);
    if(co) sc=Object.assign({}, sc, {beats:sc.beats.concat([co]), band:(typeof fallTier==='function')?fallTier((h&&h.id)||'lumina'):null});
  }
  return sc;
}
function gainXpAll(v){ const B=G.B; for(const h of B.heroes) h.xp+=v; }
/* v5.3 相手の名前。ヒロインそのもの・その番号・id のどれで渡してもよい。
   渡されなかった時は、その場に居る「自分以外の一人」——二人だけならそれで決まる。
   三人以上いて相手が指定されていなければ空を返し、呼びかけの台詞は使わせない */
function partyName(who,speaker){
  const B=G.B; if(!B) return '';
  let id=who;
  if(id&&typeof id==='object') id=id.id;
  else if(typeof id==='number') { const t=B.heroes[id]; id=t&&t.id; }
  if(!id){ const others=B.heroes.filter(x=>x!==speaker&&!x.out); if(others.length===1) id=others[0].id; }
  return (id&&typeof HEROES!=='undefined'&&HEROES[id])?HEROES[id].name:'';
}
/* パーティの台詞(js/lines_party.js の LINES_P)。path の先が {lumina:[..],freila:[..]} なら話者の声で、配列ならそのまま。
   v5.3 本文の「{o}」は相手の名前に置き換える。誰に向けた台詞かが決まらない時は、{o} を含む行を候補から外す
   (三人以上いる場で、名指しを取り違えて「フレイラ、こっち!」と呼んでしまうのを防ぐ) */
function sayPartyAs(hi,path,prio,cd,who){
  const B=G.B; if(!B||typeof LINES_P==='undefined') return false; const h=B.heroes[hi]; if(!h) return false;
  let o=LINES_P; for(const k of path.split('.')){ if(o==null) return false; o=o[k]; }
  let arr=o&&(Array.isArray(o)?o:o[h.id]); if(!Array.isArray(arr)||!arr.length) return false;
  const nm=partyName(who,h);
  if(!nm) arr=arr.filter(t=>t.indexOf('{o}')<0);
  if(!arr.length) return false;
  cd=(cd===undefined)?6:cd; const key='P'+hi+':'+path; B.lineCd=B.lineCd||{}; if(B.lineCd[key]!==undefined && B.time-B.lineCd[key]<cd) return false;
  B.lineCd[key]=B.time; heroBubble(h,arr[(Math.random()*arr.length)|0].split('{o}').join(nm),(prio||0)>=2,prio||0); return true;
}
/* 二人が画面に収まる距離に保つ(離れすぎた分を寄せる。拘束されている子は動かさない) */
/* v6.2 画面内に留める引き寄せは、床を刻んで進める。
   一息に足すと壁を貫けて、向こう側の袋に落ちる。実測では階層を通して
   壁越しに動いた跳躍は全部これだった(奥義ではなかった)。
   壁に当たったらそこで止める。あとは本人の足で回り込ませる */
function slideXY(h,nx,ny){
  const x0=h.x, y0=h.y, dx=nx-x0, dy=ny-y0, d=Math.hypot(dx,dy);
  if(d<0.01) return;
  const n=Math.min(32,Math.max(1,Math.ceil(d/6)));
  let bx=x0, by=y0;
  for(let k=1;k<=n;k++){
    const tx=x0+dx*k/n, ty=y0+dy*k/n;
    if(!passAt(tx,ty,false)) break;
    bx=tx; by=ty;
  }
  h.x=bx; h.y=by;
}
function partyClamp(){
  const B=G.B, hs=B.heroes.filter(h=>!h.out); if(hs.length<2) return;
  for(let i=0;i<hs.length;i++) for(let j=i+1;j<hs.length;j++){ const a=hs[i], b=hs[j]; const fa=!(a.pinned||attachCount(a)>0||a.charmBind), fb=!(b.pinned||attachCount(b)>0||b.charmBind);
    const dx=b.x-a.x, dy=b.y-a.y;
    if(Math.abs(dx)>BAL.PARTY_MAXDX){ const ex=(Math.abs(dx)-BAL.PARTY_MAXDX)*Math.sign(dx); if(fa&&fb){ slideXY(a,a.x+ex/2,a.y); slideXY(b,b.x-ex/2,b.y); } else if(fa) slideXY(a,a.x+ex,a.y); else if(fb) slideXY(b,b.x-ex,b.y); }
    if(Math.abs(dy)>BAL.PARTY_MAXDY){ const ey=(Math.abs(dy)-BAL.PARTY_MAXDY)*Math.sign(dy); if(fa&&fb){ slideXY(a,a.x,a.y+ey/2); slideXY(b,b.x,b.y-ey/2); } else if(fa) slideXY(a,a.x,a.y+ey); else if(fb) slideXY(b,b.x,b.y-ey); } }
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
  sayPartyAs(by.hi,'rescue.done',3,0,c); B.party.goal=null;
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
        /* v6.3 闇の刃の残り線は、円ではなく線分。跨いだ者を削る */
        const inZ=z.seam ? (segDist(e.x,e.y,z.x,z.y,z.x2,z.y2)<z.r+e.r*0.5)
                         : (Math.hypot(e.x-z.x,e.y-z.y)<z.r+e.r*0.5);
        if(inZ){ damageEnemy(e,z.dmg);
          if(z.ice){ e.chillT=Math.max(e.chillT||0,1.4);   /* v5.0 霜の華: 入った瞬間に一度だけ凍らせる */
            if(z.froze && z.froze.indexOf(e)<0){ z.froze.push(e); freezeEnemy(e,0.8);
              B.fx.push({kind:'iceshatter',x:e.x,y:e.y-e.r*0.5,r:e.r+8,t:0,life:0.45}); } } }
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
    for(let i=0;i<B.heroes.length;i++){ const h=B.heroes[i]; if(h.out||b.dead) continue; if(Math.hypot(b.x-h.x,b.y-(h.y-14))<b.r+h.r*0.8 && h.freezeT<=0){ B.ci=i; b.dead=true;
      if(b.kind==='dark'){ const Y=G.B.yami;
        yamiHurt(Y&&!Y.dead?Y:{id:'yamiboss', x:b.x, y:b.y, r:26, dmg:b.dmg||20}, G.B.hero, b.dmg||20, {pierce:true});
        parts(b.x,b.y,14,['#2a1a3e','#a77dff','#fff'],150,0.6); }   // v5.0 闇の穿ち: 快感ではなく体力を削る(とどめは刺さない)
      else runeHit(b); } }   // v3.0 誰に当たったか
  }
  B.ci=leaderIdx();
  if(B.ebullets.length) B.ebullets=B.ebullets.filter(b=>!b.dead&&b.t<b.life);
  eachHero(()=>poiTick(dt));   // 祠・泉・門(v3.0 ヒロインごと)
  denTick(dt);                 // v3.2 巣窟の魔法陣・媚薬の花・壁の光線・番人(1フレームに1度)
  lightsTick(dt); lanternTick(dt); bondTick(dt); ringsTick(dt);   // v4.0 灯りの寿命と催淫灯篭 / v4.1 絆の灯り・菌輪
  wornTick(dt); miresTick(dt); dryAuraTick(dt);   // v5.0 すり減り / 媚薬沼 / 炎のエリア
  calmTick(dt);   /* v6.0 凪ぎの鏡: 波立った面が静けさを取り戻していく */
  fieldSpawnTick(dt); boneTick(dt); silksTick(dt);   /* v6.0 床が勝手に産むもの / 骨の組み上がり / 張られた糸 */
  rewindTick(dt); breathTick(dt);   /* v6.0f 13階: 世界だけが戻る / 14階: 壁の呼吸 */
  seatGrabTick(dt);                 /* v6.0f 14階: 壁に吸われたものが間合いへ手を伸ばす */
  floorBossWake(dt);   /* v6.0 階の主(f7 水鏡の女王 / f13 はじめましての君 / f15 はじめの夜の主) */
  coreWarTick(dt);                   // v4.0 魔核戦に入ったか
  { const ci0=B.ci; for(const h of B.heroes){ if(h.id!=='freila'||h.out) continue; B.ci=h.hi; dryTick(h,dt); } B.ci=ci0; }   // v4.0 フレイラが床を焼くか
  { const ci0=B.ci; for(const h of B.heroes){ if(h.id!=='kuu'||h.out) continue; B.ci=h.hi; iceTick(h,dt); } B.ci=ci0; }        // v5.0 クウが道を凍らせるか
  { const ci0=B.ci; for(const h of B.heroes){ if(h.id!=='yamiko'||h.out) continue; B.ci=h.hi; yamiBegTick(h,dt); } B.ci=ci0; }  // v5.0 ヤミコの強がりが崩れる
  yamiCapTick(dt); shadesTick(dt);   // v5.0 救出の一幕 / 呼ばれた影
  if(!B.heroes.some(h=>h.id==='kuu'&&!h.out)) for(const h of B.heroes){ h.iceOrb=null; h.iceEcho=null; }   // v5.0 クウが捕まると、みんなの氷が一斉に消える
  for(const k in B.itemCd){ if(B.itemCd[k]>0) B.itemCd[k]-=dt; }
  eachHero(()=>trapsTick(dt));
  // 小淫魔: 近くの数を数える(集中低下)。快感は煽りアクション時のみ(バーストCD持ち)
  if(B.impBurstCd>0) B.impBurstCd-=dt;
  for(const h of B.heroes){ h.teaseN=0; if(h.out) continue; for(const e of B.enemies){ if(!e.dead&&e.id==='imp'&&Math.hypot(e.x-h.x,e.y-h.y)<120) h.teaseN++; } }
  eachHero(()=>{ aiUpdate(dt); const n0=B.bullets.length; weaponsUpdate(dt); for(let k=n0;k<B.bullets.length;k++) B.bullets[k].hi=B.ci; iceEchoSpawn(B.hero,n0,dt); rescueTick(dt); });   // v3.0 一人ずつ考えて撃つ。撃った弾は持ち主を覚える / v5.0 氷の追い矢を並べる
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
/* ★v6.5 敗北のあとの観測: 形だけの抵抗
   ------------------------------------------------------------
   捕まえた夜を、その場で終わらせない。彼女は形だけ抗い続け、次々に押し倒される。
   ★ここでは何も進まない——オーブもエッセンスも経験値も増えず、日も進まない。
     battleTick を回さないので、増える経路そのものが無い(数字を止める細工は不要)。
   主(pinSceneHi)を順に回すので、四人ぶんの本文が順に読める。
   終わりはプレイヤーが決める(afterEnd) */
function afterStart(){
  const B=G.B; if(!BAL.AFTER_ON) return false;
  if(!B.enemies.some(e=>!e.dead)) return false;
  B.after={t:0, phase:'gap', gap:0.4, hi:-1, n:0};
  for(const h of B.heroes) h.pinned=true;
  setBanner('観測はまだ終わらない','彼女は形だけ抗い続ける — 終えるなら「観測を終える」','#c98cff');
  if(typeof UI!=='undefined' && UI.afterBtn) UI.afterBtn(true);
  return true;
}
function afterNextPin(){
  const B=G.B, A=B.after; if(!A) return;
  /* 主を順に回す。四人ぶんの本文を、同じ画面で順に読ませるため */
  const idx=B.heroes.length?((A.hi+1)%B.heroes.length):0;
  A.hi=idx; const h=B.heroes[idx]; if(!h) return;
  const near=B.enemies.filter(e=>!e.dead && !MONSTERS[e.id].item);
  const mon=near.length?near[(Math.random()*near.length)|0]:null;
  if(mon){ mon.x=h.x+rand(-14,14); mon.y=h.y+rand(-10,10); }
  const sid=mon?mon.id:'default';
  B.ci=idx;
  B.pinScene=sceneForHero(h,'pin',sid); B.pinSceneHi=idx; B.pinSceneIdx=0; B.pinSceneT=0;
  if(B.pinScene) recordScene(h.id,'pin',sid);   /* 図鑑で読み返せるように控える */
  h.pinned=true; h.pinBy=mon||null; h.vx=0; h.vy=0;
  A.phase='pin'; A.t=0; A.n++;
  G.shake=Math.min(7,G.shake+4); S.capture();
}
function afterEnd(){
  const B=G.B; if(!B||!B.after) return;
  B.after=null;
  if(typeof UI!=='undefined' && UI.afterBtn) UI.afterBtn(false);
  endBattle('capture');
}
function capturedTick(dt){
  const B=G.B, p=B.hero;
  const A=B.after;
  if(!A){
    B.captureT-=dt;
    p.anim+=dt;
    for(const e of B.enemies){
      if(e.dead||e.state==='attached') continue;
      const dx=p.x-e.x, dy=p.y-e.y, d=Math.hypot(dx,dy)||1;
      if(d>36 && MONSTERS[e.id].spd>0){ e.x+=dx/d*60*dt; e.y+=dy/d*60*dt; }
      e.t+=dt;
    }
    if(Math.random()<dt*10) parts(p.x+rand(-20,20),p.y-rand(0,26),1,['#c98cff','#8458d8','#ff86b3'],40,0.8);
    if(B.captureT<=0){ if(!afterStart()) endBattle('capture'); }
    return;
  }
  /* --- 観測フェーズ --- */
  A.t+=dt;
  const sub=B.heroes[A.hi]||p;
  sub.anim+=dt;
  for(const h of B.heroes){ h.pinned=true; h.struggle=Math.max(0,(h.struggle||0)-dt*0.2); }
  for(const e of B.enemies){
    if(e.dead) continue;
    const dx=sub.x-e.x, dy=sub.y-e.y, d=Math.hypot(dx,dy)||1;
    if(d>34 && MONSTERS[e.id].spd>0){ e.x+=dx/d*52*dt; e.y+=dy/d*52*dt; }
    e.t+=dt;
  }
  if(Math.random()<dt*12) parts(sub.x+rand(-22,22),sub.y-rand(0,28),1,['#c98cff','#8458d8','#ff86b3'],40,0.8);
  if(A.phase==='gap'){
    if(A.t>=(A.gap||BAL.AFTER_GAP)){ A.gap=BAL.AFTER_GAP; afterNextPin(); }
    return;
  }
  /* 本文を送る(pinTick は回っていないので、ここで送る) */
  B.pinSceneT+=dt;
  if(B.pinScene && B.pinSceneT>BAL.AFTER_BEAT_T){ B.pinSceneT=0; B.pinSceneIdx++; }
  if(Math.random()<dt*0.5){   /* 形だけの抵抗 */
    const V={lumina:['……や、だ……','……もう、やめ……','……はな、して'], freila:['……っ、まだ……','……どけ、って……'],
             kuu:['……いや……','……やめ、て'], yamiko:['……もう、いい……','……好きに、しなさい']}[sub.id]||['……や、だ……'];
    heroBubble(sub, V[(Math.random()*V.length)|0], true, 3);
  }
  /* 本文を最後まで読ませてから次へ。AFTER_PIN_T は保険の上限 */
  const done=B.pinScene && B.pinScene.beats && B.pinSceneIdx>=B.pinScene.beats.length;
  if(done || A.t>=BAL.AFTER_PIN_T){ A.phase='gap'; A.t=0; B.pinScene=null; }
}
function survivedTick(dt){
  const B=G.B, p=B.hero;
  B.winT-=dt;
  p.anim+=dt; p.orbAng+=2.5*dt;
  if(Math.random()<dt*14) parts(p.x+rand(-160,160),p.y-rand(-20,160),1,['#fff','#ffd76a','#8fd3ff','#ff86b3'],26,1.3);
  // v4.0 魔核の跡: 根だけになり、巻き上がって赤黒い渦へ(時間が巻き戻る合図)
  const cr=B.coreRoots;
  if(cr){
    cr.t+=dt;
    const T1=BAL.LOOP_ROOT_T, T2=BAL.LOOP_WIND_T;
    if(cr.t<T1){ if(Math.random()<dt*10) parts(cr.x+rand(-cr.r*1.8,cr.r*1.8), cr.y+rand(-cr.r*0.9,cr.r*0.9), 1, ['#7a1f44','#3a0b20','#c2456f'], 60, 1.0); }
    else if(cr.t<T1+T2){
      const k=(cr.t-T1)/T2;
      if(Math.random()<dt*(18+40*k)){ const a=rand(TAU), rr=cr.r*(2.6-1.9*k)*rand(0.5,1.2);
        parts(cr.x+Math.cos(a)*rr, cr.y+Math.sin(a)*rr*0.7, 1, ['#c2456f','#3a0b20','#ff5d9a'], 40+60*k, 0.7); }
      if(!cr.windSaid && k>0.25){ cr.windSaid=true; setBanner('根が巻き上がる','千切れた根が渦を描きはじめる','#c2456f'); G.shake=Math.min(10,G.shake+5); sfx(140,60,0.8,'sawtooth',0.06); }
      G.shake=Math.max(G.shake, 1.5*k);
    }
    else if(!cr.vortex){
      cr.vortex=true;
      setBanner('赤黒い渦','深淵が、時ごと巻き戻ろうとしている','#8a1030');
      G.shake=Math.min(16,G.shake+9); sfx(90,30,1.4,'sine',0.11);
      for(const q of B.heroes){ if(!q.out) sayPartyOrLine(q,'feat.vortex','うずが……! ぜんぶ、まきこまれてく……!'); }
    }
    if(cr.vortex && Math.random()<dt*26){ const a=rand(TAU), rr=rand(cr.r*1.2, cr.r*7);
      parts(cr.x+Math.cos(a)*rr, cr.y+Math.sin(a)*rr*0.7, 1, ['#8a1030','#3a0b20','#ff2e6a','#000'], 200, 0.9); }
  }
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
