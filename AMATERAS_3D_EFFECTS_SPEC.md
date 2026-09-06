# AMATERAS — 3D WEATHER & EVENT EFFECTS SPEC
**Status:** LIVE FX-0 / FX-1 implemented; FX-2 onward remains planned  
**Research date:** 2026-09-06  
**Scope:** 3D terrain, weather visualization, disaster effects, selective 3D assets, premium Simulation/Sandbox effects  
**Product principle:** **LIVE = 日本の公式・公的情報に忠実 / SANDBOX = 仮想・遊びを明確に分離**

---


## 2026-09-07 — 今回の適用範囲と実装判断

今回の正本はユーザー承認済みのLIVE FX-0／FX-1です。全端末で初期3D＋Auto、手動設定保存、警報立体面・地震・台風と共通の品質管理を実装しました。以降の風・降水立体化・アセット・PLATEAU・SANDBOXは将来構想で、現在利用可能な機能ではありません。

MapLibre 5.24.0とGSI DEMを維持し、deck.gl 9.4.0を遅延読込。MapLibreOverlayのinterleaved方式を使用します。警報は同一区域の最強分類で集約し、選択で重大度を下げません。未知分類に高さを割り当てません。

以下のGeoJsonLayer extrusion案は設計候補です。今回の実装は各頂点を同じDEMで標高化した三角形・側面をSolidPolygonLayerにまとめます。区域全体を代表点の高さで持ち上げず、未読込標高は立体面を省略。地形に沿うfill/lineを常に残します。深度共有だけで地形追従したとは判断しません。

地震は公式の直近24時間で、選択時のみ最長4秒の象徴的なパルス。台風は現行一覧＋通常VPTW61から実況・予報・円・非対称風域を取得。雨雲タイムラインとは対象時間を分けます。AutoはスマホLow／その他Mediumから開始し、負荷で低下。Lowは実地形・区域面・輪郭・静止マーカーを維持します。

具体的な上限・キャッシュ・型は[技術構成](TECH_ARCHITECTURE.md)、実行済み試験・比較画像と未検証範囲は[検証報告](IMPLEMENTATION_REPORT.md)、今後の範囲は[ロードマップ](MVP_ROADMAP.md)を参照。公開・追加コミット・プッシュはこの工程に含めません。

---

# 0. Executive Summary

AMATERAS の 3D は「3Dモデルを大量に置く」設計にしない。

正解は次の3層。

1. **Real-world 3D Base**
   - 実測地形
   - 必要に応じて実在都市3D
   - MapLibreのカメラ・terrain

2. **Data-driven 3D Effects**
   - 降水
   - 警戒区域
   - 地震
   - 台風
   - 雷活動
   - 津波警報
   - 火山
   - 風など
   - 主に shader / particle / extrusion / ring / beam / field で表現

3. **Reusable 3D Assets**
   - 警報ビーコン
   - 竜巻シンボル
   - 雷イベントシンボル
   - 一部の特殊イベント用マーカー
   - GLB/GLTFとしてごく少数のみ制作

結論として、AMATERAS が必要とするのは **3D Asset Library** よりも **Geospatial FX Engine**。

> **地形は実測。情報は公式。立体表現は意味を増やす時だけ。演出のために事実を捏造しない。**

---

# 1. Product Modes — LIVE と遊びを絶対に混ぜない

## 1.1 LIVE

AMATERAS の正本モード。

### ルール

- 気象庁・国土地理院・国交省等の公式/公的情報を基礎にする
- イベントを勝手に発生させない
- 警報・注意報を AMATERAS 自身が発令したように見せない
- データ時刻・更新時刻を表示
- stale / source error を隠さない
- 「見た目の高さ」と「物理的な高さ」を混同しない
- 実データに無い位置へ具体的な現象を捏造しない

### LIVEの3D表現

3Dは「公式データの見やすい表現」。

例:

- 危険度 → polygon extrusion
- 震源 → marker + pulse
- 台風中心 → track + area + center marker
- 降水強度 → optional visual elevation
- 雷ナウキャスト → activity field

## 1.2 SANDBOX / SIMULATION

課金ユーザー向け候補。

**LIVEから明確に別画面・別モードにする。**

用途:

- 仮想台風
- 仮想地震
- 仮想隕石イベント
- 架空の大規模火災
- 停電
- 通信障害
- 防災訓練
- 映像制作
- 「もしここで○○が起きたら」という地理可視化

画面上に常時:

`SIMULATION`

または

`SANDBOX — NOT LIVE DATA`

を表示する。

LIVE と同じ赤い「警報」UIをそのまま使わない。

