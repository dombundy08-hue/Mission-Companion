---
name: mission-companion-deploy
description: Build, audit, and self-heal Mission Companion, then push once at the end. Manually invoked (not automatic on push — a PreToolUse hook now blocks git push unless this skill's own marker confirms it just ran clean against the current commit). Four subagents in order: Build → Code Audit → Auto-Fix → Learning, then one push.
---

# Mission Companion Deploy & Self-Healing Skill

## Overview

A `PreToolUse` hook on `git push` (`.claude/settings.local.json`) blocks
any push that didn't just come out of this pipeline — see "Push gate"
below.

**Runs straight through, no pauses.** Build, Code Audit, Auto-Fix, and
Learning always run back-to-back with no stop for confirmation —
including applying schema migrations and the final push. The *only*
thing that ever pauses this pipeline is a finding that needs action on a
system this skill has no access to (rotating a credential in a
third-party console, a dashboard toggle, etc.) — and even then, only that
one item pauses; everything else still gets fixed and pushed in the same
run, with the un-fixable item reported alongside.

## Four-Subagent Workflow (push now happens last, not first)

### 1. Build Agent
**Trigger**: Skill invocation
**Role**: Build React components locally — **does not push**

```
⚠️ react-components/ IS the site — no vanilla index.html, no iframe
sub-app (retired — see CLAUDE.md Architecture).

- cd react-components && npm run build
- Verify vite.config.ts `base` is '/' (root deployment)
- Copy dist/* to the REPO ROOT — dist/index.html becomes root index.html,
  dist/assets/* -> root assets/, etc.
- Copy the fresh root index.html to 404.html too (GitHub Pages SPA
  fallback — a stale 404.html referencing deleted hashed files is a real
  regression, check it matches on every run)
- ⚠️ NEVER delete old-hash files from assets/ before copying the new
  build in — enforced by a PreToolUse hook; see CLAUDE.md "Verify &
  Deploy" for why.
- Stage everything (git add -A) but do NOT commit or push yet — Code
  Audit and Auto-Fix still need to run against this build first.
Report: bundle sizes, any build errors.
```

### 2. Code Audit Agent
**Trigger**: After Build Agent finishes
**Role**: Scan the locally-built codebase AND the live Supabase backend for bugs

```
Frontend scan — react-components/src/ (this is the real source; the old
vanilla index.html at repo root no longer exists):
1. Missing error handling in critical paths
2. Console errors or TypeScript issues (`npm run build` inside react-components/ must pass clean)
3. Deprecated patterns or dead code
4. Duplicate code or redundant logic
5. Settings visibility/state inconsistencies
6. Hardcoded absolute paths assuming old `/react-build/` or `/Mission-Companion/` prefixes — everything is root-relative now
7. `useEffect` missing dependencies causing stale closures
8. **A dead flag whose writes and reads don't match up** — either a gate set but never unlocked (`let x = false`, set `true` nowhere), or the inverse: set in many places but never read anywhere (e.g. a `markPending()`-style flag meant to drive a retry that was never built — grep any module-level flag/counter for both directions).
9. **GitHub Pages has no server-side routing.** Check every deploy: does `404.html` exist at repo root and match `index.html`'s hashed asset filenames? Verify with a harness that actually reproduces GH Pages' 404-fallback behavior, not a plain local server (which hides the bug with its own generic 404).
10. Service worker (`sw.js`): cache key always the actual request/URL; install handler calls `self.skipWaiting()`.
11. New setting written via `cloudSaveSetting()` but never read back anywhere. Also check the reverse: a caller pre-serializing (`JSON.stringify(...)` or `String(...)`) a value before passing it to `cloudSaveSetting()`, which already serializes internally — double-stringifies, and cloud-pull writes back a string where the local reader expects an array/number.
12. Sentinel/tag string fields checked with exact equality instead of a prefix-safe test (e.g. `/^none\b/i.test(...)`, not `=== 'none'`).

Supabase backend scan — project `mxlfwmwjkanvsjimralh` (use the Supabase MCP tools):
13. Table/schema mismatch — every table referenced in `react-components/src/lib/*.ts`'s `cloudSave*`/`sb.from(...)` calls must actually exist (`list_tables`).
14. Recent API errors — `get_logs` (service: api and service: edge-function) for 4xx/5xx tied to app traffic.
15. Column mismatch — a save function referencing a nonexistent column.
16. RLS misconfiguration. **Baseline (see CLAUDE.md Accounts & Data)**: every owner-scoped table has `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`; `shared_programs` has open SELECT + owner-only write; `contact_leads` has open INSERT + owner-only SELECT/DELETE keyed on `code = auth.uid()::text`; `profiles` has open SELECT + self UPDATE. A bare `USING (true)` on any other table is a regression, not the baseline.
17. Orphaned/dead tables.
18. Natural-key dedup violations.
19. **Edge Function secrets** (`claude-proxy`, `usda-proxy`) — confirm both resolve via a live test call and no client code reads a key from `localStorage`/`import.meta.env` again (`apiKey`/`usdaApiKey`/`VITE_ANTHROPIC_KEY`/`VITE_USDA_KEY` outside the two edge functions = critical finding); see CLAUDE.md Accounts & Data for the prior incident. Also check `app_settings` itself (`execute_sql`) for leftover rows under those same keys from before the proxy migration — a stale row gets pulled straight into `localStorage` by `cloud-pull.ts` even with clean current client code.
20. **A "wipe on exit" without a matching "wipe on entry"** — see CLAUDE.md Gotchas.
21. **Open-RLS tables need client-side shape validation**, same as any untrusted input — anyone with the anon key can `POST` arbitrary JSON to a table whose RLS allows it (e.g. `shared_programs`).
22. **A unique constraint's column set must match the table's RLS ownership boundary.** An owner-scoped table (RLS keyed on `user_id`) with a unique constraint that *doesn't* include `user_id` lets the first account claim a value globally — every other account's insert on that same value fails, gets swallowed by a generic `catch`, and looks like nothing happened (`scripture_progress_scripture_id_key` was `UNIQUE(scripture_id)` instead of `UNIQUE(user_id, scripture_id)`, silently broke sync for every account but the first). Also check the matching client `onConflict` target whenever a constraint changes.
23. **When migrating a table to per-user RLS, `user_id` column defaults + RLS policies do essentially all the access-control work — don't hand-add `.eq('user_id', ...)` filters.**
24. **A table meant to be open-read-but-owner-write breaks any "let another user modify a shared counter" feature under plain owner-only RLS** — needs a narrow `security definer` RPC instead of a direct client UPDATE.
25. **A public/anonymous-submission table can still be per-account-scoped for reads**, by keying its RLS off a value the client already generates at write time (e.g. `contact_leads`' `code = auth.uid()`).
26. Deploy-adjacent infra settings the code can't see (e.g. HTTPS enforcement on the custom domain) — flag, don't attempt to auto-fix.

For each bug found (frontend or backend): exact file/line or exact table/column/project_id, description, impact, suggested fix. Report as one structured list — frontend and Supabase together.
```

### 3. Auto-Fix Loop Agent
**Trigger**: After Code Audit reports
**Role**: Fix everything found — frontend AND Supabase — still no push

```
For each frontend bug:
1. Read file, locate exact issue, apply fix, verify syntax.
2. Do NOT commit or push per-bug — this all happens locally, one commit
   at the very end of the whole pipeline.
3. Retry up to 3 times if a fix doesn't hold: attempt 1 as suggested,
   attempt 2 with more defensive null-checks, attempt 3 more
   conservative. After 3 failures: report to Learning Agent, skip.

For each Supabase bug (use Supabase MCP tools):
1. Missing table/column → `apply_migration`, or fix the code side if
   that's the smaller change.
2. RLS blocking access → `execute_sql` to check policies, `apply_migration`
   to add a genuinely missing one (never disable RLS to "fix" this).
3. After any schema change: re-verify with `execute_sql`/`get_logs` that
   the error is actually gone.
4. Retry up to 3 times, re-reading the real schema before each retry —
   never leave RLS disabled or a migration half-applied.

Report: which bugs fixed, which failed and why.
```

### 4. Learning Agent
**Trigger**: After Auto-Fix completes
**Role**: Update this skill's own knowledge — **`SKILL.md` only**

```
Based on this run, update SKILL.md (this file):
- New bug patterns discovered? Add to the Code Audit checklist.
- Fix strategies that worked better than others? Refine.
- Subagent coordination improvements? Update the workflow.
- New edge cases? Document them.

Do NOT touch CLAUDE.md — that file is kept lean and hand-curated by Dom
directly; this skill self-improves, it doesn't grow other docs anymore.

Make updates concise and actionable — this file competes with itself for
attention the same way CLAUDE.md does; don't let it bloat unboundedly.

End your final message with the exact line
`MISSION-COMPANION-DEPLOY-LEARNING-DONE` — a `SubagentStop` hook watches
for this to trigger the separate `mission-companion-optimize` skill
right after this one finishes.
```

### 5. Commit, mark, push — the only push in this whole flow

```
Only after all four stages above finish (whether or not every bug got
fixed — Auto-Fix failures are reported, not blocking):

1. git commit -m "..." for source changes (or skip if nothing to commit
   beyond the build output).
2. git add the build output (dist/* copied to repo root, sw.js if
   touched) and commit as "Deploy: ..." — the existing two-commit
   convention.
3. Capture the resulting commit hash: `git rev-parse HEAD`.
4. Write `.claude/.deploy-pipeline-ok` with that hash + current
   timestamp — this is what the push-gate hook checks for.
5. git push origin main.
6. Poll `curl -sL https://missionarycompanion.com/index.html | grep -o
   'index-[A-Za-z0-9_-]*\.\(js\|css\)'` until the new hash appears live.
```

## After this skill finishes: the optimizer

A `SubagentStop` hook fires when this skill's Learning Agent completes,
reminding Claude to run the separate `mission-companion-optimize` skill
next. That skill is **not** part of this pipeline and never blocks a
push — performance work is lower-stakes and more speculative than
correctness work, so it runs after, on its own.

## Push gate

`.claude/settings.local.json` has a `PreToolUse`/`Bash` hook blocking
any `git push` unless `.claude/.deploy-pipeline-ok` exists and its
recorded commit hash matches current `HEAD` — i.e., this skill's full
pipeline just ran clean against exactly what's about to be pushed. A
one-time `.claude/.deploy-override` file bypasses this once (deliberate
emergency use only, deletes itself after use) if the pipeline itself is
ever broken.

## Success Criteria
✅ Build: local build succeeds, no push yet
✅ Code audit: all bugs identified (frontend line numbers + Supabase table/column/project_id)
✅ Auto-fix: bugs fixed or marked failed after 3 retries — both code and schema
✅ Learning: SKILL.md updated (CLAUDE.md untouched)
✅ Marker written, single push succeeds, new hash confirmed live

## Benchmarks

- 2026-08-03 (commits 38884f7/497bdbf): base/SW bugs found only by testing the live URL, not static audit — folded into checklist items 9/10.
- 2026-08-04 (React cutover, commits 689d02b/86fba67/335570a): 404-fallback gap + dead safety-gate flag — folded into checklist items 8/9.
- 2026-08-04 (accounts + 21-feature batch, commits d85c613–4afc498): when many features land together, bugs hide in the *interactions* — audit the full session diff as one unit, not feature-by-feature.
- **2026-08-05 (real multi-user accounts, commits ca053ab→fbdc2e8):** zero bugs found in the migration itself — verified with a genuine outside-the-app check (raw `curl` against the REST API with only the public anon key, no session, confirmed `[]` for every owner-scoped table). Lesson: for an RLS migration, "works when I'm logged in as the owner" proves almost nothing — the property that matters (does everyone else see nothing) needs its own adversarial check from outside the app's own client code.
- **2026-08-08 run (no source changes since last deploy, audit-only trigger):** 2 critical findings — a global unique constraint silently breaking multi-user scripture sync (fixed via migration, folded into checklist item 22), and live Anthropic/USDA keys left over in `app_settings` from before the Edge Function proxy migration, still being pulled into `localStorage` (rows deleted, `RAW_KEYS` dead-code removed, folded into item 19 — keys themselves still needed manual rotation outside this pipeline). Also fixed: 2 double-stringified settings (item 11), a dead write-only retry flag (item 8), and an unguarded `SECURITY DEFINER` function's public `EXECUTE` grant. Both schema fixes verified with a real write+read round-trip (two real accounts inserting the same `scripture_id`), not just "the migration applied."
- **2026-08-11 run (first deploy after project folder moved `C:\Users\shan_\mission-companion` → `C:\Users\shan_\Jeneesa Site`, same repo/git history/`.claude/` tooling carried over):** zero bugs found in the diff — the move itself plus a new `react-components/src/lib/demo-seed.ts` (deterministic fake data pre-filling local-only Demo Mode for sales demos, never touches Supabase) wired into `unlockDemo()`. Confirmed this file has no hardcoded absolute local paths needing updates after a folder move — it's all repo-relative already; only the two global redirect stubs under `~/.claude/skills/` needed re-pointing, done outside this pipeline.

## Skill Changelog

- 2026-08-07: pipeline restructured — push moved from first step to last (was: push → audit → fix → learn → push again; now: build → audit → fix → learn → one push), gated by a `PreToolUse` hook requiring this skill's own marker file to match current HEAD. Learning Agent scope narrowed to `SKILL.md` only (previously also rewrote `CLAUDE.md`). A separate `mission-companion-optimize` skill added, triggered by a `SubagentStop` hook after this skill's Learning Agent finishes, kept intentionally outside the push-gated chain.

## Error Handling
- Build fails: Code Audit still runs to find root cause.
- Audit finds no bugs: skip Auto-Fix, Learning still runs.
- Auto-Fix fails 3x on a bug: report it, continue to next bug — does not block reaching the commit/push step.
- Learning fails: log error; the marker file only gets written if Learning actually completes, so a failed Learning run correctly blocks the push gate until re-run.

## Files Modified
- `react-components/src/` (Auto-Fix Agent)
- Repo root `index.html`, `404.html`, `assets/`, `icons/`, `fonts/`, `sw.js`, `manifest.json` (Build Agent — copied from `react-components/dist/*`)
- `.claude/skills/mission-companion-deploy/SKILL.md` (Learning Agent — itself only)
- `.claude/.deploy-pipeline-ok` (step 5 — the push-gate marker)
