'use strict';
/* ============================================================
   codex_status.js — v5.8 観測記録(総評・自己評価・心の声)のヒロイン別
   ------------------------------------------------------------
   v5.7 までは、観測記録は「観測対象: ルミナ」の一枚しか無く、
   フレイラ・クウ・ヤミコは同じ数字を共有していた。
   ここでは三人ぶんの筆を持つ。ルミナの分は codex.js に残してある。

   総評   : 第三者(観測者)の筆。記録調。堕ちが進むほど突き放し、侮蔑が混ざる。
            誰を見ているかで、突き放し方の角度が違う。
   自己評価: 本人の台詞のみ。声の規則は各人のもの。
            フレイラ = 「だわ」「〜よ」「かしら」「わね」を使わない。
                       短く言い切る。崩れると言い切ろうとして途中で切れる。
            クウ     = 短く、切る。「だよ」「だし」「もん」を使わない。数と条件で話す。
            ヤミコ   = 余裕のある年上の口。崩れると敬語に戻る(戻ってしまう)。
   心の声 : 本人すら口にしない本音。一行。
============================================================ */

/* ---- フレイラ: 火。誇りが先に立ち、誇りのぶんだけ深く刺さる ---- */
function reviewFreila(c, tier, sp, bodyStg, mindStg){
  const p=[];
  if(c.runs===0){
    p.push('観測対象: フレイラ。火を使う天使。助っ人として深淵へ降りる。まだ一度も、この記録に数字を残していない。');
    p.push('前へ出るのが役目だと本人が決めている。前は、いちばん先に届く場所でもある。');
    return p;
  }
  if(tier==='resist'){
    p.push(`観測対象: フレイラ。通算${c.runs}戦、捕獲${c.captures}回。肉体${bodyStg}・精神${mindStg}。踏み込みの速さは落ちていない。`);
    if(c.captures===0) p.push('まだ組み伏せられていない。間合いの管理が正確で、迷いが短い。夜側が書くべき欄が空白のままだ。空白は、埋まるまでの時間でしかない。');
    else p.push(`敗北は${c.captures}回。${sp?sp+'の前で':''}足が止まった夜がある。止まった理由を本人は「湿っていた」と説明する。説明できるうちは、まだ立て直せる。`);
    p.push('炎は空気を食う。彼女の弱点はそこにあり、本人もそれを知っている。知っていることと、閉じ込められないことは、別の話だ。');
  }else if(tier==='strain'){
    p.push(`観測対象: フレイラ。通算${c.runs}戦、捕獲${c.captures}回、絶頂${c.climax}回。肉体${bodyStg}。読み切れているのに、避ける身体が追いつかない。`);
    p.push(`${sp?sp+'に負けた回数が最も多い。':''}彼女の負け方には型がある——踏み込んでから、退がる判断が半拍遅れる。半拍は、掴むには充分だ。`);
    p.push('本人は敗北のたび原因を言語化する。言語化された原因は、次の夜も同じ形で現れる。分析は、繰り返しを止めない。');
  }else if(tier==='yield'){
    p.push(`観測対象: フレイラ。通算${c.runs}戦、捕獲${c.captures}回、絶頂${c.climax}回(最多は一夜で${c.best}回)。肉体${bodyStg}・精神${mindStg}。`);
    p.push(`計算は合っている。合っているのに腕へ力が届かない、という状態が常態になった。${sp?sp+'に触れられると、':''}反撃の初動が反応に置き換わる。置き換わった瞬間を、彼女は毎回「生理的な」と呼ぶ。`);
    p.push('呼び方を持っている者ほど、呼び方の内側で長く保つ。保った分だけ、記録は増える。');
  }else{
    p.push(`観測対象: フレイラ。通算${c.runs}戦、捕獲${c.captures}回、絶頂${c.climax}回。精神${mindStg}。火の使い手が、火を持ったまま立ち尽くす夜が増えた。`);
    p.push(`${sp?sp+'の前では、':''}掌に炎を起こす動作の途中で手が止まる。止まった手は、そのまま下りる。下ろした先に何があるかは、本人がいちばん早く知っている。`);
    p.push('前へ出るのが役目だと、本人はまだ言う。前へ出る速さだけが、以前と変わっていない。');
  }
  if((c.ab.hypnolv||0)>0) p.push(`補記: 催眠を${c.ab.hypnolv}回。${(c.ab.self||0)>0?`人目のある所で自分を慰めたのが${c.ab.self}回。`:''}覚めた後、彼女は必ず時刻を確認する。確認できた時刻だけを、記録として採用している。`);
  if((c.L.filmed||0)>0) p.push(`補記: 見られながらの絶頂が${c.L.filmed}回。ルミナが近くにいる時の耐久が、いない時より短い。理由を尋ねた記録は無い。尋ねる必要が無いからだ。`);
  if((c.ab.deny||0)>0) p.push(`補記: 寸止めを${c.ab.deny}回。止められた後、彼女は数を数えはじめる。数え終えた回数は、まだ一度も無い。`);
  if((c.traits.musk||0)>0) p.push(`補記: 性癖「雄臭への発情」${ROMANS[c.traits.musk]}。臭いの届く距離を「風下」と呼び、風下を避ける経路を毎回引き直している。引き直した経路が、毎回そこを通る。`);
  return p;
}
function selfFreila(c, tier, sp){
  const lines=[]; let heart='';
  if(c.runs===0){
    lines.push('「記録？ 好きにして。……減るものでもない」');
    lines.push('「前は私が持つ。あの子には、届く距離で戦わせない」');
    heart='（……あの子の前で、無様なことにはならない）';
  }else if(tier==='resist'){
    lines.push(`「${c.runs}戦で${c.captures}敗。……悪くない。悪くはない、けど」`);
    if(c.captures>0) lines.push(`「${sp?sp+'のは':'あれは'}床が湿っていた。火が立たなかった。それだけの話」`);
    else lines.push('「掴ませていない。掴ませるつもりも無い」');
    lines.push('「炎は空気を食う。閉じられなければ、負ける道理が無い」');
    heart=c.captures>0?'（湿っていた。……湿っていた、で、通るはず）':'（この距離を保てば、通る）';
  }else if(tier==='strain'){
    lines.push(`「${c.captures}敗。……${c.climax}という数字は何。それは戦績じゃない」`);
    lines.push(`「${sp?sp+'の間合いは':'間合いは'}測ってある。測ってあるのに、踏み込んだ後の一歩が——……いや。次は合わせる」`);
    lines.push('「肌が敏いのは胞子。抜ければ戻る。戻らなかった例は……いま、出てこない」');
    heart='（読めている。読めているのに、なぜ身体が遅れる）';
  }else if(tier==='yield'){
    lines.push(`「……${c.climax}回。数えたのはそっちで、私じゃない」`);
    lines.push(`「生理的な反応。意味は無い。${sp?sp+'の時も、':''}意味は——……意味は、無い」`);
    lines.push('「触られた場所が熱いのは、血が集まるから。当たり前のこと。……当たり前だと、言っている」');
    heart='（言い切れば、そういうことになる。……ならない）';
  }else{
    lines.push(`「${c.captures}敗。${sp?sp+'に、多い。':''}……数は合っている」`);
    lines.push('「離れろ。……いや、離れる、な。いま離れられたら、わたし——」');
    lines.push('「前へ出るのは私の役目。役目だから、出る。……出るのは、役目だから」');
    heart='（……あの子には、見せない。見せなければ、無かったことになる）';
  }
  if((c.ab.hypno||0)>0 && tier!=='crave') lines.push('「塔？ 記録に残していない。残す価値が無かった。……何も、無かった」');
  if((c.ab.hypnolv||0)>0) lines.push('「光った後の記憶が飛ぶ。……時刻は合っている。合っているから、問題ない」');
  if((c.traits.musk||0)>0) lines.push('「風下を避ける。それだけの話。……避けた経路が、そこを通っているのは、地形の都合」');
  return {lines, heart, tier};
}

