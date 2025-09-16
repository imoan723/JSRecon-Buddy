import { secretRules } from './utils/rules.js';
import { shannonEntropy } from './utils/entropy.js';

const MAX_CONTENT_SIZE_BYTES = 4 * 1024 * 1024;

/**
 * @description A map to keep track of which URLs have already been scanned.
 * @type {Map<string, {findingsCount: number}>}
 */
const scannedPages = new Map();

/**
 * @description A queue to manage pending scan jobs.
 * @type {Array<{pageData: object, tabId: number}>}
 */
const scanQueue = [];

/**
 * @description A flag to ensure only one scan runs at a time.
 * @type {boolean}
 */
let isScanInProgress = false;

/**
 * Sets the action icon to a "scanning" or "waiting" state for a specific tab,
 * after verifying the tab is scannable.
 * @param {number} tabId The ID of the tab to update.
 * @returns {Promise<void>}
 */
async function setIconWaiting(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);

    if (!tab || !tab.url || !tab.url.startsWith('http')) {
      return;
    }

    chrome.action.setIcon({ tabId, path: 'icons/icon-scanning-128.png' });
    chrome.action.setTitle({ tabId, title: 'Passive scanning in progress...' });
    chrome.action.setBadgeText({ tabId, text: '...' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#FDB813' });

  } catch (error) {
    if (error.message.includes('No tab with id')) return;
    console.error(`[JS Recon Buddy] Error in setIconWaiting for tab ${tabId}:`, error);
  }
}

/**
 * Listens for tab updates to trigger the passive scanning process.
 * It sets a "scanning" visual state when a page starts loading and
 * initiates the actual scan once the page is fully loaded.
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  setIconWaiting(tabId);
  if (changeInfo.status !== 'loading' && changeInfo.status !== 'complete') {
    return;
  }
  try {
    const tab = await chrome.tabs.get(tabId);

    if (!tab || !tab.url || !tab.url.startsWith('http')) {
      return;
    }

    if (changeInfo.status === 'loading') {
      const pageKey = `${tabId}|${tab.url}`;
      await chrome.storage.session.set({ [pageKey]: { status: 'scanning' } });
    } else if (changeInfo.status === 'complete') {
      triggerPassiveScan(tabId);
    }
  } catch (error) {
    if (error.message.includes('No tab with id')) return;
    console.warn(`[JS Recon Buddy] Error in onUpdated listener for tab ${tabId}:`, error);
  }
});

/**
 * Listens for when the active tab changes.
 * This ensures the icon is updated instantly when switching to a tab that has already been scanned.
 */
chrome.tabs.onActivated.addListener((activeInfo) => {
  setIconWaiting(activeInfo.tabId);
  triggerPassiveScan(activeInfo.tabId);
});

/**
 * Listens for client-side navigations in Single Page Applications (e.g., React, Angular).
 */
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  setIconWaiting(details.tabId);
  triggerPassiveScan(details.tabId);
});

/**
 * Cleans up the scanned pages set when a tab is closed to prevent memory leaks.
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  for (const key of scannedPages.keys()) {
    if (key.startsWith(`${tabId}|`)) {
      scannedPages.delete(key);
      chrome.storage.session.remove(key);
    }
  }
});

/**
 * Handles incoming messages from other parts of the extension.
 * This acts as a router for different actions, like starting the full
 * on-demand scan or fetching external scripts for a content script.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.type === "SCAN_PAGE") {
      const targetTabId = request.tabId;
      chrome.scripting.insertCSS({
        target: { tabId: targetTabId },
        files: ["src/overlay/overlay.css"],
      });
      chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        files: ["src/overlay/overlay.js"],
      });
    }

    if (request.type === "FETCH_SCRIPTS") {
      const fetchPromises = request.urls.map((url) =>
        fetch(url)
          .then((res) => (res.ok ? res.text() : Promise.reject()))
          .then((code) => ({ source: url, code }))
          .catch(() => null),
      );
      Promise.all(fetchPromises).then((results) => sendResponse(results));
      return true;
    }

    if (request.type === 'FORCE_PASSIVE_RESCAN') {
      for (const key of scannedPages.keys()) {
        if (key.startsWith(`${request.tabId}|`)) {
          scannedPages.delete(key);
        }
      }
      setIconWaiting(request.tabId);
      triggerPassiveScan(request.tabId, true);
      return;
    }
  } catch (error) {
    if (error.message.includes('No tab with id')) return;
    console.warn(`[JS Recon Buddy] Error in onMessage listener for tab ${tabId}:`, error);
  }
});

/**
 * The "worker" function that processes one scan job from the queue at a time.
 * @returns {Promise<void>}
 */
