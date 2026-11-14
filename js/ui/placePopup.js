/**
 * Popup content builder.
 *
 * Built with DOM APIs rather than an HTML string: place names come from a public
 * API and must never be interpreted as markup.
 */

import { OSM } from '../config.js';
import { isSaved, setHome, state, toggleSaved } from '../state.js';
import { kindLabel } from '../services/geocoding.js';
import { el, svgIcon } from '../utils/dom.js';
import { formatCoords, formatDistance, haversineKm, placeId } from '../utils/geo.js';
import { toast } from './toast.js';

function samePlace(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id) return a.id === b.id;
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lon - b.lon) < 1e-6;
}

/** @param {import('../state.js').Place} place */
function isHomePlace(place) {
  return samePlace(state.home, place);
}

/**
 * Card shown inside a Leaflet popup.
 * @param {import('../state.js').Place} place
 * @param {{ eyebrow?: string, note?: string }} [options]
 * @returns {HTMLElement}
 */
export function renderPlacePopup(place, options = {}) {
  const id = place.id || placeId(place);
  const { eyebrow, note } = options;

  const root = el('div', { class: 'popup' });
  root.append(el('p', { class: 'popup__eyebrow', text: eyebrow ?? kindLabel(place) }));
  root.append(el('h3', { class: 'popup__title', text: place.name }));
  root.append(el('p', { class: 'popup__coords', text: formatCoords(place.lat, place.lon) }));

  const pills = el('div', { class: 'popup__pills' });

  if (isHomePlace(place)) {
    pills.append(
      el('span', { class: 'popup__pill popup__pill--home' }, [
        svgIcon('i-home', 'icon icon--sm'),
        el('span', { text: 'Your home' }),
      ]),
    );
  } else if (state.home) {
    const distance = haversineKm(state.home, place);
    pills.append(
      el('span', { class: 'popup__pill popup__pill--home', title: `Distance from ${state.home.name}` }, [
        svgIcon('i-home', 'icon icon--sm'),
        el('span', { text: `${formatDistance(distance, state.units)} from home` }),
      ]),
    );
  }

  if (place.context) {
    pills.append(
      el('span', { class: 'popup__pill popup__pill--accent', text: place.context.length > 46 ? `${place.context.slice(0, 46)}…` : place.context }),
    );
  }

  if (pills.children.length) root.append(pills);

  if (note) root.append(el('p', { class: 'popup__note', text: note }));

  /* --- Actions ---------------------------------------------------------- */

  const actions = el('div', { class: 'popup__actions' });

  const saveBtn = el('button', { type: 'button', class: 'btn btn--ghost btn--grow' });
  const paintSave = () => {
    const saved = isSaved(id);
    saveBtn.setAttribute('aria-pressed', String(saved));
    saveBtn.replaceChildren(
      svgIcon('i-star', 'icon icon--sm'),
      el('span', { text: saved ? 'Saved' : 'Save' }),
    );
  };
  paintSave();
  saveBtn.addEventListener('click', () => {
    const nowSaved = toggleSaved({ ...place, id });
    paintSave();
    toast(nowSaved ? `Saved “${place.name}”` : `Removed “${place.name}”`, {
      type: nowSaved ? 'success' : 'info',
      duration: 2400,
    });
  });
  actions.append(saveBtn);

  const homeBtn = el('button', { type: 'button', class: 'btn btn--ghost btn--grow' });
  const paintHome = () => {
    const isHome = isHomePlace(place);
    homeBtn.disabled = isHome;
    homeBtn.setAttribute('aria-pressed', String(isHome));
    homeBtn.replaceChildren(
      svgIcon('i-home', 'icon icon--sm'),
      el('span', { text: isHome ? 'Home' : 'Set home' }),
    );
  };
  paintHome();
  homeBtn.addEventListener('click', () => {
    setHome({ ...place, id });
    paintHome();
    toast(`“${place.name}” is now your home base`, { type: 'success', duration: 2800 });
  });
  actions.append(homeBtn);

  actions.append(
    el(
      'a',
      {
        class: 'btn btn--ghost',
        href: OSM.placeUrl(place.lat, place.lon),
        target: '_blank',
        rel: 'noopener noreferrer',
        title: 'Open in OpenStreetMap',
        'aria-label': 'Open this place in OpenStreetMap (new tab)',
      },
      [svgIcon('i-external', 'icon icon--sm')],
    ),
  );

  root.append(actions);
  return root;
}

/**
 * Placeholder shown while a reverse lookup is in flight.
 * @param {string} [label]
 */
export function renderLoadingPopup(label = 'Looking up this spot…') {
  return el('div', { class: 'popup popup--loading' }, [
    el('span', { class: 'spinner', 'aria-hidden': 'true' }),
    el('span', { text: label }),
  ]);
}
