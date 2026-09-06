# AMATERAS

日本全国の雨雲・気象警報、直近24時間の地震、現行の台風を確認する全面地図型Webアプリです。実標高の3D地形に警報の立体面とイベントを重ねます。React / TypeScript / Vite / MapLibre GL JS / deck.glと、Cloudflare Workers向けの共通APIで動作します。

## 起動

Node.js 22.12以降（検証環境26.5.1）、pnpm 10を使用します。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

[開発サーバー](http://127.0.0.1:5186/)を開きます。APIキーは不要。地図・気象情報・標高にはインターネット接続が必要です。

```sh
pnpm check           # TypeScript
pnpm test            # Vitest
pnpm test:e2e        # Playwright・4画面サイズ
pnpm build           # 本番用dist
pnpm preview         # 共通API付き本番ビルド
pnpm smoke:live      # dev起動中の実データ8接続
pnpm data:sync       # 公式地域索引・警報コード・地図スタイルの再取得
pnpm worker:check    # 公開しないdry-run（先にbuild）
pnpm worker:dev      # Workersローカル環境 http://127.0.0.1:8787/
```

ブラウザ自動テストの初回準備は `pnpm exec playwright install chromium`。このWindows環境では引数変換の問題を避け、同じCLIを `node node_modules/@playwright/test/cli.js install chromium` で使用しました。Playwright設定は今回導入したプロジェクト内Chromiumがあれば使用し、それ以外は通常のPlaywrightブラウザを使います。

## 操作

- 初期表示は全端末で3D＋バランス（立体品質Auto）。手動の2D／3Dと品質は端末に保存します。
- 警報は区域の最も強い公式分類で集約。選択すると輪郭・ラベル・詳細を強調します。立体の高さは分類の強調で、物理的な高度ではありません。
- 「地震」タブで震央・発生時刻・M・最大震度を確認。選択時の短いパルスは発生情報の強調で、地震波の到達範囲ではありません。
- 「台風」タブで実況中心、取得済み実況経路、予報点・予報円、強風域・暴風域を確認。実線と破線で実況と予報を区別します。
- 地名検索は都道府県名付き。上下キー・Enter・Escapeに対応します。
- 雨雲は過去約3時間の観測を再生・停止・選択。「最新」で最新観測へ戻ります。雨雲の履歴中も警報・台風は最新取得、地震は直近24時間です。
- 「表示」で省電力／バランス／高画質を選択。描画解像度、地形精度、陰影、道路・建物の詳細、立体品質、アニメーションを個別調整できます。[グラフィック設定とiGPU向け調整](GRAPHICS_SETTINGS.md)を参照。
- スマホは共通の下部シートを使用。「時刻」で雨雲タイムラインを開きます。
- 「出典とデータの状態」で4系統の取得状態と時刻を確認します。標高の取得失敗時は2Dへ戻り、表示される操作から再試行できます。

全国表示では警報相当を優先し、注意報区域はズーム6以上または選択時に取得します。一覧の集計は全国の「区域×警報種別」で、地震・台風を加算しません。先頭80件から追加表示でき、区域不一致の情報も一覧に残ります。

AutoはスマホでLow、その他でMediumから開始し、負荷の継続時に品質を下げます。Lowでも実地形・区域面・輪郭・静止マーカーを維持します。OSの「動きを減らす」設定ではパルス・カメラアニメーション・ティッカーを停止します。

## 開発用シナリオと計測

`pnpm dev`のみ、`/?scenario=quiet`、`rainy`、`severe` が使えます。気象・イベント情報は検証用で、常時 **MOCK DATA** を表示します。`&density=1000` はsevereの警報を1,000件にし、`&fault=radar|warnings|earthquakes|typhoons` は各取得失敗を再現します。本番ビルドでは指定を無視し、模擬情報へ自動移行しません。

```sh
node scripts/capture-fx.mjs   # 3シナリオ×4画面、地形・シート画像
node scripts/measure-fx.mjs   # 20回切替・連続再生、描画資源とJSヒープ
node scripts/capture-graphics.mjs # 4画面＋高DPIのプリセット比較
```

severeに `&area=1340100` のような公式区域コードを付けると、指定地域の警報面を検証できます。

どちらもdev起動中に使用し、結果は `artifacts/fx/` に保存します。計測値の意味・制約は検証報告を参照してください。接続先は環境変数 `AMATERAS_URL` で変更できます。

luma.glの終了処理には[同梱パッチ](patches/README.md)を適用しています。ロックファイルとパッチファイルを一緒に保持してください。

## 公開準備

`wrangler.jsonc` のASSETSがdistを配信し、`/api/*` は共通APIが処理します。静的ホスティングだけではAPIが動きません。今回のFX実装では公開デプロイ・追加コミット・プッシュを行いません。

WindowsでWranglerのログ保存が制限される場合：

```powershell
$env:WRANGLER_LOG_PATH="$PWD/artifacts/wrangler.log"
$env:WRANGLER_REGISTRY_PATH="$PWD/artifacts/wrangler-registry"
$env:WRANGLER_SEND_METRICS='false'
pnpm worker:check
```

Workers版の実接続試験は、`pnpm worker:dev` 起動後に `$env:AMATERAS_URL='http://127.0.0.1:8787'` を設定して `pnpm smoke:live` を実行します。

## 文書

- [現在の仕様](PROJECT_SPEC.md)、[3D仕様と適用範囲](AMATERAS_3D_EFFECTS_SPEC.md)
- [技術構成](TECH_ARCHITECTURE.md)、[決定事項](DECISIONS.md)、[データ台帳](DATA_SOURCES.md)
- [検証結果と制約](IMPLEMENTATION_REPORT.md)、[受入基準](ACCEPTANCE_CRITERIA.md)、[ロードマップ](MVP_ROADMAP.md)
- [デザイン](DESIGN.md)、[ブランド](BRAND.md)、[参考UI分析](REFERENCE_UI_ANALYSIS.md)

比較画像は `artifacts/fx/`、実接続結果は `artifacts/live-smoke*.json`。ローカル検証成果物は.gitignoreの対象です。AMATERASは公開情報を加工表示し、独自の予報・警報を発表しません。
