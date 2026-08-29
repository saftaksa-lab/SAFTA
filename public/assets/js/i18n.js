/* =========================================================================
   SAFTA — bilingual engine (EN ⇄ AR)
   ------------------------------------------------------------------------
   Every translatable element carries data-ar="النص العربي".
   The English text stays in the markup, so the page is readable with JS off
   and search engines still see real content.

   On switch we:
     1. cache the English innerHTML once into data-en
     2. swap innerHTML
     3. flip <html lang> and <html dir>  →  the RTL block in style.css
        (section 31) takes over all direction-dependent geometry
     4. remember the choice in localStorage
   ========================================================================= */
(function () {
  'use strict';

  var KEY = 'safta.lang';
  var root = document.documentElement;

  function detect() {
    var seg = (location.pathname.split('/')[1] || '').toLowerCase();
    if (seg === 'ar' || seg === 'en') return seg;
    try {
      var saved = localStorage.getItem(KEY);
      if (saved === 'ar' || saved === 'en') return saved;
    } catch (e) {}
    return (navigator.language || '').toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en';
  }

  function apply(lang) {
    var ar = (lang === 'ar');

    /* 1 + 2 — text nodes */
    var nodes = document.querySelectorAll('[data-ar]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.dataset.en === undefined) el.dataset.en = el.innerHTML;
      el.innerHTML = ar ? el.dataset.ar : el.dataset.en;
    }

    /* placeholders and other attributes */
    var ph = document.querySelectorAll('[data-ar-placeholder]');
    for (var j = 0; j < ph.length; j++) {
      var f = ph[j];
      if (f.dataset.enPlaceholder === undefined) f.dataset.enPlaceholder = f.placeholder || '';
      f.placeholder = ar ? f.dataset.arPlaceholder : f.dataset.enPlaceholder;
    }

    /* 3 — document direction */
    root.lang = ar ? 'ar' : 'en';
    root.dir  = ar ? 'rtl' : 'ltr';

    /* page title */
    if (root.dataset.titleAr) {
      if (root.dataset.titleEn === undefined) root.dataset.titleEn = document.title;
      document.title = ar ? root.dataset.titleAr : root.dataset.titleEn;
    }

    /* toggle labels: the button always shows the *other* language */
    var sw = document.querySelectorAll('.lang-switch');
    for (var k = 0; k < sw.length; k++) sw[k].textContent = ar ? 'EN' : 'AR';

    var topAr = document.querySelector('.lang a:first-child');
    var topEn = document.querySelector('.lang a:last-child');
    if (topAr && topEn) {
      topAr.classList.toggle('is-active', ar);
      topEn.classList.toggle('is-active', !ar);
    }

    /* 4 — persist */
    try { localStorage.setItem(KEY, lang); } catch (e) {}

    /* let the rest of the app react (slider direction, ScrollTrigger, …) */
    document.dispatchEvent(new CustomEvent('safta:lang', { detail: { lang: lang, rtl: ar } }));
  }

  window.SAFTA_setLang = apply;
  window.SAFTA_lang = detect;

  /* run before paint so there is no flash of the wrong language */
  apply(detect());

  /* query-string pages (?id=...) are prerendered, so the lang-switch href baked at
     build time never carries the runtime query — patch it in before it can be clicked */
  if (location.search) {
    var sw = document.querySelector('.lang-switch');
    if (sw) sw.setAttribute('href', sw.getAttribute('href') + location.search);
  }

  document.addEventListener('DOMContentLoaded', function () {
    apply(detect());

    function bind(el, lang) {
      if (!el) return;
      el.addEventListener('click', function (e) {
        e.preventDefault();
        apply(lang === 'toggle' ? (root.lang === 'ar' ? 'en' : 'ar') : lang);
      });
    }

    bind(document.querySelector('.lang a:first-child'), 'ar');
    bind(document.querySelector('.lang a:last-child'), 'en');
  });
})();