## 1.3 TRAINING / DEMO

将来的な自治体・学校・展示用途候補。

- 事前定義シナリオ
- シナリオ再生
- 災害時系列
- 避難所表示
- 各レイヤーの学習

---

# 2. Research Conclusions

## 2.1 MapLibre は3D基盤として継続でよい

MapLibre GL JS は WebGL ベースの地図レンダラで、`raster-dem` を使った terrain mesh をサポートする。

`CustomLayerInterface` では MapLibre 自身の WebGL context と camera を使って任意の3D描画を追加でき、`renderingMode: "3d"` にすると depth buffer を共有できる。

つまり現在の AMATERAS の3D地形を維持したまま、

- Three.jsモデル
- custom shader
- event effects

を地理座標へ配置できる。

**判断: MapLibreを捨てない。**

## 2.2 deck.gl は「大量の地理データの3D化」に強い

deck.gl は MapLibre と interleaved integration が可能。

`interleaved: true` では deck.gl が MapLibre の WebGL2 context 内で描画されるため、

- MapLibreのラベル
- 地形
- deck.gl polygon
- 3D object

の奥行き関係を統合しやすい。

AMATERAS で特に有効なのは:

- GeoJsonLayer
- PolygonLayer
- TileLayer
- ScatterplotLayer
- PathLayer
- PointCloudLayer
- TerrainLayer（必要時）

`PolygonLayer` / `GeoJsonLayer` は polygon extrusion を標準で持つ。

よって危険地域の3D立ち上げは、最初からThree.jsで自作するより deck.gl を優先する価値が高い。

## 2.3 Three.js は「独自エフェクト」と「少数の3D Asset」担当

Three.jsを使う候補:

- particle
- pulse ring
- beam
- custom vortex
- animated event marker
- GLB
- special shader
- atmospheric effect

MapLibre公式にも terrain 上へ Three.js の3Dモデルを配置する例がある。

### 役割分担

```text
MapLibre
├─ map camera
├─ base map
├─ terrain
├─ labels
└─ raster

deck.gl
├─ GeoJSON
├─ hazard polygon
├─ extrusion
├─ large point/line datasets
└─ tiled data visualization

Three.js / Custom WebGL
├─ particles
├─ bespoke FX
├─ GLB assets
├─ pulse
├─ beam
└─ vortex / plume
```

## 2.4 WebGPU は今すぐの前提にしない

Three.js には GPU compute を使い大量 point を動かす WebGPU example があり、300k points のデモもある。

一方で MapLibre の CustomLayerInterface は現在 WebGL2 context を前提とする。

そのため AMATERAS MVP では:

**MapLibre + WebGL2 を正本**

とする。

WebGPU は将来の独立エフェクトレンダラまたは MapLibre 側のサポート成熟後に再評価。

---

# 3. Official / Public Data Relevant to 3D

## 3.1 高解像度降水ナウキャスト

気象庁の高解像度降水ナウキャスト:

- 5分間降水量 / 降水強度
- 30分先まで 250m
- 35〜60分先は 1km
- 5分毎更新

ただし、一般向けの降水強度画像をそのまま「雲の実高度」として扱うことはできない。

したがって AMATERAS で高さを付ける場合:

`VISUAL EXTRUSION — HEIGHT REPRESENTS INTENSITY`

という意味にする。

## 3.2 雷ナウキャスト

気象庁情報カタログでは雷ナウキャストは:

- 日本域
- 1km
- 10分毎
- 最大1時間

の雷活動度データとして扱われる。

推奨:

- 全国: activity field
- 地域: heat / column / subtle pulse
- 選択表示: symbolic lightning marker

「全国の雷一本一本の正確な3D落雷位置」として扱わない。

## 3.3 竜巻発生確度ナウキャスト

情報カタログ上:

- 日本域
- 10km
- 10分毎
- 最大1時間

これは「実在する竜巻がここにいる」という意味ではない。

したがって:

- 発生確度 area
- 選択時に「竜巻リスク」のsymbolic vortex

にする。

## 3.4 気象庁防災情報XML

気象庁の防災情報XMLは PULL 型で公開され、ユーザー登録不要。

高頻度Atomフィードは毎分更新され、

- 随時気象情報
- 地震
- 火山
- その他

などを取得できる。

AMATERAS の alert/event layer の基幹候補。

### 運用注意

全クライアントがJMAへ直接pollしない。

- edge cache
- dedup
- last-seen IDs
- upstream pollingの集約

を行う。

## 3.5 国土地理院 DEM

国土地理院は標高タイルを提供。

- テキスト
- PNG/RGB

形式があり、地図タイルと同じ座標系で扱える。

