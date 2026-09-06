'use strict';
/* ============================================================
   map.js — 地形マップ v2(v1.7): ダンジョン風の有限マップ
   ------------------------------------------------------------
   ・32pxのマップチップ(地形7種×4、岩壁、崖)を起動時に描き、8×8タイルのチャンクに焼いて敷く
   ・地形帯はボロノイ風(世代ごとの種)。境目には浜(浅瀬)・肉の縁(巣)・泥・石の縁を描いて「ここは○○」を読めるように
   ・岩壁(誰も通れない)と崖(飛ぶ魔物だけ通れる)。通路は広め(4タイル以上)。到達できない床は掘って繋ぐ
   ・彼女と魔物は壁に当たる。魔物は彼女への視線が壁で切れたら流れ場(BFS)に沿って回り込む。彼女は A* で目的地へ
   ・召喚/回り込みの位置は「届く床」に限り、壁のせいで彼女の真横に落ちない
   ・彼女の地形の学習: 浅瀬(足を取られる)・花園(花粉)・温泉(火照る)は、覚えた分だけ避けて歩く
   定数 MAP_T/MAP_W/MAP_H/MAP_HW/MAP_HH/ZONES は data.js
============================================================ */
const SOLID_ROCK=1, SOLID_CLIFF=2;
const FLYERS=new Set(['ghost','moth','imp','succubus','succuqueen','eye','gas','spore','ghosthand','inyoku']);   // 崖を越えられる(飛ぶ/浮く)
function canFly(id){ return FLYERS.has(id); }
function mapGen(){ return META.gen.idx||1; }
function tileI(x){ return Math.floor((x+MAP_HW)/MAP_T); }
function tileJ(y){ return Math.floor((y+MAP_HH)/MAP_T); }
function tileCX(i){ return (i+0.5)*MAP_T-MAP_HW; }
function tileCY(j){ return (j+0.5)*MAP_T-MAP_HH; }
function inMap(i,j){ return i>=0&&j>=0&&i<MAP_W&&j<MAP_H; }
function solidIJ(i,j){ if(!inMap(i,j)) return SOLID_ROCK; return (G.map&&G.map.solid)?G.map.solid[j*MAP_W+i]:0; }
function solidAt(x,y){ return solidIJ(tileI(x),tileJ(y)); }
function passIJ(i,j,fly){ const s=solidIJ(i,j); return s===0 || (!!fly && s===SOLID_CLIFF); }
function passAt(x,y,fly){ return passIJ(tileI(x),tileJ(y),fly); }
function zoneAtXY(zone,x,y){
  const i=tileI(x), j=tileJ(y);
  if(!inMap(i,j)) return 'moss';
  return ZONE_IDS[zone[j*MAP_W+i]]||'moss';
}
function zoneAt(x,y){ return (G.map&&G.map.zone)?zoneAtXY(G.map.zone,x,y):'moss'; }
function zoneMonSpd(z,id){ const t=ZONE_SPD_MON[z]; if(!t) return 1; return t[id]||t['*']||1; }
function zoneMonHp(z,id){ const t=ZONE_HP_MON[z]; if(!t) return 1; return t[id]||t['*']||1; }
function clampMapX(x,m){ m=m===undefined?24:m; return clamp(x,-MAP_HW+m,MAP_HW-m); }
function clampMapY(y,m){ m=m===undefined?24:m; return clamp(y,-MAP_HH+m,MAP_HH-m); }

