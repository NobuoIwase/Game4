'use strict';
/* ============================================================
   core.js — 基盤: 定数 / ユーティリティ / オーディオ / セーブ
   ルミナ・サバイバーズ v0.2「侵蝕デッキ」
   debug: ?ts=N でゲーム速度N倍(1-5) / console: __game
============================================================ */
const TAU = Math.PI*2;
const W = 960, H = 540;
const FONT = '"Hiragino Maru Gothic ProN","Yu Gothic UI","Meiryo",sans-serif';
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const TS = Math.max(1, Math.min(5, parseInt(new URLSearchParams(location.search).get('ts'),10) || 1));

let dpr=1, viewScale=1;
function resize(){
  dpr = Math.min(2, window.devicePixelRatio||1);
  viewScale = Math.min(window.innerWidth/W, window.innerHeight/H) * 0.985;
  cv.style.width  = Math.round(W*viewScale)+'px';
  cv.style.height = Math.round(H*viewScale)+'px';
  cv.width  = Math.round(W*viewScale*dpr);
  cv.height = Math.round(H*viewScale*dpr);
  const bb=document.getElementById('battlebar');
  bb.style.width = Math.min(720, Math.round(W*viewScale)-24)+'px';
}
window.addEventListener('resize', resize); resize();

/* ---------------- utils ---------------- */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a=1,b)=> b===undefined ? Math.random()*a : a+Math.random()*(b-a);
const pickRand=a=>a[(Math.random()*a.length)|0];
function hash2(i,j){ let h=(i*374761393 + j*668265263)|0; h=((h^(h>>13))*1274126177)|0; return ((h^(h>>16))>>>0)/4294967295; }
function rr(g,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  g.beginPath();
  g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath();
}
function star(g,x,y,R,r,n,rot){
  g.beginPath();
  for(let i=0;i<n*2;i++){
    const rad=(i%2)?r:R, a=rot+i*Math.PI/n;
    const px=x+Math.cos(a)*rad, py=y+Math.sin(a)*rad;
    if(i) g.lineTo(px,py); else g.moveTo(px,py);
  }
  g.closePath();
}
function heartPath(g,x,y,s){
  g.beginPath();
  g.moveTo(x, y+3*s);
  g.bezierCurveTo(x-6*s, y-2*s, x-3*s, y-7*s, x, y-3*s);
  g.bezierCurveTo(x+3*s, y-7*s, x+6*s, y-2*s, x, y+3*s);
  g.closePath();
}
function fmt(t){ t=Math.max(0,Math.floor(t)); return Math.floor(t/60)+':'+String(t%60).padStart(2,'0'); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }
const KANJI_NUM=['0','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ','Ⅹ'];
const genNum=n=> n<=10 ? KANJI_NUM[n] : String(n);
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ---------------- audio ---------------- */
let AC=null;
let muted=false;
try{ muted = localStorage.getItem('luna_mute')==='1'; }catch(e){}
let bgm={nodes:null, timer:0, kind:''};
function initAudio(){
  if(!AC){ try{ AC=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
  if(AC && AC.state==='suspended') AC.resume();
}
function sfx(f0,f1,dur,type,vol,delay){
  if(!AC||muted) return;
  try{
    const t=AC.currentTime+(delay||0);
    const o=AC.createOscillator(), g=AC.createGain();
    o.type=type||'sine';
    o.frequency.setValueAtTime(Math.max(1,f0),t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+dur);
    g.gain.setValueAtTime(vol||0.1,t);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g); g.connect(AC.destination);
    o.start(t); o.stop(t+dur+0.03);
  }catch(e){}
}
const S={
  pew(){ sfx(760,420,0.09,'triangle',0.03); },
  hit(){ sfx(220,140,0.05,'square',0.028); },
  gem(){ sfx(880,1500,0.09,'sine',0.04); },
  heart(){ sfx(520,900,0.18,'sine',0.08); },
  hurt(){ sfx(200,90,0.22,'sawtooth',0.1); },
  nova(){ sfx(90,320,0.3,'sine',0.11); sfx(1200,300,0.25,'triangle',0.05); },
  lvup(){ [660,880,1320].forEach((f,i)=>sfx(f,f,0.14,'triangle',0.07,i*0.08)); },
  pick(){ sfx(980,1600,0.12,'triangle',0.08); },
  boss(){ sfx(120,60,0.5,'sawtooth',0.13); sfx(80,50,0.7,'square',0.08,0.1); },
  clear(){ [523,659,784,1047,1319].forEach((f,i)=>sfx(f,f,0.2,'triangle',0.08,i*0.09)); },
  summon(){ sfx(150,70,0.24,'sawtooth',0.07); sfx(420,180,0.2,'triangle',0.05,0.03); },
  deny(){ sfx(180,140,0.12,'square',0.06); },
  bind(){ sfx(340,120,0.22,'square',0.08); sfx(900,500,0.1,'triangle',0.04,0.05); },
  dart(){ sfx(980,620,0.1,'sine',0.045); },
  charm(){ sfx(620,980,0.2,'sine',0.06); sfx(930,1240,0.18,'sine',0.04,0.08); },
  capture(){ [392,311,247,196].forEach((f,i)=>sfx(f,f*0.92,0.3,'triangle',0.1,i*0.18)); sfx(70,40,1.1,'sawtooth',0.09,0.2); },
  chest(){ [523,784,1047].forEach((f,i)=>sfx(f,f,0.13,'triangle',0.07,i*0.07)); },
  coin(){ sfx(1180,1700,0.08,'triangle',0.05); },
  buy(){ sfx(660,990,0.13,'triangle',0.08); sfx(990,1320,0.12,'sine',0.05,0.07); },
  altar(){ sfx(220,110,0.5,'sine',0.09); sfx(440,445,0.6,'sine',0.04,0.1); },
};
/* 低音量アンビエントBGM(WebAudio 生成 / 依存なし) */
function bgmStart(kind){
  if(!AC||muted||bgm.kind===kind) return;
  bgmStop();
  try{
    const master=AC.createGain(); master.gain.value=0.0; master.connect(AC.destination);
    master.gain.linearRampToValueAtTime(kind==='battle'?0.045:0.035, AC.currentTime+2.2);
    const nodes=[master];
    const mkPad=(f,detune)=>{
      const o=AC.createOscillator(), g=AC.createGain();
      o.type='sine'; o.frequency.value=f; o.detune.value=detune;
      g.gain.value=0.5; o.connect(g); g.connect(master); o.start();
      nodes.push(o,g);
    };
    if(kind==='battle'){ mkPad(55,0); mkPad(82.4,4); mkPad(110,-5); }
    else { mkPad(65.4,0); mkPad(98,3); mkPad(130.8,-4); }
    const seq = kind==='battle' ? [220,261.6,329.6,196,220,311.1,261.6,164.8]
                                : [261.6,329.6,392,329.6,293.7,392,349.2,329.6];
    let step=0;
    const iv=setInterval(()=>{
      if(!AC||muted) return;
      const t=AC.currentTime;
      const o=AC.createOscillator(), g=AC.createGain();
      o.type='triangle'; o.frequency.value=seq[step%seq.length]*(step%16>=8?0.5:1);
      g.gain.setValueAtTime(0.0001,t);
      g.gain.linearRampToValueAtTime(0.16,t+0.06);
      g.gain.exponentialRampToValueAtTime(0.0001,t+1.6);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t+1.7);
      step++;
    }, kind==='battle'?900:1400);
    bgm={nodes, timer:iv, kind};
  }catch(e){}
}
function bgmStop(){
  if(bgm.timer) clearInterval(bgm.timer);
  for(const n of bgm.nodes||[]){ try{ n.stop ? n.stop() : n.disconnect(); }catch(e){} }
  bgm={nodes:null,timer:0,kind:''};
}

