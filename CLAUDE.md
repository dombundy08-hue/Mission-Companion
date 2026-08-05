# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

**After any significant feature batch or architectural change** (not every
tiny commit), run the `mission-companion-deploy` skill's audit cycle
(Code Audit → Auto-Fix → Learning) — it's the mechanism that keeps this
file and `SKILL.md` from drifting stale, but only if actually invoked.

---

## Architecture Overview

**Mission Companion** is a React 19 + Vite + TypeScript + Tailwind v4 PWA for LDS
missionaries — personal journal, language practice, scripture mastery, health
tracking, and exercise building. It supports a small number (soft-capped at 5)
of real, independent accounts, each with fully private data.

- **Single source of truth:** `react-components/src/` — this IS the site. There is
  no vanilla `index.html` app anymore and no iframe embedding — both were retired
  2026-08-04 (preserved at git tag `pre-build-website` if ever needed). Do not
  trust any doc, comment, or memory describing a `render<Tab>()`/`state.<section>`/
  postMessage/iframe architecture — that's gone.
- **Build:** `cd react-components && npm run build` → outputs to `react-components/dist/`,
  copied to the repo root (`index.html`, `assets/`, `icons/`, `fonts/`, `sw.js`,
  `manifest.json`) — that root output is what GitHub Pages actually serves.
- **Deployment:** build, copy `dist/*` to repo root, `git add -A && git commit && git push`
  → live in ~60 seconds. **Never delete old-hash `assets/*.js`/`*.css` files before
  copying the new build in** — see Common Gotchas #7, this caused a real blank-screen
  PWA crash. Just let them accumulate; they're small and immutable.
- **Auth:** real Supabase Auth (sign-up/sign-in/sign-out), not a shared password.
  See "Accounts & Data Isolation" below — this replaced a single hardcoded
  `APP_PASSWORD` model entirely as of 2026-08-05.
- **Default landing page:** `/home` (`react-components/src/screens/HomeScreen.tsx`)
  — a dashboard with one tile per section (Spiritual/Exercise/Health), each showing
  a light data snapshot and linking into that section's normal tab interface.
  `/` redirects here. Reached from anywhere via the "Missionary Companion" button
  in the center of every section's header (`TopBar.tsx`).
- **Hosting:** GitHub Pages at https://missionarycompanion.com (aliases to
  https://dombundy08-hue.github.io/Mission-Companion/). **Repo is public, GitHub
  account is on the free plan** — Pages only serves from public repos on free,
  so the repo cannot be made private without a paid GitHub plan (would take the
  site down otherwise). This is an accepted, known tradeoff — no secrets live in
  the repo (see "What's actually public" below).

---

## Accounts & Data Isolation

Real multi-user accounts (Supabase Auth), soft-capped at 5 total via a `profiles`
table + `auth.users` insert trigger (`react-components/src/lib/auth.ts`'s
`accountCount()`/`MAX_ACCOUNTS`, checked client-side before signup — not a hard
DB-level cap).

