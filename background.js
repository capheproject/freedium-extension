const FREEDIUM_BASE = "https://freedium-mirror.cfd/";

function toFreedium(url) {
  // Don't double-wrap a page that's already on Freedium
  if (url.startsWith(FREEDIUM_BASE)) return url;
  return FREEDIUM_BASE + url;
}

function isWebUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

function openNextTo(tab, url) {
  // Firefox for Android (and forks like Iceraven) has no tab strip and rejects
  // tab-placement options it doesn't support, so fall back to a plain new tab.
  try {
    if (tab) {
      chrome.tabs.create({ url, index: tab.index + 1, openerTabId: tab.id });
      return;
    }
  } catch (e) {
    // fall through
  }
  chrome.tabs.create({ url });
}

// Toolbar button (and Alt+Shift+F): open the current page in a new tab.
// On Firefox for Android this is the extension's entry in the browser menu.
chrome.action.onClicked.addListener((tab) => {
  if (!isWebUrl(tab.url)) return;
  openNextTo(tab, toFreedium(tab.url));
});

// Right-click menus for pages and links. Mobile Firefox has no context-menu
// API, so skip them there instead of crashing the whole background script.
const menus = chrome.contextMenus;
if (menus) {
  chrome.runtime.onInstalled.addListener(() => {
    menus.create({
      id: "freedium-page",
      title: "Open page in Freedium",
      contexts: ["page"],
      documentUrlPatterns: ["http://*/*", "https://*/*"]
    });
    menus.create({
      id: "freedium-link",
      title: "Open link in Freedium",
      contexts: ["link"],
      targetUrlPatterns: ["http://*/*", "https://*/*"]
    });
  });

  menus.onClicked.addListener((info, tab) => {
    const url = info.menuItemId === "freedium-link" ? info.linkUrl : info.pageUrl;
    if (!isWebUrl(url)) return;
    openNextTo(tab, toFreedium(url));
  });
}