2026年時点では 1m / 5m DEM の更新・提供も進んでいる。

### AMATERAS用途

- 全国: coarse/medium DEM
- local zoom: 高精度DEMが使える区域のみ詳細化
- dynamic LOD

## 3.6 Project PLATEAU

PLATEAUは CityGML に加え、Web可視化向けに:

- 3D Tiles
- MVT
- Terrain
- Ortho

を配信。

2026-05-11時点の公開リストでは306地域。

また、2025年度以降の一部データは 3D Tiles 1.1。

### AMATERAS用途

PLATEAUは全国必須依存にしない。

```text
National
└─ DEM only

City zoom
└─ PLATEAU available?
    ├─ yes → lazy-load 3D Tiles
    └─ no  → DEM + normal map
```

---

# 4. 3D Effect Master Matrix

Legend:

- **LIVE** = official-data mode
- **SIM** = sandbox
- **3-view** = 三面図必要度
- **Asset** = 固定3Dモデル
- **Proc** = procedural / shader / particle

| Effect | LIVE | SIM | Method | 3-view | Priority |
|---|---:|---:|---|---:|---:|
| Terrain | ✅ | ✅ | DEM terrain | 不要 | S |
| City 3D | ✅ | ✅ | PLATEAU 3D Tiles | 不要 | C |
| Precipitation surface | ✅ | ✅ | raster | 不要 | S |
| Precipitation intensity extrusion | ✅* | ✅ | shader/height field | 不要 | A |
| Rain particles | △ | ✅ | particles | 不要 | C |
| Snow particles | △ | ✅ | particles | 不要 | C |
| Wind streamlines | △ | ✅ | GPU particles | 不要 | A |
| Cloud layer | △ | ✅ | volume/noise | 不要 | C |
| Fog | △ | ✅ | terrain fog | 不要 | D |
| Lightning activity field | ✅ | ✅ | grid/heat/columns | 不要 | A |
| Lightning marker | symbolic | ✅ | GLB/procedural | 中 | B |
| Tornado probability field | ✅ | ✅ | grid/polygon | 不要 | A |
| Tornado symbolic vortex | selected only | ✅ | particle/GLB | 高* | B |
| Warning polygon | ✅ | ✅ | GeoJSON fill | 不要 | S |
| Warning extrusion | ✅ | ✅ | deck.gl extrusion | 不要 | S |
| Warning beacon | symbolic | ✅ | GLB | 高 | B |
| Pulse ring | ✅ | ✅ | shader geometry | 不要 | S |
| Vertical beam | symbolic | ✅ | shader | 不要 | B |
| Earthquake epicenter | ✅ | ✅ | marker | 不要 | S |
| Seismic pulse | symbolic | ✅ | expanding rings | 不要 | A |
| Intensity surface | ✅ | ✅ | polygon / region | 不要 | A |
| Typhoon track | ✅ | ✅ | path | 不要 | S |
| Typhoon wind areas | ✅ | ✅ | polygons/rings | 不要 | S |
| Typhoon center marker | ✅ | ✅ | procedural/GLB | 低〜中 | B |
| Tsunami warning coast | ✅ | ✅ | coastline band | 不要 | A |
| Tsunami arrival labels | ✅ | ✅ | geographic labels | 不要 | A |
| Synthetic tsunami wave animation | ❌ live default | ✅ | shader wavefront | 不要 | C |
| Volcano event marker | ✅ | ✅ | marker | 低 | B |
| Eruption plume visualization | derived | ✅ | particles/volume | 不要 | C |
| Landslide risk extrusion | ✅ if source | ✅ | polygon extrusion | 不要 | A |
| Flood risk extrusion | ✅ if source | ✅ | polygon extrusion | 不要 | A |
| Shelter/building highlight | ✅ | ✅ | point / building highlight | 不要 | C |
| Large fire / smoke | data-dependent | ✅ | particle/plume | 不要 | C |
| Power outage region | source-dependent | ✅ | region dimming | 不要 | C |
| Communications outage | source-dependent | ✅ | polygon/texture | 不要 | D |
| Meteor event | ❌ | ✅ | trail + impact FX | optional | C |
| Fictional high-energy explosion | ❌ | ✅ | stylized FX only | optional | D |

`*` Precipitation extrusion must explicitly say that height is visualization of intensity unless an actual vertical atmospheric dataset is being used.

`*` Tornado three-view is needed only when using a fixed sculpted/GLB object. A particle vortex does not need one.

---

# 5. What Should Actually Become 3D First?

## 5.1 Warning Polygon Extrusion — S Tier

今の AMATERAS の課題:

