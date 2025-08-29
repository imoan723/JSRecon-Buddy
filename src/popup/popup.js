const scanButton = document.getElementById("scan-button");
const resetButton = document.getElementById("reset-parameters");
const paramsTextarea = document.getElementById("parameters");
const statusDiv = document.getElementById("status-message");

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

document.addEventListener("DOMContentLoaded", () => {
	chrome.storage.sync.get({ parameters: DEFAULT_PARAMETERS }, (data) => {
		paramsTextarea.value = data.parameters.join("\n");
	});
});

paramsTextarea.addEventListener("input", () => {
	const parameters = paramsTextarea.value
		.split("\n")
		.map((p) => p.trim())
		.filter(Boolean);
	chrome.storage.sync.set({ parameters: parameters }, () => {
		statusDiv.textContent = "Parameters saved!";
		setTimeout(() => {
			statusDiv.textContent = "";
		}, 2000);
	});
});

scanButton.addEventListener("click", async () => {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

	chrome.runtime.sendMessage({ type: "SCAN_PAGE", tabId: tab.id });

	window.close();
});

resetButton.addEventListener("click", () => {
	chrome.storage.sync.remove("parameters", () => {
		paramsTextarea.value = DEFAULT_PARAMETERS.join("\n");
		statusDiv.textContent = "Parameters reset to default!";
		setTimeout(() => {
			statusDiv.textContent = "";
		}, 2000);
	});
});
