# Project guide

## Layout

- `src/` contains the Firefox extension. `src/manifest.json` is the extension entry point; its scripts, pages, styles, and icons stay together under this directory.
- `docs/` contains contributor and project documentation.
- `README.md`, `CHANGELOG.md`, and `LICENSE` are repository-level files.
- `build.sh` packages the contents of `src/` into an XPI with `manifest.json` at the archive root.

## Making changes

Keep files referenced by the manifest and extension pages inside `src/`, and preserve their relative paths. Update the project map in the root README when adding a major component. Update `CHANGELOG.md` when preparing a release, and use the version in `src/manifest.json` as the package version.

To load the source in Firefox, select `src/manifest.json` from `about:debugging#/runtime/this-firefox`. To build a package, run `./build.sh` from the repository root.
