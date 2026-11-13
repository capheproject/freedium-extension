// Floating button, injected on the sites listed in the settings and on
// bypass-site pages. The background decides whether it shows and what it says.
(() => {
  if (window.top !== window || window.__openInBypassFab) return;
  window.__openInBypassFab = true;

  const POS_KEY = "fabPosition"; // { x, y } as fractions of the visible area
  const SIZE = 52; // on-screen size, whatever the page's zoom
  const MARGIN = 12;
  const DRAG_THRESHOLD = 8;

  chrome.runtime
    .sendMessage({ type: "fab-query", url: location.href })
    .then((info) => {
      if (info && info.show) mount(info.label);
    })
    .catch(() => {});

  // Set styles with !important through element.style: a page's Content
  // Security Policy can't block them and its own CSS can't override them.
  function css(el, styles) {
    for (const [k, v] of Object.entries(styles)) el.style.setProperty(k, v, "important");
  }

  async function mount(label) {
    const host = document.createElement("div");
    css(host, {
      all: "initial",
      display: "block",
      position: "fixed",
      left: "0",
      top: "0",
      "z-index": "2147483647",
      width: SIZE + "px",
      height: SIZE + "px",
      "transform-origin": "0 0",
      "touch-action": "none",
      visibility: "hidden"
    });
    const root = host.attachShadow({ mode: "closed" });

    const button = document.createElement("button");
    button.type = "button";
    button.title = label;
    button.setAttribute("aria-label", label);
    css(button, {
      all: "initial",
      "box-sizing": "border-box",
      width: SIZE + "px",
      height: SIZE + "px",
      "border-radius": "16px",
      background: "rgb(174, 214, 167)",
      border: "1px solid rgba(20, 20, 18, 0.25)",
      "box-shadow": "0 2px 8px rgba(0, 0, 0, 0.3)",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      cursor: "pointer",
      "touch-action": "none",
      "user-select": "none",
      "-webkit-tap-highlight-color": "transparent"
    });
    button.append(arrowIcon());

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.title = "Hide this button on this page";
    close.setAttribute("aria-label", "Hide this button on this page");
    css(close, {
      all: "initial",
      position: "absolute",
      top: "-9px",
      left: "-9px",
      width: "24px",
      height: "24px",
      "border-radius": "12px",
      background: "rgb(20, 20, 18)",
      color: "#fff",
      font: "bold 16px/24px system-ui, sans-serif",
      "text-align": "center",
      cursor: "pointer",
      "box-shadow": "0 1px 4px rgba(0, 0, 0, 0.3)"
    });

    root.append(button, close);

    // ---- Keep it on the page ----
    // Sites built with React and similar can rebuild the whole document after
    // loading and throw the button away; put it back when that happens.
    let closed = false;
    let watched = null;
    const watcher = new MutationObserver(() => attach());
    function attach() {
      if (closed) return;
      const html = document.documentElement;
      if (!html) return;
      // Follow a replaced <html> element.
      if (watched !== html) {
        watcher.disconnect();
        watcher.observe(document, { childList: true });
        watcher.observe(html, { childList: true });
        watched = html;
      }
      if (host.parentNode !== html) {
        html.append(host);
        place();
      }
    }
    // Backup for changes the observer can't see.
    const timer = setInterval(attach, 2000);

    close.addEventListener("click", (e) => {
      e.stopPropagation();
      closed = true;
      watcher.disconnect();
      window.removeEventListener("resize", schedule);
      clearInterval(timer);
      host.remove();
    });

    // ---- Size and position ----
    // Desktop-layout pages on a phone are shown zoomed out (and the user can
    // pinch-zoom any page). Scale the button by the inverse of the zoom and
    // place it inside the visible part of the page, so it always looks the same.
    let pos = { x: 1, y: 0.75 };
    try {
      const stored = (await chrome.storage.local.get(POS_KEY))[POS_KEY];
      if (stored && isFinite(stored.x) && isFinite(stored.y)) pos = stored;
    } catch (e) {
      // keep the default
    }

    function view() {
      const vv = window.visualViewport;
      const scale = vv && vv.scale > 0 ? vv.scale : 1;
      return {
        scale,
        left: vv ? vv.offsetLeft : 0,
        top: vv ? vv.offsetTop : 0,
        width: vv ? vv.width : window.innerWidth,
        height: vv ? vv.height : window.innerHeight
      };
    }

    // Free space (in page pixels) the button can move around in.
    function span(v) {
      const k = 1 / v.scale;
      return {
        x: Math.max(0, v.width - (SIZE + 2 * MARGIN) * k),
        y: Math.max(0, v.height - (SIZE + 2 * MARGIN) * k),
        k
      };
    }

    function place() {
      const v = view();
      const s = span(v);
      const left = v.left + MARGIN * s.k + pos.x * s.x;
      const top = v.top + MARGIN * s.k + pos.y * s.y;
      css(host, {
        transform: `translate(${left}px, ${top}px) scale(${s.k})`,
        visibility: "visible"
      });
    }

    let frame = 0;
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(() => ((frame = 0), place()));
    };
    window.addEventListener("resize", schedule);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", schedule);
      window.visualViewport.addEventListener("scroll", schedule);
    }

    // ---- Drag to move, tap to use ----
    let drag = null;
    button.addEventListener("pointerdown", (e) => {
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, start: { ...pos }, moved: false };
      button.setPointerCapture(e.pointerId);
    });
    button.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const v = view();
      // Pointer coordinates are in page pixels; the threshold is on-screen.
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) * v.scale < DRAG_THRESHOLD) return;
      drag.moved = true;
      const s = span(v);
      pos = {
        x: Math.min(1, Math.max(0, drag.start.x + (s.x ? dx / s.x : 0))),
        y: Math.min(1, Math.max(0, drag.start.y + (s.y ? dy / s.y : 0)))
      };
      place();
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const wasDrag = drag.moved;
      drag = null;
      if (wasDrag) {
        chrome.storage.local.set({ [POS_KEY]: pos }).catch(() => {});
      } else if (e.type === "pointerup") {
        activate();
      }
    };
    button.addEventListener("pointerup", end);
    button.addEventListener("pointercancel", end);
    button.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });

    let busy = false;
    function activate() {
      if (busy) return;
      busy = true;
      button.style.setProperty("opacity", "0.6", "important");
      chrome.runtime.sendMessage({ type: "fab-click", url: location.href }).catch(() => {});
      setTimeout(() => {
        busy = false;
        button.style.setProperty("opacity", "1", "important");
      }, 1500);
    }

    attach();
  }

  // The extension's arrow, drawn as in make_icons.py.
  function arrowIcon() {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 128 128");
    svg.setAttribute("width", "30");
    svg.setAttribute("height", "30");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", "M34 64H94M70 40L94 64L70 88");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "rgb(20, 20, 18)");
    path.setAttribute("stroke-width", "14");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(path);
    return svg;
  }
})();
