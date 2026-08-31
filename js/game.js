'use strict';
/* ============================================================
   game.js — 戦闘ロジック
   ヒロイン(AI自動操縦) / モンスター挙動 / EN・カード / 捕獲・報酬
============================================================ */

/* ================= ヒロイン生成 ================= */
function newHero(){
  const gb=META.gen.battle;                 // 世代内の戦歴 0..3
  const aArmor=altarLv('armor'), aRegen=altarLv('regen'), aSpeed=altarLv('speed');
  const aSense=altarLv('sense'), aHeat=altarLv('heat'), aFocus=altarLv('focus');
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
    ail:{ bound:0, boundBy:null, heat:0, slow:0, charm:0, charmBy:null },
    resist:{ bound:0, aphrodisia:0, charm:0 },
    sense:1+0.18*aSense,
    focusPen:0.12*aFocus,
    stumbleT:rand(2,3), stumbleDur:0,
  };
  // 戦闘経験の継承(世代内で強くなる)
  if(gb>=1) h.wp.bolt=2;
  if(gb>=2) h.wp.orb=1;
  if(gb>=3){ h.wp.nova=1; h.ps.speed=1; }
  h.hp=h.maxHp;
  h.ail.heat=18*aHeat;
  return h;
}
function heroFocus(h){
  return clamp(1 - h.ail.heat/100*0.45 - h.focusPen, 0.3, 1);
}
function heroStat(h){
  let spd=h.baseSpeed*(1+0.10*h.ps.speed);
  if(h.ail.slow>0) spd*=0.55;
  if(h.ail.heat>=40) spd*=1-0.08*(h.ail.heat-40)/60;
  return { speed:spd, magnet:90+45*h.ps.magnet };
}
const curLv=k=>UPG[k].kind==='wp' ? G.B.hero.wp[k] : G.B.hero.ps[k];

/* ================= 戦闘開始/終了 ================= */
function startBattle(){
  const hero=newHero();
  G.B={
    time:0, over:false,
    hero, enemies:[], bullets:[], eBullets:[], gems:[], hearts:[], trails:[], chests:[],
    en:BAL.EN_START, spawnFx:[],
    hand:META.deck.map(id=>({id, cdT:0})),
    form:META.formations[0]||'scatter',
    auto:META.settings.autoplay, autoT:1.2,
    kills:0, dmgDealt:0, dmgCarry:0, ailCount:0, orbFrag:0, essence:0,
    bossUsed:false, capturedBy:null, captureT:0, winT:0,
    ailRateT:{}, chestIdx:0,
    lvCards:null,
  };
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
  // 世代の進行と経験リセット
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
    heroLv:B.hero.level, capturedBy:B.capturedBy});
}

/* ================= 状態異常 ================= */
function heroBubble(h,txt,force){
  if(!force && h.bubbleCd>0) return;
  h.bubble=txt; h.bubbleT=1.7; h.bubbleCd=0.9;
}
function applyAil(type, power, src){
  const B=G.B, h=B.hero;
  const res=h.resist[type]||0;
  const eff=power*h.sense/(1+0.35*res);
  if(type==='bound'){
    if(eff<0.35) return;
    h.ail.bound=Math.max(h.ail.bound, eff);
    h.ail.boundBy=src||null;
    h.resist.bound=res+1;
    heroBubble(h, pickRand(['うごけないっ…!','ほどけて…っ!','はなして…!']), true);
    S.bind();
    parts(h.x,h.y-14,10,['#c98cff','#8458d8'],110,0.5);
  }else if(type==='aphrodisia'){
    const before=h.ail.heat;
    h.ail.heat=clamp(h.ail.heat+eff,0,100);
    h.resist.aphrodisia=res+0.4;
    if(before<50&&h.ail.heat>=50) heroBubble(h,'なんか、へん…あつい…');
    if(before<80&&h.ail.heat>=80) heroBubble(h,'しゅうちゅう…できな…っ');
  }else if(type==='slow'){
    h.ail.slow=Math.max(h.ail.slow, eff);
  }else if(type==='charm'){
    if(eff<0.4) return;
    h.ail.charm=Math.max(h.ail.charm, eff);
    h.ail.charmBy=src||null;
    h.resist.charm=res+1;
    heroBubble(h,'え…なんで、めが…はなせな…');
    S.charm();
  }
  // オーブ片(付与ごと・タイプ別レート制限)
  if(type!=='slow'){
    const rt=B.ailRateT[type]||0;
    if(B.time-rt>2){ B.ailRateT[type]=B.time; B.orbFrag+=BAL.ORB_PER_AIL; B.ailCount++; }
  }
}
function ailTick(h,dt){
  if(h.ail.bound>0){
    const heatPen=h.ail.heat>=50?0.3:0;
    h.ail.bound-=dt*(1.35+0.04*h.level)*(1-heatPen);
    if(h.ail.bound<=0){ h.ail.bound=0; h.ail.boundBy=null; heroBubble(h,'ぬけたっ!'); }
  }
  if(h.ail.heat>0) h.ail.heat=Math.max(0,h.ail.heat-BAL.HEAT_DECAY*dt);
  if(h.ail.slow>0) h.ail.slow-=dt;
  if(h.ail.charm>0){ h.ail.charm-=dt; if(h.ail.charm<=0) h.ail.charmBy=null; }
  for(const k in h.resist) h.resist[k]=Math.max(0,h.resist[k]-dt*0.04);
  // 高発情時のふらつき
  if(h.stumbleDur>0) h.stumbleDur-=dt;
  h.stumbleT-=dt;
  if(h.ail.heat>=70 && h.stumbleT<=0){
    h.stumbleT=rand(2.2,3.6); h.stumbleDur=0.35;
    heroBubble(h,'あしが…もつれ…っ');
  }
}

