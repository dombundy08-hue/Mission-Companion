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
Build React project:
- cd react-components && npm run build
- Verify dist/ contains assets with correct names
- Copy dist/* to ../react-build/
- Verify /Mission-Companion/ prefix is on all asset paths
- git add -A
- git commit -m "Deploy: [auto-deployed changes]"
- git push origin main
Report: Commit hash, bundle sizes, any errors
```

### 2. Code Audit Agent
**Trigger**: After Deploy completes (while production deploys ~60s)  
**Role**: Scan entire codebase AND the Supabase backend for bugs, errors, and issues

```
Frontend scan — C:\Users\shan_\mission-companion\:
1. Module-level DOM access (document.getElementById outside functions)
2. Event listeners on non-existent elements
3. Missing null checks on DOM operations
4. Console errors or TypeScript issues
5. Deprecated patterns or old code
6. Duplicate code or redundant logic
7. Missing error handling in critical paths
8. Path issues — **the site is served at its custom domain root (missionarycompanion.com), with NO `/Mission-Companion/` prefix** (the github.io project-page URL redirects to the custom domain root too, confirmed live 2026-08-03). Any code or config that hardcodes a `/Mission-Companion/` prefix is the bug, not the fix — react-build asset/base paths must be root-relative (`/react-build/...`).
9. iframe recursion or nesting issues
10. Settings visibility/state inconsistencies
11. postMessage origin security — using `'*'` instead of `window.location.origin` as the target origin
12. Message listener missing `event.origin` check (accepts messages from any source)
13. `useMemo`/`useEffect` missing dependencies for `window.location` reads (stale closures on navigation)
14. setTimeout-based iframe readiness checks — should use the iframe's `onload` event instead of a fixed delay
15. Hardcoded absolute paths (e.g. `/Mission-Companion/...`) vs dynamic URL construction (e.g. relative to `import.meta.env.BASE_URL` or current origin)
16. New setting written via `cloudSaveSetting()`/`putSetting()` but never added to the corresponding `map.has('<key>')` pull-down branch in `syncSettings()` — writes but never reads back on a second device. Grep every `cloudSaveSetting('X', ...)` call site and confirm a matching `map.has('X')` branch exists.
17. Sentinel/tag string fields (e.g. a `fallacy`/`category` value meaning "not applicable") checked with exact equality (`x==='none'`) instead of a prefix-safe test — breaks the moment the authored value is `"none — because ..."` rather than the bare word. Prefer `/^none\b/i.test(x)` (or a real `null`/absent field) over string-literal equality on human-authored content.
18. `react-components/vite.config.ts` missing a `base` setting — without it, `vite build` emits root-relative-to-nothing asset paths that only happen to be right by accident of whatever they were last hand-patched to. Always check `base` is explicitly `'/react-build/'` (per #8 above) rather than trusting a prior manual patch of `react-build/index.html`'s committed asset paths — the patch and the actual build will drift the next time anyone runs `npm run build` without re-patching.
19. Service worker (`sw.js`) fetch handler bugs specific to this app's iframe architecture: any `navigate`-mode request handling that keys its cache by a **hardcoded** string (e.g. `'./index.html'`) instead of the actual request/URL will silently serve the wrong page for every other navigation — including the Health/Exercise `react-build/index.html?app=...` iframes, which are `navigate`-mode requests from the browser's perspective. Symptom: an iframe's `contentDocument` turns out to be the outer app shell instead of its own content. Check `sw.js`'s cache key is always the actual `request`/URL, and that any app-shell fallback is scoped to real top-level app navigations only (not `react-build` paths).

Supabase backend scan — project `mxlfwmwjkanvsjimralh` (use the Supabase MCP tools):
20. Table/schema mismatch — every table referenced in index.html's `cloudSave*`/`sync*` functions (grep for `sb.from(...)`) must actually exist; use `list_tables` to compare against the code
21. Recent API errors — check `get_logs` (service: api) for 4xx/5xx responses tied to app traffic, not infra health checks
22. Column mismatch — a save function referencing a column that doesn't exist in the table (surfaces as repeated silent failures via the `foodProteinOk`-style feature-flag pattern in cloudSaveHealth)
23. RLS (row-level security) misconfiguration — a table with `rls_enabled: true` but no policy, silently blocking all reads/writes
24. Orphaned/dead tables — tables that exist in Supabase but nothing in the code writes to or reads from them (candidates for cleanup, not auto-fix)
25. Natural-key dedup violations — duplicate rows for what should be a unique natural key (date+name, etc.), meaning the dedup logic isn't working
26. Known pre-existing gap (2026-08-03): `saved_foods` table is referenced by code (`index.html:3752,5287,5289,5557`) but returns 404 — doesn't exist in `list_tables`. Not caused by any single commit; flag but don't auto-fix without confirming with the user first, since creating the table is a schema decision, not a pure bug fix.
27. Known pre-existing bug (2026-08-03, not yet fixed): `renderHealthFood()` in index.html (~lines 3882-3903) uses curly/typographic quotes (` ” `) instead of straight `"` as HTML attribute delimiters (e.g. `class=”tabtitle”`, `data-fmode=”search”`). This breaks the Food-mode toggle buttons (`data-fmode` reads back with the curly quotes embedded, so `st.foodMode==='search'` never matches after the first click) and leaves those elements unstyled. Frontend issue, not Supabase, but logged here alongside the other known gap since it was found the same day and not yet fixed — flag for the next audit pass to actually fix.

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
- **2026-08-03 run (commit d6d9d99, Phase 2 Scripture/Objections):** 2 must-fix bugs found (both new-code regressions: a setting missing from the cloud pull-down sync, and a sentinel-string exact-match bug), both fixed in one pass, zero retries. Both bug classes are now checklist items #16-17 above so future audits catch them without a live incident first.
- **2026-08-03 run (commits 38884f7, 497bdbf, Health ActivityCard integration):** found live in production, not by static audit — ground-truthed by directly navigating the deployed site. Two foundational bugs, both now fixed and checklisted (#8/#18/#19): a never-configured Vite `base` (checklist item #8 previously *encoded the wrong fix direction* — corrected), and a service worker caching every navigation under one hardcoded key, silently serving the outer app shell in place of the Health/Exercise react-build iframes. Lesson: when a fix touches deploy-path or service-worker code, ground-truth against the actual live URL before trusting docs/checklist — CLAUDE.md/SKILL.md had both been wrong about the correct base path.

## Error Handling
- Build fails: Code Audit still runs to find root cause
- Audit finds no bugs: Skip Auto-Fix, Learning still runs
- Auto-Fix fails 3x on a bug: Report it, continue to next bug
- Learning fails: Log error, next deployment will retry

## Files Modified
- `react-build/` (Deploy Agent)
- `index.html` (Auto-Fix Agent)
- `.claude/skills/mission-companion-deploy/SKILL.md` (Learning Agent)
- `CLAUDE.md` (Learning Agent)
