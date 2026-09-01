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

  function longest(videos) {
    return videos.reduce(function (best, v) {
      var d = isFinite(v.duration) ? v.duration : 0;
      return d > best ? d : best;
    }, 0);
  }

  function setupSyncGroup(group) {
    var name = group.dataset.syncGroup;
    var controls = document.querySelector('[data-sync-controls="' + name + '"]');
    var videos = videosIn(group);
    if (!videos.length) return;

    var playBtn = controls && controls.querySelector('[data-sync-play]');
    var restartBtn = controls && controls.querySelector('[data-sync-restart]');
    var scrub = controls && controls.querySelector('[data-sync-scrub]');
    var driver = videos[0];

    function playAll() {
      videos.forEach(function (v) { v.play().catch(function () { /* autoplay policy */ }); });
    }
    function pauseAll() { videos.forEach(function (v) { v.pause(); }); }

    function setPlayIcon(playing) {
      if (!playBtn) return;
      var icon = playBtn.querySelector('i');
      var text = playBtn.querySelector('span');
      if (icon) icon.className = playing ? 'fas fa-pause' : 'fas fa-play';
      if (text) text.textContent = playing ? 'Pause' : 'Play all';
    }

    if (playBtn) {
      playBtn.addEventListener('click', function () {
        if (driver.paused) { playAll(); setPlayIcon(true); }
        else { pauseAll(); setPlayIcon(false); }
      });
    }

    if (restartBtn) {
      restartBtn.addEventListener('click', function () {
        videos.forEach(function (v) { v.currentTime = 0; });
        playAll();
        setPlayIcon(true);
      });
    }

    // Clips differ slightly in length; scrub by fraction of each clip's own
    // duration so the three stay visually aligned through the manoeuvre.
    if (scrub) {
      scrub.addEventListener('input', function () {
        var frac = Number(scrub.value) / 1000;
        pauseAll();
        setPlayIcon(false);
        videos.forEach(function (v) {
          if (isFinite(v.duration) && v.duration > 0) v.currentTime = frac * v.duration;
        });
      });

      driver.addEventListener('timeupdate', function () {
        if (!isFinite(driver.duration) || driver.duration <= 0) return;
        scrub.value = String(Math.round((driver.currentTime / driver.duration) * 1000));
      });
    }

    // Keep the group in step: when the longest clip wraps, restart them all.
    var lead = videos[0];
    videos.forEach(function (v) {
      if (isFinite(v.duration) && isFinite(lead.duration) && v.duration > lead.duration) lead = v;
    });
    lead.addEventListener('ended', function () {
      videos.forEach(function (v) { v.currentTime = 0; });
      playAll();
    });

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
     Standalone clips elsewhere on the page: play while visible, pause when
     scrolled away, so a page full of video stays cheap.
     ---------------------------------------------------------------------- */
  var lazyVideos = document.querySelectorAll('video[data-autoplay-in-view]');
  if (lazyVideos.length && 'IntersectionObserver' in window) {
    var vo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting) v.play().catch(function () {});
        else v.pause();
      });
    }, { threshold: 0.4 });
    lazyVideos.forEach(function (v) { vo.observe(v); });
  }
})();
