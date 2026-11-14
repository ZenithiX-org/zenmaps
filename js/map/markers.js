/**
 * Marker management: the focused place pin, the home pin, saved-place dots and
 * the "you are here" marker.
 */

/* global L */

import { state } from '../state.js';
import { renderLoadingPopup, renderPlacePopup } from '../ui/placePopup.js';
import { pinIcon, savedDotIcon, userIcon } from './icons.js';

/** @type {L.Map | null} */
let map = null;
/** @type {L.Marker | null} */
let placeMarker = null;
/** @type {L.Marker | null} */
let homeMarker = null;
/** @type {L.Marker | null} */
let userMarker = null;
/** @type {L.Circle | null} */
let accuracyCircle = null;
/** @type {L.LayerGroup | null} */
let savedGroup = null;
/** @type {import('../state.js').Place | null} */
let focusedPlace = null;
/** @type {{ note?: string, eyebrow?: string }} */
let focusedOptions = {};

/**
 * Popup options with padding that keeps cards clear of the floating panel on
 * desktop and the bottom sheet on mobile.
 * @returns {L.PopupOptions}
 */
function popupOptions() {
  const narrow = window.matchMedia('(max-width: 899px)').matches;

  return {
    className: 'zen-popup',
    maxWidth: 300,
    minWidth: 244,
    autoPanPaddingTopLeft: narrow ? L.point(24, 60) : L.point(400, 70),
    autoPanPaddingBottomRight: narrow
      ? L.point(24, Math.round(window.innerHeight * 0.22))
      : L.point(28, 28),
    offset: [0, -4],
  };
}

/** @param {L.Map} mapInstance */
export function initMarkers(mapInstance) {
  map = mapInstance;
  savedGroup = L.layerGroup().addTo(map);
}

/* -------------------------------------------------------------------------- */
/* Focused place                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Show a single highlighted place pin and open its popup.
 * @param {import('../state.js').Place} place
 * @param {{ variant?: 'place'|'explore'|'home', loading?: boolean }} [options]
 * @returns {L.Marker}
 */
export function focusPlace(place, options = {}) {
  const { variant = 'place', loading = false } = options;
  if (!map) throw new Error('Markers not initialised');

  clearPlaceMarker();

  const marker = L.marker([place.lat, place.lon], {
    icon: pinIcon({ variant, active: true }),
    title: place.name,
    riseOnHover: true,
    keyboard: true,
    autoPanPadding: [32, 32],
    zIndexOffset: 600,
  }).addTo(map);

  marker.bindPopup(loading ? renderLoadingPopup() : renderPlacePopup(place), popupOptions());
  marker.openPopup();

  placeMarker = marker;
  focusedPlace = place;
  focusedOptions = {};
  return marker;
}

/**
 * Replace the content of an existing marker's popup (used once a reverse lookup
 * resolves).
 * @param {L.Marker} marker
 * @param {import('../state.js').Place} place
 * @param {{ note?: string, eyebrow?: string }} [options]
 */
export function updateMarker(marker, place, options = {}) {
  marker.options.title = place.name;
  marker.setPopupContent(renderPlacePopup(place, options), popupOptions());
  if (marker === placeMarker) {
    focusedPlace = place;
    focusedOptions = options;
  }
}

/**
 * Re-render the open popup of the focused pin, e.g. after the home location or
 * units change while it is on screen.
 */
export function refreshFocusPopup() {
  if (!placeMarker || !focusedPlace) return;
  if (!placeMarker.isPopupOpen()) return;
  placeMarker.setPopupContent(renderPlacePopup(focusedPlace, focusedOptions), popupOptions());
}

export function clearPlaceMarker() {
  if (!placeMarker) return;
  placeMarker.remove();
  placeMarker = null;
}

/** @returns {L.Marker | null} */
export function getPlaceMarker() {
  return placeMarker;
}

/* -------------------------------------------------------------------------- */
/* Home                                                                        */
/* -------------------------------------------------------------------------- */

/** @param {import('../state.js').Place | null} home */
export function syncHomeMarker(home) {
  if (!map) return;

  if (homeMarker) {
    homeMarker.remove();
    homeMarker = null;
  }
  if (!home) return;

  homeMarker = L.marker([home.lat, home.lon], {
    icon: pinIcon({ variant: 'home' }),
    title: `${home.name} — your home`,
    riseOnHover: true,
    keyboard: true,
    zIndexOffset: 400,
  })
    .addTo(map)
    .bindPopup(renderPlacePopup(home, { eyebrow: 'Home base' }), popupOptions());
}

/* -------------------------------------------------------------------------- */
/* Saved places                                                                */
/* -------------------------------------------------------------------------- */

/** Rebuild the quiet dots that mark saved places. */
export function refreshSavedMarkers() {
  if (!savedGroup) return;
  savedGroup.clearLayers();

  for (const place of state.saved) {
    if (state.home && state.home.id === place.id) continue; // the home pin is enough

    L.marker([place.lat, place.lon], {
      icon: savedDotIcon(),
      title: place.name,
      riseOnHover: true,
      keyboard: true,
      zIndexOffset: 200,
    })
      .addTo(savedGroup)
      .bindPopup(renderPlacePopup(place), popupOptions());
  }
}

/* -------------------------------------------------------------------------- */
/* User location                                                               */
/* -------------------------------------------------------------------------- */

/**
 * @param {number} lat
 * @param {number} lon
 * @param {number} [accuracy] metres
 */
export function showUserMarker(lat, lon, accuracy = 0) {
  if (!map) throw new Error('Markers not initialised');
  removeUserMarker();

  if (accuracy > 0 && accuracy < 20000) {
    accuracyCircle = L.circle([lat, lon], {
      radius: accuracy,
      className: 'accuracy-ring',
      weight: 1,
      interactive: false,
    }).addTo(map);
  }

  userMarker = L.marker([lat, lon], {
    icon: userIcon(),
    title: 'Your location',
    keyboard: false,
    zIndexOffset: 500,
  })
    .addTo(map)
    .bindPopup(renderLoadingPopup('Finding your address…'), popupOptions());

  userMarker.openPopup();
  return userMarker;
}

/**
 * Swap the user marker's popup for a place card.
 * @param {import('../state.js').Place} place
 */
export function updateUserPopup(place) {
  if (!userMarker) return;
  userMarker.setPopupContent(renderPlacePopup(place, { eyebrow: 'Your location' }), popupOptions());
  userMarker.openPopup();
}

export function removeUserMarker() {
  userMarker?.remove();
  userMarker = null;
  accuracyCircle?.remove();
  accuracyCircle = null;
}
