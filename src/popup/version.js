(async function checkVersion() {
	const GITHUB_MANIFEST_URL = 'https://raw.githubusercontent.com/TheArqsz/JSRecon-Buddy/main/manifest.json';
	const CACHE_DURATION = 3600 * 1000;
	const githubLink = document.querySelector('.github-link');
	if (!githubLink) return;

	const cache = await chrome.storage.local.get(['versionCache']);
	const now = new Date().getTime();

	if (cache.versionCache && (now - cache.versionCache.timestamp < CACHE_DURATION)) {
		updateUI(cache.versionCache.latestVersion);
		return;
	}

	try {
		let response = null;
		response = await fetch(GITHUB_MANIFEST_URL);
		if (response && response.status === 404) {
			return;
		}
		if (response && !response.ok) return;

		const remoteManifest = await response.json();
		const latestVersion = remoteManifest.version;

		const currentVersion = chrome.runtime.getManifest().version;
		if (latestVersion > currentVersion) {
			githubLink.classList.add('update-available');
			githubLink.setAttribute('title', `Version ${latestVersion} is available`);
		}
	} catch (error) {
		console.warn('Could not check for new version:', error);
	}
})();

function updateUI(latestVersion) {
	const githubLink = document.querySelector('.github-link');
	const tooltip = document.querySelector('.tooltip');
	const currentVersion = chrome.runtime.getManifest().version;

	if (latestVersion > currentVersion) {
		githubLink.classList.add('update-available');
		tooltip.textContent = `New version available!`;
	}
}