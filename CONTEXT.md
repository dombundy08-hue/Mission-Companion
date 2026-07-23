# Mission Companion — Context Handoff

Paste this into a new Claude chat before designing anything for this app.

---

## PART 1 — WHAT EXISTS

### Identity
- **App:** Mission Companion — personal tool for Elder Dominic Bundy (LDS missionary).
- **Live:** https://dombundy08-hue.github.io/Mission-Companion/
- **Repo:** github.com/dombundy08-hue/Mission-Companion (Dom's account)
- **Local canonical file:** `C:\Users\shan_\mission-companion\index.html` — ONE self-contained HTML file, ~184 KB, ~2,780 lines. This is the only copy. Editing anything else is editing a ghost.
- **Deploy:** git is wired up. `cd /c/Users/shan_/mission-companion && git add -A && git commit -m "..." && git push` → live in ~60s. No more manual uploads.
- **Support numbers shown in-app:** 720-745-0911 / 720-745-3166
- **Backup email target:** dom.bundy08@gmail.com

### Architecture — two-level navigation
- **Top of screen:** section switcher button (`#sectionBtn`) showing current section + `▾`. Opens a modal listing all sections.
- **Bottom of screen:** the tabs belonging to the current section, rebuilt per section by `renderBottomNav()`.

```
SECTIONS = {
  spiritual: 7 tabs — journal, spanish, mastery, email, objections, glossary, miracles
  exercise:  1 placeholder tab (no features built)
  health:    1 placeholder tab (no features built)
}
```

`SECTIONS` is a data-driven config object. **Adding a section or tab = adding entries there.** The bottom nav and switcher build themselves. Do not hand-write nav markup.

Key functions: `goToTab(tab)`, `goToSection(sec)`, `renderBottomNav()`, `openSectionModal()`, `render()` (master switch), `renderPlaceholder()` (any tab with no render function).

### Screens / boot order
`#lock` (password) → `#loading` → `#setup` (API key, first run only) → `#app`.
Boot: `authenticated === 'true'` ? `startApp()` : `showLock()`.
`startApp()` = show loading → `await cloudSyncAll()` → `cloudReady = true` → app.

### Auth
`const APP_PASSWORD` at the top of the script, marked `// CHANGE PASSWORD HERE`. Correct entry sets `localStorage.authenticated = 'true'` permanently on that device. Gear menu has "🔒 Lock App" to clear it. No lockouts.

### The 7 Spiritual features
| Tab | What it does |
|---|---|
| Journal | Auto date/time header, free-write + 1 random reflection prompt from a pool of **730** (no repeats until exhausted, tracked in `usedPromptIndices`), search, read/delete, incremental email backup via `mailto:` |
| Spanish | 3 modes (street/doorstep/lesson), Spanish-only replies, beginner-aware, never corrects grammar unless asked, "I'm Done Talking" → one-sentence English tip. In-memory only, not persisted |
| Mastery | **109** scripture cards, 3 practice modes (ref→text, fill-in-blank, text→ref), 1–5 confidence rating, inverse-confidence weighted selection, day streak, custom cards |
| Email | Voice examples → bullet points → ≤400-word weekly family email, copy button, backup reminder |
| Objections | **45** investigator concerns, AI stays in character, never grades, one-sentence reflection at end |
| Glossary | Term + child/skeptic/adult explanations (only term required), search, edit |
| Miracles | Fast capture, list, search |

### AI
All calls: `POST https://api.anthropic.com/v1/messages`, header `anthropic-dangerous-direct-browser-access: true`, model **`claude-haiku-4-5-20251001`** (never Sonnet/Opus). Every call wrapped in try/catch. Any failure shows a soft banner, never an alert:
> "The AI subscription is having difficulty. Contact 720-745-0911 or 720-745-3166."

API key is entered at runtime, stored in localStorage, synced via `app_settings`. Never hardcoded.

### Data — localStorage (the synchronous store the UI reads)
`authenticated` · `apiKey` (raw string, NOT JSON) · `lastBackupTimestamp` (raw ISO string, NOT JSON) · `journalEntries` · `miracleEntries` · `glossaryTerms` · `scriptureDeck` · `emailVoiceExamples` · `usedPromptIndices` · `activeTab` · `activeSection` · `scriptureStreak` · `scriptureCollection`

`getLS`/`setLS` are pure localStorage — deliberately NOT wrapped with cloud triggers.

### Data — Supabase (exact live columns, verified)
Project `mxlfwmwjkanvsjimralh.supabase.co`, publishable key `sb_publishable_...` (client-side, RLS open policies).

```
journal_entries   (id uuid, created_at, entry_date, body, reflection_prompt, reflection_response)
miracle_entries   (id uuid, created_at, entry_date, body)
glossary_terms    (id uuid, created_at, term, child_explanation, skeptic_explanation, adult_explanation)
scripture_progress(id uuid, scripture_id, confidence, review_count, last_reviewed)
app_settings      (id uuid, key, value)   -- value is TEXT; JSON.stringify on write, JSON.parse on read
```

**All primary keys are auto-generated UUIDs.** There is no app-id column, so:
- Each local record is stamped with its returned UUID as `cloudId` for later updates/deletes.
- Merge dedupes by **natural key**: journal/miracle = `date + body`; glossary = lowercased `term`; scripture = `scripture_id`; settings = `key`.

`app_settings` keys in use: `apiKey`, `lastBackupTimestamp`, `emailVoiceExamples`, `customScriptureCards`.

### Sync model — local-first
localStorage stays the synchronous store the render functions read. Supabase is the cross-device layer: pulled on load, pushed on every save. Reads were deliberately NOT made async — that would require rewriting every render function.

- `cloudSyncAll()` — pull + merge + push. Order matters: **settings before scripture** (settings restores custom cards; scripture then merges progress into them).
- Offline → saves locally, shows banner, `flushPending()` pushes on reconnect.
- All cloud writes are guarded by `cloudReady` + `sbOnline()`; failures queue, never throw.

### Design system
Navy `#1a2744` · warm white `#fafaf8` · gold `#b8973a`. System fonts only, no CDN fonts. Mobile-first, 44px minimum touch targets, safe-area insets. Reusable classes: `.card`, `.entry`, `.btn`, `.flashcard`, `.tabtitle`, `.more-card`, `.section-card`, `.soon`, `.linkbtn`, `.modal-back`.

---

## PART 2 — OPEN ITEMS

- **Exercise + Health are empty shells.** They render a real "nothing here yet" screen. Awaiting feature specs from Dom.
- **Scripture count is 109, not 113.** The target of 113 = 25 per book × 4 + 13 Articles of Faith. Each of the four books is short exactly **one** verse. Needs Dom to name those four. All counts in the UI are computed dynamically — adding them auto-corrects everything.
- **`remember_list` table does not exist.** A "Remember" feature (name + note flashcards, swipe-up delete) was specced but never built because the SQL was never run.
- **URL is long** for a mission phone — custom domain / shortener never done.

---

## PART 3 — HOW TO WRITE PROMPTS FOR CLAUDE CODE

Claude Code has the file, a browser to test in, direct Supabase query access, and git push. Write prompts that use that.

### Do
1. **Reference the file, don't paste it.** Say "in `C:\Users\shan_\mission-companion\index.html`". Never paste 2,800 lines into a prompt.
2. **Say additive vs. modifying, explicitly.** Name what must NOT change: "do not touch the render functions for Journal/Spanish/Mastery."
3. **Describe behavior, not implementation.** "Swipe up past a threshold deletes the card" — let Claude Code choose the mechanics. Over-specifying implementation produces worse code.
4. **One feature per prompt.** A tab, a fix, a screen. Not three.
5. **Give acceptance criteria** it can actually test: "after saving, the row appears in `remember_list` and survives a reload."
6. **Say where it goes** in the section/tab structure — which section, which position in the bottom nav.
7. **For new tables:** provide exact SQL and state whether it has been run yet. Claude Code cannot run DDL (the publishable key only reaches the data API), so table creation is always a human step in the Supabase dashboard.
8. **Let it verify and deploy.** "Test it, then commit and push" is a valid instruction.

### Don't
1. **Don't assert the app's current state without checking.** A previous brief claimed a "More menu" existed when it didn't, which sent the session down a wrong path. If unsure, say "check whether X exists first."
2. **Don't invent counts or data.** A brief once claimed 113 scripture cards while listing only 109; another claimed 25 per book while listing 24. Claude Code will build exactly what you list, and the mismatch surfaces later as a bug.
3. **Don't say "rebuild" when you mean "add."** This is a working, deployed app with real user data.
4. **Don't ask for cleanup of "test data" in Supabase.** ⚠️ The database holds Dom's real entries. A blind `DELETE` once removed his real API key. Any destructive DB operation must target specific IDs that are provably test rows, or be left to a human.

### Prompt template that works

```
In C:\Users\shan_\mission-companion\index.html — [ADD / FIX], do not rebuild.

CONTEXT: [one line on where this fits — which section, which tab]

WHAT TO BUILD:
- [behavior, not implementation]
- [data it stores, and where: localStorage key + Supabase table]

DO NOT CHANGE: [list the render functions / tabs / sync logic that must stay untouched]

SUPABASE: [exact SQL + "already run" or "not run yet"]

DONE WHEN:
- [testable criterion]
- [testable criterion]

Then test it, commit, and push.
```

### Worth knowing
- Claude Code will push back if a request conflicts with what's actually in the file. That's the system working — verify rather than override.
- It can query the live Supabase directly to confirm schema. Ask it to check rather than guessing column names.
- Screenshots are unreliable in this environment; it verifies via DOM reads and live fetches instead. Trust those.
