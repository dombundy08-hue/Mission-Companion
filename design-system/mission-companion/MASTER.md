# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/mission-companion/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Mission Companion
**Generated:** 2026-08-03 (reconciled from the live, shipped vanilla app —
not auto-generated defaults; see note below)
**Category:** Personal spiritual/productivity PWA (journal, scripture
memorization, language practice, health/exercise tracking) for a single LDS
missionary user

> **Source of truth note:** this file was seeded by `ui-ux-pro-max
> --design-system`, then **fully overwritten** with the actual, already-live
> design decisions from `index.html` (finalized the same day this file was
> created) — the tool's generic output (warm brown/violet, Figtree/Noto Sans,
> "Vibrant & Block-based" style, App Store landing pattern) does not match
> this app's real, shipped identity and was discarded rather than reconciled
> line-by-line. Every value below is taken directly from `index.html`'s
> `:root` CSS custom properties — treat this file as authoritative for any
> new React build, not the vanilla CSS as a separate/parallel source.

---

## Global Rules

### Color Palette — blue theme, light + dark

| Role | Light | Dark | CSS Variable (vanilla) |
|------|-------|------|--------------------------|
| Primary / Navy | `#163C64` | `#0B1D33` | `--navy` |
| Primary Soft | `#1F5389` | `#12314F` | `--navy-soft` |
| Background | `#F5F8FC` | `#0A0F17` | `--bg` |
| Card | `#FFFFFF` | `#121826` | `--card` |
| Accent (text/links/badges) | `#1C6FB0` | `#6BB4EA` | `--gold` (name is legacy from the pre-redesign warm-gold theme, value is now blue) |
| Accent Dark (shadows/hover) | `#145084` | `#3D7FB5` | `--gold-dark` |
| Accent Button (fixed, non-adaptive) | `#1C6FB0` | `#1C6FB0` | `--accent-btn` |
| Text | `#1B2430` | `#E4E9F1` | `--text` |
| Muted | `#5B6B82` | `#93A2B8` | `--muted` |
| Line/Border | `#E1E8F0` | `#263447` | `--line` |
| Destructive | `#9a3b2f` | `#da3633` | `--danger` |
| Destructive Background | `#fbeae6` | `#3d1f1a` | `--danger-bg` |

**Color notes:** All button backgrounds pair with **white text**
(`--accent-btn` + `color:#fff`), never `--gold`/navy directly, because a
single color value can't simultaneously satisfy contrast as both a button
background (needs to be dark enough for white text) and as plain text on a
themed background (needs to be light enough in dark mode) — verified via
WCAG contrast math this session (5.32:1 light, 6.91-8.54:1 dark). **Known
pre-existing gap, not yet fixed**: `var(--navy)` is still used directly as a
*text* color in ~70 places in `index.html` — correct in light mode, but
reads near-invisible in dark mode (contrast ~1.05:1). A React port should use
`--text` for plain text, never `--navy`, from the start rather than
reproducing this bug.

### Typography

- **Heading Font:** Newsreader (serif, self-hosted, `assets/fonts/newsreader-variable.woff2`) — used for `h1/h2/h3/.tabtitle` and the kinetic loading screen title.
- **Body Font:** Lexend (sans, self-hosted, `assets/fonts/lexend-variable.woff2`), weight 800 for the kinetic loader specifically.
- **Mood:** distinctive, readable, deliberately not the Inter/Poppins/Manrope look of generic AI-templated sites — chosen specifically to avoid that.
- **No CDN fonts** — both are self-hosted variable-weight `.woff2` files so the PWA works fully offline. A React port should copy these two files rather than pulling from Google Fonts' CDN.
- **Google Fonts origin** (for regenerating the files only, not for runtime use): Lexend + Newsreader, weights 400-700.

### Spacing

No formal spacing scale was ever tokenized in the vanilla app (ad hoc px
values throughout). For the React port, adopt a standard scale rather than
reproducing ad hoc values:

| Token | Value |
|-------|-------|
| `--space-xs` | `4px` |
| `--space-sm` | `8px` |
| `--space-md` | `16px` |
| `--space-lg` | `24px` |
| `--space-xl` | `32px` |
| `--space-2xl` | `48px` |

### Shadow / Elevation (ported directly from `index.html`, added this session)

| Level | Light | Dark |
|-------|-------|------|
| `--shadow-sm` | `0 1px 3px rgba(22,60,100,.08), 0 1px 2px rgba(22,60,100,.05)` | `0 1px 3px rgba(0,0,0,.35), 0 1px 2px rgba(0,0,0,.25)` |
| `--shadow-md` | `0 6px 16px rgba(22,60,100,.10), 0 2px 6px rgba(22,60,100,.06)` | `0 6px 16px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.30)` |
| `--shadow-lg` | `0 16px 40px rgba(22,60,100,.16), 0 6px 12px rgba(22,60,100,.08)` | `0 16px 40px rgba(0,0,0,.55), 0 6px 12px rgba(0,0,0,.35)` |

Applied to every content-card surface; `--shadow-lg` for modals, `--shadow-md`
for the single "spotlight" question card in Objections practice. Gentle
hover-lift (`translateY(-1px)` + upgrade to `--shadow-md`) on non-touch
devices only (`@media (hover:hover)`).

### Border Radius

Not formally tokenized in the vanilla app; observed range is 9-18px across
cards/buttons/inputs, mostly clustering at 12-14px. Use `12px` for
buttons/inputs, `14px` for cards, `16-18px` for modals/flashcards/prominent
elements as a reasonable default scale for the port.

