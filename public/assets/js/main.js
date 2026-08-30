/* =========================================================================
   ARAMCO HOMEPAGE — REPLICA / main.js
   Lenis (smooth scroll) + GSAP ScrollTrigger (reveals, progress, counters)
   ========================================================================= */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------
     1. SMOOTH SCROLL (Lenis) — matches Aramco's scroll feel
     --------------------------------------------------------------------- */
  var lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new Lenis({
      duration: 1.15,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.6
    });

    if (window.gsap && window.ScrollTrigger) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  if (window.gsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---------------------------------------------------------------------
     2. TOP SCROLL-PROGRESS BAR
     --------------------------------------------------------------------- */
  var bar = document.getElementById('scroll-progress');
  function updateProgress() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    bar.style.transform = 'scaleX(' + p + ')';
  }
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();

  /* ---------------------------------------------------------------------
     3. STICKY HEADER — transparent over hero, dark bar after
     --------------------------------------------------------------------- */
  var head = document.getElementById('siteHead');
  var hero = document.getElementById('hero');
  var lastY = 0;

  function updateHeader() {
    var trigger = hero ? hero.offsetHeight - 140 : 300;
    var y = window.scrollY;
    if (y > trigger) {
      head.classList.add('is-stuck');
      // hide on scroll-down, show on scroll-up
      head.style.transform = (y > lastY && y > trigger + 200) ? 'translateY(-100%)' : 'translateY(0)';
    } else {
      head.classList.remove('is-stuck');
      head.style.transform = 'translateY(0)';
    }
    lastY = y;
  }
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  /* ---------------------------------------------------------------------
     4. HERO CAROUSEL — 4 slides, autoplay, animated progress tabs
     --------------------------------------------------------------------- */
  var HERO_DURATION = 8000;
  var slides = [].slice.call(document.querySelectorAll('.hero__slide'));
  var panels = [].slice.call(document.querySelectorAll('.hero__panel'));
  var tabs   = [].slice.call(document.querySelectorAll('.hero-tab'));
  var heroIndex = 0;
  var heroTimer = null;

  document.documentElement.style.setProperty('--hero-dur', (HERO_DURATION / 1000) + 's');

  function goToSlide(i) {
    heroIndex = (i + slides.length) % slides.length;
    slides.forEach(function (s, n) { s.classList.toggle('is-active', n === heroIndex); });
    panels.forEach(function (p, n) { p.classList.toggle('is-active', n === heroIndex); });
    tabs.forEach(function (t, n) {
      t.classList.remove('is-active');
      var fill = t.querySelector('i');
      fill.style.animation = 'none';
      void fill.offsetWidth;           // force reflow to restart the CSS animation
      fill.style.animation = '';
      if (n === heroIndex) t.classList.add('is-active');
    });
  }

  function startHero() {
    stopHero();
    if (reduce) return;
    heroTimer = setInterval(function () { goToSlide(heroIndex + 1); }, HERO_DURATION);
  }
  function stopHero() { if (heroTimer) clearInterval(heroTimer); heroTimer = null; }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      goToSlide(parseInt(t.dataset.tab, 10));
      startHero();
    });
  });

  if (slides.length) {
    goToSlide(0);
    startHero();
    // pause autoplay when the hero is off-screen
    document.addEventListener('visibilitychange', function () {
      document.hidden ? stopHero() : startHero();
    });
  }

  /* ---------------------------------------------------------------------
     5. SCROLL REVEALS
     --------------------------------------------------------------------- */
  var reveals = [].slice.call(document.querySelectorAll('.reveal'));
  if (window.gsap && !reduce) {
    reveals.forEach(function (el) {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });
  } else {
    reveals.forEach(function (el) { el.style.opacity = 1; el.style.transform = 'none'; });
  }
  // failsafe: if a CDN is blocked, never leave content invisible
  setTimeout(function () {
    reveals.forEach(function (el) {
      if (getComputedStyle(el).opacity === '0') { el.style.opacity = 1; el.style.transform = 'none'; }
    });
  }, 2500);

  /* ---------------------------------------------------------------------
     6. "AT A GLANCE" COUNTERS
     --------------------------------------------------------------------- */
  function animateCount(el) {
    var target   = parseFloat(el.dataset.count);
    var decimals = parseInt(el.dataset.decimals || '0', 10);
    var suffix   = el.dataset.suffix || '';
    if (reduce) { el.textContent = format(target); return; }

    var obj = { v: 0 };
    gsap.to(obj, {
      v: target, duration: 2, ease: 'power2.out',
      onUpdate: function () { el.textContent = format(obj.v); }
    });
    function format(v) {
      return v.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }) + suffix;
    }
  }
  var counters = [].slice.call(document.querySelectorAll('[data-count]'));
  if (window.gsap && window.ScrollTrigger) {
    counters.forEach(function (el) {
      ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true,
        onEnter: function () { animateCount(el); } });
    });
  } else {
    counters.forEach(function (el) { el.textContent = el.dataset.count + (el.dataset.suffix || ''); });
  }

  /* ---------------------------------------------------------------------
     7. "WHAT WE BELIEVE" DRAG SLIDER + gradient scrollbar
     --------------------------------------------------------------------- */
  var slider = document.getElementById('believeSlider');
  var sBar   = document.getElementById('believeBar');
  if (slider) {
    var track = slider.querySelector('.slider__track');
    var maxX = 0, x = 0, down = false, startX = 0, startPos = 0;

    /* على الجوال يتولّى المتصفح التمرير أصلًا (CSS 40.1b) فنعطّل السحب
       بالـtransform تمامًا، وإلا تصادم الاثنان وتجمّد الحركة. */
    var mqNative = window.matchMedia('(max-width: 900px)');
    function nativeMode() { return mqNative.matches; }

    function measure() {
      maxX = Math.max(0, track.scrollWidth - slider.clientWidth);
      setX(Math.min(x, maxX));
    }
    // direction sign: LTR drags content left (-), RTL drags it right (+)
    function sign() { return document.documentElement.dir === 'rtl' ? 1 : -1; }

    function setX(v) {
      if (nativeMode()) return;
      x = Math.max(0, Math.min(maxX, v));
      track.style.transform = 'translate3d(' + (sign() * x) + 'px,0,0)';
      if (sBar) {
        var ratio = maxX > 0 ? x / maxX : 0;
        var thumb = sBar.querySelector('i');
        var visible = slider.clientWidth / track.scrollWidth;
        thumb.style.width = (visible * 100) + '%';
        thumb.style.transform = 'translateX(' + (-sign() * ratio * (100 / visible - 100)) + '%)';
      }
    }

    slider.addEventListener('pointerdown', function (e) {
      if (nativeMode()) return;
      down = true; startX = e.clientX; startPos = x;
      slider.classList.add('is-dragging');
      slider.setPointerCapture(e.pointerId);
      if (lenis) lenis.stop();
    });
    slider.addEventListener('pointermove', function (e) {
      if (!down) return;
      setX(startPos - (e.clientX - startX));
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      slider.addEventListener(ev, function () {
        down = false;
        slider.classList.remove('is-dragging');
        if (lenis) lenis.start();
      });
    });
    slider.addEventListener('dragstart', function (e) { e.preventDefault(); });

    /* --- prev / next arrows ------------------------------------------- */
    var nav  = document.getElementById('believeNav');
    var btns = nav ? [].slice.call(nav.querySelectorAll('.slider-nav__btn')) : [];

    function step() {
      var card = track.querySelector('.slide');
      if (!card) return 320;
      var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 20;
      return card.getBoundingClientRect().width + gap;
    }
    function syncBtns() {
      btns.forEach(function (b) {
        b.disabled = (b.dataset.dir === 'prev') ? x <= 1 : x >= maxX - 1;
      });
    }
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        setX(x + (b.dataset.dir === 'next' ? step() : -step()));
        syncBtns();
      });
    });

    /* --- trackpad / shift+wheel horizontal scrolling -------------------- */
    slider.addEventListener('wheel', function (e) {
      if (nativeMode()) return;
      var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
      if (!d) return;                       /* plain vertical wheel keeps scrolling the page */
      e.preventDefault();
      setX(x + d); syncBtns();
    }, { passive: false });

    /* --- keyboard ------------------------------------------------------ */
    slider.addEventListener('keydown', function (e) {
      var rtl = document.documentElement.dir === 'rtl';
      var fwd = rtl ? 'ArrowLeft' : 'ArrowRight';
      var bwd = rtl ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === fwd)      { e.preventDefault(); setX(x + step()); syncBtns(); }
      else if (e.key === bwd) { e.preventDefault(); setX(x - step()); syncBtns(); }
      else if (e.key === 'Home') { e.preventDefault(); setX(0); syncBtns(); }
      else if (e.key === 'End')  { e.preventDefault(); setX(maxX); syncBtns(); }
    });

    ['pointerup', 'pointercancel'].forEach(function (ev) {
      slider.addEventListener(ev, syncBtns);
    });

    var _measure = measure;
    measure = function () { _measure(); syncBtns(); };

    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    /* fonts and the EN/AR switch both change card widths */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    /* language switch flips the drag direction — rewind and re-measure */
    document.addEventListener('safta:lang', function () { x = 0; setX(0); measure(); });
    measure();
  }

  /* ---------------------------------------------------------------------
     8. KEY DOCUMENTS ACCORDION
     --------------------------------------------------------------------- */
  [].slice.call(document.querySelectorAll('.js-doc')).forEach(function (btn) {
    btn.addEventListener('click', function () {
      var panel = btn.closest('.doc').querySelector('.doc__panel');
      var open = btn.classList.toggle('is-open');
      panel.style.height = open ? panel.scrollHeight + 'px' : '0px';
    });
  });

  /* ---------------------------------------------------------------------
     9. MOBILE DRAWER + BACK TO TOP
     --------------------------------------------------------------------- */
  var drawer = document.getElementById('drawer');
  var navToggle = document.getElementById('navToggle');
  var drawerClose = document.getElementById('drawerClose');
  if (navToggle) navToggle.addEventListener('click', function () {
    drawer.classList.add('is-open'); document.body.classList.add('drawer-open'); if (lenis) lenis.stop();
  });
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    document.body.classList.remove('drawer-open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
    if (lenis) lenis.start();
  }
  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (navToggle) navToggle.addEventListener('click', function () {
    navToggle.setAttribute('aria-expanded', 'true');
  });
  /* Esc يغلق الدرج */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer && drawer.classList.contains('is-open')) closeDrawer();
  });

  /* كل رابط في الدرج يعمل مستقلًا:
     · يغلق الدرج دائمًا
     · لو الوجهة نفس الصفحة بمرساة مختلفة، نفعّلها يدويًا لأن المتصفح لا يعيد التحميل */
  if (drawer) {
    drawer.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      var hash = href.indexOf('#') > -1 ? href.slice(href.indexOf('#')) : '';
      /* الروابط بلا لاحقة .html والمسارات جذرية، فنُوحّد الطرفين قبل المقارنة */
      var page = function (u) {
        return (u || '').replace(/^\//, '').replace(/\.html?$/i, '') || 'index';
      };
      var path = href.split('#')[0];
      var here = page(location.pathname.split('/').pop());
      closeDrawer();
      if (!hash) return;                          /* رابط صفحة عادي */
      if (path && page(path) !== here) return;    /* صفحة أخرى — المتصفح يتكفّل */
      e.preventDefault();
      /* نضبط المرساة ثم نُطلق الحدث دائمًا — لا نعتمد على إطلاق المتصفح له،
         فبعض الحالات (نفس المرساة، أو تعديل برمجي) لا تُطلقه. */
      try { history.replaceState(null, '', hash); } catch (err) { location.hash = hash; }
      window.dispatchEvent(new Event('hashchange'));
    });
  }

  var toTop = document.getElementById('toTop');
  if (toTop) toTop.addEventListener('click', function () {
    lenis ? lenis.scrollTo(0, { duration: 1.4 }) : window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* 10. (كان هنا stub لزر التشغيل — استُبدل بمشغّل حقيقي في الوحدة 15) */

  /* ---------------------------------------------------------------------
     11. PARTNER LOGO STRIP — clone the track so the marquee loops seamlessly
     --------------------------------------------------------------------- */
  var pTrack = document.querySelector('.partners__track');
  if (pTrack && !pTrack.dataset.cloned) {
    pTrack.innerHTML += pTrack.innerHTML;
    /* the duplicated half is decorative — hide it from AT and tab order */
    var kids = [].slice.call(pTrack.children);
    kids.slice(kids.length / 2).forEach(function (el) {
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('tabindex', '-1');
    });
    pTrack.dataset.cloned = '1';
  }

  /* ---------------------------------------------------------------------
     12. PHOTO GALLERY LIGHTBOX
     --------------------------------------------------------------------- */
  var lb = document.getElementById('lightbox');
  if (lb) {
    var shots  = [].slice.call(document.querySelectorAll('.gallery__btn'));
    var lbImg  = document.getElementById('lbImg');
    var lbCap  = document.getElementById('lbCap');
    var lbIdx  = 0;
    var opener = null;

    function paint() {
      var b = shots[lbIdx];
      if (!b) return;
      var ar = document.documentElement.dir === 'rtl';
      lbImg.src = b.dataset.full;
      lbImg.alt = b.dataset.cap || '';
      lbCap.textContent = (ar && b.dataset.capAr) ? b.dataset.capAr : (b.dataset.cap || '');
    }
    function open(i) {
      lbIdx = i; opener = shots[i]; paint();
      lb.classList.add('is-open');
      lb.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      if (lenis) lenis.stop();
      document.getElementById('lbClose').focus();
    }
    function close() {
      lb.classList.remove('is-open');
      lb.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lenis) lenis.start();
      if (opener) opener.focus();
    }
    function move(d) { lbIdx = (lbIdx + d + shots.length) % shots.length; paint(); }

    shots.forEach(function (b, i) { b.addEventListener('click', function () { open(i); }); });
    document.getElementById('lbClose').addEventListener('click', close);
    document.getElementById('lbPrev').addEventListener('click', function () { move(-1); });
    document.getElementById('lbNext').addEventListener('click', function () { move(1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') move(document.documentElement.dir === 'rtl' ? -1 : 1);
      else if (e.key === 'ArrowLeft')  move(document.documentElement.dir === 'rtl' ? 1 : -1);
    });
    document.addEventListener('safta:lang', function () {
      if (lb.classList.contains('is-open')) paint();
    });
  }

  /* ---------------------------------------------------------------------
     13. MEMBERS MAP — records come from SAFTA_CRM.load()
         (local list by default, live CRM once an endpoint is configured)
     --------------------------------------------------------------------- */
  var mapEl = document.getElementById('membersMap');
  if (mapEl && window.L && window.SAFTA_CRM) {
    var CAT_COLOR = {
      'Government':    '#015C44',
      'Academic':      '#2FA58C',
      'Private sector':'#4689C8',
      'Non-profit':    '#63BD69'
    };
    var map = L.map(mapEl, { scrollWheelZoom: false, attributionControl: true })
               .setView([24.0, 45.0], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18, subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);
    map.on('click', function () { map.scrollWheelZoom.enable(); });
    map.on('mouseout', function () { map.scrollWheelZoom.disable(); });

    var pins = [];

    function popupHTML(m) {
      var ar = document.documentElement.dir === 'rtl';
      var name = (ar && m.name_ar) ? m.name_ar : m.name;
      var cat  = (ar && m.cat_ar)  ? m.cat_ar  : m.cat;
      var city = (ar && m.city_ar) ? m.city_ar : m.city;
      var more = ar ? 'عرض الملف' : 'View profile';
      return '<div class="memmap__pop"><span class="memmap__cat" style="color:' +
             (CAT_COLOR[m.cat] || '#015C44') + '">' + cat + '</span>' +
             '<strong>' + name + '</strong><small>' + (city || '') + '</small>' +
             '<a href="' + m.url + '">' + more + ' &rsaquo;</a></div>';
    }

    function draw(records) {
      records.forEach(function (m) {
        var mk = L.circleMarker([m.lat, m.lng], {
          radius: 9, weight: 2, color: '#fff',
          fillColor: CAT_COLOR[m.cat] || '#015C44', fillOpacity: 1
        }).addTo(map).bindPopup(popupHTML(m));
        mk.saftaData = m;
        pins.push(mk);
      });
      if (pins.length) {
        map.fitBounds(L.featureGroup(pins).getBounds(), { padding: [46, 46], maxZoom: 7 });
      }
      /* keep the map in sync with the category chips above it */
      var chipBar = document.getElementById('memberFilters');
      if (chipBar) {
        chipBar.addEventListener('click', function (e) {
          var chip = e.target.closest('.chip');
          if (!chip) return;
          var f = chip.dataset.filter;
          var shown = [];
          pins.forEach(function (mk) {
            var on = (f === 'All' || mk.saftaData.cat === f);
            if (on) { mk.addTo(map); shown.push(mk); } else { map.removeLayer(mk); }
          });
          if (shown.length) {
            map.fitBounds(L.featureGroup(shown).getBounds(), { padding: [46, 46], maxZoom: 8 });
          }
        });
      }
      /* re-render open popups when the language flips */
      document.addEventListener('safta:lang', function () {
        pins.forEach(function (mk) { mk.setPopupContent(popupHTML(mk.saftaData)); });
      });
      setTimeout(function () { map.invalidateSize(); }, 250);
    }

    window.SAFTA_CRM.load().then(draw);

    /* legend swatches take their colour from the same map */
    [].slice.call(document.querySelectorAll('.memmap__legend i')).forEach(function (i) {
      i.style.background = CAT_COLOR[i.dataset.cat] || '#015C44';
    });
  }

  /* ---------------------------------------------------------------------
     15. GREEN DUNES VIDEO
         · hero background loop (silent, respects prefers-reduced-motion)
         · click-to-play reel in the visit section and in "Our journey"
     --------------------------------------------------------------------- */
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  [].slice.call(document.querySelectorAll('.hero__slide video.hero__video')).forEach(function (bg) {
    var slide = bg.closest('.hero__slide');
    if (calm) {                       /* reduced motion: poster only, no download */
      bg.removeAttribute('autoplay');
      bg.preload = 'none';
      bg.pause();
      return;
    }
    function start() {
      if (bg.dataset.loaded !== '1') { bg.preload = 'auto'; bg.load(); bg.dataset.loaded = '1'; }
      var pr = bg.play(); if (pr && pr.catch) pr.catch(function () {});
    }
    /* a slide only spends bandwidth once it is actually on screen */
    new MutationObserver(function () {
      slide.classList.contains('is-active') ? start() : bg.pause();
    }).observe(slide, { attributes: true, attributeFilter: ['class'] });

    if (slide.classList.contains('is-active')) start();
    else {
      /* warm the next clip up during idle time so the switch is seamless */
      var warm = function () { if (bg.preload === 'none') bg.preload = 'metadata'; };
      window.requestIdleCallback ? requestIdleCallback(warm, { timeout: 4000 })
                                 : setTimeout(warm, 3000);
    }
  });

  [].slice.call(document.querySelectorAll('.video-play')).forEach(function (btn) {
    var host = btn.closest('.video-wrap, .visit__video');
    if (!host) return;
    var vid = host.querySelector('video');
    if (!vid) return;                       /* nothing wired up on this page */
    btn.addEventListener('click', function () {
      host.classList.add('is-playing');
      vid.controls = true;
      vid.preload = 'auto';
      var pr = vid.play(); if (pr && pr.catch) pr.catch(function () {});
    });
    vid.addEventListener('ended', function () { host.classList.remove('is-playing'); });
  });

  /* ---------------------------------------------------------------------
     16. تجربة الجوال — مؤشر السلايدرات الأفقية + فوتر أكورديون
         يعمل فقط دون 900px، ولا يمسّ سطح المكتب إطلاقًا
     --------------------------------------------------------------------- */
  (function () {
    var mq = window.matchMedia('(max-width: 900px)');

    /* --- شريط تدرّج أسفل كل سلايدر يتتبّع موضع التمرير --- */
    var RAILS = ['.discover .card-row', '.news .card-row', '.mag', '.tri',
                 '.visit__grid', '.awards__cats', '#believeSlider'];
    var rails = [];

    function buildRails() {
      RAILS.forEach(function (sel) {
        var el = document.querySelector(sel);
        if (!el || el.dataset.railed) return;
        var bar = document.createElement('div');
        bar.className = 'm-bar';
        bar.setAttribute('aria-hidden', 'true');
        bar.appendChild(document.createElement('i'));
        el.parentNode.insertBefore(bar, el.nextSibling);
        el.dataset.railed = '1';
        rails.push({ track: el, bar: bar, fill: bar.querySelector('i') });
      });
    }

    function paint(r) {
      var max = r.track.scrollWidth - r.track.clientWidth;
      if (max <= 4) { r.bar.style.display = 'none'; return; }
      r.bar.style.display = '';
      var visible = r.track.clientWidth / r.track.scrollWidth;
      /* في RTL يكون scrollLeft سالبًا أو معكوسًا حسب المتصفح */
      var pos = Math.abs(r.track.scrollLeft) / max;
      r.fill.style.width = (visible * 100) + '%';
      var travel = (1 / visible - 1) * 100;
      var dir = document.documentElement.dir === 'rtl' ? -1 : 1;
      r.fill.style.transform = 'translateX(' + (dir * pos * travel) + '%)';
    }

    function bind() {
      rails.forEach(function (r) {
        if (r.bound) return;
        r.bound = true;
        var tick = false;
        r.track.addEventListener('scroll', function () {
          if (tick) return;
          tick = true;
          requestAnimationFrame(function () { paint(r); tick = false; });
        }, { passive: true });
      });
      rails.forEach(paint);
    }

    /* --- فوتر أكورديون: العنوان يفتح قائمته --- */
    var cols = [].slice.call(document.querySelectorAll('.foot-col'));
    function setupFooter(on) {
      cols.forEach(function (col) {
        var h = col.querySelector('h4'), ul = col.querySelector('ul');
        if (!h || !ul) return;
        if (on) {
          if (!h.dataset.acc) {
            h.dataset.acc = '1';
            h.setAttribute('role', 'button');
            h.setAttribute('tabindex', '0');
            h.setAttribute('aria-expanded', 'false');
            var toggle = function () {
              var open = col.classList.toggle('is-open');
              h.setAttribute('aria-expanded', open ? 'true' : 'false');
              ul.style.height = open ? ul.scrollHeight + 'px' : '0px';
            };
            h.addEventListener('click', toggle);
            h.addEventListener('keydown', function (e) {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
            });
          }
          if (!col.classList.contains('is-open')) ul.style.height = '0px';
        } else {
          /* على سطح المكتب: كل شيء مفتوح وبلا أدوار */
          col.classList.remove('is-open');
          ul.style.height = '';
          h.removeAttribute('role'); h.removeAttribute('tabindex');
          h.removeAttribute('aria-expanded');
        }
      });
    }

    function apply() {
      if (mq.matches) { buildRails(); bind(); setupFooter(true); }
      else { rails.forEach(function (r) { r.bar.style.display = 'none'; }); setupFooter(false); }
    }
    apply();
    mq.addEventListener ? mq.addEventListener('change', apply) : mq.addListener(apply);
    window.addEventListener('resize', function () { if (mq.matches) rails.forEach(paint); });
    /* تبديل اللغة يقلب اتجاه التمرير */
    document.addEventListener('safta:lang', function () { if (mq.matches) rails.forEach(paint); });
  })();

  /* refresh ScrollTrigger once images settle */
  window.addEventListener('load', function () {
    if (window.ScrollTrigger) ScrollTrigger.refresh();
    updateProgress();
  });
})();