/* ================= 生成 ================= */
function genMap(){
  const gi=mapGen(), F=curFloor(), fl=F.depth, seed=1000+gi*7919+fl*104729+(typeof eraNow==='function'?eraNow()*31337:0);   // v2.0 世代×階層で地形が決まる(同じ階層への再挑戦は同じ地形) / v3.0 世代(era)で最終階層が動くので種にも入れる
  if(G.map && G.map.seed===seed && META.map && META.map.gen===gi && META.map.floor===fl){ G.map.flowT=-9; G.map.heroTile=null; G.map.flows=null; return; }   // 同じ世代・同じ階層: 流れ場だけ次の出撃で作り直す
  let sd=seed; const rnd=()=>{ sd=(sd*16807)%2147483647; return sd/2147483647; };
  const N=MAP_W*MAP_H;
  // ---- 地形帯: ボロノイ風。巣は端のほう、出発点は苔
  const types=[]; for(const z in F.zoneW){ for(let k=0;k<F.zoneW[z];k++) types.push(z); }   // v2.0 階層の地形パレット(重み=帯の数)
  const mainZone=Object.entries(F.zoneW).sort((a,b)=>b[1]-a[1])[0][0];
  const sites=types.map(t=>({t, x:(rnd()-0.5)*MAP_HW*1.8, y:(rnd()-0.5)*MAP_HH*1.8}));
  const nest=sites.find(z=>z.t==='nest'); if(nest){ const ea=rnd()*TAU; nest.x=Math.cos(ea)*MAP_HW*0.78; nest.y=Math.sin(ea)*MAP_HH*0.78; }
  sites.push({t:mainZone, x:0, y:0});
  const zone=new Uint8Array(N);
  for(let j=0;j<MAP_H;j++) for(let i=0;i<MAP_W;i++){
    const cx=tileCX(i), cy=tileCY(j);
    const jx=(hash2(i*3+gi,j*5)-0.5)*110, jy=(hash2(i*7,j*11+gi)-0.5)*110;
    let best=sites[0], bd=1e18;
    for(const z of sites){ const ex=z.x-cx-jx, ey=(z.y-cy-jy)*1.35; const d=ex*ex+ey*ey; if(d<bd){ bd=d; best=z; } }
    zone[j*MAP_W+i]=ZONE_IDS.indexOf(best.t);
  }
  // ---- 壁: 外周の岩、岩/崖の塊、崖の稜線(切れ目つき)
  const solid=new Uint8Array(N);
  const set=(i,j,v)=>{ if(inMap(i,j)) solid[j*MAP_W+i]=v; };
  const setW=(i,j,v)=>{ if(v && Math.hypot(i-MAP_W/2,(j-MAP_H/2)*1.4)<12) return; set(i,j,v); };   // v3.2 壁を置く時だけ、出発点の周りは空けておく
  // v3.2 外周: 真四角の縁をやめ、厚みがなだらかに揺れる岩に。数か所は入り江(岩が内側へ大きく食い込む)になり、その間が岬になる
  const edgeProf=(n)=>{
    const a1=rnd()*TAU, a2=rnd()*TAU, a3=rnd()*TAU, f1=1+rnd()*1.2, f2=2.4+rnd()*1.8, f3=4.5+rnd()*2.5;
    const out=new Float32Array(n);
    for(let k=0;k<n;k++){ const u=k/n*TAU; const v=Math.sin(u*f1+a1)*0.55+Math.sin(u*f2+a2)*0.30+Math.sin(u*f3+a3)*0.15; out[k]=2.2+(v*0.5+0.5)*4.0; }
    return out;
  };
  const bT=edgeProf(MAP_W), bB=edgeProf(MAP_W), bL=edgeProf(MAP_H), bR=edgeProf(MAP_H);
  const coves=[]; for(let k=0;k<6;k++) coves.push({s:k%4, at:rnd(), w:0.045+rnd()*0.05, d:3+rnd()*4.5});
  const coveAt=(s,u)=>{ let e=0; for(const c of coves){ if(c.s!==s) continue; let du=Math.abs(u-c.at); du=Math.min(du,1-du); if(du<c.w) e+=c.d*(0.5+0.5*Math.cos(Math.PI*du/c.w)); } return e; };
  const BORD_MAX=12;   // 入り江が重なっても、これ以上は食い込ませない
  const bordT=(i)=>Math.min(BORD_MAX,bT[i]+coveAt(0,i/MAP_W)), bordB=(i)=>Math.min(BORD_MAX,bB[i]+coveAt(1,i/MAP_W));
  const bordL=(j)=>Math.min(BORD_MAX,bL[j]+coveAt(2,j/MAP_H)), bordR=(j)=>Math.min(BORD_MAX,bR[j]+coveAt(3,j/MAP_H));
  for(let i=0;i<MAP_W;i++){
    const t=Math.min(MAP_H/2-4,Math.round(bordT(i))), b=Math.min(MAP_H/2-4,Math.round(bordB(i)));
    for(let j=0;j<t;j++) solid[j*MAP_W+i]=SOLID_ROCK;
    for(let j=0;j<b;j++) solid[(MAP_H-1-j)*MAP_W+i]=SOLID_ROCK;
  }
  for(let j=0;j<MAP_H;j++){
    const l=Math.min(MAP_W/2-4,Math.round(bordL(j))), r=Math.min(MAP_W/2-4,Math.round(bordR(j)));
    for(let i=0;i<l;i++) solid[j*MAP_W+i]=SOLID_ROCK;
    for(let i=0;i<r;i++) solid[j*MAP_W+MAP_W-1-i]=SOLID_ROCK;
  }
  const disk=(ci,cj,rx,ry,v)=>{ for(let j=Math.floor(cj-ry);j<=Math.ceil(cj+ry);j++) for(let i=Math.floor(ci-rx);i<=Math.ceil(ci+rx);i++){ const u=(i+0.5-ci)/rx, w=(j+0.5-cj)/ry; if(u*u+w*w<=1) set(i,j,v); } };
  // ---- v3.2 壁と崖: 「ただ丸いものが散っている」のをやめ、成り立ちの見える形にする
  //   柱の間(細い柱が並ぶ広間) / 崖の段(なだらかに曲がる崖線と、そこを越える坂) / 崩落(壁から零れた岩が大→小に散る)
  //   岩の背(同じ向きに連なる細長い塊=断層) / 部屋と通路(石畳の階層) / 狭窄(肉の階層。向かい合う膨らみが道を細める)
  const blobs=[], formSpots=[], formFeats=[];
  const spotFree=(i,j,r)=>{
    if(Math.hypot(i-MAP_W/2,(j-MAP_H/2)*1.4)<13+r*0.4) return false;             // 出発点の周りは広く空ける
    if(i<8+r||j<7+r||i>MAP_W-8-r||j>MAP_H-7-r) return false;                      // 外周の岩には食い込ませない
    return blobs.every(b=>Math.hypot(b.i-i,b.j-j)>b.r+r+5);                       // 塊の間は4タイル以上あける
  };
  const pickSpot=(r)=>{ for(let t=0;t<140;t++){ const i=8+rnd()*(MAP_W-16), j=7+rnd()*(MAP_H-14); if(spotFree(i,j,r)){ const s={i,j,r}; blobs.push(s); formSpots.push({i:Math.round(i),j:Math.round(j),r:2}); return s; } } return null; };
  const pillarHall=(kind)=>{ const s=pickSpot(6); if(!s) return; const n=5+Math.floor(rnd()*5);
    for(let k=0;k<n;k++){ const a=rnd()*TAU, dd=1.5+rnd()*4.2; disk(s.i+Math.cos(a)*dd*1.25, s.j+Math.sin(a)*dd*0.8, 1.1+rnd()*1.0, 0.9+rnd()*0.8, kind); }
    formFeats.push({kind:'pillars', r:6*MAP_T, i:Math.round(s.i), j:Math.round(s.j)}); };
  const escarp=()=>{ const s=pickSpot(7); if(!s) return; const L=16+Math.floor(rnd()*12), a0=rnd()*TAU, curve=(rnd()-0.5)*0.06;
    const ramps=[Math.floor(L*(0.22+rnd()*0.2)), Math.floor(L*(0.6+rnd()*0.22))];
    let a=a0, ci=s.i, cj=s.j;
    for(let t=0;t<L;t++){ a+=curve; ci+=Math.cos(a); cj+=Math.sin(a)*0.75;
      if(ramps.some(rp=>Math.abs(t-rp)<2)) continue;                              // 坂: ここだけ越えられる
      for(let w=-1;w<=1;w++) setW(Math.round(ci-Math.sin(a)*w), Math.round(cj+Math.cos(a)*w*0.75), SOLID_CLIFF); }
    formFeats.push({kind:'escarp', r:L*MAP_T*0.4, i:Math.round(s.i+Math.cos(a0)*L*0.5), j:Math.round(s.j+Math.sin(a0)*L*0.4)}); };
  const rockfall=()=>{ const s=pickSpot(6); if(!s) return; const a=rnd()*TAU;
    for(let k=0;k<5;k++){ const dd=k*2.2; disk(s.i+Math.cos(a)*dd*1.3, s.j+Math.sin(a)*dd*0.85, Math.max(0.8,3.0-k*0.5), Math.max(0.7,2.2-k*0.36), SOLID_ROCK); } };
  const spine=()=>{ const s=pickSpot(6); if(!s) return; const a=rnd()*TAU, n=3+Math.floor(rnd()*3), flat=Math.abs(Math.cos(a))>0.5;
    for(let k=0;k<n;k++){ const dd=k*3.4-((n-1)*1.7); const rA=2.0+rnd()*1.6, rB=1.3+rnd()*0.9;
      disk(s.i+Math.cos(a)*dd*1.3, s.j+Math.sin(a)*dd*0.85, flat?rA:rB, flat?rB:rA, rnd()<0.35?SOLID_CLIFF:SOLID_ROCK); } };
  const chambers=()=>{ const s=pickSpot(8); if(!s) return; const n=2+Math.floor(rnd()*2);
    for(let k=0;k<n;k++){
      const w=4+Math.floor(rnd()*4), h=3+Math.floor(rnd()*3);
      const ci=Math.round(s.i+(k?rnd()*10-5:0)), cj=Math.round(s.j+(k?rnd()*8-4:0));
      for(let dj=-h-1;dj<=h+1;dj++) for(let di=-w-1;di<=w+1;di++){
        const i=ci+di, j=cj+dj; if(i<3||j<3||i>=MAP_W-3||j>=MAP_H-3) continue;
        const inside=(Math.abs(di)<=w&&Math.abs(dj)<=h), edge=(Math.abs(di)===w+1||Math.abs(dj)===h+1);
        if(inside) set(i,j,0);
        else if(edge){ const door=(Math.abs(di)<=1&&Math.abs(dj)===h+1)||(Math.abs(dj)<=1&&Math.abs(di)===w+1); set(i,j,door?0:SOLID_ROCK); } } }
    formFeats.push({kind:'chamber', r:7*MAP_T, i:Math.round(s.i), j:Math.round(s.j)}); };
  const constriction=()=>{ const s=pickSpot(6); if(!s) return; const a=rnd()*TAU;
    for(const sgn of [1,-1]) disk(s.i+Math.cos(a+Math.PI/2)*sgn*4.2*1.3, s.j+Math.sin(a+Math.PI/2)*sgn*4.2*0.85, 3.4, 2.4, SOLID_ROCK); };
  {
    const style=F.wall;   // 階層の壁様式で、生えている形が変わる
    if(style==='brick'){ for(let k=0;k<3;k++) chambers(); for(let k=0;k<2;k++) escarp(); for(let k=0;k<3;k++) spine(); for(let k=0;k<2;k++) pillarHall(SOLID_ROCK); }
    else if(style==='flesh'){ for(let k=0;k<4;k++) constriction(); for(let k=0;k<3;k++) spine(); for(let k=0;k<2;k++) pillarHall(SOLID_ROCK); for(let k=0;k<2;k++) rockfall(); }
    else { for(let k=0;k<3;k++) pillarHall(rnd()<0.3?SOLID_CLIFF:SOLID_ROCK); for(let k=0;k<2;k++) escarp(); for(let k=0;k<3;k++) rockfall(); for(let k=0;k<4;k++) spine(); }
  }
  // ---- v2.0 設計された地形: 階層ごとの型を刻む(崖の一本道・水の細道・闘技場・迷路の袋小路・肉の喉道)
  const feat={shrines:[], pools:[], seals:[], exit:null, list:[]};   // list: v2.1 地形ごとの中心と半径(彼女がそこへ入った時の台詞に使う)
  const ZI=(z)=>Math.max(0,ZONE_IDS.indexOf(z));
  const farSpot=(minT)=>{ for(let t=0;t<200;t++){ const a=rnd()*TAU, dd=minT+rnd()*10; const i=Math.round(MAP_W/2+Math.cos(a)*dd*1.3), j=Math.round(MAP_H/2+Math.sin(a)*dd*0.8); if(i>8&&j>8&&i<MAP_W-8&&j<MAP_H-8) return {i,j}; } return {i:MAP_W-10,j:MAP_H/2|0}; };
  const usedF=[]; const freeSpot=(minT,rad)=>{ for(let t=0;t<120;t++){ const s=farSpot(minT); if(usedF.every(u=>Math.hypot(u.i-s.i,u.j-s.j)>u.r+rad+3)){ usedF.push({i:s.i,j:s.j,r:rad}); return s; } } return null; };
  const T2=(i,j)=>({x:tileCX(i),y:tileCY(j)});
  for(const s of formSpots) usedF.push(s);                                                        // v3.2 岩の形の上に他の地形を置かない
  for(const f of formFeats) feat.list.push(Object.assign({kind:f.kind,r:f.r},T2(f.i,f.j)));       // v3.2 台詞・ミニマップ用
  const protect=new Uint8Array(N);                                                                // v3.2 ここは掘って繋がない(入口をひとつに保つ)
  const protectRect=(i0,j0,i1,j1)=>{ for(let j=Math.max(0,Math.floor(j0));j<=Math.min(MAP_H-1,Math.ceil(j1));j++) for(let i=Math.max(0,Math.floor(i0));i<=Math.min(MAP_W-1,Math.ceil(i1));i++) if(solid[j*MAP_W+i]) protect[j*MAP_W+i]=1; };
  const protectRing=(ci,cj,r)=>{ for(let j=Math.floor(cj-r);j<=Math.ceil(cj+r);j++) for(let i=Math.floor(ci-r);i<=Math.ceil(ci+r);i++){ if(!inMap(i,j)) continue; if(Math.hypot(i-ci,j-cj)<=r && solid[j*MAP_W+i]) protect[j*MAP_W+i]=1; } };
  /* 崖の一本道: 幅3の床の両側を幅3の崖で挟む。先の袋小路に祠。飛ぶ魔物だけが横から来られる */
  const ridgePath=()=>{
    // v3.2 袋小路は外周の岩に突き当てる。奥は外の岩、両脇と奥の輪は崖——入口の通路以外からは入れない
    const L=16+Math.floor(rnd()*7);
    let pi=0, pj=0, di=0, dj=0, ok=false, side=0;               // (pi,pj)=袋小路の中心 / (di,dj)=そこから内側へ向かう向き
    for(let t=0;t<240&&!ok;t++){
      side=Math.floor(rnd()*4);
      if(side===0){ pi=Math.round(10+rnd()*(MAP_W-20)); pj=Math.round(bordT(pi)+4.4); di=0; dj=1; }
      else if(side===1){ pi=Math.round(10+rnd()*(MAP_W-20)); pj=Math.round(MAP_H-1-bordB(pi)-4.4); di=0; dj=-1; }
      else if(side===2){ pj=Math.round(8+rnd()*(MAP_H-16)); pi=Math.round(bordL(pj)+4.4); di=1; dj=0; }
      else { pj=Math.round(8+rnd()*(MAP_H-16)); pi=Math.round(MAP_W-1-bordR(pj)-4.4); di=-1; dj=0; }
      if(pi<6||pj<6||pi>MAP_W-6||pj>MAP_H-6) continue;
      if(Math.hypot(pi-MAP_W/2,(pj-MAP_H/2)*1.4)<20) continue;
      if(!usedF.every(u=>Math.hypot(u.i-pi,u.j-pj)>u.r+5)) continue;   // 岩の形は通路が切り拓いてよい(袋小路そのものが重ならなければいい)
      ok=true;
    }
    if(!ok) return;
    usedF.push({i:Math.round(pi+di*L*0.5), j:Math.round(pj+dj*L*0.5), r:Math.ceil(L*0.5)+5});
    const R=3.2, RING=5.4;
    // 袋小路(円)と、それを囲う崖の輪。通路の口だけ開ける
    for(let dy=-Math.ceil(RING);dy<=Math.ceil(RING);dy++) for(let dx=-Math.ceil(RING);dx<=Math.ceil(RING);dx++){
      const i=pi+dx, j=pj+dy; if(i<2||j<2||i>=MAP_W-2||j>=MAP_H-2) continue;
      const dd=Math.hypot(dx,dy);
      const towardIn=(dx*di+dy*dj);                              // 内側(通路のある向き)成分
      if(dd<=R) set(i,j,0);
      else if(dd<=RING){ const mouth=(towardIn>0 && Math.abs(dx*dj-dy*di)<=1.2); if(!mouth) set(i,j,SOLID_CLIFF); else set(i,j,0); }
    }
    // 通路: 幅3の床、両脇は崖
    for(let t=0;t<=L;t++){
      const ci=pi+di*(R+t), cj=pj+dj*(R+t);
      for(let w=-4;w<=4;w++){
        const i=Math.round(ci-dj*w), j=Math.round(cj+di*w);
        if(i<3||j<3||i>=MAP_W-3||j>=MAP_H-3) continue;
        if(Math.abs(w)<=1) set(i,j,0); else if(Math.abs(w)<=4 && t<L) setW(i,j,SOLID_CLIFF);
      }
    }
    protectRing(pi,pj,RING+0.6);                                 // 掘って繋ぐ処理に裏口を開けさせない
    feat.shrines.push(T2(pi,pj));
    feat.list.push(Object.assign({kind:'ridge',r:L*MAP_T*0.5},T2(Math.round(pi+di*L*0.5),Math.round(pj+dj*L*0.5))));
  };
  /* 水の細道: 浅瀬の楕円と、それを渡る1タイルの床。島の中心に清水 */
  const causeway=()=>{
    if(!F.zoneW.water) return;
    const s=freeSpot(16,11); if(!s) return;
    const rx=8+rnd()*3, ry=5+rnd()*2, a=rnd()*TAU;
    for(let j=Math.floor(s.j-ry);j<=Math.ceil(s.j+ry);j++) for(let i=Math.floor(s.i-rx);i<=Math.ceil(s.i+rx);i++){
      if(!inMap(i,j)) continue; const u=(i+0.5-s.i)/rx, w=(j+0.5-s.j)/ry;
      if(u*u+w*w<=1){ zone[j*MAP_W+i]=ZI('water'); if(solid[j*MAP_W+i]) set(i,j,0); }
    }
    for(let t=-Math.ceil(Math.max(rx,ry))-1;t<=Math.ceil(Math.max(rx,ry))+1;t++){ const i=Math.round(s.i+Math.cos(a)*t), j=Math.round(s.j+Math.sin(a)*t*0.8); if(inMap(i,j)){ zone[j*MAP_W+i]=ZI(mainZone); set(i,j,0); } }
    for(let dj=-1;dj<=1;dj++) for(let di=-1;di<=1;di++){ if(inMap(s.i+di,s.j+dj)){ zone[(s.j+dj)*MAP_W+s.i+di]=ZI(F.zoneW.damp?'damp':mainZone); set(s.i+di,s.j+dj,0); } }
    if(F.zoneW.damp) feat.pools.push(T2(s.i,s.j));
    feat.list.push(Object.assign({kind:'causeway',r:Math.max(rx,ry)*MAP_T},T2(s.i,s.j)));
  };
  /* 闘技場: 半径 r の広間。周りを崖(または岩)の輪で囲い、2か所だけ切れ目 */
  const arena=(ci,cj,r,ringKind)=>{
    for(let j=Math.floor(cj-r-2);j<=Math.ceil(cj+r+2);j++) for(let i=Math.floor(ci-r-2);i<=Math.ceil(ci+r+2);i++){
      if(i<3||j<3||i>=MAP_W-3||j>=MAP_H-3) continue;
      const dd=Math.hypot(i+0.5-ci,(j+0.5-cj)*1.3);
      if(dd<=r) set(i,j,0);
      else if(dd<=r+2){ const ang=Math.atan2((j+0.5-cj)*1.3,i+0.5-ci); const g1=Math.abs(((ang-0.3+Math.PI*3)%TAU)-Math.PI), g2=Math.abs(((ang-3.4+Math.PI*3)%TAU)-Math.PI); if(g1>0.42 && g2>0.42) set(i,j,ringKind); else set(i,j,0); }
    }
  };
  /* 迷路の袋小路: 9×9 の岩の格子(ところどころ抜け)。中心に封印石 */
  const mazePocket=()=>{
    const s=freeSpot(16,7); if(!s) return null;
    for(let dj=-4;dj<=4;dj++) for(let di=-4;di<=4;di++){
      const i=s.i+di, j=s.j+dj; if(i<3||j<3||i>=MAP_W-3||j>=MAP_H-3) continue;
      const edge=Math.abs(di)===4||Math.abs(dj)===4, grid=(di%2===0)&&(dj%2===0);
      if(edge){ set(i,j,rnd()<0.22?0:SOLID_ROCK); }
      else if(grid && !(di===0&&dj===0)){ set(i,j,rnd()<0.75?SOLID_ROCK:0); }
      else set(i,j,0);
    }
    set(s.i,s.j,0); feat.seals.push(T2(s.i,s.j)); feat.list.push(Object.assign({kind:'maze',r:4.5*MAP_T},T2(s.i,s.j))); return s;
  };
  /* v3.2 甘い褥の巣窟: 外周の岩に食い込む大きな窪地。入口は喉道ひとつだけで、いちばん奥に王の宝箱。
     奥へ行くほど効きが強く(前室→沼→最奥)、入口の外には媚薬の澱み(haze)が漂う。その手前に清水が湧く——覚悟を決める場所 */
  const lewdDen=()=>{
    const rx=6+Math.floor(rnd()*2), ry=7+Math.floor(rnd()*3);   // 進む向き(奥行き)は浅く、壁沿いの幅は広く: 二人が画面に収まる寸法
    let right=rnd()<0.5, ci=0, cj=0, ok=false;
    for(let t=0;t<200&&!ok;t++){
      if(t===100) right=!right;
      cj=Math.round(6+ry+rnd()*(MAP_H-12-2*ry));
      ci=right?(MAP_W-3-rx):(2+rx);
      if(Math.hypot(ci-MAP_W/2,(cj-MAP_H/2)*1.4)<16) continue;
      if(!usedF.every(u=>Math.hypot(u.i-ci,u.j-cj)>u.r+Math.max(rx,ry)+4)) continue;
      ok=true;
    }
    if(!ok){   // どうしても空きが見つからない時は、いちばん空いている行を選ぶ(中央に落とすと出発点や闘技場と重なる)
      let bs=-1e9;
      for(const rr of [true,false]){ const ii=rr?(MAP_W-3-rx):(2+rx);
        for(let jj=6+ry; jj<=MAP_H-6-ry; jj+=2){
          const dc=Math.hypot(ii-MAP_W/2,(jj-MAP_H/2)*1.4); if(dc<16) continue;
          let worst=1e9; for(const u of usedF) worst=Math.min(worst, Math.hypot(u.i-ii,u.j-jj)-u.r);
          const sc=Math.min(worst,40)+dc*0.05;
          if(sc>bs){ bs=sc; ci=ii; cj=jj; right=rr; } } }
      if(bs<=-1e9){ cj=Math.round(MAP_H*0.25); ci=right?(MAP_W-3-rx):(2+rx); } }
    const dir=right?-1:1, L=4+Math.floor(rnd()*3);              // dir: 内側(通路の伸びる向き)
    usedF.push({i:ci,j:cj,r:Math.max(rx,ry)+3});
    const ZL=ZI('lewd'), ZH=ZI('haze');
    const q2=(i,j)=>{ const u=(i+0.5-ci)/rx, w=(j+0.5-cj)/ry; return u*u+w*w; };
    for(let j=cj-ry-3;j<=cj+ry+3;j++) for(let i=ci-rx-3;i<=ci+rx+3;i++){
      if(i<2||j<2||i>=MAP_W-2||j>=MAP_H-2) continue;
      const q=q2(i,j);
      if(q<=1){ set(i,j,0); zone[j*MAP_W+i]=ZL; }
      else if(q<=1.6) set(i,j,SOLID_ROCK);                       // 岩で囲う(入口以外から入れない)
    }
    // 喉道: 幅3の通路。中ほどまでは褥、外側は澱み
    for(let t=-1;t<=L;t++){
      const i=Math.round(ci+dir*(rx+t));
      for(let w=-3;w<=3;w++){
        const j=cj+w; if(i<3||j<3||i>=MAP_W-3||j>=MAP_H-3) continue;
        if(Math.abs(w)<=1){ set(i,j,0); zone[j*MAP_W+i]=(t<=1)?ZL:ZH; }
        else set(i,j,SOLID_ROCK);
      }
    }
    // 澱み: 入口の外に漂う。ここはまだ薄いが、匂いで分かる
    const ax=Math.round(ci+dir*(rx+L+2)), ay=cj;
    for(let j=ay-7;j<=ay+7;j++) for(let i=ax-8;i<=ax+8;i++){
      if(i<3||j<3||i>=MAP_W-3||j>=MAP_H-3) continue;
      if(solid[j*MAP_W+i]) continue;
      if(Math.hypot(i-ax,(j-ay)*1.15)<=7 && zone[j*MAP_W+i]!==ZL) zone[j*MAP_W+i]=ZH;
    }
    protectRect(ci-rx-3,cj-ry-3,ci+rx+3,cj+ry+3);                // 掘って繋ぐ処理に横穴を開けさせない
    const P=(i,j)=>T2(Math.round(i),Math.round(j));
    const den=Object.assign({rx:rx*MAP_T, ry:ry*MAP_T, side:right?'r':'l', dir,
      mouth:P(ci+dir*(rx+L*0.5), cj), apron:P(ax,ay), deep:P(ci-dir*rx*0.5, cj),
      runes:[], flowers:[], beams:[], guard:null, r:Math.max(rx,ry)*MAP_T}, T2(ci,cj));
    for(let k=0;k<3;k++){ const a=rnd()*TAU, q=0.35+rnd()*0.3; den.runes.push(P(ci+Math.cos(a)*rx*q, cj+Math.sin(a)*ry*q)); }
    for(let k=0;k<3;k++){ const a=rnd()*TAU, q=0.5+rnd()*0.32; den.flowers.push(P(ci+Math.cos(a)*rx*q, cj+Math.sin(a)*ry*q)); }
    for(let k=0;k<3;k++){
      const a=(k/3)*TAU+rnd()*0.6+(right?Math.PI:0);
      // 壁の内側の面を探す: 縁から中心へ向かって進み、最初に床になった所を光の出どころにする(壁の中から線を引くと自分の壁で遮られる)
      let oi=-1, oj=-1;
      for(let t=0;t<26;t++){ const ii=Math.round(ci+Math.cos(a)*(rx*1.3-t*0.5)), jj=Math.round(cj+Math.sin(a)*(ry*1.3-t*0.5));
        if(!inMap(ii,jj)) continue;
        if(!solid[jj*MAP_W+ii] && q2(ii,jj)<=1){ oi=ii; oj=jj; break; } }   // 巣窟の内側の床にだけ据える(囲いの外の床を掴むと、自分の壁ごしに撃つことになる)
      if(oi<0) continue;
      const o=T2(oi,oj), pt=P(oi+Math.cos(a)*1.3, oj+Math.sin(a)*1.3);   // pt=壁に埋まって見える口 / o=線を引く起点(床)
      pt.ox=o.x; pt.oy=o.y; pt.ang=Math.atan2(tileCY(Math.round(cj))-o.y, tileCX(Math.round(ci))-o.x);
      den.beams.push(pt);
    }
    den.guard=P(ci-dir*rx*0.34, cj+(rnd()-0.5)*ry*0.6);
    feat.lewd=den;
    { const pi=Math.round(ax+dir*1.5), s0=(rnd()<0.5?1:-1); let pj=null;   // 清水は口の外の床に(壁の中に置くと、場所が別の所へ流れる)
      for(const dd of [3*s0,-3*s0,4*s0,-4*s0,2*s0,-2*s0,5*s0,-5*s0]){ const jj=ay+dd; if(inMap(pi,jj) && !solid[jj*MAP_W+pi]){ pj=jj; break; } }
      if(pj===null){ for(let jj=ay-6;jj<=ay+6&&pj===null;jj++) if(inMap(pi,jj) && !solid[jj*MAP_W+pi]) pj=jj; }
      feat.denPool=(pj===null)?P(ax,ay):P(pi,pj); }
    feat.haze=P(ax,ay);
    feat.list.push(Object.assign({kind:'lewd',r:Math.max(rx,ry)*MAP_T},T2(ci,cj)));
  };
  /* 肉の喉道: 曲がりくねった幅3の道を岩で挟み、終点を闘技場(魔核の間)に */
  const throat=(endI,endJ)=>{
    const L=26; const a0=Math.atan2(MAP_H/2-endJ,MAP_W/2-endI);
    for(let t=0;t<=L;t++){
      const a=a0+Math.sin(t*0.45)*0.6, ci=endI+Math.cos(a)*t, cj=endJ+Math.sin(a)*t*0.75;
      if(t%3===0) usedF.push({i:Math.round(ci),j:Math.round(cj),r:4});   // v2.2 喉道の上に他の地形(えちえちエリア)を置かない
      for(let w=-5;w<=5;w++){ const i=Math.round(ci-Math.sin(a)*w), j=Math.round(cj+Math.cos(a)*w*0.75); if(i<3||j<3||i>=MAP_W-3||j>=MAP_H-3) continue; if(Math.abs(w)<=1) set(i,j,0); else if(Math.abs(w)<=4 && t>2) set(i,j,SOLID_ROCK); }
    }
  };
  {
    const fl2=F.depth;
    const nRidge=fl2===3?2:1; for(let k=0;k<nRidge;k++) ridgePath();
    if(fl2<=2){ causeway(); if(fl2===2) causeway(); }
    if(F.puzzle==='seals'){ for(let k=0;k<3;k++) mazePocket(); }
    // 降り口/魔核の間: 遠くの広間
    const ex=freeSpot(F.final?26:22,F.final?14:10) || farSpot(22);
    if(!usedF.some(u=>u.i===ex.i&&u.j===ex.j)) usedF.push({i:ex.i,j:ex.j,r:F.final?14:10});   // v2.2 予備の位置でも登録
    if(F.final){ throat(ex.i,ex.j); arena(ex.i,ex.j,10,SOLID_ROCK); { const a0=Math.atan2(MAP_H/2-ex.j,MAP_W/2-ex.i); feat.list.push(Object.assign({kind:'throat',r:8*MAP_T},T2(Math.round(ex.i+Math.cos(a0)*14),Math.round(ex.j+Math.sin(a0)*14*0.75)))); } }
    else arena(ex.i,ex.j,fl2>=4?8:7,fl2>=4?SOLID_ROCK:SOLID_CLIFF);
    feat.exit=T2(ex.i,ex.j);
    feat.list.push(Object.assign({kind:'arena',r:(F.final?10:8)*MAP_T},T2(ex.i,ex.j)));
    lewdDen();
  }
  // 孤立した1タイルの壁は消す
  for(let j=2;j<MAP_H-2;j++) for(let i=2;i<MAP_W-2;i++){
    if(!solid[j*MAP_W+i]) continue;
    let n=0; for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]) if(solid[(j+dj)*MAP_W+i+di]) n++;
    if(n===0) solid[j*MAP_W+i]=0;
  }
  // ---- 到達性: 中心から歩いて届かない床は、いちばん近い届く床へ掘って繋ぐ(幅3)
  const ci0=Math.floor(MAP_W/2), cj0=Math.floor(MAP_H/2);
  const carveTo=(i0,j0,reach)=>{
    // 壁を跨いで最寄りの届く床までBFS(壁も通す)、その経路を床にする
    const prev=new Int32Array(N).fill(-1), seen=new Uint8Array(N); const q=[j0*MAP_W+i0]; seen[q[0]]=1; let found=-1;
    for(let h=0;h<q.length&&found<0;h++){ const cur=q[h], ci=cur%MAP_W, cj=(cur-ci)/MAP_W;
      for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){ const ni=ci+di, nj=cj+dj; if(ni<2||nj<2||ni>=MAP_W-2||nj>=MAP_H-2) continue; const nk=nj*MAP_W+ni; if(seen[nk]||protect[nk]) continue; seen[nk]=1; prev[nk]=cur; if(reach[nk]){ found=nk; break; } q.push(nk); } }
    if(found<0) return false;
    let cur=found; while(cur>=0){ const ci=cur%MAP_W, cj=(cur-ci)/MAP_W; for(let dj=-1;dj<=1;dj++) for(let di=-1;di<=1;di++){ const ii=ci+di, jj=cj+dj; if(ii>=2&&jj>=2&&ii<MAP_W-2&&jj<MAP_H-2 && !protect[jj*MAP_W+ii]) solid[jj*MAP_W+ii]=0; } cur=prev[cur]; }
    return true;
  };
  for(let iter=0;iter<40;iter++){
    const reach=floodReach(solid,ci0,cj0);
    let bad=-1; for(let k=0;k<N;k++){ if(!solid[k] && !reach[k]){ bad=k; break; } }
    if(bad<0) break;
    if(!carveTo(bad%MAP_W,Math.floor(bad/MAP_W),reach)){ solid[bad]=SOLID_ROCK; }   // 掘れない飛び地は埋める
  }
  // ---- 場所(祠3・泉2・門1): 届く床の上に
  const reachF=floodReach(solid,ci0,cj0);
  const okTile=(x,y)=>{ const i=tileI(x), j=tileJ(y); return inMap(i,j) && !solid[j*MAP_W+i] && reachF[j*MAP_W+i]; };
  const pois=[];
  const place=(kind,inZone,minD,at)=>{
    if(at){ const x=at.x, y=at.y; if(okTile(x,y)){ pois.push({kind,x:tileCX(tileI(x)),y:tileCY(tileJ(y)),key:'f'+fl+':'+kind+pois.length}); return; } }   // v2.0 設計された地形が決めた位置
    for(let k=0;k<600;k++){
      const x=(rnd()-0.5)*MAP_HW*1.72, y=(rnd()-0.5)*MAP_HH*1.72;
      if(Math.hypot(x,y)<minD) continue;
      if(!okTile(x,y)) continue;
      if(inZone && zoneAtXY(zone,x,y)!==inZone) continue;
      if(pois.some(q=>Math.hypot(q.x-x,q.y-y)<380)) continue;
      pois.push({kind,x:tileCX(tileI(x)),y:tileCY(tileJ(y)),key:'f'+fl+':'+kind+pois.length}); return;
    }
    const site=inZone?sites.find(z=>z.t===inZone):null;
    if(site){ // 地形帯の中心付近の届く床
      for(let k=0;k<300;k++){ const x=site.x+(rnd()-0.5)*400, y=site.y+(rnd()-0.5)*300; if(okTile(x,y)){ pois.push({kind,x:tileCX(tileI(x)),y:tileCY(tileJ(y)),key:'f'+fl+':'+kind+pois.length}); return; } }
    }
    for(let k=0;k<400;k++){ const x=(rnd()-0.5)*MAP_HW*1.72, y=(rnd()-0.5)*MAP_HH*1.72; if(Math.hypot(x,y)>=minD*0.6 && okTile(x,y)){ pois.push({kind,x:tileCX(tileI(x)),y:tileCY(tileJ(y)),key:'f'+fl+':'+kind+pois.length}); return; } }
    pois.push({kind,x:tileCX(ci0+6),y:tileCY(cj0),key:'f'+fl+':'+kind+pois.length});
  };
  // v2.0 階層ごとの場所。降り口(最終階層は魔核の間)は出発点から遠く
  for(const q of feat.shrines) place('shrine',null,0,q);   // 崖の一本道の先の祠(危険だが寄り道の価値がある)
  const nShr=fl<=3?3:2; for(let k=feat.shrines.length;k<nShr;k++) place('shrine',null,520);
  if(F.zoneW.hotspring) place('spring','hotspring',320); place('spring',null,420);
  if(F.zoneW.damp){ for(const q of feat.pools) place('pool',null,0,q); for(let k=feat.pools.length;k<2;k++) place('pool','damp',300); }
  if(F.zoneW.ruin){ place('stele','ruin',300); place('stele','ruin',300); }
  if(F.final) place('core',null,1100,feat.exit); else place('stairs',null,1000,feat.exit);   // 闘技場の中心
  if(F.puzzle==='seals'){ for(const q of feat.seals) place('seal',null,0,q); for(let k=feat.seals.length;k<3;k++) place('seal',null,500); }
  if(feat.denPool) place('pool',null,0,feat.denPool);   // v3.2 巣窟の口の外に湧く清水(入る前に整え、出てから流す)
  if(feat.lewd) place('shrine',null,0,{x:feat.lewd.x,y:feat.lewd.y});   // v2.2 えちえちエリアの祠は真ん中(岩の輪を崩さない位置。既存の場所の鍵を変えないよう最後に置く)
  // v1.8 地形帯ごとの「届く床」の索引(資源の出現・イベントの位置に使う)
  const zoneTiles={}; for(const z of ZONE_IDS) zoneTiles[z]=[];
  for(let k=0;k<N;k++){ if(!solid[k] && reachF[k]) zoneTiles[ZONE_IDS[zone[k]]].push(k); }
  // 場所の周りは床を空ける(祠・門の前に立てるように)
  for(const q of pois){ const i=tileI(q.x), j=tileJ(q.y); for(let dj=-2;dj<=2;dj++) for(let di=-2;di<=2;di++){ if(inMap(i+di,j+dj) && i+di>=2 && j+dj>=2 && i+di<MAP_W-2 && j+dj<MAP_H-2 && !protect[(j+dj)*MAP_W+i+di]) solid[(j+dj)*MAP_W+i+di]=0; } }
  if(feat.lewd && feat.haze){   // v3.2 澱みは最後に塗る(掘って繋ぐ処理や場所の整地で消えないように)
    const ZH2=ZI('haze'), ZL2=ZI('lewd'), ai=tileI(feat.haze.x), aj=tileJ(feat.haze.y);
    for(let j=aj-8;j<=aj+8;j++) for(let i=ai-9;i<=ai+9;i++){
      if(i<3||j<3||i>=MAP_W-3||j>=MAP_H-3) continue;
      if(solid[j*MAP_W+i]) continue;
      if(Math.hypot(i-ai,(j-aj)*1.15)<=7 && zone[j*MAP_W+i]!==ZL2) zone[j*MAP_W+i]=ZH2;
    }
  }
  G.map={seed, gi, floor:fl, wall:F.wall, zone, solid, sites, pois, zoneTiles, feats:feat.list, lewd:feat.lewd||null, mini:null, chunks:new Map(), dist:null, distF:null, flowT:-9, heroTile:null};   // feats: v2.1 設計された地形の中心(台詞用)
  if(!META.map || META.map.gen!==gi || META.map.floor!==fl){ META.map={gen:gi, floor:fl, known:{}, visited:{}, seen:0}; saveMeta(); }   // 世代か階層が変われば記憶を捨てる(同じ階層の再挑戦では保つ)
  // 出発点からの流れ場を先に作る(初期召喚の配置に使う)
  G.map.dist=bfsField(ci0,cj0,false); G.map.distF=bfsField(ci0,cj0,true); G.map.heroTile=[ci0,cj0];
}
function floodReach(solid,si,sj){
  const N=MAP_W*MAP_H, reach=new Uint8Array(N); const q=[sj*MAP_W+si]; reach[q[0]]=1;
  for(let h=0;h<q.length;h++){ const cur=q[h], ci=cur%MAP_W, cj=(cur-ci)/MAP_W;
    for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){ const ni=ci+di, nj=cj+dj; if(!inMap(ni,nj)) continue; const nk=nj*MAP_W+ni; if(reach[nk]||solid[nk]) continue; reach[nk]=1; q.push(nk); } }
  return reach;
}

