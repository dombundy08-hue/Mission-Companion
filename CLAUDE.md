# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Architecture Overview

**Mission Companion** is a single-file PWA (~2,800 lines vanilla JS/HTML/CSS) for LDS missionaries—personal journal, language practice, scripture mastery, health tracking, and exercise building.

- **Single source of truth:** `C:\Users\shan_\missionary-companion\index.html` (this is the ONLY file to edit)
- **Deployment:** `git add -A && git commit -m "message" && git push` → live in ~60 seconds
- **Data:** localStorage (sync store the UI reads) + Supabase (cloud layer, pulled on load, pushed on save)
- **Architecture style:** Vanilla JavaScript, no build system, no dependencies, event-driven modal/render pattern

---

## Data & Sync Model

### localStorage (canonical, synchronous)
The render functions read from localStorage. Keys are synced to Supabase on every save (async, non-blocking).

```
Current keys:
- authenticated, apiKey, theme (app state)
- journalEntries, miracleEntries, glossaryTerms (JSON arrays)
- scriptureDeck, usedPromptIndices (JSON)
- healthFood, savedFoods (arrays, if building health features)
- activeTab, activeSection (string)
- scriptureStreak, scriptureCollection (JSON)
```

Helpers: `getLS(key)`, `setLS(key, val)` — use these directly, don't JSON.stringify manually.

### Supabase (cloud sync, optional)
Project: `mxlfwmwjkanvsjimralh.supabase.co`  
Deduplication: **natural keys** (not UUIDs; collision detection by meaningful fields):
- journal/miracle: `date + body`
- glossary: lowercased `term`
- scripture: `scripture_id`
- settings: `key`

New local records get a `cloudId` UUID after first push; updates/deletes use `cloudId` to locate the cloud row.

**Important:** Isolated error handling — if a cloud table is missing or unavailable, other syncs continue (no global failure).

### Sync Flow
1. Boot: `cloudSyncAll()` pulls settings → scripture → everything else, merges by natural key, pushes conflicts back
2. On save: `cloudSaveHealth()` / `cloudSaveJournal()` / etc. fire after user action (no blocking)
3. Offline: saves locally, shows banner, `flushPending()` pushes on reconnect
4. All cloud calls guarded by `cloudReady + sbOnline()`; failures queue, never throw

---

## Navigation & Section Architecture

App structure is **data-driven:**

```javascript
SECTIONS = {
  spiritual: { name: "Spiritual", tabs: ["journal", "spanish", "mastery", "email", "objections", "glossary", "miracles"] },
  exercise: { name: "Exercise", tabs: ["routine"] },
  health: { name: "Health", tabs: ["food", "stats"] }
}
```

**No hand-written nav.** Sections switcher (`#sectionBtn`) and bottom tabs build themselves via `renderBottomNav()` from this object.

Key functions:
- `goToTab(tab)` — switch tabs, trigger render
- `goToSection(sec)` — switch sections, rebuild nav
- `render()` — master switch that calls `render<Tab>()` for active tab
- Each tab has a `render<TabName>()` function (e.g., `renderHealthFood()`, `renderJournal()`)

---

## How to Make Changes

### Adding a Feature (Small Change)
1. Find the relevant `render<Tab>()` function
2. Modify the HTML/CSS in the template string
3. Add event listeners in the same function (search for `addEventListener` in that section)
4. Update state in `state.<section>` if you need to track UI state
5. Test in the browser, then `git add -A && git commit -m "..." && git push`

**Example: Adding a button to Health Food tab**
- Edit `renderHealthFood()` (line ~3227)
- Add button markup in the template string
- Add listener for `btn-id` in the event binding section at the end of the function
- Update related functions (`logFood()`, state) if needed

### Modifying Data Storage
- **localStorage:** Just use `setLS(key, value)` — JSON.stringify is automatic
- **Supabase:** Add to cloud sync function (`cloudSaveHealth()`, etc.) with natural-key dedup
- New tables: Run SQL in Supabase dashboard (not via Claude Code), then update sync functions

