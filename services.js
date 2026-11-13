// Shared by background.js and options.js.
//
// Bypass sites, tried in this order. In a template:
//   {url}      the full article URL            https://archive.ph/newest/{url}
//   {encoded}  the URL, percent-encoded         https://archive.ph/?run=1&url={encoded}
//   {path}     only the path (and query)        https://scribe.rip/{path}
//   {domain}   the site's host in Google        https://{domain}.translate.goog/{path}
//              Translate's form (www-economist-com)
const DEFAULT_SERVICES = [
  { name: "archive.today", template: "https://archive.ph/newest/{url}", enabled: true },
  { name: "Wayback Machine", template: "https://web.archive.org/web/{url}", enabled: true },
  {
    name: "Google Translate proxy",
    template: "https://{domain}.translate.goog/{path}?_x_tr_sl=auto&_x_tr_tl=en&_x_tr_hl=en",
    enabled: true
  },
  // Last resort: have archive.today make a fresh snapshot (slow, may ask for a captcha).
  { name: "archive.today (save new copy)", template: "https://archive.ph/?run=1&url={encoded}", enabled: true },
  { name: "RemovePaywall", template: "https://www.removepaywall.com/search?url={url}", enabled: false },
  // Medium only
  { name: "Freedium", template: "https://freedium-mirror.cfd/{url}", enabled: false },
  { name: "Freedium (original)", template: "https://freedium.cfd/{url}", enabled: false },
  { name: "Scribe", template: "https://scribe.rip/{path}", enabled: false }
];

// Bump when DEFAULT_SERVICES changes in a way saved settings should pick up.
const SETTINGS_VERSION = 2;

const PLACEHOLDERS = /\{(url|encoded|path|domain)\}/g;

function isWebUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return "";
  }
}

// Google Translate's proxy writes www.economist.com as www-economist-com
// (and an existing "-" as "--").
function dashHost(host) {
  return host.replace(/-/g, "--").replace(/\./g, "-");
}

function undashHost(dashed) {
  return dashed
    .split("--")
    .map((part) => part.replace(/-/g, "."))
    .join("-");
}

