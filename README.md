# Orbital Trajectory Sandbox

An interactive, browser-based learning sandbox for orbital mechanics. Tweak the six classical orbital elements, launch a spacecraft, and watch its trajectory propagate in real time across a 3D view, an Earth-locked overview, and a 2D ground track.

**Live prototype:** `https://<your-username>.github.io/<repo-name>/`
**Design system:** `https://<your-username>.github.io/<repo-name>/design-system/`
**Token reference:** `https://<your-username>.github.io/<repo-name>/design-system/tokens.html`

> Prototype v0.1. No build step, no framework, no dependencies to install for the site itself. Plain HTML, CSS and JavaScript plus three.js from a CDN. All images are hosted in the repo.

---

## Features

- **Six orbital-element sliders.** Semimajor axis, eccentricity, inclination, RAAN, argument of periapsis and true anomaly, with live periapsis/apoapsis hints.
- **Presets.** LEO, GTO, Molniya, GEO, polar and a suborbital impact trajectory.
- **Three synchronized views.** A free-orbit 3D camera, an Earth-locked overview camera, and an equirectangular ground track.
- **Live telemetry.** Orbit classification (circular / elliptical / escape / impact), altitude, speed, apsides, eccentricity, semimajor axis, period and mission elapsed time.
- **Real physics.** State vectors are propagated with a 4th-order Runge–Kutta integrator under two-body gravity.
- **Token-driven design system.** Every color, size and spacing value comes from a single JSON file.

## How the simulation works

The six sliders are the classical orbital elements. Semimajor axis and eccentricity set the ellipse's size and shape; inclination and RAAN orient its plane in space; argument of periapsis rotates the ellipse within that plane; true anomaly places the spacecraft along it.

These are converted from the perifocal frame into an Earth-centered inertial position and velocity, then integrated forward with RK4 under

```
a = −μ r / |r|³        μ = 398,600.4418 km³/s²,  R⊕ = 6,378.137 km
```

If the trajectory intersects Earth's surface, the simulation stops and flags an impact. The Moon is currently decorative only (no gravity), a placeholder for future multi-body work.

---

## Repository structure

```
.
├── index.html                  # The prototype
├── design-system/
│   ├── index.html              # Design guide: theme, color, type, spacing, components
│   └── tokens.html             # Token reference, auto-built from tokens.json
├── assets/
│   ├── css/
│   │   ├── tokens.css          # ⚠️ GENERATED from tokens/tokens.json. Do not edit
│   │   ├── main.css            # Prototype styles
│   │   ├── loader.css          # Page loader styles
│   │   ├── design-system-guide.css  # Design guide page styles
│   │   └── design-system.css   # Token reference page styles
│   ├── img/
│   │   ├── earth-texture.png   # Equirectangular Earth map (2:1), globe + ground track
│   │   └── moon-texture.png    # Equirectangular Moon map (2:1)
│   └── js/
│       ├── main.js             # Simulation, rendering, UI wiring
│       ├── loader.js           # Page loader (percentage counter)
│       ├── design-system-guide.js   # Fills live token values into the guide
│       └── design-system.js    # Renders tokens.json into the token reference
├── tokens/
│   └── tokens.json             # ✅ Source of truth for all design tokens
├── scripts/
│   └── build-tokens.mjs        # tokens.json → tokens.css (zero dependencies)
├── .github/workflows/
│   ├── deploy.yml              # Builds tokens + deploys to GitHub Pages
│   └── tokens-check.yml        # Fails PRs where tokens.css is out of date
└── package.json                # npm scripts only, no dependencies
```

CSS load order matters: `tokens.css` → `loader.css` → `main.css`.

---

## Getting started

```bash
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>
npm start            # serves the repo at http://localhost:3000
```

Any static server works (`python3 -m http.server`, VS Code Live Server, and so on). Opening `index.html` directly from disk will run the prototype, but the token reference page needs a server because it uses `fetch()` to load `tokens.json`.

Requirements: a modern browser with WebGL, and Node 18.11+ if you want to run the token scripts.

---

## Design tokens

All visual values live in **`tokens/tokens.json`**. `assets/css/tokens.css` is generated from it and should never be edited by hand.

### Commands

| Command                | What it does                                                     |
| ---------------------- | ---------------------------------------------------------------- |
| `npm run tokens:build` | Regenerates `assets/css/tokens.css` from `tokens/tokens.json`    |
| `npm run tokens:watch` | Rebuilds automatically whenever anything in `tokens/` changes    |
| `npm run tokens:check` | Exits with an error if `tokens.css` is out of date (used in CI)  |

### Format

