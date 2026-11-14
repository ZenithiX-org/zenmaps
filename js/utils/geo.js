/**
 * Geographic helpers: distances, coordinate formatting and URL hash views.
 */

const EARTH_RADIUS_KM = 6371.0088;
const KM_PER_MILE = 1.609344;
const METERS_PER_MILE = 1609.344;

/**
 * Great-circle distance between two points in kilometres.
 * @param {{ lat: number, lon: number }} a
 * @param {{ lat: number, lon: number }} b
 */
export function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Human readable distance. Metric shows metres under 1 km, imperial shows feet
 * under 0.1 miles — the units people actually think in.
 *
 * @param {number} km
 * @param {'km' | 'mi'} units
 * @param {{ precise?: boolean }} [options]
 */
export function formatDistance(km, units = 'km', options = {}) {
  if (!Number.isFinite(km) || km < 0) return '—';

  const { precise = false } = options;
  const round = (value, digits) =>
    value.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });

  if (units === 'mi') {
    const miles = km / KM_PER_MILE;
    if (miles < 0.1) return `${Math.round((km * 1000 * 3.28084) / 10) * 10} ft`;
    if (miles < 10) return `${round(miles, precise ? 2 : 1)} mi`;
    return `${Math.round(miles).toLocaleString()} mi`;
  }

  if (km < 0.1) return `${Math.round(km * 1000)} m`;
  if (km < 1) return `${round(km * 1000, 0)} m`;
  if (km < 10) return `${round(km, precise ? 2 : 1)} km`;
  return `${Math.round(km).toLocaleString()} km`;
}

/**
 * "48.8584° N · 2.2945° E"
 * @param {number} lat
 * @param {number} lon
 */
export function formatCoords(lat, lon) {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir} · ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
}

/** Short coordinate pair for dense list rows: "48.8584, 2.2945". */
export function formatCoordsShort(lat, lon) {
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

/**
 * Encode a map view as a shareable hash: `#12.5/30.901/75.857`.
 * @param {number} zoom
 * @param {number} lat
 * @param {number} lon
 */
export function buildHash(zoom, lat, lon) {
  const z = Number(zoom.toFixed(2)).toString();
  return `#${z}/${lat.toFixed(5)}/${lon.toFixed(5)}`;
}

/**
 * Parse a map view from the URL hash. Returns null when absent or invalid.
 * @param {string} hash
 * @returns {{ center: [number, number], zoom: number } | null}
 */
export function parseHash(hash) {
  const match = /^#?(?:map=)?(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(
    (hash || '').trim(),
  );
  if (!match) return null;

  const zoom = Number(match[1]);
  const lat = Number(match[2]);
  const lon = Number(match[3]);

  if (!Number.isFinite(zoom) || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  if (zoom < 0 || zoom > 22) return null;

  return { center: [lat, lon], zoom };
}

/** A stable id for a place, tolerant of missing OSM metadata. */
export function placeId(place) {
  if (!place) return '';
  if (place.id) return String(place.id);
  return `${Number(place.lat).toFixed(5)},${Number(place.lon).toFixed(5)}`;
}

/** Rough zoom level that suits a given OSM place type. */
export function zoomForKind(/** @type {string | undefined} */ kind) {
  switch (kind) {
    case 'house':
    case 'building':
      return 17;
    case 'road':
    case 'street':
      return 16;
    case 'city':
    case 'town':
      return 12;
    case 'state':
    case 'region':
      return 8;
    case 'country':
      return 5;
    case 'continent':
      return 3;
    default:
      return 15;
  }
}
