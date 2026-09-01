'use strict';
/* ============================================================
   game.js — 戦闘ロジック
   ヒロイン(AI自動操縦) / 四肢拘束・スタミナ / モンスター / EN・カード
============================================================ */

/* ================= ヒロイン生成 ================= */
function newHero(){
  const gb=META.gen.battle;                 // 世代内の戦歴 0..3
  const aArmor=altarLv('armor'), aRegen=altarLv('regen'), aSpeed=altarLv('speed');
  const aSense=altarLv('sense'), aHeat=altarLv('heat'), aFocus=altarLv('focus');
  const aStam=altarLv('stamina');
  const LU=(META.lumina&&META.lumina.upg)||{};
  const h={
    x:0, y:0, vx:0, vy:0, r:10,
    maxHp:Math.round(175*(1+0.18*gb)*(1+0.08*(LU.vital||0))), hp:0,
    armor:Math.max(0, 7 + gb - aArmor + Math.floor((LU.guard||0)*0.5)),
    regen:(0.9+0.15*gb+0.08*(LU.bless||0))*(1-0.3*aRegen),
    baseSpeed:154*(1-0.06*aSpeed)*(1+0.02*(LU.swift||0)),
    dmgMult:1+0.06*(LU.zeal||0),
    level:1, xp:0, xpNeed:need(1),
    wp:{bolt:2, orb:1, nova:0, whip:0, rain:0, cross:0},
    ps:{speed:0, vital:0, magnet:0, haste:0, ward:0, growth:0},
    evo:{sstar:0, sring:0, sburst:0, srush:0, scomet:0, sjudge:0},
    boltT:0.6, novaT:2.5, orbAng:0, novaAnim:0, novaR:0,
    whipT:1.1, whipAnim:0, whipDir:1, whipSide:1, whipR:0, rainT:2.2, crossT:1.6,
    /* 今夜の好み: ビルド選択の癖(戦闘ごとにランダム)。
       噛み合わない好みを引いた夜は、シナジー不足でDPSが枯れる */
    taste:(()=>{
      const t={}; for(const k in UPG) t[k]=rand(0.55,1.65);
      t.bolt=Math.max(t.bolt,1.15);   // 初期武器には最低限の愛着(1戦目のDPS床)
      return t;
    })(),
    ifr:0, face:1, moving:false, anim:rand(10),
    strafeDir:Math.random()<0.5?-1:1, strafeT:2,
    bubble:'', bubbleT:0, bubbleCd:0, aiLabel:'けいかい中', aiState:'',
    /* --- スタミナ / 四肢拘束 / 押し倒し --- */
    staminaMax:BAL.STAMINA_MAX-12*aStam+6*(LU.grit||0),
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
  if(gb>=1) h.wp.bolt=3;
  if(gb>=2){ h.wp.orb=2; h.wp.nova=1; }
  if(gb>=3){ h.ps.speed=1; h.ps.haste=1; }
  h.hp=h.maxHp;
  h.stamina=h.staminaMax;
  return h;
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
  if(h.slow>0) spd*=0.55;
  if(h.heatLv>0) spd*=1-0.04*h.heatLv;
  if(h.waveDur>0) spd*=BAL.WAVE_SPD;
  if(h.exhausted) spd*=0.7;
  return { speed:spd, magnet:90+45*h.ps.magnet };
}
const curLv=k=>UPG[k].kind==='wp' ? G.B.hero.wp[k] : G.B.hero.ps[k];

/* ================= 戦闘開始/終了 ================= */
function startBattle(){
  const hero=newHero();
  G.B={
    time:0, over:false,
    hero, enemies:[], bullets:[], gems:[], hearts:[], trails:[], clouds:[], props:[], chests:[],
    en:BAL.EN_START, spawnFx:[],
    hand:META.deck.map(id=>({id, cdT:0, cdMax:1})),
    auto:META.settings.autoplay, autoT:1.2,
    kills:0, dmgDealt:0, dmgCarry:0, ailCount:0, orbFrag:0, essence:0,
    bossUsed:false, capturedBy:null, captureCause:'', captureT:0, winT:0,
    ailRateT:{}, chestIdx:0, propT:BAL.PROP_RESPAWN,
    lvCards:null, pinScene:null, pinSceneIdx:0, pinSceneT:0,
    combo:{}, lastPlay:null,
    climaxN:0, stains:[],
    heroCoins:0, impBurstCd:0,
  };
  spawnInitialProps();
  G.mode='battle';
  G.cam.x=0; G.cam.y=0;
  setBanner('第'+genNum(META.gen.idx)+'世代 — 戦歴 '+(META.gen.battle+1)+'/'+BAL.GEN_LEN,
    META.gen.battle>0?'ルミナは前回までの経験を継承している':'初期状態のルミナ(書き換え適用)', '#b46cff');
  heroBubble(hero,'今日も、まもりぬくよ!',true);
  UI.enterBattle();
  bgmStart('battle');
}
function enMax(){ return Math.min(BAL.EN_MAX, BAL.EN_BASE + BAL.EN_PER_LV*(G.B?G.B.hero.level:1)); }

function endBattle(outcome){
  const B=G.B;
  if(B.over) return;
  B.over=true;
  const gb=META.gen.battle;
  let orbGain=B.orbFrag, essGain=Math.round(B.essence);
  if(outcome==='capture'){ orbGain+=BAL.ORB_CAPTURE + BAL.ORB_CAPTURE_GEN*gb; essGain+=BAL.CAPTURE_ESS_BONUS; }
  if(outcome==='survive'){ essGain+=BAL.SURVIVE_ESS_BONUS; }
  META.essence+=essGain; META.orbs+=orbGain;
  META.runs++;
  META.life.dmg+=Math.round(B.dmgDealt); META.life.ail+=B.ailCount; META.life.kills+=B.kills;
  META.life.climax=(META.life.climax||0)+B.climaxN;
  // 夜明け: ルミナはコインを数え、自分を強化する(ヴァンサバのコイン強化に相当)
  const coinGain=Math.round(B.heroCoins+(outcome==='survive'?40:10));
  META.lumina.coins+=coinGain;
  const shopped=luminaShop();
  META.rot.dmg+=Math.round(B.dmgDealt); META.rot.ail+=B.ailCount; META.rot.battles++;
  if(outcome==='capture'){ META.captures++; META.rot.captures++; }
  if(outcome==='capture' && (!META.best || B.time<META.best.time)){
    META.best={time:B.time, gen:META.gen.idx, battle:gb+1};
  }
  META.gen.battle++;
  let rotReset=false;
  if(META.gen.battle>=BAL.GEN_LEN){
    META.gen.battle=0; META.gen.idx++;
    META.rot={dmg:0, ail:0, captures:0, battles:0};
    rotReset=true;
  }
  saveMeta();
  bgmStop();
  G.mode='result';
  UI.showResult({outcome, essGain, orbGain, rotReset,
    time:B.time, kills:B.kills, dmg:Math.round(B.dmgDealt), ail:B.ailCount,
    heroLv:B.hero.level, capturedBy:B.capturedBy, cause:B.captureCause, climax:B.climaxN,
    coins:coinGain, shop:shopped});
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
  if(B.time-rt>2){ B.ailRateT[type]=B.time; B.orbFrag+=BAL.ORB_PER_AIL; B.ailCount++; }
}
/* 魅了(v0.4): 種族別・レベル制。接触のたびその種族への段階が上がる。
   同じ種族ならどの個体にも効果が及ぶ。
   Lv1=与ダメ減 / Lv2=+無意識に寄る発作 / Lv3=+接触で魅了拘束 */
function applyCharm(mon){
  const h=G.B.hero;
  if(!mon||mon.dead) return;
  const res=1+0.22*(h.resist.charm||0);
  let c=charmEntry(h,mon.id);
  if(!c){
    c={id:mon.id, lv:0, t:0, driftCd:BAL.CHARM_DRIFT_CD*rand(0.5,0.9)};
    h.charms.push(c);
  }
  c.lv=Math.min(3,c.lv+1);
  c.t=BAL.CHARM_DUR*h.sense/res;
  h.resist.charm=(h.resist.charm||0)+1;
  heroBubble(h,[
    '','え…なんで、めが…はなせな…',
    'だめ…みちゃだめ、なのに…',
    'このこ達の、そばに…いたい……',
  ][c.lv],true,2);
  S.charm();
  awardAil('charm');
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
  h.aphro=clamp(h.aphro+amount*h.sense*(1+BAL.SENSIT_AMP*sensLvOf(h)),0,100);
  if(h.aphro>=100 && h.climaxT<=0) enterClimax();
}
/* ================= 絶頂 =================
   快感100で絶頂。脚が止まり、痙攣して動けない。終わると発情が一段深まる */
function enterClimax(){
  const B=G.B, h=B.hero;
  if(h.climaxT>0) return;
  h.climaxT=BAL.CLIMAX_DUR;
  h.climaxPhase=0;
  h.vx=0; h.vy=0;
  h.squirted=Math.random()<Math.min(0.95, BAL.SQUIRT_BASE+0.2*h.heatLv+0.12*sensLvOf(h));
  B.climaxN++;
  heroBubble(h,'や、だめ、いま……きちゃ……あ、ぁあああっ——!',true,3);
  if(B.climaxN===1) setBanner('絶頂','ルミナは立っていられない','#ff5d9e');
  if(!h.pinned && !h.charmBind){
    B.pinScene=sceneFor('climax','default');
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
    B.pinSceneT+=dt;
    if(B.pinScene && B.pinSceneT>2.6){ B.pinSceneT=0; B.pinSceneIdx++; }
  }
  const el=BAL.CLIMAX_DUR-h.climaxT;
  if(h.climaxPhase===0 && el>0.7){
    h.climaxPhase=1;
    // 絶頂はスタミナを大きく持っていく——連続絶頂はやがて力尽きる
    h.stamina=Math.max(0,h.stamina-BAL.CLIMAX_STAM_COST);
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
    if(!h.pinned && !h.charmBind) B.pinScene=null;
    heatUp();
  }
}
/* 潮の染み: 地面にしばらく残る */
function spawnStain(x,y){
  const B=G.B;
  if(B.stains.length>30) B.stains.shift();
  B.stains.push({x,y,r:rand(11,16),t:0,life:BAL.STAIN_LIFE,rot:rand(TAU),
    r2:rand(0.55,0.8)});
}
function heatUp(){
  const h=G.B.hero;
  h.heatLv=Math.min(3,h.heatLv+1);
  h.heatT=BAL.HEAT_LV_DUR;
  h.aphro=BAL.HEAT_AFTER;
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
function freeSlotFor(kind){
  const h=G.B.hero;
  const order = kind==='tether' ? ['legL','legR','armL','armR'] : shuffle(LIMBS.slice());
  for(const s of order){ if(!h.limbs[s]) return s; }
  return null;
}
function attachMonster(mon, kind, opt){
  const B=G.B, h=B.hero;
  opt=opt||{};
  const slot=freeSlotFor(kind);
  if(!slot) return false;
  const needBase=kind==='tether'?BAL.RIP_NEED_TETHER:BAL.RIP_NEED_CLING;
  const need=needBase/(1+0.12*(h.resist.bound||0));
  h.limbs[slot]={mon, kind, need, r:opt.r||0, t:B.time};
  mon.state='attached'; mon.limb=slot; mon.stun=0;
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
    mon.state = mon.id==='flower' ? 'open' : (mon.id==='gtent' ? 'idle' : 'chase');
    mon.limb=null;
    const p=limbAnchor(h,slot);
    if(mon.id!=='flower' && mon.id!=='gtent'){
      mon.x=p.x+rand(-8,8); mon.y=p.y+rand(-4,4);
    }
    if(opt.fling){
      mon.stun=1.2;
      mon.hp-=mon.maxHp*0.35;
      const a=rand(TAU);
      mon.x+=Math.cos(a)*30; mon.y+=Math.sin(a)*30;
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
  mon.state='attached'; mon.suck=slot; mon.stun=0;
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
      mon.x+=Math.cos(a)*34; mon.y+=Math.sin(a)*34;
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
  B.pinScene=sceneFor('pin', mon?mon.id:'default');
  B.pinSceneIdx=0; B.pinSceneT=0;
  setBanner('押し倒された!','もがいて逃れろ——スタミナかHPが尽きれば敗北','#ff5d7a');
  heroBubble(h,'はなれて……っ!',true,2);
  S.capture();
  G.shake=Math.min(9,G.shake+5);
  awardAil('pinned');
}
function pinTick(dt){
  const B=G.B, h=B.hero;
  h.pinT-=dt;
  B.pinSceneT+=dt;
  if(B.pinScene && B.pinSceneT>2.6){ B.pinSceneT=0; B.pinSceneIdx++; }
  if(h.pinT<=0){
    h.pinT=BAL.PIN_PULSE_T;
    h.stamina-=BAL.PIN_PULSE_COST;
    h.pinEscape+=BAL.PIN_ESCAPE_GAIN*(h.heatLv>0?1-0.1*h.heatLv:1)*(h.climaxT>0?0.25:1)*rand(0.85,1.15);
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
      setBanner('振りほどいた!','ルミナは立ち上がった','#8fd3ff');
      B.pinScene=null;
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
  B.pinScene=sceneFor('charmbind', mon.id);
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
  B.pinScene=null;
  if(sane && mon && !mon.dead){
    // 我に返っても、惚れた記憶は一段しか薄れない(魅了は簡単には解けない)
    const c=charmEntry(h,mon.id);
    if(c){ c.lv--; c.t=BAL.CHARM_DUR*0.8; if(c.lv<=0) removeCharm(h,mon.id); }
    h.resist.charm=(h.resist.charm||0)+1;
    mon.stun=1.2;
    mon.hp-=mon.maxHp*0.35;
    const a=rand(TAU);
    mon.x+=Math.cos(a)*30; mon.y+=Math.sin(a)*30;
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
  B.pinSceneT+=dt;
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
function condTick(h,dt){
  const B=G.B;
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
    if(c.t<=0){
      c.lv--;
      if(c.lv<=0){ h.charms.splice(i,1); heroBubble(h,'…あれ? わたし、なにを…'); continue; }
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
  // 絡みつき中の微快感(拘束役の練度でスケール)
  for(const sl of attachedSlots(h)){
    const m=h.limbs[sl].mon;
    if(m&&!m.dead) applyPleasure(BAL.PLEAS_BINDER*unitPmul(m)*dt);
  }
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
  // ガス雲=媚薬(敏感化)の吸引
  for(const c of B.clouds){
    if(Math.hypot(h.x-c.x,(h.y-12)-c.y)<c.r){
      applySensit(c.rate*dt);
      applyPleasure(BAL.PLEAS_GAS*dt);
      break;
    }
  }
}

/* ================= ヒロインAI ================= */
function aiUpdate(dt){
  const B=G.B, p=B.hero, st=heroStat(p);
  p.prevX=p.x; p.prevY=p.y;

  if(p.pinned || p.charmBind || p.climaxT>0 || p.stumbleDur>0){
    p.vx*=Math.pow(0.001,dt); p.vy*=Math.pow(0.001,dt);
    p.moving=false;
    p.aiLabel=p.climaxT>0?'ぜっちょう……!!'
      :(p.pinned?'おさえこまれている!!':(p.charmBind?'みりょうされて、はなれない…!!':'ふらつき…'));
    return;
  }

  if(p.diveT>0) p.diveT-=dt;

  const foc=heroFocus(p);

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
    p.thinkT=BAL.THINK_MIN+(BAL.THINK_MAX-BAL.THINK_MIN)*(1-foc)+rand(0,0.06);
    aiDecide(foc);
  }

  let dx=p.steerX, dy=p.steerY;
  const state=p.steerState;

  // 媚薬・煽りによるノイズ(思考の乱れ)
  if(foc<1){
    const n=(1-foc)*1.1;
    dx+=Math.sin(B.time*3.1+p.anim*7)*n;
    dy+=Math.cos(B.time*2.7+p.anim*5)*n;
  }

  const m=Math.hypot(dx,dy);
  const tvx=m>0.001?dx/m*st.speed:0;
  const tvy=m>0.001?dy/m*st.speed:0;
  const k=Math.min(1,dt*6.5*foc);
  p.vx+=(tvx-p.vx)*k; p.vy+=(tvy-p.vy)*k;
  p.x+=p.vx*dt; p.y+=p.vy*dt;

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

  if(Math.abs(p.vx)>12) p.face=p.vx>0?1:-1;
  p.moving=Math.hypot(p.vx,p.vy)>30;

  const LBL={flee:'かいひ行動!', boss:'ボスかいひ!!', gem:'ジェム回収', heart:'ハートへ!',
    prop:'燭台をこわして回復!', chest:'たからばこへ!', kite:'まちうけ・けん制', wait:'けいかい中',
    struggle:'ふりほどこうともがいている!',
    charmwalk:'ふらふらと、ちかづいていく…', heatwalk:'熱にまけて、よろめき寄る…'};
  const BBL={flee:'にげなきゃ〜!', boss:'おっきいのこわい!!', gem:'キラキラかいしゅう♪',
    heart:'ハートみっけ!', prop:'燭台こわして回復しなきゃ', chest:'たからばこだ〜!',
    kite:'このきょりキープ…', wait:'つぎはどこから…?', struggle:'はなれてよ〜っ!',
    charmwalk:'…なんで、あしが…', heatwalk:'…あつくて、なにも…'};
  p.aiLabel=LBL[state];
  if(state!==p.aiState){
    p.aiState=state;
    // エロ状態が乗っている間は、のんきなおしゃべりを封じる(台詞の主導権はエロ側)
    const ero=p.heatLv>0||p.aphro>=45||restraintCount(p)>0||p.climaxT>0||p.charms.length>0;
    if(!ero) heroBubble(p,BBL[state]);
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
  let ax=0, ay=0, threat=0, bossNear=false;
  for(const e of B.enemies){
    if(e.dead||e.dormant||e.state==='attached') continue;
    if(e.id==='flower' && !e.revealed) continue;
    if(e.id==='imp') continue;                                 // 小淫魔からは逃げない(脅威と認識しない)
    // 画面外の敵は存在に気づかない。視界に入ってからも反応までの遅れがある
    if(!inSight(e,p) || e.seenT < BAL.NOTICE_T*(1.4-0.4*foc)) continue;
    const dx=p.x-e.x, dy=p.y-e.y;
    const d=Math.hypot(dx,dy)||0.001;
    const DANGER={flower:130, gtent:90, slug:55, worm:55, gas:60, slime:110, leech:60};
    const danger=(e.boss?280:(DANGER[e.id]!==undefined?DANGER[e.id]:150))+e.r;
    if(d<danger){
      let w=1-d/danger; w=w*w*(e.boss?3:1);
      w*=1-0.28*charmLvFor(p,e);                               // 魅了された種族は脅威と思えない
      threat+=w; ax+=dx/d*w; ay+=dy/d*w;
      if(e.boss) bossNear=true;
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

  let dx=0, dy=0, state='wait';

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
    dx=Math.cos(B.time*7)*0.8*jerk + ax*1.2;
    dy=Math.sin(B.time*9)*0.8*jerk + ay*1.2;
  }else if(forceProp){
    p.propTarget=forceProp;
    const d=Math.hypot(forceProp.x-p.x,forceProp.y-p.y)||1;
    dx=(forceProp.x-p.x)/d; dy=(forceProp.y-p.y)/d;
    if(d<150){ dx*=0.12; dy*=0.12; }
    dx+=ax*1.1; dy+=ay*1.1;
    state='prop';
  }else if(threat>0.9){
    const m=Math.hypot(ax,ay)||1;
    dx=ax/m - (ay/m)*0.35*p.strafeDir;
    dy=ay/m + (ax/m)*0.35*p.strafeDir;
    state=bossNear?'boss':'flee';
  }else{
    let target=null, kind='';
    p.propTarget=null;
    if(p.hp < p.maxHp*0.6){
      let td=420;
      for(const h2 of B.hearts){
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
    if(!target && threat<0.3){
      let td=520;
      for(const c of B.chests){
        const d=Math.hypot(c.x-p.x,c.y-p.y);
        if(d<td){ td=d; target=c; kind='chest'; }
      }
    }
    if(!target){
      // ジェム回収。ガス溜まりの中のジェムは基本見送る——
      // ただし中のジェムが多ければ、意を決して取りに入る
      let bestGm=null, bd=430, bestCl=null;
      for(const gm of B.gems){
        const d=Math.hypot(gm.x-p.x,gm.y-p.y);
        if(d>=bd) continue;
        const cl=cloudAt(gm.x,gm.y);
        if(cl && p.diveT<=0){
          const w=cloudWorth(cl);
          if(w.n<BAL.DIVE_GEM_N && w.v<BAL.DIVE_GEM_V) continue;   // 割に合わない: 諦める
        }
        bd=d; bestGm=gm; bestCl=cl;
      }
      if(bestGm){
        target=bestGm; kind='gem';
        if(bestCl && p.diveT<=0){
          p.diveT=BAL.DIVE_T;
          heroBubble(p,'……すぅ。ちょっとだけ、だからっ');
        }
      }
    }
    if(target){
      const d=Math.hypot(target.x-p.x,target.y-p.y)||1;
      dx=(target.x-p.x)/d; dy=(target.y-p.y)/d;
      state=kind;
      if(kind==='prop' && d<150){ dx*=0.12; dy*=0.12; }   // 燭台を撃ち壊す間は足を止める
      dx+=ax*1.0; dy+=ay*1.0;
    }else{
      let ne=null, nd=1e9;
      for(const e of B.enemies){
        if(e.dead||e.dormant||e.state==='attached'||e.id==='imp') continue;
        if(!inSight(e,p)) continue;
        const d=Math.hypot(e.x-p.x,e.y-p.y);
        if(d<nd){ nd=d; ne=e; }
      }
      if(ne){
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
  p.steerX=dx; p.steerY=dy; p.steerState=state;
}

/* ================= ヒロイン武器 ================= */
function nearestEnemies(n,maxD){
  const B=G.B, p=B.hero;
  const arr=[];
  for(const e of B.enemies){
    if(e.dead||e.dormant||e.state==='attached') continue;
    if(!inSight(e,p)) continue;                       // 見えていない敵は撃てない
    const d=Math.hypot(e.x-p.x,e.y-p.y);
    // 魅了された相手は狙いが後回しになる(距離に下駄)
    arr.push({e, d:d+charmLvFor(p,e)*140});
    if(d>=maxD) arr.pop();
  }
  arr.sort((a,b)=>a.d-b.d);
  return arr.slice(0,n).map(o=>o.e);
}
function weaponsUpdate(dt){
  const B=G.B, p=B.hero;
  const atkMult=((p.pinned||p.charmBind||p.climaxT>0)?0:1)*Math.pow(0.75,armCount(p))   // 腕を拘束されるほど攻撃が乱れる
    *(p.waveDur>0?BAL.WAVE_ATK:1)                                           // 発情の波の間は手が止まりがち
    *(1+0.08*p.ps.haste);                                                   // クイックリボン
  if(atkMult<=0) return;
  if(p.wp.bolt>0){
    p.boltT-=dt*atkMult;
    if(p.boltT<=0){
      const evo=p.evo.sstar>0;
      const lv=p.wp.bolt;
      const shots=evo?6:Math.min(4,1+Math.floor(lv/2));
      // 回復が要るときは燭台を狙う
      const wantProp=p.propTarget && !p.propTarget.dead &&
        (p.hp<p.maxHp*0.55 || nearestEnemies(1,300).length===0);
      if(wantProp){
        const t=p.propTarget;
        const d=Math.hypot(t.x-p.x,t.y-p.y);
        if(d<460 && B.bullets.length<90){
          p.boltT=0.55;
          const a=Math.atan2((t.y-10)-(p.y-14), t.x-p.x);
          B.bullets.push({x:p.x,y:p.y-14,vx:Math.cos(a)*460,vy:Math.sin(a)*460,
            dmg:15+5*(lv-1), pierce:0, life:1.2, last:null, evo:false});
          S.pew();
          if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN);
        }else p.boltT=0.15;
      }else{
        const ts=nearestEnemies(shots,evo?640:560);
        if(ts.length && B.bullets.length<90){
          p.boltT=(evo?0.62:0.8)*Math.pow(0.87,lv-1);
          for(let i=0;i<shots;i++){
            const t=ts[Math.min(i,ts.length-1)];
            const dx=t.x-p.x, dy=(t.y-t.r)-(p.y-14);
            const sp=evo?520:460, spread=(i-(shots-1)/2)*0.06;
            const a=Math.atan2(dy,dx)+spread;
            B.bullets.push({x:p.x,y:p.y-14,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,
              dmg:(evo?21:15+5*(lv-1)), pierce:evo?2:(lv>=4?1:0), life:1.3, last:null, evo});
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
      const lv=p.wp.nova;
      p.novaT=(evo?4.2:4.6)-0.35*(lv-1);
      const R=(evo?165:90+16*(lv-1)), dmg=(evo?34:16+7*(lv-1));
      p.novaAnim=0.5; p.novaR=R;
      G.shake=Math.min(7,G.shake+3);
      S.nova();
      for(const e of B.enemies){
        if(e.dead||e.dormant) continue;
        const dx=e.x-p.x, dy=e.y-p.y, d=Math.hypot(dx,dy);
        if(d<R+e.r){
          damageEnemy(e,dmg);                        // 絡みついた個体もノヴァでは剥がし得る
          if(d>0.01 && !e.boss && e.state!=='attached'){ e.x+=dx/d*30; e.y+=dy/d*30; e.stun=Math.max(e.stun,evo?0.6:0.35); }
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
      const evo=p.evo.srush>0, lv=p.wp.whip;
      p.whipT=(evo?0.72:1.12)*Math.pow(0.9,lv-1);
      p.whipSide*=-1;
      const range=evo?150:95+9*lv, half=evo?150:40+4*lv;
      const dmg=evo?22:10+4*(lv-1);
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
      const evo=p.evo.scomet>0, lv=p.wp.rain;
      p.rainT=(evo?1.5:2.3)*Math.pow(0.88,lv-1);
      const drops=evo?5:1+Math.floor(lv/2);
      const ts=nearestEnemies(drops*2,540);
      let fired=false;
      for(let i=0;i<drops;i++){
        const t=ts.length?ts[(Math.random()*ts.length)|0]:null;
        if(!t) break;
        const tx=t.x+rand(-26,26), ty=t.y+rand(-16,16);
        if(B.bullets.length<120){
          B.bullets.push({kind:'rain', x:tx+rand(-40,40), y:ty-300, tx, ty,
            vx:0, vy:540, dmg:evo?26:12+5*(lv-1), splash:evo?70:42, life:1.0, last:null, evo});
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
      const evo=p.evo.sjudge>0, lv=p.wp.cross;
      const ts=nearestEnemies(1,500);
      if(ts.length && B.bullets.length<120){
        p.crossT=(evo?1.4:1.9)*Math.pow(0.9,lv-1);
        const a=Math.atan2((ts[0].y-ts[0].r)-(p.y-12), ts[0].x-p.x);
        const sp=evo?430:360;
        B.bullets.push({kind:'cross', x:p.x, y:p.y-12, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
          spd:sp, dmg:evo?20:9+4*(lv-1), retT:evo?0.55:0.42, ret:false, life:2.4, last:null, evo});
        sfx(320,180,0.12,'square',0.04);
        if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN);
      }else p.crossT=0.15;
    }
  }
}
function orbPos(i,n){
  const p=G.B.hero;
  const evo=p.evo.sring>0;
  const R=(evo?66:52)+3*Math.max(1,p.wp.orb);
  const a=p.orbAng + i*TAU/n;
  return {x:p.x+Math.cos(a)*R, y:p.y-10+Math.sin(a)*R*0.9};
}

/* ================= レベルアップ ================= */
function readyEvos(){
  const p=G.B.hero, out=[];
  for(const k in EVOS){
    const e=EVOS[k];
    if(!p.evo[k] && p.wp[e.base]>=UPG[e.base].max && p.ps[e.pair]>=2) out.push(k);
  }
  return out;
}
function maybeLevelup(){
  const B=G.B, p=B.hero;
  if(G.mode!=='battle') return;
  if(p.xp>=p.xpNeed){
    p.xp-=p.xpNeed; p.level++; p.xpNeed=need(p.level);
    offerLevelup();
  }
}
function offerLevelup(){
  const B=G.B, p=B.hero;
  const wpCount=Object.values(p.wp).filter(v=>v>0).length;
  const avail=Object.keys(UPG).filter(k=>{
    if(curLv(k)>=UPG[k].max) return false;
    if(UPG[k].kind==='wp' && curLv(k)===0 && wpCount>=4) return false;   // 武器枠は4つまで
    return true;
  });
  const evos=readyEvos();
  const pool=avail.concat(evos.map(k=>'EVO:'+k));
  if(!pool.length){
    p.hp=Math.min(p.maxHp,p.hp+40); floatTxt(p.x,p.y-64,'かいふく!','#7ee89a',13,1.4); S.lvup();
    return;
  }
  const opts=shuffle(pool.slice()).slice(0,3);
  let pick=0, bw=-1;
  opts.forEach((k,i)=>{
    let w=1;
    if(k.startsWith('EVO:')) w=6;
    else{
      if(UPG[k].kind==='wp') w=curLv(k)===0?3:2.2;
      if(UPG[k].kind==='wp' && curLv(k)>0) w*=1.5;   // 手持ちの武器を伸ばしたがる
      if(k==='vital' && p.hp<p.maxHp*0.5) w=4;
      w*=p.taste[k]||1;   // 今夜の好み: 噛み合わない夜はビルドが散る
    }
    w*=rand(0.9,1.1);
    if(w>bw){ bw=w; pick=i; }
  });
  B.lvCards={opts,pick,t:0,revealed:false};
  G.mode='levelup';
  S.lvup();
}
function applyUpg(k){
  const B=G.B, p=B.hero;
  if(k.startsWith('EVO:')){
    const id=k.slice(4);
    p.evo[id]=1;
    setBanner('★ 武器融合!', EVOS[id].name, '#ffd76a');
    heroBubble(p,'ちからが、あふれてくる…!',true);
    parts(p.x,p.y-16,30,['#fff','#ffd76a','#8fd3ff'],220,0.8);
    return;
  }
  if(UPG[k].kind==='wp') p.wp[k]++; else p.ps[k]++;
  if(k==='vital'){ p.maxHp=Math.round(p.maxHp)+25; p.hp=Math.min(p.maxHp,p.hp+25); }
  if(k==='ward'){ p.armor++; }
  floatTxt(p.x,p.y-64,UPG[k].name+' Lv'+curLv(k)+'!','#ffd76a',13,1.5);
  heroBubble(p,'つよくなった♪',true);
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
  const B=G.B, d=unitDef(id);
  const elite=o.elite||1;
  // 夜の深まり: 彼女が育つほど、召喚される魔物も強くなる(カード練度でスケール)
  const heroLv=(B.hero&&B.hero.level)||1;
  const nscale=Math.min(1,(d.lv-1)/2);
  const night=MONSTERS[id].boss?1:1+Math.min(BAL.NIGHT_STAT_CAP, BAL.NIGHT_STAT_LV*Math.max(0,heroLv-1))*nscale;
  const pm=(o.mult||1)*night;
  const u={
    id, x, y,
    hp:d.hp*elite*pm, maxHp:d.hp*elite*pm, spd:MONSTERS[id].spd, r:MONSTERS[id].r*(elite>1?1.2:1),
    dmg:d.dmg*elite*pm, xp:Math.round(MONSTERS[id].xp*(1+0.1*(d.lv-1))*(elite>1?1.6:1)),
    enVal:o.enVal||0, boss:!!MONSTERS[id].boss, lv:d.lv, elite:elite>1,
    t:rand(10), joff:rand(TAU), hitFlash:0, orbCd:0, stun:0, dead:false,
    dormant:!!o.dormant, dormT:0, state:'chase', limb:null, seenT:0,
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
  B.enemies.push(u);
  B.spawnFx.push({x,y,t:0,r:MONSTERS[id].r+8, dormant:u.dormant});
  return u;
}
function damageEnemy(e,dmg){
  if(e.dead||e.dormant) return;
  if(G.B&&G.B.hero.dmgMult) dmg*=G.B.hero.dmgMult;   // せいなる火力(自己強化)
  if(e.id==='flower') dmg*=(e.state==='bud'?0.5:1.3);
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
  // 四肢に付いていたら解放
  if(e.limb && h.limbs[e.limb] && h.limbs[e.limb].mon===e){
    h.limbs[e.limb]=null;
    heroBubble(h,'とれたっ!');
  }
  // 繋留の主が死んだら該当繋留も解除
  for(const sl of attachedSlots(h)){
    if(h.limbs[sl].mon===e) h.limbs[sl]=null;
  }
  for(const sl of suckSlots(h)){
    if(h.suckers[sl].mon===e) h.suckers[sl]=null;
  }
  if(h.pinBy===e) h.pinBy=null;
  // 縋りついていた個体が消えれば拘束は解ける(種族への魅了そのものは残る)
  if(h.charmBind && h.charmBind.mon===e) releaseCharmBind(false);
  const col=EN_COLORS[e.id]||['#fff','#aaa'];
  parts(e.x,e.y-e.r,e.boss?42:8,col,e.boss?220:110,0.55);
  S.hit();
  if(e.id==='gas'){ // 断末魔の大放出
    spawnCloud(e.x,e.y,70,7,BAL.SENSIT_GAS*1.2);
  }
  B.en=Math.min(enMax(), B.en+e.enVal*BAL.EN_REFUND);
  B.essence+=e.xp*BAL.ESS_RATE;
  if(e.boss){
    for(let i=0;i<22;i++){
      const a=rand(TAU), d2=rand(10,70);
      dropGem(e.x+Math.cos(a)*d2, e.y+Math.sin(a)*d2, 4);
    }
    setBanner('ボスが討たれた…','大量のエッセンスが残された','#b46cff');
    META.life.herBoss++;
    B.essence+=30;
    G.shake=Math.min(10,G.shake+7);
    S.clear();
  }else{
    dropGem(e.x,e.y,Math.max(1,Math.round(e.xp*0.8)));
  }
}
function dropGem(x,y,v){
  const B=G.B;
  if(B.gems.length>220){ B.gems[(Math.random()*B.gems.length)|0].v+=v; return; }
  B.gems.push({x,y,v,t:rand(10),sp:0});
}
function spawnCloud(x,y,r,life,rate){
  const B=G.B;
  if(B.clouds.length>44) B.clouds.shift();
  B.clouds.push({x,y,r,t:0,life,rate});
  parts(x,y,8,['#ff9ec2','#ffc2d8'],60,0.8);
}

function enemiesUpdate(dt){
  const B=G.B, p=B.hero;
  for(const e of B.enemies){
    if(e.dead) continue;
    e.t+=dt;
    if(e.hitFlash>0) e.hitFlash-=dt;
    if(e.orbCd>0) e.orbCd-=dt;
    if(e.crossCd>0) e.crossCd-=dt;
    if(e.nuzzleCd>0) e.nuzzleCd-=dt;
    e.seenT=inSight(e,p)?e.seenT+dt:0;   // 彼女の視界に入っている時間(反応遅れの基準)

    // 四肢に絡みつき/吸い付き中: ヒロインに追従するだけ
    if(e.state==='attached'){
      const anch=e.suck?suckAnchor(p,e.suck):limbAnchor(p,e.limb);
      e.x=anch.x; e.y=anch.y;
      continue;
    }
    // 魅了拘束の相手: 彼女に縋りつかれてその場を動かない
    if(p.charmBind && p.charmBind.mon===e){
      e.x+=Math.sin(e.t*3)*2*dt; e.y+=Math.cos(e.t*2.6)*2*dt;
      continue;
    }

    const dx=p.x-e.x, dy=p.y-e.y;
    const d=Math.hypot(dx,dy)||0.001;

    if(e.dormant){
      e.dormT+=dt;
      if(d<170 || e.dormT>25){
        e.dormant=false;
        parts(e.x,e.y,10,['#6a5a9c','#3a3158'],120,0.5);
      }else continue;
    }

    if(e.stun>0){ e.stun-=dt; }
    else if(e.boss){
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
    }else{
      // slug / goblin / ghost / slime / mistslime: 通常追跡
      const rush=(attachCount(p)>0||p.pinned||p.charmBind||p.climaxT>0) && d<300 ? 1.9 : 1;
      const ox=Math.cos(e.joff)*14, oy=Math.sin(e.joff)*14;
      const tx=p.x+ox-e.x, ty=p.y+oy-e.y;
      const td=Math.hypot(tx,ty)||0.001;
      e.x+=tx/td*e.spd*rush*dt; e.y+=ty/td*e.spd*rush*dt;
      if(e.id==='ghost'){ e.x+=-ty/td*Math.sin(e.t*2+e.joff)*22*dt; e.y+=tx/td*Math.sin(e.t*2+e.joff)*22*dt; }
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
          spawnCloud(e.x,e.y,26,3.5,BAL.SENSIT_GAS*0.6);
        }
      }
    }
    if(e.id==='slug' && e.charmCd>0) e.charmCd-=dt;

    // オーブ被弾
    if(p.wp.orb>0 && e.orbCd<=0){
      const evo=p.evo.sring>0;
      const n=p.wp.orb;
      for(let i=0;i<n;i++){
        const o=orbPos(i,n);
        if(Math.hypot(e.x-o.x,(e.y-e.r)-o.y)<e.r+(evo?13:9)){
          damageEnemy(e,(evo?16:11+4*(p.wp.orb-1)));
          if(evo) p.hp=Math.min(p.maxHp,p.hp+1);
          e.orbCd=0.4;
          parts(o.x,o.y,3,['#fff','#ffd76a'],90,0.3);
          break;
        }
      }
    }

    // 接触
    if(!e.dead && !e.dormant && e.state!=='attached' && p.ifr<=0
       && e.id!=='flower' && e.id!=='imp' && e.id!=='gas'
       && Math.hypot(e.x-p.x,e.y-p.y)<e.r+p.r){
      contactHit(e);
    }
  }
  B.enemies=B.enemies.filter(e=>!e.dead);
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
    spawnCloud(e.x,e.y-4,62,6.5,BAL.SENSIT_GAS);
    sfx(200,90,0.3,'sine',0.03);
  }
}
function impTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
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
  if(e.id==='slug'){
    if(e.charmCd<=0){
      e.charmCd=6;
      applyCharm(e);
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
  const atk=attachCount(p);
  const mult=p.pinned?BAL.PIN_DMG_MULT:((atk>0||p.charmBind)?BAL.ATTACH_DMG_MULT:1);
  const armor=opt.pierce?0:Math.max(0,p.armor-atk);
  const net=Math.max(0, dmg*mult-armor);
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
  while(B.dmgCarry>=BAL.ORB_DMG_STEP){ B.dmgCarry-=BAL.ORB_DMG_STEP; B.orbFrag++; S.coin(); }
  if(!opt.quiet){
    p.ifr=p.pinned?0.3:(atk>0?0.35:0.55);
    G.hurtFlash=0.3; G.shake=Math.min(8,G.shake+3);
    if(!opt.noKb && src && !p.pinned){
      const dx=p.x-src.x, dy=p.y-src.y, d=Math.hypot(dx,dy)||1;
      p.x+=dx/d*16; p.y+=dy/d*16;
    }
    heroBubble(p,'いたっ…!');
    S.hurt();
    parts(p.x,p.y-12,6,['#ff86b3','#fff'],120,0.4);
    floatTxt(p.x+rand(-8,8),p.y-34,'-'+Math.round(net),'#ff9db4',11,0.7);
  }
  if(p.hp<=0){ p.hp=0; beginCapture(src,'hp'); }
}
function beginCapture(src,cause){
  const B=G.B;
  if(G.mode!=='battle'&&G.mode!=='levelup') return;
  G.mode='captured';
  B.captureT=2.8;
  B.capturedBy=src?src.id:'default';
  B.captureCause=cause||'hp';
  B.hero.pinned=true;
  const bub={stamina:'ちから、が……はいらな……', charm:'だって……はなれたく、な……', hp:'そんな……っ'};
  const sub={stamina:'ルミナは力尽き、組み伏せられた', charm:'ルミナは魅了に蕩けたまま、力尽きた', hp:'ルミナは魔物たちに捕らえられた'};
  heroBubble(B.hero, bub[cause]||bub.hp, true, 3);
  setBanner('敗北 — 観測終了', sub[cause]||sub.hp,'#c98cff');
  S.capture();
  G.shake=Math.min(10,G.shake+6);
}

/* ================= 弾/回収物/燭台 ================= */
function bulletsUpdate(dt){
  const B=G.B, p=B.hero;
  for(const b of B.bullets){
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
        if(e.dead||e.dormant||e.state==='attached'||(e.crossCd||0)>0) continue;
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
      if(e.dead||e.dormant||e===b.last||e.state==='attached') continue;
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
}
function spawnInitialProps(){
  const B=G.B;
  for(let i=0;i<BAL.PROP_INIT;i++){
    const a=i*TAU/BAL.PROP_INIT+rand(-0.4,0.4), d=rand(220,520);
    B.props.push({x:Math.cos(a)*d, y:Math.sin(a)*d, hp:BAL.PROP_HP, max:BAL.PROP_HP, t:rand(10)});
  }
}
function damageProp(pr,dmg){
  const B=G.B;
  pr.hp-=dmg;
  parts(pr.x,pr.y-14,3,['#ffd76a','#c9a06a'],80,0.35);
  if(pr.hp<=0 && !pr.dead){
    pr.dead=true;
    parts(pr.x,pr.y-10,14,['#ffd76a','#fff','#c9a06a'],160,0.6);
    sfx(320,120,0.2,'square',0.07);
    if(Math.random()<0.75) B.hearts.push({x:pr.x,y:pr.y,t:0});
    else for(let i=0;i<3;i++) dropGem(pr.x+rand(-16,16),pr.y+rand(-10,10),2);
    B.props=B.props.filter(q=>q!==pr);
  }
}
function pickupsUpdate(dt){
  const B=G.B, p=B.hero, st=heroStat(p);
  for(const gm of B.gems){
    gm.t+=dt;
    const dx=p.x-gm.x, dy=(p.y-10)-gm.y;
    const d=Math.hypot(dx,dy)||0.001;
    if(d<st.magnet) gm.sp+=1400*dt;
    if(gm.sp>0){
      const mv=Math.min(gm.sp*dt,d);
      gm.x+=dx/d*mv; gm.y+=dy/d*mv;
    }
    if(d<16){
      gm.dead=true;
      p.xp+=gm.v*(1+0.12*p.ps.growth);   // ラーニングピアス
      B.heroCoins+=gm.v*0.5;             // 彼女はコインも貯えている(夜明けの自己強化)
      S.gem();
      parts(p.x,p.y-14,3,['#8fd3ff','#fff'],70,0.3);
      maybeLevelup();
      if(G.mode!=='battle') break;
    }
  }
  B.gems=B.gems.filter(g=>!g.dead);
  for(const h of B.hearts){
    h.t+=dt;
    if(Math.hypot(h.x-p.x,h.y-(p.y-10))<20){
      h.dead=true;
      p.hp=Math.min(p.maxHp,p.hp+30);
      floatTxt(p.x,p.y-58,'+30','#7ee89a',13,1);
      heroBubble(p,'かいふく♪');
      S.heart();
    }
  }
  B.hearts=B.hearts.filter(h=>!h.dead);
  for(const c of B.chests){
    c.t+=dt;
    if(!c.taken && Math.hypot(c.x-p.x,c.y-(p.y-6))<22){
      c.taken=true;
      openChest();
    }
  }
  B.chests=B.chests.filter(c=>!c.taken);
  for(const tr of B.trails){
    tr.t+=dt;
    if(Math.hypot(tr.x-p.x,tr.y-p.y)<tr.r+p.r-2) p.slow=Math.max(p.slow,0.3);
  }
  B.trails=B.trails.filter(tr=>tr.t<tr.life);
  for(const c of B.clouds){ c.t+=dt; }
  B.clouds=B.clouds.filter(c=>c.t<c.life);
}
function openChest(){
  const B=G.B, p=B.hero;
  S.chest();
  parts(p.x,p.y-10,20,['#ffd76a','#fff','#8fd3ff'],180,0.7);
  const evos=readyEvos();
  if(evos.length){ applyUpg('EVO:'+evos[0]); return; }
  const wpCount=Object.values(p.wp).filter(v=>v>0).length;
  const avail=Object.keys(UPG).filter(k=>{
    if(curLv(k)>=UPG[k].max) return false;
    if(UPG[k].kind==='wp' && curLv(k)===0 && wpCount>=4) return false;   // 武器枠は4つまで
    return true;
  });
  if(avail.length){
    const k=pickRand(avail);
    applyUpg(k);
    setBanner('宝箱!', UPG[k].name+' を入手', '#ffd76a');
  }else{
    p.hp=p.maxHp;
    setBanner('宝箱!', '全回復した', '#ffd76a');
  }
}

/* ================= カードプレイ(プレイヤー側) ================= */
function handSlot(id){ return G.B.hand.find(h=>h.id===id); }
function playCost(id, formId){
  const lv=(META.cards[id]&&META.cards[id].lv)||1;
  const f=FORMATIONS[formId];
  if(MONSTERS[id].boss) return cardCost(id,lv);
  return Math.max(1, Math.ceil(cardCost(id,lv)*f.factor));
}
function canPlay(id, formId){
  const B=G.B;
  if(!B || G.mode!=='battle') return {ok:false};
  const slot=handSlot(id);
  if(!slot) return {ok:false};
  if(slot.cdT>0) return {ok:false, why:'cd'};
  if(MONSTERS[id].boss && B.bossUsed) return {ok:false, why:'boss'};
  if(B.enemies.length>=BAL.FIELD_CAP) return {ok:false, why:'cap'};
  const cost=playCost(id,formId);
  if(B.en<cost) return {ok:false, why:'en'};
  return {ok:true, cost};
}
function playCard(id, formId){
  const B=G.B;
  const chk=canPlay(id,formId);
  if(!chk.ok){ if(chk.why==='en') S.deny(); return false; }
  const p=B.hero, f=FORMATIONS[formId], cost=chk.cost;
  B.en-=cost;
  const slot=handSlot(id);
  slot.cdMax=BAL.CARD_CD_BASE+cost*BAL.CARD_CD_COST;
  slot.cdT=slot.cdMax;
  S.summon();

  if(MONSTERS[id].boss){
    B.bossUsed=true;
    const a=rand(TAU);
    spawnUnit(id, p.x+Math.cos(a)*620, p.y+Math.sin(a)*620, {enVal:cost});
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
  // 夜の深まり: 彼女のLvに応じて多数陣形の頭数も増える(こちらも練度でスケール)
  const comboExtra=Math.floor((comboN-1)/BAL.COMBO_UNIT_PER);
  const nightExtra=Math.min(BAL.NIGHT_UNIT_MAX, Math.floor(p.level/BAL.NIGHT_UNIT_LV));
  const extra=Math.floor((comboExtra+nightExtra)*pscale);
  const multi=(formId==='scatter'||formId==='wave'||formId==='ring'||formId==='ambush');
  const m0=MONSTERS[id];
  // solo(小淫魔/ガス玉)は数が増えない。swarm持ち(鈍足の群れ)は頭数が倍化する(Lv2+)
  const sw=(m0.swarm||1)>1 && clv>=2 ? m0.swarm : 1;
  const lvExtra=Math.floor((clv-1)/2);   // カードLvは頭数で強くなる(Lv3:+1 / Lv5:+2)
  let n=f.count;
  if(!m0.solo && multi) n=Math.ceil((f.count+extra+lvExtra)*sw);
  const per=cost/n;
  const so={enVal:per, mult:comboMult};

  if(formId==='scatter'||formId==='single'){
    for(let i=0;i<n;i++){
      const a=rand(TAU);
      spawnUnit(id, p.x+Math.cos(a)*560, p.y+Math.sin(a)*560,
        Object.assign({elite:f.elite||1}, so));
    }
  }else if(formId==='wave'){
    const a=rand(TAU);
    const cx=p.x+Math.cos(a)*580, cy=p.y+Math.sin(a)*580;
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
      spawnUnit(id, p.x+Math.cos(ang+spread)*d2, p.y+Math.sin(ang+spread)*d2,
        Object.assign({dormant:id!=='flower'}, so));
    }
  }else if(formId==='ring'){
    const rot=rand(TAU);
    for(let i=0;i<n;i++){
      const a=rot+i*TAU/n+rand(-0.12,0.12);
      spawnUnit(id, p.x+Math.cos(a)*300, p.y+Math.sin(a)*225, so);
    }
  }
  return true;
}

/* ================= オート指揮 ================= */
const BINDERS=['worm','gtent','flower'];
const PRESSURE=['ghost','goblin','mistslime','slime','slug'];
function bestForm(prefer){
  for(const f of prefer){ if(META.formations.includes(f)) return f; }
  return META.formations[0];
}
function autoDirector(dt){
  const B=G.B;
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

  // 1) 拘束中・押し倒し中は畳みかける(最大2プレイ)
  if(held){
    let plays=0;
    for(const id of PRESSURE.concat(['worm'])){
      if(plays>=2) break;
      if(!has(id)) continue;
      for(const f of [bestForm(['wave','ring','scatter']), 'scatter']){
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
    for(const id of ['worm','gtent','flower']){
      if(!has(id)) continue;
      const f=id==='flower'?bestForm(['ambush','scatter']):bestForm(['wave','scatter']);
      if(ready(id,f)){ playCard(id,f); return; }
    }
  }

  // 3) 拘束役の維持
  if(binderN===0){
    for(const id of ['gtent','worm','flower']){
      if(!has(id)) continue;
      const f=id==='flower'?bestForm(['ambush','scatter']):bestForm(['single','scatter']);
      const chk=canPlay(id,f);
      if(chk.ok && B.en>=chk.cost+4){ playCard(id,f); return; }
    }
  }

  // 3.5) コンボ継続: 直前カードの連鎖が生きていて余裕があれば重ねる
  const lp=B.lastPlay;
  if(lp && !MONSTERS[lp.id].boss && B.combo[lp.id]){
    const cb=B.combo[lp.id];
    if(B.time-cb.t<=BAL.COMBO_WINDOW-1.5 && cb.n<BAL.COMBO_MAX && has(lp.id)){
      const f=bestForm(['wave','scatter']);
      const chk=canPlay(lp.id,f);
      if(chk.ok && B.en>=chk.cost+6){ playCard(lp.id,f); return; }
    }
  }

  // 4) ガスの維持(場に無ければ)——媚薬=敏感化の下地を作る
  if(has('gas') && !alive.some(e=>e.id==='gas') && sensLvOf(p)<2){
    const f=bestForm(['single','scatter']);
    const chk=canPlay('gas',f);
    if(chk.ok && B.en>=chk.cost+4){ playCard('gas',f); return; }
  }

  // 4.5) 敏感化が乗っているなら吸液羽虫で快感を注ぐ
  if(has('leech') && (sensLvOf(p)>=1||p.aphro>30) && alive.filter(e=>e.id==='leech').length<3){
    const f=bestForm(['wave','scatter']);
    const chk=canPlay('leech',f);
    if(chk.ok && B.en>=chk.cost+3){ playCard('leech',f); return; }
  }

  // 4.6) 魅了の種まき: ナメクジが場に薄ければ足す(段階UPは接触の積み重ね)
  if(has('slug') && alive.filter(e=>e.id==='slug').length<2 && charmMaxLv(p)<3 && B.time>15){
    const chk=canPlay('slug','scatter');
    if(chk.ok && B.en>=chk.cost+5){ playCard('slug','scatter'); return; }
  }

  // 5) 小淫魔を1体まとわりつかせる
  if(has('imp') && !alive.some(e=>e.id==='imp')){
    const f=bestForm(['single','scatter']);
    const chk=canPlay('imp',f);
    if(chk.ok && B.en>=chk.cost+4){ playCard('imp',f); return; }
  }

  // 6) ボス: 中盤以降・EN潤沢・彼女が万全でないとき
  for(const slot of B.hand){
    if(!MONSTERS[slot.id].boss) continue;
    if(B.time>90 && B.time<BAL.RUN_TIME-60 && (hpRatio<0.8||stamRatio<0.6) && ready(slot.id,'scatter') && B.en>playCost(slot.id,'scatter')+8){
      playCard(slot.id,'scatter'); return;
    }
  }

  // 7) EN満杯なら大きく使う(包囲)
  if(B.en>enMax()*0.9){
    for(const id of ['ghost','goblin','mistslime','slime','worm','slug']){
      if(!has(id)) continue;
      const f=bestForm(['ring','wave','scatter']);
      if(ready(id,f)){ playCard(id,f); return; }
    }
  }

  // 8) 圧が切れているなら安価に補充
  if(alive.length<5 && B.en>enMax()*0.45){
    for(const id of ['goblin','slug','worm','ghost','slime']){
      if(has(id) && ready(id,'scatter')){ playCard(id,'scatter'); return; }
    }
  }
}

/* ================= 戦闘tick ================= */
function battleTick(dt){
  const B=G.B, p=B.hero;
  B.time+=dt;

  if(B.time>=BAL.RUN_TIME){
    for(const e of B.enemies) parts(e.x,e.y-e.r,6,['#fff','#8fd3ff'],130,0.6);
    B.enemies.length=0;
    for(const sl of attachedSlots(p)) p.limbs[sl]=null;
    for(const sl of suckSlots(p)) p.suckers[sl]=null;
    p.pinned=false; p.charmBind=null; p.charmDrift=null; p.charms.length=0;
    p.climaxT=0;
    B.pinScene=null;
    setBanner('✨ 生存 ✨','ルミナは今夜も守りきった','#ffd76a');
    heroBubble(p,'やりきったよ〜!',true);
    G.mode='survived'; B.winT=1.8;
    S.clear();
    return;
  }

  p.anim+=dt;
  if(p.ifr>0) p.ifr-=dt;
  if(p.bubbleT>0) p.bubbleT-=dt;
  if(p.bubbleCd>0) p.bubbleCd-=dt;
  if(p.novaAnim>0) p.novaAnim-=dt;
  if(p.whipAnim>0) p.whipAnim-=dt;
  p.hp=Math.min(p.maxHp,p.hp+p.regen*dt);   // 清廉のご加護

  condTick(p,dt);
  if(p.climaxT>0){ climaxTick(dt); }
  if(p.pinned){ pinTick(dt); if(G.mode!=='battle') return; }
  else if(p.charmBind){ charmBindTick(dt); if(G.mode!=='battle') return; }
  for(const st of B.stains) st.t+=dt;
  B.stains=B.stains.filter(st=>st.t<st.life);
  // 小淫魔: 近くの数を数える(集中低下)。快感は煽りアクション時のみ(バーストCD持ち)
  if(B.impBurstCd>0) B.impBurstCd-=dt;
  p.teaseN=0;
  for(const e of B.enemies){
    if(!e.dead&&e.id==='imp'&&Math.hypot(e.x-p.x,e.y-p.y)<120) p.teaseN++;
  }
  aiUpdate(dt);
  weaponsUpdate(dt);
  bulletsUpdate(dt);
  enemiesUpdate(dt);
  if(G.mode!=='battle') return;
  pickupsUpdate(dt);

  // EN回復
  B.en=Math.min(enMax(), B.en+(BAL.EN_REGEN+BAL.EN_REGEN_LV*p.level)*dt);
  for(const slot of B.hand){ if(slot.cdT>0) slot.cdT-=dt; }

  // 燭台の追加出現
  B.propT-=dt;
  if(B.propT<=0 && B.props.length<8){
    B.propT=BAL.PROP_RESPAWN;
    const a=rand(TAU), d=rand(260,500);
    B.props.push({x:p.x+Math.cos(a)*d, y:p.y+Math.sin(a)*d, hp:BAL.PROP_HP, max:BAL.PROP_HP, t:0});
  }

  // 宝箱
  if(B.chestIdx<BAL.CHEST_TIMES.length && B.time>=BAL.CHEST_TIMES[B.chestIdx]){
    B.chestIdx++;
    const a=rand(TAU), d=rand(300,460);
    B.chests.push({x:p.x+Math.cos(a)*d, y:p.y+Math.sin(a)*d, t:0, taken:false});
    setBanner('宝箱が どこかに おちた','ルミナが見つけると強化されてしまう…','#8fd3ff');
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
    if(d>36){ e.x+=dx/d*60*dt; e.y+=dy/d*60*dt; }
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
  if(B.winT<=0) endBattle('survive');
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
