# Introduction

First off, thank you for considering contributing to this repository.

Following these guidelines helps to communicate that you respect the time of the developers managing and developing this open source project. In return, they should reciprocate that respect in addressing your issue, assessing changes, and helping you finalize your pull requests.

There are many ways to contribute, from writing tutorials or blog posts, improving the documentation, submitting bug reports and feature requests or writing code which can be incorporated into JS Recon Buddy itself.

# Ground Rules

* Create issues for any major changes and enhancements that you wish to make. Discuss things transparently and get community feedback.
* Keep feature versions as small as possible, preferably one new feature per version.
* Be welcoming to newcomers and encourage diverse new contributors from all backgrounds.

## Commit Message Guidelines

This project uses [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#summary) to automate the release process and generate the [CHANGELOG.md](CHANGELOG.md) file. Following this format for your commit messages is essential, as it tells our automated system how to bump the version number and categorize your changes.

### The Format

Each commit message must follow this simple structure:

```
<type>: <description>
```

For example: `feat: add a new scanner for session storage`

### Commit Types

You must use one of the following types in your commit message prefix. Here are the most common ones we use:

* **`feat`**: Use this for a **new feature**.
    * *Example*: `feat: add passive rescan button to popup`
    * *Effect*: Triggers a **minor** version release (e.g., 1.2.0 → 1.3.0).

* **`fix`**: Use this for a **bug fix**.
    * *Example*: `fix: prevent crash on pages with no scripts`
    * *Effect*: Triggers a **patch** version release (e.g., 1.2.0 → 1.2.1).

* **`docs`**: For changes to documentation only (like updating this file or the README).
* **`style`**: For code style changes that don't affect logic (formatting, whitespace, etc.).
* **`refactor`**: For code changes that don't add a feature or fix a bug (like improving the structure of a function).
* **`chore`**: For changes to the build process or other maintenance tasks (like updating the GitHub Actions workflow).

### Breaking Changes

A "breaking change" is a change that is not backward-compatible. To mark a commit as a breaking change, add a `!` after the type. This will trigger a **major** version release (e.g., 1.2.0 → 2.0.0).

* *Example*: `refactor!: remove support for legacy cache format`

### Multiline Commits

For changes that are more complex than a single line can describe, you can add an optional **body**. A blank line between the subject and the body is required.

The body can provide more context about the problem and the solution. You can also add a **footer** to reference issue numbers.

**Example:**

```
fix: properly update icon from in-memory cache

The previous logic failed to use the Map correctly, causing a TypeError.
This change uses map.get() to retrieve the cached finding count
and updates the UI instantly upon tab activation.

Closes #27
```

---

At this point, you're ready to make your changes! Feel free to ask for help - everyone is a beginner at first.

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
