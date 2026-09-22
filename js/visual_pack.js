'use strict';
/* Game4 visual pack v2.0
   High-quality map-chip / VFX rendering layer.
   Monster/hero art and scenario/erotic mechanics are intentionally untouched. */
(function(){
  const TAU=Math.PI*2;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const hash=(x,y,s=0)=>{
    const n=Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453123;
    return n-Math.floor(n);
  };
  const gfx=()=>typeof gfxLv==='function'?gfxLv():2;

  function visibleBounds(){
    if(!G||!G.cam) return null;
    return {x0:G.cam.x-W/2-96,y0:G.cam.y-H/2-96,x1:G.cam.x+W/2+96,y1:G.cam.y+H/2+96};
  }
  function tileCenter(v,step){ return Math.floor(v/step)*step+step/2; }

  function moonstoneDetail(g,x,y,step){
    const h=hash(x,y,1);
    g.save();
    g.globalAlpha=.08;
    const grd=g.createRadialGradient(x-step*.2,y-step*.3,2,x,y,step*.7);
    grd.addColorStop(0,'rgba(220,232,255,.42)');
    grd.addColorStop(.55,'rgba(115,130,170,.08)');
    grd.addColorStop(1,'rgba(10,12,26,0)');
    g.fillStyle=grd; g.fillRect(x-step*.52,y-step*.52,step*1.04,step*1.04);
    g.globalAlpha=.11;
    g.strokeStyle='rgba(150,165,210,.55)';
    g.lineWidth=.7;
    g.strokeRect(x-step*.48,y-step*.48,step*.96,step*.96);
    if(h>.77){
      g.globalAlpha=.11;
      g.strokeStyle='rgba(236,209,132,.8)';
      g.lineWidth=.85;
      g.beginPath();
      g.moveTo(x-step*.22,y); g.lineTo(x+step*.22,y);
      g.moveTo(x,y-step*.22); g.lineTo(x,y+step*.22);
      g.moveTo(x-step*.09,y-step*.09); g.lineTo(x+step*.09,y+step*.09);
      g.moveTo(x+step*.09,y-step*.09); g.lineTo(x-step*.09,y+step*.09);
      g.stroke();
    }
    // deterministic shallow crack
    if(h>.42){
      const h2=hash(x,y,2),h3=hash(x,y,3);
      g.globalAlpha=.10;
      g.strokeStyle='rgba(20,22,35,.75)';
      g.lineWidth=.65;
      g.beginPath();
      g.moveTo(x-step*.32,y-step*(.12+h2*.2));
      g.lineTo(x-step*.06,y-step*(.02-h3*.08));
      g.lineTo(x+step*.18,y+step*(.08+h2*.08));
      g.lineTo(x+step*.34,y+step*(.02-h3*.1));
      g.stroke();
    }
    g.restore();
  }

  function mireDetail(g,x,y,step){
    if(typeof mireAt!=='function'||!mireAt(x,y)) return;
    const h=hash(x,y,4);
    g.save();
    const r=step*(.30+h*.12);
    const grd=g.createRadialGradient(x-step*.08,y-step*.12,2,x,y,r);
    grd.addColorStop(0,'rgba(92,110,116,.22)');
    grd.addColorStop(.35,'rgba(38,54,62,.18)');
    grd.addColorStop(1,'rgba(8,12,18,0)');
    g.fillStyle=grd;
    g.beginPath(); g.ellipse(x,y,r,r*.58,h*TAU,0,TAU); g.fill();
    g.globalAlpha=.18;
    g.strokeStyle='rgba(150,180,195,.5)';
    g.lineWidth=.75;
    g.beginPath(); g.ellipse(x,y,r*.72,r*.28,h*TAU,0,TAU); g.stroke();
    if(h>.68){
      g.globalAlpha=.18;
      g.fillStyle='rgba(88,104,82,.8)';
      g.beginPath(); g.ellipse(x+r*.18,y-r*.08,5,2.5,.3,0,TAU); g.fill();
      g.beginPath(); g.ellipse(x-r*.22,y+r*.06,4,2.2,-.2,0,TAU); g.fill();
    }
    g.restore();
  }

  function sacredPathDetail(g,x,y,step){
    const h=hash(x,y,7);
    if(h<.91) return;
    g.save();
    g.globalAlpha=.11;
    g.strokeStyle='rgba(235,210,145,.9)';
    g.lineWidth=1;
    const r=step*.23;
    g.beginPath();
    g.moveTo(x,y-r); g.lineTo(x+r*.45,y-r*.18); g.lineTo(x+r,y);
    g.lineTo(x+r*.45,y+r*.18); g.lineTo(x,y+r);
    g.lineTo(x-r*.45,y+r*.18); g.lineTo(x-r,y);
    g.lineTo(x-r*.45,y-r*.18); g.closePath(); g.stroke();
    g.restore();
  }

  function crystalSpark(g,x,y,step){
    const h=hash(x,y,11);
    if(h<.94) return;
    g.save();
    g.globalCompositeOperation='screen';
    const a=.10+(h-.94)*1.2;
    g.globalAlpha=clamp(a,.08,.17);
    g.fillStyle='rgba(150,125,255,.9)';
    const s=3+hash(x,y,12)*5;
    g.beginPath();
    g.moveTo(x,y-s*1.6); g.lineTo(x+s*.65,y); g.lineTo(x,y+s*1.25); g.lineTo(x-s*.65,y); g.closePath(); g.fill();
    g.globalAlpha=.14; g.fillStyle='#fff'; g.fillRect(x-.5,y-s*.65,1,1);
    g.restore();
  }

  if(typeof drawTiles==='function'){
    const base=drawTiles;
    drawTiles=function(g){
      base(g);
      if(!G||!G.cam||gfx()===0) return;
      const b=visibleBounds(), step=64;
      if(!b) return;
      const sx=tileCenter(b.x0,step), sy=tileCenter(b.y0,step);
      g.save();
      for(let y=sy;y<=b.y1;y+=step){
        for(let x=sx;x<=b.x1;x+=step){
          if(typeof passAt==='function'&&!passAt(x,y,false)) continue;
          moonstoneDetail(g,x,y,step);
          if(gfx()>1){
            mireDetail(g,x,y,step);
            sacredPathDetail(g,x,y,step);
            crystalSpark(g,x,y,step);
          }
        }
      }
      g.restore();
    };
  }

  function ring(g,x,y,r,c,a=.55,w=2){
    g.save(); g.globalCompositeOperation='screen'; g.globalAlpha=a;
    g.strokeStyle=c; g.lineWidth=w;
    g.beginPath(); g.arc(x,y,r,0,TAU); g.stroke(); g.restore();
  }
  function glow(g,x,y,r,c0,c1='rgba(0,0,0,0)',a=.55){
    g.save(); g.globalCompositeOperation='screen'; g.globalAlpha=a;
    const gr=g.createRadialGradient(x,y,0,x,y,r);
    gr.addColorStop(0,c0); gr.addColorStop(1,c1);
    g.fillStyle=gr; g.beginPath(); g.arc(x,y,r,0,TAU); g.fill(); g.restore();
  }
  function star(g,x,y,r,c='#fff',a=.8){
    g.save(); g.globalCompositeOperation='screen'; g.globalAlpha=a; g.fillStyle=c;
    g.beginPath();
    g.moveTo(x,y-r); g.lineTo(x+r*.16,y-r*.16); g.lineTo(x+r,y); g.lineTo(x+r*.16,y+r*.16);
    g.lineTo(x,y+r); g.lineTo(x-r*.16,y+r*.16); g.lineTo(x-r,y); g.lineTo(x-r*.16,y-r*.16);
    g.closePath(); g.fill(); g.restore();
  }

  function vfxOverlay(g,f){
    if(!f||gfx()===0) return;
    const k=f.kind||'', r=Math.max(10,f.r||24), life=Number.isFinite(f.t)&&Number.isFinite(f.life)&&f.life>0?clamp(f.t/f.life,0,1):.55;
    const pulse=.75+.25*Math.sin((G&&G.B?G.B.time:0)*7);
    if(k==='bolt'||k==='beam'||k==='denbeam'){
      glow(g,f.x,f.y,r*1.8,'rgba(160,185,255,.44)',undefined,.42);
      star(g,f.x,f.y,r*.62,'#f7f3ff',.88);
      ring(g,f.x,f.y,r*.82,'rgba(150,185,255,.78)',.45,1.25);
    }else if(k==='mireburst'||k==='slime'||k==='splash'){
      glow(g,f.x,f.y,r*1.7,'rgba(70,190,180,.34)',undefined,.32);
      ring(g,f.x,f.y,r*(.6+life*.45),'rgba(100,220,205,.7)',.38,1.1);
      for(let i=0;i<5;i++){
        const a=i*TAU/5+hash(f.x,f.y,i)*.6, rr=r*(.45+hash(f.y,f.x,i)*.55);
        g.save();g.globalAlpha=.18;g.fillStyle='rgba(110,225,210,.8)';
        g.beginPath();g.ellipse(f.x+Math.cos(a)*rr,f.y+Math.sin(a)*rr*.65,2.4,1.5,a,0,TAU);g.fill();g.restore();
      }
    }else if(k==='darkslash'||k==='curse'||k==='darkburst'){
      glow(g,f.x,f.y,r*2.1,'rgba(115,55,185,.36)',undefined,.35);
      ring(g,f.x,f.y,r*(.8+life*.35),'rgba(175,105,255,.72)',.34,1.4);
    }else if(k==='nova'||k==='burst'){
      glow(g,f.x,f.y,r*2.25,'rgba(235,220,255,.45)',undefined,.38);
      ring(g,f.x,f.y,r*(.75+life*.6),'rgba(245,225,180,.9)',.45,1.2);
      star(g,f.x,f.y,r*.52*pulse,'#fff6dc',.74);
    }else{
      glow(g,f.x,f.y,r*1.3,'rgba(170,150,255,.22)',undefined,.18);
    }
  }

  if(typeof drawFx==='function'){
    const base=drawFx;
    drawFx=function(g,f){
      base(g,f);
      vfxOverlay(g,f);
    };
  }

  // ambient post grade; subtle enough not to obscure UI
  if(typeof draw==='function'){
    const base=draw;
    draw=function(){
      base();
      if(typeof ctx==='undefined'||gfx()===0) return;
      const g=ctx, ds=(typeof dpr==='number'?dpr:1)*(typeof viewScale==='number'?viewScale:1);
      g.save(); g.setTransform(ds,0,0,ds,0,0);
      const v=g.createRadialGradient(W*.5,H*.44,Math.min(W,H)*.18,W*.5,H*.48,Math.max(W,H)*.72);
      v.addColorStop(0,'rgba(45,55,95,0)');
      v.addColorStop(.72,'rgba(22,18,44,.025)');
      v.addColorStop(1,'rgba(8,8,22,.07)');
      g.fillStyle=v; g.fillRect(0,0,W,H);
      g.restore();
    };
  }

  window.Game4VisualPack={
    version:'2.0.0',
    scope:'map+vfx',
    note:'monster/hero/scenario rendering untouched'
  };
})();