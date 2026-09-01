'use strict';
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
    $('handrow').addEventListener('click',e=>{
      const el=e.target.closest('.hcard');
      if(!el) return;
      initAudio();
      playCard(el.dataset.id, this.selForm);
      this.refreshHand();
    });
    $('formrow').addEventListener('click',e=>{
      const el=e.target.closest('.fchip');
      if(!el) return;
      this.selForm=el.dataset.id;
      this.refreshFormRow(); this.refreshHand();
    });
  },

  action(act,arg){
    switch(act){
      case 'go': this.show(arg); break;
      case 'battle':
        if(!META.deck.length){ S.deny(); return; }
        this.hideAll(); startBattle(); break;
      case 'deckAdd':
        if(META.deck.length<6 && !META.deck.includes(arg)){ META.deck.push(arg); saveMeta(); S.pick(); }
        this.show('deck'); break;
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
      case 'autoDefault':
        META.settings.autoplay=!META.settings.autoplay; saveMeta();
        this.show('home'); break;
      case 'wipe':
        if(this._wipeArm && performance.now()-this._wipeArm<3000){ wipeMeta(); this._wipeArm=0; this.show('home'); }
        else{ this._wipeArm=performance.now(); this.show('home'); }
        break;
      case 'again': this.hideAll(); startBattle(); break;
    }
    this.refreshRes();
  },

  hideAll(){ this.root.innerHTML=''; G.screen=''; },

  show(name){
    G.screen=name;
    G.mode='home';
    G.B=null;
    $('battlebar').hidden=true;
    $('resbar').hidden=false;
    bgmStart('home');
    this.refreshRes();
    const fn={home:this.htmlHome, deck:this.htmlDeck, lab:this.htmlLab,
      altar:this.htmlAltar, status:this.htmlStatus}[name];
    this.root.innerHTML='<div class="screen"><div class="inner'+(name==='home'?'':' wide')+'" style="'+(name==='home'?'margin-top:120px;background:rgba(17,15,34,.86)':'')+'">'+fn.call(this)+'</div></div>';
    this.attachIcons();
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
    $('resRot').textContent='戦歴'+META.gen.battle+'/'+BAL.GEN_LEN;
  },

  /* ---------- 各スクリーン ---------- */
  htmlHome(){
    const best=META.best?('最速捕獲 '+fmt(META.best.time)+' (第'+genNum(META.best.gen)+'世代/戦歴'+META.best.battle+')'):'まだ捕獲記録なし';
    const wipeArmed=this._wipeArm && performance.now()-this._wipeArm<3000;
    return `
      <h1>ルミナ・サバイバーズ</h1>
      <div class="sub">v0.6 侵蝕デッキ — MONSTER DECK × AUTO BATTLE</div>
      <p>あなたは<b>夜側の指揮者</b>。デッキから魔物を差し向け、AIで戦う光の少女<b>「ルミナ」</b>を追い詰める。<br>
      彼女に魔物が倒されるほどあなたのエネルギーとエッセンスは増え、彼女もまた強くなる。</p>
      <div style="text-align:center;color:var(--gold);font-size:12px;margin-bottom:8px">${esc(best)} ・ 通算${META.runs}戦 / 捕獲${META.captures}回</div>
      <div class="menu-grid">
        <button data-act="battle">▶ 出撃<small>5分間の観測戦闘</small></button>
        <button class="sub" data-act="go" data-arg="deck">🃏 デッキ編成<small>${META.deck.length}/6 枚</small></button>
        <button class="sub" data-act="go" data-arg="lab">✦ 研究所<small>解放・強化・融合・陣形</small></button>
        <button class="sub" data-act="go" data-arg="altar">◉ オーブの祭壇<small>ルミナの初期状態を書き換える</small></button>
        <button class="sub" data-act="go" data-arg="status">👁 観測記録<small>ルミナのステータス</small></button>
        <button class="sub" data-act="autoDefault">🤖 オート初期値: ${META.settings.autoplay?'ON':'OFF'}<small>戦闘開始時のオート指揮</small></button>
      </div>
      <details style="margin-top:6px"><summary style="font-size:11px;color:var(--dim);cursor:pointer">あそびかた / ルール</summary>
      <p style="font-size:11.5px">
      ・戦闘中、ENを払ってカードの魔物を陣形つきで召喚。ルミナに倒されたぶんENとエッセンスが還元される。<br>
      ・拘束役は接触すると<b>四肢に絡みつく</b>。ルミナは移動と攻撃でもがいて引き剥がすが、<b>スタミナ</b>を消耗する。<br>
      ・スタミナが薄い時に拘束すると<b>押し倒し</b>。<b>HPかスタミナを削りきれば敗北=捕獲</b>。与ダメ・異常・捕獲で<b>オーブ</b>獲得。<br>
      ・ルミナの回復ハートは、彼女が<b>燭台を壊した時だけ</b>落ちる。回復させたくなければ燭台の周りで待ち伏せを。<br>
      ・ルミナは倒した魔物の経験で戦闘中レベルアップし、武器を融合させて強くなる。さらに<b>${BAL.GEN_LEN}戦ごとの世代内</b>で経験を持ち越す。<br>
      ・世代が変わると彼女の経験はリセット。ただし<b>祭壇の書き換え</b>は永続する。<br>
      ・護りが高く、序盤はダメージがほぼ通らない。エッセンスで魔物を育て、オーブで彼女を崩すこと。</p></details>
      <div class="note" style="text-align:center">
        <span data-act="wipe" style="cursor:pointer;text-decoration:underline">${wipeArmed?'⚠ もう一度クリックで全データ削除':'データ初期化'}</span>
        ・ ?ts=N で速度N倍(デバッグ)
      </div>`;
  },

  htmlDeck(){
    const slots=META.deck.map(id=>{
      const m=MONSTERS[id], lv=META.cards[id].lv;
      return `<div class="mcard sel" data-act="deckRem" data-arg="${id}" style="cursor:pointer" title="クリックで外す">
        <div class="cost">${cardCost(id,lv)}</div><div class="lv">Lv${lv}</div>
        <div data-icon="${id}" data-size="44"></div>
        <div class="nm">${esc(m.name)}</div>
        <div class="st">クリックで外す</div></div>`;
    }).join('') || '<p style="text-align:center">デッキが空です。下から追加してください。</p>';
    const pool=Object.keys(MONSTERS).filter(id=>META.cards[id]&&META.cards[id].owned&&!META.deck.includes(id)).map(id=>{
      const m=MONSTERS[id], lv=META.cards[id].lv;
      return `<div class="mcard" data-act="deckAdd" data-arg="${id}" style="cursor:pointer" title="クリックで追加">
        <div class="cost">${cardCost(id,lv)}</div><div class="lv">Lv${lv}</div>
        <div data-icon="${id}" data-size="44"></div>
        <div class="nm">${esc(m.name)}</div>
        <div class="st">${esc(m.role)}${m.trait?'<br>'+esc(m.trait):''}</div></div>`;
    }).join('') || '<p>追加できるカードがありません。</p>';
    return `
      <h2>🃏 デッキ編成 <span style="font-size:12px;color:var(--dim)">(${META.deck.length}/6)</span></h2>
      <div class="cards">${slots}</div>
      <h2 style="font-size:14px">所持カード</h2>
      <div class="cards">${pool}</div>
      <div class="note">陣形は戦闘中に選択します。解放済み: ${META.formations.map(f=>esc(FORMATIONS[f].name)).join(' / ')}</div>
      <div class="row"><button data-act="go" data-arg="home">← もどる</button><button class="gold" data-act="battle">▶ このデッキで出撃</button></div>`;
  },

  htmlLab(){
    const rows=[];
    for(const id in MONSTERS){
      const m=MONSTERS[id], st=META.cards[id];
      if(st&&st.owned){
        const atMax=st.lv>=CARD_LV_MAX;
        const cost=atMax?0:cardUpCost(id,st.lv);
        const mult=cardLvMult(st.lv);
        rows.push(`<div class="lrow">
          <div data-icon="${id}" data-size="40"></div>
          <div class="info"><div class="nm">${esc(m.name)} <span style="color:var(--gold)">Lv${st.lv}</span></div>
          <div class="ds">HP${Math.round(m.hp*mult.hp)} / 攻${Math.round(m.dmg*mult.dmg)} / コスト${cardCost(id,st.lv)} — ${esc(m.desc)}</div></div>
          ${atMax?'<span style="color:var(--gold);font-size:11px">MAX</span>'
            :`<button class="sub" data-act="upcard" data-arg="${id}" ${META.essence<cost?'disabled':''}>強化 ✦${cost}</button>`}
        </div>`);
      }else if(m.unlock>=0 && !m.fusion){
        rows.push(`<div class="lrow" style="opacity:.8">
          <div data-icon="${id}" data-size="40"></div>
          <div class="info"><div class="nm">${esc(m.name)}</div><div class="ds">${esc(m.desc)}</div></div>
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
    return `
      <h2>✦ 研究所 <span style="font-size:12px;color:var(--gold)">エッセンス ${Math.floor(META.essence)}</span></h2>
      <div class="list">${rows.join('')}</div>
      <h2 style="font-size:14px">融合研究</h2>
      <div class="list">${fuses.join('')||'<p>すべて融合済み。</p>'}</div>
      <h2 style="font-size:14px">陣形(出現方法)</h2>
      <div class="list">${forms}</div>
      <div class="row"><button data-act="go" data-arg="home">← もどる</button></div>`;
  },

  htmlAltar(){
    const rows=ALTAR.map(a=>{
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
    }).join('');
    return `
      <h2>◉ オーブの祭壇 <span style="font-size:12px;color:var(--vio)">オーブ ${Math.floor(META.orbs)}</span></h2>
      <p style="font-size:11.5px">攻撃・状態異常・捕獲で得たオーブを捧げ、<b>ルミナの初期状態そのもの</b>を書き換える。<br>
      書き換えは<b>世代リセット後も残り続ける</b>、唯一の爪痕。</p>
      <div class="list">${rows}</div>
      <div class="row"><button data-act="go" data-arg="home">← もどる</button></div>`;
  },

  htmlStatus(){
    const preview=newHero();
    const body=fallBody(), mind=fallMind();
    const bodyStg=stageName(body,FALL_BODY_STAGES), mindStg=stageName(mind,FALL_MIND_STAGES);
    const mods=ALTAR.filter(a=>altarLv(a.id)>0).map(a=>esc(a.name)+' '+genNum(altarLv(a.id))).join(' / ')||'なし';
    return `
      <h2>👁 観測記録 — ルミナ</h2>
      <div class="stcard"><h3>人物</h3>
        <div class="kv">
          <div>名前 <b>ルミナ</b>(成人・光の守り手)</div>
          <div>世代 <b>第${genNum(META.gen.idx)}</b></div>
          <div>戦歴 <b>${META.gen.battle}/${BAL.GEN_LEN}</b> <span>(満了で経験リセット)</span></div>
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
      <div class="stcard"><h3>経過 — 堕ちの二軸 <span style="color:var(--dim);font-weight:normal">(世代内でリセット)</span></h3>
        <div class="kv spread"><div>肉体</div><div class="stagename">${bodyStg} (${Math.round(body)})</div></div>
        <div class="bar"><i style="width:${body}%;background:linear-gradient(90deg,#ff86b3,#ff5d7a)"></i></div>
        <div class="kv spread" style="margin-top:6px"><div>精神</div><div class="stagename">${mindStg} (${Math.round(mind)})</div></div>
        <div class="bar"><i style="width:${mind}%;background:linear-gradient(90deg,#b46cff,#7a3ff2)"></i></div>
        <div class="note">肉体=今世代で受けた損耗と異常の蓄積 / 精神=捕獲された経験。数値は機構値。</div>
      </div>
      <div class="stcard"><h3>記録</h3>
        <div class="kv">
          <div>通算戦闘 <b>${META.runs}</b></div>
          <div>捕獲 <b>${META.captures}</b></div>
          <div>総与ダメージ <b>${META.life.dmg}</b></div>
          <div>異常付与 <b>${META.life.ail}</b></div>
          <div>彼女に討たれた魔物 <b>${META.life.kills}</b></div>
          <div>通算絶頂 <b>${META.life.climax||0}</b>回</div>
          <div>彼女のボス討伐 <b>${META.life.herBoss}</b></div>
        </div>
      </div>
      <div class="note">※詳細な観測テキスト(称号・総評など)は scenes.js 系のフックに別途拡張予定。</div>
      <div class="row" style="margin-top:8px"><button data-act="go" data-arg="home">← もどる</button></div>`;
  },

  showResult(sum){
    $('battlebar').hidden=true;
    $('resbar').hidden=false;
    this.refreshRes();
    const cap=sum.outcome==='capture';
    const title=cap?'★ 捕獲成功':(sum.outcome==='survive'?'守りきられた……':'撤退……');
    const color=cap?'var(--vio)':'var(--gold)';
    const by=cap&&sum.capturedBy&&MONSTERS[sum.capturedBy]?MONSTERS[sum.capturedBy].name:null;
    const causeTxt=cap?({stamina:'スタミナが尽き、組み伏せられた', charm:'魅了に蕩けたまま、力尽きた', hp:'体力が尽きた'}[sum.cause]||'体力が尽きた'):null;
    const scene=cap?sceneFor('capture',sum.capturedBy):null;
    const sceneHtml=cap?(scene
      ? `<div id="sceneBox"><b>${esc(scene.title||'')}</b>\n${scene.beats.map(esc).join('\n\n')}</div>`
      : `<div class="note">敗北シーン: テキスト未実装(js/scenes.js のフックへ別途追加)</div>`):'';
    const cgHtml=cap?`<div id="cgWrap"></div>`:'';
    this.root.innerHTML=`<div class="screen"><div class="inner" style="text-align:center;min-width:340px">
      <h2 style="color:${color}">${title}</h2>
      ${by?`<div style="font-size:12px;color:var(--body)">とどめ: ${esc(by)}${causeTxt?' — '+esc(causeTxt):''}</div>`:''}
      ${cgHtml}
      <div class="breakdown">
        経過時間 <b>${fmt(sum.time)}</b> ・ ルミナ Lv<b>${sum.heroLv}</b><br>
        討たれた魔物 <b>${sum.kills}</b>体 ・ 与ダメージ <b>${sum.dmg}</b> ・ 異常付与 <b>${sum.ail}</b>回${sum.climax?` ・ <span style="color:var(--pink)">絶頂 <b>${sum.climax}</b>回</span>`:''}<br>
        ✦ エッセンス <b>+${sum.essGain}</b> ・ <span class="o">◉ オーブ <b>+${sum.orbGain}</b></span>
      </div>
      ${sceneHtml}
      ${sum.rotReset?`<div class="newbadge">⟳ ルミナの戦闘経験がリセットされた — 次より第${genNum(META.gen.idx)}世代</div>`:''}
      <div class="row" style="margin-top:12px">
        <button class="gold" data-act="again">▶ もう一度出撃</button>
        <button class="sub" data-act="go" data-arg="deck">🃏 編成</button>
        <button class="sub" data-act="go" data-arg="lab">✦ 研究所</button>
        <button class="sub" data-act="go" data-arg="home">ホーム</button>
      </div>
    </div></div>`;
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
    this.refreshFormRow();
    this.syncBattleButtons();
    $('btnSpd').textContent='▶ ×'+(G.spd||1);
  },
  buildHand(){
    const row=$('handrow');
    row.innerHTML='';
    for(const slot of G.B.hand){
      const m=MONSTERS[slot.id];
      const el=document.createElement('div');
      el.className='hcard';
      el.dataset.id=slot.id;
      el.innerHTML=`<div class="cost"></div><div class="combo" hidden></div><div class="nm">${esc(m.name)}</div><div class="cd" style="height:0%"></div>`;
      el.insertBefore(makeIconCanvas(slot.id,44), el.firstChild);
      row.appendChild(el);
    }
    this.refreshHand();
  },
  refreshHand(){
    if(!G.B) return;
    for(const el of $('handrow').children){
      const id=el.dataset.id;
      const cost=playCost(id,this.selForm);
      el.querySelector('.cost').textContent=cost;
    }
  },
  refreshFormRow(){
    const row=$('formrow');
    row.innerHTML=META.formations.map(fid=>{
      const f=FORMATIONS[fid];
      return `<div class="fchip ${fid===this.selForm?'sel':''}" data-id="${fid}">${esc(f.name)} <span class="fc">×${f.count}</span></div>`;
    }).join('');
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
    for(const el of $('handrow').children){
      const id=el.dataset.id;
      const slot=handSlot(id);
      const chk=canPlay(id,this.selForm);
      el.classList.toggle('off',!chk.ok);
      const cdH=slot&&slot.cdT>0?clamp(slot.cdT/(slot.cdMax||1),0,1)*100:0;
      el.querySelector('.cd').style.height=cdH.toFixed(0)+'%';
      // コンボ連鎖の残り表示
      const cb=B.combo&&B.combo[id];
      const cEl=el.querySelector('.combo');
      const on=!!(cb && B.time-cb.t<=BAL.COMBO_WINDOW && cb.n>=2);
      cEl.hidden=!on;
      if(on) cEl.textContent='×'+cb.n;
    }
  },
};