/* 周囲を床にする(門の移設など)。描いた区画と縮小図・流れ場を捨てる */
function clearAround(x,y,r){
  if(!G.map) return;
  const i0=tileI(x), j0=tileJ(y);
  for(let dj=-r;dj<=r;dj++) for(let di=-r;di<=r;di++){
    const i=i0+di, j=j0+dj; if(i<2||j<2||i>=MAP_W-2||j>=MAP_H-2) continue;
    G.map.solid[j*MAP_W+i]=0;
  }
  for(let dj=-r-1;dj<=r+1;dj++) for(let di=-r-1;di<=r+1;di++) G.map.chunks.delete(chunkKey(Math.floor((i0+di)/CHUNK),Math.floor((j0+dj)/CHUNK)));
  G.map.mini=null; G.map.flowT=-9; G.map.heroTile=null; G.map.flows=null;
}
/* ================= 流れ場(魔物の回り込み)・視線・経路 ================= */
function bfsField(si,sj,fly){
  const N=MAP_W*MAP_H, dist=new Int16Array(N).fill(-1);
  if(!passIJ(si,sj,fly)){ // 壁の中から始まるなら、いちばん近い床へ
    let best=-1, bd=1e9; for(let r=1;r<6&&best<0;r++){ for(let dj=-r;dj<=r;dj++) for(let di=-r;di<=r;di++){ if(passIJ(si+di,sj+dj,fly)){ const d=di*di+dj*dj; if(d<bd){ bd=d; best=(sj+dj)*MAP_W+si+di; } } } }
    if(best<0) return dist; si=best%MAP_W; sj=(best-si)/MAP_W;
  }
  const q=new Int32Array(N); let qh=0, qt=0; q[qt++]=sj*MAP_W+si; dist[q[0]]=0;
  while(qh<qt){ const cur=q[qh++], ci=cur%MAP_W, cj=(cur-ci)/MAP_W, dc=dist[cur];
    for(let dj=-1;dj<=1;dj++) for(let di=-1;di<=1;di++){
      if(!di&&!dj) continue; const ni=ci+di, nj=cj+dj; if(!inMap(ni,nj)) continue; const nk=nj*MAP_W+ni;
      if(dist[nk]>=0 || !passIJ(ni,nj,fly)) continue;
      if(di&&dj && !(passIJ(ci+di,cj,fly)&&passIJ(ci,cj+dj,fly))) continue;   // 角をすり抜けない
      dist[nk]=dc+1; q[qt++]=nk;
    } }
  return dist;
}
function updateFlow(force){
  const B=G.B; if(!G.map||!B) return; G.map.flows=G.map.flows||{};
  const hs=B.heroes||[B.hero]; const li=(typeof leaderIdx==='function')?leaderIdx():0;
  hs.forEach((p,i)=>{   // v3.0 ヒロインごとの流れ場(魔物は自分の標的の場で回り込む)。代表の場は従来の dist/distF にも入れる
    if(p.out) return; const hi=tileI(p.x), hj=tileJ(p.y), F=G.map.flows[i];
    if(!force && F && F.tile[0]===hi && F.tile[1]===hj) return;
    if(!force && F && B.time-F.t<0.35) return;
    const nf={dist:bfsField(hi,hj,false), distF:bfsField(hi,hj,true), tile:[hi,hj], t:B.time}; G.map.flows[i]=nf;
    if(i===li){ G.map.heroTile=[hi,hj]; G.map.flowT=B.time; G.map.dist=nf.dist; G.map.distF=nf.distF; }
  });
}
/* (x,y) から彼女へ近づく向き: 隣接タイルのうち距離が最小のものへ */
function flowDir(x,y,fly,hi){
  const F=(G.map.flows&&hi!==undefined)?G.map.flows[hi]:null; const f=F?(fly?F.distF:F.dist):(fly?G.map.distF:G.map.dist); if(!f) return null;
  const i=tileI(x), j=tileJ(y); if(!inMap(i,j)) return null;
  const here=f[j*MAP_W+i]; let best=-1, bi=i, bj=j;
  for(let dj=-1;dj<=1;dj++) for(let di=-1;di<=1;di++){
    if(!di&&!dj) continue; const ni=i+di, nj=j+dj; if(!inMap(ni,nj)) continue; const d=f[nj*MAP_W+ni]; if(d<0) continue;
    if(di&&dj && !(passIJ(i+di,j,fly)&&passIJ(i,j+dj,fly))) continue;
    if(best<0 || d<best){ best=d; bi=ni; bj=nj; }
  }
  if(best<0 || (here>=0 && best>=here && here!==0)) { if(here>0 && best>=here) return null; if(best<0) return null; }
  const tx=tileCX(bi), ty=tileCY(bj); const dx=tx-x, dy=ty-y, d=Math.hypot(dx,dy)||1;
  return {x:dx/d, y:dy/d};
}
function reachableAt(x,y,fly){
  const f=fly?G.map.distF:G.map.dist; const i=tileI(x), j=tileJ(y); if(!inMap(i,j)) return false;
  if(!f) return passIJ(i,j,fly); return f[j*MAP_W+i]>=0;
}
/* 視線: 岩は視線を遮る。崖は遮らない(fly=true で崖を無視) */
function losClear(x1,y1,x2,y2,fly){
  const d=Math.hypot(x2-x1,y2-y1); if(d<1) return true;
  const n=Math.ceil(d/10);
  for(let k=1;k<n;k++){ const t=k/n; if(!passAt(x1+(x2-x1)*t,y1+(y2-y1)*t,fly)) return false; }
  return true;
}
/* 円と壁の当たり: 3×3の壁タイルから押し出す */
function collideMap(o,r,fly){
  if(!passAt(o.x,o.y,fly)){ const q=snapFloor(o.x,o.y,fly,5); if(q){ o.x=q.x; o.y=q.y; } }   // 中心が壁の中なら、いちばん近い床へ
  for(let iter=0;iter<2;iter++){
    const ci=tileI(o.x), cj=tileJ(o.y); let moved=false;
    for(let j=cj-1;j<=cj+1;j++) for(let i=ci-1;i<=ci+1;i++){
      if(passIJ(i,j,fly)) continue;
      const tx0=i*MAP_T-MAP_HW, ty0=j*MAP_T-MAP_HH;
      const nx=clamp(o.x,tx0,tx0+MAP_T), ny=clamp(o.y,ty0,ty0+MAP_T);
      const dx=o.x-nx, dy=o.y-ny, d2=dx*dx+dy*dy;
      if(d2>=r*r) continue;
      if(d2<0.0001){
        const l=o.x-tx0, rr=tx0+MAP_T-o.x, t=o.y-ty0, b=ty0+MAP_T-o.y, m=Math.min(l,rr,t,b);
        if(m===l) o.x=tx0-r; else if(m===rr) o.x=tx0+MAP_T+r; else if(m===t) o.y=ty0-r; else o.y=ty0+MAP_T+r;
      }else{ const d=Math.sqrt(d2); o.x+=dx/d*(r-d); o.y+=dy/d*(r-d); }
      moved=true;
    }
    if(!moved) break;
  }
  o.x=clampMapX(o.x,r); o.y=clampMapY(o.y,r);
}
/* v2.1 壁ぞい滑り: (dx,dy) のうち、半径 r 内の壁へ向かう成分を落とす(壁に沿って滑る)。狭い隙間では横成分が消え、軸方向だけが残る */
function wallSlide(x,y,dx,dy,r,fly){
  const ci=tileI(x), cj=tileJ(y);
  for(let j=cj-1;j<=cj+1;j++) for(let i=ci-1;i<=ci+1;i++){
    if(passIJ(i,j,fly)) continue;
    const tx0=i*MAP_T-MAP_HW, ty0=j*MAP_T-MAP_HH;
    const nx=clamp(x,tx0,tx0+MAP_T), ny=clamp(y,ty0,ty0+MAP_T);
    const ddx=x-nx, ddy=y-ny, d=Math.hypot(ddx,ddy);
    if(d<0.001||d>=r) continue;
    const ux=ddx/d, uy=ddy/d, dot=dx*ux+dy*uy;
    if(dot<0){ dx-=ux*dot; dy-=uy*dot; }
  }
  return {x:dx,y:dy};
}
/* 近くの壁から離れる力(彼女の操舵に足す) */
function wallPush(x,y,range,fly){
  let px=0, py=0; const ci=tileI(x), cj=tileJ(y), R=Math.ceil(range/MAP_T);
  for(let j=cj-R;j<=cj+R;j++) for(let i=ci-R;i<=ci+R;i++){
    if(passIJ(i,j,fly)) continue;
    const tx0=i*MAP_T-MAP_HW, ty0=j*MAP_T-MAP_HH;
    const nx=clamp(x,tx0,tx0+MAP_T), ny=clamp(y,ty0,ty0+MAP_T);
    const dx=x-nx, dy=y-ny, d=Math.hypot(dx,dy)||0.001;
    if(d<range){ const w=1-d/range; px+=dx/d*w; py+=dy/d*w; }
  }
  return {x:px, y:py};
}
/* A*: タイル中心の列を返す(始点は含まない)。壁際は少し嫌う。zoneCost で地形の学習を反映 */
function findPath(x1,y1,x2,y2,fly,zoneCost){
  const si=tileI(x1), sj=tileJ(y1); let ti=tileI(x2), tj=tileJ(y2);
  if(!inMap(si,sj)||!inMap(ti,tj)) return null;
  if(!passIJ(ti,tj,fly)){ const q=snapFloor(x2,y2,fly,4); if(!q) return null; ti=tileI(q.x); tj=tileJ(q.y); }
  const N=MAP_W*MAP_H, gsc=new Float32Array(N).fill(1e9), prev=new Int32Array(N).fill(-1), closed=new Uint8Array(N);
  const start=sj*MAP_W+si, goal=tj*MAP_W+ti;
  const h=(i,j)=>{ const dx=Math.abs(i-ti), dy=Math.abs(j-tj); return Math.max(dx,dy)+0.414*Math.min(dx,dy); };
  // 二分ヒープ
  const heap=[]; const push=(f,k)=>{ heap.push([f,k]); let c=heap.length-1; while(c>0){ const pa=(c-1)>>1; if(heap[pa][0]<=heap[c][0]) break; [heap[pa],heap[c]]=[heap[c],heap[pa]]; c=pa; } };
  const pop=()=>{ const top=heap[0], last=heap.pop(); if(heap.length){ heap[0]=last; let c=0; for(;;){ let l=2*c+1, r=l+1, m=c; if(l<heap.length&&heap[l][0]<heap[m][0]) m=l; if(r<heap.length&&heap[r][0]<heap[m][0]) m=r; if(m===c) break; [heap[m],heap[c]]=[heap[c],heap[m]]; c=m; } } return top; };
  gsc[start]=0; push(h(si,sj),start); let expanded=0;
  while(heap.length){
    const [,cur]=pop(); if(closed[cur]) continue; closed[cur]=1; if(cur===goal) break; if(++expanded>7000) break;
    const ci=cur%MAP_W, cj=(cur-ci)/MAP_W;
    for(let dj=-1;dj<=1;dj++) for(let di=-1;di<=1;di++){
      if(!di&&!dj) continue; const ni=ci+di, nj=cj+dj; if(!inMap(ni,nj)||!passIJ(ni,nj,fly)) continue;
      if(di&&dj && !(passIJ(ci+di,cj,fly)&&passIJ(ci,cj+dj,fly))) continue;
      const nk=nj*MAP_W+ni; if(closed[nk]) continue;
      let c=(di&&dj)?1.414:1;
      if(!passIJ(ni+1,nj,fly)||!passIJ(ni-1,nj,fly)||!passIJ(ni,nj+1,fly)||!passIJ(ni,nj-1,fly)) c+=0.9;   // 壁際は避ける
      if(zoneCost) c+=zoneCost(ZONE_IDS[G.map.zone[nk]]);
      const ng=gsc[cur]+c;
      if(ng<gsc[nk]){ gsc[nk]=ng; prev[nk]=cur; push(ng+h(ni,nj),nk); }
    }
  }
  if(prev[goal]<0 && goal!==start) return null;
  const out=[]; let cur=goal; while(cur>=0 && cur!==start){ const ci=cur%MAP_W, cj=(cur-ci)/MAP_W; out.push({x:tileCX(ci), y:tileCY(cj)}); cur=prev[cur]; }
  out.reverse(); if(out.length) out[out.length-1]={x:x2,y:y2};
  return out;
}
/* 彼女の操舵: 目的地が見えていれば直進、見えなければ A* の経路を辿る(見える限り先の点へ) */
function steerTo(p,tx,ty){
  const B=G.B;
  const direct=()=>{ const d=Math.hypot(tx-p.x,ty-p.y)||1; return {x:(tx-p.x)/d, y:(ty-p.y)/d}; };
  if(losClear(p.x,p.y,tx,ty,false) && heroZoneCostBetween(p.x,p.y,tx,ty)<=0){ p.path=null; return direct(); }
  if(!p.path || Math.hypot((p.pathTx||0)-tx,(p.pathTy||0)-ty)>48 || B.time-(p.pathT||-9)>1.5){
    p.path=findPath(p.x,p.y,tx,ty,false,heroZoneCost); p.pathT=B.time; p.pathTx=tx; p.pathTy=ty; p.pathI=0;
  }
  if(!p.path||!p.path.length) return direct();
  let k=Math.min(p.pathI||0,p.path.length-1);
  while(k<p.path.length-1 && losClear(p.x,p.y,p.path[k+1].x,p.path[k+1].y,false)) k++;
  p.pathI=k; const w=p.path[k];
  if(Math.hypot(w.x-p.x,w.y-p.y)<10 && k<p.path.length-1) p.pathI=k+1;
  const d=Math.hypot(w.x-p.x,w.y-p.y)||1; return {x:(w.x-p.x)/d, y:(w.y-p.y)/d};
}
/* 地形の学習: 浅瀬(足を取られる)・花園(花粉)・温泉(火照る)。3で「覚えた」 */
function zoneKnow(z){ const K=(META.gen&&META.gen.zoneKnow)||{}; return Math.min(1,(K[z]||0)/3); }
/* v2.2 地形の嫌い方(0〜3): その地形の fear × max(見て分かる分 innate, 踏んで学んだ分 zoneKnow) */
function zoneFear(z){ const Z=ZONES[z]; if(!Z) return 0; let f=(Z.fear||0)*Math.max(Z.innate||0, zoneKnow(z));
  if(Z.hazard==='slow' && G.B && G.B.hero && typeof heroStat==='function'){ const sp=heroStat(G.B.hero).speed/154; f*=Math.max(0.3,Math.min(1.2,1/Math.max(0.5,sp))); }   // v2.2 足が速いほど、足を取られる地形は気にしない
  return f; }
