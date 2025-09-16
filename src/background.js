import { secretRules } from './utils/rules.js';
import { shannonEntropy } from './utils/entropy.js';

const MAX_CONTENT_SIZE_BYTES = 4 * 1024 * 1024;

/**
 * @description A map to keep track of which URLs have already been scanned.
 * @type {Map<string, {findingsCount: number}>}
 */
const scannedPages = new Map();

/**
 * @description A map to track scan promises currently in progress for each tab.
 * This prevents starting a new scan on a tab that is already being scanned.
 * @type {Map<number, Promise<void>>}
 */
const scansInProgress = new Map();

/**
 * Listens for tab updates to trigger the initial scanning process status.
 * It sets a "scanning" visual state when a page starts loading and
 * initiates the actual scan once the page is fully loaded.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab && tab.url && tab.url.startsWith('http')) {
    setInitialLoadingState(tabId);
  }
});

/**
 * Listens for the successful completion of a page's main document navigation.
 *
 * This serves as the primary and most reliable trigger to start the actual
 * passive scan by calling `triggerPassiveScan`. It specifically checks that
 * the event is for the main frame (`frameId === 0`) to avoid incorrectly
 * triggering new scans for every iframe that finishes loading on the page.
 */
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0) {
    triggerPassiveScan(details.tabId);
  }
});

/**
 * Listens for when the active tab changes.
 * This ensures the icon is updated instantly when switching to a tab that has already been scanned.
 */
chrome.tabs.onActivated.addListener((activeInfo) => {
  triggerPassiveScan(activeInfo.tabId);
});

/**
 * Listens for client-side navigations in Single Page Applications (e.g., React, Angular).
 */
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId === 0) {
    triggerPassiveScan(details.tabId);
  }
});

/**
 * Cleans up the scanned pages set when a tab is closed to prevent memory leaks.
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  for (const key of scannedPages.keys()) {
    if (key.startsWith(`${tabId}|`)) {
      scannedPages.delete(key);
      chrome.storage.session.remove(key).catch(e => console.warn(e));
    }
  }
  scansInProgress.delete(tabId);
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
      const { tabId } = request;
      for (const key of scannedPages.keys()) {
        if (key.startsWith(`${tabId}|`)) {
          scannedPages.delete(key);
        }
      }
      triggerPassiveScan(tabId, true);
      return;
    }
  } catch (error) {
    if (error.message.includes('No tab with id')) return;
    console.warn(`[JS Recon Buddy] Error in onMessage listener for tab ${tabId}:`, error);
  }
});

/**
 * Manages the initial UI and state of a tab as it begins to load.
 *
 * This function is the first to act when a tab navigation starts. It checks
 * if complete scan results for the given URL are already stored in session
 * storage.
 *
 * - If cached results are found, it immediately restores the UI (icon, badge)
 * to reflect those findings and exits, preventing an unnecessary re-scan.
 * A brief delay is introduced to prevent potential UI flickering during
 * rapid page loads.
 *
 * - If no results are found, it sets the UI to a "scanning in progress" state
 * and updates the session storage, so the popup displays the correct status
 * while waiting for the scan to complete.
 *
 * @param {number} tabId The ID of the tab that has started loading.
 * @returns {Promise<void>} A promise that resolves once the initial state has been set.
 */
async function setInitialLoadingState(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url || !tab.url.startsWith('http') ||
      tab.url.startsWith('https://chrome.google.com/webstore')) {
      return;
    }

    const pageKey = `${tabId}|${tab.url}`;

    const dataWrapper = await chrome.storage.session.get(pageKey);
    const storedData = dataWrapper[pageKey];

    if (storedData && storedData.status === 'complete') {
      const findingsCount = storedData.results ? storedData.results.length : 0;
      await new Promise(r => setTimeout(r, 400));
      updateActionUI(tabId, findingsCount);
      scannedPages.set(pageKey, { findingsCount });
      return;
    }

    chrome.action.setIcon({ tabId, path: 'icons/icon-scanning-128.png' });
    chrome.action.setBadgeText({ tabId, text: '...' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#FDB813' });
    chrome.action.setTitle({ tabId, title: 'Page loading, preparing to scan...' });
    await chrome.storage.session.set({ [pageKey]: { status: 'scanning' } });

  } catch (error) {
    if (error.message.includes('No tab with id')) return;
    console.warn(`[JS Recon Buddy] Error setting initial loading state for tab ${tabId}:`, error);
  }
}

