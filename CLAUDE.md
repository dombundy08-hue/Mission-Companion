# CLAUDE.md

Guidance, not enforced config — every line competes for attention. If a
rule isn't decision-relevant, cut it.

## How We Work

- Status updates: bullet lists, **Done** / **Needed**. No prose recaps.
- **Nothing gets built or deployed without Dom saying "approved."**
- Multi-item batches: plan mode first, clarify each item before writing
  code — not a guess dressed up as a fix.
- Vague or visual/mobile-only bug reports get a screenshot request before
  a blind fix attempt.
- **When addressing a bug, run the `mission-companion-deploy` skill (at
  least its Code Audit phase) to investigate first** — not an ad hoc
  read-and-guess.
- "Compiles clean" isn't proof. Verify against the real dev server or the
  live site, especially anything touching auth, RLS, or a third-party API.
- After a big batch: run the `mission-companion-deploy` skill's audit
  cycle — it's what keeps this file current, but only when invoked.

---

## Architecture

- React 19 + Vite + TS + Tailwind v4 PWA. `react-components/src/` is the
  only source — no vanilla HTML, no iframe (retired 2026-08-04). Ignore
  anything describing `render<Tab>()` or postMessage.
- Deploy: `cd react-components && npm run build`, copy `dist/*` to repo
  root, commit, push.
- Landing page: `/home` (`screens/HomeScreen.tsx`).
- Hosting: GitHub Pages, public repo (free plan requires it) — no real
  secret lives in the repo, so this is an accepted tradeoff.

## Accounts & Data

- Supabase Auth, soft-capped at 5 accounts (`lib/auth.ts`).
- **Every table has `user_id default auth.uid()` + owner-scoped RLS — RLS
  already does the access control, don't hand-write `.eq('user_id', ...)`
  filters.** Exceptions: `app_settings` (unique on `user_id, key`),
  `shared_programs` (open read; likes go through the
  `increment_program_likes` RPC, not a direct UPDATE), `contact_leads`
  (open insert for anonymous QR scans, scoped by
  `auth.uid()::text = code`).
- Demo Mode is fully local, never touches Supabase (`lib/demo.ts`).
- Sign-out wipes local data (`AuthContext.tsx`) — required, since
  localStorage is read before any cloud pull.
- Supabase URL/publishable key are meant to be public — RLS enforces
  access, not secrecy of that key.
- **AI and food-search calls go through Supabase Edge Function proxies**
  (`supabase/functions/claude-proxy`, `usda-proxy`) — the real API keys
  live only as server-side secrets there. Never reintroduce a
  client-side key; a prior attempt to embed one in the build got
  GitHub's push protection blocked for exactly this reason.

## Data & Sync

- localStorage is canonical (`lib/storage.ts`'s `getLS`/`setLS`).
- Every write also fires a `cloudSave*()` (`lib/supabase-sync.ts`),
  non-blocking. `cloudSaveSettings()` batches several keys into one
  upsert when they belong to one logical action (e.g. onboarding).
- `lib/cloud-pull.ts`: only `pullBootSettings()` runs eagerly at login
  (small, and the onboarding gate depends on it). Per-section data
  (journal/miracles/scripture, workouts, health logs) pulls lazily on
  first visit to that section via `pullSectionOnce()` — additive-only,
  deduped by natural key, same as before, just deferred until needed.

## Sections & Navigation

- `lib/sections.ts`'s `SECTIONS` array is the single source —
  `TopBar`/`BottomNav` build themselves from it.
- Routing: `/:sectionId/:tabId` under `<AppShell>`; `/home`, `/contacts`,
  `/contact/:code` are standalone routes.
- Each section has its own CSS palette (`.section-<id>` in `index.css`)
  plus a 4-step tint scale (`--tint-1..4`, via `color-mix`) for shading
  cards within a section. Home always uses the base palette.

## Making Changes

- New screen: component under `screens/`; if it's a tab, add to
  `SECTIONS` and `App.tsx`'s `TabRoute`.
- New Supabase table: `user_id default auth.uid()` + RLS from the start,
  a `cloudSave*()`, and a pull function if it should round-trip.
- CSS: use the `var(--*)` tokens, never hardcode colors — source of truth
  for the whole palette/type/spacing/component system is
  `design-system/mission-companion/MASTER.md`.

---

## Verify & Deploy

1. Dev server: `mission-companion-react` launch config — full restart
   after edits, not just reload (Vite HMR serves stale closures).
2. `npx tsc -b` clean.
3. Real write+read check (not just a clean console) for anything
   touching a write/RLS path.
4. Light + dark mode for any palette touched.
5. `npm run build`, copy `dist/*` to repo root — **never delete old-hash
   `assets/*.js`/`.css` first** (a `PreToolUse` hook in
   `.claude/settings.local.json` blocks this; it caused a real
   production crash once) — push, poll `missionarycompanion.com` for the
   new hash.

## Gotchas

- `sw.js` exists at repo root **and** `react-components/public/sw.js` —
  keep byte-identical by hand.
- A migration adding `user_id` to an existing table runs with no
  session, so `auth.uid()` is null — default to the owner's literal uuid
  first, verify, then a second migration flips the default.
- A "starts clean" feature (wipe/reset) needs both entry and exit
  checked, not just one.
- `git push` is blocked by a `PreToolUse` hook unless
  `mission-companion-deploy` just ran clean against the current commit
  (one-time bypass: create `.claude/.deploy-override`) — see that
  skill's "Push gate" section.
- `.claude/` is gitignored project-wide — only files force-added
  (`git add -f`) are tracked (both skill `SKILL.md` files needed this).
  Run `git ls-files .claude/` before assuming an edit under `.claude/`
  is actually saved to history.

---

## References

- Supabase: https://app.supabase.com/projects (ref `mxlfwmwjkanvsjimralh`)
- Live app: https://missionarycompanion.com
- GitHub: https://github.com/dombundy08-hue/Mission-Companion (public,
  free-tier — see Hosting)
- Deploy/audit skill: `.claude/skills/mission-companion-deploy/SKILL.md`
- Performance report skill (read-only, auto-runs after deploy):
  `.claude/skills/mission-companion-optimize/SKILL.md`
- Style/design source of truth: `design-system/mission-companion/MASTER.md`
- Feature/build status: `react-components/docs/build-plan.md` (there is
  no unified PRD — this + this file are the current sources)
