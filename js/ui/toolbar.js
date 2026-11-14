/**
 * Floating map tools: locate, measure, basemap picker and share.
 */

import { BASEMAPS } from '../config.js';
import { clear, el, svgIcon } from '../utils/dom.js';
import { toast } from './toast.js';

export class Toolbar {
  /**
   * @param {{
   *   measure: import('../map/measure.js').MeasureTool,
   *   onLocate: () => Promise<void>,
   *   onShare: () => void,
   *   onBasemapSelect: (id: string) => void,
   * }} options
   */
  constructor(options) {
    this.measure = options.measure;
    this.onLocate = options.onLocate;
    this.onShare = options.onShare;
    this.onBasemapSelect = options.onBasemapSelect;

    this.locateBtn = /** @type {HTMLButtonElement} */ (document.getElementById('locate-btn'));
    this.measureBtn = /** @type {HTMLButtonElement} */ (document.getElementById('measure-btn'));
    this.basemapBtn = /** @type {HTMLButtonElement} */ (document.getElementById('basemap-btn'));
    this.shareBtn = /** @type {HTMLButtonElement} */ (document.getElementById('share-btn'));
    this.menu = /** @type {HTMLElement} */ (document.getElementById('basemap-menu'));
    this.list = /** @type {HTMLElement} */ (document.getElementById('basemap-list'));

    /** @type {HTMLElement[]} */
    this.items = [];
  }

  init() {
    this.renderBasemaps();

    this.basemapBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (this.menu.hidden) this.openMenu();
      else this.closeMenu();
    });

    this.measureBtn.addEventListener('click', () => this.toggleMeasure());
    this.shareBtn.addEventListener('click', () => this.onShare());
    this.locateBtn.addEventListener('click', () => this.locate());

    this.menu.addEventListener('click', (event) => event.stopPropagation());
    document.addEventListener('click', () => this.closeMenu());
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.closeMenu();
    });

    this.setMeasurePressed(this.measure.enabled);
  }

  /* ---------------------------------------------------------------------- */
  /* Basemaps                                                                */
  /* ---------------------------------------------------------------------- */

  renderBasemaps() {
    clear(this.list);

    Object.values(BASEMAPS).forEach((preset) => {
      const button = el(
        'button',
        {
          type: 'button',
          class: 'basemap',
          role: 'menuitemradio',
          'aria-checked': 'false',
          dataset: { basemap: preset.id },
        },
        [
          el('span', { class: `basemap__swatch basemap__swatch--${preset.id}`, 'aria-hidden': 'true' }),
          el('span', { text: preset.label }),
          svgIcon('i-check', 'icon icon--sm basemap__check'),
        ],
      );

      button.addEventListener('click', () => {
        this.onBasemapSelect(preset.id);
        this.closeMenu({ restoreFocus: true });
      });

      this.list.append(button);
    });

    this.items = Array.from(this.list.querySelectorAll('.basemap'));
  }

  /** @param {string} id */
  setActive(id) {
    this.items.forEach((item) => {
      item.setAttribute('aria-checked', String(item.dataset.basemap === id));
    });
  }

  openMenu() {
    this.menu.hidden = false;
    this.basemapBtn.setAttribute('aria-expanded', 'true');
    const checked =
      this.items.find((item) => item.getAttribute('aria-checked') === 'true') ?? this.items[0];
    checked?.focus({ preventScroll: true });
  }

  closeMenu(options = { restoreFocus: false }) {
    if (this.menu.hidden) return;
    this.menu.hidden = true;
    this.basemapBtn.setAttribute('aria-expanded', 'false');
    if (options.restoreFocus) this.basemapBtn.focus({ preventScroll: true });
  }

  toggleMenu() {
    if (this.menu.hidden) this.openMenu();
    else this.closeMenu({ restoreFocus: true });
  }

  /* ---------------------------------------------------------------------- */
  /* Tools                                                                   */
  /* ---------------------------------------------------------------------- */

  /** @param {boolean} active */
  setMeasurePressed(active) {
    this.measureBtn.setAttribute('aria-pressed', String(active));
  }

  toggleMeasure() {
    const active = this.measure.toggle();
    this.setMeasurePressed(active);
    if (active) {
      this.closeMenu();
      toast('Measure mode — click the map to add points', { duration: 2600 });
    }
  }

  async locate() {
    if (this.locateBtn.disabled) return;
    this.locateBtn.disabled = true;
    this.locateBtn.setAttribute('aria-busy', 'true');
    try {
      await this.onLocate();
    } finally {
      this.locateBtn.disabled = false;
      this.locateBtn.removeAttribute('aria-busy');
    }
  }
}
