'use strict';
/* Auto-wires generated assets into existing map/VFX render paths.
   Keys are driven by assets/generated/manifest.json. */
(function(){
  if(!window.Game4Assets) return;

  function drawTile(g,key,x,y,step,alpha){
    return Game4Assets.draw(g,key,x-step/2,y-step/2,step,step,alpha);
  }
  function drawFxAsset(g,key,x,y,size,alpha){
    const h=size*.75;
    return Game4Assets.draw(g,key,x-size/2,y-h/2,size,h,alpha);
  }

  if(typeof drawTiles==='function'){
    const base=drawTiles;
    drawTiles=function(g){
      base(g);
      if(!G||!G.cam||!Game4Assets.ready) return;
      const step=64;
      const x0=Math.floor((G.cam.x-W/2-96)/step)*step+step/2;
      const y0=Math.floor((G.cam.y-H/2-96)/step)*step+step/2;
      const x1=G.cam.x+W/2+96;
      const y1=G.cam.y+H/2+96;
      for(let y=y0;y<=y1;y+=step){
        for(let x=x0;x<=x1;x+=step){
          if(typeof passAt==='function'&&!passAt(x,y,false)) continue;
          const inMire=typeof mireAt==='function'&&mireAt(x,y);
          if(inMire){
            drawTile(g,'tile.mire',x,y,step,.82);
          }else{
            drawTile(g,'tile.moonstone',x,y,step,.68);
          }
        }
      }
    };
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
      drawFxAsset(g,key,f.x,f.y,r*3.6,.86);
    };
  }

  window.Game4GeneratedAssetHooks={
    version:'1.1.0',
    tileKeys:['tile.moonstone','tile.mire'],
    vfxKeys:Object.values(fxMap)
  };
})();
