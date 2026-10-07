# Karen Lin — Portfolio

A one-page portfolio. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 4321
```

Then visit http://localhost:4321

---

## The landing page

The hero is a thick, **fully opaque** pour of `#4D653E` rendered in WebGL —
nothing is seen *through* it. Two GPU passes:

1. **Simulation** — a ping-pong height field solving the 2-D wave equation, plus
   a viscosity term that bleeds off the fine chatter so the pour reads as heavy
   rather than watery. One step per frame, so swells travel slowly and settle.
2. **Render** — lights a single opaque surface. The lettering is not visible on
   its own: the relief only telegraphs up through the pour where the surface is
   actually disturbed. Still liquid lies flat over the plate and hides it; a
   passing swell raises **“Be kind”** into the light, then it sinks again.

Undisturbed liquid resolves to exactly `#4D653E` — the shading is normalised so
it only ever departs from that colour where there is a swell.

Tuning constants at the top of the fragment shader in `assets/js/liquid.js`:

| Constant | Does |
|---|---|
| `WAVE` | how far a swell tilts the surface |
| `EMBOSS` | relief of the lettering |
| `SHEEN` | breadth of the gloss highlight |
| `uRestVis` (JS, near the bottom) | how much of the relief a *still* surface keeps — raise it to leave the words permanently legible |

### Changing the phrase

The words come from `data-words` on the hero canvas, so no JS edit is needed:

```html
<canvas id="liquid" aria-hidden="true" data-words="kindness|is golden"></canvas>
```

A pipe breaks a line, and the type is auto-fitted and re-centred for any number
of lines. Break long phrases — the relief needs mass to read through an opaque
pour, so a few large words carry far better than one small line. With no
attribute the hero falls back to “Be kind”.

Update the visually-hidden line in the hero and `.foot__be` in the footer to
match, so the phrase reaches screen readers too.

For a thicker or thinner body, change `uVisc` and `uDamp` where they are set in
the frame loop, and `ptr.force` / `uPtrRadius` for the weight of the cursor.

Browsers without WebGL2 float textures get a static green hero with CSS-embossed
type. Under `prefers-reduced-motion` nothing moves, so the relief is held
permanently raised instead — a static embossed “Be kind” rather than a blank field.

The liquid only responds to actual movement: a cursor left sitting on the hero
stops disturbing it rather than drilling a well where it rests.

---

## Project layout

Each project follows the same structure:

```
title          │  UI display
animation      │  (as tall as both)
───────────────┴───────────────────
description, tags        Read case study →
```

On phones it stacks in order: title, UI display, animation, description. The
whole project is clickable through one real button, "Read case study".

Everything is drawn onto `<canvas>` elements straight on the page: no cards,
frames or slide backgrounds. Each stage pauses off screen, speeds up while you
hover the project, and shows one still frame under `prefers-reduced-motion`.

### Animations (left)

| Project | Script | What it shows |
|---|---|---|
| TossLess | `tossless-bin.js` | The deck's potato, apple, broccoli, bread and chocolate tumbling into its wire bin, piling up, then emptying |
| Steam | `steam-sources.js` | YouTube, Reddit and SteamDB joined to the Steam logo by dashed lines, as on the deck's user-flow slide, and drawn into it one by one |
| Aquila | `aquila-risk.js` | A week of appointments on a Mon–Fri calendar sorting into the ranked no-show risk list, in the deck's proportions (20 / 56 / 24 tiers, top score 0.41, Friday riskiest) |
| Apple Health | `cycle-ring.js` | A 28-day ring with the period and fertile window, a marker moving through the month |

### UI displays (right): `ui-display.js`

The `CONFIGS` object at the top sets what each stage shows:

- **TossLess:** two phones stepping through Home, Expiring Soon, Detect,
  Restock and the lock-screen notifications. The screens came from the deck's
  `.pptx`, which holds sharper originals than the PDF, and all sit in the same
  clean frame (`assets/projects/tossless-ui/`).
- **Steam:** two phones stepping through home, Fit Score and trade-in, with the
  store and Fit Score detail behind (`assets/projects/steam-live/`).
- **Aquila:** a stack of browser windows cycling through the four Tableau
  dashboards (`assets/projects/aquila-01…04.jpg`).
- **Apple Health:** an empty phone reading "Screens in progress". To show real
  screens, add them to a folder and give `cycle` a `phones` config like
  TossLess's.

`STEP` sets how long each screen stays up.

---

## Photography

Photos are served from **Cloudinary** (cloud `qzo7rz9q`) and listed in
`window.PHOTOS` in `assets/js/content.js`, newest first:

```js
window.PHOTOS = {
  daily:  [ { file: "IMG_5029", alt: "…" }, … ],
  hearts: [ { file: "IMG_7654", alt: "…" }, … ]
};
```

`file` is the photo's **public ID exactly as Cloudinary shows it**:
case-sensitive, with no extension and no folder name. Your current uploads use
their original filenames (`IMG_5029`, `fxn_2026-08-06_132559398D64B853C5`). The
site requests `f_auto,q_auto,w_500,c_fill` for the grid and `f_auto,q_auto` for
the lightbox.

The page shows the first 12 daily photos and 16 hearts, with "Show all" for the
rest (`FIRST_SHOWN` in `assets/js/site.js`). Right-click saving and dragging are
blocked on photos. That discourages casual saving but can't stop someone
determined, who can still screenshot or open the image URL.

