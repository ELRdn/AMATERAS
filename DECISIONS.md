# AMATERAS — Decisions

## 2026-09-06 implementation decisions (current)

- React + TypeScript + Vite + MapLibre GL JS + dedicated CSS.
- Shared local API and Cloudflare Worker; deployment is outside this delivery.
- Live JMA observation radar (~3 hours), current r8 warnings, official area search and geometry.
- GSI DEM terrain with 1.25x elevation, 2D/3D and mobile support are included now.
- No Three.js, deck.gl, event models, earthquake/tsunami/typhoon layers, rivers, Kikikuru, PLATEAU, accounts or notifications in this release.
- See PROJECT_SPEC.md and IMPLEMENTATION_REPORT.md for the implemented scope and evidence.

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
- selected-area outlines and small labels

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
