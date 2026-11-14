/**
 * The side panel: tabs, result rows, saved places, recent searches, units and
 * the mobile bottom-sheet behaviour.
 */

import {
  clearRecents,
  clearHome,
  isSaved,
  on,
  removeSaved,
  setActive,
  setHome,
  state,
  toggleSaved,
  toggleUnits,
} from '../state.js';
import { kindLabel } from '../services/geocoding.js';
import { clear, el, isNarrowViewport, svgIcon } from '../utils/dom.js';
import { formatCoordsShort, formatDistance, haversineKm, placeId } from '../utils/geo.js';
import { toast } from './toast.js';

export class Panel {
  /**
   * @param {{
   *   onSelect: (place: import('../state.js').Place, options?: { saved?: boolean }) => void,
   *   onRecent: (query: string) => void,
   *   onResize?: () => void,
   * }} options
   */
  constructor(options) {
    this.options = options;
    this.refs = Panel.queryRefs();
    this.tab = 'results';
  }

  /** Grab all the DOM this module owns. */
  static queryRefs() {
    const byId = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
    return {
      app: byId('app'),
      panel: byId('panel'),
      resultList: byId('result-list'),
      savedList: byId('saved-list'),
      recents: byId('recents'),
      recentChips: byId('recent-chips'),
      clearRecents: byId('clear-recents'),
      resultsEmpty: byId('results-empty'),
      resultsNone: byId('results-none'),
      resultsNoneTitle: byId('results-none-title'),
      resultsNoneText: byId('results-none-text'),
      resultsSkeleton: byId('results-skeleton'),
      savedEmpty: byId('saved-empty'),
      savedCount: byId('saved-count'),
      unitsBtn: /** @type {HTMLButtonElement} */ (byId('units-btn')),
      unitsLabel: byId('units-label'),
      sheetBtn: /** @type {HTMLButtonElement} */ (byId('sheet-btn')),
      grabber: document.querySelector('.panel__grabber'),
      tabs: Array.from(document.querySelectorAll('[role="tab"]')),
      resultsPane: byId('pane-results'),
      savedPane: byId('pane-saved'),
    };
  }

  init() {
    this.bindTabs();
    this.bindUnits();
    this.bindSheet();

    this.refs.clearRecents.addEventListener('click', () => {
      clearRecents();
      toast('Search history cleared', { type: 'info', duration: 2200 });
    });

    // Search results row interactions (delegated: rows are re-rendered often).
    this.refs.resultList.addEventListener('click', (event) => this.handleListClick(event, false));
    this.refs.savedList.addEventListener('click', (event) => this.handleListClick(event, true));

    on('results', () => {
      this.renderResults();
      if (state.status !== 'idle') this.setTab('results', { focus: false });
    });
    on('saved', () => {
      this.renderSaved();
      this.renderResults();
    });
    on('home', () => {
      this.renderResults();
      this.renderSaved();
    });
    on('units', () => {
      this.updateUnits();
      this.renderResults();
      this.renderSaved();
    });
    on('recents', () => this.renderRecents());
    on('active', (id) => this.paintActive(id));

    this.updateUnits();
    this.setTab('results', { focus: false });
    this.renderRecents();
    this.renderResults();
    this.renderSaved();
  }

  /* ---------------------------------------------------------------------- */
  /* Tabs                                                                    */
  /* ---------------------------------------------------------------------- */

