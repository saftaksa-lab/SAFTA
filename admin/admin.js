/* =========================================================================
   مركز تحكّم سافتا — المنطق
   -------------------------------------------------------------------------
   ما يستطيعه المحرّر:  تغيير النصوص (عربي/إنجليزي) واستبدال الصور.
   ما لا يستطيعه:        تغيير أسماء الأقسام · تغيير الترتيب · حذف أو إضافة
                        عنصر · لمس أي سطر برمجي · تعديل التصميم.
   البنية: schema.js يصف ما يمكن تحريره · baseline.js النسخة الأصلية ·
           التعديلات تُحفظ محليًا ثم تُصدَّر ملفاتٍ تُرفع على GitHub.
   ========================================================================= */
(function () {
'use strict';

/* ═══════════════════ 0 · ثوابت ═══════════════════ */

var USER_HASH = '466a7067305c8c24b58b8bae2d1886fc40ba332633265a834ef8ae4715220f49';
var PASS_HASH = '06b51cf25bdc12004dcea54fd6a681119b5760bd1a36962262fb7bfd4f981cb2';

var LS_KEY   = 'safta.cms.draft';
var SS_KEY   = 'safta.cms.session';
var UPLOADS  = 'assets/img/uploads/';

var SCHEMA = window.SAFTA_SCHEMA || {};
var BASE   = window.SAFTA_BASE   || {};

var $  = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

/* ═══════════════════ 1 · الحالة ═══════════════════ */

var S = {
  cur:    { pages: {}, groups: {}, articles: {}, events: {} },   /* النسخة المعدّلة */
  images: {},                                        /* المسار → dataURL */
  view:   Object.keys(SCHEMA)[0] || 'index',
  query:  ''
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function resetState() {
  S.cur = clone({ pages: BASE.pages || {}, groups: BASE.groups || {},
                  articles: BASE.articles || {}, events: BASE.events || {} });
  S.images = {};
}

function saveDraft() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ cur: S.cur, images: S.images, at: Date.now() }));
  } catch (e) {
    toast('المتصفّح رفض حفظ المسودة — نزّل الملفات قبل الإغلاق');
  }
}

function loadDraft() {
  resetState();
  try {
    var d = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (d && d.cur) { S.cur = d.cur; S.images = d.images || {}; }
  } catch (e) {}
}

/* ═══════════════════ 2 · قراءة/كتابة بالمسار ═══════════════════ */

function getPath(obj, path) {
  var p = String(path).split('.'), o = obj;
  for (var i = 0; i < p.length; i++) {
    if (o == null) return undefined;
    o = o[p[i]];
  }
  return o;
}

function setPath(obj, path, val) {
  var p = String(path).split('.'), o = obj;
  for (var i = 0; i < p.length - 1; i++) {
    if (o[p[i]] == null) o[p[i]] = {};
    o = o[p[i]];
  }
  o[p[p.length - 1]] = val;
}

/* عنوان موحّد لكل حقل داخل مجموعة تحرير واحدة */
function readField(viewKey, f, lang) {
  var sc = SCHEMA[viewKey];
  if (sc.kind === 'data') {
    var path = (lang === 'ar') ? f.arPath : f.path;
    if (!path) return null;
    return getPath(S.cur[sc.store][f.recId], path);
  }
  var rec = (S.cur.pages[viewKey] || {})[f.key];
  if (!rec) return null;
  if (f.type === 'image') return lang === 'src' ? rec.src : rec.alt;
  return rec[lang];
}

function writeField(viewKey, f, lang, val) {
  var sc = SCHEMA[viewKey];
  if (sc.kind === 'data') {
    var path = (lang === 'ar') ? f.arPath : f.path;
    if (!path) return;
    setPath(S.cur[sc.store][f.recId], path, val);
    return;
  }
  var rec = S.cur.pages[viewKey][f.key];
  if (f.type === 'image') { rec[lang === 'src' ? 'src' : 'alt'] = val; return; }
  rec[lang] = val;
}

function baseField(viewKey, f, lang) {
  var sc = SCHEMA[viewKey];
  if (sc.kind === 'data') {
    var path = (lang === 'ar') ? f.arPath : f.path;
    if (!path) return null;
    var rec0 = BASE[sc.store][f.recId];
    return rec0 ? getPath(rec0, path) : null;
  }
  var rec = (BASE.pages[viewKey] || {})[f.key];
  if (!rec) return null;
  if (f.type === 'image') return lang === 'src' ? rec.src : rec.alt;
  return rec[lang];
}