/* ================= ヒロインAI ================= */
function aiUpdate(dt){
  const B=G.B, p=B.hero, st=heroStat(p);
  if(p.ail.bound>0 || p.stumbleDur>0){
    p.vx*=Math.pow(0.001,dt); p.vy*=Math.pow(0.001,dt);
    p.moving=false;
    p.aiLabel=p.ail.bound>0?'こうそくされている!!':'ふらつき…';
    return;
  }
  let ax=0, ay=0, threat=0, bossNear=false;
  for(const e of B.enemies){
    if(e.dead||e.dormant) continue;
    if(e.id==='worm' && e.state==='burrow') continue;         // 潜航は見えない
    if(e.id==='flower' && !e.revealed) continue;              // 未発見の花は警戒外
    if(e===p.ail.charmBy) continue;                           // 魅了相手から逃げない
    const dx=p.x-e.x, dy=p.y-e.y;
    const d=Math.hypot(dx,dy)||0.001;
    const danger=(e.boss?280:(e.id==='flower'?130:(e.id==='gtent'?160:170)))+e.r;
    if(d<danger){
      let w=1-d/danger; w=w*w*(e.boss?3:1);
      threat+=w; ax+=dx/d*w; ay+=dy/d*w;
      if(e.boss) bossNear=true;
    }
  }
  // 粘液回避(弱め)
  for(const tr of B.trails){
    const dx=p.x-tr.x, dy=p.y-tr.y, d=Math.hypot(dx,dy)||0.001;
    if(d<40){ ax+=dx/d*0.35; ay+=dy/d*0.35; }
  }

  p.strafeT-=dt;
  if(p.strafeT<=0){ p.strafeDir*=-1; p.strafeT=rand(2,4.5); }

  let dx=0, dy=0, state='wait';
  if(threat>0.9){
    const m=Math.hypot(ax,ay)||1;
    dx=ax/m - (ay/m)*0.35*p.strafeDir;
    dy=ay/m + (ax/m)*0.35*p.strafeDir;
    state=bossNear?'boss':'flee';
  }else{
    let target=null, kind='';
    if(p.hp < p.maxHp*0.6){
      let td=420;
      for(const h2 of B.hearts){
        const d=Math.hypot(h2.x-p.x,h2.y-p.y);
        if(d<td){ td=d; target=h2; kind='heart'; }
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
      dx+=ax*1.0; dy+=ay*1.0;
    }else{
      let ne=null, nd=1e9;
      for(const e of B.enemies){
        if(e.dead||e.dormant||(e.id==='worm'&&e.state==='burrow')) continue;
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
  // 発情によるノイズ(思考の乱れ)
  const foc=heroFocus(p);
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
  if(Math.abs(p.vx)>12) p.face=p.vx>0?1:-1;
  p.moving=Math.hypot(p.vx,p.vy)>30;

  const LBL={flee:'かいひ行動!', boss:'ボスかいひ!!', gem:'ジェム回収', heart:'HP回復さがし',
    chest:'たからばこへ!', kite:'まちうけ・けん制', wait:'けいかい中'};
  const BBL={flee:'にげなきゃ〜!', boss:'おっきいのこわい!!', gem:'キラキラかいしゅう♪',
    heart:'ハートみっけ!', chest:'たからばこだ〜!', kite:'このきょりキープ…', wait:'つぎはどこから…?'};
  p.aiLabel=LBL[state];
  if(state!==p.aiState){ p.aiState=state; heroBubble(p,BBL[state]); }
}

/* ================= ヒロイン武器 ================= */
function nearestEnemies(n,maxD){
  const B=G.B, p=B.hero;
  const arr=[];
  for(const e of B.enemies){
    if(e.dead||e.dormant) continue;
    if(e.id==='worm'&&e.state==='burrow') continue;
    if(e===p.ail.charmBy) continue;
    const d=Math.hypot(e.x-p.x,e.y-p.y);
    if(d<maxD) arr.push({e,d});
  }
  arr.sort((a,b)=>a.d-b.d);
  return arr.slice(0,n).map(o=>o.e);
}
function weaponsUpdate(dt){
  const B=G.B, p=B.hero;
  const atkMult=p.ail.bound>0?0.55:1;     // 拘束中は攻撃が乱れる
  if(p.wp.bolt>0){
    p.boltT-=dt*atkMult;
    if(p.boltT<=0){
      const evo=p.evo.sstar>0;
      const lv=p.wp.bolt;
      const shots=evo?6:Math.min(4,1+Math.floor(lv/2));
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
      }else if(!ts.length){ p.boltT=0.12; }
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
        if(e.dead||e.dormant||e===p.ail.charmBy) continue;
        const dx=e.x-p.x, dy=e.y-p.y, d=Math.hypot(dx,dy);
        if(d<R+e.r){
          damageEnemy(e,dmg);
          if(d>0.01 && !e.boss){ e.x+=dx/d*30; e.y+=dy/d*30; e.stun=Math.max(e.stun,evo?0.6:0.35); }
        }
      }
      if(evo){ for(const gm of B.gems){ if(Math.hypot(gm.x-p.x,gm.y-p.y)<R*2) gm.sp=Math.max(gm.sp,700); } }
      parts(p.x,p.y-10,evo?24:14,['#fff','#ffd76a','#8fd3ff'],evo?200:140,0.5);
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
    dormant:!!o.dormant, dormT:0,
  };
  if(id==='worm'){ u.state='burrow'; u.st=0; }
  if(id==='flower'){ u.state='bud'; u.st=0; u.revealed=false; u.dotT=0; }
  if(id==='imp'){ u.dartT=rand(1.2,2.2); u.dartN=0; }
  if(id==='gtent'){ u.grabCd=1.5; u.whipT=0; }
  if(id==='slime'){ u.trailT=0; }
  if(u.boss){ u.bstate='chase'; u.bt=3.2; u.cdx=0; u.cdy=0; }
  B.enemies.push(u);
  B.spawnFx.push({x,y,t:0,r:MONSTERS[id].r+8, dormant:u.dormant});
  return u;
}
function damageEnemy(e,dmg){
  if(e.dead||e.dormant) return;
  if(e.id==='flower') dmg*=(e.state==='bud'?0.5:1.3);
  if(e.id==='worm'&&e.state==='burrow') return;
  e.hp-=dmg; e.hitFlash=0.12;
  floatDmg(e.x,e.y-e.r-4,dmg);
  if(e.hp<=0) killEnemy(e);
}
function killEnemy(e){
  if(e.dead) return;
  const B=G.B;
  e.dead=true; B.kills++;
  const col=EN_COLORS[e.id]||['#fff','#aaa'];
  parts(e.x,e.y-e.r,e.boss?42:8,col,e.boss?220:110,0.55);
  S.hit();
  // プレイヤー側リソース: EN還元 + エッセンス
  B.en=Math.min(enMax(), B.en+e.enVal*BAL.EN_REFUND);
  B.essence+=e.xp*BAL.ESS_RATE;
  if(e.boss){
    for(let i=0;i<22;i++){
      const a=rand(TAU), d2=rand(10,70);
      dropGem(e.x+Math.cos(a)*d2, e.y+Math.sin(a)*d2, 4);
    }
    B.hearts.push({x:e.x,y:e.y,t:0});
    setBanner('ボスが討たれた…','大量のエッセンスが残された','#b46cff');
    META.life.herBoss++;
    B.essence+=30;
    G.shake=Math.min(10,G.shake+7);
    S.clear();
  }else{
    dropGem(e.x,e.y,Math.max(1,Math.round(e.xp*0.8)));
    if(Math.random()<0.015 && B.hearts.length<2) B.hearts.push({x:e.x,y:e.y,t:0});
  }
}
function dropGem(x,y,v){
  const B=G.B;
  if(B.gems.length>220){ B.gems[(Math.random()*B.gems.length)|0].v+=v; return; }
  B.gems.push({x,y,v,t:rand(10),sp:0});
}

function enemiesUpdate(dt){
  const B=G.B, p=B.hero;
  for(const e of B.enemies){
    if(e.dead) continue;
    e.t+=dt;
    if(e.hitFlash>0) e.hitFlash-=dt;
    if(e.orbCd>0) e.orbCd-=dt;

    const dx=p.x-e.x, dy=p.y-e.y;
    const d=Math.hypot(dx,dy)||0.001;

    // 潜伏ユニットの起動
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
    }else if(e.id==='flower'){
      flowerTick(e,dt,d);
    }else if(e.id==='imp'){
      impTick(e,dt,d,dx,dy);
    }else if(e.id==='gtent'){
      gtentTick(e,dt,d,dx,dy);
    }else{
      const rush=(p.ail.bound>0 && d<300)?1.9:1;   // 拘束中は群がる
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
    }

    // オーブ被弾
    if(p.wp.orb>0 && e.orbCd<=0 && e!==p.ail.charmBy && !(e.id==='worm'&&e.state==='burrow')){
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
    if(!e.dead && !e.dormant && p.ifr<=0 && e.id!=='flower' && !(e.id==='worm'&&e.state!=='lunge')
       && Math.hypot(e.x-p.x,e.y-p.y)<e.r+p.r){
      contactHit(e);
    }
  }
  B.enemies=B.enemies.filter(e=>!e.dead);
}
function wormTick(e,dt,d,dx,dy){
  const p=G.B.hero;
  e.st-=dt;
  if(e.state==='burrow'){
    e.x+=dx/d*e.spd*1.5*dt; e.y+=dy/d*e.spd*1.5*dt;
    if(Math.random()<dt*8) parts(e.x,e.y,1,['#5a4a3a','#3a3128'],26,0.4);
    if(d<74){ e.state='pre'; e.st=0.25; }
  }else if(e.state==='pre'){
    if(e.st<=0){ e.state='lunge'; e.st=0.32; e.cdx=dx/d; e.cdy=dy/d; sfx(200,480,0.15,'sawtooth',0.06); }
  }else if(e.state==='lunge'){
    e.x+=e.cdx*330*dt; e.y+=e.cdy*330*dt;
    if(Math.hypot(p.x-e.x,p.y-e.y)<e.r+p.r+3){
      applyAil('bound',2.2,e);
      hurtHero(e.dmg,e,{noKb:true});
      e.state='rest'; e.st=1.8;
    }else if(e.st<=0){ e.state='rest'; e.st=1.6; }
  }else{ // rest
    e.x+=dx/d*e.spd*0.3*dt; e.y+=dy/d*e.spd*0.3*dt;
    if(e.st<=0){ e.state='burrow'; }
  }
}
function flowerTick(e,dt,d){
  const B=G.B, p=B.hero;
  e.st-=dt;
  if(e.state==='bud'){
    if(d<55){
      e.state='open'; e.st=8; e.revealed=true;
      applyAil('bound',3.0,e);
      hurtHero(2,e,{noKb:true,pierce:true});
      e.dotT=3;
      parts(e.x,e.y-8,16,['#e86a9c','#8fe8c9'],150,0.6);
      sfx(160,90,0.3,'sawtooth',0.08);
    }
  }else{ // open
    if(e.dotT>0){
      e.dotT-=dt;
      e.dotAcc=(e.dotAcc||0)+dt;
      if(e.dotAcc>=0.5){ e.dotAcc-=0.5; if(d<80) hurtHero(1.2,e,{noKb:true,pierce:true,quiet:true}); }
    }
    if(e.st<=0){ e.state='bud'; }
  }
}
function impTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  // 距離維持(170-230)
  let mx=0,my=0;
  if(d<160){ mx=-dx/d; my=-dy/d; }
  else if(d>240){ mx=dx/d; my=dy/d; }
  else { mx=-dy/d*0.7; my=dx/d*0.7; }
  e.x+=mx*e.spd*dt; e.y+=my*e.spd*dt;
  e.dartT-=dt;
  if(e.dartT<=0 && d<330 && B.eBullets.length<40){
    e.dartT=2.6; e.dartN++;
    const charm=(e.dartN%3===0);
    const a=Math.atan2(p.y-14-e.y, p.x-e.x)+rand(-0.05,0.05);
    B.eBullets.push({x:e.x,y:e.y-8,vx:Math.cos(a)*240,vy:Math.sin(a)*240,
      life:2, type:charm?'charm':'heat', src:e});
    S.dart();
  }
}
function gtentTick(e,dt,d,dx,dy){
  const p=G.B.hero;
  e.grabCd-=dt;
  if(e.whipT>0){
    e.whipT-=dt;
    if(e.whipT<=0 && Math.hypot(p.x-e.x,p.y-e.y)<110){
      applyAil('bound',2.6,e);
      hurtHero(e.dmg,e,{noKb:true});
      // 引き寄せ
      const dd=Math.hypot(p.x-e.x,p.y-e.y)||1;
      p.x-=(p.x-e.x)/dd*46; p.y-=(p.y-e.y)/dd*46;
    }
    return;
  }
  e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt;
  if(d<95 && e.grabCd<=0){ e.whipT=0.3; e.grabCd=4.5; sfx(140,60,0.2,'sawtooth',0.07); }
}
function eBulletsTick(dt){
  const B=G.B, p=B.hero;
  for(const b of B.eBullets){
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
    if(b.life<=0) continue;
    if(Math.hypot(b.x-p.x, b.y-(p.y-12))<p.r+5){
      b.life=0;
      if(b.type==='heat'){ applyAil('aphrodisia',16,b.src); hurtHero(1,b.src,{noKb:true,quiet:true}); }
      else applyAil('charm',2.4,b.src);
      parts(p.x,p.y-14,5,['#ff86b3','#ffb3cf'],90,0.4);
    }
  }
  B.eBullets=B.eBullets.filter(b=>b.life>0);
}
function contactHit(e){
  hurtHero(e.dmg,e,{});
  if(e.boss && e.bstate==='charge') applyAil('bound',1.1,e);
  if(e.id==='nightbat') applyAil('aphrodisia',6,e);
  if(e.id==='slime') applyAil('slow',0.8,e);
}
function hurtHero(dmg,src,opt){
  const B=G.B, p=B.hero;
  opt=opt||{};
  const bound=p.ail.bound>0;
  const armor=opt.pierce?0:p.armor*(bound?BAL.BOUND_ARMOR_MULT:1);
  const net=Math.max(0, dmg*(bound?BAL.BOUND_DMG_MULT:1)-armor);
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
    p.ifr=bound?0.26:0.55;
    G.hurtFlash=0.3; G.shake=Math.min(8,G.shake+3);
    if(!opt.noKb && src){
      const dx=p.x-src.x, dy=p.y-src.y, d=Math.hypot(dx,dy)||1;
      p.x+=dx/d*16; p.y+=dy/d*16;
    }
    heroBubble(p,'いたっ…!');
    S.hurt();
    parts(p.x,p.y-12,6,['#ff86b3','#fff'],120,0.4);
    floatTxt(p.x+rand(-8,8),p.y-34,'-'+Math.round(net),'#ff9db4',11,0.7);
  }
  if(p.hp<=0){ p.hp=0; beginCapture(src); }
}
function beginCapture(src){
  const B=G.B;
  if(G.mode!=='battle'&&G.mode!=='levelup') return;
  G.mode='captured';
  B.captureT=2.8;
  B.capturedBy=src?src.id:'default';
  B.hero.ail.bound=Math.max(B.hero.ail.bound,3);
  heroBubble(B.hero,'そんな……っ',true);
  setBanner('捕獲 — 観測終了','ルミナは魔物たちに捕らえられた','#c98cff');
  S.capture();
  G.shake=Math.min(10,G.shake+6);
}

/* ================= 弾/回収物/宝箱 ================= */
function bulletsUpdate(dt){
  const B=G.B;
  for(const b of B.bullets){
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
    if(b.life<=0) continue;
    if(Math.random()<0.3) parts(b.x,b.y,1,['#ffd76a','#fff'],20,0.25);
    for(const e of B.enemies){
      if(e.dead||e.dormant||e===b.last||e===B.hero.ail.charmBy) continue;
      if(e.id==='worm'&&e.state==='burrow') continue;
      if(Math.hypot(e.x-b.x,(e.y-e.r*0.6)-b.y)<e.r+5){
        damageEnemy(e,b.dmg);
        parts(b.x,b.y,4,['#ffd76a','#fff'],100,0.3);
        if(b.pierce>0){ b.pierce--; b.last=e; }
        else b.life=0;
        break;
      }
    }
  }
  B.bullets=B.bullets.filter(b=>b.life>0);
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
    if(Math.hypot(tr.x-p.x,tr.y-p.y)<tr.r+p.r-2) p.ail.slow=Math.max(p.ail.slow,0.3);
  }
  B.trails=B.trails.filter(tr=>tr.t<tr.life);
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
const HITTERS=['zombie','nightbat','ghost','bat','slime'];
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
  const bound=p.ail.bound>0.3;
  const has=id=>B.hand.some(h=>h.id===id);
  const ready=(id,f)=>canPlay(id,f).ok;

  // 1) 拘束中は即座に重打を叩き込む(最大2プレイ)
  if(bound){
    let plays=0;
    for(const id of HITTERS){
      if(plays>=2) break;
      if(!has(id)) continue;
      for(const f of [bestForm(['wave','scatter']), 'scatter']){
        if(ready(id,f)){ playCard(id,f); plays++; break; }
      }
    }
    if(plays>0) return;
  }

  // 2) 拘束役の維持(場に拘束役がいなければ優先確保。重打ぶんのENは残す)
  const binderOnField=alive.some(e=>BINDERS.includes(e.id));
  if(!binderOnField){
    for(const id of ['gtent','worm','flower']){
      if(!has(id)) continue;
      const f=id==='flower'?bestForm(['ambush','scatter']):bestForm(['single','scatter']);
      const chk=canPlay(id,f);
      if(chk.ok && B.en>=chk.cost+5){ playCard(id,f); return; }
    }
  }

  // 3) 熱の圧(小淫魔を1-2体維持)
  const impN=alive.filter(e=>e.id==='imp').length;
  if(has('imp') && impN<2 && p.ail.heat<60){
    const f=bestForm(['single','scatter']);
    const chk=canPlay('imp',f);
    if(chk.ok && B.en>=chk.cost+4){ playCard('imp',f); return; }
  }

  // 4) ボス: 中盤以降・EN潤沢・彼女が万全でないとき
  for(const slot of B.hand){
    if(!MONSTERS[slot.id].boss) continue;
    if(B.time>70 && B.time<150 && hpRatio<0.8 && ready(slot.id,'scatter') && B.en>playCost(slot.id,'scatter')+8){
      playCard(slot.id,'scatter'); return;
    }
  }

  // 5) EN満杯なら大きく使う(包囲)
  if(B.en>enMax()*0.9){
    for(const id of ['zombie','ghost','nightbat','bat','slime']){
      if(!has(id)) continue;
      const f=bestForm(['ring','wave','scatter']);
      if(ready(id,f)){ playCard(id,f); return; }
    }
  }

  // 6) 圧が切れているなら安価な群れ(出しすぎない)
  if(alive.length<5 && B.en>enMax()*0.45){
    for(const id of ['bat','slime','ghost']){
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

  ailTick(p,dt);
  aiUpdate(dt);
  weaponsUpdate(dt);
  bulletsUpdate(dt);
  enemiesUpdate(dt);
  eBulletsTick(dt);
  if(G.mode!=='battle') return;
  pickupsUpdate(dt);

  // EN回復
  B.en=Math.min(enMax(), B.en+(BAL.EN_REGEN+BAL.EN_REGEN_LV*p.level)*dt);
  for(const slot of B.hand){ if(slot.cdT>0) slot.cdT-=dt; }

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
  // 魔物が集まってくる(演出)
  for(const e of B.enemies){
    if(e.dead) continue;
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
