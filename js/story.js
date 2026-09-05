'use strict';
/* ============================================================
   story.js — v2.0 物語のテキスト(ストーリーバイブル docs/STORY.md に基づく)
   ------------------------------------------------------------
   prologue        : 初めての出撃の前(序章)
   floors[k].intro : その階層に降り立った導入(潜行ごとに1度)
   floors[k].enter : その階層で彼女が歩きながら零す独り言(吹き出し・22字以内)
   floors[k].descend: 降り口から次へ降りる時
   retry           : 敗北して同じ階層に再挑戦する朝(「§」で変奏を区切る)
   finalEncounter  : 最深部で魔核を目にした時
   ending          : 魔核を討ち、目的を果たした結末
   reset           : 二連敗し、記憶を失って入口に立つ朝
   配列が空なら演出は出ない(本文はワークフローで執筆し、ここへ流し込む)
============================================================ */
const STORY={
  prologue:[],
  floors:[
    {intro:[],enter:[],descend:[]},
    {intro:[],enter:[],descend:[]},
    {intro:[],enter:[],descend:[]},
    {intro:[],enter:[],descend:[]},
    {intro:[],enter:[],descend:[]},
  ],
  retry:[], finalEncounter:[], ending:[], reset:[],
};
function storyFloor(depth){ return STORY.floors[Math.max(0,Math.min(STORY.floors.length-1,(depth||1)-1))]||{intro:[],enter:[],descend:[]}; }
/* retry は「§」で変奏を区切る。1つを選んで返す */
function storyRetry(){
  const groups=[]; let cur=[];
  for(const l of STORY.retry){ if(l.startsWith('§')){ if(cur.length) groups.push(cur); cur=[]; const rest=l.slice(1).trim(); if(rest) cur.push(rest); } else cur.push(l); }
  if(cur.length) groups.push(cur);
  return groups.length?groups[(Math.random()*groups.length)|0]:[];
}
