import { Chat, ChatService } from '@/services/ChatService';
import {
  ArrowLeft,
  FolderPlus,
  Globe,
  Image as ImageIcon,
  Keyboard,
  Loader2,
  Menu,
  MessageSquare,
  Mic,
  Monitor,
  MousePointer2,
  Play,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Zap
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import SkillLibrary from './SkillLibrary';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCerebrasApiKeys, getGeminiApiKeys } from '@/lib/config';
import { AIRouter } from '@/services/AIRouter';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import VoiceVisualizer from './VoiceVisualizer';
import { CONFIG } from '../config';

interface AIWorkspaceProps {
  onBack: () => void;
  autoStartRecording?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachment?: string;
  audioUrl?: string;
  transcription?: string;
  language?: string;
}

interface Action {
  type: string;
  target?: string;
  text?: string;
  key?: string;
  app?: string;
  url?: string;
  content?: string;
  filename?: string;
  path?: string;
  oldPath?: string;
  newPath?: string;
  days?: number;
  contact?: string;
  message?: string;
  callType?: 'audio' | 'video';
  reasoning: string;
  confidence: number;
  originalJson?: any;
  background?: boolean;
  silent?: boolean;
}

const GEMINI_API_KEYS = getGeminiApiKeys();
const CEREBRAS_API_KEYS = getCerebrasApiKeys();
const aiRouter = new AIRouter(GEMINI_API_KEYS, CEREBRAS_API_KEYS);

const VoiceMessagePlayer = ({ audioUrl }: { audioUrl: string }) => {
  return (
    <div className="mt-2 p-2 bg-white/5 rounded-lg border border-white/10 flex items-center gap-3">
      <audio controls src={audioUrl} className="h-8 max-w-[200px]" />
    </div>
  );
};

const SYSTEM_PROMPT = `
You are GemDesk AI, a powerful, context-aware computer control agent running on Windows.
Your goal is to assist the user by "seeing" their screen and performing actions on their behalf.

### OPERATIONAL PRINCIPLES:
1. **Interactive Feedback**: Use informative status words like "Processing...", "Working on it...", "Checking...", or "Okay". **Avoid using ONLY "Done"** unless the task is completely finished.
2. **NO NARRATION**: NEVER tell the user "Here is the action I will take" or "I'm going to...". Just execute.
3. **Execution Only**: Do not explain how you'll execute a task unless it's a security-sensitive operation or requires high-level permission.
4. **Background Operations**: When opening apps, folders, or URLs, use "background": true unless the user wants to interact immediately.
5. **Windows Paths**: Always use double-backslashes in JSON (e.g., "C:\\\\Users\\\\ADMIN\\\\Desktop").
6. **EXACT ACTION STRINGS**: You MUST use these exact strings for "action": "launch", "open-url", "type", "keypress", "click", "list-dir", "read-file", "save-document", "create-project", "create-folder", "rename-file", "whatsapp-chat", "whatsapp-call", "create-doc", "open-path".
   NEVER use spaces in action names (e.g. use "open-url" not "open url").
7. **CLICK ACTION**: When using "click", provide coordinates in the "target" field: \`{ "action": "click", "target": { "x": number, "y": number }, "reasoning": "..." }\`.
8. **CRITICAL JSON RULE**: You MUST wrap your action JSON in triple backticks and ensure it is perfectly valid. Example:
   \`\`\`json
   { "action": "open-url", "url": "https://google.com", "reasoning": "Opening Google as requested" }
   \`\`\`
   NEVER omit commas or colons.

### AUDIO & CLARITY:
0. **Transcription**: If audio is provided, you MUST begin your response with \`TRANSCRIPTION: [What you heard]\`.
1. **Unclear Audio**: If the audio is too noisy or the user's request is unintelligible, DO NOT guess. Instead, politely ask: "I'm sorry, I didn't catch that. Could you please re-record or type your request?"
2. **Don't Spell Names**: If you are unsure of a name or word pronunciation from audio, **do not attempt to spell it out** or guess.
3. **Suggest Typing**: If you encounter a name or feature you can't pronounce or identify perfectly, **suggest that the user types it** instead.
4. **WhatsApp Calling**: When asked to call someone, follow this flow:
   - Step 1: Use the whatsapp-call action with a \`callType\` field (\`"audio"\` or \`"video"\`) based on what the user asked for.
     Example: \`\`\`json
     { "action": "whatsapp-call", "contact": "John", "callType": "audio", "reasoning": "Calling John" }
     \`\`\`
   - Step 2: Once the chat is open, a screenshot is captured. In the next vision turn find the **video/camera icon** in the top-right of the chat header (it has a small dropdown arrow).
     Click it and YOU MUST add \`"needsFollowUp": true\` to your JSON.
   - Step 3: Wait for the next screenshot showing the sub-menu. If \`callType\` is \`"audio"\`, click **"Audio call"** (phone icon). If \`callType\` is \`"video"\`, click **"Video call"** (video camera).*.
   - **CRITICAL**: Do NOT narrate these steps. Just perform the current step silently.
5. **Formatting**: For solutions and explanations, use proper markdown headings (##, ###) and numbered lists. Do NOT use raw **bold** markers — use headings instead. Use minimal vertical spacing (avoid blank lines between list items or paragraphs).
6. **Opening Folders/Documents**: To open a folder (e.g., Desktop) or a document, use the "open-path" action with the full path or shortcut name (e.g., "Desktop", "Documents").
   - If a file is on the Desktop, use the "Desktop" shortcut prefix (e.g., "Desktop\\\\myfile.pdf") or full absolute path.
   - For PDFs, spreadsheets, or text files, "open-path" will open them in their default application.
`;

