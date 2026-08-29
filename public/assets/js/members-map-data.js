/* =========================================================================
   SAFTA — members map data + CRM adapter
   =========================================================================

   HOW TO CONNECT THE CRM
   ----------------------
   Leave SAFTA_CRM.endpoint = null and the map renders the local list below.
   To go live, set the endpoint (and token if the API needs one) and adjust
   `record()` so it maps one CRM record onto the shape the map expects:

     window.SAFTA_CRM.endpoint = 'https://crm.safta.sa/api/v1/members';
     window.SAFTA_CRM.token    = '…';          // sent as: Authorization: Bearer …
     window.SAFTA_CRM.record   = function (r) {
       return {
         id: r.accountId, ini: r.shortCode,
         name: r.accountName,   name_ar: r.accountNameAr,
         cat:  r.membershipType, cat_ar: r.membershipTypeAr,
         city: r.city,          city_ar: r.cityAr,
         country: r.country,    country_ar: r.countryAr,
         lat: Number(r.latitude), lng: Number(r.longitude),
         url: '/member?id=' + r.accountId
       };
     };

   The response may be either a bare array or { data: [...] } / { value: [...] }
   (Dynamics/OData style) — both are handled. `cat` must match one of the
   filter chips on members.html: Government · Academic · Private sector ·
   Non-profit.

   NOTE: never put a write-scoped CRM key in front-end code. Expose a
   read-only endpoint, or proxy the CRM through your own backend.
   ========================================================================= */
