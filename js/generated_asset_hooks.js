'use strict';
/* generated_asset_hooks.js — 生成アセット(assets/generated/)を地図チップと VFX に重ねる。
   v7.2 で読める形に書き直し、三つ直した:
   ★(1) 局所のハッシュ関数を `H` と名付けていたので、画面の高さ `H` を覆い隠していた。
        同じ関数の中で `G.cam.y-H/2-p` と書いていたため `H/2` が NaN になり、
        タイルのループが**一周もしていなかった**(実測: 戦闘129フレームで生成画像 0枚)。
        ハッシュは `hsh` に改名
   ★(2) VFX の割当先のうち slime/splash/curse/darkburst/nova/burst の6種は、
        ゲームが一度も出さない fx 名だった。実在する種類へ付け替えた
   ★(3) beam(絶頂照射触手の光条)・flash(ゲイザーの閃光)・denbeam(巣窟の光線)・chain は
        **線や扇の形**をしている。中心に正方形の絵を貼ると形が合わないので外した
        (しかも beam には聖なる斬撃の絵が当たっていた——魔物側の光条なのに)。
        残した種類も、寿命に合わせて薄れていくようにし、大きさに上限を付けた */
(function(){
  if(!window.Game4Assets) return;
  const S=64;                                   /* 生成アトラスの一コマ(px) */
  const hsh=(x,y,s)=>{ const n=Math.sin(x*12.9898+y*78.233+(s||0)*37.719)*43758.5453123; return n-Math.floor(n); };
  const cell=(g,key,cols,rows,n,x,y,a)=>{
    const m=Game4Assets.get(key); if(!m) return false;
    const tot=cols*rows; n=((n%tot)+tot)%tot;
    const T=MAP_T, sx=(n%cols)*S, sy=Math.floor(n/cols)*S;
    g.save(); g.globalAlpha*=a; g.drawImage(m,sx,sy,S,S,x-T/2,y-T/2,T,T); g.restore();
    return true;
  };
  const isMire=(i,j)=>inMap(i,j)&&typeof mireAt==='function'&&!!mireAt(tileCX(i),tileCY(j));
  const nearMire=(i,j)=>isMire(i+1,j)||isMire(i-1,j)||isMire(i,j+1)||isMire(i,j-1);
  const edgeMask=(i,j)=>(isMire(i,j-1)?1:0)|(isMire(i+1,j)?2:0)|(isMire(i,j+1)?4:0)|(isMire(i-1,j)?8:0);

  /* ★v7.2 地図チップはチャンクを焼く時に一度だけ重ねる(js/map.js の CHUNK_DECOR)。
     以前は drawTiles を包んで毎フレーム全タイルに drawImage していた */
  const decor=(g,x0,y0,x1,y1,i0,j0,i1,j1)=>{
    if(!Game4Assets.ready) return;
    if(typeof gfxLv==='function'&&gfxLv()===0) return;
    for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){
      if(!inMap(i,j)||!passIJ(i,j,false)) continue;
      const x=tileCX(i), y=tileCY(j), r=hsh(i,j,41);
      if(isMire(i,j)){
        const q=edgeMask(i,j);
        if(q!==15&&Game4Assets.has('atlas.mire_edge')) cell(g,'atlas.mire_edge',8,2,q,x,y,.56);
        else cell(g,'atlas.mire',3,2,Math.floor(r*6),x,y,.5);
      }else if(nearMire(i,j)&&Game4Assets.has('atlas.wet')) cell(g,'atlas.wet',4,2,Math.floor(r*8),x,y,.3);
      else if(r>.94&&Game4Assets.has('atlas.moon')) cell(g,'atlas.moon',4,2,Math.floor(hsh(i,j,42)*8),x,y,.18);
      else if(Game4Assets.has('atlas.normal')) cell(g,'atlas.normal',4,2,Math.floor(r*8),x,y,.24);
    }
  };
  if(typeof CHUNK_DECOR!=='undefined') CHUNK_DECOR.push(decor);

  /* fx の種類 → 重ねる絵。★点で起きる(中心と半径を持つ)ものだけ */
  const FX={
    bolt:'vfx.projectile_trail',                 /* ルミナの光弾の着弾 */
    darkslash:'vfx.curse_cloud', darkring:'vfx.curse_cloud', coregas:'vfx.curse_cloud',
    mireburst:'vfx.mire_ripple', evap:'vfx.mire_ripple',
    hugdrop:'vfx.slime_splash',
    coreslam:'vfx.impact_flash', iceshatter:'vfx.impact_flash', brand:'vfx.impact_flash',
    dryburst:'vfx.purification_pulse', icering:'vfx.purification_pulse',
  };
  if(typeof drawFx==='function'){
    const base=drawFx;
    drawFx=function(g,f){
      base(g,f);
      if(!f||!Game4Assets.ready) return;
      if(typeof gfxLv==='function'&&gfxLv()===0) return;
      const key=FX[f.kind||'']; const m=key&&Game4Assets.get(key); if(!m) return;
      const life=(f.life>0)?Math.max(0,Math.min(1,f.t/f.life)):0.5;
      const z=Math.min(360,Math.max(12,f.r||24)*3)*(0.85+0.25*life), h=z*.75;
      g.save(); g.globalAlpha*=.68*(1-life*life); g.drawImage(m,f.x-z/2,f.y-h/2,z,h); g.restore();
    };
  }
  window.Game4GeneratedAssetHooks={version:'1.4.0',strategy:'map-grid-aligned-atlas',mapTile:MAP_T,sourceTile:S};
})();