/* =========================================================================
   SAFTA — inner page behaviour (tabs · filters · member profile · forms)
   Runs after main.js IIFE; safe on pages where the elements don't exist.
   ========================================================================= */
(function () {
  'use strict';

  /* ---- 11. MEDIA TABS ---- */
  var tabBar = document.getElementById('mediaTabs');
  if (tabBar) {
    var panels = [].slice.call(document.querySelectorAll('.tab-panel'));
    [].slice.call(tabBar.querySelectorAll('.tab')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        [].slice.call(tabBar.querySelectorAll('.tab')).forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        panels.forEach(function (p) { p.classList.toggle('is-active', p.dataset.panel === btn.dataset.tab); });
        if (window.ScrollTrigger) ScrollTrigger.refresh();
        history.replaceState(null, '', '#' + btn.dataset.tab);
      });
    });
    /* deep link: /media#gallery opens the photo gallery straight away */
    function openFromHash(scroll) {
      var id = (location.hash || '').replace('#', '');
      if (!id) return;
      var btn = tabBar.querySelector('.tab[data-tab="' + id + '"]');
      if (!btn) return;
      btn.click();
      if (scroll !== false) {
        var y = tabBar.getBoundingClientRect().top + window.pageYOffset - 110;
        if (lenis) lenis.scrollTo(y, { duration: 1.0 });
        else window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
    openFromHash(false);
    window.addEventListener('hashchange', function () { openFromHash(true); });
  }

  /* روابط المراسي داخل الصفحة نفسها (مثل #awards) */
  (function () {
    function goAnchor() {
      var id = (location.hash || '').replace('#', '');
      if (!id) return;
      var el = document.getElementById(id);
      if (!el || document.getElementById('mediaTabs')) return;   /* المركز الإعلامي له منطقه */
      var y = el.getBoundingClientRect().top + window.pageYOffset - 90;
      if (lenis) lenis.scrollTo(y, { duration: 1.1 });
      else window.scrollTo({ top: y, behavior: 'smooth' });
    }
    window.addEventListener('hashchange', goAnchor);
    if (location.hash) setTimeout(goAnchor, 350);
  })();

  /* ---- 12. MEMBER CATEGORY FILTER ---- */
  var mFilters = document.getElementById('memberFilters');
  var mGrid = document.getElementById('memberGrid');
  if (mFilters && mGrid) {
    var cards = [].slice.call(mGrid.children);
    mFilters.addEventListener('click', function (e) {
      var btn = e.target.closest('.chip');
      if (!btn) return;
      [].slice.call(mFilters.children).forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      var want = btn.dataset.filter;
      cards.forEach(function (c) {
        var cat = (c.querySelector('.member-card__cat') || {}).textContent || '';
        c.style.display = (want === 'All' || cat.trim() === want) ? '' : 'none';
      });
    });
  }

  /* ---- 13. مُرشِّح مجموعات العمل — أُزيل مع شرائح التصفية ---- */
  /* الشبكة تُبنى الآن من wg-data.js في الوحدة 22، بلا تصفية. */

  /* ---- 14. مُرشِّح ملف العضو — أُزيل مع سجلّ SAFTA_MEMBERS المضمَّن ---- */
  /* الصفحة تُصدَر الآن مباشرة من مجموعة members عبر src/pages/[locale]/member.astro. */

  /* ---- 15. FORMS (front-end validation + confirmation) ---- */
  /* loginForm is excluded: it now does a real server-side POST (see
     src/pages/[locale]/login.astro), so it must not be intercepted here. */
  [['interestForm', 'riMsg'], ['contactForm', 'cMsg']].forEach(function (pair) {
    var form = document.getElementById(pair[0]);
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      [].slice.call(form.querySelectorAll('[required]')).forEach(function (f) {
        var bad = (f.type === 'checkbox') ? !f.checked : !f.value.trim();
        f.style.borderColor = bad ? '#C0392B' : '';
        if (bad) ok = false;
      });
      if (!ok) return;
      document.getElementById(pair[1]).classList.add('is-on');
      form.querySelector('.btn-solid').setAttribute('disabled', '');
    });
    form.addEventListener('input', function (e) { e.target.style.borderColor = ''; });
  });
})();

