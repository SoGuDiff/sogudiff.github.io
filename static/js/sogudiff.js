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
      var icon = playBtn.querySelector('i');
      var text = playBtn.querySelector('span');
      if (icon) icon.className = playing ? 'fas fa-pause' : 'fas fa-play';
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
