# SoGuDiff — Project Website

Project page for *SoGuDiff: Socially Guided Diffusion for Steerable,
Norm-Grounded Robot Navigation*.

Static site: plain HTML, CSS and vanilla JS. No build step, no npm, no
dependencies to install.

> **This repo is private and the page is configured for double-blind review.**
> There are no author names, no affiliations, no lab links, and the page asks
> search engines not to index it. See [Before going public](#before-going-public).

---

## Viewing it locally

```bash
git clone <repo-url>
cd project_website
python3 -m http.server 8000
```

Open <http://localhost:8000>.

Open `file://.../index.html` directly works too, but a couple of things behave
differently (clipboard copy needs a secure context), so the local server is
preferred.

### Draft mode

Append `?draft` to the URL — <http://localhost:8000/?draft> — to reveal the
editorial notes marking everything still unfilled, plus a banner. Without the
flag the page renders exactly as a visitor would see it. Nothing in draft mode
is visible to a normal viewer.

---

## Adding the assets that are still missing

Nine media slots are wired up but have no file yet. Each renders as a labelled
dashed placeholder naming the exact path to drop in — so the page is never
broken while you are still producing material. **Adding an asset is one step:
put the file at the named path.** No HTML edit needed.

### Figures, exported from the manuscript

| Path | Source in the paper | Where it appears |
| --- | --- | --- |
| `static/images/teaser_figure.png` | `Figures/MainFigureV3.png` | Top of the page, under the title |

Export at 2000px or wider, since it is shown full-bleed.

`static/images/method_overview.svg` is already in place — it is the supplied
Lucidchart export, shown as-is in the "How It Works" section.

### Videos (in `static/videos/`)

| Path | What it is | Priority |
| --- | --- | --- |
| `real_style_comparison.mp4` | One repeated hardware scene under two or three styles, ideally side by side | **Highest** — the core real-world claim |
| `real_onboard_detections.mp4` | Camera feed with YOLO boxes/tracks beside the planner's own view | High |
| `real_group_encounter.mp4` | A real co-moving pair at `s_group = -1` vs `+1` | High |
| `real_style_switch.mp4` | Style vector changed *during* one continuous run | Bonus, high impact |
| `baseline_comparison.mp4` | Neutral SoGuDiff beside SFM / ORCA / DSRNN / SICNav, identical scenes | Medium |
| `demonstration_generation.mp4` | The offline sampler's candidate fan colored by social cost | Medium |
| `guidance_weight_sweep.mp4` | One style, guidance weight over 1 / 3 / 10 | Medium |
| `projection_ablation.mp4` | With vs without the acados projection layer | Medium |

Full rationale for each is in the `data-slot-hint` attribute on the
corresponding element in `index.html`.

### Video encoding

Keep clips web-friendly, or the page gets slow:

```bash
ffmpeg -i input.mp4 -c:v libx264 -profile:v main -pix_fmt yuv420p \
       -crf 26 -preset slow -movflags +faststart -an output.mp4
```

- `-movflags +faststart` matters: without it the browser downloads the whole
  file before the first frame appears.
- `-an` strips audio. All clips here are silent; audio only adds bytes.
- Target under ~5 MB per clip. Anything over ~10 MB belongs on YouTube instead.
- GitHub refuses files over 100 MB and warns over 50 MB.

### Poster frames

Every existing clip has a poster in `static/videos/posters/` so a still shows
before the video loads. Regenerate for a new clip with:

```bash
ffmpeg -i static/videos/NAME.mp4 -vf "select=eq(n\,10)" -vframes 1 -q:v 4 \
       static/videos/posters/NAME.jpg
```

Then add `poster="static/videos/posters/NAME.jpg"` to that `<video>` tag.

---

## Layout of the page

1. **Hero** — title, anonymous author block, inert Paper/arXiv/Code/Video buttons
2. **Teaser figure** — the paper's Fig. 1
3. **Abstract** — verbatim from the paper
4. **How It Works** — an animated ten-step walkthrough of the architecture
5. **The Style Vector** — four cards explaining the axes and what ±1 mean
6. **Steering One Axis at a Time** — tabbed explorer; per axis, the −1 / 0 / +1
   clips play in step with shared play / restart / scrub controls
7. **Composing Axes at Inference** — the four composed-style runs, also synced
8. **Real-World Deployment** — four slots
9. **Beyond the Paper** — four slots for supplementary comparisons
10. **BibTeX** and footer

### The animated walkthrough

"How It Works" shows `static/images/method_overview.svg` — the manuscript's own
vector export, **unmodified**. The walkthrough is an overlay on top of it: a
white scrim with holes cut over the region the current step is about, plus a
ring around each hole. Ten steps, five on training and five on deployment, with
autoplay on scroll-into-view, pause on scroll-away, prev / play / next controls
and clickable step dots. There are no outlines drawn around the active region:
a rectangle never quite matches the artwork beneath it, so the emphasis is
carried entirely by what stays undimmed.

To edit it, everything lives in the `STEPS` array in `static/js/sogudiff.js`:

```js
{ phase: 'a', at: [[632, 128, 420, 234]], title: '...', body: '...' }
```

- `phase` is `'a'` (training) or `'b'` (deployment); it only drives the
  Training/Deployment pill.
- `at` is a list of `[x, y, width, height]` rectangles **in the figure's own
  coordinate space**, which is `2362 × 573.16`. A step may highlight several
  disjoint regions — step 4 highlights the U-Net and its two input labels.
- `DWELL` sets the milliseconds per step.

#### Editing the regions the easy way

Open **`tools/region-picker.html`** in a browser (through the local server, so
it can load the figure). It shows the figure with the current regions drawn on
it, and you can:

- drag empty space to add a rectangle, drag a rectangle to move it, drag its
  corner to resize
- nudge with the arrow keys, ×10 with <kbd>Shift</kbd>, remove with
  <kbd>Delete</kbd>
- type exact x / y / w / h for the selected rectangle
- hit **Preview as published** to see the real scrim effect before committing
- **Copy** the output and paste it over the `at:` lines in `STEPS`

It round-trips: paste the current `at:` lines back into the text box and press
**Re-load from text** to pull them onto the figure and adjust from there.

Because the regions are coordinates rather than references to elements inside
the figure, **re-exporting the figure means re-checking them.** Swapping the
`.svg` alone is safe only if the layout did not move — the picker is the
fastest way to redo them if it did.

With JavaScript disabled the scrim never switches on, so the figure just reads
as the normal static diagram.

### Synchronized playback

The triptychs and the composition grid each form a sync group. The clips in a
group share one wall-clock timeline: a clip that finishes early **holds on its
last frame** until every clip in the group has finished, and only then do they
all restart together. Individual `loop` attributes would break that alignment,
so synced clips deliberately do not carry one — the standalone slot videos in
the later sections still do, since they play independently.

### Axis colors

Each axis is drawn in the clips with a matplotlib sequential colormap that
darkens from +1 to −1: **prox = Purples, pass = Blues, yield = Greens,
group = Oranges**. The style chips and the explorer tabs in `sogudiff.css`
are set to the exact shades sampled from the robot marker in the clips, so
the page and the videos agree. If you re-render the videos with a different
colormap, update the `--prox-*` / `--pass-*` / `--yield-*` / `--group-*`
variables at the top of that file.

### Scope

Beyond the two figures above, the page deliberately does **not** reproduce the
paper's tables or results plots. It carries the video evidence that would not
fit in the page limit, and the captions describe what each clip does rather
than restating numbers the paper already reports.

---

## Files

```
index.html                    the whole page
tools/region-picker.html      drag-and-drop editor for the diagram regions
static/css/index.css          template base styles (one copy-button fix)
static/css/fontawesome.all.min.css  UNUSED - see "Icons" below
static/css/sogudiff.css       everything specific to this project
static/css/bulma.min.css      CSS framework
static/js/index.js            BibTeX copy + scroll-to-top
static/js/sogudiff.js         asset slots, axis tabs, synchronized playback
static/images/favicon.svg     source for the favicon
static/images/favicon.ico     generated: rsvg-convert + ImageMagick
static/images/social_preview.svg  source for the link-preview card
static/images/social_preview.png  generated: rsvg-convert -w 1200 -h 630
static/videos/                clips
static/videos/posters/        poster frames
```

Regenerate the icons after editing `favicon.svg`:

```bash
cd static/images
convert -background none favicon.svg -define icon:auto-resize=64,48,32,16 favicon.ico
convert -background "#1b2a4a" favicon.svg -flatten -resize 180x180 apple-touch-icon.png
```

`bulma-carousel` and `bulma-slider` are still vendored but unused — the page
uses CSS grid instead. Safe to delete if you never add a carousel.

### Icons

Icons come from `static/js/fontawesome.all.min.js`, which renders them as
inline `<svg>`. The matching **stylesheet is deliberately not loaded**: the
template shipped `fontawesome.all.min.css` without the `static/webfonts/`
directory it references, so every glyph 404s. Academicons was dropped for the
same class of reason — it came from a CDN that ad blockers commonly refuse, and
the arXiv button now uses a Font Awesome document glyph.

One consequence worth knowing: the JS build **replaces `<i>` elements with
`<svg>`**, so any script that sets a class on an `<i>` after page load finds
nothing there. Buttons whose icon toggles (play/pause) therefore carry both
icons inline and swap them with a CSS class instead.

Two things to watch when adding an icon:

- The vendored build is **Font Awesome Free 5.15.1**, so use FA5 names. Several
  were renamed in FA6 and an FA6 name renders as a "missing icon" glyph rather
  than failing loudly — `fa-file-alt` not `fa-file-lines`, `fa-undo` not
  `fa-rotate-left`. Check a name is present with
  `grep -o "\"NAME\"" static/js/fontawesome.all.min.js`.
- The JS build **replaces `<i>` with `<svg>`**, so any script that sets a class
  on an `<i>` after page load finds nothing there. Buttons whose icon toggles
  carry both icons inline and swap them with a CSS class instead.

---

## Before going public

`index.html` contains **14 `RELEASE:` markers**, plus 5 occurrences of
`REPLACE_WITH_PROJECT_URL`. Grep for both:

```bash
grep -n "RELEASE:\|REPLACE_WITH_PROJECT_URL" index.html
```

Between them they gate everything that must change before the page is public:

1. `robots` meta — `noindex, nofollow` → `index, follow`
2. `author` meta — real names
3. `og:site_name` — institution or lab
4. `og:url` / canonical — the live URL (also in `og:image`, `twitter:image`,
   and the JSON-LD `image`; search for `REPLACE_WITH_PROJECT_URL`)
5. Google Scholar `citation_*` tags — currently commented out. Uncomment and
   complete them; Scholar will skip a page with a partial author list, so fill
   every field or leave them commented.
6. Author block in the hero — replace "Anonymous Authors"
7. The four link buttons (Paper, arXiv, Code, Video) — real URLs, and remove
   `is-pending` from each
8. JSON-LD — author, `datePublished`, publisher
9. BibTeX — the real citation

Also consider re-adding the upstream template's "More Works" lab dropdown,
which was removed here because it would identify the authors.

### Publishing with GitHub Pages

**Do not enable Pages while the repo is private and the paper is unpublished.**
On GitHub Free and Pro, publishing a private repo through Pages makes the
*site* publicly reachable even though the source stays private. Access-controlled
Pages requires GitHub Enterprise Cloud.

When you are ready: Settings → Pages → Deploy from a branch → `master` / `/`
(root). `.nojekyll` is already present, which is what stops Jekyll from
discarding the `static/` directory.

---

## Credits

Built on the [Academic Project Page Template](https://github.com/eliahuhorwitz/Academic-project-page-template),
adopted from [Nerfies](https://nerfies.github.io/). Website content licensed
[CC BY-SA 4.0](http://creativecommons.org/licenses/by-sa/4.0/).