function fearTag(f){ return f>=3?'入りたくない':(f>=2?'できれば避けたい':(f>=1?'ちょっと嫌':'')); }
function learnZone(z,amt){
  if(!META.gen) return; META.gen.zoneKnow=META.gen.zoneKnow||{};
  const before=zoneKnow(z); META.gen.zoneKnow[z]=(META.gen.zoneKnow[z]||0)+amt;
  if(before<1 && zoneKnow(z)>=1 && G.B && G.mode==='battle'){
    const h=G.B.hero, note={water:'あしを、とられる',flower:'はなの、においが……',hotspring:'ゆげで、からだが……',lewd:'からだが、へんになる……'}[z]||'';
    const f=zoneFear(z); floatTxt(h.x,h.y-84,'学習: '+ZONES[z].name+(f>=2?'は避ける':(f>=1?'はちょっと嫌':'は慣れた')),'#8fd3ff',11,1.8);   // v2.2 嫌い方の段で言い方が変わる
    if(note) heroBubble(h,note+'。ここは、とおらない',false,1);
  }
}
function heroZoneCost(z){ if(G.B&&G.B.hero&&G.B.hero.scared&&G.B.hero.scared[z]>G.B.time) return 4; const f=zoneFear(z); const C=BAL.FEAR_COST; return f>=3?C[3]:(f>=2?C[2]:(f>=1?C[1]:0.3*f)); }   // v2.2 嫌い方の段で経路コスト(1: 0.5 / 2: 1.5 / 3: 3.0)。迷って諦めた地形は40秒 4   // 巣は学習に関わらず少し避ける(門が目当ての時は経路が通る)
function heroZoneCostBetween(x1,y1,x2,y2){ const n=Math.ceil(Math.hypot(x2-x1,y2-y1)/24)||1; let c=0; for(let k=1;k<=n;k++){ const t=k/n; c+=heroZoneCost(zoneAt(x1+(x2-x1)*t,y1+(y2-y1)*t)); } return c; }
function zoneAvoided(z){ return zoneFear(z)>=2; }   // v2.2 「できれば避けたい」以上

