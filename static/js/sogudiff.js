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

    var holes = root.querySelector('#dg-holes');
    var capTitle = root.querySelector('.dg-cap-title');
    var capBody = root.querySelector('.dg-cap-body');
    var dotWrap = root.querySelector('.dg-dots');
    var prevBtn = root.querySelector('[data-dg="prev"]');
    var nextBtn = root.querySelector('[data-dg="next"]');
    var playBtn = root.querySelector('[data-dg="play"]');
    if (!holes || !playBtn) return;

    // [x, y, width, height] in the figure's coordinate space (2362 x 573.16).
    var STEPS = [
      { phase: 'a', at: [[10, 12, 176, 540]],
        title: 'Conditioning inputs',
        body: 'The robot state, goal pose, neighboring pedestrian states, and a local ' +
              'occupancy map together define the scene context. The four-dimensional ' +
              'social style vector is supplied through the same conditioning interface, ' +
              'so the desired conduct is specified at deployment rather than fixed ' +
              'during training.' },
      { phase: 'a', at: [[190, 210, 172, 238]],
        title: 'Dedicated encoders for map and style',
        body: 'A convolutional encoder compresses the occupancy map into tokens, and ' +
              'each style axis is embedded as a token of its own. Both paths are subject ' +
              'to structured conditioning dropout during training, so the model remains ' +
              'well defined when either group is replaced by its learned null embedding.' },
      { phase: 'a', at: [[372, 28, 182, 362]],
        title: 'Joint encoding of scene and style',
        body: 'Scene and style tokens are concatenated and processed by a self-attention ' +
              'encoder, allowing the two to interact before they condition the denoiser. ' +
              'The requested style is therefore interpreted in the context of the ' +
              'observed geometry rather than applied independently of it.' },
      { phase: 'a', at: [[632, 128, 420, 234], [356, 386, 228, 158]],
        title: 'Conditional trajectory denoising',
        body: 'A one-dimensional conditional U-Net denoises a corrupted trajectory while ' +
              'cross-attending to the encoded tokens, with the diffusion timestep ' +
              'entering as an embedding that modulates the residual block features. The ' +
              'output is a full trajectory over the planning horizon.' },
      { phase: 'a', at: [[1040, 186, 152, 156]],
        title: 'Training objective',
        body: 'The network is trained to predict the noise introduced by the forward ' +
              'process, under a mean squared error loss. Each demonstration carries a ' +
              'label on exactly one style axis, so composed styles are never observed ' +
              'during training.' },
      { phase: 'b', at: [[1208, 28, 184, 516]],
        title: 'Decomposed conditioning at inference',
        body: 'The trained network is queried under several conditioning subsets: ' +
              'unconditional, scene-only, and scene combined with a single style axis at ' +
              'a time. The structured dropout applied during training is what makes ' +
              'these partial queries well posed.' },
      { phase: 'b', at: [[1378, 96, 354, 354]],
        title: 'Parallel evaluation of the variants',
        body: 'All conditioning variants, across the N candidate trajectories, are ' +
              'evaluated in a single batched forward pass. Guidance therefore introduces ' +
              'no additional sequential denoising steps.' },
      { phase: 'b', at: [[1735, 76, 415, 236]],
        title: 'Per-axis classifier-free guidance',
        body: 'Each style axis contributes a score difference taken relative to the ' +
              'scene-conditional estimate and scaled by its own guidance weight. Because ' +
              'the contributions are summed independently, the axes can be weighted ' +
              'separately and composed into styles never demonstrated jointly.' },
      { phase: 'b', at: [[1348, 426, 732, 84]],
        title: 'Iterated denoising',
        body: 'The guided noise estimate drives one reverse diffusion step, and the ' +
              'procedure repeats across the sampling schedule, using twenty DDIM steps at ' +
              'inference and propagating all N candidates simultaneously.' },
      { phase: 'b', at: [[1948, 202, 404, 344]],
        title: 'Selection and feasibility projection',
        body: 'A goal-directed cost selects the lowest-cost candidate, which is then ' +
              'projected onto the robot kinematic and clearance constraints by a ' +
              'soft-constrained optimal control problem, or a controlled stop is ' +
              'commanded if the acceptance criteria are not met. Social behavior remains ' +
              'learned, while feasibility is enforced separately.' }
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

    function rect(parent, r) {
      var el = document.createElementNS(SVGNS, 'rect');
      el.setAttribute('x', r[0]);
      el.setAttribute('y', r[1]);
      el.setAttribute('width', r[2]);
      el.setAttribute('height', r[3]);
      el.setAttribute('rx', 12);
      el.setAttribute('fill', '#000');
      parent.appendChild(el);
    }

    function show(i) {
      current = (i + STEPS.length) % STEPS.length;
      var step = STEPS[current];

      while (holes.firstChild) holes.removeChild(holes.firstChild);
      // Black in the mask means the scrim is cut away there, so the region
      // stays at full strength while the rest of the figure fades back.
      step.at.forEach(function (r) { rect(holes, r); });

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

    root.classList.add('is-animated');
    show(0);
    start();

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
