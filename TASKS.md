# Mission Companion — Task Order

**Execution status:** Ready to build (PRD reviewed). BLOCKED items excluded.

---

## BLOCKED (pending conversations, NOT in executable order)
- **Multi-account rollout** — Waiting for mission-president conversation on rollout strategy.
- **GHL automations** — Waiting for legal/accountability discussion on TCPA consent and liability.

---

## Executable Order (dependencies respected, small-to-medium tasks first)

### Phase 0: Foundation (High-Value, Unblocks Later Work)

1. **Dark mode** (Visual)  
   Add system-preference dark theme toggle + CSS variables for theme colors. Prerequisite for visual refresh tasks.

2. **Church website links** (Content)  
   Add contextual links to official Church resources (member.churchofjesuschrist.org, etc.). Requires specifics from Dom on placement.

3. **Settings expansion** (Infrastructure)  
   Add placeholder structure for additional settings sections (language, notifications, etc.). Low friction; unblocks future settings work.

---

### Phase 1: Health Tracking (Small, Independent Refinements)

4. **Review averages math & decide strategy** (Health)  
   Document and finalize: per-week vs. rolling average, median vs. mean, time window. Add simple help tooltip explaining choice. Prerequisite for all health-avg features.

5. **Fast Sunday handling** (Health)  
   Add toggle to mark days as Fast Sunday; exclude or annotate in calorie/protein averages. Depends on #4 (averages math finalized).

6. **Saved Foods: frequency-gated save** (Health)  
   Only prompt to save a food after the exact same entry has been logged 10 times (within 90 days or similar window). Reduces clutter.

7. **Weekly reflection pop-up** (Health)  
   Surface lowest-tracked area (calories/protein/journaling/miracles) with encouraging nudge. Include "excuse this" to dismiss false flag. Depends on #4 & #5 (averages/Fast Sunday settled).

---

### Phase 2: Scripture & Objections (Content-Heavy, Parallel-Friendly)

8. **Scripture lock mode** (Scripture)  
   Require typing a practiced scripture on app unlock or after idle timeout. Gamifies mastery; independent of other scripture features.

9. **One-day grace period on streak** (Scripture)  
   Allow one missed review day without breaking streak; two consecutive misses do break it. Independent; low-friction UI change.

10. **Objections: fallacy recognition & comebacks** (Objections)  
    Pair each objection with logical fallacy labels and Spirit-focused gentle comebacks. Reframe as "stay grounded" not "win debate." Independent.

11. **Objections: scripture-criticism scenarios** (Objections)  
    Add edge-case objections on historical/prophecy claims; mix technical and beginner variants. Independent; builds on #10's infrastructure.

12. **Parable of the Unjust Gardener** (Objections/Content)  
    Weave into Objections, Glossary, or Email examples. Low-effort; can be folded into #10 or #11 or done standalone.

---

### Phase 3: Account & Data Management (Mid-Tier, Unblocks Multi-Account Future)

13. **Data wipe capability** (Accounts)  
    Add multi-step confirm option in Settings to fully clear local + cloud data. Essential for future multi-account or account migration. Independent.

14. **Demo account: zero API key access** (Accounts)  
    Create account mode that never requests API key; disables AI features (Spanish, Email, Objections). Allows offline field demos. Independent.

15. **Demo account: auto-delete on logout** (Accounts)  
    Add auto-deletion of all data on app unlock/exit (variant of #14). Clean slate for showing app to others. Can follow #14 as an enhancement.

16. **QR code contact exchange** (Outreach)  
    Generate unique QR per user linking to contact/share form. Independent; new table or settings entry.

17. **Miracles: resurface & reminders** (Spiritual)  
    Periodically surface old miracles; add "feeling down?" nudge. Independent; low-friction feature.

---

### Phase 4: Exercise System (Largest, Tightly Dependent — Do in Order)

18. **Confirm current exercise-style architecture state** (Exercise)  
    Audit existing code to confirm what's currently possible. Prerequisite for #19.

19. **Fix exercise-style mixing** (Exercise)  
    Allow one workout to contain Timed, Rep, and Circuit segments. Depends on #18 (audit).

20. **Reuse built-in workouts as templates** (Exercise)  
    Clone official workouts as starting points; customize. Depends on #19 (style mixing working).

21. **Save multi-week workout programs** (Exercise)  
    Bundle full week/month of workouts; "apply program" action to load all. Depends on #20 (templates working).

22. **Community feature: post & like programs** (Exercise / Social)  
    Let users share/browse saved programs; surface "most liked." No live chat. Depends on #21 (multi-week programs exist).

---

### Phase 5: Visual & Design (Medium, Phased)

23. **Restyle for church-app feel** (Design)  
    Subtle iconography, spacing, hierarchy to feel more like official Church app. Complements dark mode (#1). Depends on #1.

24. **Full visual design pass** (Design)  
    Comprehensive refresh of typography, spacing, colors, accessibility. Large scope; consider breaking into sub-tasks (e.g., modals, cards, buttons). Depends on #23 (initial restyle done).

---

### Phase 6: Technical Infrastructure (Enablers for Future)

25. **In-app update trigger + rollback** (Infrastructure)  
    Detect new versions; notify user; allow rollback to known-good. Independent; improves deployment confidence.

26. **Explore Claude Code Skills** (Tooling)  
    Investigate MCP servers or skills for app automation/validation. Discovery task; unblocks future automation opportunities.

27. **Fulfillment framework** (Content/UX)  
    Loosely frame app around four fulfillment types without naming explicitly. Subtle UX choices (icons, grouping, nudges). Independent; enhances Weekly Reflection (Task #7).

28. **7 Habits integration** (Content)  
    Light-touch Covey framework incorporation (e.g., "Sharpen the Saw" = study, "Begin with End" = mission goals). Independent; can be folded into Email, Mastery, or Exercise features.

---

### Phase 7: SEO & Future Setup

29. **Backlink strategy for missionarycompanion.com** (Outreach)  
    Leverage Dom's other sites to link to app. Non-technical; coordination + link setup.

30. **Secure GitHub repo** (Infrastructure)  
    Evaluate private repo + GitHub Pro tradeoffs. Decision task; implementation (if any) low-friction.

---

## Notes

- **Dependencies respected:** Tasks listed in an order that unblocks later work (e.g., dark mode before visual pass, exercise audit before architecture fix).
- **BLOCKED tasks deliberately excluded** from the executable order; they are listed at the top and can be scheduled once their blocking conversations conclude.
- **Parallel tracks possible:** Phases 2 (Scripture/Objections) and 3 (Accounts) can be worked in parallel; Phase 4 (Exercise) is sequential within itself.
- **All 30 tasks are small-to-medium scope:** No single task should take more than a few hours to a day; larger efforts (Full Visual Pass, Multi-Week Programs) are broken into prerequisites.
