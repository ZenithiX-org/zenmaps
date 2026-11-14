/**
 * Application state.
 *
 * A tiny observable store: state lives in one plain object, mutations go through
 * the functions below, and views subscribe to the events they care about. This
 * keeps UI code free of persistence details and makes behaviour predictable.
 *
 * @typedef {Object} Place
 * @property {string} id
 * @property {string} name
 * @property {string} context  human readable region / address
 * @property {number} lat
 * @property {number} lon
 * @property {string} [kind]   OSM type, e.g. "city", "attraction"
 * @property {string} [category]
 * @property {string} [note]   optional extra line for popups
 */

import { APP, STORAGE_KEYS } from './config.js';
import * as storage from './services/storage.js';
import { placeId } from './utils/geo.js';

/** @type {{
 *   theme: 'light'|'dark',
 *   units: 'km'|'mi',
 *   basemap: string|null,
 *   saved: Place[],
 *   home: Place|null,
 *   recents: string[],
 *   results: Place[],
 *   activeId: string|null,
 *   query: string,
 *   message: string,
 *   status: 'idle'|'loading'|'ready'|'empty'|'error',
 * }} */
export const state = {
  theme: 'light',
  units: 'km',
  basemap: null,
  saved: [],
  home: null,
  recents: [],
  results: [],
  activeId: null,
  query: '',
  message: '',
  status: 'idle',
};

/* -------------------------------------------------------------------------- */
/* Events                                                                      */
/* -------------------------------------------------------------------------- */

/** @type {Map<string, Set<Function>>} */
const listeners = new Map();

/**
 * Subscribe to a state event.
 * @param {string} event
 * @param {(payload?: any) => void} handler
 * @returns {() => void} unsubscribe
 */
export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => listeners.get(event)?.delete(handler);
}

/**
 * @param {string} event
 * @param {any} [payload]
 */