export default function AIWorkspace({ onBack, autoStartRecording }: AIWorkspaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm GemDesk AI. I can control your computer, open apps, manage files, navigate WhatsApp, and more. Enable \"Share Screen with AI\" to let me see your screen.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [shareScreen, setShareScreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [actionStatus, setActionStatus] = useState<'idle' | 'executing' | 'success' | 'error'>('idle');
  const [deviceName, setDeviceName] = useState('Developer');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const [draftedDocument, setDraftedDocument] = useState<{ content: string; filename: string } | null>(null);
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const audioMimeTypeRef = useRef<string>('audio/webm');

  useEffect(() => {
    if (autoStartRecording && !isRecording) {
      startRecording();
    }
  }, [autoStartRecording]);

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    const history = await ChatService.getChats();
    setChats(history);
  };

  const createNewChat = async () => {
    const newChat = await ChatService.createChat();
    if (newChat) {
        setCurrentChatId(newChat._id);
        setMessages([{
            id: '1', role: 'assistant',
            content: "Hello! I'm GemDesk AI. I'm ready to help.",
            timestamp: new Date()
        }]);
        loadChats();
        setShowHistory(false);
    }
  };

  const loadChatSession = async (chatId: string) => {
    const loadedMessages = await ChatService.getMessages(chatId);
    const uiMessages: Message[] = loadedMessages.map((msg: any) => ({
        id: msg.id, role: msg.role, content: msg.content,
        timestamp: new Date(msg.created_at),
        transcription: msg.transcription, language: msg.language,
    }));
    if (uiMessages.length === 0) {
        setMessages([{ id: '1', role: 'assistant', content: "Hello! Resuming chat...", timestamp: new Date() }]);
    } else {
        setMessages(uiMessages);
    }
    setCurrentChatId(chatId);
    setShowHistory(false);
  };

  const deleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    await ChatService.deleteChat(chatId);
    loadChats();
    if (currentChatId === chatId) {
        setCurrentChatId(null);
        setMessages([]);
    }
  };

  useEffect(() => {
    const fetchDeviceInfo = async () => {
      if (window.electron?.getDeviceInfo) {
        try {
          const info = await window.electron.getDeviceInfo();
          setDeviceName(info.hostname || info.username || 'Developer');
        } catch (e) {}
      }
    };
    fetchDeviceInfo();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingAction]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const startSession = async () => {
      if (shareScreen && window.electron?.startMonitoring) {
        await window.electron.startMonitoring();
        window.electron.onScreenUpdate((data: any) => {
          console.log('Screen updated:', data.timestamp);
        });
        cleanup = () => { if (window.electron?.stopMonitoring) window.electron.stopMonitoring(); };
      }
    };
    if (shareScreen) startSession();
    else if (window.electron?.stopMonitoring) window.electron.stopMonitoring();
    return () => { cleanup?.(); };
  }, [shareScreen]);

  const parseActions = (text: string): Action | null => {
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const json = JSON.parse(jsonMatch[1]);
        const type = json.action || json.type;
        const action: Action = {
            type: type,
            target: json.target,
            text: json.text,
            key: json.key,
            app: json.app || (type === 'launch' ? (typeof json.target === 'string' ? json.target : json.name) : undefined),
            url: json.url || (type === 'open-url' ? (typeof json.target === 'string' ? json.target : undefined) : undefined),
            content: json.content,
            filename: json.filename,
            path: json.path,
            oldPath: json.oldPath,
            newPath: json.newPath,
            days: json.days,
            contact: json.contact,
            message: json.message,
            reasoning: json.reasoning || 'Executing action...',
            confidence: json.confidence || 0.8,
            originalJson: json
        };
        return action;
      }
    } catch (e) {
      console.error("Failed to parse action JSON", e);
    }
    return null;
  };

  const startRecording = async () => {
    try {
      console.log('[Voice] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
      audioMimeTypeRef.current = mimeType;
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`[Voice] Received data chunk: ${event.data.size} bytes`);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('[Voice] Recording stopped. Finalizing blob...');
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        
        if (blob.size < 500) {
           console.warn('[Voice] Recording too small, ignoring.', blob.size);
           setAudioBlob(null);
           setMicStream(null);
           return;
        }

        setAudioBlob(blob);
        setMicStream(null);
        setTimeout(() => handleSendMessage(undefined, blob), 300);
      };

      mediaRecorder.start(1000); // 1s chunks
      setIsRecording(true);
      console.log('[Voice] Recording started.');
    } catch (err) {
      console.error("[Voice] Failed to start recording:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setMicStream(null);
    }
  };

  const speak = useCallback((text: string, lang?: string) => {
    if (isMuted || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (lang) utterance.lang = lang;
    const voices = window.speechSynthesis.getVoices();
    let preferredVoice = null;
    if (lang) preferredVoice = voices.find(v => v.lang.startsWith(lang.split('-')[0]));
    if (!preferredVoice) preferredVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Premium')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [isMuted]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const handleSendMessage = async (e?: React.FormEvent, overrideAudio?: Blob, overrideParts?: any[]) => {
    if (e) e.preventDefault();
    
    // If overrideParts provided, send directly to Gemini (used for vision loops)
    if (overrideParts) {
      setIsLoading(true);
      try {
        const history = messages.slice(-10).map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));

        const result = await aiRouter.generateContent({
          model: CONFIG.GEMINI_MODEL,
          config: { systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] } },
          contents: [...history, { role: "user", parts: overrideParts }]
        });
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";
        const cleanContent = text.replace(/```json[\s\S]*?```/g, '').trim();
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: 'assistant',
          content: cleanContent || text,
          timestamp: new Date()
        }]);
        const action = parseActions(text);
        if (action) { setPendingAction(action); setTimeout(() => executeAction(action), 500); }
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const currentAudio = overrideAudio || audioBlob;
    if (!input.trim() && !shareScreen && !attachedImage && !currentAudio) return;

    // Silence detection for audio
    if (currentAudio && !input.trim()) {
        try {
            console.log(`[Audio] Analysis complete. Size: ${currentAudio.size}`);

            // Simplified validation: only check if we have some data
            if (currentAudio.size < 100) {
              throw new Error("Recording too short or contains no data.");
            }
        } catch (err: any) {
            console.error("[Audio] Analysis error:", err);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: "I couldn't process that recording. " + (err.message || "The message was not recorded correctly."),
                timestamp: new Date()
            }]);
            setIsLoading(false); setAudioBlob(null); setMicStream(null);
            return;
        }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input || (currentAudio ? "Processing voice..." : (shareScreen ? "Start monitoring..." : "Analyzing uploaded image...")),
      timestamp: new Date(),
      attachment: attachedImage || undefined,
      audioUrl: currentAudio ? URL.createObjectURL(currentAudio) : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachedImage(null);
    setAudioBlob(null);
    setIsLoading(true);
    setPendingAction(null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const handleBackgroundTasks = async () => {
        let activeChatId = currentChatId;
        if (!activeChatId) {
            const newChat = await ChatService.createChat((input || "New Conversation").substring(0, 30));
            if (newChat) {
                activeChatId = newChat._id;
                setCurrentChatId(newChat._id);
                loadChats();
            }
        }
        if (activeChatId) {
            ChatService.saveMessage({ chat_id: activeChatId, role: 'user', content: userMessage.content });
        }
        return activeChatId;
      };

      const activeChatIdPromise = handleBackgroundTasks();

      let screenshot = null;
      if (shareScreen && window.electron?.captureScreenshot) {
        screenshot = await window.electron.captureScreenshot();
      }

      const parts: any[] = [];
      if (input) parts.push({ text: input });
      
      if (currentAudio) {
        const reader = new FileReader();
        const audioBase64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(currentAudio);
        });
        const audioBase64 = await audioBase64Promise;
        // Use the actual recorded mimeType so Gemini gets the correct format
        const recordedMimeType = audioMimeTypeRef.current || 'audio/webm';
        parts.push({ inlineData: { data: audioBase64, mimeType: recordedMimeType } });
      }

      if (shareScreen && screenshot) {
        parts.push({ inlineData: { data: screenshot.split(',')[1], mimeType: "image/png" } });
      }
      if (attachedImage) {
        parts.push({ inlineData: { data: attachedImage.split(',')[1], mimeType: "image/png" } });
      }

      const history = messages.slice(-10).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const result = await aiRouter.generateContent({
        model: CONFIG.GEMINI_MODEL,
        config: {
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }
        },
        contents: [...history, { role: "user", parts }]
      });

      const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";
      
      const transcriptionMatch = text.match(/TRANSCRIPTION:\s*(.*)/);
      const transcription = transcriptionMatch ? transcriptionMatch[1] : undefined;
      const languageMatch = text.match(/LANGUAGE:\s*([a-zA-Z-]+)/);
      const language = languageMatch ? languageMatch[1].trim() : undefined;

      // Strip internal action JSON blocks and TITLE from display, but keep data JSON
      const cleanContent = text
        .replace(/TITLE:.*\n?/g, '')
        .replace(/TRANSCRIPTION:.*\n?/g, '')
        .replace(/```json\s*{[\s\S]*?"action":[\s\S]*?}\s*```/gi, '') // Only strip blocks with "action":
        .trim();

      // Use transcription as user message label if it exists (shows what AI heard)
      if (transcription && !input) {
        setMessages(prev => prev.map(msg => 
          msg.id === userMessage.id ? { ...msg, content: `🗣️ ${transcription}` } : msg
        ));
      } else if (currentAudio && !input && !transcription) {
        // No transcription from AI - update content from "Processing voice..." to a generic label
        setMessages(prev => prev.map(msg => 
          msg.id === userMessage.id ? { ...msg, content: '🎤 Voice message' } : msg
        ));
      }

      const action = parseActions(text);
      if (action) {
        if (action.type === 'launch' && !action.app && action.target) {
          action.app = typeof action.target === 'string' ? action.target : undefined;
        }
        setPendingAction(action);
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: cleanContent || (action ? `Executing ${action.type}...` : text),
        timestamp: new Date(),
        language: language
      };

      setMessages(prev => [...prev, aiMessage]);
      speak(cleanContent, language);

      const finalChatId = await activeChatIdPromise;
      if (finalChatId) {
        await ChatService.saveMessage({
            chat_id: finalChatId, role: 'assistant',
            content: aiMessage.content, transcription, language, action_json: action
        });
        loadChats();
      }

      // Auto-execute safe actions immediately
      const autoExecActions = [
        'launch', 'create-folder', 'whatsapp-chat', 'whatsapp-call', 
        'open-url', 'write-file', 'delete-file', 'save-document', 
        'create-project', 'create-doc', 'open-path', 'rename-file', 'move-file', 'click'
      ];
      if (action && autoExecActions.includes(action.type)) {
        setTimeout(() => executeAction(action), 500);
      }
    } catch (error: any) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Error: " + (error.message || "Unknown error occurred"),
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const executeAction = async (directAction?: Action) => {
    const actionToRun = directAction || pendingAction;
    if (!actionToRun) return;
    
    setActionStatus('executing');
    try {
      if (window.electron && window.electron.executeAction) {
        const { originalJson, ...sanitizedAction } = actionToRun;
        const result = await window.electron.executeAction(sanitizedAction);

        if (result.success) {
            setActionStatus('success');
            
            if (actionToRun.type === 'capture-browser') {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(), role: 'assistant',
                    content: `Captured sandbox screenshot: ![Sandbox screenshot](${result.data})`,
                    timestamp: new Date()
                }]);
            }
            if (actionToRun.type === 'save-document') {
                if (actionToRun.silent) {
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(), role: 'assistant',
                        content: `Document saved successfully as ${actionToRun.filename}.`,
                        timestamp: new Date()
                    }]);
                } else {
                    setDraftedDocument({ content: actionToRun.content || '', filename: actionToRun.filename || 'document.txt' });
                    setShowDocumentPreview(true);
                }
            }
            if (actionToRun.type === 'create-folder') {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(), role: 'assistant',
                    content: `Processing...`,
                    timestamp: new Date()
                }]);
            }
            if (actionToRun.type === 'whatsapp-chat') {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(), role: 'assistant',
                    content: `Processing...`,
                    timestamp: new Date()
                }]);
            }
            if (actionToRun.type === 'whatsapp-call' && result.screenshot) {
                // Automatically trigger AI vision to click the correct call type icon
                const callType = (actionToRun as any).callType || actionToRun.originalJson?.callType || 'audio';
                const callLabel = callType === 'video' ? 'Video call' : 'Audio call';
                setTimeout(async () => {
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(), role: 'assistant',
                        content: `Processing...`,
                        timestamp: new Date()
                    }]);
                    const base64 = result.screenshot.split(',')[1];
                    const visionParts: any[] = [
                        { text: `This is a screenshot of WhatsApp after opening a chat with ${actionToRun.contact}. 
I need you to find and click the specific icons to start a ${callType} call.

1. Locate the video camera icon in the top-right header area.
2. Click the video icon. YOU MUST include "needsFollowUp": true in your JSON so I can send the next screenshot.
3. A dropdown menu will appear. In that menu in the next step, click the option labeled "${callLabel}".

4. Always include "app": "WhatsApp" in your JSON.
Respond ONLY with the JSON action block for the first step.` },
                        { inlineData: { data: base64, mimeType: 'image/png' } }
                    ];
                    await handleSendMessage(undefined, undefined, visionParts);
                }, 2000);
            } else if ((actionToRun as any).needsFollowUp || (actionToRun as any).originalJson?.needsFollowUp) {
                setTimeout(async () => {
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(), role: 'assistant',
                        content: `Taking follow-up screenshot...`,
                        timestamp: new Date()
                    }]);
                    if (window.electron?.captureScreenshot) {
                        const screenshot = await window.electron.captureScreenshot();
                        if (screenshot) {
                            const base64 = screenshot.split(',')[1];
                            const visionParts: any[] = [
                                { text: `Action executed. Here is the updated screen. Please perform the next step.` },
                                { inlineData: { data: base64, mimeType: 'image/png' } }
                            ];
                            await handleSendMessage(undefined, undefined, visionParts);
                        }
                    }
                }, 1500);
            } else if (actionToRun.type === 'whatsapp-call') {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(), role: 'assistant',
                    content: `Processing...`,
                    timestamp: new Date()
                }]);
            }
            if (actionToRun.background && window.electron.focusWindow) {
                window.electron.focusWindow();
            }

            setTimeout(() => {
                setPendingAction(null);
                setActionStatus('idle');
                if (!actionToRun.silent && !['create-folder','whatsapp-chat','whatsapp-call','save-document','capture-browser','open-path'].includes(actionToRun.type)) {
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(), role: 'assistant',
                        content: `${actionToRun.reasoning}`,
                        timestamp: new Date()
                    }]);
                }
            }, 3000);
        } else {
            console.error('Action execution failed:', result.error);
            setActionStatus('error');
            setMessages(prev => [...prev, {
                id: Date.now().toString(), role: 'assistant',
                content: `❌ Action failed: ${result.error}`,
                timestamp: new Date()
            }]);
        }
      } else {
        throw new Error('Electron interface unavailable');
      }
    } catch (e: any) {
      console.error('Action failed:', e);
      setActionStatus('error');
    }
  };

  const runSkill = async (skill: any) => {
    setShowSkills(false);
    setMessages(prev => [...prev, {
        id: Date.now().toString(), role: 'assistant',
        content: `Running skill: **${skill.name}**...`, timestamp: new Date()
    }]);
    for (const action of skill.actions) {
        await executeAction(action);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setAttachedImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#0B0B0B] text-foreground font-sans overflow-hidden relative">
      {/* Sidebar / History Overlay */}
       <AnimatePresence>
         {showHistory && (
           <motion.div 
             initial={{ x: -300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }}
             className="absolute top-0 left-0 h-full w-64 bg-[#111] border-r border-white/10 z-50 flex flex-col shadow-2xl"
           >
              <div className="p-4 border-b border-white/5 flex justify-between items-center">
                 <h3 className="font-semibold text-sm">History</h3>
                 <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)}>
                    <X className="w-4 h-4" />
                 </Button>
              </div>
              <div className="p-2">
                 <Button className="w-full justify-start gap-2 mb-2" variant="outline" onClick={createNewChat}>
                    <Plus className="w-4 h-4" /> New Chat
                 </Button>
              </div>
              <ScrollArea className="flex-1">
                 <div className="flex flex-col gap-1 p-2">
                    {chats.map(chat => (
                        <div 
                           key={chat._id} 
                           className={`group flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-white/5 ${currentChatId === chat._id ? 'bg-white/10' : ''}`}
                           onClick={() => loadChatSession(chat._id)}
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs truncate">{chat.title || 'Untitled Chat'}</span>
                            </div>
                            <Button 
                                variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => deleteChat(e, chat._id)}
                            >
                                <Trash2 className="w-3 h-3 text-red-400" />
                            </Button>
                        </div>
                    ))}
                 </div>
              </ScrollArea>
           </motion.div>
         )}
         {showHistory && (
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 z-40 backdrop-blur-sm"
                onClick={() => setShowHistory(false)}
            />
         )}
       </AnimatePresence>

      <div className="flex-1 flex flex-col h-full w-full relative">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#0B0B0B] z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setShowHistory(!showHistory)} className="hover:bg-white/5">
            <Menu className="w-5 h-5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-white/5">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-sm tracking-tight">AI WORKSPACE</h2>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {draftedDocument && (
            <Button 
              variant="outline" size="sm" onClick={() => setShowDocumentPreview(!showDocumentPreview)}
              className={`text-xs gap-2 ${showDocumentPreview ? 'bg-primary/10 border-primary/30' : 'bg-white/5 border-white/10'}`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {showDocumentPreview ? 'Hide Document' : 'View Document'}
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2 bg-white/5 border-white/10" onClick={() => setShowSkills(true)}>
              <Zap className="w-4 h-4 text-primary" /> Skills
          </Button>
          <div className="flex items-center space-x-2 bg-white/5 px-3 py-1.5 rounded-md border border-white/5">
            <Checkbox 
              id="share-screen-ai" checked={shareScreen} 
              onCheckedChange={(checked) => setShareScreen(checked as boolean)}
              className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <label htmlFor="share-screen-ai" className="text-xs font-medium leading-none cursor-pointer flex items-center gap-2">
              <Monitor className="w-3.5 h-3.5 text-primary" /> Share Screen with AI
            </label>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest bg-white/5 px-2 py-1 rounded">
            <ShieldCheck className="w-3 h-3 text-green-500/50" /> Encrypted Session
          </div>
          <Button 
            variant="ghost" size="icon"
            onClick={() => { if (isSpeaking) stopSpeaking(); else setIsMuted(!isMuted); }} 
            className={`h-8 w-8 rounded-full transition-all ${isSpeaking ? 'bg-primary/20 text-primary border border-primary/30' : 'hover:bg-white/5'}`}
          >
            {isSpeaking ? (
              <div className="flex gap-[1px] items-center">
                <motion.span animate={{ height: [4, 10, 4] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-0.5 bg-primary" />
                <motion.span animate={{ height: [8, 4, 8] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }} className="w-0.5 bg-primary" />
                <motion.span animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }} className="w-0.5 bg-primary" />
              </div>
            ) : isMuted ? (
              <VolumeX className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Volume2 className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full px-6 py-8">
          <div className="max-w-3xl mx-auto space-y-8 pb-32">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      {message.role === 'assistant' ? (
                        <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                          <Sparkles className="w-3 h-3 text-primary" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-foreground/10 flex items-center justify-center">
                          <MessageSquare className="w-3 h-3 text-muted-foreground" />
                        </div>
                      )}
                      <span className="text-[10px] font-mono text-muted-foreground uppercase flex items-center gap-1.5">
                        {message.role === 'assistant' ? 'GemDesk AI' : <><Monitor className="w-2.5 h-2.5" />{deviceName}</>}
                      </span>
                    </div>
                    <div className={`p-4 rounded-lg border text-sm leading-relaxed ${
                      message.role === 'user' 
                        ? 'bg-[#1A1A1A] border-white/10 text-foreground' 
                        : 'bg-[#0E0E0E] border-white/5 text-foreground/90 shadow-2xl'
                    }`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p({children, ...props}: any) {
                            return <p className="mb-1 last:mb-0 leading-snug" {...props}>{children}</p>;
                          },
                          h1({children, ...props}: any) {
                            return <h1 className="text-base font-semibold mb-1 mt-2 text-white" {...props}>{children}</h1>;
                          },
                          h2({children, ...props}: any) {
                            return <h2 className="text-sm font-semibold mb-1 mt-1.5 text-white/90" {...props}>{children}</h2>;
                          },
                          h3({children, ...props}: any) {
                            return <h3 className="text-xs font-semibold mb-1 mt-1 text-white/80" {...props}>{children}</h3>;
                          },
                          ul({children, ...props}: any) {
                            return <ul className="list-disc pl-4 mb-1 space-y-0" {...props}>{children}</ul>;
                          },
                          ol({children, ...props}: any) {
                            return <ol className="list-decimal pl-4 mb-1 space-y-0" {...props}>{children}</ol>;
                          },
                          li({children, ...props}: any) {
                            return <li className="leading-snug" {...props}>{children}</li>;
                          },
                          strong({children, ...props}: any) {
                            return <strong className="font-semibold text-white" {...props}>{children}</strong>;
                          },
                          code({node, inline, className, children, ...props}: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <div className="my-2 rounded-md overflow-hidden bg-black/30 border border-white/10">
                                <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
                                  <span className="text-xs text-muted-foreground">{match[1]}</span>
                                </div>
                                <div className="p-3 overflow-x-auto">
                                  <code className={className} {...props}>{children}</code>
                                </div>
                              </div>
                            ) : (
                              <code className={`${className} bg-white/10 rounded px-1 py-0.5 text-xs`} {...props}>{children}</code>
                            );
                          }
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                      {message.audioUrl && <VoiceMessagePlayer audioUrl={message.audioUrl} />}
                      {message.attachment && (
                        <div className="mt-4 rounded border border-white/10 overflow-hidden">
                          <img src={message.attachment} alt="Upload" className="max-h-64 object-contain" />
                        </div>
                      )}
                      {message.role === 'assistant' && (
                        <div className="mt-2 flex justify-end">
                           <Button 
                             variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-white/10 text-muted-foreground"
                             onClick={() => speak(message.content, message.language)} title="Read aloud"
                           >
                              <Volume2 className="w-3.5 h-3.5" />
                           </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {/* Action Status Indicator */}
            {pendingAction && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="fixed bottom-28 right-8 z-50 pointer-events-none"
                >
                    <div className="bg-[#1A1A1A]/90 backdrop-blur-md border border-primary/30 rounded-lg shadow-2xl p-3 flex items-center gap-3 min-w-[240px]">
                        <div className={`p-2 rounded-md ${actionStatus === 'executing' ? 'bg-primary/20 animate-pulse' : 'bg-green-500/20'}`}>
                            {pendingAction.type === 'click' && <MousePointer2 className="w-4 h-4 text-primary" />}
                            {pendingAction.type === 'type' && <Keyboard className="w-4 h-4 text-primary" />}
                            {pendingAction.type === 'launch' && <Play className="w-4 h-4 text-primary" />}
                            {pendingAction.type === 'open-url' && <Globe className="w-4 h-4 text-primary" />}
                            {pendingAction.type === 'create-folder' && <FolderPlus className="w-4 h-4 text-primary" />}
                        </div>
                        <div className="flex-1">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-tight font-semibold">
                                {actionStatus === 'executing' ? 'Agent Active' : 'Action Complete'}
                            </div>
                            <div className="text-xs font-medium text-foreground truncate max-w-[180px]">
                                {pendingAction.reasoning}
                            </div>
                        </div>
                        {actionStatus === 'executing' && (
                            <div className="flex gap-1">
                                <span className="w-1 h-3 bg-primary/40 animate-bounce" style={{ animationDelay: '0s' }} />
                                <span className="w-1 h-3 bg-primary/40 animate-bounce" style={{ animationDelay: '0.1s' }} />
                                <span className="w-1 h-3 bg-primary/40 animate-bounce" style={{ animationDelay: '0.2s' }} />
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Loader2 className="w-3 h-3 text-primary animate-spin" />
                    </div>
                    <span className="text-[10px] font-mono text-primary/60 uppercase">Thinking...</span>
                  </div>
                  <div className="h-10 w-24 bg-white/5 rounded-lg flex items-center justify-center border border-white/5">
                    <div className="flex gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1 h-1 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1 h-1 rounded-full bg-primary/40 animate-bounce" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input Section */}
      <div className="p-6 bg-[#0B0B0B] border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          {attachedImage && (
            <div className="mb-4 relative inline-block">
              <img src={attachedImage} className="w-20 h-20 object-cover rounded border border-white/20" />
              <button onClick={() => setAttachedImage(null)} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 shadow-lg">
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          )}
          {isRecording && <VoiceVisualizer stream={micStream} isRecording={isRecording} />}

          <form 
            onSubmit={handleSendMessage}
            className="relative flex items-end gap-2 bg-[#141414] border border-white/5 rounded-xl p-2 focus-within:border-primary/30 transition-all duration-200"
          >
            <div className="flex gap-1 mb-1 ml-1">
              <Button 
                type="button" variant="ghost" size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10"
                onClick={() => { const inp = fileInputRef.current; if (inp) inp.click(); }}
              >
                <ImageIcon className="w-4 h-4" />
              </Button>
              <Button 
                type="button" variant="ghost" size="icon"
                className={`h-9 w-9 relative transition-colors ${isRecording ? 'text-red-500 bg-red-500/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'}`}
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? (
                  <div className="absolute inset-0 flex items-center justify-center gap-[2px]">
                    <motion.span animate={{ height: [8, 16, 8] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-[2px] bg-red-500 rounded-full" />
                    <motion.span animate={{ height: [12, 6, 12] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }} className="w-[2px] bg-red-500 rounded-full" />
                    <motion.span animate={{ height: [6, 14, 6] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }} className="w-[2px] bg-red-500 rounded-full" />
                  </div>
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </Button>
            </div>

            <textarea
              rows={1}
              ref={(el) => {
                textareaRef.current = el;
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                }
              }}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={shareScreen ? "Explain what's on my screen..." : "Ask GemDesk AI anything..."}
              className="flex-1 bg-transparent border-none text-sm py-2.5 outline-none resize-none overflow-y-auto max-h-32 min-h-[40px] placeholder:text-muted-foreground/50"
            />

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />

            <Button 
              type="submit" size="icon"
              disabled={isLoading || (!input.trim() && !shareScreen && !attachedImage && !audioBlob)}
              className="bg-primary hover:bg-primary/90 text-white h-9 w-9 rounded-lg shadow-lg shadow-primary/20"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          
          <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground px-1">
            <div className="flex items-center gap-4">
              <span>Press <kbd className="font-sans px-1 bg-white/5 rounded">Enter</kbd> to send</span>
              <span>Shift + Enter for new line</span>
            </div>
            <div className="flex items-center gap-1.5 opacity-40">
              <Monitor className="w-2.5 h-2.5" />
              <span>Gemini 2.5 Flash</span>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Document Preview Split Panel */}
      <AnimatePresence>
        {showDocumentPreview && draftedDocument && (
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 20, stiffness: 100 }}
              className="w-1/3 h-full bg-[#0E0E0E] border-l border-white/10 flex flex-col z-20 shadow-2xl"
            >
               <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#141414]">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm truncate max-w-[150px]">{draftedDocument.filename}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="text-xs h-7 hover:bg-white/5" onClick={async () => {
                       await window.electron.writeFile(`C:\\Users\\ADMIN\\Documents\\${draftedDocument.filename}`, draftedDocument.content);
                    }}>Save</Button>
                    <Button variant="ghost" size="icon" onClick={() => setShowDocumentPreview(false)}>
                        <X className="w-4 h-4" />
                    </Button>
                  </div>
               </div>
               <ScrollArea className="flex-1 p-6">
                  <div className="prose prose-invert max-w-none">
                     <ReactMarkdown remarkPlugins={[remarkGfm]}>{draftedDocument.content}</ReactMarkdown>
                  </div>
               </ScrollArea>
            </motion.div>
        )}
       </AnimatePresence>

       <AnimatePresence>
          {showSkills && (
              <SkillLibrary onTriggerSkill={runSkill} onClose={() => setShowSkills(false)} />
          )}
       </AnimatePresence>
    </div>
  );
}
