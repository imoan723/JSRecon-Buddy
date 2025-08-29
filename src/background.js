chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SCAN_PAGE") {
    const targetTabId = request.tabId;
    chrome.scripting.insertCSS({
      target: { tabId: targetTabId },
      files: ["src/overlay/overlay.css"],
    });
    chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      files: ["src/content/content.js"],
    });
  } else if (request.type === "FETCH_SCRIPTS") {
    const fetchPromises = request.urls.map((url) =>
      fetch(url)
        .then((res) => (res.ok ? res.text() : Promise.reject()))
        .then((code) => ({ source: url, code }))
        .catch(() => null),
    );
    Promise.all(fetchPromises).then((results) => sendResponse(results));
    return true;
  }
});
