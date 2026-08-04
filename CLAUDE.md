# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

---

## Architecture Overview

**Mission Companion** is a single-file PWA (~2,800 lines vanilla JS/HTML/CSS) for LDS missionaries—personal journal, language practice, scripture mastery, health tracking, and exercise building.

- **Single source of truth:** `C:\Users\shan_\missionary-companion\index.html` (ONLY file to edit for vanilla features)
- **Deployment:** `git add -A && git commit -m "message" && git push` → live in ~60 seconds
- **Data:** localStorage (canonical, sync) + Supabase (cloud layer, pulled on boot, pushed on save)
- **Architecture:** Vanilla JavaScript, no build system, no dependencies, event-driven modal/render pattern
- **React integration:** Vite project in `react-components/` builds to `react-build/`, deployed as iframes (Health Metrics, Exercise Logger)
- **Hosting:** GitHub Pages at https://missionarycompanion.com (aliases to https://dombundy08-hue.github.io/Mission-Companion/)

---

## Auto-Deployment & Self-Improvement Skill

This project uses the **`mission-companion-deploy` skill** which runs **automatically on every `git push origin main`**:

1. **Deploy Agent** — Builds React components, copies to react-build/, commits, and pushes
2. **Code Audit Agent** — Scans the codebase (DOM errors, path issues, deprecated patterns) AND the Supabase backend (`mxlfwmwjkanvsjimralh`: missing tables/columns, RLS misconfig, schema/code drift) via Supabase MCP tools
3. **Auto-Fix Loop Agent** — Takes audit findings, fixes each issue on either end (code fix or Supabase migration), rebuilds, and verifies (up to 3 retries per bug)
4. **Learning Agent** — Updates SKILL.md and CLAUDE.md based on lessons learned, making both more advanced and efficient

**Result**: Every push is automatically audited and fixed on both the frontend and Supabase backend, then documented. Skill continuously improves itself.