### Dark Mode & CSS
- CSS variables defined in `:root` (light) and `@media (prefers-color-scheme: dark)` (system dark)
- Manual override: `data-theme="dark"` attribute on `<html>` overrides system preference
- All text/backgrounds should use `var(--text)`, `var(--card)`, `var(--bg)` — never hardcoded colors

Functions: `initTheme()` (on boot), `setTheme(isDark)` (on toggle), `updateThemeToggle()` (sync checkbox to state)

### Settings
Settings modal (`#settingsModal`) uses `.settings-section` containers for extensibility:
```html
<div class="settings-section">
  <h3>Section Name</h3>
  <div><!-- controls here --></div>
</div>
```

New settings sections can be added without restructuring.

---

## Testing & Verification

No automated test framework. Test manually in the browser:

1. **Local dev:** Open `file:///C:/Users/shan_/missionary-companion/index.html` in a browser
   - Hard-refresh if CSS/JS don't update (Ctrl+Shift+R or clear service worker cache)
   - Open DevTools (F12) → Console to check for errors
   - Check Network tab to verify cloud sync calls (only if `cloudReady = true`)

2. **Verify feature works:**
   - Perform the action (e.g., log food, save entry)
   - Confirm it appears in the UI
   - Reload the page — does it persist? (tests localStorage)
   - Check localStorage in DevTools → Application → Storage → Local Storage
   - If cloud sync is ready, check Supabase dashboard for the row

3. **Dark mode:**
   - Test in browser's system dark mode (Settings → Colors → Dark)
   - Test manual toggle in Settings
   - Verify all text is readable (use inspect element to check computed `color` and `background-color`)

4. **Deploy:** `git push` and verify live at https://dombundy08-hue.github.io/Mission-Companion/ in ~60 seconds

---

## Critical Files & Concepts

### Key Functions by Purpose

**Navigation:**
- `goToTab(tab)`, `goToSection(sec)`, `renderBottomNav()`, `render()`

**Storage:**
- `getLS(key)`, `setLS(key, val)` — localStorage only
- `cloudSyncAll()` — pull + merge + push all data (boot)
- `cloudSaveJournal()`, `cloudSaveHealth()`, etc. — push specific data type

**UI/State:**
- `openSettings()`, `closeSettings()` — settings modal
- `state.<section>` — UI state per section (e.g., `state.health.foodMode` for which food tab is open)
- `showFlash(msg, type)` — banner notifications

**Health (if building health features):**
- `healthAverages(days)` — calc weekly/monthly avg of calories, protein, sleep, water, mood, energy
- `getSavedFoods()`, `addSavedFood()`, `deleteSavedFood()` — saved foods helpers
- `logFood(name, cal, prot, source)` — add entry to healthFood array

**Spiritual:**
- `renderJournal()`, `renderSpanish()`, `renderMastery()` — respective tabs
- `scriptures` array (109 cards) defined at top of file
- `getRandomPrompt()`, `getUnusedPrompts()` — reflection prompt rotation

### State Object Structure
```javascript
state = {
  health: { editingGoals: false, snapRange: 7, foodMode: 'search', ... },
  workout: { sessionIdx: 0, ... },
  journal: { editingEntry: null, ... },
  ...
}
```
Used to track UI state (modal open/closed, tab selection, form input focus). Render functions read `state.<section>` to decide what to show.

### Important Constants
- `APP_PASSWORD = "steely08!"` — unlock password (line ~60, marked `// CHANGE PASSWORD HERE`)
- `SECTIONS` object — navigation config
- `scriptures` array (109 cards)
- Supabase project ref: `mxlfwmwjkanvsjimralh`

---

## Development Tips

### Reusing Existing Patterns
Before writing new code, search for similar features:
- **Modal:** search `openSettings()` or `showFlash()` for examples
- **Event binding:** look at `renderHealthFood()` event listeners (lines ~3364)
- **Cloud sync:** check `cloudSaveJournal()` for the pattern to follow
- **Data dedup:** look at `cloudSyncJournal()` natural-key merging

