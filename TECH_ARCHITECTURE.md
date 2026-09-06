# AMATERAS — 実装構成

React 19 / TypeScript / Vite / MapLibre GL JS / 専用CSS。Next.js、deck.gl、Three.jsは導入しません。依存バージョンはpnpm-lock.yamlに固定します。

## 処理の流れ

気象庁 → server/api.ts（検証・正規化・独立キャッシュ）→ Vite middleware または Cloudflare Worker → useSource → App / WeatherMap / RadarPlayer。

OpenFreeMapは背景地図、国土地理院DEMはブラウザのterrain protocolを経てTerrainRGBへ変換します。

## モジュール

- src/data/types.ts：RadarFrame / WarningEvent / SourceHealth / PlaceResult。
- normalize.ts：入力検証、コード変換、区域・電文種別ごとの最新スナップショット、解除処理、重複排除、観測抽出。
- useSource.ts：60秒更新、表示復帰時更新、最終成功保持、時刻による状態再評価。
- WeatherMap.tsx：カメラ・選択・テーマ復元・公式区域取得。同時4件、取得済み図形を再利用。
- RadarPlayer.ts：読込完了後のみ切替、隣接先読み、最大3個のレーダーsource/layer、イベント解除、20秒タイムアウト。
- radarTiles.ts：公式の偶数倍率タイルへ変換。奇数倍率は親タイルの正しい四分区を切り出し、位置と色を保持。
- terrain.ts：符号付き24bit標高と欠損処理、Mapbox TerrainRGB変換。
- fixtures.ts / mockRadar.ts：開発専用。本番ビルドから模擬情報経路を除去。

## API（GETのみ）

| パス                                            | 内容                             |
| ----------------------------------------------- | -------------------------------- |
| /api/radar                                      | 観測フレーム一覧とhealth         |
| /api/warnings                                   | 現行の発表中警報・注意報とhealth |
| /api/health                                     | 上記2系統の状態                  |
| /api/radar/tiles/{base}/{valid}/{z}/{x}/{y}.png | 存在する観測フレームのタイルのみ |
| /api/areas/{7桁区域コード}                      | 公式の市町村等区域GeoJSON        |

任意の外部URLは受け付けません。雨雲の配信zoom4・6・8・10と座標を検証。解除は現行状態から除外します。APIは過去の解除履歴を配信する履歴DBではありません。WarningEvent.statusは現行電文の状態を保持します。

通常キャッシュ60秒、失敗再試行15秒、上流タイムアウト15秒。Workersは最終成功JSONをCache APIに最大24時間保持しますが、永続保存を保証しません。キャッシュもなく取得失敗した場合はSOURCE ERROR。data=[]を単独で正常ゼロ件と判定してはいけません。

## 地形

zoom8以下はdemgm_png、9〜14はdem_png。符号付きcmをmへ復号してMapbox形式に変換。欠損は0mなので局所的な不連続があり得ます。zoom14以上はオーバーズーム。区域は地形に沿うfill/lineとラベルで表示します。

## 公開設定

wrangler.jsoncのASSETSがdistを配信し、run_worker_firstで/api/*をWorkerへ渡します。CSPはselfと必要なOpenFreeMap・地理院接続に限定し、blob workerを許可。秘密情報・アカウント・永続DBは不要です。

pnpm worker:checkはdry-runのみ。Cloudflare実配信、エッジキャッシュ、集中アクセスは公開後に別途検証します。
