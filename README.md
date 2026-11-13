# Open in Freedium

A small browser extension (Chromium and Firefox) that opens the page you're on through
`https://freedium-mirror.cfd/<url>`.

<p align="center"><img src="docs/screenshot.png" alt="Right-click a link and choose Open link in Freedium" width="640"></p>

## Install

### Chrome, Edge, Brave and other Chromium browsers

1. Download **[freedium-extension.zip](https://github.com/capheproject/freedium-extension/releases/latest/download/freedium-extension.zip)** from the [latest release](https://github.com/capheproject/freedium-extension/releases/latest) and unzip it somewhere it can stay (the browser loads it from that folder).
2. Go to `chrome://extensions` (or `edge://extensions`, `brave://extensions`, …).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick the unzipped folder.
5. Optional: pin the extension to the toolbar.

It isn't on the Chrome Web Store, so the browser may remind you on startup that a developer-mode extension is installed. That's expected.

### Firefox

1. Download **[freedium-extension-firefox.zip](https://github.com/capheproject/freedium-extension/releases/latest/download/freedium-extension-firefox.zip)** from the [latest release](https://github.com/capheproject/freedium-extension/releases/latest). No need to unzip it.
2. Go to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and pick the zip.

Firefox removes temporary add-ons when it restarts. To keep it installed, the zip has to be
signed by Mozilla: upload it to [addons.mozilla.org](https://addons.mozilla.org/developers/)
as an *unlisted* (self-distributed) add-on, and install the signed `.xpi` it gives back.
Firefox Developer Edition, Nightly and ESR can instead set `xpinstall.signatures.required`
to `false` in `about:config` and install the unsigned zip from `about:addons` → gear → **Install Add-on From File…**.

## Use

- **Toolbar button** or **Alt+Shift+F**: opens the current page in Freedium in a new tab.
- **Right-click a page**: "Open page in Freedium".
- **Right-click a link**: "Open link in Freedium" (no need to visit the article first).

To change the shortcut, go to `chrome://extensions/shortcuts` (Firefox: `about:addons` → gear → **Manage Extension Shortcuts**).
If the mirror domain changes, edit `FREEDIUM_BASE` at the top of `background.js`
and click the reload icon on the extension's card (Firefox: rebuild and load the zip again).

## Build

Both browsers share `background.js` and `icons/`; only the manifest differs
(`manifest.json` for Chromium, `firefox/manifest.json` for Firefox, which uses
background scripts instead of a service worker and carries the add-on ID). To make the release zips:

```
python3 build.py
```

This writes `dist/freedium-extension.zip` and `dist/freedium-extension-firefox.zip`.
When bumping the version, change it in both manifests.

## Icon

The icons in `icons/` are drawn by `make_icons.py` (plain Python, no dependencies).
To tweak the colours or arrow thickness, edit `GREEN`, `INK` or `STROKE` in it, then run:

```
python3 make_icons.py icons
```

## License

MIT
