'use strict';
/* ============================================================
   render.js — 描画: 世界 / ルミナ / モンスター / FX / HUD
============================================================ */

const EN_COLORS={
  /* v6.0 新しい種 */
  mirrorling:['#bcdcff','#7fa8d0'], glyphmite:['#ff8cbe','#8a2c66'], silkmite:['#ffc8dc','#c07a9c'],
  frostbud:['#d8f2ff','#8ec6e8'], stiller:['#b0a8d0','#6a628c'], lethemoth:['#e8e0e4','#b0a8b4'],
  gallery:['#e8e0e0','#ffb3cf'], echoer:['#c8c0b0','#8a8272'], bonesoldier:['#b9b2a4','#7a7466'],
  nichelord:['#ff8fb3','#7a2038'], seatflesh:['#ff7fa6','#7a2038'], heartroot:['#ff9ec2','#8a1a3c'],
  tallykeeper:['#b8b0c8','#3a3348'],
  mirrorqueen:['#cfe4ff','#2a4a6a'], nevermet:['#e8dce4','#a898a8'], firstslug:['#c8e07a','#7a9a3a'],
  slug:['#b8d86a','#7a9a3a'], ghost:['#dfe4ff','#aab4e8'],
  slime:['#8fe8c9','#3fae86'], worm:['#c9a06a','#7a5a3a'], imp:['#ff86b3','#b8548a'],
  gas:['#ff9ec2','#d86aa0'], flower:['#e86a9c','#8fe8c9'],
  mistslime:['#ffc2d8','#8fe8c9'], gtent:['#a06ac9','#5a3a7a'],
  vampi:['#c04a6a','#ffd76a','#fff'],
  goblin:['#8fd36a','#4a7a3a'], leech:['#ffb3a0','#d87a6a'],
  sentinel:['#9aa3c8','#5a6284'],
  coreling:['#ffc2d8','#a03a62'],   // v4.0 核の落とし子
  lurecap:['#9fe8c8','#c85682'], hugcap:['#f0e0bc','#b89468'],   // v4.1 きのこ
  miretent:['#e08ac0','#8a3a62'],   // v5.0 沼の触手
  yamiboss:['#a77dff','#2a1a3e','#e8d8ff'],   // v5.0 渦の眠り手
  tower:['#c98cff','#5a3a7a'],
  inyoku:['#f2a7c7','#c85a90'], suiyou:['#c8f0ff','#4696dc'],   // v2.0 淫翼・水妖
  mouth:['#c2456f','#8a3458'], guardian:['#62627e','#4a4a62'],  // v2.0 肉壁の口・遺跡の番人
  core:['#c2456f','#7a1f44','#3a0b20'],                          // v2.0 魔核
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
  const red=gem.v>=9;   // v4.0 赤ジェム: 黄より強い。巣窟の奥にまばらに落ちている
  const s=red?7.0:(gem.v>=4?5.5:4.2);
  const c=red?'#ff5d7a':(gem.v>=4?'#ffd76a':(gem.v>=2?'#7f9bff':'#6fd6ff'));
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
  if(c.fake && c.night && !c.taken) drawNightMark(g,c.x,c.y-30,'🎁');   // v2.2 偽りの宝箱の印(夜側だけが知っている)
  else if(c.lewd && !c.taken){ glow(g,c.x,c.y-6,26,'255,140,200',0.25+0.1*Math.sin(c.t*3)); }   // v2.2 えちえちエリアの報酬は桃色に光る
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
/* v4.0 魔核の跡: 本体が消えて根だけが残り、巻き上がって赤黒い渦になる(時間が巻き戻る合図) */
function drawCoreRoots(g,cr){
  const t=cr.t, r=cr.r, T1=BAL.LOOP_ROOT_T, T2=BAL.LOOP_WIND_T;
  const wind=Math.max(0,Math.min(1,(t-T1)/T2));           // 巻き上がり 0→1
  const vor=Math.max(0,Math.min(1,(t-T1-T2)/1.2));        // 渦 0→1
  const spin=t*(0.5+5.5*wind+9*vor);
  g.save(); g.translate(cr.x,cr.y);
  // 影
  g.fillStyle='rgba(12,2,8,'+(0.5+0.4*vor).toFixed(2)+')'; g.beginPath(); g.ellipse(0,r*0.3,r*(1.5+2.6*vor),r*(0.6+1.0*vor),0,0,TAU); g.fill();
  // 根: 巻き上がるほど中心へ寄り、渦では帯になる
  const n=14;
  for(let i=0;i<n;i++){
    const a0=i*TAU/n+0.2, a=a0+spin*(0.25+0.9*wind);
    const L=r*(2.1-1.0*wind+2.6*vor)*(1+0.12*Math.sin(t*2+i));
    const lift=-r*0.5*wind;
    g.strokeStyle=vor>0?'rgba(138,16,48,'+(0.5+0.4*vor).toFixed(2)+')':'rgba(58,11,32,0.85)';
    g.lineWidth=(7-2.5*wind)*(1+vor);
    g.lineCap='round';
    g.beginPath(); g.moveTo(Math.cos(a)*r*0.35, Math.sin(a)*r*0.2+lift);
    g.quadraticCurveTo(Math.cos(a+0.5+1.6*vor)*L*0.6, Math.sin(a+0.5+1.6*vor)*L*0.4+lift, Math.cos(a+1.1*vor)*L, Math.sin(a+1.1*vor)*L*0.62);
    g.stroke();
  }
  // 千切れた心臓の根株(渦になるまで残る)
  if(vor<1){
    g.globalAlpha=1-vor;
    g.fillStyle='#3a0b20'; g.beginPath(); g.ellipse(0,-r*0.1,r*(0.55-0.3*wind),r*(0.4-0.2*wind),0,0,TAU); g.fill();
    g.strokeStyle='rgba(194,69,111,0.5)'; g.lineWidth=2;
    g.beginPath(); g.ellipse(0,-r*0.1,r*(0.55-0.3*wind),r*(0.4-0.2*wind),0,0,TAU); g.stroke();
    g.globalAlpha=1;
  }
  // 赤黒い渦
  if(vor>0){
    const R=r*(1.4+5.2*vor);
    const gr=g.createRadialGradient(0,0,R*0.05,0,0,R);
    gr.addColorStop(0,'rgba(0,0,0,'+(0.9*vor).toFixed(2)+')');
    gr.addColorStop(0.35,'rgba(60,4,20,'+(0.72*vor).toFixed(2)+')');
    gr.addColorStop(0.7,'rgba(138,16,48,'+(0.42*vor).toFixed(2)+')');
    gr.addColorStop(1,'rgba(138,16,48,0)');
    g.fillStyle=gr; g.beginPath(); g.ellipse(0,0,R,R*0.72,0,0,TAU); g.fill();
    g.strokeStyle='rgba(255,46,106,'+(0.5*vor).toFixed(2)+')'; g.lineWidth=3;
    for(let k=0;k<5;k++){
      g.beginPath();
      for(let s=0;s<=28;s++){ const u=s/28, ang=spin*0.8+k*TAU/5+u*4.2, rr=R*(0.12+0.88*u);
        const px=Math.cos(ang)*rr, py=Math.sin(ang)*rr*0.72;
        if(s===0) g.moveTo(px,py); else g.lineTo(px,py); }
      g.stroke();
    }
  }
  g.restore();
}
/* v5.0 フレイラの炎のエリア: 身にまとった熱の輪。歩いた跡の床は、地形チップごと焦げて残る */
function drawDryAura(g,A){
  const B=G.B, p=B.heroes[A.hi]; if(!p||p.out) return;
  const t=B.time, k=Math.max(0,1-A.t/A.dur);
  g.save(); g.translate(p.x,p.y);
  const gr=g.createRadialGradient(0,0,A.r*0.15,0,0,A.r);
  gr.addColorStop(0,'rgba(255,140,60,'+(0.16*k).toFixed(3)+')');
  gr.addColorStop(0.6,'rgba(255,110,40,'+(0.10*k).toFixed(3)+')');
  gr.addColorStop(1,'rgba(255,90,30,0)');
  g.fillStyle=gr; g.beginPath(); g.ellipse(0,0,A.r,A.r*0.8,0,0,TAU); g.fill();
  g.strokeStyle='rgba(255,150,70,'+(0.35*k+0.15*Math.abs(Math.sin(t*4))).toFixed(3)+')'; g.lineWidth=2.6;
  g.beginPath(); g.ellipse(0,0,A.r*(0.97+0.03*Math.sin(t*3)),A.r*0.8*(0.97+0.03*Math.sin(t*3)),0,0,TAU); g.stroke();
  for(let i=0;i<7;i++){ const a=t*1.2+i*TAU/7, rr=A.r*(0.75+0.2*Math.sin(t*2+i));
    g.fillStyle='rgba(255,'+(150+((i*17)%60))+',70,'+(0.35*k).toFixed(2)+')';
    g.beginPath(); g.arc(Math.cos(a)*rr,Math.sin(a)*rr*0.8,2.2+1.6*Math.abs(Math.sin(t*3+i)),0,TAU); g.fill(); }
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
  const a=clamp(Math.min(z.t*3,(z.life-z.t)*1.2),0,1);
  /* v6.3 闇の刃の残り跡: 円ではなく、宙に浮いたままの一本の線 */
  if(z.seam){
    g.save(); g.lineCap='round';
    g.globalAlpha=a*0.34; g.strokeStyle='#2a1a3e'; g.lineWidth=z.r*0.9;
    g.beginPath(); g.moveTo(z.x,z.y); g.lineTo(z.x2,z.y2); g.stroke();
    g.globalAlpha=a*(0.45+0.30*Math.sin(z.t*7)); g.strokeStyle='#a77dff'; g.lineWidth=1.8;
    g.shadowColor='#a77dff'; g.shadowBlur=10;
    g.beginPath(); g.moveTo(z.x,z.y); g.lineTo(z.x2,z.y2); g.stroke();
    g.restore();
    return;
  }
  // きよめの泉/せいすい: 聖水の水面。波紋が広がる
  g.save();
  g.globalAlpha=a*0.55;
  const zg=g.createRadialGradient(z.x,z.y,z.r*0.2,z.x,z.y,z.r);
  zg.addColorStop(0,z.fire?'rgba(255,170,90,0.6)':(z.ice?'rgba(190,235,255,0.62)':(z.evo?'rgba(200,240,255,0.55)':'rgba(160,220,255,0.45)')));   // v3.0 火柱は炎の色 / v5.0 霜の華は氷の色
  zg.addColorStop(1,z.fire?'rgba(255,110,40,0.08)':(z.ice?'rgba(120,190,255,0.06)':'rgba(120,180,255,0.05)'));
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
  }else if(f.kind==='chain'){
    // 聖鎖: 一瞬走る光の鎖(環の列)
    g.globalAlpha=(1-pr)*0.95;
    g.strokeStyle=f.evo?'#ffe9a8':'#ffd76a'; g.lineWidth=2.2; g.shadowColor='#ffd76a'; g.shadowBlur=8;
    const L=Math.hypot(f.x2-f.x,f.y2-f.y)||1, ux=(f.x2-f.x)/L, uy=(f.y2-f.y)/L, n=Math.max(2,Math.floor(L/9));
    g.beginPath(); g.moveTo(f.x,f.y); g.lineTo(f.x2,f.y2); g.stroke();
    for(let i=0;i<=n;i++){ const x=f.x+ux*L*i/n, y=f.y+uy*L*i/n; g.beginPath(); g.ellipse(x,y,3.2,2,Math.atan2(uy,ux)+(i%2?0.5:-0.5),0,TAU); g.stroke(); }
  }else if(f.kind==='denbeam'){   // v3.2 撃たれた光線: 太い芯と広がる残光
    const pr=f.t/f.life, a=1-pr;
    g.save(); g.globalAlpha=a*0.9; g.strokeStyle=f.col; g.lineCap='round';
    g.lineWidth=BAL.DEN_BEAM_W*0.7*(1-pr*0.5); g.globalAlpha=a*0.35;
    g.beginPath(); g.moveTo(f.x,f.y); g.lineTo(f.x+Math.cos(f.ang)*f.len, f.y+Math.sin(f.ang)*f.len); g.stroke();
    g.lineWidth=4*(1-pr*0.4); g.globalAlpha=a; g.strokeStyle='#fff';
    g.beginPath(); g.moveTo(f.x,f.y); g.lineTo(f.x+Math.cos(f.ang)*f.len, f.y+Math.sin(f.ang)*f.len); g.stroke();
    g.restore();
  }else if(f.kind==='ringpuff'){   // v4.1 菌輪: 輪の全部から一斉に噴く
    const a=1-pr;
    g.globalAlpha=a*0.5; g.fillStyle='#e8d0f0';
    for(let i=0;i<10;i++){ const th=i*TAU/10+0.15, rr=f.r*(1+0.5*pr);
      g.beginPath(); g.arc(f.x+Math.cos(th)*f.r, f.y+Math.sin(th)*f.r*0.78, 6+22*pr, 0, TAU); g.fill(); }
    g.globalAlpha=a*0.35; g.strokeStyle='#e8d0f0'; g.lineWidth=4;
    g.beginPath(); g.ellipse(f.x,f.y,f.r*(0.4+0.9*pr),f.r*0.78*(0.4+0.9*pr),0,0,TAU); g.stroke();
  }else if(f.kind==='hugdrop'){   // v4.1 抱き茸: 傘が上から下りてくる
    const a=1-pr;
    g.globalAlpha=a*0.55; g.fillStyle='#d8bc90';
    g.beginPath(); g.ellipse(f.x,f.y-40*(1-pr),f.r*(0.6+0.5*pr),f.r*(0.4+0.3*pr),0,0,TAU); g.fill();
    g.globalAlpha=a*0.8; g.strokeStyle='#b89468'; g.lineWidth=3;
    g.beginPath(); g.ellipse(f.x,f.y,f.r*(0.4+0.7*pr),f.r*(0.3+0.5*pr),0,0,TAU); g.stroke();
  }else if(f.kind==='mireburst'){   // v5.0 沼が干上がる: 水面がめくれて一気に立ちのぼる
    const a=1-pr;
    g.globalAlpha=a*0.75; g.fillStyle='#ff9ec2';
    g.beginPath(); g.ellipse(f.x,f.y,f.r*(1-pr*0.7),f.r*0.78*(1-pr*0.7),0,0,TAU); g.fill();
    g.globalAlpha=a*0.5; g.strokeStyle='#fff'; g.lineWidth=3;
    for(let i=0;i<8;i++){ const th=i*TAU/8; g.beginPath();
      g.moveTo(f.x+Math.cos(th)*f.r*0.6, f.y+Math.sin(th)*f.r*0.45);
      g.lineTo(f.x+Math.cos(th)*f.r*(0.9+1.6*pr), f.y+Math.sin(th)*f.r*(0.7+1.2*pr)-40*pr); g.stroke(); }
  }else if(f.kind==='darkring'){   // v5.0 闇が外へ抜ける
    const pr=clamp(f.t/f.life,0,1), R=f.r*Math.min(1,pr*2.0);
    g.save(); g.globalAlpha=(1-pr)*0.85;
    g.strokeStyle='rgba(42,26,62,0.95)'; g.lineWidth=14*(1-pr);
    g.beginPath(); g.ellipse(f.x,f.y,R,R*0.66,0,0,TAU); g.stroke();
    g.strokeStyle='rgba(167,125,255,0.8)'; g.lineWidth=3*(1-pr);
    g.beginPath(); g.ellipse(f.x,f.y,R*0.94,R*0.62,0,0,TAU); g.stroke();
    g.restore();
  }else if(f.kind==='darkslash'){   // v5.0 闇の刃の薙ぎ
    const pr=clamp(f.t/f.life,0,1);
    g.save(); g.globalAlpha=(1-pr)*0.9; g.translate(f.x,f.y); g.rotate(f.ang);
    g.fillStyle='rgba(42,26,62,0.7)';
    g.beginPath(); g.arc(0,0,f.r*(0.4+0.6*pr),-1.1,1.1); g.arc(0,0,f.r*0.25,1.1,-1.1,true); g.closePath(); g.fill();
    g.strokeStyle='rgba(167,125,255,0.9)'; g.lineWidth=3;
    g.beginPath(); g.arc(0,0,f.r*(0.4+0.6*pr),-1.1,1.1); g.stroke();
    g.restore();
  }else if(f.kind==='icepath'){   // v5.0 氷の道: 白い線が伸びて、青白い帯になって残る
    const pr=clamp(f.t/f.life,0,1), grow=clamp(f.t/0.25,0,1), L=f.len*grow;
    const ux=Math.cos(f.ang), uy=Math.sin(f.ang)*0.9;
    g.save(); g.globalAlpha=(1-pr)*0.9;
    g.strokeStyle='rgba(232,250,255,0.9)'; g.lineWidth=f.w*0.5*(1-pr*0.5); g.lineCap='round';
    g.beginPath(); g.moveTo(f.x,f.y); g.lineTo(f.x+ux*L,f.y+uy*L); g.stroke();
    g.strokeStyle='rgba(150,215,245,0.55)'; g.lineWidth=f.w*1.5*(1-pr*0.4);
    g.beginPath(); g.moveTo(f.x,f.y); g.lineTo(f.x+ux*L,f.y+uy*L); g.stroke();
    g.restore();
  }else if(f.kind==='iceshatter'){   // v5.0 氷が砕ける
    const pr=clamp(f.t/f.life,0,1);
    g.save(); g.globalAlpha=1-pr; g.fillStyle='rgba(232,250,255,0.9)';
    for(let i=0;i<6;i++){ const a=i*TAU/6+f.r, d=f.r*(0.3+pr*1.1);
      g.save(); g.translate(f.x+Math.cos(a)*d, f.y+Math.sin(a)*d*0.7); g.rotate(a);
      g.beginPath(); g.moveTo(0,-3); g.lineTo(2.4,0); g.lineTo(0,3); g.lineTo(-2.4,0); g.closePath(); g.fill(); g.restore(); }
    g.restore();
  }else if(f.kind==='icebloom'){   // v5.0 霜の華がひらく
    const pr=clamp(f.t/f.life,0,1), R=f.r*(0.3+0.7*pr);
    g.save(); g.globalAlpha=(1-pr)*0.85;
    g.strokeStyle='rgba(232,250,255,0.9)'; g.lineWidth=2;
    for(let i=0;i<6;i++){ const a=i*TAU/6;
      g.beginPath(); g.moveTo(f.x,f.y); g.lineTo(f.x+Math.cos(a)*R,f.y+Math.sin(a)*R*0.7); g.stroke(); }
    g.restore();
  }else if(f.kind==='icering'){   // v5.0 氷結の帳・静止の一点: 白い輪が広がって止まる
    const pr=clamp(f.t/f.life,0,1), R=f.r*Math.min(1,pr*2.2);
    g.save(); g.globalAlpha=(1-pr)*0.85;
    g.strokeStyle='rgba(232,250,255,0.95)'; g.lineWidth=4*(1-pr);
    g.beginPath(); g.ellipse(f.x,f.y,R,R*0.68,0,0,TAU); g.stroke();
    g.strokeStyle='rgba(150,215,245,0.45)'; g.lineWidth=12*(1-pr);
    g.beginPath(); g.ellipse(f.x,f.y,R*0.92,R*0.62,0,0,TAU); g.stroke();
    g.restore();
  }else if(f.kind==='dryburst'){   // v4.0 フレイラが床を焼いた: 熱の輪が外へ抜ける
    const a=1-pr;
    g.globalAlpha=a*0.7; g.strokeStyle='#ffb060'; g.lineWidth=7*(1-pr*0.6); g.shadowColor='#ff7a3a'; g.shadowBlur=18;
    g.beginPath(); g.ellipse(f.x,f.y,f.r*(0.15+0.9*pr),f.r*(0.15+0.9*pr)*0.7,0,0,TAU); g.stroke();
    g.globalAlpha=a*0.22; g.fillStyle='#ff7a3a';
    g.beginPath(); g.ellipse(f.x,f.y,f.r*(0.15+0.9*pr),f.r*(0.15+0.9*pr)*0.7,0,0,TAU); g.fill();
  }else if(f.kind==='evap'){   // v4.0 媚薬が蒸発した: 桃色の霧が外へ噴き出す
    const a=1-pr;
    for(let k=0;k<3;k++){ const ph=Math.min(1,pr*1.15+k*0.12);
      g.globalAlpha=a*(0.42-k*0.1); g.strokeStyle='#ff5d9a'; g.lineWidth=10-k*2.5; g.shadowColor='#ff5d9a'; g.shadowBlur=20;
      g.beginPath(); g.ellipse(f.x,f.y,f.r*ph,f.r*ph*0.72,0,0,TAU); g.stroke(); }
    g.globalAlpha=a*0.16; g.fillStyle='#ff86b3';
    g.beginPath(); g.ellipse(f.x,f.y,f.r*Math.min(1,pr*1.15),f.r*Math.min(1,pr*1.15)*0.72,0,0,TAU); g.fill();
  }else if(f.kind==='corebeam'){   // v4.0 魔核の広範囲絶頂光線: 太い桃色の柱
    const pr=f.t/f.life, a=1-pr, ex=f.x+Math.cos(f.ang)*f.len, ey=f.y+Math.sin(f.ang)*f.len;
    g.save(); g.lineCap='round';
    g.globalAlpha=a*0.30; g.strokeStyle='#ff86b3'; g.lineWidth=f.w*2.1*(1-pr*0.35);
    g.beginPath(); g.moveTo(f.x,f.y); g.lineTo(ex,ey); g.stroke();
    g.globalAlpha=a*0.62; g.strokeStyle='#ffb3cf'; g.lineWidth=f.w*(1-pr*0.4);
    g.beginPath(); g.moveTo(f.x,f.y); g.lineTo(ex,ey); g.stroke();
    g.globalAlpha=a; g.strokeStyle='#fff'; g.lineWidth=f.w*0.28*(1-pr*0.5);
    g.beginPath(); g.moveTo(f.x,f.y); g.lineTo(ex,ey); g.stroke();
    g.restore();
  }else if(f.kind==='coregas'){   // v4.0 発狂: 吐き出される甘い霧の輪
    g.globalAlpha=(1-pr)*0.5; g.strokeStyle='#ff9ec2'; g.lineWidth=6;
    g.beginPath(); g.ellipse(f.x,f.y,f.r*(0.2+0.8*pr),f.r*(0.2+0.8*pr)*0.72,0,0,TAU); g.stroke();
    g.globalAlpha=(1-pr)*0.18; g.fillStyle='#ff9ec2';
    g.beginPath(); g.ellipse(f.x,f.y,f.r*(0.2+0.8*pr),f.r*(0.2+0.8*pr)*0.72,0,0,TAU); g.fill();
  }else if(f.kind==='coreslam'){   // v4.0 発狂: 広範囲の薙ぎ
    g.globalAlpha=(1-pr)*0.85; g.strokeStyle='#ff2e6a'; g.lineWidth=9*(1-pr*0.6);
    g.shadowColor='#ff2e6a'; g.shadowBlur=16;
    g.beginPath(); g.ellipse(f.x,f.y,f.r*pr,f.r*pr*0.68,0,0,TAU); g.stroke();
  }else if(f.kind==='corebirth'){   // v4.0 落とし子が生まれる
    g.globalAlpha=(1-pr)*0.8; g.strokeStyle='#ff9ec2'; g.lineWidth=2.4;
    for(let i=0;i<7;i++){ const a=i*TAU/7+pr*1.2, rr=26+pr*70; g.beginPath(); g.moveTo(f.x,f.y); g.quadraticCurveTo(f.x+Math.cos(a+0.5)*rr*0.6,f.y+Math.sin(a+0.5)*rr*0.4,f.x+Math.cos(a)*rr,f.y+Math.sin(a)*rr*0.66); g.stroke(); }
  }else if(f.kind==='corerage'){   // v4.0 発狂に入る瞬間
    g.globalAlpha=(1-pr)*0.9; g.strokeStyle='#ff2e6a'; g.lineWidth=5*(1-pr*0.5);
    g.shadowColor='#ff2e6a'; g.shadowBlur=22;
    for(let k=0;k<3;k++){ const rr=(70+k*60)*(0.4+pr); g.beginPath(); g.ellipse(f.x,f.y,rr,rr*0.7,0,0,TAU); g.stroke(); }
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
  }else if(pk.kind==='family'){
    // v4.1 家族茸(光茸の亜種): 親茸の傘の下に、小さいのが三つ寄り添って生えている。同じ拍で息をする
    const br=1+0.05*Math.sin(t*1.8);
    g.fillStyle='rgba(8,8,26,0.32)'; g.beginPath(); g.ellipse(0,3,17,5.5,0,0,TAU); g.fill();
    glow(g,0,-11,30,'255,225,168',0.30+0.12*Math.sin(t*1.8));
    const kids=[[-8,1,3.6],[8,2,3.0],[1,3,2.6]];
    for(let i=0;i<kids.length;i++){ const x=kids[i][0], y=kids[i][1], r=kids[i][2]*(1+0.06*Math.sin(t*1.8-0.5-i*0.4));
      g.fillStyle='#e6e2d0'; g.fillRect(x-1,y-r*0.5,2,r*0.7+2);
      g.fillStyle=['#ffe1a8','#ffd08c','#fff0c8'][i]; g.beginPath(); g.ellipse(x,y-r*0.6,r,r*0.6,0,Math.PI,TAU); g.fill();
      g.fillStyle='rgba(255,255,255,0.75)'; g.beginPath(); g.arc(x-r*0.3,y-r*0.85,0.9,0,TAU); g.fill(); }
    g.save(); g.translate(0,-4); g.scale(br,br);
    g.fillStyle='#efe9d6'; g.fillRect(-2.2,-9,4.4,11);
    g.fillStyle='#f7d79a'; g.beginPath(); g.ellipse(0,-9,12.5,7.5,0,Math.PI,TAU); g.fill();
    g.fillStyle='rgba(214,168,110,0.55)'; g.beginPath(); g.ellipse(0,-8.6,12.5,3.0,0,0,Math.PI); g.fill();
    g.strokeStyle='rgba(180,140,90,0.5)'; g.lineWidth=0.8;
    for(let i=1;i<7;i++){ const x=-12.5+i*(25/7); g.beginPath(); g.moveTo(x,-9); g.lineTo(x*0.55,-6.2); g.stroke(); }
    g.fillStyle='#fff6dc'; g.beginPath(); g.ellipse(-4,-12,4.2,2.2,-0.35,0,TAU); g.fill();
    g.restore();
    g.strokeStyle='rgba(255,225,168,'+(0.30+0.16*Math.sin(t*1.8)).toFixed(2)+')'; g.lineWidth=1;
    for(let i=0;i<kids.length;i++){ g.beginPath(); g.moveTo(0,1); g.quadraticCurveTo(kids[i][0]*0.5,kids[i][1]+1.5,kids[i][0],kids[i][1]); g.stroke(); }
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
  if(gl.kind==='gems') return 'ジェムの群れ';
  if(gl.kind==='gather') return '集まって相談';   // v3.1
  if(gl.kind==='wait') return '入口で待つ';       // v3.2
  if(gl.kind==='rescue') return '救出';
  if(gl.kind==='cover') return '仲間をかばう';   // v4.0
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
/* v3.0 フレイラのスプライト(tools/make_freila.py で生成。手描き原画を置けば差し替わる) */
const FREILA_SPR=new Image(); let FREILA_OK=false; FREILA_SPR.onload=()=>{ FREILA_OK=true; }; FREILA_SPR.onerror=()=>{ FREILA_OK=false; }; FREILA_SPR.src='assets/sprites/freila.png';
const FREILA_HD=new Image(); let FREILA_HD_OK=false; FREILA_HD.onload=()=>{ FREILA_HD_OK=true; }; FREILA_HD.onerror=()=>{ FREILA_HD_OK=false; }; FREILA_HD.src='assets/sprites/freila_hd.png';
const KUU_SPR=new Image(); let KUU_OK=false; KUU_SPR.onload=()=>{ KUU_OK=true; }; KUU_SPR.onerror=()=>{ KUU_OK=false; }; KUU_SPR.src='assets/sprites/kuu.png';
const KUU_HD=new Image(); let KUU_HD_OK=false; KUU_HD.onload=()=>{ KUU_HD_OK=true; }; KUU_HD.onerror=()=>{ KUU_HD_OK=false; }; KUU_HD.src='assets/sprites/kuu_hd.png';
const YAMI_SPR=new Image(); let YAMI_OK=false; YAMI_SPR.onload=()=>{ YAMI_OK=true; }; YAMI_SPR.onerror=()=>{ YAMI_OK=false; }; YAMI_SPR.src='assets/sprites/yamiko.png';
const YAMI_HD=new Image(); let YAMI_HD_OK=false; YAMI_HD.onload=()=>{ YAMI_HD_OK=true; }; YAMI_HD.onerror=()=>{ YAMI_HD_OK=false; }; YAMI_HD.src='assets/sprites/yamiko_hd.png';
/* v5.0 ヒロインの絵姿は表で引く(三人目からは三項では足りない) */
const HERO_IMG={
  lumina:{px:()=>LUMINA_SPR, hd:()=>LUMINA_HD, pxOk:()=>LUMINA_OK, hdOk:()=>true},
  freila:{px:()=>FREILA_SPR, hd:()=>FREILA_HD, pxOk:()=>FREILA_OK, hdOk:()=>FREILA_HD_OK},
  kuu:   {px:()=>KUU_SPR,    hd:()=>KUU_HD,    pxOk:()=>KUU_OK,    hdOk:()=>KUU_HD_OK},
  yamiko:{px:()=>YAMI_SPR,   hd:()=>YAMI_HD,   pxOk:()=>YAMI_OK,   hdOk:()=>YAMI_HD_OK},
};
const heroImg=id=>HERO_IMG[id]||HERO_IMG.lumina;
/* v1.4: 原本(160×240)から端末の実ピクセル寸のスプライトを一度だけ焼く(色変種込み)。毎フレームの ctx.filter を廃止 */
const LUMINA_H=60;                    // 論理高さ(足元アンカー -hgt+2 は据え置き)
const HERO_VARS={lumina:{key:''}, freila:{key:''}, kuu:{key:''}, yamiko:{key:''}};   // v3.0 ヒロインごとの焼き絵(v5.0 クウ・ヤミコ)
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
function heroVariants(id,hd){
  const VAR=HERO_VARS[id]||HERO_VARS.lumina;
  const ds=Math.max(0.5,Math.round(dpr*viewScale*4)/4);   // 論理1pxあたりの実ピクセル(0.25刻み)。resize() で変わる
  const key=(hd?'hd':'px')+ds;
  if(VAR.key===key) return VAR;
  const HI=heroImg(id), img=hd?HI.hd():HI.px();
  const hgt=hd?LUMINA_H:img.height*1.05, w=img.width*hgt/img.height;
  Object.assign(VAR,{key,w,h:hgt}, hd?bakeVariants(img,Math.round(w*ds),Math.round(hgt*ds),true):bakeVariants(img,img.width,img.height,false));
  return VAR;
}
const luminaVariants=hd=>heroVariants('lumina',hd);
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
  const hd=gfxHd() && heroImg(opt.id).hdOk();
  const V=heroVariants(opt.id||'lumina',hd);
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
  if(heroImg(opt.id).pxOk()){ drawGirlSprite(g,x,y,opt); return; }
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

  if(e.denGuard){   // v3.2 褥の番人: 桃色の輪を二重に敷いて「ここの主」だと分かるように
    const t=(G.B?G.B.time:0);
    g.save(); g.globalAlpha=0.5+0.2*Math.sin(t*2.2); g.strokeStyle='rgba(255,110,170,0.75)'; g.lineWidth=2.4;
    g.beginPath(); g.ellipse(0,4,e.r*1.5,e.r*0.55,0,0,TAU); g.stroke();
    g.globalAlpha=0.28; g.lineWidth=1.4; g.beginPath(); g.ellipse(0,4,e.r*1.85,e.r*0.7,0,0,TAU); g.stroke(); g.restore();
    glow(g,0,0,e.r*2.2,'255,110,170',0.16);
  }
  if(e.elite){
    g.strokeStyle='rgba(255,90,110,0.5)'; g.lineWidth=2;
    g.beginPath(); g.ellipse(0,2,e.r*1.25,e.r*0.45,0,0,TAU); g.stroke();
  }

  let ent=null;
  if(gfxHd()){
    if(e.boss) drawEnemyShaded(g,e);
    else { ent=drawEnemyCached(g,e); const aid=e.art||e.id; if(ent && MON_IRIS[aid]) MON_IRIS[aid](g,e); if(gfxLv()>=2 && MON_OVER[aid]) MON_OVER[aid](g,e); }
  }else drawBody(g,e);

  if((e.frozT||0)>0){   // v5.0 凍結: 青い氷に覆われ、結晶が立つ
    g.save();
    g.fillStyle='rgba(180,230,255,0.42)';
    g.beginPath(); g.ellipse(0,-e.r*0.7,e.r*1.15,e.r*1.35,0,0,TAU); g.fill();
    g.strokeStyle='rgba(255,255,255,0.85)'; g.lineWidth=1.6;
    for(let i=0;i<3;i++){ const a=-1.9+i*0.9;
      g.beginPath(); g.moveTo(Math.cos(a)*e.r*0.4,-e.r*0.7+Math.sin(a)*e.r*0.4);
      g.lineTo(Math.cos(a)*e.r*1.25,-e.r*0.7+Math.sin(a)*e.r*1.35); g.stroke(); }
    g.restore();
  }else if((e.chillT||0)>0){   // 冷気: 縁だけ淡く青い
    g.save(); g.globalAlpha=0.30; g.strokeStyle='#bfeaff'; g.lineWidth=2;
    g.beginPath(); g.ellipse(0,-e.r*0.7,e.r*1.05,e.r*1.2,0,0,TAU); g.stroke(); g.restore();
  }
  if((e.vulnT||0)>0){   // 冷気の帳の中: 足元に青い破線の輪
    g.save(); g.globalAlpha=0.4; g.strokeStyle='#9fd8ff'; g.lineWidth=1.2; g.setLineDash([3,3]);
    g.beginPath(); g.ellipse(0,3,e.r*1.1,e.r*0.4,0,0,TAU); g.stroke(); g.setLineDash([]); g.restore();
  }
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
/* v6.0 上位個体(熟れた個体)は base で絵を引く。新しい絵は一枚も描かず、
   体色・輪郭の発光・大きさだけを renderShaded が段に応じて足す。
   ★art の引き回しは drawBody / renderShaded / spriteKey / MON_IRIS / MON_OVER の
     全部で揃えること——一箇所でも取りこぼすと、上位個体だけ目玉が描かれない等の
     静かな欠落になる(見た目では気づけない) */
/* ================= v6.0 新しい種の絵 =================
   ★どれも既存の骨格に寄せず、「何をする一体か」が一目で分かる形にする。
   間接責めの種(映り身・観客・帳の番)は、責める線そのものを描く。 */

/* 映り身: 本人の姿を上下に反した青白い影。★手の位置だけが本人と違う動きをする */
function drawMirrorling(g,e){
  const r=e.r, t=e.t;
  g.save();
  g.globalAlpha=0.42;
  g.scale(1,-1);                                  /* 上下に反す=映り込み */
  g.fillStyle='rgba(150,200,235,0.85)';
  /* 頭 */ g.beginPath(); g.arc(0,-r*1.1,r*0.42,0,TAU); g.fill();
  /* 胴 */ g.beginPath(); g.moveTo(-r*0.42,-r*0.7); g.quadraticCurveTo(0,r*0.1,-r*0.30,r*0.7);
  g.lineTo(r*0.30,r*0.7); g.quadraticCurveTo(0,r*0.1,r*0.42,-r*0.7); g.closePath(); g.fill();
  /* 脚 */ g.fillRect(-r*0.26,r*0.6,r*0.20,r*0.7); g.fillRect(r*0.06,r*0.6,r*0.20,r*0.7);
  /* ★腕: 本人の動きではなく、胸と腿へ寄っていく */
  const sw=0.5+0.5*Math.sin(t*1.6+e.joff);
  g.strokeStyle='rgba(150,200,235,0.9)'; g.lineWidth=r*0.20; g.lineCap='round';
  g.beginPath(); g.moveTo(-r*0.40,-r*0.55); g.quadraticCurveTo(-r*0.55,-r*0.1, -r*0.16-sw*r*0.06, -r*0.30+sw*r*0.10); g.stroke();
  g.beginPath(); g.moveTo( r*0.40,-r*0.55); g.quadraticCurveTo( r*0.60, r*0.2,  r*0.10+sw*r*0.06,  r*0.55-sw*r*0.10); g.stroke();
  g.globalAlpha=0.30; g.strokeStyle='rgba(255,255,255,0.9)'; g.lineWidth=1;
  g.beginPath(); g.arc(0,-r*1.1,r*0.42,0,TAU); g.stroke();
  g.restore();
}
/* 紋喰い: 紋の形(円+内接三角)が浮き上がって歩いている。脚は描かない */
function drawGlyphmite(g,e){
  const r=e.r, ph=0.6+0.4*Math.sin(e.t*3+e.joff);
  g.save(); g.translate(0,-r*0.5-Math.sin(e.t*4+e.joff)*1.5);
  g.fillStyle='rgba(70,20,60,0.62)'; g.beginPath(); g.arc(0,0,r*0.92,0,TAU); g.fill();
  g.strokeStyle='rgba(255,140,190,'+(0.85*ph).toFixed(2)+')'; g.lineWidth=1.6;
  g.beginPath(); g.arc(0,0,r*0.92,0,TAU); g.stroke();
  g.beginPath(); for(let m=0;m<3;m++){ const a=-Math.PI/2+m*TAU/3, x=Math.cos(a)*r*0.92, y=Math.sin(a)*r*0.92; if(m===0) g.moveTo(x,y); else g.lineTo(x,y); } g.closePath(); g.stroke();
  g.fillStyle='rgba(255,190,220,'+(0.9*ph).toFixed(2)+')'; g.beginPath(); g.arc(0,0,r*0.20,0,TAU); g.fill();
  g.restore();
}
/* 糸紡ぎ: 暗い桃の紡錘。★脚は4本だけ(実在昆虫に寄せない)。尻から糸を一本 */
function drawSilkmite(g,e){
  const r=e.r, sw=Math.sin(e.t*7+e.joff);
  g.save(); g.translate(0,-r*0.6);
  g.strokeStyle='rgba(230,190,215,0.55)'; g.lineWidth=1;
  for(let i=0;i<4;i++){ const s=i<2?-1:1, o=(i%2)*0.5;
    g.beginPath(); g.moveTo(s*r*0.2,0); g.quadraticCurveTo(s*r*0.7,r*0.25+o*3+sw, s*r*0.9, r*0.7+o*2); g.stroke(); }
  g.fillStyle='rgba(200,120,160,0.9)';
  g.beginPath(); g.ellipse(0,0,r*0.42,r*0.72,0,0,TAU); g.fill();
  g.fillStyle='rgba(255,220,235,0.6)'; g.beginPath(); g.ellipse(-r*0.12,-r*0.22,r*0.14,r*0.22,0,0,TAU); g.fill();
  g.fillStyle='rgba(30,10,24,0.9)'; g.beginPath(); g.arc(0,-r*0.5,r*0.14,0,TAU); g.fill();
  g.strokeStyle='rgba(255,220,235,0.5)'; g.lineWidth=0.9;
  g.beginPath(); g.moveTo(0,r*0.7); g.quadraticCurveTo(sw*3,r*1.3,sw*5,r*1.9); g.stroke();
  g.restore();
}
/* 霜の芽: 床から生えた六角柱を三本。根元に霜の輪 */
function drawFrostbud(g,e){
  const r=e.r;
  g.save();
  g.fillStyle='rgba(255,255,255,0.20)'; g.beginPath(); g.ellipse(0,0,r*0.95,r*0.36,0,0,TAU); g.fill();
  const col=['rgba(200,235,250,0.75)','rgba(228,246,255,0.8)','rgba(178,220,242,0.7)'];
  const hs=[1.0,1.5,0.75], xs=[-r*0.42,0,r*0.44];
  for(let i=0;i<3;i++){ const H=r*hs[i], w=r*0.24;
    g.fillStyle=col[i];
    g.beginPath(); g.moveTo(xs[i]-w,0); g.lineTo(xs[i]-w*0.7,-H); g.lineTo(xs[i],-H-r*0.28); g.lineTo(xs[i]+w*0.7,-H); g.lineTo(xs[i]+w,0); g.closePath(); g.fill();
    g.fillStyle='rgba(255,255,255,0.6)'; g.fillRect(xs[i]-1,-H+2,1.6,H*0.6); }
  g.restore();
}
/* 澱み手: 手の形。★輪郭を三重にずらして重ねる=見ただけで「遅れている」と分かる */
function drawStiller(g,e){
  const r=e.r, t=e.t;
  const hand=(dx,dy,al)=>{
    g.save(); g.translate(dx,dy);
    g.fillStyle='rgba(150,140,175,'+al+')';
    g.beginPath(); g.ellipse(0,0,r*0.62,r*0.52,0,0,TAU); g.fill();
    for(let i=0;i<4;i++){ const a=-Math.PI*0.85+i*0.42, L=r*(0.85+0.12*Math.sin(t*2+i+e.joff));
      g.strokeStyle='rgba(150,140,175,'+al+')'; g.lineWidth=r*0.20; g.lineCap='round';
      g.beginPath(); g.moveTo(Math.cos(a)*r*0.3,Math.sin(a)*r*0.3); g.lineTo(Math.cos(a)*L,Math.sin(a)*L); g.stroke(); }
    g.strokeStyle='rgba(150,140,175,'+al+')'; g.lineWidth=r*0.22; g.lineCap='round';
    g.beginPath(); g.moveTo(r*0.2,r*0.15); g.lineTo(r*0.75,r*0.45); g.stroke();
    g.restore();
  };
  hand( r*0.55, r*0.42, 0.15);   /* 8px 遅れ */
  hand( r*0.28, r*0.21, 0.30);   /* 4px 遅れ */
  hand( 0,      0,      0.60);   /* 本体 */
}
/* 忘れ蛾: 乳白の翼。紋は目玉ではなく渦を二つ。真っ白なのに見つけにくい */
function drawLethemoth(g,e){
  const r=e.r, fl=Math.sin(e.t*11+e.joff);
  g.save(); g.translate(0,-r*0.5);
  for(const s of [-1,1]){
    g.save(); g.scale(s,1); g.rotate(fl*0.28);
    g.fillStyle='rgba(232,224,228,0.72)';
    g.beginPath(); g.moveTo(0,0); g.quadraticCurveTo(r*1.5,-r*0.9, r*1.15, r*0.15); g.quadraticCurveTo(r*0.8, r*0.75, 0, r*0.2); g.closePath(); g.fill();
    g.strokeStyle='rgba(200,190,205,0.55)'; g.lineWidth=1.1;
    g.beginPath(); g.arc(r*0.85,-r*0.12,r*0.20,0.6,4.4); g.stroke();
    g.beginPath(); g.arc(r*0.62, r*0.20,r*0.13,0.9,4.9); g.stroke();
    g.restore();
  }
  g.fillStyle='rgba(214,206,212,0.95)';
  g.beginPath(); g.ellipse(0,0,r*0.24,r*0.62,0,0,TAU); g.fill();
  g.fillStyle='rgba(160,150,165,0.8)'; g.beginPath(); g.arc(0,-r*0.55,r*0.20,0,TAU); g.fill();
  g.restore();
}
/* 三つ目の観客: 瞼のない眼球に短い翼を一対。組の間に張る三角形は MON_OVER が描く */
function drawGallery(g,e){
  const r=e.r, F=(G.B&&G.B.floor)||null, iris=(F&&F.col)||'#ffb3cf';
  g.save(); g.translate(0,-r*0.7);
  g.fillStyle='rgba(220,206,220,0.7)';
  for(const s of [-1,1]){ g.save(); g.scale(s,1); g.rotate(Math.sin(e.t*9+e.joff)*0.3);
    g.beginPath(); g.moveTo(r*0.6,0); g.quadraticCurveTo(r*1.5,-r*0.6,r*1.25,r*0.25); g.quadraticCurveTo(r*0.95,r*0.2,r*0.6,0); g.fill(); g.restore(); }
  g.fillStyle='#e8e0e0'; g.beginPath(); g.arc(0,0,r*0.85,0,TAU); g.fill();
  const gx=(G.B&&G.B.hero)?clamp((G.B.hero.x-e.x)/220,-1,1):0, gy=(G.B&&G.B.hero)?clamp((G.B.hero.y-e.y)/180,-1,1):0;
  g.fillStyle=iris; g.beginPath(); g.arc(gx*r*0.3,gy*r*0.3,r*0.42,0,TAU); g.fill();
  g.fillStyle='#140f18'; g.beginPath(); g.arc(gx*r*0.36,gy*r*0.36,r*0.20,0,TAU); g.fill();
  g.fillStyle='rgba(255,255,255,0.8)'; g.beginPath(); g.arc(-r*0.22,-r*0.28,r*0.12,0,TAU); g.fill();
  g.restore();
}
/* 声移し: 人型でも獣でもない。骨白の、口だけの器 */
function drawEchoer(g,e){
  const r=e.r, vc=(e.voice&&HEROES[e.voice]&&HEROES[e.voice].col)||'#ffd0e4';
  g.save(); g.translate(0,-r*0.6);
  g.fillStyle='#c8c0b0';
  g.beginPath(); g.moveTo(-r*0.55,-r*0.9); g.quadraticCurveTo(-r*0.85,r*0.4,-r*0.42,r*1.0);
  g.lineTo(r*0.42,r*1.0); g.quadraticCurveTo(r*0.85,r*0.4,r*0.55,-r*0.9); g.closePath(); g.fill();
  /* 上端が唇の形に開いている。中は空洞で暗い */
  g.fillStyle='#241e1c';
  g.beginPath(); g.ellipse(0,-r*0.9,r*0.55,r*0.26,0,0,TAU); g.fill();
  g.strokeStyle='#ddd4c4'; g.lineWidth=1.6;
  g.beginPath(); g.moveTo(-r*0.55,-r*0.9); g.quadraticCurveTo(0,-r*1.16,r*0.55,-r*0.9); g.stroke();
  g.beginPath(); g.moveTo(-r*0.55,-r*0.9); g.quadraticCurveTo(0,-r*0.66,r*0.55,-r*0.9); g.stroke();
  /* 抱えている声の主の色が、器の内側にだけ薄く灯る */
  const ph=0.35+0.25*Math.sin(e.t*1.4+e.joff);
  g.globalAlpha=ph; g.fillStyle=vc;
  g.beginPath(); g.ellipse(0,-r*0.82,r*0.40,r*0.18,0,0,TAU); g.fill();
  g.globalAlpha=1;
  g.restore();
}
/* 骨兵: 灰白の細い胴に肋を三本。歩くたび全体が縦に揺れてカタカタする */
function drawBonesoldier(g,e){
  const r=e.r, sh=Math.sin(e.t*13+e.joff)*1.5;
  g.save(); g.translate(0,-r*0.8+sh);
  g.strokeStyle='#b9b2a4'; g.lineWidth=r*0.30; g.lineCap='round';
  g.beginPath(); g.moveTo(0,-r*0.35); g.lineTo(0,r*0.9); g.stroke();
  g.lineWidth=r*0.18;
  for(let i=0;i<3;i++){ const y=-r*0.1+i*r*0.34;
    g.beginPath(); g.moveTo(-r*0.42,y); g.lineTo(r*0.42,y); g.stroke(); }
  const sw=Math.sin(e.t*8+e.joff)*0.35;
  g.lineWidth=r*0.16;
  g.beginPath(); g.moveTo(-r*0.35,-r*0.1); g.lineTo(-r*0.75,r*0.35+sw*r*0.3); g.stroke();
  g.beginPath(); g.moveTo( r*0.35,-r*0.1); g.lineTo( r*0.75,r*0.35-sw*r*0.3); g.stroke();
  g.beginPath(); g.moveTo(-r*0.16,r*0.9); g.lineTo(-r*0.26,r*1.5); g.stroke();
  g.beginPath(); g.moveTo( r*0.16,r*0.9); g.lineTo( r*0.26,r*1.5); g.stroke();
  g.fillStyle='#c6bfb0'; g.beginPath(); g.ellipse(0,-r*0.68,r*0.36,r*0.44,0,0,TAU); g.fill();
  g.fillStyle='#181410';
  g.beginPath(); g.ellipse(-r*0.14,-r*0.72,r*0.10,r*0.13,0,0,TAU); g.fill();
  g.beginPath(); g.ellipse( r*0.14,-r*0.72,r*0.10,r*0.13,0,0,TAU); g.fill();
  g.restore();
}

/* 窪みの主: 窪みそのものを大きく描く。人型のシルエットに沿った肉の縁 */
function drawNichelord(g,e){
  const r=e.r, op=e.open?1:0, t=e.t;
  g.save();
  g.fillStyle='#4a0f22';
  g.beginPath(); g.ellipse(0,0,r*0.98,r*1.25,0,0,TAU); g.fill();
  /* 人型の窪み: 頭・肩・腰・脚 */
  g.fillStyle='#2a0512';
  g.beginPath(); g.arc(0,-r*0.72,r*0.28,0,TAU); g.fill();
  g.beginPath(); g.ellipse(0,-r*0.10,r*0.44,r*0.44,0,0,TAU); g.fill();
  g.beginPath(); g.ellipse(0, r*0.62,r*0.30,r*0.52,0,0,TAU); g.fill();
  /* 襞: 開くと外へ反り返る */
  const sw=op*(0.5+0.5*Math.sin(t*1.6+e.joff));
  g.strokeStyle='rgba(220,110,150,0.6)'; g.lineWidth=r*0.10;
  for(let k=0;k<7;k++){ const a=-Math.PI/2+(k-3)*0.42;
    const R0=r*0.62, R1=r*(0.86+sw*0.24);
    g.beginPath(); g.moveTo(Math.cos(a)*R0,Math.sin(a)*R0*1.2); g.lineTo(Math.cos(a)*R1,Math.sin(a)*R1*1.2); g.stroke(); }
  g.strokeStyle='rgba(255,200,225,0.35)'; g.lineWidth=1.4;
  g.beginPath(); g.ellipse(0,0,r*0.98,r*1.25,0,0,TAU); g.stroke();
  g.restore();
}
/* 褥座: 座面と背もたれ。遠いと二つの塊、近いと椅子。★座面には既に人の形の窪み */
function drawSeatflesh(g,e){
  const r=e.r, f=(e.form||0);
  const gap=(2-f)*r*0.32;
  g.save();
  /* 背もたれ */
  g.fillStyle='#7a2038';
  g.beginPath(); g.ellipse(0,-r*0.75-gap,r*0.80,r*0.62,0,0,TAU); g.fill();
  /* 座面 */
  g.beginPath(); g.ellipse(0, r*0.20+gap,r*0.95,r*0.48,0,0,TAU); g.fill();
  if(f>=1){
    g.strokeStyle='rgba(255,190,215,0.45)'; g.lineWidth=1.6;
    g.beginPath(); g.ellipse(0,-r*0.75-gap,r*0.80,r*0.62,0,0,TAU); g.stroke();
    g.beginPath(); g.ellipse(0, r*0.20+gap,r*0.95,r*0.48,0,0,TAU); g.stroke();
  }
  if(f>=2){
    /* 座面に残った人の形の窪み */
    g.fillStyle='rgba(40,6,20,0.55)';
    g.beginPath(); g.ellipse(0,r*0.18,r*0.40,r*0.26,0,0,TAU); g.fill();
    g.fillStyle='rgba(255,170,205,0.30)';
    g.beginPath(); g.ellipse(0,r*0.10,r*0.30,r*0.14,0,0,TAU); g.fill();
  }
  g.fillStyle='rgba(255,210,230,0.45)';
  g.beginPath(); g.ellipse(-r*0.28,-r*0.90-gap,r*0.20,r*0.12,0,0,TAU); g.fill();
  g.restore();
}
/* 心根: 壁から生えた太い根。★繋いでいる間、光の粒が「壁の側」へ流れる */
function drawHeartroot(g,e){
  const r=e.r, t=e.t;
  g.save();
  for(let k=0;k<3;k++){
    const a=-Math.PI/2+(k-1)*0.55;
    const ex=Math.cos(a)*r*1.5, ey=Math.sin(a)*r*1.5;
    g.strokeStyle='rgba(180,50,90,0.65)'; g.lineWidth=r*(0.26-k*0.05); g.lineCap='round';
    g.beginPath(); g.moveTo(0,r*0.5); g.quadraticCurveTo(ex*0.5,ey*0.4+Math.sin(t+k)*3,ex,ey); g.stroke();
    g.strokeStyle='rgba(255,150,190,0.5)'; g.lineWidth=r*0.08;
    g.beginPath(); g.moveTo(0,r*0.5); g.quadraticCurveTo(ex*0.5,ey*0.4,ex,ey); g.stroke();
    if(e.feeding){ /* ★流れる向きは常に根元(=壁の側) */
      for(let m=0;m<3;m++){ const u=1-(((t*0.7+m/3+k*0.11)%1));
        const px=ex*u*u+ex*0.5*2*u*(1-u), py=(r*0.5)*(1-u)*(1-u)+ey*0.4*2*u*(1-u)+ey*u*u;
        g.fillStyle='rgba(255,220,235,0.85)'; g.beginPath(); g.arc(px,py,1.8,0,TAU); g.fill(); } }
  }
  g.fillStyle='#8a1a3c'; g.beginPath(); g.ellipse(0,r*0.55,r*0.62,r*0.42,0,0,TAU); g.fill();
  g.fillStyle='rgba(255,150,190,0.35)'; g.beginPath(); g.ellipse(-r*0.16,r*0.44,r*0.20,r*0.12,0,0,TAU); g.fill();
  g.restore();
}
/* 帳の番: 石版に半分埋まった上半身。顔は無く、片腕だけが長く伸びて刻んでいる。
   ★刻む動作は「なめらかに動かさない」——関節が一段ずつカクッと動く */
function drawTallykeeper(g,e){
  const r=e.r, step=Math.floor(((e.t*2)%1)*4)/4;
  g.save();
  g.fillStyle='#3a3348';
  g.beginPath(); g.moveTo(-r*0.72,r*0.9); g.lineTo(-r*0.58,-r*0.6); g.quadraticCurveTo(0,-r*1.0,r*0.58,-r*0.6);
  g.lineTo(r*0.72,r*0.9); g.closePath(); g.fill();
  /* 顔の位置は、ただの平らな面 */
  g.fillStyle='#4a4258';
  g.beginPath(); g.ellipse(0,-r*0.62,r*0.34,r*0.40,0,0,TAU); g.fill();
  /* 片腕だけが長く伸びて、壁面に細い線を刻む */
  const ax=r*(0.9+step*0.7), ay=-r*(0.2+step*0.5);
  g.strokeStyle='#4a4258'; g.lineWidth=r*0.18; g.lineCap='round';
  g.beginPath(); g.moveTo(r*0.35,-r*0.3); g.lineTo(r*0.75,-r*0.34); g.lineTo(ax,ay); g.stroke();
  g.strokeStyle='rgba(255,150,190,'+(e.on?0.55:0.22)+')'; g.lineWidth=1.4;
  const n=Math.min(6,Object.keys(e.tally||{}).length+1);
  for(let k=0;k<n;k++){ const y=-r*0.9+k*r*0.24;
    g.beginPath(); g.moveTo(r*0.85,y); g.lineTo(r*1.35,y-2); g.stroke(); }
  g.restore();
}
/* 水鏡の女王: 水面から上半身だけ。★顔は描かず、頭部は磨かれた鏡面(覗いた側が映る) */
function drawMirrorqueen(g,e){
  const r=e.r, t=e.t, ex=!!e.exposed;
  g.save();
  g.fillStyle=ex?'#2a4a6a':'#1c3550';
  g.beginPath(); g.moveTo(-r*0.85,r*0.9); g.quadraticCurveTo(-r*0.55,-r*0.3,-r*0.34,-r*0.55);
  g.lineTo(r*0.34,-r*0.55); g.quadraticCurveTo(r*0.55,-r*0.3,r*0.85,r*0.9); g.closePath(); g.fill();
  /* 長い腕。水面に手のひらを伏せている */
  g.strokeStyle=ex?'#35597c':'#254866'; g.lineWidth=r*0.20; g.lineCap='round';
  for(const s of [-1,1]){ g.beginPath(); g.moveTo(s*r*0.34,-r*0.35);
    g.quadraticCurveTo(s*r*1.15,r*0.1+Math.sin(t*0.8)*3, s*r*1.5, r*0.72); g.stroke(); }
  /* 頭部: 磨かれた鏡面。継ぎ目もヒビも無い(割れている時だけ入る) */
  const hy=-r*0.95;
  g.fillStyle='#14121c'; g.beginPath(); g.arc(0,hy,r*0.42,0,TAU); g.fill();
  g.fillStyle='rgba(255,255,255,0.14)';
  g.beginPath(); g.moveTo(-r*0.34,hy+r*0.28); g.lineTo(r*0.02,hy-r*0.36); g.lineTo(r*0.12,hy-r*0.34); g.lineTo(-r*0.24,hy+r*0.30); g.closePath(); g.fill();
  g.fillStyle='rgba(150,190,230,0.12)'; g.fillRect(-r*0.42,hy+r*0.12,r*0.84,r*0.26);
  if(ex){ g.strokeStyle='rgba(210,235,255,0.7)'; g.lineWidth=1;
    for(let k=0;k<5;k++){ const a=k*1.26+e.joff;
      g.beginPath(); g.moveTo(0,hy); g.lineTo(Math.cos(a)*r*0.42,hy+Math.sin(a)*r*0.42); g.stroke(); } }
  g.restore();
}
/* はじめましての君: 乳白の水から立つ人影。★顔の部分だけ毎フレーム定まらない */
function drawNevermet(g,e){
  const r=e.r, t=e.t;
  const jx=()=>(Math.random()-0.5)*3, jy=()=>(Math.random()-0.5)*3;
  g.save();
  g.fillStyle='rgba(232,220,228,0.88)';
  g.beginPath(); g.moveTo(-r*0.62,r*1.1); g.quadraticCurveTo(-r*0.48,-r*0.2,-r*0.30,-r*0.55);
  g.lineTo(r*0.30,-r*0.55); g.quadraticCurveTo(r*0.48,-r*0.2,r*0.62,r*1.1); g.closePath(); g.fill();
  g.strokeStyle='rgba(200,188,200,0.7)'; g.lineWidth=r*0.16; g.lineCap='round';
  for(const s of [-1,1]){ g.beginPath(); g.moveTo(s*r*0.28,-r*0.36);
    g.quadraticCurveTo(s*r*0.66,r*0.2+Math.sin(t*1.1)*3, s*r*0.5, r*0.7); g.stroke(); }
  /* 頭 */
  g.fillStyle='rgba(238,228,234,0.95)'; g.beginPath(); g.arc(0,-r*0.86,r*0.34,0,TAU); g.fill();
  /* ★顔だけがずれて定まらない */
  g.fillStyle='rgba(150,140,150,0.55)';
  g.beginPath(); g.arc(-r*0.13+jx(),-r*0.90+jy(),r*0.06,0,TAU); g.fill();
  g.beginPath(); g.arc( r*0.13+jx(),-r*0.90+jy(),r*0.06,0,TAU); g.fill();
  g.strokeStyle='rgba(150,140,150,0.45)'; g.lineWidth=1.2;
  g.beginPath(); g.moveTo(-r*0.10+jx(),-r*0.72+jy()); g.lineTo(r*0.10+jx(),-r*0.72+jy()); g.stroke();
  g.restore();
}
/* はじめの夜の主: 1階のナメクジと同じ寸法。★濃くなっても大きくしない。
   違いは体内を走る桃色の脈の本数だけ */
function drawFirstslug(g,e){
  const r=e.r, th=Math.min(6,e.thick||0), ph=Math.sin(e.t*2+e.joff);
  g.save();
  g.fillStyle='#8aa84a';
  g.beginPath(); g.ellipse(0,0,r*(1.05+ph*0.04),r*0.72,0,0,TAU); g.fill();
  g.fillStyle='rgba(200,224,122,0.85)';
  g.beginPath(); g.ellipse(-r*0.18,-r*0.20,r*0.42,r*0.26,0,0,TAU); g.fill();
  /* 濃さは体内の脈でだけ表す */
  g.strokeStyle='rgba(255,120,180,0.5)'; g.lineWidth=1.5;
  for(let k=0;k<th;k++){ const y=-r*0.42+k*(r*0.84/Math.max(1,th));
    g.beginPath(); g.moveTo(-r*0.85,y); g.quadraticCurveTo(0,y+Math.sin(e.t*1.6+k)*3,r*0.85,y); g.stroke(); }
  /* 触角 */
  g.strokeStyle='#7a9a3a'; g.lineWidth=r*0.12; g.lineCap='round';
  for(const s of [-1,1]){ g.beginPath(); g.moveTo(s*r*0.30,-r*0.5);
    g.lineTo(s*r*0.42,-r*0.95+ph*2); g.stroke();
    g.fillStyle='#2a3a12'; g.beginPath(); g.arc(s*r*0.42,-r*0.98+ph*2,r*0.10,0,TAU); g.fill(); }
  g.fillStyle='rgba(255,255,255,'+(0.25+0.06*th)+')';
  g.beginPath(); g.ellipse(-r*0.30,-r*0.30,r*0.22,r*0.10,0,0,TAU); g.fill();
  g.restore();
}

function drawBody(g,e){
  /* ★v6.2 上位個体(RANK_BASE)は rankPick が「その個体の id」を返すので、
     ここで base に解決しないと枝に当たらず、汎用のボスの絵に落ちる。
     設計は「差し替えは種の同一性を壊さない——絵も本文も図鑑も base のまま」なので、
     本文(sceneForHero)と同じく base を見る。実測で9種(熟れたナメクジ・絡みワーム・
     双眼・焦らしの熟手・二重傘・深口・据わりの触手王・双条・三重の囃し)が落ちていた */
  const MD=(typeof MONSTERS!=='undefined')?MONSTERS[e.id]:null;
  const aid=e.art||(MD&&MD.base)||e.id;
  if(aid==='core') drawCore(g,e);
  else if(aid==='yamiboss') drawYamiBoss(g,e);
  else if(aid==='miretent') drawMiretentBody(g,e);
  else if(aid==='lurecap') drawLurecap(g,e);
  else if(aid==='hugcap') drawHugcap(g,e);
  else if(aid==='coreling') drawCoreling(g,e);
  else if(aid==='inyoku') drawInyoku(g,e);
  else if(aid==='suiyou') drawSuiyou(g,e);
  else if(aid==='mouth') drawMouth(g,e);
  else if(aid==='guardian') drawGuardian(g,e);
  else if(aid==='sentinel') drawSentinel(g,e);
  else if(aid==='slimeking') drawSlimeking(g,e);
  else if(aid==='runemage') drawRunemage(g,e);
  else if(aid==='succuqueen') drawSuccuqueen(g,e);
  else if(aid==='gobking') drawGobking(g,e);
  else if(aid==='slug') drawSlug(g,e);
  else if(aid==='ghost') drawGhost(g,e);
  else if(aid==='slime') drawSlime(g,e,false);
  else if(aid==='mistslime') drawSlime(g,e,true);
  else if(aid==='worm') drawWormG(g,e);
  else if(aid==='gas') drawGas(g,e);
  else if(aid==='imp') drawImp(g,e);
  else if(aid==='flower') drawFlower(g,e);
  else if(aid==='gtent') drawGtent(g,e);
  else if(aid==='goblin') drawGoblin(g,e);
  else if(aid==='leech') drawLeech(g,e);
  else if(aid==='hand') drawHand(g,e);
  else if(aid==='serpent') drawSerpent(g,e);
  else if(aid==='moth') drawMoth(g,e);
  else if(aid==='pot') drawPot(g,e);
  else if(aid==='slugqueen') drawQueen(g,e);
  else if(aid==='dreamtree') drawDreamtree(g,e);
  else if(aid==='tower') drawTower(g,e);
  else if(aid==='nichelord') drawNichelord(g,e);
  else if(aid==='seatflesh') drawSeatflesh(g,e);
  else if(aid==='heartroot') drawHeartroot(g,e);
  else if(aid==='tallykeeper') drawTallykeeper(g,e);
  else if(aid==='mirrorqueen') drawMirrorqueen(g,e);
  else if(aid==='nevermet') drawNevermet(g,e);
  else if(aid==='firstslug') drawFirstslug(g,e);
  else if(aid==='mirrorling') drawMirrorling(g,e);
  else if(aid==='glyphmite') drawGlyphmite(g,e);
  else if(aid==='silkmite') drawSilkmite(g,e);
  else if(aid==='frostbud') drawFrostbud(g,e);
  else if(aid==='stiller') drawStiller(g,e);
  else if(aid==='lethemoth') drawLethemoth(g,e);
  else if(aid==='gallery') drawGallery(g,e);
  else if(aid==='echoer') drawEchoer(g,e);
  else if(aid==='bonesoldier') drawBonesoldier(g,e);
  else if(aid==='spore') drawSpore(g,e);
  else if(aid==='ghosthand') drawGhosthand(g,e);
  else if(aid==='eye') drawEye(g,e);
  else if(aid==='succubus') drawSuccubus(g,e);
  else if(aid==='web') drawWeb(g,e);
  else if(aid==='gazer') drawGazer(g,e);
  else if(aid==='beamer') drawBeamer(g,e);
  else if(aid==='bossgazer') drawBossgazer(g,e);
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
  const aid=e.art||e.id, rk=(e.rank||0);
  sil(e.elite?OUTLINE_ELITE:(OUTLINE_COL[aid]||OUTLINE_DEF),0,0);          // 色トレス線(1ワールドpx)
  for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) cg.drawImage(SIL_CV,0,0,SP,SP,dx*k,dy*k,SP,SP);
  /* v6.0 熟れた個体: 骨格は一切変えず、輪郭に桃の発光を回す(段が上がるほど太く)。
     ★大きさで強さを表現しない——大きくした瞬間、上位個体が「別の種」に見えてしまう */
  if(rk>0){ sil('rgba(255,179,207,'+(0.30+0.10*rk).toFixed(2)+')',0,0);
    const w=1+rk; for(let dy=-w;dy<=w;dy++) for(let dx=-w;dx<=w;dx++){ if(dx*dx+dy*dy>w*w) continue; cg.drawImage(SIL_CV,0,0,SP,SP,dx*k,dy*k,SP,SP); } }
  cg.drawImage(SHADE_CV,0,0,SP,SP,0,0,SP,SP);
  /* 体色を一段沈ませる(段ごとに −8%)。輪郭の桃と合わせて「同じ種の、濃い個体」に見せる */
  if(rk>0){ sil('rgba(20,10,24,'+(0.08*rk).toFixed(2)+')',0,0); cg.drawImage(SIL_CV,0,0,SP,SP,0,0,SP,SP); }
  const k1=e.r<12?1.3:1.8, k2=k1*2.2, tr=TRANSLUCENT.has(aid)?0.5:1;         // 左上からの光: 右下に帯
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
  const lv=gfxLv(), aid=e.art||e.id;   /* v6.0 絵は base で引く(上位個体は骨格を変えない) */
  let ph=Math.floor((((e.t+e.joff)%2)+2)%2*8); if(lv===0) ph&=~1;
  const vr=(lv===0||!VARI_SPECIES.has(aid))?0:(e.vari||0);
  let st='';
  switch(aid){
    case 'worm': st=e.pounceT>0?'p':''; break;
    case 'inyoku': st=e.swoopT>0?'s':''; break;
    case 'suiyou': st=e.sub?'u':''; break;
    case 'mouth': st=(e.grabCd||0)>3?'o':''; break;
    case 'guardian': st=e.aimT>0?'a'+Math.min(3,Math.floor((1-e.aimT/1.2)*4)):''; break;
    case 'sentinel': st=(G.B&&G.B.sentRing&&G.B.sentRing.stepT>0)?'s':(e.state==='idle'?'h':(G.B&&G.B.sentRing&&G.B.sentRing.alert?'a':'')); break;
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
  /* ★鍵には「絵を決めるもの」だけを入れる。id ではなく art と段(rank)で引く——
     id を入れると上位個体ぶんだけ鍵が倍に膨れて、キャッシュが回らなくなる */
  return aid+'|'+Math.round(e.r)+'|'+(e.elite?'E':'')+vr+'|'+(e.rank||0)+'|'+st+'|'+ph+'|'+gfxK();
}
let NO_IRIS=false;   // 焼き中は目玉の虹彩・瞳・照射触手の水晶を描かない(視線で鍵が8倍に膨れるので、MON_IRIS が毎フレーム生で重ねる)
function bakeSprite(e,key,R,S){
  const k=gfxK();
  const cv=document.createElement('canvas'); cv.width=S*k; cv.height=S*k; const cg=cv.getContext('2d');
  const t0=e.t, jo=e.joff; e.t=Math.floor((((e.t+e.joff)%2)+2)%2*8)/8+0.0001; e.joff=0;
  NO_IRIS=!!MON_IRIS[e.art||e.id];
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
  coreling(g,e){ if(e.state!=='attached') return; const r=e.r, t=(G.B?G.B.time:0);   // v4.0 吸い上げている輪(親へ送っている合図)
    g.save(); g.globalAlpha=0.45+0.3*Math.abs(Math.sin(t*4)); g.strokeStyle='#ff8cb9'; g.lineWidth=2;
    g.beginPath(); g.ellipse(0,-r*0.2,r*1.35,r*1.2,0,0,TAU); g.stroke();
    g.fillStyle='#fff0f6'; g.globalAlpha=0.9; g.beginPath(); g.ellipse(0,-r*0.3,r*0.09,r*0.3,0,0,TAU); g.fill(); g.restore(); },
};
/* 焼いた絵の上に重ねる生きた部分(≤3回の塗り)。ゴーストの瞳は彼女を追い、小淫魔は近づくと頰を染め、目玉は瞬く */
const MON_OVER={
  /* v6.0 三つ目の観客: 組の間に光の線で三角形を張る。★三角形の中に居ることが一目で分かる。
     視線が全部通っている(=効いている)時だけ濃くする */
  gallery(g,e){
    const B=G.B; if(!B) return;
    const kin=B.enemies.filter(o=>!o.dead&&o.id==='gallery');
    if(kin.indexOf(e)!==0 || kin.length<3) return;
    const on=!!B.galleryOn;
    g.save(); g.setTransform(1,0,0,1,0,0); g.translate(-e.x,-e.y);   /* 本体のローカル座標を解いて世界座標で引く */
    g.strokeStyle=on?'rgba(255,180,220,0.42)':'rgba(255,180,220,0.16)'; g.lineWidth=on?1.6:1;
    g.beginPath();
    for(let i=0;i<3;i++){ const a2=kin[i], b2=kin[(i+1)%3]; g.moveTo(a2.x,a2.y-a2.r*0.7); g.lineTo(b2.x,b2.y-b2.r*0.7); }
    g.stroke();
    const p=B.hero;
    if(p && on){ g.strokeStyle='rgba(255,200,230,0.30)'; g.lineWidth=1;
      g.beginPath(); for(const k of kin){ g.moveTo(k.x,k.y-k.r*0.7); g.lineTo(p.x,p.y-14); } g.stroke(); }
    g.restore();
  },
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
/* ================= v3.2 巣窟の仕掛け ================= */
/* 床の魔法陣: 灯る直前は薄く脈打ち、踏まれた瞬間に強く灯る */
function drawDenRune(g,r){
  const t=(G.B?G.B.time:0), pulse=0.5+0.5*Math.sin(t*1.8+r.x*0.01), a=0.22+0.16*pulse+0.55*(r.glow||0);
  g.save(); g.translate(r.x,r.y); g.globalAlpha=a;
  g.strokeStyle='#c98cff'; g.lineWidth=2; g.beginPath(); g.ellipse(0,0,30,13,0,0,TAU); g.stroke();
  g.lineWidth=1.2; g.beginPath(); g.ellipse(0,0,20,9,0,0,TAU); g.stroke();
  for(let k=0;k<6;k++){ const ang=k*TAU/6+t*0.25; g.beginPath(); g.moveTo(Math.cos(ang)*20,Math.sin(ang)*9); g.lineTo(Math.cos(ang)*30,Math.sin(ang)*13); g.stroke(); }
  if(r.glow>0){ g.globalAlpha=r.glow*0.5; g.fillStyle='#ff86b3'; g.beginPath(); g.ellipse(0,0,30,13,0,0,TAU); g.fill(); }
  g.restore();
}
/* 媚薬の花: 息をするように開いて、甘いものを吐く */
function drawDenFlower(g,f){
  const t=(G.B?G.B.time:0), open=0.35+0.65*(f.bloom||0);
  g.save(); g.translate(f.x,f.y);
  g.globalAlpha=0.5; g.strokeStyle='#6a9a5a'; g.lineWidth=2; g.beginPath(); g.moveTo(0,0); g.quadraticCurveTo(2,-8,0,-15); g.stroke();
  g.globalAlpha=0.9;
  for(let k=0;k<5;k++){ const ang=k*TAU/5+Math.sin(t*0.6)*0.15;
    g.fillStyle=k%2?'#ff9ec2':'#ffc2d8';
    g.beginPath(); g.ellipse(Math.cos(ang)*7*open, -15+Math.sin(ang)*4*open, 6.5*open, 3.4*open, ang, 0, TAU); g.fill(); }
  g.fillStyle='#ffe9a8'; g.beginPath(); g.arc(0,-15,2.6,0,TAU); g.fill();
  if(f.bloom>0){ g.globalAlpha=f.bloom*0.35; glow(g,0,-15,42,'255,158,194',0.5); }
  g.restore();
}
/* 壁に埋まった光線の口: 狙っている間は細い線、撃つ瞬間に太く光る */
function drawDenBeam(g,bm){
  const t=(G.B?G.B.time:0), col=bm.type==='hypno'?'#b46cff':'#ff86b3';
  g.save(); g.translate(bm.x,bm.y);
  g.globalAlpha=0.85; g.fillStyle='#1a1220'; g.beginPath(); g.ellipse(0,0,11,8,bm.ang,0,TAU); g.fill();
  g.globalAlpha=bm.state==='idle'?(0.35+0.2*Math.sin(t*2)):0.95;
  g.fillStyle=col; g.beginPath(); g.ellipse(0,0,6,4.4,bm.ang,0,TAU); g.fill();
  g.restore();
  if(bm.state==='aim'){   // 狙い: 細い線が伸びる(壁で止まる)
    const L=(typeof denBeamLen==='function')?denBeamLen(bm.ox,bm.oy,bm.aimA):BAL.DEN_BEAM_LEN;
    g.save(); g.globalAlpha=0.30+0.25*Math.sin(t*22); g.strokeStyle=col; g.lineWidth=1.6;
    g.beginPath(); g.moveTo(bm.ox,bm.oy); g.lineTo(bm.ox+Math.cos(bm.aimA)*L, bm.oy+Math.sin(bm.aimA)*L); g.stroke(); g.restore();
  }
}
function drawDen(g){
  const B=G.B, D=B&&B.den; if(!D) return;
  for(const r of D.runes) drawDenRune(g,r);
  for(const f of D.flowers) drawDenFlower(g,f);
  for(const bm of D.beams) drawDenBeam(g,bm);
}
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
  if(tr.night && tr.armed) drawNightMark(g,tr.x,tr.y-tr.r*0.55-12,{rune:'✧',suit:'🎀',freeze:'⏳'}[tr.kind||'rune']);   // v2.2 設置の印
}
/* v2.2 夜側の設置物の印: 小さな紫のひし形と品の記号(プレイヤーだけが見て分かる) */
function drawNightMark(g,x,y,icon){
  g.save(); g.translate(x,y); g.globalAlpha=0.9;
  g.fillStyle='rgba(120,60,200,0.85)'; g.beginPath(); g.moveTo(0,-7); g.lineTo(6,0); g.lineTo(0,7); g.lineTo(-6,0); g.closePath(); g.fill();
  g.strokeStyle='rgba(230,200,255,0.9)'; g.lineWidth=1; g.stroke();
  if(icon){ g.font='9px '+FONT; g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='#fff'; g.fillText(icon,0,-14); }
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
/* v2.0 淫翼: 桃色の翼の小さな飛行種。急降下(swoopT)では翼を畳む */
function drawInyoku(g,e){
  g.save();
  glow(g,0,-e.r*0.8,e.r*1.6,'255,160,200',0.18);
  drawBat(g,e,e.swoopT>0?0.85:1.0,'#f2a7c7','#c85a90');
  g.fillStyle='rgba(255,230,245,0.9)'; g.beginPath(); g.arc(-e.r*0.3,-e.r*0.9,e.r*0.09,0,TAU); g.fill(); g.beginPath(); g.arc(e.r*0.3,-e.r*0.9,e.r*0.09,0,TAU); g.fill();
  if(e.swoopT<=0){ for(let i=0;i<3;i++){ const a=e.t*2+i*2.1; g.fillStyle='rgba(255,190,220,'+(0.35+0.25*Math.sin(e.t*5+i))+')'; g.beginPath(); g.arc(Math.cos(a)*e.r*1.3,-e.r*0.6+Math.sin(a)*e.r*0.5,1.4,0,TAU); g.fill(); } }
  g.restore();
}
/* v2.0 水妖: 水面下(sub)では波紋だけ。浮かぶと水の女の上体と、腕になった水 */
function drawSuiyou(g,e){
  const r=e.r, t=e.t;
  g.save();
  if(e.sub){
    g.strokeStyle='rgba(200,240,255,0.45)'; g.lineWidth=1.2;
    for(let i=0;i<2;i++){ const ph=(t*0.5+i*0.5)%1; g.beginPath(); g.ellipse(0,0,6+ph*18,(6+ph*18)*0.4,0,0,TAU); g.stroke(); }
    g.fillStyle='rgba(120,190,230,0.35)'; g.beginPath(); g.ellipse(0,0,r*0.7,r*0.3,0,0,TAU); g.fill();
    g.restore(); return;
  }
  g.fillStyle='rgba(60,140,210,0.35)'; g.beginPath(); g.ellipse(0,2,r*1.4,r*0.55,0,0,TAU); g.fill();
  const grad=g.createLinearGradient(0,-r*2,0,0); grad.addColorStop(0,'rgba(200,240,255,0.85)'); grad.addColorStop(1,'rgba(70,150,220,0.6)');
  g.fillStyle=grad;
  g.beginPath(); g.moveTo(-r*0.9,0); g.quadraticCurveTo(-r*0.8,-r*1.1,-r*0.45,-r*1.5); g.quadraticCurveTo(0,-r*2.15,r*0.45,-r*1.5); g.quadraticCurveTo(r*0.8,-r*1.1,r*0.9,0); g.closePath(); g.fill();
  g.strokeStyle='rgba(230,250,255,0.7)'; g.lineWidth=2.4; g.lineCap='round';
  for(const sd of [-1,1]){ g.beginPath(); g.moveTo(sd*r*0.5,-r*1.0); g.quadraticCurveTo(sd*r*1.3,-r*0.9+Math.sin(t*4)*4,sd*r*1.6,-r*0.2+Math.sin(t*3.3)*5); g.stroke(); }
  g.fillStyle='#e8f8ff'; g.beginPath(); g.arc(-r*0.22,-r*1.55,r*0.1,0,TAU); g.fill(); g.beginPath(); g.arc(r*0.22,-r*1.55,r*0.1,0,TAU); g.fill();
  for(let i=0;i<3;i++){ const ph=(t*0.9+i/3)%1; g.fillStyle='rgba(220,245,255,'+(0.8-ph*0.7)+')'; g.beginPath(); g.arc(Math.sin(i*2.4+t)*r*0.8,-r*1.4+ph*r*1.6,1.6,0,TAU); g.fill(); }
  g.restore();
}
/* v2.0 肉壁の口: 床に開いた濡れた口。掴んでいる(grabCd>3)間は開く */
function drawMouth(g,e){
  const r=e.r, t=e.t, open=(e.grabCd||0)>3?1:0.35+0.15*Math.sin(t*2.2);
  g.save();
  g.fillStyle='rgba(60,10,30,0.5)'; g.beginPath(); g.ellipse(0,2,r*1.55,r*0.75,0,0,TAU); g.fill();
  g.fillStyle='#8a3458'; g.beginPath(); g.ellipse(0,0,r*1.4,r*0.66,0,0,TAU); g.fill();
  g.fillStyle='#2a0612'; g.beginPath(); g.ellipse(0,0,r*1.05,r*0.42*open,0,0,TAU); g.fill();
  g.fillStyle='rgba(230,90,140,0.7)'; g.beginPath(); g.ellipse(0,r*0.1*open,r*0.7,r*0.22*open,0,0,TAU); g.fill();
  g.strokeStyle='#c2456f'; g.lineWidth=3.2; g.lineCap='round';
  g.beginPath(); g.ellipse(0,0,r*1.15,r*0.5*open+2,0,0,TAU); g.stroke();
  g.fillStyle='rgba(255,220,235,0.45)'; g.beginPath(); g.ellipse(-r*0.4,-r*0.42*open-2,r*0.35,r*0.09,0,0,TAU); g.fill();
  for(let i=0;i<3;i++){ const ph=(t*0.7+i/3)%1; g.fillStyle='rgba(255,180,210,'+(0.5-ph*0.4)+')'; g.beginPath(); g.arc(-r*0.6+i*r*0.6,r*0.5*open+ph*6,1.5,0,TAU); g.fill(); }
  g.restore();
}
/* v2.0 遺跡の番人: 膝をついて祈る石像。額の紋が予兆(aimT)で強く光る */
function drawGuardian(g,e){
  const r=e.r, t=e.t, aim=e.aimT>0?1-e.aimT/1.2:0;
  g.save();
  g.fillStyle='rgba(8,8,26,0.4)'; g.beginPath(); g.ellipse(0,4,r*1.3,r*0.5,0,0,TAU); g.fill();
  g.fillStyle='#4a4a62'; g.fillRect(-r*1.1,-2,r*2.2,6);
  g.fillStyle='#62627e';
  g.beginPath(); g.moveTo(-r*0.8,0); g.lineTo(-r*0.6,-r*1.2); g.quadraticCurveTo(0,-r*1.7,r*0.6,-r*1.2); g.lineTo(r*0.8,0); g.closePath(); g.fill();
  g.fillStyle='#6e6e8a'; g.beginPath(); g.arc(0,-r*1.85,r*0.42,0,TAU); g.fill();
  g.fillStyle='#55556e'; g.beginPath(); g.ellipse(0,-r*0.55,r*0.32,r*0.5,0,0,TAU); g.fill();   // 合わせた手
  g.strokeStyle='#3a3a50'; g.lineWidth=1; g.beginPath(); g.moveTo(-r*0.5,-r*1.0); g.lineTo(-r*0.3,-r*0.2); g.moveTo(r*0.5,-r*1.0); g.lineTo(r*0.3,-r*0.2); g.stroke();
  const c=aim>0?'201,140,255':'160,120,220';
  glow(g,0,-r*1.95,r*(0.6+aim*0.9),c,0.3+aim*0.5);
  g.fillStyle=aim>0?'#e6d0ff':'#b08cff'; g.beginPath(); g.arc(0,-r*1.95,r*0.12+aim*r*0.06,0,TAU); g.fill();
  if(aim>0){ g.strokeStyle='rgba(201,140,255,'+(0.3+0.5*aim)+')'; g.lineWidth=1.5; const la=e.lookA||0; for(let i=-1;i<=1;i++){ const a=la+i*0.22; g.beginPath(); g.moveTo(Math.cos(a)*r*0.6,-r*1.1+Math.sin(a)*r*0.6); g.lineTo(Math.cos(a)*r*(1.2+aim*3),-r*1.1+Math.sin(a)*r*(1.2+aim*3)); g.stroke(); } }
  g.restore();
}
/* v2.1 石の番兵: 兜をかぶった石像の兵。輪で回る時は腕を胸の前に、警戒すると腕を前へ、踏み込み(stepT)で前傾、抱え込み(idle)では腕を大きく開いて閉じる */
function drawSentinel(g,e){
  const r=e.r, t=e.t, R=G.B&&G.B.sentRing, step=(R&&R.stepT>0)?1:0, alert=!!(R&&R.alert), hold=e.state==='idle';
  const lean=step?0.28:(alert?0.1:0);
  g.save();
  g.fillStyle='rgba(8,8,26,0.4)'; g.beginPath(); g.ellipse(0,3,r*1.15,r*0.42,0,0,TAU); g.fill();
  g.rotate(lean*(e.lookA!==undefined?Math.sign(Math.cos(e.lookA||0))||1:1)*0.35);
  // 脚(石の柱)
  g.fillStyle='#565d80'; g.fillRect(-r*0.62,-r*0.9,r*0.46,r*0.95); g.fillRect(r*0.16,-r*0.9,r*0.46,r*0.95);
  g.fillStyle='#3e4460'; g.fillRect(-r*0.7,-r*0.05,r*0.6,r*0.12); g.fillRect(r*0.1,-r*0.05,r*0.6,r*0.12);
  // 胴(角の丸い石塊)と胸当て
  const bodyG=g.createLinearGradient(-r,0,r,0); bodyG.addColorStop(0,'#7a82a8'); bodyG.addColorStop(0.5,'#9aa3c8'); bodyG.addColorStop(1,'#6a7296');
  g.fillStyle=bodyG; rr(g,-r*0.85,-r*2.05,r*1.7,r*1.25,r*0.35); g.fill();
  g.strokeStyle='rgba(30,32,56,0.55)'; g.lineWidth=1.2; g.beginPath(); g.moveTo(-r*0.5,-r*1.7); g.lineTo(-r*0.2,-r*1.2); g.moveTo(r*0.45,-r*1.9); g.lineTo(r*0.25,-r*1.45); g.stroke();   // ひび
  g.fillStyle='rgba(143,211,255,'+(alert?0.55:0.25)+')'; g.beginPath(); g.arc(0,-r*1.5,r*0.16,0,TAU); g.fill();   // 胸の紋(警戒で明るい)
  // 腕: 輪では胸の前、警戒で前へ、抱え込みでは大きく開いて閉じる形
  g.strokeStyle='#8790b4'; g.lineWidth=r*0.34; g.lineCap='round';
  const sw=hold?0.9:(alert?0.55:0.15), fw=hold?r*1.1:(alert?r*0.9:r*0.45), ph=Math.sin(t*2.2)*0.05;
  for(const sd of [-1,1]){ g.beginPath(); g.moveTo(sd*r*0.8,-r*1.75); g.quadraticCurveTo(sd*r*(1.15+sw*0.3),-r*(1.4+ph),sd*r*(1.0-sw*0.6)+fw*0.0,-r*(1.05+sw*0.4)); g.stroke(); }
  if(hold||alert){ g.strokeStyle='#9aa3c8'; g.lineWidth=r*0.3; g.beginPath(); g.moveTo(-r*0.45,-r*1.2); g.lineTo(fw*0.5,-r*1.05); g.moveTo(r*0.45,-r*1.2); g.lineTo(fw*0.5,-r*1.05); g.stroke(); }
  // 兜と面(無表情。目の穴だけ淡く光る)
  g.fillStyle='#6f77a0'; g.beginPath(); g.arc(0,-r*2.35,r*0.6,Math.PI,0); g.lineTo(r*0.6,-r*2.0); g.lineTo(-r*0.6,-r*2.0); g.closePath(); g.fill();
  g.fillStyle='#4a5074'; g.fillRect(-r*0.62,-r*2.1,r*1.24,r*0.14);
  g.fillStyle='#3a3f5e'; g.fillRect(-r*0.42,-r*2.28,r*0.84,r*0.22);
  const ec=alert?'rgba(160,215,255,0.95)':'rgba(140,170,220,0.55)'; g.fillStyle=ec; g.fillRect(-r*0.32,-r*2.24,r*0.2,r*0.12); g.fillRect(r*0.12,-r*2.24,r*0.2,r*0.12);
  if(step){ glow(g,0,-r*1.5,r*1.4,'143,211,255',0.35); }
  g.restore();
}
/* v2.0 魔核: 最深部の心臓。濡れた肉の塊、太い根、縦に裂けた目。脈動(pulseT)で膨らみ、鞭(whipT)で根が彼女へ伸びる */
/* v5.0 媚薬沼: 桃色に濁った甘い水溜まり。縁からえっちな触手が生えていて、近づくと伸びてくる */
function drawMireTent(g,m,tn,t){
  const bx=Math.cos(tn.a)*m.r*0.82, by=Math.sin(tn.a)*m.r*0.6;
  const wav=Math.sin(t*2.2+tn.ph), L=m.r*(0.55+0.30*wav)+BAL.MIRE_TENT_R*tn.reach*0.55;
  const ex=bx+Math.cos(tn.a)*L, ey=by+Math.sin(tn.a)*L*0.8-8;
  g.strokeStyle='rgba(196,74,132,0.92)'; g.lineWidth=5.2; g.lineCap='round';
  g.beginPath(); g.moveTo(bx,by);
  g.quadraticCurveTo(bx+Math.cos(tn.a+0.7)*L*0.6, by+Math.sin(tn.a+0.7)*L*0.4-6, ex, ey); g.stroke();
  g.strokeStyle='rgba(255,170,210,0.55)'; g.lineWidth=1.6;
  g.beginPath(); g.moveTo(bx,by);
  g.quadraticCurveTo(bx+Math.cos(tn.a+0.7)*L*0.6, by+Math.sin(tn.a+0.7)*L*0.4-6, ex, ey); g.stroke();
  g.fillStyle=tn.reach>0.2?'#ffd0e4':'#e08ac0';
  g.beginPath(); g.ellipse(ex,ey,3.4,2.6,tn.a,0,TAU); g.fill();
  for(let k=1;k<=3;k++){ const u=k/4, px=bx+(ex-bx)*u, py=by+(ey-by)*u;
    g.fillStyle='rgba(255,190,225,0.5)'; g.beginPath(); g.arc(px+Math.cos(tn.a+1.6)*2.2,py+Math.sin(tn.a+1.6)*1.8,1.3,0,TAU); g.fill(); }
}
/* v5.0 救出の一幕: 三体に囲まれて、抵抗の形すら残っていない。吸っていた闇が抜けて、白く漏れている */
function drawYamiCap(g,C){
  if(C.freed) return;
  const t=C.t, lift=Math.sin(t*1.6)*3;
  g.save(); g.translate(C.x, C.y);
  /* 漏れた光の溜まり */
  const gg=g.createRadialGradient(0,-14,6,0,-14,86);
  gg.addColorStop(0,'rgba(255,240,255,0.45)'); gg.addColorStop(1,'rgba(200,170,255,0)');
  g.fillStyle=gg; g.beginPath(); g.arc(0,-14,86,0,TAU); g.fill();
  /* 押さえつけられた翼(四枚。開いたまま閉じられない) */
  g.fillStyle='rgba(42,26,62,0.72)';
  for(const sx of [-1,1]) for(const k of [0,1]){
    const a=(0.35+k*0.5)*1, L=26-k*6;
    g.save(); g.scale(sx,1); g.rotate(a);
    g.beginPath(); g.moveTo(4,-12); g.quadraticCurveTo(L*0.9,-20,L,-4); g.quadraticCurveTo(L*0.6,-4,5,-6); g.closePath(); g.fill(); g.restore();
  }
  /* 仰向けの身体。輪郭が白く抜けている */
  g.fillStyle='rgba(58,36,86,0.95)';
  g.beginPath(); g.ellipse(0,-12+lift*0.3,15,9,0.12,0,TAU); g.fill();
  g.fillStyle='rgba(255,246,255,0.85)';
  g.beginPath(); g.ellipse(0,-12+lift*0.3,15,9,0.12,0,TAU); g.globalAlpha=0.35; g.fill(); g.globalAlpha=1;
  g.fillStyle='#2a1a3e'; g.beginPath(); g.arc(-11,-17+lift*0.4,6.4,0,TAU); g.fill();   // 仰け反った頭
  /* 吸われきったヘイロー(輪が欠けている) */
  g.strokeStyle='rgba(200,170,255,0.85)'; g.lineWidth=2;
  g.beginPath(); g.ellipse(-11,-27+lift*0.4,9,3.2,0,0.5,TAU-0.9); g.stroke();
  /* 漏れる光の粒 */
  for(let i=0;i<5;i++){ const ph=(t*0.5+i*0.2)%1;
    g.fillStyle='rgba(255,240,255,'+((1-ph)*0.55).toFixed(2)+')';
    g.beginPath(); g.arc(Math.sin(i*2.3+t)*16, -18-ph*34, 1.6+ph*2.4, 0, TAU); g.fill(); }
  /* 救出の進み */
  if(C.save>0){
    const pr=Math.min(1,C.save/BAL.YAMI_SAVE_T);
    g.strokeStyle='rgba(255,255,255,0.9)'; g.lineWidth=3; g.lineCap='round';
    g.beginPath(); g.arc(0,-14,44,-Math.PI/2,-Math.PI/2+TAU*pr); g.stroke();
  }
  g.restore();
}
/* v5.0 渦の眠り手。横たわっている間は闇が薄く、目覚めると光を吸って濃くなる */
function drawYamiBoss(g,e){
  const R=e.r, t=(G.B?G.B.time:0), asleep=!!e.asleep, melt=(e.meltT||0)>0;
  g.save();
  if(melt) g.globalAlpha=0.28;
  /* 吸い込む闇の縁 */
  const gg=g.createRadialGradient(0,-R*0.6,R*0.3,0,-R*0.6,R*2.4);
  gg.addColorStop(0,'rgba(42,26,62,0.85)'); gg.addColorStop(1,'rgba(20,10,30,0)');
  g.fillStyle=gg; g.beginPath(); g.arc(0,-R*0.6,R*2.4,0,TAU); g.fill();
  if(asleep){
    /* 横たわっている: 翼を畳んだ影 */
    g.fillStyle='#2a1a3e'; g.beginPath(); g.ellipse(0,-R*0.25,R*1.25,R*0.55,0.18,0,TAU); g.fill();
    g.fillStyle='#3a2456'; g.beginPath(); g.ellipse(-R*0.5,-R*0.4,R*0.42,R*0.3,-0.4,0,TAU); g.fill();
    g.strokeStyle='rgba(167,125,255,0.5)'; g.lineWidth=1.6;
    g.beginPath(); g.moveTo(-R*1.0,-R*0.1); g.quadraticCurveTo(0,-R*0.9,R*1.0,-R*0.15); g.stroke();
    g.fillStyle='rgba(232,216,255,0.5)'; g.beginPath(); g.arc(R*0.55,-R*0.45,R*0.14,0,TAU); g.fill();   // 眠っている顔のあたり
    g.restore(); return;
  }
  /* 起きている: 立ち上がった影と、四枚の裂けた翼 */
  g.fillStyle='#2a1a3e';
  for(const sx of [-1,1]) for(const k of [0,1]){
    const a=(-0.55-k*0.55)*1, L=R*(1.6-k*0.35), wob=Math.sin(t*2+k)*0.12;
    g.save(); g.scale(sx,1); g.rotate(a+wob);
    g.beginPath(); g.moveTo(R*0.2,-R*0.7); g.quadraticCurveTo(L*0.8,-R*1.5,L,-R*0.5);
    g.quadraticCurveTo(L*0.6,-R*0.35,R*0.25,-R*0.5); g.closePath(); g.fill(); g.restore();
  }
  g.fillStyle='#3a2456'; g.beginPath(); g.ellipse(0,-R*0.9,R*0.42,R*0.86,0,0,TAU); g.fill();
  g.fillStyle='#2a1a3e'; g.beginPath(); g.arc(0,-R*1.65,R*0.36,0,TAU); g.fill();
  /* 光を吸われた輪(ヘイローの反転) */
  g.strokeStyle='rgba(167,125,255,0.85)'; g.lineWidth=2.4;
  g.beginPath(); g.ellipse(0,-R*2.15,R*0.5,R*0.18,0,0,TAU); g.stroke();
  g.fillStyle='rgba(232,216,255,0.9)';
  for(const sx of [-1,1]){ g.beginPath(); g.ellipse(sx*R*0.15,-R*1.7,R*0.09,R*0.055,0,0,TAU); g.fill(); }
  if((e.swing||0)>0){ e.swing-=1/60;
    g.save(); g.rotate(e.swingA||0); g.strokeStyle='rgba(167,125,255,0.6)'; g.lineWidth=4;
    g.beginPath(); g.arc(0,-R*0.6,R*2.2,-0.9,0.9); g.stroke(); g.restore(); }
  g.restore();
}
/* v5.0 図鑑の絵姿: 沼から生えた一本の触手(沼の縁も少しだけ描く) */
function drawMiretentBody(g,e){
  const R=e.r||10, t=(G.B?G.B.time:0)*1.6+(e.ph||0);
  g.fillStyle='rgba(120,32,74,0.55)'; g.beginPath(); g.ellipse(0,R*0.7,R*1.5,R*0.52,0,0,TAU); g.fill();
  g.fillStyle='rgba(200,86,130,0.42)'; g.beginPath(); g.ellipse(0,R*0.7,R*1.1,R*0.36,0,0,TAU); g.fill();
  const ex=Math.sin(t)*R*0.8, ey=-R*2.0;
  g.strokeStyle='#c44a84'; g.lineWidth=R*0.48; g.lineCap='round';
  g.beginPath(); g.moveTo(0,R*0.6); g.quadraticCurveTo(-R*0.7,-R*0.7,ex,ey); g.stroke();
  g.strokeStyle='rgba(255,170,210,0.5)'; g.lineWidth=R*0.16;
  g.beginPath(); g.moveTo(0,R*0.6); g.quadraticCurveTo(-R*0.7,-R*0.7,ex,ey); g.stroke();
  g.fillStyle='#ffd0e4'; g.beginPath(); g.ellipse(ex,ey,R*0.34,R*0.26,0,0,TAU); g.fill();
  for(let k=1;k<=3;k++){ const u=k/4, px=(-R*0.7)*2*u*(1-u)+ex*u*u, py=R*0.6*(1-u)*(1-u)+(-R*0.7)*2*u*(1-u)+ey*u*u;
    g.fillStyle='rgba(255,190,225,0.55)'; g.beginPath(); g.arc(px+R*0.2,py,R*0.13,0,TAU); g.fill(); }
}
/* v5.8 液面そのものはマップチップが描く(map.js の MIRE_ROW)。
   ここで重ねるのは動くものだけ——照り・泡・水面のうねり・縁から伸びる触手。
   えちえちエリアと同じ「地形はチップ／生きている物はスプライト」の分け方に揃えた */
function drawMire(g,m){
  const t=m.t;
  if(m.dry||m.iced) return;
  if(Math.abs(m.x-G.cam.x)>W/2+m.r*2 || Math.abs(m.y-G.cam.y)>H/2+m.r*2) return;
  g.save(); g.translate(m.x,m.y);
  for(let i=0;i<m.tents.length;i++){ const tn=m.tents[i]; if(Math.sin(tn.a)>0) continue; drawMireTent(g,m,tn,t); }
  g.save();
  g.beginPath(); g.ellipse(0,0,m.r*0.94,m.r*0.94*0.78,0,0,TAU); g.clip();   /* チップの縁からはみ出さない */
  g.fillStyle='rgba(255,220,240,'+(0.14+0.06*Math.sin(t*0.9)).toFixed(3)+')';
  g.beginPath(); g.ellipse(-m.r*0.28,-m.r*0.26,m.r*0.36,m.r*0.14,-0.4,0,TAU); g.fill();
  g.strokeStyle='rgba(255,190,225,0.22)'; g.lineWidth=1.4;                   /* ゆっくり広がるうねり */
  for(let i=0;i<2;i++){ const ph=((t*0.28+i*0.5)%1), rr=m.r*(0.15+0.8*ph);
    g.globalAlpha=(1-ph)*0.5; g.beginPath(); g.ellipse(0,0,rr,rr*0.78,0,0,TAU); g.stroke(); }
  g.globalAlpha=1;
  const nb=2+Math.round(3*m.depth);                                          /* 深い沼ほど泡が多い */
  for(let i=0;i<nb;i++){ const ph=((t*0.35+i*0.27)%1), a=i*1.9+t*0.15;
    g.fillStyle='rgba(255,200,230,'+((1-ph)*0.55).toFixed(2)+')';
    g.beginPath(); g.arc(Math.cos(a)*m.r*0.5,Math.sin(a)*m.r*0.36-ph*4,1.6+ph*2.6,0,TAU); g.fill(); }
  g.restore();
  for(let i=0;i<m.tents.length;i++){ const tn=m.tents[i]; if(Math.sin(tn.a)<=0) continue; drawMireTent(g,m,tn,t); }
  glow(g,0,0,m.r*1.5,'255,110,180',0.10+0.08*Math.sin(t*1.6));
  g.restore();
}
/* v4.1 菌輪: 床に小さな茸が輪になって生えている。踏み込むと一斉にふくらんで、柔らかい壁になる */
/* ================= v6.0 新しい床の「動く分」 =================
   チップが焼くのは静止画。ここで重ねるのは、状態で変わるものだけ——
   凪いだ面に映る姿・灯った紋・時の澱の残像・忘れ水の渦。
   ★毎フレーム舐めるのは画面内のタイルだけに限る */
/* v6.0f 14階「厚みの中」: 壁の呼吸。
   ★solid は動かさない(焼き直すと落ちる)。動いて見えるのは、この一枚だけ。
   壁の内側に、位相ぶんだけ膨らんだ肉の縁を描き足す——寄ってくるのは絵、
   効いてくるのは breathHeroTick(壁ぎわで走れず、擦れて敏感化) */
function drawBreath(g){
  const B=G.B, M=G.map; if(!B||!M||!B.floor||!B.floor.breath) return;
  const q=(typeof breathPhase==='function')?breathPhase():0; if(q<=0.01) return;
  const T=MAP_T, t=B.time;
  const i0=Math.max(0,tileI(G.cam.x-W/2)-1), i1=Math.min(MAP_W-1,tileI(G.cam.x+W/2)+1);
  const j0=Math.max(0,tileJ(G.cam.y-H/2)-1), j1=Math.min(MAP_H-1,tileJ(G.cam.y+H/2)+1);
  const d=T*0.5*q;
  g.save();
  g.fillStyle='rgba(160,42,74,'+(0.30+0.34*q).toFixed(3)+')';
  for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){
    const k=j*MAP_W+i; if(!M.solid[k]) continue;
    const x=i*T-MAP_HW, y=j*T-MAP_HH;
    /* 床に面している辺だけ、内側へ膨らませる */
    if(!solidIJ(i,j-1)) g.fillRect(x, y-d, T, d);
    if(!solidIJ(i,j+1)) g.fillRect(x, y+T, T, d);
    if(!solidIJ(i-1,j)) g.fillRect(x-d, y, d, T);
    if(!solidIJ(i+1,j)) g.fillRect(x+T, y, d, T);
  }
  /* 絨毛が一斉に同じ向きへ倒れる */
  g.strokeStyle='rgba(230,130,165,'+(0.16+0.20*q).toFixed(3)+')'; g.lineWidth=1.4;
  g.beginPath();
  for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){
    const k=j*MAP_W+i; if(!M.solid[k]) continue;
    if(solidIJ(i,j+1)) continue;
    const x=i*T-MAP_HW+T*0.5, y=j*T-MAP_HH+T;
    const a=Math.sin(t*1.6+i*0.7)*0.4;
    g.moveTo(x,y); g.lineTo(x+Math.sin(a)*7, y+d+7);
  }
  g.stroke();
  g.restore();
}
function drawZoneV6(g){
  const B=G.B, M=G.map; if(!B||!M||!M.zone) return;
  const T=MAP_T, t=B.time;
  const i0=Math.max(0,tileI(G.cam.x-W/2)-1), i1=Math.min(MAP_W-1,tileI(G.cam.x+W/2)+1);
  const j0=Math.max(0,tileJ(G.cam.y-H/2)-1), j1=Math.min(MAP_H-1,tileJ(G.cam.y+H/2)+1);
  const C=M.calmT, GL=M.glyphT;
  const zMirror=ZONE_IDS.indexOf('mirror'), zGlyph=ZONE_IDS.indexOf('glyph'), zStall=ZONE_IDS.indexOf('stall'), zLethe=ZONE_IDS.indexOf('lethe');
  g.save();
  for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){
    const k=j*MAP_W+i; if(M.solid[k]) continue;
    const z=M.zone[k], x=i*T-MAP_HW, y=j*T-MAP_HH;
    if(z===zMirror && C){
      /* 凪いでいるほど、天井と自分がはっきり映る。走れば波立って消える */
      const cq=C[k]/255; if(cq<=0.12) continue;
      g.globalAlpha=Math.min(0.5,cq*0.5);
      g.fillStyle='rgba(150,200,255,0.16)'; g.fillRect(x,y,T,T);
      if(cq>0.6){ g.strokeStyle='rgba(210,235,255,0.30)'; g.lineWidth=1;
        const w=Math.sin(t*0.7+i*0.3+j*0.2)*1.6;
        g.beginPath(); g.moveTo(x,y+T*0.5+w); g.lineTo(x+T,y+T*0.5-w); g.stroke(); }
      g.globalAlpha=1;
    }else if(z===zGlyph && GL && GL[k]){
      /* 灯った紋は消えない。誰が灯したかで色を変える(自分の足跡が見える) */
      const who=(GL[k]-1)|0, col=['255,150,200','255,170,120','160,220,255','200,160,255'][who%4];
      const ph=0.55+0.25*Math.sin(t*2.0+i*0.7+j*0.5);
      g.strokeStyle='rgba('+col+','+(0.42*ph).toFixed(3)+')'; g.lineWidth=1.6;
      g.beginPath(); g.arc(x+T/2,y+T/2,9,0,TAU); g.stroke();
      g.fillStyle='rgba('+col+','+(0.55*ph).toFixed(3)+')';
      g.beginPath(); g.arc(x+T/2,y+T/2,2.2,0,TAU); g.fill();
    }else if(z===zStall){
      /* 時の澱: 床の模様が、実際に半拍おくれて動く */
      const ph=(t*0.5+i*0.11+j*0.17)%1;
      g.globalAlpha=0.10+0.10*Math.sin(ph*TAU);
      g.fillStyle='rgba(170,160,205,1)';
      g.fillRect(x+2+Math.sin(t*0.8+i)*2, y+2+Math.cos(t*0.8+j)*2, T-4, T-4);
      g.globalAlpha=1;
    }else if(z===zLethe){
      /* 忘れ水: ゆっくり回る渦。中心へ吸われていく */
      const a=t*0.35+i*0.4+j*0.3;
      g.strokeStyle='rgba(230,215,230,0.20)'; g.lineWidth=1;
      g.beginPath(); g.arc(x+T/2,y+T/2, 7+2*Math.sin(t*0.6+i), a, a+2.2); g.stroke();
    }
  }
  g.restore();
}
function drawRing(g,R){
  const t=(G.B?G.B.time:0);
  if(Math.abs(R.x-G.cam.x)>W/2+R.r*1.6 || Math.abs(R.y-G.cam.y)>H/2+R.r*1.6) return;
  const shut=R.state==='shut', cool=R.state==='cool';
  const sw=shut?Math.min(1,(BAL.RING_T-R.t)/0.35):0;         // ふくらむ
  g.save(); g.translate(R.x,R.y);
  // 輪の内側の菌糸(うっすら白い円)
  g.fillStyle=shut?'rgba(226,192,234,0.30)':'rgba(210,220,215,0.13)';
  g.beginPath(); g.ellipse(0,0,R.r,R.r*0.78,0,0,TAU); g.fill();
  if(shut) glow(g,0,0,R.r*1.2,'226,192,234',0.16+0.08*Math.sin(t*5));
  g.strokeStyle=shut?'rgba(232,208,240,0.7)':'rgba(198,212,200,0.42)'; g.lineWidth=shut?2.4:1.6;
  g.setLineDash(shut?[]:[5,4]); g.beginPath(); g.ellipse(0,0,R.r,R.r*0.78,0,0,TAU); g.stroke(); g.setLineDash([]);
  // 輪の茸
  const n=R.caps;
  for(let i=0;i<n;i++){
    const a=i*TAU/n+0.15, x=Math.cos(a)*R.r, y=Math.sin(a)*R.r*0.78;
    const base=cool?0.6:1.0, s=(base+sw*0.9)*(1+0.07*Math.sin(t*2+i));
    g.fillStyle='rgba(8,8,26,0.30)'; g.beginPath(); g.ellipse(x,y+1,5*s,1.8*s,0,0,TAU); g.fill();
    g.fillStyle='#efe6d2'; g.fillRect(x-1.5*s,y-5*s,3.0*s,6*s);
    g.fillStyle=shut?'#e2c0ea':'#d8d0bc';
    g.beginPath(); g.ellipse(x,y-5*s,6.6*s,4.2*s,0,Math.PI,TAU); g.fill();
    g.fillStyle=shut?'rgba(190,140,205,0.75)':'rgba(160,150,130,0.55)';
    g.beginPath(); g.ellipse(x,y-4.6*s,6.6*s,1.5*s,0,0,Math.PI); g.fill();
    g.fillStyle='rgba(255,255,255,0.55)'; g.beginPath(); g.arc(x-2*s,y-6.2*s,1.0*s,0,TAU); g.fill();
  }
  if(shut){ g.strokeStyle='rgba(232,208,240,'+(0.35+0.25*Math.sin(t*6)).toFixed(2)+')'; g.lineWidth=3;
    g.beginPath(); g.ellipse(0,0,R.r*1.02,R.r*0.8,0,0,TAU); g.stroke(); }
  g.restore();
}
/* v4.1 媚茸: 見破られるまでは光茸そのもの。開くと傘が裏返り、桃色の襞と粘つく糸が見える */
function drawLurecap(g,e){
  const r=e.r, t=e.t, open=(e.state==='open'||e.revealed);
  g.fillStyle='rgba(8,8,26,0.32)'; g.beginPath(); g.ellipse(0,2,r*1.3,r*0.45,0,0,TAU); g.fill();
  if(!open){
    // 光茸の擬態(drawPick の shroom と同じ形・同じ色)
    glow(g,0,-8,24,'159,232,200',0.30+0.14*Math.sin(t*2.5));
    const caps=[[-7,0,6,'#7fd8b8'],[5,1,5,'#9fe8c8'],[0,-3,7.5,'#b6f2da']];
    for(let i=0;i<caps.length;i++){ const x=caps[i][0], y=caps[i][1], rr=caps[i][2], c=caps[i][3];
      g.fillStyle='#d8d8e8'; g.fillRect(x-1.5,y-rr*0.6,3,rr*0.8+2);
      g.fillStyle=c; g.beginPath(); g.ellipse(x,y-rr*0.7,rr,rr*0.55,0,Math.PI,TAU); g.fill();
      g.fillStyle='rgba(255,255,255,0.7)'; g.beginPath(); g.arc(x-rr*0.3,y-rr*0.95,1.2,0,TAU); g.fill(); }
    return;
  }
  // 裏返った傘。襞が外を向き、糸を引いている
  const k=e.openT>0?Math.min(1,(2.2-e.openT)/0.35):1;
  glow(g,0,-8,26,'255,158,194',0.34+0.14*Math.sin(t*4));
  g.fillStyle='#c9b0a0'; g.fillRect(-2,-9,4,11);
  g.save(); g.translate(0,-10); g.scale(1,-1*(0.3+0.7*k));   // 裏返し
  g.fillStyle='#ff9ec2'; g.beginPath(); g.ellipse(0,0,r*1.25,r*0.85,0,Math.PI,TAU); g.fill();
  g.strokeStyle='rgba(200,86,130,0.75)'; g.lineWidth=1.1;
  for(let i=1;i<9;i++){ const x=-r*1.25+i*(r*2.5/9); g.beginPath(); g.moveTo(x,0); g.lineTo(x*0.5,-r*0.72); g.stroke(); }
  g.restore();
  for(let i=0;i<4;i++){ const a=t*1.4+i*1.6, ln=r*(0.8+0.5*Math.abs(Math.sin(t*2+i)));
    g.strokeStyle='rgba(255,200,220,0.5)'; g.lineWidth=1;
    g.beginPath(); g.moveTo(Math.cos(a)*r*0.5,-8); g.quadraticCurveTo(Math.cos(a)*r*0.9,-6,Math.cos(a)*ln,-2); g.stroke(); }
}
/* v4.1 抱き茸: 太い柄と、人ひとり分の大きな傘。近づくとしなって、傘が下りてくる */
function drawHugcap(g,e){
  const r=e.r, t=e.t;
  const bend=e.bendT>0?(1-e.bendT/0.55):0;
  const held=!!(G.B&&G.B.heroes.some(h=>attachedSlots(h).some(sl=>h.limbs[sl].mon===e)));
  const lean=(held?1:bend)*0.9;
  g.fillStyle='rgba(8,8,26,0.4)'; g.beginPath(); g.ellipse(0,4,r*1.5,r*0.5,0,0,TAU); g.fill();
  // 柄(しなる)
  g.strokeStyle='#e8dcc0'; g.lineWidth=r*0.55; g.lineCap='round';
  g.beginPath(); g.moveTo(0,2); g.quadraticCurveTo(lean*r*0.5,-r*1.1,lean*r*1.5,-r*1.6); g.stroke();
  g.strokeStyle='rgba(190,168,130,0.5)'; g.lineWidth=1;
  g.beginPath(); g.moveTo(0,0); g.quadraticCurveTo(lean*r*0.5,-r*1.1,lean*r*1.5,-r*1.6); g.stroke();
  // 傘
  g.save(); g.translate(lean*r*1.5,-r*1.6); g.rotate(lean*0.55);
  const grad=g.createLinearGradient(0,-r*0.9,0,r*0.2);
  grad.addColorStop(0,'#f0e0bc'); grad.addColorStop(0.6,'#d8bc90'); grad.addColorStop(1,'#b89468');
  g.fillStyle=grad; g.beginPath(); g.ellipse(0,0,r*1.85,r*1.15,0,Math.PI,TAU); g.fill();
  // 傘の裏の襞(下から覗くと見える。温かく湿っている)
  g.fillStyle='rgba(226,168,150,0.85)'; g.beginPath(); g.ellipse(0,0,r*1.85,r*0.42,0,0,Math.PI); g.fill();
  g.strokeStyle='rgba(180,110,100,0.7)'; g.lineWidth=1.2;
  for(let i=1;i<13;i++){ const x=-r*1.85+i*(r*3.7/13); g.beginPath(); g.moveTo(x,0); g.lineTo(x*0.4,r*0.4*(0.7+0.3*Math.sin(t*2+i))); g.stroke(); }
  // 傘の上のいぼ
  g.fillStyle='rgba(255,248,228,0.75)';
  for(let i=0;i<6;i++){ const a=Math.PI+0.25+i*0.52; g.beginPath(); g.ellipse(Math.cos(a)*r*1.25,Math.sin(a)*r*0.8,r*0.16,r*0.10,0,0,TAU); g.fill(); }
  g.restore();
}
/* v4.0 核の落とし子: 魔核の根がちぎれて生まれた、桃色の幼い塊。尾を引きずって這い寄る */
function drawCoreling(g,e){
  const r=e.r, t=e.t, wob=Math.sin(t*7)*0.12;
  g.save();
  g.fillStyle='rgba(20,4,12,0.4)'; g.beginPath(); g.ellipse(0,r*0.5,r*1.1,r*0.4,0,0,TAU); g.fill();
  // 尾(親の根の名残)
  g.strokeStyle='#8a3a5a'; g.lineWidth=r*0.42; g.lineCap='round';
  g.beginPath(); g.moveTo(0,0); g.quadraticCurveTo(-r*1.1,Math.sin(t*5)*r*0.5,-r*1.9,Math.sin(t*5+1)*r*0.6); g.stroke();
  // 体
  const grad=g.createRadialGradient(-r*0.3,-r*0.4,r*0.15,0,0,r*1.15);
  grad.addColorStop(0,'#ffc2d8'); grad.addColorStop(0.55,'#e2789f'); grad.addColorStop(1,'#a03a62');
  g.fillStyle=grad; g.beginPath(); g.ellipse(0,-r*0.2,r*(1+wob),r*(0.92-wob),0,0,TAU); g.fill();
  // 脈(親と同じ拍)
  g.strokeStyle='rgba(255,120,170,'+(0.35+0.3*Math.abs(Math.sin(t*3.4)))+')'; g.lineWidth=1.6;
  for(let i=0;i<3;i++){ const a=i*2.1+0.5; g.beginPath(); g.moveTo(0,-r*0.2); g.quadraticCurveTo(Math.cos(a)*r*0.5,-r*0.2+Math.sin(a)*r*0.4,Math.cos(a)*r*0.95,-r*0.2+Math.sin(a)*r*0.8); g.stroke(); }
  // 目(ひとつ。親を小さくしたかたち)
  g.fillStyle='#1a0510'; g.beginPath(); g.ellipse(0,-r*0.3,r*0.2,r*0.42,0,0,TAU); g.fill();
  g.fillStyle='#ff5d9a'; g.beginPath(); g.ellipse(0,-r*0.3,r*0.09,r*0.3,0,0,TAU); g.fill();
  g.restore();
}
/* ================= v5.2 魔核の段階 =================
   討たれるたびに巻き戻して厚くなる。世代で姿がはっきり変わるように、6段に分ける。
     0 芽    まだ心臓ですらない。膜だけの袋。目は縫い目のまま開いていない
     1 心臓  目が開く。根が床を掴む
     2 肥厚  房が分かれ、脈が浮く。小さい目が二つ
     3 殻    表面が石灰化して殻が張りはじめる。根の先が浮く
     4 鎧    殻が覆う。継ぎ目が光る。目が輪になる
     5 渦    最終形。まわりの闇がゆっくり回る                                  */
