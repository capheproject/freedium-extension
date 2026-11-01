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
  chrome.tabs.create({ url, index: tab.index + 1, openerTabId: tab.id });
}

// Toolbar button (and Alt+Shift+F): open the current page in a new tab
chrome.action.onClicked.addListener((tab) => {
  if (!isWebUrl(tab.url)) return;
  openNextTo(tab, toFreedium(tab.url));
});

// Right-click menus for pages and links
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "freedium-page",
    title: "Open page in Freedium",
    contexts: ["page"],
    documentUrlPatterns: ["http://*/*", "https://*/*"]
  });
  chrome.contextMenus.create({
    id: "freedium-link",
    title: "Open link in Freedium",
    contexts: ["link"],
    targetUrlPatterns: ["http://*/*", "https://*/*"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = info.menuItemId === "freedium-link" ? info.linkUrl : info.pageUrl;
  if (!isWebUrl(url)) return;
  openNextTo(tab, toFreedium(url));
});
