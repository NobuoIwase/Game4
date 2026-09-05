'use strict';
/* ============================================================
   render.js — 描画: 世界 / ルミナ / モンスター / FX / HUD
============================================================ */

const EN_COLORS={
  slug:['#b8d86a','#7a9a3a'], ghost:['#dfe4ff','#aab4e8'],
  slime:['#8fe8c9','#3fae86'], worm:['#c9a06a','#7a5a3a'], imp:['#ff86b3','#b8548a'],
  gas:['#ff9ec2','#d86aa0'], flower:['#e86a9c','#8fe8c9'],
  mistslime:['#ffc2d8','#8fe8c9'], gtent:['#a06ac9','#5a3a7a'],
  vampi:['#c04a6a','#ffd76a','#fff'],
  goblin:['#8fd36a','#4a7a3a'], leech:['#ffb3a0','#d87a6a'],
  tower:['#c98cff','#5a3a7a'],
  spore:['#c9ecff','#7fb8e0'], ghosthand:['#dfe4ff','#aab4e8'], eye:['#f0e8ff','#7a3ff2'],
  succubus:['#ff86b3','#5a1f3a'], web:['#ffb3cf','#fff'],
  gazer:['#b46cff','#3a1f5a','#f4efff'], beamer:['#d8c8ff','#5a3a7a'], bossgazer:['#b46cff','#2a1a3e','#f4efff'],
  slimeking:['#5fd0c0','#1a4a48','#ffd76a'], runemage:['#ff86b3','#3a1a3e','#ffd0e4'], succuqueen:['#ff5d9e','#3a1226','#ffd76a'], gobking:['#8fd36a','#2a3a1a','#ffd76a'],
  hand:['#d8d0f0','#a89ccf'], serpent:['#b07ae8','#5a3a8a'], moth:['#ffb3cf','#c9a0b8'],
  pot:['#b07890','#5a2a44'], slugqueen:['#e0a0c0','#8fae4a'], dreamtree:['#e86a9c','#3a2a3a'],
};

/* ---------------- 世界 ---------------- */
/* 地形の描画(マップチップ・場所・ミニマップ)は js/map.js */
function drawLight(g,x,y){
  const lg=g.createRadialGradient(x,y-10,20,x,y-10,270);
  lg.addColorStop(0,'rgba(255,244,214,0.10)');
  lg.addColorStop(1,'rgba(255,244,214,0)');
  g.fillStyle=lg;
  g.beginPath(); g.arc(x,y-10,270,0,TAU); g.fill();
}
function drawGem(g,gem){
  if(gem.lo){
    // ロージェム: 小さく、淡く。数で気持ちよく、経験値は薄い
    g.save();
    g.translate(gem.x,gem.y+Math.sin(gem.t*3)*1.5);
    g.rotate(gem.t*1.6);
    g.globalAlpha=0.85;
    g.fillStyle='#5f8fcf';
    g.fillRect(-2.6,-2.6,5.2,5.2);
    g.fillStyle='rgba(255,255,255,0.7)';
    g.fillRect(-2.6,-2.6,2.6,2.6);
    g.restore();
    return;
  }
  const s=gem.v>=4?5.5:4.2;
  const c=gem.v>=4?'#ffd76a':(gem.v>=2?'#7f9bff':'#6fd6ff');
  g.save();
  g.translate(gem.x,gem.y+Math.sin(gem.t*3)*2);
  g.rotate(gem.t*1.6);
  g.shadowColor=c; g.shadowBlur=7;
  g.fillStyle=c;
  g.fillRect(-s,-s,s*2,s*2);
  g.shadowBlur=0;
  g.fillStyle='rgba(255,255,255,0.85)';
  g.fillRect(-s,-s,s,s);
  g.restore();
}
function drawHeartDrop(g,h){
  g.save();
  g.translate(h.x,h.y-6+Math.sin(h.t*3.4)*2.5);
  const pl=1+Math.sin(h.t*6)*0.08;
  g.scale(pl,pl);
  g.shadowColor='#ff6b81'; g.shadowBlur=8;
  g.fillStyle='#ff7d95';
  heartPath(g,0,0,1.6); g.fill();
  g.shadowBlur=0;
  g.fillStyle='rgba(255,255,255,0.75)';
  g.beginPath(); g.arc(-2.2,-3.4,1.4,0,TAU); g.fill();
  g.restore();
}
function drawChest(g,c){
  g.save();
  g.translate(c.x,c.y+Math.sin(c.t*2.4)*1.5);
  g.shadowColor='#ffd76a'; g.shadowBlur=10+Math.sin(c.t*4)*4;
  g.fillStyle='#8a5a2a';
  rr(g,-11,-14,22,14,3); g.fill();
  g.fillStyle='#a8743a';
  rr(g,-11,-16,22,7,3); g.fill();
  g.shadowBlur=0;
  g.fillStyle='#ffd76a';
  g.fillRect(-1.6,-12,3.2,10);
  g.beginPath(); g.arc(0,-9,2.6,0,TAU); g.fill();
  g.strokeStyle='rgba(255,215,106,0.8)'; g.lineWidth=1.2;
  rr(g,-11,-16,22,16,3); g.stroke();
  g.restore();
}
function drawProp(g,pr){
  // 燭台(壊すと回復ドロップ)
  g.save();
  g.translate(pr.x,pr.y);
  g.fillStyle='rgba(8,8,26,0.3)';
  g.beginPath(); g.ellipse(0,1,8,2.6,0,0,TAU); g.fill();
  const dmg=pr.hp<pr.max;
  g.strokeStyle=dmg?'#8a7a5a':'#a8946a'; g.lineWidth=2.6; g.lineCap='round';
  g.beginPath(); g.moveTo(0,0); g.lineTo(0,-16); g.stroke();
  g.beginPath(); g.moveTo(-5,0); g.lineTo(5,0); g.stroke();
  g.beginPath(); g.moveTo(-4.5,-16); g.lineTo(4.5,-16); g.stroke();
  // 炎
  const fl=Math.sin(pr.t*7)*0.8;
  g.shadowColor='#ffb85a'; g.shadowBlur=10;
  g.fillStyle='#ffcf6a';
  g.beginPath();
  g.moveTo(0,-26-fl);
  g.quadraticCurveTo(3.4,-21,0,-17.5);
  g.quadraticCurveTo(-3.4,-21,0,-26-fl);
  g.fill();
  g.shadowBlur=0;
  g.fillStyle='#fff3c4';
  g.beginPath(); g.arc(0,-20,1.5,0,TAU); g.fill();
  if(dmg){
    const w2=16;
    g.fillStyle='rgba(10,10,26,0.7)';
    g.fillRect(-w2/2,-32,w2,3);
    g.fillStyle='#ffd76a';
    g.fillRect(-w2/2,-32,w2*clamp(pr.hp/pr.max,0,1),3);
  }
  g.restore();
}
function drawStain(g,st){
  // 潮の染み: 濡れて光る水たまり。ゆっくり乾く
  const fade=st.t>st.life*0.7 ? 1-(st.t-st.life*0.7)/(st.life*0.3) : 1;
  const grow=Math.min(1, st.t*2.5);
  g.save();
  g.translate(st.x,st.y);
  g.rotate(st.rot);
  g.globalAlpha=0.4*fade;
  g.fillStyle='rgba(40,54,96,0.8)';
  g.beginPath(); g.ellipse(0,0,st.r*grow,st.r*st.r2*grow,0,0,TAU); g.fill();
  g.globalAlpha=0.25*fade;
  g.fillStyle='rgba(150,180,230,0.9)';
  g.beginPath(); g.ellipse(-st.r*0.2,-st.r*0.12,st.r*0.55*grow,st.r*st.r2*0.4*grow,0,0,TAU); g.fill();
  g.globalAlpha=1;
  g.restore();
}
function drawTrail(g,tr){
  const a=clamp(1-tr.t/tr.life,0,1)*0.4;
  g.fillStyle='rgba(120,230,190,'+(a*0.55).toFixed(3)+')';
  g.beginPath(); g.ellipse(tr.x,tr.y,tr.r,tr.r*0.7,0,0,TAU); g.fill();
  g.fillStyle='rgba(200,255,235,'+(a*0.5).toFixed(3)+')';
  g.beginPath(); g.ellipse(tr.x-2,tr.y-2,tr.r*0.4,tr.r*0.26,0,0,TAU); g.fill();
}
let cloudSprite=null, muskSprite=null;
function makeCloudSprite(){
  const mk=(rgb)=>{ const cv=document.createElement('canvas'); cv.width=128; cv.height=128; const cg=cv.getContext('2d');
    for(const [ox,oy,rr2] of [[-12,-6,42],[14,8,36],[0,0,52]]){
      const grad=cg.createRadialGradient(64+ox,64+oy,rr2*0.2,64+ox,64+oy,rr2);
      grad.addColorStop(0,'rgba('+rgb+',0.22)'); grad.addColorStop(1,'rgba('+rgb+',0)');
      cg.fillStyle=grad; cg.beginPath(); cg.arc(64+ox,64+oy,rr2,0,TAU); cg.fill();
    } return cv; };
  cloudSprite=mk('255,158,194');     // 媚薬の霧(桃)
  muskSprite=mk('150,190,90');       // 雄臭の雲(くすんだ黄緑)
}
makeCloudSprite();
function drawCloud(g,c){
  // 媚薬ガス(桃色の滞留霧) — 事前レンダリング済みスプライトを回転・脈動させて描く
  const lifeA=clamp(Math.min(c.t*2.5,(c.life-c.t)*0.9),0,1);
  const sc=(c.r/52)*(1+Math.sin(c.t*1.1)*0.06);
  g.save();
  g.globalAlpha=lifeA;
  g.translate(c.x,c.y);
  g.rotate(c.t*0.25);
  const spr=c.kind==='musk'?muskSprite:cloudSprite;
  g.drawImage(spr,-64*sc,-64*sc,128*sc,128*sc);
  g.rotate(-c.t*0.5);
  g.drawImage(spr,-58*sc,-58*sc,116*sc,116*sc);
  g.globalAlpha=lifeA*0.6;
  g.fillStyle=c.kind==='musk'?'rgba(190,215,130,0.7)':'rgba(255,194,216,0.8)';
  for(let i=0;i<3;i++){
    const ph=c.t*1.3+i*2.1;
    g.beginPath();
    g.arc(Math.cos(ph)*c.r*0.5, Math.sin(ph*1.2)*c.r*0.4-3, 1.6,0,TAU);
    g.fill();
  }
  g.restore();
}
function drawZone(g,z){
  // きよめの泉/せいすい: 聖水の水面。波紋が広がる
  const a=clamp(Math.min(z.t*3,(z.life-z.t)*1.2),0,1);
  g.save();
  g.globalAlpha=a*0.55;
  const zg=g.createRadialGradient(z.x,z.y,z.r*0.2,z.x,z.y,z.r);
  zg.addColorStop(0,z.evo?'rgba(200,240,255,0.55)':'rgba(160,220,255,0.45)');
  zg.addColorStop(1,'rgba(120,180,255,0.05)');
  g.fillStyle=zg;
  g.beginPath(); g.ellipse(z.x,z.y,z.r,z.r*0.62,0,0,TAU); g.fill();
  g.strokeStyle='rgba(220,245,255,0.7)'; g.lineWidth=1.4;
  for(let i=0;i<2;i++){
    const ph=((z.t*0.7+i*0.5)%1);
    g.globalAlpha=a*(1-ph)*0.6;
    g.beginPath(); g.ellipse(z.x,z.y,z.r*(0.3+ph*0.7),z.r*0.62*(0.3+ph*0.7),0,0,TAU); g.stroke();
  }
  g.globalAlpha=a*0.9;
  g.fillStyle='#fff';
  for(let i=0;i<3;i++){
    const ph=(z.t*1.1+i*0.9)%1.5;
    g.beginPath(); g.arc(z.x+Math.sin(z.t*1.3+i*2.1)*z.r*0.5, z.y-ph*14+Math.cos(i)*z.r*0.3, 1.3,0,TAU); g.fill();
  }
  g.restore();
}
function drawFx(g,f){
  const pr=clamp(f.t/f.life,0,1);
  g.save();
  if(f.kind==='bolt'){
    // てんらい: 天から落ちる稲光(ジグザグ)
    g.globalAlpha=1-pr;
    g.strokeStyle='#fff6d8'; g.lineWidth=2.6; g.lineCap='round'; g.lineJoin='round';
    g.shadowColor='#ffd76a'; g.shadowBlur=14;
    g.beginPath(); g.moveTo(f.x+18,f.y-170);
    const segs=6;
    for(let i=1;i<=segs;i++){
      const yy=f.y-170+i*170/segs;
      const xx=f.x+(i===segs?0:Math.sin(i*2.3+f.x*0.01)*11);
      g.lineTo(xx,yy);
    }
    g.stroke();
    g.fillStyle='#fff';
    g.beginPath(); g.arc(f.x,f.y,9*(1-pr)+3,0,TAU); g.fill();
  }else if(f.kind==='flash'){
    // 催眠の閃光: 扇が白紫に光る
    g.globalAlpha=(1-pr)*0.85;
    g.fillStyle='#f0e6ff';
    g.beginPath(); g.moveTo(f.x,f.y); g.arc(f.x,f.y,f.r,f.ang-f.spread/2,f.ang+f.spread/2); g.closePath(); g.fill();
    g.globalAlpha=(1-pr)*0.5; g.fillStyle='#c98cff';
    g.beginPath(); g.arc(f.x,f.y,18+pr*40,0,TAU); g.fill();
  }else if(f.kind==='beam'){
    // 絶頂照射: 細く、速く、まぶしい
    g.globalAlpha=1-pr;
    g.strokeStyle='#fff6d8'; g.lineWidth=BAL.BEAM_W*(1-pr*0.6); g.lineCap='round';
    g.shadowColor='#ffd76a'; g.shadowBlur=16;
    g.beginPath(); g.moveTo(f.x,f.y); g.lineTo(f.x+Math.cos(f.ang)*f.len, f.y+Math.sin(f.ang)*f.len); g.stroke();
    g.shadowBlur=0;
    g.strokeStyle='#ff5d9e'; g.lineWidth=2;
    g.beginPath(); g.moveTo(f.x,f.y); g.lineTo(f.x+Math.cos(f.ang)*f.len, f.y+Math.sin(f.ang)*f.len); g.stroke();
  }else if(f.kind==='gaze'){
    const a=1-f.t/f.life;
    g.save();
    g.globalAlpha=a*0.55;
    g.strokeStyle='#c98cff'; g.lineWidth=1.2; g.setLineDash([3,4]);
    g.beginPath(); g.moveTo(f.x,f.y); g.lineTo(f.tx,f.ty); g.stroke();
    g.setLineDash([]);
    g.restore();
  }else if(f.kind==='pulse'){
    // 女王の甘い脈動: 広がる桃色の輪
    g.globalAlpha=(1-pr)*0.8;
    g.strokeStyle=f.col||'#ffb3cf'; g.lineWidth=3;
    g.shadowColor=f.col||'#ffb3cf'; g.shadowBlur=10;
    g.beginPath(); g.ellipse(f.x,f.y,f.r*pr,f.r*pr*0.7,0,0,TAU); g.stroke();
    g.globalAlpha=(1-pr)*0.25;
    g.fillStyle=f.col||'#ffb3cf';
    g.beginPath(); g.ellipse(f.x,f.y,f.r*pr,f.r*pr*0.7,0,0,TAU); g.fill();
  }
  g.restore();
}
function drawItem(g,it){
  // 燭台の品: 拾うと発動(聖光の閃き/星の吸引/流星群)
  g.save();
  g.translate(it.x,it.y-8+Math.sin(it.t*2.6)*2.5);
  const pl=1+Math.sin(it.t*5)*0.07;
  g.scale(pl,pl);
  if(it.kind==='wipe'){
    g.shadowColor='#fff6d8'; g.shadowBlur=14;
    g.fillStyle='#fff6d8';
    g.beginPath(); g.arc(0,0,7,0,TAU); g.fill();
    g.strokeStyle='#ffd76a'; g.lineWidth=2.2; g.lineCap='round';
    for(let i=0;i<4;i++){ const a=i*Math.PI/4+it.t; g.beginPath(); g.moveTo(Math.cos(a)*8,Math.sin(a)*8); g.lineTo(Math.cos(a)*13,Math.sin(a)*13); g.stroke(); }
  }else if(it.kind==='vacuum'){
    g.shadowColor='#8fd3ff'; g.shadowBlur=12;
    g.strokeStyle='#8fd3ff'; g.lineWidth=2.4; g.lineCap='round';
    g.rotate(-it.t*3);
    for(let i=0;i<3;i++){
      g.beginPath();
      for(let k=0;k<=8;k++){ const a=i*TAU/3+k*0.24, rr2=2+k*1.25; const px=Math.cos(a)*rr2, py=Math.sin(a)*rr2; k?g.lineTo(px,py):g.moveTo(px,py); }
      g.stroke();
    }
    g.fillStyle='#e8f4ff'; g.beginPath(); g.arc(0,0,2.4,0,TAU); g.fill();
  }else{
    g.shadowColor='#ffd76a'; g.shadowBlur=12;
    g.fillStyle='#ffd76a';
    star(g,0,0,10,4.5,5,-Math.PI/2+it.t); g.fill();
    g.fillStyle='#fff';
    star(g,6,-7,4,1.8,4,it.t*2); g.fill();
    star(g,-7,5,3.2,1.4,4,-it.t*2); g.fill();
  }
  g.restore();
}
/* v1.8 地形の資源: 光茸(苔の広間)・蜜の花(花園)・沈んだ宝(浅瀬) */
function drawPick(g,pk){
  g.save(); g.translate(pk.x,pk.y);
  const t=pk.t;
  if(pk.kind==='shroom'){
    g.fillStyle='rgba(8,8,26,0.3)'; g.beginPath(); g.ellipse(0,2,14,4.5,0,0,TAU); g.fill();
    glow(g,0,-8,22,'159,232,200',0.28+0.12*Math.sin(t*2.5));
    const caps=[[-7,0,6,'#7fd8b8'],[5,1,5,'#9fe8c8'],[0,-3,7.5,'#b6f2da']];
    for(const [x,y,r,c] of caps){
      g.fillStyle='#d8d8e8'; g.fillRect(x-1.5,y-r*0.6,3,r*0.8+2);
      g.fillStyle=c; g.beginPath(); g.ellipse(x,y-r*0.7,r,r*0.55,0,Math.PI,TAU); g.fill();
      g.fillStyle='rgba(255,255,255,0.7)'; g.beginPath(); g.arc(x-r*0.3,y-r*0.95,1.2,0,TAU); g.fill();
    }
  }else if(pk.kind==='nectar'){
    g.fillStyle='rgba(8,8,26,0.3)'; g.beginPath(); g.ellipse(0,2,12,4,0,0,TAU); g.fill();
    g.strokeStyle='#4f8a4a'; g.lineWidth=2; g.beginPath(); g.moveTo(0,2); g.quadraticCurveTo(2,-8,0,-16); g.stroke();
    g.fillStyle='#5aa050'; g.beginPath(); g.ellipse(-5,-6,5,2.4,-0.5,0,TAU); g.fill();
    const sw=1+0.06*Math.sin(t*3);
    g.translate(0,-18); g.scale(sw,sw);
    g.fillStyle='#ffb3cf'; for(let i=0;i<6;i++){ const a=i*TAU/6+t*0.2; g.beginPath(); g.ellipse(Math.cos(a)*6,Math.sin(a)*6,5,3,a,0,TAU); g.fill(); }
    glow(g,0,0,14,'255,215,106',0.3+0.15*Math.sin(t*4));
    g.fillStyle='#ffd76a'; g.beginPath(); g.arc(0,0,3.6,0,TAU); g.fill();
    g.fillStyle='rgba(255,236,160,0.9)'; g.beginPath(); g.arc(2,4+((t*0.7)%1)*6,1.6,0,TAU); g.fill();   // 蜜のしずく
  }else{
    // 沈んだ宝: 水面の下の小箱。波紋ときらめき
    g.fillStyle='rgba(60,140,210,0.35)'; g.beginPath(); g.ellipse(0,0,22,10,0,0,TAU); g.fill();
    g.save(); g.globalAlpha=0.7; g.fillStyle='#6a4a22'; rr(g,-9,-8,18,10,2); g.fill(); g.fillStyle='#8a6a32'; rr(g,-9,-10,18,5,2); g.fill(); g.fillStyle='#ffd76a'; g.fillRect(-1.2,-8,2.4,6); g.restore();
    g.strokeStyle='rgba(220,245,255,0.5)'; g.lineWidth=1; for(let i=0;i<2;i++){ const ph=(t*0.6+i*0.5)%1; g.beginPath(); g.ellipse(0,0,8+ph*16,(8+ph*16)*0.45,0,0,TAU); g.stroke(); }
    g.fillStyle='rgba(255,255,255,'+(0.5+0.5*Math.sin(t*6)).toFixed(2)+')'; g.beginPath(); g.arc(-5,-4,1.4,0,TAU); g.fill();
  }
  g.restore();
}
function hexA(hex,a){ const n=parseInt(hex.slice(1),16); return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+Math.max(0,Math.min(1,a)).toFixed(3)+')'; }
/* v1.8 イベントの光の柱(遠くからでも見える) */
function drawEventPillar(g,ev){
  const c=(EVENT_DEF[ev.kind]&&EVENT_DEF[ev.kind].col)||'#ffffff';
  const t=ev.t, a=0.34+0.1*Math.sin(t*3);
  g.save();
  const grad=g.createLinearGradient(0,ev.y,0,ev.y-700); grad.addColorStop(0,hexA(c,a*1.6)); grad.addColorStop(0.5,hexA(c,a)); grad.addColorStop(1,hexA(c,0));
  g.fillStyle=grad; g.fillRect(ev.x-30,ev.y-700,60,700);
  g.fillStyle=hexA(c,a*0.9); g.fillRect(ev.x-8,ev.y-700,16,700);
  glow(g,ev.x,ev.y,70,c.startsWith('#')?(parseInt(c.slice(1,3),16)+','+parseInt(c.slice(3,5),16)+','+parseInt(c.slice(5,7),16)):'255,255,255',0.25+0.1*Math.sin(t*3));
  g.strokeStyle=hexA(c,0.6); g.lineWidth=2; g.beginPath(); g.ellipse(ev.x,ev.y+2,30+4*Math.sin(t*2),12+1.5*Math.sin(t*2),0,0,TAU); g.stroke();
  for(let i=0;i<6;i++){ const ph=(t*0.35+i/6)%1; g.fillStyle=hexA(c,(1-ph)*0.8); g.beginPath(); g.arc(ev.x+Math.sin(i*2.1+t)*14,ev.y-ph*260,2,0,TAU); g.fill(); }
  g.restore();
}
/* v1.8 画面の端に、画面外の目当て/イベントの方向を示す矢印 */
function drawEdgeArrow(g,wx,wy,col,label){
  const dx=wx-G.cam.x, dy=wy-G.cam.y;
  if(Math.abs(dx)<W/2-40 && Math.abs(dy)<H/2-40) return;   // 画面内なら要らない
  const m=28, k=Math.min((W/2-m)/Math.abs(dx||0.001),(H/2-m)/Math.abs(dy||0.001));
  const sx=W/2+dx*k, sy=H/2+dy*k, ang=Math.atan2(dy,dx);
  g.save(); g.translate(sx,sy); g.rotate(ang);
  g.fillStyle=col; g.shadowColor=col; g.shadowBlur=8;
  g.beginPath(); g.moveTo(10,0); g.lineTo(-6,-7); g.lineTo(-3,0); g.lineTo(-6,7); g.closePath(); g.fill();
  g.restore();
  if(label){ g.save(); g.font='bold 10px '+FONT; g.textAlign='center'; g.textBaseline='middle'; g.fillStyle=col; g.shadowColor='rgba(0,0,0,0.8)'; g.shadowBlur=4;
    g.fillText(label, clamp(sx-Math.cos(ang)*30,34,W-34), clamp(sy-Math.sin(ang)*30,14,H-14)); g.restore(); }
}
/* v1.8 目当ての名前と方角(HUD・ミニマップ用) */
function goalName(gl){
  if(!gl) return '';
  if(gl.kind==='event') return '光の柱('+((EVENT_DEF[gl.sub]&&EVENT_DEF[gl.sub].name)||'')+')';
  if(gl.kind==='item') return '落ちた品';
  if(gl.kind==='chest') return gl.sub==='boss'?'王の宝箱':'宝箱';
  if(gl.kind==='poi') return (POI_DEF[gl.sub]&&POI_DEF[gl.sub].name)||gl.sub;
  if(gl.kind==='pick') return (PICK_DEF[gl.sub]&&PICK_DEF[gl.sub].name)||gl.sub;
  return '探索';
}
function dirName(dx,dy){ const a=Math.atan2(dy,dx); const i=Math.round((a+Math.PI)/(Math.PI/4))%8; return ['西','北西','北','北東','東','南東','南','南西'][i]; }
function drawSummonFx(g,s){
  const pr=s.t/0.6, a=1-pr;
  g.save();
  g.globalAlpha=a*0.8;
  g.strokeStyle=s.dormant?'#6a5a9c':'#b46cff';
  g.lineWidth=2;
  g.beginPath(); g.ellipse(s.x,s.y,s.r+pr*18,(s.r+pr*18)*0.4,0,0,TAU); g.stroke();
  g.globalAlpha=a*0.5;
  star(g,s.x,s.y,(s.r+pr*10)*0.8,(s.r+pr*10)*0.35,3,pr*3); g.stroke();
  g.restore();
}
function bowShape(g,x,y,s,color){
  g.fillStyle=color;
  g.beginPath(); g.moveTo(x,y); g.lineTo(x-s*1.6,y-s); g.lineTo(x-s*1.6,y+s); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(x,y); g.lineTo(x+s*1.6,y-s); g.lineTo(x+s*1.6,y+s); g.closePath(); g.fill();
  g.beginPath(); g.arc(x,y,s*0.55,0,TAU); g.fill();
}

/* ---------------- ルミナ ---------------- */
/* ドット絵スプライト(assets/sprites/lumina.png)。
   読み込めた場合はベクタ絵の代わりに使う(無ければ従来描画へフォールバック) */
