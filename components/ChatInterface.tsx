import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, X, Settings, Trash2, Bot, User, Loader2, Sparkles, AlertCircle, FileText, Mic, StopCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { streamChatResponse, fileToBase64 } from '../services/geminiService';
import { Message, BotModel, ChatConfig } from '../types';

const DEFAULT_SYSTEM_INSTRUCTION = "You are a helpful, clever, and friendly AI assistant named Gemini.";

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export const ChatInterface: React.FC = () => {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedTextFile, setSelectedTextFile] = useState<{ name: string; content: string } | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<ChatConfig>({
    model: BotModel.FLASH,
    systemInstruction: DEFAULT_SYSTEM_INSTRUCTION
  });

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textFileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [inputValue]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      const base64 = await fileToBase64(file);
      setImagePreview(base64);
      // Reset file input
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
        // Handle error (optional toast)
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

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputValue((prev) => {
             const spacer = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
             return prev + spacer + transcript;
          });
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

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

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && !selectedImage && !selectedTextFile) || isStreaming) return;

    let userText = inputValue.trim();
    
    // Append text file content if present
    if (selectedTextFile) {
        userText = userText 
            ? `${userText}\n\n--- Attached File: ${selectedTextFile.name} ---\n${selectedTextFile.content}`
            : `--- Attached File: ${selectedTextFile.name} ---\n${selectedTextFile.content}`;
    }

    const userImage = imagePreview; // Base64 string
    
    // Create user message for UI
    // We show the raw text input in the UI, but not the full file content to save space, 
    // or we can show a visual indicator for the file.
    // For simplicity in this view, we'll show the file as an attachment chip in the bubble.
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputValue.trim(), // Show only the typed text
      image: userImage || undefined,
      timestamp: Date.now()
    };

    // We need a way to display that a file was sent in the history. 
    // Since Message type is strict, we will append a small indicator to the text in the UI 
    // if the input was empty but a file was sent.
    if (selectedTextFile && !userMessage.text) {
        userMessage.text = `Sent file: ${selectedTextFile.name}`;
    } else if (selectedTextFile) {
        // If there is text, we append a note
        userMessage.text += `\n(Attached: ${selectedTextFile.name})`;
    }

    // Optimistically add user message
    setMessages(prev => [...prev, userMessage]);
    
    // Reset inputs
    setInputValue("");
    clearAttachments();
    if (textareaRef.current) textareaRef.current.style.height = 'inherit';

    // Create placeholder for AI response
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
      // Send the full content (including file) to Gemini
      const stream = await streamChatResponse(
        messages, // send existing history
        userText, // This contains the combined text + file content
        userImage,
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
      
      // Finalize
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
        ? { ...msg, text: fullText, isStreaming: false } 
        : msg
      ));

    } catch (error: any) {
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
        ? { ...msg, text: "Sorry, I encountered an error processing your request.", isError: true, isStreaming: false } 
        : msg
      ));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full bg-slate-900/50 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-sm">
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white leading-tight">Gemini Chat</h1>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {config.model}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setMessages([])}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="Clear Chat"
            >
                <Trash2 className="w-5 h-5" />
            </button>
            <button 
                onClick={() => setShowConfig(!showConfig)}
                className={`p-2 rounded-lg transition-all ${showConfig ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="Settings"
            >
                <Settings className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* Configuration Panel (Collapsible) */}
      {showConfig && (
        <div className="bg-slate-900/80 border-b border-slate-800 p-6 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Model</label>
                    <select
                        value={config.model}
                        onChange={(e) => setConfig(c => ({ ...c, model: e.target.value as BotModel }))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        <option value={BotModel.FLASH}>Gemini 2.5 Flash (Fastest)</option>
                        <option value={BotModel.PRO}>Gemini 3.0 Pro (Reasoning)</option>
                        <option value={BotModel.LITE}>Gemini 2.5 Flash Lite (Economy)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">System Instructions</label>
                    <textarea 
                        value={config.systemInstruction}
                        onChange={(e) => setConfig(c => ({...c, systemInstruction: e.target.value}))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-[42px] focus:h-[100px] transition-all"
                        placeholder="How should the AI behave?"
                    />
                </div>
            </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4 opacity-60">
            <Bot className="w-16 h-16 text-slate-700" />
            <p className="text-lg font-medium">Start a conversation with Gemini</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
                key={msg.id} 
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'user' 
                    ? 'bg-indigo-600' 
                    : msg.isError ? 'bg-red-500/20' : 'bg-slate-700'
                }`}>
                    {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Sparkles className="w-4 h-4 text-indigo-300" />}
                </div>

                {/* Message Bubble */}
                <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    
                    {/* Image Attachment */}
                    {msg.image && (
                        <div className="rounded-xl overflow-hidden border border-slate-700/50 shadow-lg max-w-xs">
                             <img 
                                src={`data:image/jpeg;base64,${msg.image}`} 
                                alt="Attachment" 
                                className="w-full h-auto object-cover"
                            />
                        </div>
                    )}

                    {/* Text Content */}
                    {(msg.text || msg.isStreaming) && (
                         <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-md ${
                            msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-tr-none whitespace-pre-wrap'
                            : msg.isError 
                                ? 'bg-red-500/10 text-red-200 border border-red-500/20 rounded-tl-none'
                                : 'bg-slate-800 text-slate-200 border border-slate-700/50 rounded-tl-none'
                        }`}>
                            {msg.role === 'model' ? (
                                <ReactMarkdown 
                                    remarkPlugins={[remarkGfm]}
                                    className="prose prose-invert prose-sm max-w-none break-words"
                                >
                                    {msg.text}
                                </ReactMarkdown>
                            ) : (
                                msg.text
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
                </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-900 border-t border-slate-800">
        {/* Attachments Preview */}
        {(imagePreview || selectedTextFile) && (
            <div className="mb-3 flex flex-wrap items-start gap-2 animate-in slide-in-from-bottom-2 fade-in duration-200">
                {imagePreview && (
                    <div className="relative group">
                        <img src={`data:image/jpeg;base64,${imagePreview}`} alt="Preview" className="w-16 h-16 object-cover rounded-lg border border-slate-700" />
                        <button 
                            onClick={() => { setImagePreview(null); setSelectedImage(null); }}
                            className="absolute -top-2 -right-2 bg-slate-800 text-slate-400 hover:text-red-400 rounded-full p-1 border border-slate-700 shadow-sm"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                )}
                {selectedTextFile && (
                    <div className="relative group flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg p-2 pr-3">
                        <div className="bg-indigo-500/20 p-1.5 rounded">
                            <FileText className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-medium text-slate-300 truncate max-w-[150px]">{selectedTextFile.name}</span>
                            <span className="text-[10px] text-slate-500">Text File</span>
                        </div>
                        <button 
                            onClick={() => setSelectedTextFile(null)}
                            className="ml-2 text-slate-500 hover:text-red-400"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        )}
        
        <div className="flex items-end gap-2 bg-slate-800 rounded-xl p-2 border border-slate-700 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
           {/* Image Input */}
           <input 
             type="file" 
             ref={fileInputRef}
             onChange={handleImageSelect}
             className="hidden"
             accept="image/jpeg, image/png, image/webp"
           />
           <button 
             onClick={() => fileInputRef.current?.click()}
             className={`p-2.5 rounded-lg transition-colors flex-shrink-0 ${
                imagePreview ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-white hover:bg-slate-700'
             }`}
             title="Attach Image"
           >
             <ImageIcon className="w-5 h-5" />
           </button>

           {/* Text File Input */}
           <input 
             type="file" 
             ref={textFileInputRef}
             onChange={handleTextFileSelect}
             className="hidden"
             accept=".txt,.md,.py,.js,.json,.csv,.html,.css"
           />
           <button 
             onClick={() => textFileInputRef.current?.click()}
             className={`p-2.5 rounded-lg transition-colors flex-shrink-0 ${
                selectedTextFile ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-white hover:bg-slate-700'
             }`}
             title="Attach Text File"
           >
             <FileText className="w-5 h-5" />
           </button>

           <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 bg-transparent text-white text-sm placeholder:text-slate-500 focus:outline-none py-2.5 max-h-[150px] resize-none overflow-y-auto"
              rows={1}
           />

           {/* Voice Input */}
           <button
             onClick={toggleListening}
             className={`p-2.5 rounded-lg transition-all flex-shrink-0 ${
                isListening 
                 ? 'text-red-500 bg-red-500/10 animate-pulse' 
                 : 'text-slate-400 hover:text-white hover:bg-slate-700'
             }`}
             title={isListening ? "Stop Recording" : "Voice Input"}
           >
             {isListening ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
           </button>

           <button
             onClick={handleSendMessage}
             disabled={(!inputValue.trim() && !selectedImage && !selectedTextFile) || isStreaming}
             className={`p-2.5 rounded-lg flex-shrink-0 transition-all ${
                (!inputValue.trim() && !selectedImage && !selectedTextFile) || isStreaming
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
             }`}
           >
             {isStreaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
           </button>
        </div>
        <p className="text-center text-[10px] text-slate-600 mt-2">
            Gemini can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
};