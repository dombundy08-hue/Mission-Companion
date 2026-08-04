---
name: mission-companion-deploy
description: Auto-deploy Mission Companion on every git push with bug scanning and self-healing across both the frontend code and the Supabase backend. Four coordinated subagents: Deploy (build→push), Code Audit (find bugs in code AND Supabase schema/sync), Auto-Fix (loop repair on both ends), Learning (self-improve).
---

# Mission Companion Auto-Deploy & Self-Healing Skill

## Overview
Runs automatically on every `git push origin main`. Deploys code, audits for bugs, auto-fixes issues (max 3 attempts per issue), and self-improves the skill based on learnings.

## Four-Subagent Workflow

### 1. Deploy Agent
**Trigger**: Immediately on git push  
**Role**: Build React components and push to production

```
⚠️ 2026-08-04 cutover: react-components/ IS the site now, not an embedded
iframe sub-app. The old vanilla index.html + react-build/ iframe
architecture is retired (preserved at git tag pre-build-website if ever
needed). Deploy accordingly:

Build React project:
- cd react-components && npm run build
- Verify vite.config.ts `base` is '/' (root deployment, NOT '/react-build/')
- Copy dist/* to the REPO ROOT (not react-build/) - dist/index.html becomes
  the real root index.html, dist/assets/* -> root assets/, etc.
- Copy the fresh root index.html to 404.html too (GitHub Pages SPA fallback
  - see Code Audit item #8b; this must stay in sync on every deploy or a
  build with new hashed asset filenames will make 404.html reference
  stale/missing files)
- git add -A
- git commit -m "Deploy: [auto-deployed changes]"
- git push origin main
Report: Commit hash, bundle sizes, any errors
```

### 2. Code Audit Agent
**Trigger**: After Deploy completes (while production deploys ~60s)  
**Role**: Scan entire codebase AND the Supabase backend for bugs, errors, and issues

