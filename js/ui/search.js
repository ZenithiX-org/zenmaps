/**
 * Search box controller: debounced queries, request cancellation, live status
 * announcements and keyboard handling.
 */

import { APP } from '../config.js';
import { setSearch, state } from '../state.js';
import { GeocodeError, searchPlaces } from '../services/geocoding.js';
import { debounce } from '../utils/dom.js';

export class SearchController {
  /**
   * @param {{
   *   onSelect: (place: import('../state.js').Place, options?: { record?: boolean }) => void,
   *   onFocusResults?: () => void,
   * }} options
   */
  constructor(options) {
    this.options = options;
    this.form = /** @type {HTMLFormElement} */ (document.getElementById('search-form'));
    this.input = /** @type {HTMLInputElement} */ (document.getElementById('search-input'));
    this.clearBtn = /** @type {HTMLButtonElement} */ (document.getElementById('search-clear'));
    this.spinner = /** @type {HTMLElement} */ (document.getElementById('search-spinner'));
    this.status = /** @type {HTMLElement} */ (document.getElementById('search-status'));

    /** @type {AbortController | null} */
    this.controller = null;

    this.debouncedSearch = debounce((query) => this.run(query), APP.searchDebounceMs);
  }

  init() {
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submit();
    });

    this.input.addEventListener('input', () => this.handleInput());

    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (this.input.value) {
          event.preventDefault();
          this.reset({ focus: true });
        } else {
          this.input.blur();
        }
        return;
      }

      if (event.key === 'ArrowDown' && state.results.length) {
        event.preventDefault();
        this.options.onFocusResults?.();
      }
    });

    this.clearBtn.addEventListener('click', () => this.reset({ focus: true }));
  }

  /** Focus the search field (used by the "/" and Cmd/Ctrl+K shortcuts). */
  focus() {
    this.input.focus();
    this.input.select();
  }

  /**
   * Run a search from outside the input (recent-search chips).
   * @param {string} query
   */
  searchFor(query) {
    this.input.value = query;
    this.clearBtn.hidden = query.length === 0;
    this.debouncedSearch.cancel();
    this.run(query);
  }

  handleInput() {
    const value = this.input.value;
    const query = value.trim();
    this.clearBtn.hidden = value.length === 0;

    if (!query) {
      this.debouncedSearch.cancel();
      this.abort();
      this.setLoading(false);
      this.setStatus('');
      this.showIdle();
      return;
    }

    if (query.length < APP.minQueryLength) {
      this.debouncedSearch.cancel();
      this.abort();
      this.setLoading(false);
      this.setStatus(`Type at least ${APP.minQueryLength} characters`);
      this.showIdle();
      return;
    }

    this.setStatus('');
    this.debouncedSearch(query);
  }

  submit() {
    const query = this.input.value.trim();
    if (query.length < APP.minQueryLength) {
      this.input.focus();
      return;
    }

    // Pressing Enter again on a finished search opens the best match.
    if (state.status === 'ready' && state.query === query && state.results.length) {
      this.options.onSelect(state.results[0], { record: true });
      return;
    }

    this.debouncedSearch.cancel();
    this.run(query);
  }

  /** @param {string} query */
  async run(query) {
    this.abort();
    this.controller = new AbortController();
    const { signal } = this.controller;

    this.setLoading(true);
    this.setStatus('Searching OpenStreetMap…');
    setSearch({ query, results: [], status: 'loading' });

    try {
      const results = await searchPlaces(query, { signal });
      if (signal.aborted) return;

      setSearch({
        query,
        results,
        status: results.length ? 'ready' : 'empty',
      });

      this.setStatus(
        results.length
          ? `${results.length} ${results.length === 1 ? 'place' : 'places'} found`
          : `No places found for “${query}”`,
      );
    } catch (error) {
      if (signal.aborted || error?.name === 'AbortError') return;

      const message =
        error instanceof GeocodeError
          ? error.message
          : 'Something went wrong while searching. Please try again.';

      setSearch({ query, results: [], status: 'error', message });
      this.setStatus(message);
    } finally {
      if (!signal.aborted) this.setLoading(false);
    }
  }

  reset(options = { focus: false }) {
    this.debouncedSearch.cancel();
    this.abort();
    this.input.value = '';
    this.clearBtn.hidden = true;
    this.setLoading(false);
    this.setStatus('');
    this.showIdle();
    if (options.focus) this.input.focus();
  }

  showIdle() {
    setSearch({ query: '', results: [], status: 'idle' });
  }

  abort() {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }

  /** @param {boolean} loading */
  setLoading(loading) {
    this.spinner.hidden = !loading;
    this.input.setAttribute('aria-busy', String(loading));
  }

  /** @param {string} message */
  setStatus(message) {
    this.status.textContent = message;
  }
}
