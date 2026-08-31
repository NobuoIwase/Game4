'use strict';
/* ============================================================
   scenes.js — シーンテキストの受け口(フック)
   ------------------------------------------------------------
   本ファイルはシステム側の「差し込み口」のみを定義する。
   本文テキストはここには書かず、別途の執筆パイプラインが
   このスキーマに沿ってデータを追加する。

   スキーマ:
     SCENES.pin[<monsterId>] = {
       beats: ['拍1','拍2',...],
     };
       押し倒し(pinned)中、画面下のテキストボックスに beats が
       2.6秒ごとに順繰りで表示される。key=押し倒しの主のid。
       'default' はフォールバック。未定義なら何も表示しない。

     SCENES.capture[<monsterId>] = {
       title: '見出し',
       beats: ['拍1','拍2',...],
     };
       敗北(捕獲)確定後のリザルトに表示。key=とどめ/押し倒しの主のid。

   敗北スチル(画像)は assets/cg/ に配置する(ui.js tryLoadCG参照):
     assets/cg/defeat_<monsterId>.png → assets/cg/defeat.png の順で探す。
   ・表示側は beats/画像を流すだけで、内容には関知しない。
============================================================ */
const SCENES={
  pin:{
    // default: { beats:['…'] },
  },
  capture:{
    // default: { title:'…', beats:['…'] },
  },
};
function sceneFor(kind,id){
  const t=SCENES[kind]||{};
  return t[id]||t.default||null;
}