**Fallbacks.** Cloudinary sometimes fails the first time it converts a HEIC upload
("Cannot read grid descriptor"). The gallery then tries a simpler URL, then the
same URL again, then the metadata-free copy in `Photography/Photography/` or
`Photography/Hearts/`. With Cloudinary unreachable, all photos still load from
those copies, so deploy those folders with the site.

**Two photos aren't on Cloudinary:** `E6488E43-912D-46F8-9933-E05A9854511C` and
`IMG_0730`. They're commented out in `content.js`. Upload them under those
names, then delete the `//`.

### Your location is in the Cloudinary originals

Your uploads are the original iPhone HEIC files, and Cloudinary serves originals
publicly. `…/image/upload/IMG_5029.heic` is byte-for-byte your photo, **GPS
coordinates included**. The resized images the site uses are clean, but anyone
can change the URL. To fix it, either:

- **Replace the uploads with the clean JPEGs** in `Photography/Photography/` and
  `Photography/Hearts/` under the same public IDs (overwrite on). This also stops
  the conversion failures. **Or**
- In Cloudinary **Settings → Security**, turn on strict transformations and allow
  only the two transformations above, so plain original URLs stop working.

### Adding new photos

1. Drop the photos into `Photography/Photography/` or `Photography/Hearts/` and run:

   ```bash
   python3 tools/prepare-photos.py
   ```

   It makes clean, upright, resized JPEGs with no location data, and prints the
   lines for `content.js`.
2. Upload those **.jpg** files to Cloudinary (not the HEIC originals), keeping each
   filename as its public ID.
3. Paste the printed lines into `window.PHOTOS` and replace "describe the photo"
   with a short description.
4. Change the `?v=` number on the links in `index.html`.

**Portrait:** save one as `assets/photography/portrait.jpg` and it appears in About.
Without it you get a monogram tile.

---
## Decorations

- **Footer tiles.** `assets/images/green-tiles.webp` / `.jpg` is built from
  `Green Tiles.JPG`, cut on the grout lines so it repeats seamlessly. A dark green
  wash sits on top so the cream text stays readable (at least 4.5:1 contrast for
  small text over the brightest tiles). Adjust `--tile-wash` in the CONTACT block of
  `style.css`.
- **Hearts on the Heart Collection** (`assets/js/heart-decor.js`). The three
  hand-drawn hearts (`heart_1–3.jpg`, cut out into `assets/images/hearts/`) pop into
  the empty space around the photography section when the Heart Collection opens:
  side margins, beside the heading, below the photos. They land one after another
  and then stay still. They never overlap the photos, tabs, text or each other
  (`AVOID` lists what they keep clear of), and they pop away on Daily Photography.
  If the layout changes, for example after "Show all", they pop into new spots.
  `MAX` caps how many (12 on desktop, 5 on phones); add another heart by dropping a
  transparent `.webp` into that folder and adding it to `HEARTS`.
- **Oil-painted flowers in About** (`assets/js/flower-bloom.js`). Daisies,
  ranunculus, pom-pom carnations, tulips and baby's breath in colours from
  `flowers.jpg`. Every petal, leaf and stem is built from brush strokes: an opaque
  body of paint with bristle streaks dragged through it, a light ridge along one
  side, dry-brush breaks at the ends, a soft shadow under the paint and fine canvas
  grain. Flowers root just outside the section's left, right and bottom edges and
  grow inward: stem first, then leaves, then the head opens. One or two at a time,
  never over the text, paused off screen. Under reduced motion a few stay open,
  still. `pickEdge` sets how often each edge is used.
---

## Adding the Apple Health case study

That entry is scaffolding, not findings — it says so on the page. To finish it:

1. Put the deck at `assets/pdf/apple-health-cycle.pdf` and set `pdf:` in the
   `cycle` entry of `assets/js/content.js`.
2. Export slide images to `assets/projects/cycle-01.jpg` etc.
3. Replace the `html:` string in that entry, and delete the `cs__wip` callout.
4. Swap the SVG cover in `index.html` (`.project__media--cycle`) for a real image
   if you'd rather.

---

## Editing text

- **Case studies** — `assets/js/content.js`
- **Hero, About, Contact** — `index.html`
- **Colours, type, spacing** — the `:root` block at the top of `assets/css/style.css`
- **The words in the water** — the `WORDS` constant at the top of `assets/js/liquid.js`

## Browsers showing an old version

The stylesheet and scripts are linked with a version tag, for example
`style.css?v=20260915`. When you change any CSS or JS, change that number on every
stylesheet and script link in `index.html` to today's date. Every browser then fetches the new
files instead of reusing a cached copy. The local preview server
(`.claude/serve.py`) also tells browsers not to cache, but visitors to the live
site only get your changes if the tag changes.

---

## Notes

- **Not part of the site, so don't upload these:** `Hearts/` in the Portfolio
  folder (73 MB of original HEIC photos, copied into `Photography/Hearts/`),
  `Photography/_originals/`, `Green Tiles.JPG`, `heart_1–3.jpg`,
  `flowers.jpg`, `_Steam App Redesign.pdf`, and `tools/`.

- `TossLess_.pdf` and `_Steam App Redesign.pdf` are your originals (~78 MB together).
  The site links to web-optimised copies in `assets/pdf/` (1 MB and 3.7 MB).
  Exclude the originals when you deploy.
- Deploys as-is to Netlify, Vercel, GitHub Pages or any static host. No build step.
