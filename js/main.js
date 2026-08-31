'use strict';
/* ============================================================
   main.js — 起動 / メインループ
============================================================ */
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
  const speedy=['battle','levelup','captured','survived'].includes(G.mode) && G.B;
  const steps=speedy ? TS*(G.spd||1) : 1;
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
    const p=G.B.hero;
    const k2=Math.min(1,dt*5*steps);
    G.cam.x+=(p.x-G.cam.x)*k2; G.cam.y+=(p.y-G.cam.y)*k2;
  }
  UI.tickBattleBar();
  draw();
}
UI.show('home');
requestAnimationFrame(frame);