function fieldDirty(viewKey, f) {
  var langs = (f.type === 'image') ? ['src', 'alt'] : ['en', 'ar'];
  for (var i = 0; i < langs.length; i++) {
    var a = readField(viewKey, f, langs[i]), b = baseField(viewKey, f, langs[i]);
    if (a == null && b == null) continue;
    if (String(a) !== String(b)) return true;
  }
  return false;
}

/* ═══════════════════ 3 · تسطيح المخطّط ═══════════════════ */

/* يعيد كل حقول مجموعة تحرير كقائمة مسطّحة مع مرجع القسم والبطاقة */
function flatFields(viewKey) {
  var sc = SCHEMA[viewKey], out = [];
  (sc.sections || []).forEach(function (sec) {
    (sec.fields || []).forEach(function (f) { out.push(dress(f, sec, null)); });
    (sec.cards || []).forEach(function (card) {
      (card.fields || []).forEach(function (f) { out.push(dress(f, sec, card)); });
    });
  });
  function dress(f, sec, card) {
    var g = Object.create(f);
    g.secKey = sec.key; g.secLabel = sec.label;
    g.cardKey = card ? card.key : null;
    g.cardLabel = card ? card.label : null;
    if (sc.kind === 'data') g.recId = card ? card.key : sec.key;
    g.uid = viewKey + '|' + (card ? card.key : sec.key) + '|' + (f.key || f.path);
    return g;
  }
  return out;
}

function dirtyCount() {
  var n = 0;
  Object.keys(SCHEMA).forEach(function (v) {
    flatFields(v).forEach(function (f) { if (fieldDirty(v, f)) n++; });
  });
  return n;
}

function dirtyInView(viewKey) {
  var n = 0;
  flatFields(viewKey).forEach(function (f) { if (fieldDirty(viewKey, f)) n++; });
  /* السجلّات المضافة أو المحذوفة تُحتسب تعديلًا حتى لو لم يُلمس حقل */
  var sc = SCHEMA[viewKey];
  if (sc && sc.addable) {
    var cur = Object.keys(S.cur[sc.store] || {});
    var bas = Object.keys(BASE[sc.store] || {});
    cur.forEach(function (k) { if (bas.indexOf(k) === -1) n++; });
    bas.forEach(function (k) { if (cur.indexOf(k) === -1) n++; });
  }
  return n;
}

/* ═══════════════════ 4 · تنظيف النصّ المنسّق ═══════════════════ */

var ALLOWED = { B: 1, STRONG: 1, EM: 1, I: 1, A: 1, BR: 1, SUP: 1, SMALL: 1 };

