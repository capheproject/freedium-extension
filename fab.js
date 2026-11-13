// Floating button, injected on the sites listed in the settings and on
// bypass-site pages. The background decides whether it shows and what it says.
(() => {
  if (window.top !== window || window.__openInBypassFab) return;
  window.__openInBypassFab = true;

  const POS_KEY = "fabPosition"; // { x, y } as fractions of the viewport
  const SIZE = 52;
  const MARGIN = 12;
  const DRAG_THRESHOLD = 8;

  chrome.runtime
    .sendMessage({ type: "fab-query", url: location.href })
    .then((info) => {
      if (info && info.show) mount(info.label);
    })
    .catch(() => {});

  async function mount(label) {
    // Styles are set through element.style so a page's Content Security Policy
    // can't block them; the shadow root keeps the page's own CSS out.
    const host = document.createElement("div");
    Object.assign(host.style, {
      all: "initial",
      position: "fixed",
      zIndex: "2147483647",
      width: SIZE + "px",
      height: SIZE + "px",
      touchAction: "none"
    });
    const root = host.attachShadow({ mode: "closed" });

    const button = document.createElement("button");
    button.type = "button";
    button.title = label;
    button.setAttribute("aria-label", label);
    Object.assign(button.style, {
      all: "initial",
      boxSizing: "border-box",
      width: SIZE + "px",
      height: SIZE + "px",
      borderRadius: "16px",
      background: "rgb(174, 214, 167)",
      border: "1px solid rgba(20, 20, 18, 0.25)",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      touchAction: "none",
      userSelect: "none",
      webkitTapHighlightColor: "transparent"
    });
    button.append(arrowIcon());

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.title = "Hide this button on this page";
    close.setAttribute("aria-label", "Hide this button on this page");
    Object.assign(close.style, {
      all: "initial",
      position: "absolute",
      top: "-8px",
      left: "-8px",
      width: "22px",
      height: "22px",
      borderRadius: "11px",
      background: "rgb(20, 20, 18)",
      color: "#fff",
      font: "bold 15px/22px system-ui, sans-serif",
      textAlign: "center",
      cursor: "pointer",
      boxShadow: "0 1px 4px rgba(0, 0, 0, 0.3)"
    });
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      host.remove();
    });

    root.append(button, close);
    document.documentElement.append(host);

    // ---- Position (draggable, remembered per browser) ----
    let pos = { x: 1, y: 0.75 };
    try {
      const stored = (await chrome.storage.local.get(POS_KEY))[POS_KEY];
      if (stored && isFinite(stored.x) && isFinite(stored.y)) pos = stored;
    } catch (e) {
      // keep the default
    }

    function place() {
      const maxX = window.innerWidth - SIZE - MARGIN;
      const maxY = window.innerHeight - SIZE - MARGIN;
      host.style.left = Math.round(MARGIN + pos.x * (maxX - MARGIN)) + "px";
      host.style.top = Math.round(MARGIN + pos.y * (maxY - MARGIN)) + "px";
    }
    place();
    window.addEventListener("resize", place);

    let drag = null;
    button.addEventListener("pointerdown", (e) => {
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: host.offsetLeft, top: host.offsetTop, moved: false };
      button.setPointerCapture(e.pointerId);
    });
    button.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      const spanX = Math.max(1, window.innerWidth - SIZE - 2 * MARGIN);
      const spanY = Math.max(1, window.innerHeight - SIZE - 2 * MARGIN);
      pos = {
        x: Math.min(1, Math.max(0, (drag.left + dx - MARGIN) / spanX)),
        y: Math.min(1, Math.max(0, (drag.top + dy - MARGIN) / spanY))
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
    // Keyboard users
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
      button.style.opacity = "0.6";
      chrome.runtime.sendMessage({ type: "fab-click", url: location.href }).catch(() => {});
      setTimeout(() => {
        busy = false;
        button.style.opacity = "1";
      }, 1500);
    }
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