/* v1.8 地形帯の中の届く床から1点(fx,fy から minD〜maxD の範囲。無ければその帯のどこか、帯が無ければ null) */
function randZoneSpot(z,fx,fy,minD,maxD){
  const T=G.map&&G.map.zoneTiles&&G.map.zoneTiles[z]; if(!T||!T.length) return null;
  for(let k=0;k<60;k++){
    const t=T[(Math.random()*T.length)|0]; const i=t%MAP_W, j=(t-i)/MAP_W;
    const x=tileCX(i)+rand(-10,10), y=tileCY(j)+rand(-8,8);
    if(fx!==undefined){ const d=Math.hypot(x-fx,y-fy); if(d<minD||d>maxD) continue; }
    if(!passAt(x,y,false)) continue;
    return {x,y};
  }
  return null;   // 範囲内に無い(呼ぶ側が別の置き方に切り替える)
}
/* ================= 配置 ================= */
function snapFloor(x,y,fly,maxR){
  const i=tileI(x), j=tileJ(y);
  if(inMap(i,j) && passIJ(i,j,fly)) return {x,y};
  for(let r=1;r<=(maxR||6);r++){
    for(let dj=-r;dj<=r;dj++) for(let di=-r;di<=r;di++){
      if(Math.max(Math.abs(di),Math.abs(dj))!==r) continue;
      if(passIJ(i+di,j+dj,fly)) return {x:tileCX(i+di), y:tileCY(j+dj)};
    }
  }
  return null;
}
/* 召喚/回り込みの位置: 望む方向・距離の点が壁や届かない場所なら、同じ距離を保った別の角度へ。彼女の真横には落とさない */
function placeNear(px,py,dx,dy,m,fly){
  m=m===undefined?24:m;
  const want=Math.hypot(dx,dy)||1, a0=Math.atan2(dy,dx);
  const tryAt=(a,dist)=>{
    let x=px+Math.cos(a)*dist, y=py+Math.sin(a)*dist;
    if(x<-MAP_HW+m||x>MAP_HW-m) x=px-Math.cos(a)*dist;
    if(y<-MAP_HH+m||y>MAP_HH-m) y=py-Math.sin(a)*dist;
    x=clampMapX(x,m); y=clampMapY(y,m);
    const q=snapFloor(x,y,fly,3); if(!q) return null;
    if(G.map&&G.map.dist && !reachableAt(q.x,q.y,fly)) return null;
    if(Math.hypot(q.x-px,q.y-py)<want*0.6) return null;
    return q;
  };
  const angles=[0,0.45,-0.45,0.9,-0.9,1.5,-1.5,2.2,-2.2,Math.PI];
  for(const da of angles){ const q=tryAt(a0+da,want); if(q) return q; }
  for(const da of angles){ const q=tryAt(a0+da,want*0.8); if(q) return q; }
  for(let k=0;k<80;k++){
    const x=(Math.random()-0.5)*MAP_HW*1.8, y=(Math.random()-0.5)*MAP_HH*1.8;
    if(Math.hypot(x-px,y-py)<want*0.7) continue;
    const q=snapFloor(x,y,fly,2); if(q && (!G.map.dist || reachableAt(q.x,q.y,fly))) return q;
  }
  return {x:clampMapX(px+dx,m), y:clampMapY(py+dy,m)};
}

