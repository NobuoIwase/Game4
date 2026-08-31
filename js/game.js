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
  const h={
    x:0, y:0, vx:0, vy:0, r:10,
    maxHp:Math.round(120*(1+0.18*gb)), hp:0,
    armor:Math.max(0, 5 + gb - aArmor),
    regen:(0.55+0.15*gb)*(1-0.3*aRegen),
    baseSpeed:150*(1-0.06*aSpeed),
    level:1, xp:0, xpNeed:need(1),
    wp:{bolt:1, orb:0, nova:0}, ps:{speed:0, vital:0, magnet:0},
    evo:{sstar:0, sring:0, sburst:0},
    boltT:0.6, novaT:2.5, orbAng:0, novaAnim:0, novaR:0,
    ifr:0, face:1, moving:false, anim:rand(10),
    strafeDir:Math.random()<0.5?-1:1, strafeT:2,
    bubble:'', bubbleT:0, bubbleCd:0, aiLabel:'けいかい中', aiState:'',
    /* --- スタミナ / 四肢拘束 / 押し倒し --- */
    staminaMax:BAL.STAMINA_MAX-12*aStam,
    stamina:0,
    limbs:{armL:null, armR:null, legL:null, legR:null},
    struggle:0,
    pinned:false, pinBy:null, pinT:0, pinEscape:0,
    exhausted:false,               // スタミナ0で四肢が自由だった場合の疲弊
    /* --- 媚薬 / 発情 / その他状態 --- */
    aphro:18*aHeat, heatT:0,
    slow:0, charm:0, charmBy:null,
    teaseN:0,                      // 近くの小淫魔の数(集中低下)
    resist:{bound:0, charm:0},
    sense:1+0.18*aSense,
    focusPen:0.12*aFocus,
    stumbleT:rand(2,3), stumbleDur:0,
    propTarget:null,
    prevX:0, prevY:0,
  };
  // 戦闘経験の継承(世代内で強くなる)
  if(gb>=1) h.wp.bolt=2;
  if(gb>=2) h.wp.orb=1;
  if(gb>=3){ h.wp.nova=1; h.ps.speed=1; }
  h.hp=h.maxHp;
  h.stamina=h.staminaMax;
  return h;
}
const attachedSlots=h=>LIMBS.filter(k=>h.limbs[k]);
const attachCount=h=>attachedSlots(h).length;
const armCount=h=>['armL','armR'].filter(k=>h.limbs[k]).length;
const legCount=h=>['legL','legR'].filter(k=>h.limbs[k]).length;

function heroFocus(h){
  const aph=h.heatT>0 ? 0.35 : h.aphro/100*0.2;
  return clamp(1 - aph - h.focusPen - 0.08*Math.min(2,h.teaseN), 0.25, 1);
}
function heroStat(h){
  let spd=h.baseSpeed*(1+0.10*h.ps.speed);
  spd*=Math.pow(0.72, legCount(h));
  if(h.slow>0) spd*=0.55;
  if(h.heatT>0) spd*=0.88;
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
    heroLv:B.hero.level, capturedBy:B.capturedBy, cause:B.captureCause});
}