const CORE_ST=[
  { pal:['#f0c2d4','#d69ab0','#a87a90','#9a6a80'], body:0.74, sheen:0.55, roots:5,  rootW:4,  rootL:1.55, lift:0,    eyes:0, mainEye:0,   plate:0,    ring:0, veins:3 },
  { pal:['#d1698c','#94406a','#5e2c48','#7a3050'], body:0.90, sheen:0.10, roots:8,  rootW:6,  rootL:1.85, lift:0,    eyes:0, mainEye:1,   plate:0,    ring:0, veins:5 },
  { pal:['#c2456f','#7a1f44','#3a0b20','#5a1630'], body:1.00, sheen:0.05, roots:10, rootW:7,  rootL:1.95, lift:0.04, eyes:2, mainEye:1,   plate:0.18, ring:0, veins:6 },
  { pal:['#a82a56','#5e1434','#280716','#46101f'], body:1.03, sheen:0.06, roots:12, rootW:8,  rootL:2.05, lift:0.10, eyes:4, mainEye:1,   plate:0.45, ring:0, veins:6 },
  { pal:['#8e1a44','#420c26','#180310','#340a18'], body:1.06, sheen:0.04, roots:14, rootW:9,  rootL:2.15, lift:0.16, eyes:6, mainEye:1,   plate:0.72, ring:0, veins:7 },
  { pal:['#7a1038','#33081e','#0e020a', '#26060f'], body:1.10, sheen:0.03, roots:16, rootW:10, rootL:2.25, lift:0.22, eyes:8, mainEye:1,   plate:0.92, ring:1, veins:8 },
];
function coreStage(era){ return era<=0?0 : era<=2?1 : era<=4?2 : era<=6?3 : era<=9?4 : 5; }
function drawCore(g,e){
  const r=e.r, t=e.t, ph=e.maxHp?e.hp/e.maxHp:1, era=e.era||0;
  const S=CORE_ST[coreStage(era)], CC=S.pal;
  const beat=1+0.045*Math.sin(t*(ph<0.5?5.2:3.4))+(e.pulseT>0?0.12*Math.sin(e.pulseT*9):0);
  const br=r*S.body;   // 見た目の大きさ(当たり判定は e.r のまま。若い個体は輪郭の中で小さく縮こまっている)
  g.save();
  g.fillStyle='rgba(20,4,12,'+(0.30+0.25*S.body).toFixed(2)+')'; g.beginPath(); g.ellipse(0,r*0.35,br*1.5,br*0.6,0,0,TAU); g.fill();
  /* --- 根 --- 若いほど細く短く、床に届いていない。古いほど太く多く、先が浮き上がる --- */
  const rootPath=(a,L,lift)=>{ g.beginPath(); g.moveTo(Math.cos(a)*br*0.7,Math.sin(a)*br*0.35);
    g.quadraticCurveTo(Math.cos(a+0.25)*br*1.3,Math.sin(a+0.25)*br*0.7 - lift*br,Math.cos(a)*L,Math.sin(a)*L*0.55 - lift*br*1.6); g.stroke(); };
  g.strokeStyle=CC[3]; g.lineWidth=S.rootW; g.lineCap='round';
  for(let i=0;i<S.roots;i++){ const a=i*TAU/S.roots+0.3+Math.sin(t*0.7+i)*0.05, L=br*S.rootL+Math.sin(t*1.3+i*2)*6; rootPath(a,L,S.lift); }
  g.strokeStyle='rgba(200,80,120,'+(0.35-0.04*coreStage(era)).toFixed(2)+')'; g.lineWidth=2.5;
  for(let i=0;i<S.roots;i++){ const a=i*TAU/S.roots+0.3; rootPath(a,br*S.rootL,S.lift); }
  /* --- v5.2 最終形: まわりの闇がゆっくり回る --- */
  if(S.ring){ g.save(); g.translate(0,-r*0.15);
    g.globalAlpha=0.42+0.10*Math.sin(t*1.1); g.strokeStyle='#1c0410'; g.lineWidth=7; g.setLineDash([13,9]); g.lineDashOffset=-t*22;
    g.beginPath(); g.ellipse(0,0,br*1.48,br*1.02,0,0,TAU); g.stroke();
    g.globalAlpha=0.34; g.strokeStyle='#ff2e6a'; g.lineWidth=1.8; g.lineDashOffset=t*15;
    g.beginPath(); g.ellipse(0,0,br*1.62,br*1.14,0,0,TAU); g.stroke(); g.setLineDash([]); g.restore(); }
  if(e.rage){ const rg=0.45+0.3*Math.abs(Math.sin(t*6));
    g.strokeStyle='rgba(255,46,106,'+rg.toFixed(2)+')'; g.lineWidth=3.4; g.lineCap='round';
    for(let i=0;i<12;i++){ const a=i*TAU/12+Math.sin(t*2+i)*0.25, L=br*(2.1+0.35*Math.sin(t*4+i));
      g.beginPath(); g.moveTo(Math.cos(a)*br*0.8,Math.sin(a)*br*0.45); g.quadraticCurveTo(Math.cos(a-0.4)*L*0.7,Math.sin(a-0.4)*L*0.45,Math.cos(a)*L,Math.sin(a)*L*0.6); g.stroke(); }
    glow(g,0,-br*0.25,br*2.1,'255,46,106',0.18+0.1*Math.sin(t*7)); }
  if(e.beamT>0){ const k=1-e.beamT/BAL.CORE_BEAM_CHARGE, a=e.beamA||0, L=BAL.CORE_BEAM_LEN;
    g.save(); g.globalAlpha=0.16+0.5*k; g.strokeStyle='#ff86b3'; g.lineWidth=BAL.CORE_BEAM_W*2*(0.25+0.75*k); g.lineCap='butt';
    g.beginPath(); g.moveTo(0,-r*0.25); g.lineTo(Math.cos(a)*L,-r*0.25+Math.sin(a)*L); g.stroke();
    g.globalAlpha=0.4+0.6*k; g.strokeStyle='#fff'; g.lineWidth=2+5*k;
    g.beginPath(); g.moveTo(0,-r*0.25); g.lineTo(Math.cos(a)*L,-r*0.25+Math.sin(a)*L); g.stroke();
    g.restore();
    glow(g,0,-r*0.25,r*(0.8+1.4*k),'255,134,179',0.25+0.45*k); }
  if(e.whipT>0){ const k=1-e.whipT/0.6; g.strokeStyle='rgba(255,120,170,'+(0.5+0.4*k)+')'; g.lineWidth=5+3*k; g.beginPath(); g.moveTo(0,0); g.lineTo(Math.cos(e.lookA||0)*br*(1.2+2.2*k),Math.sin(e.lookA||0)*br*(1.2+2.2*k)*0.8); g.stroke(); }
  /* --- 本体 --- */
  g.save(); g.translate(0,-r*0.25); g.scale(beat,beat);
  const grad=g.createRadialGradient(-br*0.25,-br*0.3,br*0.15,0,0,br*1.05);
  grad.addColorStop(0,CC[0]); grad.addColorStop(0.55,CC[1]); grad.addColorStop(1,CC[2]);
  g.fillStyle=grad; g.beginPath(); g.ellipse(0,0,br,br*0.86,0,0,TAU); g.fill();
  // 房(古いほど数が増え、はっきり分かれる)
  for(let i=0;i<S.veins;i++){ const a=i*(TAU/S.veins)+0.4; g.fillStyle='rgba(180,60,100,'+(0.30+0.25*S.body).toFixed(2)+')';
    g.beginPath(); g.ellipse(Math.cos(a)*br*0.5,Math.sin(a)*br*0.42,br*0.34,br*0.26,a,0,TAU); g.fill(); }
  g.strokeStyle='rgba(255,110,160,'+(0.35+(e.pulseT>0?0.4:0))+')'; g.lineWidth=2.2;
  for(let i=0;i<S.veins;i++){ const a=i*TAU/S.veins+t*0.1; g.beginPath(); g.moveTo(Math.cos(a)*br*0.25,Math.sin(a)*br*0.22);
    g.bezierCurveTo(Math.cos(a+0.4)*br*0.55,Math.sin(a+0.4)*br*0.5,Math.cos(a-0.2)*br*0.8,Math.sin(a-0.2)*br*0.7,Math.cos(a)*br*0.98,Math.sin(a)*br*0.84); g.stroke(); }
  /* --- v5.2 殻: 石灰の板が表面を覆っていく。継ぎ目は古いほど光る --- */
  if(S.plate>0){
    const nP=Math.round(4+S.plate*8);
    for(let i=0;i<nP;i++){ const a=i*TAU/nP+0.25, rr=br*(0.55+0.34*S.plate);
      g.save(); g.translate(Math.cos(a)*br*0.42,Math.sin(a)*br*0.36); g.rotate(a);
      g.fillStyle='rgba(30,10,20,'+(0.30+0.45*S.plate).toFixed(2)+')';
      g.beginPath(); g.ellipse(0,0,rr*0.52,rr*0.34,0,0,TAU); g.fill();
      g.strokeStyle='rgba(255,90,140,'+(0.10+0.35*S.plate).toFixed(2)+')'; g.lineWidth=1.2;
      g.beginPath(); g.ellipse(0,0,rr*0.52,rr*0.34,0,0,TAU); g.stroke();
      g.restore(); }
  }
  if(S.sheen>0){ g.fillStyle='rgba(255,235,245,'+S.sheen.toFixed(2)+')'; g.beginPath(); g.ellipse(-br*0.22,-br*0.3,br*0.52,br*0.34,-0.5,0,TAU); g.fill(); }
  g.fillStyle='rgba(255,220,235,0.28)'; g.beginPath(); g.ellipse(-br*0.3,-br*0.4,br*0.32,br*0.16,-0.5,0,TAU); g.fill();
  /* --- 目 --- 芽の段はまだ開いていない(縫い目だけ) --- */
  const la=e.lookA||0, ex=Math.cos(la)*br*0.12, ey=Math.sin(la)*br*0.08;
  if(!S.mainEye){
    g.strokeStyle='rgba(120,60,90,0.75)'; g.lineWidth=2.4; g.lineCap='round';
    g.beginPath(); g.moveTo(0,-br*0.34); g.lineTo(0,br*0.34); g.stroke();
    g.strokeStyle='rgba(255,200,225,0.5)'; g.lineWidth=1.1;
    g.beginPath(); g.moveTo(-br*0.05,-br*0.28); g.lineTo(-br*0.05,br*0.28); g.stroke();
  }else{
    g.fillStyle='#1a0510'; g.beginPath(); g.ellipse(0,0,br*0.16,br*0.42,0,0,TAU); g.fill();
    g.fillStyle='#ff5d9a'; g.beginPath(); g.ellipse(ex,ey,br*0.07,br*0.3,0,0,TAU); g.fill();
    g.fillStyle='#fff'; g.beginPath(); g.ellipse(ex-br*0.02,ey-br*0.12,br*0.025,br*0.06,0,0,TAU); g.fill();
  }
  for(let i=0;i<S.eyes;i++){ const a=i*(TAU/Math.max(1,S.eyes))+0.6+t*0.05, ox=Math.cos(a)*br*0.62, oy=Math.sin(a)*br*0.5;
    g.fillStyle='#1a0510'; g.beginPath(); g.ellipse(ox,oy,br*0.07,br*0.16,0,0,TAU); g.fill();
    g.fillStyle='#ff5d9a'; g.beginPath(); g.ellipse(ox+Math.cos(la)*br*0.02,oy+Math.sin(la)*br*0.02,br*0.03,br*0.1,0,0,TAU); g.fill(); }
  g.restore();
  g.restore();
}