function sanitize(html) {
  var box = document.createElement('div');
  box.innerHTML = String(html || '');
  (function walk(node) {
    var kids = Array.prototype.slice.call(node.childNodes);
    kids.forEach(function (k) {
      if (k.nodeType === 3) return;                       /* نص */
      if (k.nodeType !== 1) { k.remove(); return; }        /* تعليق أو غيره */
      if (!ALLOWED[k.tagName]) {                           /* وسم ممنوع: أبقِ محتواه */
        while (k.firstChild) node.insertBefore(k.firstChild, k);
        k.remove();
        return;
      }
      Array.prototype.slice.call(k.attributes).forEach(function (at) {
        var keep = (k.tagName === 'A' && (at.name === 'href' || at.name === 'style'));
        if (!keep) k.removeAttribute(at.name);
      });
      if (k.tagName === 'A') {
        var h = k.getAttribute('href') || '';
        if (/^\s*(javascript|data):/i.test(h)) k.setAttribute('href', '#');
      }
      walk(k);
    });
  })(box);
  return box.innerHTML.trim();
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ═══════════════════ 5 · تسجيل الدخول ═══════════════════ */

function sha256(str) {
  var buf = new TextEncoder().encode(str);
  return crypto.subtle.digest('SHA-256', buf).then(function (h) {
    return Array.prototype.map.call(new Uint8Array(h), function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  });
}

var _lf = $('#loginForm');
if (_lf) _lf.addEventListener('submit', function (e) {
  e.preventDefault();
  var u = $('#u').value.trim(), p = $('#p').value;
  Promise.all([sha256(u), sha256(u + ':' + p)]).then(function (h) {
    if (h[0] === USER_HASH && h[1] === PASS_HASH) {
      try { sessionStorage.setItem(SS_KEY, '1'); } catch (er) {}
      start();
    } else {
      $('#gateErr').hidden = false;
      $('#p').value = '';
      $('#p').focus();
    }
  });
});

$('#btnOut').addEventListener('click', function () {
  if (dirtyCount() && !confirm('لديك تعديلات لم تُنشر بعد. هل تريد الخروج؟')) return;
  try { sessionStorage.removeItem(SS_KEY); } catch (e) {}
  location.replace('../login.html');
});

function start() {
  $('#gate').hidden = true;
  $('#app').hidden = false;
  loadDraft();
  renderSide();
  renderPane();
}

/* ═══════════════════ 6 · القائمة الجانبية ═══════════════════ */

function renderSide() {
  var side = $('#side'), html = '';
  html += '<div class="side__h">صفحات الموقع</div>';
  Object.keys(SCHEMA).forEach(function (k, i) {
    var sc = SCHEMA[k];
    if (sc.kind === 'data' && i > 0) { /* عنوان فاصل قبل أول مجموعة بيانات */ }
    var n = flatFields(k).length, d = dirtyInView(k);
    html += '<button class="side__item' + (k === S.view ? ' is-on' : '') +
            (d ? ' is-dirty' : '') + '" data-view="' + k + '">' +
            '<span>' + escapeHtml(sc.label) + '</span>' +
            '<span class="side__n">' + n + '</span></button>';
  });
  side.innerHTML = html;
  $$('.side__item', side).forEach(function (b) {
    b.addEventListener('click', function () {
      S.view = b.getAttribute('data-view');
      S.query = ''; $('#q').value = '';
      renderSide(); renderPane();
      $('#pane').scrollTop = 0;
    });
  });
  refreshChip();
}

function refreshChip() {
  var n = dirtyCount();
  $('#dirtyChip').hidden = !n;
  $('#dirtyN').textContent = n;
}

/* ═══════════════════ 7 · منطقة التحرير ═══════════════════ */

function renderPane() {
  var pane = $('#pane'), sc = SCHEMA[S.view];
  if (!sc) { pane.innerHTML = ''; return; }

  var head = '<div class="pane__head">' +
    '<h1 class="pane__title">' + escapeHtml(sc.label) + '</h1>' +
    '<p class="pane__note">' +
      (sc.addable
        ? escapeHtml(sc.hint || 'تُحرَّر النصوص والصور، ويمكنك إضافة سجلّ جديد أو حذف ما أضفته.')
        : 'تُحرَّر النصوص والصور فقط. أسماء الأقسام وترتيبها وتصميم الصفحة ثابتة ولا يمكن تغييرها من هنا.') +
    '</p>' +
    (sc.addable
      ? '<button class="btn btn--primary" id="btnAddRec" type="button">' +
          escapeHtml(sc.addLabel || '＋ إضافة سجلّ') + '</button>'
      : '') +
    '</div>';

  /* وضع البحث: قائمة مسطّحة عبر كل الموقع */
  if (S.query) { pane.innerHTML = head + renderSearch(); bindPane(); return; }

  var body = '';
  (sc.sections || []).forEach(function (sec) {
    var count = (sec.fields || []).length +
                (sec.cards || []).reduce(function (a, c) { return a + c.fields.length; }, 0);
    body += '<section class="sec">' +
      '<div class="sec__head">' +
        '<h2 class="sec__name">' + escapeHtml(sec.label) + '</h2>' +
        '<span class="lock">اسم القسم وترتيبه مقفلان</span>' +
        '<span class="side__n">' + count + '</span>' +
      '</div><div class="sec__body">';

    (sec.fields || []).forEach(function (f) { body += fieldHtml(dressOne(f, sec, null)); });

    (sec.cards || []).forEach(function (card) {
      var dn = card.fields.filter(function (f) {
        return fieldDirty(S.view, dressOne(f, sec, card));
      }).length;
      var isNew = sc.addable && sec.key.indexOf(sc.newPrefix || 'wg-new-') === 0;
      body += '<div class="card"><button class="card__head" type="button">' +
        '<svg class="card__cx" viewBox="0 0 24 24" width="14" height="14"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '<span>' + escapeHtml(card.label) + '</span>' +
        (isNew ? '<span class="rec-del" data-del="' + escapeHtml(sec.key) + '" title="حذف">حذف</span>' : '') +
        (dn ? '<span class="chip" style="margin-inline-start:auto">' + dn + ' معدّل</span>' : '') +
        '<span class="side__n">' + card.fields.length + '</span>' +
        '</button><div class="card__body">';
      card.fields.forEach(function (f) { body += fieldHtml(dressOne(f, sec, card)); });
      body += '</div></div>';
    });

    body += '</div></section>';
  });

  pane.innerHTML = head + body;
  bindPane();
}

function dressOne(f, sec, card) {
  var sc = SCHEMA[S.view];
  var g = Object.create(f);
  g.secKey = sec.key; g.cardKey = card ? card.key : null;
  if (sc.kind === 'data') g.recId = card ? card.key : sec.key;
  g.uid = S.view + '|' + (card ? card.key : sec.key) + '|' + (f.key || f.path);
  return g;
}

function renderSearch() {
  var q = S.query.toLowerCase(), rows = [], seen = 0;
  Object.keys(SCHEMA).forEach(function (v) {
    flatFields(v).forEach(function (f) {
      if (seen >= 120) return;
      var hay = [readField(v, f, 'ar'), readField(v, f, 'en'), f.label, f.secLabel, f.cardLabel]
                  .join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return;
      seen++;
      rows.push('<section class="sec"><div class="sec__head">' +
        '<h2 class="sec__name">' + escapeHtml(SCHEMA[v].label) + ' › ' + escapeHtml(f.secLabel) +
        (f.cardLabel ? ' › ' + escapeHtml(f.cardLabel) : '') + '</h2></div>' +
        '<div class="sec__body">' + fieldHtml(f, v) + '</div></section>');
    });
  });
  if (!rows.length) {
    return '<div class="empty"><b>لا نتائج</b>جرّب كلمة أخرى من نص الموقع.</div>';
  }
  return rows.join('');
}

/* ═══════════════════ 8 · رسم الحقل ═══════════════════ */

function fieldHtml(f, viewOverride) {
  var v = viewOverride || S.view;
  var dirty = fieldDirty(v, f);
  var uid = escapeHtml(f.uid);
  var tag = { text: 'نص', long: 'فقرة', rich: 'نص منسّق', image: 'صورة', url: 'رابط' }[f.type] || 'نص';

  var head = '<div class="f' + (dirty ? ' is-dirty' : '') + '" data-uid="' + uid + '" data-view="' + v + '">' +
    '<div class="f__top">' +
      '<span class="f__label">' + escapeHtml(f.label || f.key || f.path) + '</span>' +
      '<span class="f__tag">' + tag + '</span>' +
      '<button class="f__reset" type="button" data-act="reset">رجوع للأصل</button>' +
    '</div>';

  if (f.type === 'image') {
    var src = readField(v, f, 'src') || '';
    var shown = S.images[src] || (src.indexOf('data:') === 0 ? src : '../' + src);
    return head +
      '<div class="img">' +
        '<div class="img__prev" style="background-image:url(\'' + escapeHtml(shown) + '\')"></div>' +
        '<div class="img__side">' +
          '<label class="img__pick">اختر صورة بديلة<input type="file" accept="image/*" data-act="pick"></label>' +
          '<div class="img__path">' + escapeHtml(src) + '</div>' +
          '<div class="f__side"><i>الوصف البديل (للقارئ الآلي)</i>' +
            '<textarea class="inp" rows="1" data-lang="alt" data-act="edit">' +
              escapeHtml(readField(v, f, 'alt') || '') + '</textarea></div>' +
        '</div>' +
      '</div></div>';
  }

  /* رابط: قيمة واحدة للّغتين، تُكتب من اليسار لليمين */
  if (f.type === 'url') {
    var u  = readField(v, f, 'en') || '';
    var ud = String(u) !== String(baseField(v, f, 'en')) ? ' is-dirty' : '';
    return head +
      '<div class="f__pair"><div class="f__side" style="grid-column:1/-1">' +
        '<i>صفحة داخل الموقع مثل <b>register-interest.html</b> أو رابط كامل مثل <b>https://…</b>' +
        ' — الروابط الكاملة تُفتح في تبويب جديد</i>' +
        '<textarea class="inp' + ud + '" rows="1" dir="ltr" style="text-align:left" ' +
        'data-lang="en" data-act="edit">' + escapeHtml(u) + '</textarea>' +
      '</div></div></div>';
  }

  var rows = f.type === 'long' ? 4 : (f.type === 'rich' ? 3 : 1);

  function box(lang, label) {
    var val = readField(v, f, lang);
    var d = String(val) !== String(baseField(v, f, lang)) ? ' is-dirty' : '';
    if (f.type === 'rich') {
      return '<div class="f__side"><i>' + label + '</i>' +
        '<div class="inp inp--rich' + d + '" contenteditable="true" data-lang="' + lang +
        '" data-act="edit" data-ph="اكتب هنا…">' + (val || '') + '</div></div>';
    }
    return '<div class="f__side"><i>' + label + '</i>' +
      '<textarea class="inp' + d + '" rows="' + rows + '" data-lang="' + lang +
      '" data-act="edit">' + escapeHtml(val || '') + '</textarea></div>';
  }

  return head + '<div class="f__pair">' + box('ar', 'العربية') + box('en', 'English') + '</div></div>';
}

/* ═══════════════════ 9 · الربط ═══════════════════ */

function findField(uid, view) {
  var list = flatFields(view);
  for (var i = 0; i < list.length; i++) if (list[i].uid === uid) return list[i];
  return null;
}

function bindPane() {
  var pane = $('#pane');

  $$('.card__head', pane).forEach(function (b) {
    b.addEventListener('click', function () { b.parentNode.classList.toggle('is-open'); });
  });

  $$('[data-act="edit"]', pane).forEach(function (el) {
    var wrap = el.closest('.f');
    var view = wrap.getAttribute('data-view');
    var f = findField(wrap.getAttribute('data-uid'), view);
    if (!f) return;
    var lang = el.getAttribute('data-lang');
    var isRich = el.classList.contains('inp--rich');

    var commit = function () {
      var val = isRich ? sanitize(el.innerHTML) : el.value;
      if (isRich && el.innerHTML !== val) el.innerHTML = val;
      writeField(view, f, lang, val);
      var chg = String(val) !== String(baseField(view, f, lang));
      el.classList.toggle('is-dirty', chg);
      wrap.classList.toggle('is-dirty', fieldDirty(view, f));
      saveDraft(); refreshChip();
      var side = $('.side__item[data-view="' + view + '"]');
      if (side) side.classList.toggle('is-dirty', dirtyInView(view) > 0);
    };

    el.addEventListener(isRich ? 'input' : 'input', function () {
      if (!isRich) autosize(el);
      clearTimeout(el._t); el._t = setTimeout(commit, 260);
    });
    el.addEventListener('blur', commit);
    if (isRich) el.addEventListener('paste', function (e) {
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, t);
    });
    if (!isRich) autosize(el);
  });

  $$('[data-act="pick"]', pane).forEach(function (inp) {
    inp.addEventListener('change', function () {
      var file = inp.files && inp.files[0];
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) { toast('الصورة أكبر من 3 ميجابايت — اضغطها أولًا'); return; }
      var wrap = inp.closest('.f');
      var view = wrap.getAttribute('data-view');
      var f = findField(wrap.getAttribute('data-uid'), view);
      var rd = new FileReader();
      rd.onload = function () {
        var name = file.name.replace(/[^\w.\-]+/g, '-').toLowerCase();
        var path = UPLOADS + Date.now().toString(36) + '-' + name;
        S.images[path] = rd.result;
        writeField(view, f, 'src', path);
        saveDraft(); refreshChip(); renderSide();
        $('.img__prev', wrap).style.backgroundImage = "url('" + rd.result + "')";
        $('.img__path', wrap).textContent = path;
        wrap.classList.add('is-dirty');
        toast('تم استبدال الصورة — تظهر بعد النشر');
      };
      rd.readAsDataURL(file);
    });
  });

  var addBtn = $('#btnAddRec', pane);
  if (addBtn) addBtn.addEventListener('click', function () { addRecord(); });

  $$('.rec-del', pane).forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var id = b.getAttribute('data-del');
      if (!confirm('حذف هذه المجموعة نهائيًا؟')) return;
      delRecord(id);
    });
  });

  $$('[data-act="reset"]', pane).forEach(function (b) {
    b.addEventListener('click', function () {
      var wrap = b.closest('.f');
      var view = wrap.getAttribute('data-view');
      var f = findField(wrap.getAttribute('data-uid'), view);
      var langs = f.type === 'image' ? ['src', 'alt'] : ['en', 'ar'];
      langs.forEach(function (l) { writeField(view, f, l, baseField(view, f, l)); });
      saveDraft(); refreshChip(); renderSide();
      if (S.query) { renderPane(); } else { renderPane(); }
    });
  });
}

