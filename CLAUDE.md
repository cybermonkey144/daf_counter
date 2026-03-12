# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Study progress tracker — a static, single-page web app for tracking Talmud Bavli and Tanach study progress. No build system, no framework, no dependencies. Pure HTML/CSS/JS served as static files.

## Development

Serve locally with any static file server (the app fetches JSON via XHR, so `file://` won't work):

```
python3 -m http.server 8000
# or
npx serve .
```

No build step, no tests, no linter configured.

## Architecture

- **index.html** — Shell with header (tab bar, overall stats + progress bar), `<main>` container, and fixed footer (export/import/reset buttons).
- **app.js** — All application logic in a single file, organized into sections:
  - **MODES descriptor object** — Defines each tracking mode (talmud, tanach) with uniform accessors (`groups`, `units`, `learnableCount`, `cellStart`, `cellEnd`, etc.). New study types are added by extending this object and adding a corresponding JSON file and tab button.
  - **State**: `appData` (from JSON), `talmudProgress` / `tanachProgress` (user data), `expandedUnits` (UI state), `activeMode` (current tab).
  - **localStorage**: Load/save with `STORAGE_KEY = 'dafTracker'`. Version 2 format: `{version: 2, talmudProgress: {...}, tanachProgress: {...}}`. Backwards-compatible with version 1 (Talmud-only).
  - **Stats**: Computed at three levels — overall, group (seder/division), unit (tractate/book).
  - **Rendering**: Full re-render via `renderContent()`, with incremental updates (`updateCell`, `updateUnitCard`, `updateGroupStats`) after user interactions. Cell grids are lazy-rendered on first unit expand.
  - **Interactions**: Click increments cell count, right-click/long-press (500ms) decrements.
  - **Export/Import/Reset**: JSON file backup via Blob download, FileReader import, localStorage clear.
- **assets/shas.json** — Talmud Bavli metadata: `talmud_bavli.sedarim[].tractates[]` with `name` and `pages` fields. `total_pages: 2711`.
- **assets/tanach.json** — Tanach metadata: `tanach.sections[].books[]` with `name` and `chapters` fields. Also contains `talmud_bavli` data (both datasets are loaded from this single file).
- **style.css** — Dark glassmorphism theme using CSS custom properties. Daf cells use `data-count` attribute for visual states (0, 1, 2, 3+). Responsive with 768px breakpoint.

## Key Conventions

- Cell numbers (daf/chapter) are stored as string keys in the progress object.
- For Talmud: pages count includes the title page; learnable dapim = `pages - 1`, starting from daf 2. For Tanach: chapters start from 1.
- Progress data shape: `{ "Berakhot": { "2": 3, "5": 1 }, ... }` — unit name -> cell number -> review count.
- The app loads **only** `assets/tanach.json` at startup (which contains both Talmud and Tanach data). `assets/shas.json` exists but is not currently used at runtime.
- Mode-specific logic is abstracted through the `MODES` descriptor — avoid scattering mode-specific conditionals throughout the code.