- **Sign-up/sign-in UI:** `react-components/src/components/shell/LockScreen.tsx` —
  a Log In / Create Account toggle, not a password gate. Collects a display name
  at signup (passed via `signUp()`'s `options.data.display_name`, so it's on
  `auth.users.raw_user_meta_data` immediately — before email confirmation
  completes, since there's no session yet to run a follow-up `profiles` update).
- **Session state:** `react-components/src/components/shell/AuthContext.tsx` —
  `authenticated` is derived from a real Supabase session
  (`sb.auth.getSession()` + `onAuthStateChange()`), not a localStorage flag.
- **Every real data table has a `user_id uuid references auth.users(id)` column**,
  defaulting to `auth.uid()`, with RLS `USING (auth.uid() = user_id) WITH CHECK
  (auth.uid() = user_id)`. Existing `insert()`/`select()`/`update()`/`delete()`
  call sites in `supabase-sync.ts`/`cloud-pull.ts` needed **no code changes** for
  this — the column default fills `user_id` on insert, and RLS transparently
  filters everything else at the database level. Three tables are special cases:
  - **`app_settings`** — used to be one GLOBAL flat `{key, value}` store (e.g. a
    single shared `'apiKey'` row for *everyone*). Now unique on `(user_id, key)`
    instead of `key` alone. `cloudSaveSetting()`'s `.upsert(..., {onConflict:
    'user_id,key'})` must match this exactly — if this ever drifts from the DB
    constraint, every settings save breaks silently (caught, marked pending,
    never surfaced as an error).
  - **`shared_programs`** (Community) — SELECT stays open (`using (true)`, browsable
    by every account) but INSERT/UPDATE/DELETE are owner-only. "Liking" someone
    else's program goes through a `security definer` RPC,
    `increment_program_likes(program_id)`, not a direct `UPDATE` — a plain
    owner-only UPDATE policy would silently block anyone but the author from
    liking. `likeSharedProgram(id)` in `supabase-sync.ts` calls the RPC.
  - **`contact_leads`** (public QR contact-share) — INSERT stays open (submitted
    by anonymous strangers with no session), SELECT/DELETE restricted to
    `auth.uid()::text = code`. `code` is no longer a random string — it's the
    owning account's own `auth.uid()`, returned by `lib/qr.ts`'s now-`async`
    `getQrCode()`. The public share page (`screens/ContactShare.tsx`) looks up
    and displays that account's `display_name` from `profiles` dynamically —
    never hardcode a person's name there again, a new account's QR code must
    show *their* name.
- **Demo Mode is untouched and orthogonal** — fully local, never calls
  `sb.auth.*` or writes to Supabase at all (`lib/demo.ts` has zero Supabase
  imports; `sbOnline()` explicitly excludes it). Checked *before* real-session
  state everywhere in `AuthContext.tsx`.
- **Sign-out (`AuthContext.tsx`'s `lock()`) calls `sb.auth.signOut()` then
  `wipeLocalData()`** (full `localStorage.clear()` + reload) — not optional
  cleanup. This app is local-first (localStorage read before any cloud pull
  runs), so without the wipe, a second person logging in on the same browser
  would see the first account's cached data flash on screen. "Lock App" and
  "Sign Out" are deliberately the same action for this reason.
- **What's actually public, and why that's fine:** the Supabase URL + anon/
  publishable key are hardcoded in `supabase-sync.ts` — this is *by design*,
  Supabase's own "publishable key" concept (like a Stripe publishable key),
  safe to ship client-side because RLS (above) is what actually enforces
  access, not hiding this key. No real secret (a user's own Anthropic/USDA API
  key, or anyone's account password) is ever in the repo or the built bundle —
  those live only in the signed-in user's own `localStorage` and their own
  `app_settings` rows.

---

## Data & Sync Model

### localStorage (canonical, synchronous)
Render functions read from localStorage directly — synchronous, no loading
state needed for most UI. `getLS(key, fallback)` / `setLS(key, val)` in
`lib/storage.ts` — JSON parse/stringify is automatic.

### Supabase (cloud layer)
Project ref: `mxlfwmwjkanvsjimralh`. Two directions:
- **Push** — every local write also fires a `cloudSave*()` call
  (`lib/supabase-sync.ts`), non-blocking, isolated per-table error handling
  (`sbOnline()` gate + `markPending()` on failure — never throws, never blocks
  the local save).
- **Pull** — `lib/cloud-pull.ts`'s `pullAndMergeAll()`, called once per
  authenticated session from `App.tsx`'s `useCloudSynced()`. Additive-only,
  never clobbers existing local data, deduped by natural keys where no
  `cloudId` exists yet (e.g. `date + body` for journal/miracles). This was
  the fix for a real "all my data is gone" incident (2026-08-04) — a device
  with empty localStorage used to show nothing even though the account's
  real data was safely in Supabase, because pull-down sync had never
  actually been built despite being documented as intended.

---

## Navigation & Section Architecture

Data-driven — no hand-written nav markup. `lib/sections.ts`'s `SECTIONS` array
is the single source; `TopBar.tsx`'s section switcher and `BottomNav.tsx`'s
tabs both build themselves from it.

```ts
SECTIONS = [
  { id: 'spiritual', tabs: [journal, miracles, objections, spanish, mastery, email] },
  { id: 'exercise',  tabs: [workout, routines, wlog] },
  { id: 'health',    tabs: [health, hfood, hbody, hstats] },
]
```

Routing (`App.tsx`): `/:sectionId/:tabId` under `<AppShell>` (TopBar +
BottomNav chrome). `/home`, `/contacts`, and the public `/contact/:code` are
top-level routes outside that chrome — each is its own self-contained screen
with its own minimal header, no BottomNav. `TabRoute` in `App.tsx` is a plain
switch mapping `sectionId/tabId` to the real screen component.

### Per-section color palettes
Every section has its own distinct CSS-variable palette in `index.css`,
applied via a `.section-<id>` class on `<html>` (same element `theme.ts`
toggles `.dark` on, so `.dark.section-exercise` etc. combine correctly) —
`AppShell.tsx`'s `useEffect` sets/clears the class based on the route's
`sectionId`. **Home never gets one of these classes** — it always shows the
untouched base `:root`/`.dark` palette, deliberately distinct from every
section:
- Home (base) — blue
- Spiritual (`.section-spiritual`) — purple
- Exercise (`.section-exercise`) — orange
- Health (`.section-health`) — green

`lib/sections.ts`'s `SECTION_ACCENT_COLORS` is a **hand-maintained** plain-JS
mirror of each section's `--primary`/`--accent` hex (light + dark), used by
`HomeScreen.tsx`'s tile swatches since Home isn't wrapped in any `.section-*`
class and can't just read the CSS variable. If a palette's hex values ever
change in `index.css`, update this map too — nothing keeps them in sync
automatically.

---

## How to Make Changes

### Adding a screen/feature
1. Add the screen component under `react-components/src/screens/`.
2. If it belongs to a section's tab set, add it to `lib/sections.ts`'s
   `SECTIONS` and to `App.tsx`'s `TabRoute` switch.
3. If it's a standalone top-level page (like `/home`, `/contacts`), add a
   sibling `<Route>` in `App.tsx`'s `GatedApp`, outside `<AppShell>`.
4. Reuse existing data helpers before writing new ones — `lib/health-data.ts`,
   `lib/exercise-data.ts`, `lib/mastery.ts` already cover most "today's
   snapshot" / streak / averages needs.

### Modifying data storage
- **localStorage:** `setLS(key, value)` from `lib/storage.ts` — JSON handled automatically.
- **Supabase:** add a `cloudSave*()`/`cloudDelete*()` function in
  `supabase-sync.ts` following the existing pattern (RLS + `user_id` default
  handles ownership automatically — don't hand-add `.eq('user_id', ...)`
  filters). New tables need `apply_migration` with `user_id default
  auth.uid()` + owner-scoped RLS from the start, and a matching pull function
  in `cloud-pull.ts` if the data should round-trip across a re-login.

### Dark Mode & CSS
CSS custom properties in `index.css`, light values in `:root`, dark in `.dark`
(plus each section's own `.dark.section-*` override). Always use
`var(--foreground)`/`var(--card)`/`var(--background)` etc. — never hardcoded
colors. `--navy`/`--navy-soft`/`--gold`/`--gold-dark` are this app's own
extra tokens (not standard shadcn vars) — every palette defines all four.

---

## Testing & Verification

1. **Local dev:** `mission-companion-react` launch config (real Vite dev
   server) — **not** `mission-companion` (serves a stale prebuilt `dist/` via
   static server, will never reflect source edits).
2. **After any edit, restart the dev server** (`preview_stop` + `preview_start`),
   don't just reload the tab — Vite HMR can silently serve stale closures,
   especially for files exporting both a component and a hook (e.g.
   `AuthContext.tsx` exporting `AuthProvider` + `useAuth`). A page reload alone
   is not enough to trust a "did this fix work" check.
3. **`npx tsc -b` clean** before considering any change done.
4. **Verify data actually round-trips**, not just "no console errors" — a
   real write + a real read (via `execute_sql` against Supabase, or logging
   out and back in) is the only real proof a fix touching the write/RLS path
   works. "The UI looks right" has been wrong before.
5. **Dark mode** — check both light and dark for every palette touched.
6. **Deploy:** `git push` → verify live via
   `curl -sL https://missionarycompanion.com/index.html | grep -o 'index-[A-Za-z0-9_-]*\.\(js\|css\)'`
   polled until the new hash appears (~30–60s for GH Pages).

