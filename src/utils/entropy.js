/**
 * Calculates the Shannon entropy of a string.
 * @param {string} str The string to analyze.
 * @returns {number} The entropy value.
 */
export function shannonEntropy(str) {
	if (!str) {
		return 0;
	}
	const len = str.length;
	const frequencies = {};

	for (const char of str) {
		frequencies[char] = (frequencies[char] || 0) + 1;
	}

	let entropy = 0;
	for (const freq of Object.values(frequencies)) {
		const p = freq / len;
		entropy -= p * Math.log2(p);
	}

	return entropy;
}