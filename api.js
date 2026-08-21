/**
 * Finverse Market API — TGJU
 * Live quotes + daily history for charts
 */
(function (global) {
  'use strict';

  var TGJU_URL = 'https://call5.tgju.org/ajax.json';
  var HISTORY_URL = 'https://api.tgju.org/v1/market/indicator/summary-table-data/';
  var CACHE_TTL_MS = 60000;
  var HISTORY_TTL_MS = 300000;

  var cache = { data: null, fetchedAt: 0 };
  var historyCache = {};

  var HISTORY_KEYS = {
    usd: 'price_dollar_rl',
    eur: 'price_eur',
    gbp: 'price_gbp',
    aed: 'price_aed',
    try: 'price_try',
    sar: 'price_sar',
    gold18: 'geram18',
    gold24: 'geram24',
    emami: 'sekee',
    silver: 'silver_999',
    ounce: 'ons'
  };

  function parsePrice(value) {
    if (value == null || value === '') return 0;
    var n = Number(String(value).replace(/,/g, '').replace(/<[^>]+>/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }

  function toToman(rial) {
    return Math.round(rial / 10);
  }

  function formatFa(n, digits) {
    digits = digits || 0;
    return Number(n).toLocaleString('fa-IR', {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits
    });
  }

  function formatEn(n, digits) {
    digits = digits == null ? 0 : digits;
    return Number(n).toLocaleString('en-US', {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits
    });
  }

  /** Format toman with thousand separators (fa) */
  function formatToman(n) {
    return formatFa(Math.round(Number(n) || 0), 0);
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
      if (!json || typeof json.current !== 'object') {
        throw new Error('TGJU: invalid payload');
      }
      cache = { data: json, fetchedAt: Date.now() };
      return json;
    });
  }

  function normalizeItem(id, raw, opts) {
    opts = opts || {};
    var currency = opts.currency || 'IRT';
    var digits = opts.digits != null ? opts.digits : 0;
    var priceRaw = parsePrice(raw.p);
    var highRaw = parsePrice(raw.h);
    var lowRaw = parsePrice(raw.l);
    var changeRaw = parsePrice(raw.d);
    var changePct = Number(raw.dp) || 0;
    var isUsd = currency === 'USD';
    var price = isUsd ? priceRaw : toToman(priceRaw);
    var high = isUsd ? highRaw : toToman(highRaw);
    var low = isUsd ? lowRaw : toToman(lowRaw);
    var changeValue = isUsd ? changeRaw : toToman(changeRaw);

    return {
      id: id,
      price: price,
      priceRaw: priceRaw,
      priceFormatted: isUsd ? formatEn(price, digits || 2) : formatToman(price),
      high: high,
      low: low,
      changeValue: changeValue,
      changePercent: changePct,
      changeFormatted: (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%',
      isUp: changePct > 0 || (changePct === 0 && changeValue >= 0),
      time: raw.t || raw['t-g'] || '',
      timeEn: raw.t_en || '',
      unit: opts.unit || (isUsd ? 'USD' : 'تومان'),
      currency: currency,
      source: 'TGJU'
    };
  }

  function pick(current, key) {
    return current[key] || null;
  }

  function buildSnapshot(current) {
    var items = {};
    function add(key, id, opts) {
      var raw = pick(current, key);
      if (raw) items[id] = normalizeItem(id, raw, opts);
    }

    // Forex
    add('price_dollar_rl', 'usd', { unit: 'تومان' });
    add('price_eur', 'eur', { unit: 'تومان' });
    add('price_gbp', 'gbp', { unit: 'تومان' });
    add('price_aed', 'aed', { unit: 'تومان' });
    add('price_try', 'try', { unit: 'تومان' });
    add('price_sar', 'sar', { unit: 'تومان' });
    add('price_iqd', 'iqd', { unit: 'تومان' });
    add('price_cad', 'cad', { unit: 'تومان' });
    add('price_aud', 'aud', { unit: 'تومان' });
    add('price_cny', 'cny', { unit: 'تومان' });
    add('usdt-irr', 'usdt', { unit: 'تومان' });

    // Gold / coins / silver
    add('geram18', 'gold18', { unit: 'تومان / گرم' });
    add('geram24', 'gold24', { unit: 'تومان / گرم' });
    add('sekee', 'emami', { unit: 'تومان' });
    add('sekeb', 'bahar', { unit: 'تومان' });
    add('nim', 'half', { unit: 'تومان' });
    add('rob', 'quarter', { unit: 'تومان' });
    add('mesghal', 'mesghal', { unit: 'تومان' });
    add('gerami', 'gerami', { unit: 'تومان' });
    add('silver_999', 'silver', { unit: 'تومان / گرم' });

    // Global metals
    add('ons', 'ounce', { unit: 'USD', currency: 'USD', digits: 2 });
    add('copper', 'copper', { unit: 'USD / ton', currency: 'USD', digits: 2 });
    add('base_global_zinc', 'zinc', { unit: 'USD / ton', currency: 'USD', digits: 2 });

    return {
      items: items,
      updatedAt: new Date().toISOString(),
      source: 'TGJU'
    };
  }

  function loadMarketData(options) {
    options = options || {};
    return fetchTgju(Boolean(options.force)).then(function (json) {
      return buildSnapshot(json.current);
    });
  }

  function getAsset(id, options) {
    return loadMarketData(options || {}).then(function (snap) {
      return snap.items[id] || null;
    });
  }

  /**
   * Daily OHLC history (closes in Toman for IRT assets)
   * @param {string} assetId internal id e.g. usd, gold18
   * @param {number} [days=30]
   * @returns {Promise<number[]>} close prices oldest → newest
   */
  function fetchHistory(assetId, days) {
    days = days || 30;
    var tgjuKey = HISTORY_KEYS[assetId];
    if (!tgjuKey) return Promise.resolve([]);

    var cacheKey = tgjuKey + ':' + days;
    var now = Date.now();
    if (historyCache[cacheKey] && now - historyCache[cacheKey].t < HISTORY_TTL_MS) {
      return Promise.resolve(historyCache[cacheKey].closes);
    }

    var url = HISTORY_URL + encodeURIComponent(tgjuKey) + '?lang=fa';
    return fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('History HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        var rows = (json && json.data) || [];
        // API returns newest first: [open, low, high, close, change, pct, gDate, jDate]
        var closes = [];
        var isUsd = assetId === 'ounce';
        for (var i = 0; i < rows.length && closes.length < days; i++) {
          var row = rows[i];
          if (!row || row.length < 4) continue;
          var closeRial = parsePrice(row[3]);
          closes.push(isUsd ? closeRial : toToman(closeRial));
        }
        closes.reverse(); // oldest → newest
        historyCache[cacheKey] = { closes: closes, t: Date.now() };
        return closes;
      })
      .catch(function () {
        return [];
      });
  }

  function clearCache() {
    cache = { data: null, fetchedAt: 0 };
    historyCache = {};
  }

  global.MarketAPI = {
    loadMarketData: loadMarketData,
    getAsset: getAsset,
    fetchHistory: fetchHistory,
    clearCache: clearCache,
    formatFa: formatFa,
    formatEn: formatEn,
    formatToman: formatToman,
    toToman: toToman,
    HISTORY_KEYS: HISTORY_KEYS
  };
})(typeof window !== 'undefined' ? window : globalThis);
