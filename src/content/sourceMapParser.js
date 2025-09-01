export async function reconstructSource(sourceMapUrl) {
  try {
    const response = await fetch(sourceMapUrl);
    if (!response.ok) throw new Error(`Failed to fetch source map: ${response.status}`);
    const sourceMapData = await response.json();

    const reconstructedSources = {};

    if (sourceMapData.sources && sourceMapData.sourcesContent) {

      sourceMapData.sources.forEach((sourceFile, index) => {
        if (sourceMapData.sourcesContent[index]) {
          reconstructedSources[sourceFile] = sourceMapData.sourcesContent[index];
        } else {
          reconstructedSources[sourceFile] = "// Source content was not embedded in the map.";
        }
      });
      return reconstructedSources;
    } else {
      console.warn(`Source map ${sourceMapUrl} does not contain embedded sourcesContent.`);
      return;
    }

  } catch (error) {
    console.error(`Error parsing source map ${sourceMapUrl}:`, error);
    return;
  }
}