const LUMINA_SPR=new Image();
let LUMINA_OK=false;
LUMINA_SPR.onload=()=>{ LUMINA_OK=true; };
LUMINA_SPR.onerror=()=>{ LUMINA_OK=false; };
LUMINA_SPR.src='assets/sprites/lumina.png';
/* v1.3 描き込み版(70×105・縁取り付き)。META.settings.gfx==='hd' のとき使う */
const LUMINA_HD=new Image();
let LUMINA_HD_OK=false;
LUMINA_HD.onload=()=>{ LUMINA_HD_OK=true; };
LUMINA_HD.onerror=()=>{ LUMINA_HD_OK=false; };
LUMINA_HD.src='assets/sprites/lumina_hd.png';
const gfxHd=()=>LUMINA_HD_OK && ((META.settings&&META.settings.gfx)||'hd')==='hd';
/* v1.4: 原本(160×240)から端末の実ピクセル寸のスプライトを一度だけ焼く(色変種込み)。毎フレームの ctx.filter を廃止 */
const LUMINA_H=60;                    // 論理高さ(足元アンカー -hgt+2 は据え置き)
const LUMINA_VAR={key:''};
function bakeVariants(img,cw,ch,smooth){
  let src=img;                        // 2段階で縮小(1回で縮めるとぼやける)
  while(smooth && src.height>ch*2){
    const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(src.width/2)); c.height=Math.max(1,Math.round(src.height/2));
    const t=c.getContext('2d'); t.imageSmoothingQuality='high'; t.drawImage(src,0,0,c.width,c.height); src=c;
  }
  const mk=(fill,lighten)=>{
    const c=document.createElement('canvas'); c.width=Math.max(1,cw); c.height=Math.max(1,ch); const t=c.getContext('2d');
    t.imageSmoothingEnabled=smooth; t.imageSmoothingQuality='high'; t.drawImage(src,0,0,c.width,c.height);
    if(fill){ t.globalCompositeOperation='source-atop'; t.fillStyle=fill; t.fillRect(0,0,c.width,c.height); }
    if(lighten){ t.globalCompositeOperation='lighter'; t.fillStyle=lighten; t.fillRect(0,0,c.width,c.height); }
    return c;
  };
  return { normal:mk(), heat:mk('rgba(255,120,160,0.22)'), climax:mk('rgba(255,90,150,0.34)','rgba(255,255,255,0.07)'), hurt:mk('rgba(255,255,255,0.62)') };
}
function luminaVariants(hd){
  const ds=Math.max(0.5,Math.round(dpr*viewScale*4)/4);   // 論理1pxあたりの実ピクセル(0.25刻み)。resize() で変わる
  const key=(hd?'hd':'px')+ds;
  if(LUMINA_VAR.key===key) return LUMINA_VAR;
  const img=hd?LUMINA_HD:LUMINA_SPR;
  const hgt=hd?LUMINA_H:img.height*1.05, w=img.width*hgt/img.height;
  Object.assign(LUMINA_VAR,{key,w,h:hgt}, hd?bakeVariants(img,Math.round(w*ds),Math.round(hgt*ds),true):bakeVariants(img,img.width,img.height,false));
  return LUMINA_VAR;
}
const HALO_ST=(()=>{ const c=document.createElement('canvas'); c.width=c.height=40; const t=c.getContext('2d');
  const gr=t.createRadialGradient(20,20,2,20,20,20); gr.addColorStop(0,'rgba(255,215,106,0.35)'); gr.addColorStop(1,'rgba(255,215,106,0)');
  t.fillStyle=gr; t.fillRect(0,0,40,40); return c; })();

function drawGirlSprite(g,x,y,opt){
  const t=opt.t, mood=opt.mood||'normal', moving=opt.moving, heat=opt.heat||0;
  const bound=mood==='bound', pinned=mood==='pinned', climax=mood==='climax';
  const s=1.05;
  g.save();
  g.translate(x,y);
  const bob = pinned?Math.sin(t*15)*0.6
            : bound?Math.sin(t*22)*0.8
            : climax?0
            : moving?-Math.abs(Math.sin(t*9))*2.4 : Math.sin(t*2.6)*0.9;
  let jx=0;
  if(climax) jx=Math.sin(t*46)*1.7;             // 痙攣の横ぶれ
  // 落ち影(二層。歩きで浮くほど内側の濃い影が縮む)
  const lift=Math.max(0,-bob);
  g.fillStyle='rgba(8,8,26,0.22)'; g.beginPath(); g.ellipse(0,1,13,4,0,0,TAU); g.fill();
  g.fillStyle='rgba(8,8,26,0.35)'; g.beginPath(); g.ellipse(0,1,7*(1-lift/6),2.2*(1-lift/6),0,0,TAU); g.fill();
  g.translate(jx, bob + (pinned?5:0) + (climax?3:0));
  if(bound) g.rotate(Math.sin(t*17)*0.05);
  if(pinned) g.rotate(Math.sin(t*9)*0.07);
  if(climax) g.rotate(Math.sin(t*30)*0.05);     // びくっ、びくっ
  const sy=(pinned?0.84:1)*(climax?1-Math.abs(Math.sin(t*13))*0.09:1);
  const hd=gfxHd();
  const V=luminaVariants(hd);
  const img=G.hurtFlash>0.15?V.hurt:climax?V.climax:heat>=60?V.heat:V.normal;
  const w=V.w, hgt=V.h*sy;
  g.imageSmoothingEnabled=!!hd; if(hd) g.imageSmoothingQuality='high';
  if(hd) g.drawImage(img,-w/2,-hgt+2,w,hgt);
  else g.drawImage(img,Math.round(-w/2),Math.round(-hgt+2),Math.round(w),Math.round(hgt));
  if(hd){
    // 光輪のにじみ(1回のブリット。脈動し、絶頂時は大きく)
    const hs=climax?52:40;
    g.globalCompositeOperation='lighter'; g.globalAlpha=climax?1:0.55+0.35*Math.sin(t*2.2);
    g.drawImage(HALO_ST,-hs/2,-hgt+2+hgt*0.08-hs/2,hs,hs);
    g.globalAlpha=1; g.globalCompositeOperation='source-over';
    g.imageSmoothingEnabled=false;
  }
  // 頬の火照り
  if(heat>=30||climax){
    g.globalAlpha=climax?0.6:Math.min(0.5,(heat-30)/70*0.6);
    g.fillStyle='#ff86a8';
    if(hd){ g.beginPath(); g.ellipse(-6,-hgt*0.60,2.6,1.6,0,0,TAU); g.fill(); g.beginPath(); g.ellipse(6,-hgt*0.60,2.6,1.6,0,0,TAU); g.fill(); }
    else{ g.fillRect(-9,Math.round(-hgt*0.62),4,2); g.fillRect(5,Math.round(-hgt*0.62),4,2); }
    g.globalAlpha=1;
  }
  // 絶頂の白い明滅
  if(climax){
    const fl=Math.max(0,Math.sin(t*26));
    g.globalAlpha=fl*0.16;
    g.fillStyle='#fff';
    g.beginPath(); g.arc(0,-hgt*0.5,hgt*0.62,0,TAU); g.fill();
    g.globalAlpha=1;
  }
  g.restore();
}
function drawGirl(g,x,y,opt){
  if(LUMINA_OK){ drawGirlSprite(g,x,y,opt); return; }
  if(opt.mood==='climax') opt=Object.assign({},opt,{mood:'pinned'});
  const t=opt.t, face=opt.face||1, moving=opt.moving, mood=opt.mood||'normal';
  const heat=opt.heat||0;
  const s=opt.scale||1.15;
  const bound=mood==='bound', pinned=mood==='pinned';
  g.save();
  g.translate(x,y);
  g.fillStyle='rgba(8,8,26,0.35)';
  g.beginPath(); g.ellipse(0,0,11*s,3.4*s,0,0,TAU); g.fill();

  const bob = pinned ? Math.sin(t*15)*0.6
            : bound ? Math.sin(t*22)*0.8
            : moving ? -Math.abs(Math.sin(t*9))*2.4 : Math.sin(t*2.6)*0.9;
  g.translate(0,bob*s + (pinned?5*s:0));
  if(bound) g.rotate(Math.sin(t*17)*0.05);
  if(pinned) g.rotate(Math.sin(t*9)*0.07);
  g.scale(face*s, s*(pinned?0.84:1));

  const swing = moving&&!bound&&!pinned ? Math.sin(t*9)*3.4 : 0;
  const sway  = Math.sin(t*5+1)*(moving&&!bound?2.4:1.1);

  // ツインテール(奥)
  g.fillStyle='#e7e3f8';
  for(const sd of [-1,1]){
    const ax=sd*8.2, ay=-33;
    g.beginPath();
    g.moveTo(ax,ay-3);
    g.quadraticCurveTo(sd*17,-29+sway*0.5, sd*13+sway*0.8*sd, -13+Math.abs(sway)*0.4);
    g.quadraticCurveTo(sd*9,-23, ax, ay+2);
    g.closePath(); g.fill();
  }

  // 脚+くつ
  g.strokeStyle='#ffffff'; g.lineCap='round'; g.lineWidth=3;
  if(pinned){
    g.beginPath(); g.moveTo(-3.2,-9); g.lineTo(-6.5,-2.5); g.stroke();
    g.beginPath(); g.moveTo(3.2,-9); g.lineTo(6.5,-2.5); g.stroke();
    g.fillStyle='#f7a4c4';
    g.beginPath(); g.ellipse(-7,-2,2.5,1.8,-0.5,0,TAU); g.fill();
    g.beginPath(); g.ellipse(7,-2,2.5,1.8,0.5,0,TAU); g.fill();
  }else{
    g.beginPath(); g.moveTo(-3.2,-9); g.lineTo(-3.2+swing*0.4,-1.5); g.stroke();
    g.beginPath(); g.moveTo(3.2,-9);  g.lineTo(3.2-swing*0.4,-1.5); g.stroke();
    g.fillStyle='#f7a4c4';
    g.beginPath(); g.ellipse(-3.2+swing*0.4,-1,2.5,1.8,0,0,TAU); g.fill();
    g.beginPath(); g.ellipse(3.2-swing*0.4,-1,2.5,1.8,0,0,TAU); g.fill();
  }

  // ワンピース(白のAライン+すそフリル)
  const hw=10.5+Math.abs(sway)*0.25;
  const dg=g.createLinearGradient(0,-24,0,-4);
  dg.addColorStop(0,'#ffffff'); dg.addColorStop(1,'#e7ebff');
  g.fillStyle=dg;
  g.strokeStyle='rgba(160,170,215,0.9)'; g.lineWidth=1;
  g.beginPath();
  g.moveTo(-4.5,-24);
  g.quadraticCurveTo(-8.5,-16,-hw,-6);
  g.quadraticCurveTo(-hw*0.66,-3.4+sway*0.3,-hw*0.33,-6);
  g.quadraticCurveTo(0,-3.4-sway*0.3,hw*0.33,-6);
  g.quadraticCurveTo(hw*0.66,-3.4+sway*0.3,hw,-6);
  g.quadraticCurveTo(8.5,-16,4.5,-24);
  g.closePath(); g.fill(); g.stroke();
  bowShape(g,0,-21.5,2.1,'#8fd3ff');

  // うで
  g.strokeStyle='#ffeadd'; g.lineWidth=2.6;
  if(bound||pinned){
    const wig=Math.sin(t*19)*1.2;
    g.beginPath(); g.moveTo(-6.5,-21); g.lineTo(-8.5+wig,-14); g.stroke();
    g.beginPath(); g.moveTo(6.5,-21); g.lineTo(8.5-wig,-14); g.stroke();
  }else{
    g.beginPath(); g.moveTo(-6.5,-21); g.lineTo(-9.5,-15.5); g.stroke();
    g.beginPath(); g.moveTo(6.5,-21); g.lineTo(10.5,-16); g.stroke();
    g.strokeStyle='#e8b96a'; g.lineWidth=1.8;
    g.beginPath(); g.moveTo(10.5,-16); g.lineTo(14.5,-23); g.stroke();
    g.shadowColor='#ffd76a'; g.shadowBlur=6;
    g.fillStyle='#ffd76a';
    star(g,15,-24.5,3.6,1.5,4,t*2); g.fill();
    g.shadowBlur=0;
  }

  // 顔
  g.fillStyle='#ffeadd';
  g.beginPath(); g.arc(0,-31.5,9.2,0,TAU); g.fill();

  // 前髪
  g.fillStyle='#efeafb';
  g.beginPath();
  g.moveTo(-9.3,-31);
  g.quadraticCurveTo(-10.5,-40,0,-41.4);
  g.quadraticCurveTo(10.5,-40,9.3,-31);
  g.quadraticCurveTo(7,-34.5,4.8,-30.6);
  g.quadraticCurveTo(2.5,-34.8,0,-30.9);
  g.quadraticCurveTo(-2.5,-34.8,-4.8,-30.6);
  g.quadraticCurveTo(-7,-34.5,-9.3,-31);
  g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-9.2,-32); g.quadraticCurveTo(-11,-27,-9,-21.5); g.quadraticCurveTo(-7.4,-26,-7.8,-31); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(9.2,-32); g.quadraticCurveTo(11,-27,9,-21.5); g.quadraticCurveTo(7.4,-26,7.8,-31); g.closePath(); g.fill();
  g.strokeStyle='#efeafb'; g.lineWidth=1.6; g.lineCap='round';
  g.beginPath(); g.moveTo(0,-41); g.quadraticCurveTo(1.5,-45,4,-44.4); g.stroke();
  bowShape(g,-8.6,-31,1.7,'#8fd3ff');
  bowShape(g,8.6,-31,1.7,'#8fd3ff');

  // 目・ほっぺ・くち
  const blink=(t%3.3)<0.12;
  if(mood==='hurt'||bound||pinned){
    g.strokeStyle='#4a4560'; g.lineWidth=1.5; g.lineCap='round';
    for(const sd of [-1,1]){
      g.beginPath(); g.moveTo(sd*2.2,-31.8); g.lineTo(sd*4.9,-30.4); g.stroke();
      g.beginPath(); g.moveTo(sd*2.2,-29.2); g.lineTo(sd*4.9,-30.4); g.stroke();
    }
  }else if(mood==='happy' || blink){
    g.strokeStyle='#4a4560'; g.lineWidth=1.5; g.lineCap='round';
    for(const sd of [-1,1]){
      g.beginPath(); g.arc(sd*3.6,-30.2,1.9,Math.PI*1.15,Math.PI*1.85); g.stroke();
    }
  }else{
    for(const sd of [-1,1]){
      g.fillStyle='#5b74d8';
      g.beginPath(); g.ellipse(sd*3.6,-30.3,1.9,2.6,0,0,TAU); g.fill();
      g.fillStyle='rgba(255,255,255,0.95)';
      g.beginPath(); g.arc(sd*3.6-0.6,-31.3,0.75,0,TAU); g.fill();
      g.strokeStyle='#4a4560'; g.lineWidth=1.2; g.lineCap='round';
      g.beginPath(); g.arc(sd*3.6,-31.6,2.3,Math.PI*1.1,Math.PI*1.9); g.stroke();
    }
  }
  // ほお(媚薬・発情で濃くなる)
  const blush=0.45+clamp(heat/100,0,1)*0.45;
  g.fillStyle='rgba(255,120,160,'+blush.toFixed(2)+')';
  g.beginPath(); g.ellipse(-6.3,-27.4,1.8+heat/100,1.1+heat/160,0,0,TAU); g.fill();
  g.beginPath(); g.ellipse(6.3,-27.4,1.8+heat/100,1.1+heat/160,0,0,TAU); g.fill();
  g.strokeStyle='#d4708a'; g.lineWidth=1.1; g.lineCap='round';
  if(mood==='hurt'||bound||pinned){
    g.beginPath(); g.moveTo(-1.6,-26.2); g.quadraticCurveTo(0,-27.4,1.6,-26.2); g.stroke();
  }else if(mood==='happy'){
    g.beginPath(); g.arc(0,-27.2,2.2,Math.PI*0.12,Math.PI*0.88); g.stroke();
  }else{
    g.beginPath(); g.arc(0,-26.8,1.7,Math.PI*0.15,Math.PI*0.85); g.stroke();
  }

  // 天使の輪
  g.strokeStyle='rgba(255,215,90,0.95)'; g.lineWidth=2.2;
  g.shadowColor='#ffd76a'; g.shadowBlur=7;
  g.beginPath(); g.ellipse(0,-46.5+Math.sin(t*3)*1,7.5,2.4,0,0,TAU); g.stroke();
  g.shadowBlur=0;

  g.restore();
}
/* 四肢への絡みつき描画 */
function drawAttachments(g,h){
  for(const sl of LIMBS){
    const at=h.limbs[sl];
    if(!at||!at.mon||at.mon.dead) continue;
    const p=limbAnchor(h,sl);
    const t=h.anim+sl.length;
    if(at.kind==='possess'){
      // 手霊の憑依: 半透明の手が腕を借りている
      g.save();
      g.translate(p.x,p.y);
      g.globalAlpha=0.8;
      g.shadowColor='#aab4e8'; g.shadowBlur=8;
      g.fillStyle='rgba(232,236,255,0.85)';
      g.beginPath(); g.ellipse(0,0,4.2,3.4,0,0,TAU); g.fill();
      g.strokeStyle='rgba(232,236,255,0.9)'; g.lineWidth=1.6; g.lineCap='round';
      for(let i=0;i<4;i++){ const a=-Math.PI*0.9+i*0.45+Math.sin(t*5+i)*0.15; g.beginPath(); g.moveTo(0,0); g.lineTo(Math.cos(a)*6,Math.sin(a)*6); g.stroke(); }
      g.restore();
      continue;
    }
    if(at.kind==='cling'){
      // ワーム/淫蛇の巻きつき
      const snake=at.mon.id==='serpent';
      g.save();
      g.translate(p.x,p.y);
      g.rotate(Math.sin(t*8)*0.2);
      g.strokeStyle=snake?'#9a6ad8':'#c9a06a'; g.lineWidth=3.4; g.lineCap='round';
      for(let i=0;i<3;i++){
        g.beginPath();
        g.arc(0,-i*2.6,4.6-i*0.7, Math.PI*0.15+Math.sin(t*6+i)*0.2, Math.PI*1.6+Math.sin(t*6+i)*0.2);
        g.stroke();
      }
      g.fillStyle=snake?'#b07ae8':'#7a5a3a';
      g.beginPath(); g.arc(Math.sin(t*6)*2,-8,2.6,0,TAU); g.fill();
      g.fillStyle=snake?'#ffd76a':'#e8d8c8';
      g.beginPath(); g.arc(Math.sin(t*6)*2,-8,1.2,0,TAU); g.fill();
      g.restore();
    }else{
      // 蔦(触手花/大触手): 主から四肢への線+巻き
      const src=at.mon;
      g.save();
      g.strokeStyle=src.id==='gtent'?'#a06ac9':(src.id==='web'?'#ffb3cf':'#4fc496');
      g.lineWidth=src.id==='gtent'?3.6:(src.id==='web'?1.8:2.6);
      g.lineCap='round';
      const mx=(src.x+p.x)/2+Math.sin(t*3)*8, my=(src.y-8+p.y)/2+Math.cos(t*2.5)*6;
      g.beginPath();
      g.moveTo(src.x,src.y-src.r*0.5);
      g.quadraticCurveTo(mx,my,p.x,p.y);
      g.stroke();
      // 巻きつき
      g.lineWidth=src.id==='gtent'?3:2.2;
      for(let i=0;i<2;i++){
        g.beginPath();
        g.arc(p.x,p.y-i*2.6,4.2-i*0.8, Math.PI*0.2+Math.sin(t*5+i)*0.25, Math.PI*1.7);
        g.stroke();
      }
      g.restore();
    }
  }
}
/* v1.2 状態の見た目: 時間停止/触手服/淫紋/寸止め/視姦 */
function drawStateFx(g,h){
  const t=h.anim;
  if(h.freezeT>0){
    g.save();
    g.globalAlpha=0.35; g.fillStyle='#8fd3ff';
    g.beginPath(); g.ellipse(h.x,h.y-22,20,30,0,0,TAU); g.fill();
    g.globalAlpha=0.9; g.strokeStyle='#e8f6ff'; g.lineWidth=1.6;
    g.beginPath(); g.arc(h.x,h.y-22,34,0,TAU); g.stroke();
    for(let i=0;i<12;i++){ const a=i*TAU/12; g.beginPath(); g.moveTo(h.x+Math.cos(a)*30,h.y-22+Math.sin(a)*30); g.lineTo(h.x+Math.cos(a)*34,h.y-22+Math.sin(a)*34); g.stroke(); }
    const ang=-Math.PI/2+TAU*(1-h.freezeT/BAL.FREEZE_DUR);
    g.lineWidth=2.4; g.beginPath(); g.moveTo(h.x,h.y-22); g.lineTo(h.x+Math.cos(ang)*26,h.y-22+Math.sin(ang)*26); g.stroke();
    g.restore();
  }
  if(h.suitT>0){
    g.save();
    g.globalAlpha=0.7; g.strokeStyle='#ff9ec2'; g.lineWidth=2; g.lineCap='round';
    for(let i=0;i<5;i++){
      const x0=h.x+(i-2)*4, ph=t*3+i;
      g.beginPath(); g.moveTo(x0,h.y-2);
      g.quadraticCurveTo(x0+Math.sin(ph)*8, h.y-22, x0+Math.cos(ph*0.7)*5, h.y-40+Math.sin(ph)*3);
      g.stroke();
    }
    g.fillStyle='rgba(255,158,194,0.9)';
    const pl=Math.max(0,Math.sin((BAL.SUIT_PULSE-h.suitPulse)*4));
    g.beginPath(); g.arc(h.x-5,h.y-26,1.6+pl*1.2,0,TAU); g.fill();
    g.beginPath(); g.arc(h.x+5,h.y-26,1.6+pl*1.2,0,TAU); g.fill();
    g.restore();
  }
  if(h.crestLv>0){
    g.save();
    g.globalAlpha=0.35+0.25*Math.sin(t*4)+0.1*h.crestLv;
    g.shadowColor='#ff86b3'; g.shadowBlur=8;
    g.strokeStyle='#ff86b3'; g.lineWidth=1.2;
    for(let k=0;k<h.crestLv;k++){ g.beginPath(); g.ellipse(h.x,h.y-9,5+k*2.5,3+k*1.5,0,0,TAU); g.stroke(); }
    g.fillStyle='#ffb3cf'; heartPath(g,h.x,h.y-10,0.55); g.fill();
    g.restore();
  }
  if(h.denyT>0){
    g.save();
    const pl=0.5+0.5*Math.sin(t*9);
    g.globalAlpha=0.5+0.3*pl;
    g.strokeStyle='#ff5d9e'; g.lineWidth=2;
    g.beginPath(); g.arc(h.x,h.y-8,9+pl*3,0,TAU); g.stroke();
    g.fillStyle='#ffd3e6'; g.beginPath(); g.arc(h.x,h.y-8,2.2,0,TAU); g.fill();
    g.restore();
  }
  if(h.watchedT>0 && G.B){
    g.save();
    g.globalAlpha=0.22; g.strokeStyle='#c98cff'; g.lineWidth=1; g.setLineDash([2,5]);
    for(const e of G.B.enemies){
      if(e.dead||e.id!=='eye') continue;
      if(Math.hypot(e.x-h.x,e.y-h.y)>BAL.WATCH_R) continue;
      g.beginPath(); g.moveTo(e.x,e.y-e.r*1.2); g.lineTo(h.x,h.y-24); g.stroke();
    }
    g.setLineDash([]);
    g.restore();
  }
}
function drawSuckers(g,h){
  // 吸液羽虫の吸い付き: 胸の先・脚の間で羽を震わせながら脈打つ
  for(const sl of SUCKS){
    const at=h.suckers[sl];
    if(!at||!at.mon||at.mon.dead) continue;
    const p=suckAnchor(h,sl);
    const t=h.anim*1.3+sl.length;
    const puls=1+Math.sin(t*6)*0.16;
    g.save();
    g.translate(p.x,p.y);
    // 羽の残像
    const wf=Math.sin(t*34)*0.6;
    g.fillStyle='rgba(255,225,235,0.45)';
    for(const sd of [-1,1]){
      g.save();
      g.rotate(sd*(0.6+wf*0.4));
      g.beginPath(); g.ellipse(0,-6,2.6,5.5,0,0,TAU); g.fill();
      g.restore();
    }
    // 肉質の体(吸い付いて脈打つ)
    const grad=g.createRadialGradient(-1,-2,1,0,0,6.5*puls);
    grad.addColorStop(0,'#ffc7b5');
    grad.addColorStop(1,'#d87a6a');
    g.fillStyle=grad;
    g.beginPath(); g.ellipse(0,-1,5.6*puls,4.4*puls,Math.sin(t*2)*0.2,0,TAU); g.fill();
    // 吸引の波紋
    g.strokeStyle='rgba(255,157,138,'+(0.5+0.3*Math.sin(t*6)).toFixed(2)+')';
    g.lineWidth=1.1;
    g.beginPath(); g.arc(0,-1,7.5+Math.sin(t*6)*1.5,0,TAU); g.stroke();
    g.restore();
  }
}
function drawStruggleRing(g,h){
  const o=oldestRestraint(h);
  if(!o) return;
  const pr=clamp(h.struggle/o.at.need,0,1);
  g.save();
  g.translate(h.x,h.y-56);
  g.strokeStyle='rgba(20,24,50,0.75)'; g.lineWidth=4;
  g.beginPath(); g.arc(0,0,9,0,TAU); g.stroke();
  g.strokeStyle='#8fd3ff'; g.lineWidth=4; g.lineCap='round';
  g.beginPath(); g.arc(0,0,9,-Math.PI/2,-Math.PI/2+TAU*pr); g.stroke();
  g.fillStyle='#cfe7ff'; g.font='bold 8px '+FONT;
  g.textAlign='center'; g.textBaseline='middle';
  g.fillText('もがき',0,0.5);
  g.restore();
}
function drawPinGauge(g,h){
  if(!h.pinned) return;
  const pr=clamp(h.pinEscape/100,0,1);
  g.save();
  g.translate(h.x,h.y-62);
  rr(g,-30,-5,60,10,5);
  g.fillStyle='rgba(20,24,50,0.85)'; g.fill();
  if(pr>0){ rr(g,-30,-5,60*pr,10,5); g.fillStyle='#ff5d7a'; g.fill(); }
  rr(g,-30,-5,60,10,5);
  g.strokeStyle='rgba(255,120,150,0.8)'; g.lineWidth=1.2; g.stroke();
  g.fillStyle='#fff'; g.font='bold 7px '+FONT;
  g.textAlign='center'; g.textBaseline='middle';
  g.fillText('だっしゅつ',0,0.5);
  g.restore();
}
function drawCharmBindGauge(g,h){
  if(!h.charmBind) return;
  const pr=clamp(h.charmSanity/100,0,1);
  g.save();
  g.translate(h.x,h.y-62);
  rr(g,-30,-5,60,10,5);
  g.fillStyle='rgba(40,16,40,0.85)'; g.fill();
  if(pr>0){ rr(g,-30,-5,60*pr,10,5); g.fillStyle='#8fd3ff'; g.fill(); }
  rr(g,-30,-5,60,10,5);
  g.strokeStyle='rgba(255,150,190,0.8)'; g.lineWidth=1.2; g.stroke();
  g.fillStyle='#fff'; g.font='bold 7px '+FONT;
  g.textAlign='center'; g.textBaseline='middle';
  g.fillText('しょうき',0,0.5);
  g.restore();
}
function drawHeatFx(g,x,y,t,heat){
  const n=heat>=70?3:heat>=40?2:1;
  g.save();
  g.strokeStyle='#ff9ec2'; g.lineWidth=1.6; g.lineCap='round';
  for(let i=0;i<n;i++){
    const ph=(t*1.4+i*0.7)%1.6;
    g.globalAlpha=clamp(1-ph/1.6,0,1)*0.5;
    const ox=Math.sin(t*3+i*2.4)*6 + (i-1)*8;
    g.beginPath();
    g.moveTo(x+ox, y-38-ph*16);
    g.quadraticCurveTo(x+ox+3, y-43-ph*16, x+ox, y-47-ph*16);
    g.stroke();
  }
  g.restore();
}