/* ─── إضافة/حذف سجلّ (مجموعات العمل فقط) ─── */

function addRecord() {
  var sc = SCHEMA[S.view];
  if (!sc || !sc.addable) return;
  var id = (sc.newPrefix || 'wg-new-') + Date.now().toString(36);
  var rec = clone(sc.newRecord || {});
  if (!S.cur[sc.store]) S.cur[sc.store] = {};
  S.cur[sc.store][id] = rec;

  var cardLbl = sc.cardLabel || 'المحتوى';
  sc.sections.push({
    key: id,
    label: rec.title_ar || rec.name_ar || rec.title || rec.name || 'سجلّ جديد',
    fields: [],
    cards: [{ key: id, label: cardLbl, fields: clone(sc.sections[0].cards[0].fields) }]
  });

  saveDraft(); refreshChip(); renderSide(); renderPane();
  toast('أُضيف سجلّ جديد — عبّئ حقوله ثم احفظ وانشر');
  var last = $$('.card', $('#pane')).pop();
  if (last) { last.classList.add('is-open'); last.scrollIntoView({ block: 'center' }); }
}

function delRecord(id) {
  var sc = SCHEMA[S.view];
  if (!sc || !sc.addable) return;
  delete S.cur[sc.store][id];
  sc.sections = sc.sections.filter(function (x) { return x.key !== id; });
  saveDraft(); refreshChip(); renderSide(); renderPane();
  toast('حُذف السجلّ');
}

