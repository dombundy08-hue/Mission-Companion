# Mission Companion → React migration — build plan

Branch: `build-website-migration`. `main` (the live deployed app) is
untouched — see `pre-build-website` tag for the exact pre-migration
checkpoint. This is a resumable checklist, not a claim of completion.

Design system: `design-system/mission-companion/MASTER.md`.

## Screens

| # | Section/Tab | Status | Notes |
|---|---|---|---|
| 1 | App shell (topbar, bottom nav, section switcher, routing) | ✅ Done | `components/shell/*`, `lib/sections.ts`, React Router in `App.tsx` |
| 2 | Spiritual → Journal | ✅ Done | List/new/read, search, mailto backup export, cloud sync. Prompt pool is a 50-item real subset of the vanilla app's 730 — full copy is a follow-up (`lib/journal-prompts.ts`) |
| 3 | Spiritual → Miracles | ✅ Done | Full CRUD + search + cloud sync, matches vanilla 1:1 |
| 4 | Spiritual → Glossary | ✅ Done | Full CRUD (add/list/edit/delete) + search + cloud sync, matches vanilla 1:1 |
| 5 | Spiritual → Spanish | ✅ Done | 3 practice modes (street/doorstep/lesson) + AI chat via shared `lib/claude-api.ts`, matches vanilla 1:1 |
| 6 | Spiritual → Objections | ✅ Done | Real 43-entry `OBJECTIONS` array (verbatim from vanilla — the earlier "50" note was an inaccurate estimate, not a real target) + fallacy/comeback reveal panel + `callClaude()`, matches vanilla 1:1 |
| 7 | Spiritual → Mastery | ✅ Done | Real 109-card `SCRIPTURE_DEFAULTS` deck, weighted spaced-repetition selection, 3 practice modes (ref→text/blank/text→ref), grace-day streak logic, cloud sync via `cloudSaveScripture`, "Add My Own" custom cards, matches vanilla 1:1 |
| 8 | Spiritual → Email | ✅ Done | Voice-example collection (first-run + "Update My Voice"), highlights composer, `callClaude()` write, copy-to-clipboard, backup-reminder banner (routes to Journal via React Router instead of the vanilla DOM-scroll approach), matches vanilla 1:1 |
| 9 | Exercise → Workout | ✅ Done | Full spoken workout coach/player: lead-in countdown (beeps + speech via Web Speech API), per-second timed engine, pause/resume/skip/end, multi-part session sequencer, Rep-part player with per-exercise rest timers, done screen. Ported to `lib/audio.ts` (speak/beep/primeAudio) + `screens/Workout.tsx` (ref-based engine state to avoid stale closures in interval/timeout callbacks) |
| 9b | Exercise → Routines | ✅ Done | Full builder: list, pick-part-type, Timed/Rep/Circuit editors, Assemble (add/reorder/edit/delete parts), sample routine, edit/delete existing routines. `lib/exercise-data.ts` has the pure logic (routineParts/expandCircuit/partSummary etc., legacy flat-array auto-wrap preserved) |
| 9c | Exercise → Log | ✅ Done | Uses the `ActivityCard` ring-style component as a full replacement for the plain vanilla list, per explicit user request — real data (workouts this week/minutes/all-time minutes), workout history list with delete |
| 10 | Health → Today | ✅ Done | Snapshot summary (week/month toggle), water/electrolyte counter, mood+energy 1-5 taps, symptom check-in with ranked "what's running low" panel, edit-goals link. Redirects to Setup if no goals set yet, matches vanilla |
| 11 | Health → Food | ✅ Done | Full food search (USDA + Open Food Facts APIs), rough-estimate mode (AI via `callClaude`), Saved Foods (add/one-tap log/delete, frequency-gated "save this" prompt ≥10 identical logs/90 days), Fast Sunday toggle. Curly-quote HTML-attribute bug from vanilla's `renderHealthFood()` NOT reproduced (real JSX attributes throughout) |
| 12 | Health → Body | ✅ Done | Weight/sleep logging, weight sparkline trend (real SVG port), expandable full entry list with delete |
| 13 | Health → Setup (goals) | ✅ Done | Profile form, calorie-goal suggestion formula (BMR + activity multiplier + goal-weight deficit/surplus), daily goals editor |
| 14 | Health → Stats | ✅ Done | Uses the `ActivityCard` ring-style component (`components/ui/activity-card.tsx`) as a full replacement for the plain vanilla status-dot list, per explicit user request — real averages/goals data (calories/protein/sleep/water/mood/energy), week/month toggle. No longer postMessage/iframe-driven — native props |
| 15 | Settings | ✅ Done | `components/shell/SettingsModal.tsx`, opened from the gear icon in `AppShell.tsx`. 6 pages ported 1:1 from vanilla's `renderSettingsView()`: Appearance (dark mode via `lib/theme.ts`, `.dark` class not vanilla's `data-theme` attr), Pop-ups (reflection day/time), Health Metrics (visible-metrics checkboxes), API Keys & Security (password-gated reveal, same hardcoded `APP_PASSWORD`), Preferences/Voice (`lib/audio.ts` voice list + test), Account (Scripture Lock toggle + Lock App button), plus the Give link. **Known gap, not fixed by this port**: the React app has no boot-time password lock screen at all (dropped silently during cutover) — "Lock App" and Scripture Lock persist their localStorage/cloud state but nothing enforces them yet. Health Metrics visibility also isn't consumed by `HealthStats`/`HealthToday` yet. Both are follow-ups. |
| 16 | Scripture Lock overlay | ⏳ Not started | Full-screen gate requiring typing a practiced scripture on idle/cold-unlock, added this session — cuts across app-shell level, not a single screen. Blocked on/bundled with the missing lock screen (see #15's gap note) |
| 17 | Kinetic loading screen | ✅ Done | `components/shell/KineticLoader.tsx` — real 3D fly-in/fly-out char animation, real brand words (LOADING/MISSIONARY/COMPANION), wired as the app boot splash gated on `document.fonts.ready` |

## Supporting infrastructure

| Item | Status | Notes |
|---|---|---|
| shadcn/Tailwind v4 setup | ✅ Done | `components.json`, `radix-ui` installed. Note: `npx shadcn@latest init` has a real bug with this project's TS "references" tsconfig pattern (`Could not load the workspace config`) — worked around by adding `compilerOptions.paths` directly to the root `tsconfig.json` (harmless/redundant alongside the project-reference files) and using `shadcn add` per-component instead of `init`. |
| Design tokens (`index.css`) | ✅ Done | Full shadcn CSS-variable convention mapped to the real Mission Companion palette/fonts/shadows, both light+dark, `@theme inline` Tailwind v4 mapping |
| Self-hosted fonts | ✅ Done | Lexend + Newsreader copied to `public/fonts/` |
| React Router | ✅ Done | `react-router-dom` 7.18.2. **Known issue**: `npm audit` flags a high-severity advisory (RSC-mode CSRF bypass) affecting 7.12.0-8.2.0 — inapplicable to this pure client-side SPA (no RSC/SSR in use), left as-is; revisit if this project ever adds SSR. |
| Supabase sync module | 🟡 Partial | `lib/supabase-sync.ts` covers Journal/Miracle/Glossary/Settings saves + generic delete, ported 1:1 from `index.html`'s real functions (same table names, same natural-key stamping). Remaining tables (scripture_progress, routines, workout logs, saved_foods, health) not yet ported. **Not live-write-tested against production Supabase this session** — deliberately, to avoid touching real user data during a build/verification pass; do a careful live test before trusting this in production. |
| PWA (manifest + service worker) | ⏳ Not started | Use `build-website` skill's `pwa-checklist.md` pattern (which is itself derived from this app's own `sw.js` fix) |
| `HealthActivityCard`/`ActivityCard` | ✅ Pre-existing | Built in an earlier session, currently postMessage/iframe-driven — needs re-wiring to native props (item #11 above) |
| `ExerciseActivityCard` | ✅ Pre-existing | Built in an earlier session, not yet wired into any route |

## Known pre-existing issues to NOT reproduce in the port
- `var(--navy)` used as a direct text color in ~70 places in the vanilla app is a dark-mode contrast bug (near-invisible text) — this port uses `--foreground`/`var(--text)`-equivalent everywhere instead. See `MASTER.md` color notes.
- The vanilla app's `renderHealthFood()` has a real curly-quote HTML-attribute bug (breaks the Food-mode toggle) — don't copy the buggy markup verbatim when porting Health → Food; fix it as part of the port.

## Next steps (in priority order)
1. Wire `HealthActivityCard`/`ExerciseActivityCard` natively (they already exist, just need route wiring — likely the fastest next win).
2. Port Spanish/Objections/Email (all need the shared `callClaude()` API wrapper — build that once, reuse three times).
3. Port Mastery (scripture deck + streak).
4. Port Health Food/Body/Setup.
5. Port Exercise (largest single chunk — do last, budget real time for it).
6. Settings screen (largest/highest-risk single screen).
7. Scripture Lock overlay + kinetic loading screen (both app-shell-level, self-contained).
8. PWA layer.
9. Full verification pass + live Supabase sync test (carefully, on a test account or with explicit care around real data) before ever considering cutover.
