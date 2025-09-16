document.addEventListener('DOMContentLoaded', async () => {
  const codeEl = document.getElementById('content-container');

  const escapeHTML = (str) => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const getLanguageFromSource = (source) => {
    if (source.endsWith('.js')) return 'javascript';
    if (source.endsWith('.css')) return 'css';
    if (source.endsWith('.json')) return 'json';
    if (source.endsWith('.html') || source === 'HTML Document') return 'markup';
    return 'javascript';
  };

  try {
    const storageKey = window.location.hash.substring(1);
    if (!storageKey) {
      codeEl.textContent = "[JS Recon Buddy] Source viewer - storage key not found in the URL.";
      return;
    }

    const storageData = await chrome.storage.local.get(storageKey);
    if (!storageData[storageKey]) {
      codeEl.textContent = "[JS Recon Buddy] Source viewer - content not found in local storage.";
      return;
    }

    chrome.storage.local.remove(storageKey);

    const { content, secret, source } = storageData[storageKey];

    if (content && secret) {
      const language = getLanguageFromSource(source);
      const escapedSecret = escapeHTML(secret);
      const updatedContent = content.replace(
        new RegExp(escapedSecret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        escapedSecret
      );
      codeEl.className = `language-${language}`;
      codeEl.textContent = updatedContent;
      Prism.hooks.add("before-highlight", function (env) {
        env.code = env.element.innerHTML;
      });
      Prism.highlightElement(codeEl, false, function () {
        const xpath = `//text()[contains(., ${JSON.stringify(secret)})]`;
        const result = document.evaluate(xpath, codeEl, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);

        let currentNode = result.iterateNext();
        if (currentNode) {
          const startIndex = currentNode.textContent.indexOf(secret);
          if (startIndex > -1) {
            const range = document.createRange();
            range.setStart(currentNode, startIndex);
            range.setEnd(currentNode, startIndex + secret.length);

            const tempHighlight = document.createElement('span');
            tempHighlight.className = 'highlight';
            range.surroundContents(tempHighlight);

            tempHighlight.scrollIntoView({
              behavior: 'auto',
              block: 'center',
              inline: 'center'
            });
          }
        }
      });



    } else {
      codeEl.textContent = "[JS Recon Buddy] Error: Could not display content.";
    }
  } catch (e) {
    codeEl.textContent = "[JS Recon Buddy] Error: Failed to parse content from URL.";
    console.error("[JS Recon Buddy] Source viewer error:", e);
  }
});