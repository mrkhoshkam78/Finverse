/**
 * Finverse Market API — TGJU
 * Auto-discovers currencies; no hardcoded prices
 */
(function (global) {
  'use strict';

  var TGJU_URL = 'https://call5.tgju.org/ajax.json';
  var HISTORY_URL = 'https://api.tgju.org/v1/market/indicator/summary-table-data/';
  var CACHE_TTL_MS = 60000;
  var HISTORY_TTL_MS = 300000;

  var cache = { data: null, fetchedAt: 0 };
  var historyCache = {};

  /** ISO → { nameFa, nameEn, country (ISO 3166-1 alpha-2 for flag) } */
  var CURRENCY_META = {
    USD: { nameFa: 'دلار آمریکا', nameEn: 'US Dollar', country: 'us' },
    EUR: { nameFa: 'یورو', nameEn: 'Euro', country: 'eu' },
    GBP: { nameFa: 'پوند انگلیس', nameEn: 'British Pound', country: 'gb' },
    CHF: { nameFa: 'فرانک سوئیس', nameEn: 'Swiss Franc', country: 'ch' },
    CAD: { nameFa: 'دلار کانادا', nameEn: 'Canadian Dollar', country: 'ca' },
    AUD: { nameFa: 'دلار استرالیا', nameEn: 'Australian Dollar', country: 'au' },
    JPY: { nameFa: 'ین ژاپن', nameEn: 'Japanese Yen', country: 'jp' },
    CNY: { nameFa: 'یوان چین', nameEn: 'Chinese Yuan', country: 'cn' },
    TRY: { nameFa: 'لیر ترکیه', nameEn: 'Turkish Lira', country: 'tr' },
    AED: { nameFa: 'درهم امارات', nameEn: 'UAE Dirham', country: 'ae' },
    SAR: { nameFa: 'ریال سعودی', nameEn: 'Saudi Riyal', country: 'sa' },
    IQD: { nameFa: 'دینار عراق', nameEn: 'Iraqi Dinar', country: 'iq' },
    INR: { nameFa: 'روپیه هند', nameEn: 'Indian Rupee', country: 'in' },
    PKR: { nameFa: 'روپیه پاکستان', nameEn: 'Pakistani Rupee', country: 'pk' },
    AFN: { nameFa: 'افغانی', nameEn: 'Afghan Afghani', country: 'af' },
    RUB: { nameFa: 'روبل روسیه', nameEn: 'Russian Ruble', country: 'ru' },
    KRW: { nameFa: 'وون کره', nameEn: 'South Korean Won', country: 'kr' },
    SEK: { nameFa: 'کرون سوئد', nameEn: 'Swedish Krona', country: 'se' },
    NOK: { nameFa: 'کرون نروژ', nameEn: 'Norwegian Krone', country: 'no' },
    DKK: { nameFa: 'کرون دانمارک', nameEn: 'Danish Krone', country: 'dk' },
    PLN: { nameFa: 'زلوتی لهستان', nameEn: 'Polish Zloty', country: 'pl' },
    BRL: { nameFa: 'رئال برزیل', nameEn: 'Brazilian Real', country: 'br' },
    MXN: { nameFa: 'پزو مکزیک', nameEn: 'Mexican Peso', country: 'mx' },
    ZAR: { nameFa: 'راند آفریقای جنوبی', nameEn: 'South African Rand', country: 'za' },
    NZD: { nameFa: 'دلار نیوزیلند', nameEn: 'New Zealand Dollar', country: 'nz' },
    SGD: { nameFa: 'دلار سنگاپور', nameEn: 'Singapore Dollar', country: 'sg' },
    HKD: { nameFa: 'دلار هنگ‌کنگ', nameEn: 'Hong Kong Dollar', country: 'hk' },
    THB: { nameFa: 'بات تایلند', nameEn: 'Thai Baht', country: 'th' },
    MYR: { nameFa: 'رینگیت مالزی', nameEn: 'Malaysian Ringgit', country: 'my' },
    IDR: { nameFa: 'روپیه اندونزی', nameEn: 'Indonesian Rupiah', country: 'id' },
    PHP: { nameFa: 'پزو فیلیپین', nameEn: 'Philippine Peso', country: 'ph' },
    VND: { nameFa: 'دانگ ویتنام', nameEn: 'Vietnamese Dong', country: 'vn' },
    EGP: { nameFa: 'پوند مصر', nameEn: 'Egyptian Pound', country: 'eg' },
    QAR: { nameFa: 'ریال قطر', nameEn: 'Qatari Riyal', country: 'qa' },
    KWD: { nameFa: 'دینار کویت', nameEn: 'Kuwaiti Dinar', country: 'kw' },
    BHD: { nameFa: 'دینار بحرین', nameEn: 'Bahraini Dinar', country: 'bh' },
    OMR: { nameFa: 'ریال عمان', nameEn: 'Omani Rial', country: 'om' },
    JOD: { nameFa: 'دینار اردن', nameEn: 'Jordanian Dinar', country: 'jo' },
    LBP: { nameFa: 'لیر لبنان', nameEn: 'Lebanese Pound', country: 'lb' },
    SYP: { nameFa: 'لیر سوریه', nameEn: 'Syrian Pound', country: 'sy' },
    AMD: { nameFa: 'درام ارمنستان', nameEn: 'Armenian Dram', country: 'am' },
    AZN: { nameFa: 'منات آذربایجان', nameEn: 'Azerbaijani Manat', country: 'az' },
    GEL: { nameFa: 'لاری گرجستان', nameEn: 'Georgian Lari', country: 'ge' },
    TJS: { nameFa: 'سامانی تاجیکستان', nameEn: 'Tajikistani Somoni', country: 'tj' },
    TMT: { nameFa: 'منات ترکمنستان', nameEn: 'Turkmenistani Manat', country: 'tm' },
    UZS: { nameFa: 'سوم ازبکستان', nameEn: 'Uzbekistani Som', country: 'uz' },
    KGS: { nameFa: 'سوم قرقیزستان', nameEn: 'Kyrgyzstani Som', country: 'kg' },
    KZT: { nameFa: 'تنگه قزاقستان', nameEn: 'Kazakhstani Tenge', country: 'kz' },
    IRR: { nameFa: 'ریال ایران', nameEn: 'Iranian Rial', country: 'ir' },
    USDT: { nameFa: 'تتر', nameEn: 'Tether', country: 'us' }
  };

  /** TGJU special key → ISO */
  var SPECIAL_KEYS = {
    price_dollar_rl: 'USD',
    price_dollar_dt: 'USD',
    price_eur: 'EUR',
    price_gbp: 'GBP',
    price_aed: 'AED',
    'usdt-irr': 'USDT'
  };

  /** Skip non-fiat / noisy keys */
  var SKIP_SUBSTR = [
    'gold', 'coin', 'oil', 'future', 'afshar', 'dubai', 'ex', 'sm', 'buy', 'sell',
    'bch', 'eos', 'xrp', 'eth', 'btc', 'doge', 'crypto', 'tether_gold'
  ];

  function parsePrice(value) {
    if (value == null || value === '') return null;
    var n = Number(String(value).replace(/,/g, '').replace(/<[^>]+>/g, '').trim());
    return Number.isFinite(n) ? n : null;
  }

  function toToman(rial) {
    if (rial == null) return null;
    return Math.round(rial / 10);
  }

  function formatFa(n, digits) {
    if (n == null || !Number.isFinite(Number(n))) return null;
    digits = digits || 0;
    return Number(n).toLocaleString('fa-IR', {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits
    });
  }

  function formatToman(n) {
    var v = formatFa(Math.round(Number(n)), 0);
    return v;
  }

  function fetchTgju(force) {
    var now = Date.now();
    if (!force && cache.data && now - cache.fetchedAt < CACHE_TTL_MS) {
      return Promise.resolve(cache.data);
    }
    return fetch(TGJU_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    }).then(function (res) {
      if (!res.ok) throw new Error('TGJU HTTP ' + res.status);
      return res.json();
    }).then(function (json) {
      if (!json || typeof json.current !== 'object') throw new Error('TGJU: invalid payload');
      cache = { data: json, fetchedAt: Date.now() };
      return json;
    });
  }

  function shouldSkipKey(key) {
    var low = key.toLowerCase();
    for (var i = 0; i < SKIP_SUBSTR.length; i++) {
      if (low.indexOf(SKIP_SUBSTR[i]) !== -1) return true;
    }
    return false;
  }

  /**
   * Extract ISO code from TGJU key
   * price_eur → EUR, price_dollar_rl → USD via SPECIAL
   */
  function keyToIso(key) {
    if (SPECIAL_KEYS[key]) return SPECIAL_KEYS[key];
    if (key === 'usdt-irr') return 'USDT';
    if (!key.startsWith('price_')) return null;
    var rest = key.slice(6); // after price_
    if (!rest || rest.length < 3 || rest.length > 4) return null;
    if (!/^[a-z]{3,4}$/i.test(rest)) return null;
    return rest.toUpperCase();
  }

  function normalizeCurrency(key, raw, iso) {
    var meta = CURRENCY_META[iso] || {
      nameFa: iso,
      nameEn: iso,
      country: ''
    };
    var priceRial = parsePrice(raw.p);
    var highRial = parsePrice(raw.h);
    var lowRial = parsePrice(raw.l);
    var changeRial = parsePrice(raw.d);
    var changePct = raw.dp != null && raw.dp !== '' ? Number(raw.dp) : null;

    var price = priceRial != null ? toToman(priceRial) : null;
    var high = highRial != null ? toToman(highRial) : null;
    var low = lowRial != null ? toToman(lowRial) : null;
    var changeValue = changeRial != null ? toToman(changeRial) : null;

    return {
      id: iso.toLowerCase(),
      iso: iso,
      tgjuKey: key,
      nameFa: meta.nameFa,
      nameEn: meta.nameEn,
      country: meta.country,
      flagUrl: meta.country ? ('https://flagcdn.com/24x18/' + meta.country + '.png') : null,
      price: price,
      priceFormatted: price != null ? formatToman(price) : null,
      high: high,
      highFormatted: high != null ? formatToman(high) : null,
      low: low,
      lowFormatted: low != null ? formatToman(low) : null,
      changeValue: changeValue,
      changePercent: changePct != null && Number.isFinite(changePct) ? changePct : null,
      changeFormatted: changePct != null && Number.isFinite(changePct)
        ? ((changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%')
        : null,
      isUp: changePct != null ? changePct >= 0 : null,
      time: raw.t || raw['t-g'] || null,
      timeEn: raw.t_en || null,
      timestamp: raw.ts || null,
      unit: 'تومان',
      source: 'TGJU',
      available: price != null
    };
  }

  /**
   * Auto-discover all fiat currencies from TGJU current payload
   * Prefer price_dollar_rl over other USD variants
   */
  function extractCurrencies(current) {
    var byIso = {};
    var preferredUsd = null;

    Object.keys(current).forEach(function (key) {
      var raw = current[key];
      if (!raw || typeof raw !== 'object' || raw.p == null) return;
      if (shouldSkipKey(key)) return;

      var iso = keyToIso(key);
      if (!iso) return;
      // Prefer main market USD
      if (iso === 'USD') {
        if (key === 'price_dollar_rl') preferredUsd = normalizeCurrency(key, raw, iso);
        else if (!preferredUsd && !byIso.USD) byIso.USD = normalizeCurrency(key, raw, iso);
        return;
      }
      // First occurrence wins unless we already have better
      if (!byIso[iso]) {
        byIso[iso] = normalizeCurrency(key, raw, iso);
      }
    });

    if (preferredUsd) byIso.USD = preferredUsd;

    // usdt-irr
    if (current['usdt-irr'] && !byIso.USDT) {
      byIso.USDT = normalizeCurrency('usdt-irr', current['usdt-irr'], 'USDT');
    }

    var list = Object.keys(byIso).map(function (k) { return byIso[k]; });
    // Sort: major first, then alpha
    var major = ['USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY', 'CNY', 'TRY', 'AED', 'SAR', 'INR'];
    list.sort(function (a, b) {
      var ia = major.indexOf(a.iso);
      var ib = major.indexOf(b.iso);
      if (ia === -1) ia = 999;
      if (ib === -1) ib = 999;
      if (ia !== ib) return ia - ib;
      return a.iso.localeCompare(b.iso);
    });
    return list;
  }

  // Legacy snapshot for gold / metals (unchanged keys)
  function normalizeItem(id, raw, opts) {
    opts = opts || {};
    var currency = opts.currency || 'IRT';
    var priceRaw = parsePrice(raw.p);
    var highRaw = parsePrice(raw.h);
    var lowRaw = parsePrice(raw.l);
    var changeRaw = parsePrice(raw.d);
    var changePct = raw.dp != null ? Number(raw.dp) : null;
    var isUsd = currency === 'USD';
    var price = priceRaw == null ? null : (isUsd ? priceRaw : toToman(priceRaw));
    return {
      id: id,
      price: price,
      priceFormatted: price == null ? null : (isUsd ? formatFa(price, 2) : formatToman(price)),
      high: highRaw == null ? null : (isUsd ? highRaw : toToman(highRaw)),
      low: lowRaw == null ? null : (isUsd ? lowRaw : toToman(lowRaw)),
      changeValue: changeRaw == null ? null : (isUsd ? changeRaw : toToman(changeRaw)),
      changePercent: changePct,
      changeFormatted: changePct != null ? ((changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%') : null,
      isUp: changePct != null ? changePct >= 0 : null,
      unit: opts.unit || 'تومان',
      source: 'TGJU',
      available: price != null
    };
  }

  function buildSnapshot(current) {
    var items = {};
    function add(key, id, opts) {
      if (current[key]) items[id] = normalizeItem(id, current[key], opts);
    }
    add('price_dollar_rl', 'usd', { unit: 'تومان' });
    add('price_eur', 'eur', { unit: 'تومان' });
    add('price_gbp', 'gbp', { unit: 'تومان' });
    add('price_aed', 'aed', { unit: 'تومان' });
    add('price_try', 'try', { unit: 'تومان' });
    add('price_sar', 'sar', { unit: 'تومان' });
    add('geram18', 'gold18', { unit: 'تومان / گرم' });
    add('geram24', 'gold24', { unit: 'تومان / گرم' });
    add('sekee', 'emami', { unit: 'تومان' });
    add('sekeb', 'bahar', { unit: 'تومان' });
    add('nim', 'half', { unit: 'تومان' });
    add('rob', 'quarter', { unit: 'تومان' });
    add('mesghal', 'mesghal', { unit: 'تومان' });
    add('silver_999', 'silver', { unit: 'تومان / گرم' });
    add('ons', 'ounce', { unit: 'USD', currency: 'USD' });
    add('copper', 'copper', { unit: 'USD / ton', currency: 'USD' });
    add('base_global_zinc', 'zinc', { unit: 'USD / ton', currency: 'USD' });
    return { items: items, updatedAt: new Date().toISOString(), source: 'TGJU' };
  }

  function loadMarketData(options) {
    options = options || {};
    return fetchTgju(Boolean(options.force)).then(function (json) {
      return buildSnapshot(json.current);
    });
  }

  /**
   * Load all currencies auto-discovered from API
   * @returns {Promise<{currencies: Array, updatedAt: string, source: string, status: string, error: string|null}>}
   */
  function loadCurrencies(options) {
    options = options || {};
    return fetchTgju(Boolean(options.force))
      .then(function (json) {
        var list = extractCurrencies(json.current);
        return {
          currencies: list,
          updatedAt: new Date().toISOString(),
          source: 'TGJU',
          status: 'ok',
          error: null,
          count: list.length
        };
      })
      .catch(function (err) {
        return {
          currencies: [],
          updatedAt: null,
          source: 'TGJU',
          status: 'error',
          error: String(err && err.message ? err.message : err),
          count: 0
        };
      });
  }

  /**
   * Convert amount using live rates (both priced in Toman vs IRR base)
   * rate(iso) = toman per 1 unit of foreign currency
   */
  function convert(amount, fromIso, toIso, currencies) {
    amount = Number(amount);
    if (!Number.isFinite(amount) || !currencies || !currencies.length) {
      return { value: null, available: false };
    }
    var map = {};
    currencies.forEach(function (c) {
      if (c.available && c.price != null) map[c.iso] = c.price;
    });
    // IRR/Toman: 1 Toman = 1 when working in toman units
    map.IRT = 1;
    map.IRR = 0.1; // 1 Rial = 0.1 Toman approximately display; prefer IRT

    if (fromIso === 'IRT' || fromIso === 'TMN') fromIso = 'IRT';
    if (toIso === 'IRT' || toIso === 'TMN') toIso = 'IRT';

    var fromRate = map[fromIso];
    var toRate = map[toIso];
    if (fromRate == null || toRate == null || fromRate === 0) {
      return { value: null, available: false };
    }
    // amount in from → toman → to
    var inToman = fromIso === 'IRT' ? amount : amount * fromRate;
    var result = toIso === 'IRT' ? inToman : inToman / toRate;
    return { value: result, available: true };
  }

  function fetchHistory(tgjuKeyOrId, days) {
    days = days || 30;
    var key = tgjuKeyOrId;
    // allow internal ids usd/gold18
    var ID_MAP = {
      usd: 'price_dollar_rl', eur: 'price_eur', gbp: 'price_gbp',
      aed: 'price_aed', try: 'price_try', sar: 'price_sar',
      gold18: 'geram18', gold24: 'geram24', emami: 'sekee', silver: 'silver_999', ounce: 'ons'
    };
    if (ID_MAP[key]) key = ID_MAP[key];
    if (!key) return Promise.resolve([]);

    var cacheKey = key + ':' + days;
    var now = Date.now();
    if (historyCache[cacheKey] && now - historyCache[cacheKey].t < HISTORY_TTL_MS) {
      return Promise.resolve(historyCache[cacheKey].closes);
    }

    var url = HISTORY_URL + encodeURIComponent(key) + '?lang=fa';
    return fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('History HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        var rows = (json && json.data) || [];
        var closes = [];
        var isUsdGlobal = key === 'ons';
        for (var i = 0; i < rows.length && closes.length < days; i++) {
          var row = rows[i];
          if (!row || row.length < 4) continue;
          var closeRial = parsePrice(row[3]);
          if (closeRial == null) continue;
          closes.push(isUsdGlobal ? closeRial : toToman(closeRial));
        }
        closes.reverse();
        historyCache[cacheKey] = { closes: closes, t: Date.now() };
        return closes;
      })
      .catch(function () { return []; });
  }

  function clearCache() {
    cache = { data: null, fetchedAt: 0 };
    historyCache = {};
  }

  global.MarketAPI = {
    loadMarketData: loadMarketData,
    loadCurrencies: loadCurrencies,
    convert: convert,
    fetchHistory: fetchHistory,
    clearCache: clearCache,
    formatFa: formatFa,
    formatToman: formatToman,
    toToman: toToman,
    CURRENCY_META: CURRENCY_META
  };
})(typeof window !== 'undefined' ? window : globalThis);