The file follows the [W3C Design Tokens (DTCG)](https://www.designtokens.org/) format, so it can be imported into tools like Tokens Studio or Style Dictionary later without changes.

- Any object with a `$value` is a token; anything else is a group.
- `$type` is inherited from the nearest parent group.
- `$description` is optional and shows up on the token reference page.

```json
"color": {
  "$type": "color",
  "accent": { "$value": "#ff4d4d", "$description": "Ground track, velocity vector, impact state" }
}
```

### Naming

The CSS variable name is the token's path joined with hyphens:

| JSON path            | CSS variable            |
| -------------------- | ----------------------- |
| `color.accent`       | `--color-accent`        |
| `font.size.10-5`     | `--font-size-10-5`      |
| `space.24`           | `--space-24`            |
| `shadow.panel`       | `--shadow-panel`        |

Keys may only contain letters, digits and `-`. Decimal steps use a hyphen (`10-5` = 10.5px).

### References (aliases)

A token can point at another token with `{group.token}`. References compile to `var()` rather than being copied, so overriding the base token (for a theme, say) updates everything that points to it:

```json
"button-bg": { "$value": "{color.white}" }
```

```css
--color-button-bg: var(--color-white);
```

The build fails with a clear message on unknown references, circular references or duplicate names.

### Supported types

| `$type`      | Example `$value`                                      | Output                              |
| ------------ | ----------------------------------------------------- | ----------------------------------- |
| `color`      | `"#ff4d4d"`, `"rgba(255,77,77,0.6)"`                  | as written                          |
| `dimension`  | `"12px"` or `{ "value": 12, "unit": "px" }`           | `12px`                              |
| `fontFamily` | `["Segoe UI", "Roboto", "sans-serif"]`                | `'Segoe UI', Roboto, sans-serif`    |
| `fontWeight` | `600`                                                 | `600`                               |
| `number`     | `1.5`                                                 | `1.5`                               |
| `duration`   | `"0.18s"`                                             | `0.18s`                             |
| `shadow`     | `{ offsetX, offsetY, blur, spread, color, inset }` or an array of them | `inset 0 1px 0 rgba(…)` |

### Adding or changing a token

1. Edit `tokens/tokens.json`.
2. Run `npm run tokens:build` (or keep `tokens:watch` running).
3. Use it in CSS as `var(--your-token)`.
4. Commit **both** `tokens.json` and the regenerated `tokens.css`.

The deploy workflow rebuilds tokens anyway, but committing the generated file keeps the repo working when it's opened locally or served without CI. The PR check will flag it if they drift.

### Design system pages

Both design-system pages read from the same source. The **design guide** (`design-system/index.html`) is hand-written: theme principles, usage samples and component demos. Any element with `data-token="--name"` has its displayed value filled in from `tokens.css` at load time, so the numbers on the page always match the JSON. The **token reference** (`design-system/tokens.html`) is fully automatic and lists every token in `tokens.json`. When you add a token, it appears in the reference immediately; add it to the guide only if it needs a usage example.

### Using tokens in JavaScript

Canvas and three.js colors read from the same CSS variables, so the JSON stays the single source of truth:

```js
const css = getComputedStyle(document.documentElement);
const COLOR_ACCENT = css.getPropertyValue('--color-accent').trim();
```

---

## Deploying to GitHub Pages

Deployment is automated with GitHub Actions.

1. Push the repo to GitHub with `main` as the default branch.
2. Go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow manually from the **Actions** tab).

The workflow rebuilds `tokens.css`, copies only the public files (`index.html`, `assets/`, `design-system/`, `tokens/`) into `_site/`, and publishes it. Scripts and config files are not deployed.

All asset paths are relative, so the site works under a project URL (`/<repo-name>/`) as well as a custom domain. Keep new paths relative (`assets/...`, not `/assets/...`).

---

## Page loader

`assets/js/loader.js` shows a full-screen percentage counter for at least 2 seconds, then switches to tracking real resource-load progress if the page is still loading. Its markup and script must be the first things in `<body>`, and the script must load **without** `defer` or `async`:

```html
<div id="page-loader"><div id="loader-percent">0%</div></div>
<script src="assets/js/loader.js"></script>
```

Adjust `MIN_TIME` in `loader.js` to change the minimum display time. The fade duration (`FADE_MS`) should match the `--duration-slow` token.

---

## Known issues and notes

- **Textures must stay equirectangular (2:1).** `earth-texture.png` is used both on the globe and as the ground-track background, so a different projection or aspect ratio will misalign the satellite track. If an image fails to load, the app falls back to procedurally generated textures.
- **three.js is pinned to r128** via cdnjs. Upgrading may require changes (for example, `Geometry` and some helper APIs changed in later releases).
- On short viewports the floating panels can overlap one another.

## Roadmap ideas

- Lunar gravity and multi-body trajectories (slingshots)
- Maneuver planning (Δv burns at periapsis/apoapsis, Hohmann transfers)
- J2 perturbation and atmospheric drag
- Light theme via token overrides

## License

TBD. Add a `LICENSE` file before making the repo public.