/* ---------------- 永続データ ---------------- */
const SAVE_KEY='luna2_save';
function defaultMeta(){
  return {
    v:3,
    essence:0, orbs:0,
    runs:0, captures:0,
    gen:{ idx:1, battle:0, know:{} },     // 世代 / 世代内の戦闘数(0..GEN_LEN-1) / 世代内の学習 {id:{met,cap}}
    cards:{ slug:{owned:true,lv:1}, worm:{owned:true,lv:1}, ghost:{owned:true,lv:1} },
    deck:['slug','worm','ghost'],
    formations:['scatter'],
    altar:{},                              // {id: lv}
    life:{ dmg:0, ail:0, kills:0, herBoss:0, climax:0, survive:0, bestClimax:0,
           ailBy:{}, capBy:{}, capCause:{} },   // 通算記録(v1.1: 種別内訳も)
    streak:0,                                   // 連続生存(捕獲で0に)
    nightItems:{ mist:true },                   // 夜側のアイテム(解放状態)
    traits:{},                                  // 身についた性癖(永続) {musk:Lv}
    codex:{},                                   // 図鑑: {id:{seen,met,climax,capture,kills}}
    rot:{ dmg:0, ail:0, captures:0, battles:0 }, // 世代内記録(リセットされる)
    best:null,
    lumina:{ coins:0, will:0, upg:{vital:0,guard:0,bless:0,swift:0,grit:0,zeal:0} },  // 彼女の自己強化(永続)・抵抗の意志
    curse:null,   // ボス敗北の呪い {id,left}
    map:{ gen:0, known:{}, visited:{}, gateProg:0, gateDone:0, seen:0 },   // 地形マップの記憶(世代ごと)
    settings:{ autoplay:true, gfx:'hd', gfxAuto:true },   // gfx: 'hd'=描き込み / 'pixel'=ドット。gfxAuto: fps低下で装飾を自動で省く
  };
}
let META=defaultMeta();
function saveMeta(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(META)); }catch(e){} }
function loadMeta(){
  try{
    const d=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
    if(d && (d.v===2||d.v===3)){
      META=Object.assign(defaultMeta(), d);
      META.v=3;
      META.gen=Object.assign({idx:1,battle:0,know:{}}, d.gen); META.gen.know=META.gen.know||{};
      META.life=Object.assign(defaultMeta().life, d.life);
      for(const k of ['ailBy','capBy','capCause']) META.life[k]=Object.assign({}, (d.life||{})[k]||{});
      META.nightItems=Object.assign({mist:true}, d.nightItems||{});
      META.traits=Object.assign({}, d.traits||{});
      META.codex=Object.assign({}, d.codex||{});
      META.rot=Object.assign(defaultMeta().rot, d.rot);
      META.settings=Object.assign(defaultMeta().settings, d.settings);
      META.lumina=Object.assign({coins:0,will:0,upg:{}}, d.lumina);
      META.curse=(d.curse&&d.curse.id&&d.curse.left>0)?d.curse:null;
      META.map=Object.assign({gen:0, known:{}, visited:{}, gateProg:0, gateDone:0, seen:0}, d.map||{});
      META.map.known=META.map.known||{}; META.map.visited=META.map.visited||{};
      META.lumina.upg=Object.assign({vital:0,guard:0,bless:0,swift:0,grit:0,zeal:0}, (d.lumina||{}).upg);
      migrateCards();
    }
  }catch(e){}
}
/* v2→v3: 廃止カード(こうもり/ゾンビ/宵闇こうもり)を除去し、コストを返金 */
function migrateCards(){
  const REFUND={ zombie:120, nightbat:320 };
  for(const id of Object.keys(META.cards)){
    if(!MONSTERS[id]){
      if(META.cards[id].owned && REFUND[id]) META.essence+=REFUND[id];
      delete META.cards[id];
    }
  }
  // 新スターターを保証
  for(const id of ['slug','worm','ghost']){
    if(!META.cards[id]) META.cards[id]={owned:true,lv:1};
    META.cards[id].owned=true;
  }
  META.deck=(META.deck||[]).filter(id=>META.cards[id]&&META.cards[id].owned);
  // 階級ごとの枠(雑魚2/中型2/大型1/ボス1)に収める(v1.0)
  const tcnt={};
  META.deck=META.deck.filter(id=>{ const t=tierOf(id); tcnt[t]=(tcnt[t]||0)+1; return tcnt[t]<=TIER_CAP[t]; });
  if(!META.deck.length) META.deck=['slug','worm','ghost'];
  META.formations=(META.formations||['scatter']).filter(f=>FORMATIONS[f]);
  if(!META.formations.includes('scatter')) META.formations.unshift('scatter');
}
function wipeMeta(){ META=defaultMeta(); saveMeta(); }

