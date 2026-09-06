# AMATERAS — データ台帳

確認日：2026-09-06〜07。機械生成の地域索引・コード表の取得時刻はpublic/data/provenance.json、実接続結果はartifacts/live-smoke.jsonを参照。

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
| 標高       | https://cyberjapandata.gsi.go.jp/xyz/demgm_png/{z}/{x}/{y}.png と dem_png                    | 地図要求に応じ取得、提供側HTTPキャッシュ   | 404は同じ地理院の低倍率タイルへ補完。符号付き24bit cmをmへ復号しTerrainRGBへ変換。画像内欠損0m、表示1.25倍                |
| 背景地図   | https://tiles.openfreemap.org/styles/dark と /styles/liberty、/planet                        | スタイル同梱、ベクトルタイル等は提供側配信 | 色・日本語ラベル・不要レイヤーを調整                                           |

## 雨雲のタイル倍率

[公式ナウキャスト設定](https://www.jma.go.jp/bosai/nowc/table/nowc.properties__7d6f7d8dc6f16a416574.xml)のhrpnsはzoomUse="even"、minZoom=4、maxNativeZoom=10です。配信は4・6・8・10を使用。奇数倍率の要求は透明画像が返る場合があるため直接使用せず、偶数倍率の親タイルの四分区を切り出します。気象情報の補間・予測・色変換は行いません。この設定URLには版ハッシュがあり、変更時は公式ページから再確認します。

## 標高の欠損と補完

離島周辺や海域で高倍率の標高タイルがHTTP 404の場合、demgm_pngなど取得可能な低倍率の公式タイルの該当区画を最近傍で切り出します。RGBのまま平滑化すると符号化標高が変わるため、混色しません。画像内の欠損コードは0mとして表示します。通信障害・HTTP 5xx・全倍率404は取得失敗として扱い、画面を2Dへ戻して再試行を案内します。

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

## FX-0／FX-1の追加データ

| データ | 取得先 | 更新・キャッシュ | 加工 |
| --- | --- | --- | --- |
| 地震一覧 | https://www.jma.go.jp/bosai/quake/data/list.json | 60秒確認、成功スナップショット最大24時間 | eidで統合、rdt/serで訂正・取消、atの直近24時間、震央は経度・緯度の順、深さkm。EEW・訓練を除外 |
| 台風の現行一覧 | https://www.jma.go.jp/bosai/typhoon/data/targetTc.json | 60秒確認 | tropicalCycloneを対象IDに使用。issueと詳細発表時刻のずれを検知 |
| 高頻度フィード | https://www.data.jma.go.jp/developer/xml/feed/extra.xml | 60秒確認、同時要求集約 | 公式VPTW61電文リンクだけ抽出 |
| 長期フィード | https://www.data.jma.go.jp/developer/xml/feed/extra_l.xml | 初回補完、その後1時間間隔 | 高頻度フィードと統合し、最大24件の新しい電文で補完 |
| 台風VPTW61 | https://www.data.jma.go.jp/developer/xml/data/{発表時刻}_{連番}_VPTW61_{番号}.xml | 取得済みは再利用。メモリ128件、Workerキャッシュ7日 | 通常発表のみ。実況・予報の位置、円の半径、非対称風域、hPa・m/s・ノット・km・海里を解釈 |

[気象庁XML配信仕様](https://xml.kishou.go.jp/xmlpull.html)を基に、長期フィードの初期補完と高頻度の更新取得を分けています。全フィードの常時再ダウンロードは行いません。電文の同時取得は4件、更新全体は18秒で打ち切り、取得できた部分と最終成功データを明示します。

地震の観測時刻、台風の実況・予報対象時刻、発表時刻、原電文取得時刻、確認時刻を分けます。台風の過去経路は取得できた公式実況点（最大72時間）だけで、アプリ独自の補間観測点は加えません。風域の不明な方向・半径を全円で代用せず、部分取得として表示します。

警報の立体高さは分類の視覚的な強調です。地形の各頂点にDEM標高を与え、分類の高さを加算。未知コードは高さを加えません。地震パルスは情報選択の強調で、地震波・到達予測ではありません。これらの加工の意味をGeoEffectと画面に記録します。

## 固定試験資料の出典

- tests/fixtures/earthquake-jma.json：上記気象庁地震一覧から2026-09-06取得の先頭8件を抜粋。実際の文字列ser・ISO時刻・ISO6709座標を固定試験に使用。
- tests/fixtures/typhoon-vptw61.xml：[気象庁の2026-09-06 12:41:26 UTC電文](https://www.data.jma.go.jp/developer/xml/data/20260906124126_0_VPTW61_010000.xml)。実際の階層と単位属性を固定試験に使用。
- 訂正・取消・未知形式などの変形入力はテスト内で生成し、LIVEへ配信しません。開発用の架空イベントも別モジュールに隔離し、MOCK DATAを常時表示します。

追加データにも上記気象庁の出典・加工表示と利用規約を適用します。接続結果はViteとWorkerのライブ試験ログ、検証日はIMPLEMENTATION_REPORT.mdで確認できます。
