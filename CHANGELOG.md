# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-09-01

### Added

- An ability to see sources deconstructed from source maps was added to Source Map module

## [1.2.1] - 2025-09-01

### Fixed

- Styles in overlay.css overwriting styles in the analyzed page

## [1.2.0] - 2025-09-01

### Added

- Contributing guidelines at [CONTRIBUTING.md](CONTRIBUTING.md)

### Changed

- Revised logic behind the versioning verification

## [1.1.0] - 2025-09-01

### Added

- New Github workflow for creating releases

### Changed

- **Refactored the entire UI to use the Shadow DOM.** This provides complete CSS encapsulation, preventing style conflicts with host pages and ensuring a consistent, reliable user interface across all websites.
- **Revised and improved component styles.** The UI has been updated for better layout, readability, and consistency, including fixes for minor alignment and overflow issues.
- Added examples in the README.md 

### Removed

-   Removed excessive and unnecessary `console.log` statements from the content script to provide a cleaner browser console for developers.

---

## [1.0.0] - 2025-08-30

### Added

- **Initial public release.** A working Proof of Concept for the JS Recon Buddy extension.
- Core scanning functionality for subdomains, endpoints, potential secrets, JS libraries, and source maps.
- An injectable overlay UI to display scan results directly on the page.
- Features for rescanning, exporting results to JSON, and viewing the context of each finding.

---

[1.3.0]: https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/TheArqsz/JSRecon-Buddy/releases/tag/v1.0.0