(function () {
  'use strict';

  /* --- demo records ------------------------------------------------------
     TODO(بيانات): هذه إحداثيات تقريبية لأغراض العرض — استبدلها بسجلات
     التحالف الحقيقية أو اربط الخريطة بالـCRM كما هو موضّح أعلاه.        */
  window.SAFTA_MEMBERS_MAP = [
    { id: 'mewa',      ini: 'MEWA',  cat: 'Government',    cat_ar: 'حكومي',
      name: 'Ministry of Environment, Water & Agriculture', name_ar: 'وزارة البيئة والمياه والزراعة',
      city: 'Riyadh', city_ar: 'الرياض', country: 'Saudi Arabia', country_ar: 'السعودية',
      lat: 24.7136, lng: 46.6753 },
    { id: 'gfsa',      ini: 'GFSA',  cat: 'Government',    cat_ar: 'حكومي',
      name: 'General Food Security Authority', name_ar: 'الهيئة العامة للأمن الغذائي',
      city: 'Riyadh', city_ar: 'الرياض', country: 'Saudi Arabia', country_ar: 'السعودية',
      lat: 24.6877, lng: 46.7219 },
    { id: 'sfda',      ini: 'SFDA',  cat: 'Government',    cat_ar: 'حكومي',
      name: 'Saudi Food & Drug Authority', name_ar: 'الهيئة العامة للغذاء والدواء',
      city: 'Riyadh', city_ar: 'الرياض', country: 'Saudi Arabia', country_ar: 'السعودية',
      lat: 24.7743, lng: 46.7386 },
    { id: 'monshaat',  ini: 'MON',   cat: 'Government',    cat_ar: 'حكومي',
      name: 'Monsha’at — SME Authority', name_ar: 'منشآت — هيئة المنشآت الصغيرة والمتوسطة',
      city: 'Riyadh', city_ar: 'الرياض', country: 'Saudi Arabia', country_ar: 'السعودية',
      lat: 24.7500, lng: 46.6700 },
    { id: 'kacst',     ini: 'KACST', cat: 'Academic',      cat_ar: 'أكاديمي',
      name: 'King Abdulaziz City for Science & Technology', name_ar: 'مدينة الملك عبدالعزيز للعلوم والتقنية',
      city: 'Riyadh', city_ar: 'الرياض', country: 'Saudi Arabia', country_ar: 'السعودية',
      lat: 24.7212, lng: 46.6218 },
    { id: 'kaust',     ini: 'KAUST', cat: 'Academic',      cat_ar: 'أكاديمي',
      name: 'King Abdullah University of Science & Technology', name_ar: 'جامعة الملك عبدالله للعلوم والتقنية',
      city: 'Thuwal', city_ar: 'ثول', country: 'Saudi Arabia', country_ar: 'السعودية',
      lat: 22.3095, lng: 39.1046 },
    { id: 'ksu-agri',  ini: 'KSU',   cat: 'Academic',      cat_ar: 'أكاديمي',
      name: 'King Saud University — College of Food & Agriculture', name_ar: 'جامعة الملك سعود — كلية علوم الأغذية والزراعة',
      city: 'Riyadh', city_ar: 'الرياض', country: 'Saudi Arabia', country_ar: 'السعودية',
      lat: 24.7255, lng: 46.6196 },
    { id: 'nadec',     ini: 'NAD',   cat: 'Private sector', cat_ar: 'قطاع خاص',
      name: 'National Agricultural Development Co. (NADEC)', name_ar: 'الشركة الوطنية للتنمية الزراعية (نادك)',
      city: 'Riyadh', city_ar: 'الرياض', country: 'Saudi Arabia', country_ar: 'السعودية',
      lat: 24.6408, lng: 46.7728 },
    { id: 'almarai',   ini: 'ALM',   cat: 'Private sector', cat_ar: 'قطاع خاص',
      name: 'Almarai', name_ar: 'المراعي',
      city: 'Riyadh', city_ar: 'الرياض', country: 'Saudi Arabia', country_ar: 'السعودية',
      lat: 24.8395, lng: 46.7050 },
    { id: 'neom-food', ini: 'NEOM',  cat: 'Private sector', cat_ar: 'قطاع خاص',
      name: 'NEOM Food', name_ar: 'نيوم للغذاء',
      city: 'NEOM, Tabuk', city_ar: 'نيوم، تبوك', country: 'Saudi Arabia', country_ar: 'السعودية',
      lat: 28.0000, lng: 35.3000 },
    { id: 'wateer',    ini: 'WTR',   cat: 'Non-profit',    cat_ar: 'غير ربحي',
      name: 'Water Conservation Society', name_ar: 'جمعية ترشيد استهلاك المياه',
      city: 'Riyadh', city_ar: 'الرياض', country: 'Saudi Arabia', country_ar: 'السعودية',
      lat: 24.7000, lng: 46.6800 },
    { id: 'foodbank',  ini: 'ETA',   cat: 'Non-profit',    cat_ar: 'غير ربحي',
      name: 'Saudi Food Bank (Eta’am)', name_ar: 'بنك الطعام السعودي (إطعام)',
      city: 'Jeddah', city_ar: 'جدة', country: 'Saudi Arabia', country_ar: 'السعودية',
      lat: 21.5433, lng: 39.1728 }
  ];

  /* --- CRM adapter ----------------------------------------------------- */
  window.SAFTA_CRM = {
    endpoint: null,
    token: null,

    /* shape one CRM record — override to match your field names */
    record: function (r) {
      return {
        id: r.id, ini: r.ini, cat: r.cat, cat_ar: r.cat_ar,
        name: r.name, name_ar: r.name_ar,
        city: r.city, city_ar: r.city_ar,
        country: r.country, country_ar: r.country_ar,
        lat: Number(r.lat), lng: Number(r.lng),
        url: r.url || ('/member?id=' + r.id)
      };
    },

    /* resolves with an array of map-ready records; never rejects */
    load: function () {
      var self = this;
      var local = (window.SAFTA_MEMBERS_MAP || []).map(function (m) {
        return self.record(m);
      });
      if (!this.endpoint) return Promise.resolve(local);

      var opts = { headers: { Accept: 'application/json' } };
      if (this.token) opts.headers.Authorization = 'Bearer ' + this.token;

      return fetch(this.endpoint, opts)
        .then(function (r) {
          if (!r.ok) throw new Error('CRM responded ' + r.status);
          return r.json();
        })
        .then(function (j) {
          var rows = Array.isArray(j) ? j : (j.data || j.value || j.records || []);
          var out = rows.map(function (r) { return self.record(r); })
                        .filter(function (m) { return isFinite(m.lat) && isFinite(m.lng); });
          return out.length ? out : local;
        })
        .catch(function (e) {
          console.warn('[SAFTA] CRM unreachable, falling back to local records:', e.message);
          return local;
        });
    }
  };
})();
