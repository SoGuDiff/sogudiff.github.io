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

## Adding the videos that are still missing

Nine media slots are wired up but have no file yet. Each renders as a labelled
dashed placeholder naming the exact path to drop in — so the page is never
broken while you are still producing footage. **Adding a video is one step: put
the file at the named path.** No HTML edit needed.

| Path (in `static/videos/`) | What it is | Priority |
| --- | --- | --- |
| `teaser.mp4` | Top-of-page reel. Real-world footage, then the same scene under contrasting styles. | **Highest** — first thing anyone sees |
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

1. **Hero** — title, anonymous author block, inert Paper/arXiv/Code buttons
2. **Teaser** — slot for the headline video
3. **Abstract** — verbatim from the paper
4. **The Style Vector** — four cards explaining the axes and what ±1 mean
5. **Steering One Axis at a Time** — tabbed explorer; per axis, the −1 / 0 / +1
   clips play in step with shared play / restart / scrub controls
6. **Composing Axes at Inference** — the four composed-style runs
7. **Real-World Deployment** — four slots
8. **Beyond the Paper** — four slots for supplementary comparisons
9. **BibTeX** and footer

The page deliberately does **not** reproduce the paper's tables and figures.
It carries the video evidence that would not fit in the page limit; only a few
headline numbers appear, as captions to the clips they explain.

---

## Files

```
index.html                    the whole page
static/css/index.css          template base styles (unmodified)
static/css/sogudiff.css       everything specific to this project
static/css/bulma.min.css      CSS framework
static/js/index.js            BibTeX copy + scroll-to-top
static/js/sogudiff.js         asset slots, axis tabs, synchronized playback
static/images/favicon.svg     source for the favicon
static/images/favicon.ico     generated: rsvg-convert + ImageMagick
static/images/social_preview.png  1200x630 link-preview card
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

---

## Before going public

`index.html` contains **13 `RELEASE:` markers**, plus 5 occurrences of
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
7. The three link buttons — real URLs, and remove `is-pending` from each
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
