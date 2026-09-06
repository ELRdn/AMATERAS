# AMATERAS — 実装構成

React 19 / TypeScript / Vite / MapLibre GL JS 5.24.0 / deck.gl 9.4.0 / 専用CSS。依存バージョンはpnpm-lock.yamlに固定。Next.js・Three.js・WebGPUは使用しません。

## 処理の流れ

気象庁 → 共通API（検証・正規化・独立キャッシュ）→ Vite middleware または Cloudflare Worker → useSource → App / WeatherMap / RadarPlayer / FxManager。

背景はOpenFreeMap。GSI DEMをブラウザのterrain protocolでTerrainRGBへ変換し、地形と警報メッシュに共用します。deck.glは3D使用時の動的importで読み、MapLibreOverlayのinterleaved方式で1つのWebGL2コンテキストを共有します。

## モジュール

| ファイル | 責務 |
| --- | --- |
| src/data/types.ts | RadarFrame / WarningEvent / SourceHealth / PlaceResult / EarthquakeEvent / TyphoonEvent / GeoEffect / FxQuality |
| src/data/normalize.ts | 警報コード・解除・重複処理、観測雨雲抽出 |
| src/data/events.ts | 地震JSONと台風XMLの検証・訂正・取消・座標・単位・方向の正規化 |
| server/events.ts | 地震・台風の独立キャッシュ、フィード補完、取得集約、部分失敗 |
| src/data/useSource.ts | 60秒更新、表示復帰更新、最終成功保持、取得時刻による状態評価 |
| src/map/WeatherMap.tsx | カメラ・選択・テーマ復元、公式区域取得（同時4件、キャッシュ上限500） |
| src/map/fx/geometry.ts | 最強分類の区域集約、穴を保つ三角形分割・細分化、頂点標高、測地円・非対称風域 |
| src/map/fx/FxManager.ts | 立体面を単一バッチ化、選択パルス、生成・更新・破棄、標高タイル到着時の再構築 |
| src/map/fx/eventLayers.ts | 地形に沿う地震マーカー、台風実況・予報・円・風域、選択連動 |
| src/map/fx/quality.ts / useFxSettings.ts | 品質上限・自動低下、端末保存、動きを減らす設定 |
| src/map/RadarPlayer.ts | 読込後切替、隣接先読み、最大3個のレーダーsource/layer、タイムアウトと解放 |
| src/map/radarTiles.ts / terrain.ts | 雨雲の偶数倍率への対応、符号付きDEM変換 |
| fixtures.ts / eventFixtures.ts / mockRadar.ts | 開発専用シナリオ。本番の通信障害から呼び出さない |

## API（GETのみ）

| パス | 内容 |
| --- | --- |
| /api/radar | 観測フレームとhealth |
| /api/warnings | 現行警報・注意報とhealth |
| /api/earthquakes | 直近24時間の地震（取消状態を保持）とhealth |
| /api/typhoons | 現行台風、実況・予報・区域、detailStateとhealth |
| /api/health | 上記4系統の独立した状態 |
| /api/radar/tiles/{base}/{valid}/{z}/{x}/{y}.png | 検証済み観測フレームのタイル |
| /api/areas/{7桁区域コード} | コード一致を検証した公式GeoJSON |

任意URLを引数に受け付けません。XMLは公式ホストのVPTW61電文パスのみ。リダイレクト、DOCTYPE、ENTITY宣言を拒否し、通常発表だけを採用します。APIは解除履歴を保存する履歴DBではありません。

## 更新とキャッシュ

通常60秒、失敗時のサーバー再試行待機15秒。雨雲・警報の上流タイムアウト15秒、イベントの1回の更新全体は18秒。各系統の同時要求を1つに集約します。最終成功スナップショットはメモリと利用可能なWorker Cache APIに最大24時間保持。PARTIALも保持し、再起動時にLIVEへ書き換えません。キャッシュは永続DBではありません。

台風は現行一覧が成功したゼロ件なら正常ゼロ件。対象がある場合、初回の長期フィードと毎回の高頻度フィードから最大24件の新しいVPTW61を同時4件で取得。長期フィードは以後1時間ごとに補完します。電文はメモリ上限128件、Workerキャッシュ7日で再取得を抑え、原取得時刻を保存します。実況点は取得済みの最大72時間。フィード欠落、未知の風域、現行一覧と詳細の発表時刻のずれはPARTIALです。

