# JS Bounty Buddy

A simple browser extension to quickly find interesting security-related information on a webpage. It injects an overlay to display its findings without interrupting your workflow.

## Features

- On-Page Overlay - All results are displayed in an overlay directly on the page you're testing.
- Comprehensive Scan - Analyzes inline scripts, external JavaScript files, and the main HTML document.
- Categorized Findings - Organizes results into logical categories for clear and easy analysis.
- Interactive Results - Easily copy individual sections or export all findings to a JSON file for further use.

## What It Finds

The scanner uses a set of regex patterns to identify and categorize potential security-related information:

- Subdomains - Discovers related subdomains within the code.
- Endpoints & Paths - Uncovers potential API endpoints and other useful paths.
- Potential Secrets - Scans for API keys, tokens, and other sensitive data using pattern matching and Shannon entropy checks.
- Potential DOM XSS Sinks - Identifies dangerous properties and functions like .innerHTML and document.write.
- Interesting Parameters - Flags potentially vulnerable URL parameters (e.g., redirect, debug, url).
- Source Maps - Finds links to source maps which can expose original source code.
- JS Libraries - Lists identified JavaScript libraries and their versions.

## How to Use

1. Navigate to the target website.
2. Click the extension icon in your browser's toolbar.
3. (optional) Set your own parameters
4. Press 'Analyse page'
5. An overlay will appear and automatically start scanning the page.
6. Review the categorized findings!