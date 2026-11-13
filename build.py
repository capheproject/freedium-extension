#!/usr/bin/env python3
"""Package the extension for Chromium and Firefox.

    python3 build.py

writes:
    dist/freedium-extension.zip          Chromium (manifest.json)
    dist/freedium-extension-firefox.zip  Firefox  (firefox/manifest.json)

Both packages share background.js and icons/; only the manifest differs.
"""
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent
DIST = ROOT / "dist"
SHARED = ["background.js", "LICENSE", *sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / "icons").glob("*.png"))]

TARGETS = {
    "freedium-extension.zip": ROOT / "manifest.json",
    "freedium-extension-firefox.zip": ROOT / "firefox" / "manifest.json",
}


def build(name, manifest):
    out = DIST / name
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(manifest, "manifest.json")
        for rel in SHARED:
            z.write(ROOT / rel, rel)
    print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    DIST.mkdir(exist_ok=True)
    for name, manifest in TARGETS.items():
        build(name, manifest)
