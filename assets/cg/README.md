# 画像スロット(assets/cg/)

NovelAI等で作った画像をこのフォルダに置くと、ゲーム内の各場面に表示されます。
無いスロットは何も表示されません(エラーにならない)。

## 敗北スチル(リザルト画面)
- `defeat_<モンスターid>.png` … そのモンスターにとどめを刺された時
- `defeat.png` … 汎用フォールバック(現在: ルミナのドット絵を配置済み)

## 戦闘中カットイン(画面右にウィンドウ表示)
- `pin_<モンスターid>.png` → `pin.png` … 押し倒し中
- `charmbind_<モンスターid>.png` → `charmbind.png` … 魅了拘束中
- `climax.png` … 絶頂中

モンスターid: slug / worm / ghost / slime / gas / imp / flower /
goblin / leech / mistslime / gtent / vampi

## ドット化ツール

NovelAIの画像をゲームの雰囲気に合わせてドット絵化できます:

```
python3 tools/pixelate.py 入力.png assets/cg/pin_worm.png --height 208 --colors 24
```

ヒロインのスプライト(戦闘中の見た目)は `assets/sprites/lumina.png`(35×52)。
差し替えると見た目が変わります。ファイルを消すと従来のベクタ描画に戻ります。