/* ---- クウ: 氷。短く切る。数と条件で世界を扱い、扱えなくなると黙る ---- */
function reviewKuu(c, tier, sp, bodyStg, mindStg){
  const p=[];
  if(c.runs===0){
    p.push('観測対象: クウ。氷を使う天使。二日続けて誰かが倒れた朝に降りてくる。記録はまだ一行も無い。');
    p.push('喋る量が少ない。少ない言葉のうち、ほとんどが数と条件だ。数えられるものだけを扱っている、とも言える。');
    return p;
  }
  if(tier==='resist'){
    p.push(`観測対象: クウ。通算${c.runs}戦、捕獲${c.captures}回。肉体${bodyStg}・精神${mindStg}。距離の取り方が正確で、無駄が無い。`);
    if(c.captures===0) p.push('まだ届かれていない。触れさせる前に凍らせる。合理的で、面白みが無い。夜側が退屈するという意味では、最も厄介な相手だ。');
    else p.push(`敗北は${c.captures}回。${sp?sp+'に':''}届かれた夜がある。届かれた後の彼女は、抵抗より先に条件を数え直す癖がある。数え直している間に、次が来る。`);
    p.push('身体はいちばん薄い。薄さを距離で補っている。距離が潰れた時に何が残るかは、まだ記録されていない。');
  }else if(tier==='strain'){
    p.push(`観測対象: クウ。通算${c.runs}戦、捕獲${c.captures}回、絶頂${c.climax}回。肉体${bodyStg}。氷が溶けるのが早くなった。`);
    p.push(`${sp?sp+'に掴まれる回数が最も多い。':''}掴まれた瞬間、彼女は数えるのをやめる。やめた後の数分が、記録のいちばん長い空白になっている。`);
    p.push('温度の話をするようになった。冷たい、熱い、温い。観測対象が自分の温度を報告しはじめるのは、たいてい良くない兆候だ。');
  }else if(tier==='yield'){
    p.push(`観測対象: クウ。通算${c.runs}戦、捕獲${c.captures}回、絶頂${c.climax}回(最多は一夜で${c.best}回)。肉体${bodyStg}・精神${mindStg}。`);
    p.push(`${sp?sp+'の前で、':''}凍らせる前に手が止まる場面が増えた。止まる時間は毎回ほぼ同じで、彼女がそれを測っているのが分かる。測っていて、短くならない。`);
    p.push('言葉が短くなるのは元からだ。短さの中身が変わった。以前は条件を削っていた。いまは、言いたくないところを削っている。');
  }else{
    p.push(`観測対象: クウ。通算${c.runs}戦、捕獲${c.captures}回、絶頂${c.climax}回。精神${mindStg}。氷は、もう出ない夜のほうが多い。`);
    p.push(`${sp?sp+'が近づくと、':''}距離を詰められる前に、自分から半歩ぶん動いている。方向は、いつも同じだ。本人は「風」と説明する。洞に風は無い。`);
    p.push('数える癖だけが残った。数えているものが何かを、記録は特定できていない。特定する必要も、もう無い。');
  }
  if((c.ab.hypnolv||0)>0) p.push(`補記: 催眠を${c.ab.hypnolv}回。${(c.ab.self||0)>0?`人目のある所で自分を慰めたのが${c.ab.self}回。`:''}覚めた後、指を折って数を数え直す。合わなかった時だけ、二度数える。`);
  if((c.L.filmed||0)>0) p.push(`補記: 見られながらの絶頂が${c.L.filmed}回。見られていないほうが長く保つ、という比較を本人が口にした。比較のために両方を経験している。`);
  if((c.ab.deny||0)>0) p.push(`補記: 寸止めを${c.ab.deny}回。止められた時だけ、彼女の言葉が長くなる。長くなった言葉は、条件の形をしていない。`);
  if((c.traits.musk||0)>0) p.push(`補記: 性癖「雄臭への発情」${ROMANS[c.traits.musk]}。「臭い」ではなく「濃度」と呼ぶ。濃度が高い場所を避ける記述はあるが、避けた記録は無い。`);
  return p;
}
function selfKuu(c, tier, sp){
  const lines=[]; let heart='';
  if(c.runs===0){
    lines.push('「……観測。ふうん。好きにして」');
    lines.push('「距離は測ってある。届かない所からやる。それだけ」');
    heart='（……見られてるほうが、少し、はやい）';
  }else if(tier==='resist'){
    lines.push(`「${c.runs}回。負けは${c.captures}。……計算どおり」`);
    if(c.captures>0) lines.push(`「${sp?sp+'は':'あれは'}、距離を誤った。次は誤らない」`);
    else lines.push('「届かせてない。届かせる理由が無い」');
    lines.push('「氷は、溶ける前に済ませる。それだけの話」');
    heart=c.captures>0?'（誤差。……誤差のはず）':'（このままでいい。このままで）';
  }else if(tier==='strain'){
    lines.push(`「負け${c.captures}。……${c.climax}は、別の数。数えないで」`);
    lines.push(`「${sp?sp+'の距離は':'距離は'}覚えた。覚えたのに、手が遅い。……原因は、まだ」`);
    lines.push('「温い。……いまのは、記録として言った。それだけ」');
    heart='（数えるのを、やめた時間がある。あれは、何）';
  }else if(tier==='yield'){
    lines.push(`「${c.climax}。……その数は、要らない」`);
    lines.push(`「凍らせる前に、手が。${sp?sp+'の時だけ。':''}……理由は、無い」`);
    lines.push('「溶けたんじゃない。溶かされた。……同じだけど、違う」');
    heart='（止まる時間、毎回おなじ。……測ってる。測ってるのに）';
  }else{
    lines.push(`「${c.captures}。……もう、合ってるかも分からない」`);
    lines.push('「近づいてくると、半歩。……風。洞に風は、……ある。あることにして」');
    lines.push('「数えてる。ずっと。何をかは、言わない」');
    heart='（……はやく。はやく、と思ってる。氷より、そっちが先に来る）';
  }
  if((c.ab.hypno||0)>0 && tier!=='crave') lines.push('「塔。……記録にない。無いものは、無い」');
  if((c.ab.hypnolv||0)>0) lines.push('「光ったあと。……三十秒。合わない。二度数えても、合わない」');
  if((c.traits.musk||0)>0) lines.push('「濃度の話。避ける経路は引いた。……引いたけど、通ってない」');
  return {lines, heart, tier};
}

