---
name: mission-companion-optimize
description: Reports performance/efficiency opportunities in Mission Companion (bundle size, re-renders, Supabase write batching, dead code). Read-only — proposes, never auto-applies. Triggered by a SubagentStop hook right after mission-companion-deploy's Learning Agent finishes, but is a fully separate skill that never blocks a push.
---

# Mission Companion Performance Optimizer

## Why this is separate from `mission-companion-deploy`

Correctness is binary, performance is judgment-call — see that skill's
own "After this skill finishes" section for the full rationale (kept
there as the canonical copy). Recurring findings here should get folded
back into its Build Agent instructions over time via its Learning Agent.

## Scope — react-components/src/, real current architecture

This audits the actual React 19 + Vite + TS + Tailwind v4 stack. Ignore
anything about `render<Tab>()`, `state.<section>`, or a single-file
architecture — that's the retired vanilla app, not this one.

### 1. Bundle size

**Known, measured, current problem**: the production build already warns
`Some chunks are larger than 500 kB after minification` for a single
~868 KB main JS chunk (measured 2026-08-08 `npm run build`; reverify
before treating as current — bundle size drifts every build). This is
the single most concrete, already-quantified finding — start here.

- Which screens/libraries are pulling weight into the main chunk that
  don't need to be there on first load? Good candidates: AI-chat-heavy
  screens (`Objections.tsx`, `Spanish.tsx`, `Email.tsx`) and food-search
  (`HealthFood.tsx`) — none are needed until the user navigates to them.
- Propose `React.lazy()` + `Suspense` boundaries for route-level
  code-splitting via `App.tsx`'s `TabRoute` switch, or
  `build.rolldownOptions.output.codeSplitting` / a raised
  `chunkSizeWarningLimit` if splitting isn't worth the complexity for a
  given chunk.
- Check for accidental whole-library imports (e.g. `lucide-react` icons
  — confirm named/specific imports, not a barrel import pulling in
  everything).

### 2. React render cost

- Look for props/state causing broad re-renders where a narrower
  `useMemo`/`useCallback` would help — but only where there's a real,
  identifiable hot path (a list re-rendering on every keystroke
  elsewhere, a timer-driven component re-rendering siblings that don't
  depend on the timer). Don't propose memoization as a reflexive
  default; unnecessary memoization adds complexity without payoff.
- `Workout.tsx`'s tick-driven state updates (`tickStart()`,
  `startRepRest()`) are the most timer-heavy code in the app — confirm
  they don't cause the countdown UI to re-render more than the number
  actually changing requires.

### 3. Supabase read/write efficiency

- Any screen firing multiple separate `cloudSave*()` calls for what's
  conceptually one user action, that could be one write instead.
- Any place reading the same table/row repeatedly within a single render
  or short window instead of caching the result.
- `lib/cloud-pull.ts`'s `pullAndMergeAll()` — confirm it isn't
  re-fetching tables the current session doesn't need yet.

### 4. Dead code / duplication

- Repeated inline style patterns across screens (e.g. the
  `rounded-[14px] border p-4` card wrapper appears near-identically in
  many screens) — candidate for a shared component, but only if repeated
  many times with no variation (this project prefers explicit JSX over
  premature abstraction).
- Any component, helper, or export with zero remaining call sites
  (`grep` before flagging — this project has been burned before by
  leftover dead files from the pre-React architecture).

## Output Format

Report-only, structured for Dom to prioritize and approve:

1. **Bundle/size wins** — what, current measured size if known, expected
   impact, effort (small/medium/large).
2. **Render/runtime wins** — current pattern, proposed pattern, why it's
   actually hot (not speculative).
3. **Data efficiency wins** — current flow, proposed flow, fewer
   round-trips.
4. **Dead code / duplication** — exact files, confirmed zero call sites
   or genuine repetition count.
5. **Risk per item** — what could break, what to verify if applied.

Do not edit any code as part of this skill. Findings feed back to Dom
for approval, same as every other change in this project.
