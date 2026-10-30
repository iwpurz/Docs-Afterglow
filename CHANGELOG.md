# Changelog

## 1.0.0 — first public release

- Themes for the Google Docs editor and, new, the Docs home page.
- One shared theme list (built-in, scenes, saved looks, Studio themes) in the popup, settings page and Studio.
  Any built-in theme can be opened and edited in Studio (new *Classic background* layer type).
- Studio themes remember whether Docs should be inverted (so light themes round-trip).
- Settings page previews layered scenes; the *Layers* background type only appears when a layered theme exists.
- Studio library media moved out of the theme list, so opening the popup no longer loads every saved video.
- Faster: UI tagging is throttled and ignores typing, caret and selection changes; background work pauses in hidden tabs.
- Fixes: corrupt saved settings no longer break the theme; cleared containers no longer hide their children from
  detection; importing a settings file asks before accepting its custom CSS.
- Removed the unneeded host permission; minimum Firefox 115.
