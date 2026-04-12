import { Button } from '@/components/ui/button';
import { getCerebrasApiKeys, getGeminiApiKeys } from '@/lib/config';
import { cn } from '@/lib/utils';
import { AIRouter } from '@/services/AIRouter';
import { WakeWordService } from '@/services/WakeWordService';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AudioLines,
  Loader2,
  Menu,
  MessageSquare,
  Mic,
  Move,
  Power,
  Send,
  Settings,
  Sparkles
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CONFIG } from '../config';

interface OverlayBarProps {
  onClose?: () => void;
  onToggleMode?: (mode: string) => void;
  onToggleChat?: (active: boolean) => void;
}

const GEMINI_API_KEYS = getGeminiApiKeys();
const CEREBRAS_API_KEYS = getCerebrasApiKeys();
const aiRouter = new AIRouter(GEMINI_API_KEYS, CEREBRAS_API_KEYS);

const OVERLAY_SYSTEM_PROMPT = `You are GemDesk AI, a highly capable desktop assistant.
You operate as an interactive overlay, seeing the user's screen and hearing their voice.

CORE BEHAVIOR:
1. **Interactive Presence**: Provide a helpful, natural response to the user's request.
2. **NO NARRATION**: Do not tell the user what you are "going to do" or how you'll execute unless requested or for security.
3. **Context Awareness**: Remember the previous turn's context.
4. **Action Execution**: When performing an action, include a JSON block.
5. **EXACT ACTION STRINGS**: You MUST use these exact strings for "action": "launch", "open-url", "type", "keypress", "list-dir", "read-file", "save-document", "create-project", "create-folder", "rename-file", "whatsapp-chat", "whatsapp-call", "whatsapp-initiate-call-dropdown", "create-doc", "open-path".
   NEVER use spaces in action names (e.g. use "open-url" not "open url").
   **CRITICAL**: For "whatsapp-chat" and "whatsapp-call", the "contact" field is MANDATORY.
6. **CLICK ACTION**: When using "click", provide coordinates in the "target" field: \`{ "action": "click", "target": { "x": number, "y": number }, "reasoning": "..." }\`. If you need another screenshot immediately after to perform the next step (like clicking a menu item that appears), add \`"needsFollowUp": true\` to your JSON.
7. **CRITICAL JSON RULE**: You MUST wrap your action JSON in triple backticks and ensure it is perfectly valid. Example:
   \`\`\`json
   { "action": "launch", "app": "notepad", "reasoning": "Opening notepad" }
   \`\`\`
   NEVER omit commas or colons.
   Example for WhatsApp Message:
   \`\`\`json
   { "action": "whatsapp-chat", "contact": "John", "message": "Hello!", "reasoning": "Messaging John" }
   \`\`\`

### AUDIO & CLARITY:
0. **Transcription**: If audio is provided, you MUST begin your response with \`TRANSCRIPTION: [What you heard]\`.
1. **Natural Interaction**: Respond directly to what the user said. If the request is unclear, politely ask for clarification.
2. **Don't Spell Names**: If you are unsure of a name or word pronunciation from audio, **do not attempt to spell it out** or guess.
3. **Suggest Typing**: If you encounter a name or feature you can't pronounce or identify perfectly, **suggest that the user types it** instead.
4. **WhatsApp Calling**: When asked to call someone, the "contact" field is MANDATORY. Follow this flow:
   - Step 1: Use the whatsapp-call action with a \`callType\` field (\`"audio"\` or \`"video"\`) based on what the user asked for.
     Example: \`\`\`json
     { "action": "whatsapp-call", "contact": "John", "callType": "audio", "reasoning": "Calling John" }
     \`\`\`
   - Step 2: A screenshot will be provided. VERIFY the contact was successfully found. If so, output \`{ "action": "whatsapp-initiate-call-dropdown", "callType": "..." }\`. Include "app": "WhatsApp".
   - Step 3: Another screenshot showing the call dropdown will be provided. Output a \`click\` action on either "Audio call" or "Video call" based on the user's request. Include "app": "WhatsApp".
   - **CRITICAL**: Do NOT narrate these steps. Just perform the current step silently.
5. **Formatting**: For solutions and explanations, use proper markdown headings (##, ###) and numbered lists. Do NOT use raw **bold** markers — use headings instead. Use minimal vertical spacing (avoid blank lines between list items).
   **DATA RESULTS**: If the user asks to "generate data", "extract info", or "summarize results" in a structured way, use the \`data-result\` action: 
   \`\`\`json
   { "action": "data-result", "content": "MARKKDOWN_CONTENT", "title": "RESULT_TITLE", "reasoning": "..." }
   \`\`\`
   This will display the result in a dedicated solution modal. Use this for ANY data-heavy response.
6. **Opening Folders/Documents**: To open a folder (e.g., Desktop) or a document, use the "open-path" action with the full path or shortcut name (e.g., "Desktop", "Documents").

### APP PREFERENCES:
- **Email**: When asked to "open email", "check mail", or "gmail", use \`"app": "email"\`. We prioritize Chrome browser for email.
- **VS Code**: Use \`"app": "code"\` or \`"app": "vscode"\`.
- **NO NARRATION**: NEVER include your JSON action in conversational text. Just output the block at the end.

Available actions: launch, open-url, type, keypress, click, list-dir, read-file, save-document, create-project, create-folder, rename-file, whatsapp-chat, whatsapp-call, create-doc, open-path, data-result.`;

