/**
 * In-memory cache for paginated product list responses.
 * Reduces database load for frequently requested pages (e.g. first page, popular categories).
 * TTL in seconds; default 60. Cache is keyed by (page, limit, category, search, sort).
 */

const DEFAULT_TTL_SEC = 60;
const MAX_ENTRIES = 200;

/** @type {Map<string, { value: unknown; expiresAt: number }>} */
const store = new Map();

/**
 * @param {string} key
 * @returns {unknown | null}
 */
function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * @param {string} key
 * @param {unknown} value
 * @param {number} [ttlSec]
 */
function set(key, value, ttlSec = DEFAULT_TTL_SEC) {
  if (store.size >= MAX_ENTRIES) {
    const firstKey = store.keys().next().value;
    if (firstKey) store.delete(firstKey);
  }
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlSec * 1000,
  });
}

/**
 * Build cache key from list query params.
 * @param {{ page: number; limit: number; category: string; search: string; sort: string }} params
 * @returns {string}
 */
function buildKey(params) {
  return [
    params.page,
    params.limit,
    params.category || '',
    params.search || '',
    params.sort || 'newest',
  ].join('|');
}

/**
 * Invalidate all list cache entries (call after product create/update/delete if needed).
 */
function invalidateAll() {
  store.clear();
}

export default {
  get,
  set,
  buildKey,
  invalidateAll,
};
