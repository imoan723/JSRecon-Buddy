(async function () {
	'use strict';

	const { secretRules } = await import(chrome.runtime.getURL('src/content/rules.js'));
	const OVERLAY_ID = 'bug-bounty-scanner-overlay';

	const DEFAULT_PARAMETERS = [
		'redirect', 'url', 'ret', 'next', 'goto', 'target', 'dest', 'r',
		'debug', 'test', 'admin', 'edit', 'enable',
		'id', 'user', 'account', 'profile',
		'key', 'token', 'api_key', 'secret', 'password', 'email',
		'callback', 'return', 'returnTo', 'return_to', 'redirect', 'redirect_to',
		'redirectTo', 'continue'
	];

	async function runScanner() {
		if (document.getElementById(OVERLAY_ID)) {
			document.getElementById(OVERLAY_ID).remove();
			return;
		}

		createOverlay();
	}

	async function createOverlay() {
		const overlay = document.createElement('div');
		overlay.id = OVERLAY_ID;
		const overlayURL = chrome.runtime.getURL('src/overlay/overlay.html');

		fetch(overlayURL)
			.then(response => response.text())
			.then(async (html) => {
				overlay.innerHTML = html;
				document.body.appendChild(overlay);

				const closeOverlay = () => {
					overlay.remove();
					document.removeEventListener('keydown', handleEsc);
				};
				const handleEsc = (event) => {
					if (event.key === 'Escape') closeOverlay();
				};
				overlay.querySelector('.scanner-close').onclick = closeOverlay;
				document.addEventListener('keydown', handleEsc);

				updateOverlayContent('<h2><span class="spinner"></span> Analysing scripts...</h2>');

				setTimeout(async () => {
					const { parameters } = await chrome.storage.sync.get({ parameters: DEFAULT_PARAMETERS });

					const PATTERNS = getPatterns(parameters);
					const allScripts = await gatherScripts();
					const results = await processScriptsAsync(allScripts, PATTERNS);
					renderResults(results);
				}, 50);
			});
	}

	async function gatherScripts() {
		const inlineScripts = Array.from(document.querySelectorAll('script:not([src])')).map((el, idx) => ({ source: `Inline Script #${idx + 1}`, code: el.innerHTML }));
		const externalScriptUrls = Array.from(document.querySelectorAll('script[src]')).map(tag => tag.src);

		const externalScripts = await chrome.runtime.sendMessage({ type: 'FETCH_SCRIPTS', urls: externalScriptUrls });

		const mainHtml = document.documentElement.getHTML();
		return [
			...inlineScripts,
			...externalScripts.filter(Boolean),
			{ source: 'Main HTML Document', code: mainHtml },
		];
	}

	async function processScriptsAsync(scripts, patterns) {
		const { currentHostname, baseDomain } = getDomainInfo();
		const isValidSubdomain = (domain) => (domain === currentHostname || domain.endsWith(`.${currentHostname}`) || domain === baseDomain || domain.endsWith(`.${baseDomain}`));
		const isValidEntropy = (secret, ruleEntropy) => shannonEntropy(secret) >= ruleEntropy;
		const isValidEndpoint = (endpoint) => !/^\/+$/.test(endpoint);

		const results = Object.keys(patterns).reduce((acc, key) => ({ ...acc, [key]: new Map() }), {});

		const processMatch = (match, { group, context: contextType, ruleId, ruleEntropy }, name, code, source) => {
			let finding = match[group]?.trim();
			if (!finding) return;

			const validationMap = {
				'Subdomains': () => isValidSubdomain(finding),
				'Potential Secrets': () => isValidEntropy(finding, ruleEntropy),
				'Endpoints': () => isValidEndpoint(finding)
			};

			if (validationMap[name] && !validationMap[name]()) {
				return;
			}

			let displayContext = null;
			let fullContext = null;
			if (contextType === 'snippet') {
				const displaySnippetStart = Math.max(0, match.index - 40);
				const displaySnippetEnd = Math.min(code.length, match.index + finding.length + 40);
				displayContext = `... ${code.substring(displaySnippetStart, displaySnippetEnd).replace(/\n/g, ' ')} ...`;

				const fullSnippetStart = Math.max(0, match.index - 250);
				const fullSnippetEnd = Math.min(code.length, match.index + finding.length + 250);
				fullContext = `... ${code.substring(fullSnippetStart, fullSnippetEnd).replace(/\n/g, ' ')} ...`;
			} else if (contextType === 'line') {
				displayContext = fullContext = match[0].trim();
			}

			if (!results[name].has(finding)) {
				results[name].set(finding, []);
			}
			results[name].get(finding).push({ source, context: displayContext, fullContext, ruleId });
		};

		const applyRulesToCode = (code, source) => {
			for (const name in patterns) {
				const rules = Array.isArray(patterns[name]) ? patterns[name] : [patterns[name]];
				for (const rule of rules) {
					if (!rule.regex) continue;
					for (const match of code.matchAll(rule.regex)) {
						processMatch(match, rule, name, code, source);
					}
				}
			}
		};

		const processSingleScript = (script) => {
			let { code, source } = script;
			if (!code) return;

			const decodedCode = decodeText(code);
			applyRulesToCode(decodedCode, source);
		};

		const processChunk = (startIndex) => {
			return new Promise(resolve => {
				const endIndex = Math.min(startIndex + 5, scripts.length);

				for (let i = startIndex; i < endIndex; i++) {
					processSingleScript(scripts[i]);
				}

				if (endIndex < scripts.length) {
					setTimeout(() => processChunk(endIndex).then(resolve), 0);
				} else {
					resolve();
				}
			});
		};

		await processChunk(0);
		return results;
	}

	function decodeText(str) {
		const standardizedStr = str.replace(/\\?u00([0-9a-f]{2})/gi, (match, hex) => `%${hex}`);

		const decodedStr = standardizedStr.replace(/%[0-9a-f]{2}/gi, (match) => {
			try {
				return decodeURIComponent(match);
			} catch (err) {
				return match;
			}
		});

		const tempEl = document.createElement('textarea');
		tempEl.innerHTML = decodedStr;
		return tempEl.value;
	}

	// function processScripts(scripts, patterns) {
	// 	const { currentHostname, baseDomain } = getDomainInfo();
	// 	const isValidSubdomain = (domain) => (domain === currentHostname || domain.endsWith(`.${currentHostname}`) || domain === baseDomain || domain.endsWith(`.${baseDomain}`));
	// 	const isValidEntropy = (secret, ruleEntropy) => shannonEntropy(secret) >= ruleEntropy;
	// 	const isValidEndpoint = (endpoint) => !/^\/+$/.test(endpoint);

	// 	const results = Object.keys(patterns).reduce((acc, key) => ({ ...acc, [key]: new Map() }), {});

	// 	for (const { code, source } of scripts) {
	// 		if (!code) continue;
	// 		for (const name in patterns) {
	// 			const rules = Array.isArray(patterns[name]) ? patterns[name] : [patterns[name]];
	// 			for (const rule of rules) {
	// 				const { regex, group, context: contextType, ruleId, ruleEntropy } = rule;
	// 				if (!regex) continue;
	// 				for (const match of code.matchAll(regex)) {
	// 					const finding = match[group]?.trim();
	// 					if (!finding) continue;
	// 					try { finding = decodeURIComponent(finding); } catch (e) { }

	// 					if (name === 'Subdomains' && !isValidSubdomain(finding)) continue;
	// 					if (name === 'Potential Secrets' && !isValidEntropy(finding, ruleEntropy)) continue;
	// 					if (name === 'Endpoints' && !isValidEndpoint(finding)) continue;

	// 					let displayContext = null;
	// 					let fullContext = null;
	// 					if (contextType === 'snippet') {
	// 						const displaySnippetStart = Math.max(0, match.index - 40);
	// 						const displaySnippetEnd = Math.min(code.length, match.index + finding.length + 40);
	// 						displayContext = `... ${code.substring(displaySnippetStart, displaySnippetEnd).replace(/\n/g, ' ')} ...`;

	// 						const fullSnippetStart = Math.max(0, match.index - 250);
	// 						const fullSnippetEnd = Math.min(code.length, match.index + finding.length + 250);
	// 						fullContext = `... ${code.substring(fullSnippetStart, fullSnippetEnd).replace(/\n/g, ' ')} ...`;
	// 					} else if (contextType === 'line') {
	// 						displayContext = match[0].trim();
	// 						fullContext = match[0].trim();
	// 					}
	// 					if (!results[name].has(finding)) results[name].set(finding, []);
	// 					results[name].get(finding).push({
	// 						source,
	// 						context: displayContext,
	// 						fullContext: fullContext,
	// 						ruleId: ruleId
	// 					});
	// 				}
	// 			}
	// 		}
	// 	}
	// 	return results;
	// }

	function updateOverlayContent(html) {
		const resultsContainer = document.querySelector(`#${OVERLAY_ID} .scanner-results`);
		if (resultsContainer) resultsContainer.innerHTML = html;
	}

	function renderResults(results) {
		let expButton = document.getElementById('export-button');
		if (expButton) {
			expButton.disabled = false;
		}

		// const highlightRegex = new RegExp(`(${keywords.join('|')})`, 'gi');
		const sectionConfig = [
			{ key: 'Subdomains', title: '[+] Subdomains', formatter: (safe) => `<a href="https://${safe}" target="_blank">${safe}</a>` },
			{
				key: 'Endpoints', title: '[>] Endpoints & Paths', formatter: (safe) => {
					if (safe.startsWith('//')) {
						return `<a href="https:${safe}" target="_blank">${safe}</a>`;
					}
					if (safe.startsWith('http')) {
						return `<a href="${safe}" target="_blank">${safe}</a>`;
					}
					return `<a href="${new URL(safe, location.origin).href}" target="_blank">${safe}</a>`;
				},
			},
			{ key: 'Potential DOM XSS Sinks', title: '[!] Potential DOM XSS Sinks', formatter: (t) => `<span style="color:#ff8a80;">${t}</span>` },
			{
				key: 'Potential Secrets', title: '[!] Potential Secrets', formatter: (t) => {
					// return `
					// ${occurrences[0].ruleId}<br>
					// <code style="background:#333; color:#ffeb3b; padding:4px; border-radius:4px;">
					// 	${t}
					// </code>
					// `
					return `
					<code style="background:#333; color:#ffeb3b; padding:4px; border-radius:4px;">
						${t}
					</code>
					`
				}
			},
			{ key: 'Interesting Parameters', title: '[?] Interesting Parameters', formatter: (safe) => `<span style="color:#ffd180;">${safe}</span>` },
			{ key: 'JS Libraries', title: '[L] JS Libraries', formatter: (t) => `<span>${t}</span>` },
			{
				key: 'Source Maps',
				title: '[M] Source Maps',

				formatter: (finding, occurrences) => {
					const sourceUrl = occurrences[0]?.source;
					let fullUrl = finding;
					try {
						if (sourceUrl && sourceUrl.startsWith('http')) {
							fullUrl = new URL(finding, sourceUrl).href;
						}
					} catch (e) {
						console.warn("Could not create a valid URL for source map:", finding, "from source:", sourceUrl);
					}

					return `<a href="${fullUrl}" target="_blank">${finding}</a>`;
				}
			},
			// {
			// 	key: 'High-Value Keywords',
			// 	title: '[!] High-Value Keywords',
			// 	formatter: (t) => `<span style="color:#ffd180;">${t.replace(highlightRegex, `<span class="highlight">$1</span>`)}</span>`
			// },
		];
		const sectionsHTML = sectionConfig.map(({ key, title, formatter }) => renderSection(results[key], title, formatter)).join('');
		const totalFindings = Object.values(results).reduce((sum, map) => sum + map.size, 0);

		updateOverlayContent(totalFindings > 0 ? sectionsHTML : '<h2>No findings. All clear!</h2>');

		attachEventListeners(results);
	}

	function attachEventListeners(results) {
		const resultsContainer = document.querySelector(`#${OVERLAY_ID} .scanner-results`);
		resultsContainer.addEventListener('click', (event) => {
			const target = event.target;

			if (target.classList.contains('clickable-source')) {
				const context = target.getAttribute('data-context');
				if (context) showContextModal(context);
				return;
			}

			if (target.classList.contains('copy-section-button')) {
				const section = target.closest('details');
				let records = null;
				let textToCopy = null;
				if (section.textContent.includes("Potential Secrets")) {
					records = Array.from(section.querySelectorAll('.finding-details > summary code'));
					textToCopy = records.map(r => r.textContent.trim()).join('\n');
				} else if (section.textContent.includes("XSS Sinks")) {
					records = Array.from(section.querySelectorAll('.finding-details > div div'));
					textToCopy = [...new Set(records.map(r => r.textContent.trim().replace('↳ ', '')))].join('\n');
				} else if (section.textContent.includes("Source Maps")) {
					records = Array.from(section.querySelectorAll('.finding-details > summary > a')).map(a => a.href);
					textToCopy = records.join('\n');
				} else {
					records = Array.from(section.querySelectorAll('.finding-details > summary'));
					textToCopy = records.map(r => r.textContent.trim()).join('\n');
				}

				navigator.clipboard.writeText(textToCopy).then(() => {
					target.textContent = 'Copied!';
					setTimeout(() => { target.textContent = 'Copy'; }, 2000);
				});
			}
		});

		attachExportListener(results);
		attachCollapseListener();
	}

	function attachCollapseListener() {
		const toggleCatButton = document.getElementById('toggle-cat-button');
		let areCatOpen = false;

		toggleCatButton.addEventListener('click', () => {
			areCatOpen = !areCatOpen;
			toggleCatButton.textContent = areCatOpen ? 'Collapse Categories' : 'Expand Categories';
			const allCategories = document.querySelectorAll(`#${OVERLAY_ID} .scanner-results > details`);
			allCategories.forEach(details => {
				details.open = areCatOpen;
			});
		});

		const toggleAllButton = document.getElementById('toggle-all-button');
		let areAllOpen = false;
		toggleAllButton.addEventListener('click', () => {
			areAllOpen = !areAllOpen;
			toggleAllButton.textContent = areAllOpen ? 'Collapse All' : 'Expand All';
			const allCategories = document.querySelectorAll(`#${OVERLAY_ID} .scanner-results > details`);
			allCategories.forEach(details => {
				details.open = areAllOpen;
			});
			const allDetails = document.querySelectorAll(`#${OVERLAY_ID} .finding-details`);
			allDetails.forEach(details => {
				details.open = areAllOpen;
			});
		});
	}

	function showContextModal(context) {
		const existingModal = document.getElementById('context-modal');
		if (existingModal) existingModal.remove();

		const modal = document.createElement('div');
		modal.id = 'context-modal';
		modal.innerHTML = `
    <div class="modal-content">
      <span class="modal-close">&times;</span>
      <p>Context Snippet:</p>
      <pre><code></code></pre>
    </div>
  	`;
		modal.querySelector('code').textContent = context;

		document.getElementById(OVERLAY_ID).appendChild(modal);

		modal.querySelector('.modal-close').onclick = () => modal.remove();
		modal.onclick = (e) => {
			if (e.target === modal) modal.remove();
		};
	}

	function attachExportListener(results) {
		const exportButton = document.getElementById('export-button');

		exportButton.replaceWith(exportButton.cloneNode(true));
		document.getElementById('export-button').addEventListener('click', () => {
			if (!results) return;

			const exportableResults = {};
			for (const key in results) {
				if (results[key] instanceof Map) {
					exportableResults[key] = Object.fromEntries(results[key]);
				}
			}
			const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportableResults, null, 2));
			const downloadAnchorNode = document.createElement('a');
			downloadAnchorNode.setAttribute("href", dataStr);
			downloadAnchorNode.setAttribute("download", `recon_${location.hostname}.json`);
			document.body.appendChild(downloadAnchorNode);
			downloadAnchorNode.click();
			downloadAnchorNode.remove();
		});
	}

	// function renderSection(findingsMap, title, formatter) {
	// 	if (!findingsMap || findingsMap.size === 0) return '';
	// 	const escapeHTML = (str) => {
	// 		return str
	// 			.replace(/&/g, '&amp;')
	// 			.replace(/</g, '&lt;')
	// 			.replace(/>/g, '&gt;')
	// 			.replace(/"/g, '&quot;')
	// 			.replace(/'/g, '&#039;');
	// 	};
	// 	let itemsHTML = '';
	// 	findingsMap.forEach((occurrences, item) => {
	// 		const safeItem = escapeHTML(item);
	// 		const renderedItem = formatter ? formatter(safeItem, occurrences) : safeItem;
	// 		let occurrencesHTML = '';
	// 		const uniqueOccurrences = new Map(occurrences.map(occ => [occ.source + (occ.context || ''), occ]));

	// 		uniqueOccurrences.forEach(({ source, context, fullContext }) => {
	// 			const isLocal = source.startsWith('Inline Script') || source === 'Main HTML Document';
	// 			const isURL = source.startsWith('http');

	// 			let sourceHTML = `↳ ${escapeHTML(source)}`;

	// 			if (isURL) {
	// 				sourceHTML = `↳ <a href="${source}" target="_blank">${escapeHTML(source)}</a>`;
	// 			} else if (isLocal && fullContext) {
	// 				sourceHTML = `↳ <span class="clickable-source" data-context="${escapeHTML(fullContext)}">${escapeHTML(source)} (click to view)</span>`;
	// 			}

	// 			occurrencesHTML += `<div>${sourceHTML}</div>`;

	// 			if (context && !isLocal) {
	// 				occurrencesHTML += `<code class="context-snippet">${escapeHTML(context)}</code>`;
	// 			}
	// 		});

	// 		itemsHTML += `
	// 			<li>
	// 				<details class="finding-details">
	// 					<summary>${renderedItem}</summary>
	// 					<div style="font-size:.85em;color:#999;padding-left:15px;margin-top:5px">
	// 						${occurrencesHTML}
	// 					</div>
	// 				</details>
	// 			</li>
	// 		`;
	// 	});

	// 	const summaryHTML = `
	// 			<span>${title} (${findingsMap.size})</span>
	// 			<button class="copy-section-button">Copy</button>
	// 	`;
	// 	return `<details><summary>${summaryHTML}</summary><ul>${itemsHTML}</ul></details>`;
	// }

	function renderSection(findingsMap, title, formatter) {
		if (!findingsMap || findingsMap.size === 0) return '';
		let itemsHTML = '';

		if (title.includes('[!] Potential Secrets')) {
			const findingsByRule = {};
			findingsMap.forEach((occurrences, item) => {
				const ruleId = occurrences[0]?.ruleId || 'generic-secret';
				if (!findingsByRule[ruleId]) {
					findingsByRule[ruleId] = [];
				}
				findingsByRule[ruleId].push({ item, occurrences });
			});

			for (const ruleId in findingsByRule) {
				const subfindings = findingsByRule[ruleId]
				itemsHTML += `<div class="sub-section"><details><summary>${ruleId} (${subfindings.length})</summary><ul>`;
				subfindings.forEach(({ item, occurrences }) => {
					itemsHTML += renderListItem(item, occurrences, formatter);
				});
				itemsHTML += `</ul></details></div>`;
			}
		} else {
			findingsMap.forEach((occurrences, item) => {
				itemsHTML += renderListItem(item, occurrences, formatter);
			});
		}

		const summaryHTML = `
      <span>${title} (${findingsMap.size})</span>
      <button class="copy-section-button">Copy</button>
    `;
		return `<details><summary>${summaryHTML}</summary><ul>${itemsHTML}</ul></details>`;
	}

	function renderListItem(item, occurrences, formatter) {
		const escapeHTML = (str) => {
			return str
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#039;');
		};
		const safeItem = escapeHTML(item);
		const renderedItem = formatter ? formatter(safeItem, occurrences, item) : safeItem;
		let occurrencesHTML = '';
		const uniqueOccurrences = new Map(occurrences.map(occ => [occ.source + (occ.context || ''), occ]));

		uniqueOccurrences.forEach(({ source, context, fullContext }) => {
			const isLocal = source.startsWith('Inline Script') || source === 'Main HTML Document';
			const isURL = source.startsWith('http');
			let sourceHTML = `↳ ${escapeHTML(source)}`;
			if (isURL) {
				sourceHTML = `↳ <a href="${source}" target="_blank">${escapeHTML(source)}</a>`;
			} else if (isLocal && fullContext) {
				sourceHTML = `↳ <span class="clickable-source" data-context="${escapeHTML(fullContext)}">${escapeHTML(source)} (click to view)</span>`;
			}
			occurrencesHTML += `<div>${sourceHTML}</div>`;
			if (context && !isLocal) {
				occurrencesHTML += `<code class="context-snippet">${escapeHTML(context)}</code>`;
			}
		});

		return `
    <li>
      <details class="finding-details">
        <summary>${renderedItem}</summary>
        <div style="font-size:.85em;color:#999;padding-left:15px;margin-top:5px">
          ${occurrencesHTML}
        </div>
      </details>
    </li>
  `;
	}

	function getPatterns(parameters) {
		let patterns = {
			Subdomains: {
				regex: /\b(?:https?:\/\/)?((?:[a-zA-Z0-9-]+\.)+[a-z]{2,63})(?:\/[^\s"'`]*)?/g,
				group: 1,
				context: 'snippet'
			},
			Endpoints: {
				regex: /(["'`])(\/(?!\/)[a-zA-Z0-9_?&=\/\-#.]*)\1/g,
				group: 2,
				context: 'snippet'
			},
			'Source Maps': {
				regex: /\/[#*]\s?sourceMappingURL=([^\s*]+)/g,
				group: 1,
				context: 'line'
			},
			'JS Libraries': {
				regex: /\/\*!?[ \n][a-zA-Z0-9\._\- ]+ v([0-9\.]+)/g,
				group: 0,
				context: 'line'
			},
			'Potential DOM XSS Sinks': {
				regex: /(innerHTML|outerHTML|document\.write)/g,
				group: 1,
				context: 'snippet'
			},
			'Interesting Parameters': {
				regex: parameters && parameters.length > 0 ? new RegExp(`[?&"']((${parameters.join('|')}))\\s*[:=]`, 'gi') : null,
				group: 1,
				context: 'snippet'
			},
			// 'High-Value Keywords': {
			// 	regex: keywords && keywords.length > 0 ? new RegExp(`(["'])([^"'\`]*\\b(${keywords.join('|')})\\b[^"'\`]*)\\1`, 'gi') : null,
			// 	group: 2,
			// 	context: 'snippet'
			// },
		};
		for (const rule of secretRules) {
			if (!patterns['Potential Secrets']) {
				patterns['Potential Secrets'] = [];
			}
			patterns['Potential Secrets'].push({
				regex: new RegExp(rule.regex, 'gi'),
				group: rule.group ?? 0,
				context: 'snippet',
				ruleId: rule.id,
				ruleEntropy: rule.entropy ?? 0,
			});
		}
		return patterns;
	}

	function getDomainInfo() {
		const hostname = window.location.hostname;
		const parts = hostname.split('.');
		if (parts.length <= 2) return { currentHostname: hostname, baseDomain: hostname };
		const slds = new Set(['co', 'com', 'gov', 'org', 'net', 'ac', 'edu']);
		const baseDomain = slds.has(parts[parts.length - 2]) ? parts.slice(-3).join('.') : parts.slice(-2).join('.');
		return { currentHostname: hostname, baseDomain };
	}

	function shannonEntropy(str) {
		const len = str.length;
		const frequencies = {};

		for (const char of str) {
			frequencies[char] = (frequencies[char] || 0) + 1;
		}

		let entropy = 0;
		for (const freq of Object.values(frequencies)) {
			const p = freq / len;
			entropy -= p * Math.log2(p);
		}

		return entropy;
	}

	runScanner();
})();