/**
 * Main function to trigger a passive scan on a tab if necessary.
 * @param {number} tabId - The ID of the tab to potentially scan.
 * @param {boolean} [force=false] - If true, bypasses the duplicate scan check.
 */
async function triggerPassiveScan(tabId, force = false) {
  try {
    if (scansInProgress.has(tabId) && !force) {
      return;
    }
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url ||
      !tab.url.startsWith('http') ||
      tab.url.startsWith('https://chrome.google.com/webstore')) {
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

    const scanPromise = (async () => {
      await setIconAndState(tabId, 'scanning');

      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scrapePageContent,
      });

      if (injectionResults && injectionResults[0] && injectionResults[0].result) {
        await runPassiveScan(injectionResults[0].result, tab.id, pageKey);
      } else {
        await setIconAndState(tabId, 'idle');
      }
    })();

    scansInProgress.set(tabId, scanPromise);
    scanPromise.finally(() => {
      scansInProgress.delete(tabId);
    });
  } catch (error) {
    scansInProgress.delete(tabId);
    if (error.message.includes('No tab with id')) {
      return;
    }
    console.error(`[JS Recon Buddy] Error triggering scan on tab ${tabId}:`, error);
  }
}

/**
 * Performs the main passive scan for secrets on all provided page content.
 *
 * This function fetches any external scripts, iterates through all content
 * sources (HTML, inline scripts, external scripts), applies the defined
 * secret-finding rules, and stores the results in session storage.
 * Finally, it updates the extension's action icon to reflect the number of findings.
 *
 * @param {object} pageData The initial content scraped from the page.
 * @param {string} pageData.html The full outer HTML of the document.
 * @param {string[]} pageData.inlineScripts An array of inline script contents.
 * @param {string[]} pageData.externalScripts An array of external script URLs.
 * @param {number} tabId The ID of the tab being scanned.
 * @param {string} pageKey The unique key ('${tabId}|${tab.url}') for this page, used for caching and storage.
 * @returns {Promise<void>} A promise that resolves when the scan is complete and the UI is updated.
 */
async function runPassiveScan(pageData, tabId, pageKey) {
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

  try {
    await chrome.storage.session.set({
      [pageKey]: {
        status: 'complete',
        results: findings,
        contentMap: contentMap,
      }
    });
  } catch (error) {
    if (error.message.toLowerCase().includes('quota')) {
      await chrome.storage.session.set({
        [pageKey]: { status: 'complete', results: findings, contentMap: {} }
      });
    }
  }

  updateActionUI(tabId, findings.length);
}

/**
 * Centralized function to set the action icon and the storage state.
 * This ensures the icon and popup UI are always synchronized.
 * @param {number} tabId
 * @param {'scanning' | 'idle'} state
 */
async function setIconAndState(tabId, state) {
  try {
    if (state === 'scanning') {
      chrome.action.setIcon({ tabId, path: 'icons/icon-scanning-128.png' });
      chrome.action.setTitle({ tabId, title: 'Passive scanning in progress...' });
      chrome.action.setBadgeText({ tabId, text: '...' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#FDB813' });

      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.url) {
        const pageKey = `${tabId}|${tab.url}`;
        await chrome.storage.session.set({ [pageKey]: { status: 'scanning' } });
      }
    } else {
      chrome.action.setIcon({ tabId, path: 'icons/icon-notfound-128.png' });
      chrome.action.setTitle({ tabId, title: '' });
      chrome.action.setBadgeText({ tabId, text: '' });
    }
  } catch (error) {
    if (error.message.includes('No tab with id')) return;
    console.warn(`[JS Recon Buddy] Error in setIconAndState for tab ${tabId}:`, error);
  }
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