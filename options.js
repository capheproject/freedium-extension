const list = document.getElementById("list");
const autoFallback = document.getElementById("autoFallback");
const buttonSites = document.getElementById("buttonSites");
const buttonSitesError = document.getElementById("buttonSitesError");
const buttonOnBypass = document.getElementById("buttonOnBypass");
const status = document.getElementById("status");

let services = [];

function setStatus(text) {
  status.textContent = text;
}

function render() {
  list.textContent = "";
  services.forEach((s, i) => {
    const li = document.createElement("li");
    li.className = "row" + (s.enabled ? "" : " off");

    const enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.checked = s.enabled;
    enabled.title = "Use this site";
    enabled.setAttribute("aria-label", `Use ${s.name || "this site"}`);
    enabled.addEventListener("change", () => {
      s.enabled = enabled.checked;
      li.classList.toggle("off", !s.enabled);
      setStatus("");
    });

    const name = document.createElement("input");
    name.type = "text";
    name.className = "name";
    name.value = s.name;
    name.placeholder = "Name";
    name.setAttribute("aria-label", "Name");
    name.addEventListener("input", () => {
      s.name = name.value;
      setStatus("");
    });

    const tools = document.createElement("div");
    tools.className = "tools";
    const button = (label, title, onClick, disabled) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.title = title;
      b.setAttribute("aria-label", title);
      b.disabled = disabled;
      b.addEventListener("click", () => {
        onClick();
        setStatus("");
        render();
      });
      tools.append(b);
    };
    button("↑", "Move up", () => services.splice(i - 1, 0, services.splice(i, 1)[0]), i === 0);
    button("↓", "Move down", () => services.splice(i + 1, 0, services.splice(i, 1)[0]), i === services.length - 1);
    button("✕", "Remove", () => services.splice(i, 1), false);

    const template = document.createElement("input");
    template.type = "text";
    template.className = "template";
    template.value = s.template;
    template.placeholder = "https://example.com/{url}";
    template.spellcheck = false;
    template.autocapitalize = "off";
    template.setAttribute("aria-label", "Address");
    template.addEventListener("input", () => {
      s.template = template.value.trim();
      setStatus("");
    });

    li.append(enabled, name, tools, template);
    if (s.error) {
      const err = document.createElement("div");
      err.className = "error";
      err.textContent = s.error;
      li.append(err);
    }
    list.append(li);
  });
}

function validate() {
  let ok = true;
  for (const s of services) {
    s.name = s.name.trim();
    const problem = templateError(s.template);
    s.error = problem ? `Address ${problem}.` : !s.name ? "Give this site a name." : null;
    if (s.error) ok = false;
  }
  return ok;
}

document.getElementById("add").addEventListener("click", () => {
  services.push({ name: "", template: "", enabled: true });
  setStatus("");
  render();
  list.querySelector("li:last-child .name").focus();
});

document.getElementById("reset").addEventListener("click", () => {
  services = DEFAULT_SERVICES.map((s) => ({ ...s }));
  autoFallback.checked = true;
  buttonSites.value = DEFAULT_BUTTON_SITES.join("\n");
  buttonOnBypass.checked = true;
  setStatus("Defaults restored. Press Save to keep them.");
  render();
});

function readButtonSites() {
  const lines = buttonSites.value.split(/[\n,]+/).map((l) => l.trim()).filter(Boolean);
  const bad = lines.filter((l) => !normalizeDomain(l));
  buttonSitesError.textContent = bad.length ? `Not a site address: ${bad.join(", ")}` : "";
  return bad.length ? null : [...new Set(lines.map(normalizeDomain))];
}

document.getElementById("save").addEventListener("click", async () => {
  const sites = readButtonSites();
  if (!validate() || !sites) {
    render();
    setStatus("Fix the highlighted sites first.");
    return;
  }
  if (!services.some((s) => s.enabled)) {
    setStatus("Enable at least one site.");
    return;
  }

  // Ask for access to any new sites. This has to happen straight from the
  // click, before anything is awaited, or the browser refuses to show it.
  const origins = [
    ...new Set([
      ...services.map((s) => `*://${templateHostPattern(s.template)}/*`),
      ...sites.map(domainPattern)
    ])
  ];
  const granted = chrome.permissions.request({ origins }).catch(() => false);

  const clean = services.map(({ name, template, enabled }) => ({ name, template, enabled }));
  await chrome.storage.local.set({
    services: clean,
    autoFallback: autoFallback.checked,
    buttonSites: sites,
    buttonOnBypass: buttonOnBypass.checked
  });
  buttonSites.value = sites.join("\n");
  render();
  setStatus(
    (await granted)
      ? "Saved."
      : "Saved. Without access to the new sites, the button won't appear there and the automatic fallback only notices when they can't be reached at all."
  );
});

loadSettings().then((settings) => {
  services = settings.services.map((s) => ({ ...s }));
  autoFallback.checked = settings.autoFallback;
  buttonSites.value = settings.buttonSites.join("\n");
  buttonOnBypass.checked = settings.buttonOnBypass;
  render();
});

// ---- Site access ----
// Without it the floating button can't appear and errors on bypass sites go
// unnoticed. Browsers don't always grant it on install, so offer it here.
const access = document.getElementById("access");
let missing = [];

async function checkAccess() {
  missing = await missingOrigins();
  access.hidden = !missing.length;
  document.getElementById("accessText").textContent =
    `It isn't allowed on ${missing.map(originLabel).join(", ")}, so the floating button won't ` +
    "appear there and the automatic fallback can't spot error pages.";
}

document.getElementById("grant").addEventListener("click", async () => {
  // Must be called straight from the click.
  const granted = await chrome.permissions.request({ origins: missing }).catch(() => false);
  if (!granted) document.getElementById("accessHelp").hidden = false;
  checkAccess();
});

chrome.permissions.onAdded.addListener(checkAccess);
chrome.permissions.onRemoved.addListener(checkAccess);
chrome.storage.onChanged.addListener(checkAccess);
checkAccess();
