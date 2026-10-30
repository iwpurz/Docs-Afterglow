# Docs Afterglow

Make Google Docs yours. A Firefox extension that re-themes Google Docs: dark and custom
color themes, gradients, animated and scenic backgrounds, and a Studio for building your own.

Created by iwpurz, 2026. Licensed under the GNU General Public License v3 (see `LICENSE`).
Not affiliated with or endorsed by Google. "Google Docs" is a trademark of Google LLC.

## What it does

- **Ready-made themes** in five groups: Built-in (Midnight, Nord, Dracula, …), Scenes
  (Sakura Dusk, Neon Rain, …), Seasonal (Halloween Hollow, Frosted Evergreen, Spring Bloom,
  Summer Solstice), My looks (saved from the settings page) and My themes (saved in Studio).
  Scenic presets use 25% film grain.
  The popup, the settings page and Studio all show the same list.
- **Backgrounds:** solid, gradient, animated gradient, aurora, starfield, Matrix rain, neon network,
  plasma, your own image/GIF, or layered scenes with images, video and particle effects.
- **Full control of the interface:** toolbar/menus/sidebars, the page, text, cursor, selection, scrollbars,
  each with its own colors and opacity.
- **The Docs home page** (your document list) gets the same theme, with its own opacity slider.
- **Studio:** a layer editor. Open any theme in it, change it, save it, export/import `.afterglow.json` files.
  Imported themes keep embedded PNG, JPEG, WebP, GIF and MP4/WebM media; SVG, remote links and custom code are rejected.
- **Schedule:** always, only when Firefox is in dark mode, or between set times. `Alt+Shift+D` toggles the theme.

## Install

**From Firefox Add-ons:** search for "Docs Afterglow" (once published).

**From a file (Firefox Developer Edition / Nightly / unbranded builds):**
1. `about:config` → set `xpinstall.signatures.required` to `false`.
2. `about:addons` → gear icon → *Install Add-on From File…* → pick the `.xpi`.

**Temporary (any Firefox, until restart):** `about:debugging#/runtime/this-firefox` →
*Load Temporary Add-on…* → pick the `.xpi` or `manifest.json`.

Requires Firefox 115 or newer.

## Privacy

Everything stays in your browser. No accounts, no network requests, no analytics. See `PRIVACY.md`.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Saves your settings and themes. |
| `unlimitedStorage` | Themes can embed images/video; browser storage is otherwise capped at about 10 MB. |
| Access to `docs.google.com/document/*` | The only place the theme is applied. |

## Troubleshooting

- **A part of Docs isn't themed.** Google changes Docs' markup. Settings → Advanced lists the CSS selectors
  used for each area; inspect the element (Ctrl+Shift+C) and add its selector. *Auto-clear opaque areas* handles
  most leftover light panels by itself.
- **Pictures in a document look inverted.** Page text is drawn on a canvas and recolored as a whole, so images in
  the document are inverted with it. Turn off *Dark-ify* under Page to see the original colors.
- **Heavy animation.** Lower the frame rate cap (Background settings or Studio) or choose a static background.
- **Background image doesn't show.** Upload the file instead of using a URL; Docs' security policy can block remote images.

## Building

`python3 scripts/build.py` writes `dist/docs-afterglow-<version>.xpi`. There is no build step beyond zipping;
the source is plain JavaScript.

See `CHANGELOG.md` for release notes.
