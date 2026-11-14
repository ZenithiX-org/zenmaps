/**
 * Theme: applies the persisted (or system) colour scheme to the document and
 * keeps the toggle button in sync.
 */

import { STORAGE_KEYS } from '../config.js';
import { adoptTheme, on, state, toggleTheme } from '../state.js';
import * as storage from '../services/storage.js';

const media = window.matchMedia('(prefers-color-scheme: dark)');

/** @type {HTMLButtonElement | null} */
let button = null;

/**
 * @param {HTMLButtonElement | null} themeButton
 */
export function initTheme(themeButton) {
  button = themeButton;

  apply(state.theme);
  on('theme', apply);

  button?.addEventListener('click', () => toggleTheme());

  // Follow the OS preference only until the user makes an explicit choice.
  media.addEventListener('change', (event) => {
    if (storage.read(STORAGE_KEYS.theme, null)) return;
    adoptTheme(event.matches ? 'dark' : 'light');
  });
}

/** @param {'light'|'dark'} theme */
function apply(theme) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = theme;

  if (button) {
    const label = dark ? 'Switch to light theme' : 'Switch to dark theme';
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', dark ? '#080b0e' : '#e9edef');
  });
}

/** Current effective theme. */
export function currentTheme() {
  return state.theme;
}