function autosize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight + 2, 420) + 'px';
}

/* ═══════════════════ 10 · البحث ═══════════════════ */

$('#q').addEventListener('input', function () {
  clearTimeout(window._qt);
  var self = this;
  window._qt = setTimeout(function () {
    S.query = self.value.trim();
    renderPane();
    $('#pane').scrollTop = 0;
  }, 220);
});

/* ═══════════════════ 11 · المعاينة ═══════════════════ */

function previewTarget() {
  var sc = SCHEMA[S.view];
  if (sc.kind !== 'data') return { file: sc.file, id: null };
  if (S.view === '_groups')   return { file: 'working-group.html', id: Object.keys(S.cur.groups)[0] };
  if (S.view === '_events')   return { file: 'media.html', id: null };
  return { file: 'article.html', id: Object.keys(S.cur.articles)[0] };
}

$('#btnPreview').addEventListener('click', function () {
  var t = previewTarget();
  $('#pvTitle').textContent = 'معاينة · ' + SCHEMA[S.view].label;
  $('#pvModal').hidden = false;
  buildPreview(t, 'ar', '100%');
});

function buildPreview(t, lang, width) {
  var url = '../' + t.file + (t.id ? '?id=' + encodeURIComponent(t.id) : '');
  fetch(url).then(function (r) { return r.text(); }).then(function (html) {
    var page = t.file.replace('.html', '');

    /* المحتوى المعدّل بدل الملف المنشور */
    var inject = '<script>window.SAFTA_C=window.SAFTA_C||{};window.SAFTA_C[' +
      JSON.stringify(page) + ']=' + JSON.stringify(withImages(S.cur.pages[page] || {})) + ';<\/script>';
    html = html.replace(/<script src="assets\/content\/[\w-]+\.js"><\/script>/, inject);

    /* بيانات المجموعات والمقالات المعدّلة */
    html = html.replace(/<script src="assets\/js\/wg-data\.js"><\/script>/,
      '<script>window.SAFTA_GROUPS=' + JSON.stringify(S.cur.groups) + ';<\/script>');
    html = html.replace(/<script src="assets\/js\/article-data\.js"><\/script>/,
      '<script>window.SAFTA_ARTICLES=' + JSON.stringify(S.cur.articles) + ';<\/script>');
    html = html.replace(/<script src="assets\/js\/events-data\.js(\?v=\d+)?"><\/script>/,
      '<script>window.SAFTA_EVENTS=' + JSON.stringify(S.cur.events) + ';<\/script>');

    html = html.replace(/<head([^>]*)>/i, '<head$1><base href="../">');
    html = html.replace(/localStorage\.getItem\(KEY\)/, 'null');
    html = html.replace(/<\/body>/i,
      '<script>try{localStorage.setItem("safta.lang",' + JSON.stringify(lang) +
      ');window.SAFTA_setLang&&window.SAFTA_setLang(' + JSON.stringify(lang) + ');}catch(e){}<\/script></body>');

    var fr = $('#pvFrame');
    fr.style.width = width;
    fr.srcdoc = html;
  }).catch(function () {
    toast('تعذّرت المعاينة — افتح المركز عبر خادم محلي أو من الموقع المنشور');
  });
}

