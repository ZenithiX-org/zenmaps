/**
 * Application configuration.
 * Everything tunable lives here so behaviour can change without touching logic.
 */

export const APP = {
  /** Where the map opens when there is no saved view in the URL. */
  view: { center: [24, 12], zoom: 2 },
  focusZoom: 14,
  minZoom: 2,
  maxZoom: 19,
  savedLimit: 60,
  recentLimit: 6,
  hintDuration: 8000,
  searchDebounceMs: 420,
  minQueryLength: 3,
};

/**
 * Basemaps. `id` is used in markup, storage and the URL-free UI.
 * @typedef {Object} Basemap
 * @property {string} id
 * @property {string} label
 * @property {string} url
 * @property {string} attribution
 * @property {number} maxZoom
 * @property {string} [subdomains]
 * @property {boolean} [retina]
 */

/** @type {Record<string, Basemap>} */
export const BASEMAPS = {
  streets: {
    id: 'streets',
    label: 'Streets',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  light: {
    id: 'light',
    label: 'Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
    maxZoom: 20,
    subdomains: 'abcd',
    retina: true,
  },
  dark: {
    id: 'dark',
    label: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
    maxZoom: 20,
    subdomains: 'abcd',
    retina: true,
  },
  terrain: {
    id: 'terrain',
    label: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a>',
    maxZoom: 17,
    subdomains: 'abc',
  },
  satellite: {
    id: 'satellite',
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Imagery &copy; <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
};

/** Basemap used when the theme is dark and the user has not picked one. */
export const THEME_BASEMAP = { light: 'streets', dark: 'dark' };

export const GEOCODING = {
  searchEndpoint: 'https://nominatim.openstreetmap.org/search',
  reverseEndpoint: 'https://nominatim.openstreetmap.org/reverse',
  /** Nominatim's usage policy allows at most one request per second. */
  minIntervalMs: 1000,
  limit: 8,
  reverseZoom: 18,
  timeoutMs: 12000,
  cacheSize: 80,
};

export const STORAGE_KEYS = {
  saved: 'zenmaps.saved',
  home: 'zenmaps.home',
  units: 'zenmaps.units',
  theme: 'zenmaps.theme',
  basemap: 'zenmaps.basemap',
  recents: 'zenmaps.recents',
  hintDismissed: 'zenmaps.hintDismissed',
};

export const OSM = {
  placeUrl: (lat, lon) =>
    `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`,
};
