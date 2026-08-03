# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Architecture Overview

**Mission Companion** is a single-file PWA (~2,800 lines vanilla JS/HTML/CSS) for LDS missionaries—personal journal, language practice, scripture mastery, health tracking, and exercise building.

- **Single source of truth:** `C:\Users\shan_\mission-companion\index.html` (this is the ONLY file to edit)
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

1. **Local dev:** Open `file:///C:/Users/shan_/mission-companion/index.html` in a browser
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
