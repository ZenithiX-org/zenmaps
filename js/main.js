/**
 * ZenMaps entry point.
 *
 * This file wires the modules together and owns the few behaviours that span
 * more than one area (map clicks, keyboard shortcuts, locating the user).
 */

import { APP, STORAGE_KEYS, THEME_BASEMAP } from './config.js';
import {
  addRecent,
  load,
  on,
  setActive,
  setBasemap as rememberBasemap,
  state,
} from './state.js';
import * as storage from './services/storage.js';
import { reversePlace } from './services/geocoding.js';
import { getCurrentPosition } from './services/geolocation.js';
import {
  createMap,
  currentViewUrl,
  flyTo,
  invalidateSize,
  setBasemap as applyBasemapLayer,
} from './map/map.js';
import {
  focusPlace,
  initMarkers,
  refreshFocusPopup,
  refreshSavedMarkers,
  showUserMarker,
  syncHomeMarker,
  updateMarker,
  updateUserPopup,
} from './map/markers.js';
import { MeasureTool } from './map/measure.js';
import { SearchController } from './ui/search.js';
import { Panel } from './ui/places.js';
import { Toolbar } from './ui/toolbar.js';
import { initTheme } from './ui/theme.js';
import { toast } from './ui/toast.js';
import { isNarrowViewport, isTypingTarget } from './utils/dom.js';
import { zoomForKind } from './utils/geo.js';

/* global L */

const els = {
  hint: document.getElementById('map-hint'),
  hintClose: document.getElementById('map-hint-close'),
  measureHud: document.getElementById('measure-hud'),
  measureTotal: document.getElementById('measure-total'),
  measureLabel: document.getElementById('measure-label'),
  measureUndo: document.getElementById('measure-undo'),
  measureClear: document.getElementById('measure-clear'),
  measureDone: document.getElementById('measure-done'),
};

