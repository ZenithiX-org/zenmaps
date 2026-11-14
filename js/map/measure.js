/**
 * Distance measuring tool.
 *
 * Click points on the map to build a path; segment labels and a running total
 * are drawn on the map, with a HUD (owned by the DOM layer) showing the sum.
 */

/* global L */

import { state } from '../state.js';
import { formatDistance, haversineKm } from '../utils/geo.js';

function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * @typedef {Object} MeasureSnapshot
 * @property {boolean} active
 * @property {number} pointCount
 * @property {number} totalKm
 * @property {string} totalLabel
 */

export class MeasureTool {
  /**
   * @param {L.Map} map
   * @param {{ onChange?: (snapshot: MeasureSnapshot) => void }} [options]
   */
  constructor(map, options = {}) {
    this.map = map;
    this.onChange = options.onChange ?? (() => {});
    this.enabled = false;

    /** @type {L.LatLng[]} */
    this.points = [];
    this.group = L.layerGroup().addTo(map);
    this.container = map.getContainer();
    this.handleClick = (event) => this.addPoint(event.latlng);

    this.emit();
  }

  get totalKm() {
    let total = 0;
    for (let i = 1; i < this.points.length; i += 1) {
      total += haversineKm(this.points[i - 1], this.points[i]);
    }
    return total;
  }

  /** @returns {MeasureSnapshot} */
  snapshot() {
    const total = this.totalKm;
    return {
      active: this.enabled,
      pointCount: this.points.length,
      totalKm: total,
      totalLabel: formatDistance(total, state.units, { precise: true }),
    };
  }

  emit() {
    this.onChange(this.snapshot());
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.container.classList.add('is-measuring');
    this.map.on('click', this.handleClick);
    // Placing points by double click should not also zoom.
    this.map.doubleClickZoom.disable();
    this.emit();
  }

  /** Stop listening for clicks but keep the measured path on screen. */
  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.container.classList.remove('is-measuring');
    this.map.off('click', this.handleClick);
    this.map.doubleClickZoom.enable();
    this.emit();
  }

  toggle() {
    if (this.enabled) this.disable();
    else this.enable();
    return this.enabled;
  }

  /** @param {L.LatLng} latlng */
  addPoint(latlng) {
    if (!Number.isFinite(latlng.lat) || !Number.isFinite(latlng.lng)) return;

    const last = this.points[this.points.length - 1];
    if (last && last.distanceTo(latlng) < 0.5) return; // ignore jitter at the same spot

    this.points.push(latlng);
    this.render();
    this.emit();
  }

  undo() {
    if (!this.points.length) return;
    this.points.pop();
    this.render();
    this.emit();
  }

  clear() {
    this.points = [];
    this.group.clearLayers();
    this.emit();
  }

  /** Re-draw with current theme colours / units. */
  refresh() {
    this.render();
    this.emit();
  }

  render() {
    this.group.clearLayers();
    if (!this.points.length) return;

    const accent = cssVar('--accent', '#0f8a7a');
    const surface = cssVar('--surface-solid', '#ffffff');
    const units = state.units;

    if (this.points.length > 1) {
      L.polyline(this.points, {
        color: accent,
        weight: 3,
        opacity: 0.95,
        dashArray: '1 8',
        lineCap: 'round',
        className: 'measure-line',
      }).addTo(this.group);

      for (let i = 1; i < this.points.length; i += 1) {
        const from = this.points[i - 1];
        const to = this.points[i];
        const segmentKm = haversineKm(from, to);
        const midpoint = L.latLng((from.lat + to.lat) / 2, (from.lng + to.lng) / 2);

        L.tooltip({
          permanent: true,
          direction: 'center',
          className: 'measure-label',
          opacity: 1,
          interactive: false,
        })
          .setLatLng(midpoint)
          .setContent(formatDistance(segmentKm, units))
          .addTo(this.group);
      }
    }

    this.points.forEach((point, index) => {
      const isLast = index === this.points.length - 1;

      const vertex = L.circleMarker(point, {
        radius: isLast ? 6 : 4.5,
        color: surface,
        weight: 2.5,
        fillColor: accent,
        fillOpacity: 1,
        className: 'measure-vertex',
      }).addTo(this.group);

      if (isLast && this.points.length > 1) {
        vertex
          .bindTooltip(`Total ${formatDistance(this.totalKm, units, { precise: true })}`, {
            permanent: true,
            direction: 'top',
            offset: [0, -12],
            className: 'measure-total',
            opacity: 1,
          })
          .openTooltip();
      }
    });
  }
}
