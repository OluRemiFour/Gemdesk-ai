
/**
 * Parses natural language or JSON actions from AI into structured executable commands
 */
export class ActionParser {
  /**
   * Validates and normalizes an action object
   * @param {any} rawAction The action object from AI
   * @returns {object|null} The validated action or null if invalid
   */
  static parse(rawAction) {
    if (!rawAction || typeof rawAction !== 'object') return null;
    
    // Normalize action type
    const actionType = rawAction.action?.toLowerCase();
    const validActions = [
      'click', 'doubleclick', 'rightclick', 'type', 'keypress', 'launch', 'wait', 'scroll', 'open-url',
      'list-dir', 'read-file', 'write-file', 'delete-file', 'move-file', 'rename-file', 'create-folder',
      'create-doc', 'save-document', 'create-project', 'whatsapp-chat', 'whatsapp-call', 'whatsapp-initiate-call-dropdown',
      'create-browser', 'navigate-browser', 'capture-browser', 'close-browser', 'eval-browser'
    ];
    
    if (!validActions.includes(actionType)) {
      console.warn(`[ActionParser] Invalid action type: ${actionType}`);
      return null;
    }

    const normalized = {
      action: actionType,
      reasoning: rawAction.reasoning || 'No reasoning provided',
      confidence: parseFloat(rawAction.confidence) || 0.5,
      ...rawAction // Spread other props
    };

    // Validation per type
    switch (actionType) {
      case 'click':
      case 'doubleclick':
      case 'rightclick':
        if (!normalized.target) return null;
        // If target is {x,y}, keep it. If it's a string description, it needs vision processing (handled elsewhere)
        break;
        
      case 'type':
        if (!normalized.text) return null;
        break;
        
      case 'keypress':
        if (!normalized.key) return null;
        break;
        
      case 'launch':
        if (!normalized.app && !normalized.target) return null;
        normalized.app = normalized.app || normalized.target;
        break;

      case 'open-url':
        if (!normalized.url && !normalized.target) return null;
        let urlValue = (normalized.url || normalized.target).trim();
        const commonApps = ['chrome', 'google chrome', 'firefox', 'edge', 'msedge', 'microsoft edge', 'brave', 'opera', 'safari', 'whatsapp', 'vscode', 'visual studio code', 'notepad', 'word', 'excel', 'powerpoint', 'winword', 'excel.exe'];
        
        if (commonApps.includes(urlValue.toLowerCase())) {
          console.log(`[ActionParser] Auto-correcting "open-url" to "launch" for app: ${urlValue}`);
          normalized.action = 'launch';
          normalized.app = urlValue;
        } else {
          normalized.url = urlValue;
        }
        break;

      case 'create-folder':
        if (!normalized.path && !normalized.target && !normalized.name && !normalized.folderName) return null;
        const bDir = (normalized.path || normalized.target || '').trim();
        const fName = (normalized.name || normalized.folderName || '').trim();
        
        if (bDir && fName && !bDir.toLowerCase().includes(fName.toLowerCase())) {
          // Join path and name if they are both present and name isn't already in path
          normalized.path = bDir.endsWith('/') || bDir.endsWith('\\') ? `${bDir}${fName}` : `${bDir}/${fName}`;
        } else {
          normalized.path = bDir || fName;
        }
        break;

      case 'list-dir':
      case 'read-file':
      case 'delete-file':
        if (!normalized.path && !normalized.target) return null;
        normalized.path = normalized.path || normalized.target;
        break;
      
      case 'write-file':
        if ((!normalized.path && !normalized.target) || normalized.content === undefined) return null;
        normalized.path = normalized.path || normalized.target;
        break;

      case 'create-doc':
      case 'save-document':
        if (!normalized.filename && !normalized.target && !normalized.name) return null;
        normalized.filename = normalized.filename || normalized.target || normalized.name;
        // Check for directory preference
        const dirPref = normalized.directory || normalized.path || normalized.folder;
        if (dirPref) normalized.directory = dirPref;
        break;
      
      case 'whatsapp-chat':
      case 'whatsapp-call':
        if (!normalized.contact && !normalized.target && !normalized.name) return null;
        normalized.contact = normalized.contact || normalized.target || normalized.name;
        break;

      case 'create-browser':
      case 'navigate-browser':
        if (!normalized.url && !normalized.target) return null;
        normalized.url = normalized.url || normalized.target;
        break;
    }


    return normalized;
  }
  
  /**
   * Extracts action JSON from a markdown string
   * @param {string} text The full AI response text
   * @returns {object[]} Array of found action objects
   */
  static extractActionsFromText(text) {
    if (!text) return [];
    const actions = [];
    
    // 1. First, look for standard JSON blocks
    const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/gi;
    let match;
    
    while ((match = jsonBlockRegex.exec(text)) !== null) {
      try {
        const content = match[1];
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          parsed.forEach(item => {
            const valid = ActionParser.parse(item);
            if (valid) actions.push(valid);
          });
        } else {
          const valid = ActionParser.parse(parsed);
          if (valid) actions.push(valid);
        }
      } catch (e) {
        console.warn('[ActionParser] Failed to parse JSON block:', e.message);
      }
    }

    // 2. Fallback: If no actions found in blocks, try to find raw JSON objects
    // Look for objects containing "action" or "type" keys
    if (actions.length === 0) {
      // Look for something that looks like a JSON object containing an action key
      const rawJsonRegex = /\{[\s\S]*?["'](?:action|type)["'][\s\S]*?\}/g;
      const rawMatches = text.match(rawJsonRegex);
      
      if (rawMatches) {
        rawMatches.forEach(rawMatch => {
          try {
            const parsed = JSON.parse(rawMatch.trim());
            const valid = ActionParser.parse(parsed);
            if (valid) actions.push(valid);
          } catch (e) {
            // Ignore failed raw attempts
          }
        });
      }
    }
    
    return actions;
  }
}
