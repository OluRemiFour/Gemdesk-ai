import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatService, Chat } from '@/services/ChatService';
import { 
  ArrowLeft, 
  Send, 
  Image as ImageIcon, 
  Mic, 
  X, 
  Trash2,
  MoreVertical,
  Plus,
  Loader2, 
  Sparkles, 
  Monitor, 
  MessageSquare,
  ShieldCheck,
  MousePointer2,
  CheckCircle2,
  XCircle,
  Play,
  Pause,
  Keyboard,
  Globe,
  Volume2,
  VolumeX,
  Menu
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Import Google GenAI
import { GoogleGenAI } from "@google/genai";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  screenshot?: string;
  attachment?: string;
  audioUrl?: string; // New field for replay
  transcription?: string; // Transcription from AI
  language?: string; // Language for TTS
}

interface Action {
  type: 'click' | 'doubleclick' | 'rightclick' | 'type' | 'keypress' | 'launch' | 'open-url';
  target?: { x: number; y: number } | string;
  text?: string;
  key?: string;
  app?: string;
  url?: string;
  reasoning: string;
  confidence: number;
  originalJson: any;
}


interface AIWorkspaceProps {
  onBack: () => void;
}

const VoiceMessagePlayer = ({ audioUrl }: { audioUrl: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      // Chrome has a bug with webm duration being Infinity
      if (audio.duration === Infinity || isNaN(audio.duration)) {
        // Trick to force duration calculation: seek to a huge number
        audio.currentTime = 1e101;
        
        const onTimeUpdate = () => {
           audio.currentTime = 0;
           audio.removeEventListener('timeupdate', onTimeUpdate);
        };
        
        audio.addEventListener('timeupdate', onTimeUpdate);
      } else {
        setDuration(audio.duration);
      }
    };
    
    // Fallback: update duration during playback if it changes from Infinity
    const handleDurationChange = () => {
        if(audio.duration !== Infinity && !isNaN(audio.duration)) {
            setDuration(audio.duration);
        }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  return (
    <div className="mt-2 flex items-center gap-3 bg-white/5 p-2 rounded-lg border border-white/10 min-w-[200px]">
      <audio ref={audioRef} src={audioUrl} />
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-8 w-8 rounded-full p-0 flex items-center justify-center hover:bg-primary/20 text-primary"
        onClick={togglePlay}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </Button>
      
      <div className="flex-1 flex flex-col gap-1">
        <input 
          type="range"
          min="0"
          max={duration || 0}
          step="0.01"
          value={currentTime}
          onChange={handleSliderChange}
          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

// Import GeminiService
import { GeminiService } from '@/services/GeminiService';

const MESSAGE_ICON_SIZE = 'w-5 h-5';
// ... (keep unused imports if needed or clean up)

// Get API keys from env, support comma separation
const GEMINI_API_KEYS = (import.meta.env.VITE_GEMINI_API_KEY || "GEMINI_API_KEY_HERE").split(',').map((k: string) => k.trim());
const geminiService = new GeminiService(GEMINI_API_KEYS);

const SYSTEM_PROMPT = `
You are GemDesk AI, a powerful, context-aware computer control agent. 
Your goal is to assist the user by "seeing" their screen and performing actions.

### OPERATIONAL PRINCIPLES:
1. **Act on User's Behalf**: When instructed to message someone or browse, adopt a professional yet helpful tone.
2. **Locating Content**: To find a chat, contact, or file, launch the app, search, and select the match. 
3. **Web Automation**: To open a website, use "open-url" or "launch" with a browser name and URL (e.g., 'Microsoft Edge gmail.com').
4. **Files and Folders**: To open a folder or file, use "launch" with the FULL PATH if possible. For items on the Desktop, try "C:\\Users\\ADMIN\\Desktop\\foldername".
5. **App Navigation (e.g., WhatsApp)**: To navigate to a specific chat, first "launch" the app. Once it's open, use "click" to focus on the search box, "type" the contact name, then "click" the contact in the results.
6. **Resilience**: If an action fails, try Start Menu search via "launch".

### TRANSCRIPTION RULES:
1. **LITERAL TRANSCRIPTION ONLY**: Transcribe EXACTLY as spoken.
2. **Action Generation**: Commands MUST be in a JSON block.
3. **Response Format**: Start with \`TRANSCRIPTION: [Text]\`.

### SUPPORTED ACTIONS (JSON):
- **launch**: {\"action\": \"launch\", \"app\": \"C:\\\\Users\\\\ADMIN\\\\Desktop\\\\ml\", \"reasoning\": \"Opening the requested folder...\", \"confidence\": 0.9}
- **click**: {\"action\": \"click\", \"target\": {\"x\": 500, \"y\": 300}, \"reasoning\": \"...\", \"confidence\": 0.9}
- **type**: {\"action\": \"type\", \"text\": \"hello world\", \"reasoning\": \"...\", \"confidence\": 0.9}
- **keypress**: {\"action\": \"keypress\", \"key\": \"enter\", \"reasoning\": \"...\", \"confidence\": 0.9}
- **open-url**: {\"action\": \"open-url\", \"url\": \"https://google.com\", \"reasoning\": \"...\", \"confidence\": 0.9}
`;

export default function AIWorkspace({ onBack }: AIWorkspaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm GemDesk AI. Enable \"Share Screen with AI\" to let me see your screen and perform actions for you.",
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
  
  // Chat History State
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chats on mount
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
            id: '1',
            role: 'assistant',
            content: "Hello! I'm GemDesk AI. I'm ready to help.",
            timestamp: new Date()
        }]);
        loadChats();
        setShowHistory(false);
    }
  };

  const loadChatSession = async (chatId: string) => {
    const loadedMessages = await ChatService.getMessages(chatId);
    // Map DB messages to UI messages
    const uiMessages: Message[] = loadedMessages.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.created_at),
        transcription: msg.transcription,
        language: msg.language,
        // attachment: msg.attachment_url // TODO: Handle attachments if we save them
    }));
    
    if (uiMessages.length === 0) {
        // Fallback for empty chat
         setMessages([{
            id: '1',
            role: 'assistant',
            content: "Hello! Resuming chat...",
            timestamp: new Date()
        }]);
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


  // Fetch device info
  useEffect(() => {
    const fetchDeviceInfo = async () => {
      if (window.electron?.getDeviceInfo) {
        try {
          const info = await window.electron.getDeviceInfo();
          setDeviceName(info.hostname || info.username || 'Developer');
        } catch (e) {
          console.error("Failed to fetch device info", e);
        }
      }
    };
    fetchDeviceInfo();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingAction]);

  // Handle continuous monitoring
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const startSession = async () => {
      if (shareScreen && window.electron?.startMonitoring) {
        await window.electron.startMonitoring();
        
        // Listen for screen updates
        window.electron.onScreenUpdate((data: any) => {
          // In a real implementation, we might auto-send this to Gemini 
          // if we are in an "active agent" mode. 
          // For now, we just update the view or logs.
          console.log('Screen updated:', data.timestamp);
        });

        cleanup = () => {
          if (window.electron?.stopMonitoring) {
            window.electron.stopMonitoring();
          }
        };
      }
    };

    if (shareScreen) {
      startSession();
    } else {
      if (window.electron?.stopMonitoring) {
        window.electron.stopMonitoring();
      }
    }

    return () => {
      cleanup?.();
    };
  }, [shareScreen]);

  const parseActions = (text: string): Action | null => {
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const json = JSON.parse(jsonMatch[1]);
        const type = json.action || json.type;
        
        // Normalize the action object
        const action: Action = {
            type: type,
            target: json.target,
            text: json.text,
            key: json.key,
            app: json.app || (type === 'launch' ? (typeof json.target === 'string' ? json.target : json.name) : undefined),
            url: json.url || (type === 'open-url' ? (typeof json.target === 'string' ? json.target : undefined) : undefined),
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        // Auto-send when recording stops
        setTimeout(() => handleSendMessage(undefined, blob), 300);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Stop all tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const speak = useCallback((text: string, lang?: string) => {
    if (isMuted || !text) return;
    
    // Stop any current speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (lang) {
        utterance.lang = lang;
        console.log(`Setting TTS language to: ${lang}`);
    }

    const voices = window.speechSynthesis.getVoices();
    
    // If a specific language is requested, try to find a voice for it
    let preferredVoice = null;
    if (lang) {
        preferredVoice = voices.find(v => v.lang.startsWith(lang.split('-')[0]));
    }
    
    // Fallback to Google/Premium preference if no specific lang voice or if lang not set
    if (!preferredVoice) {
        preferredVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Premium')) || voices[0];
    }
    
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

  const handleSendMessage = async (e?: React.FormEvent, overrideAudio?: Blob) => {
    if (e) e.preventDefault();
    const currentAudio = overrideAudio || audioBlob;
    if (!input.trim() && !shareScreen && !attachedImage && !currentAudio) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input || (currentAudio ? "Processing voice..." : (shareScreen ? "Start monitoring..." : "Analyzing uploaded image...")),
      timestamp: new Date(),
      attachment: attachedImage || undefined,
      audioUrl: currentAudio ? URL.createObjectURL(currentAudio) : undefined
    };

    // OPTIMISTIC UI: Update messages and clear input immediately
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachedImage(null);
    setAudioBlob(null);
    setIsLoading(true);
    setPendingAction(null);

    try {
      // Perform background operations asynchronously
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
            ChatService.saveMessage({
                chat_id: activeChatId,
                role: 'user',
                content: userMessage.content,
            });
        }
        return activeChatId;
      };

      // Start tasks but don't block the UI update
      const activeChatIdPromise = handleBackgroundTasks();

      let screenshot = null;
      if (shareScreen) {
        if (typeof window !== 'undefined' && window.electron && window.electron.captureScreenshot) {
          screenshot = await window.electron.captureScreenshot();
        }
      }

      const parts: any[] = [];
      if (input) parts.push({ text: input });
      
      // Handle Audio Data
      if (currentAudio) {
        const reader = new FileReader();
        const audioBase64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(currentAudio);
        });
        
        const audioBase64 = await audioBase64Promise;
        parts.push({
          inlineData: {
            data: audioBase64,
            mimeType: "audio/webm"
          }
        });
      }

      if (shareScreen && screenshot) {
        parts.push({
          inlineData: {
            data: screenshot.split(',')[1],
            mimeType: "image/png"
          }
        });
      }
      if (attachedImage) {
        parts.push({
          inlineData: {
            data: attachedImage.split(',')[1],
            mimeType: "image/png"
          }
        });
      }

      const result = await geminiService.generateContent({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          }
        },
        contents: [{ role: "user", parts }]
      });

      const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";
      
      // Extract transcription if present
      const transcriptionMatch = text.match(/TRANSCRIPTION:\s*(.*)/);
      const transcription = transcriptionMatch ? transcriptionMatch[1] : undefined;

      // Extract language if present
      const languageMatch = text.match(/LANGUAGE:\s*([a-zA-Z-]+)/);
      const language = languageMatch ? languageMatch[1].trim() : undefined;

      const cleanContent = text
        .replace(/TRANSCRIPTION:.*\n?/g, '')
        .replace(/LANGUAGE:.*\n?/g, '')
        .replace(/```json[\s\S]*?```/g, '')
        .trim();

      // Update user message with transcription if we got one and it was a voice message
      if (transcription && !input) {
        setMessages(prev => prev.map(msg => 
          msg.id === userMessage.id ? { ...msg, content: transcription } : msg
        ));
      }

      // Parse for actions
      const action = parseActions(text);
      if (action) {
        // Fix for launch action if target is used instead of app
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
        screenshot: undefined, // Don't return captured frame in chat
        language: language // Store detected language
      };

      setMessages(prev => [...prev, aiMessage]);

      // Wait for chat creation if needed before saving AI response
      const finalChatId = await activeChatIdPromise;

      // SAVE AI MESSAGE
      if (finalChatId) {
        await ChatService.saveMessage({
            chat_id: finalChatId,
            role: 'assistant',
            content: aiMessage.content,
            transcription: transcription,
            language: language,
            action_json: action
        });
        loadChats(); // Refresh history
      }

      // AUTO-EXECUTE: If an action specifically for 'launch' was parsed, execute it immediately.
      // This hides the manual approval step for launches as requested.
      if (action && action.type === 'launch') {
        console.log("[AIWorkspace] Auto-executing 'launch' action:", action.app);
        setTimeout(() => {
          executeAction(action);
        }, 500);
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
        // @ts-ignore
        const { originalJson, ...sanitizedAction } = actionToRun;
        const result = await window.electron.executeAction(sanitizedAction);
        

        if (result.success) {
            setActionStatus('success');
            setTimeout(() => {
                setPendingAction(null);
                setActionStatus('idle');
                // Optional: Auto-follow up
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: `${actionToRun.reasoning}`, // Removed the green mark/icon
                    timestamp: new Date()
                }]);
            }, 3000);
        } else {
            console.error('Action execution failed:', result.error);
            setActionStatus('error');
        }
      } else {
        throw new Error('Electron interface unavailable');
      }
    } catch (e) {
      console.error('Action failed:', e);
      setActionStatus('error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#0B0B0B] text-foreground font-sans overflow-hidden relative">
      {/* Sidebar / History Overlay */}
       <AnimatePresence>
         {showHistory && (
           <motion.div 
             initial={{ x: -300, opacity: 0 }}
             animate={{ x: 0, opacity: 1 }}
             exit={{ x: -300, opacity: 0 }}
             className="absolute top-0 left-0 h-full w-64 bg-[#111] border-r border-white/10 z-50 flex flex-col shadow-2xl"
           >
              <div className="p-4 border-b border-white/5 flex justify-between items-center">
                 <h3 className="font-semibold text-sm">History</h3>
                 <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)}>
                    <X className="w-4 h-4" />
                 </Button>
              </div>
              <div className="p-2">
                 <Button 
                    className="w-full justify-start gap-2 mb-2" 
                    variant="outline" 
                    onClick={createNewChat}
                 >
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
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
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
         {/* Backdrop */}
         {showHistory && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
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

        <div className="flex items-center gap-6">
          <div className="flex items-center space-x-2 bg-white/5 px-3 py-1.5 rounded-md border border-white/5">
            <Checkbox 
              id="share-screen-ai" 
              checked={shareScreen} 
              onCheckedChange={(checked) => setShareScreen(checked as boolean)}
              className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <label 
              htmlFor="share-screen-ai"
              className="text-xs font-medium leading-none cursor-pointer flex items-center gap-2"
            >
              <Monitor className="w-3.5 h-3.5 text-primary" />
              Share Screen with AI
            </label>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest bg-white/5 px-2 py-1 rounded">
            <ShieldCheck className="w-3 h-3 text-green-500/50" />
            Encrypted Session
          </div>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              if (isSpeaking) {
                stopSpeaking();
              } else {
                setIsMuted(!isMuted);
              }
            }} 
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

      {/* Main Chat Area */}
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
                        {message.role === 'assistant' ? (
                          'GemDesk AI'
                        ) : (
                          <>
                            <Monitor className="w-2.5 h-2.5" />
                            {deviceName}
                          </>
                        )}
                      </span>
                    </div>

                    <div className={`
                      p-4 rounded-lg border text-sm leading-relaxed
                      ${message.role === 'user' 
                        ? 'bg-[#1A1A1A] border-white/10 text-foreground' 
                        : 'bg-[#0E0E0E] border-white/5 text-foreground/90 shadow-2xl'}
                    `}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({node, inline, className, children, ...props}: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <div className="my-2 rounded-md overflow-hidden bg-black/30 border border-white/10">
                                <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
                                  <span className="text-xs text-muted-foreground">{match[1]}</span>
                                </div>
                                <div className="p-3 overflow-x-auto">
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                </div>
                              </div>
                            ) : (
                              <code className={`${className} bg-white/10 rounded px-1 py-0.5`} {...props}>
                                {children}
                              </code>
                            );
                          }
                        }}
                      >
                        {message.content} 
                      </ReactMarkdown>
                      
                      {message.audioUrl && (
                        <VoiceMessagePlayer audioUrl={message.audioUrl} />
                      )}

                      {message.attachment && (
                        <div className="mt-4 rounded border border-white/10 overflow-hidden">
                          <img src={message.attachment} alt="Upload" className="max-h-64 object-contain" />
                        </div>
                      )}
                      
                      {message.role === 'assistant' && (
                        <div className="mt-2 flex justify-end">
                           <Button 
                             variant="ghost" 
                             size="sm" 
                             className="h-6 w-6 p-0 hover:bg-white/10 text-muted-foreground"
                             onClick={() => speak(message.content, message.language)}
                             title="Read aloud"
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
            
            {/* Seamless Action Status Indicator */}
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
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="flex justify-start"
              >
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
              <button 
                onClick={() => setAttachedImage(null)}
                className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 shadow-lg"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          )}

          <form 
            onSubmit={handleSendMessage}
            className="relative flex items-end gap-2 bg-[#141414] border border-white/5 rounded-xl p-2 focus-within:border-primary/30 transition-all duration-200"
          >
            <div className="flex gap-1 mb-1 ml-1">
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10"
                onClick={() => {
                  const input = fileInputRef.current;
                  if (input) input.click();
                }}
              >
                <ImageIcon className="w-4 h-4" />
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
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
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                }
              }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={shareScreen ? "Explain what's on my screen..." : "Ask GemDesk AI anything..."}
              className="flex-1 bg-transparent border-none text-sm py-2.5 outline-none resize-none overflow-y-auto max-h-32 min-h-[40px] placeholder:text-muted-foreground/50 transition-[height] duration-200"
            />

            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileUpload} 
            />

            <Button 
              type="submit" 
              size="icon" 
              disabled={isLoading || (!input.trim() && !shareScreen && !attachedImage)}
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
              <span>Gemini 3 Flash</span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