/* ---------------- モンスター ---------------- */
function drawEnemy(g,e){
  g.save();
  g.translate(e.x, e.y + ((e.id==='imp'||e.boss) ? Math.sin(e.t*4)*2.5 : 0));
  if(e.dormant){ drawDormant(g,e); g.restore(); return; }
  g.fillStyle='rgba(8,8,26,0.3)';
  g.beginPath(); g.ellipse(0,e.boss?6:2,e.r*0.9,e.r*0.28,0,0,TAU); g.fill();

  if(e.elite){
    g.strokeStyle='rgba(255,90,110,0.5)'; g.lineWidth=2;
    g.beginPath(); g.ellipse(0,2,e.r*1.25,e.r*0.45,0,0,TAU); g.stroke();
  }

  let ent=null;
  if(gfxHd()){
    if(e.boss) drawEnemyShaded(g,e);
    else { ent=drawEnemyCached(g,e); if(ent && MON_IRIS[e.id]) MON_IRIS[e.id](g,e); if(gfxLv()>=2 && MON_OVER[e.id]) MON_OVER[e.id](g,e); }
  }else drawBody(g,e);

  if(e.hitFlash>0){
    g.globalAlpha=Math.min(1,e.hitFlash*6)*0.75;
    if(ent) g.drawImage(flashOf(ent),-ent.R,-ent.oy,ent.S,ent.S);
    else { g.fillStyle='#ffffff'; g.beginPath(); g.arc(0,-e.r*0.9,e.r*1.05,0,TAU); g.fill(); }
    g.globalAlpha=1;
  }
  if(!e.boss && e.hp<e.maxHp){
    const w2=e.r*1.8;
    g.fillStyle='rgba(10,10,26,0.7)';
    g.fillRect(-w2/2,-e.r*2.1-4,w2,3);
    g.fillStyle='#ff7a9c';
    g.fillRect(-w2/2,-e.r*2.1-4,w2*clamp(e.hp/e.maxHp,0,1),3);
  }
  g.restore();
}
/* 種族ごとの本体描画(drawEnemy から分離。描き込みモードではオフスクリーンで陰影を重ねる) */
function drawBody(g,e){
  if(e.id==='core') drawCore(g,e);
  else if(e.id==='slimeking') drawSlimeking(g,e);
  else if(e.id==='runemage') drawRunemage(g,e);
  else if(e.id==='succuqueen') drawSuccuqueen(g,e);
  else if(e.id==='gobking') drawGobking(g,e);
  else if(e.id==='slug') drawSlug(g,e);
  else if(e.id==='ghost') drawGhost(g,e);
  else if(e.id==='slime') drawSlime(g,e,false);
  else if(e.id==='mistslime') drawSlime(g,e,true);
  else if(e.id==='worm') drawWormG(g,e);
  else if(e.id==='gas') drawGas(g,e);
  else if(e.id==='imp') drawImp(g,e);
  else if(e.id==='flower') drawFlower(g,e);
  else if(e.id==='gtent') drawGtent(g,e);
  else if(e.id==='goblin') drawGoblin(g,e);
  else if(e.id==='leech') drawLeech(g,e);
  else if(e.id==='hand') drawHand(g,e);
  else if(e.id==='serpent') drawSerpent(g,e);
  else if(e.id==='moth') drawMoth(g,e);
  else if(e.id==='pot') drawPot(g,e);
  else if(e.id==='slugqueen') drawQueen(g,e);
  else if(e.id==='dreamtree') drawDreamtree(g,e);
  else if(e.id==='tower') drawTower(g,e);
  else if(e.id==='spore') drawSpore(g,e);
  else if(e.id==='ghosthand') drawGhosthand(g,e);
  else if(e.id==='eye') drawEye(g,e);
  else if(e.id==='succubus') drawSuccubus(g,e);
  else if(e.id==='web') drawWeb(g,e);
  else if(e.id==='gazer') drawGazer(g,e);
  else if(e.id==='beamer') drawBeamer(g,e);
  else if(e.id==='bossgazer') drawBossgazer(g,e);
  else drawBoss(g,e);
}
/* v1.3 描き込み: 本体を一度オフスクリーンに描き、暗い縁取り・左上からの光・右下の陰・ハイライトを重ねる */
const SHADE_CV=document.createElement('canvas'); SHADE_CV.width=512; SHADE_CV.height=512;
const SG=SHADE_CV.getContext('2d');
const SIL_CV=document.createElement('canvas'); SIL_CV.width=512; SIL_CV.height=512;
const SIL=SIL_CV.getContext('2d');
/* v1.4 描き込み(セル調): 本体をオフスクリーンに描き、AO → 種族色の色トレス線 → 本体 → 影の帯2段 → 左上のリム を焼く。
   結果は種族×半径×精鋭×個体差×状態×アニメ位相(16コマ/2秒)でキャッシュし、以後は drawImage 1回。 */