function withImages(pageObj) {
  var o = clone(pageObj);
  Object.keys(o).forEach(function (k) {
    if (o[k] && o[k].src && S.images[o[k].src]) o[k].src = S.images[o[k].src];
  });
  return o;
}

$$('[data-pv-lang]').forEach(function (b) {
  b.addEventListener('click', function () {
    $$('[data-pv-lang]').forEach(function (x) { x.classList.remove('is-on'); });
    b.classList.add('is-on');
    var w = ($('[data-pv-w].is-on') || {}).getAttribute ? $('[data-pv-w].is-on').getAttribute('data-pv-w') : '100%';
    buildPreview(previewTarget(), b.getAttribute('data-pv-lang'), w);
  });
});
$$('[data-pv-w]').forEach(function (b) {
  b.addEventListener('click', function () {
    $$('[data-pv-w]').forEach(function (x) { x.classList.remove('is-on'); });
    b.classList.add('is-on');
    $('#pvFrame').style.width = b.getAttribute('data-pv-w');
  });
});
$('#pvX').addEventListener('click', function () { $('#pvModal').hidden = true; $('#pvFrame').srcdoc = ''; });

/* ═══════════════════ 12 · النشر ═══════════════════ */

function changedFiles() {
  var out = [];

  /* ملفات محتوى الصفحات */
  Object.keys(SCHEMA).forEach(function (v) {
    var sc = SCHEMA[v];
    if (sc.kind === 'data') return;
    var n = dirtyInView(v);
    if (!n) return;
    out.push({
      name: v + '.js',
      to:   'assets/content/' + v + '.js',
      n:    n,
      text: '/* محتوى صفحة «' + v + '» — يولّده مركز التحكّم. لا تُحرَّر يدويًا. */\n' +
            'window.SAFTA_C = window.SAFTA_C || {};\n' +
            'window.SAFTA_C["' + v + '"] = ' + JSON.stringify(S.cur.pages[v], null, 1) + ';\n'
    });
  });

  /* بيانات المجموعات */
  if (dirtyInView('_groups')) {
    out.push({
      name: 'wg-data.js', to: 'assets/js/wg-data.js', n: dirtyInView('_groups'),
      text: '/* بيانات مجموعات العمل التسع — يولّدها مركز التحكّم. لا تُحرَّر يدويًا. */\n' +
            'window.SAFTA_GROUPS = ' + JSON.stringify(S.cur.groups, null, 2) + ';\n'
    });
  }

  /* بيانات المقالات */
  if (dirtyInView('_articles')) {
    out.push({
      name: 'article-data.js', to: 'assets/js/article-data.js', n: dirtyInView('_articles'),
      text: '/* الأخبار والمقالات — يولّدها مركز التحكّم. لا تُحرَّر يدويًا. */\n' +
            'window.SAFTA_ARTICLES = ' + JSON.stringify(S.cur.articles, null, 2) + ';\n'
    });
  }

  /* بيانات الفعاليات */
  if (dirtyInView('_events')) {
    out.push({
      name: 'events-data.js', to: 'assets/js/events-data.js', n: dirtyInView('_events'),
      text: '/* الفعاليات والمعارض — يولّدها مركز التحكّم. لا تُحرَّر يدويًا. */\n' +
            'window.SAFTA_EVENTS = ' + JSON.stringify(S.cur.events, null, 2) + ';\n'
    });
  }

  /* الصور المرفوعة المستخدَمة فعليًا */
  var used = {};
  Object.keys(S.cur.pages).forEach(function (p) {
    Object.keys(S.cur.pages[p]).forEach(function (k) {
      var r = S.cur.pages[p][k];
      if (r && r.src && S.images[r.src]) used[r.src] = S.images[r.src];
    });
  });
  Object.keys(used).forEach(function (path) {
    out.push({ name: path.split('/').pop(), to: path, n: 1, dataUrl: used[path] });
  });

  return out;
}

