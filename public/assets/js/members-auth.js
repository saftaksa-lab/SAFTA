/* =========================================================================
   SAFTA — بوابة أعضاء التحالف إلى مركز تحكّم المحتوى
   -------------------------------------------------------------------------
   أعضاء التحالف هم من يحرّرون الموقع، فصفحة «دخول الأعضاء» هي نفسها بوابة
   اللوحة. عند نجاح الدخول تُفتح ‎/admin/‎ مباشرة.

   ملاحظة مهنية: الموقع ملفات ساكنة، فأي كلمة مرور فيه تُخفي ولا تُؤمّن.
   اللوحة لا تكتب على الموقع — تُنتج ملفات يرفعها العضو بحسابه على GitHub.
   ========================================================================= */
(function () {
  'use strict';

  var USER_HASH = '466a7067305c8c24b58b8bae2d1886fc40ba332633265a834ef8ae4715220f49';
  var PASS_HASH = '06b51cf25bdc12004dcea54fd6a681119b5760bd1a36962262fb7bfd4f981cb2';
  var SS_KEY    = 'safta.cms.session';

  var form = document.getElementById('loginForm');
  if (!form) return;
  var msg  = document.getElementById('lMsg');
  var uEl  = document.getElementById('l-user');
  var pEl  = document.getElementById('l-pass');
  if (!uEl || !pEl) return;

  function isAr() { return document.documentElement.lang === 'ar'; }

  function say(text, textAr, bad) {
    if (!msg) return;
    msg.hidden = false;
    msg.textContent = isAr() ? textAr : text;
    msg.setAttribute('data-ar', textAr);
    msg.style.color = bad ? '#D32F2F' : '';
  }

  function sha256(str) {
    var buf = new TextEncoder().encode(str);
    return crypto.subtle.digest('SHA-256', buf).then(function (h) {
      return Array.prototype.map.call(new Uint8Array(h), function (b) {
        return ('0' + b.toString(16)).slice(-2);
      }).join('');
    });
  }

  /* جلسة قائمة؟ اعرض طريقًا مختصرًا بدل إعادة الكتابة */
  try {
    if (sessionStorage.getItem(SS_KEY) === '1') {
      say('You are already signed in — opening the control centre…',
          'أنت مسجّل الدخول بالفعل — يجري فتح مركز التحكّم…');
      setTimeout(function () { location.href = '/admin/index.html'; }, 700);
    }
  } catch (e) {}

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var u = (uEl.value || '').trim();
    var p = pEl.value || '';
    if (!u || !p) {
      say('Enter your username and password.', 'أدخل اسم المستخدم وكلمة المرور.', true);
      return;
    }
    if (!window.crypto || !crypto.subtle) {
      say('This browser is not supported. Use Chrome, Edge, Safari or Firefox over HTTPS.',
          'هذا المتصفّح غير مدعوم. استخدم Chrome أو Edge أو Safari أو Firefox عبر HTTPS.', true);
      return;
    }
    say('Checking…', 'جارٍ التحقق…');

    Promise.all([sha256(u), sha256(u + ':' + p)]).then(function (h) {
      if (h[0] === USER_HASH && h[1] === PASS_HASH) {
        try { sessionStorage.setItem(SS_KEY, '1'); } catch (er) {}
        say('Signed in — opening the control centre…',
            'تم الدخول — يجري فتح مركز التحكّم…');
        setTimeout(function () { location.href = '/admin/index.html'; }, 450);
      } else {
        pEl.value = '';
        pEl.focus();
        say('Incorrect username or password.', 'اسم المستخدم أو كلمة المرور غير صحيحة.', true);
      }
    });
  });
})();
