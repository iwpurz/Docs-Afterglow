# Changelog

## 1.1.0

* **Google Slides support (beta).** The theme, background scenes, typing effects and sounds now also work in Google Slides: film strip, rulers, speaker notes and the side rail are themed, and the slide itself is left as authored. Slides is still beta and may have rough edges.
* **Typing effects, sounds and music** (all off by default). Effects are drawn on a click-through layer at the caret, sounds are synthesized live (no audio files), and music plays a link you choose (YouTube, Spotify, SoundCloud or a direct audio file) or audio files you add. Shortcuts: Alt+Shift+D toggles the theme, Alt+Shift+S sounds, Alt+Shift+M music.
* **Simple typing effects:** new *Fade in* (new letters fade in) and *Fade out* (a soft glow trails what you typed and fades), grouped with *Soft glow* and *Ripples* under "Simple". *Fade in* is the default effect for new installs. Particle effects respect your system's reduced-motion setting; the simple fades stay on.
* **Themes can bring a "vibe"** (typing effect, sound and music link). They only choose which one plays, never turn anything on, and you can opt out with "Let themes choose my typing effect, sound and music".
* **Crisp mode (beta)** for Docs: recolors text at paint time so text stays sharp and pictures keep their colors.
* **Copy diagnostics** in the popup (class names, colors and positions only; never document text) to make bug reports easier.
* Fixes (Slides): typing effects now find the Slides caret and hook the text box as soon as you click into it; effects no longer fire while typing in the title box, Find, menu search or speaker notes; typing in a slide no longer re-scans the whole interface (less lag); the film strip panel, its control icons, page numbers and the rulers are themed; the slide and its containers can never be color-inverted.
* Settings schema bumped to 6: saved selector lists are reset once so new selectors apply.

## 1.0.0 — first public release

* Themes for the Google Docs editor and, new, the Docs home page.
* One shared theme list (built-in, scenes, saved looks, Studio themes) in the popup, settings page and Studio. Any built-in theme can be opened and edited in Studio (new Classic background layer type).
* Studio themes remember whether Docs should be inverted (so light themes round-trip).
* Settings page previews layered scenes; the Layers background type only appears when a layered theme exists.
* Studio library media moved out of the theme list, so opening the popup no longer loads every saved video.
* Faster: UI tagging is throttled and ignores typing, caret and selection changes; background work pauses in hidden tabs.
* Fixes: corrupt saved settings no longer break the theme; cleared containers no longer hide their children from detection; importing a settings file asks before accepting its custom CSS.
* Removed the unneeded host permission; minimum Firefox 115.
