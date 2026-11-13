// Chromium runs this as a service worker and needs to pull in services.js;
// Firefox lists both files in the manifest instead.
if (typeof importScripts === "function") importScripts("services.js");

const menus = chrome.contextMenus; // missing on Firefox for Android
const WEB_PATTERNS = ["http://*/*", "https://*/*"];
// Navigations we cancel ourselves (e.g. by moving on to the next site) report
// these; they aren't failures. The number is Firefox's NS_BINDING_ABORTED.
const ABORTED = new Set(["net::ERR_ABORTED", "Error code 2152398850"]);

async function enabledSettings() {
  const { services, autoFallback } = await loadSettings();
  return { services: services.filter((s) => s.enabled), autoFallback };
}

// ---- Per-tab state ---------------------------------------------------------
// For each tab showing an article through a bypass site:
//   { original, index, host, pending, failedUrl }
// `index` is the position in the enabled list, `host` the site being tried and
// `pending` is true until that page has finished loading. `failedUrl` is the
// previous attempt, whose late "finished loading" event must not count. Kept in memory and
// mirrored to storage.session, because the background can be unloaded.

const tabState = new Map();
const pendingByUrl = new Map(); // state for tabs being created, keyed by URL
const failing = new Set(); // tabs whose current load came back with an HTTP error
const session = chrome.storage.session;

async function getState(tabId) {
  if (tabState.has(tabId)) return tabState.get(tabId);
  if (!session) return null;
  const key = "tab:" + tabId;
  const stored = (await session.get(key))[key];
  if (stored && !tabState.has(tabId)) tabState.set(tabId, stored);
  return tabState.get(tabId) || null;
}

function setState(tabId, state) {
  tabState.set(tabId, state);
  if (session) session.set({ ["tab:" + tabId]: state });
}

function clearState(tabId) {
  tabState.delete(tabId);
  failing.delete(tabId);
  if (session) session.remove("tab:" + tabId);
}

// ---- Opening articles ------------------------------------------------------

async function openInNewTab(tab, original, index, services) {
  const url = buildUrl(services[index].template, original);
  const state = { original, index, host: hostOf(url), pending: true };
  pendingByUrl.set(url, state);
  let created = null;
  if (tab) {
    try {
      created = await chrome.tabs.create({ url, index: tab.index + 1, openerTabId: tab.id });
    } catch (e) {
      // Firefox for Android rejects tab placement; use a plain new tab.
    }
  }
  if (!created) created = await chrome.tabs.create({ url });
  pendingByUrl.delete(url);
  // A load error may already have claimed this state and moved on.
  if (!tabState.has(created.id)) setState(created.id, state);
}

function goTo(tabId, original, index, services, failedUrl = null) {
  const url = buildUrl(services[index].template, original);
  failing.delete(tabId);
  setState(tabId, { original, index, host: hostOf(url), pending: true, failedUrl });
  chrome.tabs.update(tabId, { url });
}

// Which bypass site (and article) is this tab on, if any?
async function currentBypass(tabId, url, services) {
  const state = await getState(tabId);
  if (state && hostOf(url) === state.host) return state;
  return parseBypassUrl(url, services);
}

// Open the article through the next site, in the same tab (wraps around).
async function tryNext(tab, services) {
  const cur = await currentBypass(tab.id, tab.url, services);
  if (!tab || !cur || !services.length) return false;
  goTo(tab.id, cur.original, (cur.index + 1) % services.length, services);
  return true;
}

// ---- Automatic fallback ----------------------------------------------------

async function fallBack(tabId, url) {
  let state = await getState(tabId);
  if (!state && pendingByUrl.has(url)) {
    state = pendingByUrl.get(url);
    setState(tabId, state);
  }
  if (!state || !state.pending || hostOf(url) !== state.host) return;

  const { services, autoFallback } = await enabledSettings();
  const next = state.index + 1;
  if (!autoFallback || next >= services.length) {
    // Nothing left to try: leave the error page up.
    setState(tabId, { ...state, pending: false });
    return;
  }
  goTo(tabId, state.original, next, services, url);
}

