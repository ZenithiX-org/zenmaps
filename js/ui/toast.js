/**
 * Toasts — small, self-dismissing confirmations that replace alert().
 */

import { el, svgIcon } from '../utils/dom.js';

const ICONS = {
  success: 'i-check',
  error: 'i-warning',
  info: 'i-compass',
};

const MAX_VISIBLE = 3;
/** @type {HTMLElement | null} */
let host = null;

function getHost() {
  if (!host || !host.isConnected) {
    host = document.getElementById('toasts');
  }
  return host;
}

/**
 * @param {string} message
 * @param {{
 *   type?: 'info' | 'success' | 'error',
 *   duration?: number,
 *   actionLabel?: string,
 *   onAction?: () => void,
 * }} [options]
 * @returns {HTMLElement | null}
 */
export function toast(message, options = {}) {
  const { type = 'info', duration = 3600, actionLabel, onAction } = options;
  const container = getHost();
  if (!container) return null;

  const node = el('div', { class: `toast toast--${type}` });
  node.append(el('span', { class: 'toast__icon' }, [svgIcon(ICONS[type] ?? ICONS.info, 'icon icon--sm')]));
  node.append(el('span', { class: 'toast__text', text: message }));

  let timer = 0;

  const dismiss = () => {
    window.clearTimeout(timer);
    if (!node.isConnected || node.classList.contains('is-leaving')) return;
    node.classList.add('is-leaving');
    window.setTimeout(() => node.remove(), 220);
  };

  if (actionLabel && onAction) {
    node.append(
      el(
        'button',
        {
          type: 'button',
          class: 'toast__action',
          onclick: () => {
            onAction();
            dismiss();
          },
        },
        actionLabel,
      ),
    );
  }

  container.append(node);

  while (container.children.length > MAX_VISIBLE) {
    container.firstElementChild?.remove();
  }

  timer = window.setTimeout(dismiss, duration);

  return node;
}

/** Remove every visible toast. */
export function dismissAll() {
  const container = getHost();
  if (!container) return;
  Array.from(container.children).forEach((child) => {
    child.classList.add('is-leaving');
    window.setTimeout(() => child.remove(), 220);
  });
}