/* ---- ヤミコ: 闇。夜側の生まれ。余裕が剥がれると、敬語のほうが先に出る ---- */
function reviewYamiko(c, tier, sp, bodyStg, mindStg){
  const p=[];
  if(c.runs===0){
    p.push('観測対象: ヤミコ。夜側で生まれ、光の側へ渡った者。記録の欄はまだ空だが、彼女は記録される側の作法を知っている。');
    p.push('知っている者を記録するのは、知らない者を記録するのとは別の面白さがある。彼女は自分が何をされるかを先に言い当てる。言い当てて、そこから逃げない。');
    return p;
  }
  if(tier==='resist'){
    p.push(`観測対象: ヤミコ。通算${c.runs}戦、捕獲${c.captures}回。肉体${bodyStg}・精神${mindStg}。手数も判断も、四人の中でいちばん少ない動きで済んでいる。`);
    if(c.captures===0) p.push('まだ落ちていない。夜側の手を全部知っているというのは、そういうことだ。知っている者を落とすには、知らない手が要る。用意はある。');
    else p.push(`敗北は${c.captures}回。${sp?sp+'に':''}沈んだ夜がある。沈む直前まで、彼女は年上の口ぶりを保っていた。保つのをやめる境目が、この記録の見どころだ。`);
    p.push('闇に溶けて回り込む戦い方は、夜側の作法そのものだ。作法を知る者が作法で負ける時、負け方まで作法どおりになる。');
  }else if(tier==='strain'){
    p.push(`観測対象: ヤミコ。通算${c.runs}戦、捕獲${c.captures}回、絶頂${c.climax}回。肉体${bodyStg}。余裕の位置が、少し前に出た。`);
    p.push(`${sp?sp+'に絡まれる回数が最も多い。':''}絡まれている最中、彼女はまだ解説をする。解説の文が短くなり、語尾が丁寧になっていく順序は、毎回同じだ。`);
    p.push('「こちら側の手ですね」と言う。言えているうちは、まだ向こう側に立っている。言えなくなる夜が、この段階の終点だ。');
  }else if(tier==='yield'){
    p.push(`観測対象: ヤミコ。通算${c.runs}戦、捕獲${c.captures}回、絶頂${c.climax}回(最多は一夜で${c.best}回)。肉体${bodyStg}・精神${mindStg}。`);
    p.push(`${sp?sp+'の手筋を先に読み上げ、':''}読み上げたとおりに落ちる。読めることは、防げることではない。彼女はそれを、光の側へ渡ってから知った。`);
    p.push('敬語が抜けなくなった。年上の口ぶりは残っているが、崩れた時に戻る先が変わっている。戻る先は、かつて自分が仕えていた側の言葉だ。');
  }else{
    p.push(`観測対象: ヤミコ。通算${c.runs}戦、捕獲${c.captures}回、絶頂${c.climax}回。精神${mindStg}。渡ってきた側の手つきを、身体のほうが憶えている。`);
    p.push(`${sp?sp+'の前で、':''}構える前に姿勢が変わる。夜側で覚えた受け方だ。受け方を覚えている身体は、受けることを拒まない。`);
    p.push('年上の顔は、最初の一言だけ残っている。二言目からは、ずっと丁寧だ。');
  }
  if((c.ab.hypnolv||0)>0) p.push(`補記: 催眠を${c.ab.hypnolv}回。${(c.ab.self||0)>0?`人目のある所で自分を慰めたのが${c.ab.self}回。`:''}彼女は催眠の仕組みを説明できる。説明できることと、かからないことは別だ。`);
  if((c.L.filmed||0)>0) p.push(`補記: 見られながらの絶頂が${c.L.filmed}回。見られる側に回ったのは、渡ってからが初めてだという。初めては一度きりで、回数は増えていく。`);
  if((c.ab.deny||0)>0) p.push(`補記: 寸止めを${c.ab.deny}回。止められた時、彼女は相手の手順を褒める。褒めた後の声が、褒める前より高い。`);
  if((c.traits.musk||0)>0) p.push(`補記: 性癖「雄臭への発情」${ROMANS[c.traits.musk]}。夜側にいた頃は、この臭いの中で働いていた。働いていた場所へ、身体だけが帰りたがっている。`);
  return p;
}
function selfYamiko(c, tier, sp){
  const lines=[]; let heart='';
  if(c.runs===0){
    lines.push('「観測記録。……ふふ。懐かしい書式ね。こちら側でも、同じものを付けていたわ」');
    lines.push('「好きに書いて構わない。書かれる側の作法は、心得ているつもり」');
    heart='（……書式まで同じとは、思わなかった）';
  }else if(tier==='resist'){
    lines.push(`「${c.runs}戦で${c.captures}敗。若い子たちより、ずいぶん少ないでしょう」`);
    if(c.captures>0) lines.push(`「${sp?sp+'に':'あれに'}沈んだのは、こちら側の手を一つ忘れていたから。……次は忘れない」`);
    else lines.push('「落ちていない。手はぜんぶ知っているもの。知っている手には、落ちない」');
    lines.push('「あの子たちの前では、あまり格好の悪いことはできないの。年上だから」');
    heart='（知っている手には落ちない。……知らない手を、まだ見ていないだけ）';
  }else if(tier==='strain'){
    lines.push(`「${c.captures}敗。${c.climax}回……それは戦績ではないでしょう。書くところが違うわ」`);
    lines.push(`「${sp?sp+'の手筋は':'あの手筋は'}分かっているの。分かっていて——……ええ。分かって、います」`);
    lines.push('「いま丁寧になったのは、癖。昔の職場の癖よ。……深い意味は、ありません」');
    heart='（言葉が戻る。戻る先が、あちら側なのが、いちばん困る）';
  }else if(tier==='yield'){
    lines.push(`「……${c.climax}回。ええ、数えていました。数えるのも、あちらでの仕事でしたから」`);
    lines.push(`「${sp?sp+'の手順は':'手順は'}先に申し上げたはずです。申し上げたとおりに、なりました。……予告どおりですので、驚くには当たりません」`);
    lines.push('「年上らしく、と思っているのですけれど。身体のほうが、その、……先に、覚えていて」');
    heart='（読めている。読めているのに、身体がその手順を待っている）';
  }else{
    lines.push(`「${c.captures}回。……はい。数は、合っております」`);
    lines.push('「構える前に、姿勢が。あちらで教わった受け方です。……受ける形が、身体に」');
    lines.push('「あの子たちには、……見せないでください。お願いします。……お願い、します」');
    heart='（帰りたいのではない。帰り方だけが、まだ残っている）';
  }
  if((c.ab.hypno||0)>0 && tier!=='crave') lines.push('「塔？ あれは古い型ね。……古い型に、二度掛かるものではないのだけれど」');
  if((c.ab.hypnolv||0)>0) lines.push('「仕組みは説明できます。掛かる側に回ると、説明は何の役にも立ちません」');
  if((c.traits.musk||0)>0) lines.push('「この臭いの中で働いていたの。……働いて、いました。ずっと」');
  return {lines, heart, tier};
}