async function processScanQueue() {
  if (isScanInProgress) {
    console.warn("Waiting for other scan to finish");
    return;
  } else if (scanQueue.length === 0) {
    return;
  }

  isScanInProgress = true;
  const job = scanQueue.shift();

  try {
    await runPassiveScan(job.pageData, job.tabId);
  } catch (error) {
    console.warn(`[JS Recon Buddy] Issue during scan for tab ${job.tabId}:`, error);
  } finally {
    isScanInProgress = false;
    processScanQueue();
  }
}

/**
 * Main function to trigger a passive scan on a tab if necessary.
 * @param {number} tabId - The ID of the tab to potentially scan.
 * @param {boolean} [force=false] - If true, bypasses the duplicate scan check.
 */
async function triggerPassiveScan(tabId, force = false) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url || !tab.url.startsWith('http')) {
      return;
    }

    const pageKey = `${tab.id}|${tab.url}`;
    if (scannedPages.has(pageKey) && !force) {
      const cachedScan = scannedPages.get(pageKey);
      updateActionUI(tab.id, cachedScan.findingsCount);
      return;
    }

    const dataWrapper = await chrome.storage.session.get(pageKey);
    const storedData = dataWrapper[pageKey];

    if (storedData && storedData.status === 'complete' && !force) {
      const findingsCount = storedData.results ? storedData.results.length : 0;
      updateActionUI(tab.id, findingsCount);
      scannedPages.set(pageKey, { findingsCount });
      return;
    }

    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: scrapePageContent,
    });

    if (injectionResults && injectionResults.length > 0) {
      const pageData = injectionResults[0].result;
      if (pageData) {
        scanQueue.push({ pageData, tabId: tab.id });
        processScanQueue();
      }
    }
  } catch (error) {
    if (error.message.includes('No tab with id')) {
      return;
    }
    console.error(`[JS Recon Buddy] Error triggering scan on tab ${tabId}:`, error);
  }
}

/**
 * Fetches external scripts and performs a passive scan for secrets on all page content.
 * @param {object} pageData - The initial data scraped from the page.
 * @param {string} pageData.html - The full outer HTML of the document.
 * @param {string[]} pageData.inlineScripts - An array of inline script contents.
 * @param {string[]} pageData.externalScripts - An array of external script URLs.
 * @param {number} tabId - The ID of the tab being scanned.
 * @returns {Promise<void>} A promise that resolves when the scan is complete and the UI is updated.
 */
