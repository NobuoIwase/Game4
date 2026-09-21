'use strict';
/* Game4 quality patch v1.0
   Tactical AI, progression telemetry, and world rendering polish.
   Existing scenario and erotic-state mechanics are intentionally not rewritten. */
(function(){
  const norm=(x,y)=>{ const d=Math.hypot(x,y)||1; return {x:x/d,y:y/d}; };
  const audit=(p,reason,extra)=>{
    if(typeof G==='undefined'||!G.B||!p) return;
    const B=G.B;
    B.tacticalAudit=B.tacticalAudit||[];
    B.tacticalAudit.push(Object.assign({
      t:+(B.time||0).toFixed(2), id:p.id, reason,
      state:p.steerState||'',
      hp:+(p.hp/Math.max(1,p.maxHp||1)).toFixed(2),
      stam:+(p.stamina/Math.max(1,p.staminaMax||1)).toFixed(2)
    },extra||{}));
    if(B.tacticalAudit.length>240) B.tacticalAudit.splice(0,B.tacticalAudit.length-240);
    p.tacticalReason=reason;
  };
  function hazardVector(p){
    const B=G.B; let x=0,y=0,w=0,cloudN=0;
    for(const c of (B.clouds||[])){
      const dx=p.x-c.x,dy=p.y-c.y,d=Math.hypot(dx,dy)||1,reach=(c.r||0)+72;
      if(d<reach){ const k=1-d/reach; x+=dx/d*k; y+=dy/d*k; w+=k; if(d<(c.r||0)) cloudN++; }
    }
    for(const e of (B.enemies||[])){
      if(e.dead||e.dormant||e.state==='attached') continue;
      const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1,reach=(e.boss?330:190)+(e.r||0);
      if(d<reach){ const k=(1-d/reach)*(e.boss?2.1:1); x+=dx/d*k; y+=dy/d*k; w+=k; }
    }
    if(Math.hypot(x,y)<0.001){ x=-(p.steerX||p.vx||1); y=-(p.steerY||p.vy||0); }
    const n=norm(x,y); return {x:n.x,y:n.y,w,cloudN};
  }
  function nearestEnemy(p,maxD){
    let best=null,bd=maxD||1e9;
    for(const e of (G.B.enemies||[])){
      if(e.dead||e.dormant||e.state==='attached') continue;
      const d=Math.hypot(e.x-p.x,e.y-p.y); if(d<bd){bd=d;best=e;}
    }
    return best?{e:best,d:bd}:null;
  }
  function weakestMate(p){
    let best=null,bs=9;
    for(const h of (G.B.heroes||[])){
      if(h===p||h.out||h.captive) continue;
      const s=(h.hp/Math.max(1,h.maxHp||1))*0.55+(h.stamina/Math.max(1,h.staminaMax||1))*0.45;
      if(s<bs){bs=s;best=h;}
    }
    return best?{h:best,s:bs}:null;
  }
  function steerBlend(p,x,y,k,state){
    const n=norm(x,y);
    p.steerX=(p.steerX||0)*(1-k)+n.x*k;
    p.steerY=(p.steerY||0)*(1-k)+n.y*k;
    if(state) p.steerState=state;
  }
  function tacticalPost(p){
    if(!p||p.out||p.captive||p.pinned||p.charmBind||p.climaxT>0) return;
    const B=G.B,hp=p.hp/Math.max(1,p.maxHp||1),st=p.stamina/Math.max(1,p.staminaMax||1);
    const hz=hazardVector(p),mate=weakestMate(p);
    const severe=hp<0.30||st<0.24||hz.cloudN>=2;
    const strained=hp<0.48||st<0.36||hz.w>1.55;

    if((p.steerState==='assist'||p.steerState==='g_rescue'||p.steerState==='g_cover')&&st<0.30&&hz.w>0.55){
      steerBlend(p,hz.x,hz.y,0.90,'retreat');
      audit(p,'援護綑続を断念: 自分の余力不足',{haz:+hz.w.toFixed(2)}); return;
    }
    if(p.diveT>0&&(strained||(hz.cloudN>0&&st<0.48))){
      p.diveT=0; steerBlend(p,hz.x,hz.y,0.92,'retreat');
      audit(p,'ガス内回収を中止: 往復余力不足',{cloudN:hz.cloudN,haz:+hz.w.toFixed(2)}); return;
    }
    if(typeof mireAt==='function'&&(p.steerX||p.steerY)){
      const n=norm(p.steerX||0,p.steerY||0),qx=p.x+n.x*58,qy=p.y+n.y*58;
      if(!mireAt(p.x,p.y)&&mireAt(qx,qy)&&(st<0.42||hp<0.42||hz.w>1.25)){
        p.scared=p.scared||{}; p.scared.mire=(B.time||0)+8;
        p.steerX=-n.x*0.55+hz.x*0.8; p.steerY=-n.y*0.55+hz.y*0.8; p.steerState='hesitate';
        audit(p,'沼への突入を拒否: 帰路の危険が高い',{haz:+hz.w.toFixed(2)}); return;
      }
    }
    if(severe){
      steerBlend(p,hz.x,hz.y,0.88,'retreat');
      audit(p,'緊急離脱: HP/スタミナ/重複危険',{cloudN:hz.cloudN,haz:+hz.w.toFixed(2)}); return;
    }

    const ne=nearestEnemy(p,420);
    const partner=(typeof partnerFor==='function')?partnerFor(p):null;
    if(p.id==='freila'&&ne&&st>0.44&&hp>0.42){
      const dx=ne.e.x-p.x,dy=ne.e.y-p.y;
      if(ne.d>92&&hz.w<1.35){ steerBlend(p,dx,dy,0.34,'kite'); p.preferredRange=88; audit(p,'フレイラ: 前衛間合いへ詰める'); }
    }else if(p.id==='kuu'){
      if(ne&&ne.d<145){ steerBlend(p,p.x-ne.e.x,p.y-ne.e.y,0.52,'kite2'); audit(p,'クウ: 近接圧から離れて支援距離を確保'); }
      else if(mate&&mate.s<0.62&&st>0.40){ steerBlend(p,mate.h.x-p.x,mate.h.y-p.y,0.24,'g_cover'); audit(p,'クウ: 弱った味方側へ支援位置を調整'); }
      else if(partner){
        const d=Math.hypot(partner.x-p.x,partner.y-p.y);
        if(d<115) steerBlend(p,p.x-partner.x,p.y-partner.y,0.20,'kite2');
        else if(d>245) steerBlend(p,partner.x-p.x,partner.y-p.y,0.18,'g_cover');
      }
      p.preferredRange=210;
    }else if(p.id==='yamiko'&&ne){
      if((st<0.42||hp<0.46)&&partner){
        steerBlend(p,partner.x-p.x,partner.y-p.y,0.42,'g_cover');
        audit(p,'ヤミコ: 消耗時だけ孤立を解いて合流');
      }else if(hz.w<1.15){
        const dx=ne.e.x-p.x,dy=ne.e.y-p.y,n=norm(dx,dy),side=((p.strafeDir||1)>0?1:-1);
        steerBlend(p,-n.y*side+n.x*0.18,n.x*side+n.y*0.18,0.26,'kite2');
        audit(p,'ヤミコ: 単独気味に側面を取る');
      }
      p.preferredRange=155;
    }else p.preferredRange=165;

    const sx=p.steerX||p.vx||0,sy=p.steerY||p.vy||0;
    if(Math.hypot(sx,sy)>0.08){ let a=Math.atan2(sy,sx); if(a<0)a+=Math.PI*2; p.face8=Math.round(a/(Math.PI/4))&7; }
  }

  if(typeof aiDecide==='function'){
    const baseAI=aiDecide;
    aiDecide=function(foc,dt){
      baseAI(foc,dt);
      const hs=(G.B&&G.B.heroes)||[G.B&&G.B.hero];
      for(const h of hs) if(h&&!h.out&&!h.captive) tacticalPost(h);
    };
  }

  if(typeof partyJoinCheck==='function'){
    const baseJoin=partyJoinCheck;
    partyJoinCheck=function(){
      const B=G.B,before=(typeof META!=='undefined'&&META.run)?JSON.stringify(META.run):'';
      const r=baseJoin.apply(this,arguments);
      const after=(typeof META!=='undefined'&&META.run)?JSON.stringify(META.run):'';
      if(B&&before!==after){
        B.joinAudit=B.joinAudit||[];
        B.joinAudit.push({t:B.time||0,depth:(B.floor&&B.floor.depth)||0,before,after});
        if(B.joinAudit.length>40) B.joinAudit.shift();
      }
      return r;
    };
  }

  if(typeof drawEnemy==='function'){
    const baseEnemy=drawEnemy;
    drawEnemy=function(g,e){
      if(!e||e.dead) return baseEnemy(g,e);
      g.save();
      g.globalAlpha=0.28; g.fillStyle='rgba(0,0,0,.72)';
      g.beginPath(); g.ellipse(e.x,e.y+Math.max(3,(e.r||10)*0.36),(e.r||12)*0.92,(e.r||12)*0.28,0,0,Math.PI*2); g.fill();
      g.restore();
      baseEnemy(g,e);
      g.save();
      const r=Math.max(9,e.r||12),gr=g.createRadialGradient(e.x-r*.35,e.y-r*.55,1,e.x,e.y,r*1.25);
      gr.addColorStop(0,'rgba(255,255,255,'+(e.boss?0.22:0.13)+')'); gr.addColorStop(.38,'rgba(255,255,255,0)'); gr.addColorStop(1,'rgba(0,0,0,.18)');
      g.globalCompositeOperation='screen'; g.globalAlpha=.8; g.fillStyle=gr;
      g.beginPath(); g.arc(e.x,e.y,r*1.05,0,Math.PI*2); g.fill(); g.restore();
    };
  }

  if(typeof drawTiles==='function'){
    const baseTiles=drawTiles;
    drawTiles=function(g){
      baseTiles(g);
      if(!G||!G.cam||(typeof gfxLv==='function'&&gfxLv()===0)) return;
      const step=64,x0=Math.floor((G.cam.x-W/2-80)/step)*step,y0=Math.floor((G.cam.y-H/2-80)/step)*step;
      g.save(); g.lineCap='round';
      for(let y=y0;y<G.cam.y+H/2+80;y+=step) for(let x=x0;x<G.cam.x+W/2+80;x+=step){
        const h=Math.sin(x*12.9898+y*78.233)*43758.5453,f=h-Math.floor(h);
        if(f<0.58) continue;
        if(typeof passAt==='function'&&!passAt(x,y,false)) continue;
        g.globalAlpha=.045+.03*f; g.strokeStyle=f>.82?'#d7ccff':'#0a0816'; g.lineWidth=.7;
        g.beginPath(); g.moveTo(x-8,y+5); g.lineTo(x-2,y+1); g.lineTo(x+5,y+4); g.stroke();
        g.globalAlpha=.035; g.fillStyle='#fff'; g.fillRect(x+10,y-9,1,1);
      }
      g.restore();
    };
  }

  if(typeof draw==='function'){
    const baseDraw=draw;
    draw=function(){
      baseDraw();
      if(typeof ctx==='undefined'||!G) return;
      const g=ctx,ds=(typeof dpr==='number'?dpr:1)*(typeof viewScale==='number'?viewScale:1);
      g.save(); g.setTransform(ds,0,0,ds,0,0);
      const gr=g.createLinearGradient(0,0,W,H);
      gr.addColorStop(0,'rgba(90,110,170,.025)'); gr.addColorStop(.5,'rgba(0,0,0,0)'); gr.addColorStop(1,'rgba(120,40,80,.035)');
      g.fillStyle=gr; g.fillRect(0,0,W,H);
      if(G.shake>2){ g.globalAlpha=Math.min(.08,G.shake*.008); g.fillStyle='#fff'; g.fillRect(0,0,W,H); }
      g.restore();
    };
  }

  window.Game4QualityPatch={
    version:'1.0.0',
    audit:()=>G&&G.B?(G.B.tacticalAudit||[]):[],
    joinAudit:()=>G&&G.B?(G.B.joinAudit||[]):[]
  };
})();