/* v3.0 捕まってその場に残っている子の印: 紫の輪と「救出」の進み */
function drawCaptiveMark(g,p){
  const c=p.captive, t=G.B.time; g.save();
  g.strokeStyle='rgba(201,140,255,0.75)'; g.lineWidth=2; g.setLineDash([4,4]); g.beginPath(); g.ellipse(p.x,p.y-4,26,12,0,0,TAU); g.stroke(); g.setLineDash([]);
  if(c.rescue>0){ g.strokeStyle='#8fd3ff'; g.lineWidth=3; g.beginPath(); g.arc(p.x,p.y-52,14,-Math.PI/2,-Math.PI/2+TAU*Math.min(1,c.rescue/BAL.RESCUE_T)); g.stroke(); }
  g.font='bold 10px '+FONT; g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='#e8d8ff'; g.shadowColor='rgba(0,0,0,0.8)'; g.shadowBlur=3;
  g.fillText(c.rescue>0?'救出中…':'捕まっている', p.x, p.y-70+Math.sin(t*3)*1.5); g.restore();
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
  const h=(B.heroes&&B.heroes[B.pinSceneHi]&&!B.heroes[B.pinSceneHi].out)?B.heroes[B.pinSceneHi]:B.hero;   // v3.0 場面の主
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
  const B=G.B; const hh=B&&((B.heroes&&B.heroes[B.pinSceneHi])||B.hero);   // v3.0 場面の主(押し倒された/絶頂した子)
  if(!B||!hh||hh.out||!(hh.pinned||hh.charmBind||hh.climaxT>0)||!B.pinScene||!B.pinScene.beats||!B.pinScene.beats.length) return;
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
  /* v1.10 視界は端末の縦横比に合わせて幅が変わる。狭いときは横並びをやめて段に積む。
     右端はミュートボタン(DOM)と重なるので、そのぶん余白を取る。 */
  const narrow = W < 780;
  const RM = narrow ? 56 : 16;
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

  // HP / スタミナ / 護り(v3.0 ヒロインごとに一段)
  const barX = narrow ? 10 : 82;
  const barY0 = narrow ? 44 : 14;
  const barW = narrow ? Math.max(120, W-152) : 150;
  const rowH = narrow ? 30 : 26;
  B.heroes.forEach((hh,i)=>{
    const by=barY0+i*rowH, HD=HEROES[hh.id]||HEROES.lumina;
    rr(g,barX,by,barW,11,6); g.fillStyle='rgba(20,24,50,0.78)'; g.fill();
    const hr=clamp(hh.hp/hh.maxHp,0,1);
    if(hr>0){ rr(g,barX,by,barW*hr,11,6); g.fillStyle=hh.out?'#7a4a8a':(hr>0.35?'#ff5d7a':'#ff9c2e'); g.fill(); }
    rr(g,barX,by,barW,11,6); g.strokeStyle=B.heroes.length>1?HD.col:'rgba(255,255,255,0.35)'; g.lineWidth=1.2; g.stroke();
    g.fillStyle='#ffffff'; g.font='bold 9px '+FONT; g.textAlign=narrow?'right':'left';
    if(narrow){ g.shadowColor='rgba(0,0,0,0.9)'; g.shadowBlur=3; }
    g.fillText((B.heroes.length>1?HD.name+' ':'')+(hh.out?'捕まっている':'HP '+Math.ceil(hh.hp)+'/'+hh.maxHp), narrow?barX+barW-6:barX+barW+8, by+5.5);
    g.shadowBlur=0;
    rr(g,barX,by+14,barW,8,4); g.fillStyle='rgba(20,24,50,0.78)'; g.fill();
    const sr=clamp(hh.stamina/hh.staminaMax,0,1);
    if(sr>0){ rr(g,barX,by+14,barW*sr,8,4); g.fillStyle=sr>0.3?'#ffd76a':'#ff7a4a'; g.fill(); }
    rr(g,barX,by+14,barW,8,4); g.strokeStyle='rgba(255,255,255,0.28)'; g.lineWidth=1; g.stroke();
    g.fillStyle=narrow?'#ffffff':'#ffe9b0'; g.font='bold 8px '+FONT; g.textAlign=narrow?'right':'left';
    if(narrow){ g.shadowColor='rgba(0,0,0,0.9)'; g.shadowBlur=3; }
    g.fillText('スタミナ '+Math.ceil(hh.stamina)+'  護り '+Math.max(0,hh.armor-attachCount(hh)), narrow?barX+barW-6:barX+barW+8, by+18.5);
    g.shadowBlur=0;
  });
  const barY=barY0;   // 以降の配置の基準(1人目の段)
  // タイマー
  g.textAlign='center';
  g.font='bold '+(narrow?20:24)+'px '+FONT;
  g.fillStyle='#ffffff';
  g.shadowColor='rgba(0,0,0,0.6)'; g.shadowBlur=5;
  g.fillText(fmt(B.time), W/2, 26);
  g.shadowBlur=0;
  if(!narrow){
    g.font='9px '+FONT; g.fillStyle='rgba(190,200,240,0.75)';
    const F=B.floor||curFloor();
    const nS=B.enemies.filter(e=>e.id==='sentinel'&&!e.dead).length;
    const st=F.final?'魔核を討てば目的達成':(B.exitLocked?'封印石 '+Object.keys(B.seals||{}).length+'/3 で降り口が開く':(nS>0?'降り口は石の番兵が守る(残り'+nS+')':'降り口に着けば次の階層へ'))+(B.wantExit?' — 彼女は降りたがっている':(F.final?'':' — 彼女は見るものを見てから降りる'));   // v2.1
    if(B.heroes.length>1){ let txt='第'+F.depth+'層 '+F.name+' — '+st; const x0=barX+barW+180, maxW=Math.max(120,(W-RM-140)-x0); g.textAlign='left'; while(txt.length>8 && g.measureText(txt).width>maxW) txt=txt.slice(0,-2)+'…'; g.fillText(txt, x0, 42); g.textAlign='center'; }   // v3.0 二人分の段と重ならない位置に
    else g.fillText('第'+F.depth+'層 '+F.name+' — '+st, W/2, 42);
  }
  // 右上
  g.textAlign='right'; g.font='bold '+(narrow?12:13)+'px '+FONT; g.fillStyle='#ffd76a';
  g.shadowColor='rgba(0,0,0,0.85)'; g.shadowBlur=3;
  g.fillText('被撃破 '+B.kills, W-RM, narrow?22:24);
  g.font=(narrow?9:10)+'px '+FONT; g.fillStyle='rgba(200,180,255,0.85)';
  g.fillText('第'+genNum(META.gen.idx)+'世代 / '+(META.run.day||1)+'日目'+((META.run.fails||0)>0?' / 連敗'+META.run.fails:''), narrow?W-10:W-RM, narrow?barY+18.5:42);
  // 夜の深まり(彼女のLv連動の夜側強化)
  const nStat=Math.round(Math.min(BAL.NIGHT_STAT_CAP, BAL.NIGHT_STAT_LV*Math.max(0,p.level-1))*100);
  const nUnit=Math.min(BAL.NIGHT_UNIT_MAX, Math.floor(p.level/BAL.NIGHT_UNIT_LV));
  if(nStat>0||nUnit>0){
    g.fillStyle='rgba(212,168,255,0.95)'; g.font='bold '+(narrow?9:10)+'px '+FONT;
    g.fillText('夜の深まり +'+nStat+'%'+(nUnit>0?' / +'+nUnit+'体':''), narrow?W-10:W-RM, narrow?barY+30:58);
  }
  { const pr=pressure();   // v2.2 深淵の圧(この階層に居る時間で増す)
    if(pr>0){ g.fillStyle='rgba(255,140,170,0.95)'; g.font='bold '+(narrow?9:10)+'px '+FONT;
      g.fillText('深淵の圧 +'+Math.round(pr*100)+'%  EN上限+'+Math.round(pr*BAL.PRESS_EN_MAX*100)+'% 頭数+'+Math.round(pr*BAL.PRESS_UNIT*100)+'%', narrow?W-10:W-RM, narrow?barY+42:72); }
    else if(!narrow){ g.fillStyle='rgba(200,180,255,0.6)'; g.font='9px '+FONT; g.fillText('深淵の圧 まだ静か('+Math.max(0,Math.ceil(BAL.PRESS_T0-B.time))+'秒)', W-RM, 72); } }
  g.shadowBlur=0;
  // ボスHP
  const boss=B.enemies.find(e=>e.boss&&!e.dead&&!MONSTERS[e.id].guardian)||B.enemies.find(e=>e.boss&&!e.dead);
  if(boss){
    g.textAlign='center'; g.font='bold 9px '+FONT; g.fillStyle='#ff8c9e';
    const bw=Math.min(300, W-40), by=narrow?H-72:60;   // 縦画面では上が詰まるのでボスHPは下に寄せる
    g.fillText(MONSTERS[boss.id].name, W/2, by-8);
    rr(g,W/2-bw/2,by,bw,7,4);
    g.fillStyle='rgba(20,24,50,0.8)'; g.fill();
    const br=clamp(boss.hp/boss.maxHp,0,1);
    if(br>0){ rr(g,W/2-bw/2,by,bw*br,7,4); g.fillStyle='#e84a68'; g.fill(); }
    rr(g,W/2-bw/2,by,bw,7,4);
    g.strokeStyle='rgba(255,120,140,0.6)'; g.lineWidth=1; g.stroke();
  }
  // AI思考チップ
  g.font='bold 11px '+FONT;
  const label='AI思考: '+p.aiLabel;
  const cw=g.measureText(label).width+34;
  const chipY=(narrow?72:48)+Math.max(0,B.heroes.length-1)*(narrow?30:26);   // v3.0 二人分の段の下に
  rr(g,10,chipY,cw,22,11);
  g.fillStyle='rgba(24,30,60,0.82)'; g.fill();
  g.strokeStyle='rgba(143,211,255,0.65)'; g.lineWidth=1.3; g.stroke();
  const pulse=0.55+0.45*Math.sin(performance.now()*0.006);
  g.fillStyle='rgba(143,211,255,'+pulse.toFixed(2)+')';
  g.beginPath(); g.arc(23,chipY+11,3.6,0,TAU); g.fill();
  g.fillStyle='#cfe7ff'; g.textAlign='left'; g.textBaseline='middle';
  g.fillText(label,32,chipY+11.5);
  // v1.8 目当てチップ: 彼女がいま向かっている先と方角(夜側が先回りして待ち伏せできるように)
  if(p.goal && G.mode==='battle'){
    const gl=p.goal, gx=gl.x-p.x, gy=gl.y-p.y, gd=Math.hypot(gx,gy);
    const gcol=gl.kind==='event'?((EVENT_DEF[gl.sub]&&EVENT_DEF[gl.sub].col)||'#ffd76a'):'#ffe9b0';
    const gtxt='目当て: '+goalName(gl)+(gd>60?'  '+dirName(gx,gy)+' '+Math.round(gd)+'px':'  ここ');
    const gw=g.measureText(gtxt).width+26;
    const gx0=narrow?10:10+cw+8, gy0=narrow?chipY+24:chipY;   // 狭い画面ではAI思考チップの下に置く(v3.0 段の数に合わせて下がる)
    rr(g,gx0,gy0,gw,22,11); g.fillStyle='rgba(40,30,20,0.82)'; g.fill(); g.strokeStyle=hexA(gcol,0.7); g.lineWidth=1.3; g.stroke();
    g.fillStyle=gcol; g.textAlign='left'; g.textBaseline='middle'; g.fillText(gtxt,gx0+13,gy0+11.5);
    drawEdgeArrow(g,gl.x,gl.y,gcol,goalName(gl));
  }
  if(B.event && G.mode==='battle' && !(p.goal&&p.goal.kind==='event')) drawEdgeArrow(g,B.event.x,B.event.y,(EVENT_DEF[B.event.kind]&&EVENT_DEF[B.event.kind].col)||'#fff','光の柱');
  // v2.2 設置一覧: 場に生きている夜側の設置物(記号×数)。オート指揮の設置も含む
  if(B.placed && G.mode==='battle'){
    const near=(o,it)=>Math.abs(o.x-it.x)<1&&Math.abs(o.y-it.y)<1;
    const alive={}; for(const it of B.placed){ if(B.time>=it.until) continue;
      if(it.id==='fake'){ if(!B.chests.some(c=>c.fake&&!c.taken&&near(c,it))) continue; }
      else if(it.id==='rune'||it.id==='suit'||it.id==='freeze'){ if(!B.traps.some(tr=>tr.night&&tr.armed&&near(tr,it))) continue; }
      else if(it.id==='web'||it.id==='tower'){ if(!B.enemies.some(e=>e.night&&!e.dead&&e.id===it.id&&near(e,it))) continue; }
      alive[it.id]=(alive[it.id]||0)+1; }
    const keys=Object.keys(alive);
    if(keys.length){ const txt='設置: '+keys.map(k=>NIGHT_ITEMS[k].icon+'×'+alive[k]).join(' '); g.font='bold 10px '+FONT; const pw=g.measureText(txt).width+22; const px0=10, py0=narrow?chipY+76:100;
      rr(g,px0,py0,pw,20,10); g.fillStyle='rgba(50,25,80,0.82)'; g.fill(); g.strokeStyle='rgba(201,140,255,0.7)'; g.lineWidth=1.2; g.stroke(); g.fillStyle='#e8dcff'; g.textAlign='left'; g.textBaseline='middle'; g.fillText(txt,px0+11,py0+10.5); }
  }
  // 状態チップ
  let sx=10, sy=(narrow?chipY+50:76)+Math.max(0,B.heroes.length-2)*26;   // v3.0 3人以上なら段を下げる
  for(const hh of B.heroes){ const p=hh;   // v3.0 ヒロインごとに一段(チップがある時だけ名前を添える)
  /* v5.0 名前は段の先頭にインラインで置くので、上に浮かせるための座標は不要 */
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
  if((p.sticky||0)>=0.3) chips.push(['aphro','媚薬ぬめり '+(p.sticky).toFixed(1)+(p.wipeT>0?' 拭い中':'')]);   /* v6.3b 洗うまで身体に残る */
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
  if(p.guardT>0) chips.push(['heal','聖光の壁 '+Math.ceil(p.guardT)+'s']);
  { const SK=heroSkills(p); const un=Object.keys(SK).filter(k=>p.level>=SK[k].lv); if(un.length) chips.push(['skill','奥義 '+un.map(k=>SK[k].icon+((p.skillCd[k]||0)>0?Math.ceil(p.skillCd[k]):'')).join(' ')]); }   // v2.3 解放済みの奥義とCD(v3.0 ヒロインごと)
  if(BAL.SMART_AI && (p.aiMode==='kite'||p.aiMode==='flee')) chips.push(['flee',p.aiMode==='flee'?'逃げに徹する':'引き撃ち']);
  if(p.selfT>0) chips.push(['self','自慰……']);
  if(p.inMusk){ const mk=(typeof heroLife==='function'?(heroLife(p.id).traits.musk||0):(META.traits.musk||0)); chips.push(['musk','雄臭'+(mk>0?ROMANS[mk]:'')]); }   /* v5.8 その子に刻まれた段 */
  if(p.curse&&BOSS_CURSES[p.curse]) chips.push(['curse','呪い: '+BOSS_CURSES[p.curse].name]);
  /* v5.0 三人以上でも段が重ならないよう、名前は段の先頭に置く(上に浮かせない) */
  if(B.heroes.length>1 && chips.length){ const HD=HEROES[hh.id]||HEROES.lumina;
    g.font='bold 9px '+FONT; g.fillStyle=HD.col; g.textAlign='left'; g.textBaseline='middle';
    g.shadowColor='rgba(0,0,0,0.85)'; g.shadowBlur=3;
    g.fillText(HD.name, sx+1, sy+10.5); g.shadowBlur=0;
    sx+=g.measureText(HD.name).width+8; }
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
  if(chips.length){ sx=10; sy+=24; } else { sx=10; } }
  // デバッグ
  g.font='9px '+FONT; g.fillStyle='rgba(130,140,180,0.55)'; g.textAlign='left';
  drawMinimap(g);
  g.fillText('enemies:'+B.enemies.length+' fps:'+Math.round(G.fps)+(TS>1?' x'+TS:''), 12, H-6);
  g.textAlign='right'; g.fillStyle='rgba(255,255,255,0.3)'; g.font='bold 10px '+FONT;
  g.fillText('v5.0 深淵 — 沼と炎', W-12, H-6);
}
function drawCards(g){
  const B=G.B, c=B.lvCards; if(!c) return;
  g.fillStyle='rgba(8,10,20,0.6)'; g.fillRect(0,0,W,H);
  g.textAlign='center'; g.textBaseline='middle';
  g.font='bold 20px '+FONT; g.fillStyle='#ffd76a';
  g.shadowColor='rgba(0,0,0,0.7)'; g.shadowBlur=6;
  g.fillText('LEVEL UP! — '+((B.heroes&&B.heroes.length>1)?(B.heroes.length+'人が選んでいます(強化できるのは一人)…'):'ルミナのAIが選んでいます…'), W/2, 92);
  g.shadowBlur=0;
  const cw=168, ch=186;
  const vert = W < cw*3+56;   // 縦長の画面では3枚を横に並べきれないので縦に積む
  c.opts.forEach((k,i)=>{
    const chosen=c.revealed&&i===c.pick;
    const isEvo=k.startsWith('EVO:');
    const def=isEvo?EVOS[k.slice(4)]:UPG[k];
    const px=vert ? W/2-cw/2 : W/2+(i-1)*Math.min(196,(W-24)/3)-cw/2;
    const py=(vert ? H/2+(i-1)*(ch+12)-ch/2 : H/2-ch/2)
             + (chosen? -8-Math.abs(Math.sin(c.t*7))*4 : 0);
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
    { const base=isEvo?EVOS[k.slice(4)].base:k; const ow=(UPG[base]&&UPG[base].kind==='wp')?(HEROES[UPG[base].owner||'lumina']):null;   // v3.0 誰の強化か
      g.font='bold 10px '+FONT; g.fillStyle=ow?ow.col:'rgba(200,210,255,0.85)'; g.fillText(ow?'▶ '+ow.name:'▶ 全員(パッシブ)',px+cw/2,py+16); }
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
  /* v3.0 フレイラの火(v5.0 でようやく絵が付いた) */
  if(id==='fsword'||id==='inferno'){
    g.shadowColor='#ff7a3a'; g.shadowBlur=9; g.strokeStyle='#ffd76a'; g.lineWidth=3; g.lineCap='round';
    const n=id==='inferno'?3:1;
    for(let i=0;i<n;i++){ const a=i*TAU/3-0.5; g.save(); g.rotate(n>1?a:0);
      g.beginPath(); g.moveTo(-11,7); g.quadraticCurveTo(2,-2,12,-9); g.stroke();
      g.strokeStyle='#ff7a3a'; g.lineWidth=1.4; g.beginPath(); g.moveTo(-9,10); g.quadraticCurveTo(3,1,13,-6); g.stroke();
      g.strokeStyle='#ffd76a'; g.lineWidth=3; g.restore(); }
  }else if(id==='fring'||id==='corona'){
    g.shadowColor='#ff7a3a'; g.shadowBlur=9; g.lineCap='round';
    const seg=id==='corona'?8:5, R=id==='corona'?13:10;
    for(let i=0;i<seg;i++){ const a0=i*TAU/seg; g.strokeStyle=i%2?'#ffd76a':'#ff7a3a'; g.lineWidth=id==='corona'?4:3;
      g.beginPath(); g.arc(0,0,R,a0,a0+TAU/seg*0.62); g.stroke(); }
  }else if(id==='fburst'||id==='eruption'){
    g.shadowColor='#ff7a3a'; g.shadowBlur=10; g.fillStyle='#ffd76a';
    const n=id==='eruption'?8:6;
    for(let i=0;i<n;i++){ const a=i*TAU/n, r0=id==='eruption'?5:4, r1=id==='eruption'?15:11;
      g.save(); g.rotate(a); g.beginPath(); g.moveTo(0,-r0); g.lineTo(3,-r1); g.lineTo(-3,-r1); g.closePath(); g.fill(); g.restore(); }
    g.fillStyle='#ff7a3a'; g.beginPath(); g.arc(0,0,4,0,TAU); g.fill();
  }else if(id==='fpillar'){
    g.shadowColor='#ff7a3a'; g.shadowBlur=9; g.fillStyle='#ffd76a';
    g.beginPath(); g.moveTo(-6,12); g.quadraticCurveTo(-3,-2,0,-13); g.quadraticCurveTo(3,-2,6,12); g.closePath(); g.fill();
    g.fillStyle='#ff7a3a'; g.beginPath(); g.moveTo(-3,12); g.quadraticCurveTo(-1,2,0,-6); g.quadraticCurveTo(1,2,3,12); g.closePath(); g.fill();
  }else if(id==='fwing'){
    g.shadowColor='#ff7a3a'; g.shadowBlur=9; g.fillStyle='#ffb060';
    for(const sx of [-1,1]){ g.save(); g.scale(sx,1);
      g.beginPath(); g.moveTo(2,-2); g.quadraticCurveTo(11,-12,14,-2); g.quadraticCurveTo(9,0,2,6); g.closePath(); g.fill(); g.restore(); }
    g.fillStyle='#ffd76a'; g.beginPath(); g.arc(0,0,3.4,0,TAU); g.fill();
  /* v5.0 クウの氷 */
  }else if(id==='ineedle'){
    g.shadowColor='#bfeaff'; g.shadowBlur=9; g.fillStyle='#bfeaff';
    for(const dx of [-7,0,7]){ g.beginPath(); g.moveTo(dx,-12); g.lineTo(dx+2.4,0); g.lineTo(dx,12); g.lineTo(dx-2.4,0); g.closePath(); g.fill(); }
  }else if(id==='ifield'||id==='blizzard'){
    g.shadowColor='#bfeaff'; g.shadowBlur=9; g.strokeStyle='#bfeaff'; g.lineWidth=2; g.setLineDash([4,3]);
    g.beginPath(); g.arc(0,0,id==='blizzard'?14:11,0,TAU); g.stroke();
    g.beginPath(); g.arc(0,0,id==='blizzard'?9:6.5,0,TAU); g.stroke(); g.setLineDash([]);
    if(id==='blizzard'){ g.strokeStyle='#7fe8dd'; g.lineWidth=1.6;
      for(let i=0;i<4;i++){ const y=-9+i*6; g.beginPath(); g.moveTo(-13,y); g.lineTo(-4,y-3); g.stroke(); } }
  }else if(id==='ibloom'||id==='glacier'){
    g.shadowColor='#bfeaff'; g.shadowBlur=9; g.strokeStyle='#e8faff'; g.lineWidth=2.2; g.lineCap='round';
    for(let i=0;i<6;i++){ const a=i*TAU/6;
      g.beginPath(); g.moveTo(0,0); g.lineTo(Math.cos(a)*12,Math.sin(a)*12); g.stroke();
      g.lineWidth=1.2; g.beginPath(); g.moveTo(Math.cos(a)*7,Math.sin(a)*7); g.lineTo(Math.cos(a+0.5)*11,Math.sin(a+0.5)*11); g.stroke(); g.lineWidth=2.2; }
    if(id==='glacier'){ g.fillStyle='rgba(150,215,245,0.5)'; g.fillRect(-13,7,26,6); }
  }else if(id==='iorbit'||id==='aurora'){
    g.shadowColor='#bfeaff'; g.shadowBlur=8; g.fillStyle='#bfeaff';
    const n=id==='aurora'?8:3, R=11;
    for(let i=0;i<n;i++){ const a=i*TAU/n; g.save(); g.translate(Math.cos(a)*R,Math.sin(a)*R*0.8); g.rotate(a);
      const w=id==='aurora'?4:5, h2=id==='aurora'?7:9;
      g.beginPath(); g.moveTo(0,-h2/2); g.lineTo(w/2,0); g.lineTo(0,h2/2); g.lineTo(-w/2,0); g.closePath(); g.fill(); g.restore(); }
    g.fillStyle='#7fe8dd'; g.beginPath(); g.arc(0,0,3,0,TAU); g.fill();
  }else if(id==='iecho'){
    g.shadowColor='#bfeaff'; g.shadowBlur=8; g.lineCap='round';
    g.strokeStyle='#ffd76a'; g.lineWidth=2.6; g.beginPath(); g.moveTo(-12,-5); g.lineTo(12,-5); g.stroke();
    g.beginPath(); g.moveTo(6,-9); g.lineTo(12,-5); g.lineTo(6,-1); g.stroke();
    g.strokeStyle='#bfeaff'; g.beginPath(); g.moveTo(-12,6); g.lineTo(12,6); g.stroke();
    g.beginPath(); g.moveTo(6,2); g.lineTo(12,6); g.lineTo(6,10); g.stroke();
  /* v5.0 ヤミコの闇 */
  }else if(id==='dblade'||id==='eclipse'){
    g.shadowColor='#a77dff'; g.shadowBlur=10; g.lineCap='round';
    g.strokeStyle='#2a1a3e'; g.lineWidth=6; g.beginPath(); g.moveTo(-13,8); g.quadraticCurveTo(0,-4,13,-9); g.stroke();
    g.strokeStyle='#a77dff'; g.lineWidth=2.6; g.beginPath(); g.moveTo(-13,8); g.quadraticCurveTo(0,-4,13,-9); g.stroke();
    if(id==='eclipse'){ g.strokeStyle='#e8d8ff'; g.lineWidth=1.6;
      g.beginPath(); g.moveTo(-11,13); g.quadraticCurveTo(1,1,13,-4); g.stroke();
      g.fillStyle='#2a1a3e'; g.beginPath(); g.arc(9,-9,5,0,TAU); g.fill();
      g.strokeStyle='#e8d8ff'; g.lineWidth=1.2; g.beginPath(); g.arc(9,-9,5.6,0,TAU); g.stroke(); }
  }else if(id==='dring'||id==='umbra'){
    /* 輪は「太い線」で描く。くり抜くと札の下地まで消える */
    g.shadowColor='#a77dff'; g.shadowBlur=10; const R=id==='umbra'?12:9.5;
    g.strokeStyle='#2a1a3e'; g.lineWidth=id==='umbra'?7:5; g.beginPath(); g.arc(0,0,R,0,TAU); g.stroke();
    g.shadowBlur=0; g.strokeStyle='#a77dff'; g.lineWidth=1.6;
    g.beginPath(); g.arc(0,0,R+(id==='umbra'?3.5:2.5),0,TAU); g.stroke();
    g.beginPath(); g.arc(0,0,R-(id==='umbra'?3.5:2.5),0,TAU); g.stroke();
    if(id==='umbra'){ g.strokeStyle='#e8d8ff'; g.lineWidth=1.2; g.setLineDash([3,4]);
      g.beginPath(); g.arc(0,0,18,0,TAU); g.stroke(); g.setLineDash([]); }
  }else if(id==='dspear'||id==='gloom'){
    g.shadowColor='#a77dff'; g.shadowBlur=9; g.lineCap='round';
    g.strokeStyle='#2a1a3e'; g.lineWidth=5; g.beginPath(); g.moveTo(-13,9); g.lineTo(11,-8); g.stroke();
    g.fillStyle='#a77dff'; g.beginPath(); g.moveTo(14,-11); g.lineTo(6,-9); g.lineTo(10,-2); g.closePath(); g.fill();
    if(id==='gloom'){ g.strokeStyle='#e8d8ff'; g.lineWidth=1.4; g.globalAlpha=0.7;
      for(const o of [-5,5]){ g.beginPath(); g.moveTo(-13+o,9+o*0.4); g.lineTo(9+o,-8+o*0.4); g.stroke(); } g.globalAlpha=1; }
  }else if(id==='dcall'){
    g.shadowColor='#a77dff'; g.shadowBlur=9;
    g.fillStyle='#2a1a3e';
    for(const [ox,oy,r0] of [[-8,3,7],[8,4,6],[0,-4,8]]){
      g.beginPath(); g.arc(ox,oy,r0,Math.PI,0); g.lineTo(ox+r0,oy+r0); g.lineTo(ox-r0,oy+r0); g.closePath(); g.fill(); }
    g.fillStyle='#a77dff';
    for(const [ox,oy] of [[-10,2],[-6,2],[6,3],[10,3],[-2,-5],[2,-5]]){ g.beginPath(); g.arc(ox,oy,1.5,0,TAU); g.fill(); }
  }else if(id==='dstep'){
    /* 消えた影(淡い) → 点線 → 現れた影(濃い) */
    const fig=(x,al,col)=>{ g.globalAlpha=al; g.fillStyle=col;
      g.beginPath(); g.ellipse(x,3,4.5,7,0,0,TAU); g.fill();                 /* 胴 */
      g.beginPath(); g.arc(x,-7,3.4,0,TAU); g.fill();                        /* 頭 */
      g.globalAlpha=1; };
    g.shadowColor='#a77dff'; g.shadowBlur=8;
    fig(-10,0.35,'#a77dff');
    fig(9,1,'#2a1a3e');
    g.shadowBlur=0;
    g.strokeStyle='#a77dff'; g.lineWidth=1.6; g.lineCap='round'; g.setLineDash([2.5,3]);
    g.beginPath(); g.moveTo(-4,0); g.lineTo(3,0); g.stroke(); g.setLineDash([]);
    g.strokeStyle='#e8d8ff'; g.lineWidth=1.3;
    g.beginPath(); g.ellipse(9,1,7.5,11,0,0,TAU); g.stroke();
  }else if(id==='chain'||id==='hchain'){
    g.strokeStyle=id==='hchain'?'#ffe9a8':'#ffd76a'; g.lineWidth=2.6; g.shadowColor='#ffd76a'; g.shadowBlur=8;
    const n=id==='hchain'?3:1; for(let k2=0;k2<n;k2++){ const oy=(k2-(n-1)/2)*7; for(let i=-2;i<=2;i++){ g.beginPath(); g.ellipse(i*6,oy,3.4,2.2,i%2?0.4:-0.4,0,TAU); g.stroke(); } }
  }else if(id==='spirit'||id==='twinspirit'){
    g.shadowColor='#e8f4ff'; g.shadowBlur=12; g.fillStyle='#e8f4ff';
    const n=id==='twinspirit'?4:1; for(let i=0;i<n;i++){ const a=i*TAU/n, x=n>1?Math.cos(a)*8:0, y=n>1?Math.sin(a)*8:0; g.beginPath(); g.arc(x,y,n>1?4:7,0,TAU); g.fill(); g.strokeStyle='rgba(232,244,255,0.6)'; g.lineWidth=2; g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x-8,y+4,x-13,y-2); g.stroke(); }
  }else if(id==='shield'||id==='aegis'){
    g.strokeStyle='#8fd3ff'; g.lineWidth=3.2; g.shadowColor='#8fd3ff'; g.shadowBlur=10; g.lineCap='round';
    g.beginPath(); if(id==='aegis') g.arc(0,0,12,0,TAU); else g.arc(0,0,12,-Math.PI*0.6,Math.PI*0.6); g.stroke();
    g.fillStyle='#fff3c4'; g.beginPath(); g.arc(0,0,3,0,TAU); g.fill();
  }else if(id==='reach'){
    g.strokeStyle='#ffd76a'; g.lineWidth=3; g.lineCap='round'; g.beginPath(); g.moveTo(-12,6); g.lineTo(10,-8); g.stroke();
    g.beginPath(); g.moveTo(10,-8); g.lineTo(2,-9); g.moveTo(10,-8); g.lineTo(9,0); g.stroke();
    g.fillStyle='#fff'; g.beginPath(); g.arc(-12,6,3,0,TAU); g.fill();
  }else if(id==='pierce'){
    g.strokeStyle='#e8f4ff'; g.lineWidth=2.6; g.lineCap='round'; g.beginPath(); g.moveTo(-13,0); g.lineTo(13,0); g.stroke();
    g.fillStyle='#ff9db4'; g.beginPath(); g.arc(-4,0,5,0,TAU); g.fill(); g.beginPath(); g.arc(7,0,4,0,TAU); g.fill();
    g.fillStyle='#fff'; g.beginPath(); g.moveTo(13,0); g.lineTo(8,-3); g.lineTo(8,3); g.closePath(); g.fill();
  }else if(id==='regen'){
    g.shadowColor='#7ee89a'; g.shadowBlur=8; g.fillStyle='#8fe8a8';
    g.beginPath(); g.moveTo(0,-12); g.quadraticCurveTo(9,0,0,10); g.quadraticCurveTo(-9,0,0,-12); g.fill();
    g.fillStyle='rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(-2.5,-3,2,3.5,0.3,0,TAU); g.fill();
  }else if(id==='bolt'||id==='sstar'){
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
/* ================= v4.0 暗闇のレイヤ =================
   深淵の上に一枚の闇を落とし、光っている所だけを抜く。抜けるのは
   二人の淡い光・催淫灯篭・光や炎が通った跡・光の柱・炎の帯、そして魔物のまわりの薄明かり。
   プレイヤーには DARK_CAP のぶんだけ薄く透けて見える(彼女たちよりは少しだけ多く見えている) */
let darkCv=null, darkCg=null, darkMk=null, darkMg=null, darkSpr=null;
function darkSprite(){
  if(darkSpr) return darkSpr;
  const c=document.createElement('canvas'); c.width=c.height=128; const d=c.getContext('2d');
  const gr=d.createRadialGradient(64,64,0,64,64,64);
  gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.42,'rgba(255,255,255,0.86)');
  gr.addColorStop(0.72,'rgba(255,255,255,0.42)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  d.fillStyle=gr; d.fillRect(0,0,128,128);
  darkSpr=c; return c;
}
const DARK_SC=3;   // 暗幕は 1/3 の大きさで作って引き伸ばす(光のふちは元々ぼやけているので粗さは出ない)
function drawDark(g,ox,oy){
  const B=G.B; if(!B||typeof darkLevel!=='function') return;
  const lv=darkLevel(); if(lv<=0.02) return;
  const lo=gfxLv()<=1, sc=lo?DARK_SC+2:DARK_SC;   // 描画を落としている端末では、もっと粗い暗幕で軽くする
  const DW=Math.ceil(W/sc), DH=Math.ceil(H/sc);
  if(!darkCv){ darkCv=document.createElement('canvas'); darkCg=darkCv.getContext('2d'); darkMk=document.createElement('canvas'); darkMg=darkMk.getContext('2d'); }
  if(darkCv.width!==DW||darkCv.height!==DH){ darkCv.width=darkMk.width=DW; darkCv.height=darkMk.height=DH; }
  const d=darkCg, m=darkMg, spr=darkSprite(), S=1/sc;
  // 1) 光の地図を足し合わせる(白いほど明るい)
  m.setTransform(1,0,0,1,0,0); m.globalCompositeOperation='source-over'; m.globalAlpha=1;
  m.clearRect(0,0,DW,DH); m.globalCompositeOperation='lighter';
  const hole=(wx,wy,r,k)=>{
    if(r<=0||k<=0.01) return;
    const x=(wx+ox)*S, y=(wy+oy)*S, rr=r*S;
    if(x<-rr||y<-rr||x>DW+rr||y>DH+rr) return;
    m.globalAlpha=k<1?k:1; m.drawImage(spr,x-rr,y-rr,rr*2,rr*2);
  };
  for(const h of B.heroes){ if(h.out) continue; const HD=HEROES[h.id]||{}; hole(h.x,h.y-10,heroLightR(h)*(HD.lightK||1),1); }
  if(B.lanterns) for(const q of B.lanterns) hole(q.x,q.y-28,BAL.LANTERN_R,0.95);
  if(B.lights) for(const q of B.lights){ const fade=1-q.t/q.life; hole(q.x,q.y,q.r,q.k*fade); }
  if(B.event) hole(B.event.x,B.event.y,300,0.95);
  for(const z of B.zones){ if(z.fire) hole(z.x,z.y,z.r*1.6,0.85); }
  for(const e of B.enemies){ if(e.dead) continue; if(lo&&!e.boss&&!e.night) continue; hole(e.x,e.y-8,BAL.DARK_ENEMY_R*(e.boss?1.9:1),0.5); }   // 魔物のまわりも薄く光る(察知の距離は変わらない)
  m.globalAlpha=1; m.globalCompositeOperation='source-over';
  // 2) 暗幕から、その光の地図のぶんだけ抜く(抜き合成は一度だけ)
  d.setTransform(1,0,0,1,0,0); d.globalCompositeOperation='source-over'; d.globalAlpha=1;
  d.fillStyle='rgba(5,4,14,'+(BAL.DARK_CAP*lv).toFixed(3)+')';
  d.clearRect(0,0,DW,DH); d.fillRect(0,0,DW,DH);
  d.globalCompositeOperation='destination-out'; d.drawImage(darkMk,0,0);
  d.globalCompositeOperation='source-over';
  g.drawImage(darkCv,0,0,DW,DH,0,0,W,H);
}
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
    drawZoneV6(g);   /* v6.0 鏡の映り・灯った紋・澱の残像・忘れ水の渦 */
    drawBreath(g);   /* v6.0f 14階: 壁が寄ってくる */
    if(B.silks && B.silks.length){   /* v6.0 糸紡ぎが張った糸。倒しても残る */
      g.strokeStyle='rgba(255,200,220,0.42)'; g.lineWidth=0.9;
      g.beginPath(); for(const s2 of B.silks){ g.moveTo(s2.x0,s2.y0); g.lineTo(s2.x1,s2.y1); } g.stroke();
      g.fillStyle='rgba(255,240,248,0.7)';
      for(const s2 of B.silks){ g.beginPath(); g.arc((s2.x0+s2.x1)/2,(s2.y0+s2.y1)/2,1.2,0,TAU); g.fill(); }
    }
    if(B.rings) for(const R of B.rings) drawRing(g,R);   // v4.1 菌輪
    if(B.mires) for(const m of B.mires) drawMire(g,m);   // v5.0 媚薬沼
    if(B.dryAura) drawDryAura(g,B.dryAura);        // v5.0 フレイラの炎のエリア(焼けた床は地形チップに焼き込まれる)
    if(B.coreRoots) drawCoreRoots(g,B.coreRoots);  // v4.0 魔核の跡: 根 → 赤黒い渦
    for(const st of B.stains) drawStain(g,st);
    for(const tr of B.trails) drawTrail(g,tr);
    for(const c of B.clouds) drawCloud(g,c);
    for(const z of B.zones) drawZone(g,z);
    for(const s of B.spawnFx) drawSummonFx(g,s);
    for(const pr of B.props) drawProp(g,pr);
    for(const gm of B.gems) drawGem(g,gm);
    for(const h of B.hearts) drawHeartDrop(g,h);
    drawDen(g);                                            // v3.2 巣窟の魔法陣・媚薬の花・壁の光線
    for(const tr of B.traps) drawTrap(g,tr);
    for(const c of B.chests){ if(c.bossChest){ glow(g,c.x,c.y-6,34,'255,215,106',0.35+0.15*Math.sin(c.t*4)); } drawChest(g,c); if(c.fake){ g.save(); g.globalAlpha=0.35; g.fillStyle='#c98cff'; g.beginPath(); g.ellipse(c.x,c.y+2,14,5,0,0,TAU); g.fill(); g.restore(); } }
    for(const it of B.items) drawItem(g,it);
    for(const pk of B.picks) drawPick(g,pk);                 // v1.8 地形の資源
    if(B.event) drawEventPillar(g,B.event);                  // v1.8 光の柱
    if(B.yamiCap) drawYamiCap(g,B.yamiCap);                  // v5.0 囲まれている誰か
    if(B.ebullets) for(const b of B.ebullets) drawRuneBolt(g,b);

    drawSightSectors(g,B);
    B.enemies.sort((a,b)=>a.y-b.y);
    const cvx=G.cam.x, cvy=G.cam.y;
    for(const e of B.enemies){
      if(e.state==='attached') continue;
      if(Math.abs(e.x-cvx)>W/2+80 || Math.abs(e.y-cvy)>H/2+100) continue;   // 画面外は描かない
      drawEnemy(g,e);
      if(e.night && !e.dead) drawNightMark(g,e.x,e.y-e.r-18,e.id==='web'?'🕸':'📡');   // v2.2 設置の印
    }

    for(const hh of B.heroes){ const p=hh; B.ci=hh.hi;   // v3.0 ヒロインごとの武器の光と姿
    // v5.0 冷気の帳: クウの周りの薄い青の輪(フレイラのそばでは目に見えて縮む)
    if(p.ifieldR>0){
      g.save(); g.globalAlpha=0.16;
      const fg2=g.createRadialGradient(p.x,p.y-8,p.ifieldR*0.4,p.x,p.y-8,p.ifieldR);
      fg2.addColorStop(0,'rgba(190,235,255,0)'); fg2.addColorStop(1,'rgba(150,215,245,0.75)');
      g.fillStyle=fg2; g.beginPath(); g.ellipse(p.x,p.y-8,p.ifieldR,p.ifieldR*0.7,0,0,TAU); g.fill();
      g.globalAlpha=0.35; g.strokeStyle='#bfeaff'; g.lineWidth=1.2; g.setLineDash([5,5]);
      g.beginPath(); g.ellipse(p.x,p.y-8,p.ifieldR,p.ifieldR*0.7,0,0,TAU); g.stroke(); g.setLineDash([]);
      g.restore();
    }
    // v5.0 氷衛: 味方の周りを回る氷の菱形(割れている枠は描かない=消耗が見える)
    if(p.iceOrb){
      const O=p.iceOrb;
      g.save();
      for(let i=0;i<O.n;i++){
        if(O.cd[i]>0) continue;
        const a=O.ang+i*TAU/O.n, sx=p.x+Math.cos(a)*O.r, sy=(p.y-10)+Math.sin(a)*O.r*0.78;
        const w=O.evo?8:6, hgt=O.evo?13:10;
        g.save(); g.translate(sx,sy); g.rotate(a*0.6);
        g.fillStyle='rgba(191,234,255,0.85)'; g.strokeStyle=O.evo?'rgba(255,240,255,0.95)':'rgba(255,255,255,0.9)'; g.lineWidth=1.2;
        g.beginPath(); g.moveTo(0,-hgt/2); g.lineTo(w/2,0); g.lineTo(0,hgt/2); g.lineTo(-w/2,0); g.closePath(); g.fill(); g.stroke();
        g.restore();
        glow(g,sx,sy,14,'150,220,255',0.25);
      }
      g.restore();
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
    // v2.0 ひかりの盾: 向いている側の光の弧(進化で全周)
    if(p.wp.shield>0 && p.shieldR>0){
      const evo=p.evo.aegis>0, a0=p.shieldAng-p.shieldArc/2, a1=p.shieldAng+p.shieldArc/2;
      g.save(); g.globalAlpha=0.55+0.15*Math.sin(p.shieldPulse*12);
      g.strokeStyle=evo?'#fff3c4':'#8fd3ff'; g.lineWidth=evo?4:3; g.shadowColor=evo?'#ffd76a':'#8fd3ff'; g.shadowBlur=10; g.lineCap='round';
      g.beginPath(); g.arc(p.x,p.y-10,p.shieldR,a0,a1); g.stroke();
      g.globalAlpha=0.12; g.fillStyle=evo?'#fff3c4':'#8fd3ff'; g.beginPath(); g.moveTo(p.x,p.y-10); g.arc(p.x,p.y-10,p.shieldR,a0,a1); g.closePath(); g.fill();
      g.restore();
    }
    // v3.0 火の輪(フレイラ)
    if(p.wp.fring>0 && p.fringR>0){
      g.save(); g.lineCap='round'; g.shadowColor='#ff7a3a'; g.shadowBlur=10;
      const seg=p.evo.corona>0?8:5; for(let i=0;i<seg;i++){ const a0=p.fringAng+i*TAU/seg; g.globalAlpha=0.55+0.25*Math.sin(p.anim*9+i); g.strokeStyle=i%2?'#ffd76a':'#ff7a3a'; g.lineWidth=p.evo.corona>0?5:3.5; g.beginPath(); g.ellipse(p.x,p.y-10,p.fringR,p.fringR*0.9,0,a0,a0+TAU/seg*0.62); g.stroke(); }
      g.restore();
    }
    /* v6.3 闇の輪(ヤミコ)。★これは一度も描かれていなかった——
       p.dringR は毎フレーム書かれていたのに、読む場所がどこにも無い。
       外から内へ締まる輪なので、締まりきる寸前ほど濃く見せる */
    if(p.wp.dring>0 && p.dringR>0){
      const ph=p.dringPhase||0, evo=p.evo.umbra>0;
      g.save(); g.lineCap='round'; g.shadowColor='#2a1a3e'; g.shadowBlur=12;
      const seg=evo?7:5;
      for(let i=0;i<seg;i++){
        const a0=p.dringAng+i*TAU/seg;
        g.globalAlpha=(0.30+0.45*ph)*(0.75+0.25*Math.sin(p.anim*8+i));
        g.strokeStyle=i%2?'#a77dff':'#2a1a3e'; g.lineWidth=(evo?5:3.5)*(0.8+0.5*ph);
        g.beginPath(); g.ellipse(p.x,p.y-10,p.dringR,p.dringR*0.9,0,a0,a0+TAU/seg*0.66); g.stroke();
      }
      /* 締まる向きが分かるよう、内へ落ちる筋を薄く引く */
      g.globalAlpha=0.18*(1-ph); g.strokeStyle='#a77dff'; g.lineWidth=1;
      g.beginPath(); g.ellipse(p.x,p.y-10,p.dringR*1.35,p.dringR*1.22,0,0,TAU); g.stroke();
      g.restore();
    }
    // v3.0 焔の翼の残像
    if(p.fwingAnim>0){ g.save(); g.globalAlpha=Math.min(1,p.fwingAnim/0.25)*0.8; g.strokeStyle='#ff9a4a'; g.lineWidth=8; g.lineCap='round'; g.shadowColor='#ff7a3a'; g.shadowBlur=14; g.beginPath(); g.moveTo(p.fwingX,p.fwingY-14); g.lineTo(p.x,p.y-14); g.stroke(); g.restore(); }
    // ノヴァ(フレイラの爆炎は炎の色)
    if(p.novaAnim>0){
      const pr2=(1-p.novaAnim/0.5);
      g.globalAlpha=(1-pr2)*0.8;
      g.strokeStyle=p.novaFire?'#ff9a4a':'#fff3c4'; g.lineWidth=5;
      g.shadowColor=p.novaFire?'#ff5a1a':'#ffd76a'; g.shadowBlur=14;
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
    drawGirl(g,p.x,p.y,{t:p.anim,face:p.face,moving:p.moving&&G.mode==='battle',mood,heat:heatVis,id:p.id});
    g.globalAlpha=1;
    drawAttachments(g,p);
    drawSuckers(g,p);
    if(p.out && p.captive) drawCaptiveMark(g,p);
    drawStateFx(g,p);
    if(G.mode==='battle'){
      if(p.pinned && !p.out) drawPinGauge(g,p);   // v3.0 捕まって残っている子には脱出ゲージを出さない
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
    }   // v3.0 ヒロインごとの描画ここまで
    B.ci=leaderIdx();

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
      }else if(b.kind==='spirit'){
        // みちびきの精霊: 尾を引く小さな光
        g.rotate(Math.atan2(b.vy,b.vx));
        g.strokeStyle=b.evo?'rgba(255,200,230,0.5)':'rgba(200,235,255,0.5)'; g.lineWidth=3; g.lineCap='round';
        g.beginPath(); g.moveTo(-16,0); g.quadraticCurveTo(-8,3*Math.sin(performance.now()*0.02),-2,0); g.stroke();
        g.shadowColor=b.evo?'#ffb3cf':'#8fd3ff'; g.shadowBlur=12; g.fillStyle=b.evo?'#ffe3ef':'#e8f4ff';
        g.beginPath(); g.arc(0,0,b.evo?5.5:4.5,0,TAU); g.fill();
        g.fillStyle='#fff'; g.beginPath(); g.arc(1,-1,1.6,0,TAU); g.fill();
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
    // プリズムウィップ/炎の剣の薙ぎ(残像)
    for(const hh of B.heroes){ const p=hh;
    if(p.whipAnim>0){
      const pr2=clamp(p.whipAnim/0.16,0,1);
      g.save();
      g.globalAlpha=pr2*0.75;
      /* ★v6.3 whipDark を誰も読んでいなかった。ヤミコの闇の刃が、ルミナの桃色の光で描かれていた */
      g.strokeStyle=p.whipDark?'#a77dff':(p.whipFire?'#ffb060':'#ffe3f0'); g.lineWidth=5; g.lineCap='round';
      g.shadowColor=p.whipDark?'#2a1a3e':(p.whipFire?'#ff6a1a':'#ff9ec2'); g.shadowBlur=12;
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
    for(const p of G.B.heroes){   // v3.0 全員の吹き出しと守りの光
    if(p.guardT>0){ glow(g,p.x,p.y-14,62,'255,215,106',0.3+0.15*Math.sin(G.B.time*8)); g.save(); g.strokeStyle='rgba(255,230,150,0.8)'; g.lineWidth=2; g.beginPath(); g.ellipse(p.x,p.y-12,30,38,0,0,TAU); g.stroke(); g.restore(); }   // v2.3 聖光の壁
    if(p.emberT>0){ glow(g,p.x,p.y-14,70,'255,120,60',0.3+0.15*Math.sin(G.B.time*10)); }   // v3.0 熾火の壁
    drawBubbleAt(g,p.x,p.y,p.bubble,p.bubbleT);
    }
  }
  g.restore();

  if(inBattle) drawDark(g, W/2-G.cam.x+sx, H/2-G.cam.y+sy);   // v4.0 暗闇は世界の上、UIの下に落とす
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