async function runPassiveScan(pageData, tabId) {
  if (!tabId) {
    return;
  }
  const allContentSources = [
    { source: 'HTML Document', content: pageData.html },
    ...pageData.inlineScripts.map((script, i) => ({
      source: `Inline Script #${i + 1}`,
      content: script,
    })),
  ];

  await Promise.all(
    pageData.externalScripts.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const content = await response.text();
          allContentSources.push({ source: url, content });
        }
      } catch (e) { }
    })
  );

  const findings = [];
  const contentMap = {};

  for (const { source, content } of allContentSources.filter(s => s.content)) {
    const contentSize = new Blob([content]).size;
    let isContentTooLarge = contentSize > MAX_CONTENT_SIZE_BYTES;
    if (!isContentTooLarge) {
      contentMap[source] = content;
    }
    for (const rule of secretRules) {
      const matches = content.matchAll(rule.regex);
      for (const match of matches) {
        const secret = match[rule.group || 0];
        if (rule.entropy && shannonEntropy(secret) < rule.entropy) {
          continue;
        }

        findings.push({
          id: rule.id,
          description: rule.description,
          secret: secret,
          source: source,
          isSourceTooLarge: isContentTooLarge
        });
      }
    }
  }
  let pageKey, tab;
  try {
    tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url) return;

    pageKey = `${tabId}|${tab.url}`;
    scannedPages.set(pageKey, { findingsCount: findings.length });
  } catch (error) {
    if (error.message.includes('No tab with id')) {
      console.warn("[JS Recon Buddy] The tab that we were working on was prematurely closed")
      return;
    } else {
      console.warn("[JS Recon Buddy] There was an uncaught error when scanning a page: ", error)
    }
  }
  try {
    await chrome.storage.session.set({
      [pageKey]: {
        status: 'complete',
        results: findings,
        contentMap: contentMap
      }
    });
  } catch (error) {
    if (error.message.toLowerCase().includes('quota')) {
      console.warn('[JS Recon Buddy] Session storage quota exceeded. Saving findings without source content as a fallback.');

      await chrome.storage.session.set({
        [pageKey]: {
          status: 'complete',
          results: findings,
          contentMap: {}
        }
      });
    } else {
      console.error('[JS Recon Buddy] Failed to save to session storage:', error);
    }
  }
  updateActionUI(tabId, findings.length);
}

/**
 * Updates the title of a specific tab to reflect the number of findings.
 * It injects a script to safely modify the page's document.title.
 * @param {number} tabId - The ID of the tab to update.
 * @param {number} findingsCount - The number of secrets found.
 * @returns {Promise<void>}
 */
async function updateTabTitle(tabId, findingsCount) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: (count) => {
        const oldPrefixRegex = /^\[JSRB \(\d+\)\] /;
        const originalTitle = document.title.replace(oldPrefixRegex, '');

        if (count > 0) {
          document.title = `[JSRB (${count})] ${originalTitle}`;
        } else {
          document.title = originalTitle;
        }
      },
      args: [findingsCount],
    });
  } catch (error) {
    if (error.message.includes("Cannot access a chrome:// URL")) return;
    console.warn(`[JS Recon Buddy] Could not update title for tab ${tabId}:`, error.message);
  }
}

/**
 * Updates the extension's action icon and badge based on the number of findings.
 * @param {number} tabId - The ID of the tab whose action icon should be updated.
 * @param {number} findingsCount - The number of secrets found.
 */
function updateActionUI(tabId, findingsCount) {
  try {
    if (findingsCount > 0) {
      chrome.action.setIcon({ tabId, path: 'icons/icon-found-128.png' });
      chrome.action.setBadgeText({ tabId, text: findingsCount.toString() });
      chrome.action.setTitle({ tabId, title: `Found ${findingsCount} potential secrets` })
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#D92A2A' });
    } else {
      chrome.action.setIcon({ tabId, path: 'icons/icon-notfound-128.png' });
      chrome.action.setBadgeText({ tabId, text: '' });
    }
    updateTabTitle(tabId, findingsCount);
  } catch (error) {
    if (error.message.includes('No tab with id')) {
      console.warn("[JS Recon Buddy] The tab that we were working on was prematurely closed")
      return;
    } else {
      console.warn("[JS Recon Buddy] There was an uncaught error when updating the tab icon: ", error)
    }
  }
}

/**
 * Scrapes the initial content from the active web page.
 * This function is executed in the context of the web page itself,
 * not in the service worker's context.
 * @returns {{html: string, inlineScripts: string[], externalScripts: string[]}} An object containing the page's content.
 */
function scrapePageContent() {
  const scripts = Array.from(document.scripts);
  const inlineScripts = scripts
    .filter(script => !script.src)
    .map(script => script.textContent);
  const externalScripts = scripts
    .filter(script => script.src)
    .map(script => script.src);
  return {
    html: document.documentElement.outerHTML,
    inlineScripts,
    externalScripts,
  };
}