---

## Common Gotchas

1. **`react-components` dev server vs. static preview** — `.claude/launch.json`
   has two configs; only `mission-companion-react` reflects source edits (see
   Testing & Verification above).
2. **Vite HMR staleness on files exporting both a component and a hook** — full
   server restart needed, not just a reload.
3. **A "starts clean" guarantee needs both entry AND exit checked, not just
   one.** Demo Mode's `unlockDemo()` originally only wiped `localStorage` on
   exit — a device already holding real account data would leak it into the
   demo session on the *first* entry, before the first lock. Fixed
   2026-08-04. Applies to any future feature with the same premise.
4. **Open-RLS tables need client-side shape validation on read**, same as any
   other untrusted input — anyone with the public anon key can `POST`
   arbitrary JSON directly to a table whose RLS allows it (e.g.
   `shared_programs`), bypassing the app's own UI entirely.
5. **Never delete old-hash `assets/*.js`/`*.css` files on deploy.** The
   service worker's cached HTML shell can reference a deploy's hashed
   filenames for a while after a newer deploy goes live (stale-while-
   revalidate). Deleting old files turns that normal staleness into a hard
   crash — React never mounts, blank white screen, no visible error.
   Reproduced live 2026-08-04. Just let old files accumulate; they're small
   and immutable. `sw.js`'s `CACHE` version should still be bumped whenever
   an *unhashed* `public/` asset's content changes under the same filename
   (icons, favicon, manifest) — that's a different, still-necessary case.
