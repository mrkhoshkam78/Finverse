/**
 * Finverse Market API Layer
 * Primary source: TGJU (call5.tgju.org) — free, CORS *
 * Covers: forex, gold, silver, coins, global metals
 */
(function (global) {
  'use strict';

  var TGJU_URL = 'https://call5.tgju.org/ajax.json';
  var CACHE_TTL_MS = 60000;
  var cache = { data: null, fetchedAt: 0 };

  var KEY_MAP = {
    price_dollar_rl: 'usd',
    price_eur: 'eur',
    price_gbp: 'gbp',
    price_aed: 'aed',
    'usdt-irr': 'usdt',
    geram18: 'gold18',
    geram24: 'gold24',
    sekee: 'emami',
    sekeb: 'bahar',
    nim: 'half',
    rob: 'quarter',
    silver_999: 'silver',
    ons: 'ounce',
    copper: 'copper',
    base_global_zinc: 'zinc'
  };

  function parsePrice(value) {
    if (value == null || value === '') return 0;
    var n = Number(String(value).replace(/,/g, '').trim());
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
      priceFormatted: isUsd ? formatEn(price, digits || 2) : formatFa(price, digits),
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

    add('price_dollar_rl', 'usd', { unit: 'تومان' });
    add('price_eur', 'eur', { unit: 'تومان' });
    add('price_gbp', 'gbp', { unit: 'تومان' });
    add('price_aed', 'aed', { unit: 'تومان' });
    add('usdt-irr', 'usdt', { unit: 'تومان' });

    add('geram18', 'gold18', { unit: 'تومان / گرم' });
    add('geram24', 'gold24', { unit: 'تومان / گرم' });
    add('sekee', 'emami', { unit: 'تومان' });
    add('sekeb', 'bahar', { unit: 'تومان' });
    add('nim', 'half', { unit: 'تومان' });
    add('rob', 'quarter', { unit: 'تومان' });
    add('silver_999', 'silver', { unit: 'تومان / گرم' });

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

  function clearCache() {
    cache = { data: null, fetchedAt: 0 };
  }

  global.MarketAPI = {
    loadMarketData: loadMarketData,
    getAsset: getAsset,
    clearCache: clearCache,
    KEY_MAP: KEY_MAP,
    formatFa: formatFa,
    formatEn: formatEn,
    toToman: toToman
  };
})(typeof window !== 'undefined' ? window : globalThis);