- 大雨
- 土砂
- 雷

などのラベルが大量に重なる。

全国表示では文字ではなく **面** で読ませる。

### 表現

```text
注意     → flat / very low
警戒     → low extrusion
危険     → medium
重大     → stronger edge / higher visual emphasis
```

高さは物理高度ではない。

UI legendに:

`HEIGHT = ALERT / RISK LEVEL`

を表示。

### Recommended implementation

deck.gl:

- GeoJsonLayer
- PolygonLayer
- `extruded: true`
- `getElevation`
- `getFillColor`

## 5.2 Earthquake Pulse — S Tier

実装が軽く、視認性が高い。

- epicenter dot
- vertical pin optional
- 2〜3 expanding rings
- timestamp
- magnitude / maximum intensity label

Pulseは「地震波が現在この円まで来ている」という物理シミュレーションではなく、

**event emphasis animation**

として扱う。

## 5.3 Typhoon Visualization — S Tier

台風本体の巨大3Dハリケーンモデルは不要。

### 表示

- center
- track
- forecast points
- forecast circle
- wind/storm regions
- subtle rotational particle field optional

地面上の area を少し持ち上げる程度。

## 5.4 Radar Intensity Lift — A Tier

現在の2D radar は維持。

3Dモード時のみ optional:

```text
height = normalized precipitation intensity
```

これは:

**データの高さではなく、データ値の立体グラフ**

と定義する。

全国表示で派手に立ち上げすぎない。

- default gain low
- user TUNE で height gain
- zoom out → flatten
- zoom in → slightly increase

---

# 6. Wind — 「神の目線」感を最も強くするFX

風は AMATERAS のミニチュア世界感と非常に相性が良い。

## Visual

地表上を細い粒子が流れる。

```text
→ → → →
  ↗ ↗
    ↻
```

台風周辺では流れが回転。

## Implementation

候補:

- custom WebGL2 layer
- Three.js Points
- GPU-advected particle texture
- deck.gl custom layer

### MVP

CPUで大量Lineを毎frame更新しない。

particle stateをGPU側へ寄せる。

### WebGPU

将来候補。

Three.js公式には大量point compute demoがあるが、AMATERAS MapLibre統合では現状WebGL2を優先。

---

# 7. Rain / Snow / Clouds

## Rain Particle

全国表示では不要。

ズーム時の optional aesthetic layer。

レーダーがすでに「どこで降っているか」を示すため、大量の縦雨particleは情報を隠す。

推奨:

- local zoom only
- low opacity
- camera-relative
- user toggle
- reduced-motion対応

## Snow

同様。

雪粒子は selected/local viewのみ。

全国表示では precipitation classification / raster。

## Cloud

最も危険な「カッコいいけど読めない」FX。

Default:

OFF または非常に薄い。

Method:

- noise-based translucent layer
- low-density volume
- 2.5D cloud sheet

本格 volumetric raymarching は MVP 後。

---

# 8. Lightning

雷は 2段階にする。

## Level 1 — Area

雷ナウキャストを:

- activity tint
- flicker density
- low columns

として表示。

## Level 2 — Selected Detail

地点を選択した時だけ symbolic bolt。

### Avoid

- 全国に大量のGLB
- flashing the entire screen
- 実際の落雷位置と誤認させるランダムbolt

---

# 9. Tornado

日本のLIVEで使う場合、気象庁の「竜巻発生確度」を尊重。

## National / regional

probability field。

## Selected area

symbolic vortex。

### Rendering choice

**Procedural particle vortex推奨。**

理由:

- 風らしい動き
- GLBより自然
- scaleを変えやすい
- color/opacityをrisk levelへ合わせやすい

### Fixed GLB version

ブランド用の小型 vortex icon が欲しい場合のみ制作。

この場合は三面図を用意する価値が高い。

---

# 10. Earthquake

## LIVE

JMA earthquake informationを event point として表示。

Effects:

- epicenter
- pulse
- affected region
- intensity color

### Future 3D

震源深さを見せる **focus cutaway mode** は面白い。

ただし通常Map上で地面の下へ無理に描画すると理解しづらいため、専用detail view候補。

---

# 11. Tsunami

LIVEでは極めて慎重。

## Recommended LIVE

- warning/advisory coast band
- forecast area
- expected arrival information
- official heights/labels if source supports
- critical coastal emphasis

## Do NOT

実際の津波frontのように見える架空の波を勝手に日本沿岸へ走らせる。

### Sandbox

仮想波面animationは可能。

必ずSIMULATION表示。

---

# 12. Volcano

LIVE:

- volcano location
- JMA alert/event state
- eruption event marker
- official textual metrics if available