// The site answered with an error (404, 500, 503, ...).
chrome.webRequest.onCompleted.addListener(
  (d) => {
    if (d.tabId < 0 || d.statusCode < 400) return;
    failing.add(d.tabId);
    fallBack(d.tabId, d.url);
  },
  { urls: ["<all_urls>"], types: ["main_frame"] }
);

// The site couldn't be reached at all (DNS failure, refused, timed out, ...).
chrome.webNavigation.onErrorOccurred.addListener((d) => {
  if (d.frameId !== 0 || ABORTED.has(d.error)) return;
  fallBack(d.tabId, d.url);
});

// The page loaded fine: stop watching it, so later clicks inside the site
// don't trigger a fallback.
chrome.webNavigation.onCompleted.addListener(async (d) => {
  if (d.frameId !== 0 || failing.has(d.tabId)) return;
  const state = await getState(d.tabId);
  if (state && state.pending && hostOf(d.url) === state.host && d.url !== state.failedUrl) {
    setState(d.tabId, { ...state, pending: false });
  }
});

chrome.tabs.onRemoved.addListener(clearState);

chrome.runtime.onInstalled.addListener(() => migrateSettings());

// ---- Toolbar button / Alt+Shift+F / Android menu entry ---------------------
// On a normal page: open it through the first site in a new tab.
// On a bypass page: switch to the next site in the same tab.

async function onAction(tab) {
  const { services } = await enabledSettings();
  if (!services.length) {
    chrome.runtime.openOptionsPage();
    return;
  }
  if (await tryNext(tab, services)) return;
  if (isWebUrl(tab.url)) await openInNewTab(tab, tab.url, 0, services);
}

chrome.action.onClicked.addListener(onAction);

// ---- Right-click menus (desktop only) --------------------------------------

async function buildMenus() {
  const { services } = await enabledSettings();
  await menus.removeAll();
  services.forEach((s, i) => {
    menus.create({
      id: "page:" + i,
      title: `Open page with ${s.name}`,
      contexts: ["page"],
      documentUrlPatterns: WEB_PATTERNS
    });
  });
  services.forEach((s, i) => {
    menus.create({
      id: "link:" + i,
      title: `Open link with ${s.name}`,
      contexts: ["link"],
      targetUrlPatterns: WEB_PATTERNS
    });
  });
  const hosts = [...new Set(services.map((s) => templateHostPattern(s.template)))].filter(Boolean);
  if (services.length > 1 && hosts.length) {
    menus.create({
      id: "next",
      title: "Try next bypass site",
      contexts: ["page"],
      documentUrlPatterns: hosts.map((h) => `*://${h}/*`)
    });
  }
}

if (menus) {
  let building = Promise.resolve();
  const rebuildMenus = () => {
    building = building.then(buildMenus, buildMenus);
  };
  chrome.runtime.onInstalled.addListener(rebuildMenus);
  chrome.runtime.onStartup.addListener(rebuildMenus);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.services) rebuildMenus();
  });

  menus.onClicked.addListener(async (info, tab) => {
    const { services } = await enabledSettings();
    const [kind, i] = String(info.menuItemId).split(":");

    if (kind === "next") {
      if (tab) tryNext({ ...tab, url: info.pageUrl }, services);
      return;
    }

    const index = Number(i);
    let url = kind === "link" ? info.linkUrl : info.pageUrl;
    if (!services[index] || !isWebUrl(url)) return;
    // Already on a bypass page (or a link to one)? Use the article behind it.
    const cur =
      kind === "page" && tab
        ? await currentBypass(tab.id, url, services)
        : parseBypassUrl(url, services);
    if (cur) url = cur.original;
    openInNewTab(tab, url, index, services);
  });
}