```
Frontend scan — C:\Users\shan_\mission-companion\react-components\src\ (⚠️ 2026-08-04: this
is the real source now — the old vanilla index.html at repo root no longer exists, don't scan
for it):
1. Missing error handling in critical paths
2. Console errors or TypeScript issues (`npm run build` inside react-components/ must pass clean)
3. Deprecated patterns or dead code
4. Duplicate code or redundant logic
5. Settings visibility/state inconsistencies
6. Hardcoded absolute paths that assume the old `/react-build/` or `/Mission-Companion/`
   prefixes — both are gone now, everything is root-relative (`/assets/...`, `/icons/...`)
7. `useEffect` missing dependencies causing stale closures (React equivalent of the old
   vanilla "stale window.location read" pattern)
8. **A dead safety-gate flag that's set but never unlocked.** Found 2026-08-04:
   `supabase-sync.ts` had a `cloudReady` flag defaulting `false` with no code path anywhere
   that ever called the setter — every single `cloudSave*`/`cloudDeleteRow` function opened
   with `if (!cloudReady) return`, so ALL cloud writes silently no-op'd for the entire session
   they were built in. Nothing crashed, nothing errored — it just quietly never wrote
   anything. **General pattern to grep for**: any module-level `let x = false` (or similar)
   gating a side effect, where `x` is set to `true` in exactly zero places in the codebase.
   Fix: either wire the real trigger that should unlock it, or remove the gate if — like here
   — it was a half-built safety mechanism with no corresponding "other half."
8b. **GitHub Pages has no server-side routing.** Since the site is now a client-side-routed
    React Router SPA served from a static host, a direct request (fresh load, bookmark,
    reload) to any non-root path (e.g. `/spiritual/journal`) has no matching file and 404s —
    GH Pages serves whatever `404.html` exists at the root for any unmatched path, but the
    browser keeps the originally-requested URL, so React Router picks it up correctly once
    the JS loads. **Check on every deploy: does `404.html` exist at repo root, and is it an
    up-to-date copy of `index.html` (same hashed asset filenames)?** A stale 404.html
    referencing a deleted/renamed hashed bundle is a real, easy-to-miss regression — verify
    with a test harness that actually reproduces GH Pages' 404-fallback behavior (a plain
    `python -m http.server` does NOT replicate this — its own generic 404 page hides the bug
    completely; write/reuse a small custom handler that serves 404.html's body with a 404
    status for any unmatched path before trusting a "it loaded" local check).
9. Service worker (`sw.js`): cache key must always be the actual request/URL (never a
   hardcoded string); `isAppShell` in the fetch handler's navigate-mode branch should match
   any same-origin navigation now (the whole site is client-side-routed, there's no more
   iframe-vs-outer-shell distinction to worry about); install handler should call
   `self.skipWaiting()` so a new SW version activates immediately rather than leaving a stale
   one serving old content until every tab closes (this exact gap caused a real "briefly
   showed old content" symptom on 2026-08-04's cutover).
10. New setting written via `cloudSaveSetting()` but never read back anywhere — this app
    doesn't have a boot-time pull/merge sync yet at all (tracked in
    `react-components/docs/build-plan.md`, "Supabase sync module 🟡 Partial"), so *no*
    setting round-trips across devices right now. Don't flag every individual missing
    pull-down as a new bug until the boot sync itself is built — flag the boot sync's absence
    once, not per-setting.
11. Sentinel/tag string fields checked with exact equality instead of a prefix-safe test —
    still applies, same reasoning as before (breaks the moment authored text isn't the bare
    sentinel word). Already fixed correctly in `Objections.tsx`'s fallacy check as a reference
    example (`/^none\b/i.test(...)`).

Supabase backend scan — project `mxlfwmwjkanvsjimralh` (use the Supabase MCP tools):
12. Table/schema mismatch — every table referenced in `react-components/src/lib/*.ts`'s
    `cloudSave*`/`sb.from(...)` calls must actually exist; use `list_tables` to compare
13. Recent API errors — check `get_logs` (service: api) for 4xx/5xx responses tied to app traffic, not infra health checks
14. Column mismatch — a save function referencing a column that doesn't exist in the table
15. RLS (row-level security) misconfiguration — a table with `rls_enabled: true` but no policy, silently blocking all reads/writes. Note: as of 2026-08-04 every table's RLS policy is `USING (true)`/`WITH CHECK (true)` (fully open to anyone with the anon key) — this is the app's known, accepted security posture for a single-user personal tool (confirmed with the user), not a bug to silently "fix" by tightening policies without asking first.
16. Orphaned/dead tables — tables that exist in Supabase but nothing in the code writes to or reads from them (candidates for cleanup, not auto-fix)
17. Natural-key dedup violations — duplicate rows for what should be a unique natural key (date+name, etc.), meaning the dedup logic isn't working
18. Known pre-existing gap: `saved_foods` table is referenced by code but returns 404 — doesn't exist in `list_tables`. Flag but don't auto-fix without confirming with the user first, since creating the table is a schema decision, not a pure bug fix.
19. Known gap found 2026-08-04: `glossary_terms` table also doesn't exist, so the React port's Glossary screen has been failing to sync to the backend since it was built (caught by its own try/catch, so no crash — just silent). Combined with Glossary never having been part of the vanilla app's live nav (`SECTIONS` object never included it), this confirms Glossary was genuinely abandoned/incomplete functionality upstream, not something this migration broke. Currently kept in the React nav (flagged to the user, not yet resolved either way) — don't auto-create the table without asking, same reasoning as `saved_foods`.
20. **A "wipe on exit" without a matching "wipe on entry."** Found 2026-08-04: Demo Mode's
    `unlockDemo()` set `demoMode=true` but never cleared `localStorage` first — only `lock()`
    (exit) wiped it. Any device that already held real user data would show all of it to
    whoever Demo Mode was being demonstrated to, the first time, before the first lock. **General
    pattern to grep for**: any feature whose whole safety premise is "starts from a clean
    slate" — check BOTH the entry point and the exit point wipe/reset state, not just one.
    A privacy/safety guarantee that only holds after the first use of the feature is not a
    guarantee.
21. **Open-RLS tables need client-side shape validation, not just server-side trust.** Found
    2026-08-04: a `shared_programs` (Community) table with `USING (true)` RLS means literally
    anyone with the anon key (which ships in the client bundle) can `POST` arbitrary JSON
    directly to the REST API, not just through this app's own UI. Code that reads such a
    table (`sp.workouts.length`, `.map()` over a nested field, etc.) crashed on `undefined`/
    wrong-shape data with zero validation. **General pattern**: for any table with open RLS
    that the client reads back and renders/iterates, validate the shape (`Array.isArray`,
    `typeof` checks) before using it — treat it the same as any other untrusted external input,
    because that's what it structurally is.
22. **Deploy-adjacent infra settings the code can't see.** Found 2026-08-04: the custom domain
    (`missionarycompanion.com`) serves plain `http://` with no redirect to `https://` — GitHub
    repo Settings → Pages → "Enforce HTTPS" is off. This breaks service-worker registration
    (requires a secure context) and sends the app password / API keys in cleartext for anyone
    who reaches the bare domain or the `.github.io` URL without an explicit `https://`. Not
    fixable via a commit — it's a one-click GitHub setting. **Check on every deploy**: does
    `curl -sI http://<custom-domain>/` redirect to `https://`? If not, flag it — don't assume
    it's "probably already on" just because DNS/TLS otherwise works.

For each bug found (frontend or backend):
- Exact file/line number, OR exact table/column/project_id for Supabase issues
- Description of the problem
- How it affects functionality
- Suggested fix (specific code, or specific SQL/migration)

Report as one structured list — frontend and Supabase bugs together — so Auto-Fix agent can process each item regardless of which side it's on.
```

### 3. Auto-Fix Loop Agent
**Trigger**: After Code Audit reports (receives detailed bug list)  
**Role**: Fix all reported issues — frontend code AND Supabase backend — rebuild, verify (max 3 retries)

```
Input: Structured bug list from Code Audit agent (frontend + Supabase issues combined)

For each frontend bug:
1. Read file and locate exact issue
2. Apply suggested fix
3. Verify syntax is correct
4. Commit: git commit -m "Fix: [specific bug description]"
5. Push: git push origin main
6. Wait 60s for production update
7. Verify on live site (console, network, DOM)
8. If still broken: retry fix (up to 3 times)
9. If fixed: move to next bug

For each Supabase bug (use Supabase MCP tools):
1. Missing table → use `apply_migration` to create it matching what the code expects (or fix the code's table name if it was just a typo — prefer the smaller change)
2. Missing/mismatched column → `apply_migration` to add the column, or update the code's `toCloud`/`fromCloud` mapping if the column was never meant to exist
3. RLS blocking access → check policies with `execute_sql`, add a policy via `apply_migration` if genuinely missing (never disable RLS to "fix" this)
4. After any schema change: re-run the specific failing operation (via `execute_sql` or by re-checking `get_logs`) to confirm the error is gone
5. If still broken: retry (up to 3 times) — never guess blindly on schema changes; re-read the actual table structure with `list_tables(verbose: true)` before each retry

Retry strategy (frontend):
- Attempt 1: Apply suggested fix as-is
- Attempt 2: Apply fix with additional null checks
- Attempt 3: Apply fix with more conservative approach
- After 3 failures: Report to Learning Agent, skip this bug

Retry strategy (Supabase):
- Attempt 1: Apply suggested migration/fix as-is
- Attempt 2: Re-verify actual schema first (don't assume prior fix applied cleanly), adjust
- Attempt 3: Fix the code side instead of the schema side (or vice versa) if the first approach was wrong
- After 3 failures: Report to Learning Agent, skip this bug — never leave RLS disabled or a migration half-applied

Report: Which bugs were fixed (frontend/Supabase), which failed (and why)
```

### 4. Learning Agent
**Trigger**: After Auto-Fix completes (all bugs attempted)  
**Role**: Update SKILL.md and CLAUDE.md based on learnings

```
Based on the deployment run, update:

SKILL.md improvements:
- Were any new bug patterns discovered? Add them to Code Audit scope.
- Did certain fixes work better than others? Refine fix strategies.
- Any subagent coordination improvements? Update workflow order.
- New edge cases found? Document them.

CLAUDE.md improvements:
- Add lessons learned this deployment
- Update architecture sections if code structure changed
- Document any new patterns or anti-patterns
- Update deployment checklist if new validation needed

Make updates concise and actionable.
Commit: git commit -m "Learn: Self-improve skill & docs from this deployment"
Push: git push origin main
```

## Execution Flow

```
User: git push origin main
  ↓
Deploy Agent runs (Build React → Commit → Push)
  ↓ (after ~60s for production update)
Code Audit Agent runs (Scan for bugs)
  ↓
Auto-Fix Loop Agent runs (Fix each bug, max 3 retries per)
  ↓
Learning Agent runs (Update SKILL.md and CLAUDE.md)
  ↓
Complete: Skill self-improved, code fixed, docs updated
```

## Success Criteria
✅ Deploy agent: Commit pushed to main  
✅ Code audit: All bugs identified (frontend line numbers + Supabase table/column/project_id)  
✅ Auto-fix: Bugs fixed or marked as failed after 3 retries — both code and schema  
✅ Learning: SKILL.md and CLAUDE.md updated  
✅ Supabase: no orphaned 404s from missing tables, no silent RLS blocks, no schema/code drift

## Benchmarks
- **2026-08-03 run (commit ee6edbd):** 10 bugs found (1 critical, 3 high, 4 medium, 1 low), all 10 fixed in one pass — **100% first-pass fix success, zero retries needed.** Use this as the target: retries should be the exception, not the norm.
- **2026-08-03 run (commit d6d9d99, Phase 2 Scripture/Objections):** 2 must-fix bugs found (both new-code regressions: a setting missing from the cloud pull-down sync, and a sentinel-string exact-match bug), both fixed in one pass, zero retries.
- **2026-08-03 run (commits 38884f7, 497bdbf, Health ActivityCard integration):** found live in production, not by static audit — ground-truthed by directly navigating the deployed site. A never-configured Vite `base`, and a service worker caching every navigation under one hardcoded key. Lesson: when a fix touches deploy-path or service-worker code, ground-truth against the actual live URL before trusting docs/checklist.
- **2026-08-04 run (commits 689d02b, 86fba67, 335570a — React-app cutover):** the whole site architecture changed (vanilla index.html retired, react-components/ promoted to site root) in the same session as the audit, so most of the old checklist (iframe/postMessage items) went obsolete in one shot — rewritten above rather than incrementally patched. Two critical bugs found and fixed same-session: (1) GH Pages 404 on any direct-navigated client-side route (no 404.html fallback existed yet — this is a **structural gap for any React-Router-on-GH-Pages deploy**, not a regression, so it should be checked on the *first* deploy of any new SPA-on-static-host setup, not just as a regression check); (2) the dead `cloudReady` gate (checklist item #8) — **found only by actually tracing the write path with fresh eyes, not by pattern-matching against a known bug list**, since this bug class (a half-built safety mechanism, not a "regression") wasn't on the checklist at all before this run. Verified fixed by a real live round-trip: wrote a labeled test row via the actual production UI, confirmed it in `journal_entries` via `execute_sql`, deleted it via the UI's own delete flow. Lesson: **"no errors in the console" and "the UI looks right" are not proof data is actually persisting anywhere** — when a fix specifically touches the write path, verify with a real write+read, not just a UI smoke test.
- **2026-08-04 run (commits d85c613/105b78e then a580454/4afc498 — Accounts & Security + a huge feature batch: Fast Sunday, averages rewrite, built-in workout templates, multi-week Programs, Community, QR contact exchange, per-section color schemes, and more):** the largest single-session diff yet (21 features, 2 new Supabase tables). Audit found 1 critical (checklist item #20, demo mode not wiping on entry — a real, currently-live privacy hole on the developer's own device), 1 high (#22, HTTPS not enforced — infra setting, not a code fix, correctly identified as un-auto-fixable and flagged to the user instead of attempted), 1 medium (#21, Community import trusting unvalidated open-RLS data). Both code-fixable bugs fixed in one pass, zero retries, verified live (localStorage before/after check for the demo-mode fix, reproduced via the actual "Try Demo Mode" button — not just read the code and assumed it worked). Lesson: **when a session builds many independent features back-to-back, the interactions between them are where bugs actually hide** — demo mode and the lock screen were each individually correct in isolation; the bug was specifically in how demo-mode *entry* interacted with pre-existing localStorage state that the lock-screen work didn't create but also didn't need to worry about. A feature-by-feature audit would likely have missed this; auditing the full session's diff as one unit caught it.

## Error Handling
- Build fails: Code Audit still runs to find root cause
- Audit finds no bugs: Skip Auto-Fix, Learning still runs
- Auto-Fix fails 3x on a bug: Report it, continue to next bug
- Learning fails: Log error, next deployment will retry

## Files Modified
- `react-components/src/` (Auto-Fix Agent — this is the real source now)
- Repo root `index.html`, `404.html`, `assets/`, `icons/`, `fonts/`, `sw.js`, `manifest.json` (Deploy Agent — these are `react-components/dist/*` copied to root, keep `index.html`/`404.html` in sync)
- `.claude/skills/mission-companion-deploy/SKILL.md` (Learning Agent)
- `CLAUDE.md` (Learning Agent)
