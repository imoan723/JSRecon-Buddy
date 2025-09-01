export async function reconstructSource(sourceMapUrl) {
  try {
    const response = await fetch(sourceMapUrl);
    if (!response.ok) throw new Error(`Failed to fetch source map ${sourceMapUrl}: ${response.status}`);
    const sourceMapData = await response.json();

    const reconstructedSources = {};

    if (!sourceMapData.sources) {
      throw new Error(`Source map ${sourceMapUrl} does not contain a 'sources' array.`);
    }

    for (const [index, sourceFile] of sourceMapData.sources.entries()) {
      const embeddedContent = sourceMapData.sourcesContent?.[index];
      if (embeddedContent) {
        reconstructedSources[sourceFile] = embeddedContent;
        continue;
      }

      try {
        const sourceUrl = new URL(sourceFile, sourceMapUrl).href;
        const sourceResponse = await fetch(sourceUrl);

        if (!sourceResponse.ok) {
          console.warn(`Skipping missing source file: ${sourceUrl} (Status: ${sourceResponse.status})`);
          continue;
        }

        reconstructedSources[sourceFile] = await sourceResponse.text();
      } catch (fetchError) {
        console.warn(`Skipping source file due to network error: ${fetchError.message}`);
        continue;
      }
    }

    return reconstructedSources;

  } catch (error) {
    console.info(`Error parsing source map ${sourceMapUrl}:`, error);
    return { "jsrecon.buddy.error.log": error.toString() };
  }
}