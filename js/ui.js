'use strict';
const ADV_CPS=26;   // v2.1 物語の文字送り(文字/秒)
/* ============================================================
   ui.js — DOMスクリーンと戦闘バー
============================================================ */
const $=id=>document.getElementById(id);

const UI={
  root:null, selForm:'scatter', retreatArm:0,
  labSel:null,     // v5.2 研究所で詳細を開いている魔物(再描画しても開いたまま残す)
  altarWho:null,   // v5.8 祭壇でいま見ているヒロイン
  statWho:null,    // v5.8 観測記録でいま見ているヒロイン
  codexWho:null,   // v5.8 図鑑でいま開いている手記の持ち主

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
      /* ★v6.5 敗北のあとの観測は、このボタンで終える(バーの場所を新しく作らない) */
      if(G.B && G.B.after && G.mode==='captured'){ afterEnd(); return; }
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
      case 'labpick': this.labSel=arg; S.pick(); this.show('lab'); break;   // v5.2 マスを押して詳細を出す
      case 'labclose': this.labSel=null; this.show('lab'); break;
      case 'unlock':{
        const m=MONSTERS[arg];
        /* v6.3c 深さの錠: その種の住処の階が開くまでは、いくら払っても解放できない */
        if(META.essence>=m.unlock && deepOk(arg) && !(META.cards[arg]&&META.cards[arg].owned)){
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
      case 'altarWho':
        this.altarWho=arg; this.show('altar'); break;
      case 'statWho':
        this.statWho=arg; this.show('status'); break;
      case 'codexWho':
        this.codexWho=arg; this.show('codex'); break;
      case 'altar':{
        /* v5.8 arg は "id"(夜側の共通) か "id:ヒロインid"(ヒロインごとの弱体化) */
        const cut=arg.indexOf(':'), aid=cut<0?arg:arg.slice(0,cut), who=cut<0?null:arg.slice(cut+1);
        const a=ALTAR.find(x=>x.id===aid);
        if(!a){ S.deny(); this.show('altar'); break; }
        const tbl=who?altarHTable(who):META.altar;
        const lv=tbl[aid]||0;
        if(lv<a.max && altarOpen(a,lv) && META.orbs>=a.costs[lv]){
          META.orbs-=a.costs[lv];
          tbl[aid]=lv+1;
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
      const img=$('advImg'); img.addEventListener('error',()=>{ if(img.dataset.fb!=='1'){ img.dataset.fb='1'; img.src=(img.dataset.who==='freila')?'assets/ref/freila_stand.png':'assets/cg/defeat.png'; } else img.style.visibility='hidden'; }); img.dataset.who='lumina'; img.src='assets/ref/lumina_novelai.png';
    }
    this.advSyncAuto(); box.hidden=false; this.advRender();
  },
  /* ★v6.5 敗北のあとの観測の間だけ、撤退ボタンを「観測を終える」に貸す */
  afterBtn(on){ const b=$('btnRetreat'); if(!b) return; b.textContent=on?'観測を終える':'撤退'; b.classList.toggle('warn',!!on); },
  advSyncAuto(){ const b=$('advAuto'); if(b) b.textContent='自動送り: '+((META.settings.advAuto!==false)?'ON':'OFF'); },
  advRender(){
    const A=this.adv, ln=A.lines[A.idx]; if(!ln) return;
    const NAMES={lumina:'ルミナ', freila:'フレイラ', kuu:'クウ', yamiko:'ヤミコ', town:'街の人', voice:'声', n:''};
    const SPK=['lumina','freila','kuu','yamiko'];   // v5.0 立ち絵と鉤括弧の付く話者
    const nm=$('advName'); nm.textContent=(NAMES[ln.s]!==undefined)?NAMES[ln.s]:ln.s; nm.className=ln.s;
    // v3.0 立ち絵は話しているヒロインに切り替える(地の文は直前の話者のまま暗く)
    { const img=$('advImg'); const who=SPK.includes(ln.s)?ln.s:(A.lastWho||'lumina'); A.lastWho=who;
      const SRC={lumina:'assets/ref/lumina_novelai.png', freila:'assets/ref/freila.png', kuu:'assets/ref/kuu.png', yamiko:'assets/ref/yamiko.png'};
      if(img && img.dataset.who!==who){ img.dataset.who=who; img.dataset.fb='0'; img.style.visibility=''; img.src=SRC[who]||SRC.lumina; } }
    const st=$('advStand'); st.className=(SPK.includes(ln.s)?'speak':'dim')+' who-'+(A.lastWho||'lumina')+(ln.f?' f-'+ln.f:'');
    const tx=$('advText'); tx.className=ln.s; tx.textContent='';
    A.typeT=0; A.shown=0; A.dwell=0; A.full=(SPK.includes(ln.s)||ln.s==='town'||ln.s==='voice')?'「'+ln.t+'」':ln.t;
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
    if(name!=='lab') this.labSel=null;       /* v5.2 研究所を離れたら、開いていた詳細は畳む */
    if(name!=='altar') this.altarWho=null;   /* v5.8 祭壇のヒロイン選択も、離れたら戻す */
    if(name!=='status') this.statWho=null;   /* v5.8 観測記録のヒロイン選択も同じ */
    if(name!=='codex') this.codexWho=null;   /* v5.8 図鑑の手記の持ち主も同じ */
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
      <div class="sub">v3.2 深淵 — 洞は形を持ち、褥は巣窟になる × MONSTER DECK</div>
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
        <button class="sub" data-act="go" data-arg="codex">📖 図鑑<small>魔物の解説と、それぞれの手記</small></button>
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
    /* v6.5 系統。いま効いている系統には金の縁がつくので、何枚目で届くかが見て分かる */
    const fb=deckFam(META.deck);
    const famTag=id=>{ const f=famOf(id); return f?`<div class="fam${fb.fam===f?' on':''}">${esc(FAMS[f].name)}</div>`:''; };
    const card=(id,sel)=>{
      const m=MONSTERS[id], lv=(META.cards[id]&&META.cards[id].lv)||1;
      return `<div class="mcard ${sel?'sel':''} t-${tierOf(id)}" data-act="${sel?'deckRem':'deckAdd'}" data-arg="${id}" style="cursor:pointer" title="${sel?'クリックで外す':'クリックで追加'}">
        <div class="cost">${cardCost(id,lv)}</div><div class="lv">Lv${lv}</div>
        <div data-icon="${id}" data-size="44"></div>
        <div class="nm">${esc(m.name)}</div>
        <div class="st">${sel?'クリックで外す':esc(m.role)+(m.trait?'<br>'+esc(m.trait):'')}</div>
        ${famTag(id)}</div>`;
    };
    const sections=TIERS.map(t=>{
      const inDeck=META.deck.filter(id=>tierOf(id)===t);
      const pool=Object.keys(MONSTERS).filter(id=>tierOf(id)===t&&!MONSTERS[id].field&&META.cards[id]&&META.cards[id].owned&&!META.deck.includes(id));
      const empties=Math.max(0,TIER_CAP[t]-inDeck.length);
      const slots=inDeck.map(id=>card(id,true)).join('')+
        Array.from({length:empties},()=>`<div class="mcard empty"><div class="nm">空き枠</div><div class="st">${esc(TIER_NAMES[t])}を1枚</div></div>`).join('');
      const forms=TIER_FORMS[t]?TIER_FORMS[t].map(f=>esc(FORMATIONS[f].name)).join('/'):'全陣形';
      return `<h2 style="font-size:14px" class="tier-h t-${t}">${esc(TIER_NAMES[t])} <span style="font-size:11px;color:var(--dim)">(${inDeck.length}/${TIER_CAP[t]}) 陣形: ${forms}</span></h2>
        <div class="cards">${slots}${pool.map(id=>card(id,false)).join('')}</div>`;
    }).join('');
    /* v6.5 同系統ボーナスの現在地。届いていない時は「あと何枚」まで言う */
    const famList=Object.keys(FAMS).map(f=>esc(FAMS[f].name)).join('・');
    const famNote=fb.fam
      ? `<b style="color:var(--gold)">${esc(fb.name)} ${fb.n}枚</b> — この系統だけカードのCDが <b>−${Math.round(fb.cut*100)}%</b>。${fb.cut<BAL.FAM_MAX?'まだ伸びる。':'ここが上限。'}`
      : (()=>{ const c={}; for(const id of META.deck){ const f=famOf(id); if(f) c[f]=(c[f]||0)+1; }
          let top=null,n=0; for(const f in c){ if(c[f]>n){ top=f; n=c[f]; } }
          return `系統ボーナス: <b>効いていない</b>。同じ系統を${BAL.FAM_MIN}枚そろえると、その系統だけCDが縮む`
            + (top?`(いまの最多は<b>${esc(FAMS[top].name)}</b> ${n}枚、あと${BAL.FAM_MIN-n}枚)`:'')
            + `。系統: ${famList}`; })();
    return `
      <h2>🃏 デッキ編成 <span style="font-size:12px;color:var(--dim)">(${META.deck.length}/${DECK_CAP})</span></h2>
      <div class="note">次は<b>第${curFloor().depth}層 ${esc(curFloor().name)}</b>。この階層で硬くなる種(HP×${BAL.FLOOR_AFFINITY}): ${curFloor().affinity.filter(id=>MONSTERS[id]).map(id=>esc(MONSTERS[id].name)).join('・')}。EN: 上限×${curFloor().en.max}・回復×${curFloor().en.regen}
        <span data-act="deckMode" style="cursor:pointer;text-decoration:underline;margin-left:8px">編成モード: ${({manual:'手動',auto:'おまかせ',random:'ランダム'})[META.settings.deckMode||'manual']}</span></div>
      <div class="note">雑魚・中型は全陣形で出せる。大型は<b>精鋭/双璧</b>の少数精鋭のみ、ボスは<b>単騎</b>。戦闘中に彼女が開けた宝箱からは、ランダムな魔物がこちらの手札に加わる(その戦闘限り・枚数制限なし)。</div>
      <div class="note">${famNote}</div>
      ${sections}
      <div class="note">陣形は戦闘中に選択します。解放済み: ${META.formations.map(f=>esc(FORMATIONS[f].name)).join(' / ')}</div>
      <div class="row"><button data-act="go" data-arg="home">← もどる</button><button class="gold" data-act="battle">▶ このデッキで出撃</button></div>`;
  },

  /* v5.2 研究所: 雑魚→中型→大型→ボスの順に、横3マスの格子で並べる。
     マスを押すと詳細が出て、そこから解放・強化・融合をする(格子は数字だけ、詳細は読み物)。
     ポップアップは this.labSel を見て描くので、強化して再描画されても開いたまま残る */
  labCell(id){
    const m=MONSTERS[id], st=META.cards[id], t=tierOf(id);
    const owned=!!(st&&st.owned), fuse=!!m.fusion;
    let cls='mcell t-'+t, stat='', extra='';
    if(owned){
      const atMax=st.lv>=CARD_LV_MAX;
      stat=`<div class="st">Lv${st.lv}</div>`;
      if(atMax) extra='<span class="max">MAX</span>';
      else{ const c=cardUpCost(id,st.lv); if(META.essence>=c) stat=`<div class="st can">Lv${st.lv} ▲</div>`; }
    }else if(fuse){
      cls+=' locked fuse';
      const ok=m.fusion.every(f=>META.cards[f]&&META.cards[f].owned&&META.cards[f].lv>=3);
      stat=`<div class="st ${ok&&META.essence>=m.fuseCost?'can':'lock'}">★ 融合</div>`;
    }else{
      cls+=' locked';
      stat=deepOk(id)
        ? `<div class="st ${META.essence>=m.unlock?'can':'lock'}">✦${m.unlock}</div>`
        : `<div class="st lock">${m.deep}階</div>`;   /* v6.3c まだ届かない深さ */
    }
    return `<div class="${cls}" data-act="labpick" data-arg="${id}"><div class="cnr"></div>${extra}
      <div data-icon="${id}" data-size="38"></div>
      <div class="nm">${esc(m.name)}</div>${stat}</div>`;
  },
  labSheet(){
    const id=this.labSel; if(!id||!MONSTERS[id]) return '';
    const m=MONSTERS[id], st=META.cards[id], t=tierOf(id);
    const owned=!!(st&&st.owned), fuse=!!m.fusion;
    const mult=owned?cardLvMult(st.lv):cardLvMult(1);
    let act='', req='';
    if(owned){
      if(st.lv>=CARD_LV_MAX) act='<span class="note" style="color:var(--gold)">これ以上は強くならない(MAX)</span>';
      else{ const c=cardUpCost(id,st.lv);
        act=`<button class="sub" data-act="upcard" data-arg="${id}" ${META.essence<c?'disabled':''}>強化 Lv${st.lv}→${st.lv+1} ✦${c}</button>`; }
    }else if(fuse){
      const ok=m.fusion.every(f=>META.cards[f]&&META.cards[f].owned&&META.cards[f].lv>=3);
      req=`<div class="req">素材: ${m.fusion.map(f=>esc(MONSTERS[f].name)+' Lv3+').join(' × ')}${ok?' — 揃っている':' — まだ足りない'}</div>`;
      act=`<button class="sub" data-act="fuse" data-arg="${id}" ${(!ok||META.essence<m.fuseCost)?'disabled':''}>融合 ✦${m.fuseCost}</button>`;
    }else{
      if(!deepOk(id)){
        req=`<div class="req">${m.deep}階の魔物。まだ ${openFloors()}階までしか開いていない — この深さへ届くまで、呼び出しかたが分からない</div>`;
        act=`<button class="sub" disabled>解放 ✦${m.unlock}</button>`;
      }else
      act=`<button class="sub" data-act="unlock" data-arg="${id}" ${META.essence<m.unlock?'disabled':''}>解放 ✦${m.unlock}</button>`;
    }
    return `<div class="msheet"><div class="back" data-act="labclose"></div><div class="box">
      <div class="hd"><div data-icon="${id}" data-size="54"></div>
        <div><div class="nm">${fuse?'★ ':''}${esc(m.name)} <span class="tierlbl t-${t}">${esc(TIER_NAMES[t])}</span></div>
        <div class="rl">${esc(m.role)}${owned?' — Lv'+st.lv:''}</div></div></div>
      <div class="stats"><span>HP <b>${Math.round(m.hp*mult.hp)}</b></span><span>攻 <b>${Math.round(m.dmg*mult.dmg)}</b></span>
        <span>速 <b>${m.spd}</b></span><span>コスト <b>${owned?cardCost(id,st.lv):m.cost}</b></span></div>
      <div class="ds">${esc(m.desc)}</div>
      ${m.trait?`<div class="tr">▸ ${esc(m.trait)}</div>`:''}
      ${req}
      <div class="act">${act}<button data-act="labclose">とじる</button></div>
      <div class="note" style="margin-top:6px">エッセンス ✦${Math.floor(META.essence)}</div>
    </div></div>`;
  },
  htmlLab(){
    const TORDER=['fodder','mid','large','boss'];
    const byTier={};
    for(const id in MONSTERS){
      const m=MONSTERS[id];
      if(m.item||m.guardian) continue;
      if(!(META.cards[id]&&META.cards[id].owned) && m.unlock<0 && !m.fusion) continue;   // 手に入らないものは並べない
      (byTier[tierOf(id)]=byTier[tierOf(id)]||[]).push(id);
    }
    const grids=TORDER.filter(t=>byTier[t]&&byTier[t].length).map(t=>{
      const ids=byTier[t].slice().sort((a,b)=>{     // 所持 → 解放できる → まだ、の順
        const oa=(META.cards[a]&&META.cards[a].owned)?0:1, ob=(META.cards[b]&&META.cards[b].owned)?0:1;
        if(oa!==ob) return oa-ob;
        return (MONSTERS[a].unlock||9999)-(MONSTERS[b].unlock||9999);
      });
      const n=ids.filter(id=>META.cards[id]&&META.cards[id].owned).length;
      return `<h2 style="font-size:14px" class="tier-h t-${t}">${esc(TIER_NAMES[t])} <span style="font-size:11px;color:var(--dim)">(${n}/${ids.length})</span></h2>
        <div class="mgrid">${ids.map(id=>this.labCell(id)).join('')}</div>`;
    }).join('');
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
      <p style="font-size:11px;color:var(--dim);margin:2px 0 6px">マスを押すと、その魔物の詳細と強化が出る</p>
      ${grids}
      <h2 style="font-size:14px">陣形(出現方法)</h2>
      <div class="list">${forms}</div>
      <h2 style="font-size:14px">夜側のアイテム <span style="font-size:11px;color:var(--dim);font-weight:normal">(戦闘中に画面をタップして置く)</span></h2>
      <div class="list">${items}</div>
      <div class="row"><button data-act="go" data-arg="home">← もどる</button></div>
      ${this.labSheet()}`;
  },

  htmlAltar(){
    /* v5.8 段ごとの錠。魔核を討った回数(META.era)で一段ずつ開く。
       ——HUD の「第N世代」は META.gen.idx(二連敗でも進む)で別の数なので、ここでは討伐回数で言う。
       ヒロインへの弱体化は各ヒロインぶん別々に積む(誰を選んでいるかは this.altarWho) */
    const era=eraNow();
    const row=(a,who)=>{
      const lv=who?altarLvH(a.id,who):(META.altar[a.id]||0);
      const atMax=lv>=a.max;
      const need=altarGateEra(a,lv);
      const open=atMax||era>=need;
      const cost=atMax?0:a.costs[lv];
      const openN=altarOpenMax(a);
      const pips='<span class="pips">'+Array.from({length:a.max},(_,i)=>
        `<i class="${i<lv?'on':(i<openN?'':'shut')}"></i>`).join('')+'</span>';
      let btn;
      if(atMax) btn='<span style="color:var(--vio);font-size:11px">極まった</span>';
      else if(!open) btn=`<span style="color:var(--dim);font-size:11px">魔核を${need}度討つと</span>`;
      else btn=`<button class="sub" data-act="altar" data-arg="${a.id}${who?':'+who:''}" ${META.orbs<cost?'disabled':''}>◉${cost}</button>`;
      return `<div class="lrow${open?'':' shut'}">
        <div class="info"><div class="nm">${esc(a.name)}${pips}</div>
        <div class="ds">${esc(a.desc)} <span style="color:var(--vio)">[${esc(a.fx)}]</span></div></div>
        ${btn}
      </div>`;
    };
    const ids=(typeof partyIds==='function')?partyIds():['lumina'];
    const who=(ids.indexOf(this.altarWho)>=0)?this.altarWho:'lumina';
    const tabs=ids.map(id=>`<button class="sub${id===who?' on':''}" data-act="altarWho" data-arg="${id}">${esc((HEROES[id]||{}).name||id)}</button>`).join('');
    const heroRows=ALTAR.filter(a=>!a.side).map(a=>row(a,who)).join('');
    const nightRows=ALTAR.filter(a=>a.side==='night').map(a=>row(a,null)).join('');
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
      <p style="font-size:11.5px">攻撃・状態異常・捕獲で得たオーブを捧げる。<b>すべて世代リセット後も残り続ける</b>。<br>
      <span style="color:var(--dim)">段には錠がかかっている。心臓が厚くなるたび、書き換えられる段が一つずつ開く。<b>魔核を討った回数 ${era}</b>。</span></p>
      <h3 style="color:var(--vio)">ヒロインの初期状態を書き換える</h3>
      <div class="row" style="margin:2px 0 6px">${tabs}</div>
      <div class="note" style="margin:0 0 6px">${esc((HEROES[who]||{}).name||who)}に積んだ分だけが、${esc((HEROES[who]||{}).name||who)}に効く。<b>ヒロインごとに別々</b>。</div>
      <div class="list">${heroRows}</div>
      <h3 style="color:var(--pink);margin-top:14px">夜側の軍備 <span style="font-size:11px;color:var(--dim);font-weight:normal">(共通)</span></h3>
      <div class="list">${nightRows}</div>
      <h3 style="color:var(--gold);margin-top:14px">ルミナの自己強化を削ぐ <span style="font-size:11px;color:var(--dim);font-weight:normal">(彼女がコインで積んだ強化を1段引き剥がす)</span></h3>
      <div class="note" style="margin:2px 0 6px">彼女の貯えコイン: ${Math.floor((META.lumina&&META.lumina.coins)||0)} — 夜明けごとに自動で買い足してくるので、削ぎ続けるか元を断つかはあなた次第。</div>
      <div class="list">${shaveRows}</div>
      <div class="row"><button data-act="go" data-arg="home">← もどる</button></div>`;
  },

  htmlStatus(){
    /* v5.8 観測記録はヒロインごと。数字も称号も総評も、その子の帳簿だけを見る */
    const sids=(typeof partyIds==='function')?partyIds():['lumina'];
    const who=(sids.indexOf(this.statWho)>=0)?this.statWho:'lumina';
    const HD=HEROES[who]||HEROES.lumina;
    const preview=newHero(who);
    const body=fallBodyOf(who), mind=fallMindOf(who);
    const bodyStg=stageName(body,FALL_BODY_STAGES), mindStg=stageName(mind,FALL_MIND_STAGES);
    const mods=ALTAR.filter(a=>(a.side?(META.altar[a.id]||0):altarLvH(a.id,who))>0)
      .map(a=>esc(a.name)+' '+genNum(a.side?(META.altar[a.id]||0):altarLvH(a.id,who))+(a.side?'(共通)':'')).join(' / ')||'なし';
    const titles=heldTitles(who);
    const honor=titles.filter(t=>t.kind==='honor'), ero=titles.filter(t=>t.kind==='ero');
    const tcard=t=>`<div class="tcard ${t.kind}">
        <div class="tn">${t.kind==='honor'?'📜':'💋'} ${esc(t.name)}${t.stage?`<small>s${t.stage}・${esc(t.line)}</small>`:''}</div>
        <div class="td">${esc(t.desc)}${t.long?'<br><span style="color:var(--dim)">'+esc(t.long)+'</span>':''}</div>
        <div class="tc">取得条件: ${esc(t.condText)}</div></div>`;
    const review=heroReview(who), self=heroSelfEval(who);
    const L=heroLife(who), cb=L.capBy||{};
    const statTabs=sids.map(id=>`<button class="sub${id===who?' on':''}" data-act="statWho" data-arg="${id}">${esc((HEROES[id]||{}).name||id)}</button>`).join('');
    /* 自己強化(コインで積む)はルミナだけの仕組みなので、他の子の頁には出さない */
    const selfUpgHtml = (who!=='lumina') ? '' : `<div class="stcard"><h3>ルミナの自己強化 <span style="color:var(--dim);font-weight:normal">(彼女が夜明けに買う)</span></h3>
        <div class="kv">
          ${Object.keys(LUMINA_UPG).map(id=>{
            const r=luminaRank(id);
            return `<div>${esc(LUMINA_UPG[id].name)} <b>${r?genNum(r):'—'}</b><span>/${LUMINA_UPG[id].max}</span></div>`;
          }).join('')}
        </div>
        <div class="note">貯えたコイン: ${Math.floor((META.lumina&&META.lumina.coins)||0)} — 戦闘中に彼女が拾ったジェムの一部がコインになる。<b>世代の夜明けごとに${BAL.LUMINA_DECAY}段だけ薄れる</b>(初期値には戻らない——世代を跨ぐごとに土台が少しずつ上がる)。</div>
      </div>`;
    const topCap=Object.keys(cb).filter(id=>MONSTERS[id]).sort((a,b)=>cb[b]-cb[a]).slice(0,3)
      .map(id=>esc(MONSTERS[id].name)+' '+cb[id]+'回').join(' / ')||'まだ無い';
    const ailBy=L.ailBy||{};
    const ailTxt=Object.keys(ailBy).filter(k=>AILMENTS[k]).map(k=>esc(AILMENTS[k].name)+' '+ailBy[k]).join(' / ')||'—';
    return `
      <h2>👁 観測記録 — ${esc(HD.name)}</h2>
      <div class="row" style="margin:2px 0 8px">${statTabs}</div>
      <div class="stcard"><h3>称号</h3>
        ${honor.map(tcard).join('')}
        ${ero.length?`<div class="divider">——立派な響きの、その裏の記録——</div>${ero.map(tcard).join('')}`
          :'<div class="note">裏の記録は、まだ無い。称号は変化より追加で増え、条件は厳しい。</div>'}
      </div>
      <div class="stcard"><h3>人物</h3>
        <div class="kv">
          <div>名前 <b>${esc(HD.name)}</b><span>${esc(HD.desc||'')}</span></div>
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
      ${selfUpgHtml}
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
          <div>意志 <b>${L.will||0}/${BAL.WILL_CAP}</b> <span>(敗北のたび+${BAL.WILL_CAP_GAIN}、60秒以内の敗北は+${BAL.WILL_CAP_GAIN+BAL.WILL_FAST_GAIN}。生き延びると-${BAL.WILL_SURVIVE_LOSS})</span></div>
          <div>効果 <span>最大HP+3%/点・与ダメ+2%/点・スタミナ+1.5/点・振りほどき+2%/点。催眠Ⅲの底でも意志の分だけ手が動く。魅了/催眠ゲージの入り-1.5%/点</span></div>
          <div>世代の成長 <span>第${genNum(META.gen.idx)}世代: 素のHPと火力 ×${(1+BAL.GEN_SCALE*Math.min(10,Math.max(0,(META.gen.idx||1)-1))).toFixed(2)}</span></div>
        </div>
        ${META.curse&&BOSS_CURSES[META.curse.id]?`<div class="note" style="color:#ff6b81;margin-top:6px">ボス敗北の呪い『${esc(BOSS_CURSES[META.curse.id].name)}』 残り${META.curse.left}日 — ${esc(BOSS_CURSES[META.curse.id].desc)}</div>`:'<div class="note" style="margin-top:6px">ボス敗北の呪いは、いま無い。</div>'}
      </div>
      <div class="stcard"><h3>身についた性癖 <span style="color:var(--dim);font-weight:normal">(通常の処置では抜けぬ・世代を跨いで残る)</span></h3>
        ${Object.keys(TRAITS).filter(k=>((L.traits||{})[k]||0)>0).map(k=>`<div class="tcard ero"><div class="tn">♨ ${esc(TRAITS[k].name)} <b style="color:var(--pink)">${ROMANS[L.traits[k]]}</b><small>/${TRAITS[k].max}</small></div><div class="td">${esc(TRAITS[k].desc)}</div><div class="tc">刻まれ方: ${esc(TRAITS[k].how)}</div></div>`).join('')
          ||'<div class="note">まだ何も刻まれていない。性癖は特定の条件が揃った夜に一つずつ刻まれ、世代リセットでも消えない。</div>'}
      </div>
      <div class="stcard"><h3>記録</h3>
        <div class="kv">
          <div>通算戦闘 <b>${L.runs||0}</b></div>
          <div>捕獲 <b>${L.captures||0}</b></div>
          <div>生存 <b>${L.survive||0}</b> <span>(連続${L.streak||0})</span></div>
          <div>夜側に削られた <b>${L.dmg||0}</b> <span>(この子が受けた損耗の合計)</span></div>
          <div>この子に入った異常 <b>${L.ail||0}</b></div>
          <div>この子が討った魔物 <b>${L.kills||0}</b></div>
          <div>通算絶頂 <b>${L.climax||0}</b>回 <span>(一夜最多${L.bestClimax||0})</span></div>
          <div>この子のボス討伐 <b>${L.herBoss||0}</b></div>
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
    const ids=Object.keys(MONSTERS).filter(id=>!MONSTERS[id].item && !MONSTERS[id].variant && (!MONSTERS[id].guardian || (META.codex[id]&&META.codex[id].seen)));   // 魔核は出会ってから載る(v6.0 熟れた個体は base の欄に合流する)
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
      const m=MONSTERS[sel], cx=CODEX[sel], rec=(META.codex||{})[sel]||{};
      /* v5.8 手記はヒロインごと。ルミナの頁に他の子が書き足す形をやめ、各人が自分の帳面を持つ。
         段の解禁も各人ぶん——同じ魔物でも、負けた子の頁だけが三段目まで進む */
      const cids=(typeof partyIds==='function')?partyIds():['lumina'];
      const cwho=(cids.indexOf(this.codexWho)>=0)?this.codexWho:'lumina';
      const cTabs=cids.map(id=>`<button class="sub${id===cwho?' on':''}" data-act="codexWho" data-arg="${id}">${esc((HEROES[id]||{}).name||id)}</button>`).join('');
      const BOOKS={ lumina:(cx&&cx.note)||null,
                    freila:(typeof CODEX_F!=='undefined')?CODEX_F[sel]:null,
                    kuu:(typeof CODEX_K!=='undefined')?CODEX_K[sel]:null,
                    yamiko:(typeof CODEX_Y!=='undefined')?CODEX_Y[sel]:null };
      const PENS={ lumina:{cls:'', how:'戦闘後、自室でペンで'},
                   freila:{cls:'f', how:'赤ペン。短く、要点だけ'},
                   kuu:{cls:'k', how:'青の細字。数と条件だけ'},
                   yamiko:{cls:'y', how:'墨の走り書き。夜側から見た書き方'} };
      const book=BOOKS[cwho], pen=PENS[cwho]||PENS.lumina;
      const hrec=((META.codexH&&META.codexH[cwho])||{})[sel]||{};
      const hstg=codexStage(sel, cwho);
      const entries=[];
      if(book){
        const line=(txt)=> (cwho==='lumina') ? noteHtml(txt) : ('<div class="mline '+pen.cls+'">'+esc(txt)+'</div>');
        const line3=(txt)=> (cwho==='lumina') ? noteHtml(txt, true) : ('<div class="mline '+pen.cls+'">'+esc(txt)+'</div>');
        if(hstg>=0 && book.base) entries.push(`<div class="entry"><span class="lbl">特徴</span>${line(book.base)}</div>`);
        for(let i=0;i<3;i++){
          const txt=book.add&&book.add[i];
          if(hstg>=i+1 && txt) entries.push(`<div class="entry"><span class="lbl">追記${['一','二','三'][i]}</span>${i===2?line3(txt):line(txt)}</div>`);
          else{ entries.push(`<div class="entry locked">（追記${['一','二','三'][i]}は、まだ書かれていない——${esc((HEROES[cwho]||{}).name||cwho)}が${['この種族に何かされた夜','この種族が絡んだ絶頂','この種族への敗北'][i]}を経た後に増える）</div>`); break; }
        }
        if(hstg>=3 && book.after) entries.push(`<div class="after">${esc(book.after)}</div>`);
      }
      /* ★v6.5 見た場面: 一度でも目に触れた押し倒し・敗北の本文を、ここから読み返せる。
         本文そのものではなく鍵を控えているので、組み直して出す(sceneReplay) */
      const RS=((META.readScenes||{})[cwho])||{};
      const KINDN={pin:'押し倒された', charmbind:'魅了に縋った', climax:'絶頂'};
      const beatTxt=(b)=> (typeof b==='string')?b:(b&&typeof b==='object'?Object.keys(b).map(k=>b[k]).filter(v=>typeof v==='string').join(' '):'');
      const scParts=[];
      for(const kind of ['pin','charmbind']){
        const key=kind+'/'+sel;
        if(!RS[key]) continue;
        const sc=(typeof sceneReplay==='function')?sceneReplay(cwho,key):null;
        if(!sc||!sc.beats||!sc.beats.length) continue;
        const body=sc.beats.map(b=>'<div class="mline '+pen.cls+'">'+esc(beatTxt(b))+'</div>').join('');
        scParts.push('<div class="entry"><span class="lbl">'+esc(KINDN[kind]||kind)+'</span>'+body+'</div>');
      }
      const scAll=Object.keys(RS).length;
      const sceneBox=`<h3 style="margin-top:12px">見た場面 — ${esc((HEROES[cwho]||{}).name||cwho)} <span style="color:var(--dim);font-weight:normal">(この子が目にした本文 ${scAll} 件)</span></h3>
        <div class="notebook ${pen.cls}">${scParts.join('')||'<div class="locked">（'+esc((HEROES[cwho]||{}).name||cwho)+'は、この魔物にまだ組み伏せられていない）</div>'}</div>`;
      const bookTitle=(cwho==='lumina')?((cx&&cx.note&&cx.note.title)||m.name):m.name;
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
          <div>討たれた(全員) <b>${rec.kills||0}</b></div>
          <div>何かされた(全員) <b>${rec.met||0}</b>回</div>
          <div>絡んだ絶頂(全員) <b>${rec.climax||0}</b></div>
          <div>敗北(全員) <b>${rec.capture||0}</b></div>
        </div>
        <h3 style="margin-top:12px">手記 — ${esc((HEROES[cwho]||{}).name||cwho)} <span style="color:var(--dim);font-weight:normal">(${esc(pen.how)})</span></h3>
        <div class="row" style="margin:2px 0 6px">${cTabs}</div>
        <div class="kv" style="margin-bottom:6px">
          <div>${esc((HEROES[cwho]||{}).name||cwho)}が討った <b>${hrec.kills||0}</b></div>
          <div>されたこと <b>${hrec.met||0}</b>回</div>
          <div>絡んだ絶頂 <b>${hrec.climax||0}</b></div>
          <div>この種族への敗北 <b>${hrec.capture||0}</b></div>
        </div>
        <div class="notebook ${pen.cls}"><h4>${esc(bookTitle)}</h4>${entries.join('')||'<div class="locked">（'+esc((HEROES[cwho]||{}).name||cwho)+'は、この魔物の頁をまだ持っていない）</div>'}</div>
        ${sceneBox}
      </div>`;
    }
    return `
      <h2>📖 図鑑 <span style="font-size:12px;color:var(--dim)">夜側の解説と、それぞれの手記</span></h2>
      <div class="note">上は夜側から見た解説。手記は<b>各人が自分の帳面に</b>書いたもので、<b>その子が</b>その種族に何かされる／その種族が絡んだ絶頂／その種族への敗北を経るたびに追記が増える。追記は三度まで。<br>同じ魔物でも、負けた子の頁だけが三段目まで進む——誰が何を知っているかは、四人で食い違う。<br><b>見た場面</b>は、実際にその子が組み伏せられた時に流れた本文。一度でも目にしたものだけが、ここに残る。</div>
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
    const joinHtml=sum.join?`<div class="newbadge" style="color:#ff9a7a;border-color:#ff9a7a">✦ ${esc(sum.join)}が翌朝、降りてくる——${sum.joinWhy==='late'?'一人で討たせる数ではない、と':'一人では勝てなくなった、と'}</div>`:'';   // v3.1 参戦の予兆
    const runHtml=(sum.runNote==='reset'?`<div class="newbadge">⟳ 二連敗——時が初日へ巻き戻る。深淵は何も知らないまま、彼女たちは覚えたことをそのまま持って降りる(第${genNum(META.gen.idx)}世代)</div>`
      :(sum.runNote==='retry'?`<div class="note" style="color:#ff86b3;margin:6px 0">彼女は明日も第${(sum.floor||{}).depth||1}層に立つ(連敗 ${sum.fails}/${BAL.RUN_FAILS_RESET}。あと1敗でリセット)</div>`
      :(sum.runNote==='descend'?`<div class="note" style="color:#8fd3ff;margin:6px 0">次の潜行は第${sum.nextFloor}層 ${esc((FLOORS[(sum.nextFloor||1)-1]||{}).name||'')}。深いほど夜側のENは多く、魔物は硬い</div>`
      :(sum.runNote==='clear'?`<div class="newbadge">✦ 魔核が時を巻き戻す。深淵は一つ深く、心臓は一回り厚くなり、彼女たちはこの世代で覚えたことを失う(第${genNum(META.gen.idx)}世代・手記だけが残る)</div>`:''))))+joinHtml;
    const by=cap&&sum.capturedBy&&MONSTERS[sum.capturedBy]?MONSTERS[sum.capturedBy].name:null;
    const causeTxt=cap?({stamina:'スタミナが尽き、組み伏せられた', charm:'魅了に蕩けたまま、力尽きた', hp:'体力が尽きた'}[sum.cause]||'体力が尽きた'):null;
    // v3.0 捕まったヒロインごとの敗北本文(二人なら二本)。ヒロインの声の表(SCENES / SCENES_F)で引く
    const caps=cap?((sum.captures&&sum.captures.length)?sum.captures:[{id:'lumina',by:sum.capturedBy,cause:sum.cause}]):[];
    const sceneHtml=cap?caps.map(c=>{ const sc=(typeof sceneForHero==='function')?sceneForHero({id:c.id},'capture',c.by):sceneFor('capture',c.by); const nm=(typeof HEROES!=='undefined'&&HEROES[c.id])?HEROES[c.id].name:'';
      return sc?`<div id="sceneBox"><b>${esc((caps.length>1&&nm?nm+' — ':'')+(sc.title||''))}</b>\n${sc.beats.map(esc).join('\n\n')}</div>`:`<div class="note">敗北シーン(${esc(nm)}): テキスト未実装</div>`; }).join(''):'';
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
        経過時間 <b>${fmt(sum.time)}</b> ・ パーティ Lv<b>${sum.heroLv}</b>${sum.leftBehind&&sum.leftBehind.length?` ・ <span style="color:#ff86b3">${esc(sum.leftBehind.join('・'))}を置いてきた</span>`:''}<br>
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
    // v2.1 結末・リセットの物語は結果画面の上で流れる。v4.0 その後にループの演出(赤黒い渦 / 白い奇跡の光)
    if(sum.storyLines&&sum.storyLines.length) this.showStory(sum.storyLines, sum.loopFx?{onEnd:()=>this.loopFx(sum.loopFx)}:undefined);
    else if(sum.loopFx) this.loopFx(sum.loopFx);
    if(cap) this.tryLoadCG(sum.capturedBy);
  },

  /* v4.0 ループの演出: 結末の文が終わった後、画面いっぱいに流す。
     clear → 魔核の根が巻いた赤黒い渦(時間が巻き戻る) / reset → 二人が白く光って初日へ戻る */
  loopFx(kind){
    if(!kind) return;
    const old=document.getElementById('loopfx'); if(old) old.remove();
    const d=document.createElement('div'); d.id='loopfx'; d.className=(kind==='miracle')?'miracle':'vortex';
    d.innerHTML='<div class="core"></div><div class="core b"></div><div class="word">'+(kind==='miracle'?'——もう一度、はじめから':'——深淵が、巻き戻る')+'</div>';
    (document.getElementById('stage')||document.body).appendChild(d);
    if(typeof S!=='undefined'){ if(kind==='miracle'){ if(S.clear) S.clear(); } else if(S.boss) S.boss(); }
    setTimeout(()=>{ const q=document.getElementById('loopfx'); if(q) q.remove(); }, kind==='miracle'?4700:5700);
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
    const fbB=G.B.fam||{fam:null, name:'', cut:0};   /* v6.5 系統ボーナスが乗る札に金の下線 */
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
      if(fbB.fam && famOf(slot.id)===fbB.fam){
        el.classList.add('famon');
        el.title=m.name+' — '+fbB.name+'のデッキ: 出し直しが '+Math.round(fbB.cut*100)+'% 速い';
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
