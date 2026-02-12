
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
    const validActions = ['click', 'doubleclick', 'rightclick', 'type', 'keypress', 'launch', 'wait', 'scroll', 'open-url'];
    
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
    const actions = [];
    
    // Look for JSON blocks
    const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
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
        console.warn('[ActionParser] Failed to parse JSON block:', e);
      }
    }
    
    return actions;
  }
}
