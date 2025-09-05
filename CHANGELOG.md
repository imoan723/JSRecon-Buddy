# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.6] - 2025-09-05

### Fixed

- The extension now properly updates passive scanning status

## [1.4.5] - 2025-09-05

### Fixed

- The extension now properly refreshes on tabs' updated and activations

### Added

- write permission to the release.yml action

## [1.4.4] - 2025-09-04

### Fixed

- isScannable was not being properly passed

## [1.4.3] - 2025-09-04

### Changed

- Popup UI (added force passive rescan button)
- Handling of cached data (extension now properly handles big sources)

## [1.4.2] - 2025-09-03

### Added

- Simple progress bar was added to a full analysis mode

## [1.4.1] - 2025-09-03

### Changed

- sourcegraph-access-token rule was changed to be less noisy.
- azure-tenant-id rule was changed to catch other format of tenant_id.

## [1.4.0] - 2025-09-03

### Added

- Parameters input from the popup was replaced with new passive secret scanning feature
- Three new icons for 3 statuses of passive secret scanning
- New html and css for `source-viewer` from passive secret scanning functionality
- Docstrings for most of the functions
- New file for `getPatterns`: `src/utils/patterns.js`

### Changed

- Styles for popup to adhere to new functionality
- Refactored file structure:
	- Moved `entropy.js`, `rules.js` and `sourceMapParser.js` to `src/utils`
	- Renamed `content.js` to `src/overlay/overlay.js`
- README.md was updated to match changes

## [1.3.1] - 2025-09-01

### Changed

- A regex for generic-api-key was tweaked to match common patterns in HTML.

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

[1.4.6]: https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.4.5...v1.4.6
[1.4.5]: https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.4.4...v1.4.5
[1.4.4]: https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.4.3...v1.4.4
[1.4.3]: https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.4.2...v1.4.3
[1.4.2]: https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.4.1...v1.4.2
[1.4.1]: https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/TheArqsz/JSRecon-Buddy/releases/tag/v1.0.0
