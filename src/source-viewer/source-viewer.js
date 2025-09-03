document.addEventListener('DOMContentLoaded', () => {
	const contentEl = document.getElementById('content');
	const escapeHTML = (str) => {
		return str
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	};
	try {
		const { content, secret } = JSON.parse(decodeURIComponent(window.location.hash.substring(1)));

		if (content && secret) {
			const sanitizedContent = escapeHTML(content);
			const escapedSecret = escapeHTML(secret);
			const highlightedContent = sanitizedContent.replace(
				new RegExp(escapedSecret, 'g'),
				`<span class="highlight">${escapedSecret}</span>`
			);
			contentEl.innerHTML = highlightedContent;

			const firstFinding = contentEl.querySelector('.highlight');

			if (firstFinding) {
				firstFinding.scrollIntoView({
					behavior: 'auto',
					block: 'center'
				});
			}

		} else {
			contentEl.textContent = "[JS Recon Buddy] Error: Could not display content.";
		}
	} catch (e) {
		contentEl.textContent = "[JS Recon Buddy] Error: Failed to parse content from URL.";
		console.error("[JS Recon Buddy] Source viewer error:", e);
	}
});