function boot() {
  if (typeof L === 'undefined') {
    const mapEl = document.getElementById('map');
    if (mapEl) {
      mapEl.textContent = 'The map library failed to load. Please check your connection and reload.';
    }
    return;
  }

  load();

  const map = createMap('map');
  initMarkers(map);
  initTheme(/** @type {HTMLButtonElement | null} */ (document.getElementById('theme-btn')));

  /** @type {Toolbar | null} */
  let toolbar = null;
  /** @type {Panel | null} */
  let panel = null;

  const measure = new MeasureTool(map, { onChange: (snapshot) => updateMeasureUI(snapshot) });

  panel = new Panel({
    onSelect: (place, options) => selectPlace(place, { record: !options?.saved }),
    onRecent: (query) => search.searchFor(query),
    onResize: () => invalidateSize(),
  });
  panel.init();

  const search = new SearchController({
    onSelect: (place, options) => selectPlace(place, options),
    onFocusResults: () => panel?.focusFirstResult(),
  });
  search.init();

  toolbar = new Toolbar({
    measure,
    onLocate: () => locateUser(),
    onShare: () => shareView(),
    onBasemapSelect: (id) => chooseBasemap(id),
  });
  toolbar.init();

  /* ---------------------------------------------------------------------- */
  /* Basemap                                                                */
  /* ---------------------------------------------------------------------- */

  function applyBasemap(id) {
    const effective = applyBasemapLayer(id);
    toolbar?.setActive(effective);
  }

  function chooseBasemap(id) {
    if (state.basemap === id) {
      // Already the remembered choice: re-apply in case the layer was swapped.
      applyBasemap(id);
      return;
    }
    rememberBasemap(id); // emits "basemap"
  }

  applyBasemap(state.basemap ?? THEME_BASEMAP[state.theme]);

  /* ---------------------------------------------------------------------- */
  /* Persistent map decorations                                             */
  /* ---------------------------------------------------------------------- */

  syncHomeMarker(state.home);
  refreshSavedMarkers();

  on('home', (home) => {
    syncHomeMarker(home);
    refreshFocusPopup();
  });
  on('saved', () => refreshSavedMarkers());
  on('basemap', (id) => applyBasemap(id));
  on('units', () => {
    measure.refresh();
    refreshFocusPopup();
  });
  on('theme', (theme) => {
    measure.refresh();
    if (!state.basemap) applyBasemap(THEME_BASEMAP[theme]);
  });

  /* ---------------------------------------------------------------------- */
  /* Place selection                                                        */
  /* ---------------------------------------------------------------------- */

  /**
   * @param {import('./state.js').Place} place
   * @param {{ record?: boolean, saved?: boolean }} [options]
   */
  function selectPlace(place, options = {}) {
    const zoom = Math.min(APP.maxZoom, Math.max(APP.minZoom, zoomForKind(place.kind)));
    flyTo(place.lat, place.lon, zoom);
    focusPlace(place);
    setActive(place.id);

    if (options.record) addRecent(state.query || place.name);
    if (isNarrowViewport()) panel?.closeSheet();
  }

  /* ---------------------------------------------------------------------- */
  /* Map clicks                                                             */
  /* ---------------------------------------------------------------------- */

  /** @type {AbortController | null} */
  let exploreController = null;

  /**
   * Reverse geocode a clicked point and show it in a popup.
   * @param {number} lat
   * @param {number} lon
   */
  async function exploreAt(lat, lon) {
    exploreController?.abort();
    exploreController = new AbortController();
    const { signal } = exploreController;

    const provisional = {
      id: `point/${lat.toFixed(5)}/${lon.toFixed(5)}`,
      name: 'Dropped pin',
      context: '',
      lat,
      lon,
      kind: 'pin',
    };

    if (map.getZoom() < 10) flyTo(lat, lon, 13);

    const marker = focusPlace(provisional, { variant: 'explore', loading: true });

    try {
      const place = await reversePlace(lat, lon, { signal });
      if (!map.hasLayer(marker)) return;

      if (place) {
        updateMarker(marker, place);
        setActive(place.id);
      } else {
        updateMarker(marker, provisional, {
          eyebrow: 'Dropped pin',
          note: 'No named place was found here — the coordinates are still exact.',
        });
      }
    } catch (error) {
      if (signal.aborted || error?.name === 'AbortError') return;
      if (!map.hasLayer(marker)) return;

      updateMarker(marker, provisional, {
        eyebrow: 'Dropped pin',
        note: error instanceof Error ? error.message : 'We could not look up this spot.',
      });
    }
  }

  map.on('click', (event) => {
    if (measure.enabled) return;
    const { lat, lng } = event.latlng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    dismissHint();
    exploreAt(lat, lng);
  });

  /* ---------------------------------------------------------------------- */
  /* Locate & share                                                         */
  /* ---------------------------------------------------------------------- */

  async function locateUser() {
    try {
      const { lat, lon, accuracy } = await getCurrentPosition();

      showUserMarker(lat, lon, accuracy);
      flyTo(lat, lon, 15);
      if (isNarrowViewport()) panel?.closeSheet();

      const fallback = {
        id: `point/${lat.toFixed(5)}/${lon.toFixed(5)}`,
        name: 'Your location',
        context: '',
        lat,
        lon,
        kind: 'pin',
      };

      try {
        const place = await reversePlace(lat, lon);
        updateUserPopup(place ?? fallback);
      } catch {
        updateUserPopup(fallback);
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not find your location.', {
        type: 'error',
        duration: 5200,
      });
    }
  }

  async function shareView() {
    const url = currentViewUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast('Link to this view copied to the clipboard', { type: 'success' });
    } catch {
      // Clipboard access is blocked outside secure contexts; fall back to a prompt.
      window.prompt('Copy this link to share the view:', url);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Measure HUD                                                            */
  /* ---------------------------------------------------------------------- */

  /** @param {import('./map/measure.js').MeasureSnapshot} snapshot */
  function updateMeasureUI(snapshot) {
    const visible = snapshot.active || snapshot.pointCount > 0;
    if (els.measureHud) els.measureHud.hidden = !visible;
    if (els.measureTotal) els.measureTotal.textContent = snapshot.totalLabel;
    if (els.measureDone) {
      // Once measuring stops the overlay stays on screen, so only Undo/Clear apply.
      els.measureDone.hidden = !snapshot.active;
    }
    if (els.measureLabel) {
      els.measureLabel.textContent = snapshot.active
        ? 'Total distance · click the map to add points'
        : 'Total distance';
    }

    toolbar?.setMeasurePressed(snapshot.active);

    if (snapshot.active) {
      dismissHint();
      panel?.closeSheet();
    }
  }

  els.measureUndo?.addEventListener('click', () => measure.undo());
  els.measureClear?.addEventListener('click', () => {
    measure.clear();
    measure.disable();
    toolbar?.setMeasurePressed(false);
  });
  els.measureDone?.addEventListener('click', () => {
    measure.disable();
    toolbar?.setMeasurePressed(false);
  });

  /* ---------------------------------------------------------------------- */
  /* Hint                                                                   */
  /* ---------------------------------------------------------------------- */

  function initHint() {
    if (!els.hint) return;
    if (storage.read(STORAGE_KEYS.hintDismissed, false)) {
      els.hint.hidden = true;
      return;
    }
    window.setTimeout(dismissHint, APP.hintDuration);
  }

  function dismissHint() {
    if (!els.hint || els.hint.hidden || els.hint.classList.contains('is-hidden')) return;
    els.hint.classList.add('is-hidden');
    storage.write(STORAGE_KEYS.hintDismissed, true);
    window.setTimeout(() => {
      if (els.hint) els.hint.hidden = true;
    }, 300);
  }

  els.hintClose?.addEventListener('click', dismissHint);
  initHint();

  /* ---------------------------------------------------------------------- */
  /* Keyboard shortcuts                                                     */
  /* ---------------------------------------------------------------------- */

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      toolbar?.closeMenu();
      if (measure.enabled) measure.disable();
      return;
    }

    if (isTypingTarget(event.target)) return;

    const key = event.key.toLowerCase();
    const modifier = event.metaKey || event.ctrlKey;

    if ((modifier && key === 'k') || (!modifier && !event.altKey && event.key === '/')) {
      event.preventDefault();
      panel?.openSheet();
      search.focus();
      return;
    }

    if (modifier || event.altKey) return;

    if (key === 'l') {
      event.preventDefault();
      void toolbar?.locate();
    } else if (key === 'm') {
      event.preventDefault();
      toolbar?.toggleMeasure();
    } else if (key === 'b') {
      event.preventDefault();
      toolbar?.toggleMenu();
    }
  });

  // Keep the map crisp when the mobile sheet animates open or closed.
  window.addEventListener('orientationchange', () => window.setTimeout(invalidateSize, 260));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
