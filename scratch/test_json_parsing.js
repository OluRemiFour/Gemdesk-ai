
function extractJsonRobust(text) {
  // 1. Try traditional block match
  const blockMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (blockMatch) return blockMatch[1];

  // 2. Try to find anything that looks like a JSON object { ... }
  // We look for { "action": ... } or { "type": ... }
  // This is more aggressive and can fail if there are other {} in text, but good for AI responses.
  const jsonRegex = /\{[\s\S]*?"action":[\s\S]*?\}/g;
  const matches = text.match(jsonRegex);
  if (matches) {
    // Return the one that is most likely valid JSON
    for (const match of matches) {
      try {
        JSON.parse(match);
        return match;
      } catch (e) {}
    }
  }

  return null;
}

const tests = [
  'Here is the action: ```json\n{"action": "launch", "app": "vscode"}\n```',
  'I will open vscode for you. {"action": "launch", "app": "vscode"}',
  'Sure! \n{"action": "launch", "app": "vscode"}\n hope that helps.',
  '{"action": "type", "text": "Hello"} and then click { "action": "click", "target": {"x": 10, "y": 20}}'
];

tests.forEach(t => {
  console.log("Input:", t);
  console.log("Result:", extractJsonRobust(t));
  console.log("---");
});
