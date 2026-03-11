# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Daf Yomi Tracker — a static, single-page web app for tracking Talmud Bavli study progress. No build system, no framework, no dependencies. Pure HTML/CSS/JS served as static files.

## Development

Serve locally with any static file server (the app fetches `dapim.json` via XHR, so `file://` won't work):

```
python3 -m http.server 8000
# or
npx serve .
```

No build step, no tests, no linter configured.

## Architecture

- **index.html** — Shell with header (overall stats + progress bar), `<main>` container, and fixed footer (export/import/reset buttons).
- **app.js** — All application logic in a single file, organized into sections:
  - **State**: `talmudData` (from JSON), `progress` (user data), `expandedTractates` (UI state)
  - **localStorage**: Load/save with `STORAGE_KEY = 'dafTracker'`, versioned JSON format `{version: 1, progress: {...}}`
  - **Stats**: Computed at three levels — overall, seder, tractate. `tractateLearnableCount()` returns `pages - 1` (daf 1 is title page).
  - **Rendering**: Full re-render via `renderApp()`, with incremental updates (`updateDafCell`, `updateTractateCard`, `updateSederStats`) after user interactions.
  - **Interactions**: Click increments daf count, right-click/long-press (500ms) decrements. Daf cells are lazy-rendered on first tractate expand.
  - **Export/Import/Reset**: JSON file backup via Blob download, FileReader import, localStorage clear.
- **dapim.json** — Tractate metadata structured as `talmud_bavli.sedarim[].tractates[]` with `name` and `pages` fields. `total_pages: 2711`.
- **style.css** — Dark glassmorphism theme using CSS custom properties. Daf cells use `data-count` attribute for visual states (0, 1, 2, 3+). Responsive with 768px breakpoint.

## Key Conventions

- Daf numbers are stored as string keys in the progress object.
- Pages count includes the title page; learnable dapim = `pages - 1`, starting from daf 2.
- Progress data shape: `{ "Berakhot": { "2": 3, "5": 1 }, ... }` — tractate name → daf number → review count.
