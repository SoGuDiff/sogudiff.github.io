/* ==========================================================================
   SoGuDiff project page behaviour.
   Three independent pieces, each safe to delete on its own:
     1. asset slots   — graceful placeholders for files not added yet
     2. axis explorer — tab switching with synchronized triptych playback
     3. sync groups   — shared play/pause/scrub over a set of clips
   ========================================================================== */
(function () {
  'use strict';

  /* ----------------------------------------------------------------------
     Draft mode: append ?draft to the URL to reveal the editorial notes
     marking everything still unfilled. Off by default so the page can be
     shared as-is.
     ---------------------------------------------------------------------- */
  if (/[?&]draft\b/.test(window.location.search)) {
    document.body.classList.add('is-draft');
    var banner = document.createElement('div');
    banner.className = 'draft-banner';
    banner.textContent =
      'Draft mode — editorial notes visible. Remove ?draft from the URL to preview the page as visitors see it.';
    document.body.insertBefore(banner, document.body.firstChild);
  }

  /* ----------------------------------------------------------------------
     1. Asset slots
     A <video data-slot="..."> or <img data-slot="..."> whose file is missing
     is replaced by a dashed placeholder naming the path to drop in. This
     keeps the page coherent while assets are still being produced.
     ---------------------------------------------------------------------- */
  function buildSlot(el) {
    var wrap = document.createElement('div');
    wrap.className = 'asset-slot' + (el.dataset.slotShape === 'square' ? ' is-square' : '');

    var icon = document.createElement('i');
    icon.className = 'slot-icon fas ' + (el.tagName === 'IMG' ? 'fa-image' : 'fa-film');
    icon.setAttribute('aria-hidden', 'true');

    var label = document.createElement('div');
    label.className = 'slot-label';
    label.textContent = el.dataset.slot || 'Asset pending';

    var path = document.createElement('code');
    path.className = 'slot-path';
    path.textContent = el.dataset.slotPath || (el.currentSrc || el.src || '');

    wrap.appendChild(icon);
    wrap.appendChild(label);
    if (path.textContent) wrap.appendChild(path);

    if (el.dataset.slotHint) {
      var hint = document.createElement('div');
      hint.className = 'slot-hint';
      hint.textContent = el.dataset.slotHint;
      wrap.appendChild(hint);
    }

    if (el.parentNode) el.parentNode.replaceChild(wrap, el);
  }

  document.querySelectorAll('[data-slot]').forEach(function (el) {
    if (el.tagName === 'IMG') {
      el.addEventListener('error', function () { buildSlot(el); });
      // Already failed before this script ran.
      if (el.complete && el.naturalWidth === 0) buildSlot(el);
      return;
    }
    // <video>: the error fires on the <source>, and readyState stays 0.
    var sources = el.querySelectorAll('source');
    if (!sources.length) { buildSlot(el); return; }
    sources[sources.length - 1].addEventListener('error', function () { buildSlot(el); });
    el.addEventListener('error', function () { buildSlot(el); });
  });

  /* ----------------------------------------------------------------------
     2 & 3. Synchronized playback groups
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
              'well defined when either group is replaced by its learned null embedding.' },
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
      { phase: 'b', at: [167, 169, 171, 173, 175, 180],
        title: 'Decomposed conditioning at inference',
        body: 'The trained network is queried under several conditioning subsets: ' +
              'unconditional, scene-only, and scene combined with a single style axis at ' +
              'a time. The structured dropout applied during training is what makes ' +
              'these partial queries well posed.' },
      { phase: 'b', at: [2, 4, [80, 81], [83, 86], [98, 100], 107, 118, [120, 121], [125, 127], [162, 164], [176, 178], [185, 188]],
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
