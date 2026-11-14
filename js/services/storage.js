/**
 * Safe localStorage wrapper. Storage can throw (private mode, quota, disabled
 * cookies), and persisted JSON can be corrupt — neither should break the app.
 */

/** @param {string} key @param {*} fallback */
export function read(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[storage] could not read "${key}"`, error);
    return fallback;
  }
}

/** @param {string} key @param {*} value */
export function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`[storage] could not write "${key}"`, error);
    return false;
  }
}

/** @param {string} key */
export function remove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn(`[storage] could not remove "${key}"`, error);
  }
}

/** Is storage usable at all? Used to warn once when persistence is unavailable. */
export function isAvailable() {
  try {
    const probe = '__zenmaps_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}