**Latest learnings (2026-08-03):** Audit checklist covers postMessage/iframe security patterns (`'*'` target origin, missing `event.origin` checks, `useMemo`/`useEffect` deps for `window.location`, setTimeout-based iframe readiness, hardcoded vs dynamic paths) plus Supabase schema drift (e.g. code querying a `saved_foods` table that doesn't exist in the project — 404s that fail silently). Also now covers two regression classes found during the Phase 2 (Scripture/Objections) deploy: (1) a new setting saved via `cloudSaveSetting()` but never added to its `map.has()` pull-down branch in `syncSettings()` — silently write-only across devices; (2) sentinel strings meaning "not applicable" (e.g. a `fallacy` field of `"none"`) checked with exact equality instead of a prefix-safe regex — breaks the moment the authored value has an explanatory suffix. See SKILL.md for full details.

See `.claude/skills/mission-companion-deploy/SKILL.md` for full workflow details.

---

## Data & Sync Model

### localStorage (canonical, synchronous)
Render functions read from localStorage. Keys are synced to Supabase on every save (async, non-blocking).

```
Keys:
- authenticated, apiKey, theme, scriptureLockMode (app state)
- journalEntries, miracleEntries, glossaryTerms (JSON arrays)
- scriptureDeck, usedPromptIndices (JSON)
- healthFood, savedFoods, workoutLog (arrays)
- activeTab, activeSection (string)
- scriptureStreak, scriptureCollection (JSON) — `effectiveStreak()` grants one grace day (missed exactly one day keeps it alive); two consecutive misses breaks it
```

Helpers: `getLS(key)`, `setLS(key, val)` — use these directly, JSON.stringify is automatic.

### Supabase (cloud sync, optional)
Project: `mxlfwmwjkanvsjimralh.supabase.co`  
Deduplication by **natural keys** (not UUIDs): `date + body` (journal/miracle), lowercased `term` (glossary), `scripture_id`, `timestamp` (health/workout).

New records get a `cloudId` UUID after first push; updates/deletes use `cloudId`.

**Important:** Isolated error handling — if a cloud table fails, other syncs continue.

### Sync Flow
1. Boot: `cloudSyncAll()` pulls all tables, merges by natural key, pushes conflicts back
2. On save: `cloudSaveHealth()` / `cloudSaveJournal()` / etc. fire after user action (non-blocking)
3. Offline: saves locally, shows banner, `flushPending()` pushes on reconnect
4. All cloud calls guarded by `cloudReady + sbOnline()`; failures queue, never throw

---

## Navigation & Section Architecture

**Data-driven structure:**

```javascript
SECTIONS = {
  spiritual: { name: "Spiritual", tabs: ["journal", "spanish", "mastery", "email", "objections", "glossary", "miracles"] },
  exercise: { name: "Exercise", tabs: ["routine"] },
  health: { name: "Health", tabs: ["food", "stats"] }
}
```

No hand-written nav. Sections switcher and tabs build themselves via `renderBottomNav()`.

Key functions:
- `goToTab(tab)` — switch tabs, trigger render
- `goToSection(sec)` — switch sections, rebuild nav
- `render()` — master switch calling `render<Tab>()` for active tab
- Each tab has a `render<TabName>()` function (e.g., `renderHealthFood()`, `renderJournal()`)

---

## How to Make Changes

### Adding a Feature (Small Change)
1. Find relevant `render<Tab>()` function
2. Modify HTML/CSS in template string
3. Add event listeners in same function (search `addEventListener`)
4. Update `state.<section>` if tracking UI state
5. Test in browser → `git add -A && git commit -m "..." && git push`

### Modifying Data Storage
- **localStorage:** Use `setLS(key, value)` — JSON.stringify is automatic
- **Supabase:** Add to cloud sync function (`cloudSaveHealth()`, etc.) with natural-key dedup
- New tables: Run SQL in Supabase dashboard, update sync functions

### Dark Mode & CSS
- CSS variables in `:root` (light) and `@media (prefers-color-scheme: dark)` (system dark)
- Manual override: `data-theme="dark"` attribute on `<html>`
- Always use `var(--text)`, `var(--card)`, `var(--bg)` — never hardcoded colors

### Settings Modal
Settings modal uses `.settings-section` containers for extensibility:
```html
<div class="settings-section">
  <h3>Section Name</h3>
  <div><!-- controls here --></div>
</div>
```

---

## Testing & Verification

Manual testing in browser:

1. **Local dev:** Open `file:///C:/Users/shan_/missionary-companion/index.html`
   - Hard-refresh (Ctrl+Shift+R) if CSS/JS don't update
   - DevTools (F12) → Console for errors; Network tab for cloud sync calls

2. **Verify feature:** Perform action → appears in UI → reload → persists in localStorage → check Supabase dashboard

3. **Dark mode:** Test system dark mode + manual toggle in Settings; verify text readable

4. **Deploy:** `git push` → verify live in ~60 seconds

---

## Critical Functions & Concepts

### Key Functions by Purpose

**Navigation:**
- `goToTab(tab)`, `goToSection(sec)`, `renderBottomNav()`, `render()`

**Storage:**
- `getLS(key)`, `setLS(key, val)` — localStorage
- `cloudSyncAll()` — pull + merge + push all data (boot)
- `cloudSaveJournal()`, `cloudSaveHealth()`, etc. — push specific data

**UI/State:**
- `openSettings()`, `closeSettings()` — settings modal
- `state.<section>` — UI state per section
- `showFlash(msg, type)` — banner notifications

**Health:**
- `healthAverages(days)` — calc weekly/monthly avg
- `getSavedFoods()`, `addSavedFood()`, `deleteSavedFood()`
- `logFood(name, cal, prot, source)` — add entry

**Spiritual:**
- `renderJournal()`, `renderSpanish()`, `renderMastery()`
- `scriptures` array (109 cards)
- `getRandomPrompt()`, `getUnusedPrompts()` — prompt rotation

### State Object Structure
```javascript
state = {
  health: { editingGoals: false, snapRange: 7, foodMode: 'search', ... },
  workout: { sessionIdx: 0, ... },
  journal: { editingEntry: null, ... },
}
```
Tracks UI state; render functions read `state.<section>` to decide what to show.

### Important Constants
- `APP_PASSWORD = "steely08!"` (line ~60, marked `// CHANGE PASSWORD HERE`)
- `SECTIONS` object — navigation config
- `scriptures` array (109 cards)
- Supabase project ref: `mxlfwmwjkanvsjimralh`

---

## React Components (Embedded via iframe)

### Structure
**Source:** `react-components/` (Vite + React + TypeScript + Tailwind)  
**Output:** `react-build/` (deployed as `/Mission-Companion/react-build/`)

### Integration
Health Metrics iframe (line 4178):
```html
<iframe id="healthActivityFrame" src="/Mission-Companion/react-build/index.html?app=health" 
  style="width:100%;height:600px;border:none;border-radius:12px;background:var(--card);"></iframe>
```

Exercise Logger iframe (line 2618):
```html
<iframe id="exerciseActivityFrame" src="/Mission-Companion/react-build/index.html?app=exercise" 
  style="width:100%;height:650px;border:none;border-radius:12px;background:var(--card);"></iframe>
```

### postMessage Protocol
**Vanilla → React (health data):**
- Function: `sendHealthMetricsUpdate()` (line 3766)
- Data: `{type: 'updateMetrics', metrics: {...}, visible: [...]}`

**React → Vanilla (exercise logging):**
- Listener at line 2171
- Data: `{type: 'exerciseSaved', exercise: {...}, timestamp: Date.now()}`

---

## Building & Deploying React Components

### Build
```bash
cd react-components
npm run build
cp -r dist/* ../react-build/
```

### Test Locally
Development server (isolated):
```bash
cd react-components && npm run dev  # http://localhost:5173
```

Testing with iframes:
1. `npm run build && cp -r dist/* ../react-build/`
2. Open `file:///C:/Users/shan_/missionary-companion/index.html`
3. Hard-refresh (Ctrl+Shift+R)
4. Navigate to Health → Stats or Exercise → Routines

### Deploy
```bash
git add index.html react-build/
git commit -m "Update React components: [what changed]"
git push  # Live in ~60 seconds
```

---

## Development Tips

### Reusing Existing Patterns
- **Modal:** search `openSettings()` or `showFlash()`
- **Event binding:** look at `renderHealthFood()` listeners (lines ~3364)
- **Cloud sync:** check `cloudSaveJournal()` pattern
- **Data dedup:** look at `cloudSyncJournal()` natural-key merging

### Common Gotchas
1. **Service worker caching:** Hard-refresh if changes don't appear
2. **Password hardcoded:** Search `APP_PASSWORD` to change it
3. **localStorage keys:** Use `isoDate()` (ISO string, timezone-safe), not `Date.now()`
4. **Cloud tables optional:** Missing table won't break other syncs (isolated error handling)
5. **Natural-key dedup:** Collisions resolved by meaningful fields, not UUIDs
6. **Async reads:** localStorage is sync; Supabase pulled once at boot (all reads hit localStorage)

### Debugging Cloud Sync
1. DevTools → Network tab
2. Perform action triggering cloud save
3. Look for POST to `api.supabase.co` → check response
4. Console for `[CLOUD]` log messages
5. Supabase MCP available via `.mcp.json` for SQL queries

---

## Deployment Checklist

Before pushing:

1. Test locally — hard-refresh, test end-to-end
2. Console — no errors
3. localStorage — feature persists after reload
4. Dark mode — both light and dark readable
5. No secrets — no API keys/passwords in code
6. Commit message — describe what changed (e.g., "Add saved foods frequency-gating")
7. `git push` → verify live in ~60 seconds

---

## DOM-Ready & Initialization Patterns

### Critical: Module-Level DOM Access Breaks Features

**Problem:** Script runs before DOM elements exist → event listeners fail silently → feature broken, no error shown.

**Solution: Defer DOM access until after DOMContentLoaded:**

```javascript
// WRONG: Runs before element exists
document.getElementById('voiceSelect').addEventListener('change', handler);

// RIGHT: Deferred until DOM ready
function attachListeners() {
  const el = document.getElementById('voiceSelect');
  if (el) {
    el.addEventListener('change', handler);
    console.log('[BOOT] Listener attached');
  } else {
    console.log('[BOOT] ERROR: Element not found');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', attachListeners);
} else {
  attachListeners();
}
```

### Boot-Stage Debugging
- Add `console.log('[BOOT]')` at initialization checkpoints
- Reload page, scan console for sequence
- Missing steps indicate where errors occur
- Use `console.trace()` for call stack

### Example: Voice Selector Bug
Found at line ~2847: event listener tried to attach before `voiceSelect` element existed in DOM.
- Symptom: Voice buttons unresponsive, no console error
- Root cause: Listener attachment failed silently
- Fix: Wrap listener in DOM-ready check + add boot logging
- Verification: Console shows `[BOOT] Listener attached` ✓

---

## Parallel Diagnostic Workflow (for Production Issues)

When a feature breaks in production but works locally, spawn TWO agents in parallel:

**Code Audit Agent:** Searches for:
- Module-level DOM access outside functions
- Event listeners on non-existent elements
- Silent error catches (try/catch → variable = null)
- Stale function references

**Production Test Agent:** Tests live site:
- Console for errors
- Manual feature testing (click, fill, render)
- Network tab for failed API calls
- DevTools console for function calls

**Workflow:** Launch both simultaneously → compare findings → fix once → verify both scenarios

---

## References

- **Supabase:** https://app.supabase.com/projects (ref: `mxlfwmwjkanvsjimralh`)
- **Live app:** https://dombundy08-hue.github.io/Mission-Companion/
- **GitHub:** https://github.com/dombundy08-hue/Mission-Companion
- **Related docs:** CONTEXT.md (full architecture), TASKS.md (task order), PRD.md (requirements), BACKLOG.md (backlog)
