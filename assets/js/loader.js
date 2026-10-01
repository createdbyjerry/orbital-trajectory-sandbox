/**
 * Page loader
 * Load this synchronously (no defer/async) directly after the #page-loader
 * markup, so it starts counting before the rest of the page renders.
 *  - Always shows for at least MIN_TIME ms (smooth eased count).
 *  - If the real load takes longer, the percentage tracks actual resource
 *    progress (images, video, iframes, stylesheets) until window "load".
 */
(function () {
  'use strict';

  var MIN_TIME = 2000; // minimum time the loader stays visible, in ms
  var FADE_MS = 500;   // keep in sync with --duration-slow
  var startTime = Date.now();

  var loaderEl = document.getElementById('page-loader');
  var pctEl = document.getElementById('loader-percent');
  if (!loaderEl || !pctEl) return;

  document.body.style.overflow = 'hidden';

  /* ---------- real page-load progress ---------- */
  var resources = [];

  function trackResource(el, isDoneNow) {
    var entry = { done: !!isDoneNow };
    resources.push(entry);
    if (!entry.done) {
      var markDone = function () { entry.done = true; };
      el.addEventListener('load', markDone, { once: true });
      el.addEventListener('error', markDone, { once: true });
    }
  }

  function collectResources() {
    var els = document.querySelectorAll('img, video, source, iframe, link[rel="stylesheet"]');
    els.forEach(function (el) {
      if (el.tagName === 'IMG') {
        trackResource(el, el.complete);
      } else if (el.tagName === 'VIDEO' || el.tagName === 'SOURCE') {
        trackResource(el, el.readyState >= 3);
      } else if (el.tagName === 'LINK') {
        trackResource(el, !!el.sheet);
      } else {
        trackResource(el, false);
      }
    });
  }

  if (document.readyState !== 'loading') {
    collectResources();
  } else {
    document.addEventListener('DOMContentLoaded', collectResources);
  }

  var windowLoaded = false;
  window.addEventListener('load', function () { windowLoaded = true; });

  function getRealProgress() {
    if (windowLoaded) return 100;
    if (!resources.length) return 0;
    var done = 0;
    for (var i = 0; i < resources.length; i++) if (resources[i].done) done++;
    return (done / resources.length) * 100;
  }

  /* ---------- simulated time-based progress ---------- */
  function getTimeProgress(elapsed) {
    var t = Math.min(elapsed / MIN_TIME, 1);
    var eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    return eased * 99;
  }

  /* ---------- combine, render, finish ---------- */
  var displayed = 0;

  function tick() {
    var elapsed = Date.now() - startTime;
    var timeP = getTimeProgress(elapsed);
    var realP = getRealProgress();
    var target;

    if (elapsed < MIN_TIME) {
      // Before minimum time: whichever is higher, capped at 99
      target = Math.max(timeP, Math.min(realP, 99));
    } else {
      // After minimum time: rely on actual load progress
      target = Math.max(99, realP);
    }

    displayed += (target - displayed) * 0.3;
    if (displayed > target) displayed = target;

    var shown = Math.min(99, Math.round(displayed));
    var complete = windowLoaded && elapsed >= MIN_TIME;
    if (complete) shown = 100;

    pctEl.textContent = shown + '%';

    if (complete) {
      finish();
      return;
    }
    requestAnimationFrame(tick);
  }

  function finish() {
    pctEl.textContent = '100%';
    loaderEl.classList.add('loader-hide');
    setTimeout(function () {
      loaderEl.style.display = 'none';
      document.body.style.overflow = '';
    }, FADE_MS);
  }

  requestAnimationFrame(tick);
})();