Plume:

actual plume shapeはAMATERASが知っているとは限らない。

symbolic plume にするか、実データがある時だけ高さを関連付ける。

---

# 13. Kikikuru / Risk Surfaces

AMATERASで非常に強い候補。

Visualization:

- flat color surface
- extruded severity surface
- translucent edge glow

Rule:

extrusion height = risk category

と明示。

3D地形の山の高さと危険度の高さが混ざらないUIにする。

---

# 14. Premium Sandbox / Special Events

有料ユーザー向けの「遊べる神視点」は相性が良い。

ただしLIVEと完全分離。

## 14.1 Meteor / Impact

Components:

- atmospheric trail
- descending object optional
- impact flash
- stylized shock ring
- smoke/plume
- impact marker
- camera shake optional

### 三面図

隕石本体: **不要寄り**

理由: 一瞬しか見えない。

もし繰り返し表示する branded meteor asset が欲しければ三面図を使う。

### Important

SANDBOX上の視覚演出として扱う。

現実の破壊規模計算や危害予測をAMATERASの公式機能のように見せない。

## 14.2 Fictional High-energy Explosion

SANDBOX専用。

**weapon-specific real-world damage model は実装対象にしない。**

使用するなら:

- abstract flash
- expanding ring
- stylized plume
- clearly fictional hazard visualization

のみ。

Explicitly excluded:

- 現実の兵器威力に基づく被害半径計算
- 実在兵器の再現
- fallout/weapon effect の精密予測
- LIVEとの混在

AMATERASの「公式情報に忠実」というブランドを守るため。

## 14.3 Large Fire

Sandbox + 将来official-data source。

- smoke plume
- heat shimmer
- active perimeter
- wind-dependent visual drift

実災害に使う場合は official perimeter/data source がある時だけLIVE化。

## 14.4 Power Outage / Communications

3Dにしすぎない。

Better visualization:

- city lights dim
- affected region mask
- infrastructure icon
- subtle vertical column

「神の目線」のミニチュア感には city-light dimming がかなり効く。

---

# 15. Reusable FX Primitives

個別災害ごとに全部ゼロから作らない。

```text
AMATERAS FX Primitives
├─ PulseRing
├─ GroundDisc
├─ VerticalBeam
├─ AreaExtrusion
├─ ParticleField
├─ VectorField
├─ Trail
├─ Plume
├─ PointMarker
├─ Track
├─ LabelAnchor
└─ Heat/ActivityField
```

Example:

```text
Earthquake
= PointMarker + PulseRing + LabelAnchor

Tornado risk
= ActivityField + LabelAnchor + optional ParticleField

Meteor Sandbox
= Trail + PointMarker + PulseRing + Plume
```

---

# 16. Suggested FX Interface

```ts
type DataSemantics =
  | "official-observation"
  | "official-forecast"
  | "official-warning"
  | "derived-visualization"
  | "simulation";

type HeightSemantics =
  | "physical-altitude"
  | "terrain"
  | "data-value"
  | "visual-only";

type EffectMode = "live" | "simulation" | "training";

interface GeoEffect {
  id: string;
  kind: string;
  mode: EffectMode;

  source?: {
    organization: string;
    issuedAt?: string;
    observedAt?: string;
    fetchedAt: string;
  };

  dataSemantics: DataSemantics;
  heightSemantics?: HeightSemantics;

  geometry: unknown;

  visible: boolean;
  minZoom?: number;
  maxZoom?: number;
}
```

これを持っておけば、

「この高さは何を意味しているの？」

がコードレベルでも曖昧にならない。

---

# 17. 3D Asset List — 三面図が必要なのはこれだけ

## S — 三面図推奨

### 17.1 AMATERAS Warning Beacon

最も再利用性が高い。

用途:

- selected warning
- earthquake focus
- radar event
- special event
- search result highlight

必要ビュー:

- front
- side
- top

さらに:

- neutral material
- emissive parts separated
- ground origin

### 17.2 Stylized Tornado Marker

固定GLBを採用する場合。

必要:

- front
- side
- top
- silhouette sheet

ただし procedural vortexなら不要。

## A — 条件付き

### 17.3 Lightning Event Totem

「雷そのもの」ではなく、イベントmarkerとして固定デザインする場合。

### 17.4 Typhoon Center Marker

独自メカニカルmarkerを作る場合。

### 17.5 Volcano Marker

実地形とは別のイベントsymbolが必要なら。

### 17.6 Premium Impact Marker

Sandboxのimpact中心に置く固体assetが欲しい場合。

## 不要

以下は三面図を作らない。

