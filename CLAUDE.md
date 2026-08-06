# CLAUDE.md

This file provides guidance to Claude Code working in this repository.
Keep it lean — every line competes for attention, so if a rule isn't
decision-relevant, cut it.

**After a significant feature batch or architectural change**, run the
`mission-companion-deploy` skill's audit cycle (Code Audit → Auto-Fix →
Learning) — it's what keeps this file and `SKILL.md` current, but only
runs when actually invoked.

---

## Architecture

Mission Companion: React 19 + Vite + TypeScript + Tailwind v4 PWA for LDS
missionaries (journal, language practice, scripture mastery, health,
exercise). Supports real, independent accounts (soft-capped at 5) with
fully private data per account.

- **Source of truth:** `react-components/src/` — this IS the site. No
  vanilla `index.html`, no iframe embedding (retired 2026-08-04, tag
  `pre-build-website`). Ignore any doc/comment describing `render<Tab>()`,
  `state.<section>`, or postMessage — that architecture is gone.
- **Build/deploy:** `cd react-components && npm run build`, copy `dist/*`
  to repo root, commit, push → live in ~60s.
- **Auth:** real Supabase Auth, not a shared password. See "Accounts &
  Data Isolation."
- **Default landing page:** `/home` (`screens/HomeScreen.tsx`) — one tile
  per section with a live snapshot, linking into that section's normal
  tabs. Reachable from any section via the "Missionary Companion" button
  in the header (`TopBar.tsx`).
- **Hosting:** GitHub Pages, custom domain missionarycompanion.com. Repo
  is public and the GitHub account is on the free plan — Pages requires a
  public repo on free, so it can't be made private without a paid plan.
  No real secret lives in the repo (see "What's public" below), so this
  is an accepted tradeoff, not a gap to fix.

---

## Accounts & Data Isolation

Supabase Auth, soft-capped at `MAX_ACCOUNTS = 5` (`lib/auth.ts`'s
`accountCount()`, checked client-side pre-signup via an open-read
`profiles` table populated by an `auth.users` insert trigger).

- **Sign-up/sign-in:** `components/shell/LockScreen.tsx`. Display name
  passed via `signUp()`'s `options.data.display_name` (lands in
  `auth.users.raw_user_meta_data` immediately, before email confirmation,
  since there's no session yet for a follow-up `profiles` update).
- **Session state:** `components/shell/AuthContext.tsx` — `authenticated`
  is derived from `sb.auth.getSession()` + `onAuthStateChange()`, not a
  stored flag.