/* ================= 描画: マップチップ・チャンク ================= */
let TILE_ATLAS=null;
const TILE_VARS=4, ROCK_ROW=ZONE_IDS.length, CLIFF_ROW=ZONE_IDS.length+1, BRICK_ROW=ZONE_IDS.length+2, FLESH_ROW=ZONE_IDS.length+3;   // 地形帯の行の後に 岩/崖/煉瓦/肉壁
function makeTileAtlas(){
  const T=MAP_T;
  TILE_ATLAS=document.createElement('canvas'); TILE_ATLAS.width=T*TILE_VARS; TILE_ATLAS.height=T*(ZONE_IDS.length+4);
  const g=TILE_ATLAS.getContext('2d');
  const R=(seed)=>{ let sd=seed*9973+17; return ()=>{ sd=(sd*16807)%2147483647; return sd/2147483647; }; };
  const paint=(row,v,fn)=>{ const ox=v*T, oy=row*T, rnd=R(row*11+v+1); g.save(); g.beginPath(); g.rect(ox,oy,T,T); g.clip(); fn(ox,oy,rnd); g.restore(); };
  const dot=(x,y,r,c)=>{ g.fillStyle=c; g.beginPath(); g.arc(x,y,r,0,TAU); g.fill(); };
  ZONE_IDS.forEach((z,row)=>{
    for(let v=0;v<TILE_VARS;v++) paint(row,v,(ox,oy,rnd)=>{
      g.fillStyle=ZONES[z].col; g.fillRect(ox,oy,T,T);
      g.fillStyle='rgba(255,255,255,'+(0.02+0.02*(v%2))+')'; g.fillRect(ox,oy,T,T);
      if(z==='moss'){
        for(let k=0;k<4;k++) dot(ox+rnd()*T,oy+rnd()*T,1.6+rnd()*2.4,'rgba(80,160,110,0.42)');
        dot(ox+rnd()*T,oy+rnd()*T,1.6,'rgba(150,170,200,0.35)');
        if(v===3){ const x=ox+8+rnd()*16, y=oy+8+rnd()*16; g.strokeStyle='rgba(200,180,240,0.6)'; g.lineWidth=1.2; g.beginPath(); g.moveTo(x,y); g.lineTo(x,y+4); g.stroke(); dot(x,y-1,3,'rgba(190,150,255,0.7)'); dot(x,y-1,4.5,'rgba(190,150,255,0.18)'); }
      }else if(z==='damp'){
        const x=ox+rnd()*T, y=oy+rnd()*T, w=5+rnd()*8, h=2.5+rnd()*3.5;
        g.fillStyle='rgba(70,150,165,0.5)'; g.beginPath(); g.ellipse(x,y,w,h,0,0,TAU); g.fill();
        g.fillStyle='rgba(200,240,245,0.35)'; g.beginPath(); g.ellipse(x-w*0.3,y-h*0.3,w*0.35,h*0.3,0,0,TAU); g.fill();
        for(let k=0;k<3;k++) dot(ox+rnd()*T,oy+rnd()*T,1.2,'rgba(140,220,210,0.4)');
        dot(ox+rnd()*T,oy+rnd()*T,2+rnd()*1.5,'rgba(40,70,80,0.6)');
      }else if(z==='water'){
        g.strokeStyle='rgba(140,200,255,0.42)'; g.lineWidth=1.2;
        for(let k=0;k<2;k++){ const x=ox+rnd()*T, y=oy+rnd()*T, w=5+rnd()*7; g.beginPath(); g.moveTo(x-w,y); g.quadraticCurveTo(x-w/2,y-2.5,x,y); g.quadraticCurveTo(x+w/2,y+2.5,x+w,y); g.stroke(); }
        for(let k=0;k<3;k++) dot(ox+rnd()*T,oy+rnd()*T,0.9,'rgba(230,245,255,0.6)');
        g.fillStyle='rgba(20,50,100,0.35)'; g.beginPath(); g.ellipse(ox+rnd()*T,oy+rnd()*T,8,4,0,0,TAU); g.fill();
      }else if(z==='flower'){
        g.strokeStyle='rgba(110,190,110,0.45)'; g.lineWidth=1.2;
        for(let k=0;k<3;k++){ const x=ox+rnd()*T, y=oy+rnd()*T; for(let m=-1;m<=1;m++){ g.beginPath(); g.moveTo(x+m*2,y+2); g.quadraticCurveTo(x+m*3,y-2,x+m*3.5,y-5); g.stroke(); } }
        const cols=['rgba(255,150,190,0.85)','rgba(255,235,245,0.85)','rgba(255,215,120,0.8)','rgba(220,170,255,0.8)'];
        for(let k=0;k<2+(v%2);k++){ const x=ox+3+rnd()*(T-6), y=oy+3+rnd()*(T-6), c=cols[Math.floor(rnd()*cols.length)]; for(let m=0;m<5;m++){ const a=m*TAU/5+rnd()*0.4; dot(x+Math.cos(a)*2.4,y+Math.sin(a)*2.4,1.6,c); } dot(x,y,1.1,'rgba(255,240,180,0.95)'); }
        for(let k=0;k<2;k++) dot(ox+rnd()*T,oy+rnd()*T,1,'rgba(255,190,220,0.5)');
      }else if(z==='hotspring'){
        g.fillStyle='rgba(120,70,80,0.5)'; g.beginPath(); g.ellipse(ox+rnd()*T,oy+rnd()*T,6+rnd()*6,3+rnd()*3,0,0,TAU); g.fill();
        const x=ox+rnd()*T, y=oy+rnd()*T, w=5+rnd()*6, h=3+rnd()*3;
        g.fillStyle='rgba(230,160,150,0.55)'; g.beginPath(); g.ellipse(x,y,w,h,0,0,TAU); g.fill();
        g.strokeStyle='rgba(255,225,215,0.5)'; g.lineWidth=1; g.beginPath(); g.ellipse(x,y,w,h,0,0,TAU); g.stroke();
        dot(ox+rnd()*T,oy+rnd()*T,5+rnd()*5,'rgba(255,235,235,0.10)');
        g.strokeStyle='rgba(90,50,50,0.6)'; g.lineWidth=1; const cx=ox+rnd()*T, cy=oy+rnd()*T; g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+rnd()*8-4,cy+rnd()*8-4); g.stroke();
      }else if(z==='haze'){
        // 澱み: 床に薄い霞と、甘い粒。奥に何かある匂い
        g.fillStyle='rgba(160,90,160,0.16)'; g.beginPath(); g.ellipse(ox+rnd()*T,oy+rnd()*T,9+rnd()*7,5+rnd()*4,rnd()*TAU,0,TAU); g.fill();
        for(let k=0;k<3;k++) dot(ox+rnd()*T,oy+rnd()*T,1+rnd()*1.6,'rgba(255,170,215,0.30)');
        if(v%2===0){ g.strokeStyle='rgba(255,160,210,0.20)'; g.lineWidth=1; const x=ox+rnd()*T, y=oy+rnd()*T; g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+4,y-6,x+1,y-11); g.stroke(); }
      }else if(z==='ruin'){
        g.strokeStyle='rgba(30,30,44,0.8)'; g.lineWidth=1.6;
        const s2=T/2, off=(v%2)*s2/2;
        for(let i=0;i<=2;i++){ g.beginPath(); g.moveTo(ox,oy+i*s2); g.lineTo(ox+T,oy+i*s2); g.stroke(); }
        for(let j=0;j<2;j++){ const o2=(j%2)?off:(s2/2-off); for(let i=0;i<=2;i++){ g.beginPath(); g.moveTo(ox+i*s2+o2,oy+j*s2); g.lineTo(ox+i*s2+o2,oy+(j+1)*s2); g.stroke(); } }
        g.fillStyle='rgba(255,255,255,0.05)'; g.fillRect(ox+1,oy+1,s2-2,s2-2); g.fillRect(ox+s2+1,oy+s2+1,s2-2,s2-2);
        if(v>=2){ g.strokeStyle='rgba(20,20,30,0.7)'; g.lineWidth=1; const x=ox+rnd()*T, y=oy+rnd()*T; g.beginPath(); g.moveTo(x,y); g.lineTo(x+rnd()*8-4,y+rnd()*8-4); g.lineTo(x+rnd()*10-5,y+rnd()*10-5); g.stroke(); }
        dot(ox+rnd()*T,oy+rnd()*T,1.5,'rgba(120,170,120,0.35)');
      }else if(z==='nest'){
        g.strokeStyle='rgba(150,60,110,0.55)'; g.lineWidth=1.8;
        for(let k=0;k<2;k++){ const x=ox+rnd()*T, y=oy+rnd()*T; g.beginPath(); g.moveTo(x,y); g.bezierCurveTo(x+rnd()*20-10,y+rnd()*20-10,x+rnd()*24-12,y+rnd()*24-12,x+rnd()*28-14,y+rnd()*28-14); g.stroke(); }
        for(let k=0;k<2;k++){ const x=ox+rnd()*T, y=oy+rnd()*T, r=2+rnd()*2.2; dot(x,y,r,'rgba(170,90,130,0.7)'); dot(x-r*0.3,y-r*0.3,r*0.35,'rgba(255,200,230,0.55)'); }
        g.fillStyle='rgba(30,8,24,0.4)'; g.beginPath(); g.ellipse(ox+rnd()*T,oy+rnd()*T,6,3.5,rnd(),0,TAU); g.fill();
      }else if(z==='lewd'){
        // v2.2 甘い褥: 桃色に濡れた床。膨らみのハイライト、小さなハート、光る粒、細い蔦
        g.fillStyle='rgba(255,120,180,0.16)'; g.beginPath(); g.ellipse(ox+rnd()*T,oy+rnd()*T,10+rnd()*6,6+rnd()*4,rnd()*3,0,TAU); g.fill();
        for(let k=0;k<2;k++){ const x=ox+rnd()*T, y=oy+rnd()*T, r=2+rnd()*2; dot(x,y,r,'rgba(255,150,200,0.55)'); dot(x-r*0.3,y-r*0.3,r*0.4,'rgba(255,230,240,0.75)'); }
        { const x=ox+rnd()*T, y=oy+rnd()*T; g.fillStyle='rgba(255,140,190,0.6)'; g.beginPath(); g.moveTo(x,y+3); g.bezierCurveTo(x-4,y-1,x-2,y-4,x,y-1.5); g.bezierCurveTo(x+2,y-4,x+4,y-1,x,y+3); g.fill(); }
        g.strokeStyle='rgba(255,170,210,0.35)'; g.lineWidth=1.2; { const x=ox+rnd()*T, y=oy+rnd()*T; g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+rnd()*16-8,y+rnd()*16-8,x+rnd()*20-10,y+rnd()*20-10); g.stroke(); }
        if(rnd()<0.5) dot(ox+rnd()*T,oy+rnd()*T,1.2,'rgba(255,255,255,0.8)');
      }else if(z==='flesh'){
        // 肉の床: 濡れた桃色の組織。太い血管、膨らみのハイライト、小さな窪み
        g.fillStyle='rgba(120,40,70,0.35)'; g.beginPath(); g.ellipse(ox+rnd()*T,oy+rnd()*T,9+rnd()*6,6+rnd()*4,rnd()*3,0,TAU); g.fill();
        g.strokeStyle='rgba(150,30,60,0.55)'; g.lineWidth=2.2; for(let k=0;k<2;k++){ const x=ox+rnd()*T, y=oy+rnd()*T; g.beginPath(); g.moveTo(x,y); g.bezierCurveTo(x+rnd()*22-11,y+rnd()*22-11,x+rnd()*26-13,y+rnd()*26-13,x+rnd()*30-15,y+rnd()*30-15); g.stroke(); }
        g.strokeStyle='rgba(230,120,160,0.35)'; g.lineWidth=1; { const x=ox+rnd()*T, y=oy+rnd()*T; g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+rnd()*14-7,y+rnd()*14-7,x+rnd()*18-9,y+rnd()*18-9); g.stroke(); }
        for(let k=0;k<2;k++){ const x=ox+rnd()*T, y=oy+rnd()*T, r=2.5+rnd()*2.5; dot(x,y,r,'rgba(200,90,130,0.6)'); dot(x-r*0.35,y-r*0.35,r*0.4,'rgba(255,200,225,0.7)'); }
        { const x=ox+rnd()*T, y=oy+rnd()*T; g.fillStyle='rgba(40,6,20,0.55)'; g.beginPath(); g.ellipse(x,y,3.5,2.2,rnd()*3,0,TAU); g.fill(); g.fillStyle='rgba(255,150,190,0.35)'; g.beginPath(); g.ellipse(x,y-1.2,2.2,0.9,0,0,TAU); g.fill(); }
      }
    });
  });
  // 岩壁
  for(let v=0;v<TILE_VARS;v++) paint(ROCK_ROW,v,(ox,oy,rnd)=>{
    g.fillStyle='#2b2742'; g.fillRect(ox,oy,T,T);
    for(let k=0;k<3;k++) dot(ox+rnd()*T,oy+rnd()*T,3+rnd()*4,'rgba(70,64,100,0.5)');
    g.strokeStyle='rgba(18,14,30,0.8)'; g.lineWidth=1.3; for(let k=0;k<2;k++){ const x=ox+rnd()*T, y=oy+rnd()*T; g.beginPath(); g.moveTo(x,y); g.lineTo(x+rnd()*12-6,y+rnd()*12-6); g.lineTo(x+rnd()*14-7,y+rnd()*14-7); g.stroke(); }
    for(let k=0;k<4;k++) dot(ox+rnd()*T,oy+rnd()*T,0.9,'rgba(120,110,160,0.5)');
  });
  // 崖(高台の上面)
  for(let v=0;v<TILE_VARS;v++) paint(CLIFF_ROW,v,(ox,oy,rnd)=>{
    g.fillStyle='#4c4666'; g.fillRect(ox,oy,T,T);
    for(let k=0;k<3;k++) dot(ox+rnd()*T,oy+rnd()*T,2+rnd()*3,'rgba(110,100,150,0.35)');
    g.strokeStyle='rgba(40,34,60,0.6)'; g.lineWidth=1; const x=ox+rnd()*T, y=oy+rnd()*T; g.beginPath(); g.moveTo(x,y); g.lineTo(x+rnd()*10-5,y+rnd()*10-5); g.stroke();
    for(let k=0;k<2;k++) dot(ox+rnd()*T,oy+rnd()*T,1.3,'rgba(80,140,110,0.35)');
  });
  // 煉瓦の壁(沈んだ回廊): 暗い石積みと目地、欠け
  for(let v=0;v<TILE_VARS;v++) paint(BRICK_ROW,v,(ox,oy,rnd)=>{
    g.fillStyle='#262636'; g.fillRect(ox,oy,T,T);
    const bh=T/4; g.strokeStyle='rgba(12,12,22,0.9)'; g.lineWidth=1.4;
    for(let r=0;r<4;r++){ const y=oy+r*bh; g.beginPath(); g.moveTo(ox,y+0.7); g.lineTo(ox+T,y+0.7); g.stroke(); const off=(r%2)*(T/4); for(let k=0;k<3;k++){ const x=ox+off+k*(T/2); if(x>ox&&x<ox+T){ g.beginPath(); g.moveTo(x,y); g.lineTo(x,y+bh); g.stroke(); } } }
    g.fillStyle='rgba(255,255,255,0.05)'; for(let r=0;r<4;r++){ const off=(r%2)*(T/4); for(let k=-1;k<3;k++){ const x=ox+off+k*(T/2); g.fillRect(Math.max(ox,x+1),oy+r*bh+1,Math.min(T/2-2,ox+T-Math.max(ox,x+1)),2); } }
    if(v>=2){ g.strokeStyle='rgba(10,10,18,0.8)'; g.lineWidth=1; const x=ox+rnd()*T, y=oy+rnd()*T; g.beginPath(); g.moveTo(x,y); g.lineTo(x+rnd()*10-5,y+rnd()*10-5); g.stroke(); }
    for(let k=0;k<2;k++) dot(ox+rnd()*T,oy+rnd()*T,1.2,'rgba(110,150,120,0.35)');
  });
  // 肉の壁(肉の巣): 暗い赤紫の組織に太い血管と膨らみ
  for(let v=0;v<TILE_VARS;v++) paint(FLESH_ROW,v,(ox,oy,rnd)=>{
    g.fillStyle='#3a0f22'; g.fillRect(ox,oy,T,T);
    for(let k=0;k<3;k++){ g.fillStyle='rgba(110,30,60,0.55)'; g.beginPath(); g.ellipse(ox+rnd()*T,oy+rnd()*T,6+rnd()*6,4+rnd()*4,rnd()*3,0,TAU); g.fill(); }
    g.strokeStyle='rgba(160,40,80,0.7)'; g.lineWidth=2.6; for(let k=0;k<2;k++){ const x=ox+rnd()*T, y=oy+rnd()*T; g.beginPath(); g.moveTo(x,y); g.bezierCurveTo(x+rnd()*24-12,y+rnd()*24-12,x+rnd()*28-14,y+rnd()*28-14,x+rnd()*32-16,y+rnd()*32-16); g.stroke(); }
    g.strokeStyle='rgba(255,150,190,0.22)'; g.lineWidth=1; { const x=ox+rnd()*T, y=oy+rnd()*T; g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+rnd()*14-7,y+rnd()*14-7,x+rnd()*20-10,y+rnd()*20-10); g.stroke(); }
    { const x=ox+rnd()*T, y=oy+rnd()*T, r=3+rnd()*2; dot(x,y,r,'rgba(190,80,120,0.55)'); dot(x-r*0.3,y-r*0.35,r*0.35,'rgba(255,210,230,0.6)'); }
  });
}
makeTileAtlas();
const CHUNK=8;   // タイル数(8×32=256px)
function chunkKey(ci,cj){ return ci*1000+cj; }
function renderChunk(ci,cj){
  const T=MAP_T, S=CHUNK*T, cv=document.createElement('canvas'); cv.width=S; cv.height=S; const g=cv.getContext('2d');
  const zone=G.map.zone, solid=G.map.solid;
  const i0=ci*CHUNK, j0=cj*CHUNK;
  const zid=(i,j)=>inMap(i,j)?zone[j*MAP_W+i]:0, sol=(i,j)=>solidIJ(i,j);
  for(let j=j0;j<j0+CHUNK;j++) for(let i=i0;i<i0+CHUNK;i++){
    if(!inMap(i,j)) continue;
    const x=(i-i0)*T, y=(j-j0)*T, v=Math.floor(hash2(i,j)*TILE_VARS), s=sol(i,j), z=zid(i,j);
    const wallRow=G.map.wall==='brick'?BRICK_ROW:(G.map.wall==='flesh'?FLESH_ROW:ROCK_ROW);   // v2.0 階層の壁様式
    if(s===SOLID_ROCK) g.drawImage(TILE_ATLAS,v*T,wallRow*T,T,T,x,y,T,T);
    else if(s===SOLID_CLIFF) g.drawImage(TILE_ATLAS,v*T,CLIFF_ROW*T,T,T,x,y,T,T);
    else g.drawImage(TILE_ATLAS,v*T,z*T,T,T,x,y,T,T);
    if(s===0){
      const zn=ZONE_IDS[z];
      // 地形の境目: 浜(浅瀬)・肉の縁(巣)・泥(湿地)・石の縁(温泉/石畳)
      const sides=[[0,-1,x,y,T,6],[0,1,x,y+T-6,T,6],[-1,0,x,y,6,T],[1,0,x+T-6,y,6,T]];
      for(const [di,dj,bx,by,bw,bh] of sides){
        const ni=i+di, nj=j+dj; if(!inMap(ni,nj)) continue;
        const ns=sol(ni,nj), nz=ZONE_IDS[zid(ni,nj)];
        if(ns){   // 壁の影(壁の側に落ちる。上の壁の影がいちばん濃く長い)
          if(dj<0){ g.fillStyle='rgba(0,0,0,0.34)'; g.fillRect(x,y,T,5); g.fillStyle='rgba(0,0,0,0.16)'; g.fillRect(x,y+5,T,5); }
          else if(dj>0){ g.fillStyle='rgba(0,0,0,0.18)'; g.fillRect(x,y+T-5,T,5); }
          else if(di<0){ g.fillStyle='rgba(0,0,0,0.22)'; g.fillRect(x,y,4,T); g.fillStyle='rgba(0,0,0,0.10)'; g.fillRect(x+4,y,3,T); }
          else { g.fillStyle='rgba(0,0,0,0.22)'; g.fillRect(x+T-4,y,4,T); g.fillStyle='rgba(0,0,0,0.10)'; g.fillRect(x+T-7,y,3,T); }
          continue;
        }
        if(nz===zn) continue;
        if(zn==='water'){ g.fillStyle='#cdbd92'; g.fillRect(bx,by,bw,bh); g.fillStyle='rgba(120,170,220,0.55)'; if(dj<0) g.fillRect(x,y+6,T,1.5); else if(dj>0) g.fillRect(x,y+T-7.5,T,1.5); else if(di<0) g.fillRect(x+6,y,1.5,T); else g.fillRect(x+T-7.5,y,1.5,T); }
        else if(zn==='nest'){ g.fillStyle='#6e2a4a'; g.fillRect(bx,by,bw,bh); g.fillStyle='rgba(200,110,160,0.6)'; if(dj<0) g.fillRect(x,y,T,1.5); else if(dj>0) g.fillRect(x,y+T-1.5,T,1.5); else if(di<0) g.fillRect(x,y,1.5,T); else g.fillRect(x+T-1.5,y,1.5,T); }
        else if(zn==='flesh'){ g.fillStyle='#8a3458'; g.fillRect(bx,by,bw,bh); g.fillStyle='rgba(255,170,200,0.55)'; if(dj<0) g.fillRect(x,y,T,1.5); else if(dj>0) g.fillRect(x,y+T-1.5,T,1.5); else if(di<0) g.fillRect(x,y,1.5,T); else g.fillRect(x+T-1.5,y,1.5,T); }
        else if(zn==='lewd'){ g.fillStyle='#a03a7a'; g.fillRect(bx,by,bw,bh); g.fillStyle='rgba(255,170,230,0.75)'; if(dj<0) g.fillRect(x,y,T,2); else if(dj>0) g.fillRect(x,y+T-2,T,2); else if(di<0) g.fillRect(x,y,2,T); else g.fillRect(x+T-2,y,2,T); }   // v2.2 甘い褥の縁は桃色に光る
        else if(zn==='damp' && nz!=='water'){ g.fillStyle='rgba(40,80,76,0.75)'; g.fillRect(bx,by,bw,bh); }
        else if(zn==='hotspring'){ g.fillStyle='#7a5e5e'; g.fillRect(bx,by,bw,bh); g.fillStyle='rgba(255,220,210,0.25)'; if(dj<0) g.fillRect(x,y,T,1.5); else if(dj>0) g.fillRect(x,y+T-1.5,T,1.5); else if(di<0) g.fillRect(x,y,1.5,T); else g.fillRect(x+T-1.5,y,1.5,T); }
        else if(zn==='ruin'){ g.fillStyle='#5c5c74'; if(dj<0) g.fillRect(x,y,T,3); else if(dj>0) g.fillRect(x,y+T-3,T,3); else if(di<0) g.fillRect(x,y,3,T); else g.fillRect(x+T-3,y,3,T); }
        else if((zn==='flower'||zn==='moss') && (nz==='moss'||nz==='flower')){ g.strokeStyle='rgba(120,190,120,0.5)'; g.lineWidth=1.2; for(let k=0;k<3;k++){ const tx=bx+bw*(0.2+0.3*k), ty=by+bh*0.5; g.beginPath(); g.moveTo(tx,ty+3); g.lineTo(tx+1,ty-3); g.stroke(); } }
      }
    }else{
      // 壁・崖の立体感: 下が床なら「面」を描く。崖は縁の明かり
      const below=sol(i,j+1)===0 && inMap(i,j+1);
      if(below){ const wf=G.map.wall==='brick'?['#15151f','rgba(140,140,180,0.35)']:(G.map.wall==='flesh'?['#22060f','rgba(230,120,160,0.4)']:['#17132a','rgba(120,110,160,0.35)']);
        g.fillStyle=s===SOLID_ROCK?wf[0]:'#2e2a46'; g.fillRect(x,y+T-9,T,9); g.fillStyle=s===SOLID_ROCK?wf[1]:'rgba(170,165,210,0.5)'; g.fillRect(x,y+T-9,T,1.5); }
      if(s===SOLID_CLIFF){ g.strokeStyle='rgba(170,165,210,0.55)'; g.lineWidth=1.5; if(sol(i,j-1)===0) { g.beginPath(); g.moveTo(x,y+0.75); g.lineTo(x+T,y+0.75); g.stroke(); } if(sol(i-1,j)===0){ g.beginPath(); g.moveTo(x+0.75,y); g.lineTo(x+0.75,y+T); g.stroke(); } if(sol(i+1,j)===0){ g.beginPath(); g.moveTo(x+T-0.75,y); g.lineTo(x+T-0.75,y+T); g.stroke(); } }
      else if(sol(i,j-1)===0){ g.fillStyle='rgba(140,130,180,0.28)'; g.fillRect(x,y,T,2); }
    }
  }
  return cv;
}
let CHUNK_BUDGET=0;
/* 開幕に彼女の周りのチャンクを先に焼く(最初の数フレームの引っかかりを避ける) */
function prewarmChunks(x,y){
  if(!G.map||!G.map.zone) return; if(!G.map.chunks) G.map.chunks=new Map();
  const S=CHUNK*MAP_T, ci0=Math.floor((x+MAP_HW)/S), cj0=Math.floor((y+MAP_HH)/S);
  for(let cj=cj0-1;cj<=cj0+1;cj++) for(let ci=ci0-2;ci<=ci0+2;ci++){
    if(ci<0||cj<0||ci>=Math.ceil(MAP_W/CHUNK)||cj>=Math.ceil(MAP_H/CHUNK)) continue;
    const k=chunkKey(ci,cj); if(!G.map.chunks.has(k)) G.map.chunks.set(k,renderChunk(ci,cj));
  }
}
function drawTiles(g){
  const cx=G.cam.x, cy=G.cam.y, T=MAP_T;
  g.fillStyle='#0d0c16'; g.fillRect(cx-W/2-40,cy-H/2-40,W+80,H+80);
  if(!G.map||!G.map.zone){ return; }
  if(!G.map.chunks) G.map.chunks=new Map();
  CHUNK_BUDGET=2;
  const S=CHUNK*T;
  const c0=Math.max(0,Math.floor((cx-W/2+MAP_HW)/S)), c1=Math.min(Math.ceil(MAP_W/CHUNK)-1,Math.floor((cx+W/2+MAP_HW)/S));
  const d0=Math.max(0,Math.floor((cy-H/2+MAP_HH)/S)), d1=Math.min(Math.ceil(MAP_H/CHUNK)-1,Math.floor((cy+H/2+MAP_HH)/S));
  for(let ci=c0;ci<=c1;ci++) for(let cj=d0;cj<=d1;cj++){
    const k=chunkKey(ci,cj); let cv=G.map.chunks.get(k);
    if(!cv){
      if(CHUNK_BUDGET>0){ cv=renderChunk(ci,cj); G.map.chunks.set(k,cv); CHUNK_BUDGET--; }
      else{ // まだ焼けていない: 地形色だけ
        for(let j=cj*CHUNK;j<cj*CHUNK+CHUNK;j++) for(let i=ci*CHUNK;i<ci*CHUNK+CHUNK;i++){ if(!inMap(i,j)) continue; const s=G.map.solid[j*MAP_W+i]; g.fillStyle=s===SOLID_ROCK?'#2b2742':(s===SOLID_CLIFF?'#4c4666':ZONES[ZONE_IDS[G.map.zone[j*MAP_W+i]]].col); g.fillRect(i*T-MAP_HW,j*T-MAP_HH,T+0.5,T+0.5); }
        continue;
      }
    }
    g.drawImage(cv, ci*S-MAP_HW, cj*S-MAP_HH);
  }
}
/* 場所: 祠(金の灯)・泉(湯)・門(巣の奥) */
function drawPoi(g,q){
  const M=META.map||{}, t=performance.now()*0.001, known=!!M.known[q.key];
  g.save(); g.translate(q.x,q.y);
  if(q.kind==='shrine'){
    const done=!!M.visited[q.key];
    g.fillStyle='rgba(8,8,26,0.35)'; g.beginPath(); g.ellipse(0,4,24,9,0,0,TAU); g.fill();
    g.fillStyle='#5a5a70'; g.fillRect(-16,-4,32,6);
    g.fillStyle='#6e6e88'; g.fillRect(-5,-30,10,26);
    g.fillStyle='#4a4a62'; g.beginPath(); g.moveTo(-18,-30); g.lineTo(0,-42); g.lineTo(18,-30); g.closePath(); g.fill();
    glow(g,0,-18,done?10:16,done?'200,200,220':'255,215,106',done?0.25:0.55+0.2*Math.sin(t*3));
    g.fillStyle=done?'#c8c8dc':'#ffd76a'; g.beginPath(); g.arc(0,-18,4,0,TAU); g.fill();
  }else if(q.kind==='spring'){
    const grad=g.createRadialGradient(0,0,4,0,0,40); grad.addColorStop(0,'rgba(180,230,255,0.85)'); grad.addColorStop(1,'rgba(90,150,210,0.55)');
    g.fillStyle=grad; g.beginPath(); g.ellipse(0,0,40,20,0,0,TAU); g.fill();
    g.strokeStyle='rgba(220,245,255,0.5)'; g.lineWidth=1.2; g.beginPath(); g.ellipse(0,0,26+Math.sin(t*2)*3,12+Math.sin(t*2)*1.5,0,0,TAU); g.stroke();
    g.fillStyle='rgba(255,240,245,0.16)'; for(let i=0;i<3;i++){ const ph=(t*0.4+i*0.33)%1; g.beginPath(); g.arc(-14+i*14,-10-ph*30,8+ph*8,0,TAU); g.fill(); }
    g.fillStyle='#6a6a80'; for(let i=0;i<7;i++){ const a=i*TAU/7; g.beginPath(); g.ellipse(Math.cos(a)*42,Math.sin(a)*21,5,3,a,0,TAU); g.fill(); }
  }else if(q.kind==='stairs'){
    // 降り口: 床に開いた暗い穴。石段が下へ、下から薄い光と塵が昇る
    const B=G.B, locked=B&&B.exitLocked;
    g.fillStyle='rgba(0,0,0,0.55)'; g.beginPath(); g.ellipse(0,6,46,20,0,0,TAU); g.fill();
    g.fillStyle='#0a0814'; g.beginPath(); g.ellipse(0,4,38,15,0,0,TAU); g.fill();
    g.fillStyle='#3a3450'; for(let i=0;i<4;i++){ g.fillRect(-26+i*3,-2+i*5,52-i*6,3.5); }
    g.fillStyle='#55506c'; g.fillRect(-30,-6,60,4);
    if(!locked){ const grad=g.createRadialGradient(0,2,2,0,2,34); grad.addColorStop(0,'rgba(160,190,255,0.35)'); grad.addColorStop(1,'rgba(160,190,255,0)'); g.fillStyle=grad; g.beginPath(); g.ellipse(0,2,34,13,0,0,TAU); g.fill();
      for(let i=0;i<4;i++){ const ph=(t*0.3+i/4)%1; g.fillStyle='rgba(200,220,255,'+((1-ph)*0.6).toFixed(2)+')'; g.beginPath(); g.arc(Math.sin(i*2.3+t)*16,2-ph*60,1.5,0,TAU); g.fill(); } }
    else{ g.strokeStyle='rgba(201,140,255,0.7)'; g.lineWidth=2; for(let i=0;i<3;i++){ const a=i*TAU/3+t*0.4; g.beginPath(); g.moveTo(Math.cos(a)*30,4+Math.sin(a)*12); g.lineTo(Math.cos(a+Math.PI)*30,4+Math.sin(a+Math.PI)*12); g.stroke(); } }
  }else if(q.kind==='core'){
    // 魔核の間: 床に広がる根と脈。魔核そのものは魔物として描く
    g.strokeStyle='rgba(160,40,80,0.45)'; g.lineWidth=3; for(let i=0;i<8;i++){ const a=i*TAU/8+0.2; g.beginPath(); g.moveTo(Math.cos(a)*40,Math.sin(a)*18); g.quadraticCurveTo(Math.cos(a+0.3)*90,Math.sin(a+0.3)*40,Math.cos(a)*140,Math.sin(a)*62); g.stroke(); }
    g.fillStyle='rgba(120,20,60,'+(0.10+0.05*Math.sin(t*2))+')'; g.beginPath(); g.ellipse(0,0,120,52,0,0,TAU); g.fill();
  }else if(q.kind==='seal'){
    // 封印石: 石柱。灯ると金色に光る
    const B=G.B, lit=B&&B.seals&&B.seals[q.key];
    g.fillStyle='rgba(8,8,26,0.35)'; g.beginPath(); g.ellipse(0,4,18,7,0,0,TAU); g.fill();
    g.fillStyle='#4a4a62'; g.fillRect(-12,-2,24,5);
    g.fillStyle='#5e5e7a'; g.beginPath(); g.moveTo(-8,0); g.lineTo(-6,-40); g.lineTo(6,-40); g.lineTo(8,0); g.closePath(); g.fill();
    g.strokeStyle='#33334a'; g.lineWidth=1; g.stroke();
    g.fillStyle=lit?'#ffd76a':'rgba(201,140,255,0.55)'; g.beginPath(); g.arc(0,-22,4,0,TAU); g.fill();
    glow(g,0,-22,lit?26:12,lit?'255,215,106':'201,140,255',lit?0.5+0.2*Math.sin(t*3):0.25+0.1*Math.sin(t*2));
    if(lit){ g.strokeStyle='rgba(255,215,106,0.6)'; g.lineWidth=1.2; g.beginPath(); g.moveTo(-4,-30); g.lineTo(4,-30); g.moveTo(-3,-14); g.lineTo(3,-14); g.stroke(); }
  }
  else if(q.kind==='pool'){
    // 清水: 澄んだ小さな水面。使った直後(cd)は濁って見える。イベント中は光る
    const B=G.B, cd=B&&B.poolCd&&B.poolCd[q.key]>0, ev=B&&B.event&&B.event.key===q.key;
    g.fillStyle='rgba(8,8,26,0.3)'; g.beginPath(); g.ellipse(0,3,34,15,0,0,TAU); g.fill();
    g.fillStyle='#4a4a5c'; for(let i=0;i<8;i++){ const a=i*TAU/8+0.3; g.beginPath(); g.ellipse(Math.cos(a)*33,Math.sin(a)*15,5,3.2,a,0,TAU); g.fill(); }
    const grad=g.createRadialGradient(0,0,3,0,0,30); grad.addColorStop(0,cd?'rgba(140,190,210,0.7)':'rgba(200,250,255,0.95)'); grad.addColorStop(1,cd?'rgba(60,110,140,0.6)':'rgba(70,170,220,0.7)');
    g.fillStyle=grad; g.beginPath(); g.ellipse(0,0,30,13,0,0,TAU); g.fill();
    g.strokeStyle='rgba(230,255,255,'+(cd?0.2:0.55)+')'; g.lineWidth=1; for(let i=0;i<2;i++){ const ph=(t*0.5+i*0.5)%1; g.beginPath(); g.ellipse(0,0,6+ph*22,(6+ph*22)*0.42,0,0,TAU); g.stroke(); }
    if(!cd){ g.fillStyle='rgba(255,255,255,'+(0.5+0.4*Math.sin(t*5))+')'; g.beginPath(); g.arc(-9,-3,1.6,0,TAU); g.fill(); g.beginPath(); g.arc(11,4,1.2,0,TAU); g.fill(); }
    if(ev) glow(g,0,-4,44,'143,211,255',0.35+0.15*Math.sin(t*4));
  }else if(q.kind==='stele'){
    // 石碑: 碑文の刻まれた石板。読んだ後は光が消える。イベント中は強く光る
    const B=G.B, read=B&&B.steleRead&&B.steleRead[q.key], ev=B&&B.event&&B.event.key===q.key;
    g.fillStyle='rgba(8,8,26,0.35)'; g.beginPath(); g.ellipse(0,4,20,7,0,0,TAU); g.fill();
    g.fillStyle='#4e4e66'; g.fillRect(-14,-2,28,5);
    g.fillStyle='#62627e'; g.beginPath(); g.moveTo(-10,0); g.lineTo(-10,-30); g.quadraticCurveTo(0,-40,10,-30); g.lineTo(10,0); g.closePath(); g.fill();
    g.strokeStyle='#3a3a50'; g.lineWidth=1; g.stroke();
    const rc=read?'rgba(170,170,200,0.45)':'rgba(203,213,255,'+(0.7+0.3*Math.sin(t*3))+')';
    g.strokeStyle=rc; g.lineWidth=1.4; for(let i=0;i<4;i++){ const y=-26+i*6; g.beginPath(); g.moveTo(-6,y); g.lineTo(-6+([7,10,5,9][i]),y); g.stroke(); }
    if(!read) glow(g,0,-18,ev?40:16,'203,213,255',ev?0.45+0.2*Math.sin(t*4):0.3);
  }
  if(known){ g.fillStyle='rgba(143,211,255,0.9)'; g.font='bold 10px sans-serif'; g.textAlign='center'; g.fillText(POI_DEF[q.kind].name, 0, ({stairs:-22,core:-70,seal:-56,spring:-30,pool:-28,stele:-50})[q.kind]||-50); }
  g.restore();
}
/* ミニマップ(左下): 地形色・壁・知っている場所・彼女・ボス */
function drawMinimap(g){
  if(!G.map||!G.B) return;
  const M=META.map||{}, B=G.B, p=B.hero;
  if(!G.map.mini){
    const c=document.createElement('canvas'); c.width=MAP_W; c.height=MAP_H; const cg=c.getContext('2d');
    for(let j=0;j<MAP_H;j++) for(let i=0;i<MAP_W;i++){ const s=G.map.solid[j*MAP_W+i]; cg.fillStyle=s===SOLID_ROCK?(G.map.wall==='flesh'?'#2a0812':(G.map.wall==='brick'?'#1c1c28':'#14111f')):(s===SOLID_CLIFF?'#5a5478':ZONES[ZONE_IDS[G.map.zone[j*MAP_W+i]]].col); cg.fillRect(i,j,1,1); }
    G.map.mini=c;
  }
  const sc=1, mw=MAP_W*sc, mh=MAP_H*sc, x0=12, y0=H-mh-22-Math.round(typeof barCover==='number'?barCover:0);   // v1.9 横持ちでは戦闘バーの上に
  g.save(); g.globalAlpha=0.9;
  g.fillStyle='rgba(10,10,26,0.8)'; g.fillRect(x0-3,y0-3,mw+6,mh+6);
  g.imageSmoothingEnabled=false; g.drawImage(G.map.mini,x0,y0,mw,mh);
  if(G.map.seen){   // v2.4 未探索の霧(見た範囲は晴れる)
    const now=performance.now();
    if(!G.map.fog || G.map.fogT<0 || now-G.map.fogT>500){
      if(!G.map.fog){ G.map.fog=document.createElement('canvas'); G.map.fog.width=MAP_W; G.map.fog.height=MAP_H; }
      const fg=G.map.fog.getContext('2d'), im=fg.createImageData(MAP_W,MAP_H), dd=im.data;
      for(let k=0;k<MAP_W*MAP_H;k++){ if(G.map.seen[k]) continue; const o=k*4; dd[o]=8; dd[o+1]=6; dd[o+2]=18; dd[o+3]=G.map.solid[k]===0?200:120; }
      fg.putImageData(im,0,0); G.map.fogT=now;
    }
    g.drawImage(G.map.fog,x0,y0,mw,mh);
  }
  g.imageSmoothingEnabled=true;
  const tx=(x)=>x0+(x+MAP_HW)/MAP_T*sc, ty=(y)=>y0+(y+MAP_HH)/MAP_T*sc;
  for(const q of G.map.pois){ if(!M.known[q.key]) continue; g.fillStyle=q.kind==='shrine'?(M.visited[q.key]?'#9a9ab0':'#ffd76a'):(q.kind==='spring'?'#8fd3ff':(q.kind==='pool'?'#7fe0ff':(q.kind==='stele'?'#cbd5ff':(q.kind==='stairs'?'#ffffff':(q.kind==='seal'?((B.seals&&B.seals[q.key])?'#ffe9b0':'#c98cff'):'#ff6b81'))))); g.fillRect(tx(q.x)-2,ty(q.y)-2,4,4); }
  for(const c of B.chests){ g.fillStyle='#ffe9b0'; g.fillRect(tx(c.x)-1,ty(c.y)-1,3,3); }
  for(const e of B.enemies){ if(e.boss&&!e.dead){ g.fillStyle='#ff5d7a'; g.fillRect(tx(e.x)-2,ty(e.y)-2,4,4); } }
  for(const pk of B.picks){ if(pk.dead||!pk.known) continue; g.fillStyle=pk.kind==='shroom'?'#9fe8c8':(pk.kind==='nectar'?'#ffb3cf':'#ffd76a'); g.fillRect(tx(pk.x)-1,ty(pk.y)-1,2,2); }   // v1.8 知っている資源
  if(p.goal){ const gl=p.goal; g.strokeStyle='rgba(255,233,176,0.55)'; g.lineWidth=1; g.setLineDash([2,2]); g.beginPath(); g.moveTo(tx(p.x),ty(p.y)); g.lineTo(tx(gl.x),ty(gl.y)); g.stroke(); g.setLineDash([]);
    g.strokeStyle='#ffe9b0'; g.beginPath(); g.arc(tx(gl.x),ty(gl.y),3.5+Math.sin(performance.now()*0.006),0,TAU); g.stroke(); }   // v1.8 目当て
  if(B.event){ const c=(EVENT_DEF[B.event.kind]&&EVENT_DEF[B.event.kind].col)||'#fff'; g.fillStyle=c; g.globalAlpha=0.6+0.4*Math.sin(performance.now()*0.008); g.beginPath(); g.arc(tx(B.event.x),ty(B.event.y),3,0,TAU); g.fill(); g.globalAlpha=0.9; }   // v1.8 光の柱
  for(const hh of (B.heroes||[p])){ g.fillStyle=hh.out?'#c98cff':((typeof HEROES!=='undefined'&&HEROES[hh.id])?HEROES[hh.id].col:'#fff'); g.beginPath(); g.arc(tx(hh.x),ty(hh.y),2.2,0,TAU); g.fill(); }   // v3.0 全員の位置
  g.strokeStyle='rgba(255,255,255,0.35)'; g.lineWidth=1; g.strokeRect(tx(G.cam.x-W/2),ty(G.cam.y-H/2),W/MAP_T*sc,H/MAP_T*sc);
  g.strokeStyle='rgba(201,140,255,0.6)'; g.strokeRect(x0-3,y0-3,mw+6,mh+6);
  if(G.map.seen && G.map.passN){ g.font='bold 9px '+FONT; g.fillStyle='rgba(220,225,255,0.85)'; g.textAlign='right'; g.textBaseline='bottom'; g.fillText('探索 '+Math.round(100*G.map.seenN/G.map.passN)+'%', x0+mw, y0-4); }   // v2.4 探索率
  g.restore();
}
