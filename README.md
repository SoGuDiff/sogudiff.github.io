# SoGuDiff — Project Website

Source for <https://sogudiff.github.io/>, the project page for *SoGuDiff:
Socially Guided Diffusion for Steerable, Norm-Grounded Robot Navigation*.

Code for the method itself lives at
<https://github.com/schaiblc/SoGuDiff>.

Static site: plain HTML, CSS and vanilla JS. No build step, no npm, nothing to
install.

---

## Running it locally

```bash
git clone git@github.com:SoGuDiff/sogudiff.github.io.git
cd sogudiff.github.io
python3 -m http.server 8000
```

Open <http://localhost:8000>. Opening `index.html` over `file://` mostly works,
but the clipboard copy needs a secure context and the method figure cannot be
fetched for inlining, so the local server is preferred.

---

## Layout of the page

1. **Hero** — title, authors, links
2. **Teaser** — the layered interactive Fig. 1
3. **Abstract**
4. **How It Works** — an animated ten-step walkthrough of the architecture
5. **The Style Vector** — four cards explaining the axes and what ±1 mean
6. **Neutral Style and Baseline Comparisons** — 11 methods × 5 scenes, synced,
   with per-panel outcomes. It sits here because it shows the planner with
   every axis at its default, which is the reference the styled behaviour
   below is measured against.
7. **Steering One Axis at a Time** — tabbed explorer; per axis the −1 / 0 / +1
   clips play in step under shared play / restart / scrub controls
8. **Composing Axes at Inference** — the four composed-style runs, also synced
9. **Real-World Deployment** — unstructured neutral runs, the four axes tabbed
   with both ends synced, a 2×2 composed matrix, and a live style switch
10. **BibTeX** and footer

The page deliberately does **not** reproduce the paper's tables or results
plots. It carries the video evidence that did not fit in the page limit, and
the captions describe what each clip does rather than restating numbers the
paper already reports.

---

## Files

```
index.html                    the whole page
robots.txt                    crawl rules (this is a domain root, so they apply)
sitemap.xml                   one entry, pointed at from robots.txt
static/css/index.css          template base styles, trimmed
static/css/sogudiff.css       everything specific to this project
static/css/bulma.min.css      CSS framework
static/js/index.js            BibTeX copy + scroll-to-top
static/js/sogudiff.js         axis tabs, synchronized playback, walkthrough, teaser
static/images/favicon.svg     source for the favicon
static/images/favicon.ico     generated: rsvg-convert + ImageMagick
static/images/social_preview.svg   source for the link-preview card
static/images/social_preview.png   generated: rsvg-convert -w 1200 -h 630
static/videos/                simulated clips
static/videos/real/           hardware clips
static/videos/*/posters/      poster frames
```

