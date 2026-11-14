# ZenMaps

A calm, fast map for exploring the world. Search any place, click anywhere to see
what is there, save the spots you care about, keep a home base and measure
distances — no account, no tracking, no build step.

![No dependencies beyond a vendored Leaflet build](https://img.shields.io/badge/dependencies-none-brightgreen)

## Features

- **Search** any city, address or landmark via OpenStreetMap Nominatim, with
  debounced queries, request cancellation, a polite 1 req/s queue and caching.
- **Explore by clicking** — reverse geocoding turns any point into a place card
  with coordinates and distance from your home base.
- **Saved places** kept in `localStorage`, shown as quiet dots on the map and in
  the Saved tab, with one-click undo.
- **Home base** pin, with live distance readouts in results, saved rows and popups.
- **Measure distance** by clicking points on the map: per-segment labels, running
  total, undo and clear.
- **Five map styles** — Streets, Light, Dark, Terrain and Satellite — and the
  style follows the theme until you pick one yourself.
- **Light / dark themes**, honouring `prefers-color-scheme` until you choose.
- **Mobile-first layout** with a draggable-feeling bottom sheet, and a floating
  side panel on desktop.
- **Shareable views**: the current position lives in the URL hash
  (`#12.5/30.901/75.857`), so links restore the exact view.
- **Keyboard shortcuts**: `/` or `⌘/Ctrl + K` search, `L` locate, `M` measure,
  `B` map style, `Esc` close.
- **Accessible** tab lists, live regions, focus-visible states, reduced-motion
  support and labelled controls throughout.

## Running it

The site is static; any web server works. It must be served over HTTP (ES modules
and `fetch` do not work from `file://`).

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

Deploy by uploading the repository as-is — there is nothing to compile.

## Project structure

```
.
├── index.html              # app shell: markup, icon sprite, script entry
├── assets/
│   └── favicon.svg
├── css/
│   ├── tokens.css          # design tokens (colour, type, space, motion, dark mode)
│   ├── base.css            # reset, typography, a11y helpers, scrollbars
│   ├── layout.css          # app shell, panel, map chrome, mobile bottom sheet
│   ├── components.css      # buttons, place rows, chips, empties, toasts
│   └── map.css             # Leaflet theming, pins, popups, measure styles
├── js/
│   ├── main.js             # composition root: wiring, keyboard, map clicks
│   ├── config.js           # app config, basemaps, endpoints, storage keys
│   ├── state.js            # observable store + persistence of user choices
│   ├── map/
│   │   ├── map.js          # Leaflet lifecycle, basemaps, camera, URL hash
│   │   ├── markers.js      # place / home / saved / user markers
│   │   ├── icons.js        # divIcon factories (inline SVG pins)
│   │   └── measure.js      # distance measuring tool
│   ├── services/
│   │   ├── geocoding.js    # Nominatim search + reverse, queue, cache, errors
│   │   ├── geolocation.js  # geolocation promise wrapper
│   │   └── storage.js      # safe localStorage access
│   ├── ui/
│   │   ├── places.js       # side panel: tabs, lists, units, sheet
│   │   ├── search.js       # search input controller
│   │   ├── placePopup.js   # map popup cards
│   │   ├── toolbar.js      # locate / measure / basemap / share tools
│   │   ├── theme.js        # theme application + toggle
│   │   └── toast.js        # toast notifications
│   └── utils/
│       ├── dom.js          # element/icon helpers, debounce, viewport checks
│       └── geo.js          # haversine, distance/coordinate formatting, hash
└── vendor/
    └── leaflet/            # Leaflet 1.9.4 (BSD-2-Clause, see LICENSE)
```

### Conventions

- **No framework, no bundler.** Native ES modules, one responsibility per module.
- **State flows one way.** Views never mutate state directly; they call actions in
  `js/state.js`, which persist and emit events. Views subscribe to what they need.
- **Services own the network.** UI code never constructs a URL; `geocoding.js`
  owns endpoints, throttling and error messages.
- **The DOM layer never builds HTML strings from API data** — popups and list rows
  are created with `document.createElement`, so place names cannot inject markup.
- **Tokens over magic values.** Colours, radii, shadows and motion live in
  `css/tokens.css`; `[data-theme="dark"]` overrides the palette in one place.

## Data & privacy

- Search and reverse geocoding use [Nominatim](https://nominatim.openstreetmap.org/)
  (OpenStreetMap Foundation), with a rate-limited queue and caching.
- Map tiles come from OpenStreetMap, CARTO, OpenTopoMap and Esri, per the selected
  style; attribution is always shown on the map.
- Saved places, home, theme, units and recent searches are stored only in your
  browser's `localStorage`. There is no backend and no analytics.
