(async function () {
	"use strict";

	const { secretRules } = await import(
		chrome.runtime.getURL("src/content/rules.js")
	);
	const { reconstructSource } = await import(
		chrome.runtime.getURL("src/content/sourceMapParser.js")
	);
	const OVERLAY_ID = "bug-bounty-scanner-overlay";
	const CACHE_KEY_PREFIX = "scan_cache_";
	let shadowRoot = null;
	const DEFAULT_PARAMETERS = [
		"redirect",
		"url",
		"ret",
		"next",
		"goto",
		"target",
		"dest",
		"r",
		"debug",
		"test",
		"admin",
		"edit",
		"enable",
		"id",
		"user",
		"account",
		"profile",
		"key",
		"token",
		"api_key",
		"secret",
		"password",
		"email",
		"callback",
		"return",
		"returnTo",
		"return_to",
		"redirect",
		"redirect_to",
		"redirectTo",
		"continue",
	];

	function getCacheKey() {
		return `${CACHE_KEY_PREFIX}${window.location.href}`;
	}

	async function getCachedResults() {
		const key = getCacheKey();
		const data = await chrome.storage.local.get(key);
		if (!data[key]) return null;

		const results = {};
		for (const category in data[key].results) {
			results[category] = new Map(Object.entries(data[key].results[category]));
		}
		return { ...data[key], results };
	}

	async function setCachedResults(results) {
		const key = getCacheKey();

		const serializableResults = {};
		for (const category in results) {
			if (results[category] instanceof Map) {
				serializableResults[category] = Object.fromEntries(results[category]);
			}
		}

		await chrome.storage.local.set({
			[key]: {
				results: serializableResults,
				timestamp: new Date().toISOString(),
			},
		});
	}


	async function runScanner(forceRescan = false) {
		const existingOverlay = document.getElementById(OVERLAY_ID);

		if (existingOverlay) {
			existingOverlay.remove();
			if (!forceRescan) {
				return;
			}
		}

		createOverlay(forceRescan);
	}

	async function performScan() {
		updateOverlayContent(
			'<h2><span class="spinner"></span> Analyzing scripts...</h2>'
		);

		setTimeout(async () => {
			const { parameters } = await chrome.storage.sync.get({
				parameters: DEFAULT_PARAMETERS,
			});

			const PATTERNS = getPatterns(parameters);
			const allScripts = await gatherScripts();
			const results = await processScriptsAsync(allScripts, PATTERNS);

			await setCachedResults(results);

			renderResults(results);
		}, 50);
	}

	async function createOverlay(forceRescan = false) {
		const shadowHost = document.createElement("div");
		shadowHost.id = OVERLAY_ID;
		document.body.appendChild(shadowHost);
		shadowRoot = shadowHost.attachShadow({ mode: "open" });

		const overlayURL = chrome.runtime.getURL("src/overlay/overlay.html");
		const cssURL = chrome.runtime.getURL("src/overlay/overlay.css");

		fetch(overlayURL)
			.then((response) => response.text())
			.then(async (html) => {
				shadowRoot.innerHTML = `<style>@import "${cssURL}";</style>${html}`;

				const closeOverlay = () => {
					shadowHost.remove();
					document.removeEventListener("keydown", handleEsc);
				};
				const handleEsc = (event) => {
					if (event.key === "Escape") closeOverlay();
				};
				shadowRoot.querySelector("#close-button").onclick = closeOverlay;
				document.addEventListener("keydown", handleEsc);

				const rescanButton = shadowRoot.querySelector("#rescan-button");
				if (rescanButton) {
					rescanButton.onclick = () => runScanner(true);
				}

				if (!forceRescan) {
					const cachedData = await getCachedResults();
					if (cachedData && cachedData.results) {
						const timestamp = new Date(cachedData.timestamp).toLocaleString();
						updateOverlayHeader(`Cached Scan (${timestamp})`);
						renderResults(cachedData.results);
						return;
					}
				}

				updateOverlayHeader("Live Scan");
				await performScan();
			});
	}

	function updateOverlayHeader(titleText) {
		const statusSpan = shadowRoot.querySelector("#scan-status");
		if (statusSpan) {
			statusSpan.textContent = titleText;
		}
	}

	async function gatherScripts() {
		const inlineScripts = Array.from(
			document.querySelectorAll("script:not([src])"),
		).map((el, idx) => ({
			source: `Inline Script #${idx + 1}`,
			code: el.innerHTML,
		}));
		const externalScriptUrls = Array.from(
			document.querySelectorAll("script[src]"),
		).map((tag) => tag.src);

		const externalScripts = await chrome.runtime.sendMessage({
			type: "FETCH_SCRIPTS",
			urls: externalScriptUrls,
		});

		const mainHtml = document.documentElement.outerHTML;
		return [
			...inlineScripts,
			...externalScripts.filter(Boolean),
			{ source: "Main HTML Document", code: mainHtml },
		];
	}

	async function processScriptsAsync(scripts, patterns) {
		const { currentHostname, baseDomain } = getDomainInfo();
		const isValidSubdomain = (domain) =>
			domain === currentHostname ||
			domain.endsWith(`.${currentHostname}`) ||
			domain === baseDomain ||
			domain.endsWith(`.${baseDomain}`);
		const isValidEntropy = (secret, ruleEntropy) =>
			shannonEntropy(secret) >= ruleEntropy;
		const isValidEndpoint = (endpoint) => !/^\/+$/.test(endpoint);

		const results = Object.keys(patterns).reduce(
			(acc, key) => ({ ...acc, [key]: new Map() }),
			{},
		);

		const processMatch = (
			match,
			{ group, context: contextType, ruleId, ruleEntropy },
			name,
			code,
			source,
		) => {
			let finding = match[group]?.trim();
			if (!finding) return;

			const validationMap = {
				Subdomains: () => isValidSubdomain(finding),
				"Potential Secrets": () => isValidEntropy(finding, ruleEntropy),
				Endpoints: () => isValidEndpoint(finding),
			};

			if (validationMap[name] && !validationMap[name]()) {
				return;
			}

			let displayContext = null;
			let fullContext = null;
			if (contextType === "snippet") {
				const displaySnippetStart = Math.max(0, match.index - 40);
				const displaySnippetEnd = Math.min(
					code.length,
					match.index + finding.length + 40,
				);
				displayContext = `... ${code.substring(displaySnippetStart, displaySnippetEnd).replace(/\n/g, " ")} ...`;

				const fullSnippetStart = Math.max(0, match.index - 250);
				const fullSnippetEnd = Math.min(
					code.length,
					match.index + finding.length + 250,
				);
				fullContext = `... ${code.substring(fullSnippetStart, fullSnippetEnd).replace(/\n/g, " ")} ...`;
			} else if (contextType === "line") {
				displayContext = fullContext = match[0].trim();
			}

			if (!results[name].has(finding)) {
				results[name].set(finding, []);
			}
			results[name]
				.get(finding)
				.push({ source, context: displayContext, fullContext, ruleId });
		};

		const applyRulesToCode = (code, source) => {
			for (const name in patterns) {
				const rules = Array.isArray(patterns[name])
					? patterns[name]
					: [patterns[name]];
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
			return new Promise((resolve) => {
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
		const standardizedStr = str.replace(
			/\\?u00([0-9a-f]{2})/gi,
			(match, hex) => `%${hex}`,
		);

		const decodedStr = standardizedStr.replace(/%[0-9a-f]{2}/gi, (match) => {
			try {
				return decodeURIComponent(match);
			} catch (err) {
				return match;
			}
		});

		const tempEl = document.createElement("textarea");
		tempEl.innerHTML = decodedStr;
		return tempEl.value;
	}

	function updateOverlayContent(html) {
		const resultsContainer = shadowRoot.querySelector(
			`.scanner-overlay__results`,
		);
		if (resultsContainer) resultsContainer.innerHTML = html;
	}

	function renderResults(results) {
		let expButton = shadowRoot.getElementById("export-button");
		if (expButton) {
			expButton.disabled = false;
		}

		const sectionConfig = [
			{
				key: "Subdomains",
				title: "[+] Subdomains",
				formatter: (safe) =>
					`<a href="https://${safe}" target="_blank">${safe}</a>`,
				copySelector: ".finding-details > summary",
			},
			{
				key: "Endpoints",
				title: "[/] Endpoints & Paths",
				formatter: (safe) => {
					if (safe.startsWith("//")) {
						return `<a href="https:${safe}" target="_blank">${safe}</a>`;
					}
					if (safe.startsWith("http")) {
						return `<a href="${safe}" target="_blank">${safe}</a>`;
					}
					return `<a href="${new URL(safe, location.origin).href}" target="_blank">${safe}</a>`;
				},
				copySelector: ".finding-details > summary",
			},
			{
				key: "Potential DOM XSS Sinks",
				title: "[!] Potential DOM XSS Sinks",
				formatter: (t) => `<span style="color:#ff8a80;">${t}</span>`,
				copySelector: ".finding-details > div div",
				copyModifier: "deduplicate-and-clean",
			},
			{
				key: "Potential Secrets",
				title: "[!] Potential Secrets",
				formatter: (t) => {
					return `
					<code style="background:#333; color:#ffeb3b; padding:4px; border-radius:4px;">
						${t}
					</code>
					`;
				},
				copySelector: ".finding-details > summary code",
			},
			{
				key: "Interesting Parameters",
				title: "[?] Interesting Parameters",
				formatter: (safe) => `<span style="color:#ffd180;">${safe}</span>`,
				copySelector: ".finding-details > summary",
			},
			{
				key: "JS Libraries",
				title: "[L] JS Libraries",
				formatter: (t) => `<span>${t}</span>`,
				copySelector: ".finding-details > summary",
			},
			{
				key: "Source Maps",
				title: "[M] Source Maps",
				formatter: (safe, occurrences, rawFinding) => {
					const sourceUrl = occurrences[0]?.source;
					let fullUrl = rawFinding;
					try {
						if (sourceUrl && sourceUrl.startsWith("http")) {
							fullUrl = new URL(rawFinding, sourceUrl).href;
						}
					} catch (e) {
						console.warn(
							"Could not create a valid URL for source map:",
							finding,
							"from source:",
							sourceUrl,
						);
					}

					return `<a href="${fullUrl}" target="_blank" class="source-map-link" data-url="${fullUrl}">${safe}</a>`;
				},
				copySelector: ".finding-details > summary > a",
			},
		];
		const sectionsHTML = sectionConfig
			.map(({ key, title, formatter, copySelector, copyModifier }) =>
				renderSection(
					results[key],
					title,
					formatter,
					copySelector,
					copyModifier,
				),
			)
			.join("");
		const totalFindings = Object.values(results).reduce(
			(sum, map) => sum + map.size,
			0,
		);

		updateOverlayContent(
			totalFindings > 0 ? sectionsHTML : "<h2>No findings. All clear!</h2>",
		);

		attachEventListeners(results);
	}

	function attachEventListeners(results) {
		const resultsContainer = shadowRoot.querySelector(
			`.scanner-overlay__results`,
		);
		resultsContainer.addEventListener("click", (event) => {
			const target = event.target;

			if (target.classList.contains("clickable-source")) {
				const context = target.getAttribute("data-context");
				if (context) showContextModal(context);
				return;
			}

			if (target.classList.contains("btn--copy-section")) {
				const section = target.closest("details");
				const selector = target.dataset.copySelector;
				const modifier = target.dataset.copyModifier;

				if (!selector) return;

				const records = Array.from(section.querySelectorAll(selector));

				let itemsToCopy = records.map((r) =>
					selector.endsWith("a")
						? (r.href || "").trim()
						: (r.textContent || "").trim(),
				);

				if (modifier === "deduplicate-and-clean") {
					const cleanedItems = itemsToCopy.map((item) =>
						item.replace("↳ ", ""),
					);
					itemsToCopy = [...new Set(cleanedItems)];
				}

				const textToCopy = itemsToCopy.join("\n");

				navigator.clipboard.writeText(textToCopy).then(() => {
					target.textContent = "Copied!";
					setTimeout(() => {
						target.textContent = "Copy";
					}, 2000);
				});
			}

			if (target.classList.contains('source-map-link')) {
				event.preventDefault();
				const url = target.dataset.url;

				target.textContent = "Reconstructing...";

				(async () => {
					const reconstructedSources = await reconstructSource(url);

					showSourceMapModal(reconstructedSources, url);

					target.textContent = url.split('/').pop() || url;
				})();
			}
		});

		attachExportListener(results);
		attachCollapseListener();
	}

	function attachCollapseListener() {
		const toggleCatButton = shadowRoot.getElementById("toggle-cat-button");
		let areCatOpen = false;

		toggleCatButton.addEventListener("click", () => {
			areCatOpen = !areCatOpen;
			toggleCatButton.textContent = areCatOpen
				? "Collapse Categories"
				: "Expand Categories";
			const allCategories = shadowRoot.querySelectorAll(
				`.scanner-overlay__results > details`,
			);
			allCategories.forEach((details) => {
				details.open = areCatOpen;
			});
		});

		const toggleAllButton = shadowRoot.getElementById("toggle-all-button");
		let areAllOpen = false;
		toggleAllButton.addEventListener("click", () => {
			areAllOpen = !areAllOpen;
			toggleAllButton.textContent = areAllOpen ? "Collapse All" : "Expand All";
			const allCategories = shadowRoot.querySelectorAll(
				`.scanner-overlay__results > details`,
			);
			allCategories.forEach((details) => {
				details.open = areAllOpen;
			});
			const allDetails = shadowRoot.querySelectorAll(
				`.finding-details`,
			);
			allDetails.forEach((details) => {
				details.open = areAllOpen;
			});
		});
	}

	function showContextModal(context) {
		const existingModal = document.getElementById("context-modal");
		if (existingModal) existingModal.remove();

		const modal = document.createElement("div");
		modal.id = "context-modal";
		modal.innerHTML = `
    <div class="modal-content">
      <span class="modal-close">&times;</span>
      <p>Context Snippet:</p>
      <pre><code></code></pre>
    </div>
  	`;
		modal.querySelector("code").textContent = context;

		shadowRoot.appendChild(modal);

		modal.querySelector(".modal-close").onclick = () => modal.remove();
		modal.onclick = (e) => {
			if (e.target === modal) modal.remove();
		};
	}

	function showSourceMapModal(sources, sourceMapUrl) {
		const existingModal = shadowRoot.getElementById('context-modal');
		if (existingModal) existingModal.remove();

		const modal = document.createElement("div");
		modal.id = "context-modal";

		const copyButtonSVG = `<svg width='12' height='12' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'><rect width='24' height='24' stroke='none' fill='#000000' opacity='0'/><g transform="matrix(1.43 0 0 1.43 12 12)" ><path style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-dashoffset: 0; stroke-linejoin: miter; stroke-miterlimit: 4; fill: rgb(255,255,255); fill-rule: nonzero; opacity: 1;" transform=" translate(-8, -7.5)" d="M 2.5 1 C 1.675781 1 1 1.675781 1 2.5 L 1 10.5 C 1 11.324219 1.675781 12 2.5 12 L 4 12 L 4 12.5 C 4 13.324219 4.675781 14 5.5 14 L 13.5 14 C 14.324219 14 15 13.324219 15 12.5 L 15 4.5 C 15 3.675781 14.324219 3 13.5 3 L 12 3 L 12 2.5 C 12 1.675781 11.324219 1 10.5 1 Z M 2.5 2 L 10.5 2 C 10.78125 2 11 2.21875 11 2.5 L 11 10.5 C 11 10.78125 10.78125 11 10.5 11 L 2.5 11 C 2.21875 11 2 10.78125 2 10.5 L 2 2.5 C 2 2.21875 2.21875 2 2.5 2 Z M 12 4 L 13.5 4 C 13.78125 4 14 4.21875 14 4.5 L 14 12.5 C 14 12.78125 13.78125 13 13.5 13 L 5.5 13 C 5.21875 13 5 12.78125 5 12.5 L 5 12 L 10.5 12 C 11.324219 12 12 11.324219 12 10.5 Z" stroke-linecap="round" /></g></svg>`;

		const filePaths = Object.keys(sources);
		const fileTreeHTML = generateFileTreeHTML(filePaths);
		modal.innerHTML = `
    <div class="modal-content-source-viewer">
      <span class="modal-close">&times;</span>
      <p>Reconstructed ${filePaths.length} sources from <a target="_blank" href="${sourceMapUrl}">${sourceMapUrl.split('/').pop()}</a>:</p>
      <div class="source-viewer">
        <div class="file-browser">${fileTreeHTML}</div>
        <div class="code-viewer">
          <div class="code-header">
            <span id="code-filename">Select a file</span>
            <div class="button-group">
              <button id="copy-code-button" class="btn btn--copy" title="Copy code" disabled>${copyButtonSVG}</button>
              <button id="download-file-button" class="btn btn--primary" disabled>Download</button>
            </div>
          </div>
          <pre><code id="code-content"></code></pre>
        </div>
      </div>
    </div>
  `;

		shadowRoot.appendChild(modal);

		const modalContent = modal.querySelector(".modal-content-source-viewer");
		const codeContentEl = modalContent.querySelector('#code-content');
		const codeFilenameEl = modalContent.querySelector('#code-filename');
		const copyButton = modalContent.querySelector('#copy-code-button');
		const downloadButton = modalContent.querySelector('#download-file-button');

		modalContent.querySelectorAll('.file-link').forEach(link => {
			link.addEventListener('click', (e) => {
				e.preventDefault();
				const fileName = e.target.closest('a').dataset.filename;
				const fileContent = sources[fileName] || '';

				codeFilenameEl.textContent = fileName;
				codeContentEl.textContent = fileContent;

				const hasContent = fileContent.length > 0;
				copyButton.disabled = !hasContent;
				downloadButton.disabled = !hasContent;
			});
		});

		copyButton.addEventListener('click', () => {
			const contentToCopy = codeContentEl.textContent;
			if (!contentToCopy) return;

			navigator.clipboard.writeText(codeContentEl.textContent).then(() => {
				copyButton.innerHTML = 'Copied!';
				setTimeout(() => {
					copyButton.innerHTML = copyButtonSVG;
				}, 2000);
			});
		});

		downloadButton.addEventListener('click', () => {
			const fileName = codeFilenameEl.textContent;
			const content = codeContentEl.textContent;
			if (!fileName || fileName === 'Select a file' || !content) return;

			const blob = new Blob([content], { type: 'text/plain' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = fileName.split('/').pop();
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		});

		modalContent.querySelector('.modal-close').onclick = () => shadowRoot.getElementById('context-modal').remove();
	}

	function generateFileTreeHTML(filePaths) {
		const root = {};
		filePaths.forEach(path => {
			let currentLevel = root;
			path.split('/').forEach(part => {
				if (!currentLevel[part]) {
					currentLevel[part] = {};
				}
				currentLevel = currentLevel[part];
			});
		});

		const createHTML = (node, path = '') => {
			let html = '<ul>';
			const entries = Object.entries(node);
			if (entries.length === 0) return '';

			entries.forEach(([name, children]) => {
				const currentPath = path ? `${path}/${name}` : name;
				const hasChildren = Object.keys(children).length > 0;

				html += '<li>';
				if (hasChildren) {
					html += `<details open><summary><span class="folder-icon">🗀</span> ${name}</summary>${createHTML(children, currentPath)}</details>`;
				} else {
					html += `<a href="#" class="file-link" data-filename="${currentPath}"><span class="file-icon">🖹</span> ${name}</a>`;
				}
				html += '</li>';
			});

			html += '</ul>';
			return html;
		};

		return createHTML(root);
	}

	let exportController = new AbortController();

	function attachExportListener(results) {
		exportController.abort();
		exportController = new AbortController();
		shadowRoot.getElementById("export-button").addEventListener(
			"click",
			() => {
				if (!results) return;

				const exportableResults = {};
				for (const key in results) {
					if (results[key] instanceof Map) {
						exportableResults[key] = Object.fromEntries(results[key]);
					}
				}
				const dataStr =
					"data:text/json;charset=utf-8," +
					encodeURIComponent(JSON.stringify(exportableResults, null, 2));
				const downloadAnchorNode = document.createElement("a");
				downloadAnchorNode.setAttribute("href", dataStr);
				downloadAnchorNode.setAttribute(
					"download",
					`recon_${location.hostname}.json`,
				);
				document.body.appendChild(downloadAnchorNode);
				downloadAnchorNode.click();
				downloadAnchorNode.remove();
			},
			{ signal: exportController.signal },
		);
	}

	function renderSection(
		findingsMap,
		title,
		formatter,
		selector,
		copyModifier,
	) {
		if (!findingsMap || findingsMap.size === 0) return "";
		let itemsHTML = "";

		if (title.includes("[!] Potential Secrets")) {
			const findingsByRule = {};
			findingsMap.forEach((occurrences, item) => {
				const ruleId = occurrences[0]?.ruleId || "generic-secret";
				if (!findingsByRule[ruleId]) {
					findingsByRule[ruleId] = [];
				}
				findingsByRule[ruleId].push({ item, occurrences });
			});

			for (const ruleId in findingsByRule) {
				const subfindings = findingsByRule[ruleId];
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

		const copySelector = selector || ".finding-details > summary";
		const modifierAttribute = copyModifier
			? `data-copy-modifier="${copyModifier}"`
			: "";

		const summaryHTML = `
      <span>${title} (${findingsMap.size})</span>
      <button class="btn btn--copy-section" data-copy-selector="${copySelector}" ${modifierAttribute}>Copy</button>
    `;
		return `<details><summary>${summaryHTML}</summary><ul>${itemsHTML}</ul></details>`;
	}

	function renderListItem(item, occurrences, formatter) {
		const escapeHTML = (str) => {
			return str
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#039;");
		};
		const safeItem = escapeHTML(item);
		const renderedItem = formatter
			? formatter(safeItem, occurrences, item)
			: safeItem;
		let occurrencesHTML = "";
		const uniqueOccurrences = new Map(
			occurrences.map((occ) => [occ.source + (occ.context || ""), occ]),
		);

		uniqueOccurrences.forEach(({ source, context, fullContext }) => {
			const isLocal =
				source.startsWith("Inline Script") || source === "Main HTML Document";
			const isURL = source.startsWith("http");
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
				regex:
					/\b(?:https?:\/\/)?((?:[a-zA-Z0-9-]+\.)+[a-z]{2,63})(?:\/[^\s"'`]*)?/g,
				group: 1,
				context: "snippet",
			},
			Endpoints: {
				regex: /(["'`])(\/(?!\/)[a-zA-Z0-9_?&=\/\-#.]*)\1/g,
				group: 2,
				context: "snippet",
			},
			"Source Maps": {
				regex: /\/[#*]\s?sourceMappingURL=([^\s*]+)/g,
				group: 1,
				context: "line",
			},
			"JS Libraries": {
				regex: /\/\*!?[ \n][a-zA-Z0-9\._\- ]+ v([0-9\.]+)/g,
				group: 0,
				context: "line",
			},
			"Potential DOM XSS Sinks": {
				regex: /(innerHTML|outerHTML|document\.write)/g,
				group: 1,
				context: "snippet",
			},
			"Interesting Parameters": {
				regex:
					parameters && parameters.length > 0
						? new RegExp(`[?&"']((${parameters.join("|")}))\\s*[:=]`, "gi")
						: null,
				group: 1,
				context: "snippet",
			}
		};
		for (const rule of secretRules) {
			if (!patterns["Potential Secrets"]) {
				patterns["Potential Secrets"] = [];
			}
			patterns["Potential Secrets"].push({
				regex: new RegExp(rule.regex, "gi"),
				group: rule.group ?? 0,
				context: "snippet",
				ruleId: rule.id,
				ruleEntropy: rule.entropy ?? 0,
			});
		}
		return patterns;
	}

	function getDomainInfo() {
		const hostname = window.location.hostname;
		const parts = hostname.split(".");
		if (parts.length <= 2)
			return { currentHostname: hostname, baseDomain: hostname };
		const slds = new Set(["co", "com", "gov", "org", "net", "ac", "edu"]);
		const baseDomain = slds.has(parts[parts.length - 2])
			? parts.slice(-3).join(".")
			: parts.slice(-2).join(".");
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

	if (typeof module !== "undefined" && module.exports) {
		module.exports = { shannonEntropy, getPatterns };
	}

	runScanner();
})();
