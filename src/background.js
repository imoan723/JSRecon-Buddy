import { secretRules } from './utils/rules.js';
import { shannonEntropy } from './utils/entropy.js';

/**
 * Listens for tab updates to trigger the passive scanning process.
 * It sets a "scanning" visual state when a page starts loading and
 * initiates the actual scan once the page is fully loaded.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (changeInfo.status === 'loading' && tab.url && tab.url.startsWith('http')) {
		chrome.storage.session.set({ [tabId]: { status: 'scanning' } });
		chrome.action.setIcon({ tabId, path: 'icons/icon-scanning-128.png' });
		chrome.action.setBadgeText({ tabId, text: '...' });
		chrome.action.setBadgeBackgroundColor({ tabId, color: '#FDB813' });
	} else if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
		chrome.scripting.executeScript({
			target: { tabId: tabId },
			function: scrapePageContent,
		}, (injectionResults) => {
			if (chrome.runtime.lastError || !injectionResults || !injectionResults.length) {
				console.error("[JS Recon Buddy] Script injection failed:", chrome.runtime.lastError);
				return;
			}
			const pageData = injectionResults[0].result;
			if (pageData) {
				runPassiveScan(pageData, tabId);
			}
		});
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
});

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

	for (const { source, content } of allContentSources.filter(s => s.content)) {
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
					fullContent: content
				});
			}
		}
	}

	await chrome.storage.session.set({ [tabId]: { status: 'complete', results: findings } });
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