const REVIEW_BY={ freila:{r:reviewFreila, s:selfFreila}, kuu:{r:reviewKuu, s:selfKuu}, yamiko:{r:reviewYamiko, s:selfYamiko} };

/* codex.js の heroReview / heroSelfEval から呼ばれる(ルミナ以外) */
function heroReviewOther(id){
  const F=REVIEW_BY[id]; if(!F) return heroReviewFallback(id);
  const c=titleCtx(id), tier=fallTier(id);
  const sp=c.topSp?MONSTERS[c.topSp].name:null;
  return F.r(c, tier, sp, stageName(c.body,FALL_BODY_STAGES), stageName(c.mind,FALL_MIND_STAGES));
}
function heroSelfEvalOther(id){
  const F=REVIEW_BY[id]; if(!F) return {lines:[], heart:'', tier:fallTier(id)};
  const c=titleCtx(id), tier=fallTier(id);
  return F.s(c, tier, c.topSp?MONSTERS[c.topSp].name:null);
}
/* 名簿に無い子(将来の追加)向けの、素っ気ない記録 */
function heroReviewFallback(id){
  const c=titleCtx(id), nm=(HEROES[id]||{}).name||id;
  return ['観測対象: '+nm+'。通算'+c.runs+'戦、捕獲'+c.captures+'回、絶頂'+c.climax+'回。筆はまだ、この対象の書き方を決めていない。'];
}