const OUT_CV=document.createElement('canvas'); OUT_CV.width=OUT_CV.height=512; const OUTG=OUT_CV.getContext('2d');
/* 焼き解像度: 端末の実ピクセル/ワールドpx(dpr×viewScale)に合わせて1〜2倍で焼き、等倍に縮めて置く(1倍で焼いて拡大するとぼやける) */
function gfxK(){ return (G.kCap||2)<2?1:clamp(Math.ceil((dpr||1)*(viewScale||1)-0.1),1,2); }   // 鍵に入るので gfxLv には依存させない(段が動くたび全焼き直しになる)。kCap は戦闘中は片道
function resetSpriteCache(){ SPR_CACHE.clear(); THRASH_N=0; }
/* キャッシュ溢れの検知: 焼き予算が使い切られ続け、かつキャッシュが満杯なら「働き集合が入らない」——その戦闘は1倍焼きへ落とす(2倍は容量4倍) */
let THRASH_N=0;
function thrashGuard(){
  if((G.kCap||2)<2){ THRASH_N=0; return; }
  // 満杯で予算を使い切ったフレームは+1、そうでないフレームは-0.25(6割方の飽和が1.5秒続けば落とす)
  let full=false;
  if(BAKE_N>=BAKE_MAX && SPR_CACHE.size>=sprMax()){ const k=gfxK(); let n=0; for(const en of SPR_CACHE.values()) if(en.k===k) n++; full=n>=sprMax()*0.9; }   // 別倍率の古い絵は「満杯」に数えない
  if(full) THRASH_N+=1; else THRASH_N=Math.max(0,THRASH_N-0.25);
  if(THRASH_N>=40){ G.kCap=1; THRASH_N=0; }
}
const OUTLINE_COL={};
(function(){
  const T=[42,26,62];
  for(const id in EN_COLORS){
    const hex=(EN_COLORS[id][1]||EN_COLORS[id][0]); if(!hex||hex[0]!=='#'||hex.length<7) continue;
    const n=parseInt(hex.slice(1,7),16);
    let c=[n>>16&255,n>>8&255,n&255].map((v,i)=>v*0.6+T[i]*0.4);
    const L=0.299*c[0]+0.587*c[1]+0.114*c[2]; if(L>90) c=c.map(v=>v*90/L);
    OUTLINE_COL[id]='rgba('+c.map(Math.round).join(',')+',0.92)';
  }
})();
const OUTLINE_ELITE='rgba(255,196,90,0.95)', OUTLINE_DEF='rgba(34,18,58,0.92)';
const SHADOW_COL='rgba(58,28,110,', RIM_COL='rgba(255,240,255,0.45)';
const TRANSLUCENT=new Set(['ghost','ghosthand','spore','web','mistslime']);
/* shadowBlur の代わり: キャッシュした放射グラデの円盤 */
const GLOW={};
function glow(g,x,y,r,rgb,alpha){
  let c=GLOW[rgb];
  if(!c){ c=document.createElement('canvas'); c.width=c.height=64; const t=c.getContext('2d');
    const gr=t.createRadialGradient(32,32,2,32,32,32); gr.addColorStop(0,'rgba('+rgb+',0.9)'); gr.addColorStop(1,'rgba('+rgb+',0)');
    t.fillStyle=gr; t.fillRect(0,0,64,64); GLOW[rgb]=c; }
  const a=g.globalAlpha; g.globalAlpha=a*alpha; g.drawImage(c,x-r,y-r,r*2,r*2); g.globalAlpha=a;
}
function renderShaded(cg,e,R,S,oy,k){
  k=k||1; const SP=S*k;   // SP: 実ピクセル寸。本体は k 倍で描き、合成は実ピクセルで行う(帯の幅・線の太さはワールドpxで一定)
  SG.setTransform(1,0,0,1,0,0); SG.globalCompositeOperation='source-over'; SG.clearRect(0,0,SP,SP);
  SG.save(); SG.setTransform(k,0,0,k,R*k,oy*k); drawBody(SG,e); SG.restore();
  // AO: 足元へ紫に沈む
  SG.globalCompositeOperation='source-atop';
  const ao=SG.createLinearGradient(0,(oy-e.r*2.2)*k,0,(oy+e.r*0.5)*k); ao.addColorStop(0,SHADOW_COL+'0)'); ao.addColorStop(1,SHADOW_COL+'0.26)');
  SG.fillStyle=ao; SG.fillRect(0,0,SP,SP); SG.globalCompositeOperation='source-over';
  // sil(col,dx,dy): 本体マスクを col で塗る。ずらし付きなら「ずらした本体」を引いて片側の帯だけ残す
  const sil=(col,dx,dy)=>{
    SIL.setTransform(1,0,0,1,0,0); SIL.globalCompositeOperation='source-over'; SIL.clearRect(0,0,SP,SP);
    SIL.drawImage(SHADE_CV,0,0,SP,SP,0,0,SP,SP);
    if(dx||dy){ SIL.globalCompositeOperation='destination-out'; SIL.drawImage(SHADE_CV,0,0,SP,SP,dx*k,dy*k,SP,SP); }
    SIL.globalCompositeOperation='source-in'; SIL.fillStyle=col; SIL.fillRect(0,0,SP,SP); SIL.globalCompositeOperation='source-over';
  };
  sil(e.elite?OUTLINE_ELITE:(OUTLINE_COL[e.id]||OUTLINE_DEF),0,0);          // 色トレス線(1ワールドpx)
  for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) cg.drawImage(SIL_CV,0,0,SP,SP,dx*k,dy*k,SP,SP);
  cg.drawImage(SHADE_CV,0,0,SP,SP,0,0,SP,SP);
  const k1=e.r<12?1.3:1.8, k2=k1*2.2, tr=TRANSLUCENT.has(e.id)?0.5:1;         // 左上からの光: 右下に帯
  sil(SHADOW_COL+(0.22*tr)+')',-k2,-k2*1.3); cg.drawImage(SIL_CV,0,0,SP,SP,0,0,SP,SP);   // 広く淡い
  sil(SHADOW_COL+(0.50*tr)+')',-k1,-k1*1.3); cg.drawImage(SIL_CV,0,0,SP,SP,0,0,SP,SP);   // 狭く硬い(セルの段)
  sil(RIM_COL,1,1.3);                          cg.drawImage(SIL_CV,0,0,SP,SP,0,0,SP,SP);   // 左上のリム
}
/* ボス(≤3体)とアイコンはキャッシュせず毎フレーム同じパスで合成。kOpt: 焼き倍率の指定(アイコン用) */
function drawEnemyShaded(g,e,kOpt){
  const R=Math.ceil(e.r*2.8)+8, S=R*2; if(S>256){ drawBody(g,e); return; }
  const k=Math.max(1,Math.min(kOpt||gfxK(), Math.floor(512/S))), SP=S*k;
  OUTG.setTransform(1,0,0,1,0,0); OUTG.clearRect(0,0,SP,SP); renderShaded(OUTG,e,R,S,R*1.4,k);
  g.drawImage(OUT_CV,0,0,SP,SP,-R,-R*1.4,S,S);
}
const SPR_CACHE=new Map(); const sprMax=()=>gfxK()>1?480:900;   // 2倍焼きは1枚4倍の容量なので上限を下げる(溢れたら thrashGuard が1倍へ)
const q8=a=>((Math.round(a/(TAU/8))%8)+8)%8;
const tq=e=>Math.floor((((e.t+e.joff)%2)+2)%2*8)/8;   // 量子化した本体時刻(オーバーレイを焼いたコマに合わせる)
let BAKE_N=0; const BAKE_MAX=6;                          // 1フレームの焼き上限。draw() 冒頭で0に戻す
let FRAME_N=0;                                           // 描画フレーム番号(LRU の「このフレームで触った」印)
function gfxLv(){ return (META.settings&&META.settings.gfxAuto===false)?2:(G.gfxLv===undefined?2:G.gfxLv); }
const VARI_SPECIES=new Set(['goblin','slug','moth']);   // 個体差で絵が変わる種族だけ鍵に vari を含める(他は3倍の焼き直しになるだけ)
function spriteKey(e){
  const lv=gfxLv();
  let ph=Math.floor((((e.t+e.joff)%2)+2)%2*8); if(lv===0) ph&=~1;
  const vr=(lv===0||!VARI_SPECIES.has(e.id))?0:(e.vari||0);
  let st='';
  switch(e.id){
    case 'worm': st=e.pounceT>0?'p':''; break;
    case 'flower': st=e.state+(e.revealed?'r':''); break;
    case 'gtent': st=(e.whipT>0?'w':'')+e.state; break;
    case 'imp': st=Math.cos(e.orbitA||0)>=0?'R':'L'; break;
    case 'succubus': st=(Math.cos(e.orbitA||0)>=0?'R':'L')+Math.min(3,Math.floor(Math.max(0,1-((e.denyCd===undefined?8:e.denyCd)/1.5))*4)); break;
    case 'hand': st=e.retreatT>0?'b':''; break;
    case 'leech': st=q8(Math.atan2(e.lvy||0,e.lvx||1)); break;
    case 'moth': st=e.swoopT>0?'s':''; break;
    case 'slugqueen': st=(e.pulseCd||9)<1?'p'+Math.min(3,Math.floor((1-Math.max(0,e.pulseCd||0))*4)):''; break;
    case 'gas': st=String(Math.min(3,Math.floor(Math.max(0,1-((e.puffT===undefined?3.2:e.puffT)/3.2))*4))); break;
    case 'tower': st=Math.floor(Math.max(0,1-((e.pulseCd||4)/4))*4); break;
    case 'eye': st='g'+Math.min(2,Math.floor(clamp(1-((e.gazeCd===undefined?3:e.gazeCd)/1.2),0,1)*3)); break;                 // 視線は MON_IRIS が生で描くので鍵に含めない
    case 'gazer': st=(e.gzState||'')+Math.min(3,Math.floor((e.gzState==='aim'?clamp(1-(e.gzT||0)/BAL.GAZE_AIM,0,1):(e.gzState==='flash'?1:0))*4)); break;
    case 'beamer': st=(e.bmState||'')+(e.bmState==='aim'?Math.min(3,Math.floor(clamp(1-e.bmT/BAL.BEAM_AIM,0,1)*4)):0); break;
  }
  return e.id+'|'+Math.round(e.r)+'|'+(e.elite?'E':'')+vr+'|'+st+'|'+ph+'|'+gfxK();
}
let NO_IRIS=false;   // 焼き中は目玉の虹彩・瞳・照射触手の水晶を描かない(視線で鍵が8倍に膨れるので、MON_IRIS が毎フレーム生で重ねる)
function bakeSprite(e,key,R,S){
  const k=gfxK();
  const cv=document.createElement('canvas'); cv.width=S*k; cv.height=S*k; const cg=cv.getContext('2d');
  const t0=e.t, jo=e.joff; e.t=Math.floor((((e.t+e.joff)%2)+2)%2*8)/8+0.0001; e.joff=0;
  NO_IRIS=!!MON_IRIS[e.id];
  try{ renderShaded(cg,e,R,S,R*1.4,k); } finally { NO_IRIS=false; }
  e.t=t0; e.joff=jo;
  const ent={cv,R,oy:R*1.4,S,k,fl:null,hit:FRAME_N};
  const mx=sprMax(); while(SPR_CACHE.size>=mx) SPR_CACHE.delete(SPR_CACHE.keys().next().value);
  SPR_CACHE.set(key,ent); return ent;
}
/* 被弾フラッシュ: 白いシルエット(遅延生成) */
function flashOf(ent){
  if(!ent.fl){ const c=document.createElement('canvas'); c.width=c.height=ent.cv.width; const t=c.getContext('2d');
    t.drawImage(ent.cv,0,0); t.globalCompositeOperation='source-in'; t.fillStyle='#fff'; t.fillRect(0,0,c.width,c.height); ent.fl=c; }
  return ent.fl;
}
function drawEnemyCached(g,e){
  const R=Math.ceil(e.r*2.8)+8, S=R*2; if(S>256){ drawBody(g,e); return null; }
  const key=spriteKey(e); let ent=SPR_CACHE.get(key);
  if(!ent){ if(BAKE_N>=BAKE_MAX){ drawBody(g,e); return null; } BAKE_N++; ent=bakeSprite(e,key,R,S); }   // 予算超過: この1フレームは素で描く
  else if(ent.hit!==FRAME_N){ ent.hit=FRAME_N; SPR_CACHE.delete(key); SPR_CACHE.set(key,ent); }        // LRU: 使った鍵を末尾へ(先頭から追い出す)。FIFOだと2秒周期の位相が戻る前に消えて焼き直しが止まらない
  g.drawImage(ent.cv,-ent.R,-ent.oy,ent.S,ent.S); return ent;
}
/* 事前焼き: startBattle で積んだ G.prebake(種族×位相×個体差)を毎フレーム数体ずつ焼く */
function prebakeStep(){
  if(!G.prebake||!G.prebake.length||!gfxHd()) return;
  while(G.prebake.length && BAKE_N<BAKE_MAX && SPR_CACHE.size<sprMax()*0.85){   // 上限近くまで焼くと実戦の分を追い出すので手前で止める
    const it=G.prebake.pop();
    const fe=fakeEnemy(it.id); fe.t=it.t; fe.vari=it.vari; fe.x=0; fe.y=0;
    const R=Math.ceil(fe.r*2.8)+8, S=R*2; if(S>256) continue;
    const key=spriteKey(fe); if(SPR_CACHE.has(key)) continue;
    BAKE_N++; bakeSprite(fe,key,R,S);
  }
}
/* fps ガード: 2秒間40fps未満で装飾を1段省く(2: 全部 / 1: オーバーレイ無し / 0: 位相8コマ・個体差無し)。8秒間55fps超で戻す */
function fpsGuard(){
  if(META.settings&&META.settings.gfxAuto===false){ G.gfxLv=2; return; }
  const fdt=1/Math.max(20,G.fps||60);
  if(G.fps<40){ G.hiT=0; G.lowT=(G.lowT||0)+fdt; if(G.lowT>2 && gfxLv()>0){ G.gfxLv=gfxLv()-1; G.lowT=0; if(G.gfxLv===0) G.kCap=1; } }   // 最下段まで落ちたら焼き倍率も1倍へ(片道)
  else if(G.fps>55){ G.lowT=0; G.hiT=(G.hiT||0)+fdt; if(G.hiT>8 && gfxLv()<2){ G.gfxLv=gfxLv()+1; G.hiT=0; } }
}
/* 焼き絵の上に必ず重ねる部分: 目玉系の虹彩・瞳(視線が滑らかに追う)と照射触手の水晶。焼きの鍵から視線を外せる */
const MON_IRIS={
  gazer(g,e){ const gl=e.gzState==='aim'?clamp(1-(e.gzT||0)/BAL.GAZE_AIM,0,1):(e.gzState==='flash'?1:0); g.save(); g.translate(0,-e.r); drawIris(g,e.r*0.95,e.lookA||0,gl); g.restore(); },
  eye(g,e){ const gl=clamp(1-((e.gazeCd===undefined?3:e.gazeCd)/1.2),0,1); const oy=-e.r*1.2+Math.sin(tq(e)*3)*2; g.save(); g.translate(0,oy); drawIris(g,e.r*0.9,eyeLookA(e,oy),gl,gl>0.3?'#b46cff':'#7a3ff2'); g.restore(); },
  beamer(g,e){ drawBeamerCrystal(g,e,Math.sin(tq(e)*1.1)*2,-e.r*1.4); },
};
/* 焼いた絵の上に重ねる生きた部分(≤3回の塗り)。ゴーストの瞳は彼女を追い、小淫魔は近づくと頰を染め、目玉は瞬く */
const MON_OVER={
  ghost(g,e){
    const p=G.B&&G.B.hero; if(!p) return;
    const r=e.r, dx=p.x-e.x, dy=p.y-e.y, d=Math.hypot(dx,dy)||1;
    const lx=dx/d*r*0.06, ly=dy/d*r*0.08;
    g.fillStyle='#9fdcff';
    g.beginPath(); g.arc(-r*0.32+lx,-r*1.05+ly,r*0.06,0,TAU); g.fill();
    g.beginPath(); g.arc(r*0.32+lx,-r*1.05+ly,r*0.06,0,TAU); g.fill();
  },
  imp(g,e){ impBlush(g,e); }, succubus(g,e){ impBlush(g,e); },
  eye(g,e){ blink(g,e,0,-e.r*1.2+Math.sin(tq(e)*3)*2,e.r*0.95); },
  gazer(g,e){ blink(g,e,0,-e.r,e.r*0.95); },
};
function impBlush(g,e){
  const p=G.B&&G.B.hero; if(!p) return;
  const r=e.r*1.15, d=Math.hypot(p.x-e.x,p.y-e.y), near=clamp(1-(d-40)/90,0,1);
  const t=tq(e), fl=Math.sin(t*11), dir=Math.cos(e.orbitA||0)>=0?1:-1;
  g.save(); g.translate(0,fl*1.6-r*0.5); g.scale(dir,1);
  g.globalAlpha=0.35+0.45*near; g.fillStyle='rgba(255,120,160,0.6)';
  g.beginPath(); g.ellipse(-r*0.3,-r*1.18,r*0.09,r*0.06,0,0,TAU); g.fill();
  g.beginPath(); g.ellipse(r*0.3,-r*1.18,r*0.09,r*0.06,0,0,TAU); g.fill();
  if(near>0.6){ g.globalAlpha=0.8; g.fillStyle='#ff86b3'; heartPath(g,r*0.5,-r*1.9-((e.t*1.5)%1)*6,0.7); g.fill(); }
  g.restore();
}
function blink(g,e,cx,cy,R){
  const ph=(e.t+e.joff)%3.7; if(ph>=0.12) return;
  const k=Math.sin(ph/0.12*Math.PI);
  g.fillStyle='#5a3a7a'; g.beginPath(); g.ellipse(cx,cy,R*1.02,R*1.02*k,0,0,TAU); g.fill();
}
/* アイコン・事前焼き用の「その種族らしい」ダミー個体 */
function fakeEnemy(id){
  return { id, r:MONSTERS[id].r, t:1.2, joff:0, x:0, y:0, vari:0, elite:false, state:MONSTERS[id].boss?'chase':(id==='flower'?'bud':'chase'),
    whipT:0, pounceT:0, puffT:2, orbitA:0, boss:MONSTERS[id].boss, bstate:'chase', spd:0,
    hp:1, maxHp:1, hitFlash:0, dormant:false,
    pulseCd:5, grabCd:0, swoopT:0, dustT:1, gropeCd:0, retreatT:0, spawnCd:5, rootCd:5, eatN:0, lvx:null, lvy:null,
    gzState:'idle', gzAng:-Math.PI/2, bmState:'idle', bmAng:-Math.PI/2, lookA:-Math.PI/2, gazeCd:3, denyCd:8, bmT:1, gzT:1,
    eyes:[0,1,2].map(i=>({base:(-Math.PI/2)+(i-1)*1.05, dx:Math.cos((-Math.PI/2)+(i-1)*1.05)*MONSTERS[id].r*1.9, dy:Math.sin((-Math.PI/2)+(i-1)*1.05)*MONSTERS[id].r*0.8-MONSTERS[id].r*1.7, ang:-Math.PI/2, state:'idle', t:1})) };
}
function drawDormant(g,e){
  g.fillStyle='rgba(60,50,90,0.8)';
  g.beginPath(); g.ellipse(0,0,e.r*0.9,e.r*0.4,0,0,TAU); g.fill();
  const bl=(e.t%2)<1.3;
  if(bl){
    g.fillStyle='#c98cff';
    g.beginPath(); g.arc(-3,-2,1.4,0,TAU); g.fill();
    g.beginPath(); g.arc(3,-2,1.4,0,TAU); g.fill();
  }
}
function drawSlug(g,e){
  const r=e.r, ph=Math.sin(e.t*3.2);
  const stretch=1+ph*0.12;
  // 体(ぬめり。個体で色味が違う)
  const v=e.vari||0;
  g.fillStyle=['#a8cc5e','#b4d060','#9cc86a'][v];
  g.beginPath();
  g.ellipse(0,-r*0.4,r*0.95*stretch,r*0.5/stretch,0,0,TAU);
  g.fill();
  g.fillStyle='#c2e07a';
  g.beginPath();
  g.ellipse(-r*0.15,-r*0.55,r*0.6*stretch,r*0.3,0,0,TAU);
  g.fill();
  // 頭
  g.fillStyle='#b8d86a';
  g.beginPath(); g.arc(r*0.62*stretch,-r*0.5,r*0.36,0,TAU); g.fill();
  // 触角(目)
  g.strokeStyle='#8fae4a'; g.lineWidth=1.6; g.lineCap='round';
  for(const sd of [-1,1]){
    const wx=r*0.62*stretch+sd*2.2, tip=Math.sin(e.t*4+sd)*1.2;
    g.beginPath(); g.moveTo(wx,-r*0.72);
    g.quadraticCurveTo(wx+sd*1.5,-r*1.1, wx+sd*2+tip,-r*1.25);
    g.stroke();
    g.fillStyle='#3a4a1f';
    g.beginPath(); g.arc(wx+sd*2+tip,-r*1.28,1.4,0.15*Math.PI,0.85*Math.PI); g.fill();   // 半眼
  }
  // 背の斑点(模様。個体で並びが違う)
  g.fillStyle='rgba(90,120,40,0.5)';
  for(let i=0;i<4;i++){ const px=-r*0.6+i*r*0.32+(v*0.07*r), py=-r*0.55-Math.sin(i*1.7+v)*r*0.1; g.beginPath(); g.ellipse(px,py,r*0.1,r*0.07,0.3,0,TAU); g.fill(); }
  // 足の濡れた帯、背を流れる光沢、涎
  g.fillStyle='rgba(70,90,30,0.45)';
  g.beginPath(); g.ellipse(0,-r*0.05,r*0.9,r*0.12,0,0,TAU); g.fill();
  g.fillStyle='rgba(255,255,255,0.55)';
  for(let i=0;i<3;i++){ const x=-r*0.5+((e.t*0.5+i*0.33)%1)*r*1.1; g.beginPath(); g.arc(x,-r*0.78,1.2,0,TAU); g.fill(); }
  const dr=(e.t%2)/2;
  g.fillStyle='rgba(200,240,255,0.7)';
  g.beginPath(); g.ellipse(r*0.75,-r*0.3+dr*r*0.5,0.9,1.4+dr*1.2,0,0,TAU); g.fill();
  // ハート模様(魅了持ちの記号)
  g.fillStyle='rgba(255,130,175,0.75)';
  heartPath(g,-r*0.3,-r*0.5,0.9); g.fill();
  g.strokeStyle='#c94a7c'; g.lineWidth=0.8; heartPath(g,-r*0.3,-r*0.5,0.9); g.stroke();
  // ぬめりの光沢
  g.fillStyle='rgba(255,255,255,0.4)';
  g.beginPath(); g.ellipse(-r*0.4,-r*0.72,r*0.24,r*0.1,-0.4,0,TAU); g.fill();
}
function drawWormG(g,e){
  // 地上ワーム: 這って進む節虫
  const r=e.r;
  const lunge=e.pounceT>0;
  g.save();
  const squish=lunge?1.25:1+Math.sin(e.t*6)*0.1;
  for(let i=3;i>=0;i--){
    const sx=-i*r*0.5*squish+Math.sin(e.t*7-i*1.1)*1.6;
    const sy=-r*0.42-Math.abs(Math.sin(e.t*7-i*1.1))*1.6;
    g.fillStyle=i%2?'#c9a06a':'#b8905a';
    g.beginPath(); g.arc(sx,sy,r*(0.46+i*0.07),0,TAU); g.fill();
    // 節の環(模様)
    g.strokeStyle='rgba(110,75,40,0.55)'; g.lineWidth=1;
    g.beginPath(); g.arc(sx,sy,r*(0.46+i*0.07)*0.82,Math.PI*0.25,Math.PI*1.75,false); g.stroke();
  }
  const hx=Math.sin(e.t*7)*1.6+r*0.3;
  g.fillStyle='#7a5a3a';
  g.beginPath(); g.arc(hx,-r*0.5,r*0.42,0,TAU); g.fill();
  const open=lunge?0.85:Math.abs(Math.sin(e.t*5))*0.4+0.2;
  g.fillStyle='#e8d8c8';
  g.beginPath(); g.ellipse(hx+r*0.15,-r*0.5,r*0.26,r*0.26*open,0,0,TAU); g.fill();
  g.fillStyle='#5a3a2a';
  g.beginPath(); g.ellipse(hx+r*0.15,-r*0.5,r*0.14,r*0.14*open,0,0,TAU); g.fill();
  g.restore();
}
function drawGoblin(g,e){
  // 緑色のチビ。よちよちと群れる
  const r=e.r, wob=Math.sin(e.t*9)*0.1;
  g.save();
  g.rotate(wob);
  // 脚(ちょこちょこ)
  g.strokeStyle='#4a7a3a'; g.lineWidth=2.4; g.lineCap='round';
  for(const sd of [-1,1]){
    const st=Math.sin(e.t*11+sd)*2.4;
    g.beginPath(); g.moveTo(sd*2.6,-r*0.3); g.lineTo(sd*3.4+st,1.4); g.stroke();
  }
  // 胴(ぼろ布。個体で色が違う)
  const v=e.vari||0;
  g.fillStyle=['#6a5340','#4a3a5e'][v&1];
  g.beginPath();
  g.moveTo(-r*0.55,-r*0.2);
  g.lineTo(r*0.55,-r*0.2);
  g.lineTo(r*0.4,-r*0.95);
  g.lineTo(-r*0.4,-r*0.95);
  g.closePath(); g.fill();
  // 布の格子(模様)
  g.save(); g.clip();
  g.strokeStyle='rgba(30,20,20,0.35)'; g.lineWidth=0.8;
  for(let k=-2;k<=2;k++){ g.beginPath(); g.moveTo(-r*0.6,-r*0.95+k*r*0.2+r*0.4); g.lineTo(r*0.6,-r*0.95+k*r*0.2+r*0.4); g.stroke(); g.beginPath(); g.moveTo(k*r*0.22,-r); g.lineTo(k*r*0.22,-r*0.1); g.stroke(); }
  g.restore();
  // 腕(こん棒を振り回す)
  g.strokeStyle='#7ab84a'; g.lineWidth=2.6;
  const sw=Math.sin(e.t*7)*0.5;
  g.beginPath(); g.moveTo(-r*0.5,-r*0.7); g.lineTo(-r*0.95,-r*0.5+sw*2); g.stroke();
  g.beginPath(); g.moveTo(r*0.5,-r*0.7); g.lineTo(r*0.9,-r*0.95+sw*3); g.stroke();
  g.strokeStyle='#8a6a4a'; g.lineWidth=3;
  g.beginPath(); g.moveTo(r*0.9,-r*0.95+sw*3); g.lineTo(r*1.15,-r*1.4+sw*3); g.stroke();
  // 頭(でかい・尖り耳)。下半分に丸みの陰
  g.fillStyle='#8fd36a';
  g.beginPath(); g.arc(0,-r*1.25,r*0.62,0,TAU); g.fill();
  g.fillStyle='rgba(60,110,50,0.45)';
  g.beginPath(); g.arc(0,-r*1.25,r*0.62,0.15*Math.PI,0.85*Math.PI); g.fill();
  g.fillStyle='#7ab84a';
  for(const sd of [-1,1]){
    g.beginPath();
    g.moveTo(sd*r*0.5,-r*1.35);
    g.lineTo(sd*r*1.05,-r*1.5+Math.sin(e.t*5+sd)*1);
    g.lineTo(sd*r*0.5,-r*1.15);
    g.closePath(); g.fill();
  }
  // 顔(個体差: 0=ニタァ+牙 / 1=舌 / 2=睨み)
  g.fillStyle='#e8e070';
  g.beginPath(); g.ellipse(-r*0.22,-r*1.32,2.2,1.6,0,0,TAU); g.fill();
  g.beginPath(); g.ellipse(r*0.22,-r*1.32,2.2,1.6,0,0,TAU); g.fill();
  g.fillStyle='#2a3a1f';
  g.beginPath(); g.arc(-r*0.22,-r*1.32,1.3,0,TAU); g.fill();
  g.beginPath(); g.arc(r*0.22,-r*1.32,1.3,0,TAU); g.fill();
  g.strokeStyle='#2a3a1f'; g.lineWidth=1.2; g.lineCap='round';
  if(v===2){
    g.beginPath(); g.moveTo(-r*0.34,-r*1.5); g.lineTo(-r*0.1,-r*1.42); g.stroke();
    g.beginPath(); g.moveTo(r*0.34,-r*1.5); g.lineTo(r*0.1,-r*1.42); g.stroke();
    g.beginPath(); g.moveTo(-r*0.22,-r*1.1); g.lineTo(r*0.22,-r*1.1); g.stroke();
  }else{
    g.beginPath(); g.arc(0,-r*1.18,r*0.3,0.15*Math.PI,0.85*Math.PI); g.stroke();
    if(v===0){ g.fillStyle='#fff'; g.beginPath(); g.moveTo(r*0.06,-r*1.1); g.lineTo(r*0.16,-r*1.1); g.lineTo(r*0.11,-r*0.98); g.closePath(); g.fill(); }
    else{ g.fillStyle='#ff7a9c'; g.beginPath(); g.ellipse(r*0.08,-r*1.02,1.4,2.2,0,0,TAU); g.fill(); }
  }
  g.restore();
}
function drawLeech(g,e){
  // 吸液羽虫: 肉質の小さな羽虫
  const r=e.r;
  const ang=(e.lvx!==undefined&&e.lvx!==null)?Math.atan2(e.lvy||0,e.lvx||1):0;
  g.save();
  g.translate(0,-r*0.8);
  // 羽(高速ではためく半透明)
  const wf=Math.sin(e.t*40)*0.7;
  g.fillStyle='rgba(255,225,235,0.5)';
  for(const sd of [-1,1]){
    g.save();
    g.rotate(sd*(0.5+wf*0.45));
    g.beginPath(); g.ellipse(0,-r*0.75,r*0.42,r*0.95,0,0,TAU); g.fill();
    g.restore();
  }
  // 体(肉っぽい楕円・節)
  g.rotate(ang*0.25);
  const grad=g.createRadialGradient(-r*0.2,-r*0.25,r*0.15,0,0,r*1.05);
  grad.addColorStop(0,'#ffc7b5');
  grad.addColorStop(1,'#d87a6a');
  g.fillStyle=grad;
  g.beginPath(); g.ellipse(0,0,r*1.0,r*0.72,0,0,TAU); g.fill();
  g.strokeStyle='rgba(170,80,70,0.5)'; g.lineWidth=1;
  for(let i=-1;i<=1;i++){
    g.beginPath(); g.arc(i*r*0.34,0,r*0.6,Math.PI*0.25,Math.PI*0.75); g.stroke();
  }
  // 吸い口(先端の丸い口・すぼまり)
  g.fillStyle='#b85a52';
  g.beginPath(); g.arc(r*0.85,0,r*0.34,0,TAU); g.fill();
  g.fillStyle='#ffd8cc';
  g.beginPath(); g.arc(r*0.88,0,r*0.16*(1+Math.sin(e.t*10)*0.4),0,TAU); g.fill();
  // 点目
  g.fillStyle='#5a2a2a';
  g.beginPath(); g.arc(r*0.45,-r*0.3,1.2,0,TAU); g.fill();
  g.restore();
}
function drawGas(g,e){
  const r=e.r, pf=Math.max(0,1-(e.puffT/3.2));
  const puls=1+Math.sin(e.t*2.6)*0.08+(pf>0.85?(pf-0.85)*1.2:0);
  // 本体(まんまるの胞子袋)
  const grad=g.createRadialGradient(-r*0.25,-r*0.9,r*0.2,0,-r*0.7,r*0.95*puls);
  grad.addColorStop(0,'#ffc2d8');
  grad.addColorStop(1,'#d86aa0');
  g.fillStyle=grad;
  g.beginPath(); g.arc(0,-r*0.7,r*0.85*puls,0,TAU); g.fill();
  // 噴出口
  g.fillStyle='#a84a7c';
  for(let i=0;i<3;i++){
    const a=-Math.PI/2+(i-1)*0.75;
    g.beginPath();
    g.arc(Math.cos(a)*r*0.72,-r*0.7+Math.sin(a)*r*0.72,r*0.14,0,TAU);
    g.fill();
  }
  // 目(ねむそう)
  g.strokeStyle='#5a1f3a'; g.lineWidth=1.3; g.lineCap='round';
  g.beginPath(); g.arc(-r*0.26,-r*0.74,r*0.13,Math.PI*0.1,Math.PI*0.9); g.stroke();
  g.beginPath(); g.arc(r*0.26,-r*0.74,r*0.13,Math.PI*0.1,Math.PI*0.9); g.stroke();
  // 漏れ出る霧
  g.fillStyle='rgba(255,158,194,0.35)';
  for(let i=0;i<2;i++){
    const ph=(e.t*0.8+i*0.9)%1.4;
    g.beginPath();
    g.arc(Math.sin(e.t+i*2)*r*0.4, -r*1.5-ph*10, 3+ph*4, 0, TAU);
    g.fill();
  }
}
function drawImp(g,e,pal){
  pal=Object.assign({wing:'#b8548a',tail:'#d86aa0',heart:'#ff86b3',skin:'#ffd9c9',dress:'#e05a92',head:'#ffe3d5',hair:'#d86ab8',horn:'#fff',face:'#5a1f3a',blush:'rgba(255,120,160,0.5)'},pal||{});
  // 小淫魔: 女の子っぽい小悪魔。パタパタと飛んで煽る
  const r=e.r*1.15, fl=Math.sin(e.t*11);
  g.save();
  g.translate(0,fl*1.6-r*0.5);
  const dir=Math.cos(e.orbitA||0)>=0?1:-1;
  g.scale(dir,1);
  // 羽(パタパタ)
  g.fillStyle=pal.wing;
  for(const sd of [-1,1]){
    const flap=fl*0.5*sd;
    g.beginPath();
    g.moveTo(sd*r*0.3,-r*1.05);
    g.quadraticCurveTo(sd*r*1.35,-r*1.5-flap*6, sd*r*1.3,-r*0.6-flap*7);
    g.quadraticCurveTo(sd*r*0.8,-r*0.7, sd*r*0.3,-r*0.7);
    g.closePath(); g.fill();
  }
  // しっぽ(ハート鏃)
  g.strokeStyle=pal.tail; g.lineWidth=1.6; g.lineCap='round';
  g.beginPath();
  g.moveTo(-r*0.2,-r*0.35);
  g.quadraticCurveTo(-r*0.9,-r*0.1, -r*1.1+Math.sin(e.t*5)*2, -r*0.7);
  g.stroke();
  g.fillStyle=pal.heart;
  heartPath(g,-r*1.1+Math.sin(e.t*5)*2,-r*0.82,0.75); g.fill();
  // 素足(ぶらぶら)
  g.strokeStyle=pal.skin; g.lineWidth=1.8;
  g.beginPath(); g.moveTo(-r*0.15,-r*0.4); g.lineTo(-r*0.2,-r*0.05+fl*0.6); g.stroke();
  g.beginPath(); g.moveTo(r*0.15,-r*0.4); g.lineTo(r*0.22,-r*0.02-fl*0.6); g.stroke();
  // ちいさなドレス身体
  g.fillStyle=pal.dress;
  g.beginPath();
  g.moveTo(-r*0.32,-r*0.95);
  g.quadraticCurveTo(-r*0.55,-r*0.45,-r*0.4,-r*0.35);
  g.lineTo(r*0.4,-r*0.35);
  g.quadraticCurveTo(r*0.55,-r*0.45,r*0.32,-r*0.95);
  g.closePath(); g.fill();
  if(pal.pattern){ g.fillStyle=pal.pattern; for(let i=0;i<4;i++){ g.beginPath(); g.arc(-r*0.24+i*r*0.16,-r*0.6+(i%2)*r*0.12,0.9,0,TAU); g.fill(); } }   // 衣の模様
  // 腕(ちょいちょいと手招き)
  g.strokeStyle=pal.skin; g.lineWidth=1.6;
  const beck=Math.sin(e.t*6)*1.4;
  g.beginPath(); g.moveTo(-r*0.3,-r*0.8); g.lineTo(-r*0.55,-r*0.65); g.stroke();
  g.beginPath(); g.moveTo(r*0.3,-r*0.8); g.lineTo(r*0.6,-r*0.85+beck); g.stroke();
  // 頭
  g.fillStyle=pal.head;
  g.beginPath(); g.arc(0,-r*1.28,r*0.46,0,TAU); g.fill();
  // 髪(ツインテの小悪魔)
  g.fillStyle=pal.hair;
  g.beginPath(); g.arc(0,-r*1.38,r*0.48,Math.PI*0.95,Math.PI*2.05); g.fill();
  for(const sd of [-1,1]){
    g.beginPath();
    g.moveTo(sd*r*0.42,-r*1.45);
    g.quadraticCurveTo(sd*r*0.85,-r*1.2+fl*1.2, sd*r*0.7,-r*0.75);
    g.quadraticCurveTo(sd*r*0.5,-r*1.05, sd*r*0.34,-r*1.25);
    g.closePath(); g.fill();
  }
  // つの
  g.fillStyle=pal.horn;
  g.beginPath(); g.moveTo(-r*0.24,-r*1.62); g.lineTo(-r*0.36,-r*1.85); g.lineTo(-r*0.1,-r*1.68); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(r*0.24,-r*1.62); g.lineTo(r*0.36,-r*1.85); g.lineTo(r*0.1,-r*1.68); g.closePath(); g.fill();
  // 顔(にやにや)
  g.fillStyle=pal.face;
  g.beginPath(); g.ellipse(-r*0.16,-r*1.3,r*0.07,r*0.11,0,0,TAU); g.fill();
  g.beginPath(); g.ellipse(r*0.16,-r*1.3,r*0.07,r*0.11,0,0,TAU); g.fill();
  g.strokeStyle=pal.face; g.lineWidth=1.1; g.lineCap='round';
  g.beginPath(); g.arc(0,-r*1.18,r*0.14,Math.PI*0.15,Math.PI*0.85); g.stroke();
  g.fillStyle=pal.blush;
  g.beginPath(); g.ellipse(-r*0.3,-r*1.18,r*0.09,r*0.06,0,0,TAU); g.fill();
  g.beginPath(); g.ellipse(r*0.3,-r*1.18,r*0.09,r*0.06,0,0,TAU); g.fill();
  g.restore();
}
function drawGhost(g,e){
  const r=e.r, ph=e.t*6;
  g.globalAlpha=0.92;
  const gb=g.createLinearGradient(0,-2*r,0,0); gb.addColorStop(0,'#f6f7ff'); gb.addColorStop(1,'rgba(170,180,235,0.55)');   // 裾が溶ける
  g.fillStyle=gb;
  g.strokeStyle='rgba(140,150,210,0.8)'; g.lineWidth=1.2;
  g.beginPath();
  g.arc(0,-r,r*0.95,Math.PI,0);
  g.lineTo(r*0.95,-r*0.15);
  for(let i=0;i<3;i++){
    const x1=r*0.95-(i*2+1)*r*0.317, dip=Math.sin(ph+i)*2;
    g.quadraticCurveTo(x1+r*0.16,-r*0.15+5+dip,x1,-r*0.15);
  }
  g.closePath(); g.fill(); g.stroke();
  const core=g.createRadialGradient(0,-r*0.9,0,0,-r*0.9,r*0.35); core.addColorStop(0,'rgba(200,210,255,0.35)'); core.addColorStop(1,'rgba(200,210,255,0)');
  g.fillStyle=core; g.beginPath(); g.arc(0,-r*0.9,r*0.35,0,TAU); g.fill();   // 魂の芯
  g.strokeStyle='rgba(150,160,220,0.35)'; g.lineWidth=0.8;   // 布の流れ(模様)
  for(let i=0;i<3;i++){ g.beginPath(); g.moveTo(-r*0.5+i*r*0.45,-r*0.55); g.quadraticCurveTo(-r*0.35+i*r*0.45+Math.sin(ph+i)*2,-r*0.3,-r*0.5+i*r*0.45,-r*0.1); g.stroke(); }
  g.fillStyle='#2f3358';
  g.beginPath(); g.ellipse(-r*0.32,-r*1.05,r*0.13,r*0.22,0,0,TAU); g.fill();
  g.beginPath(); g.ellipse(r*0.32,-r*1.05,r*0.13,r*0.22,0,0,TAU); g.fill();
  g.beginPath(); g.ellipse(0,-r*0.62,r*0.14,r*0.19,0,0,TAU); g.fill();
  g.globalAlpha=1;
}
function drawSlime(g,e,mist){
  const r=e.r;
  const wob=1+Math.sin(e.t*6)*0.09;
  g.fillStyle=mist?'rgba(240,150,190,0.9)':'rgba(90,210,170,0.9)';
  g.beginPath(); g.ellipse(0,-r*0.55,r*wob,r*0.8/wob,0,0,TAU); g.fill();
  g.fillStyle=mist?'rgba(255,200,225,0.6)':'rgba(150,240,210,0.55)';
  g.beginPath(); g.ellipse(-r*0.3,-r*0.85,r*0.34,r*0.22,-0.5,0,TAU); g.fill();
  // 中の気泡(模様)
  g.fillStyle=mist?'rgba(255,230,240,0.45)':'rgba(200,255,235,0.4)';
  for(let i=0;i<3;i++){ const bx=(i-1)*r*0.32, by=-r*0.45-((e.t*0.4+i*0.33)%1)*r*0.5; g.beginPath(); g.arc(bx,by,r*0.07+i*0.5,0,TAU); g.fill(); }
  g.fillStyle=mist?'#5a2440':'#1f4a3c';
  g.beginPath(); g.arc(-r*0.28,-r*0.6,r*0.11,0,TAU); g.fill();
  g.beginPath(); g.arc(r*0.28,-r*0.6,r*0.11,0,TAU); g.fill();
  g.strokeStyle=mist?'#5a2440':'#1f4a3c'; g.lineWidth=1.2;
  g.beginPath(); g.arc(0,-r*0.42,r*0.16,Math.PI*0.1,Math.PI*0.9); g.stroke();
  if(mist){
    g.fillStyle='rgba(255,158,194,0.4)';
    for(let i=0;i<2;i++){
      const ph=(e.t*0.9+i*0.7)%1.2;
      g.beginPath(); g.arc(Math.sin(e.t*1.4+i*2)*r*0.5,-r*1.3-ph*8,2.5+ph*3,0,TAU); g.fill();
    }
  }
}
function drawFlower(g,e){
  const r=e.r;
  if(e.state==='bud'){
    g.strokeStyle='#3fae86'; g.lineWidth=2.4; g.lineCap='round';
    g.beginPath(); g.moveTo(0,0); g.quadraticCurveTo(2,-r*0.7,0,-r*1.2); g.stroke();
    g.fillStyle='#e86a9c';
    g.beginPath();
    g.ellipse(0,-r*1.35,r*0.5,r*0.72,Math.sin(e.t*1.4)*0.08,0,TAU);
    g.fill();
    g.strokeStyle='#c94a7c'; g.lineWidth=1.2;
    g.beginPath(); g.moveTo(0,-r*1.9); g.quadraticCurveTo(1,-r*1.4,0,-r*0.9); g.stroke();
    g.fillStyle='#4fc496';
    for(const sd of [-1,1]){
      g.beginPath(); g.ellipse(sd*r*0.45,-r*0.4,r*0.4,r*0.16,sd*0.5,0,TAU); g.fill();
    }
    return;
  }
  // hold / open
  const holding=e.state==='hold';
  const pu=1+Math.sin(e.t*(holding?3.4:2.2))*0.05;
  g.fillStyle='#c94a7c';
  for(let i=0;i<6;i++){
    const a=i*TAU/6+Math.sin(e.t*0.8)*0.1;
    g.beginPath();
    g.ellipse(Math.cos(a)*r*0.75*pu,-r*0.5+Math.sin(a)*r*0.55*pu,r*0.62,r*0.3,a,0,TAU);
    g.fill();
  }
  g.fillStyle='#e86a9c';
  g.beginPath(); g.ellipse(0,-r*0.5,r*0.72*pu,r*0.5*pu,0,0,TAU); g.fill();
  g.fillStyle='#8a2450';
  g.beginPath(); g.ellipse(0,-r*0.5,r*0.4*pu,r*0.28*pu,0,0,TAU); g.fill();
  g.strokeStyle='#4fc496'; g.lineWidth=2; g.lineCap='round';
  for(let i=0;i<4;i++){
    const a=i*TAU/4+0.6, ph=e.t*3+i;
    g.beginPath();
    g.moveTo(Math.cos(a)*r*0.5,-r*0.4);
    g.quadraticCurveTo(Math.cos(a)*r*1.3, -r*0.9+Math.sin(ph)*5, Math.cos(a)*r*1.6, -r*0.3+Math.cos(ph)*4);
    g.stroke();
  }
}
function drawGtent(g,e){
  const r=e.r;
  g.fillStyle='#5a3a7a';
  g.beginPath(); g.ellipse(0,-r*0.3,r*0.85,r*0.55,0,0,TAU); g.fill();
  g.strokeStyle='#a06ac9'; g.lineWidth=3.4; g.lineCap='round';
  const wh=e.whipT>0?2.4:1;
  for(let i=0;i<5;i++){
    const a=(i-2)*0.5, ph=e.t*2.6+i*1.3;
    g.beginPath();
    g.moveTo(a*r*0.5,-r*0.5);
    g.quadraticCurveTo(a*r*1.2+Math.sin(ph)*6*wh, -r*1.5-Math.cos(ph)*4*wh,
                       a*r*1.6+Math.sin(ph+1)*8*wh, -r*1.9+Math.sin(ph)*6*wh);
    g.stroke();
  }
  g.fillStyle='#c98cff';
  for(let i=0;i<3;i++){
    const a2=e.t*1.4+i*2.1;
    g.beginPath(); g.arc(Math.cos(a2)*r*0.4,-r*0.35+Math.sin(a2)*r*0.2,r*0.1,0,TAU); g.fill();
  }
}
function drawBat(g,e,sc,bodyC,wingC){
  const r=e.r*sc, flap=Math.sin(e.t*13)*0.85;
  g.fillStyle=wingC;
  for(const sd of [-1,1]){
    g.beginPath();
    g.moveTo(sd*r*0.4,-r);
    g.quadraticCurveTo(sd*r*1.7,-r-flap*8, sd*(r*1.9),-r*0.5-flap*10);
    g.quadraticCurveTo(sd*r*1.35,-r*0.55, sd*r*1.1,-r*0.5);
    g.quadraticCurveTo(sd*r*0.8,-r*0.35, sd*r*0.4,-r*0.45);
    g.closePath(); g.fill();
  }
  g.fillStyle=bodyC;
  g.beginPath(); g.ellipse(0,-r*0.75,r*0.75,r*0.85,0,0,TAU); g.fill();
  g.fillStyle=wingC;
  g.beginPath(); g.moveTo(-r*0.45,-r*1.4); g.lineTo(-r*0.2,-r*1.05); g.lineTo(-r*0.65,-r*1.0); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(r*0.45,-r*1.4); g.lineTo(r*0.2,-r*1.05); g.lineTo(r*0.65,-r*1.0); g.closePath(); g.fill();
  g.fillStyle='#ff5d6e';
  g.beginPath(); g.arc(-r*0.28,-r*0.85,r*0.14,0,TAU); g.fill();
  g.beginPath(); g.arc(r*0.28,-r*0.85,r*0.14,0,TAU); g.fill();
  g.fillStyle='#ffffff';
  g.beginPath(); g.moveTo(-r*0.2,-r*0.5); g.lineTo(-r*0.1,-r*0.28); g.lineTo(0,-r*0.5); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(r*0.2,-r*0.5); g.lineTo(r*0.1,-r*0.28); g.lineTo(0,-r*0.5); g.closePath(); g.fill();
}
/* ---- v1.0 追加種 ---- */
function drawHand(g,e){
  // 這い寄る手: 手首から先だけの青白い手。指を動かして地面を這う
  const r=e.r, ph=e.t*9+e.joff;
  g.save();
  g.rotate(Math.sin(e.t*1.3+e.joff)*0.3);
  // 手首の断面(暗い)
  g.fillStyle='#8a7fb0';
  g.beginPath(); g.ellipse(-r*0.7,-r*0.3,r*0.32,r*0.42,0,0,TAU); g.fill();
  // 掌
  g.fillStyle='#d8d0f0';
  g.beginPath(); g.ellipse(0,-r*0.35,r*0.72,r*0.5,0,0,TAU); g.fill();
  // 指(5本・順にうねる)
  g.strokeStyle='#cfc4ea'; g.lineWidth=r*0.24; g.lineCap='round';
  for(let i=0;i<4;i++){
    const a=-0.55+i*0.37, len=r*(0.85-Math.abs(i-1.5)*0.1);
    const wig=Math.sin(ph+i*1.2)*r*0.18;
    const bx=r*0.55*Math.cos(a), by=-r*0.35+r*0.4*Math.sin(a);
    g.beginPath(); g.moveTo(bx,by);
    g.quadraticCurveTo(bx+len*0.55,by+wig*0.5, bx+len,by+wig);
    g.stroke();
  }
  // 親指
  const th=Math.sin(ph+5)*r*0.14;
  g.beginPath(); g.moveTo(-r*0.1,-r*0.05); g.lineTo(r*0.25+th,r*0.32+th*0.5); g.stroke();
  // 関節の影
  g.fillStyle='rgba(120,100,170,0.35)';
  g.beginPath(); g.ellipse(r*0.1,-r*0.35,r*0.3,r*0.2,0,0,TAU); g.fill();
  g.restore();
}
function drawSerpent(g,e){
  // 淫蛇: 紫の鱗のぬめる蛇。蛇行しながら滑る
  const r=e.r, ph=e.t*7+e.joff;
  g.save();
  // 胴(節を後ろへ連ねる)
  for(let i=6;i>=1;i--){
    const sx=-i*r*0.34, sy=-r*0.35+Math.sin(ph-i*0.9)*r*0.28;
    g.fillStyle=i%2?'#8a5ac9':'#a06ae0';
    g.beginPath(); g.arc(sx,sy,r*(0.42-i*0.035),0,TAU); g.fill();
    g.fillStyle='rgba(232,200,255,0.45)';
    g.beginPath(); g.ellipse(sx,sy+r*0.1,r*(0.26-i*0.02),r*0.08,0,0,TAU); g.fill();
    // 鱗の菱形(模様)
    g.save(); g.translate(sx,sy-r*0.12); g.rotate(Math.PI/4);
    g.fillStyle='rgba(60,30,110,0.5)'; const q=r*(0.11-i*0.008); g.fillRect(-q/2,-q/2,q,q);
    g.restore();
  }
  // 頭
  const hy=-r*0.35+Math.sin(ph)*r*0.28;
  g.fillStyle='#b07ae8';
  g.beginPath(); g.ellipse(r*0.15,hy,r*0.55,r*0.4,0,0,TAU); g.fill();
  // 舌(ちろちろ)
  const tg=Math.max(0,Math.sin(e.t*13))*r*0.5;
  if(tg>0.05){
    g.strokeStyle='#ff6b9a'; g.lineWidth=1.2; g.lineCap='round';
    g.beginPath(); g.moveTo(r*0.68,hy); g.lineTo(r*0.68+tg,hy-tg*0.25); g.stroke();
    g.beginPath(); g.moveTo(r*0.68,hy); g.lineTo(r*0.68+tg,hy+tg*0.25); g.stroke();
  }
  // 目
  g.fillStyle='#ffd76a';
  g.beginPath(); g.arc(r*0.38,hy-r*0.12,r*0.11,0,TAU); g.fill();
  g.fillStyle='#2a1a3a';
  g.beginPath(); g.ellipse(r*0.4,hy-r*0.12,r*0.03,r*0.09,0,0,TAU); g.fill();
  // 光沢
  g.fillStyle='rgba(255,255,255,0.35)';
  g.beginPath(); g.ellipse(r*0.05,hy-r*0.22,r*0.3,r*0.08,0,0,TAU); g.fill();
  g.restore();
}
function drawMoth(g,e){
  // 媚蛾: 翼幅の広い桃色の大蛾。旋回しながら鱗粉を撒く
  const r=e.r, fl=Math.sin(e.t*(e.swoopT>0?26:9));
  g.save();
  g.translate(0,-r*0.9+Math.sin(e.t*3)*2);
  const wsc=0.55+0.45*Math.abs(fl);
  // 翼(4枚・はばたきで横幅が変わる)
  for(const sd of [-1,1]){
    g.save(); g.scale(sd*wsc,1);
    // 上翅
    g.fillStyle='#ffb3cf';
    g.beginPath(); g.moveTo(r*0.15,-r*0.2);
    g.quadraticCurveTo(r*1.3,-r*1.5, r*1.7,-r*0.55);
    g.quadraticCurveTo(r*1.2,-r*0.05, r*0.15,r*0.05);
    g.closePath(); g.fill();
    // 下翅
    g.fillStyle='#ff86b3';
    g.beginPath(); g.moveTo(r*0.15,r*0.05);
    g.quadraticCurveTo(r*1.25,r*0.35, r*1.1,r*0.95);
    g.quadraticCurveTo(r*0.6,r*0.75, r*0.12,r*0.45);
    g.closePath(); g.fill();
    // 翅脈
    g.strokeStyle='rgba(138,58,106,0.35)'; g.lineWidth=0.8;
    for(const [cx2,cy2] of [[r*1.5,-r*0.9],[r*1.6,-r*0.55],[r*1.3,-r*0.2]]){ g.beginPath(); g.moveTo(r*0.15,-r*0.1); g.quadraticCurveTo(r*0.8,(cy2-r*0.1)/2, cx2,cy2); g.stroke(); }
    // 眼状紋(個体で色が違う・二重の輪)
    const ec=['#8a3a6a','#3a5a8a','#8a6a2a'][e.vari||0];
    g.fillStyle=ec;
    g.beginPath(); g.ellipse(r*0.95,-r*0.6,r*0.22,r*0.16,0.3,0,TAU); g.fill();
    g.strokeStyle='rgba(255,227,239,0.7)'; g.lineWidth=0.7;
    g.beginPath(); g.ellipse(r*0.95,-r*0.6,r*0.3,r*0.22,0.3,0,TAU); g.stroke();
    g.fillStyle='#ffe3ef';
    g.beginPath(); g.arc(r*1.0,-r*0.63,r*0.07,0,TAU); g.fill();
    g.restore();
  }
  // 胴(もふもふ。毛の弧)
  g.fillStyle='#c9a0b8';
  g.beginPath(); g.ellipse(0,r*0.2,r*0.26,r*0.62,0,0,TAU); g.fill();
  g.strokeStyle='#e8c8d8'; g.lineWidth=0.8;
  for(let i=0;i<3;i++){ g.beginPath(); g.arc(0,-r*0.1+i*r*0.28,r*0.3,Math.PI*1.15,Math.PI*1.85); g.stroke(); }
  g.fillStyle='#e8c8d8';
  g.beginPath(); g.arc(0,-r*0.35,r*0.3,0,TAU); g.fill();
  // 触角(羽根状)
  g.strokeStyle='#8a3a6a'; g.lineWidth=1.4; g.lineCap='round';
  for(const sd of [-1,1]){
    g.beginPath(); g.moveTo(sd*r*0.1,-r*0.55);
    g.quadraticCurveTo(sd*r*0.5,-r*1.1, sd*r*0.75+Math.sin(e.t*4+sd)*1.5,-r*1.15);
    g.stroke();
  }
  // 目
  g.fillStyle='#3a1a2a';
  g.beginPath(); g.arc(-r*0.12,-r*0.4,r*0.07,0,TAU); g.fill();
  g.beginPath(); g.arc(r*0.12,-r*0.4,r*0.07,0,TAU); g.fill();
  // 鱗粉
  g.fillStyle='rgba(255,194,216,0.6)';
  for(let i=0;i<3;i++){
    const ph=(e.t*1.4+i*0.7)%1.2;
    g.beginPath(); g.arc(Math.sin(e.t*2+i*2.1)*r*0.9, r*0.6+ph*10, 1.4+ph, 0, TAU); g.fill();
  }
  g.restore();
}
function drawPot(g,e){
  // 触手壺: 口を開けた肉の壺。縁の触手がうねり、ジェムを吸い込む
  const r=e.r, ph=e.t*2.2;
  g.save();
  // 吸引の渦(うすく)
  g.strokeStyle='rgba(143,211,255,0.18)'; g.lineWidth=1;
  for(let i=0;i<2;i++){
    g.beginPath(); g.arc(0,-r*0.9,r*(1.6+i*0.9)+Math.sin(ph+i)*3,0,TAU); g.stroke();
  }
  // 壺の胴
  const grad=g.createRadialGradient(-r*0.3,-r*0.9,r*0.2,0,-r*0.7,r*1.15);
  grad.addColorStop(0,'#c890a8'); grad.addColorStop(1,'#7a4a66');
  g.fillStyle=grad;
  g.beginPath();
  g.moveTo(-r*0.75,-r*1.15);
  g.quadraticCurveTo(-r*1.2,-r*0.5, -r*0.8,0);
  g.quadraticCurveTo(0,r*0.18, r*0.8,0);
  g.quadraticCurveTo(r*1.2,-r*0.5, r*0.75,-r*1.15);
  g.closePath(); g.fill();
  // 血管めいた筋
  g.strokeStyle='rgba(90,40,70,0.45)'; g.lineWidth=1.2;
  for(let i=-1;i<=1;i++){
    g.beginPath(); g.moveTo(i*r*0.35,-r*1.05); g.quadraticCurveTo(i*r*0.55+Math.sin(ph+i)*2,-r*0.5, i*r*0.3,-r*0.05); g.stroke();
  }
  // 口(暗い洞)
  g.fillStyle='#3a1a2e';
  g.beginPath(); g.ellipse(0,-r*1.15,r*0.78,r*0.3,0,0,TAU); g.fill();
  g.fillStyle='#5a2a44';
  g.beginPath(); g.ellipse(0,-r*1.15,r*0.55,r*0.18,0,0,TAU); g.fill();
  // 縁の触手(うねうね)
  g.strokeStyle='#c98cbf'; g.lineWidth=r*0.16; g.lineCap='round';
  for(let i=0;i<6;i++){
    const a=Math.PI+i*Math.PI/5, bx=Math.cos(a)*r*0.72, by=-r*1.15+Math.sin(a)*r*0.28;
    const w=Math.sin(ph*1.6+i*1.3)*r*0.25;
    g.beginPath(); g.moveTo(bx,by);
    g.quadraticCurveTo(bx*1.25+w,by-r*0.45, bx*1.15+w*1.6,by-r*0.85+Math.abs(w)*0.5);
    g.stroke();
  }
  // 唾液の光沢
  g.fillStyle='rgba(255,255,255,0.3)';
  g.beginPath(); g.ellipse(-r*0.4,-r*0.8,r*0.16,r*0.32,0.3,0,TAU); g.fill();
  g.restore();
}
function drawQueen(g,e){
  // ナメクジ女王: 王冠めいた襞を持つ大ナメクジ。脈動の直前に光る
  const r=e.r, ph=Math.sin(e.t*2.4);
  const stretch=1+ph*0.1;
  g.save();
  const charge=e.pulseCd<1?1-e.pulseCd:0;
  if(charge>0){
    g.globalAlpha=0.35*charge;
    g.fillStyle='#ffb3cf';
    g.beginPath(); g.arc(0,-r*0.5,r*1.6*charge+r*0.4,0,TAU); g.fill();
    g.globalAlpha=1;
  }
  // 体
  g.fillStyle='#d090b0';
  g.beginPath(); g.ellipse(0,-r*0.42,r*1.0*stretch,r*0.55/stretch,0,0,TAU); g.fill();
  g.fillStyle='#e0a0c0';
  g.beginPath(); g.ellipse(-r*0.15,-r*0.6,r*0.62*stretch,r*0.32,0,0,TAU); g.fill();
  // 頭
  g.fillStyle='#d8a0c8';
  g.beginPath(); g.arc(r*0.68*stretch,-r*0.55,r*0.4,0,TAU); g.fill();
  // 触角
  g.strokeStyle='#a06a90'; g.lineWidth=1.8; g.lineCap='round';
  for(const sd of [-1,1]){
    const wx=r*0.68*stretch+sd*2.6, tip=Math.sin(e.t*3.5+sd)*1.4;
    g.beginPath(); g.moveTo(wx,-r*0.8);
    g.quadraticCurveTo(wx+sd*1.5,-r*1.2, wx+sd*2.4+tip,-r*1.38);
    g.stroke();
    g.fillStyle='#3a1a3a';
    g.beginPath(); g.arc(wx+sd*2.4+tip,-r*1.4,1.5,0,TAU); g.fill();
  }
  // 王冠の襞(背)
  g.fillStyle='#ffd0e6';
  for(let i=0;i<5;i++){
    const bx=-r*0.7+i*r*0.32, h=r*(0.5+0.2*Math.sin(e.t*3+i));
    g.beginPath(); g.moveTo(bx-r*0.14,-r*0.85); g.lineTo(bx,-r*0.85-h); g.lineTo(bx+r*0.14,-r*0.85); g.closePath(); g.fill();
  }
  g.fillStyle='#ffd76a';
  for(let i=0;i<5;i++){
    const bx=-r*0.7+i*r*0.32, h=r*(0.5+0.2*Math.sin(e.t*3+i));
    g.beginPath(); g.arc(bx,-r*0.85-h,1.6,0,TAU); g.fill();
  }
  // ハート模様
  g.fillStyle='rgba(255,130,175,0.85)';
  heartPath(g,-r*0.25,-r*0.5,1.3); g.fill();
  g.fillStyle='rgba(255,255,255,0.4)';
  g.beginPath(); g.ellipse(-r*0.45,-r*0.78,r*0.26,r*0.1,-0.4,0,TAU); g.fill();
  g.restore();
}
function drawDreamtree(g,e){
  // 淫夢の樹: 桃色の花を咲かせた黒い樹。根が広がり、洞からワームが這い出る
  const r=e.r, sw=Math.sin(e.t*0.9)*0.04;
  g.save();
  // 甘香の領域
  const aura=g.createRadialGradient(0,-r*0.6,r*0.6,0,-r*0.6,120);
  aura.addColorStop(0,'rgba(255,150,190,0.16)'); aura.addColorStop(1,'rgba(255,150,190,0)');
  g.fillStyle=aura;
  g.beginPath(); g.arc(0,-r*0.6,120,0,TAU); g.fill();
  // 根
  g.strokeStyle='#2a1e2e'; g.lineWidth=r*0.16; g.lineCap='round';
  for(let i=0;i<7;i++){
    const a=Math.PI*0.15+i*Math.PI*0.7/6, len=r*(1.3+0.3*Math.sin(i*1.7));
    const w=Math.sin(e.t*1.4+i)*3;
    g.beginPath(); g.moveTo((i-3)*r*0.18,0);
    g.quadraticCurveTo(Math.cos(a)*len*0.6+w, r*0.25, Math.cos(a)*len*(i%2?1:-1)*0.9+w, r*0.45);
    g.stroke();
  }
  // 幹
  g.save(); g.rotate(sw);
  g.fillStyle='#2a1e2e';
  g.beginPath();
  g.moveTo(-r*0.55,0);
  g.quadraticCurveTo(-r*0.35,-r*0.9, -r*0.4,-r*1.7);
  g.lineTo(r*0.4,-r*1.7);
  g.quadraticCurveTo(r*0.35,-r*0.9, r*0.55,0);
  g.closePath(); g.fill();
  // 洞(ワームの出口・脈動)
  const puls=e.spawnCd<0.8?1+(0.8-e.spawnCd)*0.6:1;
  g.fillStyle='#4a1a3a';
  g.beginPath(); g.ellipse(0,-r*0.7,r*0.22*puls,r*0.3*puls,0,0,TAU); g.fill();
  g.fillStyle='#8a3a6a';
  g.beginPath(); g.ellipse(0,-r*0.72,r*0.1*puls,r*0.16*puls,0,0,TAU); g.fill();
  // 花冠(黒い枝に桃色の花房)
  const canopy=[[0,-r*2.1,r*0.75],[-r*0.75,-r*1.8,r*0.6],[r*0.75,-r*1.85,r*0.62],[-r*0.35,-r*2.45,r*0.5],[r*0.4,-r*2.4,r*0.52]];
  for(const [cx,cy,cr] of canopy){
    g.fillStyle='#1e1424';
    g.beginPath(); g.arc(cx,cy+2,cr*1.02,0,TAU); g.fill();
  }
  for(const [cx,cy,cr] of canopy){
    const gr=g.createRadialGradient(cx-cr*0.3,cy-cr*0.3,cr*0.1,cx,cy,cr);
    gr.addColorStop(0,'#ffc2d8'); gr.addColorStop(1,'#e86a9c');
    g.fillStyle=gr;
    g.beginPath(); g.arc(cx,cy,cr,0,TAU); g.fill();
  }
  // 花(小さな五弁)
  g.fillStyle='#fff0f6';
  for(let i=0;i<6;i++){
    const a=e.t*0.5+i*1.05, cx=Math.cos(a)*r*0.9, cy=-r*2.05+Math.sin(a*1.3)*r*0.4;
    for(let k=0;k<5;k++){ g.beginPath(); g.arc(cx+Math.cos(k*TAU/5)*2.2,cy+Math.sin(k*TAU/5)*2.2,1.5,0,TAU); g.fill(); }
  }
  g.restore();
  // 舞う花弁
  g.fillStyle='rgba(255,194,216,0.7)';
  for(let i=0;i<4;i++){
    const ph=(e.t*0.6+i*0.8)%2;
    g.beginPath(); g.ellipse(Math.sin(e.t+i*1.7)*r*1.3, -r*2.2+ph*r*1.2, 2.2,1.2, e.t*3+i,0,TAU); g.fill();
  }
  g.restore();
}
function drawSpore(g,e){
  // 痺れ浮遊子: 半透明の傘、垂れる細い触糸、縁の小さな火花
  const r=e.r, ph=Math.sin(e.t*2.4+e.joff);
  g.save();
  g.translate(0,-r*0.9+ph*1.5);
  g.strokeStyle='rgba(180,220,255,0.6)'; g.lineWidth=1;
  for(let i=0;i<5;i++){
    const x=(i-2)*r*0.3;
    g.beginPath(); g.moveTo(x,r*0.2);
    g.quadraticCurveTo(x+Math.sin(e.t*3+i)*3, r*0.9, x+Math.sin(e.t*2+i)*4, r*1.6);
    g.stroke();
  }
  const grad=g.createRadialGradient(-r*0.2,-r*0.3,r*0.1,0,0,r);
  grad.addColorStop(0,'rgba(230,245,255,0.9)'); grad.addColorStop(1,'rgba(127,184,224,0.45)');
  g.fillStyle=grad;
  g.beginPath(); g.ellipse(0,0,r*(1+ph*0.06),r*0.7*(1-ph*0.06),0,0,TAU); g.fill();
  g.fillStyle='rgba(120,170,220,0.45)';
  for(let i=0;i<5;i++){ const a=-Math.PI*0.9+i*0.45; g.beginPath(); g.arc(Math.cos(a)*r*0.55,Math.sin(a)*r*0.4,r*0.09,0,TAU); g.fill(); }   // 傘の斑点(模様)
  g.strokeStyle='rgba(255,224,102,'+(0.4+0.4*Math.max(0,Math.sin(e.t*9))).toFixed(2)+')'; g.lineWidth=1.2;
  for(let i=0;i<3;i++){
    const a=e.t*4+i*TAU/3;
    g.beginPath(); g.moveTo(Math.cos(a)*r,Math.sin(a)*r*0.7); g.lineTo(Math.cos(a)*r*1.3,Math.sin(a)*r*0.9); g.stroke();
  }
  g.restore();
}
function drawGhosthand(g,e){
  // 手霊: 半透明の青白い手。指がゆっくり蠢く。下に霊気の尾
  const r=e.r, t=e.t;
  g.save();
  g.translate(0,-r*1.2+Math.sin(t*2.5+e.joff)*2);
  g.globalAlpha=0.85;
  glow(g,0,r*0.4,r*1.4,'170,180,232',0.5);
  g.fillStyle='rgba(223,228,255,0.7)';
  g.beginPath(); g.moveTo(0,r*1.6); g.quadraticCurveTo(-r*0.6,r*0.8,0,r*0.3); g.quadraticCurveTo(r*0.6,r*0.8,0,r*1.6); g.fill();   // 尾
  g.fillStyle='#e8ecff';
  g.beginPath(); g.ellipse(0,0,r*0.75,r*0.6,0,0,TAU); g.fill();   // 掌
  g.strokeStyle='#e8ecff'; g.lineWidth=r*0.32; g.lineCap='round';
  for(let i=0;i<5;i++){
    const a=-Math.PI*0.95+i*0.38, len=r*(i===0?0.7:0.95)+Math.sin(t*4+i)*1.5;
    g.beginPath(); g.moveTo(Math.cos(a)*r*0.5,Math.sin(a)*r*0.4); g.lineTo(Math.cos(a)*len,Math.sin(a)*len*0.9); g.stroke();
  }
  g.restore();
}
function drawEye(g,e){
  // 覗き目玉: 瞼のない眼球に小さな翼。凝視の直前に虹彩が光る
  const r=e.r, t=e.t, gl=clamp(1-((e.gazeCd===undefined?3:e.gazeCd)/1.2),0,1);
  g.save();
  g.translate(0,-r*1.2+Math.sin(t*3)*2);
  const fl=Math.sin(t*14)*0.5;
  g.fillStyle='#5a3a7a';
  for(const sd of [-1,1]){
    g.beginPath(); g.moveTo(sd*r*0.6,-r*0.2); g.quadraticCurveTo(sd*r*1.6,-r*1.1-fl*6, sd*r*1.7,-r*0.1-fl*5); g.quadraticCurveTo(sd*r*1.1,-r*0.1, sd*r*0.6,r*0.2); g.closePath(); g.fill();
  }
  glow(g,0,0,r*1.5,'201,140,255',0.3+gl*0.6);
  g.fillStyle='#f4efff';
  g.beginPath(); g.arc(0,0,r*0.95,0,TAU); g.fill();
  g.fillStyle='rgba(60,20,90,0.3)';
  g.beginPath(); g.arc(0,0,r*0.95,0.2*Math.PI,0.8*Math.PI); g.fill();
  g.strokeStyle='rgba(200,80,110,0.5)'; g.lineWidth=0.8;
  for(let i=0;i<5;i++){ const a=i*TAU/5+0.4; g.beginPath(); g.moveTo(Math.cos(a)*r*0.5,Math.sin(a)*r*0.5); g.lineTo(Math.cos(a)*r*0.92,Math.sin(a)*r*0.92); g.stroke(); }
  if(!NO_IRIS) drawIris(g,r*0.9,eyeLookA(e,-r*1.2),gl,gl>0.3?'#b46cff':'#7a3ff2');
  g.restore();
}
/* 覗き目玉の視線: 眼の位置(e.x, e.y+oy)から彼女の胸元へ */
function eyeLookA(e,oy){ const p=G.B&&G.B.hero; if(!p) return -Math.PI/2; return Math.atan2((p.y-20)-(e.y+oy), p.x-e.x); }
function drawSuccubus(g,e){
  // 寸止めの淫魔: 小淫魔の姉。色が深く、指先に「栓」の光
  g.save();
  drawImp(g,e,{wing:'#7a2a5a',tail:'#b8407a',heart:'#ff5d9e',skin:'#f4d2c4',dress:'#b8306a',head:'#f7dccf',hair:'#5a2a6a',horn:'#f0e0ff',face:'#3a1226',blush:'rgba(255,90,140,0.55)',pattern:'rgba(255,200,230,0.7)'});
  const r=e.r*1.15, ch=Math.max(0,1-((e.denyCd===undefined?8:e.denyCd)/1.5));
  if(ch>0){
    g.globalAlpha=ch;
    g.shadowColor='#ff5d9e'; g.shadowBlur=10;
    g.fillStyle='#ffd3e6';
    g.beginPath(); g.arc(r*0.6,-r*0.85,2.6+ch*1.5,0,TAU); g.fill();
    g.globalAlpha=1;
  }
  g.restore();
}
function drawWeb(g,e){
  // 淫糸の巣: 桃色に濡れた放射糸と同心多角形
  const r=e.r*1.9, t=e.t;
  g.save();
  g.translate(0,-e.r*0.4);
  g.globalAlpha=0.85;
  g.strokeStyle='rgba(255,179,207,0.75)'; g.lineWidth=1.2;
  const N=8;
  for(let i=0;i<N;i++){ const a=i*TAU/N; g.beginPath(); g.moveTo(0,0); g.lineTo(Math.cos(a)*r,Math.sin(a)*r*0.6); g.stroke(); }
  for(let k=1;k<=3;k++){
    const rr2=r*k/3, wob=Math.sin(t*2+k)*1.5;
    g.beginPath();
    for(let i=0;i<=N;i++){ const a=i*TAU/N; const x=Math.cos(a)*(rr2+wob), y=Math.sin(a)*(rr2+wob)*0.6; if(i===0) g.moveTo(x,y); else g.lineTo(x,y); }
    g.stroke();
  }
  g.fillStyle='rgba(255,255,255,0.7)';
  for(let i=0;i<6;i++){ const a=i*1.1+t*0.3, rr3=r*(0.3+((i*0.37)%0.6)); g.beginPath(); g.arc(Math.cos(a)*rr3,Math.sin(a)*rr3*0.6,1.2,0,TAU); g.fill(); }
  g.restore();
}
/* ---- v1.3: ゲイザー種・照射触手(瞳は常に彼女を追う) ---- */
function drawTentacleBase(g,r,t,n,col){
  g.strokeStyle=col; g.lineWidth=r*0.22; g.lineCap='round';
  for(let i=0;i<n;i++){
    const a=Math.PI*0.15+i*(Math.PI*0.7/(n-1));
    const ph=Math.sin(t*2+i*1.3);
    const x0=Math.cos(a)*r*0.5, y0=-r*0.2, cx=Math.cos(a)*r*1.2+ph*4, cy=r*0.1, x1=Math.cos(a)*r*1.5+ph*6, y1=r*0.45;
    g.beginPath(); g.moveTo(x0,y0); g.quadraticCurveTo(cx,cy,x1,y1); g.stroke();
    // 吸盤の模様
    g.fillStyle='rgba(200,150,220,0.5)';
    for(let k=1;k<=2;k++){ const q=k/3, bx=(1-q)*(1-q)*x0+2*(1-q)*q*cx+q*q*x1, by=(1-q)*(1-q)*y0+2*(1-q)*q*cy+q*q*y1; g.beginPath(); g.arc(bx,by,r*0.05,0,TAU); g.fill(); }
    g.strokeStyle=col;
  }
}
function drawEyeball(g,cx,cy,R,lookA,gl,irisCol){
  g.save();
  g.translate(cx,cy);
  glow(g,0,0,R*1.6,'180,108,255',0.35+gl*0.55);
  g.fillStyle='#f4efff';
  g.beginPath(); g.arc(0,0,R,0,TAU); g.fill();
  g.fillStyle='rgba(60,20,90,0.35)';
  g.beginPath(); g.arc(0,0,R,0.2*Math.PI,0.8*Math.PI); g.fill();   // 下瞼の陰(球に見える)
  g.strokeStyle='rgba(200,80,110,0.45)'; g.lineWidth=Math.max(0.8,R*0.05);
  for(let i=0;i<6;i++){ const a=i*TAU/6+0.3; g.beginPath(); g.moveTo(Math.cos(a)*R*0.45,Math.sin(a)*R*0.45); g.lineTo(Math.cos(a)*R*0.92,Math.sin(a)*R*0.92); g.stroke(); }
  if(!NO_IRIS) drawIris(g,R,lookA,gl,irisCol);
  g.restore();
}
/* 虹彩・瞳・ハイライト(視線 lookA 方向へ寄る)。焼き絵の上に生で重ねる部分 */
function drawIris(g,R,lookA,gl,irisCol){
  const lx=Math.cos(lookA)*R*0.34, ly=Math.sin(lookA)*R*0.34;
  g.fillStyle=irisCol||(gl>0.3?'#c98cff':'#7a3ff2');
  g.beginPath(); g.arc(lx,ly,R*0.46,0,TAU); g.fill();
  g.fillStyle='#120a1e';
  g.beginPath(); g.arc(lx,ly,R*0.22*(1-gl*0.45),0,TAU); g.fill();
  g.fillStyle='rgba(255,255,255,0.85)';
  g.beginPath(); g.arc(lx-R*0.15,ly-R*0.17,R*0.09,0,TAU); g.fill();
}
function drawGazer(g,e){
  const r=e.r, t=e.t;
  const glow=e.gzState==='aim'?clamp(1-(e.gzT||0)/BAL.GAZE_AIM,0,1):(e.gzState==='flash'?1:0);
  g.save();
  drawTentacleBase(g,r,t,5,'#5a3a7a');
  g.fillStyle='#3a1f5a';
  g.beginPath(); g.ellipse(0,-r*0.35,r*0.8,r*0.5,0,0,TAU); g.fill();
  drawEyeball(g,0,-r,r*0.95,e.lookA||0,glow);
  g.restore();
}
function drawBeamer(g,e){
  const r=e.r, t=e.t;
  const aiming=e.bmState==='aim', firing=e.bmState==='fire';
  g.save();
  // 細長い触手の胴
  g.strokeStyle='#5a3a7a'; g.lineWidth=r*0.6; g.lineCap='round';
  g.beginPath(); g.moveTo(0,0); g.quadraticCurveTo(Math.sin(t*1.5)*4,-r*0.8, Math.sin(t*1.1)*2,-r*1.4); g.stroke();
  g.strokeStyle='#8a5aa8'; g.lineWidth=r*0.32;
  g.beginPath(); g.moveTo(0,-r*0.1); g.quadraticCurveTo(Math.sin(t*1.5)*4,-r*0.8, Math.sin(t*1.1)*2,-r*1.35); g.stroke();
  // 先端の水晶の眼(焼き中は描かず MON_IRIS.beamer が生で重ねる: 視線で回るので)
  if(!NO_IRIS) drawBeamerCrystal(g,e,Math.sin(t*1.1)*2,-r*1.4);
  // 照準線は焼いた絵の外(ワールド座標)で drawSightSectors が描く——焼き絵の中だと45px で切れ、角度も量子化される
  g.restore();
}
function drawBeamerCrystal(g,e,ex,ey){
  const r=e.r, aiming=e.bmState==='aim', firing=e.bmState==='fire';
  g.save(); g.translate(ex,ey);
  glow(g,0,0,r*1.1,aiming||firing?'255,215,106':'216,200,255',aiming?0.7:0.4);
  g.rotate((e.lookA||0)+Math.PI/2);
  g.fillStyle=aiming?'#fff3c4':'#d8c8ff';
  g.beginPath(); g.moveTo(0,-r*0.6); g.lineTo(r*0.36,0); g.lineTo(0,r*0.45); g.lineTo(-r*0.36,0); g.closePath(); g.fill();
  g.fillStyle=aiming||firing?'#ff5d9e':'#5a3a7a';
  g.beginPath(); g.arc(0,-r*0.05,r*0.16,0,TAU); g.fill();
  g.restore();
}
/* ---- v1.6 ボス4種 ---- */
function drawSlimeking(g,e){
  const r=e.r, t=e.t, puls=1+Math.sin(t*2.2)*0.05;
  g.save();
  // 足元に広がる粘液
  g.fillStyle='rgba(95,208,192,0.35)';
  g.beginPath(); g.ellipse(0,2,r*1.5,r*0.45,0,0,TAU); g.fill();
  for(let i=0;i<5;i++){ const a=i*TAU/5+t*0.3; g.beginPath(); g.ellipse(Math.cos(a)*r*1.3,2+Math.sin(a)*r*0.35,r*0.22,r*0.1,0,0,TAU); g.fill(); }
  // 胴(半透明の粘液の山)
  const grad=g.createRadialGradient(-r*0.3,-r*1.1,r*0.2,0,-r*0.8,r*1.5);
  grad.addColorStop(0,'rgba(180,255,240,0.95)'); grad.addColorStop(0.6,'rgba(95,208,192,0.9)'); grad.addColorStop(1,'rgba(40,120,110,0.9)');
  g.fillStyle=grad;
  g.beginPath(); g.moveTo(-r*1.3,0); g.bezierCurveTo(-r*1.45,-r*1.2*puls,-r*0.6,-r*1.9*puls,0,-r*1.85*puls); g.bezierCurveTo(r*0.6,-r*1.9*puls,r*1.45,-r*1.2*puls,r*1.3,0); g.closePath(); g.fill();
  // 核と、昇っていく泡(模様)
  g.fillStyle='rgba(30,90,85,0.55)'; g.beginPath(); g.ellipse(0,-r*0.75,r*0.5,r*0.6,0,0,TAU); g.fill();
  g.fillStyle='rgba(220,255,250,0.5)';
  for(let i=0;i<7;i++){ const a=i*2.4+t*0.5, rr=r*(0.35+0.45*((i*0.37)%1)); const bx=Math.cos(a)*rr*0.9, by=-r*0.9+Math.sin(a)*rr*0.7-((t*0.35+i*0.3)%1)*r*0.4; g.beginPath(); g.arc(bx,by,r*0.06+((i*0.53)%1)*r*0.07,0,TAU); g.fill(); }
  // 目(彼女を追う)
  const la=e.lookA||0, lx=Math.cos(la)*r*0.12, ly=Math.sin(la)*r*0.08;
  g.fillStyle='#fff'; for(const sd of [-1,1]){ g.beginPath(); g.ellipse(sd*r*0.38,-r*1.05,r*0.16,r*0.2,0,0,TAU); g.fill(); }
  g.fillStyle='#1a4a48'; for(const sd of [-1,1]){ g.beginPath(); g.arc(sd*r*0.38+lx,-r*1.05+ly,r*0.09,0,TAU); g.fill(); }
  // 水晶の冠
  g.fillStyle='#ffd76a';
  for(const [ox,h] of [[-r*0.45,r*0.35],[-r*0.15,r*0.5],[r*0.15,r*0.5],[r*0.45,r*0.35]]){ g.beginPath(); g.moveTo(ox-r*0.1,-r*1.75); g.lineTo(ox,-r*1.75-h); g.lineTo(ox+r*0.1,-r*1.75); g.closePath(); g.fill(); }
  g.fillRect(-r*0.55,-r*1.8,r*1.1,r*0.12);
  g.fillStyle='rgba(255,255,255,0.45)'; g.beginPath(); g.ellipse(-r*0.45,-r*1.35,r*0.22,r*0.12,-0.5,0,TAU); g.fill();
  g.restore();
}
function drawRunemage(g,e){
  const r=e.r, t=e.t, bob=Math.sin(t*1.6)*2;
  const dir=Math.cos(e.lookA||0)>=0?1:-1;
  g.save();
  // 足元に浮く淫紋の輪
  g.save(); g.globalAlpha=0.5; g.strokeStyle='#ff86b3'; g.lineWidth=1.4;
  g.beginPath(); g.ellipse(0,1,r*1.3,r*0.45,0,0,TAU); g.stroke();
  g.fillStyle='#ffb3cf'; for(let i=0;i<6;i++){ const a=i*TAU/6+t*0.8; g.beginPath(); g.arc(Math.cos(a)*r*1.3,1+Math.sin(a)*r*0.45,1.6,0,TAU); g.fill(); }
  g.restore();
  g.translate(0,bob);
  // ローブ
  g.fillStyle='#5a2a5a';
  g.beginPath(); g.moveTo(-r*0.95,0); g.quadraticCurveTo(-r*0.9,-r*1.4,-r*0.45,-r*2.0); g.lineTo(r*0.45,-r*2.0); g.quadraticCurveTo(r*0.9,-r*1.4,r*0.95,0); g.closePath(); g.fill();
  // ローブの紋(模様)
  g.strokeStyle='rgba(255,134,179,0.55)'; g.lineWidth=1.1;
  for(let i=0;i<3;i++){ const y=-r*(0.35+i*0.45), w=r*(0.75-i*0.15); g.beginPath(); g.moveTo(-w,y); g.quadraticCurveTo(0,y-r*0.15,w,y); g.stroke(); }
  g.fillStyle='rgba(255,134,179,0.6)'; g.beginPath(); g.arc(0,-r*1.0,r*0.16,0,TAU); g.fill();
  // 頭巾と、闇の中の桃色の目
  g.fillStyle='#4a1f4a'; g.beginPath(); g.ellipse(0,-r*2.05,r*0.55,r*0.5,0,0,TAU); g.fill();
  g.fillStyle='#1a0a1e'; g.beginPath(); g.ellipse(dir*r*0.08,-r*1.95,r*0.4,r*0.32,0,0,TAU); g.fill();
  g.fillStyle='#ff86b3'; for(const sd of [-1,1]){ g.beginPath(); g.ellipse(dir*r*0.08+sd*r*0.16,-r*1.95,r*0.07,r*0.05,0,0,TAU); g.fill(); }
  // 杖と、先で回る呪印
  g.strokeStyle='#8a5a3a'; g.lineWidth=2.2; g.lineCap='round'; g.beginPath(); g.moveTo(dir*r*0.8,-r*0.1); g.lineTo(dir*r*0.95,-r*2.3); g.stroke();
  const gl=0.5+0.5*Math.sin(t*3);
  glow(g,dir*r*0.95,-r*2.55,r*0.55,'255,134,179',0.35+0.35*gl);
  g.save(); g.translate(dir*r*0.95,-r*2.55); g.rotate(t*1.5); g.fillStyle='#ffd0e4';
  g.beginPath(); for(let i=0;i<8;i++){ const a=i*Math.PI/4, rr=(i%2===0)?r*0.3:r*0.12; g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr); } g.closePath(); g.fill();
  g.restore();
  g.restore();
}
function drawSuccuqueen(g,e){
  const r=e.r*1.15, fl=Math.sin(e.t*11);
  g.save();
  // 大きな翅(本体の後ろ)
  g.save(); g.translate(0,fl*1.6-r*0.5); const dir=Math.cos(e.orbitA||0)>=0?1:-1; g.scale(dir,1);
  g.fillStyle='#6a1f4a';
  for(const sd of [-1,1]){ const flap=fl*0.4*sd; g.beginPath(); g.moveTo(sd*r*0.3,-r*1.2); g.quadraticCurveTo(sd*r*2.0,-r*2.2-flap*8,sd*r*2.4,-r*0.6-flap*6); g.quadraticCurveTo(sd*r*1.6,-r*0.5,sd*r*0.35,-r*0.3); g.closePath(); g.fill(); }
  g.restore();
  drawImp(g,e,{wing:'#8a2a6a',tail:'#c8408a',heart:'#ff5d9e',skin:'#f7d8cc',dress:'#7a1f5a',head:'#f9e0d4',hair:'#2a1a3e',horn:'#ffd76a',face:'#3a1226',blush:'rgba(255,90,140,0.6)',pattern:'rgba(255,215,106,0.55)'});
  // 冠
  g.save(); g.translate(0,fl*1.6-r*0.5);
  g.fillStyle='#ffd76a';
  g.beginPath(); g.moveTo(-r*0.42,-r*2.05); g.lineTo(-r*0.3,-r*2.45); g.lineTo(-r*0.15,-r*2.15); g.lineTo(0,-r*2.55); g.lineTo(r*0.15,-r*2.15); g.lineTo(r*0.3,-r*2.45); g.lineTo(r*0.42,-r*2.05); g.closePath(); g.fill();
  g.fillStyle='#ff5d9e'; g.beginPath(); g.arc(0,-r*2.15,r*0.07,0,TAU); g.fill();
  g.restore();
  g.restore();
}
function drawGobking(g,e){
  const r=e.r;
  g.save();
  // 毛皮のマント(後ろ)
  g.fillStyle='#6a4a3a'; g.beginPath(); g.moveTo(-r*0.9,-r*1.4); g.quadraticCurveTo(-r*1.1,-r*0.2,-r*0.8,r*0.1); g.lineTo(r*0.8,r*0.1); g.quadraticCurveTo(r*1.1,-r*0.2,r*0.9,-r*1.4); g.closePath(); g.fill();
  g.fillStyle='rgba(255,240,220,0.25)'; for(let i=0;i<6;i++){ g.beginPath(); g.arc(-r*0.75+i*r*0.3,-r*1.35,r*0.13,0,TAU); g.fill(); }
  drawGoblin(g,e);
  // 骨の棍棒
  g.strokeStyle='#d8cfc4'; g.lineWidth=r*0.16; g.lineCap='round';
  g.beginPath(); g.moveTo(r*0.6,-r*0.5); g.lineTo(r*1.25,-r*1.55); g.stroke();
  g.fillStyle='#e8e0d8'; g.beginPath(); g.arc(r*1.28,-r*1.62,r*0.2,0,TAU); g.fill();
  // 冠
  g.fillStyle='#ffd76a';
  g.beginPath(); g.moveTo(-r*0.5,-r*1.85); g.lineTo(-r*0.35,-r*2.3); g.lineTo(-r*0.17,-r*1.95); g.lineTo(0,-r*2.4); g.lineTo(r*0.17,-r*1.95); g.lineTo(r*0.35,-r*2.3); g.lineTo(r*0.5,-r*1.85); g.closePath(); g.fill();
  g.restore();
}
/* 刻印師の呪弾 */
function drawRuneBolt(g,b){
  g.save(); g.translate(b.x,b.y);
  glow(g,0,0,b.r*2.2,'255,134,179',0.5);
  g.rotate(b.t*6); g.fillStyle='#ffd0e4';
  g.beginPath(); for(let i=0;i<8;i++){ const a=i*Math.PI/4, rr=(i%2===0)?b.r:b.r*0.4; g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr); } g.closePath(); g.fill();
  g.fillStyle='#ff5d9e'; g.beginPath(); g.arc(0,0,b.r*0.3,0,TAU); g.fill();
  g.restore();
}
function drawBossgazer(g,e){
  const r=e.r, t=e.t;
  g.save();
  drawTentacleBase(g,r*1.1,t,7,'#3a1f5a');
  const grad=g.createRadialGradient(-r*0.3,-r*0.7,r*0.2,0,-r*0.5,r*1.1);
  grad.addColorStop(0,'#5a3a7a'); grad.addColorStop(1,'#2a1a3e');
  g.fillStyle=grad;
  g.beginPath(); g.ellipse(0,-r*0.5,r*1.0,r*0.7,0,0,TAU); g.fill();
  // 三本の長い触手。先端に眼球(吸盤の列つき)。真ん中は本人を、両脇はずらした先を睨む
  for(const ey of (e.eyes||[])){
    const cx=ey.dx*0.55+Math.sin(t*1.3+ey.base)*r*0.15, cy=ey.dy*0.5-r*0.3;
    g.strokeStyle='#3a1f5a'; g.lineWidth=r*0.3; g.lineCap='round';
    g.beginPath(); g.moveTo(ey.dx*0.2,-r*0.7); g.quadraticCurveTo(cx,cy, ey.dx, ey.dy); g.stroke();
    g.strokeStyle='#5a3a7a'; g.lineWidth=r*0.16;
    g.beginPath(); g.moveTo(ey.dx*0.2,-r*0.7); g.quadraticCurveTo(cx,cy, ey.dx, ey.dy); g.stroke();
    g.fillStyle='rgba(180,120,200,0.55)';
    for(let k=1;k<=4;k++){ const q=k/5, bx=(1-q)*(1-q)*ey.dx*0.2+2*(1-q)*q*cx+q*q*ey.dx, by=(1-q)*(1-q)*(-r*0.7)+2*(1-q)*q*cy+q*q*ey.dy; g.beginPath(); g.arc(bx,by,r*0.045,0,TAU); g.fill(); }
    const glow=ey.state==='aim'?clamp(1-ey.t/(BAL.GAZE_AIM*1.1),0,1):(ey.state==='flash'?1:0);
    const look=ey.state==='aim'?ey.ang:(G.B&&G.B.hero?Math.atan2((G.B.hero.y-10)-(e.y+ey.dy), G.B.hero.x-(e.x+ey.dx)):ey.ang);
    drawEyeball(g,ey.dx,ey.dy,r*0.4,look,glow);
  }
  // 口(触手の胴の裂け目)
  g.fillStyle='#120a1e';
  g.beginPath(); g.ellipse(0,-r*0.25,r*0.35,r*0.12+Math.sin(t*3)*r*0.03,0,0,TAU); g.fill();
  g.restore();
}
/* ゲイザーの視界(扇): 照らされてから閃光まで。彼女はこれを見て避ける */
function drawSightSectors(g,B){
  for(const e of B.enemies){
    if(e.dead||e.dormant) continue;
    if(e.id==='beamer'){
      // 絶頂照射の照準: 光条の通り道(幅=BEAM_W)を淡く示し、中心に流れる破線。最後の0.25秒(固定)は白く締まる
      if(e.bmState!=='aim') continue;
      const pr=clamp(1-e.bmT/BAL.BEAM_AIM,0,1);
      const ox=e.x+Math.sin(e.t*1.1)*2, oy=e.y-e.r*1.4, ux=Math.cos(e.bmAng), uy=Math.sin(e.bmAng);
      g.save();
      g.globalAlpha=0.04+0.10*pr; g.strokeStyle='#ff5d9e'; g.lineWidth=BAL.BEAM_W; g.lineCap='butt';
      g.beginPath(); g.moveTo(ox,oy); g.lineTo(ox+ux*BAL.BEAM_LEN, oy+uy*BAL.BEAM_LEN); g.stroke();
      g.globalAlpha=0.35+0.55*pr; g.lineWidth=1.2; g.setLineDash([5,4]); g.lineDashOffset=-(performance.now()*0.02)%9;
      g.beginPath(); g.moveTo(ox,oy); g.lineTo(ox+ux*BAL.BEAM_LEN, oy+uy*BAL.BEAM_LEN); g.stroke();
      g.setLineDash([]);
      if(e.bmT<=0.25){ g.globalAlpha=0.9; g.strokeStyle='#fff3c4'; g.lineWidth=1.6; g.beginPath(); g.moveTo(ox,oy); g.lineTo(ox+ux*BAL.BEAM_LEN, oy+uy*BAL.BEAM_LEN); g.stroke(); }
      g.restore();
      continue;
    }
    if(e.id!=='gazer'&&e.id!=='bossgazer') continue;
    for(const ey of gazerEyes(e)){
      if(ey.state!=='aim') continue;
      const pr=clamp(1-ey.t/ey.tmax,0,1);
      g.save();
      g.translate(ey.x,ey.y);
      g.globalAlpha=0.10+0.22*pr+0.06*Math.sin(performance.now()*0.02);
      const grad=g.createRadialGradient(0,0,10,0,0,ey.r);
      grad.addColorStop(0,'rgba(200,140,255,0.9)'); grad.addColorStop(1,'rgba(120,60,200,0.15)');
      g.fillStyle=grad;
      g.beginPath(); g.moveTo(0,0); g.arc(0,0,ey.r,ey.ang-ey.spread/2,ey.ang+ey.spread/2); g.closePath(); g.fill();
      g.globalAlpha=0.5+0.4*pr;
      g.strokeStyle='#c98cff'; g.lineWidth=1.2;
      g.beginPath(); g.moveTo(0,0); g.arc(0,0,ey.r,ey.ang-ey.spread/2,ey.ang+ey.spread/2); g.closePath(); g.stroke();
      g.restore();
    }
  }
}
function drawTower(g,e){
  // 催眠電波の塔: 骨と肉の小塔。頂の眼球が周期的に紫の波を放つ
  const r=e.r, ph=Math.max(0,1-((e.pulseCd||4)/4));
  g.save();
  // 土台(肉)
  g.fillStyle='#5a3a5a';
  g.beginPath(); g.ellipse(0,-r*0.1,r*1.0,r*0.42,0,0,TAU); g.fill();
  // 骨の柱(3本)
  g.strokeStyle='#d8cfc4'; g.lineWidth=2.2; g.lineCap='round';
  for(const sd of [-1,0,1]){
    g.beginPath(); g.moveTo(sd*r*0.55,-r*0.2); g.lineTo(sd*r*0.22,-r*2.0); g.stroke();
  }
  // 肉の巻き
  g.strokeStyle='#8a4a7a'; g.lineWidth=3;
  for(let i=0;i<3;i++){
    g.beginPath(); g.arc(0,-r*(0.6+i*0.45),r*(0.5-i*0.1),Math.PI*0.1,Math.PI*0.9,true); g.stroke();
  }
  // 頂の眼球
  g.shadowColor='#c98cff'; g.shadowBlur=8+ph*10;
  g.fillStyle='#f0e8ff';
  g.beginPath(); g.arc(0,-r*2.2,r*0.42,0,TAU); g.fill();
  g.shadowBlur=0;
  g.fillStyle='#7a3ff2';
  g.beginPath(); g.arc(Math.sin(e.t*1.3)*r*0.1,-r*2.2,r*0.22,0,TAU); g.fill();
  g.fillStyle='#1a0a2a';
  g.beginPath(); g.arc(Math.sin(e.t*1.3)*r*0.1,-r*2.2,r*0.1,0,TAU); g.fill();
  // 電波の予兆(放射直前に環が縮む)
  if(ph>0.7){
    g.globalAlpha=(ph-0.7)/0.3*0.6;
    g.strokeStyle='#c98cff'; g.lineWidth=1.5;
    g.beginPath(); g.arc(0,-r*2.2,r*(1.6-(ph-0.7)*3),0,TAU); g.stroke();
    g.globalAlpha=1;
  }
  g.restore();
}
/* 淫紋の罠: プレイヤーにだけ見える淡い紋(彼女のAIは気づかない) */
function drawTrap(g,tr){
  g.save();
  g.translate(tr.x,tr.y);
  const a=tr.armed?(0.22+0.1*Math.sin(tr.t*3)):0.9;
  g.globalAlpha=a;
  const col={rune:'#c98cff',suit:'#ff9ec2',freeze:'#8fd3ff'}[tr.kind||'rune'];
  g.strokeStyle=tr.armed?col:'#fff'; g.lineWidth=tr.armed?1.2:3;
  g.beginPath(); g.ellipse(0,0,tr.r,tr.r*0.55,0,0,TAU); g.stroke();
  g.beginPath(); g.ellipse(0,0,tr.r*0.55,tr.r*0.3,0,0,TAU); g.stroke();
  for(let i=0;i<6;i++){
    const an=i*TAU/6+tr.t*0.4;
    g.beginPath(); g.moveTo(Math.cos(an)*tr.r*0.55,Math.sin(an)*tr.r*0.3); g.lineTo(Math.cos(an)*tr.r,Math.sin(an)*tr.r*0.55); g.stroke();
  }
  if((tr.kind||'rune')==='freeze'){
    g.strokeStyle='#8fd3ff'; g.lineWidth=1.4;
    g.beginPath(); g.moveTo(0,0); g.lineTo(0,-7); g.stroke();
    g.beginPath(); g.moveTo(0,0); g.lineTo(5,2); g.stroke();
  }else{
    g.fillStyle=(tr.kind==='suit')?'rgba(255,158,194,0.9)':'rgba(255,134,179,0.8)';
    heartPath(g,0,-2,0.8); g.fill();
  }
  g.restore();
}
/* アイテム設置カーソル(場の座標) */
function drawPlaceCursor(g,id,x,y){
  const it=NIGHT_ITEMS[id]; if(!it) return;
  const R={mist:80, pool:60, rune:26, tower:190, fake:22}[id]||30;
  g.save();
  g.translate(x,y);
  g.globalAlpha=0.35+0.15*Math.sin(performance.now()*0.008);
  g.strokeStyle='#c98cff'; g.lineWidth=1.5; g.setLineDash([6,5]);
  g.beginPath(); g.ellipse(0,0,R,R*0.7,0,0,TAU); g.stroke();
  g.setLineDash([]);
  g.globalAlpha=0.9;
  g.font='bold 11px '+FONT; g.textAlign='center'; g.textBaseline='middle';
  g.fillStyle='#e8dcff';
  g.fillText(it.icon+' '+it.name+'  EN'+it.cost, 0, -R*0.7-14);
  g.restore();
}
/* v2.0 魔核: 最深部の心臓。濡れた肉の塊、太い根、縦に裂けた目。脈動(pulseT)で膨らみ、鞭(whipT)で根が彼女へ伸びる */
function drawCore(g,e){
  const r=e.r, t=e.t, ph=e.maxHp?e.hp/e.maxHp:1;
  const beat=1+0.045*Math.sin(t*(ph<0.5?5.2:3.4))+(e.pulseT>0?0.12*Math.sin(e.pulseT*9):0);
  g.save();
  g.fillStyle='rgba(20,4,12,0.55)'; g.beginPath(); g.ellipse(0,r*0.35,r*1.5,r*0.6,0,0,TAU); g.fill();
  // 根(床へ広がる)
  g.strokeStyle='#5a1630'; g.lineWidth=7; g.lineCap='round';
  for(let i=0;i<9;i++){ const a=i*TAU/9+0.3+Math.sin(t*0.7+i)*0.05; const L=r*1.9+Math.sin(t*1.3+i*2)*6; g.beginPath(); g.moveTo(Math.cos(a)*r*0.7,Math.sin(a)*r*0.35); g.quadraticCurveTo(Math.cos(a+0.25)*r*1.3,Math.sin(a+0.25)*r*0.7,Math.cos(a)*L,Math.sin(a)*L*0.55); g.stroke(); }
  g.strokeStyle='rgba(200,80,120,0.35)'; g.lineWidth=2.5;
  for(let i=0;i<9;i++){ const a=i*TAU/9+0.3; const L=r*1.9; g.beginPath(); g.moveTo(Math.cos(a)*r*0.7,Math.sin(a)*r*0.35); g.quadraticCurveTo(Math.cos(a+0.25)*r*1.3,Math.sin(a+0.25)*r*0.7,Math.cos(a)*L,Math.sin(a)*L*0.55); g.stroke(); }
  // 鞭の予兆: 彼女の方へ根が伸びる
  if(e.whipT>0){ const k=1-e.whipT/0.6; g.strokeStyle='rgba(255,120,170,'+(0.5+0.4*k)+')'; g.lineWidth=5+3*k; g.beginPath(); g.moveTo(0,0); g.lineTo(Math.cos(e.lookA||0)*r*(1.2+2.2*k),Math.sin(e.lookA||0)*r*(1.2+2.2*k)*0.8); g.stroke(); }
  // 本体
  g.save(); g.translate(0,-r*0.25); g.scale(beat,beat);
  const grad=g.createRadialGradient(-r*0.25,-r*0.3,r*0.15,0,0,r*1.05); grad.addColorStop(0,'#c2456f'); grad.addColorStop(0.55,'#7a1f44'); grad.addColorStop(1,'#3a0b20');
  g.fillStyle=grad; g.beginPath(); g.ellipse(0,0,r,r*0.86,0,0,TAU); g.fill();
  for(let i=0;i<5;i++){ const a=i*1.3+0.4; g.fillStyle='rgba(180,60,100,0.55)'; g.beginPath(); g.ellipse(Math.cos(a)*r*0.5,Math.sin(a)*r*0.42,r*0.34,r*0.26,a,0,TAU); g.fill(); }
  g.strokeStyle='rgba(255,110,160,'+(0.35+(e.pulseT>0?0.4:0))+')'; g.lineWidth=2.2;
  for(let i=0;i<6;i++){ const a=i*TAU/6+t*0.1; g.beginPath(); g.moveTo(Math.cos(a)*r*0.25,Math.sin(a)*r*0.22); g.bezierCurveTo(Math.cos(a+0.4)*r*0.55,Math.sin(a+0.4)*r*0.5,Math.cos(a-0.2)*r*0.8,Math.sin(a-0.2)*r*0.7,Math.cos(a)*r*0.98,Math.sin(a)*r*0.84); g.stroke(); }
  g.fillStyle='rgba(255,220,235,0.28)'; g.beginPath(); g.ellipse(-r*0.3,-r*0.4,r*0.32,r*0.16,-0.5,0,TAU); g.fill();
  // 縦に裂けた目(彼女を見る)
  const la=e.lookA||0, ex=Math.cos(la)*r*0.12, ey=Math.sin(la)*r*0.08;
  g.fillStyle='#1a0510'; g.beginPath(); g.ellipse(0,0,r*0.16,r*0.42,0,0,TAU); g.fill();
  g.fillStyle='#ff5d9a'; g.beginPath(); g.ellipse(ex,ey,r*0.07,r*0.3,0,0,TAU); g.fill();
  g.fillStyle='#fff'; g.beginPath(); g.ellipse(ex-r*0.02,ey-r*0.12,r*0.025,r*0.06,0,0,TAU); g.fill();
  g.restore();
  g.restore();
}
function drawBoss(g,e){
  const r=e.r;
  const glow=g.createRadialGradient(0,-r*0.8,r*0.3,0,-r*0.8,r*2.1);
  glow.addColorStop(0,'rgba(190,60,110,0.24)');
  glow.addColorStop(1,'rgba(190,60,110,0)');
  g.fillStyle=glow;
  g.beginPath(); g.arc(0,-r*0.8,r*2.1,0,TAU); g.fill();
  drawBat(g,{...e,r:r},1,'#5b3fb8','#3c2a86');
  g.fillStyle='#ffd76a';
  g.beginPath();
  g.moveTo(-r*0.5,-r*1.62);
  g.lineTo(-r*0.42,-r*2.0); g.lineTo(-r*0.2,-r*1.7);
  g.lineTo(0,-r*2.1); g.lineTo(r*0.2,-r*1.7);
  g.lineTo(r*0.42,-r*2.0); g.lineTo(r*0.5,-r*1.62);
  g.closePath(); g.fill();
  if(e.bstate==='tele'){
    g.globalAlpha=0.5+0.5*Math.sin(e.t*30);
    g.strokeStyle='#ff5d6e'; g.lineWidth=3;
    g.beginPath(); g.arc(0,-r*0.8,r*1.25,0,TAU); g.stroke();
    g.globalAlpha=1;
  }
}

