/**
 * Marker icon factories.
 *
 * Pins are inline SVG inside a Leaflet divIcon, so they inherit CSS custom
 * properties and follow the active theme without duplicating assets.
 *
 * @typedef {'place' | 'explore' | 'home'} PinVariant
 */

/* global L */

const PIN_PATH =
  'M15 36.6C15 36.6 27.9 23.5 27.9 15.1A12.9 12.9 0 1 0 2.1 15.1C2.1 23.5 15 36.6 15 36.6Z';

/**
 * @param {{ variant?: PinVariant, active?: boolean }} [options]
 */
export function pinIcon(options = {}) {
  const { variant = 'place', active = false } = options;

  const badge =
    variant === 'home'
      ? `<circle class="zen-pin__badge" cx="15" cy="15" r="5.9"/>
         <path class="zen-pin__glyph" d="M11.8 17.1v-3.3l3.2-2.4 3.2 2.4v3.3h-2.2v-2.1h-2v2.1z"/>`
      : `<circle class="zen-pin__badge" cx="15" cy="15" r="4.2"/>`;

  const html = `<svg width="30" height="38" viewBox="0 0 30 38" fill="none" aria-hidden="true">
    <path class="zen-pin__shape" d="${PIN_PATH}"/>
    ${badge}
  </svg>`;

  return L.divIcon({
    className: `zen-pin zen-pin--${variant}${active ? ' zen-pin--active' : ''}`,
    html,
    iconSize: [30, 38],
    iconAnchor: [15, 37],
    popupAnchor: [0, -33],
  });
}

/** Quiet dot used for saved places, so the map does not turn into a forest of pins. */
export function savedDotIcon() {
  return L.divIcon({
    className: 'zen-saved-marker',
    html: '<span class="zen-saved-dot"></span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
}

/** Pulsing "you are here" dot. */
export function userIcon() {
  return L.divIcon({
    className: 'zen-user-marker',
    html: '<span class="zen-user-dot"></span>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
  });
}
