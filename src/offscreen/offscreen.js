import { shannonEntropy } from '../utils/entropy.js';

/**
 * Listens for and routes incoming messages from the service worker.
 *
 * This is the main entry point for the offscreen document. It handles two types
 * of requests:
 * - 'ping': A simple readiness check to confirm the document is active and
 * responsive before receiving a larger payload.
 * - 'scanContent': The main task. It deserializes the provided RegExp rules,
 * passes the data to the `performScan` function for processing, and returns
 * the results or any errors that occur.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ping') {
    sendResponse({ status: 'ready' });
    return true;
  } else if (request.type === 'scanContent') {
    (async () => {
      try {
        const { allContentSources, secretRules } = request;
        const deserializedRules = secretRules.map(rule => ({
          ...rule,
          regex: new RegExp(rule.regex.source, rule.regex.flags)
        }));
        const findings = await performScan(allContentSources, deserializedRules);
        sendResponse({ status: 'success', data: findings });
      } catch (error) {
        console.warn("[JS Recon Buddy] An error has occured during offscreen scan:", error);
        sendResponse({ status: 'error', message: error.message });
      }
    })();
    return true;
  }
});

/**
 * Executes the CPU-intensive secret scanning logic asynchronously.
 *
 * This function processes each content source and then yields control back to
 * the event loop. This prevents it from blocking the thread for too long,
 * allowing the extension to remain responsive to other events.
 *
 * @param {Array<{source: string, content: string, isTooLarge: boolean}>} allContentSources
 * An array of content objects to scan.
 * @param {Array<object>} secretRules
 * An array of rule objects containing live RegExp objects to match against the content.
 * @returns {Promise<Array<object>>}
 * A promise that resolves with an array of finding objects.
 */
async function performScan(allContentSources, secretRules) {
  const findings = [];
  for (const { source, content, isTooLarge } of allContentSources) {
    for (const rule of secretRules) {
      const matches = content.matchAll(rule.regex);
      for (const match of matches) {
        const secret = match[rule.group || 0];

        if (rule.entropy && shannonEntropy(secret) < rule.entropy) {
          continue;
        }

        findings.push({
          id: rule.id,
          description: rule.description,
          secret: secret,
          source: source,
          isSourceTooLarge: isTooLarge
        });
      }
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return findings;
}
