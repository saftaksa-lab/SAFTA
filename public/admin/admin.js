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

var LS_KEY   = 'safta.cms.draft';
var UPLOADS  = 'assets/img/uploads/';

var SCHEMA = window.SAFTA_SCHEMA || {};
var BASE   = window.SAFTA_BASE   || {};

var $  = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

/* ═══════════════════ 1 · الحالة ═══════════════════ */

var S = {
  cur:    { pages: {}, groups: {}, articles: {}, events: {}, members: {} },   /* النسخة المعدّلة */
  images: {},                                        /* المسار → dataURL */
  view:   Object.keys(SCHEMA)[0] || 'index',
  query:  ''
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function resetState() {
  S.cur = clone({ pages: BASE.pages || {}, groups: BASE.groups || {},
                  articles: BASE.articles || {}, events: BASE.events || {}, members: BASE.members || {} });
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
    if (d && d.cur) {
      /* دمج بالسجلّ لا استبدال المخزن (groups/articles/events/members) كاملًا —
         استبدال المخزن كاملًا بنسخة المسودة كان يمحو من اللوحة أي سجلّ حاضر على
         الخادم لم تلمسه تلك المسودة (مثلًا بعد npm run seed:collections --force
         التي تُعيد توليد content/*.json بمُعرِّفات جديدة)، ثم يرفض الخادم النشر
         بخطأ 400 لأن تلك السجلّات الحاضرة فعليًا تبدو للتحقّق وكأنها حُذفت. مسودة
         قديمة قد تحمل أيضًا مُعرِّفات لم تعد موجودة أصلًا — هذه تُهمَل ما لم تكن
         سجلًّا جديدًا لم يُنشَر بعد (مُعرَّف بادئته newPrefix في مجموعة addable). */
      if (d.cur.pages !== undefined) S.cur.pages = d.cur.pages;
      Object.keys(SCHEMA).forEach(function (v) {
        var sc = SCHEMA[v];
        if (sc.kind !== 'data' || !d.cur[sc.store]) return;
        var draftStore = d.cur[sc.store];
        Object.keys(draftStore).forEach(function (id) {
          var known = Object.prototype.hasOwnProperty.call(S.cur[sc.store], id);
          var pendingNew = !known && sc.addable && id.indexOf(sc.newPrefix || 'wg-new-') === 0;
          if (known || pendingNew) S.cur[sc.store][id] = draftStore[id];
        });
      });
      S.images = d.images || {};
    }
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

/* يحدّد نوع حقل مجموعة (_groups/_articles/_events) من type/arPath — الاشتقاق نفسه الذي
   تستخدمه scripts/lib/legacy-collection-shape.mjs، منقولًا هنا لأن كل قراءة/كتابة تحتاجه. */
function fieldKind(f) {
  if (f.type === 'image') return 'image';
  if (f.type === 'boolean') return 'boolean';
  if (f.arPath) return 'text';
  return 'value';
}

/* يحوّل مسار الحقل القديم (المُعرَّف في schema.js تجاه الشكل المسطّح القديم) إلى مسار
   الوصول داخل content/{groups,articles,events}.json المتداخل الفعلي — دون تغيير أي شيء في
   schema.js. حقول القيمة/المنطقية تبقى بمسارها كما هو (كانت دومًا قيمة مباشرة في الشكلين). */
function dataAccessPath(f, lang) {
  var kind = fieldKind(f);
  if (kind === 'text') {
    if (lang === 'ar') return f.path + '.ar';
    if (lang === 'en') return f.path + '.en';
    return null;
  }
  if (kind === 'image') {
    return lang === 'src' ? f.path + '.src' : null;
  }
  return (lang === 'ar' || lang === 'alt') ? null : f.path;
}

/* عنوان موحّد لكل حقل داخل مجموعة تحرير واحدة */
function readField(viewKey, f, lang) {
  var sc = SCHEMA[viewKey];
  if (sc.kind === 'data') {
    var path = dataAccessPath(f, lang);
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
    var path = dataAccessPath(f, lang);
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
    var path = dataAccessPath(f, lang);
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
/* الجلسة تُتحقّق منها على الخادم (middleware) قبل الوصول لهذه الصفحة أصلًا. */

$('#btnOut').addEventListener('click', function () {
  if (dirtyCount() && !confirm('لديك تعديلات لم تُنشر بعد. هل تريد الخروج؟')) return;
  fetch('/logout', { method: 'POST' }).then(function () { location.href = '/en/login'; });
});

function start() {
  loadDraft();
  renderSide();
  renderPane();
}

/* الصفحات apiBacked (حاليًا «عن التحالف» فقط) تُقرأ وتُكتب مباشرة من الخادم —
   BASE لهذه الصفحات يجب أن يعكس آخر نسخة محفوظة فعليًا قبل حساب الفروقات،
   بدل الاعتماد على لقطة baseline.js الجامدة. */
function apiBackedViews() {
  return Object.keys(SCHEMA).filter(function (v) { return SCHEMA[v].apiBacked; });
}

/* مخطط الحقول لهذه الصفحات يُولَّد من ملف مخطط واحد على الخادم
   (src/lib/content/schema/*.ts) بدل الاعتماد فقط على النسخة اليدوية في schema.js —
   نجلبه هنا ونستبدل به قبل أي استخدام لـ SCHEMA، فيبقى schema.js احتياطًا محليًا فقط
   إن تعذّر الاتصال بالخادم. */
/* مجموعات _groups/_articles/_events ليس لها مخطط خادمي منفصل — schema.js يبقى المرجع
   الوحيد لحقولها (generate-collection-schema.mjs يفشل بصوت عالٍ لو اختلف عن
   content/*.json)، فلا حاجة لجلب مخطط حيّ لها كما تفعل الصفحات المسطّحة. */
function syncApiBackedSchema() {
  var views = apiBackedViews().filter(function (v) { return SCHEMA[v].kind !== 'data'; });
  return Promise.all(views.map(function (v) {
    return fetch('/admin/api/schema/' + v)
      .then(function (r) { if (!r.ok) throw new Error('bad status'); return r.json(); })
      .then(function (data) { SCHEMA[v] = Object.assign({}, SCHEMA[v], data); })
      .catch(function () {
        toast('تعذّر تحميل أحدث مخطط لحقول «' + (SCHEMA[v].label || v) + '» — يُعرض آخر إصدار محفوظ محليًا');
      });
  }));
}

function syncApiBackedBaseline() {
  var views = apiBackedViews();
  return Promise.all(views.map(function (v) {
    var sc = SCHEMA[v];
    var url = sc.kind === 'data' ? '/admin/api/collection/' + sc.store : '/admin/api/content/' + v;
    return fetch(url)
      .then(function (r) { if (!r.ok) throw new Error('bad status'); return r.json(); })
      .then(function (data) {
        if (sc.kind === 'data') BASE[sc.store] = data;
        else BASE.pages[v] = data;
      })
      .catch(function () {
        toast('تعذّر تحميل أحدث نسخة من «' + (SCHEMA[v].label || v) + '» — يُعرض آخر إصدار محفوظ محليًا');
      });
  }));
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
  var sc = SCHEMA[v];
  var dirty = fieldDirty(v, f);
  var uid = escapeHtml(f.uid);
  var tag = { text: 'نص', long: 'فقرة', rich: 'نص منسّق', image: 'صورة', url: 'رابط', boolean: 'قيمة منطقية' }[f.type] || 'نص';

  var head = '<div class="f' + (dirty ? ' is-dirty' : '') + '" data-uid="' + uid + '" data-view="' + v + '">' +
    '<div class="f__top">' +
      '<span class="f__label">' + escapeHtml(f.label || f.key || f.path) + '</span>' +
      '<span class="f__tag">' + tag + '</span>' +
      '<button class="f__reset" type="button" data-act="reset">رجوع للأصل</button>' +
    '</div>';

  if (f.type === 'image') {
    var src = readField(v, f, 'src') || '';
    var shown = S.images[src] || (src.indexOf('data:') === 0 ? src : '../' + src);
    /* صور المجموعات (_groups/_articles) ليس لها وصف بديل في الشكل المخزَّن أصلًا — لا
       داعٍ لعنصر تحرير يكتب إلى مسار غير موجود. */
    var altBox = (sc.kind === 'data') ? '' :
      '<div class="f__side"><i>الوصف البديل (للقارئ الآلي)</i>' +
        '<textarea class="inp" rows="1" data-lang="alt" data-act="edit">' +
          escapeHtml(readField(v, f, 'alt') || '') + '</textarea></div>';
    return head +
      '<div class="img">' +
        '<div class="img__prev" style="background-image:url(\'' + escapeHtml(shown) + '\')"></div>' +
        '<div class="img__side">' +
          '<label class="img__pick">اختر صورة بديلة<input type="file" accept="image/*" data-act="pick"></label>' +
          '<div class="img__path">' + escapeHtml(src) + '</div>' +
          altBox +
        '</div>' +
      '</div></div>';
  }

  if (f.type === 'boolean') {
    var checked = !!readField(v, f, 'en');
    var bd = Boolean(checked) !== Boolean(baseField(v, f, 'en')) ? ' is-dirty' : '';
    return head +
      '<div class="f__pair"><div class="f__side' + bd + '" style="grid-column:1/-1">' +
        '<label class="chk"><input type="checkbox" data-act="toggle"' + (checked ? ' checked' : '') + '> مفعّل</label>' +
      '</div></div></div>';
  }

  /* رابط: قيمة واحدة للّغتين، تُكتب من اليسار لليمين */
  if (f.type === 'url') {
    var u  = readField(v, f, 'en') || '';
    var ud = String(u) !== String(baseField(v, f, 'en')) ? ' is-dirty' : '';
    return head +
      '<div class="f__pair"><div class="f__side" style="grid-column:1/-1">' +
        '<i>صفحة داخل الموقع مثل <b>/register-interest</b> أو رابط كامل مثل <b>https://…</b>' +
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

  $$('[data-act="toggle"]', pane).forEach(function (el) {
    var wrap = el.closest('.f');
    var view = wrap.getAttribute('data-view');
    var f = findField(wrap.getAttribute('data-uid'), view);
    if (!f) return;
    el.addEventListener('change', function () {
      var val = el.checked;
      writeField(view, f, 'en', val);
      var chg = Boolean(val) !== Boolean(baseField(view, f, 'en'));
      wrap.classList.toggle('is-dirty', chg);
      saveDraft(); refreshChip();
      var side = $('.side__item[data-view="' + view + '"]');
      if (side) side.classList.toggle('is-dirty', dirtyInView(view) > 0);
    });
  });

  $$('[data-act="pick"]', pane).forEach(function (inp) {
    inp.addEventListener('change', function () {
      var file = inp.files && inp.files[0];
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) { toast('الصورة أكبر من 3 ميجابايت — اضغطها أولًا'); return; }
      var wrap = inp.closest('.f');
      var view = wrap.getAttribute('data-view');
      var f = findField(wrap.getAttribute('data-uid'), view);

      /* الصفحات apiBacked تُرفَع صورها فورًا إلى public/uploads عبر الخادم —
         لا حاجة لتخزينها كـ dataURL محليًا بانتظار التنزيل والنشر اليدوي. */
      if (SCHEMA[view] && SCHEMA[view].apiBacked) {
        var fd = new FormData();
        fd.append('file', file);
        toast('يتم رفع الصورة…');
        fetch('/admin/api/uploads', { method: 'POST', body: fd })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) {
            if (!res.ok) { toast((res.j && res.j.error) || 'تعذّر رفع الصورة'); return; }
            var path = res.j.path;
            writeField(view, f, 'src', path);
            saveDraft(); refreshChip(); renderSide();
            $('.img__prev', wrap).style.backgroundImage = "url('../" + path + "')";
            $('.img__path', wrap).textContent = path;
            wrap.classList.add('is-dirty');
            toast('تم رفع الصورة');
          })
          .catch(function () { toast('تعذّر رفع الصورة'); });
        return;
      }

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

/* ─── تحويل السجلّ الجديد من الشكل المسطّح القديم (newRecord في schema.js) إلى الشكل
   المتداخل الذي يخزّنه content/{groups,articles,events}.json فعليًا — نفس منطق
   scripts/lib/legacy-collection-shape.mjs منقولًا هنا (بلا اعتماد على Node). ─── */

function deriveCollectionShape(sections) {
  var allFields = [];
  sections.forEach(function (s) {
    (s.cards || []).forEach(function (c) { (c.fields || []).forEach(function (f) { allFields.push(f); }); });
  });
  var byTop = {};
  allFields.forEach(function (f) {
    var top = f.path.split('.')[0];
    if (!byTop[top]) byTop[top] = [];
    byTop[top].push(f);
  });

  var shape = {};
  Object.keys(byTop).forEach(function (top) {
    var fields = byTop[top];
    var depths = {};
    fields.forEach(function (f) { depths[f.path.split('.').length] = true; });

    if (depths[1]) {
      var f0 = fields.filter(function (x) { return x.path === top; })[0];
      shape[top] = scalarDescriptor(f0);
      return;
    }
    if (depths[2]) {
      var first = fields.filter(function (x) { return x.path === top + '.0'; })[0] || fields[0];
      shape[top] = { kind: 'list', itemKind: first.arPath ? 'text' : 'value' };
      return;
    }
    if (depths[3]) {
      var idx = firstListIndex(fields, top);
      var itemFieldSource = fields.filter(function (x) { return x.path.indexOf(top + '.' + idx + '.') === 0; });
      var itemFields = {};
      itemFieldSource.forEach(function (x) {
        var sub = x.path.split('.')[2];
        itemFields[sub] = x.arPath ? { kind: 'text', arKey: x.arPath } : { kind: 'value' };
      });
      shape[top] = { kind: 'list', itemFields: itemFields };
    }
  });
  return shape;
}

function scalarDescriptor(f) {
  if (!f) return { kind: 'value' };
  if (f.type === 'image') return { kind: 'image' };
  if (f.type === 'boolean') return { kind: 'boolean' };
  if (f.arPath) return { kind: 'text', arKey: f.arPath };
  return { kind: 'value' };
}

function firstListIndex(fields, top) {
  var indices = [];
  var re = new RegExp('^' + top.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.(\\d+)\\.');
  fields.forEach(function (f) {
    var m = f.path.match(re);
    if (m) indices.push(Number(m[1]));
  });
  return indices.length ? Math.min.apply(null, indices) : 0;
}

function reshapeToNested(raw, shape) {
  var out = {};
  Object.keys(shape).forEach(function (key) { out[key] = reshapeValue(raw, key, shape[key]); });
  return out;
}

function reshapeValue(raw, key, desc) {
  switch (desc.kind) {
    case 'text': return { en: raw[key] || '', ar: raw[desc.arKey] || '' };
    case 'value': return raw[key] != null ? raw[key] : '';
    case 'boolean': return !!raw[key];
    case 'image': return { src: raw[key] || '' };
    case 'list': {
      var arr = Array.isArray(raw[key]) ? raw[key] : [];
      if (desc.itemKind === 'text') {
        var arArr = Array.isArray(raw[key + '_ar']) ? raw[key + '_ar'] : [];
        return arr.map(function (en, i) { return { en: en, ar: arArr[i] || '' }; });
      }
      if (desc.itemKind === 'value') return arr.slice();
      return arr.map(function (item) { return reshapeToNested(item, desc.itemFields); });
    }
    default: return null;
  }
}

/* ─── إضافة/حذف سجلّ (مجموعات العمل فقط) ─── */

function addRecord() {
  var sc = SCHEMA[S.view];
  if (!sc || !sc.addable) return;
  var id = (sc.newPrefix || 'wg-new-') + Date.now().toString(36);
  var rec = (sc.kind === 'data')
    ? reshapeToNested(clone(sc.newRecord || {}), deriveCollectionShape(sc.sections))
    : clone(sc.newRecord || {});
  if (!S.cur[sc.store]) S.cur[sc.store] = {};
  S.cur[sc.store][id] = rec;

  var cardLbl = sc.cardLabel || 'المحتوى';
  var titleField = (sc.kind === 'data') ? (rec.title || rec.name) : null;
  var label = (sc.kind === 'data')
    ? ((titleField && (titleField.ar || titleField.en)) || 'سجلّ جديد')
    : (rec.title_ar || rec.name_ar || rec.title || rec.name || 'سجلّ جديد');
  sc.sections.push({
    key: id,
    label: label,
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
  if (S.view === '_groups')   return { file: 'working-group.html', id: Object.keys(S.cur.groups)[0], view: S.view };
  if (S.view === '_events')   return { file: 'media.html', id: null, view: S.view };
  if (S.view === '_members')  return { file: 'member.html', id: Object.keys(S.cur.members)[0], view: S.view };
  return { file: 'article.html', id: Object.keys(S.cur.articles)[0], view: S.view };
}

/* بناء قاموس بديل «data-cms → قيمة» لسجلّ واحد من مجموعة (المجموعات/المقالات، حيث تُعرض
   نسخة واحدة بمُعرِّف ?id= في كل مرة) — المفاتيح هي مسارات schema.js نفسها، وهي أيضًا
   مفاتيح data-cms التي يرسمها Text/Value/Image في الصفحة (انظر article.astro مثلًا). */
function collectionPatchDict(view, id) {
  var sc = SCHEMA[view];
  var rec = (S.cur[sc.store] || {})[id];
  if (!rec) return {};
  var dict = {};
  flatFields(view).forEach(function (f) {
    if (f.recId !== id) return;
    dict[f.path] = fieldPatchValue(f, rec);
  });
  return dict;
}

/* نفس الفكرة لكن لكل سجلّات المجموعة معًا (الفعاليات: media.astro يعرض كل الفعاليات في
   آنٍ واحد، لا سجلًّا واحدًا بمُعرِّف) — كل مفتاح مسبوق بمُعرِّف السجلّ. */
function collectionPatchDictAll(view) {
  var sc = SCHEMA[view];
  var dict = {};
  Object.keys(S.cur[sc.store] || {}).forEach(function (id) {
    var rec = S.cur[sc.store][id];
    flatFields(view).forEach(function (f) {
      if (f.recId !== id) return;
      dict[id + '.' + f.path] = fieldPatchValue(f, rec);
    });
  });
  return dict;
}

function fieldPatchValue(f, rec) {
  var kind = fieldKind(f);
  if (kind === 'image') return { src: getPath(rec, f.path + '.src') };
  if (kind === 'text') return { en: getPath(rec, f.path + '.en'), ar: getPath(rec, f.path + '.ar') };
  /* قيمة/منطقي: لا مقابل عربي — تُغلَّف بـ{en:...} فقط لتُطابق شرط سكربت الترقيع الحالي
     (r.en) دون تعديله. */
  return { en: getPath(rec, f.path) };
}

$('#btnPreview').addEventListener('click', function () {
  var t = previewTarget();
  $('#pvTitle').textContent = 'معاينة · ' + SCHEMA[S.view].label;
  $('#pvModal').hidden = false;
  buildPreview(t, 'ar', '100%');
});

function buildPreview(t, lang, width) {
  var page = t.file.replace('.html', '');
  var url = '/en' + (page === 'index' ? '' : '/' + page) + (t.id ? '?id=' + encodeURIComponent(t.id) : '');
  fetch(url).then(function (r) { return r.text(); }).then(function (html) {

    /* الصفحات apiBacked تُصيَّر من content/<page>.json مباشرة على الخادم — لا
       سكربت محتوى نستبدله كما في الصفحات القديمة. نطبّق المسودة بنفس منطق
       cms.js القديم عبر data-cms/data-cms-img، ونضعه قبل i18n.js — لا بعد
       </body> — حتى لا يخزّن i18n.js النصّ الأصلي في data-en قبل أن نُبدّله. */
    if (SCHEMA[page] && SCHEMA[page].apiBacked) {
      var draft = withImages(S.cur.pages[page] || {});
      var patch = '<script>(function(){' +
        'var C=' + JSON.stringify(draft) + ';' +
        'document.querySelectorAll("[data-cms]").forEach(function(el){' +
          'var r=C[el.getAttribute("data-cms")];if(!r)return;' +
          'if(typeof r.en==="string")el.innerHTML=r.en;' +
          'if(typeof r.ar==="string")el.setAttribute("data-ar",r.ar);' +
        '});' +
        'document.querySelectorAll("[data-cms-img]").forEach(function(el){' +
          'var r=C[el.getAttribute("data-cms-img")];if(!r)return;' +
          'if(r.src)el.setAttribute("src",r.src);' +
          'if(typeof r.alt==="string")el.setAttribute("alt",r.alt);' +
        '});' +
      '})();<\/script>';
      html = html.replace(
        /<script[^>]*src="\/?assets\/js\/i18n\.js(\?v=\d+)?"[^>]*><\/script>/,
        function (m) { return patch + m; }
      );
    }

    /* مجموعات _groups/_articles/_events: نفس آلية الترقيع أعلاه لكن بقاموس مبنيّ من
       مسارات schema.js نفسها — article.astro/working-group.astro/media.astro تُصدر
       data-cms/data-cms-img بهذه المسارات ذاتها عبر Text/Value/Image. لا سكربت بيانات
       نستبدله كما في الصفحات القديمة (wg-data.js وغيرها لم يعودا موجودَين في القالب). */
    if (t.view && SCHEMA[t.view] && SCHEMA[t.view].kind === 'data') {
      var cdict = (t.view === '_events') ? collectionPatchDictAll(t.view) : collectionPatchDict(t.view, t.id);
      var cpatch = '<script>(function(){' +
        'var C=' + JSON.stringify(cdict) + ';' +
        'document.querySelectorAll("[data-cms]").forEach(function(el){' +
          'var r=C[el.getAttribute("data-cms")];if(!r)return;' +
          'if(typeof r.en==="string")el.innerHTML=r.en;' +
          'if(typeof r.ar==="string")el.setAttribute("data-ar",r.ar);' +
        '});' +
        'document.querySelectorAll("[data-cms-img]").forEach(function(el){' +
          'var r=C[el.getAttribute("data-cms-img")];if(!r)return;' +
          'if(r.src)el.setAttribute("src",r.src);' +
        '});' +
      '})();<\/script>';
      html = html.replace(
        /<script[^>]*src="\/?assets\/js\/i18n\.js(\?v=\d+)?"[^>]*><\/script>/,
        function (m) { return cpatch + m; }
      );
    }

    /* المحتوى المعدّل بدل الملف المنشور (الصفحات القديمة فقط) */
    var inject = '<script>window.SAFTA_C=window.SAFTA_C||{};window.SAFTA_C[' +
      JSON.stringify(page) + ']=' + JSON.stringify(withImages(S.cur.pages[page] || {})) + ';<\/script>';
    html = html.replace(/<script[^>]*src="\/?assets\/content\/[\w-]+\.js(\?v=\d+)?"[^>]*><\/script>/, inject);

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

  /* ملفات محتوى الصفحات — الصفحات apiBacked تُنشَر مباشرة عبر الخادم، فلا
     تظهر هنا كملفٍ يُنزَّل ويُرفَع يدويًا. */
  Object.keys(SCHEMA).forEach(function (v) {
    var sc = SCHEMA[v];
    if (sc.kind === 'data') return;
    if (sc.apiBacked) return;
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

  /* بيانات _groups/_articles/_events تُنشَر مباشرة عبر الخادم الآن (انظر
     publishApiBacked) — لم تعد تحتاج تنزيلًا يدويًا لـwg-data.js/article-data.js/
     events-data.js، ولم تعد القوالب تقرأ هذه الملفات أصلًا. */

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

function showDownloadModal(files) {
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
}

/* تنشر مباشرةً كل صفحة apiBacked تحمل تعديلًا — عبر POST إلى content/<page>.json
   على الخادم. عند النجاح تُحدَّث BASE لتلك الصفحة فتُصفَّر علامة "غير محفوظ". */
function publishApiBacked() {
  var views = apiBackedViews().filter(function (v) { return dirtyInView(v) > 0; });
  if (!views.length) return Promise.resolve([]);
  return Promise.all(views.map(function (v) {
    var sc = SCHEMA[v];
    var url = sc.kind === 'data' ? '/admin/api/collection/' + sc.store : '/admin/api/content/' + v;
    var body = sc.kind === 'data' ? S.cur[sc.store] : S.cur.pages[v];
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json().then(function (j) { return { view: v, ok: r.ok, j: j }; }); })
      .catch(function () { return { view: v, ok: false, j: {} }; });
  }));
}

$('#btnPublish').addEventListener('click', function () {
  var apiDirty = apiBackedViews().filter(function (v) { return dirtyInView(v) > 0; });

  if (!apiDirty.length) {
    showDownloadModal(changedFiles());
    return;
  }

  var btn = $('#btnPublish');
  btn.disabled = true;
  publishApiBacked().then(function (results) {
    btn.disabled = false;
    var saved = [], failed = [];
    results.forEach(function (r) {
      var sc = SCHEMA[r.view];
      if (r.ok) {
        if (sc.kind === 'data') BASE[sc.store] = clone(S.cur[sc.store]);
        else BASE.pages[r.view] = clone(S.cur.pages[r.view]);
        saved.push(sc.label);
      } else failed.push((sc && sc.label) || r.view);
    });
    saveDraft(); refreshChip(); renderSide(); renderPane();

    if (failed.length) toast('تعذّر حفظ: ' + failed.join('، ') + (saved.length ? ' (نُشر: ' + saved.join('، ') + ')' : ''));
    else toast('تم الحفظ والنشر مباشرة: ' + saved.join('، '));

    /* لا داعي لفتح نافذة التنزيل إن لم يبقَ أي ملفٍ من الصفحات القديمة ينتظر النشر اليدوي */
    var remaining = changedFiles();
    if (remaining.length) showDownloadModal(remaining);
  });
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
/* أعضاء التحالف يدخلون من صفحة «دخول الأعضاء». الخادم (middleware) هو من
   يتحقّق من الجلسة قبل أن تصل هذه الصفحة أصلًا، فلا حاجة لفحصٍ هنا. */

(function boot() {
  syncApiBackedSchema().then(function () {
    return syncApiBackedBaseline();
  }).then(start, start);
})();

/* للاختبار الآلي */
window.SAFTA_ADMIN = {
  state: S, schema: SCHEMA, base: BASE,
  flatFields: flatFields, dirtyCount: dirtyCount, changedFiles: changedFiles,
  sanitize: sanitize, readField: readField, writeField: writeField, start: start
};

})();
