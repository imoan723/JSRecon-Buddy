import { secretRules } from './utils/rules.js';
import { shannonEntropy } from './utils/entropy.js';

const MAX_CONTENT_SIZE_BYTES = 4 * 1024 * 1024;

/**
 * @description A set to keep track of which URLs have already been scanned in a given tab.
 * The key is a string in the format: `${tabId}|${url}`.
 * This prevents redundant scans on the same page.
 * @type {Set<string>}
 */
const scannedPages = new Set();

/**
 * Listens for tab updates to trigger the passive scanning process.
 * It sets a "scanning" visual state when a page starts loading and
 * initiates the actual scan once the page is fully loaded.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (changeInfo.status === 'complete') {
		triggerPassiveScan(tabId);
	}
});

/**
 * Listens for client-side navigations in Single Page Applications (e.g., React, Angular).
 */
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
	triggerPassiveScan(details.tabId);
});

/**
 * Cleans up the scanned pages set when a tab is closed to prevent memory leaks.
 */
chrome.tabs.onRemoved.addListener((tabId) => {
	for (const key of scannedPages) {
		if (key.startsWith(`${tabId}|`)) {
			scannedPages.delete(key);
		}
	}
});

/**
 * Handles incoming messages from other parts of the extension.
 * This acts as a router for different actions, like starting the full
 * on-demand scan or fetching external scripts for a content script.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
		triggerPassiveScan(request.tabId, true);
		return;
	}
});

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
			return;
		}

		chrome.storage.session.set({ [tabId]: { status: 'scanning' } });
		chrome.action.setIcon({ tabId, path: 'icons/icon-scanning-128.png' });
		chrome.action.setBadgeText({ tabId, text: '...' });
		chrome.action.setBadgeBackgroundColor({ tabId, color: '#FDB813' });

		const injectionResults = await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			function: scrapePageContent,
		});

		if (injectionResults && injectionResults.length > 0) {
			const pageData = injectionResults[0].result;
			if (pageData) {
				scannedPages.add(pageKey);
				runPassiveScan(pageData, tab.id);
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
			[tabId]: {
				status: 'complete',
				results: findings,
				contentMap: contentMap
			}
		});
	} catch (error) {
		if (error.message.toLowerCase().includes('quota')) {
			console.warn('[JS Recon Buddy] Session storage quota exceeded. Saving findings without source content as a fallback.');

			await chrome.storage.session.set({
				[tabId]: {
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
 * Updates the extension's action icon and badge based on the number of findings.
 * @param {number} tabId - The ID of the tab whose action icon should be updated.
 * @param {number} findingsCount - The number of secrets found.
 */
function updateActionUI(tabId, findingsCount) {
	if (findingsCount > 0) {
		chrome.action.setIcon({ tabId, path: 'icons/icon-found-128.png' });
		chrome.action.setBadgeText({ tabId, text: findingsCount.toString() });
		chrome.action.setBadgeBackgroundColor({ tabId, color: '#D92A2A' });
	} else {
		chrome.action.setIcon({ tabId, path: 'icons/icon-notfound-128.png' });
		chrome.action.setBadgeText({ tabId, text: '' });
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