/* ---------------- 吹き出し/バナー ---------------- */
function drawBubbleAt(g,x,y,txt,tLeft){
  if(tLeft<=0||!txt) return;
  const a=clamp(tLeft/0.3,0,1);
  g.save();
  g.globalAlpha=a;
  const pop=clamp((1.7-tLeft)*10,0,1);
  const ty=y-60-pop*4;
  g.font='bold 11px '+FONT;
  const w2=g.measureText(txt).width+18;
  rr(g,x-w2/2,ty-11,w2,21,10);
  g.fillStyle='rgba(255,255,255,0.95)'; g.fill();
  g.strokeStyle='#ffb3cf'; g.lineWidth=1.5; g.stroke();
  g.beginPath();
  g.moveTo(x-4,ty+9.5); g.lineTo(x,ty+16); g.lineTo(x+4,ty+9.5);
  g.closePath();
  g.fillStyle='rgba(255,255,255,0.95)'; g.fill();
  g.fillStyle='#5a4a66'; g.textAlign='center'; g.textBaseline='middle';
  g.fillText(txt,x,ty+0.5);
  g.restore();
}
function drawBanner(g){
  const b=G.banner; if(!b) return;
  const inA=clamp(b.t*4,0,1), outA=clamp((b.dur-b.t)*3,0,1);
  const a=Math.min(inA,outA);
  const pop=1+Math.max(0,0.25-b.t)*2.2;
  g.save();
  g.globalAlpha=a;
  g.translate(W/2,148); g.scale(pop,pop);
  g.textAlign='center'; g.textBaseline='middle';
  g.font='bold 28px '+FONT;
  g.shadowColor='rgba(0,0,0,0.8)'; g.shadowBlur=8;
  g.fillStyle=b.color;
  g.fillText(b.text,0,0);
  if(b.sub){
    g.font='bold 13px '+FONT; g.fillStyle='#ffffff';
    g.fillText(b.sub,0,26);
  }
  g.restore();
}
/* えっちシーンのカットインCG(assets/cg/ に画像を置くと表示される):
   押し倒し: pin_<id>.png → pin.png / 魅了拘束: charmbind_<id>.png → charmbind.png /
   絶頂: climax.png。無ければ何も出さない */