export function emit(event, payload) {
  listeners.get(event)?.forEach((handler) => {
    try {
      handler(payload);
    } catch (error) {
      console.error(`[state] listener for "${event}" failed`, error);
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Sanitising persisted data                                                   */
/* -------------------------------------------------------------------------- */

function isValidPlace(value) {
  return (
    value &&
    typeof value === 'object' &&
    Number.isFinite(Number(value.lat)) &&
    Number.isFinite(Number(value.lon)) &&
    Math.abs(Number(value.lat)) <= 90 &&
    Math.abs(Number(value.lon)) <= 180
  );
}

/** @param {any} value @returns {Place | null} */
function toStoredPlace(value) {
  if (!isValidPlace(value)) return null;
  return {
    id: String(value.id || placeId(value)),
    name: String(value.name || 'Unnamed place').slice(0, 160),
    context: String(value.context || '').slice(0, 240),
    lat: Number(value.lat),
    lon: Number(value.lon),
    kind: value.kind ? String(value.kind) : undefined,
    category: value.category ? String(value.category) : undefined,
  };
}

/* -------------------------------------------------------------------------- */
/* Loading                                                                     */
/* -------------------------------------------------------------------------- */

/** Read persisted preferences into state. Call once at startup. */
export function load() {
  const storedTheme = storage.read(STORAGE_KEYS.theme, null);
  state.theme =
    storedTheme === 'dark' || storedTheme === 'light'
      ? storedTheme
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';

  const storedUnits = storage.read(STORAGE_KEYS.units, 'km');
  state.units = storedUnits === 'mi' ? 'mi' : 'km';

  const storedBasemap = storage.read(STORAGE_KEYS.basemap, null);
  state.basemap = typeof storedBasemap === 'string' ? storedBasemap : null;

  const saved = storage.read(STORAGE_KEYS.saved, []);
  state.saved = Array.isArray(saved)
    ? saved.map(toStoredPlace).filter((place) => Boolean(place)).slice(0, APP.savedLimit)
    : [];

  state.home = toStoredPlace(storage.read(STORAGE_KEYS.home, null));

  const recents = storage.read(STORAGE_KEYS.recents, []);
  state.recents = Array.isArray(recents)
    ? recents.filter((item) => typeof item === 'string').slice(0, APP.recentLimit)
    : [];

  return state;
}

/* -------------------------------------------------------------------------- */
/* Preferences                                                                 */
/* -------------------------------------------------------------------------- */

/** @param {'light'|'dark'} theme */
export function setTheme(theme) {
  if (theme !== 'dark' && theme !== 'light') return;
  if (state.theme === theme) return;
  state.theme = theme;
  storage.write(STORAGE_KEYS.theme, theme);
  emit('theme', theme);
}

export function toggleTheme() {
  setTheme(state.theme === 'dark' ? 'light' : 'dark');
}

/**
 * Adopt the operating system theme without persisting it, so the app keeps
 * following the OS until the user picks a theme explicitly.
 * @param {'light'|'dark'} theme
 */
export function adoptTheme(theme) {
  if (theme !== 'dark' && theme !== 'light') return;
  if (state.theme === theme) return;
  state.theme = theme;
  emit('theme', theme);
}

/** @param {'km'|'mi'} units */
export function setUnits(units) {
  const next = units === 'mi' ? 'mi' : 'km';
  if (state.units === next) return;
  state.units = next;
  storage.write(STORAGE_KEYS.units, next);
  emit('units', next);
}

export function toggleUnits() {
  setUnits(state.units === 'km' ? 'mi' : 'km');
}

/** @param {string} id */
export function setBasemap(id) {
  if (state.basemap === id) return;
  state.basemap = id;
  storage.write(STORAGE_KEYS.basemap, id);
  emit('basemap', id);
}

/* -------------------------------------------------------------------------- */
/* Saved places                                                                */
/* -------------------------------------------------------------------------- */

/** @param {string} id */
export function isSaved(id) {
  return state.saved.some((place) => place.id === id);
}

/**
 * Add or remove a saved place.
 * @param {Place} place
 * @returns {boolean} true when the place is now saved
 */
export function toggleSaved(place) {
  const id = place.id || placeId(place);
  const saved = isSaved(id);

  if (saved) {
    state.saved = state.saved.filter((item) => item.id !== id);
    // A saved place can double as home; clearing home would be surprising, so
    // home is kept independently.
  } else {
    const entry = toStoredPlace({ ...place, id });
    if (!entry) return false;
    state.saved = [{ ...entry, savedAt: Date.now() }, ...state.saved].slice(0, APP.savedLimit);
  }

  storage.write(STORAGE_KEYS.saved, state.saved);
  emit('saved', state.saved);
  return !saved;
}

/** @param {string} id */
export function removeSaved(id) {
  const next = state.saved.filter((place) => place.id !== id);
  if (next.length === state.saved.length) return;
  state.saved = next;
  storage.write(STORAGE_KEYS.saved, state.saved);
  emit('saved', state.saved);
}

/* -------------------------------------------------------------------------- */
/* Home                                                                        */
/* -------------------------------------------------------------------------- */

/** @param {Place} place */
export function setHome(place) {
  const entry = toStoredPlace({ ...place, id: place.id || placeId(place) });
  if (!entry) return;
  state.home = entry;
  storage.write(STORAGE_KEYS.home, entry);
  emit('home', entry);
}

export function clearHome() {
  if (!state.home) return;
  state.home = null;
  storage.remove(STORAGE_KEYS.home);
  emit('home', null);
}

/* -------------------------------------------------------------------------- */
/* Recent searches                                                             */
/* -------------------------------------------------------------------------- */

/** @param {string} query */
export function addRecent(query) {
  const value = query.trim();
  if (value.length < 2) return;

  const next = [value, ...state.recents.filter((item) => item.toLowerCase() !== value.toLowerCase())];
  state.recents = next.slice(0, APP.recentLimit);
  storage.write(STORAGE_KEYS.recents, state.recents);
  emit('recents', state.recents);
}

export function clearRecents() {
  if (!state.recents.length) return;
  state.recents = [];
  storage.write(STORAGE_KEYS.recents, []);
  emit('recents', state.recents);
}

/* -------------------------------------------------------------------------- */
/* Search results                                                              */
/* -------------------------------------------------------------------------- */

/**
 * @param {{ query: string, results?: Place[], status?: 'idle'|'loading'|'ready'|'empty'|'error', message?: string }} payload
 */
export function setSearch({ query, results = [], status = 'ready', message = '' }) {
  state.query = query;
  state.results = results;
  state.status = status;
  state.message = message;
  state.activeId = null;
  emit('results', state);
}

/** @param {string | null} id */
export function setActive(id) {
  if (state.activeId === id) return;
  state.activeId = id;
  emit('active', id);
}