/* =========================================================================
   16. RTL AWARENESS  —  reacts to the language switch in i18n.js
   ========================================================================= */
(function () {
  'use strict';
  var isRTL = function () { return document.documentElement.dir === 'rtl'; };

  /* the drag slider moves the other way in RTL */
  function refreshSlider() {
    var slider = document.getElementById('believeSlider');
    if (!slider) return;
    var track = slider.querySelector('.slider__track');
    track.style.transform = 'translate3d(0,0,0)';
    var thumb = document.querySelector('#believeBar i');
    if (thumb) thumb.style.transform = 'translateX(0)';
    slider.dataset.rtl = isRTL() ? '1' : '0';
  }

  document.addEventListener('safta:lang', function () {
    refreshSlider();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  });

  document.addEventListener('DOMContentLoaded', function () {
    refreshSlider();
  });
})();

/* ---------------------------------------------------------------------
   20. اختيار ملف — يعرض اسم الملف بدل نص المتصفح الافتراضي
   --------------------------------------------------------------------- */
(function () {
  [].slice.call(document.querySelectorAll('.filepick input[type="file"]')).forEach(function (inp) {
    var out = inp.closest('.filepick').querySelector('.filepick__name');
    if (!out) return;
    var ar = document.documentElement.lang === 'ar';
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      if (f) {
        out.textContent = f.name + ' · ' + Math.max(1, Math.round(f.size / 1024)) + ' KB';
        out.classList.add('is-set');
        out.removeAttribute('data-ar');
      } else {
        out.classList.remove('is-set');
        out.setAttribute('data-ar', 'لم يُختر أي ملف');
        out.textContent = document.documentElement.lang === 'ar' ? 'لم يُختر أي ملف' : 'No file chosen';
      }
    });
  });
})();