### Common Gotchas
1. **Service worker caching:** Hard-refresh the browser if CSS/JS changes don't appear
2. **Password is hardcoded:** Search `APP_PASSWORD` to find/change it
3. **Don't use `Date.now()` in localStorage keys:** Use `isoDate()` helper instead (ISO string, timezone-safe)
4. **Cloud tables are optional:** A missing table won't break other syncs (isolated error handling)
5. **Natural-key dedup, not UUID:** Collisions are resolved by matching meaningful fields, not IDs
6. **Avoid async reads:** localStorage is sync; Supabase is pulled once at boot and never re-queried (all reads hit localStorage)

### Debugging Cloud Sync
1. Open DevTools → Network tab
2. Perform an action that triggers cloud save
3. Look for POST to `api.supabase.co` → check response for errors
4. Check browser console for `[CLOUD]` log messages (search the code for `console.log('[CLOUD]'...)`)
5. Supabase MCP available via `.mcp.json` for SQL queries if needed

---

## Deployment Checklist

Before pushing to live:

1. **Test locally** — open HTML in browser, hard-refresh, test feature end-to-end
2. **Check console** — no errors in DevTools Console
3. **Verify localStorage** — feature persists after reload
4. **Dark mode** — test both light and dark modes (all text readable)
5. **No hardcoded secrets** — search for API keys, passwords in code (should be in localStorage, not code)
6. **Commit message** — describe what changed, not just "fix" (e.g., "Add saved foods frequency-gating for health tracking")
7. **Push:** `git add -A && git commit -m "..." && git push`
8. **Verify live:** https://dombundy08-hue.github.io/Mission-Companion/ should show changes in ~60 seconds

---

## React Build & Deployment Checklist

When updating React components (Health Metrics, Exercise Logger, or new components):