// The host pattern a template's pages live on, e.g. "archive.ph" or
// "*.translate.goog". Null if the template has no usable host.
function templateHostPattern(template) {
  const m = template.match(/^https?:\/\/([^/?#]+)/i);
  if (!m) return null;
  let host = m[1].replace(/:\d+$/, "").toLowerCase();
  if (host.startsWith("{domain}.")) host = "*" + host.slice("{domain}".length);
  return /^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(host) ? host : null;
}

function templateError(template) {
  if (!isWebUrl(template)) return "must start with https:// or http://";
  if (!template.match(PLACEHOLDERS)) return "must contain {url}, {encoded}, {path} or {domain}";
  if (!templateHostPattern(template)) return "has no valid site address";
  return null;
}

function buildUrl(template, articleUrl) {
  const u = new URL(articleUrl);
  // If the template adds its own query after {path}, don't put a second "?"
  // in: append the article's query parameters to the end instead.
  const ownQuery = (template.split("{path}")[1] || "").includes("?");
  const path = (ownQuery ? u.pathname : u.pathname + u.search).replace(/^\//, "");
  let out = template
    .replace("{url}", articleUrl)
    .replace("{encoded}", encodeURIComponent(articleUrl))
    .replace("{domain}", dashHost(u.hostname))
    .replace("{path}", path);
  if (ownQuery && u.search) out += "&" + u.search.slice(1);
  return out;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const GROUPS = {
  // The Wayback Machine redirects to /web/<timestamp>/<url>, so allow
  // anything before the article URL.
  url: ".*?(https?:\\/\\/.+)",
  encoded: "([^&#]+)",
  path: "(.*)",
  domain: "([a-z0-9-]+)"
};

// If `url` is a page on one of the bypass sites, work out which one and the
// article it's showing: { index, original }. Otherwise null.
function parseBypassUrl(url, services) {
  if (typeof url !== "string") return null;
  for (let i = 0; i < services.length; i++) {
    const original = parseWith(services[i].template, url);
    if (isWebUrl(original)) return { index: i, original };
  }
  return null;
}

function parseWith(template, url) {
  const kinds = [];
  let re = "^";
  let last = 0;
  for (const m of template.matchAll(PLACEHOLDERS)) {
    re += escapeRegExp(template.slice(last, m.index)) + GROUPS[m[1]];
    kinds.push(m[1]);
    last = m.index + m[0].length;
  }
  if (!kinds.length) return null;
  const m = url.match(new RegExp(re, "i"));
  if (!m) return null;
  const v = {};
  kinds.forEach((k, j) => (v[k] = m[j + 1]));

  if (v.url) return v.url;
  if (v.encoded) {
    try {
      return decodeURIComponent(v.encoded);
    } catch (e) {
      return null;
    }
  }
  if (v.path === undefined) return null;
  if (!v.domain) return v.path ? "https://medium.com/" + v.path : null; // Medium front-ends
  try {
    const u = new URL("https://" + undashHost(v.domain) + "/" + v.path);
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith("_x_tr_")) u.searchParams.delete(key);
    }
    return u.toString();
  } catch (e) {
    return null;
  }
}

// Sites that get the floating button.
const DEFAULT_BUTTON_SITES = ["economist.com"];

// "https://www.Economist.com/x" or "economist.com" -> "economist.com".
// Null if it isn't a plain domain.
function normalizeDomain(input) {
  let d = String(input).trim().toLowerCase();
  if (!d) return null;
  d = d.replace(/^[a-z]+:\/\//, "").split(/[/?#:]/)[0].replace(/^\*\./, "").replace(/^www\./, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? d : null;
}

// Match pattern for a domain and its subdomains (also matches the bare domain).
function domainPattern(domain) {
  return `*://*.${domain}/*`;
}

function onDomain(url, domain) {
  const host = hostOf(url);
  return host === domain || host.endsWith("." + domain);
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(["services", "autoFallback", "buttonSites", "buttonOnBypass"]);
  const services =
    Array.isArray(stored.services) && stored.services.length ? stored.services : DEFAULT_SERVICES;
  return {
    services,
    autoFallback: stored.autoFallback !== false,
    buttonSites: Array.isArray(stored.buttonSites) ? stored.buttonSites : DEFAULT_BUTTON_SITES,
    buttonOnBypass: stored.buttonOnBypass !== false
  };
}

// Bring settings saved by an older version up to date: switch off the
// Medium-only sites and add any new default sites to the end of the list.
async function migrateSettings() {
  const stored = await chrome.storage.local.get(["services", "settingsVersion"]);
  if ((stored.settingsVersion || 1) >= SETTINGS_VERSION) return;
  if (Array.isArray(stored.services) && stored.services.length) {
    const mediumOnly = /freedium|scribe\.rip/i;
    const services = stored.services.map((s) =>
      mediumOnly.test(s.template) ? { ...s, enabled: false } : s
    );
    for (const d of DEFAULT_SERVICES) {
      if (!services.some((s) => s.template === d.template)) services.push({ ...d });
    }
    await chrome.storage.local.set({ services });
  }
  await chrome.storage.local.set({ settingsVersion: SETTINGS_VERSION });
}

// Site patterns the extension needs access to: the bypass sites (to watch for
// errors and show the button) and the floating-button sites.
async function neededOrigins({ forButton = false } = {}) {
  const { services, buttonSites, buttonOnBypass } = await loadSettings();
  const origins = new Set(buttonSites.map(normalizeDomain).filter(Boolean).map(domainPattern));
  if (!forButton || buttonOnBypass) {
    for (const s of services) {
      const h = s.enabled && templateHostPattern(s.template);
      if (h) origins.add(`*://${h}/*`);
    }
  }
  return [...origins];
}

async function missingOrigins() {
  const missing = [];
  for (const o of await neededOrigins()) {
    if (!(await chrome.permissions.contains({ origins: [o] }))) missing.push(o);
  }
  return missing;
}

// "*://*.economist.com/*" -> "economist.com"
function originLabel(origin) {
  return origin.replace(/^\*:\/\//, "").replace(/^\*\./, "").replace(/\/\*$/, "");
}