/* ================= v5.8 称号のヒロイン別 =================
   称号の文はルミナの像(星・光・守り手・聖女・街の灯)で書かれている。
   数字だけ各人ぶんにしても、名前がルミナのままでは記録にならないので、
   名前と——ルミナ固有の像を含む——本文を差し替える。
   `long` は「彼女」で通る中立の文が多いので、必要な所だけ上書きする。 */
const TITLE_BY={
  freila:{
    star:{name:'前を持つ者', desc:'助っ人として先に立つ役目の、いちばん古い呼び名。彼女はこれを、まだ一度も疑ったことがない。'},
    unfallen:{name:'消えない火'},
    hunter:{name:'薪を絶やさぬ者'},
    kingslayer:{name:'王を焼いた者', desc:'夜の統率者を一度でも焼き払った火。王は、焼かれたことを覚えていない。'},
    fivenights:{name:'五夜を越えた火', desc:'五度の夜明けを見た。見るたびに、彼女は刃の欠けを数え直した。'},
    bind1:{name:'刃を持つ腕の、蟲の縄目', desc:'踏み込むための腕と脚が、蟲の縄目として使われた回数。一線は、一度目に越えている。'},
    bind2:{name:'読み切って、蔦の寝台'},
    bind3:{name:'縛られて息を継ぐ火'},
    charm1:{name:'刃の鈍った火'},
    charm2:{name:'種族に焦がれる火'},
    charm3:{name:'火の花嫁', long:'魅了拘束の最中にスタミナが尽き、縋りついた腕がそのまま降参の形になった敗北。前を持つと決めた者が、夜側に嫁いだ夜の記録。'},
    body1:{name:'火の身に、甘い霧'},
    body2:{name:'前を持つはずの、崩れる膝', desc:'戦場で十度、脚を止めて震えた身体。前を持つという役目は、もう膝のほうには届いていない。'},
    body3:{name:'数を言わなくなった火'},
    hypno1:{name:'電波の届く火'},
    deny1:{name:'待たされる火'},
    deny2:{name:'栓を抜かれて燃える火', desc:'待たされ、抜かれ、深く達する。その手順を身体が覚えた。役目の名は、待っている間だけ思い出される。'},
    possess1:{name:'自分の手に負けた火'},
    watch1:{name:'見られている火'},
    suit1:{name:'纏われた火'},
    hypno2:{name:'瞳に従う火'},
    self1:{name:'人目を忘れた火'},
    beam1:{name:'照らされて咲く火'},
    musk1:{name:'雄の匂いに酔う火'},
  },
  kuu:{
    star:{name:'測る者', desc:'届く距離を先に測る役目の、いちばん古い呼び名。彼女はこれを、まだ一度も疑ったことがない。'},
    unfallen:{name:'溶けない氷'},
    hunter:{name:'数え終えた者'},
    kingslayer:{name:'王を止めた者', desc:'夜の統率者を一度でも止めた冷気。王は、止められたことを覚えていない。'},
    fivenights:{name:'五夜を越えた氷', desc:'五度の夜明けを見た。見るたびに、彼女は溶けた分を目盛りに書き足した。'},
    bind1:{name:'測る腕の、蟲の縄目', desc:'距離を測るための腕と脚が、蟲の縄目として使われた回数。一線は、一度目に越えている。'},
    bind2:{name:'測り違えて、蔦の寝台'},
    bind3:{name:'縛られて数えるのをやめた氷'},
    charm1:{name:'手加減という名の誤差'},
    charm2:{name:'種族に懐く氷'},
    charm3:{name:'氷の花嫁', long:'魅了拘束の最中にスタミナが尽き、縋りついた腕がそのまま降参の形になった敗北。距離を測る者が、測るのをやめて嫁いだ夜の記録。'},
    body1:{name:'冷えた身に、甘い霧'},
    body2:{name:'測れなくなった身体', desc:'戦場で十度、脚を止めて震えた身体。測るという仕事は、もう身体のほうには届いていない。'},
    body3:{name:'数えるのをやめた氷'},
    hypno1:{name:'電波の届く氷'},
    deny1:{name:'待たされる氷'},
    deny2:{name:'栓を抜かれて溶ける氷', desc:'待たされ、抜かれ、深く達する。その手順を身体が覚えた。数える癖は、待っている間だけ戻ってくる。'},
    possess1:{name:'自分の手に負けた氷'},
    watch1:{name:'見られている氷'},
    suit1:{name:'纏われた氷'},
    hypno2:{name:'瞳に従う氷'},
    self1:{name:'人目を忘れた氷'},
    beam1:{name:'照らされて咲く氷'},
    musk1:{name:'濃度に酔う氷'},
  },
  yamiko:{
    star:{name:'渡ってきた者', desc:'夜側で生まれ、光の側へ渡った者の呼び名。彼女はこれを、まだ一度も返上していない。'},
    unfallen:{name:'明けない夜'},
    hunter:{name:'群れを掃く者'},
    kingslayer:{name:'王の作法を返した者', desc:'夜の統率者を一度でも退けた者。かつて同じ側にいた者に退けられたことを、王は覚えていない。'},
    fivenights:{name:'五夜を越えた影', desc:'五度の夜明けを見た。見るたびに、彼女は朝の眩しさに慣れられなかった。'},
    bind1:{name:'夜側を知る腕の、蟲の縄目', desc:'かつて縄目を掛ける側にあった腕と脚が、蟲の縄目として使われた回数。一線は、一度目に越えている。'},
    bind2:{name:'手筋を知って、蔦の寝台'},
    bind3:{name:'縛られて作法に戻る者'},
    charm1:{name:'情の移った渡り者'},
    charm2:{name:'種族に馴染む影'},
    charm3:{name:'里帰りした花嫁', long:'魅了拘束の最中にスタミナが尽き、縋りついた腕がそのまま降参の形になった敗北。渡ってきた者が、渡ってきた先から帰った夜の記録。'},
    body1:{name:'慣れた身に、甘い霧'},
    body2:{name:'作法を知る、崩れる身体', desc:'戦場で十度、脚を止めて震えた身体。手順を知っていることは、止められることではない。'},
    body3:{name:'数えるのが仕事だった者'},
    hypno1:{name:'電波の届く影'},
    deny1:{name:'待たされる者'},
    deny2:{name:'栓を抜かれて崩れる影', desc:'待たされ、抜かれ、深く達する。その手順を身体が覚えた。手順は、こちら側でも同じだった。'},
    possess1:{name:'自分の手に負けた者'},
    watch1:{name:'見られる側に回った者'},
    suit1:{name:'纏われた影'},
    hypno2:{name:'瞳に従う者'},
    self1:{name:'人目を忘れた者'},
    beam1:{name:'照らされて咲く影'},
    musk1:{name:'雄の匂いに帰る影'},
  },
};
/* 種族別の敗北称号。ルミナ以外は、まだ一人ずつ書き下ろしていないので、
   その子の像に合う型で名づける(ルミナの「聖女」「星」を借りない) */
