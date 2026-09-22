'use strict';
/* Generated asset loader.
   Reads assets/generated/manifest.json and preloads every image for runtime lookup. */
(function(){
  const api={
    version:'1.0.0',
    ready:false,
    manifest:{version:1,assets:{}},
    images:new Map(),
    async load(){
      try{
        const res=await fetch('assets/generated/manifest.json?v=1',{cache:'no-store'});
        if(!res.ok) throw new Error('manifest '+res.status);
        this.manifest=await res.json();
        const entries=Object.entries(this.manifest.assets||{});
        await Promise.all(entries.map(([key,meta])=>new Promise(resolve=>{
          const img=new Image();
          img.decoding='async';
          img.onload=()=>{this.images.set(key,img);resolve();};
          img.onerror=()=>{console.warn('[Game4Assets] failed',key,meta.src);resolve();};
          img.src=meta.src;
        })));
      }catch(err){
        console.warn('[Game4Assets] manifest unavailable',err);
      }
      this.ready=true;
      return this;
    },
    get(key){ return this.images.get(key)||null; },
    has(key){ return this.images.has(key); },
    meta(key){ return (this.manifest.assets||{})[key]||null; },
    draw(g,key,x,y,w,h,alpha=1){
      const img=this.get(key); if(!img) return false;
      g.save(); g.globalAlpha*=alpha; g.drawImage(img,x,y,w,h); g.restore();
      return true;
    }
  };
  window.Game4Assets=api;
})();
