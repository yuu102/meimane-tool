# Changelog

## Phase 2

- EXPバー、現在EXP、次レベルまでの必要EXPをカードに追加。
- デイリー進捗（初期値 `0 / 3`）と、カード上の増減ボタンを追加。
- 完了カードの緑色表示、お気に入りカードの金色強調表示を追加。
- カードのホバー浮遊アニメーション、フォーカス表示、ゲーム風のカード・EXPバー表現を追加。
- 既存のデイリーデータを `daily.progress` / `daily.goal` 形式へ正規化し、既存データ・JSON復元との互換性を維持。

## Phase 1.2

- お気に入り順、Lv順（降順）、名前順（昇順）の表示ソートを追加。
- JSONバックアップのダウンロード機能を追加。
- JSON復元機能を追加。Phase 1.2形式と旧形式の配列JSONに対応し、重複UUIDは復元時に補正。
- 検索欄の下に、HTML/CSSを変更せず操作バーを動的に追加。

## Phase 1.1

- `completed` 状態の切替を追加し、合計・完了・残りの件数を正しく集計するように変更。
- `favorite: boolean` を追加。カード上部の `★` / `☆` で切り替え、LocalStorageへ保存。
- 描画処理を `renderCard()`、`renderSummary()`、`renderEmpty()` に分割。
- 空状態やダイアログなどの表示文言を定数化。
- LocalStorageの読み込みと `normalizeCharacter()` を整理し、旧データの `id`、`completed`、`favorite`、`exp` を安全に移行。
- 保守しやすいコメントを追加し、UUIDを基準とする検索中の編集・削除を維持。
- READMEをPhase 1.1の機能、データ構造、利用方法、アーキテクチャに更新。