/* v6.0 種族別の敗北称号を、四人ぶん書き下ろした。
   v5.8 までは三人ぶんが「名前＋に二度焼き損ねた火」のような雛形だったので、
   相手の性質が名前に一つも入っていなかった。★雛形は最後の受け皿としてだけ残す */
const SPECIES_TITLE_BY={
  freila:{
    beamer:"振りかぶる前に落ちた焔",
    bonesoldier:"斬るほど増える骨に燃え尽きた火",
    bossgazer:"三つを一度に潰せない焔",
    core:"根に繋がれたまま消えた焔",
    coreling:"幼い塊に熱を持ち去られた火",
    dreamtree:"根に繋がれたまま眠る熾火",
    echoer:"己の嬌声に足を取られた火",
    eye:"強がりを記録された焔",
    firstslug:"焼くほど太らせた熾火",
    flower:"花粉に芯を湿らされた熾",
    frostbud:"冷えを溶かしきれない火種",
    gallery:"見られて崩れる強がりの火",
    gas:"乾かすほど濃くなった雲の焔",
    gazer:"睨み返して呑まれた焔",
    ghost:"掴めぬものに火を空振った熾",
    ghosthand:"刃を握る手に裏切られた火",
    glyphmite:"自分の紋に燃やされた焔",
    gobking:"臭いに巻かれて燃え残った熾",
    goblin:"雄の雲に空気を奪われた焔",
    gtent:"四肢を取られて振れぬ火",
    guardian:"石は焼けないと知った火",
    hand:"斬っても減らぬ手の中の熾",
    heartroot:"根に吸われて厚みになる火",
    hugcap:"湿った襞に燻された熾",
    imp:"安い挑発で焚きつけられた熾",
    inyoku:"届かぬ空へ運ばれた火",
    leech:"羽虫に熱を吸われ続けた焔",
    lethemoth:"誰を庇うのか忘れた火",
    lurecap:"見分ける前に絡め取られた火",
    miretent:"媚薬の沼に浸けられた熾",
    mirrorling:"映りには火が届かない熾",
    mirrorqueen:"水鏡に映って消えた火",
    mistslime:"内側に回られて熾らない焔",
    moth:"粉に巻かれて点かぬ火",
    mouth:"踏み込んだ先が口だった火",
    nevermet:"初対面のまま負ける焔",
    nichelord:"自分の形の窪みに沈んだ熾",
    pot:"壺の中で燃え尽きぬ熾",
    runemage:"焼く側から焼かれた側へ回った火",
    seatflesh:"前に立てず腰かけた熾火",
    sentinel:"輪をひとつも割れなかった焔",
    serpent:"踏み込みを封じられた焔",
    silkmite:"糸を焼き切れなかった熾",
    slime:"全身を塞がれて立ち消えた焔",
    slimeking:"王の粘りに鎮められた焔",
    slug:"粘りに火口を塞がれた熾",
    slugqueen:"甘い脈で消し止められた火",
    spore:"痺れた指から落ちた焔",
    stiller:"振り払う手が遅れた熾火",
    succubus:"燃え上がれず燻り続けた熾",
    succuqueen:"口づけで熾を抜かれた火",
    suiyou:"水の腕に消し止められた火",
    tallykeeper:"刻まれた分だけ効いた熾火",
    vampi:"薪を吸い尽くされた焔",
    worm:"掌を巻かれて火を出せない熾",
    yamiboss:"回り込まれて焚き損ねた焔",
  },
  kuu:{
    beamer:"一秒を測り切れない氷",
    bonesoldier:"湧く数を計算から外した氷",
    bossgazer:"三つの拍を取り違えた氷",
    core:"脈の間合いを測り違えた氷",
    coreling:"湧く数に追いつけない氷",
    dreamtree:"香りの効きを侮った氷",
    echoer:"偽の声を本物と数えた霜",
    eye:"測る側から数えられた氷",
    firstslug:"削った分だけ濃くした氷",
    flower:"待ち伏せの半径を外した霜",
    frostbud:"冷たさを数に入れ忘れた氷",
    gallery:"視線の本数を読み違えた氷",
    gas:"雲の濃度を読み違えた霜",
    gazer:"視界の扇を読み違えた氷",
    ghost:"掴めないものを数に入れ忘れた氷",
    ghosthand:"自分の手に数を乱された氷",
    glyphmite:"紋の数を数え損ねた氷",
    gobking:"臭いの届く縁を踏み越えた氷",
    goblin:"湧く数を勘定し損ねた霜",
    gtent:"鞭の届く先を読み損ねた氷",
    guardian:"動かぬ的を測り損ねた氷",
    hand:"手の数を数え切れなかった氷",
    heartroot:"勘定に無い分を吸われた氷",
    hugcap:"抜け出す時間を測り損ねた氷",
    imp:"軽口に数を見失った氷",
    inyoku:"高さを目盛りに入れ忘れた氷",
    leech:"吸着点を三つまで許した霜",
    lethemoth:"数えた端から消えていく霜",
    lurecap:"光の数を読み違えた氷",
    miretent:"届く長さを見誤った氷",
    mirrorling:"実像と映りを取り違えた氷",
    mirrorqueen:"凍らせ損ねた水鏡の氷",
    mistslime:"外周しか固めていない氷",
    moth:"粉の濃さを測り違えた氷",
    mouth:"壁の一枚と見積もった氷",
    nevermet:"数だけが覚えている氷",
    nichelord:"寸法の合いすぎた氷の型",
    pot:"動かぬ物と見積もった氷",
    runemage:"退がる先まで数えられた氷",
    seatflesh:"座高まで測り取られた霜",
    sentinel:"輪の間合いを外した氷",
    serpent:"滑る速さを見誤った霜",
    silkmite:"残る糸を数え落とした氷",
    slime:"粘りの速さを測り違えた氷",
    slimeking:"遅れを勘定に入れ忘れた氷",
    slug:"遅さしか測れなかった氷",
    slugqueen:"脈の間隔を数え違えた霜",
    spore:"痺れて刻みの狂った氷",
    stiller:"遅れを勘定に入れなかった氷",
    succubus:"残り秒を数えさせられた氷",
    succuqueen:"残り一度を数え違えた氷",
    suiyou:"同じ水に読み負けた氷",
    tallykeeper:"数えられる側になった氷",
    vampi:"目減りだけを数えていた氷",
    worm:"絡む本数の見積もりを外した氷",
    yamiboss:"影が溶けて目盛りが消えた氷",
  },
  yamiko:{
    beamer:"一条の光に暴かれた夜",
    bonesoldier:"余力だけ削られて座り込む闇",
    bossgazer:"どの眼から伏せるか迷った夜",
    core:"古巣の心臓に膝を折った夜",
    coreling:"落とし子に足元を掬われた夜",
    dreamtree:"夢の底で年嵩を忘れた影",
    echoer:"取り繕う前の声が響く闇",
    eye:"瞼のない眼に晒された影",
    firstslug:"格下に構えを崩された夜",
    flower:"花弁に脚を縫い留められた影",
    frostbud:"動かぬ芽に足を止めた影",
    gallery:"囲まれて姉の顔が剥げた闇",
    gas:"息を止めていられなかった夜",
    gazer:"構えたまま瞳に落ちた影",
    ghost:"同じ闇の手に撫でられた影",
    ghosthand:"己の腕が味方を辞めた夜",
    glyphmite:"己の紋に追われる夜の影",
    gobking:"雄の雲に呑まれた夜の余裕",
    goblin:"格下の輪に飲まれた夜",
    gtent:"構えごと宙へ攫われた影",
    guardian:"動かぬものに構え負けた影",
    hand:"這う手に構えを解かれた影",
    heartroot:"夜側を知る者の、知らぬ供物",
    hugcap:"撫でられ続けて解けた夜の作法",
    imp:"年下の口に言い負かされた影",
    inyoku:"頭上を取られて崩れた夜",
    leech:"たかが羽虫に解かれた夜の構え",
    lethemoth:"年上らしさだけ残った夜",
    lurecap:"夜側の手口に釣られた影",
    miretent:"涼しい顔のまま沼へ運ばれた影",
    mirrorling:"影にだけ許した夜の姉",
    mirrorqueen:"鏡面に夜側を映された影",
    mistslime:"内側まで通してしまった夜",
    moth:"鱗粉に酔って濁った影",
    mouth:"背を預けた壁が口だった夜",
    nevermet:"名乗られるたび崩れる夜",
    nichelord:"誘われて踏み込んだ夜の影",
    pot:"壺の縁に据えられた影",
    runemage:"覚えのある紋に伏せられた影",
    seatflesh:"椅子に解けた夜の構え",
    sentinel:"降り口ごと囲われた影",
    serpent:"脚から崩されていく夜",
    silkmite:"糸に絡んで構えを崩した闇",
    slime:"余裕ごと包み込まれた夜",
    slimeking:"身動きごと構えを奪われた影",
    slug:"ぬめりに余裕を溶かされた影",
    slugqueen:"女王の前に膝を折った夜",
    spore:"痺れの中で座り込んだ夜",
    stiller:"構えだけが遅れて来る夜",
    succubus:"教えた側の、焦らされる夜",
    succuqueen:"口づけで年上の顔を落とした夜",
    suiyou:"水に足元を掬われた夜",
    tallykeeper:"かつて刻む側だった影",
    vampi:"かつての主に吸われた影",
    worm:"両腕を絡め取られた影",
    yamiboss:"元いた眠りへ戻された夜",
  },
};
const SPECIES_TITLE_FORM={
  freila:n=>n+'に二度焼き損ねた火',
  kuu:n=>n+'に二度測り違えた氷',
  yamiko:n=>n+'に二度沈んだ影',
};
/* heldTitles から呼ばれる: その子ぶんの名前と本文へ差し替える */
function titleFor(t, hero){
  if(!hero || hero==='lumina') return t;
  const B=TITLE_BY[hero]; if(!B) return t;
  const o=B[t.id]; if(!o) return t;
  const r=Object.assign({}, t);
  if(o.name) r.name=o.name;
  if(o.desc) r.desc=o.desc;
  if(o.long) r.long=o.long;
  return r;
}
function speciesTitleFor(monId, hero){
  if(MONSTERS[monId] && MONSTERS[monId].base) monId=MONSTERS[monId].base;   /* v6.0 称号も base の種で付く */
  const nm=(MONSTERS[monId]||{}).name||monId;
  if(!hero || hero==='lumina') return (typeof SPECIES_TITLES!=='undefined' && SPECIES_TITLES[monId])||(nm+'の戦利品');
  /* v6.0 書き下ろしがあればそれを。無ければ雛形へ落とす */
  const W=SPECIES_TITLE_BY[hero];
  if(W && W[monId]) return W[monId];
  const f=SPECIES_TITLE_FORM[hero];
  return f?f(nm):(nm+'の戦利品');
}
