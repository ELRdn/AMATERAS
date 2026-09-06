# AMATERAS — Design Specification

## 1. Design thesis

**Map first. HUD second.**

The reference video is the main visual source of truth.

AMATERAS should feel like a geographic live instrument, not a page composed from dashboard cards.

---

## 2. Desktop layout target

Reference frame: approximately 16:9 desktop.

Suggested proportions:

- top bar: ~5–6% viewport height
- right warning rail: ~18–20% viewport width
- lower tool/ticker area: ~7–9% viewport height combined
- remaining area: map

Do not treat these as rigid pixel values; preserve the relationship.

---

## 3. Z-order

Recommended visual stack:

1. map base
2. terrain
3. weather raster/vector layers
4. warning polygons
5. geographic labels
6. event markers / pulse / beam
7. small map-attached labels
8. floating radar timeline
9. top/right/bottom chrome
10. modal / legend

---

## 4. Main map visual style

### Default map

- deep navy/near-black ocean
- subdued terrain
- thin cool coastline highlights
- restrained city/place labels
- subtle grid only if it improves the radar-console feel
- no decorative giant globe

### Weather layers

Do not brand-recolor the data.

Precipitation should use a recognizable intensity scale.

Brand colors belong to:

- controls
- focus state
- selected state
- borders
- interaction affordances

---

## 5. Top bar

Visual character:

- single thin horizontal strip
- dark translucent or opaque background
- subtle bottom divider
- minimal icons
- no tall navigation

Logo should not dominate the map.

Search remains prominent but compact.

---

## 6. Right warning rail

The rail should visually feel like a list layered beside the map.

Use:

- dense rows
- small category icon
- small typography
- colored accent edge
- timestamp
- compact filter chips

Avoid:

- card shadows
- large thumbnails
- news cards
- giant badges
- large padding

---

## 7. Left counters

Small vertical stack.

Preferred properties:

- 3–4 counters visible
- compact numeric emphasis
- semantic outline color
- translucent dark surface
- minimal glow

They should take seconds to read and almost no map area.

---

## 8. Radar timeline

Small floating rectangle.

Should contain only:

- title / timestamp
- play control
- frames
- current marker
- short time labels

No full-width transport bar.

---

## 9. Bottom toolbar

Thin linear strip.

Controls should be small enough that the user perceives a map application before perceiving the toolbar.

Use icon + short label.

Recommended interaction states:

- default
- hover
- selected
- disabled

---

## 10. Ticker

Very thin.

Left severity/status tab can use Alert Amber.

Ticker text should be compact.

Do not permanently animate rapidly.

---

## 11. Quiet-state design

Quiet-state quality is a core design requirement.

When there are no warnings:

- do not add placeholder cards
- allow empty space
- keep the terrain/map visually attractive
- right rail may show a small neutral confirmation
- counters may show `0` or collapse selectively
- map should remain worth looking at

The visual system must not require fake data to feel complete.

---

## 12. Motion

Use motion to make the app feel live.

Good motion:

- radar frame playback
- subtle pulse at selected event
- smooth map camera changes
- short alert entry transition
- controlled ticker motion
- event-marker rotation when semantically appropriate

Avoid:

- everything glowing
- constant floating panels
- decorative particle noise everywhere
- aggressive pulsing

---

## 13. 2D / 3D

2D:

- near-top-down
- optimal for data reading

3D:

- camera pitch
- terrain relief
- 3D event markers
- same UI shell

Switching modes should not change information architecture.

---

## 14. Typography

Japanese UI must be readable.

Direction:

- modern Japanese sans-serif
- technical English micro-labels can use geometric/condensed sans
- logo remains custom/geometric

Hierarchy should come from:

- weight
- spacing
- alignment
- semantic color

Not giant font sizes.

---

## 15. Anti-slop checklist

Reject a design if any are true:

- map feels secondary
- both sides contain large permanent panels
- screen looks like an enterprise BI dashboard
- there are large temperature cards
- there is decorative AI/insight copy
- a huge title sits over the map
- information exists only to make the screenshot busy
- radar uses brand cyan instead of severity/intensity colors
- multiple large charts are visible
- the layout would look empty without fake warning data
- 3D is cinematic rather than informative

---

## 16. Reference fidelity

When in conflict:

1. real app usability
2. map-first principle
3. reference video layout
4. AMATERAS brand polish
5. decorative creativity

Do not sacrifice the first three to make something look more “designed”.

## FX-0／FX-1（2026-09-07）

地図を主役にしたまま、右一覧を気象警報・地震・台風のタブにします。警報の立体面は薄く、選択輪郭を優先。地名・雨雲・公式分類色を覆う光や大型モデルを使いません。全国の細かい道路ラベルを抑え、ラベル数は品質と縮尺で制限します。

立体高さの意味と、雨雲以外の対象時刻を小型表示します。地震は選択時だけ短いパルス、台風は実線の実況と破線の予報、淡い区域面、時刻付き詳細。スマホは共通シートを使用し、選択位置にシート分のカメラ余白を取ります。Lowは地形を維持し、区域面・輪郭・静止マーカーを残します。
