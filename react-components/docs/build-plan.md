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
| 5 | Spiritual → Spanish | ⏳ Placeholder | ~92 lines vanilla — practice mode + AI chat (Claude Haiku), needs the `callClaude()` API wrapper ported |
| 6 | Spiritual → Objections | ⏳ Placeholder | ~88 lines vanilla — AI practice chat, fallacy/comeback panel (added Phase 2 today) — needs `OBJECTIONS` array (50 entries) + `callClaude()` ported |
| 7 | Spiritual → Mastery | ⏳ Placeholder | ~176 lines vanilla incl. streak/grace-day logic (added today) — 109-card `SCRIPTURE_DEFAULTS` array + spaced-repetition practice modes |
| 8 | Spiritual → Email | ⏳ Placeholder | ~193 lines vanilla — voice examples + AI email generation, needs `callClaude()` |
| 9 | Exercise → Routines | ⏳ Placeholder | Largest/most complex screen family: Routines list (~52) + part-type picker (~39) + Timed/Rep/Circuit editors (~32/32/41) + Assemble (~231, multi-part state machine) + Workout player (~109) + Rep player (~62) + Workout log (~166) |
| 10 | Health → Food | ⏳ Placeholder | ~320 lines vanilla — food search (USDA API), rough-estimate mode (AI), Saved Foods (frequency-gated), Fast Sunday toggle |
| 11 | Health → Stats | ⏳ Placeholder | Existing `HealthActivityCard`/`ActivityCard` component already built (earlier session) — needs re-wiring from postMessage/iframe to native props now that it's in the same app, no iframe boundary |
| 12 | Health → Body | ⏳ Placeholder | ~62 lines vanilla — body metrics form |
| 13 | Health → Setup (goals) | ⏳ Placeholder | ~313 lines vanilla — large goals-editor form |
| 14 | Settings | ⏳ Not started | ~537 lines vanilla — biggest single screen: dark mode, API keys (password-gated), voice picker, Scripture Lock toggle, backup/export, Church link. Highest risk/complexity in the whole app |
| 15 | Scripture Lock overlay | ⏳ Not started | Full-screen gate requiring typing a practiced scripture on idle/cold-unlock, added this session — cuts across app-shell level, not a single screen |
| 16 | Kinetic loading screen | ⏳ Not started | LOADING/MISSIONARY+COMPANION word-cycle animation, added this session — self-contained, should be a quick, low-risk port once picked up |

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
