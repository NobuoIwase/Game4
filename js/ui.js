'use strict';
const ADV_CPS=26;   // v2.1 物語の文字送り(文字/秒)
/* ============================================================
   ui.js — DOMスクリーンと戦闘バー
============================================================ */
const $=id=>document.getElementById(id);

const UI={
  root:null, selForm:'scatter', retreatArm:0,

  init(){
    this.root=$('screens');
    this.root.addEventListener('click',e=>{
      const el=e.target.closest('[data-act]');
      if(!el) return;
      initAudio();
      this.action(el.dataset.act, el.dataset.arg);
    });
    $('btnAuto').addEventListener('click',()=>{
      if(!G.B) return;
      G.B.auto=!G.B.auto;
      META.settings.autoplay=G.B.auto; saveMeta();
      this.syncBattleButtons();
    });
    $('btnSpd').addEventListener('click',()=>{
      G.spd=(G.spd||1)%3+1;
      $('btnSpd').textContent='▶ ×'+G.spd;
    });
    $('btnRetreat').addEventListener('click',()=>{
      if(!G.B||G.mode!=='battle') return;
      const now=performance.now();
      if(now-this.retreatArm<2000){ endBattle('retreat'); }
      else{ this.retreatArm=now; $('btnRetreat').textContent='撤退する?'; setTimeout(()=>{ $('btnRetreat').textContent='撤退'; },2000); }
    });
    const onCard=e=>{
      const el=e.target.closest('.hcard,.gchip');
      if(!el) return;
      initAudio();
      playCard(el.dataset.id, this.selForm);
      this.refreshHand();
    };
    $('handrow').addEventListener('click',onCard);
    $('guestrow').addEventListener('click',onCard);
    $('formrow').addEventListener('click',e=>{
      const el=e.target.closest('.fchip');
      if(!el) return;
      this.selForm=el.dataset.id;
      this.refreshFormRow(); this.refreshHand();
    });
    // 夜側のアイテム: チップで選び、画面をタップして置く
    $('itemrow').addEventListener('click',e=>{
      const el=e.target.closest('.ichip');
      if(!el) return;
      initAudio();
      this.armItem(this.armed===el.dataset.id?null:el.dataset.id);
    });
    cv.addEventListener('pointermove',e=>{ G.mouse=this.worldPos(e); });
    cv.addEventListener('pointerdown',e=>{
      if(!this.armed || G.mode!=='battle') return;
      const w=this.worldPos(e);
      G.mouse=w;
      if(placeItem(this.armed,w.x,w.y)){ this.armItem(null); }
      e.preventDefault();
    });
    window.addEventListener('keydown',e=>{ if(e.key==='Escape' && this.armed) this.armItem(null); });
  },
  worldPos(e){
    const r=cv.getBoundingClientRect();
    const sx=(e.clientX-r.left)/r.width*W, sy=(e.clientY-r.top)/r.height*H;
    return {x:sx-W/2+G.cam.x, y:sy-H/2+G.cam.y};
  },
  armItem(id){
    this.armed=id||null; G.armItem=this.armed;
    cv.classList.toggle('arm',!!this.armed);
    this.refreshItems();
  },

  action(act,arg){
    switch(act){
      case 'go': this.show(arg); break;
      case 'battle':
        applyDeckMode();   // v2.0 おまかせ/ランダム編成なら出撃直前に組む
        if(!META.deck.length){ S.deny(); return; }
        this.hideAll(); startBattle(); break;
      case 'randomBattle':   // v2.0 ランダム編成で出撃(設定は変えない)
        META.deck=buildDeck('random'); saveMeta(); this.hideAll(); startBattle(); break;
      case 'deckMode':{
        const modes=['manual','auto','random'], cur=META.settings.deckMode||'manual';
        META.settings.deckMode=modes[(modes.indexOf(cur)+1)%modes.length]; saveMeta(); S.pick();
        this.show(G.screen==='deck'?'deck':'home'); break; }
      case 'deckAdd':{
        const t=tierOf(arg);
        const n=META.deck.filter(id=>tierOf(id)===t).length;
        if(n<TIER_CAP[t] && !META.deck.includes(arg)){ META.deck.push(arg); saveMeta(); S.pick(); }
        else S.deny();
        this.show('deck'); break; }
      case 'deckRem':
        META.deck=META.deck.filter(x=>x!==arg); saveMeta();
        this.show('deck'); break;
      case 'unlock':{
        const m=MONSTERS[arg];
        if(META.essence>=m.unlock && !(META.cards[arg]&&META.cards[arg].owned)){
          META.essence-=m.unlock;
          META.cards[arg]={owned:true,lv:1};
          saveMeta(); S.buy();
        }else S.deny();
        this.show('lab'); break;
      }
      case 'upcard':{
        const c=META.cards[arg];
        if(!c) break;
        const cost=cardUpCost(arg,c.lv);
        if(c.lv<CARD_LV_MAX && META.essence>=cost){
          META.essence-=cost; c.lv++;
          saveMeta(); S.buy();
        }else S.deny();
        this.show('lab'); break;
      }
      case 'fuse':{
        const m=MONSTERS[arg];
        const cost=MONSTERS[arg].fuseCost;
        const ok=m.fusion.every(f=>META.cards[f]&&META.cards[f].owned&&META.cards[f].lv>=3);
        if(ok && META.essence>=cost && !(META.cards[arg]&&META.cards[arg].owned)){
          META.essence-=cost;
          META.cards[arg]={owned:true,lv:1};
          saveMeta(); S.buy();
          setBanner('融合成立!', m.name+' が生まれた', '#b46cff');
        }else S.deny();
        this.show('lab'); break;
      }
      case 'unitem':{
        const it=NIGHT_ITEMS[arg];
        if(it && !META.nightItems[arg] && META.essence>=it.unlock){
          META.essence-=it.unlock; META.nightItems[arg]=true;
          saveMeta(); S.buy();
        }else S.deny();
        this.show('lab'); break;
      }
      case 'codex':
        this.codexSel=arg; this.show('codex'); break;
      case 'unform':{
        const f=FORMATIONS[arg];
        if(!META.formations.includes(arg) && META.essence>=f.unlock){
          META.essence-=f.unlock;
          META.formations.push(arg);
          saveMeta(); S.buy();
        }else S.deny();
        this.show('lab'); break;
      }
      case 'altar':{
        const a=ALTAR.find(x=>x.id===arg);
        const lv=altarLv(arg);
        if(lv<a.max && META.orbs>=a.costs[lv]){
          META.orbs-=a.costs[lv];
          META.altar[arg]=lv+1;
          saveMeta(); S.altar();
        }else S.deny();
        this.show('altar'); break;
      }
      case 'shave':{
        const r=luminaRank(arg);
        const cost=shaveCost(r);
        if(r>0 && META.orbs>=cost){
          META.orbs-=cost;
          META.lumina.upg[arg]=r-1;
          saveMeta(); S.altar();
          setBanner('加護を削いだ', LUMINA_UPG[arg].name+' '+(r-1>0?genNum(r-1):'消滅'), '#ffd76a');
        }else S.deny();
        this.show('altar'); break;
      }
      case 'gfxAutoToggle':
        META.settings.gfxAuto=!(META.settings.gfxAuto!==false); saveMeta();
        this.show('home'); break;
      case 'gfxToggle':
        META.settings.gfx=(META.settings.gfx||'hd')==='hd'?'pixel':'hd'; saveMeta();
        this.show('home'); break;
      case 'autoDefault':
        META.settings.autoplay=!META.settings.autoplay; saveMeta();
        this.show('home'); break;
      case 'wipe':
        if(this._wipeArm && performance.now()-this._wipeArm<3000){ wipeMeta(); this._wipeArm=0; this.show('home'); }
        else{ this._wipeArm=performance.now(); this.show('home'); }
        break;
      case 'again': applyDeckMode(); this.hideAll(); startBattle(); break;
    }
    this.refreshRes();
  },

  hideAll(){ this.root.innerHTML=''; G.screen=''; },
  /* ===== v2.1 ADV(立ち絵+名前+台詞/地の文)。1行ずつタップで送る。表示中はゲーム時間が止まる(main.js が UI.advOpen() を見る) =====
     lines: 文字列でも {s,t,f} でも可(storyNorm)。opt.onEnd: 閉じた時に呼ぶ */
  adv:{ open:false, lines:[], idx:0, typeT:0, shown:0, dwell:0, full:'', onEnd:null },
  advOpen(){ return !!(this.adv&&this.adv.open); },
  showStory(lines,opt){
    opt=opt||{}; const L=storyNorm(lines);
    if(!L.length){ if(opt.onEnd) opt.onEnd(); return; }
    const A=this.adv, box=$('adv'); if(!box){ if(opt.onEnd) opt.onEnd(); return; }
    if(A.open && A.onEnd){ const f=A.onEnd; A.onEnd=null; f(); }   // 前の物語が開いたままなら、その終了処理だけ済ませて差し替える
    A.lines=L; A.idx=0; A.open=true; A.onEnd=opt.onEnd||null;
    if(!this._advBound){ this._advBound=true;
      box.addEventListener('click',e=>{ if(e.target.closest('#advCtl')) return; initAudio(); this.advNext(); });
      $('advSkip').addEventListener('click',e=>{ e.stopPropagation(); this.hideStory(); });
      $('advAuto').addEventListener('click',e=>{ e.stopPropagation(); META.settings.advAuto=!(META.settings.advAuto!==false); saveMeta(); this.advSyncAuto(); });
      document.addEventListener('keydown',e=>{ if(!this.adv.open) return; if(e.code==='Space'||e.code==='Enter'||e.code==='ArrowRight'){ e.preventDefault(); this.advNext(); } else if(e.code==='Escape'){ this.hideStory(); } });
      const img=$('advImg'); img.addEventListener('error',()=>{ if(img.dataset.fb!=='1'){ img.dataset.fb='1'; img.src='assets/cg/defeat.png'; } else img.style.visibility='hidden'; }); img.src='assets/ref/lumina_novelai.png';
    }
    this.advSyncAuto(); box.hidden=false; this.advRender();
  },
  advSyncAuto(){ const b=$('advAuto'); if(b) b.textContent='自動送り: '+((META.settings.advAuto!==false)?'ON':'OFF'); },
  advRender(){
    const A=this.adv, ln=A.lines[A.idx]; if(!ln) return;
    const NAMES={lumina:'ルミナ', town:'街の人', voice:'声', n:''};
    const nm=$('advName'); nm.textContent=(NAMES[ln.s]!==undefined)?NAMES[ln.s]:ln.s; nm.className=ln.s;
    const st=$('advStand'); st.className=(ln.s==='lumina'?'speak':'dim')+(ln.f?' f-'+ln.f:'');
    const tx=$('advText'); tx.className=ln.s; tx.textContent='';
    A.typeT=0; A.shown=0; A.dwell=0; A.full=(ln.s==='lumina'||ln.s==='town'||ln.s==='voice')?'「'+ln.t+'」':ln.t;
    $('advHint').textContent=(A.idx>=A.lines.length-1)?'▼ タップで閉じる':'▼ タップで次へ';
  },
  tickAdv(rdt){
    const A=this.adv; if(!A.open) return; const full=A.full||'';
    if(A.shown<full.length){ A.typeT+=rdt; const n=Math.min(full.length,Math.floor(A.typeT*ADV_CPS)); if(n!==A.shown){ A.shown=n; $('advText').textContent=full.slice(0,n); } }
    else if(META.settings.advAuto!==false){ A.dwell+=rdt; if(A.dwell>=1.8+full.length*0.09) this.advNext(); }
  },
  advNext(){
    const A=this.adv; if(!A.open) return; const full=A.full||'';
    if(A.shown<full.length){ A.shown=full.length; $('advText').textContent=full; A.dwell=0; return; }   // 表示途中なら全文を出す
    A.idx++; if(A.idx>=A.lines.length){ this.hideStory(); return; }
    this.advRender();
  },
  hideStory(){
    const A=this.adv, was=A.open; A.open=false;
    const box=$('adv'); if(box) box.hidden=true; const sb=$('storybox'); if(sb) sb.hidden=true;
    if(was && A.onEnd){ const f=A.onEnd; A.onEnd=null; f(); }
  },

  show(name){
    // 同じ画面の再描画(強化ボタン等)ではスクロール位置を保持する
    const sameScreen=G.screen===name;
    const prevScr=this.root.querySelector('.screen');
    const keepScroll=sameScreen&&prevScr?prevScr.scrollTop:0;
    G.screen=name;
    G.mode='home';
    G.B=null;
    this.hideStory();
    $('battlebar').hidden=true;
    $('resbar').hidden=false;
    bgmStart('home');
    this.refreshRes();
    const fn={home:this.htmlHome, deck:this.htmlDeck, lab:this.htmlLab,
      altar:this.htmlAltar, status:this.htmlStatus, codex:this.htmlCodex, story:this.htmlStory}[name];
    this.root.innerHTML='<div class="screen"><div class="inner'+(name==='home'?'':' wide')+'" style="'+(name==='home'?'margin-top:120px;background:rgba(17,15,34,.86)':'')+'">'+fn.call(this)+'</div></div>';
    this.attachIcons();
    if(keepScroll){
      const scr=this.root.querySelector('.screen');
      if(scr) scr.scrollTop=keepScroll;
    }
  },

  attachIcons(){
    for(const holder of this.root.querySelectorAll('[data-icon]')){
      const c=makeIconCanvas(holder.dataset.icon, parseInt(holder.dataset.size||'48',10));
      holder.appendChild(c);
    }
  },

  refreshRes(){
    $('resEss').textContent=Math.floor(META.essence);
    $('resOrb').textContent=Math.floor(META.orbs);
    $('resGen').textContent=genNum(META.gen.idx);
    $('resRot').textContent='第'+curFloor().depth+'層 / '+(META.run.day||1)+'日目';
  },

  /* ---------- 各スクリーン ---------- */
  htmlHome(){
    const best=META.best?('最速捕獲 '+fmt(META.best.time)+' (第'+genNum(META.best.gen)+'世代/戦歴'+META.best.battle+')'):'まだ捕獲記録なし';
    const wipeArmed=this._wipeArm && performance.now()-this._wipeArm<3000;
    return `
      <h1>ルミナ・サバイバーズ</h1>
      <div class="sub">v2.1 深淵 — MONSTER DECK × AUTO BATTLE</div>
      <p>あなたは<b>夜側の指揮者</b>。デッキから魔物を差し向け、AIで戦う光の少女<b>「ルミナ」</b>を追い詰める。<br>
      彼女に魔物が倒されるほどあなたのエネルギーとエッセンスは増え、彼女もまた強くなる。</p>
      <div style="text-align:center;color:var(--gold);font-size:12px;margin-bottom:8px">${esc(best)} ・ 通算${META.runs}戦 / 捕獲${META.captures}回</div>
      <div class="menu-grid">
        <button data-act="battle">▶ 出撃 — 第${curFloor().depth}層 ${esc(curFloor().name)}<small>${(META.run.fails||0)>0?'再挑戦(連敗'+META.run.fails+'/'+BAL.RUN_FAILS_RESET+')':(META.run.day||1)+'日目'}${(META.run.hero&&META.run.hero.level>1)?' ・ 彼女はLv'+META.run.hero.level+'を引き継ぐ':''} ・ 編成: ${({manual:'手動',auto:'おまかせ',random:'ランダム'})[META.settings.deckMode||'manual']}</small></button>
        <button class="sub" data-act="randomBattle">🎲 ランダム編成で出撃<small>持っている魔物から無作為に組む</small></button>
        <button class="sub" data-act="deckMode">🧭 編成モード: ${({manual:'手動',auto:'おまかせ(階層に合わせる)',random:'ランダム'})[META.settings.deckMode||'manual']}<small>出撃直前に自動で組み直す</small></button>
        <button class="sub" data-act="go" data-arg="deck">🃏 デッキ編成<small>${META.deck.length}/${DECK_CAP} 枚</small></button>
        <button class="sub" data-act="go" data-arg="lab">✦ 研究所<small>解放・強化・融合・陣形</small></button>
        <button class="sub" data-act="go" data-arg="altar">◉ オーブの祭壇<small>ルミナの初期状態を書き換える</small></button>
        <button class="sub" data-act="go" data-arg="status">👁 観測記録<small>称号・総評・自己評価</small></button>
        <button class="sub" data-act="go" data-arg="codex">📖 図鑑<small>魔物の解説と、彼女の手記</small></button>
        <button class="sub" data-act="go" data-arg="story">📜 物語<small>彼女がここへ来た理由と、深淵の記録</small></button>
        <button class="sub" data-act="autoDefault">🤖 オート初期値: ${META.settings.autoplay?'ON':'OFF'}<small>戦闘開始時のオート指揮</small></button>
        <button class="sub" data-act="gfxToggle">🎨 絵柄: ${(META.settings.gfx||'hd')==='hd'?'描き込み':'ドット(旧)'}<small>ルミナと魔物の描き方を切り替え</small></button>
        <button class="sub" data-act="gfxAutoToggle">⚙ 自動品質: ${META.settings.gfxAuto!==false?'ON':'OFF'}<small>fpsが落ちたら装飾を自動で省く</small></button>
      </div>
      <details style="margin-top:6px"><summary style="font-size:11px;color:var(--dim);cursor:pointer">あそびかた / ルール</summary>
      <p style="font-size:11.5px">
      ・戦闘中、ENを払ってカードの魔物を陣形つきで召喚。ルミナに倒されたぶんENとエッセンスが還元される。<br>
      ・<b>夜側のアイテム</b>(媚薬の霧壺など)はカード列の下のチップで選び、<b>画面をタップした場所に置く</b>。オート指揮中もあなたの手で罠を仕掛けられる。<br>
      ・拘束役は接触すると<b>四肢に絡みつく</b>。ルミナは移動と攻撃でもがいて引き剥がすが、<b>スタミナ</b>を消耗する。<br>
      ・スタミナが薄い時に拘束すると<b>押し倒し</b>。<b>HPかスタミナを削りきれば敗北=捕獲</b>。与ダメ・異常・捕獲で<b>オーブ</b>獲得。<br>
      ・ルミナの回復ハートは、彼女が<b>燭台を壊した時だけ</b>落ちる。回復させたくなければ燭台の周りで待ち伏せを。<br>
      ・ルミナは倒した魔物の経験で戦闘中レベルアップし、武器を融合させて強くなる。経験は<b>潜行のあいだ</b>持ち越す。<br>
      ・<b>深淵は5階層</b>。一日=一階層。彼女が<b>降り口に着けば次の階層</b>へ(その日は終わり)、捕まれば同じ階層に再挑戦、<b>二連敗で入口へ戻り経験はリセット</b>(手記だけ残る)。最深部の<b>魔核</b>を討たれると彼女の目的は果たされ、深淵は組み替わる。<br>
      ・深いほど夜側の<b>EN上限と回復</b>が増え、魔物は硬くなる。階層ごとに得意な種がいる(デッキ編成の画面に表示)。
      ・世代が変わると彼女の経験はリセット。ただし<b>祭壇の書き換え</b>は永続する。<br>
      ・護りが高く、序盤はダメージがほぼ通らない。エッセンスで魔物を育て、オーブで彼女を崩すこと。</p></details>
      <div class="note" style="text-align:center">
        <span data-act="wipe" style="cursor:pointer;text-decoration:underline">${wipeArmed?'⚠ もう一度クリックで全データ削除':'データ初期化'}</span>
        ・ ?ts=N で速度N倍(デバッグ)
      </div>`;
  },

  /* v2.0 物語: 序章と、到達した階層の導入。結末・リセットの記録 */
  htmlStory(){
    const deepest=Math.max(1,META.run.deepest||1);
    const block=(title,lines,color)=>lines&&lines.length?`<h2 style="font-size:14px;color:${color||'var(--vio)'}">${esc(title)}</h2><div class="note storytext">${lines.map(storyLineHtml).join('')}</div>`:'';   // v2.1 話者付き
    let floorsHtml='';
    for(let k=0;k<FLOORS.length;k++){ const F=FLOORS[k], sf=storyFloor(k+1); if(k+1<=deepest) floorsHtml+=block('第'+F.depth+'層 '+F.name,sf.intro,F.col); else floorsHtml+=`<h2 style="font-size:14px;color:var(--dim)">第${F.depth}層 ${esc(F.name)} <span style="font-size:11px">— まだ辿り着いていない</span></h2>`; }
    return `
      <h2>📜 物語</h2>
      <div class="note">いまは<b>第${genNum(META.gen.idx)}世代</b>、第${curFloor().depth}層。最深到達 第${deepest}層。魔核を討った回数 ${META.run.clears||0}。二連敗の朝、深淵の霧は彼女の記憶を奪う——手記だけが残る。</div>
      ${STORY.prologue.length?block('序章',STORY.prologue,'var(--gold)'):'<div class="note">序章の文はまだ届いていない(執筆中)。</div>'}
      ${floorsHtml}
      ${(META.run.clears||0)>0?block('結末(魔核を討った日)',STORY.ending,'var(--gold)'):''}
      <div class="row"><button data-act="go" data-arg="home">← もどる</button></div>`;
  },
  htmlDeck(){
    // 階級ごとに枠がある: 雑魚2 / 中型2 / 大型1 / ボス1(大型は精鋭・双璧のみ、ボスは単騎)
    const card=(id,sel)=>{
      const m=MONSTERS[id], lv=(META.cards[id]&&META.cards[id].lv)||1;
      return `<div class="mcard ${sel?'sel':''} t-${tierOf(id)}" data-act="${sel?'deckRem':'deckAdd'}" data-arg="${id}" style="cursor:pointer" title="${sel?'クリックで外す':'クリックで追加'}">
        <div class="cost">${cardCost(id,lv)}</div><div class="lv">Lv${lv}</div>
        <div data-icon="${id}" data-size="44"></div>
        <div class="nm">${esc(m.name)}</div>
        <div class="st">${sel?'クリックで外す':esc(m.role)+(m.trait?'<br>'+esc(m.trait):'')}</div></div>`;
    };
    const sections=TIERS.map(t=>{
      const inDeck=META.deck.filter(id=>tierOf(id)===t);
      const pool=Object.keys(MONSTERS).filter(id=>tierOf(id)===t&&META.cards[id]&&META.cards[id].owned&&!META.deck.includes(id));
      const empties=Math.max(0,TIER_CAP[t]-inDeck.length);
      const slots=inDeck.map(id=>card(id,true)).join('')+
        Array.from({length:empties},()=>`<div class="mcard empty"><div class="nm">空き枠</div><div class="st">${esc(TIER_NAMES[t])}を1枚</div></div>`).join('');
      const forms=TIER_FORMS[t]?TIER_FORMS[t].map(f=>esc(FORMATIONS[f].name)).join('/'):'全陣形';
      return `<h2 style="font-size:14px" class="tier-h t-${t}">${esc(TIER_NAMES[t])} <span style="font-size:11px;color:var(--dim)">(${inDeck.length}/${TIER_CAP[t]}) 陣形: ${forms}</span></h2>
        <div class="cards">${slots}${pool.map(id=>card(id,false)).join('')}</div>`;
    }).join('');
    return `
      <h2>🃏 デッキ編成 <span style="font-size:12px;color:var(--dim)">(${META.deck.length}/${DECK_CAP})</span></h2>
      <div class="note">次は<b>第${curFloor().depth}層 ${esc(curFloor().name)}</b>。この階層で硬くなる種(HP×${BAL.FLOOR_AFFINITY}): ${curFloor().affinity.filter(id=>MONSTERS[id]).map(id=>esc(MONSTERS[id].name)).join('・')}。EN: 上限×${curFloor().en.max}・回復×${curFloor().en.regen}
        <span data-act="deckMode" style="cursor:pointer;text-decoration:underline;margin-left:8px">編成モード: ${({manual:'手動',auto:'おまかせ',random:'ランダム'})[META.settings.deckMode||'manual']}</span></div>
      <div class="note">雑魚・中型は全陣形で出せる。大型は<b>精鋭/双璧</b>の少数精鋭のみ、ボスは<b>単騎</b>。戦闘中に彼女が開けた宝箱からは、ランダムな魔物がこちらの手札に加わる(その戦闘限り・枚数制限なし)。</div>
      ${sections}
      <div class="note">陣形は戦闘中に選択します。解放済み: ${META.formations.map(f=>esc(FORMATIONS[f].name)).join(' / ')}</div>
      <div class="row"><button data-act="go" data-arg="home">← もどる</button><button class="gold" data-act="battle">▶ このデッキで出撃</button></div>`;
  },

  htmlLab(){
    const rows=[];
    for(const id in MONSTERS){
      const m=MONSTERS[id], st=META.cards[id];
      if(m.item||m.guardian) continue;
      if(st&&st.owned){
        const atMax=st.lv>=CARD_LV_MAX;
        const cost=atMax?0:cardUpCost(id,st.lv);
        const mult=cardLvMult(st.lv);
        rows.push(`<div class="lrow">
          <div data-icon="${id}" data-size="40"></div>
          <div class="info"><div class="nm">${esc(m.name)} <span class="tierlbl t-${tierOf(id)}">${esc(TIER_NAMES[tierOf(id)])}</span> <span style="color:var(--gold)">Lv${st.lv}</span></div>
          <div class="ds">HP${Math.round(m.hp*mult.hp)} / 攻${Math.round(m.dmg*mult.dmg)} / コスト${cardCost(id,st.lv)} — ${esc(m.desc)}</div></div>
          ${atMax?'<span style="color:var(--gold);font-size:11px">MAX</span>'
            :`<button class="sub" data-act="upcard" data-arg="${id}" ${META.essence<cost?'disabled':''}>強化 ✦${cost}</button>`}
        </div>`);
      }else if(m.unlock>=0 && !m.fusion){
        rows.push(`<div class="lrow" style="opacity:.8">
          <div data-icon="${id}" data-size="40"></div>
          <div class="info"><div class="nm">${esc(m.name)} <span class="tierlbl t-${tierOf(id)}">${esc(TIER_NAMES[tierOf(id)])}</span></div><div class="ds">${esc(m.desc)}</div></div>
          <button class="sub" data-act="unlock" data-arg="${id}" ${META.essence<m.unlock?'disabled':''}>解放 ✦${m.unlock}</button>
        </div>`);
      }
    }
    const fuses=[];
    for(const id of FUSION_IDS){
      const m=MONSTERS[id];
      if(META.cards[id]&&META.cards[id].owned) continue;
      const cost=MONSTERS[id].fuseCost;
      const matsOk=m.fusion.every(f=>META.cards[f]&&META.cards[f].owned&&META.cards[f].lv>=3);
      fuses.push(`<div class="lrow" style="border-color:rgba(220,160,255,.5)">
        <div data-icon="${id}" data-size="40"></div>
        <div class="info"><div class="nm">★ ${esc(m.name)}</div>
        <div class="ds">${m.fusion.map(f=>esc(MONSTERS[f].name)+'Lv3+').join(' × ')} — ${esc(m.desc)}</div></div>
        <button class="sub" data-act="fuse" data-arg="${id}" ${(!matsOk||META.essence<cost)?'disabled':''}>融合 ✦${cost}</button>
      </div>`);
    }
    const forms=Object.keys(FORMATIONS).map(fid=>{
      const f=FORMATIONS[fid], has=META.formations.includes(fid);
      return `<div class="lrow">
        <div class="info"><div class="nm">${esc(f.name)} <span style="color:var(--dim);font-size:10px">×${f.count} / コスト係数${f.factor}</span></div>
        <div class="ds">${esc(f.desc)}</div></div>
        ${has?'<span style="color:var(--green);font-size:11px">解放済</span>'
          :`<button class="sub" data-act="unform" data-arg="${fid}" ${META.essence<f.unlock?'disabled':''}>解放 ✦${f.unlock}</button>`}
      </div>`;
    }).join('');
    const items=Object.keys(NIGHT_ITEMS).map(id=>{
      const it=NIGHT_ITEMS[id], has=!!META.nightItems[id];
      return `<div class="lrow">
        <div class="info"><div class="nm">${it.icon} ${esc(it.name)} <span style="color:var(--dim);font-size:10px">EN${it.cost} / CD${it.cd}s</span></div>
        <div class="ds">${esc(it.desc)}</div></div>
        ${has?'<span style="color:var(--green);font-size:11px">解放済</span>'
          :`<button class="sub" data-act="unitem" data-arg="${id}" ${META.essence<it.unlock?'disabled':''}>解放 ✦${it.unlock}</button>`}
      </div>`;
    }).join('');
    return `
      <h2>✦ 研究所 <span style="font-size:12px;color:var(--gold)">エッセンス ${Math.floor(META.essence)}</span></h2>
      <div class="list">${rows.join('')}</div>
      <h2 style="font-size:14px">融合研究</h2>
      <div class="list">${fuses.join('')||'<p>すべて融合済み。</p>'}</div>
      <h2 style="font-size:14px">陣形(出現方法)</h2>
      <div class="list">${forms}</div>
      <h2 style="font-size:14px">夜側のアイテム <span style="font-size:11px;color:var(--dim);font-weight:normal">(戦闘中に画面をタップして置く)</span></h2>
      <div class="list">${items}</div>
      <div class="row"><button data-act="go" data-arg="home">← もどる</button></div>`;
  },

  htmlAltar(){
    const row=a=>{
      const lv=altarLv(a.id);
      const atMax=lv>=a.max;
      const cost=atMax?0:a.costs[lv];
      const pips='<span class="pips">'+Array.from({length:a.max},(_,i)=>`<i class="${i<lv?'on':''}"></i>`).join('')+'</span>';
      return `<div class="lrow">
        <div class="info"><div class="nm">${esc(a.name)}${pips}</div>
        <div class="ds">${esc(a.desc)} <span style="color:var(--vio)">[${esc(a.fx)}]</span></div></div>
        ${atMax?'<span style="color:var(--vio);font-size:11px">極まった</span>'
          :`<button class="sub" data-act="altar" data-arg="${a.id}" ${META.orbs<cost?'disabled':''}>◉${cost}</button>`}
      </div>`;
    };
    const heroRows=ALTAR.filter(a=>!a.side).map(row).join('');
    const nightRows=ALTAR.filter(a=>a.side==='night').map(row).join('');
    const shaveRows=Object.keys(LUMINA_UPG).map(id=>{
      const r=luminaRank(id);
      const cost=shaveCost(r);
      return `<div class="lrow">
        <div class="info"><div class="nm">${esc(LUMINA_UPG[id].name)} <b style="color:var(--gold)">${r?genNum(r):'—'}</b><span style="color:var(--dim)">/${LUMINA_UPG[id].max}</span></div>
        <div class="ds">${esc(LUMINA_UPG[id].fx)} を彼女は積んでいる</div></div>
        ${r>0?`<button class="sub" data-act="shave" data-arg="${id}" ${META.orbs<cost?'disabled':''}>削ぐ ◉${cost}</button>`
          :'<span style="color:var(--dim);font-size:11px">なし</span>'}
      </div>`;
    }).join('');
    return `
      <h2>◉ オーブの祭壇 <span style="font-size:12px;color:var(--vio)">オーブ ${Math.floor(META.orbs)}</span></h2>
      <p style="font-size:11.5px">攻撃・状態異常・捕獲で得たオーブを捧げる。<b>すべて世代リセット後も残り続ける</b>。</p>
      <h3 style="color:var(--vio)">ルミナの初期状態を書き換える</h3>
      <div class="list">${heroRows}</div>
      <h3 style="color:var(--pink);margin-top:14px">夜側の軍備</h3>
      <div class="list">${nightRows}</div>
      <h3 style="color:var(--gold);margin-top:14px">ルミナの自己強化を削ぐ <span style="font-size:11px;color:var(--dim);font-weight:normal">(彼女がコインで積んだ強化を1段引き剥がす)</span></h3>
      <div class="note" style="margin:2px 0 6px">彼女の貯えコイン: ${Math.floor((META.lumina&&META.lumina.coins)||0)} — 夜明けごとに自動で買い足してくるので、削ぎ続けるか元を断つかはあなた次第。</div>
      <div class="list">${shaveRows}</div>
      <div class="row"><button data-act="go" data-arg="home">← もどる</button></div>`;
  },

  htmlStatus(){
    const preview=newHero();
    const body=fallBody(), mind=fallMind();
    const bodyStg=stageName(body,FALL_BODY_STAGES), mindStg=stageName(mind,FALL_MIND_STAGES);
    const mods=ALTAR.filter(a=>altarLv(a.id)>0).map(a=>esc(a.name)+' '+genNum(altarLv(a.id))).join(' / ')||'なし';
    const titles=heldTitles();
    const honor=titles.filter(t=>t.kind==='honor'), ero=titles.filter(t=>t.kind==='ero');
    const tcard=t=>`<div class="tcard ${t.kind}">
        <div class="tn">${t.kind==='honor'?'📜':'💋'} ${esc(t.name)}${t.stage?`<small>s${t.stage}・${esc(t.line)}</small>`:''}</div>
        <div class="td">${esc(t.desc)}${t.long?'<br><span style="color:var(--dim)">'+esc(t.long)+'</span>':''}</div>
        <div class="tc">取得条件: ${esc(t.condText)}</div></div>`;
    const review=heroReview(), self=heroSelfEval();
    const L=META.life||{}, cb=L.capBy||{};
    const topCap=Object.keys(cb).filter(id=>MONSTERS[id]).sort((a,b)=>cb[b]-cb[a]).slice(0,3)
      .map(id=>esc(MONSTERS[id].name)+' '+cb[id]+'回').join(' / ')||'まだ無い';
    const ailBy=L.ailBy||{};
    const ailTxt=Object.keys(ailBy).filter(k=>AILMENTS[k]).map(k=>esc(AILMENTS[k].name)+' '+ailBy[k]).join(' / ')||'—';
    return `
      <h2>👁 観測記録 — ルミナ</h2>
      <div class="stcard"><h3>称号</h3>
        ${honor.map(tcard).join('')}
        ${ero.length?`<div class="divider">——立派な響きの、その裏の記録——</div>${ero.map(tcard).join('')}`
          :'<div class="note">裏の記録は、まだ無い。称号は変化より追加で増え、条件は厳しい。</div>'}
      </div>
      <div class="stcard"><h3>人物</h3>
        <div class="kv">
          <div>名前 <b>ルミナ</b>(成人・光の守り手)</div>
          <div>世代 <b>第${genNum(META.gen.idx)}</b></div>
          <div>潜行の日数 <b>${META.gen.battle}</b> <span>(二連敗か魔核討伐でリセット)</span></div>
        </div>
        <div class="kv" style="margin-top:4px">
          <div>HP <b>${preview.maxHp}</b></div>
          <div>スタミナ <b>${preview.staminaMax}</b></div>
          <div>護り <b>${preview.armor}</b></div>
          <div>回復 <b>${preview.regen.toFixed(2)}/s</b></div>
          <div>基礎速度 <b>${Math.round(preview.baseSpeed)}</b></div>
          <div>初期敏感 <b>${Math.round(preview.sensit)}%</b></div>
        </div>
        <div class="note">次の戦闘開始時の実効値(世代内継承+書き換え適用後)。</div>
      </div>
      <div class="stcard"><h3>書き換え(祭壇・永続)</h3>
        <div class="kv"><div>${mods}</div></div>
      </div>
      <div class="stcard"><h3>ルミナの自己強化 <span style="color:var(--dim);font-weight:normal">(彼女が夜明けに買う)</span></h3>
        <div class="kv">
          ${Object.keys(LUMINA_UPG).map(id=>{
            const r=luminaRank(id);
            return `<div>${esc(LUMINA_UPG[id].name)} <b>${r?genNum(r):'—'}</b><span>/${LUMINA_UPG[id].max}</span></div>`;
          }).join('')}
        </div>
        <div class="note">貯えたコイン: ${Math.floor((META.lumina&&META.lumina.coins)||0)} — 戦闘中に彼女が拾ったジェムの一部がコインになる。<b>世代の夜明けごとに${BAL.LUMINA_DECAY}段だけ薄れる</b>(初期値には戻らない——世代を跨ぐごとに土台が少しずつ上がる)。</div>
      </div>
      <div class="stcard"><h3>経過 — 堕ちの二軸 <span style="color:var(--dim);font-weight:normal">(世代内でリセット)</span></h3>
        <div class="kv spread"><div>肉体</div><div class="stagename">${bodyStg} (${Math.round(body)})</div></div>
        <div class="bar"><i style="width:${body}%;background:linear-gradient(90deg,#ff86b3,#ff5d7a)"></i></div>
        <div class="kv spread" style="margin-top:6px"><div>精神</div><div class="stagename">${mindStg} (${Math.round(mind)})</div></div>
        <div class="bar"><i style="width:${mind}%;background:linear-gradient(90deg,#b46cff,#7a3ff2)"></i></div>
        <div class="kv" style="margin-top:6px"><div>現在の反応段階 <b>${esc(TIER_NAMES_JP[self.tier])}</b></div></div>
        <div class="note">肉体=今世代で受けた損耗と異常の蓄積 / 精神=捕獲された経験。反応段階は二軸から導く(心は拒み、体は応える期間が最も長い)。</div>
      </div>
      <div class="stcard"><h3>探索 <span style="color:var(--dim);font-weight:normal">(地形マップ・世代ごとに地形が変わる)</span></h3>
        <div class="kv">
          <div>見つけた場所 <b>${Object.values((META.map&&META.map.known)||{}).filter(Boolean).length}/10</b> <span>(祠3・泉2・門1・清水2・石碑2。見えた場所・光茸の光で知った場所を目当てに歩く)</span></div>
          <div>祠の加護 <b>${Object.keys((META.map&&META.map.visited)||{}).length}/3</b> <span>(着くと自己強化が1段・世代内で1度ずつ)</span></div>
          <div>潜行 <b>第${curFloor().depth}層 ${esc(curFloor().name)}</b> <span>(${META.run.day||1}日目・連敗 ${META.run.fails||0}/${BAL.RUN_FAILS_RESET}・最深 第${META.run.deepest||1}層・魔核討伐 ${META.run.clears||0}回)</span></div>
        </div>
        <div class="note" style="margin-top:6px">${Object.keys(ZONES).map(z=>'<b>'+esc(ZONES[z].name)+'</b>: '+esc(ZONES[z].desc)+' — 彼女には: '+esc(ZONES[z].her)).join('<br>')}</div>
        <div class="note" style="margin-top:6px">目当て(v1.8): 彼女は光の柱・宝箱・落ちた品・場所・資源を「価値÷距離」で選び、脅威が薄ければそこへ歩く(進む先のジェムだけ拾う)。HUDの「目当て」チップとミニマップの点線に向かう先が出るので、先回りして待ち伏せできる。イベント(光の柱)は30秒後から50〜75秒ごと。</div>
      </div>
      <div class="stcard"><h3>抵抗の意志 <span style="color:var(--dim);font-weight:normal">(夜側の強化が行き着いても、彼女は「全く抵抗できない」には落ちない)</span></h3>
        <div class="kv">
          <div>意志 <b>${(META.lumina&&META.lumina.will)||0}/${BAL.WILL_CAP}</b> <span>(敗北のたび+${BAL.WILL_CAP_GAIN}、60秒以内の敗北は+${BAL.WILL_CAP_GAIN+BAL.WILL_FAST_GAIN}。生き延びると-${BAL.WILL_SURVIVE_LOSS})</span></div>
          <div>効果 <span>最大HP+3%/点・与ダメ+2%/点・スタミナ+1.5/点・振りほどき+2%/点。催眠Ⅲの底でも意志の分だけ手が動く。魅了/催眠ゲージの入り-1.5%/点</span></div>
          <div>世代の成長 <span>第${genNum(META.gen.idx)}世代: 素のHPと火力 ×${(1+BAL.GEN_SCALE*Math.min(10,Math.max(0,(META.gen.idx||1)-1))).toFixed(2)}</span></div>
        </div>
        ${META.curse&&BOSS_CURSES[META.curse.id]?`<div class="note" style="color:#ff6b81;margin-top:6px">ボス敗北の呪い『${esc(BOSS_CURSES[META.curse.id].name)}』 残り${META.curse.left}日 — ${esc(BOSS_CURSES[META.curse.id].desc)}</div>`:'<div class="note" style="margin-top:6px">ボス敗北の呪いは、いま無い。</div>'}
      </div>
      <div class="stcard"><h3>身についた性癖 <span style="color:var(--dim);font-weight:normal">(通常の処置では抜けぬ・世代を跨いで残る)</span></h3>
        ${Object.keys(TRAITS).filter(k=>(META.traits[k]||0)>0).map(k=>`<div class="tcard ero"><div class="tn">♨ ${esc(TRAITS[k].name)} <b style="color:var(--pink)">${ROMANS[META.traits[k]]}</b><small>/${TRAITS[k].max}</small></div><div class="td">${esc(TRAITS[k].desc)}</div><div class="tc">刻まれ方: ${esc(TRAITS[k].how)}</div></div>`).join('')
          ||'<div class="note">まだ何も刻まれていない。性癖は特定の条件が揃った夜に一つずつ刻まれ、世代リセットでも消えない。</div>'}
      </div>
      <div class="stcard"><h3>記録</h3>
        <div class="kv">
          <div>通算戦闘 <b>${META.runs}</b></div>
          <div>捕獲 <b>${META.captures}</b></div>
          <div>生存 <b>${L.survive||0}</b> <span>(連続${META.streak||0})</span></div>
          <div>総与ダメージ <b>${L.dmg}</b></div>
          <div>異常付与 <b>${L.ail}</b></div>
          <div>彼女に討たれた魔物 <b>${L.kills}</b></div>
          <div>通算絶頂 <b>${L.climax||0}</b>回 <span>(一夜最多${L.bestClimax||0})</span></div>
          <div>彼女のボス討伐 <b>${L.herBoss}</b></div>
          <div>撮影された絶頂 <b>${L.filmed||0}</b></div>
        </div>
        <div class="kv" style="margin-top:6px"><div>とどめを刺した種族 <b>${topCap}</b></div></div>
        <div class="kv" style="margin-top:4px"><div>異常の内訳 <span>${ailTxt}</span></div></div>
      </div>
      <div class="stcard"><h3>総評 <span style="color:var(--dim);font-weight:normal">(観測者の筆)</span></h3>
        <div class="review">${review.map(p=>'<p>'+esc(p)+'</p>').join('')}</div>
        <div class="divider">——本人による自己評価——</div>
        <div class="selfeval">${self.lines.map(l=>'<p>'+esc(l)+'</p>').join('')}</div>
        ${self.heart?`<div class="heart">〔心の声〕${esc(self.heart)}</div>`:''}
      </div>
      <div class="row" style="margin-top:8px"><button data-act="go" data-arg="codex">📖 図鑑</button><button data-act="go" data-arg="home">← もどる</button></div>`;
  },

  /* ---------- 図鑑 ---------- */
  htmlCodex(){
    const ids=Object.keys(MONSTERS).filter(id=>!MONSTERS[id].item && (!MONSTERS[id].guardian || (META.codex[id]&&META.codex[id].seen)));   // 魔核は出会ってから載る
    const stageTxt=['見かけた','追記一','追記二','追記三'];
    const cards=ids.map(id=>{
      const m=MONSTERS[id], stg=codexStage(id);
      if(stg<0) return `<div class="ccard unknown"><div style="height:44px;line-height:44px;font-size:22px">？</div><div class="nm">？？？</div><div class="st">${esc(TIER_NAMES[tierOf(id)])}・未観測</div></div>`;
      const kl=knowLv(id);
      return `<div class="ccard ${id===this.codexSel?'sel':''}" data-act="codex" data-arg="${id}">
        <div class="stg">${stageTxt[stg]}</div>
        <div data-icon="${id}" data-size="44"></div>
        <div class="nm">${esc(m.name)}</div><div class="st">${esc(TIER_NAMES[tierOf(id)])}・${esc(m.role)}</div>${kl?'<div class="lrn">今世代の学習 '+ROMANS[kl]+' '+esc(KNOW_NAMES[kl])+'</div>':''}</div>`;
    }).join('');
    let detail='';
    const sel=this.codexSel;
    if(sel && MONSTERS[sel] && codexStage(sel)>=0){
      const m=MONSTERS[sel], cx=CODEX[sel], stg=codexStage(sel), rec=(META.codex||{})[sel]||{};
      const note=cx?cx.note:null;
      const entries=[];
      if(note){
        entries.push(`<div class="entry"><span class="lbl">特徴</span>${noteHtml(note.base)}</div>`);
        for(let i=0;i<3;i++){
          if(stg>=i+1) entries.push(`<div class="entry"><span class="lbl">追記${['一','二','三'][i]}</span>${noteHtml(note.add[i], i===2)}</div>`);
          else{ entries.push(`<div class="entry locked">（追記${['一','二','三'][i]}は、まだ書かれていない——${['この種族に何かされた夜','この種族が絡んだ絶頂','この種族への敗北'][i]}の後に増える）</div>`); break; }
        }
        if(stg>=3 && note.after) entries.push(`<div class="after">${esc(note.after)}</div>`);
      }
      detail=`<div class="stcard" style="text-align:left">
        <div style="display:flex;gap:12px;align-items:center">
          <div data-icon="${sel}" data-size="56"></div>
          <div><div style="font-weight:bold;font-size:15px">${esc(m.name)} <span class="tierlbl t-${tierOf(sel)}">${esc(TIER_NAMES[tierOf(sel)])}</span></div>
          <div style="font-size:11px;color:var(--dim)">${esc(m.role)} — ${esc(m.trait||'通常追跡')} / HP${m.hp} 速${m.spd} 攻${m.dmg} コスト${m.cost}</div></div>
        </div>
        <h3 style="margin-top:10px">夜側の解説</h3>
        <div class="review"><p>${esc(m.desc)}</p>${cx?'<p>'+esc(cx.lore)+'</p>':''}</div>
        <div class="kv" style="margin-top:6px">
          <div>今世代の学習 <b>${esc(KNOW_NAMES[knowLv(sel)])}</b> <span>(脅威度${SPEC_THREAT[sel]||0}${knowLv(sel)>=2&&(SPEC_THREAT[sel]||0)>=3?'・何があっても避ける':''})</span></div>
          <div>彼女に討たれた <b>${rec.kills||0}</b></div>
          <div>彼女に何かした <b>${rec.met||0}</b>回</div>
          <div>絡んだ絶頂 <b>${rec.climax||0}</b></div>
          <div>この種族への敗北 <b>${rec.capture||0}</b></div>
        </div>
        <h3 style="margin-top:12px">ルミナの手記 <span style="color:var(--dim);font-weight:normal">(戦闘後、自室で)</span></h3>
        <div class="notebook"><h4>${esc((cx.note&&cx.note.title)||m.name)}</h4>${entries.join('')||'<div class="locked">（この魔物の頁は、まだ白い）</div>'}</div>
      </div>`;
    }
    return `
      <h2>📖 図鑑 <span style="font-size:12px;color:var(--dim)">夜側の解説と、彼女の手記</span></h2>
      <div class="note">左は夜側から見た解説。右の手記は彼女が戦闘後に書いたもので、<b>その種族に何かされる／その種族が絡んだ絶頂／その種族への敗北</b>のたびに追記が増える。追記は三度まで。</div>
      ${detail}
      <div class="codex-grid">${cards}</div>
      <div class="row"><button data-act="go" data-arg="status">👁 観測記録</button><button data-act="go" data-arg="home">← もどる</button></div>`;
  },

  showResult(sum){
    $('battlebar').hidden=true;
    $('resbar').hidden=false;
    this.refreshRes();
    const cap=sum.outcome==='capture';
    const title=cap?'★ 捕獲成功':(sum.outcome==='descend'?'降りられた……(第'+((sum.floorBefore||1)+1)+'層へ)':(sum.outcome==='clear'?'魔核、討たれる——彼女は目的を果たした':(sum.outcome==='survive'?'守りきられた……':'撤退……')));
    const color=cap?'var(--vio)':'var(--gold)';
    const runHtml=sum.runNote==='reset'?`<div class="newbadge">⟳ 二連敗——深淵の霧が彼女の記憶を奪い、入口へ。次より第${genNum(META.gen.idx)}世代(手記だけが残る)</div>`
      :(sum.runNote==='retry'?`<div class="note" style="color:#ff86b3;margin:6px 0">彼女は明日も第${(sum.floor||{}).depth||1}層に立つ(連敗 ${sum.fails}/${BAL.RUN_FAILS_RESET}。あと1敗でリセット)</div>`
      :(sum.runNote==='descend'?`<div class="note" style="color:#8fd3ff;margin:6px 0">次の潜行は第${sum.nextFloor}層 ${esc((FLOORS[(sum.nextFloor||1)-1]||{}).name||'')}。深いほど夜側のENは多く、魔物は硬い</div>`
      :(sum.runNote==='clear'?`<div class="newbadge">✦ 深淵は組み替わる。次より第${genNum(META.gen.idx)}世代——彼女はまた入口に立つ</div>`:'')));
    const by=cap&&sum.capturedBy&&MONSTERS[sum.capturedBy]?MONSTERS[sum.capturedBy].name:null;
    const causeTxt=cap?({stamina:'スタミナが尽き、組み伏せられた', charm:'魅了に蕩けたまま、力尽きた', hp:'体力が尽きた'}[sum.cause]||'体力が尽きた'):null;
    const scene=cap?sceneFor('capture',sum.capturedBy):null;
    const sceneHtml=cap?(scene
      ? `<div id="sceneBox"><b>${esc(scene.title||'')}</b>\n${scene.beats.map(esc).join('\n\n')}</div>`
      : `<div class="note">敗北シーン: テキスト未実装(js/scenes.js のフックへ別途追加)</div>`):'';
    const cgHtml=cap?`<div id="cgWrap"></div>`:'';
    this.hideStory();
    const storyHtml=(sum.storyLines&&sum.storyLines.length)?`<details style="text-align:left;margin:8px 0"><summary style="cursor:pointer;color:var(--vio);font-size:12px">物語を読み返す</summary><div class="note storytext">${sum.storyLines.map(storyLineHtml).join('')}</div></details>`:'';   // v2.1 本文は ADV で流れる
    const carryHtml=(sum.carryLv>1 && sum.runNote!=='reset' && sum.runNote!=='clear')?`<div class="note" style="color:#ffd76a;margin:6px 0">引き継ぎ: 彼女は Lv${sum.carryLv} と武器・パッシブをそのまま持ち越す(リセットまで)。夜側もそのぶん強くなる</div>`:'';
    this.root.innerHTML=`<div class="screen"><div class="inner" style="text-align:center;min-width:340px">
      <h2 style="color:${color}">${title}</h2>
      ${runHtml}
      ${carryHtml}
      ${storyHtml}
      ${by?`<div style="font-size:12px;color:var(--body)">とどめ: ${esc(by)}${causeTxt?' — '+esc(causeTxt):''}</div>`:''}
      ${sum.shop&&sum.shop.length?`<div class="note" style="color:var(--gold);margin:6px 0">——夜が明けて、ルミナは自分を強化した——<br>${sum.shop.map(esc).join(' ・ ')}</div>`:''}
      ${sum.shrines&&sum.shrines.length?`<div class="note" style="color:#ffd76a;margin:6px 0">——祠の加護: ${sum.shrines.map(esc).join(' ・ ')}——</div>`:''}
      ${sum.seals>0?`<div class="note" style="color:#ffd76a;margin:6px 0">封印石を ${sum.seals}/3 灯した</div>`:''}
      ${sum.used&&(sum.used.shroom+sum.used.nectar+sum.used.treasure+sum.used.pool+sum.used.stele)>0?`<div class="note" style="color:#9fe8c8;margin:6px 0">地形の資源: ${[['光茸',sum.used.shroom],['蜜の花',sum.used.nectar],['沈んだ宝',sum.used.treasure],['清水',sum.used.pool],['石碑',sum.used.stele]].filter(a=>a[1]>0).map(a=>a[0]+'×'+a[1]).join(' ・ ')}</div>`:''}
      ${sum.eventsN>0?`<div class="note" style="color:#ffe9b0;margin:6px 0">光の柱 ${sum.eventsN}回(彼女が辿り着いた ${sum.eventsDone}回)</div>`:''}
      ${sum.willUp?`<div class="note" style="color:#8fd3ff;margin:6px 0">——抵抗の意志が固くなった(${sum.will}/${BAL.WILL_CAP})。次からの彼女は少し粘る——</div>`:''}
      ${sum.newCurse?`<div class="note" style="color:#ff6b81;margin:6px 0">——ボス敗北。呪い『${esc(sum.newCurse.name)}』が${BAL.CURSE_DAYS}日残る: ${esc(sum.newCurse.desc)}——</div>`:''}
      ${sum.curseGone?`<div class="note" style="color:var(--dim);margin:6px 0">呪い『${esc(sum.curseGone.name)}』が抜けた</div>`:''}
      ${sum.decay&&sum.decay.length?`<div class="note" style="color:var(--vio);margin:6px 0">——世代の夜明け。彼女の加護が${sum.decay.length}段薄れた——<br>${sum.decay.map(esc).join(' ・ ')}</div>`:''}
      ${cgHtml}
      <div class="breakdown">
        経過時間 <b>${fmt(sum.time)}</b> ・ ルミナ Lv<b>${sum.heroLv}</b><br>
        討たれた魔物 <b>${sum.kills}</b>体 ・ 与ダメージ <b>${sum.dmg}</b> ・ 異常付与 <b>${sum.ail}</b>回${sum.climax?` ・ <span style="color:var(--pink)">絶頂 <b>${sum.climax}</b>回</span>`:''}<br>
        ✦ エッセンス <b>+${sum.essGain}</b> ・ <span class="o">◉ オーブ <b>+${sum.orbGain}</b></span><br>
        <span style="color:var(--gold)">🪙 ルミナのコイン +${sum.coins||0}</span>
      </div>
      ${sceneHtml}

      <div class="row" style="margin-top:12px">
        <button class="gold" data-act="again">▶ もう一度出撃</button>
        <button class="sub" data-act="go" data-arg="deck">🃏 編成</button>
        <button class="sub" data-act="go" data-arg="lab">✦ 研究所</button>
        <button class="sub" data-act="go" data-arg="home">ホーム</button>
      </div>
    </div></div>`;
    if(sum.storyLines&&sum.storyLines.length) this.showStory(sum.storyLines);   // v2.1 結末・リセットの物語は結果画面の上で流れる
    if(cap) this.tryLoadCG(sum.capturedBy);
  },

  /* 敗北スチル: assets/cg/defeat_<id>.png → defeat.png の順に探す(無ければ注記のみ) */
  tryLoadCG(byId){
    const wrap=document.getElementById('cgWrap');
    if(!wrap) return;
    const cands=[];
    if(byId) cands.push('assets/cg/defeat_'+byId+'.png');
    cands.push('assets/cg/defeat.png');
    const tryNext=i=>{
      if(i>=cands.length){
        wrap.innerHTML='<div class="note">敗北スチル: 未設定(assets/cg/defeat.png を置くと表示されます)</div>';
        return;
      }
      const img=new Image();
      img.onload=()=>{
        img.style.cssText='max-width:100%;max-height:260px;border-radius:10px;border:1.4px solid var(--card-line);margin:6px 0';
        wrap.innerHTML=''; wrap.appendChild(img);
      };
      img.onerror=()=>tryNext(i+1);
      img.src=cands[i];
    };
    tryNext(0);
  },

  /* ---------- 戦闘バー ---------- */
  enterBattle(){
    this.hideAll();
    $('resbar').hidden=true;
    $('battlebar').hidden=false;
    this.selForm=META.formations.includes(this.selForm)?this.selForm:META.formations[0];
    this.buildHand();
    this.buildItems();
    this.armItem(null);
    this.refreshFormRow();
    this.syncBattleButtons();
    $('btnSpd').textContent='▶ ×'+(G.spd||1);
    if(typeof resize==='function') resize();   // v1.9 縦持ちではバーの高さぶんキャンバスを縮める
  },
  /* 手札の要素(デッキ札+客札)。客札は別の帯に小さく並ぶ */
  handEls(){ return [...$('handrow').children, ...$('guestrow').querySelectorAll('.gchip')]; },
  buildHand(){
    const row=$('handrow'), grow=$('guestrow');
    // 客の帯: ラベルは固定、札だけが横スクロールする。作り直す前の位置(右端にいたか)を覚えておく
    const oldSc=grow.querySelector('#guestscroll');
    const atEnd=!oldSc || oldSc.scrollLeft+oldSc.clientWidth>=oldSc.scrollWidth-12, keepLeft=oldSc?oldSc.scrollLeft:0;
    row.innerHTML=''; grow.innerHTML='';
    const sc=document.createElement('div'); sc.id='guestscroll';
    const guests=G.B.hand.filter(h=>h.temp);
    for(const slot of G.B.hand){
      const m=MONSTERS[slot.id];
      const el=document.createElement('div');
      el.dataset.id=slot.id;
      if(slot.temp){
        el.className='gchip t-'+tierOf(slot.id);
        el.title=m.name+' — 宝箱の加勢(この戦闘のみ)';
        el.innerHTML=`<div class="cost"></div><div class="tg">客</div><div class="combo" hidden></div><div class="cnt"></div><div class="nm">${esc(m.name)}</div><div class="cd" style="height:0%"></div>`;
        el.insertBefore(makeIconCanvas(slot.id,44), el.firstChild);
        sc.appendChild(el);
      }else{
        el.className='hcard t-'+tierOf(slot.id);
        const tg={fodder:'雑',mid:'中',large:'大',boss:'王'}[tierOf(slot.id)];
        el.innerHTML=`<div class="cost"></div><div class="tg">${tg}</div><div class="combo" hidden></div><div class="cnt"></div><div class="nm">${esc(m.name)}</div><div class="cd" style="height:0%"></div>`;
        el.insertBefore(makeIconCanvas(slot.id,44), el.firstChild);
        row.appendChild(el);
      }
    }
    row.classList.toggle('dense', G.B.hand.filter(h=>!h.temp).length>9);   // v1.9 札が多い時は小さめで一列
    grow.hidden=guests.length===0;
    if(guests.length){
      const lbl=document.createElement('div'); lbl.className='glbl'; lbl.innerHTML='客 <b>'+guests.length+'</b>';
      grow.appendChild(lbl); grow.appendChild(sc);
      sc.scrollLeft=atEnd?sc.scrollWidth:keepLeft;   // 右端を見ていたなら新しく来た客が見える位置へ、途中を見ていたならそのまま
    }
    this.refreshHand();
  },
  refreshHand(){
    if(!G.B) return;
    for(const el of this.handEls()){
      const id=el.dataset.id;
      const cost=playCost(id,this.selForm);
      el.querySelector('.cost').textContent=cost;
    }
  },
  buildItems(){
    const row=$('itemrow');
    row.innerHTML=Object.keys(NIGHT_ITEMS).filter(id=>META.nightItems[id]).map(id=>{
      const it=NIGHT_ITEMS[id];
      return `<div class="ichip" data-id="${id}" title="${esc(it.desc)}"><div class="icd" style="width:0%"></div><span>${it.icon} ${esc(it.name)} <b>${it.cost}</b></span></div>`;
    }).join('');
    this.refreshItems();
  },
  refreshItems(){
    for(const el of $('itemrow').children){
      el.classList.toggle('sel', el.dataset.id===this.armed);
    }
  },
  refreshFormRow(){
    const row=$('formrow');
    row.innerHTML=META.formations.map(fid=>{
      const f=FORMATIONS[fid];
      return `<div class="fchip ${fid===this.selForm?'sel':''}" data-id="${fid}">${esc(f.name)} <span class="fc">×${f.count}</span></div>`;
    }).join('');
  },
  /* 陣形の実効頭数(基礎+夜の深まり+軍団旗)。ヒロインLvで×4→×8のように育つ */
  formLiveCount(fid){
    const f=FORMATIONS[fid];
    if(fid==='single'||!G.B) return f.count;
    const night=Math.min(BAL.NIGHT_UNIT_MAX, Math.floor(G.B.hero.level/BAL.NIGHT_UNIT_LV));
    return f.count+night+altarLv('legion');
  },
  syncBattleButtons(){
    if(!G.B) return;
    $('btnAuto').className='sub'+(G.B.auto?' on':'');
    $('btnAuto').textContent=G.B.auto?'AUTO ON':'AUTO OFF';
  },
  tickBattleBar(){
    const B=G.B;
    if(!B||$('battlebar').hidden) return;
    const em=enMax();
    $('enfill').style.width=(clamp(B.en/em,0,1)*100).toFixed(1)+'%';
    $('entext').textContent='EN '+Math.floor(B.en)+'/'+em;
    for(const el of this.handEls()){
      const id=el.dataset.id;
      const slot=handSlot(id);
      const chk=canPlay(id,this.selForm);
      el.classList.toggle('off',!chk.ok);
      const isBoss=!!MONSTERS[id].boss;
      const cdH=isBoss?(B.bossCd>0?clamp(B.bossCd/BAL.BOSS_CD,0,1)*100:0):(slot&&slot.cdT>0?clamp(slot.cdT/(slot.cdMax||1),0,1)*100:0);
      el.querySelector('.cd').style.height=cdH.toFixed(0)+'%';
      // コンボ連鎖の残り表示
      const cb=B.combo&&B.combo[id];
      const cEl=el.querySelector('.combo');
      const on=!!(cb && B.time-cb.t<=BAL.COMBO_WINDOW && cb.n>=2);
      cEl.hidden=!on;
      if(on) cEl.textContent='×'+cb.n;
      // 次に出したときの召喚数(コンボ・夜の深まり込み)
      const nextCombo=(cb && B.time-cb.t<=BAL.COMBO_WINDOW)?Math.min(BAL.COMBO_MAX,cb.n+1):1;
      // 大型・ボスは陣形が精鋭型へ丸められる——丸めた先の陣形名を添える
      const rf=resolveForm(id,this.selForm);
      const n=spawnCountFor(id,rf,nextCombo);
      el.querySelector('.cnt').textContent=isBoss
        ?(B.bossPlayed[id]?'出撃済':(B.bossCd>0?'次まで'+Math.ceil(B.bossCd)+'s':(B.enemies.some(e=>e.boss&&!e.dead)?'交代待ち':'単騎')))
        :((rf!==this.selForm?FORMATIONS[rf].name+' ':'')+n+'体');
    }
    // 夜側のアイテム: 使えるか・クールダウン
    for(const el of $('itemrow').children){
      const id=el.dataset.id;
      const chk=canPlaceItem(id);
      el.classList.toggle('off',!chk.ok);
      const cd=B.itemCd[id]||0, it=NIGHT_ITEMS[id];
      el.querySelector('.icd').style.width=(cd>0?clamp(cd/it.cd,0,1)*100:0).toFixed(0)+'%';
    }
    // 陣形チップの実効頭数(彼女のLvで育つ)
    for(const fEl of $('formrow').children){
      const fc=fEl.querySelector('.fc');
      if(fc) fc.textContent='×'+this.formLiveCount(fEl.dataset.id);
    }
  },
};
