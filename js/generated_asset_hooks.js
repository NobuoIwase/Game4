'use strict';
/* Generated asset hooks v1.2
   Visibility-first tile variation. Terrain semantics preserved:
   - normal floors: normal atlas, rare moonlit variant only
   - near mire: wet atlas
   - mire: mire/mire-edge atlas selected from adjacency
   - VFX remain image overlays
*/
(function(){
  if(!window.Game4Assets) return;

  const CELL=64;
  function h2(x,y,s=0){
    const n=Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453123;
    return n-Math.floor(n);
  }
  function atlasDraw(g,key,cols,rows,index,x,y,alpha){
    const img=Game4Assets.get(key);
    if(!img) return false;
    index=((index%(cols*rows))+(cols*rows))%(cols*rows);
    const sx=(index%cols)*CELL, sy=Math.floor(index/cols)*CELL;
    g.save();
    g.globalAlpha*=alpha;
    g.drawImage(img,sx,sy,CELL,CELL,x-CELL/2,y-CELL/2,CELL,CELL);
    g.restore();
    return true;
  }
  function mire(x,y){
    return typeof mireAt==='function' && !!mireAt(x,y);
  }
  function nearMire(x,y){
    return mire(x+CELL,y)||mire(x-CELL,y)||mire(x,y+CELL)||mire(x,y-CELL);
  }
  function mireMask(x,y){
    let m=0;
    if(mire(x,y-CELL)) m|=1;
    if(mire(x+CELL,y)) m|=2;
    if(mire(x,y+CELL)) m|=4;
    if(mire(x-CELL,y)) m|=8;
    return m;
  }
  function drawTerrainTile(g,x,y){
    const r=h2(x,y,41);
    if(mire(x,y)){
      const mask=mireMask(x,y);
      if(mask!==15 && Game4Assets.has('atlas.mire_edge')){
        return atlasDraw(g,'atlas.mire_edge',8,2,mask,x,y,.68);
      }
      return atlasDraw(g,'atlas.mire',3,2,Math.floor(r*6),x,y,.64);
    }
    if(nearMire(x,y) && Game4Assets.has('atlas.wet')){
      return atlasDraw(g,'atlas.wet',4,2,Math.floor(r*8),x,y,.42);
    }
    // Moonlit variant is decorative, not a terrain replacement.
    if(r>.90 && Game4Assets.has('atlas.moon')){
      return atlasDraw(g,'atlas.moon',4,2,Math.floor(h2(x,y,42)*8),x,y,.28);
    }
    if(Game4Assets.has('atlas.normal')){
      return atlasDraw(g,'atlas.normal',4,2,Math.floor(r*8),x,y,.34);
    }
    return false;
  }

  if(typeof drawTiles==='function'){
    const base=drawTiles;
    drawTiles=function(g){
      base(g);
      if(!G||!G.cam||!Game4Assets.ready) return;
      const x0=Math.floor((G.cam.x-W/2-96)/CELL)*CELL+CELL/2;
      const y0=Math.floor((G.cam.y-H/2-96)/CELL)*CELL+CELL/2;
      const x1=G.cam.x+W/2+96, y1=G.cam.y+H/2+96;
      for(let y=y0;y<=y1;y+=CELL){
        for(let x=x0;x<=x1;x+=CELL){
          if(typeof passAt==='function'&&!passAt(x,y,false)) continue;
          drawTerrainTile(g,x,y);
        }
      }
    };
  }

  function drawFxAsset(g,key,x,y,size,alpha){
    const img=Game4Assets.get(key);
    if(!img) return false;
    const hh=size*.75;
    g.save();
    g.globalAlpha*=alpha;
    g.drawImage(img,x-size/2,y-hh/2,size,hh);
    g.restore();
    return true;
  }
  const fxMap={
    bolt:'vfx.projectile_trail',
    beam:'vfx.holy_slash',
    denbeam:'vfx.moon_burst',
    mireburst:'vfx.mire_ripple',
    slime:'vfx.slime_splash',
    splash:'vfx.slime_splash',
    darkslash:'vfx.curse_cloud',
    curse:'vfx.curse_cloud',
    darkburst:'vfx.curse_cloud',
    nova:'vfx.purification_pulse',
    burst:'vfx.impact_flash'
  };
  if(typeof drawFx==='function'){
    const base=drawFx;
    drawFx=function(g,f){
      base(g,f);
      if(!f||!Game4Assets.ready) return;
      const key=fxMap[f.kind||''];
      if(!key||!Game4Assets.has(key)) return;
      const r=Math.max(12,f.r||24);
      drawFxAsset(g,key,f.x,f.y,r*3.15,.72);
    };
  }

  window.Game4GeneratedAssetHooks={
    version:'1.2.0',
    strategy:'visibility-first-atlas',
    atlases:['atlas.normal','atlas.moon','atlas.wet','atlas.mire','atlas.mire_edge'],
    vfxKeys:Object.values(fxMap)
  };
})();
