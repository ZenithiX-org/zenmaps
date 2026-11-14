/**
 * Leaflet map lifecycle: creation, basemap switching, camera moves and
 * syncing the current view into the URL hash.
 */

/* global L */

import { APP, BASEMAPS } from '../config.js';
import { buildHash, parseHash } from '../utils/geo.js';
import { prefersReducedMotion } from '../utils/dom.js';

/** @type {L.Map | null} */
let map = null;
/** @type {L.TileLayer | null} */
let baseLayer = null;
let activeBasemap = 'streets';
let hashTimer = 0;

/**
 * Create the map and its controls.
 * @param {string | HTMLElement} target
 * @returns {L.Map}
 */
export function createMap(target) {
  const initial = parseHash(window.location.hash) ?? {
    center: APP.view.center,
    zoom: APP.view.zoom,
  };

  map = L.map(target, {
    center: initial.center,
    zoom: initial.zoom,
    minZoom: APP.minZoom,
    maxZoom: APP.maxZoom,
    zoomControl: false,
    zoomSnap: 0.5,
    zoomDelta: 0.5,
    wheelPxPerZoomLevel: 90,
    worldCopyJump: true,
    zoomAnimation: !prefersReducedMotion(),
    fadeAnimation: !prefersReducedMotion(),
    markerZoomAnimation: !prefersReducedMotion(),
    zoomAnimationThreshold: 3,
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  L.control
    .scale({ position: 'bottomleft', metric: true, imperial: false, maxWidth: 110 })
    .addTo(map);

  map.attributionControl.setPrefix(
    '<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>',
  );

  map.on('moveend', scheduleHashSync);

  // Follow hash changes made outside the app (pasted links, history navigation).
  window.addEventListener('hashchange', () => {
    if (!map) return;
    const view = parseHash(window.location.hash);
    if (!view) return;
    map.setView(view.center, view.zoom, { animate: false });
  });

  return map;
}

/**
 * Swap the basemap. Returns the id actually applied (invalid ids fall back to
 * the default style).
 * @param {string} id
 * @returns {string}
 */
export function setBasemap(id) {
  if (!map) return activeBasemap;

  const preset = BASEMAPS[id] ?? BASEMAPS.streets;
  const maxNativeZoom = preset.maxZoom;

  if (baseLayer) {
    map.removeLayer(baseLayer);
    baseLayer = null;
  }

  baseLayer = L.tileLayer(preset.url, {
    attribution: preset.attribution,
    maxZoom: APP.maxZoom,
    maxNativeZoom,
    subdomains: preset.subdomains ?? 'abc',
    detectRetina: Boolean(preset.retina),
    // Fade tiles in gently instead of popping.
    updateWhenIdle: false,
    keepBuffer: 3,
  });

  baseLayer.addTo(map);
  activeBasemap = preset.id;
  document.documentElement.dataset.basemap = preset.id;

  return activeBasemap;
}

/**
 * Smoothly move the camera.
 * @param {number} lat
 * @param {number} lon
 * @param {number} [zoom]
 */
export function flyTo(lat, lon, zoom = APP.focusZoom) {
  if (!map) return;

  const target = {
    center: /** @type {[number, number]} */ ([lat, lon]),
    zoom: Math.min(APP.maxZoom, Math.max(APP.minZoom, zoom)),
  };

  if (prefersReducedMotion() || map.getZoom() < 3) {
    // flyTo across the whole world looks like a screensaver; jump instead.
    map.setView(target.center, target.zoom);
    return;
  }

  map.flyTo(target.center, target.zoom, { duration: 0.9, easeLinearity: 0.28 });
}

/** Re-measure the container after layout changes (e.g. mobile sheet). */
export function invalidateSize() {
  map?.invalidateSize({ animate: false, pan: false });
}

/** Write the current view into the URL without adding history entries. */
function scheduleHashSync() {
  window.clearTimeout(hashTimer);
  hashTimer = window.setTimeout(() => {
    if (!map) return;
    const center = map.getCenter();
    const hash = buildHash(map.getZoom(), center.lat, center.lng);
    if (window.location.hash === hash) return;

    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}${hash}`,
    );
  }, 220);
}

/** The hash for the current view, for the share button. */
export function currentViewUrl() {
  if (!map) return window.location.href;
  const center = map.getCenter();
  return `${window.location.origin}${window.location.pathname}${window.location.search}${buildHash(
    map.getZoom(),
    center.lat,
    center.lng,
  )}`;
}
