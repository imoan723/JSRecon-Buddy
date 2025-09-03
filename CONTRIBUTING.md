# Introduction

First off, thank you for considering contributing to this repository.

Following these guidelines helps to communicate that you respect the time of the developers managing and developing this open source project. In return, they should reciprocate that respect in addressing your issue, assessing changes, and helping you finalize your pull requests.

There are many ways to contribute, from writing tutorials or blog posts, improving the documentation, submitting bug reports and feature requests or writing code which can be incorporated into JS Recon Buddy itself.

# Ground Rules

* Create issues for any major changes and enhancements that you wish to make. Discuss things transparently and get community feedback.
* Keep feature versions as small as possible, preferably one new feature per version.
* Be welcoming to newcomers and encourage diverse new contributors from all backgrounds.

At this point, you're ready to make your changes! Feel free to ask for help - everyone is a beginner at first.

# Getting started

## Standard Contributions

1. Fork the repository.
2. Create a new branch for your feature or bug fix (`git checkout -b feature/your-feature-name`).
3. Commit your changes (`git commit -am 'Add some amazing feature'`).
4. Push to the branch (`git push origin feature/your-feature-name`).
5. Open a Pull Request.

## Adding a New Scanner

The extension is designed to be easily extensible. To add a new search "engine" or category of findings, you only need to modify two parts of [overlay.js](src/overlay/overlay.js):

1. Add the Pattern

In the `getPatterns` function, add a new entry to the patterns object. This includes a key, a regex, the capturing group, and the context type (`snippet`, `line` or null).

```javascript
'My New Scanner': {
  regex: /your-regex-here/g,
  group: 1,
  context: 'snippet'
},
```

2. Add the UI Section

In the `renderResults` function, add a corresponding entry to the `sectionConfig` array. This defines how the results for your new category will be displayed.

```javascript
{ 
  key: 'My New Scanner', 
  title: '[?] My New Scanner', 
  formatter: (safe) => `<span>${safe}</span>` 
},
```

## Adding or Modifying Secret Rules

The secret detection logic is powered by a list of rules in the [rules.js](src/utils/rules.js) file. To add a new secret to detect, simply add a new object to the `secretRules` array in this file.

As an example, to add a rule for detecting Postman API keys, you would add the following object to the array:

```js
{
  id: "postman-api-key",
  description: "Postman API Key",
  regex: '(PMAK-[0-9a-f]{24}-[0-9a-f]{34})',
  group: 1,
  entropy: 4.5,
},
```

Each rule requires:
- `id` - a unique, descriptive ID for the rule.
- `description` - ashort description of what the key is.
- `regex` - the regular expression used to find the secret.
- `group` - *(optional)* the specific capturing group from the regex to extract as the finding. Defaults to `0` (the entire match).
- `entropy` - *(optional)* a minimum Shannon entropy value. The finding will only be reported if its calculated entropy is higher than this value, which helps reduce false positives. Defaults to `0`.