const CG_CACHE={};
function getCG(names){
  for(const n of names){
    const k='assets/cg/'+n;
    if(CG_CACHE[k]===undefined){
      CG_CACHE[k]='loading';
      const im=new Image();
      im.onload=()=>{ CG_CACHE[k]=im; };
      im.onerror=()=>{ CG_CACHE[k]=null; };
      im.src=k;
    }
    const v=CG_CACHE[k];
    if(v && v!=='loading') return v;
  }
  return null;
}
function drawCutin(g){
  const B=G.B; if(!B) return;
  const h=B.hero;
  let im=null;
  if(h.pinned){ const id=h.pinBy?h.pinBy.id:'default'; im=getCG(['pin_'+id+'.png','pin.png']); }
  else if(h.charmBind){ im=getCG(['charmbind_'+h.charmBind.mon.id+'.png','charmbind.png']); }
  else if(h.climaxT>0){ im=getCG(['climax.png']); }
  if(!im) return;
  const pw=168, ph=Math.min(232, pw*im.height/im.width);
  const px=W-pw-14, py=H/2-ph/2-20;
  g.save();
  g.globalAlpha=0.96;
  rr(g,px-5,py-5,pw+10,ph+10,10);
  g.fillStyle='rgba(14,10,28,0.85)'; g.fill();
  g.strokeStyle='rgba(255,110,150,0.6)'; g.lineWidth=1.4; g.stroke();
  g.imageSmoothingEnabled=false;
  g.drawImage(im,px,py,pw,ph);
  g.restore();
}
function drawPinScene(g){
  const B=G.B;
  if(!B||!(B.hero.pinned||B.hero.charmBind||B.hero.climaxT>0)||!B.pinScene||!B.pinScene.beats||!B.pinScene.beats.length) return;
  const beat=B.pinScene.beats[B.pinSceneIdx % B.pinScene.beats.length];
  g.save();
  const w2=Math.min(640,W-80);
  const bc=(typeof barCover==='number'?barCover:0);
  const by=bc>H*0.3 ? 104 : H-26-bc-44;   // 重なる戦闘バーの上。バーが高い(小さい窓)なら彼女に被せず上へ。縦持ち(bc=0)は下端近く
  rr(g,W/2-w2/2,by,w2,44,10);
  g.fillStyle='rgba(14,10,28,0.82)'; g.fill();
  g.strokeStyle='rgba(255,110,150,0.5)'; g.lineWidth=1.2; g.stroke();
  g.fillStyle='#e8d8ea'; g.font='12px '+FONT;
  g.textAlign='center'; g.textBaseline='middle';
  g.fillText(beat, W/2, by+22);
  g.restore();
}