/* ================= 状態付与 ================= */
function heroBubble(h,txt,force){
  if(!force && h.bubbleCd>0) return;
  h.bubble=txt; h.bubbleT=1.7; h.bubbleCd=0.9;
}
function awardAil(type){
  const B=G.B;
  const rt=B.ailRateT[type]||0;
  if(B.time-rt>2){ B.ailRateT[type]=B.time; B.orbFrag+=BAL.ORB_PER_AIL; B.ailCount++; }
}
function applyCharm(dur,src){
  const h=G.B.hero;
  const eff=dur*h.sense/(1+0.35*(h.resist.charm||0));
  if(eff<0.4) return;
  h.charm=Math.max(h.charm,eff);
  h.charmBy=src||null;
  h.resist.charm=(h.resist.charm||0)+1;
  heroBubble(h,'え…なんで、めが…はなせな…');
  S.charm();
  awardAil('charm');
}
function applyAphro(amount){
  const h=G.B.hero;
  const before=h.aphro;
  h.aphro=clamp(h.aphro+amount*h.sense,0,100);
  if(before<50&&h.aphro>=50) heroBubble(h,'なんか、あまいにおい…');
  if(h.aphro>=100 && h.heatT<=0){
    h.heatT=BAL.HEAT_DUR;
    heroBubble(h,'あつい……へんに、なりそ…っ',true);
    parts(h.x,h.y-20,14,['#ff9ec2','#ff5d9e'],120,0.7);
    sfx(520,860,0.4,'sine',0.07);
    awardAil('heat');
  }
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
  heroBubble(h, pickRand(['からみついてる…っ!','はなれてっ…!','やだ、脚に…っ!']), true);
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
function oldestAttachment(h){
  let best=null, bs=null;
  for(const sl of LIMBS){
    const at=h.limbs[sl];
    if(at && (!best || at.t<best.t)){ best=at; bs=sl; }
  }
  return bs?{slot:bs, at:best}:null;
}
function addStruggle(amount){
  const h=G.B.hero;
  if(attachCount(h)===0||h.pinned) return;
  if(h.stamina<=0) return;
  h.struggle+=amount*(h.heatT>0?0.7:1);
  const o=oldestAttachment(h);
  if(o && h.struggle>=o.at.need){
    h.struggle=0;
    detachLimb(o.slot,{fling:true});
    h.stamina-=BAL.STAMINA_RIP_COST;
    heroBubble(h,'えいっ…!');
    sfx(300,700,0.15,'triangle',0.07);
    floatTxt(h.x,h.y-52,'ふりほどいた!','#8fd3ff',11,1);
    checkStaminaCollapse();
  }
}
function checkStaminaCollapse(){
  const h=G.B.hero;
  if(h.stamina>0) return;
  h.stamina=0;
  if(attachCount(h)>0||h.pinned){
    const o=oldestAttachment(h);
    beginCapture(h.pinBy||(o&&o.at.mon)||null,'stamina');
  }else{
    h.exhausted=true;
    heroBubble(h,'はぁ……はぁ……',true);
  }
}
/* --- 押し倒し --- */
function enterPin(mon){
  const B=G.B, h=B.hero;
  h.pinned=true; h.pinBy=mon||null;
  h.pinT=BAL.PIN_PULSE_T; h.pinEscape=0;
  h.vx=0; h.vy=0;
  B.pinScene=sceneFor('pin', mon?mon.id:'default');
  B.pinSceneIdx=0; B.pinSceneT=0;
  setBanner('押し倒された!','もがいて逃れろ——スタミナかHPが尽きれば敗北','#ff5d7a');
  heroBubble(h,'はなれて……っ!',true);
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
    h.pinEscape+=BAL.PIN_ESCAPE_GAIN*(h.heatT>0?0.7:1)*rand(0.85,1.15);
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
      heroBubble(h,'まだ……まけないっ!',true);
      setBanner('振りほどいた!','ルミナは立ち上がった','#8fd3ff');
      B.pinScene=null;
    }
  }
}

/* ================= 状態tick ================= */
function condTick(h,dt){
  // 媚薬 / 発情
  if(h.heatT>0){
    h.heatT-=dt;
    if(h.heatT<=0){ h.heatT=0; h.aphro=BAL.HEAT_AFTER; heroBubble(h,'……いまの、なに…'); }
  }else if(h.aphro>0){
    h.aphro=Math.max(0,h.aphro-BAL.APHRO_DECAY*dt);
  }
  if(h.slow>0) h.slow-=dt;
  if(h.charm>0){ h.charm-=dt; if(h.charm<=0) h.charmBy=null; }
  for(const k in h.resist) h.resist[k]=Math.max(0,h.resist[k]-dt*0.04);
  // 2箇所以上絡みつかれていると体力がじわじわ奪われる
  if(!h.pinned && attachCount(h)>=2){
    h.stamina=Math.max(0,h.stamina-BAL.STAMINA_DRAG*dt);
    checkStaminaCollapse();
    if(G.mode!=='battle'&&G.mode!=='levelup') return;
  }
  // スタミナ回復
  if(!h.pinned && attachCount(h)===0){
    const rg=h.heatT>0?BAL.STAMINA_REGEN_HEAT:BAL.STAMINA_REGEN;
    h.stamina=Math.min(h.staminaMax,h.stamina+rg*dt);
    if(h.exhausted && h.stamina>25){ h.exhausted=false; heroBubble(h,'……よし、いける'); }
  }
  // 発情のふらつき
  if(h.stumbleDur>0) h.stumbleDur-=dt;
  h.stumbleT-=dt;
  if(h.heatT>0 && h.stumbleT<=0 && !h.pinned){
    h.stumbleT=rand(2.2,3.6); h.stumbleDur=0.35;
    heroBubble(h,'あしが…もつれ…っ');
  }
  // ガス雲の吸引
  const B=G.B;
  for(const c of B.clouds){
    if(Math.hypot(h.x-c.x,(h.y-12)-c.y)<c.r){
      applyAphro(c.rate*dt);
      break;
    }
  }
}

