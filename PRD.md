# Mission Companion — Product Requirements Document

## Completed
- **Custom section icons** — Spiritual/Exercise/Health tabs now use custom images instead of text labels. Already shipped.

## Blocked (awaiting external conversation)
- **Multi-account rollout** — Enable multiple missionaries to use the app with distinct accounts. *Blocked: requires mission-president conversation to discuss rollout strategy, data isolation, and account provisioning.*
- **GHL automations** — Auto-text phone numbers collected during missionary work. *Blocked: TCPA consent and legal liability concerns flagged; requires legal/accountability discussion before any build.*

---

## Feature Groups (grouped by system overlap)

### Exercise System Architecture & Program Building
**Scope:** Medium–Large (touches workout architecture, storage, UI)

Three related items that share exercise-program data structures:

1. **Fix exercise-style architecture** — Currently constrained to single style per workout (Timed OR Rep OR Circuit). Unlock mixing: allow one workout to contain Timed sets, Rep sets, and Circuit segments in one session. *Status: scoped in past sessions; confirm current implementation state before building.*

2. **Reuse built-in workouts as templates** — Instead of always building from scratch, let users pick an official workout (e.g., "Cardio Burst") and clone it as a starting point, then customize. Avoids duplication, speeds up planning.

3. **Save multi-week workout programs** — Extend beyond single-session saves to allow storing a full week/month of workouts as a bundled program. Include a "apply this program" action to load all sessions at once. Shared storage with #1 & #2.

4. **Community feature: post & like programs** — Let users share their saved programs, browse others' programs, and surface "most liked" without live chat. Low-distraction design. Builds on #3 (multi-week programs); storage extends to a community_programs table or similar.

---

### Health Tracking Refinements
**Scope:** Small–Medium (mostly data logic and UI flows)

1. **Saved Foods: frequency-gated save** — Currently, users can save any food after logging it. Change to: only prompt to save after the *exact same food entry* has been logged 10 times within some window (e.g., last 90 days). Reduces clutter from one-off entries.

2. **Fast Sunday handling** — Add a toggle/indicator when marking a day as a Fast Sunday, then exclude or annotate that day in calorie/protein averages (or use a separate "eating days" average). Example: if averaging 7 days but one was a fast day, show "avg (6 eating days)" or similar.

3. **Review averages math** — Clarify the averaging strategy: per-week snapshots vs. one rolling average; consider median if weekly averages vary widely. Document the rationale simply in the UI (e.g., a help tooltip). Current implementation state TBD; requires decision on median vs. mean and time window.

4. **Weekly reflection pop-up** — Surfaces the lowest-tracked area of the four (calories/protein/journaling/miracles) with an encouraging nudge. Includes "excuse this" to dismiss a false flag and move to the next area. Encourages holistic self-care.

---

### Scripture & Objections Features
**Scope:** Small–Medium (content + UI logic)

1. **Scripture lock mode** — Periodic re-entry (e.g., on app unlock or after 30 min idle) requires typing one of the scriptures currently being practiced, adding a reinforcement drill. Gamifies mastery.

2. **One-day grace period on streak** — If the user misses reviewing scripture for one day, the streak doesn't break; two consecutive misses do. Allows life flexibility without losing motivation.

3. **Objections: fallacy recognition & comebacks** — Pair each investigator objection with common logical fallacies (ad hominem, straw man, etc.) and gentle, Spirit-focused comebacks. Reframe the stance as "stay grounded, don't concede beliefs" rather than "win the debate." Respectful tone.

4. **Objections: scripture-criticism scenarios** — Add edge-case objections around scripture criticism, historical claims, or false-prophecy accusations. Mix technical and beginner-level variants so learners can practice at their comfort level.

5. **Include Parable of the Unjust Gardener** — Weave this parable (often misheard as "Invisible" Gardener) into relevant Objections, Glossary, or Email examples. Low-effort high-value resonance.

---