interface ResponseBubble {
  text: string;
  isError?: boolean;
}

const DEFAULT_SETTINGS = {
  wakeWordEnabled: false,
  visionEnabled: true,
  ttsEnabled: true,
  connectionQuality: 'high',
  adaptiveQuality: true,
  requireApproval: true,
  showNotifications: true,
  displayMode: 'fit',
  showFps: true,
  hardwareAcceleration: true,
};

export default function OverlayBar({ onClose, onToggleMode, onToggleChat }: OverlayBarProps) {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('gemdesk_settings');
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const updateSetting = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('gemdesk_settings', JSON.stringify(newSettings));
  };

  const [isRecording, setIsRecording] = useState(false);
  const [isChatMode, setIsChatMode] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [responseBubble, setResponseBubble] = useState<ResponseBubble | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isVertical, setIsVertical] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [solutionContent, setSolutionContent] = useState('');
  const [solutionTitle, setSolutionTitle] = useState('Result');
  const [isInputMode, setIsInputMode] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [inputRequest, setInputRequest] = useState<{ label: string; description: string } | null>(null);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [pendingAction, setPendingAction] = useState<any>(null);
  const isListeningForWakeWord = settings.wakeWordEnabled;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (window.electron?.setIgnoreMouseEvents) {
      window.electron.setIgnoreMouseEvents(false);
    }
  };

  const handleMouseLeave = () => {
    if (window.electron?.setIgnoreMouseEvents) {
      window.electron.setIgnoreMouseEvents(true, { forward: true });
    }
  };

  // ── Handle Body Background Transparency ────────────────────────────────────
  useEffect(() => {
    // When OverlayBar mounts, make the body transparent
    const originalBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = 'transparent';
    
    // Also ensure the root element is transparent if needed
    const root = document.getElementById('root');
    if (root) root.style.backgroundColor = 'transparent';

    return () => {
      // Revert when unmounting (e.g. if we navigated away, though overlay usually closes window)
      document.body.style.backgroundColor = originalBg;
      if (root) root.style.backgroundColor = '';
    };
  }, []);

  const onWakeWordRef = useRef<(() => void) | null>(null);
  const wakeWordServiceRef = useRef<WakeWordService | null>(null);
  
  useEffect(() => {
    onWakeWordRef.current = () => {
      console.log('[OverlayBar] Wake word "Hi Gemdesk" detected via Ref');
      startRecording();
    };
  }, [isRecording, isChatMode]);

  // ── Wake Word & Services Init ──────────────────────────────────────────────
  useEffect(() => {
    if (!wakeWordServiceRef.current) {
        wakeWordServiceRef.current = new WakeWordService(() => {
          if (onWakeWordRef.current) onWakeWordRef.current();
        });
    }

    if (settings.wakeWordEnabled && !isRecording && !isChatMode) {
      wakeWordServiceRef.current.start();
    } else {
      wakeWordServiceRef.current.stop();
    }

    return () => {
      wakeWordServiceRef.current?.stop();
    };
  }, [settings.wakeWordEnabled, isRecording, isChatMode]);

  // ── Show response bubble, auto-dismiss after 12s ───────────────────────────
  const showBubble = (text: string, isError = false) => {
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    setResponseBubble({ text, isError });
    bubbleTimerRef.current = setTimeout(() => setResponseBubble(null), 12000);
  };

  // ── TTS ────────────────────────────────────────────────────────────────────
  const speak = useCallback((text: string, isAuto = false, isNecessary = false) => {
    return new Promise<void>((resolve) => {
      if (!settings.ttsEnabled || !text) {
        resolve();
        return;
      }

      const words = text.trim().split(/\s+/);
      if (isAuto && words.length > 12) {
        console.log('[OverlayBar] Skipping auto-speak: too long (', words.length, 'words)');
        resolve();
        return;
      }

      if (isAuto && !isNecessary) {
        console.log('[OverlayBar] Skipping auto-speak: not necessary');
        resolve();
        return;
      }

      // Check for code blocks (manual limit still applies in some cases, but auto-TTS definitely skips them)
      const containsCode = text.includes('```');
      if (isAuto && containsCode) {
        console.log('[OverlayBar] Skipping auto-speak: contains code block.');
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.name.includes('Google') || v.name.includes('Premium')) || voices[0];
      if (preferred) utterance.voice = preferred;
      utterance.rate = 1.0;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }, [settings.ttsEnabled]);

  // ── Parse & Execute Action ─────────────────────────────────────────────────
  const maybeExecuteAction = async (text: string) => {
    try {
      // 1. Robust JSON Extraction
      // Try block match first
      let jsonStr = '';
      const blockMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
      
      if (blockMatch) {
        jsonStr = blockMatch[1];
      } else {
        // Fallback: look for raw JSON object
        const rawMatch = text.match(/\{[\s\S]*?"action":[\s\S]*?\}/);
        if (rawMatch) jsonStr = rawMatch[0];
      }

      if (!jsonStr) {
        // Correct state if no action was actually found despite string matches earlier
        // We use a small timeout to ensure the state update from showBubble('Processing...') has processed
        setTimeout(() => {
          setResponseBubble(prev => prev?.text === 'Processing...' ? null : prev);
        }, 100);
        return;
      }

      const json = JSON.parse(jsonStr.trim());
      const actionType = json.action || json.type;
      
      // Handle data-result
      if (actionType === 'data-result') {
        const title = json.title || 'Data Result';
        const content = json.content || json.text || '';
        setSolutionTitle(title);
        setSolutionContent(content);
        setShowSolution(true);
        setIsInputMode(false);
        showBubble(`Generated: ${title}`);
        return;
      }

      // Handle info requests
      if (actionType === 'request-info') {
        setInputRequest({
          label: json.label || 'Information Needed',
          description: json.description || 'Please provide the requested details.'
        });
        setIsInputMode(true);
        setShowSolution(true);
        return;
      }

      if (json) {
        const type = json.action || json.type;
        const normalizedAction = {
          ...json,
          type: type === 'open url' ? 'open-url' : 
                type === 'open WhatsApp' ? 'whatsapp-chat' : type
        };

        const autoExecActions = [
          'launch', 'create-folder', 'whatsapp-chat', 'whatsapp-call', 'whatsapp-initiate-call-dropdown',
          'open-url', 'write-file', 'delete-file', 'save-document', 
          'create-project', 'create-doc', 'delete-file', 'open-path', 'click'
        ];

        if (autoExecActions.includes(normalizedAction.type)) {
          console.log(`[OverlayBar] Auto-executing action: ${normalizedAction.type}`);
          const result = await window.electron.executeAction(normalizedAction);
          
          if (result && result.success) {
            // Only update processing bubble if it's still showing the default message
            if (responseBubble?.text === 'Processing...') {
                showBubble(`Action executed successfully.`);
            }
            
            // Auto-followup for multi-step flows
            if (normalizedAction.type === 'whatsapp-call' && result.screenshot) {
              const callType = normalizedAction.callType || 'audio';
              const base64 = result.screenshot.split(',')[1];
              setTimeout(() => {
                showBubble("Processing...");
                sendToGemini([
                  { text: `This is a screenshot of WhatsApp after searching for ${normalizedAction.contact}. 
1. Check if the contact was successfully found and the chat is open. (Look for "No results found" or similar).
2. If the contact was NOT found, DO NOT initiate a call. Instead, reply to the user that the contact was not found.
3. If the contact IS found and the chat is open, output a JSON action to open the call dropdown: 
{ "action": "whatsapp-initiate-call-dropdown", "callType": "${callType}", "app": "WhatsApp" }
Output ONLY this JSON if the contact is found.` },
                  { inlineData: { data: base64, mimeType: 'image/png' } }
                ]);
              }, 2000);
            } else if (normalizedAction.type === 'whatsapp-initiate-call-dropdown' && result.screenshot) {
              const callType = normalizedAction.callType || 'audio';
              const callLabel = callType === 'video' ? 'Video call' : 'Audio call';
              const base64 = result.screenshot.split(',')[1];
              setTimeout(() => {
                showBubble("Processing...");
                sendToGemini([
                  { text: `The WhatsApp call dropdown is now open. The user requested a ${callType} call.
1. Look at the dropdown menu.
2. Find the option labeled "${callLabel}".
3. Output a "click" action with the exact X and Y coordinates of that option.
Always include "app": "WhatsApp" in your JSON.` },
                  { inlineData: { data: base64, mimeType: 'image/png' } }
                ]);
              }, 2000);
            }
          } else if (result?.error) {
            showBubble(`Action failed: ${result.error}`, true);
          }
        } else {
          setPendingAction(normalizedAction);
          setIsInputMode(false);
        }
      }
    } catch (e) {
      console.error('[OverlayBar] Action parse/exec error:', e);
      // If we showed "Processing..." but parsing failed, clear it
      setTimeout(() => {
        setResponseBubble(prev => prev?.text === 'Processing...' ? null : prev);
      }, 100);
    }
  };

  // ── Send to Gemini ─────────────────────────────────────────────────────────
  const sendToGemini = async (parts: any[]) => {
    setIsLoading(true);
    try {
      // 1. Prepare current history + new user input
      const currentHistory = [...chatHistory];
      const userMessage = { role: 'user', parts };

      // 2. Attach screenshot if vision is enabled (only to the LATEST part)
      if (settings.visionEnabled && window.electron?.captureScreenshot) {
        const screenshot = await window.electron.captureScreenshot();
        if (screenshot) {
          parts.push({
            inlineData: {
              data: screenshot.split(',')[1],
              mimeType: 'image/png',
            },
          });
        }
      }

      // 3. Prepare the payload for Gemini
      const contents = [...currentHistory, userMessage];

      const result = await aiRouter.generateContent({
        model: CONFIG.GEMINI_MODEL,
        config: {
          systemInstruction: {
            parts: [{ text: OVERLAY_SYSTEM_PROMPT }],
          },
        },
        contents,
      });

      const responseText =
        result.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";

      // 4. Update Chat History (keep last 12 items for context window management)
      const assistantMessage = { role: 'model', parts: [{ text: responseText }] };
      const updatedHistory = [...contents, assistantMessage].slice(-12);
      setChatHistory(updatedHistory);

      // Extract dynamic title if present
      const titleMatch = responseText.match(/TITLE:\s*(.*)/);
      if (titleMatch) {
        setSolutionTitle(titleMatch[1].trim());
      } else {
        setSolutionTitle('Solution / Code');
      }

      // Strip internal action JSON blocks and TITLE from display, but keep data JSON
      const cleanText = responseText
        .replace(/TITLE:.*\n?/g, '')
        .replace(/TRANSCRIPTION:.*\n?/g, '')
        .replace(/```json\s*[\s\S]*?```/gi, '') // Strip ALL JSON blocks
        .replace(/\{[\s\S]*?["']action["'][\s\S]*?\}/gi, '') // Strip raw JSON objects with "action" matching
        .replace(/```/g, '') // Clean up any stray backticks leftover
        .trim();

      // 5. Detect code blocks for Solution Modal (ignore JSON actions)
      const hasAction = responseText.includes('"action":') || responseText.includes('"type":');
      const codeMatches = responseText.match(/```(?!(?:json|JSON))[\s\S]*?```/g);
      
      // Implement the 15-word threshold for solution modal
      const wordCount = cleanText.trim().split(/\s+/).length;
      const isLargeResponse = (wordCount > 15 || codeMatches) && !hasAction;

      if (isLargeResponse) {
        // Show cleanText in the modal; if code blocks exist, append them
        setSolutionContent(codeMatches ? cleanText + '\n\n' + codeMatches.join('\n\n') : cleanText);
        setShowSolution(true);
        setIsInputMode(false);
        showBubble("Check the detailed response in the panel.");
      } else if (cleanText) {
        showBubble(cleanText);
      } else if (hasAction) {
        showBubble('Processing...');
      }
      
      // Decouple Action Execution from Speech and Modal
      // 1. Kick off action execution immediately (robust parsing will handle cleanup if it's not actually an action)
      maybeExecuteAction(responseText);

      // 2. Speak then check for clarification (async)
      const isNecessary = updatedHistory[updatedHistory.length - 2].parts.some((p: any) => p.inlineData && p.inlineData.mimeType.startsWith('audio')) || cleanText.includes('?') || hasAction;
      speak(cleanText, true, isNecessary).then(() => {
        // Automatic recording if it's a clarification (contains ?)
        if (cleanText.includes('?') && !isChatMode) {
          console.log('[OverlayBar] Clarification detected, auto-starting recording...');
          startRecording();
        }
      });
    } catch (err: any) {
      console.error('[OverlayBar] Gemini error:', err);
      const errorMsg = err?.message?.includes('429')
        ? 'API quota exceeded. Try again shortly.'
        : 'Error: ' + (err?.message || 'Unknown error');
      showBubble(errorMsg, true);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Recording ──────────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (isRecording) return;
    try {
      console.log('[Voice] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      console.log('[Voice] Recording started.');
      setIsRecording(true);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`[Voice] Received data chunk: ${event.data.size} bytes`);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[Voice] Recording stopped. Finalizing blob...');
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        if (blob.size < 500) {
          console.warn('[Voice] Recording too small, ignoring.', blob.size);
          setIsRecording(false);
          return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
          console.log('[Voice] Sending audio to Gemini...');
          const base64 = (reader.result as string).split(',')[1];
          await sendToGemini([
            { inlineData: { data: base64, mimeType: 'audio/webm' } },
          ]);
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start(1000); // Collect data every 1s (Improved reliability)
    } catch (err) {
      console.error('[Voice] Error starting recording:', err);
      showBubble('Microphone access denied.', true);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  // ── Chat send ──────────────────────────────────────────────────────────────
  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || isLoading) return;
    setChatInput('');
    await sendToGemini([{ text }]);
  };

  const toggleOrientation = () => {
    const next = !isVertical;
    setIsVertical(next);
    // Request window resize from electron if needed
    if (window.electron?.resizeOverlay) {
      window.electron.resizeOverlay(next ? 120 : 820, next ? 650 : 180);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showBubble('Copied to clipboard!');
  };

  const handleInputSubmit = async () => {
    if (!inputValue.trim()) return;
    const info = inputValue;
    setInputValue('');
    setShowSolution(false);
    setIsInputMode(false);
    setInputRequest(null);
    await sendToGemini([{ text: `User provided info: ${info}` }]);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="fixed inset-0 pointer-events-none flex flex-col items-center justify-end pb-8">
      {/* Main Bar Container */}
      <motion.div
        layout
        drag
        dragMomentum={false}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="flex flex-col items-center gap-3 pointer-events-auto relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Wake Word indicator - Now relative to the bar */}
        <div className="absolute bottom-full mb-8 left-1/2 -translate-x-1/2 pointer-events-none w-max">
          <AnimatePresence>
            {isListeningForWakeWord && !isRecording && !isChatMode && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                className="px-4 py-1.5 bg-indigo-500/20 backdrop-blur-md border border-indigo-500/30 rounded-full flex items-center gap-2"
              >
                <AudioLines className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">
                  Say "Hi Gemdesk"
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* AI Response Bubble - Now relative to the bar */}
        <div className="absolute bottom-full mb-16 left-1/2 -translate-x-1/2 pointer-events-none flex justify-center w-[90vw] max-w-[600px] px-4">
          <AnimatePresence>
            {responseBubble && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className={cn(
                  "px-6 py-4 rounded-[2rem] backdrop-blur-2xl border text-sm text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] pointer-events-auto w-full",
                  responseBubble.isError
                    ? "bg-red-500/20 border-red-500/30"
                    : "bg-black/80 border-white/10"
                )}
                onClick={() => setResponseBubble(null)}
              >
                {responseBubble.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className={cn(
          "flex items-center gap-2 bg-black/50 border border-white/10 p-2 rounded-full shadow-2xl transition-all duration-300",
          isVertical && "flex-col py-3 px-1.5 h-auto min-h-[400px] max-h-[85vh] rounded-[2.5rem] justify-between"
        )}>
        {/* Expandable Chat Input */}
        <AnimatePresence mode="wait">
          {isChatMode && (
            <motion.div
              initial={{ width: 0, height: 0, opacity: 0 }}
              animate={{ 
                width: isVertical ? '100%' : 320, 
                height: isVertical ? 'auto' : 'auto',
                opacity: 1 
              }}
              exit={{ width: 0, height: 0, opacity: 0 }}
              className="overflow-hidden flex items-center px-2"
              style={{ WebkitAppRegion: 'no-drag' } as any}
            >
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask Gemdesk..."
                className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 placeholder:text-white/30"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleChatSend();
                }}
                autoFocus
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Primary Action Button */}
        <motion.div layout whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={isChatMode ? handleChatSend : toggleRecording}
            disabled={isLoading}
            className={cn(
              "rounded-full w-12 h-12 shadow-lg transition-all duration-300",
              isLoading
                ? "bg-indigo-500/50 cursor-wait"
                : isRecording
                ? "bg-red-500 hover:bg-red-600 animate-pulse"
                : "bg-indigo-600 hover:bg-indigo-700"
            )}
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : isChatMode ? (
              <Send className="w-5 h-5 text-white" />
            ) : (
              <Mic className="w-5 h-5 text-white" />
            )}
          </Button>
        </motion.div>

        <div className={cn("flex items-center gap-1.5", isVertical && "flex-col pb-1")}>
          {/* Toggle Chat / Voice Mode */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const next = !isChatMode;
              setIsChatMode(next);
              onToggleChat?.(next);
              if (next) setTimeout(() => chatInputRef.current?.focus(), 300);
            }}
            className={cn(
              "rounded-full w-9 h-9 text-white hover:bg-white/10 p-0",
              isChatMode && "bg-indigo-500/20 text-indigo-400"
            )}
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            {isChatMode ? <Mic className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleOrientation}
            title={isVertical ? "Horizontal View" : "Vertical View"}
            className="rounded-full w-9 h-9 text-white hover:bg-white/10 p-0"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            <Menu className={cn("w-4 h-4 transition-transform", isVertical && "rotate-90")} />
          </Button>

          {/* Draggable Handle */}
          <div
            className="group cursor-move flex items-center justify-center w-9 h-9 bg-indigo-500/20 hover:bg-indigo-500/40 rounded-full transition-colors"
          >
            <Move className="w-4 h-4 text-white/50" />
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (window.electron?.switchToDesktop) {
                window.electron.switchToDesktop();
              } else {
                onToggleMode?.('desktop');
              }
            }}
            title="Desktop Mode"
            className="rounded-full w-9 h-9 text-white hover:bg-white/10 p-0"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            <Sparkles className="w-4 h-4 text-indigo-300" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(true)}
            title="Settings"
            className="rounded-full w-9 h-9 text-white hover:bg-white/10 p-0"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            <Settings className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (window.electron?.closeOverlay) {
                window.electron.closeOverlay();
              } else {
                onClose?.();
              }
            }}
            title="Close"
            className="rounded-full w-9 h-9 bg-red-500/10 hover:bg-red-500/30 text-red-500 transition-all p-0"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            <Power className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
    </div>
      {/* ── Settings Modal - Positioned in the right corner ────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <div 
            className="fixed inset-0 z-[100] pointer-events-none"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Panel */}
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-8 bottom-24 z-10 w-full max-w-md bg-[#111]/95 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden pointer-events-auto mb-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <Settings className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h3 className="font-semibold text-base text-white">Overlay Settings</h3>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 text-white/40 hover:text-white transition-all text-xl"
                >✕</button>
              </div>

              {/* Settings Body */}
              <div className="p-6 flex flex-col gap-5 max-h-[70vh] overflow-y-auto custom-scrollbar">

                {/* Wake Word */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Wake Word Detection</p>
                    <p className="text-xs text-white/40 mt-0.5">Listen for "Hi Gemdesk" to activate</p>
                  </div>
                  <button
                    onClick={() => updateSetting('wakeWordEnabled', !settings.wakeWordEnabled)}
                    className={`relative w-11 h-6 rounded-full transition-colors flex items-center ${
                      settings.wakeWordEnabled ? 'bg-indigo-500' : 'bg-white/10'
                    }`}
                  >
                    <span className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      settings.wakeWordEnabled ? 'translate-x-5' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {/* Vision Default */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Vision (Screen Context)</p>
                    <p className="text-xs text-white/40 mt-0.5">Send screenshot with each request</p>
                  </div>
                  <button
                    onClick={() => updateSetting('visionEnabled', !settings.visionEnabled)}
                    className={`relative w-11 h-6 rounded-full transition-colors flex items-center ${
                      settings.visionEnabled ? 'bg-indigo-500' : 'bg-white/10'
                    }`}
                  >
                    <span className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      settings.visionEnabled ? 'translate-x-5' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {/* TTS Mute */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">AI Voice (TTS)</p>
                    <p className="text-xs text-white/40 mt-0.5">Speak AI responses aloud</p>
                  </div>
                  <button
                    onClick={() => { updateSetting('ttsEnabled', !settings.ttsEnabled); if (settings.ttsEnabled) window.speechSynthesis.cancel(); }}
                    className={`relative w-11 h-6 rounded-full transition-colors flex items-center ${
                      settings.ttsEnabled ? 'bg-indigo-500' : 'bg-white/10'
                    }`}
                  >
                    <span className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      settings.ttsEnabled ? 'translate-x-5' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                <hr className="border-white/5" />

                {/* Model info */}
                <div className="flex items-center justify-between text-xs">
                  {/* comment out this for now */}
                  {/* <span className="text-white/40">AI Model</span> */}
                  {/* <span className="text-indigo-400 font-mono">{CONFIG.GEMINI_MODEL}</span> */}
                </div>

                {/* Hotkey info */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Global Hotkey</span>
                  <span className="text-white/60 font-mono">Ctrl + G</span>
                </div>

                <hr className="border-white/5" />

                {/* Quick actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { window.electron?.switchToDesktop?.(); setShowSettings(false); }}
                    className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/70 transition-colors"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    Switch to Desktop
                  </button>
                  <button
                    onClick={() => { window.electron?.closeOverlay?.(); setShowSettings(false); }}
                    className="flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-xs text-red-400 transition-colors"
                  >
                    <Power className="w-4 h-4" />
                    Close Overlay
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Solution & Input Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showSolution && (
          <div 
            className="fixed inset-0 z-[100] pointer-events-none"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <motion.div
              initial={{ x: -400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -400, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute left-8 bottom-24 z-10 w-[650px] max-h-[65vh] bg-[#0E0E0E]/95 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden pointer-events-auto flex flex-col mb-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    {isInputMode ? <MessageSquare className="w-4 h-4 text-indigo-400" /> : <Sparkles className="w-4 h-4 text-indigo-400" />}
                  </div>
                  <h3 className="font-semibold text-base text-white">
                    {isInputMode ? (inputRequest?.label || 'Information Needed') : solutionTitle}
                  </h3>
                </div>
                <button
                  onClick={() => setShowSolution(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 text-white/40 hover:text-white transition-all text-xl"
                >✕</button>
              </div>

              {/* Body */}
              <div className="p-6 flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
                {isInputMode ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-white">{inputRequest?.label}</p>
                      <p className="text-xs text-white/40">{inputRequest?.description}</p>
                    </div>
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Type here..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                      onKeyDown={(e) => e.key === 'Enter' && handleInputSubmit()}
                      autoFocus
                    />
                    <Button 
                      onClick={handleInputSubmit}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl"
                    >
                      Submit
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="bg-black/40 rounded-xl p-4 flex-1 overflow-y-auto custom-scrollbar">
                      <div className="prose prose-invert prose-sm max-w-none leading-relaxed [&>p]:mb-1 [&>ol]:mb-1.5 [&>ul]:mb-1.5 [&>h1]:mb-1 [&>h2]:mb-1 [&>h3]:mb-1">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {solutionContent}
                        </ReactMarkdown>
                      </div>
                    </div>
                    <Button 
                      onClick={() => copyToClipboard(solutionContent)}
                      className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl gap-2"
                    >
                      Copy Content
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
