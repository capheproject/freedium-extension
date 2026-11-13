// Shared by background.js and options.js.
//
// Bypass sites, tried in this order. In a template:
//   {url}      the full article URL           https://freedium-mirror.cfd/{url}
//   {encoded}  the URL, percent-encoded        https://example.com/?u={encoded}
//   {path}     only the path and query         https://scribe.rip/{path}
//              (for Medium front-ends that take medium.com paths)
const DEFAULT_SERVICES = [
  { name: "Freedium", template: "https://freedium-mirror.cfd/{url}", enabled: true },
  { name: "Freedium (original)", template: "https://freedium.cfd/{url}", enabled: true },
  { name: "Scribe", template: "https://scribe.rip/{path}", enabled: true },
  { name: "archive.today", template: "https://archive.ph/newest/{url}", enabled: true },
  { name: "Wayback Machine", template: "https://web.archive.org/web/{url}", enabled: true }
];

const PLACEHOLDER = /\{(url|encoded|path)\}/;

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

function templatePrefix(template) {
  return template.split(PLACEHOLDER)[0];
}

function templateError(template) {
  if (!isWebUrl(template)) return "must start with https:// or http://";
  if (!PLACEHOLDER.test(template)) return "must contain {url}, {encoded} or {path}";
  if (!hostOf(templatePrefix(template))) return "has no valid site address before the placeholder";
  return null;
}

function buildUrl(template, articleUrl) {
  const u = new URL(articleUrl);
  return template
    .replace("{url}", articleUrl)
    .replace("{encoded}", encodeURIComponent(articleUrl))
    .replace("{path}", (u.pathname + u.search).replace(/^\//, ""));
}

// If `url` is a page on one of the bypass sites, work out which one and the
// article it's showing: { index, original }. Otherwise null.
function parseBypassUrl(url, services) {
  if (typeof url !== "string") return null;
  for (let i = 0; i < services.length; i++) {
    const template = services[i].template;
    const kind = (template.match(PLACEHOLDER) || [])[1];
    const prefix = templatePrefix(template);
    if (!kind || !url.startsWith(prefix)) continue;

    let rest = url.slice(prefix.length);
    let original = null;
    if (kind === "path") {
      if (rest) original = "https://medium.com/" + rest;
    } else {
      if (kind === "encoded") {
        rest = rest.split("&")[0];
        try {
          rest = decodeURIComponent(rest);
        } catch (e) {
          // leave as is
        }
      }
      // The Wayback Machine redirects to /web/<timestamp>/<url>, so look for
      // the URL anywhere in the rest rather than only at the start.
      const m = rest.match(/https?:\/\/.+/i);
      if (m) original = m[0];
    }
    if (isWebUrl(original)) return { index: i, original };
  }
  return null;
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(["services", "autoFallback"]);
  const services =
    Array.isArray(stored.services) && stored.services.length ? stored.services : DEFAULT_SERVICES;
  return { services, autoFallback: stored.autoFallback !== false };
}
