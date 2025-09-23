## [1.6.2](https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.6.1...v1.6.2) (2025-09-22)


### Bug Fixes

* Updated the logic behind the popup rendering ([5720fc6](https://github.com/TheArqsz/JSRecon-Buddy/commit/5720fc6637d00447865fd596bfb0fe58ca8d5782))

## [1.6.1](https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.6.0...v1.6.1) (2025-09-22)


### Bug Fixes

* Changed handling of fetch requests ([f286d95](https://github.com/TheArqsz/JSRecon-Buddy/commit/f286d954b5286e744ddab8485579a9a3a1096bf6))

## [1.6.0](https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.5.4...v1.6.0) (2025-09-19)


### Features

* Added new HTML sink values in patterns.js ([9baaee3](https://github.com/TheArqsz/JSRecon-Buddy/commit/9baaee350a8bf75b530c65cfe20a8a1efab90424))


### Bug Fixes

* Added mechanism that clears old local storage cache properly ([9e4a937](https://github.com/TheArqsz/JSRecon-Buddy/commit/9e4a937ff5a1561927adf416df3416b2fe0b4c0b))

## [1.5.4](https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.5.3...v1.5.4) (2025-09-18)


### Bug Fixes

* Changed how text is copied in the overlay ([8ebf591](https://github.com/TheArqsz/JSRecon-Buddy/commit/8ebf591c794cc85d216b978885e509c0b0cbc99e))

## [1.5.3](https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.5.2...v1.5.3) (2025-09-18)


### Bug Fixes

* Source map parser was fixed to properly handle 404s and other URL issues when collecting maps ([65c11f4](https://github.com/TheArqsz/JSRecon-Buddy/commit/65c11f4fc1805d0f9a018acc46b4f6f1e85a5223))

## [1.5.2](https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.5.1...v1.5.2) (2025-09-17)


### Bug Fixes

* Fixed code not being wrapped and added copy button ([54a1f36](https://github.com/TheArqsz/JSRecon-Buddy/commit/54a1f36d063d2878107c5d467d543cf1b3351410))
* Fixed source maps not being properly downloaded due to context restrictions (moved source map downloading to background.js ([2b34820](https://github.com/TheArqsz/JSRecon-Buddy/commit/2b3482089c1849728f5fe7b4301d6634c2080893))
* Fixed styles not being respected on some websites ([eb643cd](https://github.com/TheArqsz/JSRecon-Buddy/commit/eb643cdb3dbe650da0379bf23748238b37991028))
* Popup is no longer throwing errors on chrome webstore and other google's pages ([45b6453](https://github.com/TheArqsz/JSRecon-Buddy/commit/45b6453f07af01cbf516a218f8f7f684791d3d49))

## [1.5.1](https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.5.0...v1.5.1) (2025-09-16)


### Bug Fixes

* Removed race condition issue for passive scanning ([4c20d14](https://github.com/TheArqsz/JSRecon-Buddy/commit/4c20d1415e6075d54f55232591f37d356697cf19))

## [1.5.0](https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.4.8...v1.5.0) (2025-09-16)


### Features

* Added support for Offscreen API that allows the extension to be executed async in multiple tabs at once ([76f3cb2](https://github.com/TheArqsz/JSRecon-Buddy/commit/76f3cb23fc8470a4ccd30e96e37c66973fc81757))


### Bug Fixes

* Fixed responsiveness of the extension by making passive scanning async ([3cb04bb](https://github.com/TheArqsz/JSRecon-Buddy/commit/3cb04bbe027d082d8d01a412330d9c346419d886))
* Fixed the behavior of icon not being set properly and scanning not updating the results ([96b7623](https://github.com/TheArqsz/JSRecon-Buddy/commit/96b76231c519f3ff1ad39f9d584984432bae8038))

## [1.4.8](https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.4.7...v1.4.8) (2025-09-08)


### Bug Fixes

* Added error handling for one of the scanning phases ([e05ab75](https://github.com/TheArqsz/JSRecon-Buddy/commit/e05ab7528c044c63da2bd3b3751c79d5ee2546cb))

## [1.4.7](https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.4.6...v1.4.7) (2025-09-08)


### Bug Fixes

* Added scan queue to be able to properly scan pages in order ([fa0358f](https://github.com/TheArqsz/JSRecon-Buddy/commit/fa0358fc0513cd1f1b8d1fc537412351de15926c))
* Removed unnecessary logging and fixed global variable assignment ([41f9f6e](https://github.com/TheArqsz/JSRecon-Buddy/commit/41f9f6e283e0dec853a19083373bac36eab8d5dc))

## [1.4.6](https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.4.5...v1.4.6) (2025-09-05)


### Bug Fixes

* proper content update on passive scanning ([f84c6eb](https://github.com/TheArqsz/JSRecon-Buddy/commit/f84c6ebdba383f979a330289fbfb41edd00a75d5))

## [1.4.5](https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.4.4...v1.4.5) (2025-09-05)


### Bug Fixes

* edited version in manifest.json ([75d5207](https://github.com/TheArqsz/JSRecon-Buddy/commit/75d52074a89778334ff4228e1277eb4a6c5b90c4))
* env -> secrets in release.yml ([a31200b](https://github.com/TheArqsz/JSRecon-Buddy/commit/a31200bba63cedb6b5cd4118ea6bb4988c9ee532))
* Fixed the behaviour of the extension on active tabs and reloads ([dfd76f9](https://github.com/TheArqsz/JSRecon-Buddy/commit/dfd76f95174d2ace6144876b83c26e091ea3e56d))

## [1.4.4](https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.4.3...v1.4.4) (2025-09-04)


### Bug Fixes

* Fixed isScannable not being passed ([833d484](https://github.com/TheArqsz/JSRecon-Buddy/commit/833d4841cc9f260c42b06164d6e3aa4f44c78e68))
* Properly changed version in manifest.json ([f77f10f](https://github.com/TheArqsz/JSRecon-Buddy/commit/f77f10fc6f5d84ad6d42b2a2e913bade7daf5e20))

## [1.4.3](https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.4.2...v1.4.3) (2025-09-04)


### Bug Fixes

* Cache handling and popup ui ([38fb776](https://github.com/TheArqsz/JSRecon-Buddy/commit/38fb776c6de78061e298f1ac67cde87cb9fcbd4b))
* Properly set version in cache ([66714ba](https://github.com/TheArqsz/JSRecon-Buddy/commit/66714ba740e5cc9cc016e623c015a5a8425afb8c))

## [1.4.2](https://github.com/TheArqsz/JSRecon-Buddy/compare/v1.0.0...v1.4.2) (2025-09-04)


### Features

* added passive scanning and docstrings ([5b3e0af](https://github.com/TheArqsz/JSRecon-Buddy/commit/5b3e0afa60b7b5c611815b9192981f7f81157c6f))
* Added source map deconstruction ([a538159](https://github.com/TheArqsz/JSRecon-Buddy/commit/a538159610b235098a6cb65ce55a73f79b429caf))
* changed version handling to match semver versioning scheme ([a77d42e](https://github.com/TheArqsz/JSRecon-Buddy/commit/a77d42e72671c1f5c9c4cd7421c4770cc6301451))


### Bug Fixes

* Changed color for Live scan status badge ([4294aa4](https://github.com/TheArqsz/JSRecon-Buddy/commit/4294aa4a57fe79ebf08895577172c675711767de))
* Changed some rules in rules.js ([f38682b](https://github.com/TheArqsz/JSRecon-Buddy/commit/f38682bf046d7f2b84340824d56a1f97193d0b84))
* Fixed regex for sourceMaps and changed the fileBrowsing logic ([01ba7e5](https://github.com/TheArqsz/JSRecon-Buddy/commit/01ba7e50de598b734abaa4727664a51f55ceee55))
* Styles in overlay.css are no longer overwriting styles in the analyzed page ([906b6cf](https://github.com/TheArqsz/JSRecon-Buddy/commit/906b6cf381098e3fa7254812a4fdd94ea2afd9f5))
* update manifest.json with new version ([1749a3d](https://github.com/TheArqsz/JSRecon-Buddy/commit/1749a3dcf517eeb79af59d20e5f189a83c1a91ea))
* Updated regex for generic-api-key ([f8d8ca1](https://github.com/TheArqsz/JSRecon-Buddy/commit/f8d8ca160e91f2f984ff40b1c03f207da312915a))

## 1.0.0 (2025-08-29)