### Account & Data Management
**Scope:** Small–Medium (requires table schema changes; multi-account rollout is BLOCKED)

1. **Data wipe capability** — Add a settings option to completely clear local and cloud data for the current account (or a future alternate account), with a multi-step confirm. Essential for future multi-account setup or account migration.

2. **Demo account: zero API key access** — Create a special account mode that never asks for or stores an API key, disabling all AI features (Spanish chat, Email summaries, Objections). Allows showing the app offline in the mission field without leaking API credentials.

3. **Demo account: auto-delete on logout** — Variant of #2: a demo mode that auto-deletes all data on app unlock/exit, so each fresh open is a clean slate. Useful for showing the app to interested people without leaving traces.

---

### Content & External Integration
**Scope:** Small (mostly content and linking)

1. **Links to official Church websites** — Add contextual links to official Church resources (e.g., member.churchofjesuschrist.org, scriptures.church, etc.) throughout the app. *Requires specifics from Dom on which pages to link and where to place them.*

2. **QR code contact exchange** — Generate a unique QR code per user/account that links to a "contact this missionary" form or share-contact endpoint. Cross-platform friendly. Storage: new qr_codes table or app_settings entry.

3. **Miracles: resurface & reminders** — Periodically surface old miracle entries as reminders of God's presence. Add a "feeling down?" nudge that resurrects a random old miracle and invites reflection. Boosts retention and morale.

---

### Visual & Design
**Scope:** Medium–Large (UI-heavy; affects brand perception)

1. **Dark mode** — Add a system-preference-aware dark theme toggle, with CSS variables for theme colors. Improves usability for evening/night use.

2. **Restyle for church-app feel** — Currently the app reads as one flat color/style. Add subtle iconography, spacing tweaks, and visual hierarchy to feel more like an official Church app (LDS-aligned aesthetics). Complements dark mode.

3. **Full visual design pass** — Comprehensive refresh of typography, spacing, colors, and component styling. Includes accessibility audit. *Large scope; likely a multi-phase effort.*

---

### Technical Infrastructure & Tooling
**Scope:** Medium (architecture; may unlock future work)

1. **In-app update trigger + rollback** — Detect when a new app version ships (via service worker or version endpoint), notify the user, and allow rollback to a previous known-good version if something breaks. Increases confidence in deployments.

2. **Explore Claude Code Skills** — Investigate using Claude Code skills or custom MCP servers to automate app maintenance, data validation, or documentation. TBD on specific use case.

3. **Fulfill­ment framework** — Loosely frame the app around four types of fulfillment (physical/intellectual/social-emotional/spiritual) without naming it explicitly. Use this frame to help surface which area needs user attention (ties into Weekly Reflection pop-up).

4. **7 Habits integration** — Explore incorporating Covey's 7 Habits framework into mission work (e.g., Sharpening the Saw = spiritual study, Begin with the End in Mind = daily mission goals). Light touch; avoid preachiness.

---

### Settings & Metadata
**Scope:** Small (configuration)

1. **Additional settings-area sections** — Placeholder for future settings expansion (notification preferences, language, etc.). TBD specifics.

2. **Secure the GitHub repo** — Evaluate private-repo + GitHub Pro tradeoffs for dom's current public repo. Consider API-key exposure risk, access control, and cost.

---

### SEO & Outreach
**Scope:** Small (external)

1. **Backlink strategy for missionarycompanion.com** — Dom owns other sites; leverage them to link to the app for SEO. No technical work; coordination + link setup.

---

## Dependency Notes

- **Exercise features** (#1–4 of Architecture group) share storage; recommend building in order: fix style mixing → templates → multi-week programs → community.
- **Scripture features** are independent; can build in parallel.
- **Weekly reflection pop-up** depends on finalized Health tracking logic (averages, Fast Sunday handling).
- **Dark mode** is prerequisite for "restyle for church-app feel" and "full visual design pass."
- **Demo account** features can be built independently but may inform multi-account rollout strategy (currently BLOCKED).
