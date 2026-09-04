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
  // 抵抗の意志(敗北で固くなる・生き延びると少し緩む)と、世代ごとの素の成長。夜側の強化が行き着いても「全く抵抗できない」には落ちない
  const will=Math.min(BAL.WILL_CAP,(META.lumina&&META.lumina.will)||0);
  const gsc=1+BAL.GEN_SCALE*Math.min(10,Math.max(0,(META.gen.idx||1)-1));
  const h={
    x:0, y:0, vx:0, vy:0, r:10,
    maxHp:Math.round(175*(1+0.18*gb)*(1+0.08*(LU.vital||0))*(1+0.03*will)*gsc), hp:0,
    armor:Math.max(0, 7 + gb - aArmor + Math.floor((LU.guard||0)*0.5)),
    regen:(0.9+0.15*gb+0.08*(LU.bless||0))*(1-0.3*aRegen),
    baseSpeed:154*(1-0.06*aSpeed)*(1+0.02*(LU.swift||0)),
    dmgMult:(1+0.06*(LU.zeal||0))*(1+0.02*will)*gsc,
    will, curse:null, curseAmp:0, curseAche:false,     // v1.6 抵抗の意志 / ボス敗北の呪い
    hypnoG:0, hypnoFloor:0, heatG:0, inMusk:false,     // v1.6 催眠ゲージ(呪いの下限) / 発情ゲージ(雲から) / 雄臭の雲の中
    zone:'moss', bathT:0, springCd:0, dest:null, destUntil:0, explore:null, exploreUntil:0,   // v1.6 地形マップ
    level:1, xp:0, xpNeed:need(1),
    wp:{bolt:2, orb:1, nova:0, whip:0, rain:0, cross:0, sanct:0, blade:0, thunder:0, holy:0},
    ps:{speed:0, vital:0, magnet:0, haste:0, ward:0, growth:0, area:0, dup:0, luck:0, endure:0},
    evo:{sstar:0, sring:0, sburst:0, srush:0, scomet:0, sjudge:0, gsanct:0, kblade:0, judgment:0, spring:0},
    boltT:0.6, novaT:2.5, orbAng:0, novaAnim:0, novaR:0,
    whipT:1.1, whipAnim:0, whipDir:1, whipSide:1, whipR:0, rainT:2.2, crossT:1.6,
    sanctT:0, sanctPulse:0, bladeT:1.0, thunderT:2.0, holyT:2.4,
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
      t.bolt=Math.max(t.bolt,1.15);   // 初期武器には最低限の愛着(1戦目のDPS床)
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
  if(gb>=1) h.wp.bolt=3;
  if(gb>=2){ h.wp.orb=2; h.wp.nova=1; }
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
const curLv=k=>UPG[k].kind==='wp' ? G.B.hero.wp[k] : G.B.hero.ps[k];
const areaMult=h=>1+0.10*(h.ps.area||0);      // ひろがるろうそく
const dupN=h=>(h.ps.dup||0);                   // ふたごの鏡(投射+1)

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
  };
  genMap();               // 地形(世代ごとに変わる)
  spawnInitialProps();
  // 描き込みスプライトの事前焼き(デッキの種族×位相を最初の数十フレームで焼いておく)
  G.gfxLv=2; G.kCap=2; G.prebake=[];
  if(typeof resetSpriteCache==='function') resetSpriteCache();   // 前の戦闘の焼き絵(別デッキ・別倍率)は捨てる
  for(const id of new Set(META.deck.concat(['hand','worm']))){ if(MONSTERS[id]&&!MONSTERS[id].boss&&!MONSTERS[id].item){ for(let k=0;k<16;k++) for(let v=0;v<3;v++) G.prebake.push({id, t:k/8, vari:v}); } }
  G.mode='battle';
  G.cam.x=0; G.cam.y=0;
  setBanner('第'+genNum(META.gen.idx)+'世代 — 戦歴 '+(META.gen.battle+1)+'/'+BAL.GEN_LEN,
    META.gen.battle>0?'ルミナは前回までの経験を継承している':'初期状態のルミナ(書き換え適用)', '#b46cff');
  heroBubble(hero,'今日も、まもりぬくよ!',true);
  UI.enterBattle();
  bgmStart('battle');
}
function enMax(){ return Math.min(BAL.EN_MAX, BAL.EN_BASE + 6*altarLv('encap') + BAL.EN_PER_LV*(G.B?G.B.hero.level:1)); }

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
  META.life.bestClimax=Math.max(META.life.bestClimax||0, B.climaxN);
  if(outcome==='survive'){ META.life.survive=(META.life.survive||0)+1; META.streak=(META.streak||0)+1; }
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
  if(outcome==='survive') META.lumina.will=Math.max(0,(META.lumina.will||0)-BAL.WILL_SURVIVE_LOSS);
  if(newCurse) META.curse=newCurse;
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
  let rotReset=false, decay=null;
  if(META.gen.battle>=BAL.GEN_LEN){
    META.gen.battle=0; META.gen.idx++;
    META.rot={dmg:0, ail:0, captures:0, battles:0};
    META.gen.know={};   // 世代が変わると、覚えたことも忘れる(手記に書いた分だけ残る)
    rotReset=true;
    decay=luminaDecay();   // 世代の夜明け: 自己強化が一定数薄れる(ゼロには戻らない)
  }
  saveMeta();
  bgmStop();
  G.mode='result';
  UI.showResult({outcome, essGain, orbGain, rotReset,
    time:B.time, kills:B.kills, dmg:Math.round(B.dmgDealt), ail:B.ailCount,
    heroLv:B.hero.level, capturedBy:B.capturedBy, cause:B.captureCause, climax:B.climaxN,
    coins:coinGain, shop:shopped, decay,
    will:META.lumina.will||0, willUp:outcome==='capture', shrines:B.shrineGot, gateT:B.gateT, newCurse:newCurse?BOSS_CURSES[newCurse.id]:null,
    curseGone:(oldCurse&&!META.curse&&!newCurse)?BOSS_CURSES[oldCurse.id]:null});
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
    if(!h.pinned && !h.charmBind) B.pinScene=null;
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
  mon.state='attached'; mon.limb=slot; mon.stun=0;
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
      mon.state = mon.id==='flower' ? 'open' : (mon.id==='gtent' ? 'idle' : 'chase');
      mon.limb=null;
      const p=limbAnchor(h,slot);
      if(mon.id!=='flower' && mon.id!=='gtent' && mon.id!=='web'){
        mon.x=p.x+rand(-8,8); mon.y=p.y+rand(-4,4);
      }
    }
    if(opt.fling){
      mon.stun=1.2;
      mon.hp-=mon.maxHp*(mon.boss?0.05:0.35);   // ボスは振りほどかれても大きくは削れない(呑み込みで自滅しない)
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
  B.pinScene=sceneFor('pin', sid);
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
  return {x:e.x+ey.dx, y:e.y+ey.dy, ang:ey.ang, r:BAL.GAZE_R+BAL.GAZE_BOSS_EXTRA, spread:BAL.GAZE_ANG, state:ey.state, t:ey.t, tmax:BAL.GAZE_AIM*1.1,
          cd:BAL.GAZE_CD*1.2, scatter:i===1?0:(i===0?-1:1), off:ey.off||0};
}
function inSector(ey,p){
  const dx=p.x-ey.x, dy=(p.y-10)-ey.y, d=Math.hypot(dx,dy);
  if(d>ey.r) return false;
  const da=Math.abs(((Math.atan2(dy,dx)-ey.ang+Math.PI*3)%TAU)-Math.PI);
  return da<ey.spread/2;
}
/* v1.2 状態異常: 寸止め/疼き/痺れ/視姦/時間停止/触手服/おねだり */
function statesTick(h,dt){
  // 地形: 花園の花粉、温泉の湯気(回復するが火照る)
  h.zone=zoneAt(h.x,h.y);
  if(h.zone==='flower') applySensit(0.6*dt);
  if(h.zone==='hotspring'){ applySensit(1.2*dt); addHeatG(2*dt); h.hp=Math.min(h.maxHp,h.hp+h.regen*0.5*dt); }
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

  if(p.pinned || p.charmBind || p.climaxT>0 || p.stumbleDur>0 || p.freezeT>0 || p.selfT>0 || p.sniffT>0 || p.bathT>0){
    p.vx*=Math.pow(0.001,dt); p.vy*=Math.pow(0.001,dt);
    p.moving=false;
    p.aiLabel=p.freezeT>0?'じかんが、とまって……'
      :p.climaxT>0?'ぜっちょう……!!'
      :p.selfT>0?'……(その場で、じぶんを)……'
      :p.bathT>0?'おゆに、つかってる……'
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
  p.x=clampMapX(p.x,p.r+6); p.y=clampMapY(p.y,p.r+6);   // マップの端

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

  const LBL={flee:'かいひ行動!', boss:'ボスかいひ!!', dodge:'よける!(おぼえてる)', gem:'ジェム回収', poi:'めざす場所へ', explore:'たんさく中', heart:'ハートへ!',
    prop:'燭台をこわして回復!', chest:'たからばこへ!', kite:'まちうけ・けん制', wait:'けいかい中',
    struggle:'ふりほどこうともがいている!',
    charmwalk:'ふらふらと、ちかづいていく…', heatwalk:'熱にまけて、よろめき寄る…',
    hypno:'……電波に、あしが……', item:'おちてる品へ!', beg:'……おねだり、なんて……してない……'};
  const BBL={flee:'にげなきゃ〜!', boss:'おっきいのこわい!!', dodge:'あれは…だめ、よけなきゃ!', gem:'キラキラかいしゅう♪', poi:'あそこまで、いってみる', explore:'こっちは、まだ見てない',
    heart:'ハートみっけ!', prop:'燭台こわして回復しなきゃ', chest:'たからばこだ〜!',
    kite:'このきょりキープ…', wait:'つぎはどこから…?', struggle:'はなれてよ〜っ!',
    charmwalk:'…なんで、あしが…', heatwalk:'…あつくて、なにも…',
    hypno:'……あっち、いかなきゃ……', item:'なにか、おちてる!', beg:'……ちがう……'};
  if(p.dodging>0){ p.dodging-=dt; }
  p.aiLabel=LBL[state]||LBL.wait;
  if(state!==p.aiState){
    p.aiState=state;
    // エロ状態が乗っている間は、のんきなおしゃべりを封じる(台詞の主導権はエロ側)
    const ero=p.heatLv>0||p.aphro>=45||restraintCount(p)>0||p.climaxT>0||p.charms.some(c=>c.lv>0);   // ゲージだけの魅了エントリ(lv0)は数えない
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
      if(knowLv(b.src||'runemage')===0) continue;
      const sp=Math.hypot(b.vx,b.vy)||1, ux=b.vx/sp, uy=b.vy/sp, rx=p.x-b.x, ry=(p.y-14)-b.y;
      const along=rx*ux+ry*uy; if(along<0||along>240) continue;
      const px=rx-ux*along, py=ry-uy*along, pd=Math.hypot(px,py)||0.001;
      if(pd<52){ ddx+=px/pd*1.3*baseDodge; ddy+=py/pd*1.3*baseDodge; }
    }
  }
  if(strong){ ax*=0.4; ay*=0.4; }
  ax+=ddx; ay+=ddy;

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
    const will=p.hypnoLv>=2?0.15:1;   // 催眠Ⅱ+: もがく気が起きない
    dx=(Math.cos(B.time*7)*0.8*jerk + ax*1.2)*will;
    dy=(Math.sin(B.time*9)*0.8*jerk + ay*1.2)*will;
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
    if(!target && threat<0.6){
      // 燭台からこぼれた品(全消去/全回収/流星群)は多少の脅威があっても拾いに行く
      let td=480;
      for(const it of B.items){
        const d=Math.hypot(it.x-p.x,it.y-p.y);
        if(d<td){ td=d; target=it; kind='item'; }
      }
    }
    if(!target && threat<0.3){
      let td=520;
      for(const c of B.chests){
        const d=Math.hypot(c.x-p.x,c.y-p.y);
        if(d<td){ td=d; target=c; kind='chest'; }
      }
    }
    // 目的地(祠・泉・門)や探索: 近くにジェムが無く、脅威が薄いときに歩く
    if(!target && threat<0.3 && G.map && !nearGem(p,170)){
      const dest=pickDest(p);
      if(dest){ target=dest; kind=dest.kind==='explore'?'explore':'poi'; }
    }
    if(!target){
      // ジェム回収。ガス溜まりの中のジェムは基本見送る——
      // ただし中のジェムが多ければ、意を決して取りに入る
      let bestGm=null, bd=430, bestCl=null;
      for(const gm of B.gems){
        const d=Math.hypot(gm.x-p.x,gm.y-p.y);
        if(d>=bd) continue;
        if(nearKnownTrap(gm.x,gm.y)) continue;   // 知っている罠のそばのジェムは諦める
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
  p.steerX=dx; p.steerY=dy; p.steerState=state;
}

/* 知っている(理解以上)罠のそば */
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
  const B=G.B, p=B.hero;
  const arr=[];
  for(const e of B.enemies){
    if(e.dead||e.dormant||e.state==='attached') continue;
    if(!inSight(e,p)) continue;                       // 見えていない敵は撃てない
    const d=Math.hypot(e.x-p.x,e.y-p.y);
    // 魅了された相手は狙いが後回し(距離に下駄)。理解した脅威は優先討伐(距離を差し引く)
    const prio=knowLv(e.id)>=2?(SPEC_THREAT[e.id]||0)*90:0;
    arr.push({e, d:d+charmLvFor(p,e)*140-prio});
    if(d>=maxD) arr.pop();
  }
  arr.sort((a,b)=>a.d-b.d);
  return arr.slice(0,n).map(o=>o.e);
}
function weaponsUpdate(dt){
  const B=G.B, p=B.hero;
  const atkMult=((p.pinned||p.charmBind||p.climaxT>0||p.freezeT>0||p.begT>0||p.selfT>0||p.sniffT>0||p.bathT>0)?0:1)*Math.pow(0.75,armCount(p))   // 腕を拘束されるほど攻撃が乱れる
    *(p.waveDur>0?BAL.WAVE_ATK:1)                                           // 発情の波の間は手が止まりがち
    *(p.numbT>0?0.5:1)                                                      // 痺れ: 指が動かない
    *(1+0.08*p.ps.haste);                                                   // クイックリボン
  if(atkMult<=0) return;
  if(p.wp.bolt>0){
    p.boltT-=dt*atkMult;
    if(p.boltT<=0){
      const evo=p.evo.sstar>0;
      const lv=p.wp.bolt;
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
            dmg:15+5*(lv-1), pierce:0, life:1.2, last:null, evo:false});
          S.pew();
          if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN);
        }else p.boltT=0.15;
      }else{
        const ts=nearestEnemies(shots,evo?640:560);
        if(ts.length && B.bullets.length<150){
          p.boltT=(evo?0.55:0.7)*Math.pow(0.87,lv-1);
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
      p.novaT=(evo?4.0:4.3)-0.4*(lv-1);
      const R=(evo?180:100+20*(lv-1))*areaMult(p), dmg=(evo?34:16+7*(lv-1));
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
      p.whipT=(evo?0.65:1.0)*Math.pow(0.9,lv-1);
      p.whipSide*=-1;
      const range=(evo?165:105+11*lv)*areaMult(p), half=(evo?165:46+5*lv)*areaMult(p);
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
      const drops=(evo?6:1+Math.ceil(lv/2))+dupN(p);
      const ts=nearestEnemies(drops*2,540);
      let fired=false;
      for(let i=0;i<drops;i++){
        const t=ts.length?ts[(Math.random()*ts.length)|0]:null;
        if(!t) break;
        const tx=t.x+rand(-26,26), ty=t.y+rand(-16,16);
        if(B.bullets.length<170){
          B.bullets.push({kind:'rain', x:tx+rand(-40,40), y:ty-300, tx, ty,
            vx:0, vy:540, dmg:evo?26:12+5*(lv-1), splash:(evo?76:48)*areaMult(p), life:1.0, last:null, evo});
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
      if(ts.length && B.bullets.length<170){
        p.crossT=(evo?1.3:1.7)*Math.pow(0.9,lv-1);
        const a=Math.atan2((ts[0].y-ts[0].r)-(p.y-12), ts[0].x-p.x);
        const sp=evo?430:360;
        const nC=1+dupN(p);
        for(let i=0;i<nC;i++){
          const a2=a+(i-(nC-1)/2)*0.4;
          B.bullets.push({kind:'cross', x:p.x, y:p.y-12, vx:Math.cos(a2)*sp, vy:Math.sin(a2)*sp,
            spd:sp, dmg:evo?20:9+4*(lv-1), retT:evo?0.55:0.42, ret:false, life:2.4, last:null, evo});
        }
        sfx(320,180,0.12,'square',0.04);
        if(restraintCount(p)>0) addStruggle(BAL.STRUGGLE_SHOT_GAIN);
      }else p.crossT=0.15;
    }
  }
  /* --- せいいき: 常時の光の領域。触れた敵を焼き続ける。進化=広域+自己回復 --- */
  if(p.wp.sanct>0){
    const evo=p.evo.gsanct>0, lv=p.wp.sanct;
    p.sanctPulse+=dt*atkMult;
    p.sanctR=((evo?130:70+8*lv))*areaMult(p);
    if(p.sanctPulse>=0.5){
      p.sanctPulse-=0.5;
      const dmg=evo?14:6+3*(lv-1);
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
      const evo=p.evo.kblade>0, lv=p.wp.blade;
      p.bladeT=(evo?0.42:0.85)*Math.pow(0.9,lv-1);
      const n=(evo?4:1+Math.floor(lv/2))+dupN(p);
      const dirs=evo?[p.face,-p.face]:[p.face];
      for(const dir of dirs){
        for(let i=0;i<n;i++){
          if(B.bullets.length>=170) break;
          const spread=(i-(n-1)/2)*0.07;
          const sp=580;
          B.bullets.push({kind:'blade', x:p.x+dir*8, y:p.y-14+(i-(n-1)/2)*4, vx:Math.cos(spread)*sp*dir, vy:Math.sin(spread)*sp,
            dmg:evo?16:10+3*(lv-1), pierce:evo?3:1, life:0.9, last:null, evo});
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
      const evo=p.evo.judgment>0, lv=p.wp.thunder;
      const n=(evo?6:1+Math.floor((lv+1)/2))+dupN(p);
      const ts=nearestEnemies(n*3,440);
      if(ts.length){
        p.thunderT=(evo?2.0:2.6)*Math.pow(0.9,lv-1);
        const splash=(evo?52:34)*areaMult(p), dmg=evo?30:18+6*(lv-1);
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
  /* --- せいすい: 聖水を投げ、地面に清めの水溜まりを残す(継続ダメージ) --- */
  if(p.wp.holy>0){
    p.holyT-=dt*atkMult;
    if(p.holyT<=0){
      // v1.1: 本家の聖水どおり、投げる先は【ランダム】。彼女が敵を誘導しないと当たらない。
      // 進化(きよめの泉)で初めて敵の足元を狙うようになり、Lvを積んでようやく使い物になる
      const evo=p.evo.spring>0, lv=p.wp.holy;
      const n=(evo?3:1+Math.floor((lv-1)/2))+dupN(p);
      const ts=evo?nearestEnemies(n*2,420):[];
      if(!evo || ts.length){
        p.holyT=(evo?2.4:3.0)*Math.pow(0.92,lv-1);
        for(let i=0;i<n;i++){
          let tx,ty;
          if(evo){ const t=ts[(Math.random()*ts.length)|0]; tx=t.x+rand(-20,20); ty=t.y+rand(-12,12); }
          else{ const a=rand(TAU), d2=rand(40,170); tx=p.x+Math.cos(a)*d2; ty=p.y-10+Math.sin(a)*d2*0.8; }
          if(B.zones.length>24) B.zones.shift();
          B.zones.push({x:tx, y:ty, r:(evo?72:34+3*lv)*areaMult(p),
            t:0, life:evo?6:3.0, dmg:evo?9:3+1*(lv-1), tick:0, evo});
          parts(tx,ty,6,['#8fd3ff','#e8f4ff'],90,0.4);
        }
        sfx(520,700,0.1,'sine',0.04);
      }else p.holyT=0.2;
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
  const psCount=Object.values(p.ps).filter(v=>v>0).length;
  const avail=Object.keys(UPG).filter(k=>{
    if(curLv(k)>=UPG[k].max) return false;
    if(UPG[k].kind==='wp' && curLv(k)===0 && wpCount>=4) return false;   // 武器枠は4つまで
    if(UPG[k].kind==='ps' && curLv(k)===0 && psCount>=4) return false;   // パッシブ枠も4つ
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
  if(k==='endure'){ const add=Math.round(p.staminaMax*0.1); p.staminaMax+=add; p.stamina=Math.min(p.staminaMax,p.stamina+add); }
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
  x=clampMapX(x,20); y=clampMapY(y,20);
  const B=G.B, d=unitDef(id);
  const elite=o.elite||1;
  // 夜の深まり: 彼女が育つほど、召喚される魔物も強くなる(カード練度でスケール)
  const heroLv=(B.hero&&B.hero.level)||1;
  const nscale=Math.min(1,(d.lv-1)/2);
  const night=MONSTERS[id].boss?1:1+Math.min(BAL.NIGHT_STAT_CAP, BAL.NIGHT_STAT_LV*Math.max(0,heroLv-1))*nscale;
  const flesh=1+0.10*altarLv('mhp');           // 魔性の肉(オーブ・HPのみ)
  const pm=(o.mult||1)*night;
  const u={
    id, x, y,
    hp:d.hp*elite*pm*flesh, maxHp:d.hp*elite*pm*flesh, spd:MONSTERS[id].spd, r:MONSTERS[id].r*(elite>1?1.2:1),
    dmg:d.dmg*elite*pm, xp:Math.round(MONSTERS[id].xp*(1+0.1*(d.lv-1))*(elite>1?1.6:1)),
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
  // 地形の恩恵: 湿地で粘る種のHP、巣の魔物のHP。速度は毎フレーム今いる地形で決まる(spd0 が素の速度)
  u.spd0=u.spd; u.zone=zoneAt(x,y);
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
    spawnCloud(e.x,e.y,70,7,BAL.SENSIT_GAS*1.2,'gas');
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

    // 本家同様: 遠く離れた魔物は画面外の縁へ回り込み、同じ個体として再登場する(動ける個体のみ)
    if(MONSTERS[e.id].spd>0 && d>BAL.REENTER_D){
      const vd=Math.hypot(p.vx,p.vy);
      const base=vd>20?Math.atan2(p.vy,p.vx):rand(TAU);
      const a=base+rand(-1.1,1.1);
      { const q=placeNear(p.x,p.y,Math.cos(a)*BAL.REENTER_R,Math.sin(a)*BAL.REENTER_R*0.8,e.r); e.x=q.x; e.y=q.y; }
      e.seenT=0; e.lvx=null; e.lvy=null;
      B.spawnFx.push({x:e.x,y:e.y,t:0,r:e.r+8});
      if(e.boss){ floatTxt(e.x,e.y-e.r-20,'まわりこんできた!','#ff6b81',11,1.2); }
      continue;
    }
    e.zone=zoneAt(e.x,e.y); if(e.spd0!==undefined) e.spd=e.spd0*zoneMonSpd(e.zone,e.id);
    e.x=clampMapX(e.x,e.r); e.y=clampMapY(e.y,e.r);
    if(e.stun>0){ e.stun-=dt; }
    else if(e.id==='dreamtree'){
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
      const tx=p.x+ox-e.x, ty=p.y+oy-e.y;
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
       && e.id!=='flower' && e.id!=='imp' && e.id!=='gas' && e.id!=='pot' && e.id!=='tower' && e.id!=='web' && e.id!=='eye'
       && e.id!=='gazer' && e.id!=='beamer'
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
    spawnCloud(e.x,e.y-4,62,6.5,BAL.SENSIT_GAS,'gas');
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
  const tx=p.x+ox-e.x, ty=p.y+oy-e.y, td=Math.hypot(tx,ty)||0.001;
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
  // 幹の洞からワームを産み続ける(自前の子は8体まで。無償なのでロージェムしか落とさない)
  if(e.spawnCd<=0){
    e.spawnCd=5;
    const kids=B.enemies.filter(k=>!k.dead&&k.parent===e).length;
    if(kids<8 && B.enemies.length<BAL.FIELD_CAP){
      const a=rand(TAU);
      spawnUnit('worm', e.x+Math.cos(a)*26, e.y+Math.sin(a)*14, {enVal:0, gemMul:0, mult:1.2, parent:e});
      parts(e.x,e.y-e.r,8,['#e86a9c','#5a3a7a'],90,0.5);
    }
  }
  // 根の繋留
  if(!holding && d<150 && e.rootCd<=0){
    if(attachMonster(e,'tether',{r:130})){
      heroBubble(p,pickRand(['ね、が……あし、に……っ','うごか、ない……ひっぱられ……','やだ、木に、ひきずられ……っ']),true,2);
    }
    e.rootCd=7;
  }
  // 甘香の領域: 近いほど身体が熱を覚える
  if(d<120 && !p.pinned){
    applySensit(3*dt);
    applyPleasure(2.0*dt*(holding?1.6:1));
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
  const tx=p.x+ox-e.x, ty=p.y-14+oy-e.y, td=Math.hypot(tx,ty)||0.001;
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
  if(d>120){ e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt; }
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
      if(pd<BAL.BEAM_W/2+p.r*0.7 && !p.pinned) forcedClimax(e);
      else floatTxt(p.x,p.y-60,'かわした!','#ffd76a',10,0.9);
    }
  }else if(e.bmState==='fire'){
    if(e.bmT<=0){ e.bmState='cd'; e.bmT=BAL.BEAM_CD; }
  }else{ if(e.bmT<=0) e.bmState='idle'; }
}

/* ================= 地形マップ(v1.6・実験) =================
   有限マップを世代ごとの種で生成。彼女は見つけた場所(祠・泉・門)を目当てに歩き、知らなければ探索する */
function mapGen(){ return META.gen.idx||1; }
function genMap(){
  const gi=mapGen(), seed=1000+gi*7919;
  if(G.map && G.map.seed===seed && META.map && META.map.gen===gi) return;
  let sd=seed; const rnd=()=>{ sd=(sd*16807)%2147483647; return sd/2147483647; };
  const types=['moss','moss','moss','damp','damp','water','water','flower','flower','hotspring','ruin','ruin','nest'];
  const sites=types.map(t=>({t, x:(rnd()-0.5)*MAP_HW*1.8, y:(rnd()-0.5)*MAP_HH*1.8}));
  const nest=sites.find(z=>z.t==='nest'); const ea=rnd()*TAU; nest.x=Math.cos(ea)*MAP_HW*0.78; nest.y=Math.sin(ea)*MAP_HH*0.78;   // 巣は端のほう
  sites.push({t:'moss', x:0, y:0});   // 出発点は苔の広間
  const zone=new Uint8Array(MAP_W*MAP_H);
  for(let j=0;j<MAP_H;j++) for(let i=0;i<MAP_W;i++){
    const cx=(i+0.5)*MAP_T-MAP_HW, cy=(j+0.5)*MAP_T-MAP_HH;
    const jx=(hash2(i*3+gi,j*5)-0.5)*110, jy=(hash2(i*7,j*11+gi)-0.5)*110;   // 境目を揺らして自然に
    let best=sites[0], bd=1e18;
    for(const z of sites){ const d=(z.x-cx-jx)*(z.x-cx-jx)+((z.y-cy-jy)*1.35)*((z.y-cy-jy)*1.35); if(d<bd){ bd=d; best=z; } }
    zone[j*MAP_W+i]=ZONE_IDS.indexOf(best.t);
  }
  const pois=[];
  const place=(kind,inZone,minD)=>{
    for(let k=0;k<400;k++){
      const x=(rnd()-0.5)*MAP_HW*1.72, y=(rnd()-0.5)*MAP_HH*1.72;
      if(Math.hypot(x,y)<minD) continue;
      if(inZone && zoneAtXY(zone,x,y)!==inZone) continue;
      if(pois.some(q=>Math.hypot(q.x-x,q.y-y)<380)) continue;
      pois.push({kind,x,y,key:kind+pois.length}); return;
    }
    // 置けなかった: その地形帯の中心へ(門は巣の中心、泉は温泉帯の中心)。それも無ければ遠い点
    const site=inZone?sites.find(z=>z.t===inZone):null;
    if(site){ pois.push({kind,x:clampMapX(site.x,140),y:clampMapY(site.y,140),key:kind+pois.length}); return; }
    for(let k=0;k<200;k++){ const x=(rnd()-0.5)*MAP_HW*1.72, y=(rnd()-0.5)*MAP_HH*1.72; if(Math.hypot(x,y)>=minD){ pois.push({kind,x,y,key:kind+pois.length}); return; } }
    pois.push({kind,x:(rnd()-0.5)*1400,y:(rnd()-0.5)*900,key:kind+pois.length});
  };
  place('shrine',null,520); place('shrine',null,520); place('shrine',null,520);
  place('spring','hotspring',320); place('spring',null,420);
  place('gate','nest',700);
  G.map={seed, gi, zone, sites, pois, mini:null};
  if(!META.map || META.map.gen!==gi){ META.map={gen:gi, known:{}, visited:{}, gateProg:0, gateDone:0, seen:0}; saveMeta(); }
  // 突破後に移した門の位置は世代内で保つ
  if(META.map.gatePos){ const g=pois.find(q=>q.kind==='gate'); if(g){ g.x=META.map.gatePos.x; g.y=META.map.gatePos.y; } }
}
function zoneAtXY(zone,x,y){
  const i=Math.floor((x+MAP_HW)/MAP_T), j=Math.floor((y+MAP_HH)/MAP_T);
  if(i<0||j<0||i>=MAP_W||j>=MAP_H) return 'moss';
  return ZONE_IDS[zone[j*MAP_W+i]]||'moss';
}
function zoneAt(x,y){ return (G.map&&G.map.zone)?zoneAtXY(G.map.zone,x,y):'moss'; }
function zoneMonSpd(z,id){ const t=ZONE_SPD_MON[z]; if(!t) return 1; return t[id]||t['*']||1; }
function zoneMonHp(z,id){ const t=ZONE_HP_MON[z]; if(!t) return 1; return t[id]||t['*']||1; }
function clampMapX(x,m){ m=m===undefined?24:m; return clamp(x,-MAP_HW+m,MAP_HW-m); }
/* 端では召喚/回り込みの点を内側へ折り返す(壁へ丸めるだけだと彼女の真横に落ちる) */
function placeNear(px,py,dx,dy,m){
  m=m===undefined?24:m;
  let x=px+dx, y=py+dy;
  if(x<-MAP_HW+m||x>MAP_HW-m) x=px-dx;
  if(y<-MAP_HH+m||y>MAP_HH-m) y=py-dy;
  return {x:clampMapX(x,m), y:clampMapY(y,m)};
}
function clampMapY(y,m){ m=m===undefined?24:m; return clamp(y,-MAP_HH+m,MAP_HH-m); }
function nearGem(p,r){ for(const gm of G.B.gems){ if(Math.hypot(gm.x-p.x,gm.y-p.y)<r) return true; } return false; }
/* 門に挑むのは、2日目以降か、3種以上を理解してから(初日の初見では巣の奥まで行こうとしない) */
function gateAllowed(){ const kn=META.gen.know||{}; let n=0; for(const id in kn){ if(knowLv(id)>=2) n++; } return (META.gen.battle>=1 || n>=3); }
/* 彼女の目的地: 知っている(見たことのある)場所から選ぶ。何も無ければ、まだ見ていない方向へ探索に歩く */
function pickDest(p){
  const M=META.map, B=G.B; if(!G.map||!M) return null;
  if(p.dest && B.time<p.destUntil){ if(Math.hypot(p.dest.x-p.x,p.dest.y-p.y)>40) return p.dest; }
  p.destUntil=B.time+6;   // 6秒ごとに目的地を見直す
  let best=null, bd=1e9;
  for(const q of G.map.pois){
    if(!M.known[q.key]) continue;
    if(q.kind==='shrine' && M.visited[q.key]) continue;
    if(q.kind==='spring' && !(p.hp<p.maxHp*0.7 && p.springCd<=0)) continue;
    if(q.kind==='gate' && !gateAllowed()) continue;
    const d=Math.hypot(q.x-p.x,q.y-p.y)*(q.kind==='gate'?1.3:1);
    if(d<bd){ bd=d; best=q; }
  }
  if(best){ p.dest={x:best.x,y:best.y,kind:best.kind,key:best.key}; return p.dest; }
  if(!p.explore || B.time>p.exploreUntil || Math.hypot(p.explore.x-p.x,p.explore.y-p.y)<70){
    let cand=null, cs=-1;
    for(let k=0;k<8;k++){
      const a=rand(TAU), dd=rand(600,1200);
      const x=clampMapX(p.x+Math.cos(a)*dd,120), y=clampMapY(p.y+Math.sin(a)*dd,120);
      let sc=Math.hypot(x-p.x,y-p.y)/1200;
      for(const q of G.map.pois){ if(!M.known[q.key]) sc+=Math.max(0,1-Math.hypot(q.x-x,q.y-y)/700); }   // まだ見ていない場所のそばほど良い
      if(sc>cs){ cs=sc; cand={x,y}; }
    }
    p.explore=cand; p.exploreUntil=B.time+30;
  }
  p.dest={x:p.explore.x,y:p.explore.y,kind:'explore'};
  return p.dest;
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
  B.poiCd-=dt;
  for(const q of G.map.pois){
    if(!M.known[q.key] && inSight(q,p)){
      M.known[q.key]=1; M.seen=(M.seen||0)+1;
      floatTxt(q.x,q.y-40,'みつけた: '+POI_DEF[q.kind].name,'#8fd3ff',12,1.8);
      heroBubble(p,pickRand(['あそこ、なにかある……','あれ、なんだろ','おぼえておこう']),false,1);
      if(q.kind==='gate') setBanner('門を見つけた','巣の奥。彼女は突破したがるだろう','#ff86b3');
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
    if(q.kind==='gate' && d<70 && !p.pinned && p.climaxT<=0){
      M.gateProg+=dt; B.gateT+=dt;
      if(B.poiCd<=0){
        B.poiCd=3;
        if(B.enemies.length<BAL.FIELD_CAP-4){ for(let i=0;i<2;i++){ const a=rand(TAU); spawnUnit(pickRand(['slug','goblin','worm','ghost','hand','leech']), q.x+Math.cos(a)*90, q.y+Math.sin(a)*70, {enVal:0, gemMul:0.5}); } }   // 巣の守り
      }
      if(M.gateProg>=12){
        M.gateProg=0; M.gateDone=(M.gateDone||0)+1;
        META.lumina.coins+=80; META.lumina.will=Math.min(BAL.WILL_CAP,(META.lumina.will||0)+1);
        setBanner('門を突破した','巣の奥へ。意志が固くなり、コインを得た。門は別の場所へ移る','#ff86b3');
        heroBubble(p,'……とおった。つぎも、いける',false,3); S.boss();
        // 門は巣の別の場所へ(巣に置けなければ遠い場所へ)。位置は世代内で保つ。彼女の目的地は捨てる
        let placed=false;
        for(let pass=0;pass<2&&!placed;pass++){
          for(let k=0;k<300;k++){ const x=(Math.random()-0.5)*MAP_HW*1.7, y=(Math.random()-0.5)*MAP_HH*1.7;
            if(Math.hypot(x,y)<700||Math.hypot(x-p.x,y-p.y)<600) continue; if(pass===0 && zoneAt(x,y)!=='nest') continue;
            q.x=x; q.y=y; placed=true; break; }
        }
        M.gatePos={x:q.x,y:q.y}; M.known[q.key]=0; p.dest=null; p.destUntil=0; saveMeta();
      }
    }
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
    e.x+=e.cdx*340*dt; e.y+=e.cdy*340*dt;
    parts(e.x,e.y,1,['#c04a6a','#7a2a4a'],40,0.3);
    if(e.bt<=0){ e.bstate='chase'; e.bt=rand(3.2,4.7); }
  }
}
/* 粘獣王: 粘液の帯を残しながら迫り、追いつけば脚を呑む(粘液の繋留2本+敏感化+鈍足) */
function slimekingTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  if(e.state==='attached') return;
  e.lookA=Math.atan2(dy,dx);
  e.x+=dx/d*e.spd*dt; e.y+=dy/d*e.spd*dt;
  e.trailT-=dt;
  if(e.trailT<=0){ e.trailT=0.22; if(B.trails.length<90) B.trails.push({x:e.x+rand(-10,10),y:e.y+rand(-6,6),r:20,t:0,life:6}); }
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
    e.castCd=4.5;
    const a=Math.atan2((p.y-14)-(e.y-e.r*1.2), p.x-e.x);
    B.ebullets.push({kind:'rune', x:e.x, y:e.y-e.r*1.2, vx:Math.cos(a)*210, vy:Math.sin(a)*210, t:0, life:3.2, r:9, src:'runemage'});
    sfx(500,900,0.25,'sine',0.05);
  }
  if(e.runeCd<=0 && d<400 && B.traps.length<12){ e.runeCd=13; B.traps.push({kind:'rune',x:p.x+rand(-60,60),y:p.y+rand(-40,40),t:0,life:45,r:26,armed:true,src:'runemage'}); }
}
/* 呪弾の命中: 淫紋Lv+1(最大3)・快感・よろめき */
function runeHit(b){
  const B=G.B, p=B.hero;
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
  e.orbitA+=e.orbitDir*1.1*dt;
  const R=130, tx=p.x+Math.cos(e.orbitA)*R, ty=p.y+Math.sin(e.orbitA)*R*0.7;
  const tdx=tx-e.x, tdy=ty-e.y, td=Math.hypot(tdx,tdy)||1;
  const mv=Math.min(td, e.spd*dt*1.6); e.x+=tdx/td*mv; e.y+=tdy/td*mv;
  e.lookA=Math.atan2(dy,dx);
  e.pulseCd-=dt; e.spawnCd-=dt; e.kissCd-=dt;
  if(e.pulseCd<=0){
    e.pulseCd=6;
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
    e.kissCd=5; applySensit(10); addHeatG(20);
    heroBubble(p,'んっ……!? くち、に……',true,2);
    B.bossMark={id:'succuqueen',t:B.time}; codexMet('succuqueen');
  }
  if(e.spawnCd<=0){
    e.spawnCd=15;
    if(aliveOf('imp')<6 && B.enemies.length<BAL.FIELD_CAP-2){
      for(let i=0;i<2;i++){ const a=rand(TAU); spawnUnit('imp', e.x+Math.cos(a)*30, e.y+Math.sin(a)*30, {parent:e, enVal:0, gemMul:0}); }
      setBanner('女王の呼び声','小淫魔が集う','#ff9ec2');
    }
  }
}
/* ゴブリンの王: 濃い雄臭の雲を撒き、呼び笛で手下を呼び、突進する */
function gobkingTick(e,dt,d,dx,dy){
  const B=G.B, p=B.hero;
  bossChargeTick(e,dt,d,dx,dy);
  e.muskCd-=dt; e.hornCd-=dt;
  if(e.muskCd<=0 && d<520){ e.muskCd=1.8; const c=spawnCloud(e.x,e.y+2,90,5,BAL.SENSIT_GAS*0.6,'musk'); if(c) c.boss='gobking'; }
  if(e.hornCd<=0 && d<480){
    e.hornCd=9; let n=0;
    for(let i=0;i<3;i++){ if(aliveOf('goblin')>=12||B.enemies.length>=BAL.FIELD_CAP) break; const a=rand(TAU); spawnUnit('goblin', e.x+Math.cos(a)*40, e.y+Math.sin(a)*40, {parent:e, enVal:0, gemMul:0}); n++; }
    if(n){ setBanner('呼び笛','ゴブリンの王が手下を呼んだ','#8fd36a'); sfx(180,420,0.4,'square',0.06); }
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
function placeItem(id,x,y){
  const B=G.B, p=B.hero;
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
    B.traps.push({kind:'rune',x,y,t:0,life:45,r:26,armed:true});
    parts(x,y,6,['#c98cff','#5a3a7a'],40,0.5);
  }else if(id==='suit'){
    B.traps.push({kind:'suit',x,y,t:0,life:45,r:26,armed:true});
    parts(x,y,6,['#ff9ec2','#5a3a7a'],40,0.5);
  }else if(id==='freeze'){
    B.traps.push({kind:'freeze',x,y,t:0,life:45,r:26,armed:true});
    parts(x,y,6,['#8fd3ff','#5a3a7a'],40,0.5);
  }else if(id==='web'){
    const u=spawnUnit('web',x,y,{enVal:0,gemMul:0});
    u.life=40;
  }else if(id==='tower'){
    const u=spawnUnit('tower',x,y,{enVal:0,gemMul:0});
    u.life=40; u.pulseCd=0.8;
  }else if(id==='fake'){
    B.chests.push({x,y,t:0,taken:false,fake:true});
  }
  floatTxt(x,y-20,it.name,'#c98cff',10,1.0);
  return true;
}
/* 淫紋の罠: 踏むと快感が弾け、這い寄る手が湧く */
function trapsTick(dt){
  const B=G.B, p=B.hero;
  for(const tr of B.traps){
    tr.t+=dt;
    if(tr.armed && !p.pinned && p.freezeT<=0 && Math.hypot(p.x-tr.x,p.y-tr.y)<tr.r){
      tr.armed=false; tr.t=Math.max(tr.t,tr.life-0.8);
      const kind=tr.kind||'rune';
      if(kind==='rune'){
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
  if(src&&src.id) codexMet(src.id);
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
  // 帰属: 直前6秒の強制絶頂、または催眠Ⅱ以上での敗北は、その源(照射触手/ゲイザー)の仕業として記録する(ボス個体に倒された時は除く)
  { const h=B.hero, lb=h.lastBeam, lh=h.lastHypno;
    if(!(src&&src.boss)){
      if(lb && B.time-lb.t<6 && MONSTERS[lb.id]) B.capturedBy=lb.id;
      else if(h.hypnoLv>=2 && lh && B.time-lh.t<25 && MONSTERS[lh.id]) B.capturedBy=lh.id;
    } }
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
    const a=i*TAU/BAL.PROP_INIT+rand(-0.4,0.4), d=rand(200,480);
    B.props.push({x:Math.cos(a)*d, y:Math.sin(a)*d, hp:BAL.PROP_HP, max:BAL.PROP_HP, t:rand(10)});
  }
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
  for(const it of B.items){
    it.t+=dt;
    const dx=p.x-it.x, dy=(p.y-10)-it.y, d=Math.hypot(dx,dy)||0.001;
    if(d<st.magnet*1.2){ const mv=Math.min(d,420*dt); it.x+=dx/d*mv; it.y+=dy/d*mv; }
    if(d<18){ it.dead=true; applyItem(it.kind); if(G.mode!=='battle') break; }
  }
  B.items=B.items.filter(it=>!it.dead);
  for(const c of B.chests){
    c.t+=dt;
    if(!c.taken && Math.hypot(c.x-p.x,c.y-(p.y-6))<22){
      c.taken=true;
      if(c.fake) fakeChestTrap(c); else openChest();
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
  return capN(Math.ceil((f.count+extra)*sw*ringMul));
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
    if(B.enemies.some(e=>e.boss&&!e.dead)) return {ok:false, why:'boss1'};  // 同時に1体
  }
  if(B.enemies.length>=BAL.FIELD_CAP) return {ok:false, why:'cap'};
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
      const q=placeNear(p.x,p.y,Math.cos(a)*560,Math.sin(a)*560);
      spawnUnit(id, q.x, q.y,
        Object.assign({elite:f.elite||1}, so));
    }
  }else if(formId==='wave'){
    const a=rand(TAU);
    const q0=placeNear(p.x,p.y,Math.cos(a)*580,Math.sin(a)*580); const cx=q0.x, cy=q0.y;
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
      const q=placeNear(p.x,p.y,Math.cos(ang+spread)*d2,Math.sin(ang+spread)*d2);
      spawnUnit(id, q.x, q.y,
        Object.assign({dormant:id!=='flower'}, so));
    }
  }else if(formId==='ring'){
    const rot=rand(TAU);
    for(let i=0;i<n;i++){
      const a=rot+i*TAU/n+rand(-0.12,0.12);
      const q=placeNear(p.x,p.y,Math.cos(a)*380,Math.sin(a)*285);
      spawnUnit(id, q.x, q.y, so);   // 広い輪から締める(端では内側へ折り返す)
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
      for(const f of [bestForm(['ring','burst','wave','scatter']), 'scatter']){
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

  // 3.5) コンボ継続: 直前カードの連鎖が生きていて余裕があれば重ねる
  const lp=B.lastPlay;
  if(lp && !MONSTERS[lp.id].boss && B.combo[lp.id]){
    const cb=B.combo[lp.id];
    if(B.time-cb.t<=BAL.COMBO_WINDOW-1.5 && cb.n<BAL.COMBO_MAX && has(lp.id)){
      const f=bestForm(['burst','wave','scatter']);
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

  // 4.8) 覗き目玉を1体、見張りに
  if(has('eye') && !alive.some(e=>e.id==='eye') && B.time>20){
    const f=bestForm(['single','scatter']);
    const chk=canPlay('eye',f);
    if(chk.ok && B.en>=chk.cost+4){ playCard('eye',f); return; }
  }
  // 5) 小淫魔を1体まとわりつかせる
  if(has('imp') && !alive.some(e=>e.id==='imp')){
    const f=bestForm(['single','scatter']);
    const chk=canPlay('imp',f);
    if(chk.ok && B.en>=chk.cost+4){ playCard('imp',f); return; }
  }

  // 5.5) 大型: 場に大型が居なければ精鋭/双璧で1枚置く(少数精鋭)
  if(B.time>40 && !alive.some(e=>tierOf(e.id)==='large')){
    for(const slot of B.hand){
      if(tierOf(slot.id)!=='large') continue;
      const f=resolveForm(slot.id, bestForm(['duo','single']));
      const chk=canPlay(slot.id,f);
      if(chk.ok && B.en>=chk.cost+6){ playCard(slot.id,f); return; }
    }
  }

  // 6) ボス: 中盤以降・EN潤沢・彼女が万全でないとき
  for(const slot of B.hand){
    if(!MONSTERS[slot.id].boss) continue;
    if(B.time>90 && B.time<BAL.RUN_TIME-60 && (hpRatio<0.8||stamRatio<0.6) && ready(slot.id,'scatter') && B.en>playCost(slot.id,'scatter')+8){
      playCard(slot.id,'scatter'); return;
    }
  }

  // 7) ENが溢れそうなら全力放出(1tickで最大4プレイ・半分まで使い切る)
  if(flush){
    let plays=0;
    for(const id of ['gtent','ghost','serpent','ghosthand','goblin','hand','spore','mistslime','slime','worm','slug','leech','slugqueen','moth','succubus','gazer','beamer']){
      if(plays>=4 || B.en<enMax()*0.5) break;
      if(!has(id)) continue;
      const f=bestForm(['ring','burst','wave','scatter']);
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
  if(B.bossCd>0) B.bossCd-=dt;
  // 敵弾(刻印師の呪弾): 直進し、彼女に当たれば淫紋
  for(const b of B.ebullets){
    b.t+=dt; b.x+=b.vx*dt; b.y+=b.vy*dt;
    if(!b.dead && Math.hypot(b.x-p.x,b.y-(p.y-14))<b.r+p.r*0.8 && p.freezeT<=0){ b.dead=true; runeHit(b); }
  }
  if(B.ebullets.length) B.ebullets=B.ebullets.filter(b=>!b.dead&&b.t<b.life);
  poiTick(dt);   // 祠・泉・門
  for(const k in B.itemCd){ if(B.itemCd[k]>0) B.itemCd[k]-=dt; }
  trapsTick(dt);
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
  B.en=Math.min(enMax(), B.en+(BAL.EN_REGEN+0.12*altarLv('enregen')+BAL.EN_REGEN_LV*p.level)*dt);
  for(const slot of B.hand){ if(slot.cdT>0) slot.cdT-=dt; }

  // 燭台の追加出現
  B.propT-=dt;
  if(B.propT<=0 && B.props.length<BAL.PROP_MAX){
    B.propT=BAL.PROP_RESPAWN;
    const a=rand(TAU), d=rand(200,460);
    B.props.push({x:clampMapX(p.x+Math.cos(a)*d,40), y:clampMapY(p.y+Math.sin(a)*d,40), hp:BAL.PROP_HP, max:BAL.PROP_HP, t:0});
  }

  // 宝箱
  if(B.chestIdx<BAL.CHEST_TIMES.length && B.time>=BAL.CHEST_TIMES[B.chestIdx]){
    B.chestIdx++;
    const a=rand(TAU), d=rand(300,460);
    B.chests.push({x:clampMapX(p.x+Math.cos(a)*d,40), y:clampMapY(p.y+Math.sin(a)*d,40), t:0, taken:false});
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