6. **`sw.js` exists in two places** (`sw.js` at repo root, and
   `react-components/public/sw.js`) and must be kept byte-identical by
   hand — no build step enforces this. Always edit/copy both.
7. **Migrations that add a `user_id` column run with no authenticated
   session** — `auth.uid()` evaluates to `null` at migration time, which
   violates a `not null` constraint immediately. The correct sequence for
   backfilling an existing single-owner table: default to that owner's
   *literal* uuid first (backfills existing rows in the same statement),
   verify, **then** a separate migration flips the default to `auth.uid()`
   for future inserts.
8. **RLS is doing the real access-control work, not the client.** When
   adding a new table or a new call site against an existing one, don't
   hand-write `.eq('user_id', ...)` filters — the column default + RLS
   policy already scope inserts/selects/updates/deletes correctly. Manually
   adding filters is redundant at best and a false sense of security if RLS
   itself is ever misconfigured.
9. **A `security definer` RPC is the right tool when RLS is legitimately too
   coarse** — e.g. letting any signed-in user bump a shared counter (Community
   likes) without granting them full row-owner UPDATE rights. Keep these
   narrow (touch exactly one column, one operation) — don't reach for
   `security definer` as a general RLS-bypass habit.
10. **Supabase's default email sending has a low rate limit** — expect
    "email rate limit exceeded" during real signup testing, especially
    back-to-back. Not a bug. For a small known-group app (this one, capped at
    5 accounts), turning off "Confirm email" in Supabase Auth settings
    (Authentication → Providers → Email) removes the email step from signup
    entirely and sidesteps this — a reasonable tradeoff at this trust level,
    not appropriate for a public-signup product.

---

## Deployment Checklist

1. `cd react-components && npx tsc -b` clean.
2. Test locally against the real dev server — full restart after edits, not just reload.
3. Console — no new errors (the Browser pane's console history can include
   stale entries from before a restart; check timestamps/context before
   treating an old error as current).
4. Dark mode — check every palette touched.
5. No secrets in code — Supabase anon/publishable key is fine (see "What's
   actually public" above); a real password, a service-role key, or a
   user's own API key never should be.
6. `npm run build` in `react-components/` (auto-copies fresh `dist/index.html`
   over `dist/404.html` — don't hand-copy separately).
7. Copy `dist/*` to repo root **without deleting old-hash asset files** (Gotcha #5).
8. `git push` → poll for the new hash live (~60s).
9. Any change to a table's schema/RLS that a live client already talks to —
   ship the matching client fix in the **same** deploy, not a follow-up one.
10. Any feature with a "starts clean" guarantee — verify both entry and exit.

---

## References

- **Supabase:** https://app.supabase.com/projects (ref: `mxlfwmwjkanvsjimralh`)
- **Live app:** https://missionarycompanion.com
- **GitHub:** https://github.com/dombundy08-hue/Mission-Companion (public repo,
  free-tier account — see "Hosting" above for why it can't be made private
  without breaking Pages)
- **Deploy/audit skill:** `.claude/skills/mission-companion-deploy/SKILL.md`
  — runs a 4-agent Deploy/Code-Audit/Auto-Fix/Learning cycle; keep its
  benchmark log current, it's the project's own memory of past incidents.