$('#btnPublish').addEventListener('click', function () {
  var files = changedFiles();
  var list = $('#pubList');
  if (!files.length) {
    list.innerHTML = '<div class="empty"><b>لا توجد تعديلات</b>لم تُغيّر أي نص أو صورة بعد.</div>';
    $('#pubAll').hidden = true;
  } else {
    $('#pubAll').hidden = false;
    list.innerHTML = files.map(function (f, i) {
      return '<div class="pub__row">' +
        '<div class="pub__meta"><div class="pub__name">' + escapeHtml(f.name) + '</div>' +
        '<div class="pub__to">' + escapeHtml(f.to) + '</div></div>' +
        '<span class="pub__n">' + f.n + ' تعديل</span>' +
        '<button class="btn btn--ghost btn--sm" data-dl="' + i + '">تنزيل</button>' +
        (f.text ? '<button class="btn btn--ghost btn--sm" data-cp="' + i + '">نسخ</button>' : '') +
        '</div>';
    }).join('');
    $$('[data-dl]', list).forEach(function (b) {
      b.addEventListener('click', function () { download(files[+b.getAttribute('data-dl')]); });
    });
    $$('[data-cp]', list).forEach(function (b) {
      b.addEventListener('click', function () {
        navigator.clipboard.writeText(files[+b.getAttribute('data-cp')].text)
          .then(function () { toast('نُسخ المحتوى — الصقه في GitHub'); });
      });
    });
  }
  $('#pubModal').hidden = false;
});