- rain
- snow
- cloud
- wind
- shock ring
- pulse
- beam
- warning polygon
- tsunami band
- earthquake wave emphasis
- flood surface
- landslide surface
- radar heightfield
- smoke/plume if procedural

---

# 18. Asset Creation Pipeline

## Pipeline A — Astra + Blender

**AMATERAS第一候補。**

OpenAIのAstra事例では、AstraがUnity/Godot等のゲームエンジン内でscene編集・実行・テスト・検証を行う使い方が公開されている。

OpenAI DevelopersではAstraによるBlender/建築可視化の事例も公開されている。

### AMATERAS workflow

```text
1. DESIGN.md / asset brief
2. optional ImageGen 三面図
3. Astra → Blender
4. low-poly modeling
5. material
6. origin/pivot check
7. camera spin preview
8. export GLB
9. browser preview
10. Astra visual review
11. optimization
12. integration
```

### Astraに必ず指定

- web real-time asset
- low poly
- no unnecessary backfaces
- transform applied
- origin at ground center
- glTF compatibility確認
- no baked lighting unless intentional
- emissive material separate
- animation clips named
- GLB export

## Pipeline B — ImageGen → Meshy → Blender Cleanup

Meshyの2026 APIでは:

- Image to 3D
- Multi-Image to 3D
- Remesh
- GLB export
- low-poly model type
- auto sizing
- origin_at
- multi-view thumbnails

などが提供されている。

Good for:

- beacon
- stylized marker
- simple prop

Bad for:

- wind
- rain
- plume
- clouds
- hazard surfaces
- data visualization

Workflow:

```text
ImageGen
├─ front
├─ side
└─ top

→ Multi-image 3D
→ Remesh
→ Blender cleanup
→ GLB
→ Optimize
```

---

# 19. How to Make a Good Three-view Sheet

三面図を作るなら、普通のコンセプトアートにしない。

Required:

- orthographic
- front
- side
- top
- same scale
- same proportions
- neutral lighting
- plain background
- no perspective
- no dramatic effects
- no cast shadow hiding geometry
- material colors consistent

Optional:

- rear view
- 3/4 beauty view
- wireframe intention
- emissive mask
- material separation chart

---

# 20. GLB / GLTF Web Pipeline

Web向け基本形式:

**GLB**

Three.js GLTFLoader は:

- Draco
- Meshopt
- KTX2/BasisU
- GPU instancing extension

等をサポート。

Recommended optimization:

1. remove unused nodes/materials
2. merge where safe
3. reduce polygon count
4. reduce texture resolution
5. meshopt or Draco
6. texture compression
7. verify visual result

glTF-Transform は:

- inspect
- optimize
- Draco
- Meshopt
- WebP
- KTX2/Basis

などのpipelineを提供。

---

# 21. Draco vs Meshopt

## Draco

Pros:

- geometry compression strong

Cons:

- client decode cost

## Meshopt

Pros:

- geometry
- morph targets
- animation data
- runtime-oriented pipeline

Three.js GLTFLoaderは両方対応。

### AMATERAS

小型reusable markerなら:

**まず meshopt を試す**

大きな静的geometryで転送量が問題なら Draco も比較。

実測して選択。

---

# 22. Texture Strategy

AMATERASのイベントマーカーは巨大な4K PBRを持たない。

Preferred:

- 256〜1024程度を用途で選ぶ
- simple PBR
- emissive mask
- normal mapは必要な時のみ

Three.js KTX2Loader は GPU compressed texture をサポート。

Goal:

VRAM / transfer / decodeを抑える。

---

# 23. Instancing

同じGLBを何十個も表示する場合、個別Meshを大量生成しない。

候補:

- Three.js InstancedMesh
- glTF GPU instancing
- deck.gl の再利用レイヤー

Example:

警報ビーコン 100個:

❌ GLBを100回ロード

✅ 1 asset + instance transforms

---

# 24. Zoom-based Level of Detail

## National

- radar
- broad polygons
- typhoon
- major alerts
- no tiny particles
- no building 3D

## Regional

- extrusion
- selected particle
- more labels
- event marker

## Local

- detailed DEM
- optional PLATEAU
- rain/snow FX
- local river/observation layers
- detailed markers

---

# 25. Automatic Density Control

画面内イベント数で表現を変える。

```text
0–few events
→ individual labels / markers

medium
→ clustered / representative

many
→ polygons / heat / aggregate
```

**1000件あるなら1000個3Dを置かない。**

情報量が増えるほど「集約表示」へ移行する。

---

# 26. Performance Strategy

AMATERASは既に3D terrain + radarが重い。

FXはbudget制にする。

Required:

