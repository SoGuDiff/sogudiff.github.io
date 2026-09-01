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
    var rings = root.querySelector('#dg-rings');
    var capTitle = root.querySelector('.dg-cap-title');
    var capBody = root.querySelector('.dg-cap-body');
    var dotWrap = root.querySelector('.dg-dots');
    var prevBtn = root.querySelector('[data-dg="prev"]');
    var nextBtn = root.querySelector('[data-dg="next"]');
    var playBtn = root.querySelector('[data-dg="play"]');
    if (!holes || !rings || !playBtn) return;

    // [x, y, width, height] in the figure's coordinate space.
    var STEPS = [
      { phase: 'a', at: [[10, 12, 176, 540]],
        title: 'Everything the planner is told',
        body: 'The robot\u2019s own state, its goal, the people around it, and a local ' +
              'occupancy map describe the situation. The four-number social style ' +
              'vector arrives through the same door as the rest, which is what makes ' +
              'conduct something you set at deployment rather than something you retrain.' },
      { phase: 'a', at: [[190, 210, 172, 238]],
        title: 'Two inputs need their own encoder',
        body: 'The occupancy map is compressed into tokens by a small convolutional ' +
              'encoder, and each style axis becomes a token of its own. Both pass ' +
              'through conditioning dropout during training, so the network learns to ' +
              'cope when either is withheld \u2014 the property the whole guidance scheme ' +
              'later rests on.' },
      { phase: 'a', at: [[372, 28, 182, 362]],
        title: 'Scene and style are fused, not stacked',
        body: 'A self-attention encoder mixes the scene and style tokens before either ' +
              'reaches the denoiser. The requested manners are therefore interpreted in ' +
              'light of the actual geometry, rather than applied blindly on top of it.' },
      { phase: 'a', at: [[632, 128, 420, 234], [356, 386, 228, 158]],
        title: 'A U-Net denoises a whole trajectory',
        body: 'A one-dimensional conditional U-Net takes a noised trajectory and ' +
              'cross-attends to those tokens, with the diffusion timestep modulating ' +
              'its residual blocks. It produces a path, not a single next action.' },
      { phase: 'a', at: [[1040, 186, 152, 156]],
        title: 'The only thing it is trained to do',
        body: 'The network learns to predict the noise that was added, scored by mean ' +
              'squared error. Every demonstration carries a label on exactly one style ' +
              'axis \u2014 combinations are never trained for, which is what makes the ' +
              'right-hand panel interesting.' },
      { phase: 'b', at: [[1208, 28, 184, 516]],
        title: 'One network, asked several different questions',
        body: 'At deployment the same weights are queried under different conditioning: ' +
              'nothing at all, the scene alone, and the scene plus a single style axis ' +
              'at a time. Conditioning dropout is what makes those partial queries mean ' +
              'anything.' },
      { phase: 'b', at: [[1378, 96, 354, 354]],
        title: 'Asked in parallel, not in sequence',
        body: 'Every conditioning variant is evaluated in one batched forward pass, ' +
              'across all N candidate trajectories at once. Steering the style costs no ' +
              'extra denoising steps \u2014 only a wider batch.' },
      { phase: 'b', at: [[1735, 76, 415, 236]],
        title: 'Each axis contributes its own nudge',
        body: 'Every axis is measured as a difference against the scene-conditional ' +
              'estimate and scaled by its own weight. Because the terms are summed ' +
              'separately, the axes can be dialled independently and combined into ' +
              'styles the model was never shown together.' },
      { phase: 'b', at: [[1348, 426, 732, 84]],
        title: 'Repeat down the noise schedule',
        body: 'The combined estimate drives one denoising step and the loop runs again, ' +
              'twenty times at inference, carrying all N candidates along together.' },
      { phase: 'b', at: [[1948, 202, 404, 344]],
        title: 'Choose one, then make it executable',
        body: 'A goal-directed cost picks the best candidate, and an optimal-control ' +
              'layer projects it onto the robot\u2019s kinematics and clearance ' +
              'constraints \u2014 or commands a controlled stop when it cannot. Social ' +
              'behavior stays learned; feasibility stays enforced.' }
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

    function rect(parent, r, cls) {
      var el = document.createElementNS(SVGNS, 'rect');
      el.setAttribute('x', r[0]);
      el.setAttribute('y', r[1]);
      el.setAttribute('width', r[2]);
      el.setAttribute('height', r[3]);
      el.setAttribute('rx', 10);
      if (cls) el.setAttribute('class', cls);
      else el.setAttribute('fill', '#000');
      parent.appendChild(el);
    }

    function show(i) {
      current = (i + STEPS.length) % STEPS.length;
      var step = STEPS[current];

      while (holes.firstChild) holes.removeChild(holes.firstChild);
      while (rings.firstChild) rings.removeChild(rings.firstChild);
      step.at.forEach(function (r) {
        rect(holes, r);              // black in the mask = not dimmed
        rect(rings, r, 'dg-ring');
      });

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
    stop();

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
