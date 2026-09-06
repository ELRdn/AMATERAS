# AMATERAS

日本全国の雨雲と発表中の気象警報・注意報を確認する、全面地図型Webアプリです。React / TypeScript / Vite / MapLibre GL JSと、Cloudflare Workers向けの共通APIで動作します。

## 起動

Node.js 22.12以降（検証環境26.5.1）、pnpm 10を使用します。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

http://127.0.0.1:5186/ を開きます。APIキーは不要。地図・気象情報・標高にはインターネット接続が必要です。

```sh
pnpm test             # Vitest
pnpm check            # TypeScript
pnpm build            # 本番用dist
pnpm preview          # 共通API付き本番ビルドの確認
pnpm smoke:live       # dev起動中の実データ接続検証
pnpm data:sync        # 公式地域索引・警報コード・地図スタイルの再取得
pnpm worker:check     # 公開しないdry-run
pnpm worker:dev       # Workers互換ローカル環境
```

ブラウザ自動テストの初回準備：

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

このWindows環境ではpnpm execの引数が誤変換されたため、同じCLIを `node node_modules/@playwright/test/cli.js install chromium` で実行しました。今回の検証ブラウザはプロジェクト内に保存しています。

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH="$PWD/artifacts/playwright-browsers"
pnpm test:e2e
```

## 操作

- 地名検索：都道府県名で同名地域を区別。上下キー・Enter・Escapeに対応。
- 警報選択：区域へ移動し、対応する公式図形の輪郭とラベルを強調。
- 雨雲：過去約3時間の観測を再生・停止・選択。「最新」で最新観測へ復帰。
- 2D/3D：真上表示と実標高による地形を切替。標高は1.25倍に強調。
- 表示：雨雲の表示・濃さ、地形、テーマを変更。
- スマホ：警報一覧は下部シート。「時刻」でタイムラインを開く。
- 出典・状態：発表・観測時刻と取得時刻を別々に表示。

全国表示では警報相当を優先して区域を描き、注意報区域はズーム6以上または選択時に取得します。一覧の集計は全国の「区域×種別」。先頭80件から追加表示でき、区域不一致も一覧に残ります。

## 開発用シナリオ

pnpm devのみ、`/?scenario=quiet`、`rainy`、`severe` が使えます。雨雲・警報は検証用で、常時 **MOCK DATA** を表示。`&fault=warnings` / `&fault=radar` で取得失敗を検証できます。本番ビルドでは指定を無視し、模擬情報へ自動移行しません。

## 公開準備

設定はwrangler.jsonc。静的ファイルはdist、/api/*はserver/worker.tsが処理します。静的ホスティングだけではAPIが動きません。公開操作は実施していません。

WindowsでWranglerのログ保存が制限される場合：

```powershell
$env:WRANGLER_LOG_PATH="$PWD/artifacts/wrangler.log"
$env:WRANGLER_REGISTRY_PATH="$PWD/artifacts/wrangler-registry"
$env:WRANGLER_SEND_METRICS='false'
pnpm worker:check
```

## 文書

- [現在の仕様](PROJECT_SPEC.md)、[技術構成](TECH_ARCHITECTURE.md)、[決定事項](DECISIONS.md)
- [データ台帳・利用条件](DATA_SOURCES.md)
- [検証結果と制約](IMPLEMENTATION_REPORT.md)、[受入基準](ACCEPTANCE_CRITERIA.md)、[ロードマップ](MVP_ROADMAP.md)
- [デザイン](DESIGN.md)、[ブランド](BRAND.md)、[参考UI分析](REFERENCE_UI_ANALYSIS.md)

比較画像はartifacts/{quiet,rainy,severe}-{幅}x{高さ}.png、実接続結果はartifacts/live-smoke.json。検証成果物・依存関係は.gitignoreの対象です。

AMATERASは公開情報を加工表示し、独自の予報・警報を発表しません。河川単位の氾濫情報など未対応の情報があり、すべての防災情報を網羅するものではありません。
