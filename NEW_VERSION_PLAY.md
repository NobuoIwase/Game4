# Game4 新版テストプレイ

新版ブランチ: `claude/ai-girl-deck-battle-game-1k94l5`

## ブラウザで起動

https://raw.githack.com/NobuoIwase/Game4/claude/ai-girl-deck-battle-game-1k94l5/index.html

このURLは新版ブランチの `index.html` を、そのブランチ内のJS・画像・その他アセットと一緒にブラウザ配信するテスト用URLです。

## 確認

開いたあと、ブラウザの開発者コンソールで以下を確認できます。

```js
Game4QualityPatch.version
```

`1.3.0` と出れば今回のAI・バランス監査・描画強化パッチが読み込まれています。

監査ログ:

```js
Game4QualityPatch.audit()
Game4QualityPatch.samples()
Game4QualityPatch.joinAudit()
```