$('#pubAll').addEventListener('click', function () {
  var files = changedFiles();
  files.forEach(function (f, i) { setTimeout(function () { download(f); }, i * 320); });
  toast('يتم تنزيل ' + files.length + ' ملف…');
});

$('#pubX').addEventListener('click', function () { $('#pubModal').hidden = true; });

function download(f) {
  var a = document.createElement('a');
  a.download = f.name;
  a.href = f.dataUrl || ('data:text/javascript;charset=utf-8,' + encodeURIComponent(f.text));
  document.body.appendChild(a); a.click(); a.remove();
}

/* ═══════════════════ 13 · تنبيهات ═══════════════════ */

var toastT;
function toast(msg) {
  var t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(function () { t.hidden = true; }, 2600);
}

window.addEventListener('beforeunload', function (e) {
  if (dirtyCount()) { e.preventDefault(); e.returnValue = ''; }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { $('#pubModal').hidden = true; $('#pvModal').hidden = true; }
});

/* ═══════════════════ 14 · الإقلاع ═══════════════════ */
/* أعضاء التحالف يدخلون من صفحة «دخول الأعضاء». لا شاشة دخول ثانية هنا:
   بلا جلسة → تحويل إلى البوابة، ومعها → فتح اللوحة مباشرة. */

(function boot() {
  var ok = false;
  try { ok = sessionStorage.getItem(SS_KEY) === '1'; } catch (e) {}
  if (ok) { start(); return; }
  if (window.SAFTA_ADMIN_NO_REDIRECT) return;      /* للاختبار الآلي */
  location.replace('../login.html');
})();

/* للاختبار الآلي */
window.SAFTA_ADMIN = {
  state: S, schema: SCHEMA, base: BASE,
  flatFields: flatFields, dirtyCount: dirtyCount, changedFiles: changedFiles,
  sanitize: sanitize, readField: readField, writeField: writeField, start: start
};

})();