### Pre-Build
1. **Update component files** — edit `.tsx` files in `react-components/src/components/`
2. **Test with dev server** — `cd react-components && npm run dev` (http://localhost:5173)
3. **Visual verification** — check styling, responsive design, dark mode
4. **Console check** — no TypeScript errors, no console warnings

### Build Phase
1. **Build React:** `cd react-components && npm run build`
2. **Verify dist/ output:** Check that `dist/index.html`, `dist/assets/index-*.js`, and `dist/assets/index-*.css` exist
3. **Deploy build:** `cp -r dist/* ../react-build/`
4. **Verify deployment:** Confirm `react-build/` now has updated assets with new hashes

### Integration Testing (Local)
1. **Hard-refresh browser** — Ctrl+Shift+R to clear cache
2. **Open main app** — `file:///C:/Users/shan_/missionary-companion/index.html`
3. **Navigate to Health → Stats** — verify health metrics iframe loads + displays (may need to set goals first)
4. **Navigate to Exercise → Routines** — verify exercise logger iframe loads + form renders
5. **Check console** — F12 → Console, look for any errors or CORS issues
6. **Check Network tab** — verify `react-build/assets/index-*.js` and `index-*.css` are requested with 200 OK

### postMessage Testing (if modified communication)
1. **Health metrics update** — if data changes in vanilla app, verify iframe receives update via postMessage
2. **Exercise logging** — submit exercise in iframe, verify vanilla app receives `exerciseSaved` message
3. **Settings toggle** — change metric visibility in settings, verify health metrics hide/show in iframe

### Commit & Deploy
1. **Stage changes:** `git add index.html react-build/ CLAUDE.md` (include any doc updates)
2. **Write descriptive message:** `git commit -m "Update React components: [what changed and why]"`
   - Example: "Update Health Metrics styling for better mobile responsiveness"
   - Example: "Add new Exercise History component with recent session summaries"
3. **Push to production:** `git push`
4. **Wait ~60 seconds** for GitHub Pages deployment

### Post-Deployment Verification
1. **Visit production:** https://missionarycompanion.com or https://dombundy08-hue.github.io/Mission-Companion/
2. **Navigate to Health/Exercise sections** (requires authentication)
3. **Verify iframes load** without 404 errors on assets
4. **Check Network tab** for successful asset loading
5. **Verify functionality** — if able to authenticate, test data display and form submission

### Rollback (if needed)
If deployment breaks the app:
1. `git revert HEAD` (creates new commit undoing previous)
2. `git push` (production auto-reverts in ~60 seconds)
3. **OR** manually edit `react-build/` assets to previous version and commit

---

## Phase Roadmap

The app is being built in 7 phases (defined in `TASKS.md`):

- **Phase 0 (DONE):** Dark mode, Church links, Settings expansion
- **Phase 1 (CURRENT):** Health tracking — Saved Foods frequency-gating, Weekly reflection pop-up
- **Phase 2:** Scripture & Objections — Lock mode, grace period, fallacy recognition
- **Phase 3:** Account & Data — Data wipe, demo accounts, QR codes
- **Phase 4:** Exercise — Style mixing, templates, multi-week programs, community
- **Phase 5:** Visual & Design — Church-app styling, full design pass
- **Phase 6:** Technical Infrastructure — In-app updates, Claude Code Skills, fulfillment framework
- **Phase 7:** SEO & Future — Backlinks, GitHub security

Reference `TASKS.md`, `PRD.md`, and `.claude/plans/clever-petting-kahn.md` for detailed specs per phase.

---

## References

- **CONTEXT.md** — Full architecture, auth, data tables, sync model (paste into new Claude chats for full context)
- **TASKS.md** — Executable task order with dependencies
- **PRD.md** — Product requirements by feature group
- **BACKLOG.md** — Complete backlog (includes BLOCKED items)
- **Supabase project:** https://app.supabase.com/projects (project ref: `mxlfwmwjkanvsjimralh`)
- **Live app:** https://dombundy08-hue.github.io/Mission-Companion/
- **GitHub:** https://github.com/dombundy08-hue/Mission-Companion (user account: dombundy08-hue)

---

## Questions?

If a prompt assumes something about the code that feels wrong, verify:
1. Search the actual file for the function/variable in question
2. Check if it's defined at a different line than expected
3. Look for natural-key dedup logic (not UUIDs) when touching cloud sync
4. Confirm the data model in Supabase schema before assuming a table exists

Always read the actual code before building; don't assume from a brief description.

---

---

## Deployment Architecture

**Hosting Model:**
- **Repository:** `https://github.com/dombundy08-hue/Mission-Companion` (main branch)
- **Hosting:** GitHub Pages with custom domain
- **Production Domain:** `https://missionarycompanion.com`
- **GitHub Pages URL:** `https://dombundy08-hue.github.io/Mission-Companion/` (aliases to missionarycompanion.com)
- **Deployment:** Push to `main` → GitHub Pages auto-deploys to production in ~60 seconds

**Key Paths:**
- Main app: `index.html` (vanilla JS/HTML/CSS, ~2,800 lines)
- React components: `react-components/` (TypeScript/Tailwind Vite project)
- React build output: `react-build/` (deployed as `/Mission-Companion/react-build/` on GitHub Pages)
- Asset paths for GitHub Pages must include `/Mission-Companion/` subdirectory prefix

**Critical:** When updating asset paths, use `/Mission-Companion/react-build/` not `/react-build/` for GitHub Pages subdirectory compatibility.

---

## React Integration Architecture (COMPLETED ✅)

### Overview
Separate React/TypeScript/Tailwind project embedded as iframes into vanilla JS app:
- **Health Section (Stats tab):** Health Metrics card with 7 circular progress indicators
- **Exercise Section (Routines tab):** Exercise Logger card with form + last session display

### Project Structure
```
missionary-companion/
├── index.html (vanilla JS primary app)
├── react-components/ (Vite + React + TypeScript)
│   ├── src/
│   │   ├── App.tsx (router: reads ?app query param → renders HealthApp or ExerciseApp)
│   │   ├── main.tsx (Vite entry)
│   │   ├── index.css (Tailwind imports)
│   │   ├── components/health/
│   │   │   ├── health-activity-card.tsx (7 metrics: calories, protein, sleep, water, mood, energy, weight)
│   │   │   └── health-app.tsx (HealthApp wrapper)
│   │   ├── components/exercise/
│   │   │   ├── exercise-activity-card.tsx (form + last session display)
│   │   │   └── exercise-app.tsx (ExerciseApp wrapper)
│   │   └── lib/utils.ts (cn() utility)
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── dist/ (build output)
├── react-build/ (deployed output)
│   ├── index.html (entry point for both iframes, routes via ?app param)
│   ├── assets/
│   │   ├── index--g8GZ92I.js (216KB React bundle)
│   │   └── index-CZQy5zqk.css (9.4KB Tailwind styles)
│   ├── favicon.svg
│   └── icons.svg
```

### Phases (All COMPLETED ✅)

**Phase A: Setup** — Vite project initialized with React, TypeScript, Tailwind, dependencies installed

**Phase B: Health Metrics Card** — `health-activity-card.tsx` displays 7 metrics in circular progress, receives data via postMessage

**Phase C: Exercise Activity Card** — `exercise-activity-card.tsx` provides exercise logging form, sends data via postMessage

**Phase D: Settings Integration** — Health Metrics card in settings (line 785+), 7 visibility toggles (lines 1997-2015), state synced to localStorage + Supabase

**Phase E: postMessage Communication** — `sendHealthMetricsUpdate()` (line 3766) sends data to health iframe; exercise listener (line 2171) receives logged exercises

**Phase F: Build & Deploy** — React components built, deployed to `react-build/`, iframes render at `/Mission-Companion/react-build/index.html?app=health|exercise`

### How iframes are integrated into vanilla JS:

**Health Metrics iframe (index.html, line 4178):**
```html
<iframe id="healthActivityFrame" 
  src="/Mission-Companion/react-build/index.html?app=health" 
  style="width:100%;height:600px;border:none;border-radius:12px;background:var(--card);"></iframe>
```

**Exercise Logger iframe (index.html, line 2618):**
```html
<iframe id="exerciseActivityFrame" 
  src="/Mission-Companion/react-build/index.html?app=exercise" 
  style="width:100%;height:650px;border:none;border-radius:12px;background:var(--card);"></iframe>
```

### postMessage Protocol

**Vanilla JS → React (health metrics data):**
- Function: `sendHealthMetricsUpdate()` at line 3766
- Called: On page load (Health Stats tab render) + on settings change
- Data: 7 metrics with value, trend %, unit; visibility array
- Example: `{type: 'updateMetrics', metrics: {...}, visible: ['calories', 'protein', 'sleep', 'water', 'mood', 'energy']}`

**React → Vanilla JS (exercise logging):**
- Listener: `window.addEventListener('message', ...)` at line 2171
- Event type: `exerciseSaved`
- Data: Exercise object with exerciseName, duration, reps, sets, weight, intensity, notes, timestamp
- Action: Saves to workoutLog localStorage + Supabase, shows flash message

### Client-Side Routing
React app uses URL query params to determine which component to render:
- `?app=health` → renders HealthApp (Health Metrics card)
- `?app=exercise` → renders ExerciseApp (Exercise Logger card)
- Default (no param): renders HealthApp

---

## Development Workflow (Build & Deploy)

### Building React Components

**Prerequisites:**
- Node.js 18+ installed
- `cd` to `react-components/` directory

**Step 1: Build React**
```bash
cd react-components
npm run build
```
Output: Built files in `dist/` (JavaScript bundle + CSS)

**Step 2: Deploy Build Output**
```bash
cp -r dist/* ../react-build/
```
This copies the build to `react-build/` which is deployed to production.

**Step 3: Commit Both Changes**
```bash
git add index.html react-build/  # Add both vanilla and React changes
git commit -m "Update React components: [describe change]"
git push
```
Production deployment happens automatically in ~60 seconds.

### Testing React Components Locally

**Development Server:**
```bash
cd react-components
npm run dev
```
Runs on `http://localhost:5173` for isolated testing.

**Testing in Context (with iframes):**
1. Build and copy as above: `npm run build && cp -r dist/* ../react-build/`
2. Open `file:///C:/Users/shan_/missionary-companion/index.html` in browser
3. Hard-refresh (Ctrl+Shift+R)
4. Navigate to Health → Stats or Exercise → Routines to see iframes load

### Modifying React Components

**To update Health Metrics:**
- Edit `react-components/src/components/health/health-activity-card.tsx`
- Test with dev server: `npm run dev`
- Rebuild: `npm run build && cp -r dist/* ../react-build/`
- Commit changes to vanilla `index.html` (if any) + `react-build/` (always)

**To update Exercise Logger:**
- Edit `react-components/src/components/exercise/exercise-activity-card.tsx`
- Same build/test/commit workflow

**To add new React components:**
- Create component in `react-components/src/components/`
- Export from HealthApp or ExerciseApp as needed
- Ensure postMessage communication if component needs parent app data
- Build and deploy via same workflow

---

## 21st.dev Integration Guide

**For Visual Improvements & New Components:**

When requesting design updates or new React components via 21st.dev or future prompts:

1. **Request Format:** Specify what you want:
   - "Improve the Health Metrics card styling" → updates `health-activity-card.tsx`
   - "Add a new Exercise History component" → new file in `react-components/src/components/exercise/`
   - "Make Health Metrics mobile-responsive" → update Tailwind breakpoints in existing component

2. **Component Isolation:** React components are isolated in iframes:
   - CSS is scoped to iframe (Tailwind classes don't leak to parent)
   - Styling is encapsulated per iframe
   - Use standard Tailwind v4 syntax for responsive design

3. **Data Communication:** If new components need parent app data:
   - Update `sendHealthMetricsUpdate()` for health components
   - Use `parent.postMessage()` for exercise components to send data back
   - Follow existing postMessage protocol (type + data structure)

4. **Build & Deploy Workflow After Changes:**
   - Claude Code will run: `npm run build` in `react-components/`
   - Copy output: `cp -r dist/* ../react-build/`
   - Commit: `git add` both vanilla and `react-build/` changes
   - Push: `git push` → production live in ~60 seconds

5. **Component Template (Copy & Adapt):**
   - Health components: inherit from `health-activity-card.tsx` pattern
   - Exercise components: inherit from `exercise-activity-card.tsx` pattern
   - Use Tailwind CSS v4 for styling
   - Use `lucide-react` for icons if needed

6. **Testing After Update:**
   - Developer will verify iframes load on production
   - Check Network tab for asset loading (no 404s)
   - Confirm data flows via postMessage
   - Test on production domain after deployment

---

## React Component Guidelines

### Health Components
- Receive data via postMessage: `{type: 'updateMetrics', metrics: {...}, visible: [...]}`
- Display 7 metrics: calories, protein, sleep, water, mood, energy, weight
- Each metric shows: circular progress indicator, value, unit, trend %
- Metric visibility controlled by settings (vanilla app sends visible array)
- Color coding: Calories (red), Protein (green), Sleep (blue), Water (cyan), Mood (yellow), Energy (orange), Weight (purple)

### Exercise Components
- Display last logged exercise session (if exists)
- Provide form to log new exercise: name, duration, sets, reps, weight, intensity, notes
- On submit: send via postMessage with type `'exerciseSaved'`
- Data format: `{type: 'exerciseSaved', exercise: {...}, timestamp: Date.now()}`
- Timestamp used to deduplicate exercises in vanilla app

### Styling Requirements
- Use Tailwind CSS v4 (responsive-first)
- Dark mode support via CSS variables from parent (inherited via iframe)
- Mobile-responsive: test at 375px (mobile), 768px (tablet), 1280px (desktop)
- Accessible: use semantic HTML, sufficient color contrast, ARIA labels where needed

### postMessage Security
- Always check `event.data.type` before processing
- Validate data structure before rendering
- Use `'*'` origin for postMessage (same-origin with parent in GitHub Pages)
- No sensitive data in postMessage (all user data already in iframe context)
**Metrics not updating:** Ensure vanilla JS sends postMessage AFTER iframe is loaded; add `iframe.onload` listener
**Build issues:** Run `npm install` in `react-components/`, verify `package.json` has all deps
**Tailwind not applying:** Check `tailwind.config.js` includes `src/**/*.{js,ts,jsx,tsx}`