- FPS monitor development-only
- layer GPU timing where possible
- memory observation
- adaptive FX quality
- pause hidden/inactive effects
- visibility culling
- zoom culling
- lazy-loading
- asset cache
- worker decoding where possible

Presets:

### Low
- terrain
- radar
- warning surfaces
- no decorative particles

### Medium
- terrain
- radar
- selected particles
- event pulse

### High
- wind field
- detailed particles
- local cloud
- optional PLATEAU

### Auto
default。

---

# 27. Reduce-motion

OS `prefers-reduced-motion` を尊重。

以下をstaticへ:

- pulse animation
- particle density
- rotating marker
- ticker motion

防災情報そのものは消さない。

---

# 28. Visual Truth / Semantics Rules

各effectに以下を持つ。

```text
SOURCE
DATA TIME
DISPLAY MEANING
HEIGHT MEANING
LIVE / SIMULATION
```

Examples:

### Radar extrusion
`HEIGHT = PRECIPITATION INTENSITY VISUALIZATION`

### Warning surface
`HEIGHT = WARNING/RISK LEVEL`

### Pulse
`ANIMATION = EVENT EMPHASIS, NOT PHYSICAL WAVE PROPAGATION`

---

# 29. Things AMATERAS Must Never Fake in LIVE

- fake storm object
- fake lightning strike point
- fake tsunami wavefront
- fake tornado location
- fake hazard radius
- fake evacuation route
- fake official warning
- fake physical cloud height
- simulated result without label

---

# 30. Recommended Development Phases

## FX-0 — Cleanup（実装済み）

Before new3D:

- reduce excessive map labels
- zoom-dependent hazard labels
- cluster/collapse warnings
- GPU/performance baseline
- add quality selector

## FX-1 — Data Surfaces（今回のLIVE対象を実装済み）

Implement:

1. Warning polygon
2. Warning extrusion
3. Earthquake pulse
4. Typhoon track/areas
5. layer legend semantics

No GLB required.

## FX-2 — Weather Motion

1. radar intensity lift
2. wind particles
3. lightning activity visualization
4. tornado risk visualization

## FX-3 — Reusable Assets

Create:

1. AMATERAS Warning Beacon
2. optional Tornado Marker
3. optional Lightning Totem
4. optional Typhoon Center

ここで ImageGen 三面図が役に立つ。

## FX-4 — Local Immersion

- local rain
- snow
- clouds
- detailed terrain
- PLATEAU lazy-load

## FX-5 — Premium Sandbox

Separate route/mode.

First candidates:

1. hypothetical typhoon
2. hypothetical earthquake
3. meteor impact visual
4. large fire
5. infrastructure outage

Every screen:

`SIMULATION — NOT LIVE DATA`

---

# 31. Prioritized Backlog

## S

- [x] Warning Polygon Extrusion
- [x] Earthquake Pulse
- [x] Typhoon areas/track
- [x] Effect semantic metadata
- [x] FX density control
- [x] quality presets

## A

- [ ] Radar Intensity Lift
- [ ] Wind Particle Field
- [ ] Lightning Activity Layer
- [ ] Tornado Risk Field
- [ ] Kikikuru extrusion
- [x] warning label LOD

## B

- [ ] Warning Beacon GLB
- [ ] Lightning symbolic marker
- [ ] Tornado procedural vortex
- [ ] local rain
- [ ] PLATEAU city detail

## C

- [ ] cloud volume
- [ ] snow particle
- [ ] volcano plume
- [ ] Sandbox meteor
- [ ] Sandbox fire
- [ ] outage visualizer

---

# 32. Astra Task Breakdown

Astraへ一気に「全部3D化して」と投げない。

## Task 1

Current renderer audit:

- MapLibre version
- WebGL2
- terrain source
- radar source
- frame time
- memory
- current layer stack

## Task 2

Implement FX primitives:

- PulseRing
- VerticalBeam
- GroundDisc

## Task 3

deck.gl integration:

- interleaved
- GeoJSON
- extrusion
- z-order

## Task 4

event adapter:

official event → visual primitive

## Task 5

wind proof-of-concept

## Task 6

Astra + Blender asset pipeline

warning beacon only。

---

# 33. Completion Gate

3D FX phase is not complete until:

- [x] LIVE does not contain fake events
- [x] every derived 3D height has a documented meaning
- [x] quiet weather remains readable
- [x] severe weather does not become visual chaos
- [x] 1000+ warnings do not create 1000 3D objects
- [x] 2D remains available
- [x] low-quality mode remains usable
- [x] source timestamp remains visible
- [x] stale state remains visible
- [ ] PLATEAU is lazy-loaded
- [ ] GLB assets are optimized
- [ ] SIMULATION cannot be mistaken for LIVE
- [ ] no special-event sandbox data leaks into official alert counts
- [x] reduced-motion mode works
- [x] map remains more important than the FX