  bindTabs() {
    this.refs.tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => this.setTab(tab.dataset.tab));
      tab.addEventListener('keydown', (event) => {
        const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (!keys.includes(event.key)) return;
        event.preventDefault();

        const last = this.refs.tabs.length - 1;
        let next = index;
        if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
        if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = last;

        const target = this.refs.tabs[next];
        this.setTab(target.dataset.tab);
        target.focus();
      });
    });
  }

  /** @param {'results'|'saved'} name */
  setTab(name, options = { focus: true }) {
    this.tab = name;

    this.refs.tabs.forEach((tab) => {
      const selected = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && options.focus) tab.focus();
    });

    this.refs.resultsPane.hidden = name !== 'results';
    this.refs.savedPane.hidden = name !== 'saved';
  }

  /* ---------------------------------------------------------------------- */
  /* Rendering                                                               */
  /* ---------------------------------------------------------------------- */

  renderResults() {
    const { results, status, message, query } = state;
    const loading = status === 'loading';

    this.refs.resultsSkeleton.hidden = !loading;
    this.refs.resultsEmpty.hidden = status !== 'idle';
    this.refs.resultsNone.hidden = status !== 'empty' && status !== 'error';
    this.refs.recents.hidden = !(status === 'idle' && state.recents.length > 0);

    if (!loading) {
      clear(this.refs.resultList);
      results.forEach((place) => {
        this.refs.resultList.append(this.buildItem(place, { saved: false }));
      });
    }

    this.refs.resultList.hidden = loading || results.length === 0;

    if (status === 'empty') {
      this.refs.resultsNoneTitle.textContent = 'No places found';
      this.refs.resultsNoneText.textContent = query
        ? `Nothing matched “${query}”. Try a city, region or landmark.`
        : 'Try a broader search — a city or region works best.';
    } else if (status === 'error') {
      this.refs.resultsNoneTitle.textContent = 'Search unavailable';
      this.refs.resultsNoneText.textContent =
        message || 'We could not reach the search service. Check your connection and try again.';
    }
  }

  renderSaved() {
    clear(this.refs.savedList);

    state.saved.forEach((place) => {
      this.refs.savedList.append(this.buildItem(place, { saved: true }));
    });

    this.refs.savedEmpty.hidden = state.saved.length > 0;
    this.refs.savedCount.textContent = String(state.saved.length);
    this.refs.savedCount.hidden = state.saved.length === 0;
  }

  renderRecents() {
    clear(this.refs.recentChips);

    state.recents.forEach((query) => {
      const chip = el(
        'button',
        { type: 'button', class: 'chip', title: `Search “${query}” again` },
        [svgIcon('i-clock', 'icon icon--sm'), el('span', { class: 'chip__label', text: query })],
      );
      chip.addEventListener('click', () => this.options.onRecent(query));
      this.refs.recentChips.append(chip);
    });

    this.refs.clearRecents.hidden = state.recents.length === 0;
  }

  /**
   * Build one row for a place.
   * @param {import('../state.js').Place} place
   * @param {{ saved?: boolean }} options
   */
  buildItem(place, options) {
    const savedRow = Boolean(options?.saved);
    const id = place.id || placeId(place);
    const item = el('li', {
      class: `place-item${savedRow ? ' place-item--saved' : ''}${
        state.activeId === id ? ' is-active' : ''
      }`,
      dataset: { id },
    });

    const meta = savedRow
      ? `${kindLabel(place)} · ${formatCoordsShort(place.lat, place.lon)}`
      : [kindLabel(place), place.context].filter(Boolean).join(' · ');

    const main = el('button', { type: 'button', class: 'place-item__main' }, [
      el('span', { class: 'place-item__icon' }, [
        svgIcon(savedRow ? 'i-star' : 'i-pin', 'icon icon--sm'),
      ]),
      el('span', { class: 'place-item__text' }, [
        el('span', { class: 'place-item__name', text: place.name }),
        el('span', { class: 'place-item__meta', text: meta }),
      ]),
    ]);
    main.setAttribute(
      'aria-label',
      `${place.name}. ${meta}. ${savedRow ? 'Open saved place' : 'Show on map'}`,
    );
    item.append(main);

    const distance = this.distanceLabel(place);
    if (distance) {
      item.append(
        el('span', {
          class: 'place-item__distance',
          text: distance,
          title: state.home ? `Distance from ${state.home.name}` : 'Distance from home',
        }),
      );
    }

    const actions = el('div', { class: 'place-item__actions' });

    if (savedRow) {
      const isHome = state.home?.id === id;
      const homeBtn = el('button', {
        type: 'button',
        class: 'item-btn',
        'aria-pressed': String(isHome),
        'aria-label': isHome ? `Remove ${place.name} as home` : `Set ${place.name} as home`,
        title: isHome ? 'Home base — click to remove' : 'Set as home',
      });
      homeBtn.append(svgIcon('i-home', 'icon icon--sm'));
      homeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (isHome) {
          clearHome();
          toast(`Removed “${place.name}” as home`, { type: 'info', duration: 2400 });
        } else {
          setHome(place);
          toast(`“${place.name}” is now your home base`, { type: 'success', duration: 2600 });
        }
      });
      actions.append(homeBtn);

      const removeBtn = el('button', {
        type: 'button',
        class: 'item-btn item-btn--danger',
        'aria-label': `Remove ${place.name} from saved places`,
        title: 'Remove from saved',
      });
      removeBtn.append(svgIcon('i-trash', 'icon icon--sm'));
      removeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        removeSaved(id);
        toast(`Removed “${place.name}”`, {
          type: 'info',
          duration: 4200,
          actionLabel: 'Undo',
          onAction: () => toggleSaved(place),
        });
      });
      actions.append(removeBtn);
    } else {
      const saved = isSaved(id);
      const saveBtn = el('button', {
        type: 'button',
        class: 'item-btn',
        'aria-pressed': String(saved),
        'aria-label': saved ? `Remove ${place.name} from saved` : `Save ${place.name}`,
        title: saved ? 'Saved — click to remove' : 'Save this place',
      });
      saveBtn.append(svgIcon('i-star', 'icon icon--sm'));
      saveBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const nowSaved = toggleSaved({ ...place, id });
        saveBtn.setAttribute('aria-pressed', String(nowSaved));
        saveBtn.setAttribute(
          'aria-label',
          nowSaved ? `Remove ${place.name} from saved` : `Save ${place.name}`,
        );
        saveBtn.title = nowSaved ? 'Saved — click to remove' : 'Save this place';
      });
      actions.append(saveBtn);
    }

    item.append(actions);
    return item;
  }

  /** @param {string | null} id */
  paintActive(id) {
    this.refs.resultList.querySelectorAll('.place-item').forEach((item) => {
      item.classList.toggle('is-active', id !== null && item.dataset.id === id);
    });
    this.refs.savedList.querySelectorAll('.place-item').forEach((item) => {
      item.classList.toggle('is-active', id !== null && item.dataset.id === id);
    });
  }

  /** @param {import('../state.js').Place} place */
  distanceLabel(place) {
    if (!state.home) return null;
    if (state.home.id === place.id) return 'Home';
    return formatDistance(haversineKm(state.home, place), state.units);
  }

  /**
   * Delegate clicks on a list.
   * @param {MouseEvent} event
   * @param {boolean} savedRow
   */
  handleListClick(event, savedRow) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const item = target.closest('.place-item');
    if (!item) return;

    // The dedicated action buttons handle themselves; ignore them here.
    if (target.closest('.item-btn')) return;

    const place = savedRow
      ? state.saved.find((candidate) => candidate.id === item.dataset.id)
      : state.results.find((candidate) => candidate.id === item.dataset.id);

    if (!place) return;
    setActive(place.id);
    this.options.onSelect(place, { saved: savedRow });
  }

  /* ---------------------------------------------------------------------- */
  /* Units & sheet                                                           */
  /* ---------------------------------------------------------------------- */

  bindUnits() {
    this.refs.unitsBtn.addEventListener('click', () => toggleUnits());
  }

  updateUnits() {
    const metric = state.units === 'km';
    this.refs.unitsLabel.textContent = metric ? 'km' : 'mi';
    this.refs.unitsBtn.setAttribute(
      'aria-label',
      metric
        ? 'Distance units: kilometres. Activate to switch to miles.'
        : 'Distance units: miles. Activate to switch to kilometres.',
    );
    this.refs.unitsBtn.title = metric ? 'Units: kilometres — switch to miles' : 'Units: miles — switch to kilometres';
  }

  bindSheet() {
    this.refs.sheetBtn.addEventListener('click', () => {
      this.setSheet(this.refs.app.dataset.sheet !== 'open');
    });

    // The grabber is a generous tap target for expanding the sheet.
    this.refs.grabber?.addEventListener('click', () => this.openSheet());

    // Focusing the search field on mobile should reveal the whole sheet —
    // except when the focus came from the collapse button itself.
    this.refs.panel.addEventListener('focusin', (event) => {
      if (!isNarrowViewport() || this.refs.app.dataset.sheet === 'open') return;
      if (event.target instanceof Element && event.target.closest('#sheet-btn')) return;
      this.openSheet();
    });
  }

  /** @param {boolean} open */
  setSheet(open) {
    this.refs.app.dataset.sheet = open ? 'open' : 'closed';
    this.refs.sheetBtn.setAttribute('aria-expanded', String(open));
    const label = open ? 'Collapse panel' : 'Expand panel';
    this.refs.sheetBtn.setAttribute('aria-label', label);
    this.refs.sheetBtn.title = label;

    window.setTimeout(() => this.options.onResize?.(), 340);
  }

  openSheet() {
    if (this.refs.app.dataset.sheet === 'open') return;
    this.setSheet(true);
  }

  closeSheet() {
    if (!isNarrowViewport()) return;
    if (this.refs.app.dataset.sheet === 'closed') return;
    this.setSheet(false);
  }

  focusFirstResult() {
    const first = this.refs.resultList.querySelector('.place-item__main');
    if (first instanceof HTMLElement) first.focus();
  }
}
