# Open in Freedium

A small Chromium extension that opens the page you're on through
`https://freedium-mirror.cfd/<url>`.

## Install

1. Go to `chrome://extensions` (or `edge://extensions`, `brave://extensions`, …).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and pick this folder.
4. Optional: pin the extension to the toolbar.

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