`bulma-carousel` and `bulma-slider` are not used and have been removed; the
page uses CSS grid. Every icon is inline SVG and **no icon library is loaded** —
the GitHub and YouTube marks are [Simple Icons](https://simpleicons.org/) (CC0),
the arXiv mark is [Academicons](https://jpswalsh.github.io/academicons/)
(SIL OFL 1.1). To add an icon, paste its SVG path at the use site.

Regenerate the favicons after editing `favicon.svg`:

```bash
cd static/images
convert -background none favicon.svg -define icon:auto-resize=64,48,32,16 favicon.ico
convert -background "#1b2a4a" favicon.svg -flatten -resize 180x180 apple-touch-icon.png
```

---

## The animated walkthrough

"How It Works" shows `static/images/method_overview.svg`, the manuscript's own
vector export. On load the page fetches that file and swaps the `<img>` for the
same SVG inlined, which makes each shape addressable; a step then lights its
own shapes and dims the rest. Selecting shapes rather than rectangular regions
means a box, an arrow or a label is always wholly lit or wholly dim, never
clipped part-way. If the SVG cannot be fetched, the figure stays a plain `<img>`
and reads as a normal static diagram.

Steps are defined by the `STEPS` array in `static/js/sogudiff.js`:

```js
{ phase: 'a', at: [9, [41, 42], 68, 71], title: '...', body: '...' }
```

- `phase` is `'a'` (training) or `'b'` (deployment), and only drives the
  Training/Deployment pill.
- `at` lists shapes by position among the figure's top-level elements;
  `[a, b]` is an inclusive range. Index 0 is the white page backing and is
  never dimmed.
- `DWELL` sets the milliseconds per step.

### One addition to the figure

`method_overview.svg` carries a single added element, `#dg-input-riser`, at the
end of the file. The export draws each of the three return paths as one element
covering both the loop's bottom horizontal *and* the rise into its net, so the
vertical could not be lit without dragging the horizontal along with it. The
added element is that vertical alone. It lies exactly under the existing paths,
so it is invisible as drawn, and exists only so that step 7 can light the input
rising into the nets while step 9 keeps the loop.

**Re-add it after any re-export of the figure**, or drop it from step 7.
Re-exporting can also change element order, so the `at` indices need
re-checking when that happens.

---

## Videos

### Encoding

```bash
ffmpeg -i input.mp4 -c:v libx264 -profile:v main -pix_fmt yuv420p \
       -crf 26 -preset slow -movflags +faststart -an output.mp4
```

- `-movflags +faststart` matters: without it a browser downloads the whole file
  before showing a frame.
- `-an` strips audio. Every clip here is silent and muted on the page.
- Keep clips under ~5 MB. GitHub warns over 50 MB and refuses over 100 MB.

Poster frames, so a still shows before a clip loads:

```bash
ffmpeg -i static/videos/NAME.mp4 -vf "select=eq(n\,10)" -vframes 1 -q:v 4 \
       static/videos/posters/NAME.jpg
```

Then add `poster="static/videos/posters/NAME.jpg"` to that `<video>`.

### Real-world clips

Fifteen clips from the Jackal deployment in `static/videos/real/`, all
1280×720, re-encoded from 1080p30 at CRF 25 with audio stripped (~23 MB for the
set).

| Files | Shown as |
| --- | --- |
| `neutral1`, `neutral2` | Two unstructured runs, three pedestrians, neutral style |
| `prox_pos/neg`, `pass_pos/neg`, `yield_pos/neg`, `group_pos/neg` | Tabbed per axis, the two ends side by side and synced |
| `comp_pp`, `comp_pm`, `comp_mp`, `comp_mm` | A 2×2 matrix of proxemic against passing side, all four synced |
| `liveswitch` | The style vector rewritten mid-episode |

They are `preload="none"` and fetched only when their tab or block is first
scrolled to; loading fifteen clips up front would dwarf the rest of the page.
Posters are WebP stills taken a third of the way in, so a panel shows the
interaction rather than an empty room.

The real-world tabs use `.rw-tab` / `.rw-panel` rather than the simulated
explorer's `.axis-tab` / `.axis-panel`: that explorer queries its classes across
the whole document and would otherwise drive both blocks at once.

### Baseline comparison

`static/videos/compare/<method>_scene<N>.mp4` — 11 methods × 5 scenes. These are
scenes **215, 231, 235, 252, 262** of the randomized evaluation set behind the
paper's baseline table (the renderer labels episodes 1-indexed, so they display
as 216/232/236/253/263).

Per-panel outcomes are stored in the `OUTCOMES` table in the comparison block of
`static/js/sogudiff.js`. Re-rendering the clips means updating that table.

### Composition style vectors

The `[x, x, x, x]` vectors shown on the composition cards were read off each
clip's own title bar, so they match the runs exactly. Re-check them if those
videos are re-rendered.

### Synchronized playback

The triptychs, the composition grid and the real-world pairs each form a sync
group. Clips in a group share one wall-clock timeline: a clip that finishes
early **holds on its last frame** until every clip in the group has finished,
and only then do they all restart together. A per-clip `loop` attribute would
break that alignment, so synced clips deliberately do not carry one.

### Axis colors

Each axis is drawn in the clips with a matplotlib sequential colormap that
darkens from +1 to −1: **prox = Purples, pass = Blues, yield = Greens,
group = Oranges**. The style chips and explorer tabs in `sogudiff.css` use the
exact shades sampled from the robot marker in the clips, so page and video
agree. Re-rendering with a different colormap means updating the `--prox-*` /
`--pass-*` / `--yield-*` / `--group-*` variables at the top of that file.

---

## The teaser

Five renders sharing one camera and one pixel size, stacked in `static/images/`:

| File | Contents |
| --- | --- |
| `teaser_base.webp` | The scene: room, floor, three pedestrians, motion arrows, goal flag, robot. No trajectories. |
| `teaser_neutral.webp` | Neutral's three curves — dashed samples, selected, projected — transparent background. |
| `teaser_cautious.webp` | Cautious & Yielding. |
| `teaser_assertive.webp` | Assertive & Group-Agnostic. |
| `teaser_nonyield.webp` | Non-Yielding & Right-Side Passing. |
| `teaser_robot.webp` | The robot alone, transparent, so it sits above the trajectories and paths appear to leave from behind it. |

With JavaScript the styles cycle one at a time and can be picked from the
legend; without it every layer stays visible, which is the figure as printed.

---

## Deployment

GitHub Pages serves this repo at the organization root, because the repo is
named `sogudiff.github.io`. Settings → Pages → *Deploy from a branch*,
`master`, `/ (root)`. `.nojekyll` is what stops Jekyll from discarding
`static/`.

Because the site is at a domain root, `robots.txt` is read by crawlers and
`sitemap.xml` is discovered through it — neither would be true from a
`github.io/<repo>/` project page.

---

## Updating the page as the paper progresses

The page is built to pass through three states without restructuring: pending,
preprint, and published. The hero carries **two** paper buttons for exactly
this reason — **Paper** is the venue's official version, **arXiv** is the
preprint — so once both exist they coexist rather than one replacing the other.

Everything below is in `index.html` unless noted. Find the current state with:

```bash
grep -n "is-pending\|venue-badge\|citation_\|datePublished" index.html
```

### Now: no arXiv entry yet

Four things are deliberately left undone, because each would otherwise point at
something that does not exist:

- The **Paper** and **arXiv** buttons carry `is-pending` and `aria-disabled`,
  with a note beneath them
- `<meta name="citation_pdf_url">` is absent — Google Scholar requires it to
  resolve to a real PDF, and a 404 there is worse than omitting it
- `datePublished` and `publisher` are absent from the JSON-LD
- BibTeX is a plain `@misc` pointing at this site

### Stage 1 — the preprint goes up

1. **arXiv button** — real `href`, drop `is-pending`, `aria-disabled` and
   `tabindex="-1"`, add `target="_blank" rel="noopener"`
2. Delete the "The paper links go live when the preprint is posted" note. Leave
   the Paper button pending; it is the venue version, which does not exist yet
3. Add `<meta name="citation_pdf_url" content="https://arxiv.org/pdf/XXXXX">`
4. JSON-LD: add `"datePublished"` (the arXiv submission date) and
   `"publisher": { "@type": "Organization", "name": "arXiv" }`
5. BibTeX: keep `@misc`, add `eprint`, `archivePrefix = {arXiv}` and
   `primaryClass = {cs.RO}`
6. Venue badge stays **Preprint · 2026**

### Stage 2 — accepted at a venue

1. **Paper button** — point at the official version and drop `is-pending`
2. Venue badge → the venue and year, e.g. `IROS 2026`
3. Add `<meta name="citation_conference_title">` (or `citation_journal_title`
   for a journal), and point `citation_pdf_url` at whichever version should be
   indexed — usually the venue's
4. JSON-LD: `publisher` becomes the venue, `datePublished` the publication date
5. BibTeX: `@misc` → `@inproceedings` (or `@article`) with `booktitle`,
   `pages` and `publisher`; keep the `eprint` field so the preprint stays
   findable
6. `sitemap.xml`: bump `<lastmod>`

---

## Credits

Built on the [Academic Project Page Template](https://github.com/eliahuhorwitz/Academic-project-page-template),
adopted from [Nerfies](https://nerfies.github.io/). Website content licensed
[CC BY-SA 4.0](http://creativecommons.org/licenses/by-sa/4.0/).
