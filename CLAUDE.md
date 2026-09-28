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
index.html      a front page that explains there is nothing to browse
404.html        the same, for a wrong address
voice/          the player - the only page that does anything
favicon.png     kept from the old app
sw.js           a tombstone, see below
CNAME           missionarycompanion.com
```

## How the player works

`voice/index.html` is opened as `/voice/?v=<recording id>` from a link in
the weekly letter. It is a bare static document on purpose.

**The page it replaced was served by Apps Script, and the Gmail app's
in-app browser showed it as raw source text.** That is not fixable:
`HtmlService` always wraps a web app in Google's own javascript bootstrap
document, and that browser gives up part way through running it. No
setting removes the wrapper. Hence a plain file here.

The recording itself never moved. The page asks Dominic's Apps Script
project for the week's data (title, artwork, the letter, where to stream
the audio) over **JSONP** — a `<script>` tag, not `fetch()`, because a
script tag is not subject to CORS and so cannot be broken by whatever
headers Apps Script sends in future.

- The script side lives in `C:\Users\shan_\mission-email-system` —
  `missionary-tools/Tools.gs`, documented in `REFERENCE.md` §4r.
- **The two hardcode each other's addresses.** `EXEC` near the top of
  `voice/index.html` is the deployment. Editing a deployment with "New
  version" keeps that address; making a *brand new* deployment changes it
  and this file must be edited to match.
- No Supabase, no build step, no dependencies, no API keys. Don't
  reintroduce any of them — the point of this site is that it keeps
  working for two years with nobody maintaining it.

## Gotchas

- **`sw.js` must keep being served.** It is a tombstone that unregisters
  the old app's service worker. Deleting it would strand phones that
  installed the PWA on a cached shell pointing at deleted assets. Read
  the comment at the top of it before touching it.
- Pages are `noindex` — these are a missionary's letters to his family,
  and the repo is only public because Pages on a free account requires
  it. The recordings are **not** in this repo; they stay in his Drive.
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
