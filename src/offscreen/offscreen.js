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
    try {
      const { allContentSources, secretRules } = request;
      const deserializedRules = secretRules.map(rule => ({
        ...rule,
        regex: new RegExp(rule.regex.source, rule.regex.flags)
      }));
      const findings = performScan(allContentSources, deserializedRules);
      sendResponse({ status: 'success', data: findings });
    } catch (error) {
      console.warn("[JS Recon Buddy] An error has occured during offscreen scan:", error);
      sendResponse({ status: 'error', message: error.message });
    }
  }
  return true;
});

/**
 * Executes the CPU-intensive secret scanning logic against provided content.
 *
 * This function iterates through each content source and applies every defined
 * secret-finding rule. It uses `matchAll` for efficient regex matching and
 * performs an optional Shannon entropy check to reduce false positives.
 *
 * @param {Array<{source: string, content: string, isTooLarge: boolean}>} allContentSources
 * An array of content objects to scan.
 * @param {Array<object>} secretRules
 * An array of rule objects containing live RegExp objects to match against the content.
 * @returns {Array<{id: string, description: string, secret: string, source: string, isTooLarge: boolean}>}
 * An array of finding objects, each detailing a potential secret that was discovered.
 */
function performScan(allContentSources, secretRules) {
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
  }
  return findings;
}