---

## Component Specs

### Buttons

```css
.btn-primary {
  background: var(--accent-btn); /* #1C6FB0, fixed, non-theme-adaptive */
  color: #fff;
  min-height: 50px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 17px;
  box-shadow: 0 2px 0 var(--gold-dark);
  transition: transform .12s ease, box-shadow .12s ease;
}
.btn-primary:active { transform: translateY(1px); box-shadow: 0 1px 0 var(--gold-dark); }

.btn-secondary {
  background: #eef0f4;
  color: var(--navy);
  box-shadow: 0 2px 0 #d9dde6;
}
```

### Cards

```css
.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
  transition: box-shadow .2s ease, transform .2s ease;
}
```

### Focus state (accessibility — hard requirement)

```css
:focus-visible {
  outline: 2px solid var(--accent-btn);
  outline-offset: 2px;
  border-radius: 4px;
}
```

### App shell — topbar / bottom nav (frosted glass, added this session)

```css
header.topbar, nav.bottomnav {
  background: var(--navy); /* fallback first for color-mix() unsupported browsers */
  background: color-mix(in srgb, var(--navy) 90%, transparent);
  backdrop-filter: blur(14px) saturate(160%);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
}
```

### Background texture (signature detail, added this session)

Body background uses a very subtle (5% opacity) inline-SVG `feTurbulence`
grain texture layered under `--bg`, applied via `background-image` on `body`
— not a separate element, no z-index/stacking concerns. Reuse the exact SVG
data URI from `index.html`'s `body{}` rule rather than regenerating a new
noise pattern.

---

## Style Guidelines

**Style:** Clean utility-app shell, NOT a marketing/landing page style. This
is a personal daily-use tool (journal, scripture practice, health tracking),
not a product being sold — no hero sections, no "download now" CTAs, no App
Store landing pattern. Screens are functional and content-first: lists,
forms, practice/flashcard interfaces, simple stat displays.

**Keywords:** Trustworthy, calm, personal, distraction-free, offline-capable,
mobile-first (this is used one-handed on a phone in the field).

**Key effects:** Subtle elevation (not flat, not heavy/dramatic), kinetic
word-cycle loading animation (see below), gentle hover-lift on non-touch
devices only, frosted-glass nav bars, subtle background grain texture.

### Kinetic loading screen (signature brand moment, added this session)

Character-level 3D fly-in/fly-out animation cycling **LOADING** → **MISSIONARY**
/ **COMPANION** (stacked, two lines), Lexend extrabold, `--text` color (not
`--navy` — that was the dark-mode contrast bug this exact screen surfaced and
fixed this session). Always respects `prefers-reduced-motion` (shorter travel
distance, no 3D rotation, faster timing when reduced motion is preferred).
This is the app's most distinctive, ownable visual moment — preserve it
faithfully in the React port rather than replacing it with a generic spinner.

---

## Anti-Patterns (Do NOT Use) — project-specific overrides

- ❌ **Do NOT replace emoji icons with an SVG icon set.** This is a deliberate
  override of `ui-ux-pro-max`'s generic "no emojis as icons" rule — emoji
  (📖 🍽️ ⚙️ etc.) are a confirmed, intentional, and central part of this
  app's personality (explicitly reconfirmed with the user this session: "keep
  the emoji, polish everything around them"). Do not swap them for Lucide/
  Heroicons in the React port.
- ❌ Marketing/landing-page patterns (hero sections, download CTAs, app-store
  screenshots pattern) — this is a private single-user tool, not a product
  being marketed.
- ❌ `var(--navy)` (or its React-port equivalent) as a direct text color —
  use `--text` instead. See the color notes above; this is a known bug in
  the current vanilla app, don't reproduce it in the port.
- ❌ Low contrast text — maintain 4.5:1 minimum (already verified for every
  color pairing introduced this session; verify any new pairing the same way
  before shipping it).
- ❌ Instant state changes — always use transitions (120-300ms, matches what's
  already on `.btn`/cards).
- ❌ Invisible focus states — must be visible for keyboard nav (the
  `:focus-visible` rule above, verified via real Tab-key navigation this
  session).
- ❌ Animation that ignores `prefers-reduced-motion` — every animation in this
  app (kinetic loader, hover-lift, card transitions) has a reduced-motion
  path; any new animation in the port needs one too.

---

## Pre-Delivery Checklist

- [ ] Emoji icons preserved as-is (NOT swapped for an SVG icon set)
- [ ] `--text` used for text color, never `--navy`/`--gold` directly on a
      background they weren't designed to pair with
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (120-300ms)
- [ ] Light mode AND dark mode: text contrast 4.5:1 minimum (verify both,
      not just light — this app's dark mode has a known pre-existing gap
      elsewhere in the vanilla app, don't add to it)
- [ ] Focus states visible for keyboard navigation (real Tab-key test, not
      just `.focus()`)
- [ ] `prefers-reduced-motion` respected on every animation
- [ ] Responsive: 375px, 768px, 1024px, 1440px (mobile-first — this is
      primarily a one-handed phone app)
- [ ] No content hidden behind the fixed bottom nav / sticky top bar
- [ ] No horizontal scroll on mobile
- [ ] Self-hosted fonts only — no Google Fonts CDN link (offline PWA
      requirement)
- [ ] Service worker (when ported) follows the cache-key-by-actual-URL
      pattern — see `pwa-checklist.md` in the `build-website` skill
