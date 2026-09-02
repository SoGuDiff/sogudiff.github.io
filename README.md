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

Four media slots are wired up but have no file yet. Each renders as a labelled
dashed placeholder naming the exact path to drop in — so the page is never
broken while you are still producing material. **Adding an asset is one step:
put the file at the named path.** No HTML edit needed.

### The teaser

The teaser is five renders sharing one camera and one pixel size, stacked on
top of each other in `static/images/`:

| File | Contents |
| --- | --- |
| `teaser_base.webp` | The scene: room, floor, the three pedestrians, their motion arrows, the goal flag, the robot. No trajectories, no legend. |
| `teaser_neutral.webp` | Neutral's three curves — dashed samples, selected, projected — transparent background. |
| `teaser_cautious.webp` | Cautious & Yielding. |
| `teaser_assertive.webp` | Assertive & Group-Agnostic. |
| `teaser_nonyield.webp` | Non-Yielding & Right-Side Passing. |
| `teaser_robot.webp` | The robot alone, transparent background, so it sits **above** the trajectories and the paths appear to leave from behind it. Currently derived from `teaser_base.webp` by keying out the floor colour; replace it with a proper render if you re-export. |

The four style layers are **visible by default**, so with JavaScript disabled
the teaser is the figure exactly as printed in the paper. Script adds
`.is-interactive` to the stage, which dims them and brings one back at a time,
cycling every `DWELL` milliseconds and ending on "All four". Hovering holds the
current style; clicking one in the legend stops the cycle for good.

Layer order is base, then the four trajectory layers, then the robot.

The legend is HTML, not pixels, so it stays sharp and is clickable. The four
styles sit in a 2x2 grid; each row carries that style's own line key — dashed
samples, solid selected, thick projected — and its four axis values written
out (`prox +1`, `pass 0`, and so on) rather than as a bare vector, since the
teaser is the first thing a reader meets and the notation has not been
introduced yet. A key row underneath names the three line weights, the goal
flag and the pedestrian motion arrows.

The figure is capped at 780px wide rather than filling the container: at 1.6:1
it otherwise pushes the abstract a long way down the page. The renders are
1600px wide, so that is still a little over 2x for sharpness. Colors and values
live in the teaser markup in `index.html`; `DWELL` is in the teaser block of
`static/js/sogudiff.js`.

To re-render: keep one camera and one pixel size across all six files, since
they are stacked directly. Replacing them needs no code changes.

They are **WebP**, not PNG. These are photographic 3D renders, which PNG stores
badly: the set was 711 KB as PNG and is 128 KB as WebP at quality 88, with the
alpha channel kept lossless so the trajectory layers still composite cleanly.
Convert with:

```bash
cwebp -q 88 -alpha_q 100 teaser_base.png -o static/images/teaser_base.webp
```

`social_preview.png` deliberately stays PNG — social-card crawlers do not all
read WebP.

### Videos (in `static/videos/`)

| Path | What it is | Priority |
| --- | --- | --- |
| `real_style_comparison.mp4` | One repeated hardware scene under two or three styles, ideally side by side | **Highest** — the core real-world claim |
| `real_onboard_detections.mp4` | Camera feed with YOLO boxes/tracks beside the planner's own view | High |
| `real_group_encounter.mp4` | A real co-moving pair at `s_group = -1` vs `+1` | High |
| `real_style_switch.mp4` | Style vector changed *during* one continuous run | Bonus, high impact |

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
2. **Teaser** — the layered interactive Fig. 1
3. **Abstract** — verbatim from the paper
4. **How It Works** — an animated ten-step walkthrough of the architecture
5. **The Style Vector** — four cards explaining the axes and what ±1 mean
6. **Neutral Style and Baseline Comparisons** — 11 methods × 5 scenes, synced,
   with per-panel outcomes. Sits here because it shows the planner with every
   axis at its default, which is the reference the styled behaviour below is
   measured against.
7. **Steering One Axis at a Time** — tabbed explorer; per axis, the −1 / 0 / +1
   clips play in step with shared play / restart / scrub controls
8. **Composing Axes at Inference** — the four composed-style runs, also synced
9. **Real-World Deployment** — four slots
10. **BibTeX** and footer

### The animated walkthrough

"How It Works" shows `static/images/method_overview.svg` — the manuscript's own
vector export, **unmodified**. On load the page fetches that file and swaps the
`<img>` for the same SVG inlined, which makes each shape in it addressable.
A step then simply lights its own shapes and dims the rest.

Ten steps, five on training and five on deployment, with autoplay on
scroll-into-view, pause on scroll-away, prev / play / next controls and
clickable step dots.

Selecting **shapes** rather than rectangular areas is the point: a box, an
arrow or a label is always either wholly lit or wholly dim, so nothing is ever
clipped halfway through — which rectangles could not avoid, since they have no
relationship to the artwork underneath them.

