import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, X, Trash2, Bot, User, Loader2, Sparkles, FileText, Mic, StopCircle, RefreshCw, Copy, Check, ChevronDown, Terminal, Lightbulb, Code2, Plane, BookOpen, History, MessageSquare, Plus, Pencil, Menu } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { streamChatResponse, fileToBase64 } from '../services/geminiService';
import { Message, BotModel, ChatConfig, ChatSession } from '../types';

const DEFAULT_SYSTEM_INSTRUCTION = "You are a helpful, clever, and friendly AI assistant named Gemini.";

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

// --- Sub-component: Code Block with Copy ---
const CodeBlock = ({ language, value }: { language: string, value: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-slate-700/50 bg-slate-950 shadow-md group/code">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
        <span className="text-xs font-mono text-indigo-400 flex items-center gap-1">
          <Terminal className="w-3 h-3" />
          {language || 'text'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors opacity-0 group-hover/code:opacity-100"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="text-sm font-mono text-slate-300 leading-relaxed whitespace-pre">
          <code>{value}</code>
        </pre>
      </div>
    </div>
  );
};

export const ChatInterface: React.FC = () => {
  // --- State ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  const [inputValue, setInputValue] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedTextFile, setSelectedTextFile] = useState<{ name: string; content: string } | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showModelSelect, setShowModelSelect] = useState(false);
  
  const [config, setConfig] = useState<ChatConfig>({
    model: BotModel.FLASH,
    systemInstruction: DEFAULT_SYSTEM_INSTRUCTION
  });

  // --- Refs ---
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textFileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Load sessions from localStorage on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem('gemini_chat_sessions');
    if (savedSessions) {
      try {
        setSessions(JSON.parse(savedSessions));
      } catch (e) {
        console.error("Failed to parse sessions", e);
      }
    }
    // Start a new session automatically if none exists or selected
    if (!currentSessionId) {
        createNewSession();
    }
  }, []);

  // Save sessions whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('gemini_chat_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  // Update current session data when messages change
  useEffect(() => {
    if (!currentSessionId || messages.length === 0) return;
    
    setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
            // Generate a title from the first user message if it's "New Chat"
            let title = session.title;
            if (title === "New Chat" && messages.length > 0) {
                const firstUserMsg = messages.find(m => m.role === 'user');
                if (firstUserMsg) {
                    title = firstUserMsg.text.slice(0, 30) + (firstUserMsg.text.length > 30 ? '...' : '');
                }
            }
            return {
                ...session,
                messages: messages,
                title: title,
                updatedAt: Date.now()
            };
        }
        return session;
    }));
    
    scrollToBottom();
  }, [messages, currentSessionId]);

  // Close model dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setShowModelSelect(false);
      }
      // Close sidebar on mobile when clicking outside
      if (window.innerWidth < 1024 && showHistory && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
         // Only if we clicked outside the toggle button too (optional, but keeps logic simple)
         const toggleBtn = document.getElementById('history-toggle-btn');
         if (toggleBtn && !toggleBtn.contains(event.target as Node)) {
             setShowHistory(false);
         }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHistory]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [inputValue]);

  // --- Session Management ---

  const createNewSession = () => {
    const newId = Date.now().toString();
    const newSession: ChatSession = {
        id: newId,
        title: "New Chat",
        messages: [],
        updatedAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setMessages([]);
    setShowHistory(false); // Close sidebar on mobile
    if (window.innerWidth < 1024) setShowHistory(false);
  };

  const loadSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
        setCurrentSessionId(sessionId);
        setMessages(session.messages);
        if (window.innerWidth < 1024) setShowHistory(false);
    }
  };

  const deleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(newSessions);
    if (currentSessionId === sessionId) {
        if (newSessions.length > 0) {
            loadSession(newSessions[0].id);
        } else {
            createNewSession();
        }
    }
  };

  // --- Handlers ---

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      const base64 = await fileToBase64(file);
      setImagePreview(base64);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTextFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const text = await file.text();
        setSelectedTextFile({ name: file.name, content: text });
      } catch (err) {
        console.error("Error reading text file:", err);
      }
      if (textFileInputRef.current) textFileInputRef.current.value = '';
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputValue((prev) => {
             const spacer = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
             return prev + spacer + transcript;
          });
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        recognitionRef.current = recognition;
        recognition.start();
      } else {
        alert("Speech recognition is not supported in this browser.");
      }
    }
  };

  const clearAttachments = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setSelectedTextFile(null);
  };

  const processMessage = async (text: string, image: string | null | undefined, history: Message[]) => {
    const aiMessageId = (Date.now() + 1).toString();
    const aiPlaceholder: Message = {
      id: aiMessageId,
      role: 'model',
      text: "",
      isStreaming: true,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, aiPlaceholder]);
    setIsStreaming(true);

    try {
      const stream = await streamChatResponse(
        history,
        text,
        image || null,
        config.model,
        config.systemInstruction
      );

      let fullText = "";
      
      for await (const chunk of stream) {
        const textChunk = chunk.text;
        if (textChunk) {
            fullText += textChunk;
            setMessages(prev => prev.map(msg => 
                msg.id === aiMessageId 
                ? { ...msg, text: fullText } 
                : msg
            ));
        }
      }
      
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
        ? { ...msg, text: fullText, isStreaming: false } 
        : msg
      ));

    } catch (error: any) {
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
        ? { ...msg, text: "Sorry, I encountered an error. Please check your API Key.", isError: true, isStreaming: false } 
        : msg
      ));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSendMessage = async (overrideText?: string) => {
    const textToSend = overrideText !== undefined ? overrideText : inputValue;
    
    if ((!textToSend.trim() && !selectedImage && !selectedTextFile) || isStreaming) return;

    let userText = textToSend.trim();
    if (selectedTextFile) {
        userText = userText 
            ? `${userText}\n\n--- Attached File: ${selectedTextFile.name} ---\n${selectedTextFile.content}`
            : `--- Attached File: ${selectedTextFile.name} ---\n${selectedTextFile.content}`;
    }
    const userImage = imagePreview; 

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend.trim() || (selectedTextFile ? `Sent file: ${selectedTextFile.name}` : ''),
      image: userImage || undefined,
      timestamp: Date.now()
    };
    
    // We store the FULL context
    const fullMessageForHistory = { ...userMessage, text: userText };

    setMessages(prev => [...prev, fullMessageForHistory]);
    setInputValue("");
    clearAttachments();
    if (textareaRef.current) textareaRef.current.style.height = 'inherit';

    await processMessage(userText, userImage, messages);
  };

  const handleRegenerate = async () => {
    if (isStreaming || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'model') return;

    const newHistory = messages.slice(0, -1);
    setMessages(newHistory);

    const lastUserMessage = newHistory[newHistory.length - 1];
    if (!lastUserMessage || lastUserMessage.role !== 'user') return;

    await processMessage(lastUserMessage.text, lastUserMessage.image, newHistory.slice(0, -1));
  };

  const handleEditMessage = (index: number) => {
    if (isStreaming) return;
    const msgToEdit = messages[index];
    if (msgToEdit.role !== 'user') return;

    setInputValue(msgToEdit.text); // Populate input
    setMessages(prev => prev.slice(0, index)); // Remove this and subsequent messages
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const suggestions = [
    { icon: <Code2 className="w-4 h-4" />, label: "Write a Python script to parse JSON" },
    { icon: <Lightbulb className="w-4 h-4" />, label: "Explain Quantum Computing" },
    { icon: <BookOpen className="w-4 h-4" />, label: "Summarize 'The Alchemist'" },
    { icon: <Plane className="w-4 h-4" />, label: "Itinerary for 3 days in Paris" },
  ];

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden relative">
      
      {/* Sidebar (History) */}
      <div 
        ref={sidebarRef}
        className={`absolute md:relative z-30 h-full w-[280px] bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out ${
            showHistory ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden'
        } ${/* Hack to make sidebar visible on large screens if we want a toggle, but user wants "history button". 
            Let's make it toggleable on ALL screens for cleaner UI */ ''} 
            ${showHistory ? 'shadow-2xl' : ''}
        `}
      >
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="font-semibold text-slate-200 flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-400" /> History
                </h2>
                <button 
                    onClick={() => setShowHistory(false)} 
                    className="md:hidden text-slate-400 hover:text-white"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
            
            <div className="p-3">
                <button 
                    onClick={createNewSession}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-lg shadow-indigo-900/20"
                >
                    <Plus className="w-4 h-4" /> New Chat
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
                {sessions.map(session => (
                    <div 
                        key={session.id}
                        onClick={() => loadSession(session.id)}
                        className={`group flex items-center justify-between px-3 py-3 rounded-lg cursor-pointer transition-all ${
                            currentSessionId === session.id 
                            ? 'bg-slate-800 text-white border border-slate-700' 
                            : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                        }`}
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <MessageSquare className="w-4 h-4 flex-shrink-0" />
                            <span className="text-sm truncate">{session.title}</span>
                        </div>
                        <button
                            onClick={(e) => deleteSession(e, session.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative min-w-0">
        
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 lg:px-6 bg-slate-900/80 border-b border-slate-800 backdrop-blur-md z-10">
            <div className="flex items-center gap-3">
                <button 
                    id="history-toggle-btn"
                    onClick={() => setShowHistory(!showHistory)}
                    className="p-2 -ml-2 text-slate-400 hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <Menu className="w-5 h-5" />
                </button>
                
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Sparkles className="w-4 h-4 text-white" />
                </div>
                
                <div className="relative" ref={modelDropdownRef}>
                    <button 
                        onClick={() => setShowModelSelect(!showModelSelect)}
                        className="flex items-center gap-2 text-sm font-semibold text-white hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        {config.model === BotModel.FLASH && 'Gemini 2.5 Flash'}
                        {config.model === BotModel.PRO && 'Gemini 2.5 Pro'}
                        {config.model === BotModel.LITE && 'Gemini Flash Lite'}
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>

                    {/* Model Dropdown */}
                    {showModelSelect && (
                        <div className="absolute top-full left-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                            <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Model</div>
                            {[
                                { id: BotModel.FLASH, name: 'Gemini 2.5 Flash', desc: 'Fastest & most versatile' },
                                { id: BotModel.PRO, name: 'Gemini 2.5 Pro', desc: 'Best for complex reasoning' },
                                { id: BotModel.LITE, name: 'Gemini Flash Lite', desc: 'Lightweight & cost-effective' }
                            ].map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => {
                                        setConfig({ ...config, model: m.id });
                                        setShowModelSelect(false);
                                    }}
                                    className={`w-full text-left px-4 py-3 hover:bg-slate-700/50 transition-colors flex flex-col ${
                                        config.model === m.id ? 'bg-indigo-500/10 border-l-2 border-indigo-500' : ''
                                    }`}
                                >
                                    <span className={`text-sm font-medium ${config.model === m.id ? 'text-indigo-400' : 'text-slate-200'}`}>
                                        {m.name}
                                    </span>
                                    <span className="text-xs text-slate-500 mt-0.5">{m.desc}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 scrollbar-thin">
            {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-8 ring-1 ring-slate-700 shadow-2xl">
                        <Bot className="w-12 h-12 text-indigo-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">How can I help you today?</h2>
                    <p className="text-slate-400 mb-8 text-center max-w-md">
                        I'm Gemini, a multimodal AI. I can process text, code, images, and files.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                        {suggestions.map((s, i) => (
                            <button 
                                key={i}
                                onClick={() => handleSendMessage(s.label)}
                                className="flex items-center gap-3 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/50 rounded-xl text-left text-sm text-slate-300 hover:text-white transition-all hover:-translate-y-0.5 group"
                            >
                                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                    {s.icon}
                                </div>
                                <span className="font-medium">{s.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="max-w-3xl mx-auto space-y-6">
                    {messages.map((msg, idx) => (
                        <div 
                            key={msg.id} 
                            className={`group flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md mt-1 ${
                                msg.role === 'user' ? 'bg-indigo-600' : msg.isError ? 'bg-red-500/20' : 'bg-slate-800'
                            }`}>
                                {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Sparkles className="w-5 h-5 text-indigo-400" />}
                            </div>

                            <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                {msg.image && (
                                    <img 
                                        src={`data:image/jpeg;base64,${msg.image}`} 
                                        alt="Uploaded content" 
                                        className="rounded-xl border border-slate-700/50 shadow-lg max-w-xs w-full object-cover"
                                    />
                                )}
                                
                                {(msg.text || msg.isStreaming) && (
                                    <div className={`relative px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-lg ${
                                        msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-tr-none'
                                        : msg.isError 
                                            ? 'bg-red-500/10 text-red-200 border border-red-500/20 rounded-tl-none'
                                            : 'bg-slate-800 text-slate-200 border border-slate-700/50 rounded-tl-none'
                                    }`}>
                                        {msg.role === 'model' ? (
                                            <div className="prose prose-invert prose-sm max-w-none break-words [&>p]:mb-3 [&>p:last-child]:mb-0 [&_a]:text-indigo-400 [&_a]:underline hover:[&_a]:text-indigo-300">
                                                <ReactMarkdown 
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        code({node, inline, className, children, ...props}: any) {
                                                            const match = /language-(\w+)/.exec(className || '');
                                                            const value = String(children).replace(/\n$/, '');
                                                            if (!inline) {
                                                                return <CodeBlock language={match?.[1] || ''} value={value} />;
                                                            }
                                                            return (
                                                                <code className="bg-slate-950/50 border border-slate-700/50 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-xs" {...props}>
                                                                    {children}
                                                                </code>
                                                            );
                                                        }
                                                    }}
                                                >
                                                    {msg.text}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            <div className="whitespace-pre-wrap">{msg.text}</div>
                                        )}
                                        
                                        {msg.isStreaming && !msg.text && (
                                            <div className="flex gap-1 py-1">
                                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full typing-dot"></span>
                                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full typing-dot"></span>
                                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full typing-dot"></span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Message Actions */}
                                {!msg.isStreaming && !msg.isError && (
                                    <div className={`flex items-center gap-2 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === 'user' ? 'pr-1' : 'pl-1'}`}>
                                        <button 
                                            onClick={() => handleCopyMessage(msg.text)}
                                            className="p-1 hover:text-white transition-colors" 
                                            title="Copy"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>
                                        {msg.role === 'user' && (
                                            <button 
                                                onClick={() => handleEditMessage(idx)}
                                                className="p-1 hover:text-white transition-colors" 
                                                title="Edit"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        {msg.role === 'model' && idx === messages.length - 1 && (
                                            <button 
                                                onClick={handleRegenerate}
                                                className="p-1 hover:text-white transition-colors" 
                                                title="Regenerate"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            )}
        </div>

        {/* Input Area */}
        <div className="p-4 lg:p-6 bg-slate-900 border-t border-slate-800">
            <div className="max-w-3xl mx-auto">
                {(imagePreview || selectedTextFile) && (
                    <div className="mb-4 flex flex-wrap gap-2">
                        {imagePreview && (
                            <div className="relative group">
                                <img src={`data:image/jpeg;base64,${imagePreview}`} alt="Preview" className="h-20 w-auto rounded-lg border border-slate-700" />
                                <button 
                                    onClick={() => { setImagePreview(null); setSelectedImage(null); }}
                                    className="absolute -top-2 -right-2 bg-slate-800 text-white p-1 rounded-full border border-slate-600 hover:bg-red-500/80 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                        {selectedTextFile && (
                            <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-lg p-3 relative group">
                                <div className="bg-indigo-500/20 p-2 rounded">
                                    <FileText className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <div className="text-xs font-medium text-white truncate max-w-[150px]">{selectedTextFile.name}</div>
                                    <div className="text-[10px] text-slate-400">Text File</div>
                                </div>
                                <button 
                                    onClick={() => setSelectedTextFile(null)}
                                    className="absolute -top-2 -right-2 bg-slate-800 text-white p-1 rounded-full border border-slate-600 hover:bg-red-500/80 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <div className="relative flex items-end gap-2 bg-slate-800/50 p-2 rounded-2xl border border-slate-700 focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-inner">
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleImageSelect}
                        className="hidden"
                        accept="image/jpeg, image/png, image/webp"
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-colors"
                        title="Upload Image"
                    >
                        <ImageIcon className="w-5 h-5" />
                    </button>
                    
                    <input 
                        type="file" 
                        ref={textFileInputRef}
                        onChange={handleTextFileSelect}
                        className="hidden"
                        accept=".txt,.md,.py,.js,.json,.csv"
                    />
                    <button 
                        onClick={() => textFileInputRef.current?.click()}
                        className="p-3 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-colors"
                        title="Upload File"
                    >
                        <FileText className="w-5 h-5" />
                    </button>

                    <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything..."
                        className="flex-1 bg-transparent text-white placeholder:text-slate-500 text-sm py-3 focus:outline-none max-h-[200px] resize-none"
                        rows={1}
                    />
                    
                    <button
                        onClick={toggleListening}
                        className={`p-3 rounded-xl transition-all ${
                            isListening 
                            ? 'text-red-400 bg-red-500/10 ring-1 ring-red-500/50 animate-pulse' 
                            : 'text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                    >
                        {isListening ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>

                    <button
                        onClick={() => handleSendMessage()}
                        disabled={(!inputValue.trim() && !selectedImage && !selectedTextFile) || isStreaming}
                        className={`p-3 rounded-xl transition-all ${
                            (!inputValue.trim() && !selectedImage && !selectedTextFile) || isStreaming
                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 active:scale-95'
                        }`}
                    >
                        {isStreaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                </div>
                <div className="text-center mt-3">
                     <p className="text-[10px] text-slate-600">
                        Gemini can make mistakes. Check important info.
                    </p>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};