発生時刻と取得の鮮度を分離します。通信失敗を成功したゼロ件に変換しません。台風一覧だけ成功し詳細全件が失敗した場合も対象名を残し、未取得を明示します。

## 地形と立体面

zoom8以下はdemgm_png、9〜14はdem_png、以降オーバーズーム。HTTP 404の未整備・海域タイルは、同じ国土地理院の低倍率タイルの該当部分を使います。符号化済みRGBを混色しない最近傍切り出しの後、符号付きcmをmへ復号します。画像内の欠損値は0mへ変換。5xx・通信失敗を0mで隠さず、2D復帰と再試行を表示します。表示地形は1.25倍です。

MapLibreのfill/lineは常に地形上の区域を担当。立体面はearcutで穴を維持して三角形化し、共有辺に亀裂ができないよう段階的に細分化。各頂点をqueryTerrainElevationで標高化し、分類に応じた高さを加えた上面と側面をSolidPolygonLayerにまとめます。代表点で区域全体を持ち上げません。TerrainExtensionによる別の地形を追加せず、深度共有だけを地形追従の根拠にしません。

未読込の頂点標高がある面は描かず、公式の平面・輪郭を残してDEM到着後に再構築。広域・複雑区域は計算予算によって立体面を省略する場合があります。分類別の基準高さ100/350/700/1100mに縮尺係数を適用します。これは表示用の強調量で、物理的な気象高度ではありません。未知コードは高さ0。

| 品質 | 立体対象区域上限 | 上面三角形予算 | 目標辺長 | ラベル上限 |
| --- | ---: | ---: | ---: | ---: |
| Low | 0（平面・輪郭は維持） | 0 | — | 8 |
| Medium | 48 | 12,000 | 2,500m | 18 |
| High | 80 | 24,000 | 900m | 28 |

三角形予算は上面用で、側面は境界に追加します。1ポリゴンの上面は最大2,000、分割キャッシュは最大180。ラベルは選択・縮尺・密度を考慮します。Autoは描画イベントの間隔を負荷の代理指標として観測し、40ms超が45回分続けば15秒以上の待機期間を挟んで下げます。GPUの実行時間を直接計測する機能ではありません。自動昇格は行わず、短い往復を防ぎます。

## カメラと小画面

初期3Dの傾斜は50度。選択区域・イベントへの移動は対象の中心、区域から求めた縮尺、実際に開いているシートの余白を同時に適用します。傾斜時に平面用の中心補正だけへ依存せず、スマホでも選択点をシートの上に残します。シート開閉で余白を更新し、全国リセットで解除します。縮尺は目的の表示領域だけから求め、MapLibreの保持済み余白と二重計算しません。

## 終了・失敗と公開設定

テーマ変更と2D復帰でoverlayを取り外し、レイヤー・イベント・再構築タイマー・RAF・キャッシュを解放します。選択パルスだけ最大4秒間RAFを使い、非表示・Low・reduced-motionで停止。DEM失敗は2Dへ、FX失敗は平面地図を継続します。

wrangler.jsoncのASSETSがdistを配信し、/api/*をWorkerへ渡します。CSPは必要な地図・地理院接続とblob workerを許可。秘密情報・アカウントは不要。worker:checkはdry-runで、Cloudflareへの公開ではありません。

統合方式の参考：[deck.gl MapLibre統合](https://deck.gl/docs/developer-guide/base-maps/using-with-maplibre)、[TerrainExtension](https://deck.gl/docs/api-reference/extensions/terrain-extension)。検証結果はIMPLEMENTATION_REPORT.mdに分離します。

## 依存関係の終了処理パッチ

luma.gl 9.4.0のcanvasイベント解除漏れと頂点配列の解放漏れを、[同梱パッチ](patches/README.md)で修正しています。pnpmのpatchedDependenciesとしてロックし、再インストールでも適用。テーマ変更時は旧スタイルの地形を明示的に解除してから置換します。終了済みFXを保持しないことをcanvasイベント数と実ブラウザのヒープで検証します。