/* ================= ヒロインAI ================= */
function aiUpdate(dt){
  const B=G.B, p=B.hero, st=heroStat(p);
  p.prevX=p.x; p.prevY=p.y;

  if(p.pinned || p.stumbleDur>0){
    p.vx*=Math.pow(0.001,dt); p.vy*=Math.pow(0.001,dt);
    p.moving=false;
    p.aiLabel=p.pinned?'おさえこまれている!!':'ふらつき…';
    return;
  }

  let ax=0, ay=0, threat=0, bossNear=false;
  for(const e of B.enemies){
    if(e.dead||e.dormant||e.state==='attached') continue;
    if(e.id==='flower' && !e.revealed) continue;
    if(e===p.charmBy) continue;
    if(e.id==='imp') continue;                                 // 小淫魔からは逃げない(脅威と認識しない)
    const dx=p.x-e.x, dy=p.y-e.y;
    const d=Math.hypot(dx,dy)||0.001;
    const DANGER={flower:130, gtent:90, slug:55, worm:55, gas:60, slime:110};
    const danger=(e.boss?280:(DANGER[e.id]!==undefined?DANGER[e.id]:150))+e.r;
    if(d<danger){
      let w=1-d/danger; w=w*w*(e.boss?3:1);
      threat+=w; ax+=dx/d*w; ay+=dy/d*w;
      if(e.boss) bossNear=true;
    }
  }
  // 粘液・ガス雲の回避(集中が低いと避けきれない)
  const foc=heroFocus(p);
  for(const tr of B.trails){
    const dx=p.x-tr.x, dy=p.y-tr.y, d=Math.hypot(dx,dy)||0.001;
    if(d<40){ ax+=dx/d*0.35; ay+=dy/d*0.35; }
  }
  for(const c of B.clouds){
    const dx=p.x-c.x, dy=p.y-c.y, d=Math.hypot(dx,dy)||0.001;
    if(d<c.r+30){ ax+=dx/d*0.35*foc; ay+=dy/d*0.35*foc; }
  }

  p.strafeT-=dt;
  if(p.strafeT<=0){ p.strafeDir*=-1; p.strafeT=rand(2,4.5); }

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
      let td=430;
      for(const gm of B.gems){
        const d=Math.hypot(gm.x-p.x,gm.y-p.y);
        if(d<td){ td=d; target=gm; kind='gem'; }
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
  // 媚薬・煽りによるノイズ(思考の乱れ)
  if(foc<1){
    const n=(1-foc)*1.1;
    dx+=Math.sin(B.time*3.1+p.anim*7)*n;
    dy+=Math.cos(B.time*2.7+p.anim*5)*n;
  }

  const m=Math.hypot(dx,dy);
  const tvx=m>0.001?dx/m*st.speed:0;
  const tvy=m>0.001?dy/m*st.speed:0;
  const k=Math.min(1,dt*8*foc);
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
  if(attachCount(p)>0) addStruggle(moved*BAL.STRUGGLE_MOVE_RATE);

  if(Math.abs(p.vx)>12) p.face=p.vx>0?1:-1;
  p.moving=Math.hypot(p.vx,p.vy)>30;

  const LBL={flee:'かいひ行動!', boss:'ボスかいひ!!', gem:'ジェム回収', heart:'ハートへ!',
    prop:'燭台をこわして回復!', chest:'たからばこへ!', kite:'まちうけ・けん制', wait:'けいかい中',
    struggle:'ふりほどこうともがいている!'};
  const BBL={flee:'にげなきゃ〜!', boss:'おっきいのこわい!!', gem:'キラキラかいしゅう♪',
    heart:'ハートみっけ!', prop:'燭台こわして回復しなきゃ', chest:'たからばこだ〜!',
    kite:'このきょりキープ…', wait:'つぎはどこから…?', struggle:'はなれてよ〜っ!'};
  p.aiLabel=LBL[state];
  if(state!==p.aiState){ p.aiState=state; heroBubble(p,BBL[state]); }
}

/* ================= ヒロイン武器 ================= */
function nearestEnemies(n,maxD){
  const B=G.B, p=B.hero;
  const arr=[];
  for(const e of B.enemies){
    if(e.dead||e.dormant||e.state==='attached') continue;
    if(e===p.charmBy) continue;
    const d=Math.hypot(e.x-p.x,e.y-p.y);
    if(d<maxD) arr.push({e,d});
  }
  arr.sort((a,b)=>a.d-b.d);
  return arr.slice(0,n).map(o=>o.e);
}
function weaponsUpdate(dt){
  const B=G.B, p=B.hero;
  const atkMult=(p.pinned?0:1)*Math.pow(0.75,armCount(p));   // 腕を拘束されるほど攻撃が乱れる
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
            dmg:13+4*(lv-1), pierce:0, life:1.2, last:null, evo:false});
          S.pew();
          if(attachCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN);
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
              dmg:(evo?18:13+4*(lv-1)), pierce:evo?2:(lv>=4?1:0), life:1.3, last:null, evo});
          }
          S.pew();
          if(attachCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN);
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
      const R=(evo?165:85+16*(lv-1)), dmg=(evo?30:14+6*(lv-1));
      p.novaAnim=0.5; p.novaR=R;
      G.shake=Math.min(7,G.shake+3);
      S.nova();
      for(const e of B.enemies){
        if(e.dead||e.dormant||e===p.charmBy) continue;
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
      if(attachCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN);
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
  const avail=Object.keys(UPG).filter(k=>curLv(k)<UPG[k].max);
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
      if(k==='vital' && p.hp<p.maxHp*0.5) w=4;
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
  const u={
    id, x, y,
    hp:d.hp*elite, maxHp:d.hp*elite, spd:MONSTERS[id].spd, r:MONSTERS[id].r*(elite>1?1.2:1),
    dmg:d.dmg*elite, xp:Math.round(MONSTERS[id].xp*(1+0.1*(d.lv-1))*(elite>1?1.6:1)),
    enVal:o.enVal||0, boss:!!MONSTERS[id].boss, lv:d.lv, elite:elite>1,
    t:rand(10), joff:rand(TAU), hitFlash:0, orbCd:0, stun:0, dead:false,
    dormant:!!o.dormant, dormT:0, state:'chase', limb:null,
  };
  if(id==='worm'){ u.pounceCd=rand(1,2); u.pounceT=0; }
  if(id==='slug'){ u.charmCd=0; }
  if(id==='gas'){ u.puffT=rand(0.8,1.6); }
  if(id==='imp'){ u.orbitA=rand(TAU); u.orbitDir=Math.random()<0.5?-1:1; u.dodgeCd=0; u.teaseT=rand(1,3); }
  if(id==='flower'){ u.state='bud'; u.revealed=false; u.dotAcc=0; u.openT=0; }
  if(id==='gtent'){ u.grabCd=1.5; u.whipT=0; u.state='idle'; }
  if(id==='slime'||id==='mistslime'){ u.trailT=0; }
  if(u.boss){ u.bstate='chase'; u.bt=3.2; u.cdx=0; u.cdy=0; }
  B.enemies.push(u);
  B.spawnFx.push({x,y,t:0,r:MONSTERS[id].r+8, dormant:u.dormant});
  return u;
}
function damageEnemy(e,dmg){
  if(e.dead||e.dormant) return;
  if(e.id==='flower') dmg*=(e.state==='bud'?0.5:1.3);
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
  if(h.pinBy===e) h.pinBy=null;
  const col=EN_COLORS[e.id]||['#fff','#aaa'];
  parts(e.x,e.y-e.r,e.boss?42:8,col,e.boss?220:110,0.55);
  S.hit();
  if(e.id==='gas'){ // 断末魔の大放出
    spawnCloud(e.x,e.y,70,7,BAL.APHRO_GAS*1.2);
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

    // 四肢に絡みつき中: ヒロインに追従するだけ
    if(e.state==='attached'){
      const anch=limbAnchor(p,e.limb);
      e.x=anch.x; e.y=anch.y;
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
    }else{
      // slug / ghost / slime / mistslime: 通常追跡
      const rush=(attachCount(p)>0||p.pinned) && d<300 ? 1.9 : 1;
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
          spawnCloud(e.x,e.y,26,3.5,BAL.APHRO_GAS*0.6);
        }
      }
    }
    if(e.id==='slug' && e.charmCd>0) e.charmCd-=dt;

    // オーブ被弾
    if(p.wp.orb>0 && e.orbCd<=0 && e!==p.charmBy){
      const evo=p.evo.sring>0;
      const n=p.wp.orb;
      for(let i=0;i<n;i++){
        const o=orbPos(i,n);
        if(Math.hypot(e.x-o.x,(e.y-e.r)-o.y)<e.r+(evo?13:9)){
          damageEnemy(e,(evo?14:9+3*(p.wp.orb-1)));
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
  const rush=(attachCount(p)>0||p.pinned) && d<300 ? 1.7 : 1;
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
    spawnCloud(e.x,e.y-4,62,6.5,BAL.APHRO_GAS);
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
    applyAphro(BAL.APHRO_IMP*dt);
    e.teaseT-=dt;
    if(e.teaseT<=0){
      e.teaseT=rand(2.2,3.8);
      floatTxt(e.x,e.y-e.r-12,pickRand(['♪','♡','ふふっ','こっちこっち♪']),'#ffb3cf',10,1);
      if(Math.random()<0.4) heroBubble(p,pickRand(['み、みないでっ!','からかわないで!','うぅ…ちょこまかと…']));
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
    e.grabCd=2.5;
    return;
  }
  e.grabCd-=dt;
  if(e.whipT>0){
    e.whipT-=dt;
    if(e.whipT<=0 && Math.hypot(p.x-e.x,p.y-e.y)<125){
      if(attachMonster(e,'tether',{r:115})){
        hurtHero(e.dmg*0.5,e,{noKb:true});
      }
      e.grabCd=4.5;
    }
    return;
  }
  e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt;
  if(d<110 && e.grabCd<=0){ e.whipT=0.3; sfx(140,60,0.2,'sawtooth',0.07); }
}
function contactHit(e){
  const p=G.B.hero;
  if(e.id==='worm'){
    if(attachMonster(e,'cling')) return;   // 絡みつき成功時はダメージなし
    hurtHero(e.dmg,e,{});
    return;
  }
  if(e.id==='slug'){
    if(e.charmCd<=0){
      e.charmCd=6;
      applyCharm(2.2,e);
      applyAphro(4);
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
  const mult=p.pinned?BAL.PIN_DMG_MULT:(atk>0?BAL.ATTACH_DMG_MULT:1);
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
  heroBubble(B.hero, cause==='stamina'?'ちから、が……はいらな……':'そんな……っ', true);
  setBanner('敗北 — 観測終了', cause==='stamina'?'ルミナは力尽き、組み伏せられた':'ルミナは魔物たちに捕らえられた','#c98cff');
  S.capture();
  G.shake=Math.min(10,G.shake+6);
}

/* ================= 弾/回収物/燭台 ================= */
function bulletsUpdate(dt){
  const B=G.B;
  for(const b of B.bullets){
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
    if(b.life<=0) continue;
    if(Math.random()<0.3) parts(b.x,b.y,1,['#ffd76a','#fff'],20,0.25);
    let hit=false;
    for(const e of B.enemies){
      if(e.dead||e.dormant||e===b.last||e===B.hero.charmBy||e.state==='attached') continue;
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
      p.xp+=gm.v;
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
  const avail=Object.keys(UPG).filter(k=>curLv(k)<UPG[k].max);
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
  slot.cdMax=2.2+cost*0.16;
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
  const n=f.count, per=cost/n;
  if(formId==='scatter'||formId==='single'){
    for(let i=0;i<n;i++){
      const a=rand(TAU);
      spawnUnit(id, p.x+Math.cos(a)*560, p.y+Math.sin(a)*560, {enVal:per, elite:f.elite||1});
    }
  }else if(formId==='wave'){
    const a=rand(TAU);
    const cx=p.x+Math.cos(a)*580, cy=p.y+Math.sin(a)*580;
    const px=-Math.sin(a), py=Math.cos(a);
    for(let i=0;i<n;i++){
      const off=(i-(n-1)/2)*55;
      spawnUnit(id, cx+px*off, cy+py*off, {enVal:per});
    }
  }else if(formId==='ambush'){
    const vd=Math.hypot(p.vx,p.vy);
    const ang=vd>20?Math.atan2(p.vy,p.vx):rand(TAU);
    for(let i=0;i<n;i++){
      const d2=rand(240,380), spread=rand(-0.5,0.5);
      spawnUnit(id, p.x+Math.cos(ang+spread)*d2, p.y+Math.sin(ang+spread)*d2,
        {enVal:per, dormant:id!=='flower'});
    }
  }else if(formId==='ring'){
    const rot=rand(TAU);
    for(let i=0;i<n;i++){
      const a=rot+i*TAU/n+rand(-0.12,0.12);
      spawnUnit(id, p.x+Math.cos(a)*300, p.y+Math.sin(a)*225, {enVal:per});
    }
  }
  return true;
}

/* ================= オート指揮 ================= */
const BINDERS=['worm','gtent','flower'];
const PRESSURE=['ghost','mistslime','slime','slug'];
function bestForm(prefer){
  for(const f of prefer){ if(META.formations.includes(f)) return f; }
  return META.formations[0];
}
function autoDirector(dt){
  const B=G.B;
  if(!B.auto) return;
  B.autoT-=dt;
  if(B.autoT>0) return;
  B.autoT=0.55;
  const p=B.hero;
  const alive=B.enemies.filter(e=>!e.dead);
  const hpRatio=p.hp/p.maxHp;
  const stamRatio=p.stamina/p.staminaMax;
  const held=attachCount(p)>0||p.pinned;
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

  // 2) スタミナが削れているなら拘束役を追加投入(押し倒しの好機)
  const binderN=alive.filter(e=>BINDERS.includes(e.id)).length;
  if(stamRatio<0.45 && binderN<4){
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

  // 4) ガスの維持(場に無ければ)
  if(has('gas') && !alive.some(e=>e.id==='gas') && p.aphro<70){
    const f=bestForm(['single','scatter']);
    const chk=canPlay('gas',f);
    if(chk.ok && B.en>=chk.cost+4){ playCard('gas',f); return; }
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
    if(B.time>70 && B.time<150 && (hpRatio<0.8||stamRatio<0.6) && ready(slot.id,'scatter') && B.en>playCost(slot.id,'scatter')+8){
      playCard(slot.id,'scatter'); return;
    }
  }

  // 7) EN満杯なら大きく使う(包囲)
  if(B.en>enMax()*0.9){
    for(const id of ['ghost','mistslime','slime','worm','slug']){
      if(!has(id)) continue;
      const f=bestForm(['ring','wave','scatter']);
      if(ready(id,f)){ playCard(id,f); return; }
    }
  }

  // 8) 圧が切れているなら安価に補充
  if(alive.length<5 && B.en>enMax()*0.45){
    for(const id of ['slug','worm','ghost','slime']){
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
    p.pinned=false;
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
  p.hp=Math.min(p.maxHp,p.hp+p.regen*dt);   // 清廉のご加護

  condTick(p,dt);
  if(p.pinned){ pinTick(dt); if(G.mode!=='battle') return; }
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
