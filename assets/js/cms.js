/* =========================================================================
   SAFTA — محرّك المحتوى (CMS runtime)
   -------------------------------------------------------------------------
   يقرأ window.SAFTA_C[<الصفحة>] ويطبّقه على الصفحة قبل أن يعمل i18n.js.
   لا يغيّر التصميم ولا الترتيب ولا يضيف عنصرًا واحدًا — يبدّل النص والصورة فقط.
   ترتيب التحميل الإلزامي:  content/<page>.js  →  cms.js  →  i18n.js  →  main.js
   ========================================================================= */
(function () {
  'use strict';
  var file = (location.pathname.split('/').pop() || 'index.html');
  var page = file.replace(/\.html?$/i, '') || 'index';
  var C = (window.SAFTA_C || {})[page];
  if (!C) return;

  var n = 0;

  /* النصوص ثنائية اللغة */
  var t = document.querySelectorAll('[data-cms]');
  for (var i = 0; i < t.length; i++) {
    var el = t[i], r = C[el.getAttribute('data-cms')];
    if (!r) continue;
    if (typeof r.en === 'string' && r.en !== el.innerHTML) { el.innerHTML = r.en; n++; }
    if (typeof r.ar === 'string') el.setAttribute('data-ar', r.ar);
  }

  /* النصوص الإرشادية داخل الحقول */
  var p = document.querySelectorAll('[data-cms-ph]');
  for (var j = 0; j < p.length; j++) {
    var f = p[j], q = C[f.getAttribute('data-cms-ph')];
    if (!q) continue;
    if (typeof q.en === 'string' && q.en !== f.getAttribute('placeholder')) {
      f.setAttribute('placeholder', q.en); n++;
    }
    if (typeof q.ar === 'string') f.setAttribute('data-ar-placeholder', q.ar);
  }

  /* الصور */
  var g = document.querySelectorAll('[data-cms-img]');
  for (var k = 0; k < g.length; k++) {
    var im = g[k], s = C[im.getAttribute('data-cms-img')];
    if (!s) continue;
    if (s.src && s.src !== im.getAttribute('src')) {
      im.setAttribute('src', s.src);
      if (im.hasAttribute('srcset')) im.removeAttribute('srcset');
      n++;
    }
    if (typeof s.alt === 'string' && s.alt !== im.getAttribute('alt')) {
      im.setAttribute('alt', s.alt); n++;
    }
  }

  window.SAFTA_CMS = { page: page, applied: n, fields: Object.keys(C).length };
})();
