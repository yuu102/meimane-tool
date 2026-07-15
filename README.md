# めいまねつーる — Phase 3.2

ブラウザだけで使えるキャラクター／デイリークエスト管理ツールです。ES Modules対応の静的サイトとして、GitHub PagesまたはローカルHTTPサーバーで利用します。

## 起動方法

ES Modulesを使用しているため、`file://` で `index.html` を直接開くと、ブラウザのセキュリティ制限により動かない場合があります。GitHub Pagesへ公開して利用するか、ローカルHTTPサーバーから開いてください。

例: プロジェクトフォルダで `python -m http.server 8000` を実行し、`http://localhost:8000/` をブラウザで開きます。

## 使い方

1. 右下の `＋` でキャラクターを追加します。職業を選ぶと系列は自動設定されます。
2. 前日終了EXPには0〜100の割合を入力します。`45.67` は `EXP 45.67%` と表示されます。
3. カードを選ぶと詳細画面が開きます。デイリーのチェック、キャラ編集、デイリー編集はここから行います。
4. 全デイリーがチェック済みになると自動で「完了」になり、どれかを外すと「未完了」に戻ります。
5. 検索欄の下から並び替え、JSONバックアップ／復元、設定を利用できます。

## 設定

設定はLocalStorageキー `meimane.settings` に保存され、再読み込み後も維持されます。

```json
{
  "sortMode": "favorite",
  "autoDailyReset": true,
  "lastResetDate": "2026-07-15"
}
```

- `sortMode`: `default`、`favorite`、`level`、`name` のいずれか。
- `autoDailyReset`: `true` なら日付が変わって最初にアプリを開いたとき、すべてのデイリーを未チェックへ戻します。
- `lastResetDate`: 最後に自動リセットを実行した端末ローカル日付です。同じ日に複数回起動してもリセットしません。

自動リセット時はデイリー完了状態を解除し、キャラクターの完了状態を再計算して `meimane.characters` へ保存します。

## ファイル構成

```text
meimane-tool/
├── index.html       # type="module" で app.js を読み込む画面
├── style.css         # 現在使用中のゲーム風UIスタイル
├── app.js            # 初期化・画面イベント・各モジュールの接続
├── storage.js        # LocalStorageのキーとJSON読み書き
├── settings.js       # 設定の正規化と保存
├── characters.js     # キャラクターの移行・CRUD・保存
├── dailies.js        # デイリー移行・完了判定・日次リセット
├── jobs.js           # 職業一覧・系列の自動判定
├── render.js         # カード・件数の描画
├── dialogs.js        # キャラ／詳細／デイリー／設定ダイアログ
├── backup.js         # JSONバックアップ・復元
├── utils.js          # UUID・入力正規化・ローカル日付
├── README.md
└── CHANGELOG.md
```

## 既存データ互換性

キャラクターデータは従来どおり `meimane.characters` に保存します。IDなしデータ、旧 `exp`、`daily.progress / goal`、旧職業名、旧JSON配列形式のバックアップを読み込めます。

- `previousExp` は0〜100%へ丸め、小数第2位までに正規化します。
- 旧 `daily` は個別の `dailies[]` へ移行します。
- 一覧外の旧職業名は編集時に「既存職業」として保持します。
- JSONバックアップは従来形式と `{ "characters": [] }` 形式の両方を復元できます。
