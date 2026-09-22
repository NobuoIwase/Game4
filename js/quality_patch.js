'use strict';
/* Game4 quality patch v1.3 — AI / balance telemetry / rendering only.
   Existing scenario and erotic-state mechanics are intentionally left intact. */
(function(){
 const norm=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d}};
 const blend=(p,x,y,k,state)=>{const n=norm(x,y);p.steerX=(p.steerX||0)*(1-k)+n.x*k;p.steerY=(p.steerY||0)*(1-k)+n.y*k;if(state)p.steerState=state};
 const audit=(p,reason,extra)=>{if(!G||!G.B||!p)return;const B=G.B,a=B.tacticalAudit||(B.tacticalAudit=[]);a.push(Object.assign({t:+(B.time||0).toFixed(2),id:p.id,reason,state:p.steerState||'',hp:+(p.hp/Math.max(1,p.maxHp||1)).toFixed(2),stam:+(p.stamina/Math.max(1,p.staminaMax||1)).toFixed(2)},extra||{}));if(a.length>240)a.splice(0,a.length-240);p.tacticalReason=reason};
 function sample(p){if(!G||!G.B||!p)return;const B=G.B,a=B.balanceAudit||(B.balanceAudit=[]),nearCloud=(B.clouds||[]).filter(c=>Math.hypot(p.x-c.x,p.y-c.y)<(c.r||0)).length;a.push({t:+(B.time||0).toFixed(1),id:p.id,depth:(B.floor&&B.floor.depth)||0,hp:+(p.hp/Math.max(1,p.maxHp||1)).toFixed(2),stam:+(p.stamina/Math.max(1,p.staminaMax||1)).toFixed(2),aphro:+(p.aphro||0).toFixed(1),heat:p.heatLv||0,bound:typeof attachCount==='function'?attachCount(p):0,pinned:!!p.pinned,exhausted:!!p.exhausted,clouds:nearCloud,zone:p.zone||'',sticky:+(p.sticky||0).toFixed(2),state:p.steerState||''});if(a.length>600)a.splice(0,a.length-600)}
 function hazard(p){const B=G.B;let x=0,y=0,w=0,cloudN=0;for(const c of(B.clouds||[])){const dx=p.x-c.x,dy=p.y-c.y,d=Math.hypot(dx,dy)||1,r=(c.r||0)+72;if(d<r){const k=1-d/r;x+=dx/d*k;y+=dy/d*k;w+=k;if(d<(c.r||0))cloudN++}}for(const e of(B.enemies||[])){if(e.dead||e.dormant||e.state==='attached')continue;const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1,r=(e.boss?330:190)+(e.r||0);if(d<r){const k=(1-d/r)*(e.boss?2.1:1);x+=dx/d*k;y+=dy/d*k;w+=k}}if(Math.hypot(x,y)<.001){x=-(p.steerX||p.vx||1);y=-(p.steerY||p.vy||0)}const n=norm(x,y);return{x:n.x,y:n.y,w,cloudN}}
 function nearestEnemy(p,maxD=1e9){let best=null,bd=maxD;for(const e of(G.B.enemies||[])){if(e.dead||e.dormant||e.state==='attached')continue;const d=Math.hypot(e.x-p.x,e.y-p.y);if(d<bd){bd=d;best=e}}return best?{e:best,d:bd}:null}
 function weakestMate(p){let best=null,bs=9;for(const h of(G.B.heroes||[])){if(h===p||h.out||h.captive)continue;const s=(h.hp/Math.max(1,h.maxHp||1))*.55+(h.stamina/Math.max(1,h.staminaMax||1))*.45;if(s<bs){bs=s;best=h}}return best?{h:best,s:bs}:null}
 function lineDodge(p,ox,oy,a,len,width){const ux=Math.cos(a),uy=Math.sin(a),rx=p.x-ox,ry=(p.y-14)-oy,t=rx*ux+ry*uy;if(t<0||t>len)return null;const px=rx-ux*t,py=ry-uy*t,pd=Math.hypot(px,py);if(pd>=width)return null;const side=(p.strafeDir||1)>=0?1:-1;return pd>.001?{x:px/pd,y:py/pd,d:pd}:{x:-uy*side,y:ux*side,d:0}}
 function beamEscape(p,foc){
  const dodge=Math.max(0,(foc||0)*(1-.25*(p.hypnoLv||0))); if(dodge<=.1)return null;
  const known=e=>typeof knowLv!=='function'||knowLv(e.id)>0;
  for(const e of(G.B.enemies||[])){if(e.dead||e.dormant||!known(e))continue;let q=null;
   if(e.id==='beamer'&&e.bmState==='aim'&&Number.isFinite(e.bmAng))q=lineDodge(p,e.x,e.y-e.r*1.4,e.bmAng,typeof BAL!=='undefined'?BAL.BEAM_LEN:900,60);
   if(!q&&e.id==='core'&&(e.beamT||0)>0)q=lineDodge(p,e.x,e.y,e.beamA||0,typeof BAL!=='undefined'?BAL.CORE_BEAM_LEN:900,(typeof BAL!=='undefined'?BAL.CORE_BEAM_W*.9:70));
   if(!q&&e.rays)for(const r of e.rays){if(r.state==='off'||!r.len)continue;q=lineDodge(p,e.x,e.y-e.r*1.2,r.ang,r.len,typeof BAL!=='undefined'?BAL.RAY_AVOID_W:70);if(q)break}
   if(q){q.dodge=dodge;return q}
  }
  if(typeof crestKnow!=='function'||crestKnow()>0)for(const b of(G.B.ebullets||[])){const sp=Math.hypot(b.vx,b.vy);if(!sp)continue;const q=lineDodge(p,b.x,b.y,Math.atan2(b.vy,b.vx),240,52);if(q){q.dodge=dodge;return q}}
  return null;
 }
 function tacticalPost(p,foc){
  if(!p||p.out||p.captive||p.pinned||p.charmBind||p.climaxT>0)return;sample(p);
  const B=G.B,hp=p.hp/Math.max(1,p.maxHp||1),st=p.stamina/Math.max(1,p.staminaMax||1),hz=hazard(p),mate=weakestMate(p),beam=beamEscape(p,foc);
  const cognition=Math.max(.2,Math.min(1,(foc||0)*(1-.25*(p.hypnoLv||0))));
  if(beam){blend(p,beam.x,beam.y,.92*beam.dodge,'dodge');audit(p,'射線回避: 中心線でも横方向を生成',{beamD:+beam.d.toFixed(1)});return}
  const severe=hp<.30||st<.24||hz.cloudN>=2,strained=hp<.48||st<.36||hz.w>1.55;
  if((p.steerState==='assist'||p.steerState==='g_rescue'||p.steerState==='g_cover')&&st<.30&&hz.w>.55){blend(p,hz.x,hz.y,.9*cognition,'retreat');audit(p,'援護継続を断念: 自分の余力不足');return}
  if(p.diveT>0&&(strained||(hz.cloudN>0&&st<.48))){p.diveT=0;blend(p,hz.x,hz.y,.92*cognition,'retreat');audit(p,'ガス内回収を中止: 往復余力不足',{cloudN:hz.cloudN});return}
  if(typeof mireAt==='function'&&(p.steerX||p.steerY)){const n=norm(p.steerX||0,p.steerY||0),qx=p.x+n.x*58,qy=p.y+n.y*58;if(!mireAt(p.x,p.y)&&mireAt(qx,qy)&&(st<.42||hp<.42||hz.w>1.25)){p.scared=p.scared||{};p.scared.mire=(B.time||0)+8;p.steerX=(p.steerX||0)*(1-cognition)+(-n.x*.55+hz.x*.8)*cognition;p.steerY=(p.steerY||0)*(1-cognition)+(-n.y*.55+hz.y*.8)*cognition;p.steerState='hesitate';audit(p,'沼への突入を拒否: 帰路の危険が高い');return}}
  if(severe){blend(p,hz.x,hz.y,.88*cognition,'retreat');audit(p,'緊急離脱: HP/スタミナ/重複危険',{cloudN:hz.cloudN});return}
  const ne=nearestEnemy(p,420),partner=typeof partnerOf==='function'?partnerOf(p):null;
  if(p.id==='freila'&&ne&&st>.44&&hp>.42){if(ne.d>92&&hz.w<1.35){blend(p,ne.e.x-p.x,ne.e.y-p.y,.34*cognition,'kite');p.preferredRange=88;audit(p,'フレイラ: 前衛間合いへ詰める')}}
  else if(p.id==='kuu'){if(ne&&ne.d<145){blend(p,p.x-ne.e.x,p.y-ne.e.y,.52*cognition,'kite2');audit(p,'クウ: 近接圧から離れて支援距離を確保')}else if(mate&&mate.s<.62&&st>.40){blend(p,mate.h.x-p.x,mate.h.y-p.y,.24*cognition,'g_cover');audit(p,'クウ: 弱った味方側へ支援位置を調整')}else if(partner){const d=Math.hypot(partner.x-p.x,partner.y-p.y);if(d<115)blend(p,p.x-partner.x,p.y-partner.y,.20*cognition,'kite2');else if(d>245)blend(p,partner.x-p.x,partner.y-p.y,.18*cognition,'g_cover')}p.preferredRange=210}
  else if(p.id==='yamiko'&&ne){if((st<.42||hp<.46)&&partner){blend(p,partner.x-p.x,partner.y-p.y,.42*cognition,'g_cover');audit(p,'ヤミコ: 消耗時だけ孤立を解いて合流')}else if(hz.w<1.15){const n=norm(ne.e.x-p.x,ne.e.y-p.y),side=(p.strafeDir||1)>=0?1:-1;blend(p,-n.y*side+n.x*.18,n.x*side+n.y*.18,.26*cognition,'kite2');audit(p,'ヤミコ: 単独気味に側面を取る')}p.preferredRange=155}
  else p.preferredRange=165;
  const sx=p.steerX||p.vx||0,sy=p.steerY||p.vy||0;if(Math.hypot(sx,sy)>.08){let a=Math.atan2(sy,sx);if(a<0)a+=Math.PI*2;p.face8=Math.round(a/(Math.PI/4))&7}
 }
 if(typeof PARTY_JOIN!=='undefined'){const f=PARTY_JOIN.find(x=>x.id==='freila');if(f&&f.deep<5)f.deep=5}
 if(typeof aiDecide==='function'){const base=aiDecide;aiDecide=function(foc,dt){base(foc,dt);tacticalPost(G.B&&G.B.hero,foc)}}
 if(typeof partyJoinCheck==='function'){const base=partyJoinCheck;partyJoinCheck=function(runNote){const B=G.B,before={roster:[...((META.party&&META.party.roster)||[])],resets:(META.party&&META.party.resets)||0,deepest:META.deepest||1,era:META.era||0};const r=base.apply(this,arguments);if(B&&r){const a=B.joinAudit||(B.joinAudit=[]);a.push({t:B.time||0,runNote,depth:(B.floor&&B.floor.depth)||0,joined:r,why:META.run&&META.run.joinWhy||'',before,after:{roster:[...((META.party&&META.party.roster)||[])],resets:(META.party&&META.party.resets)||0,deepest:META.deepest||1,era:META.era||0}});if(a.length>40)a.shift()}return r}}
 /* v7.2 影とハイライトの放射グラデは、原点で半径ごとに一度だけ作って translate で使い回す
    (以前は毎フレーム・魔物ごとに createRadialGradient していた) */
 const GR=new Map();
 const hiGrad=(g,r,boss)=>{ const k=(boss?'b':'n')+Math.round(r); let gr=GR.get(k); if(gr) return gr;
   gr=g.createRadialGradient(-r*.35,-r*.55,1,0,0,r*1.25);
   gr.addColorStop(0,'rgba(255,255,255,'+(boss?.20:.11)+')'); gr.addColorStop(.4,'rgba(255,255,255,0)'); gr.addColorStop(1,'rgba(0,0,0,.15)');
   GR.set(k,gr); return gr; };
 if(typeof drawEnemy==='function'){const base=drawEnemy;drawEnemy=function(g,e){if(!e||e.dead)return base(g,e);g.save();g.globalAlpha=.2;g.fillStyle='rgba(0,0,0,.72)';g.beginPath();g.ellipse(e.x,e.y+Math.max(3,(e.r||10)*.36),(e.r||12)*.92,(e.r||12)*.28,0,0,Math.PI*2);g.fill();g.restore();base(g,e);g.save();const r=Math.max(9,e.r||12);g.translate(e.x,e.y);g.globalCompositeOperation='screen';g.globalAlpha=.75;g.fillStyle=hiGrad(g,r,e.boss);g.beginPath();g.arc(0,0,r*1.05,0,Math.PI*2);g.fill();g.restore()}}
 /* v7.2 床のひびは静止画なので、チャンクを焼く時に一度だけ描く(js/map.js の CHUNK_DECOR) */
 if(typeof CHUNK_DECOR!=='undefined')CHUNK_DECOR.push(function(g,x0,y0,x1,y1){if(typeof gfxLv==='function'&&gfxLv()===0)return;const step=64;g.save();for(let y=Math.floor(y0/step)*step;y<y1;y+=step)for(let x=Math.floor(x0/step)*step;x<x1;x+=step){const q=Math.sin(x*12.9898+y*78.233)*43758.5453,f=q-Math.floor(q);if(f<.58||(typeof passAt==='function'&&!passAt(x,y,false)))continue;g.globalAlpha=.04+.028*f;g.strokeStyle=f>.82?'#d7ccff':'#0a0816';g.lineWidth=.7;g.beginPath();g.moveTo(x-8,y+5);g.lineTo(x-2,y+1);g.lineTo(x+5,y+4);g.stroke();g.globalAlpha=.025;g.fillStyle='#fff';g.fillRect(x+10,y-9,1,1)}g.restore()});
 if(typeof drawFx==='function'){const base=drawFx;drawFx=function(g,f){base(g,f);if(!f||typeof gfxLv==='function'&&gfxLv()<2)return;if(!['bolt','beam','denbeam','mireburst','darkslash','nova','burst'].includes(f.kind))return;g.save();g.globalCompositeOperation='screen';const r=Math.max(18,f.r||26),gr=g.createRadialGradient(f.x,f.y,0,f.x,f.y,r*1.8);gr.addColorStop(0,'rgba(255,245,255,.16)');gr.addColorStop(.45,'rgba(190,150,255,.06)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.beginPath();g.arc(f.x,f.y,r*1.8,0,Math.PI*2);g.fill();g.restore()}}
 let POST=null;
 if(typeof draw==='function'){const base=draw;draw=function(){base();if(typeof ctx==='undefined'||!G)return;const g=ctx,ds=(typeof dpr==='number'?dpr:1)*(typeof viewScale==='number'?viewScale:1);g.save();g.setTransform(ds,0,0,ds,0,0);if(!POST||POST.w!==W||POST.h!==H){const gr=g.createLinearGradient(0,0,W,H);gr.addColorStop(0,'rgba(90,110,170,.022)');gr.addColorStop(.5,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(120,40,80,.03)');POST={w:W,h:H,gr};}g.fillStyle=POST.gr;g.fillRect(0,0,W,H);if(G.shake>2){g.globalAlpha=Math.min(.07,G.shake*.007);g.fillStyle='#fff';g.fillRect(0,0,W,H)}g.restore()}}
 window.Game4QualityPatch={version:'1.3.0',audit:()=>G&&G.B?(G.B.tacticalAudit||[]):[],samples:()=>G&&G.B?(G.B.balanceAudit||[]):[],joinAudit:()=>G&&G.B?(G.B.joinAudit||[]):[]};
})();