# グラフィック設定とiGPU向け調整

2026-09-07。ユーザー指定の初期設定は「バランス」。7900X内蔵GPUで従来の3Dが重いという報告を基に、地図の描画量を調整できる設定を追加しました。

## 使い方

画面下の「表示」または右上の設定から「描画品質」を開きます。設定は即時反映され、端末に保存されます。個別に変更すると「カスタム」になり、各プリセットを選ぶとその値へ戻ります。保存済みの2D／3Dはプリセットで上書きしません。

| 設定 | 省電力 | バランス（初期） | 高画質 |
| --- | --- | --- | --- |
| 描画解像度 | 50% | 75% | 100% |
| 100%時に対する描画画素数 | 約25% | 約56% | 100% |
| 地形の細かさ | 広域向け | 標準 | 高精細 |
| 地形の陰影 | オフ | オン | オン |
| 道路・建物の詳細 | 簡略 | 通常 | 通常 |
| 立体表現の品質 | Low | Auto | High |
| アニメーション | オフ | オン | オン |

まず「省電力」で試し、地図の文字が粗く感じる場合は描画解像度だけ75%へ上げます。さらに軽くする場合は、画面下の「3D」から2Dへ切り替えられます。雨雲のレーダー更新や気象情報の取得周期を遅くするプリセットではありません。

OSの「動きを減らす」が有効な場合は、プリセットに関係なく演出を静止し、アニメーションの入力を無効にします。画面内にGPUやFPSを推測した表示は出しません。

## 描画への適用

- MapLibreのpixelRatioを変更し、地図canvasだけを低解像度化します。UIと一覧はCSS解像度を維持。画面には実canvasの幅・高さを表示します。
- デバイスのDPIは0.25〜2倍の範囲で採用し、そこへ50／75／100%を掛けます。画素数は辺の比率の二乗です。画素数の削減率はFPSの改善率ではありません。
- 地形精度は使用するDEMの最大zoomを10／12／14に変更します。低い設定では拡大時に低倍率の実標高を使用。MapLibre内部の地形メッシュ分割数を直接変更するものではありません。
- 標高sourceを置換する前に既存地形と陰影を破棄し、FXも再構築します。テーマ変更・2D復帰後も設定を復元します。
- Lowではdeck.glのFXを生成せず、使用中なら破棄します。地形、公式区域の面・輪郭、地震・台風の静止マーカーはMapLibreで維持します。スマホのAutoがLowの場合も同様です。
- 詳細表示オフは細い道路・線路と建物を非表示にします。元のレイヤーvisibilityを記録し、通常設定へ戻すと復元します。
- アニメーションオフはカメラ補間・選択パルス・CSS演出を停止します。雨雲再生は独立したユーザー操作です。
- 保存先はamateras.graphics.v1。形式と値を検証し、破損・未対応の値は安全な初期値へ戻します。旧amateras.fxQualityの手動設定は移行します。その場合、初回表示がカスタムになることがあります。

## 検証

単体テスト79件・E2E 43件成功（重複する負荷試験9件はskip）。型チェック・ビルド・Workers dry-runも成功。保存と旧設定移行、異常値、実canvas画素数、地形精度、陰影、OS設定、テーマ・2D復帰、プリセットの連続切替を確認します。結果は[Vitest](artifacts/graphics/vitest.json)、[Playwright](artifacts/graphics/e2e.json)。

実背景・実DEM＋MOCK DATAで4画面サイズと高DPIを検証。1366×768、DPI 1の地図canvasは次の値でした。

| プリセット | 実canvas | FXレイヤー | 地形 |
| --- | --- | ---: | --- |
| バランス | 819×474 | 1 | 3D |
| 省電力 | 546×316 | 0 | 3D |
| 高画質 | 1093×633 | 1 | 3D |

5条件×3プリセットの15表示でブラウザ例外0、地図canvasは常に1個でした。[実測JSON](artifacts/graphics/comparison.json)。

検証ブラウザが使用したGPUは **AMD Radeon RX 7600（ANGLE / Direct3D11）** です。7900X内蔵GPUでの変更後のFPS、消費電力、長時間のVRAMは未測定です。画素数とFXの削減を確認した結果であり、iGPUで特定のFPSを保証するものではありません。

## 比較画像

- 設定画面：[1920×1080](artifacts/graphics/settings-1920x1080-dpr1.png)、[1366×768](artifacts/graphics/settings-1366x768-dpr1.png)、[768×1024](artifacts/graphics/settings-768x1024-dpr1.png)、[390×844](artifacts/graphics/settings-390x844-dpr1.png)、[高DPI](artifacts/graphics/settings-1366x768-dpr2.png)
- 地図：[省電力](artifacts/graphics/map-performance.png)、[バランス](artifacts/graphics/map-balanced.png)、[高画質](artifacts/graphics/map-quality.png)
- [省電力＋スマホ台風シート](artifacts/graphics/mobile-power-sheet.png)

再現はdev起動後に node scripts/capture-graphics.mjs。成果物はローカルのartifacts/graphicsへ保存します。GRAPHICS_LIVE=1とAMATERAS_URLを設定すると、本番ビルドと実データの確認を分けて記録できます。

## 本番ビルドの実データ確認

ローカルWorker（8787）でも5条件×3プリセットの15表示を確認しました。ブラウザ例外0、地図の取得エラー表示0、MOCK DATAなし。品質切替後も3Dを維持。結果は[実データ確認JSON](artifacts/graphics/live.json)、[省電力の実データ画面](artifacts/graphics/map-performance-live.png)、[スマホ](artifacts/graphics/mobile-power-sheet-live.png)を参照してください。公開デプロイは行っていません。
