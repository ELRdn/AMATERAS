# AMATERAS — Decisions

## 2026-09-07 FX-0 / FX-1 decisions (current)

- Maintain React / TypeScript / Vite / MapLibre 5.24.0; add lazy-loaded deck.gl 9.4.0 via interleaved MapLibreOverlay.
- Default to 3D + Auto on every device. Persist manual terrain and quality choices.
- Group warnings by area and retain the strongest official classification regardless of selection. Unknown classifications receive no invented height.
- Sample the same GSI DEM at subdivided mesh vertices; native ground fills and outlines remain available.
- Add official earthquakes from the last 24 hours and current typhoons from the target list and normal VPTW61 XML.
- Selected earthquake pulses are symbolic and last up to four seconds; forecast and observed typhoon geometry remain distinct.
- Keep radar, warnings, earthquakes and typhoons independent, including failure and partial states. Historical radar does not rewind events.
- Low retains terrain, flat areas, outlines and static markers. Auto begins Low on small screens, Medium elsewhere, and downgrades under sustained load.
- No wind/radar lift, Three.js, GLB, PLATEAU, SANDBOX, accounts or notifications in this phase.
- This phase includes local operation, tests, evidence and docs; no additional commit, push or deployment.
- The initial MVP remains the baseline. Current scope and verification: PROJECT_SPEC.md / IMPLEMENTATION_REPORT.md.

## Product name

**AMATERAS**

Working public descriptors:

- AMATERAS
- AMATERAS Weather
- AMATERAS Live

The UI logo should primarily display simply:

`AMATERAS`

## Product concept

A Japanese real-time weather and disaster visualization application.

Core concept:

> **Map-first live weather and disaster awareness for Japan.**

The product should aggregate official/public weather and disaster information into a single geographic interface rather than inventing its own forecasts.

## Visual source of truth

Primary reference:

`references/reference_weather_radar.mp4`

Design policy:

- roughly **80% structural inspiration** from the reference
- Japan-specific data and labels
- AMATERAS branding and palette
- improved Japanese typography
- less unnecessary gaming/HUD excess where readability suffers

## Brand palette

Use **Palette A — Cyber Radar** as the primary UI palette.

- Midnight Navy `#0A1A2F`
- Storm Blue `#1E3A8A`
- Electric Cyan `#00D9FF`
- Rain Teal `#00A896`
- Alert Amber `#FFB020`
- Warning Red `#FF3B30`
- Cloud Gray `#94A3B8`
- Snow White `#F8FAFC`

Reference asset:

`references/palette_A_cyber_radar.png`

## Logo

Use the **Palette C AMATERAS logo direction**:

- geometric AMATERAS wordmark
- small golden solar arc above the center of the wordmark
- restrained, premium, technical appearance

Do **not** use Palette C as the overall UI color system.

Reference:

`references/palette_C_logo_reference.png`

## UX principle

The application must remain visually useful when **almost nothing is happening**.

Normal conditions should look calm, sparse, and map-focused.

Information density grows only when real events exist.

## Data principle

- No fake alerts in production.
- No decorative warnings just to make the map look exciting.
- Official/severity colors must retain semantic meaning.
- Brand cyan must not recolor meteorological intensity scales.
- AMATERAS does not independently issue weather warnings.

## 3D principle

3D is selective.

Use 3D for:

- terrain
- map camera pitch
- terrain-sampled warning meshes with selected-area outlines and small labels
- symbolic selected earthquake pulses
- official typhoon tracks and areas

Do not build a fully volumetric atmosphere for MVP.

## Explicitly rejected direction

Do not use:

- large dual sidebars
- KPI grids
- weather-card dashboards
- huge temperature cards
- “AI analysis” panels
- giant cinematic globe
- decorative analytics charts
- oversized hero copy inside the application
- permanent high visual density

If uncertain, remove UI rather than add it.