/* ---------------------------------------------------------------------
   23. مشغّل الفيديو بالضغط
   ---------------------------------------------------------------------
   لا يُحمّل الفيديو إطلاقًا حتى يضغط الزائر: الصفحة ترى صورة غلاف
   بحجم 100 كيلوبايت بدل 4.7 ميجابايت. عند الضغط يُنشأ عنصر <video>
   ويبدأ التشغيل فورًا.
   --------------------------------------------------------------------- */
(function () {
  'use strict';
  var boxes = document.querySelectorAll('.vplay');
  if (!boxes.length) return;

  Array.prototype.forEach.call(boxes, function (box) {
    var btn = box.querySelector('.vplay__btn');
    if (!btn) return;

    btn.addEventListener('click', function () {
      if (box.classList.contains('is-playing')) return;

      var v = document.createElement('video');
      v.className   = 'vplay__video';
      v.controls    = true;
      v.autoplay    = true;
      v.playsInline = true;
      v.preload     = 'auto';
      v.setAttribute('poster', (box.querySelector('.vplay__poster') || {}).src || '');

      var webm = box.getAttribute('data-src-webm');
      var mp4  = box.getAttribute('data-src-mp4');
      if (webm) { var s1 = document.createElement('source'); s1.src = webm; s1.type = 'video/webm'; v.appendChild(s1); }
      if (mp4)  { var s2 = document.createElement('source'); s2.src = mp4;  s2.type = 'video/mp4';  v.appendChild(s2); }

      box.appendChild(v);
      box.classList.add('is-playing');
      var p = v.play();
      if (p && p.catch) p.catch(function () { /* المتصفّح منع التشغيل — الأزرار ظاهرة */ });
    });
  });
})();

/* ══════════════ 25) تبويبات الأخبار/الفعاليات (News & Events) ══════════════
   يبدّل بين .mtab-panel حسب زر .mtab[data-mtab]. لا يعتمد على صفحة بعينها. */
(function () {
  var tabs = [].slice.call(document.querySelectorAll('.mtab[data-mtab]'));
  if (!tabs.length) return;
  function show(key) {
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-mtab') === key;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    [].slice.call(document.querySelectorAll('.mtab-panel')).forEach(function (p) {
      var on = p.id === key;
      p.classList.toggle('is-active', on);
      p.hidden = !on;
    });
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { show(t.getAttribute('data-mtab')); });
  });
})();
