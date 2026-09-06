# AMATERAS — Reference UI Analysis

> 2026-09-06：この文書の災害分類は参考映像を分析した当初の例です。今回の公式分類はDATA_SOURCES.mdと生成済み2026年警報コード表、実装範囲はPROJECT_SPEC.mdを優先します。「洪水」等の例を現行の公式分類として固定しません。今回の3Dは実地形と区域輪郭・ラベルに限定します。
## Source of Truth: TCPoole Dopplar Radar reference video

**Reference video:** `I built a live weather radar in a few hours with Claude / TCPoole Dopplar Radar`  
**Video properties:** 1920×1080, 30 FPS, 16.9 s  
**AMATERAS design intent:** Use this reference at roughly **80% visual/interaction inspiration**, while replacing the U.S.-specific weather/disaster data and branding with AMATERAS/Japan.

---

# 1. Core Design Principle

## MAP FIRST

The application is **not a dashboard with a map inside it**.

It is a **full-screen interactive map application with thin UI chrome overlaid around the edges**.

Do:

- Let the map dominate almost the entire viewport.
- Keep information panels thin and edge-aligned.
- Put weather labels, warning geometry, radar data, and 3D markers directly on the map.
- Keep utility controls compact.
- Preserve the feeling of manipulating a live radar system.

Do not:

- Build large left/right dashboard columns.
- Fill the screen with cards.
- Turn it into a generic “disaster command center” dashboard.
- Add decorative hero copy over the map.
- Add large weather cards, statistics cards, or marketing sections inside the application UI.

---

# 2. Approximate Screen Composition

Based on the 1920×1080 reference.

## Top Bar

Approx. **5–6% of viewport height**.

Contains:

- Brand/logo on the left.
- Compact location search in the center.
- Radar status / LIVE state / clock on the right.
- Thin divider line below.

AMATERAS adaptation:

- Left: `AMATERAS` logo using the Palette C logo direction.
- Center: Japanese place search.
- Right: `LIVE`, JST clock, optional data-source health indicator.

No oversized navigation.

---

## Map Canvas

Approx. **75–85% of the visible screen area**.

This is the visual priority.

Reference characteristics:

- Map fills behind almost everything.
- Radar precipitation sits directly on the map.
- Warning labels float over relevant positions.
- Warning polygons and colored ground areas are visible in-map.
- 3D warning objects are placed directly at event positions.
- Zoom / pan / rotate feels like the primary interaction.

AMATERAS should preserve this very strongly.

---

## Left Warning Counters

Reference uses **three small stacked counters** at the upper-left of the map.

Examples:

- Tornado
- Thunderstorm
- Flood

They are not a sidebar.

AMATERAS adaptation could use compact stacked counters such as:

- 大雨
- 雷
- 土砂
- 洪水
- 地震

Only show a small subset at once; avoid a permanent large list.

---

## Right Warning Panel

Approx. **18–20% of viewport width**.

This is the only substantial persistent side panel.

Structure:

1. `ACTIVE WARNINGS`
2. Large total count.
3. Compact category filter chips.
4. Vertically scrolling warning list.
5. Small radar intensity legend near the lower area.

Important:

- The panel is visually narrow.
- Each warning row is dense.
- Rows use warning-specific colors, not large illustrations.
- The list feels operational, not editorial.

AMATERAS adaptation:

- `発表中の情報`
- Total count
- Filter chips: ALL / 大雨 / 雷 / 洪水 / 土砂 / 地震 etc.
- Scrollable JMA-derived event list.

---

# 3. Bottom UI

## Main Tool Strip

A very thin horizontal toolbar.

Reference buttons include:

- MAP
- 2D
- RADAR
- TUNE
- LEGEND
- PLAY / PAUSE
- REFRESH
- THEME
- RESET

Plus inline control hints for mouse interaction.

AMATERAS should use the same pattern.

Possible AMATERAS version:

- MAP
- 2D / 3D
- RADAR
- LAYERS / TUNE
- LEGEND
- PLAY / PAUSE
- REFRESH
- THEME
- RESET

Do not turn these into large floating cards.

---

## Radar Timeline

The radar loop is a **small floating strip near the lower center of the map**, not a giant timeline panel.

Reference characteristics:

- Small rectangular history slots.
- LIVE time highlighted.
- Very little vertical space.
- Appears to belong to the map itself.

AMATERAS should follow this closely.

---

## Emergency Banner

Above the lower toolbar/timeline, the reference shows a narrow bright emergency banner such as:

`3 ACTIVE TORNADO WARNINGS — SEEK SHELTER IMMEDIATELY`

AMATERAS adaptation:

Use only for truly important public warnings.

Examples:

- `大雨特別警報 発表中`
- `津波警報 発表中`
- `緊急地震速報`

It should be narrow, strong, and temporary-looking rather than a permanent card.

---

## Bottom Alert Ticker

A very thin ticker at the absolute bottom.

Reference:

- Yellow `WEATHER ALERT` label on the left.
- Horizontal stream of alert text to the right.
- Severity colors embedded in the ticker.

AMATERAS can use:

- `防災情報`
- Scrolling/current JMA warnings.

This contributes heavily to the live-broadcast/radar-console feel.

---

# 4. Map Visualization Language

## Warning Labels

Reference labels are tiny floating tags directly above geographic positions.

Examples:

- `T-STORM`
- `FLOOD`
- `TORNADO`

Visual rules:

- Dark nearly-black background.
- Thin colored outline/glow.
- Very compact typography.
- Labels can overlap slightly in dense event areas.
- They feel like map annotations, not cards.

AMATERAS examples:

- `大雨`
- `洪水`
- `雷`
- `土砂`
- `津波`
- `震度5弱`

---

## Radar Layer

Radar uses the familiar multicolor intensity scale.

Important:

- Radar should retain physical/map readability.
- Brand cyan should be used for interface chrome, **not to recolor all weather data**.
- Weather data colors must remain semantically meaningful.

This is one of the biggest mistakes to avoid in generated mockups.

---

## 3D Warning Objects

The reference uses intentionally exaggerated 3D warning symbols.

Observed:

- Dark rotating tornado object.
- Metallic/golden lightning object.
- Vertical light beams.
- Ground discs / warning polygons.
- Pulse rings.
- Diamond markers.

The 3D objects are **event markers**, not realistic weather simulations.

AMATERAS should follow this rule.

Recommended use:

- Tornado: stylized dark vortex.
- Lightning: restrained 3D bolt or vertical energy marker.
- Earthquake: pulse rings + epicenter marker.
- Volcano: optional simple marker.
- Typhoon: likely better as radar/wind visualization rather than a giant 3D hurricane mesh.

Do not make the entire atmosphere volumetric in the MVP.

---

# 5. 2D / 3D Behavior

The reference supports switching between flatter and more perspective-heavy map views.

3D mode:

- Camera pitch increases.
- Geographic surface becomes visibly dimensional.
- Event models gain depth.
- Warning polygons remain attached to terrain.
- UI chrome stays fixed in screen space.

This should be replicated in AMATERAS.

The camera/map experience is more important than adding more panels.

---

# 6. Theme System

The video visibly switches between a dark cyber map and a bright conventional map.

## Dark Theme

Primary AMATERAS direction.

Use the previously selected Palette A:

- Midnight Navy — `#0A1A2F`
- Storm Blue — `#1E3A8A`
- Electric Cyan — `#00D9FF`
- Rain Teal — `#00A896`
- Alert Amber — `#FFB020`
- Warning Red — `#FF3B30`
- Cloud Gray — `#94A3B8`
- Snow White — `#F8FAFC`

The interface should primarily be Midnight Navy / near-black with thin cyan lines.

## Light Theme

Useful as a secondary map style.

Important: switching map themes should not radically redesign the application shell.

---

# 7. Typography & UI Density

Reference typography:

- Technical / condensed / futuristic appearance.
- Many uppercase labels.
- Small text sizes.
- Wide letter spacing in headers.
- Very compact row heights.

AMATERAS should keep the technical feel but improve Japanese readability.

Suggested direction:

- Latin/logo: geometric futuristic sans.
- Japanese UI: clean sans-serif with strong legibility.
- Use uppercase English micro-labels sparingly under Japanese titles if desired.

Avoid huge headings.

---

# 8. Motion

The video's appeal comes from motion more than static decoration.

Important motion types:

- Radar loop.
- Smooth map zoom/pan/rotation.
- Theme transition.
- 3D tornado rotation.
- Light beam / marker motion.
- Pulse rings.
- Blinking/active warning states.
- Ticker movement.

AMATERAS mockups should imply these behaviors visually.

---

# 9. Modal / Legend

The beginning of the video shows a centered **MAP LEGEND** modal.

It contains:

- Large previews of the 3D tornado and lightning models.
- Explanation of each marker type.
- A grid explaining warning polygons, light beams, diamonds, ground discs, pulse rings, and city dots.
- Dark translucent backdrop.

AMATERAS can retain this pattern almost directly as a first-run/help modal.

This is a better place to explain the unusual 3D visual language than putting permanent explanatory cards on the main map.

---

# 10. What AMATERAS Should Copy Closely (~80%)

1. Full-screen map-first composition.
2. Thin top bar.
3. Search position.
4. LIVE/clock position.
5. Compact warning counters at upper-left.
6. Narrow persistent warning list on right.
7. Warning filter chips.
8. Floating warning labels on the map.
9. Radar precipitation layer.
10. 3D event markers.
11. Ground warning geometry.
12. Small radar timeline near bottom-center.
13. Thin bottom toolbar.
14. Theme switch.
15. 2D/3D mode.
16. Bottom alert ticker.
17. Legend modal concept.
18. High information density without large cards.

---

# 11. What AMATERAS Should Change (~20%)

1. AMATERAS branding.
2. Palette A application chrome.
3. Palette C-derived AMATERAS logo.
4. Japan geography.
5. Japanese labels and place names.
6. JMA-specific warning taxonomy.
7. Earthquake / tsunami / typhoon / Kikikuru layers.
8. Improve Japanese typography.
9. Slightly reduce the original's gaming/HUD excess where readability suffers.
10. Preserve official/severity colors for meteorological data instead of forcing brand colors.

---

# 12. Explicit Anti-Slop Rules

Future image generation MUST NOT:

- Create a generic enterprise dashboard.
- Put large card columns on both sides.
- Add large weather forecast widgets.
- Add random analytics/statistic cards.
- Use giant marketing headlines inside the app.
- Add a hero image or decorative Earth globe.
- Turn Japan into a cinematic satellite poster.
- Make every UI element glow.
- Apply cyan to all radar/weather data.
- Add fake “AI intelligence” panels.
- Add unnecessary charts.
- Add huge 3D hurricane artwork.
- Make the map less than the obvious main subject.

When uncertain, remove UI rather than add more.

---

# 13. One-Sentence Visual Brief

> **AMATERAS is a full-screen Japanese live-weather map with a thin cyber-radar HUD around its edges: map first, warnings embedded directly into geography, compact right-side alert feed, tiny lower controls, and selective 3D event markers.**

---

# 14. A/B/C Mockup Strategy

The next A/B/C test should NOT test three unrelated dashboard styles.

All three should preserve the same source-of-truth layout.

Only vary one major dimension per version.

### A — Closest to Reference
- ~90% reference composition.
- Dark map.
- Minimal AMATERAS customization.

### B — AMATERAS Refined
- Same layout.
- Palette A polished.
- Cleaner Japanese typography.
- Slightly more restrained HUD.

### C — 3D Emphasis
- Same layout.
- Stronger terrain pitch and 3D event markers.
- Still map-first; no added dashboard panels.

This makes the A/B/C test meaningful.
