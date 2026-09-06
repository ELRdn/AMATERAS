# AMATERAS — データ台帳

確認日：2026-09-06。機械生成の地域索引・コード表の取得時刻はpublic/data/provenance.json、実接続結果はartifacts/live-smoke.jsonを参照。

## 採用データ

| データ     | 取得先                                                                                       | 更新・キャッシュ                           | 加工                                                                           |
| ---------- | -------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| 雨雲時刻   | https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N1.json                            | 約5分間隔の観測、取得60秒                  | basetime=validtime、hrpnsのみ、直近約3時間、時刻順・重複排除                   |
| 雨雲画像   | https://www.jma.go.jp/bosai/jmatile/data/nowc/{base}/none/{valid}/surf/hrpns/{z}/{x}/{y}.png | ブラウザ/Workerで300秒                     | 色を保持。奇数倍率は偶数倍率の親画像の対応四分区を切出し拡大、表示透過率を変更 |
| 現行警報   | https://www.jma.go.jp/bosai/warning/data/r8/map.json                                         | 発表に応じ更新、取得60秒                   | 電文種別・区域ごとの現行状態、解除判定、公式名称付与、区域×種別集計            |
| 警報コード | https://www.jma.go.jp/bosai/warning/ の公開コード定義                                        | pnpm data:syncで更新                       | 33コードを抽出、任意JSは実行しない                                             |
| 地域名     | https://www.jma.go.jp/bosai/common/const/area.json                                           | 静的同梱、手動再同期                       | 公式区域名と都道府県を検索索引化                                               |
| 地域範囲   | https://www.jma.go.jp/bosai/common/const/class20relm.json                                    | 静的同梱、手動再同期                       | lat/lonからMapLibre bounds、1863検索エントリ                                   |
| 区域図形   | https://www.jma.go.jp/bosai/common/const/geojson/class20s/{code}.json                        | 必要区域のみ取得、86400秒                  | コード一致を検証して塗り・輪郭・ラベル表示                                     |
| 標高       | https://cyberjapandata.gsi.go.jp/xyz/demgm_png/{z}/{x}/{y}.png と dem_png                    | 地図要求に応じ取得、提供側HTTPキャッシュ   | 符号付き24bit cmをmへ復号しTerrainRGBへ変換。欠損0m、表示1.25倍                |
| 背景地図   | https://tiles.openfreemap.org/styles/dark と /styles/liberty、/planet                        | スタイル同梱、ベクトルタイル等は提供側配信 | 色・日本語ラベル・不要レイヤーを調整                                           |

## 雨雲のタイル倍率

[公式ナウキャスト設定](https://www.jma.go.jp/bosai/nowc/table/nowc.properties__7d6f7d8dc6f16a416574.xml)のhrpnsはzoomUse="even"、minZoom=4、maxNativeZoom=10です。配信は4・6・8・10を使用。奇数倍率の要求は透明画像が返る場合があるため直接使用せず、偶数倍率の親タイルの四分区を切り出します。気象情報の補間・予測・色変換は行いません。この設定URLには版ハッシュがあり、変更時は公式ページから再確認します。

## 2026年体系への対応

[気象庁の新体系](https://www.jma.go.jp/jma/kishou/know/bosai/keiho-update2026/)を確認し、現行サイトが参照するr8データを採用しました。旧warning/data/warning/map.jsonはHTTP 200でも5月28日付の古いデータでした。正常HTTPだけで現行と判断せず、本アプリでは使用しません。

大雨・土砂災害・高潮のレベル付き名称を公式定義から取得。他の気象情報に独自の警戒レベル名を付与しません。内部levelは表示順と色のための分類も含みます。河川単位の氾濫情報は今回未対応です。

## 利用条件と出典表示

- [気象庁の利用規約](https://www.jma.go.jp/jma/kishou/info/coment.html)：権利表示が別にないコンテンツは公共データ利用規約第1.0版に準拠。出典・加工の明記が必要です。本アプリは地図 attribution と「出典とデータの状態」に気象庁へのリンクと加工表示を備えます。気象庁の公式アプリ・独自警報として表示しません。
- [地理院タイル一覧と利用条件](https://maps.gsi.go.jp/development/ichiran.html)、[標高タイル仕様](https://maps.gsi.go.jp/development/demtile.html)：使用データごとの条件を参照。国土地理院の出典と標高変換を明記します。
- [OpenFreeMap利用案内](https://openfreemap.org/quick_start/)：背景にOpenFreeMap / OpenMapTiles / OpenStreetMapの帰属を維持。OpenStreetMapの著作権リンクも地図上に表示します。地図サービスと元データの権利を混同しません。

これらの気象庁公開Webデータは本アプリ専用の安定API契約ではありません。URL・形式の変更や配信停止に備え、入力検証と障害表示を実装しています。再配信する個別素材に別の権利表示が追加された場合、公開前に確認してください。

## 接続と障害

PowerShellの外部取得ではTLS接続エラーがありましたが、アプリが実際に使用するNode.js標準fetchでは証明書検証を有効にしたまま取得できました。TLS検証の無効化やOS証明書設定の変更は行っていません。

レーダー・警報は独立キャッシュです。警報の古い発表時刻を失効条件にせず、現行スナップショットと解除情報で判定。全件取得失敗はSOURCE ERRORで、成功したゼロ件と区別します。通信停止からの最終成功保持は同一プロセスまたは利用可能なWorkerキャッシュの範囲です。
