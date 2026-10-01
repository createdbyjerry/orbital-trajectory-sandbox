/**
 * Design guide page (design-system/index.html).
 * Every element with data-token="--name" shows that token's live value from
 * tokens.css, so the docs can never drift from tokens/tokens.json.
 * The HTML keeps a static fallback value in case this script doesn't run.
 */
(function () {
  'use strict';

  var css = getComputedStyle(document.documentElement);

  document.querySelectorAll('[data-token]').forEach(function (el) {
    var value = css.getPropertyValue(el.getAttribute('data-token')).trim();
    if (value) el.textContent = value;
    else el.title = 'Token not found in tokens.css';
  });

  // Live readout for the slider demo
  var slider = document.getElementById('demoEcc');
  var readout = document.getElementById('demoEccVal');
  if (slider && readout) {
    slider.addEventListener('input', function () {
      readout.textContent = parseFloat(slider.value).toFixed(2);
    });
  }
})();