/* ---------------- HUD ---------------- */
function drawHUD(g){
  const B=G.B, p=B.hero;
  // XPバー(ヒロインの成長=脅威度)
  g.fillStyle='rgba(255,255,255,0.10)'; g.fillRect(0,0,W,7);
  const xg=g.createLinearGradient(0,0,W,0);
  xg.addColorStop(0,'#57c7ff'); xg.addColorStop(1,'#3b82f6');
  g.fillStyle=xg;
  g.fillRect(0,0,W*clamp(p.xp/p.xpNeed,0,1),7);
  // Lvバッジ
  rr(g,10,14,62,24,12);
  g.fillStyle='rgba(20,24,50,0.78)'; g.fill();
  g.strokeStyle='rgba(255,215,106,0.7)'; g.lineWidth=1.4; g.stroke();
  g.fillStyle='#ffd76a'; g.font='bold 13px '+FONT;
  g.textAlign='center'; g.textBaseline='middle';
  g.fillText('Lv '+p.level,41,26.5);
  // HPバー
  rr(g,82,14,150,11,6);
  g.fillStyle='rgba(20,24,50,0.78)'; g.fill();
  const hr=clamp(p.hp/p.maxHp,0,1);
  if(hr>0){
    rr(g,82,14,150*hr,11,6);
    g.fillStyle=hr>0.35?'#ff5d7a':'#ff9c2e'; g.fill();
  }
  rr(g,82,14,150,11,6);
  g.strokeStyle='rgba(255,255,255,0.35)'; g.lineWidth=1.2; g.stroke();
  g.fillStyle='#ffffff'; g.font='bold 9px '+FONT; g.textAlign='left';
  g.fillText('HP '+Math.ceil(p.hp)+'/'+p.maxHp, 240, 19.5);
  // スタミナバー
  rr(g,82,28,150,8,4);
  g.fillStyle='rgba(20,24,50,0.78)'; g.fill();
  const sr=clamp(p.stamina/p.staminaMax,0,1);
  if(sr>0){
    rr(g,82,28,150*sr,8,4);
    g.fillStyle=sr>0.3?'#ffd76a':'#ff7a4a'; g.fill();
  }
  rr(g,82,28,150,8,4);
  g.strokeStyle='rgba(255,255,255,0.28)'; g.lineWidth=1; g.stroke();
  g.fillStyle='#ffe9b0'; g.font='bold 8px '+FONT;
  g.fillText('スタミナ '+Math.ceil(p.stamina), 240, 32.5);
  // 護り
  g.fillStyle='#8fd3ff'; g.font='bold 10px '+FONT;
  g.fillText('護り '+Math.max(0,p.armor-attachCount(p)), 330, 19.5);
  // タイマー
  g.textAlign='center';
  g.font='bold 24px '+FONT;
  g.fillStyle='#ffffff';
  g.shadowColor='rgba(0,0,0,0.6)'; g.shadowBlur=5;
  g.fillText(fmt(B.time), W/2, 26);
  g.shadowBlur=0;
  g.font='9px '+FONT; g.fillStyle='rgba(190,200,240,0.75)';
  { const F=B.floor||curFloor(); g.fillText('第'+F.depth+'層 '+F.name+' — '+(F.final?'魔核を討てば目的達成':(B.exitLocked?'封印石 '+Object.keys(B.seals||{}).length+'/3 で降り口が開く':'降り口に着けば次の階層へ')), W/2, 42); }
  // 右上
  g.textAlign='right'; g.font='bold 13px '+FONT; g.fillStyle='#ffd76a';
  g.fillText('被撃破 '+B.kills, W-16, 24);
  g.font='10px '+FONT; g.fillStyle='rgba(200,180,255,0.8)';
  g.fillText('第'+genNum(META.gen.idx)+'世代 / '+(META.run.day||1)+'日目'+((META.run.fails||0)>0?' / 連敗'+META.run.fails:''), W-16, 42);
  // 夜の深まり(彼女のLv連動の夜側強化)
  const nStat=Math.round(Math.min(BAL.NIGHT_STAT_CAP, BAL.NIGHT_STAT_LV*Math.max(0,p.level-1))*100);
  const nUnit=Math.min(BAL.NIGHT_UNIT_MAX, Math.floor(p.level/BAL.NIGHT_UNIT_LV));
  if(nStat>0||nUnit>0){
    g.fillStyle='rgba(196,140,255,0.9)'; g.font='bold 10px '+FONT;
    g.fillText('夜の深まり +'+nStat+'%'+(nUnit>0?' / +'+nUnit+'体':''), W-16, 58);
  }
  // ボスHP
  const boss=B.enemies.find(e=>e.boss);
  if(boss){
    g.textAlign='center'; g.font='bold 9px '+FONT; g.fillStyle='#ff8c9e';
    g.fillText(MONSTERS[boss.id].name, W/2, 56);
    rr(g,W/2-150,60,300,7,4);
    g.fillStyle='rgba(20,24,50,0.8)'; g.fill();
    const br=clamp(boss.hp/boss.maxHp,0,1);
    if(br>0){ rr(g,W/2-150,60,300*br,7,4); g.fillStyle='#e84a68'; g.fill(); }
    rr(g,W/2-150,60,300,7,4);
    g.strokeStyle='rgba(255,120,140,0.6)'; g.lineWidth=1; g.stroke();
  }
  // AI思考チップ
  g.font='bold 11px '+FONT;
  const label='AI思考: '+p.aiLabel;
  const cw=g.measureText(label).width+34;
  rr(g,10,48,cw,22,11);
  g.fillStyle='rgba(24,30,60,0.82)'; g.fill();
  g.strokeStyle='rgba(143,211,255,0.65)'; g.lineWidth=1.3; g.stroke();
  const pulse=0.55+0.45*Math.sin(performance.now()*0.006);
  g.fillStyle='rgba(143,211,255,'+pulse.toFixed(2)+')';
  g.beginPath(); g.arc(23,59,3.6,0,TAU); g.fill();
  g.fillStyle='#cfe7ff'; g.textAlign='left'; g.textBaseline='middle';
  g.fillText(label,32,59.5);
  // v1.8 目当てチップ: 彼女がいま向かっている先と方角(夜側が先回りして待ち伏せできるように)
  if(p.goal && G.mode==='battle'){
    const gl=p.goal, gx=gl.x-p.x, gy=gl.y-p.y, gd=Math.hypot(gx,gy);
    const gcol=gl.kind==='event'?((EVENT_DEF[gl.sub]&&EVENT_DEF[gl.sub].col)||'#ffd76a'):'#ffe9b0';
    const gtxt='目当て: '+goalName(gl)+(gd>60?'  '+dirName(gx,gy)+' '+Math.round(gd)+'px':'  ここ');
    const gw=g.measureText(gtxt).width+26;
    rr(g,10+cw+8,48,gw,22,11); g.fillStyle='rgba(40,30,20,0.82)'; g.fill(); g.strokeStyle=hexA(gcol,0.7); g.lineWidth=1.3; g.stroke();
    g.fillStyle=gcol; g.textAlign='left'; g.textBaseline='middle'; g.fillText(gtxt,10+cw+8+13,59.5);
    drawEdgeArrow(g,gl.x,gl.y,gcol,goalName(gl));
  }
  if(B.event && G.mode==='battle' && !(p.goal&&p.goal.kind==='event')) drawEdgeArrow(g,B.event.x,B.event.y,(EVENT_DEF[B.event.kind]&&EVENT_DEF[B.event.kind].col)||'#fff','光の柱');
  // 状態チップ
  let sx=10, sy=76;
  const chips=[];
  const atk=attachCount(p);
  if(p.climaxT>0) chips.push(['climax','絶頂!!']);
  if(p.pinned) chips.push(['pinned','押し倒し']);
  else if(p.charmBind) chips.push(['charmbind','魅了拘束']);
  else if(atk>0){
    const names=attachedSlots(p).map(sl=>LIMB_NAMES[sl]).join('・');
    chips.push(['bound','拘束 '+names]);
  }
  const sk=suckCount(p);
  if(sk>0) chips.push(['suck','吸い付き '+suckSlots(p).map(sl=>SUCK_NAMES[sl]).join('・')]);
  if(p.heatLv>0) chips.push(['heat','発情'+ROMANS[p.heatLv]+(p.waveDur>0?' 波!':'')+(p.heatLv<3&&p.heatG>0?' '+Math.round(p.heatG)+'%':'')]);
  else if((p.heatG||0)>=10) chips.push(['heatg','発情 '+Math.round(p.heatG)+'%']);
  if(p.aphro>=8) chips.push(['aphro','快感 '+Math.round(p.aphro)+'%']);
  const slv=sensLvOf(p);
  if(slv>0) chips.push(['sens','敏感'+ROMANS[slv]]);
  if(p.slow>0) chips.push(['slow','粘液']);
  for(const c of p.charms) chips.push(['charm','魅了'+ROMANS[c.lv]+' '+((MONSTERS[c.id]&&MONSTERS[c.id].name)||c.id)+(c.lv<3?' '+Math.round(c.g||0)+'%':'')]);
  if(p.exhausted) chips.push(['pinned','疲弊']);
  if(p.freezeT>0) chips.push(['freeze','時間停止 '+Math.ceil(p.freezeT)+'s']);
  if(p.denyT>0) chips.push(['deny','寸止め '+Math.ceil(p.denyT)+'s']);
  if(p.begT>0) chips.push(['beg','おねだり…']);
  const posN=attachedSlots(p).filter(sl=>p.limbs[sl].kind==='possess').length;
  if(posN>0) chips.push(['possess','憑依 '+attachedSlots(p).filter(sl=>p.limbs[sl].kind==='possess').map(sl=>LIMB_NAMES[sl]).join('・')]);
  if(p.numbT>0) chips.push(['numb','痺れ']);
  if(p.suitT>0) chips.push(['suit','触手服 '+Math.ceil(p.suitT)+'s']);
  if(p.crestLv>0) chips.push(['crest','淫紋'+ROMANS[p.crestLv]]);
  if(p.watchedT>0) chips.push(['watched','視姦']);
  if(p.hypnoLv>0) chips.push(['hypnolv','催眠'+ROMANS[p.hypnoLv]+(p.hypnoLv<3&&p.hypnoG>0?' '+Math.round(p.hypnoG)+'%':'')]);
  else if((p.hypnoG||0)>=10) chips.push(['hypnolv','催眠 '+Math.round(p.hypnoG)+'%']);
  if(p.selfT>0) chips.push(['self','自慰……']);
  if(p.inMusk) chips.push(['musk','雄臭'+((META.traits.musk||0)>0?ROMANS[META.traits.musk]:'')]);
  if(p.curse&&BOSS_CURSES[p.curse]) chips.push(['curse','呪い: '+BOSS_CURSES[p.curse].name]);
  g.font='bold 10px '+FONT;
  for(const [id,txt] of chips){
    const A=AILMENTS[id];
    const w2=g.measureText(A.icon+' '+txt).width+18;
    rr(g,sx,sy,w2,20,10);
    g.fillStyle='rgba(24,18,44,0.85)'; g.fill();
    g.strokeStyle=A.color; g.lineWidth=1.3; g.stroke();
    g.fillStyle=A.color; g.textAlign='left'; g.textBaseline='middle';
    g.fillText(A.icon+' '+txt, sx+9, sy+10.5);
    sx+=w2+6;
    if(sx>W-160){ sx=10; sy+=24; }
  }
  // デバッグ
  g.font='9px '+FONT; g.fillStyle='rgba(130,140,180,0.55)'; g.textAlign='left';
  drawMinimap(g);
  g.fillText('enemies:'+B.enemies.length+' fps:'+Math.round(G.fps)+(TS>1?' x'+TS:''), 12, H-6);
  g.textAlign='right'; g.fillStyle='rgba(255,255,255,0.3)'; g.font='bold 10px '+FONT;
  g.fillText('v2.0 深淵', W-12, H-6);
}
function drawCards(g){
  const B=G.B, c=B.lvCards; if(!c) return;
  g.fillStyle='rgba(8,10,20,0.6)'; g.fillRect(0,0,W,H);
  g.textAlign='center'; g.textBaseline='middle';
  g.font='bold 20px '+FONT; g.fillStyle='#ffd76a';
  g.shadowColor='rgba(0,0,0,0.7)'; g.shadowBlur=6;
  g.fillText('LEVEL UP! — ルミナのAIが選んでいます…', W/2, 92);
  g.shadowBlur=0;
  const cw=168, ch=186;
  c.opts.forEach((k,i)=>{
    const chosen=c.revealed&&i===c.pick;
    const isEvo=k.startsWith('EVO:');
    const def=isEvo?EVOS[k.slice(4)]:UPG[k];
    const px=W/2+(i-1)*196-cw/2;
    const py=H/2-ch/2+ (chosen? -8-Math.abs(Math.sin(c.t*7))*4 : 0);
    g.save();
    rr(g,px,py,cw,ch,14);
    g.fillStyle=isEvo?'rgba(40,26,60,0.97)':'rgba(20,24,46,0.96)'; g.fill();
    if(chosen){ g.shadowColor='#ffd76a'; g.shadowBlur=16; }
    g.strokeStyle=chosen?'#ffd76a':(isEvo?'rgba(220,160,255,0.8)':'rgba(140,164,255,0.55)');
    g.lineWidth=chosen?3:1.6; g.stroke();
    g.shadowBlur=0;
    drawUpgIcon(g,k,px+cw/2,py+50);
    g.textAlign='center';
    g.fillStyle='#ffffff'; g.font='bold 13px '+FONT;
    g.fillText(def.name,px+cw/2,py+92);
    if(isEvo){
      g.fillStyle='#e8b0ff'; g.font='bold 11px '+FONT;
      g.fillText('★ 融合進化',px+cw/2,py+112);
    }else{
      const lv=curLv(k);
      g.fillStyle='#8fd3ff'; g.font='bold 11px '+FONT;
      g.fillText(lv===0?'NEW!':'Lv'+lv+' → Lv'+(lv+1),px+cw/2,py+112);
    }
    g.fillStyle='rgba(190,198,235,0.9)'; g.font='11px '+FONT;
    g.fillText(def.d1,px+cw/2,py+136);
    g.fillText(def.d2,px+cw/2,py+152);
    if(chosen){
      g.fillStyle='#ffd76a'; g.font='bold 12px '+FONT;
      g.fillText('▼ これにする!',px+cw/2,py+172);
    }
    g.restore();
  });
}
function drawUpgIcon(g,k,x,y){
  g.save(); g.translate(x,y);
  const id=k.startsWith('EVO:')?k.slice(4):k;
  if(id==='bolt'||id==='sstar'){
    g.shadowColor='#ffd76a'; g.shadowBlur=10;
    g.fillStyle=id==='sstar'?'#ffe9a8':'#ffd76a'; star(g,0,0,13,5.5,id==='sstar'?5:4,-Math.PI/2); g.fill();
  }else if(id==='orb'||id==='sring'){
    g.shadowColor='#fff3c4'; g.shadowBlur=12;
    g.fillStyle='#fff3c4'; g.beginPath(); g.arc(0,0,10,0,TAU); g.fill();
    g.shadowBlur=0;
    g.strokeStyle='rgba(255,215,106,0.8)'; g.lineWidth=1.6;
    g.beginPath(); g.ellipse(0,0,16,6,-0.5,0,TAU); g.stroke();
    if(id==='sring'){ g.strokeStyle='#ff9db4'; g.beginPath(); g.ellipse(0,0,19,8,0.6,0,TAU); g.stroke(); }
  }else if(id==='nova'||id==='sburst'){
    g.strokeStyle='#8fd3ff'; g.lineWidth=3;
    g.shadowColor='#8fd3ff'; g.shadowBlur=8;
    g.beginPath(); g.arc(0,0,8,0,TAU); g.stroke();
    g.globalAlpha=0.55; g.beginPath(); g.arc(0,0,14,0,TAU); g.stroke();
    if(id==='sburst'){ g.globalAlpha=0.35; g.beginPath(); g.arc(0,0,19,0,TAU); g.stroke(); }
  }else if(id==='speed'){
    g.strokeStyle='#8fd3ff'; g.lineWidth=4; g.lineCap='round'; g.lineJoin='round';
    for(const o of [-6,4]){
      g.beginPath(); g.moveTo(o-4,-9); g.lineTo(o+5,0); g.lineTo(o-4,9); g.stroke();
    }
  }else if(id==='vital'){
    g.shadowColor='#ff6b81'; g.shadowBlur=8;
    g.fillStyle='#ff7d95'; heartPath(g,0,0,2.6); g.fill();
  }else if(id==='magnet'){
    g.strokeStyle='#ff5d6e'; g.lineWidth=6; g.lineCap='butt';
    g.beginPath(); g.arc(0,-2,9,Math.PI,0,false); g.stroke();
    g.strokeStyle='#e9e6fa'; g.lineWidth=6;
    g.beginPath(); g.moveTo(-12,-2); g.lineTo(-12,4); g.stroke();
    g.beginPath(); g.moveTo(12,-2); g.lineTo(12,4); g.stroke();
  }else if(id==='whip'||id==='srush'){
    g.strokeStyle=id==='srush'?'#ffb3cf':'#ffe3f0'; g.lineWidth=4; g.lineCap='round';
    g.shadowColor='#ff9ec2'; g.shadowBlur=8;
    g.beginPath(); g.moveTo(-12,8);
    g.quadraticCurveTo(-2,-14, 12,-6);
    g.stroke();
    if(id==='srush'){ g.globalAlpha=0.5; g.beginPath(); g.arc(0,0,14,0,TAU); g.stroke(); }
  }else if(id==='rain'||id==='scomet'){
    g.shadowColor='#8fd3ff'; g.shadowBlur=8;
    for(const [ox,oy,r0] of (id==='scomet'?[[-8,-2,4],[4,-8,5.5],[9,6,3.5]]:[[-6,-4,4],[7,3,5]])){
      g.strokeStyle='rgba(143,211,255,0.5)'; g.lineWidth=1.8;
      g.beginPath(); g.moveTo(ox,oy-12); g.lineTo(ox,oy-4); g.stroke();
      g.fillStyle='#e8f4ff';
      star(g,ox,oy,r0+1.5,r0*0.45,4,0.4); g.fill();
    }
  }else if(id==='cross'||id==='sjudge'){
    g.shadowColor='#fff3c4'; g.shadowBlur=9;
    g.strokeStyle='#fff6d8'; g.lineWidth=id==='sjudge'?6:4.5; g.lineCap='round';
    const L=id==='sjudge'?13:10;
    g.beginPath(); g.moveTo(-L,0); g.lineTo(L,0); g.stroke();
    g.beginPath(); g.moveTo(0,-L); g.lineTo(0,L); g.stroke();
  }else if(id==='haste'){
    g.strokeStyle='#ffb3cf'; g.lineWidth=3.4; g.lineCap='round';
    g.beginPath(); g.moveTo(-10,-6); g.quadraticCurveTo(0,-12,10,-6); g.stroke();
    g.beginPath(); g.moveTo(-10,2); g.quadraticCurveTo(0,-4,10,2); g.stroke();
    g.beginPath(); g.moveTo(-10,10); g.quadraticCurveTo(0,4,10,10); g.stroke();
  }else if(id==='ward'){
    g.fillStyle='rgba(143,211,255,0.25)';
    g.strokeStyle='#8fd3ff'; g.lineWidth=2.6; g.lineJoin='round';
    g.beginPath();
    g.moveTo(0,-12); g.lineTo(10,-7); g.lineTo(10,3);
    g.quadraticCurveTo(10,10,0,13);
    g.quadraticCurveTo(-10,10,-10,3);
    g.lineTo(-10,-7); g.closePath();
    g.fill(); g.stroke();
  }else if(id==='growth'){
    g.shadowColor='#7ee89a'; g.shadowBlur=8;
    g.fillStyle='#8fd3ff';
    g.save(); g.rotate(Math.PI/4);
    g.fillRect(-5,-5,10,10);
    g.restore();
    g.strokeStyle='#7ee89a'; g.lineWidth=2.4; g.lineCap='round';
    g.beginPath(); g.moveTo(6,-6); g.lineTo(12,-12); g.stroke();
    g.beginPath(); g.moveTo(12,-12); g.lineTo(7,-12); g.stroke();
    g.beginPath(); g.moveTo(12,-12); g.lineTo(12,-7); g.stroke();
  }else if(id==='sanct'||id==='gsanct'){
    // せいいき: 光の輪の中心に灯
    g.shadowColor='#ffd76a'; g.shadowBlur=10;
    g.strokeStyle=id==='gsanct'?'#ffd6e6':'#fff0c0'; g.lineWidth=2.4;
    g.beginPath(); g.arc(0,0,13,0,TAU); g.stroke();
    if(id==='gsanct'){ g.globalAlpha=0.5; g.beginPath(); g.arc(0,0,17,0,TAU); g.stroke(); g.globalAlpha=1; }
    g.fillStyle='#fff6d8'; g.beginPath(); g.arc(0,0,4.5,0,TAU); g.fill();
    g.strokeStyle='rgba(255,215,106,0.7)'; g.lineWidth=1.4;
    for(let i=0;i<6;i++){ const a=i*Math.PI/3; g.beginPath(); g.moveTo(Math.cos(a)*6.5,Math.sin(a)*6.5); g.lineTo(Math.cos(a)*10,Math.sin(a)*10); g.stroke(); }
  }else if(id==='blade'||id==='kblade'){
    // ひかりの刃: 細長い光の刃
    g.shadowColor='#8fd3ff'; g.shadowBlur=10;
    const drawB=(rot)=>{ g.save(); g.rotate(rot); g.fillStyle=id==='kblade'?'#ffe3ef':'#e8f4ff';
      g.beginPath(); g.moveTo(-15,0); g.lineTo(0,-4); g.lineTo(15,0); g.lineTo(0,4); g.closePath(); g.fill(); g.restore(); };
    drawB(-0.6);
    if(id==='kblade') drawB(0.6);
  }else if(id==='thunder'||id==='judgment'){
    // てんらい: 稲光
    g.shadowColor='#ffd76a'; g.shadowBlur=12;
    g.fillStyle=id==='judgment'?'#fff6d8':'#ffe9a8';
    g.beginPath(); g.moveTo(3,-15); g.lineTo(-6,1); g.lineTo(0,1); g.lineTo(-3,15); g.lineTo(7,-3); g.lineTo(1,-3); g.closePath(); g.fill();
    if(id==='judgment'){ g.globalAlpha=0.6; g.save(); g.translate(9,-4); g.scale(0.6,0.6);
      g.beginPath(); g.moveTo(3,-15); g.lineTo(-6,1); g.lineTo(0,1); g.lineTo(-3,15); g.lineTo(7,-3); g.lineTo(1,-3); g.closePath(); g.fill(); g.restore(); g.globalAlpha=1; }
  }else if(id==='holy'||id==='spring'){
    // せいすい: 聖水の滴と波紋
    g.shadowColor='#8fd3ff'; g.shadowBlur=10;
    g.fillStyle=id==='spring'?'#e8f4ff':'#bfe6ff';
    g.beginPath(); g.moveTo(0,-14); g.quadraticCurveTo(9,-2,7,4); g.arc(0,4,7,0,Math.PI); g.quadraticCurveTo(-9,-2,0,-14); g.fill();
    g.shadowBlur=0;
    g.strokeStyle='rgba(143,211,255,0.8)'; g.lineWidth=1.6;
    g.beginPath(); g.ellipse(0,12,12,3.5,0,0,TAU); g.stroke();
    if(id==='spring'){ g.globalAlpha=0.5; g.beginPath(); g.ellipse(0,12,16,5,0,0,TAU); g.stroke(); g.globalAlpha=1; }
  }else if(id==='area'){
    // ひろがるろうそく: 大きな炎と広がる弧
    g.fillStyle='#e8d8c8'; g.fillRect(-3,0,6,13);
    g.shadowColor='#ffb347'; g.shadowBlur=12;
    g.fillStyle='#ffb347';
    g.beginPath(); g.moveTo(0,-14); g.quadraticCurveTo(8,-4,0,2); g.quadraticCurveTo(-8,-4,0,-14); g.fill();
    g.fillStyle='#fff6d8'; g.beginPath(); g.ellipse(0,-4,2.2,4,0,0,TAU); g.fill();
    g.shadowBlur=0;
    g.strokeStyle='rgba(255,179,71,0.7)'; g.lineWidth=1.5;
    g.beginPath(); g.arc(0,-4,12,Math.PI*1.15,Math.PI*1.85); g.stroke();
    g.beginPath(); g.arc(0,-4,16,Math.PI*1.2,Math.PI*1.8); g.stroke();
  }else if(id==='dup'){
    // ふたごの鏡: 重なる二枚の鏡
    for(const [ox,oy] of [[-5,3],[4,-4]]){
      g.fillStyle='rgba(200,230,255,0.85)'; g.strokeStyle='#ffd76a'; g.lineWidth=1.6;
      rr(g,ox-6,oy-9,12,18,3); g.fill(); g.stroke();
      g.strokeStyle='rgba(255,255,255,0.9)'; g.lineWidth=1.2;
      g.beginPath(); g.moveTo(ox-3,oy+5); g.lineTo(ox+3,oy-5); g.stroke();
    }
  }else if(id==='luck'){
    // よつばのクローバー
    g.shadowColor='#7ee89a'; g.shadowBlur=8;
    g.fillStyle='#6fd68a';
    for(let i=0;i<4;i++){ const a=i*Math.PI/2; heartPath(g,Math.cos(a)*5.5,Math.sin(a)*5.5-1,0.9); g.fill(); }
    g.shadowBlur=0;
    g.strokeStyle='#3f9a5a'; g.lineWidth=1.6; g.lineCap='round';
    g.beginPath(); g.moveTo(1,4); g.quadraticCurveTo(3,10,6,14); g.stroke();
  }else if(id==='endure'){
    // ねばりのリボン: 蝶結び
    g.shadowColor='#ff9ec2'; g.shadowBlur=8;
    g.fillStyle='#ff86b3';
    g.beginPath(); g.ellipse(-8,-2,7,4.5,-0.35,0,TAU); g.fill();
    g.beginPath(); g.ellipse(8,-2,7,4.5,0.35,0,TAU); g.fill();
    g.fillStyle='#ffb3cf';
    g.beginPath(); g.moveTo(-2,2); g.lineTo(-7,13); g.lineTo(-1,10); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(2,2); g.lineTo(7,13); g.lineTo(1,10); g.closePath(); g.fill();
    g.fillStyle='#ff5d9e'; g.beginPath(); g.arc(0,-2,3.2,0,TAU); g.fill();
  }
  g.restore();
}

