/**
 * Geocoding via OpenStreetMap Nominatim.
 *
 * Responsibilities:
 *  - respect Nominatim's 1 request/second policy (serial queue)
 *  - cache and de-duplicate requests
 *  - normalise raw OSM records into the app's Place shape
 *  - translate network failures into friendly errors
 *
 * @typedef {import('../state.js').Place} Place
 */

import { GEOCODING } from '../config.js';
import { sleep } from '../utils/dom.js';

/** @type {Map<string, Place[]>} */
const cache = new Map();
/** @type {Map<string, Promise<Place[]>>} */
const inflight = new Map();

let queue = Promise.resolve();
let lastRequestAt = 0;

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

export class GeocodeError extends Error {
  /**
   * @param {string} message user facing message
   * @param {'network'|'timeout'|'http'|'empty'} kind
   */
  constructor(message, kind = 'network') {
    super(message);
    this.name = 'GeocodeError';
    this.kind = kind;
  }
}

/* -------------------------------------------------------------------------- */
/* Request plumbing                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Serialise tasks so we never exceed one request per `minIntervalMs`.
 * @template T
 * @param {() => Promise<T>} task
 * @param {AbortSignal} [signal]
 * @returns {Promise<T>}
 */
function throttle(task, signal) {
  const aborted = () => signal?.aborted === true;

  const run = async () => {
    if (aborted()) throw new DOMException('Aborted', 'AbortError');

    const wait = GEOCODING.minIntervalMs - (Date.now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
    if (aborted()) throw new DOMException('Aborted', 'AbortError');

    lastRequestAt = Date.now();
    return task();
  };

  const result = queue.then(run, run);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/**
 * Fetch JSON with a timeout, honouring an external abort signal.
 * @param {URL} url
 * @param {AbortSignal} [signal]
 */
async function fetchJson(url, signal) {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(new DOMException('Timeout', 'TimeoutError')),
    GEOCODING.timeoutMs,
  );

  const forwardAbort = () => controller.abort(new DOMException('Aborted', 'AbortError'));
  if (signal) {
    if (signal.aborted) forwardAbort();
    else signal.addEventListener('abort', forwardAbort, { once: true });
  }

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      // Nominatim asks for an identifiable client; browsers control User-Agent,
      // so the app name is sent via Referer and this header instead.
      referrerPolicy: 'strict-origin-when-cross-origin',
    });

    if (!response.ok) {
      throw new GeocodeError(
        response.status === 429
          ? 'Too many searches just now. Give it a moment and try again.'
          : `Search service unavailable (${response.status}).`,
        'http',
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof GeocodeError) throw error;
    if (error?.name === 'AbortError') throw error;
    if (error?.name === 'TimeoutError') {
      throw new GeocodeError('The search took too long. Check your connection and retry.', 'timeout');
    }
    throw new GeocodeError('Could not reach the search service. Check your connection.', 'network');
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (hit) {
    // Refresh recency (simple LRU).
    cache.delete(key);
    cache.set(key, hit);
  }
  return hit;
}

