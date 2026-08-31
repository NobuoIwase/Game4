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
};

/* ---------------- 世界 ---------------- */
function drawTiles(g){
  const cx=G.cam.x, cy=G.cam.y, T=64;
  const i0=Math.floor((cx-W/2)/T)-1, i1=Math.floor((cx+W/2)/T)+1;
  const j0=Math.floor((cy-H/2)/T)-1, j1=Math.floor((cy+H/2)/T)+1;
  for(let i=i0;i<=i1;i++){
    for(let j=j0;j<=j1;j++){
      g.fillStyle=((i+j)&1)?'#1b1e36':'#1d213b';
      g.fillRect(i*T,j*T,T+0.5,T+0.5);
      const h=hash2(i,j);
      if(h<0.05){ // 花
        const fx=i*T+((h*7919)%1)*T, fy=j*T+((h*104729)%1)*T;
        g.fillStyle= h<0.025 ? 'rgba(255,190,215,0.45)' : 'rgba(220,230,255,0.38)';
        for(let k=0;k<4;k++){ const a=k*TAU/4+h*9; g.beginPath(); g.arc(fx+Math.cos(a)*2.4,fy+Math.sin(a)*2.4,1.7,0,TAU); g.fill(); }
        g.fillStyle='rgba(255,225,140,0.55)'; g.beginPath(); g.arc(fx,fy,1.3,0,TAU); g.fill();
      }else if(h<0.13){ // 草
        const fx=i*T+((h*7919)%1)*T, fy=j*T+((h*104729)%1)*T;
        g.strokeStyle='rgba(120,140,200,0.26)'; g.lineWidth=1.4; g.lineCap='round';
        for(let k=-1;k<=1;k++){ g.beginPath(); g.moveTo(fx+k*3,fy+3); g.quadraticCurveTo(fx+k*4,fy-2,fx+k*5,fy-5); g.stroke(); }
      }else if(h>0.985){ // 光茸
        const fx=i*T+((h*7919)%1)*T, fy=j*T+((h*104729)%1)*T;
        g.fillStyle='rgba(120,90,190,0.5)';
        g.beginPath(); g.arc(fx,fy,3.2,Math.PI,0); g.fill();
        g.fillStyle='rgba(180,140,255,0.35)';
        g.beginPath(); g.arc(fx,fy-1,4.5,Math.PI,0); g.fill();
        g.strokeStyle='rgba(150,120,220,0.4)'; g.lineWidth=1.6;
        g.beginPath(); g.moveTo(fx,fy); g.lineTo(fx,fy+3.6); g.stroke();
      }
    }
  }
}
function drawLight(g,x,y){
  const lg=g.createRadialGradient(x,y-10,20,x,y-10,270);
  lg.addColorStop(0,'rgba(255,244,214,0.10)');
  lg.addColorStop(1,'rgba(255,244,214,0)');
  g.fillStyle=lg;
  g.beginPath(); g.arc(x,y-10,270,0,TAU); g.fill();
}
function drawGem(g,gem){
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
function drawTrail(g,tr){
  const a=clamp(1-tr.t/tr.life,0,1)*0.4;
  g.fillStyle='rgba(120,230,190,'+(a*0.55).toFixed(3)+')';
  g.beginPath(); g.ellipse(tr.x,tr.y,tr.r,tr.r*0.7,0,0,TAU); g.fill();
  g.fillStyle='rgba(200,255,235,'+(a*0.5).toFixed(3)+')';
  g.beginPath(); g.ellipse(tr.x-2,tr.y-2,tr.r*0.4,tr.r*0.26,0,0,TAU); g.fill();
}
let cloudSprite=null;
function makeCloudSprite(){
  cloudSprite=document.createElement('canvas');
  cloudSprite.width=128; cloudSprite.height=128;
  const cg=cloudSprite.getContext('2d');
  for(const [ox,oy,rr2] of [[-12,-6,42],[14,8,36],[0,0,52]]){
    const grad=cg.createRadialGradient(64+ox,64+oy,rr2*0.2,64+ox,64+oy,rr2);
    grad.addColorStop(0,'rgba(255,158,194,0.22)');
    grad.addColorStop(1,'rgba(255,158,194,0)');
    cg.fillStyle=grad;
    cg.beginPath(); cg.arc(64+ox,64+oy,rr2,0,TAU); cg.fill();
  }
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
  g.drawImage(cloudSprite,-64*sc,-64*sc,128*sc,128*sc);
  g.rotate(-c.t*0.5);
  g.drawImage(cloudSprite,-58*sc,-58*sc,116*sc,116*sc);
  g.globalAlpha=lifeA*0.6;
  g.fillStyle='rgba(255,194,216,0.8)';
  for(let i=0;i<3;i++){
    const ph=c.t*1.3+i*2.1;
    g.beginPath();
    g.arc(Math.cos(ph)*c.r*0.5, Math.sin(ph*1.2)*c.r*0.4-3, 1.6,0,TAU);
    g.fill();
  }
  g.restore();
}
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
function drawGirl(g,x,y,opt){
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
    if(at.kind==='cling'){
      // ワームの巻きつき
      g.save();
      g.translate(p.x,p.y);
      g.rotate(Math.sin(t*8)*0.2);
      g.strokeStyle='#c9a06a'; g.lineWidth=3.4; g.lineCap='round';
      for(let i=0;i<3;i++){
        g.beginPath();
        g.arc(0,-i*2.6,4.6-i*0.7, Math.PI*0.15+Math.sin(t*6+i)*0.2, Math.PI*1.6+Math.sin(t*6+i)*0.2);
        g.stroke();
      }
      g.fillStyle='#7a5a3a';
      g.beginPath(); g.arc(Math.sin(t*6)*2,-8,2.6,0,TAU); g.fill();
      g.fillStyle='#e8d8c8';
      g.beginPath(); g.arc(Math.sin(t*6)*2,-8,1.2,0,TAU); g.fill();
      g.restore();
    }else{
      // 蔦(触手花/大触手): 主から四肢への線+巻き
      const src=at.mon;
      g.save();
      g.strokeStyle=src.id==='gtent'?'#a06ac9':'#4fc496';
      g.lineWidth=src.id==='gtent'?3.6:2.6;
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
function drawStruggleRing(g,h){
  const o=oldestAttachment(h);
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

  if(e.id==='slug') drawSlug(g,e);
  else if(e.id==='ghost') drawGhost(g,e);
  else if(e.id==='slime') drawSlime(g,e,false);
  else if(e.id==='mistslime') drawSlime(g,e,true);
  else if(e.id==='worm') drawWormG(g,e);
  else if(e.id==='gas') drawGas(g,e);
  else if(e.id==='imp') drawImp(g,e);
  else if(e.id==='flower') drawFlower(g,e);
  else if(e.id==='gtent') drawGtent(g,e);
  else drawBoss(g,e);

  if(e.hitFlash>0){
    g.globalAlpha=Math.min(1,e.hitFlash*6)*0.75;
    g.fillStyle='#ffffff';
    g.beginPath(); g.arc(0,-e.r*0.9,e.r*1.05,0,TAU); g.fill();
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
  // 体(ぬめり)
  g.fillStyle='#a8cc5e';
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
    g.beginPath(); g.arc(wx+sd*2+tip,-r*1.28,1.3,0,TAU); g.fill();
  }
  // ハート模様(魅了持ちの記号)
  g.fillStyle='rgba(255,130,175,0.75)';
  heartPath(g,-r*0.3,-r*0.5,0.9); g.fill();
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
function drawImp(g,e){
  // 小淫魔: 女の子っぽい小悪魔。パタパタと飛んで煽る
  const r=e.r*1.15, fl=Math.sin(e.t*11);
  g.save();
  g.translate(0,fl*1.6-r*0.5);
  const dir=Math.cos(e.orbitA||0)>=0?1:-1;
  g.scale(dir,1);
  // 羽(パタパタ)
  g.fillStyle='#b8548a';
  for(const sd of [-1,1]){
    const flap=fl*0.5*sd;
    g.beginPath();
    g.moveTo(sd*r*0.3,-r*1.05);
    g.quadraticCurveTo(sd*r*1.35,-r*1.5-flap*6, sd*r*1.3,-r*0.6-flap*7);
    g.quadraticCurveTo(sd*r*0.8,-r*0.7, sd*r*0.3,-r*0.7);
    g.closePath(); g.fill();
  }
  // しっぽ(ハート鏃)
  g.strokeStyle='#d86aa0'; g.lineWidth=1.6; g.lineCap='round';
  g.beginPath();
  g.moveTo(-r*0.2,-r*0.35);
  g.quadraticCurveTo(-r*0.9,-r*0.1, -r*1.1+Math.sin(e.t*5)*2, -r*0.7);
  g.stroke();
  g.fillStyle='#ff86b3';
  heartPath(g,-r*1.1+Math.sin(e.t*5)*2,-r*0.82,0.75); g.fill();
  // 素足(ぶらぶら)
  g.strokeStyle='#ffd9c9'; g.lineWidth=1.8;
  g.beginPath(); g.moveTo(-r*0.15,-r*0.4); g.lineTo(-r*0.2,-r*0.05+fl*0.6); g.stroke();
  g.beginPath(); g.moveTo(r*0.15,-r*0.4); g.lineTo(r*0.22,-r*0.02-fl*0.6); g.stroke();
  // ちいさなドレス身体
  g.fillStyle='#e05a92';
  g.beginPath();
  g.moveTo(-r*0.32,-r*0.95);
  g.quadraticCurveTo(-r*0.55,-r*0.45,-r*0.4,-r*0.35);
  g.lineTo(r*0.4,-r*0.35);
  g.quadraticCurveTo(r*0.55,-r*0.45,r*0.32,-r*0.95);
  g.closePath(); g.fill();
  // 腕(ちょいちょいと手招き)
  g.strokeStyle='#ffd9c9'; g.lineWidth=1.6;
  const beck=Math.sin(e.t*6)*1.4;
  g.beginPath(); g.moveTo(-r*0.3,-r*0.8); g.lineTo(-r*0.55,-r*0.65); g.stroke();
  g.beginPath(); g.moveTo(r*0.3,-r*0.8); g.lineTo(r*0.6,-r*0.85+beck); g.stroke();
  // 頭
  g.fillStyle='#ffe3d5';
  g.beginPath(); g.arc(0,-r*1.28,r*0.46,0,TAU); g.fill();
  // 髪(ツインテの小悪魔)
  g.fillStyle='#d86ab8';
  g.beginPath(); g.arc(0,-r*1.38,r*0.48,Math.PI*0.95,Math.PI*2.05); g.fill();
  for(const sd of [-1,1]){
    g.beginPath();
    g.moveTo(sd*r*0.42,-r*1.45);
    g.quadraticCurveTo(sd*r*0.85,-r*1.2+fl*1.2, sd*r*0.7,-r*0.75);
    g.quadraticCurveTo(sd*r*0.5,-r*1.05, sd*r*0.34,-r*1.25);
    g.closePath(); g.fill();
  }
  // つの
  g.fillStyle='#fff';
  g.beginPath(); g.moveTo(-r*0.24,-r*1.62); g.lineTo(-r*0.36,-r*1.85); g.lineTo(-r*0.1,-r*1.68); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(r*0.24,-r*1.62); g.lineTo(r*0.36,-r*1.85); g.lineTo(r*0.1,-r*1.68); g.closePath(); g.fill();
  // 顔(にやにや)
  g.fillStyle='#5a1f3a';
  g.beginPath(); g.ellipse(-r*0.16,-r*1.3,r*0.07,r*0.11,0,0,TAU); g.fill();
  g.beginPath(); g.ellipse(r*0.16,-r*1.3,r*0.07,r*0.11,0,0,TAU); g.fill();
  g.strokeStyle='#5a1f3a'; g.lineWidth=1.1; g.lineCap='round';
  g.beginPath(); g.arc(0,-r*1.18,r*0.14,Math.PI*0.15,Math.PI*0.85); g.stroke();
  g.fillStyle='rgba(255,120,160,0.5)';
  g.beginPath(); g.ellipse(-r*0.3,-r*1.18,r*0.09,r*0.06,0,0,TAU); g.fill();
  g.beginPath(); g.ellipse(r*0.3,-r*1.18,r*0.09,r*0.06,0,0,TAU); g.fill();
  g.restore();
}
function drawGhost(g,e){
  const r=e.r, ph=e.t*6;
  g.globalAlpha=0.92;
  g.fillStyle='#dfe4ff';
  g.strokeStyle='rgba(140,150,210,0.8)'; g.lineWidth=1.2;
  g.beginPath();
  g.arc(0,-r,r*0.95,Math.PI,0);
  g.lineTo(r*0.95,-r*0.15);
  for(let i=0;i<3;i++){
    const x1=r*0.95-(i*2+1)*r*0.317, dip=Math.sin(ph+i)*2;
    g.quadraticCurveTo(x1+r*0.16,-r*0.15+5+dip,x1,-r*0.15);
  }
  g.closePath(); g.fill(); g.stroke();
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
function drawPinScene(g){
  const B=G.B;
  if(!B||!B.hero.pinned||!B.pinScene||!B.pinScene.beats||!B.pinScene.beats.length) return;
  const beat=B.pinScene.beats[B.pinSceneIdx % B.pinScene.beats.length];
  g.save();
  const w2=Math.min(640,W-80);
  rr(g,W/2-w2/2,H-142,w2,44,10);
  g.fillStyle='rgba(14,10,28,0.82)'; g.fill();
  g.strokeStyle='rgba(255,110,150,0.5)'; g.lineWidth=1.2; g.stroke();
  g.fillStyle='#e8d8ea'; g.font='12px '+FONT;
  g.textAlign='center'; g.textBaseline='middle';
  g.fillText(beat, W/2, H-120);
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
  g.fillText('/ 3:00 まで生存でルミナの勝利', W/2, 42);
  // 右上
  g.textAlign='right'; g.font='bold 13px '+FONT; g.fillStyle='#ffd76a';
  g.fillText('被撃破 '+B.kills, W-16, 24);
  g.font='10px '+FONT; g.fillStyle='rgba(200,180,255,0.8)';
  g.fillText('第'+genNum(META.gen.idx)+'世代 / 戦歴'+(META.gen.battle+1)+'/'+BAL.GEN_LEN, W-16, 42);
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
  // 状態チップ
  let sx=10, sy=76;
  const chips=[];
  const atk=attachCount(p);
  if(p.pinned) chips.push(['pinned','押し倒し']);
  else if(atk>0){
    const names=attachedSlots(p).map(sl=>LIMB_NAMES[sl]).join('・');
    chips.push(['bound','拘束 '+names]);
  }
  if(p.heatT>0) chips.push(['heat','発情 '+Math.ceil(p.heatT)]);
  else if(p.aphro>=8) chips.push(['aphro','媚薬 '+Math.round(p.aphro)+'%']);
  if(p.slow>0) chips.push(['slow','粘液']);
  if(p.charm>0) chips.push(['charm','魅了 '+p.charm.toFixed(1)]);
  if(p.exhausted) chips.push(['pinned','疲弊']);
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
  g.fillText('enemies:'+B.enemies.length+' fps:'+Math.round(G.fps)+(TS>1?' x'+TS:''), 12, H-6);
  g.textAlign='right'; g.fillStyle='rgba(255,255,255,0.3)'; g.font='bold 10px '+FONT;
  g.fillText('v0.3 侵蝕デッキ', W-12, H-6);
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

  const inBattle=['battle','levelup','captured','survived','result'].includes(G.mode) && G.B;
  const sx=G.shake>0?rand(-G.shake,G.shake):0;
  const sy=G.shake>0?rand(-G.shake,G.shake):0;

  g.save();
  g.translate(W/2-G.cam.x+sx, H/2-G.cam.y+sy);
  drawTiles(g);

  if(inBattle){
    const B=G.B, p=B.hero;
    drawLight(g,p.x,p.y);
    for(const tr of B.trails) drawTrail(g,tr);
    for(const c of B.clouds) drawCloud(g,c);
    for(const s of B.spawnFx) drawSummonFx(g,s);
    for(const pr of B.props) drawProp(g,pr);
    for(const gm of B.gems) drawGem(g,gm);
    for(const h of B.hearts) drawHeartDrop(g,h);
    for(const c of B.chests) drawChest(g,c);

    B.enemies.sort((a,b)=>a.y-b.y);
    for(const e of B.enemies){ if(e.state!=='attached') drawEnemy(g,e); }

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
      const R=(evo?66:52)+3*Math.max(1,p.wp.orb);
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
    const heatVis=p.heatT>0?100:p.aphro;
    const mood = (G.mode==='captured'||p.pinned)?'pinned'
               : attachCount(p)>0?'bound'
               : G.mode==='survived'?'happy'
               : (G.hurtFlash>0.15?'hurt':'normal');
    const blinking = p.ifr>0 && G.mode==='battle' && (Math.floor(p.ifr*14)%2===0);
    if(blinking) g.globalAlpha=0.45;
    drawGirl(g,p.x,p.y,{t:p.anim,face:p.face,moving:p.moving&&G.mode==='battle',mood,heat:heatVis});
    g.globalAlpha=1;
    drawAttachments(g,p);
    if(G.mode==='battle'){
      if(p.pinned) drawPinGauge(g,p);
      else if(attachCount(p)>0) drawStruggleRing(g,p);
    }
    if(heatVis>=30) drawHeatFx(g,p.x,p.y,p.anim,heatVis);
    if(p.charm>0 && p.charmBy && !p.charmBy.dead){
      const cb=p.charmBy;
      g.save();
      g.globalAlpha=0.5+0.3*Math.sin(p.anim*6);
      g.strokeStyle='#ffb3cf'; g.lineWidth=1.4; g.setLineDash([4,5]);
      g.beginPath(); g.moveTo(p.x,p.y-30); g.lineTo(cb.x,cb.y-cb.r); g.stroke();
      g.setLineDash([]);
      g.restore();
    }

    // ヒロインの弾
    for(const b of B.bullets){
      g.save();
      g.translate(b.x,b.y);
      g.rotate(Math.atan2(b.vy,b.vx));
      g.strokeStyle=b.evo?'rgba(180,220,255,0.6)':'rgba(255,215,106,0.5)'; g.lineWidth=2; g.lineCap='round';
      g.beginPath(); g.moveTo(-12,0); g.lineTo(-3,0); g.stroke();
      g.shadowColor=b.evo?'#8fd3ff':'#ffd76a'; g.shadowBlur=9;
      g.fillStyle=b.evo?'#e8f4ff':'#fff6d8';
      star(g,0,0,5.5,2.3,b.evo?5:4,performance.now()*0.02);
      g.fill();
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
  if(G.hurtFlash>0){
    g.fillStyle='rgba(255,40,70,'+(G.hurtFlash*0.32).toFixed(3)+')';
    g.fillRect(0,0,W,H);
  }
  if(inBattle){
    const p=G.B.hero;
    const hv=p.heatT>0?100:p.aphro;
    if(hv>=60){
      const a=(hv-60)/40*0.09;
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
  if(G.mode==='battle') drawPinScene(g);
  if(G.mode==='levelup') drawCards(g);
  drawBanner(g);
}

/* ---------------- DOM用ミニアイコン ---------------- */
function makeIconCanvas(id,size){
  const c=document.createElement('canvas');
  c.width=size; c.height=size;
  const g=c.getContext('2d');
  const fake={ id, r:MONSTERS[id].r, t:1.2, joff:0, state:MONSTERS[id].boss?'chase':(id==='flower'?'bud':'chase'),
    whipT:0, pounceT:0, puffT:2, orbitA:0, boss:MONSTERS[id].boss, bstate:'chase', spd:0, elite:false,
    hp:1, maxHp:1, hitFlash:0, dormant:false };
  g.translate(size/2, size*0.72);
  const sc=size/(MONSTERS[id].r*(MONSTERS[id].boss?4.6:3.4));
  g.scale(sc,sc);
  if(id==='slug') drawSlug(g,fake);
  else if(id==='ghost') drawGhost(g,fake);
  else if(id==='slime') drawSlime(g,fake,false);
  else if(id==='mistslime') drawSlime(g,fake,true);
  else if(id==='worm') drawWormG(g,fake);
  else if(id==='gas') drawGas(g,fake);
  else if(id==='imp') drawImp(g,fake);
  else if(id==='flower') drawFlower(g,fake);
  else if(id==='gtent') drawGtent(g,fake);
  else drawBoss(g,fake);
  return c;
}
