# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-09-01

### Changed

-   **Refactored the entire UI to use the Shadow DOM.** This provides complete CSS encapsulation, preventing style conflicts with host pages and ensuring a consistent, reliable user interface across all websites.
-   **Revised and improved component styles.** The UI has been updated for better layout, readability, and consistency, including fixes for minor alignment and overflow issues.

### Removed

-   Removed excessive and unnecessary `console.log` statements from the content script to provide a cleaner browser console for developers.

---

## [1.0.0] - 2025-08-30

### Added

-   **Initial public release.** A working Proof of Concept for the JS Recon Buddy extension.
-   Core scanning functionality for subdomains, endpoints, potential secrets, JS libraries, and source maps.
-   An injectable overlay UI to display scan results directly on the page.
-   Features for rescanning, exporting results to JSON, and viewing the context of each finding.

---

[1.1.0]: https://github.com/TheArqsz/JSRecon-Buddy/releases/tag/v1.0.0...v1.1.0
[1.0.0]: https://github.com/TheArqsz/JSRecon-Buddy/releases/tag/v1.0.0