function cacheSet(key, value) {
  cache.set(key, value);
  while (cache.size > GEOCODING.cacheSize) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/* -------------------------------------------------------------------------- */
/* Normalisation                                                               */
/* -------------------------------------------------------------------------- */

const KIND_LABELS = {
  city: 'City',
  town: 'Town',
  village: 'Village',
  hamlet: 'Hamlet',
  municipality: 'Municipality',
  suburb: 'Suburb',
  neighbourhood: 'Neighbourhood',
  quarter: 'Quarter',
  residential: 'Area',
  administrative: 'Region',
  state: 'State',
  region: 'Region',
  county: 'County',
  country: 'Country',
  continent: 'Continent',
  house: 'Address',
  building: 'Building',
  road: 'Road',
  street: 'Street',
  footway: 'Path',
  railway: 'Railway',
  station: 'Station',
  airport: 'Airport',
  attraction: 'Attraction',
  museum: 'Museum',
  monument: 'Monument',
  viewpoint: 'Viewpoint',
  park: 'Park',
  garden: 'Garden',
  peak: 'Peak',
  water: 'Water',
  lake: 'Lake',
  river: 'River',
  beach: 'Beach',
  hotel: 'Hotel',
  restaurant: 'Restaurant',
  cafe: 'Café',
  bar: 'Bar',
  pub: 'Pub',
  bakery: 'Bakery',
  supermarket: 'Supermarket',
  mall: 'Shopping centre',
  school: 'School',
  university: 'University',
  hospital: 'Hospital',
  pharmacy: 'Pharmacy',
  bank: 'Bank',
  place_of_worship: 'Place of worship',
  temple: 'Temple',
  church: 'Church',
  mosque: 'Mosque',
  stadium: 'Stadium',
  theatre: 'Theatre',
  cinema: 'Cinema',
  library: 'Library',
  post_office: 'Post office',
  bus_stop: 'Bus stop',
  parking: 'Parking',
  fuel: 'Fuel station',
};

/**
 * Friendly label for a place's OSM type.
 * @param {Place} place
 */
export function kindLabel(place) {
  const raw = (place?.kind || place?.category || '').toLowerCase();
  if (!raw) return 'Place';
  if (KIND_LABELS[raw]) return KIND_LABELS[raw];
  const words = raw.replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Place';
}

/**
 * Split a Nominatim display name into a title and a supporting context line.
 * @param {any} item
 */
function splitDisplayName(item) {
  const display = String(item.display_name || '').trim();
  const parts = display
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const cleanedName = String(item.name || '').trim();
  const name = cleanedName || parts[0] || 'Unnamed place';

  const contextParts = [...parts];
  if (contextParts[0] && contextParts[0].toLowerCase() === name.toLowerCase()) {
    contextParts.shift();
  }

  return { name, context: contextParts.join(', ') };
}

/**
 * @param {any} item raw Nominatim record
 * @returns {Place | null}
 */
function normalisePlace(item) {
  const lat = Number(item?.lat);
  const lon = Number(item?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  const { name, context } = splitDisplayName(item);
  const id =
    item.osm_type && item.osm_id
      ? `${item.osm_type}/${item.osm_id}`
      : `${lat.toFixed(5)},${lon.toFixed(5)}`;

  return {
    id,
    name,
    context,
    lat,
    lon,
    kind: item.addresstype || item.type || '',
    category: item.category || '',
    importance: Number(item.importance) || 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Search for places by free-text query.
 * @param {string} query
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<Place[]>}
 */
export async function searchPlaces(query, options = {}) {
  const cleaned = query.trim().replace(/\s+/g, ' ');
  if (cleaned.length < 2) return [];

  const key = `search:${cleaned.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const request = (async () => {
    const url = new URL(GEOCODING.searchEndpoint);
    url.searchParams.set('q', cleaned);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', String(GEOCODING.limit));
    url.searchParams.set('accept-language', navigator.language || 'en');

    const data = await throttle(() => fetchJson(url, options.signal), options.signal);
    const places = Array.isArray(data) ? data.map(normalisePlace).filter(Boolean) : [];

    const seen = new Set();
    const unique = places.filter((place) => {
      if (seen.has(place.id)) return false;
      seen.add(place.id);
      return true;
    });

    cacheSet(key, unique);
    return unique;
  })();

  inflight.set(key, request);
  try {
    return await request;
  } finally {
    inflight.delete(key);
  }
}

/**
 * Reverse geocode a coordinate into a place.
 * @param {number} lat
 * @param {number} lon
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<Place | null>}
 */
export async function reversePlace(lat, lon, options = {}) {
  const key = `reverse:${lat.toFixed(5)},${lon.toFixed(5)}`;
  const cached = cacheGet(key);
  if (cached) return cached[0] ?? null;

  const pending = inflight.get(key);
  if (pending) return (await pending)[0] ?? null;

  const request = (async () => {
    const url = new URL(GEOCODING.reverseEndpoint);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('zoom', String(GEOCODING.reverseZoom));
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', navigator.language || 'en');

    const data = await throttle(() => fetchJson(url, options.signal), options.signal);
    const place = data && !data.error ? normalisePlace(data) : null;
    const result = place ? [place] : [];

    cacheSet(key, result);
    return result;
  })();

  inflight.set(key, request);
  try {
    const result = await request;
    return result[0] ?? null;
  } finally {
    inflight.delete(key);
  }
}