/* ---------------- ランタイム状態 ---------------- */
const G = {
  mode:'home',          // home | battle | levelup | captured | survived | result
  screen:'home',        // DOM側スクリーン
  B:null,               // 戦闘状態(battle開始時に生成)
  cam:{x:0,y:150},
  parts:[], floats:[],
  banner:null, shake:0, hurtFlash:0, fps:60,
  lobby:null,           // ホーム画面のルミナ(装飾)
  titleT:0,
};
window.__game = G;
window.__meta = ()=>META;

/* ---------------- 共有FX ---------------- */
function parts(x,y,n,colors,spd,life){
  for(let i=0;i<n;i++){
    if(G.parts.length>360) G.parts.shift();
    const a=rand(TAU), s=rand(0.25,1)*spd;
    G.parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:0,life:life*rand(0.6,1.2),
      c:colors[(Math.random()*colors.length)|0], r:rand(1.2,3)});
  }
}
function floatTxt(x,y,txt,c,size,life){
  if(G.floats.length>80) G.floats.shift();
  G.floats.push({x,y,txt,c,size,t:0,life,vy:-30});
}
function floatDmg(x,y,d){ floatTxt(x+rand(-6,6),y,String(Math.round(d)),'#fff',11,0.6); }
function setBanner(text,sub,color){ G.banner={text,sub,color,t:0,dur:2.4}; }
function fxTick(dt){
  for(const q of G.parts){ q.t+=dt; q.x+=q.vx*dt; q.y+=q.vy*dt; q.vx*=Math.pow(0.02,dt); q.vy*=Math.pow(0.02,dt); }
  G.parts=G.parts.filter(q=>q.t<q.life);
  for(const f of G.floats){ f.t+=dt; f.y+=f.vy*dt; }
  G.floats=G.floats.filter(f=>f.t<f.life);
  if(G.banner){ G.banner.t+=dt; if(G.banner.t>G.banner.dur) G.banner=null; }
  G.shake=Math.max(0,G.shake-dt*14);
  G.hurtFlash=Math.max(0,G.hurtFlash-dt);
}
