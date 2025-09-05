// Mock implementation of Python tagExtractor for browser preview
export function extractTags(text) {
  // Simple hashtag extraction (mimicking the Python version)
  const tags = text.match(/#(\w+)/g) || [];
  return tags.map(tag => tag.substring(1)); // Remove the # symbol
}

export default { extractTags };
