# Changelog

## Phase 1.1

- `completed` 状態の切替を追加し、合計・完了・残りの件数を正しく集計するように変更。
- `favorite: boolean` を追加。カード上部の `★` / `☆` で切り替え、LocalStorageへ保存。
- 描画処理を `renderCard()`、`renderSummary()`、`renderEmpty()` に分割。
- 空状態やダイアログなどの表示文言を定数化。
- LocalStorageの読み込みと `normalizeCharacter()` を整理し、旧データの `id`、`completed`、`favorite`、`exp` を安全に移行。
- 保守しやすいコメントを追加し、UUIDを基準とする検索中の編集・削除を維持。
- READMEをPhase 1.1の機能、データ構造、利用方法、アーキテクチャに更新。
