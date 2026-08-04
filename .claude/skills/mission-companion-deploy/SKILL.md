---
name: mission-companion-deploy
description: Auto-deploy Mission Companion on every git push with bug scanning and self-healing. Four coordinated subagents: Deploy (build→push), Code Audit (find bugs), Auto-Fix (loop repair), Learning (self-improve).
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
**Role**: Scan entire codebase for bugs, errors, and issues

```
Scan C:\Users\shan_\mission-companion\ for:
1. Module-level DOM access (document.getElementById outside functions)
2. Event listeners on non-existent elements
3. Missing null checks on DOM operations
4. Console errors or TypeScript issues
5. Deprecated patterns or old code
6. Duplicate code or redundant logic
7. Missing error handling in critical paths
8. Path issues (/Mission-Companion/ prefix missing)
9. iframe recursion or nesting issues
10. Settings visibility/state inconsistencies
11. postMessage origin security — using `'*'` instead of `window.location.origin` as the target origin
12. Message listener missing `event.origin` check (accepts messages from any source)
13. `useMemo`/`useEffect` missing dependencies for `window.location` reads (stale closures on navigation)
14. setTimeout-based iframe readiness checks — should use the iframe's `onload` event instead of a fixed delay
15. Hardcoded absolute paths (e.g. `/Mission-Companion/...`) vs dynamic URL construction (e.g. relative to `import.meta.env.BASE_URL` or current origin)

For each bug found:
- Exact file and line number
- Description of the problem
- How it affects functionality
- Suggested fix (specific code)

Report as structured list so Auto-Fix agent can process each item.
```

### 3. Auto-Fix Loop Agent
**Trigger**: After Code Audit reports (receives detailed bug list)  
**Role**: Fix all reported issues, rebuild, verify (max 3 retries)

```
Input: Structured bug list from Code Audit agent

For each bug:
1. Read file and locate exact issue
2. Apply suggested fix
3. Verify syntax is correct
4. Commit: git commit -m "Fix: [specific bug description]"
5. Push: git push origin main
6. Wait 60s for production update
7. Verify on live site (console, network, DOM)
8. If still broken: retry fix (up to 3 times)
9. If fixed: move to next bug

Retry strategy:
- Attempt 1: Apply suggested fix as-is
- Attempt 2: Apply fix with additional null checks
- Attempt 3: Apply fix with more conservative approach
- After 3 failures: Report to Learning Agent, skip this bug

Report: Which bugs were fixed, which failed (and why)
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
✅ Code audit: All bugs identified with line numbers  
✅ Auto-fix: Bugs fixed or marked as failed after 3 retries  
✅ Learning: SKILL.md and CLAUDE.md updated  

## Benchmarks
- **2026-08-03 run (commit ee6edbd):** 10 bugs found (1 critical, 3 high, 4 medium, 1 low), all 10 fixed in one pass — **100% first-pass fix success, zero retries needed.** Use this as the target: retries should be the exception, not the norm.

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
