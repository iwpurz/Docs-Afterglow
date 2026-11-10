# Docs Afterglow

Docs Afterglow is a Firefox extension for customizing Google Docs and, in beta, Google Slides. It includes color themes, animated backgrounds, typing effects and sounds, optional music, and a theme editor called Studio.

| | |
| --- | --- |
| Current version | 1.1.0 |
| Firefox requirement | Firefox 115 or newer |
| License | GNU GPL v3 (see [LICENSE](LICENSE)) |
| Release notes | [CHANGELOG.md](CHANGELOG.md) |

## Install

Install the published version from [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/docs-afterglow/).

## Run from source

1. In Firefox, open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on…** and select `src/manifest.json`.
3. Open a Google Doc or Slides presentation.

## Build a package

Run `./build.sh` from this directory in an environment with Bash, Python 3, and `zip`. The script reads the version from `src/manifest.json` and writes `dist/docs-afterglow-<version>.xpi`. A package intended for regular Firefox installation must be signed by Mozilla through AMO.

## Project map

| Path | Responsibility |
| --- | --- |
| `src/manifest.json` | Firefox entry points, permissions, and script load order |
| `src/shared.js`, `src/themes.js` | Shared settings, validation, presets, and built-in themes |
| `src/background.js` | Extension shortcuts and music playback coordination |
| `src/content.js` | Google Docs and Slides page theming and integration |
| `src/bgengine.js`, `src/layers.js` | Background rendering and scene layers |
| `src/canvashook.js` | Crisp mode canvas integration |
| `src/fx.js`, `src/audio.js` | Typing effects, music controls, and synthesized typing sounds |
| `src/popup/` | Toolbar popup interface |
| `src/options/` | Settings interface |
| `src/studio/` | Theme creation and editing interface |
| `src/icons/` | Extension icons |
| `build.sh` | Reproducible XPI packaging command |

See [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md) for code boundaries and the change workflow.

## Privacy

- The extension itself makes no network requests. A music service you choose may load its own page.
- Keystrokes are classified only as letter, space, Enter, or Backspace to select an effect or sound; they are not stored, logged, or sent.
- Crisp mode reads color strings, not document text. Popup diagnostics report class names and positions, not document contents.

## Contributing

Keep the manifest's paths and script order aligned with the files they reference. Update [CHANGELOG.md](CHANGELOG.md) when preparing a release, and use the version in `src/manifest.json` as the package version.
