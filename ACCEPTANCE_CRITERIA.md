# AMATERAS — 受入基準と検証の対応

2026-09-07。実行結果・未検証範囲は[検証報告](IMPLEMENTATION_REPORT.md)。固定データによる自動試験と、実通信の接続試験を分離します。

| 基準 | 検証 |
| --- | --- |
| 公式2026年コード、重複・解除・切替・未知コード、古い発表の継続 | tests/data.test.ts |
| 正常ゼロ件、取得失敗、最終成功保持、独立キャッシュ | tests/api.test.ts / events.test.ts、E2E |
| 雨雲時刻順・欠損・予測除外、偶数倍率の位置対応 | data.test.ts / radar-tiles.test.ts |
| 読込待ち、競合、先読み失敗、100フレームで最大3source/layer | playback.test.ts |
| 同一区域の複数警報、低分類の選択で重大度が下がらない、1,000件の集約 | fx.test.ts、E2E密度試験 |
| 未知コードに独自の高さを付けない | fx.test.ts |
| DEM正負・欠損、穴・三角形予算、頂点別標高と未読込面の省略 | data.test.ts / fx.test.ts / terrain-fallback.test.ts |
| 地震の実形式、経緯度順、更新・訂正・取消、発生時刻欠損、EEW除外 | events.test.ts、出典付き固定資料 |
| 台風の実XML、予報更新、非対称風域、km/海里/m/s/ノット、取消・通常発表 | events.test.ts |
| 台風現行一覧と詳細の不一致、全詳細失敗、活動終了、再取得抑制 | events.test.ts |
| 全端末の初期3D、手動設定保存、品質、選択・テーマ復元 | tests/e2e/fx.spec.ts |
| 4画面サイズ、検索、モーダル、スマホのシートと時刻の排他・地震から台風への連続選択 | tests/e2e/app.spec.ts / fx.spec.ts |
| DEM失敗時の2D・再試行、reduced-motionの停止 | E2E |
| 20回切替のレイヤー数・canvas数・レーダー上限 | E2E、scripts/measure-fx.mjs |
| 再生中のJSヒープとWebGL資源の推移 | scripts/measure-fx.mjs（限定時間の測定） |
| 実データ8接続と正常な位置・単位 | scripts/smoke-live.mjs、ViteとWorkerを別ログ化 |
| 型安全性・本番生成・公開準備 | pnpm check / test / test:e2e / build / worker:check |

比較画像の模擬気象には常時MOCK DATAを表示します。E2Eでは地図・DEMも固定入力に置き換えて再現性を確保。別の画面確認では実際の背景・DEMを使います。これらを実気象との接続成功の根拠にしません。

実機iOS/Android、全ブラウザ互換性、数時間のGPU/VRAM計測、全国すべての地形・区域の照合、Cloudflare公開負荷は未検証。WebGLオブジェクト数はVRAMバイト数ではなく、RAF間隔はGPU描画時間ではありません。
