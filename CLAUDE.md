# CLAUDE.md

Guidance, not enforced config — every line competes for attention. If a
rule isn't decision-relevant, cut it.

## What this repo is

`missionarycompanion.com` — a three-page static site whose only job is to
play the voice memo in Dominic's weekly letter home.

It used to be Mission Companion, a React + Vite + Supabase PWA. That app
was retired on 2026-09-28 and the domain repurposed. **Nothing of it is
lost**: it is at the tag `mission-companion-app-final`, and
`git checkout mission-companion-app-final` brings all of it back.

```
index.html      "There's nothing here." Deliberately empty - see below
404.html        a byte-identical copy, so a wrong address looks the same
robots.txt      disallow everything
voice/          the player - the only page that does anything
m/              published memos: <slug>.json + <slug>.<ext>, one pair per week
sw.js           a tombstone, see below
CNAME           missionarycompanion.com
```

## How the player works

`voice/index.html` is opened as `/voice/?m=<slug>` from a link in
the weekly letter. It is a bare static document on purpose.

**The page it replaced was served by Apps Script, and the Gmail app's
in-app browser showed it as raw source text.** That is not fixable:
`HtmlService` always wraps a web app in Google's own javascript bootstrap
document, and that browser gives up part way through running it. No
setting removes the wrapper. Hence a plain file here.

**`/voice/?m=<slug>` is the live route.** Everything the player needs is
committed into this repo by Dominic's Apps Script project at send time:
`m/<slug>.json` (title, week, artwork, the letter, the audio path) and
the recording beside it. The page fetches both from this same origin. No
Drive link to expire, no sharing setting to reset, no Apps Script
deployment to keep in step — the audio is simply a file on this site.

`/voice/?v=<drive id>` is the older route, kept only because letters sent
before 28 September 2026 are still in people's inboxes. It asks the Apps
Script project over **JSONP** — a `<script>` tag, not `fetch()`, because a
script tag is not subject to CORS.

- The script side lives in `C:\Users\shan_\mission-email-system` —
  `missionary-tools/Tools.gs`, documented in `REFERENCE.md` §4r.
- **`EXEC` near the top of `voice/index.html` only matters to the old
  `?v=` route.** Editing a deployment with "New version" keeps that
  address; a *brand new* deployment changes it and this file must match.
  Published `?m=` memos do not depend on it at all.
- Publishing needs a fine-grained GitHub token (Contents: read and write,
  this repo only) in the Apps Script project's Script Properties as
  `GITHUB_TOKEN`. No token just means memos fall back to the old route.
- No Supabase, no build step, no dependencies, no API keys. Don't
  reintroduce any of them — the point of this site is that it keeps
  working for two years with nobody maintaining it.

## Gotchas

- **`sw.js` must keep being served.** It is a tombstone that unregisters
  the old app's service worker. Deleting it would strand phones that
  installed the PWA on a cached shell pointing at deleted assets. Read
  the comment at the top of it before touching it.
- **The front page gives nothing away on purpose.** A stranger who looks
  up the domain sees "There's nothing here." and no name, link or
  explanation; `404.html` is identical so a wrong address looks the same.
  Everything is `noindex` and `robots.txt` disallows all. Don't add a
  nav, a title, a favicon or a friendly explanation to `/` — the only
  way to a memo is the letter it came in.
- **A memo's address is its only protection.** Slugs are 32 hex
  characters from a hash, and nothing links to them. The repo has to be
  public for Pages on a free account, so anyone who finds *the repo* can
  browse `m/` — that is the accepted tradeoff for the audio being served
  from here rather than from Drive.
- `voice/` must not be cached or rewritten by anything. Each link is a
  different week.
- `.claude/` is gitignored project-wide — only force-added files (`git
  add -f`) are tracked. The two `mission-companion-*` skills under it
  refer to the retired app.

## Deploying

Commit and push to `main`. GitHub Pages builds it. There is no build
step and nothing to compile — check `gh api
repos/dombundy08-hue/Mission-Companion/pages/builds/latest` and then
fetch the live URL.

## References

- Live: https://missionarycompanion.com and
  https://missionarycompanion.com/voice/
- GitHub: https://github.com/dombundy08-hue/Mission-Companion (public,
  free tier)
- The retired app: tag `mission-companion-app-final`
- The script that feeds the player:
  `C:\Users\shan_\mission-email-system\REFERENCE.md` §4r
