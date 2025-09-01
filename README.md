<p align="center">
    <img src="./src/icons/buddy.png" alt="Buddy Logo" width="30%"/>
</p>
<p align="center">
    <strong>JS Recon Buddy</strong>
</p>


A simple browser extension to quickly find interesting security-related information on a webpage. It injects an overlay to display its findings without interrupting your workflow.

## Features

- On-Page Overlay - all results are displayed in an overlay directly on the page you're testing.
- Comprehensive Scan - analyzes inline scripts, external JavaScript files, and the main HTML document.
- Categorized Findings - organizes results into logical categories for clear and easy analysis.
- Interactive Results - easily copy individual sections or export all findings to a JSON file for further use.

## What It Finds

The scanner uses a set of regex patterns to identify and categorize potential security-related information:

- Subdomains - discovers related subdomains within the code.
- Endpoints & Paths - uncovers potential API endpoints and other useful paths.
- Potential Secrets - scans for API keys, tokens, and other sensitive data using pattern matching and Shannon entropy checks.
- Potential DOM XSS Sinks - identifies dangerous properties and functions like .innerHTML and document.write.
- Interesting Parameters - flags potentially vulnerable URL parameters (e.g., redirect, debug, url).
- Source Maps - finds links to source maps which can expose original source code.
- JS Libraries - lists identified JavaScript libraries and their versions.

## Examples

- Extension's popup
<figure align="center">
	<img src="./assets/popup.png" alt="Popup" width="40%"/>
</figure>

- First scan of a given website
<figure align="center">
	<img src="./assets/github-first-scan.png" alt="First scan" width="90%"/>
</figure>

- Cached results of a given website
<figure align="center">
	<img src="./assets/github-rescan.png" alt="Cached results" width="90%"/>
</figure>

- New version is available on Github
<figure align="center">
	<img src="./assets/new-version-av.png" alt="New Version" width="40%"/>
</figure>

## How to Install

Since this extension is not on the Chrome Web Store, it must be loaded as an unpacked extension in developer mode.

1. Download ZIP or clone this repository to your local machine.
   
   > Unzip or Extract the ZIP file. This will create a new folder with the extension's files inside.
3. Open Google Chrome (or other chromium-based browser) and navigate to chrome://extensions.
4. Turn on "Developer mode" using the toggle in the top-right corner.
5. Click the "Load unpacked" button.
6. Select the directory where you cloned the repository or unzipped the archive.

The extension will now be installed.

## How to Use

1. Navigate to the target website.
2. Click the extension icon in your browser's toolbar.
3. (optional) Configure custom parameters in the popup.
4. Press 'Analyze page'
5. An overlay will appear and automatically start scanning the page.
    - If you've analyzed this page before, it will instantly show the cached results (indicated in the top-left corner) while a new scan runs.
    - You can rescan the page again if you want
7. Review the categorized findings!

## Automatic Version Check

The extension automatically checks for new versions. When you open the popup, it compares its own version against the [manifest.json](manifest.json) file in this GitHub repository. To avoid excessive requests, the latest version number is cached for one hour. If a newer version is available on GitHub, an asterisk will appear on the GitHub logo in the popup.

<figure align="center">
	<img src="./assets/new-version-av-tip.png" alt="New Version" width="40%"/>
</figure>

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This tool is intended for **educational** and **authorized** security testing purposes only. Do not use this tool on any system or website for which you do not have explicit, prior authorization. The author accepts no liability and is not responsible for any misuse or damage caused by this program. Use at your own risk.
