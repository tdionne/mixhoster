async function getCaptured(tabId) {
  const key = `captured_${tabId}`;
  const result = await chrome.storage.session.get(key);
  return result[key] || [];
}

async function setCaptured(tabId, urls) {
  const key = `captured_${tabId}`;
  await chrome.storage.session.set({ [key]: urls });
}

async function addCaptured(tabId, url) {
  const urls = await getCaptured(tabId);
  if (!urls.includes(url)) {
    urls.push(url);
    await setCaptured(tabId, urls);
  }
  chrome.action.setBadgeText({ tabId, text: String(urls.length) });
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#4dabf7" });
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId >= 0 && details.url.includes(".m3u8")) {
      addCaptured(details.tabId, details.url);
    }
  },
  { urls: ["*://*.mixcloud.stream/*"] }
);

// Clear captures for a tab when it navigates to a new page, so stale
// URLs from a previous mix don't linger in the popup.
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) {
    setCaptured(details.tabId, []);
    chrome.action.setBadgeText({ tabId: details.tabId, text: "" });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getCaptured") {
    getCaptured(message.tabId).then(sendResponse);
    return true;
  }
});
