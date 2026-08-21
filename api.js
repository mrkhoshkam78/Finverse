/**
 * Live Market Price API Layer
 * Source: TGJU (call5.tgju.org) — free, CORS-enabled
 * Clean, modular, no external dependencies
 */

const TGJU_URL = 'https://call5.tgju.org/ajax.json';
const CACHE_TTL_MS = 60_000; // 1 minute client cache

/** @type {{ data: object|null, fetchedAt: number }} */
let _cache = { data: null, fetchedAt: 0 };

/** TGJU key → internal asset id */
const KEY_MAP = {
  price_dollar_rl: 'usd',
  price_eur: 'eur',
  price_gbp: 'gbp',
  price_aed: 'aed',
  geram18: 'gold18',
  geram24: 'gold24',
  sekee: 'emami',
  sekeb: 'bahar',
  nim: 'half',
  rob: 'quarter',
  silver_999: 'silver',
  ons: 'ounce',
  'usdt-irr': 'usdt',
};

/**
 * Parse TGJU price string → number (Rial)
 * @param {string|number} value
 * @returns {number}
 */
function parsePrice(value) {
  if (value == null) return 0;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

/**
 * Rial → Toman (display unit used on site)
 * @param {number} rial
 * @returns {number}
 */
function toToman(rial) {
  return Math.round(rial / 10);
}

/**
 * Format number with Persian locale separators
 * @param {number} n
 * @returns {string}
 */
function formatNumber(n) {
  return Math.round(n).toLocaleString('fa-IR');
}

/**
 * Fetch raw TGJU payload (with short client cache)
 * @param {boolean} [force=false]
 * @returns {Promise<object>}
 */
async function fetchTgju(force = false) {
  const now = Date.now();
  if (!force && _cache.data && now - _cache.fetchedAt < CACHE_TTL_MS) {
    return _cache.data;
  }

  const res = await fetch(TGJU_URL, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`TGJU HTTP ${res.status}`);
  }

  const json = await res.json();
  if (!json || !json.current) {
    throw new Error('TGJU: invalid payload');
  }

  _cache = { data: json, fetchedAt: now };
  return json;
}

/**
 * Normalize one TGJU item into UI-friendly shape
 * @param {string} id
 * @param {object} raw
 * @param {{ unit?: string, isUsd?: boolean }} [opts]
 */
function normalizeItem(id, raw, opts = {}) {
  const priceRial = parsePrice(raw.p);
  const highRial = parsePrice(raw.h);
  const lowRial = parsePrice(raw.l);
  const changeVal = parsePrice(raw.d);
  const changePct = Number(raw.dp) || 0;
  const isUsd = Boolean(opts.isUsd);
  const price = isUsd ? priceRial : toToman(priceRial);

  return {
    id,
    price,
    priceRaw: priceRial,
    priceFormatted: isUsd
      ? priceRial.toLocaleString('en-US', { maximumFractionDigits: 2 })
      : formatNumber(price),
    high: isUsd ? highRial : toToman(highRial),
    low: isUsd ? lowRial : toToman(lowRial),
    changeValue: isUsd ? changeVal : toToman(changeVal),
    changePercent: changePct,
    changeFormatted: `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}٪`,
    isUp: changePct > 0 || (changePct === 0 && changeVal >= 0),
    time: raw.t || raw['t-g'] || '',
    timeEn: raw.t_en || '',
    unit: opts.unit || 'تومان',
    source: 'TGJU',
  };
}

/**
 * Build structured market snapshot from TGJU current object
 * @param {object} current
 */
function buildSnapshot(current) {
  const get = (key) => current[key] || null;

  const usd = get('price_dollar_rl');
  const eur = get('price_eur');
  const gbp = get('price_gbp');
  const aed = get('price_aed');
  const gold18 = get('geram18');
  const gold24 = get('geram24');
  const emami = get('sekee');
  const bahar = get('sekeb');
  const half = get('nim');
  const quarter = get('rob');
  const silver = get('silver_999');
  const ounce = get('ons');
  const usdt = get('usdt-irr');

  const items = {};

  if (usd) items.usd = normalizeItem('usd', usd, { unit: 'تومان' });
  if (eur) items.eur = normalizeItem('eur', eur, { unit: 'تومان' });
  if (gbp) items.gbp = normalizeItem('gbp', gbp, { unit: 'تومان' });
  if (aed) items.aed = normalizeItem('aed', aed, { unit: 'تومان' });
  if (gold18) items.gold18 = normalizeItem('gold18', gold18, { unit: 'تومان / گرم' });
  if (gold24) items.gold24 = normalizeItem('gold24', gold24, { unit: 'تومان / گرم' });
  if (emami) items.emami = normalizeItem('emami', emami, { unit: 'تومان' });
  if (bahar) items.bahar = normalizeItem('bahar', bahar, { unit: 'تومان' });
  if (half) items.half = normalizeItem('half', half, { unit: 'تومان' });
  if (quarter) items.quarter = normalizeItem('quarter', quarter, { unit: 'تومان' });
  if (silver) items.silver = normalizeItem('silver', silver, { unit: 'تومان / گرم' });
  if (ounce) items.ounce = normalizeItem('ounce', ounce, { unit: 'USD', isUsd: true });
  if (usdt) items.usdt = normalizeItem('usdt', usdt, { unit: 'تومان' });

  return {
    items,
    updatedAt: new Date().toISOString(),
    source: 'TGJU',
  };
}

/**
 * Public API: load live market data
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<{ items: Record<string, object>, updatedAt: string, source: string }>}
 */
async function loadMarketData(options = {}) {
  const json = await fetchTgju(Boolean(options.force));
  return buildSnapshot(json.current);
}

/**
 * Get single asset by internal id
 * @param {string} id
 * @param {{ force?: boolean }} [options]
 */
async function getAsset(id, options = {}) {
  const snap = await loadMarketData(options);
  return snap.items[id] || null;
}

/**
 * Clear client cache (force next fetch)
 */
function clearCache() {
  _cache = { data: null, fetchedAt: 0 };
}

// Global API surface (classic script — no bundler required)
window.MarketAPI = {
  loadMarketData,
  getAsset,
  clearCache,
  KEY_MAP,
  formatNumber,
  toToman,
};