---

# 34. Strong Recommendation

最初に ImageGen で三面図を作る対象:

## 1st — AMATERAS Warning Beacon

理由:

- 全災害共通
- selected point共通
- search/location highlightにも使える
- brand identityになる
- 1個作れば大量再利用可能

## 2nd — Stylized Tornado Marker

ただし procedural vortex POC と比較してから。

## 3rd — Lightning Event Totem

actual lightning boltではなく map symbol として。

---

# 35. Final Architecture

```text
                     AMATERAS
                        |
                 MapLibre GL JS
                        |
       +----------------+----------------+
       |                |                |
     Terrain          Raster         Base labels
       |                                 |
       +----------------+----------------+
                        |
                   deck.gl
                        |
        +---------------+---------------+
        |               |               |
     polygons         paths           points
        |               |               |
    extrusion        tracks          events
                        |
                 Custom WebGL / THREE
                        |
        +---------------+----------------+
        |               |                |
     particles         FX             GLB assets
        |               |                |
      wind          pulse/beam         beacon
     rain          vortex/plume       special
                        |
                 FX Semantic Layer
                        |
       LIVE / SIMULATION / TRAINING separation
```

---

# 36. Research Sources

Official / primary sources checked during this specification:

## MapLibre
- MapLibre GL JS documentation — CustomLayerInterface
- MapLibre examples — 3D Terrain
- MapLibre examples — Three.js 3D model on terrain
- MapLibre examples — 3D Tiles using Three.js
- MapLibre project documentation — WebGL / planned WebGPU support

## deck.gl
- Using with MapLibre
- MapboxOverlay interleaved mode
- GeoJsonLayer
- PolygonLayer
- TileLayer
- TerrainLayer

## Three.js
- GLTFLoader
- DRACOLoader
- KTX2Loader
- Points / GPU compute examples

## JMA
- 気象庁防災情報XML
- PULL型 / high-frequency Atom feeds
- 高解像度降水ナウキャスト
- 気象データガイド
- 気象庁情報カタログ
  - high-resolution precipitation nowcast
  - lightning nowcast
  - tornado probability nowcast

## GSI
- 地理院地図 標高タイル仕様
- 数値標高モデル更新情報

## Project PLATEAU
- PLATEAU Open Data
- PLATEAU 3D Tiles / MVT
- PLATEAU 配信サービス
- Terrain / API

## OpenAI
- GPT-6 Astra / Playco game prototyping
- Astra architectural visualization / Blender workflow

## 3D Asset Pipeline
- Blender glTF 2.0 exporter
- glTF-Transform
- Meshy Image-to-3D / Remesh / Multi-view capabilities

---

# 37. Reference URLs

- https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/
- https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/
- https://maplibre.org/maplibre-gl-js/docs/examples/adding-3d-models-using-threejs-on-terrain/
- https://maplibre.org/maplibre-gl-js/docs/examples/add-3d-tiles-using-threejs/
- https://deck.gl/docs/developer-guide/base-maps/using-with-maplibre
- https://deck.gl/docs/api-reference/layers/geojson-layer
- https://deck.gl/docs/api-reference/layers/polygon-layer
- https://deck.gl/docs/api-reference/geo-layers/tile-layer
- https://threejs.org/docs/pages/GLTFLoader.html
- https://threejs.org/docs/pages/DRACOLoader.html
- https://threejs.org/docs/pages/KTX2Loader.html
- https://xml.kishou.go.jp/
- https://xml.kishou.go.jp/xmlpull.html
- https://www.data.jma.go.jp/developer/weatherdataguide/appendix/2-1-b.html
- https://www.data.jma.go.jp/suishin/cgi-bin/catalogue/make_product_page.cgi?id=Nowcast
- https://maps.gsi.go.jp/development/demtile.html
- https://www.mlit.go.jp/plateau/open-data/
- https://docs.plateauview.mlit.go.jp/datasets/3d-tiles/
- https://docs.plateauview.mlit.go.jp/
- https://openai.com/ja-JP/index/playco-game-prototyping-with-astra/
- https://docs.meshy.ai/ja/api/changelog
- https://docs.meshy.ai/ja/api/remesh
- https://github.com/donmccurdy/glTF-Transform

---

# 38. One-line Product Rule

> **AMATERAS LIVEは現実を立体化する。SANDBOXは想像を立体化する。両者を絶対に混ぜない。**