/* ---------------- メイン描画 ---------------- */
let vignette=null;
function makeVignette(){
  vignette=document.createElement('canvas');
  vignette.width=W; vignette.height=H;
  const vg=vignette.getContext('2d');
  const grad=vg.createRadialGradient(W/2,H/2,H*0.42,W/2,H/2,H*0.85);
  grad.addColorStop(0,'rgba(6,8,18,0)');
  grad.addColorStop(1,'rgba(6,8,18,0.55)');
  vg.fillStyle=grad; vg.fillRect(0,0,W,H);
}
makeVignette();

function draw(){
  const g=ctx;
  g.setTransform(dpr*viewScale,0,0,dpr*viewScale,0,0);
  g.fillStyle='#151830'; g.fillRect(0,0,W,H);
  thrashGuard(); BAKE_N=0; FRAME_N++; fpsGuard(); prebakeStep();

  const inBattle=['battle','levelup','captured','survived','result'].includes(G.mode) && G.B;
  const sx=G.shake>0?rand(-G.shake,G.shake):0;
  const sy=G.shake>0?rand(-G.shake,G.shake):0;

  g.save();
  g.translate(W/2-G.cam.x+sx, H/2-G.cam.y+sy);
  drawTiles(g);
  if(G.map&&G.B) for(const q of G.map.pois) drawPoi(g,q);

  if(inBattle){
    const B=G.B, p=B.hero;
    drawLight(g,p.x,p.y);
    for(const st of B.stains) drawStain(g,st);
    for(const tr of B.trails) drawTrail(g,tr);
    for(const c of B.clouds) drawCloud(g,c);
    for(const z of B.zones) drawZone(g,z);
    for(const s of B.spawnFx) drawSummonFx(g,s);
    for(const pr of B.props) drawProp(g,pr);
    for(const gm of B.gems) drawGem(g,gm);
    for(const h of B.hearts) drawHeartDrop(g,h);
    for(const tr of B.traps) drawTrap(g,tr);
    for(const c of B.chests){ if(c.bossChest){ glow(g,c.x,c.y-6,34,'255,215,106',0.35+0.15*Math.sin(c.t*4)); } drawChest(g,c); if(c.fake){ g.save(); g.globalAlpha=0.35; g.fillStyle='#c98cff'; g.beginPath(); g.ellipse(c.x,c.y+2,14,5,0,0,TAU); g.fill(); g.restore(); } }
    for(const it of B.items) drawItem(g,it);
    for(const pk of B.picks) drawPick(g,pk);                 // v1.8 地形の資源
    if(B.event) drawEventPillar(g,B.event);                  // v1.8 光の柱
    if(B.ebullets) for(const b of B.ebullets) drawRuneBolt(g,b);

    drawSightSectors(g,B);
    B.enemies.sort((a,b)=>a.y-b.y);
    const cvx=G.cam.x, cvy=G.cam.y;
    for(const e of B.enemies){
      if(e.state==='attached') continue;
      if(Math.abs(e.x-cvx)>W/2+80 || Math.abs(e.y-cvy)>H/2+100) continue;   // 画面外は描かない
      drawEnemy(g,e);
    }

    // せいいき(聖域): 彼女を中心にした光の輪。脈動の瞬間に明滅
    if(p.wp.sanct>0 && p.sanctR){
      const evo=p.evo.gsanct>0;
      const flash=p.sanctPulse<0.12?1-p.sanctPulse/0.12:0;
      g.save();
      g.globalAlpha=0.16+0.3*flash;
      const sg=g.createRadialGradient(p.x,p.y-8,p.sanctR*0.5,p.x,p.y-8,p.sanctR);
      sg.addColorStop(0,'rgba(255,240,200,0)'); sg.addColorStop(1,evo?'rgba(255,200,230,0.8)':'rgba(255,225,150,0.7)');
      g.fillStyle=sg;
      g.beginPath(); g.arc(p.x,p.y-8,p.sanctR,0,TAU); g.fill();
      g.globalAlpha=0.35+0.5*flash;
      g.strokeStyle=evo?'#ffd6e6':'#fff0c0'; g.lineWidth=evo?3:2;
      g.shadowColor='#ffd76a'; g.shadowBlur=8;
      g.beginPath(); g.arc(p.x,p.y-8,p.sanctR,0,TAU); g.stroke();
      g.restore();
    }
    // ノヴァ
    if(p.novaAnim>0){
      const pr2=(1-p.novaAnim/0.5);
      g.globalAlpha=(1-pr2)*0.8;
      g.strokeStyle='#fff3c4'; g.lineWidth=5;
      g.shadowColor='#ffd76a'; g.shadowBlur=14;
      g.beginPath(); g.arc(p.x,p.y-10,p.novaR*pr2,0,TAU); g.stroke();
      g.shadowBlur=0; g.globalAlpha=1;
    }
    // オーブ
    if(p.wp.orb>0){
      const evo=p.evo.sring>0;
      const R=(evo?70:56)+4*Math.max(1,p.wp.orb);
      g.strokeStyle='rgba(255,235,170,0.15)'; g.lineWidth=1;
      g.beginPath(); g.ellipse(p.x,p.y-10,R,R*0.9,0,0,TAU); g.stroke();
      for(let i=0;i<p.wp.orb;i++){
        const o=orbPos(i,p.wp.orb);
        g.shadowColor=evo?'#ffb3cf':'#ffe9a8'; g.shadowBlur=10;
        g.fillStyle=evo?'#ffe3ef':'#fff6d8';
        g.beginPath(); g.arc(o.x,o.y,evo?8:6,0,TAU); g.fill();
        g.shadowBlur=0;
      }
    }
    // ルミナ
    const heatVis=p.heatLv>0?100:p.aphro;
    const mood = (G.mode==='captured'||p.pinned||p.charmBind)?'pinned'
               : p.climaxT>0?'climax'
               : attachCount(p)>0?'bound'
               : G.mode==='survived'?'happy'
               : (G.hurtFlash>0.15?'hurt':'normal');
    const blinking = p.ifr>0 && G.mode==='battle' && (Math.floor(p.ifr*14)%2===0);
    if(blinking) g.globalAlpha=0.45;
    drawGirl(g,p.x,p.y,{t:p.anim,face:p.face,moving:p.moving&&G.mode==='battle',mood,heat:heatVis});
    g.globalAlpha=1;
    drawAttachments(g,p);
    drawSuckers(g,p);
    drawStateFx(g,p);
    if(G.mode==='battle'){
      if(p.pinned) drawPinGauge(g,p);
      else if(p.charmBind) drawCharmBindGauge(g,p);
      else if(restraintCount(p)>0) drawStruggleRing(g,p);
    }
    if(heatVis>=30) drawHeatFx(g,p.x,p.y,p.anim,heatVis);
    // 魅了の糸(種族ごとに、最寄りの個体へ。深いほど濃い)
    for(const c of p.charms){
      if(c.lv<=0) continue;   // ゲージが溜まりはじめただけの種族には糸を描かない
      let cm=null, cd=1e9;
      for(const e of B.enemies){
        if(e.dead||e.dormant||e.id!==c.id) continue;
        const d2=Math.hypot(e.x-p.x,e.y-p.y);
        if(d2<cd){ cd=d2; cm=e; }
      }
      if(!cm) continue;
      g.save();
      g.globalAlpha=(0.25+0.18*c.lv)+0.2*Math.sin(p.anim*6);
      g.strokeStyle='#ffb3cf'; g.lineWidth=1+0.4*c.lv; g.setLineDash([4,5]);
      g.beginPath(); g.moveTo(p.x,p.y-30); g.lineTo(cm.x,cm.y-cm.r); g.stroke();
      g.setLineDash([]);
      g.restore();
    }

    // ヒロインの弾
    for(const b of B.bullets){
      g.save();
      g.translate(b.x,b.y);
      if(b.kind==='rain'){
        // 落下する流れ星(縦の尾)
        g.strokeStyle='rgba(143,211,255,0.55)'; g.lineWidth=2; g.lineCap='round';
        g.beginPath(); g.moveTo(0,-26); g.lineTo(0,-6); g.stroke();
        g.shadowColor='#8fd3ff'; g.shadowBlur=9;
        g.fillStyle='#e8f4ff';
        star(g,0,0,b.evo?6.5:5,2.3,4,performance.now()*0.02);
        g.fill();
      }else if(b.kind==='blade'){
        // ひかりの刃: 細長い光の刃が直進する
        g.rotate(Math.atan2(b.vy,b.vx));
        g.shadowColor=b.evo?'#ffb3cf':'#8fd3ff'; g.shadowBlur=10;
        const L=b.evo?16:12;
        const bg=g.createLinearGradient(-L,0,L,0);
        bg.addColorStop(0,'rgba(255,255,255,0)'); bg.addColorStop(0.5,b.evo?'#ffe3ef':'#e8f4ff'); bg.addColorStop(1,'#fff');
        g.fillStyle=bg;
        g.beginPath(); g.moveTo(-L,0); g.lineTo(0,-3.2); g.lineTo(L,0); g.lineTo(0,3.2); g.closePath(); g.fill();
      }else if(b.kind==='cross'){
        // 高速回転する光の十字
        g.rotate(performance.now()*0.02);
        g.shadowColor='#fff3c4'; g.shadowBlur=10;
        g.strokeStyle=b.evo?'#ffe9a8':'#fff6d8'; g.lineWidth=b.evo?5:3.6; g.lineCap='round';
        const L=b.evo?13:9;
        g.beginPath(); g.moveTo(-L,0); g.lineTo(L,0); g.stroke();
        g.beginPath(); g.moveTo(0,-L); g.lineTo(0,L); g.stroke();
      }else{
        g.rotate(Math.atan2(b.vy,b.vx));
        g.strokeStyle=b.evo?'rgba(180,220,255,0.6)':'rgba(255,215,106,0.5)'; g.lineWidth=2; g.lineCap='round';
        g.beginPath(); g.moveTo(-12,0); g.lineTo(-3,0); g.stroke();
        g.shadowColor=b.evo?'#8fd3ff':'#ffd76a'; g.shadowBlur=9;
        g.fillStyle=b.evo?'#e8f4ff':'#fff6d8';
        star(g,0,0,5.5,2.3,b.evo?5:4,performance.now()*0.02);
        g.fill();
      }
      g.restore();
    }
    // 演出FX(てんらいの雷・女王の脈動)
    for(const f of B.fx) drawFx(g,f);
    // アイテム設置カーソル(選択中)
    if(G.armItem && G.mouse && G.mode==='battle') drawPlaceCursor(g,G.armItem,G.mouse.x,G.mouse.y);
    // プリズムウィップの薙ぎ(残像)
    if(p.whipAnim>0){
      const pr2=clamp(p.whipAnim/0.16,0,1);
      g.save();
      g.globalAlpha=pr2*0.75;
      g.strokeStyle='#ffe3f0'; g.lineWidth=5; g.lineCap='round';
      g.shadowColor='#ff9ec2'; g.shadowBlur=12;
      if(p.whipDir===0){
        g.beginPath(); g.arc(p.x,p.y-10,p.whipR*(1.05-pr2*0.25),0,TAU); g.stroke();
      }else{
        const sweep=(1-pr2)*1.9-0.95;
        g.beginPath();
        g.arc(p.x,p.y-10,p.whipR*0.92, p.whipDir>0?sweep-0.5:Math.PI+sweep-0.5, p.whipDir>0?sweep+0.5:Math.PI+sweep+0.5);
        g.stroke();
      }
      g.restore();
    }
  }else{
    // ロビー
    const L=G.lobby;
    if(L){
      drawLight(g,0,0);
      drawGirl(g,0,0,{t:L.anim,face:1,moving:false,mood:'normal',heat:0});
      drawBubbleAt(g,0,0-6,L.bubble,L.bubbleT);
    }
  }

  // パーティクル / フロート
  for(const q of G.parts){
    g.globalAlpha=clamp(1-q.t/q.life,0,1);
    g.fillStyle=q.c;
    g.beginPath(); g.arc(q.x,q.y,q.r,0,TAU); g.fill();
  }
  g.globalAlpha=1;
  for(const f of G.floats){
    g.globalAlpha=clamp(1-f.t/f.life,0,1);
    g.font='bold '+f.size+'px '+FONT;
    g.textAlign='center'; g.textBaseline='middle';
    g.strokeStyle='rgba(10,10,30,0.8)'; g.lineWidth=3;
    g.strokeText(f.txt,f.x,f.y);
    g.fillStyle=f.c;
    g.fillText(f.txt,f.x,f.y);
  }
  g.globalAlpha=1;
  if(inBattle){
    const p=G.B.hero;
    drawBubbleAt(g,p.x,p.y,p.bubble,p.bubbleT);
  }
  g.restore();

  g.drawImage(vignette,0,0,W,H);
  if(inBattle && G.B.whiteFlash>0){
    // 聖光の閃き(画面全消去)
    g.fillStyle='rgba(255,252,240,'+(clamp(G.B.whiteFlash/0.45,0,1)*0.85).toFixed(3)+')';
    g.fillRect(0,0,W,H);
  }
  if(G.hurtFlash>0){
    g.fillStyle='rgba(255,40,70,'+(G.hurtFlash*0.32).toFixed(3)+')';
    g.fillRect(0,0,W,H);
  }
  if(inBattle){
    const p=G.B.hero;
    const hv=p.heatLv>0?100:p.aphro;
    if(hv>=60){
      let a=(hv-60)/40*0.09;
      if(p.waveDur>0) a+=0.05+0.03*Math.sin(performance.now()*0.008);   // 波の間は明滅
      g.fillStyle='rgba(255,110,160,'+a.toFixed(3)+')';
      g.fillRect(0,0,W,H);
    }
  }
  if(G.mode==='captured'){
    const B=G.B;
    const pr=clamp(1-B.captureT/2.8,0,1);
    g.fillStyle='rgba(20,8,36,'+(pr*0.55).toFixed(3)+')';
    g.fillRect(0,0,W,H);
  }
  if(['battle','levelup','captured','survived'].includes(G.mode) && G.B) drawHUD(g);
  if(G.mode==='battle'){ drawCutin(g); drawPinScene(g); }
  if(G.mode==='levelup') drawCards(g);
  drawBanner(g);
}

/* ---------------- DOM用ミニアイコン ---------------- */
function makeIconCanvas(id,size){
  const c=document.createElement('canvas');
  const d=Math.min(3,Math.max(1,Math.round(dpr||1)));      // アイコンも端末の実ピクセルで描く
  c.width=size*d; c.height=size*d; c.style.width=c.style.height=size+'px';
  const g=c.getContext('2d');
  g.scale(d,d);
  const fake=fakeEnemy(id);
  g.translate(size/2, size*0.72);
  const sc=size/(MONSTERS[id].r*(MONSTERS[id].boss?4.6:3.4));
  g.scale(sc,sc);
  if(gfxHd()) drawEnemyShaded(g,fake,clamp(Math.ceil(sc*d),1,3)); else drawBody(g,fake);   // アイコンも同じ絵で(拡大率ぶん高く焼く)
  return c;
}