To edit it, everything lives in the `STEPS` array in `static/js/sogudiff.js`:

```js
{ phase: 'a', at: [9, [41, 42], 68, 71], title: '...', body: '...' }
```

- `phase` is `'a'` (training) or `'b'` (deployment); it only drives the
  Training/Deployment pill.
- `at` lists shapes by their position among the figure's top-level elements.
  `[a, b]` is an inclusive range. Index 0 is the white page backing and is
  never dimmed.
- `DWELL` sets the milliseconds per step.

#### Editing the steps

Change the `at` list for a step. Numbers are positions among the figure's
top-level elements, so to find the one you want, render the figure with each
element labelled:

```python
# from the repo root, with the SVG open in any text editor:
#   the Nth top-level child of the single <g> is element N (0 is the backing)
```

A drag-and-drop picker for this lived at `tools/region-picker.html` and was
removed when the repo was tidied for publication — it is in the git history if
the steps ever need reworking wholesale:

```bash
git log --diff-filter=D --name-only -- tools/region-picker.html
git checkout <commit>^ -- tools/region-picker.html
```

#### The one edit made to the figure

`method_overview.svg` carries a single added element, `#dg-input-riser`, at the
very end. The figure draws each of the three return paths as one element that
runs along the loop's bottom horizontal *and* then up into its net, so the
vertical could not be lit without dragging the horizontal along with it. The
added element is that vertical on its own. It lies exactly under the existing
paths, so it is invisible in the figure as drawn, and it exists only so step 7
can light the input rising into the nets while step 9 keeps the loop.
**Re-add it after re-exporting the figure**, or drop it from step 7.

If the figure is re-exported from Lucidchart, the element order can change, so
re-check the steps in the picker — the **Select nothing-assigned shapes**
button makes gaps obvious. If the SVG cannot be fetched at all (opening the
page over `file://`, for instance) the figure stays a plain `<img>` and reads
as a normal static diagram.

### The baseline comparison

`static/videos/compare/<method>_scene<N>.mp4` — 11 methods × 5 scenes, already
in place. These are scenes **215, 231, 235, 252, 262** of the randomized
evaluation set behind the paper's baseline table (the renderer labels episodes
1-indexed, so those display as 216/232/236/253/263).

They were produced by new, self-contained infrastructure in
`CrowdNav_DiffusionEnv/crowd_nav/`: `test_evaluateWEB5.py` plus
`test_evalWEB5_{BASELINES,SOGUDIFF,SICNAV}.slurm`. **`crowd_sim.py` is not
modified** — the caption, the legend and the attention overlay are overridden
from inside that script and only when `--cases` is passed, so every other job
in that repo behaves exactly as before.

Outcomes are baked into the `OUTCOMES` table in the comparison block of
`static/js/sogudiff.js`. Re-running the clips means updating that table; the
job logs print a `Test N: ... | <outcome> |` line per episode.

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
static/css/index.css          template base styles (trimmed, see below)
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

`bulma-carousel`, `bulma-slider` and their stylesheets have been deleted: the
page uses CSS grid, and nothing loaded them. `index.css` has also had the
template's rules for the removed "More Works" dropdown and carousel stripped.

### Icons

Every icon is inline SVG; **no icon library is loaded**. Font Awesome was
removed: it cost 1.3 MB of JavaScript for seven glyphs, the template shipped
its stylesheet without the `static/webfonts/` directory it references, and its
build rewrites `<i>` elements into `<svg>` at runtime — which silently broke
two scripts here before it was tracked down. Academicons went the same way,
since it came from a CDN ad blockers commonly refuse.

To add an icon, paste an SVG path. The GitHub and YouTube marks are Simple
Icons (CC0); the arXiv mark is Academicons (SIL OFL 1.1), inlined at its use
site with its viewBox cropped to the artwork so `height: 1em` matches the
others.

---

## Before going public

`index.html` contains **15 `RELEASE:` markers**, plus 6 occurrences of
`REPLACE_WITH_PROJECT_URL`. Grep for both:

```bash
grep -n "RELEASE:\|REPLACE_WITH_PROJECT_URL" index.html
```

Between them they gate everything that must change before the page is public:

1. `robots` meta — `noindex, nofollow` → `index, follow`
2. `author` meta — real names
3. `og:site_name` — institution or lab
4. `og:url` and `<link rel="canonical">` — the live URL (also in `og:image`,
   `twitter:image` and the JSON-LD `image`; search `REPLACE_WITH_PROJECT_URL`)
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

`tools/` is a development directory. Nothing on the site links to it, but once
Pages is enabled it would be reachable at `/tools/region-picker.html`. It gives
nothing away — it only shows the figure the page already publishes — so it can
stay. Delete the directory before publishing if you would rather it were not
served.

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
