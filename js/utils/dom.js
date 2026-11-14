/**
 * Small DOM helpers. No framework, no dependencies — just enough sugar to keep
 * view code readable.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** @param {string} selector @param {ParentNode} [root] */
export function $(selector, root = document) {
  return root.querySelector(selector);
}

/** @param {string} selector @param {ParentNode} [root] */
export function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

/**
 * Create an element.
 *
 * Supported props: `class`, `text`, `dataset`, event handlers (`onclick`…),
 * booleans become empty attributes, everything else becomes an attribute.
 *
 * @param {string} tag
 * @param {Record<string, any>} [props]
 * @param {Node | string | Array<Node | string | null | false>} [children]
 * @returns {HTMLElement}
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class') {
      node.className = value;
    } else if (key === 'text') {
      node.textContent = String(value);
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(value));
    }
  }

  append(node, children);
  return node;
}

/** Append a child, or an array of children, ignoring empty values. */
export function append(parent, children) {
  const list = Array.isArray(children) ? children : [children];

  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return parent;
}

/**
 * Build an inline SVG icon from the sprite in index.html.
 * Only ever called with icon ids defined in our own markup, never user input.
 *
 * @param {string} id sprite symbol id, e.g. "i-search"
 * @param {string} [className]
 */
export function svgIcon(id, className = 'icon') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);

  return svg;
}

/** @param {Element} node */
export function clear(node) {
  node.replaceChildren();
}

/**
 * Trailing debounce.
 * @template {(...args: any[]) => void} F
 * @param {F} fn
 * @param {number} wait
 */
export function debounce(fn, wait) {
  let timer = 0;
  /** @param {Parameters<F>} args */
  const debounced = (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => window.clearTimeout(timer);
  return debounced;
}

/** @param {number} ms */
export function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** True when the event target is a text field where shortcuts should not fire. */
export function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** Mobile / narrow viewport check matching the CSS breakpoint. */
export function isNarrowViewport() {
  return window.matchMedia('(max-width: 899px)').matches;
}

/** True when the user prefers reduced motion. */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
