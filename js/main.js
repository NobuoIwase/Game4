'use strict';
/* main.js — 起動。quality_patch.js を確実に読み込んでからゲームを開始する */
(function bootGame4(){
  function load(src){
    return new Promise(resolve=>{
      const s=document.createElement('script');
      s.src=src;
      s.async=false;
      s.onload=resolve;
      s.onerror=()=>{ console.warn('[Game4] failed to load '+src); resolve(); };
      document.head.appendChild(s);
    });
  }
  load('js/quality_patch.js?v=14')
    .then(()=>load('js/generated_assets.js?v=10'))
    .then(()=>window.Game4Assets ? Game4Assets.load() : null)
    .then(()=>load('js/visual_pack.js?v=20'))
    .then(()=>load('js/generated_asset_hooks.js?v=10'))
    .then(startGame4);
})();
function startGame4(){
loadMeta();
UI.init();
G.spd=1;

const muteBtn=$('mute');
function syncMute(){ muteBtn.textContent = muted?'🔇':'🔊'; }
muteBtn.addEventListener('click',()=>{
  muted=!muted;
  try{ localStorage.setItem('luna_mute',muted?'1':'0'); }catch(e){}
  if(muted){ bgmStop(); }
  else{ initAudio(); bgmStart(G.mode==='home'?'home':'battle'); }
  syncMute();
});
syncMute();
document.addEventListener('pointerdown',()=>initAudio(),{once:true});

let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  let rdt=(now-last)/1000; last=now;
  if(rdt>0.1) rdt=0.1;
  if(rdt>0) G.fps=G.fps*0.95+(1/rdt)*0.05;
  const dt=Math.min(rdt,0.05);
  const paused=UI.advOpen();
  const speedy=!paused && ['battle','levelup','captured','survived'].includes(G.mode) && G.B;
  const steps=paused ? 0 : (speedy ? TS*(G.spd||1) : 1);
  if(paused){ UI.tickAdv(rdt); G.shake=Math.max(0,G.shake-dt*14); }
  for(let k=0;k<steps;k++){
    switch(G.mode){
      case 'home':     lobbyTick(dt); break;
      case 'battle':   battleTick(dt); break;
      case 'levelup':  lvTick(dt); break;
      case 'captured': capturedTick(dt); break;
      case 'survived': survivedTick(dt); break;
    }
    fxTick(dt);
    if(!G.B && speedy) break;
  }
  if(G.B){
    const hs=(G.B.heroes||[G.B.hero]).filter(h=>!h.out||h.captive); const p=G.B.hero;
    const cx=hs.length?hs.reduce((a,h)=>a+h.x,0)/hs.length:p.x, cy=hs.length?hs.reduce((a,h)=>a+h.y,0)/hs.length:p.y;
    const k2=Math.min(1,dt*5*steps);
    G.cam.x+=(cx-G.cam.x)*k2; G.cam.y+=(cy-G.cam.y)*k2;
    if(typeof MAP_HW!=='undefined'){ G.cam.x=clamp(G.cam.x,-MAP_HW+W/2,MAP_HW-W/2); G.cam.y=clamp(G.cam.y,-MAP_HH+H/2,MAP_HH-H/2); }
  }
  UI.tickBattleBar();
  draw();
}
UI.show('home');
requestAnimationFrame(frame);
}
