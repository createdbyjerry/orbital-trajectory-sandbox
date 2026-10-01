/**
 * Design system page — renders tokens/tokens.json as living documentation.
 * Previews use var(--token) directly, so what you see is what tokens.css ships.
 * Needs to be served over http(s) (GitHub Pages or a local server) for fetch() to work.
 */
(function () {
  'use strict';

  var TOKENS_URL = '../tokens/tokens.json';
  var root = document.getElementById('ds-root');
  var toast = document.getElementById('ds-toast');
  var css = getComputedStyle(document.documentElement);

  /* ---------- helpers ---------- */
  function flatten(node, path, inheritedType, out) {
    Object.keys(node).forEach(function (key) {
      if (key.charAt(0) === '$') return;
      var child = node[key];
      var p = path.concat(key);
      var type = child.$type || inheritedType;
      if ('$value' in child) {
        out.push({ path: p, cssVar: '--' + p.join('-'), type: type, description: child.$description });
      } else {
        flatten(child, p, type, out);
      }
    });
    return out;
  }

  function h(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function titleCase(s) {
    return s.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  // section key: top-level group, except "font" which splits into family/size/weight
  function sectionOf(t) {
    return t.path[0] === 'font' ? 'font-' + t.path[1] : t.path[0];
  }

  var toastTimer;
  function copy(text) {
    var done = function () {
      toast.textContent = 'Copied ' + text;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 1400);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done);
    else done();
  }

  /* ---------- token card ---------- */
  function card(t, preview) {
    var btn = h('button', 'ds-token');
    btn.type = 'button';
    btn.title = 'Copy var(' + t.cssVar + ')';
    btn.addEventListener('click', function () { copy('var(' + t.cssVar + ')'); });
    if (preview) btn.appendChild(preview);
    var meta = h('div', 'ds-meta');
    meta.appendChild(h('span', 'ds-name', t.cssVar));
    meta.appendChild(h('span', 'ds-value', css.getPropertyValue(t.cssVar).trim()));
    if (t.description) meta.appendChild(h('span', 'ds-desc', t.description));
    btn.appendChild(meta);
    return btn;
  }

  /* ---------- previews per section ---------- */
  var renderers = {
    'color': { layout: 'grid', preview: function (t) {
      var sw = h('div', 'ds-swatch'); var fill = h('span');
      fill.style.background = 'var(' + t.cssVar + ')'; sw.appendChild(fill); return sw;
    } },
    'font-family': { layout: 'list', preview: function (t) {
      var s = h('div', 'ds-type-sample', 'Orbital Trajectory Sandbox 0123456789');
      s.style.fontFamily = 'var(' + t.cssVar + ')'; s.style.fontSize = 'var(--font-size-16)'; return s;
    } },
    'font-size': { layout: 'list', preview: function (t) {
      var s = h('div', 'ds-type-sample', 'Periapsis altitude 408 km');
      s.style.fontSize = 'var(' + t.cssVar + ')'; return s;
    } },
    'font-weight': { layout: 'list', preview: function (t) {
      var s = h('div', 'ds-type-sample', 'Telemetry');
      s.style.fontWeight = 'var(' + t.cssVar + ')'; s.style.fontSize = 'var(--font-size-16)'; return s;
    } },
    'letter-spacing': { layout: 'list', preview: function (t) {
      var s = h('div', 'ds-type-sample', 'ORBITAL ELEMENTS');
      s.style.letterSpacing = 'var(' + t.cssVar + ')'; s.style.fontSize = 'var(--font-size-12)'; return s;
    } },
    'space': { layout: 'list', preview: function (t) {
      var track = h('div', 'ds-bar-track'); var bar = h('div', 'ds-bar');
      bar.style.width = 'var(' + t.cssVar + ')'; track.appendChild(bar); return track;
    } },
    'radius': { layout: 'grid', preview: function (t) {
      var r = h('div', 'ds-radius'); r.style.borderRadius = 'var(' + t.cssVar + ')'; return r;
    } },
    'shadow': { layout: 'grid', preview: function (t) {
      var s = h('div', 'ds-shadow'); s.style.boxShadow = 'var(' + t.cssVar + ')'; return s;
    } }
  };

  /* ---------- render ---------- */
  function render(json) {
    var tokens = flatten(json, [], undefined, []);
    var sections = [];
    var bySection = {};
    tokens.forEach(function (t) {
      var key = sectionOf(t);
      if (!bySection[key]) { bySection[key] = []; sections.push(key); }
      bySection[key].push(t);
    });

    root.textContent = '';
    sections.forEach(function (key) {
      var r = renderers[key] || { layout: 'list', preview: null };
      var sec = h('section', 'ds-section');
      sec.appendChild(h('h2', null, titleCase(key) + ' · ' + bySection[key].length));
      var wrap = h('div', r.layout === 'grid' ? 'ds-grid' : 'ds-list');
      bySection[key].forEach(function (t) {
        wrap.appendChild(card(t, r.preview ? r.preview(t) : null));
      });
      sec.appendChild(wrap);
      root.appendChild(sec);
    });
  }

  fetch(TOKENS_URL)
    .then(function (res) { if (!res.ok) throw new Error(res.status + ' ' + res.statusText); return res.json(); })
    .then(render)
    .catch(function (err) {
      root.textContent = '';
      root.appendChild(h('p', 'ds-muted',
        'Could not load tokens.json (' + err.message + '). If you opened this file directly, ' +
        'serve the repo over http instead, e.g. "npm start".'));
    });
})();
