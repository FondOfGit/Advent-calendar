# CLAUDE.md

A static Advent calendar of Christmas trivia for adults, styled as a Victorian Christmas. It has 24 doors, one per day from 1 to 24 December. Each door unlocks on its date in the viewer's local time and opens a multiple-choice question; once answered, it shows a short explanation. The score is kept in the browser.

## Stack

- Plain HTML, CSS and JavaScript. There is no framework, no build step, no package.json and no backend.
- Fonts come from Google Fonts: Playfair Display for display text and numerals, EB Garamond for body text. Both have Georgia or Garamond fallbacks.
- All ornament is inline SVG. A sprite of `<symbol>`s at the top of `index.html` (`corner`, `divider`, `star`, `keyhole`) is reused with `<use href="#...">`.
- The wallpaper is William Morris's "Willow Bough" (1887, The Met, public domain), cut to one seamless pattern repeat and tinted deep green: `images/wallpaper-willow-bough.jpg`, tiled on `<body>` at 400px wide. A fixed `body::before` layer adds lamplight from above and a vignette.
- The holly swag across the top is an inline SVG in `index.html` (three loops of holly with ribbon bows). Each loop "breathes" and each bow sways via CSS animation. `--swag-inset` keeps its ends clear of the frame corners, and `.masthead` padding is derived from it.
- `.hearth` is a fixed firelight glow at the bottom of the viewport, flickering via two out-of-phase CSS animations.
- Snow is drawn on a single `<canvas>`. It is off by default when the visitor has `prefers-reduced-motion` set, can be toggled with the "Snow" button, and pauses while the tab is hidden.
- The question dialog uses the native `<dialog>` element, which provides focus trapping and Escape-to-close.
- The CSS is mobile-first: 3 columns by default, 4 from 600px and 6 from 960px.

## Files

```
index.html                    Markup, SVG ornament sprite, dialog shell
css/styles.css                All styling (colour tokens are in :root)
js/app.js                     Lock logic, storage, rendering, dialog, snow
questions.json                The 24 questions. All content lives here.
images/cards/                 Put the vintage card art here (see below)
favicon.svg
scripts/validate-questions.mjs  Schema check for questions.json (run in CI)
.github/workflows/pages.yml   GitHub Pages deployment
```

## Run locally

The page loads `questions.json` with `fetch`, so opening `index.html` straight from the filesystem (`file://`) will not work. Serve the folder instead:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/?preview=1
```

Any static server works, for example `npx serve .`.

### Testing flags

| URL | Effect |
| --- | --- |
| `?preview=1` | Unlocks every door. Shows a banner, labels empty image slots, and saves answers under a separate `:preview` key so the real score is untouched. |
| `?date=2026-12-09` | Pretends today is that date, so you can check the lock behaviour for any day. Also saves under the `:preview` key. |

Validate the questions after editing:

```sh
node scripts/validate-questions.mjs
```

## Unlock rules (`js/app.js`)

- In December, door N is open when the local date is N December or later.
- From 25 December to 6 January (Twelfth Night), all doors stay open.
- From 7 January to 30 November, all doors are locked and the header counts down to 1 December.
- An open tab re-checks the locks just after local midnight.

Locking happens only in the browser. Anyone who reads `questions.json` can see every answer, which is acceptable for a trivia game but means this is not tamper-proof.

## Score and storage

Answers are saved in `localStorage` under `victorian-advent:<season-year>`. The season year is the December's year, so 1 to 6 January counts toward the previous year. Each new season therefore starts with a clean score. The stored shape is `{ v: 1, opened: [days], answers: { "<day>": { choice, correct } } }`. Each question can be answered once. "Reset my answers" in the footer clears the current season. The snow preference is stored separately as `victorian-advent:snow`.

## questions.json

```json
{
  "day": 1,
  "question": "…",
  "options": ["…", "…", "…", "…"],
  "answer": 1,
  "explanation": "…",
  "image": null,
  "imageAlt": "",
  "imageCredit": ""
}
```

- `answer` is a **zero-based** index into `options`. There can be 2 to 6 options, and they are shown in the order written.
- Each `day` from 1 to 24 must appear once. A missing day still shows its door, but opening it shows a "still being written" message.
- Use typographic quotes (“ ” ’) in the text.

## Adding the vintage card art

1. Put each image in `images/cards/`. A portrait shape around 3:4 suits the doors best; images are cropped with `object-fit: cover`. Keep each file under about 300 KB, as JPEG or WebP.
2. Fill in that day's entry, for example:
   ```json
   "image": "images/cards/day-01.jpg",
   "imageAlt": "Chromolithograph of a robin on a holly branch",
   "imageCredit": "Raphael Tuck & Sons, c. 1890. Public domain, via the Library of Congress."
   ```
3. Run `node scripts/validate-questions.mjs`. It fails if the file is missing and warns if the alt text or credit is empty.

The art appears behind the door once it is opened, and above the question in the dialog. Images are not requested until their door is opened. Until art is added, each door shows a gilt star ornament; in preview mode it is also labelled with the slot.

## Deploy (GitHub Pages)

The workflow in `.github/workflows/pages.yml` runs on every push to `main`, and can also be run by hand. It validates `questions.json`, copies only the public files (`index.html`, `favicon.svg`, `questions.json`, `css/`, `js/`, `images/`) into `_site`, and publishes them with `actions/deploy-pages`.

One-time setup: in the repository on GitHub, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**. The site will then be published at `https://<owner>.github.io/<repo>/`.

All paths in the site are relative, so it works under the `/<repo>/` subpath without changes. If you add a new top-level folder that the site needs, add it to the `cp` line in the workflow.

The one exception is the link-preview tags in `index.html` (`og:*`, `twitter:card`, `canonical`). Scrapers require absolute URLs there, so they point at `https://fondofgit.github.io/Advent-calendar/`. Update them if the site moves to another address or a custom domain. The preview image is `images/social-preview.jpg` (1200×630). It's a screenshot of a composition built from the site's own CSS, wallpaper, swag and card art, so regenerate it if the look changes significantly.

## Conventions

- Keep it dependency-free. Do not add a bundler, framework or npm packages.
- All copy for the questions lives in `questions.json`. UI strings live in `index.html` and `js/app.js`.
- Respect `prefers-reduced-motion`; the door swing, today's glow, swag, firelight and snow are all stopped or disabled under it.
- Insert untrusted text with `textContent`. `questions.json` is never injected as HTML.
