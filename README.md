# Open in Freedium

A small Chromium extension that opens the page you're on through
`https://freedium-mirror.cfd/<url>`.

<p align="center"><img src="docs/screenshot.png" alt="Right-click a link and choose Open link in Freedium" width="640"></p>

## Install

1. Download **[freedium-extension.zip](https://github.com/capheproject/freedium-extension/releases/latest/download/freedium-extension.zip)** from the [latest release](https://github.com/capheproject/freedium-extension/releases/latest) and unzip it somewhere it can stay (the browser loads it from that folder).
2. Go to `chrome://extensions` (or `edge://extensions`, `brave://extensions`, …).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick the unzipped folder.
5. Optional: pin the extension to the toolbar.

It isn't on the Chrome Web Store, so the browser may remind you on startup that a developer-mode extension is installed. That's expected.

## Use

- **Toolbar button** or **Alt+Shift+F**: opens the current page in Freedium in a new tab.
- **Right-click a page**: "Open page in Freedium".
- **Right-click a link**: "Open link in Freedium" (no need to visit the article first).

To change the shortcut, go to `chrome://extensions/shortcuts`.
If the mirror domain changes, edit `FREEDIUM_BASE` at the top of `background.js`
and click the reload icon on the extension's card.

## Icon

The icons in `icons/` are drawn by `make_icons.py` (plain Python, no dependencies).
To tweak the colours or arrow thickness, edit `GREEN`, `INK` or `STROKE` in it, then run:

```
python3 make_icons.py icons
```

## License

MIT
