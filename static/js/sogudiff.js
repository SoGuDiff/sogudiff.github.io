/* ==========================================================================
   SoGuDiff project page behaviour.
   Independent pieces, each safe to delete on its own:
     - synchronized playback groups (shared play/pause/scrub over a set of clips)
     - the axis explorers, simulated and real-world
     - the method walkthrough, the teaser, and the baseline comparison
   ========================================================================== */
(function () {
  'use strict';

  /* ----------------------------------------------------------------------
     Synchronized playback groups
     Every [data-sync-group] contains videos that should play as one. The
     group's controls live in [data-sync-controls] with a matching name.
     ---------------------------------------------------------------------- */
  function videosIn(group) {
    return Array.prototype.slice.call(group.querySelectorAll('video'));
  }

  function setupSyncGroup(group) {
    var name = group.dataset.syncGroup;
    var controls = document.querySelector('[data-sync-controls="' + name + '"]');
    var videos = videosIn(group);
    if (!videos.length) return;

    var playBtn = controls && controls.querySelector('[data-sync-play]');
    var restartBtn = controls && controls.querySelector('[data-sync-restart]');
    var scrub = controls && controls.querySelector('[data-sync-scrub]');

    // The clips differ in length. They share one wall-clock timeline: a clip
    // that finishes early holds on its last frame until every clip has
    // finished, and only then do they all restart together. Looping each clip
    // on its own would silently break the alignment the comparison depends on.
    function groupDuration() {
      return videos.reduce(function (max, v) {
        return isFinite(v.duration) && v.duration > max ? v.duration : max;
      }, 0);
    }

    function allEnded() {
      return videos.every(function (v) { return v.ended; });
    }

    function rewindAll() {
      videos.forEach(function (v) { v.currentTime = 0; });
    }

    function playAll() {
      // Seeking clears the ended flag, so rewind before replaying a finished set.
      if (allEnded()) rewindAll();
      videos.forEach(function (v) {
        if (!v.ended) v.play().catch(function () { /* autoplay policy */ });
      });
    }

    function pauseAll() {
      videos.forEach(function (v) { v.pause(); });
    }

    function setPlayIcon(playing) {
      if (!playBtn) return;
      // Font Awesome's JS build replaces <i> with <svg>, so the button carries
      // its own inline icons and we toggle a class rather than an <i>'s class.
      playBtn.classList.toggle('is-playing', playing);
      var text = playBtn.querySelector('span');
      if (text) text.textContent = playing ? 'Pause' : 'Play all';
    }

    // When the last clip finishes, restart the whole group in step.
    videos.forEach(function (v) {
      v.addEventListener('ended', function () {
        if (allEnded()) { rewindAll(); playAll(); }
      });
    });

    if (playBtn) {
      playBtn.addEventListener('click', function () {
        var playing = videos.some(function (v) { return !v.paused && !v.ended; });
        if (playing) { pauseAll(); setPlayIcon(false); }
        else { playAll(); setPlayIcon(true); }
      });
    }

    if (restartBtn) {
      restartBtn.addEventListener('click', function () {
        rewindAll();
        playAll();
        setPlayIcon(true);
      });
    }

    if (scrub) {
      // Scrubbing moves the shared timeline, not each clip's own fraction, so
      // a short clip parks on its final frame instead of racing ahead.
      scrub.addEventListener('input', function () {
        var total = groupDuration();
        if (!total) return;
        var t = (Number(scrub.value) / 1000) * total;
        pauseAll();
        setPlayIcon(false);
        videos.forEach(function (v) {
          if (!isFinite(v.duration) || v.duration <= 0) return;
          // Nudge just inside the end so the frame renders rather than firing 'ended'.
          v.currentTime = Math.min(t, Math.max(0, v.duration - 0.02));
        });
      });

      // Drive the readout from whichever clip is longest, so the bar keeps
      // advancing after the shorter ones have parked.
      videos.forEach(function (v) {
        v.addEventListener('timeupdate', function () {
          var total = groupDuration();
          if (!total || !isFinite(v.duration) || v.duration < total) return;
          scrub.value = String(Math.round((v.currentTime / total) * 1000));
        });
      });
    }

    group._syncPlay = playAll;
    group._syncPause = pauseAll;
    group._syncReset = setPlayIcon;
  }

  document.querySelectorAll('[data-sync-group]').forEach(setupSyncGroup);

  /* ----------------------------------------------------------------------
     Axis explorer tabs
     ---------------------------------------------------------------------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.axis-tab'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.axis-panel'));

  function selectAxis(axis, focusTab) {
    tabs.forEach(function (t) {
      var on = t.dataset.axis === axis;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on && focusTab) t.focus();
    });
    panels.forEach(function (p) {
      var on = p.dataset.axis === axis;
      p.hidden = !on;
      var group = p.querySelector('[data-sync-group]');
      if (!group) return;
      if (on) {
        // Autoplay the newly revealed panel; muted+inline so policies allow it.
        if (group._syncPlay) { group._syncPlay(); if (group._syncReset) group._syncReset(true); }
      } else if (group._syncPause) {
        group._syncPause();
        if (group._syncReset) group._syncReset(false);
      }
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () { selectAxis(tab.dataset.axis, false); });
    tab.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(tab);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var next = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
        selectAxis(tabs[next].dataset.axis, true);
      }
    });
  });

  // Only start the explorer once it is actually on screen, so the clips are
  // not fetched and decoded while the visitor is still reading the abstract.
  var explorer = document.getElementById('style-explorer');
  if (explorer && 'IntersectionObserver' in window) {
    var started = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || started) return;
        started = true;
        var active = document.querySelector('.axis-tab[aria-selected="true"]');
        if (active) selectAxis(active.dataset.axis, false);
        io.disconnect();
      });
    }, { threshold: 0.25 });
    io.observe(explorer);
  }

  /* ----------------------------------------------------------------------
     Layered teaser
     The trajectory layers are in the markup and visible by default, so with
     no script the teaser is the paper's figure exactly as printed. Taking
     control means dimming them and bringing one back at a time.
     ---------------------------------------------------------------------- */
  (function () {
    var stage = document.getElementById('teaser-stage');
    var legend = document.getElementById('teaser-legend');
    if (!stage || !legend) return;

    var layers = Array.prototype.slice.call(stage.querySelectorAll('.teaser-layer'));
    var buttons = Array.prototype.slice.call(legend.querySelectorAll('.tl-btn[data-style]'));
    var cycleBtn = legend.querySelector('[data-cycle]');
    if (!layers.length || !buttons.length) return;

    var ORDER = ['neutral', 'cautious', 'assertive', 'nonyield', 'all'];
    var DWELL = 2600;
    var idx = 0, timer = null;

    function apply(name) {
      layers.forEach(function (el) {
        el.classList.toggle('is-on', name === 'all' || el.dataset.style === name);
      });
      buttons.forEach(function (b) {
        b.classList.toggle('is-on', b.dataset.style === name);
      });
    }

    function setCycleUI() {
      if (!cycleBtn) return;
      cycleBtn.classList.toggle('is-playing', !!timer);
      var label = cycleBtn.querySelector('span');
      if (label) label.textContent = timer ? 'Pause' : 'Cycle';
    }

    function play() {
      if (timer) return;
      timer = setInterval(function () {
        idx = (idx + 1) % ORDER.length;
        apply(ORDER[idx]);
      }, DWELL);
      setCycleUI();
    }

    function pause() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
      setCycleUI();
    }

    // Picking a style stops the cycle; the Cycle button starts it again.
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        pause();
        idx = ORDER.indexOf(b.dataset.style);
        apply(b.dataset.style);
      });
    });

    if (cycleBtn) {
      cycleBtn.addEventListener('click', function () { timer ? pause() : play(); });
    }

    stage.classList.add('is-interactive');   // hands the layers over to CSS
    legend.hidden = false;
    apply(ORDER[0]);
    setCycleUI();

    // Run only while on screen. Whether it was cycling is remembered, so
    // scrolling away and back does not restart a cycle the reader stopped.
    if ('IntersectionObserver' in window) {
      var wasPlaying = true;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { if (wasPlaying) play(); }
          else { wasPlaying = !!timer; pause(); }
        });
      }, { threshold: 0.25 });
      io.observe(stage);
    } else {
      play();
    }
  })();

  /* ----------------------------------------------------------------------
     Animated method walkthrough
     The figure itself is the manuscript's vector export, untouched. This
     drives an overlay: a scrim with holes cut over the region each step is
     about. Regions are in the figure's own coordinate space (2362 x 573.16).
     ---------------------------------------------------------------------- */
  (function () {
    var root = document.getElementById('method-diagram');
    if (!root) return;

    var figure = document.getElementById('dg-figure');
    var capTitle = root.querySelector('.dg-cap-title');
    var capBody = root.querySelector('.dg-cap-body');
    var dotWrap = root.querySelector('.dg-dots');
    var prevBtn = root.querySelector('[data-dg="prev"]');
    var nextBtn = root.querySelector('[data-dg="next"]');
    var playBtn = root.querySelector('[data-dg="play"]');
    if (!figure || !playBtn) return;

    // `at` lists the shapes each step lights up, by their position among the
    // figure's top-level elements. Selecting whole shapes rather than
    // rectangular areas means a box, an arrow or a label is always either
    // wholly lit or wholly dim - it can never be clipped part way through.
    // Ranges are written [first, last]. Use tools/region-picker.html to edit.
    // Element 191 is #dg-input-riser, added to the figure for this walkthrough:
    // see the note in method_overview.svg.
    var STEPS = [
      { phase: 'a', at: [9, [41, 42], [44, 45], [47, 48], [50, 51], [53, 55], 60],
        title: 'Conditioning inputs',
        body: 'The robot state, goal pose, neighboring pedestrian states, and a local ' +
              'occupancy map together define the scene context. The four-dimensional ' +
              'social style vector is supplied through the same conditioning interface, ' +
              'so the desired conduct is specified at deployment rather than fixed ' +
              'during training.' },
      { phase: 'a', at: [[10, 12], [19, 22], [61, 66], [181, 182]],
        title: 'Dedicated encoders for map and style',
        body: 'A convolutional encoder compresses the occupancy map into tokens, and ' +
              'each style axis is embedded as a token of its own. Both paths are subject ' +
              'to structured conditioning dropout during training, so the model remains ' +
              'well-defined when either group is replaced by its learned null embedding.' },
      { phase: 'a', at: [[15, 18], 26, [56, 58], [67, 75], [155, 160]],
        title: 'Joint encoding of scene and style',
        body: 'Scene and style tokens are concatenated and processed by a self-attention ' +
              'encoder, allowing the two to interact before they condition the denoiser. ' +
              'The requested style is therefore interpreted in the context of the ' +
              'observed geometry rather than applied independently of it.' },
      { phase: 'a', at: [[13, 14], 25, 27, [29, 36], [77, 79], [149, 154]],
        title: 'Conditional trajectory denoising',
        body: 'A one-dimensional conditional U-Net denoises a corrupted trajectory while ' +
              'cross-attending to the encoded tokens, with the diffusion timestep ' +
              'entering as an embedding that modulates the residual block features. The ' +
              'output is a full trajectory over the planning horizon.' },
      { phase: 'a', at: [[6, 8], [38, 39], [88, 93]],
        title: 'Training objective',
        body: 'The network is trained to predict the noise introduced by the forward ' +
              'process, under a mean squared error loss. Each demonstration carries a ' +
              'label on exactly one style axis, so composed styles are never observed ' +
              'during training.' },
      { phase: 'b', at: [167, 169, 171, 173, 180],
        title: 'Decomposed conditioning at inference',
        body: 'The trained network is queried under several conditioning subsets: ' +
              'unconditional, scene-only, and scene combined with a single style axis at ' +
              'a time. The structured dropout applied during training is what makes ' +
              'these partial queries well-posed.' },
      { phase: 'b', at: [4, [80, 81], [83, 86], [98, 100], [120, 121], [125, 127], [162, 164], [175, 178], [185, 188], 191],
        title: 'Parallel evaluation of the variants',
        body: 'All conditioning variants, across the N candidate trajectories, are ' +
              'evaluated in a single batched forward pass. Guidance therefore introduces ' +
              'no additional sequential denoising steps.' },
      { phase: 'b', at: [[101, 106], [110, 112], [114, 117], [122, 124], [165, 166], 189],
        title: 'Per-axis classifier-free guidance',
        body: 'Each style axis contributes a score difference taken relative to the ' +
              'scene-conditional estimate and scaled by its own guidance weight. Because ' +
              'the contributions are summed independently, the axes can be weighted ' +
              'separately and composed into styles never demonstrated jointly.' },
      { phase: 'b', at: [[2, 4], [107, 109], [114, 120], 184],
        title: 'Iterated denoising',
        body: 'The guided noise estimate drives one reverse diffusion step, and the ' +
              'procedure repeats across the sampling schedule, propagating all N ' +
              'candidate trajectories simultaneously.' },
      { phase: 'b', at: [[128, 131], [133, 147]],
        title: 'Selection and feasibility projection',
        body: 'A goal-directed cost selects the lowest-cost candidate. A ' +
              'soft-constrained optimal control problem then refines it into a ' +
              'trajectory that satisfies the robot\u2019s kinematic limits and obstacle ' +
              'clearances, and the commanded control actions are taken from that ' +
              'projected trajectory. If the acceptance criteria are not met, a ' +
              'controlled stop is commanded instead. Social behavior remains learned, ' +
              'while feasibility is enforced separately.' }
    ];

    var phases = Array.prototype.slice.call(root.querySelectorAll('.dg-phase'));
    var SVGNS = 'http://www.w3.org/2000/svg';
    var current = 0, timer = null, playing = false;
    var DWELL = 5600;

    var dots = STEPS.map(function (step, i) {
      var d = document.createElement('button');
      d.className = 'dg-dot';
      d.type = 'button';
      d.setAttribute('aria-label', 'Step ' + (i + 1) + ': ' + step.title);
      d.addEventListener('click', function () { stop(); show(i); });
      dotWrap.appendChild(d);
      return d;
    });

    // Expand [a, b] pairs into the individual indices they stand for.
    function expand(list) {
      var out = [];
      list.forEach(function (v) {
        if (typeof v === 'number') { out.push(v); return; }
        for (var n = v[0]; n <= v[1]; n++) out.push(n);
      });
      return out;
    }

    var els = null;   // index -> element, filled in once the SVG is inlined

    // Swap the <img> for the same SVG inlined, so its shapes become
    // addressable. Falls back to leaving the <img> in place.
    function inlineFigure(done) {
      var img = figure.querySelector('img');
      if (!img) { done(false); return; }
      fetch(img.getAttribute('src'))
        .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
        .then(function (text) {
          var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
          var svg = doc.documentElement;
          if (!svg || svg.nodeName.toLowerCase() !== 'svg') { done(false); return; }
          // Lucidchart exports carry width/height but no viewBox. As an <img>
          // that is fine, but inline it leaves the SVG with no mapping from
          // user units to the box it is given, so it draws at raw size and
          // overflows. Synthesize the viewBox before dropping the dimensions.
          if (!svg.getAttribute('viewBox')) {
            var w = parseFloat(svg.getAttribute('width'));
            var h = parseFloat(svg.getAttribute('height'));
            if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) { done(false); return; }
            svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
          }
          svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          svg.setAttribute('class', 'dg-base');
          svg.removeAttribute('width');
          svg.removeAttribute('height');
          if (img.alt) svg.setAttribute('aria-label', img.alt);
          svg.setAttribute('role', 'img');
          figure.replaceChild(document.importNode(svg, true), img);

          var root2 = figure.querySelector('svg > g');
          if (!root2) { done(false); return; }
          els = {};
          Array.prototype.forEach.call(root2.children, function (el, i) {
            // Index 0 is the white page backing; leave it alone so the figure
            // keeps a solid background when everything else is dimmed.
            if (i === 0 || el.nodeName.toLowerCase() === 'defs') return;
            el.setAttribute('data-e', i);
            el.classList.add('dg-el');
            els[i] = el;
          });
          done(true);
        })
        .catch(function () { done(false); });
    }

    function show(i) {
      current = (i + STEPS.length) % STEPS.length;
      var step = STEPS[current];

      if (els) {
        var on = {};
        expand(step.at).forEach(function (n) { on[n] = true; });
        Object.keys(els).forEach(function (n) {
          els[n].classList.toggle('is-on', !!on[n]);
        });
      }

      phases.forEach(function (ph) {
        ph.classList.toggle('is-current', ph.dataset.phase === step.phase);
      });
      dots.forEach(function (d, n) { d.classList.toggle('is-current', n === current); });

      capTitle.textContent = step.title;
      capBody.textContent = step.body;
    }

    // The icon is two inline SVGs toggled by a class. Font Awesome's JS build
    // rewrites <i> elements into <svg>, so anything that looked up the <i>
    // afterwards found nothing.
    function setPlayUI() {
      playBtn.classList.toggle('is-playing', playing);
      var label = playBtn.querySelector('span');
      if (label) label.textContent = playing ? 'Pause' : 'Play';
    }

    function start() {
      if (playing) return;
      playing = true;
      setPlayUI();
      timer = setInterval(function () { show(current + 1); }, DWELL);
    }

    function stop() {
      playing = false;
      setPlayUI();
      if (timer) { clearInterval(timer); timer = null; }
    }

    prevBtn.addEventListener('click', function () { stop(); show(current - 1); });
    nextBtn.addEventListener('click', function () { stop(); show(current + 1); });
    playBtn.addEventListener('click', function () { playing ? stop() : start(); });

    inlineFigure(function (ok) {
      if (!ok) { show(0); return; }   // static figure; captions still render
      root.classList.add('is-animated');
      show(0);
      start();
    });

    if ('IntersectionObserver' in window) {
      var seen = false;
      var mo = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            if (!seen) { seen = true; show(0); }
            start();
          } else {
            stop();
          }
        });
      }, { threshold: 0.3 });
      mo.observe(root);
    } else {
      start();
    }
  })();

  /* ----------------------------------------------------------------------
     Real-world axis tabs
     Deliberately separate from the simulated explorer above: that one queries
     .axis-tab / .axis-panel across the whole document, so reusing those class
     names here would make one set of tabs drive both blocks.

     The clips are preload="none" — fifteen 720p files is far too much to fetch
     on load — so a panel's videos are told to load the first time it is shown.
     ---------------------------------------------------------------------- */
  (function () {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.rw-tab'));
    var panels = Array.prototype.slice.call(document.querySelectorAll('.rw-panel'));
    if (!tabs.length || !panels.length) return;

    function show(axis, focus) {
      tabs.forEach(function (t) {
        var on = t.dataset.axis === axis;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
      panels.forEach(function (p) {
        var on = p.dataset.axis === axis;
        p.hidden = !on;
        var group = p.querySelector('[data-sync-group]');
        if (!group) return;
        if (on) {
          group.querySelectorAll('video').forEach(function (v) {
            if (v.preload === 'none') { v.preload = 'metadata'; v.load(); }
          });
          if (group._syncPlay) { group._syncPlay(); if (group._syncReset) group._syncReset(true); }
        } else if (group._syncPause) {
          group._syncPause();
          if (group._syncReset) group._syncReset(false);
        }
      });
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { show(tab.dataset.axis, false); });
      tab.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        var i = tabs.indexOf(tab);
        var next = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
        show(tabs[next].dataset.axis, true);
      });
    });

    // Nothing loads or plays until the block is actually on screen.
    var section = document.getElementById('real-world');
    if (section && 'IntersectionObserver' in window) {
      var started = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting || started) return;
          started = true;
          var active = document.querySelector('.rw-tab[aria-selected="true"]');
          if (active) show(active.dataset.axis, false);
          io.disconnect();
        });
      }, { threshold: 0.15 });
      io.observe(section);
    }

    // The composed matrix is not tabbed, so it gets its own trigger.
    var matrix = document.querySelector('[data-sync-group="rw-comp"]');
    if (matrix && 'IntersectionObserver' in window) {
      var mo = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            matrix.querySelectorAll('video').forEach(function (v) {
              if (v.preload === 'none') { v.preload = 'metadata'; v.load(); }
            });
            if (matrix._syncPlay) { matrix._syncPlay(); if (matrix._syncReset) matrix._syncReset(true); }
          } else if (matrix._syncPause) {
            matrix._syncPause();
            if (matrix._syncReset) matrix._syncReset(false);
          }
        });
      }, { threshold: 0.25 });
      mo.observe(matrix);
    }
  })();

  /* ----------------------------------------------------------------------
     Baseline comparison
     Eleven panels of one scene. Switching scene repoints every <video> at
     that scene's file, so the eleven stay together rather than drifting apart
     across scenes. Each panel is marked with its own outcome the moment its
     episode ends, which matters because the methods finish at very different
     times — in scene 1 five of them collide inside 1.5 s while others run past
     12 s, and without a marker a frozen panel just looks like a stalled video.
     ---------------------------------------------------------------------- */
  (function () {
    var root = document.getElementById('compare');
    if (!root) return;

    var OUTCOMES = {
          "sogudiff": {
                "1": "success",
                "2": "success",
                "3": "success",
                "4": "success",
                "5": "success"
          },
          "orca": {
                "1": "collision",
                "2": "success",
                "3": "success",
                "4": "success",
                "5": "success"
          },
          "sfm": {
                "1": "collision",
                "2": "collision",
                "3": "collision",
                "4": "collision",
                "5": "success"
          },
          "cadrl": {
                "1": "collision",
                "2": "success",
                "3": "success",
                "4": "success",
                "5": "success"
          },
          "lstm-rl": {
                "1": "collision",
                "2": "collision",
                "3": "success",
                "4": "success",
                "5": "success"
          },
          "sarl": {
                "1": "collision",
                "2": "success",
                "3": "success",
                "4": "success",
                "5": "success"
          },
          "rgl": {
                "1": "collision",
                "2": "success",
                "3": "success",
                "4": "success",
                "5": "success"
          },
          "dsrnn": {
                "1": "success",
                "2": "success",
                "3": "success",
                "4": "success",
                "5": "collision"
          },
          "navistar": {
                "1": "success",
                "2": "success",
                "3": "collision",
                "4": "collision",
                "5": "success"
          },
          "height": {
                "1": "success",
                "2": "success",
                "3": "success",
                "4": "success",
                "5": "success"
          },
          "sicnav": {
                "1": "collision",
                "2": "success",
                "3": "success",
                "4": "success",
                "5": "success"
          }
    };
    var LABEL = { success: 'Reached goal', collision: 'Collision', timeout: 'Timed out' };

    var panels = Array.prototype.slice.call(root.querySelectorAll('.cmp-panel'));
    var tabs = Array.prototype.slice.call(root.querySelectorAll('.cmp-scene'));
    var group = root.querySelector('[data-sync-group]');
    var scene = '1';

    function mark(panel, method) {
      var o = (OUTCOMES[method] || {})[scene];
      if (!o) return;
      var b = panel.querySelector('.cmp-badge');
      b.textContent = LABEL[o] || o;
      b.className = 'cmp-badge is-' + o + ' is-on';
    }

    panels.forEach(function (panel) {
      var v = panel.querySelector('video');
      var m = panel.dataset.method;
      // The clip ends exactly when the episode does, so 'ended' is the moment
      // the outcome is known — no separate timing data needed.
      v.addEventListener('ended', function () { mark(panel, m); });
    });

    function load(n) {
      scene = String(n);
      panels.forEach(function (panel) {
        var v = panel.querySelector('video');
        var m = panel.dataset.method;
        var b = panel.querySelector('.cmp-badge');
        b.className = 'cmp-badge';
        b.textContent = '';
        v.src = 'static/videos/compare/' + m + '_scene' + scene + '.mp4';
        v.load();
      });
      tabs.forEach(function (t) {
        t.setAttribute('aria-selected', t.dataset.scene === scene ? 'true' : 'false');
      });
    }

    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        load(t.dataset.scene);
        if (group && group._syncPlay) {
          group._syncPlay();
          if (group._syncReset) group._syncReset(true);
        }
      });
    });

    load(1);

    if ('IntersectionObserver' in window && group) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            if (group._syncPlay) { group._syncPlay(); if (group._syncReset) group._syncReset(true); }
          } else if (group._syncPause) {
            group._syncPause();
            if (group._syncReset) group._syncReset(false);
          }
        });
      }, { threshold: 0.2 });
      io.observe(root);
    }
  })();

  /* ----------------------------------------------------------------------
     Sync groups outside the tabbed explorer (the composition grid) start
     when scrolled into view and pause when scrolled away, so a page full of
     video stays cheap. The explorer has its own trigger above.
     ---------------------------------------------------------------------- */
  var looseGroups = Array.prototype.filter.call(
    document.querySelectorAll('[data-sync-group]'),
    function (g) { return !explorer || !explorer.contains(g); }
  );

  if (looseGroups.length && 'IntersectionObserver' in window) {
    var go = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var g = entry.target;
        if (entry.isIntersecting) {
          if (g._syncPlay) { g._syncPlay(); if (g._syncReset) g._syncReset(true); }
        } else if (g._syncPause) {
          g._syncPause();
          if (g._syncReset) g._syncReset(false);
        }
      });
    }, { threshold: 0.25 });
    looseGroups.forEach(function (g) { go.observe(g); });
  }
})();