- **Every data table has `user_id` defaulting to `auth.uid()`, with
  owner-scoped RLS.** Existing call sites needed no code changes — see
  Gotchas. Three tables differ:
  - `app_settings` — unique on `(user_id, key)`, not `key` alone (used to
    be one global row per key for everyone). `cloudSaveSetting()`'s
    upsert `onConflict` must match this exactly.
  - `shared_programs` (Community) — open SELECT, owner-only write. Liking
    someone else's program goes through the `increment_program_likes
    (program_id)` RPC, not a direct UPDATE (RLS would block it).
  - `contact_leads` (public QR contact-share) — open INSERT (anonymous
    submitters), SELECT/DELETE scoped to `auth.uid()::text = code`.
    `code` is the owning account's own uid (`lib/qr.ts`'s `getQrCode()`).
    `screens/ContactShare.tsx` looks up and shows that account's real
    `display_name` — never hardcode a name there.
- **Demo Mode is fully local and orthogonal** — never calls `sb.auth.*` or
  Supabase at all (`lib/demo.ts`), checked before real-session state
  everywhere.
- **Sign-out wipes local data** (`AuthContext.tsx`'s `lock()`:
  `sb.auth.signOut()` then `wipeLocalData()`) — required, not cosmetic,
  since this app reads localStorage before any cloud pull; without the
  wipe a second person on the same browser would see the first account's
  cached data.
- **What's public, and why that's fine:** the Supabase URL + publishable
  key are hardcoded client-side by design (like a Stripe publishable
  key) — RLS enforces access, not secrecy of this key. Real secrets (API
  keys, passwords) never touch the repo; they live only in a signed-in
  user's own `localStorage`/`app_settings` row.

---

## Data & Sync Model

- **localStorage** is canonical and synchronous — `getLS(key, fallback)` /
  `setLS(key, val)` (`lib/storage.ts`), JSON handled automatically.
- **Supabase push:** every local write also fires a `cloudSave*()`
  (`lib/supabase-sync.ts`), non-blocking, isolated per table (`sbOnline()`
  gate, `markPending()` on failure — never throws).
- **Supabase pull:** `lib/cloud-pull.ts`'s `pullAndMergeAll()`, once per
  authenticated session (`App.tsx`'s `useCloudSynced()`). Additive-only,
  deduped by natural keys where no `cloudId` exists yet.

---

## Navigation & Sections

Data-driven — `lib/sections.ts`'s `SECTIONS` array is the single source;
`TopBar.tsx`/`BottomNav.tsx` build themselves from it.

```ts
SECTIONS = [
  { id: 'spiritual', tabs: [journal, miracles, objections, spanish, mastery, email] },
  { id: 'exercise',  tabs: [workout, routines, wlog] },
  { id: 'health',    tabs: [health, hfood, hbody, hstats] },
]
```

Routing (`App.tsx`): `/:sectionId/:tabId` under `<AppShell>`. `/home`,
`/contacts`, `/contact/:code` are top-level routes outside that chrome,
each self-contained with no BottomNav.

**Per-section color palettes:** each section has its own CSS-variable
palette in `index.css`, applied via a `.section-<id>` class on `<html>`
(`AppShell.tsx`'s effect). Home never gets one — always the base palette.
Home: blue, Spiritual: purple, Exercise: orange, Health: green.
`lib/sections.ts`'s `SECTION_ACCENT_COLORS` hand-mirrors each palette's
hex for `HomeScreen.tsx`'s tiles (Home can't read a `.section-*` CSS var
it's not wrapped in) — update both together if a palette changes.

---

## How to Make Changes

**Adding a screen:** component under `screens/`. If it's a section tab,
add to `lib/sections.ts`'s `SECTIONS` and `App.tsx`'s `TabRoute`. If
standalone (like `/home`), add a sibling `<Route>` outside `<AppShell>`.
Reuse `lib/health-data.ts` / `lib/exercise-data.ts` / `lib/mastery.ts`
before writing new data helpers.

**New Supabase table:** `apply_migration` with `user_id default
auth.uid()` + owner-scoped RLS from the start, a `cloudSave*()` in
`supabase-sync.ts`, and a pull function in `cloud-pull.ts` if it should
round-trip across a re-login.

**CSS:** `var(--foreground)` / `var(--card)` / `var(--background)` etc. —
never hardcoded colors. `--navy` / `--navy-soft` / `--gold` / `--gold-dark`
are this app's own tokens; every palette defines all four.

---

## Testing & Verification

1. Dev server: `mission-companion-react` launch config (real Vite
   server) — not `mission-companion` (stale prebuilt `dist/`, never
   reflects edits).
2. After any edit, restart the dev server (`preview_stop` +
   `preview_start`), not just a reload — Vite HMR can serve stale
   closures, especially on files exporting both a component and a hook.
3. `npx tsc -b` clean before calling anything done.
4. Verify data round-trips with a real write + read (`execute_sql`, or
   log out/in) when a fix touches the write/RLS path — a clean console
   isn't proof.
5. Check both light and dark mode for any palette touched.
6. After deploy, poll
   `curl -sL https://missionarycompanion.com/index.html | grep -o 'index-[A-Za-z0-9_-]*\.\(js\|css\)'`
   until the new hash appears (~30–60s).

---

## Gotchas

- A "starts clean" guarantee needs both entry and exit checked, not just
  one — e.g. a mode that's supposed to wipe data must wipe on the way in
  too, not only on the way out.
- Open-RLS tables need client-side shape validation on read, same as any
  untrusted input — anyone with the public key can `POST` arbitrary JSON
  to a table whose RLS allows it (e.g. `shared_programs`).
- **`sw.js` exists at repo root and at `react-components/public/sw.js`**
  and must be kept byte-identical by hand — always edit/copy both.
- **A migration adding `user_id` to an existing table runs with no
  session**, so `auth.uid()` is `null` and violates `not null`
  immediately. Default to the owner's literal uuid first (backfills in
  the same statement), verify, then a separate migration flips the
  default to `auth.uid()`.
- **RLS does the real access-control work — don't hand-write
  `.eq('user_id', ...)` filters.** The column default + policy already
  scope every insert/select/update/delete; manual filters are redundant
  at best.
- A `security definer` RPC is the right tool when RLS is legitimately too
  coarse (e.g. letting any signed-in user bump a shared counter without
  full row-owner rights) — keep it narrow, one column, one operation.
- Supabase's default email sending has a low rate limit — "email rate
  limit exceeded" during signup testing isn't a bug. Turning off "Confirm
  email" (Authentication → Providers → Email) sidesteps it for this small
  known-group app.

---

## Deployment Checklist

1. `cd react-components && npx tsc -b` clean.
2. Test against the real dev server, full restart after edits.
3. Console clean (watch for stale entries carried over from before a restart).
4. Dark mode checked for any palette touched.
5. No real secrets in code (the Supabase publishable key is fine — see "What's public").
6. `npm run build` (auto-syncs `dist/404.html`).
7. Copy `dist/*` to repo root, `git push`, poll for the new hash live.
8. Any schema/RLS change a live client already talks to — ship the matching client fix in the same deploy.
9. Any "starts clean" feature — verify both entry and exit.

---

## References

- Supabase: https://app.supabase.com/projects (ref `mxlfwmwjkanvsjimralh`)
- Live app: https://missionarycompanion.com
- GitHub: https://github.com/dombundy08-hue/Mission-Companion (public repo, free-tier — see Hosting)
- Deploy/audit skill: `.claude/skills/mission-companion-deploy/SKILL.md` — keep its benchmark log current
