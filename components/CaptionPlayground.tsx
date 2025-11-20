import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Send, Loader2, UploadCloud, RefreshCw, Info, Zap } from 'lucide-react';
import { generateImageCaption, fileToBase64 } from '../services/geminiService';
import { BotModel } from '../types';

export const CaptionPlayground: React.FC = () => {
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("Describe this image in detail for a Telegram caption.");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setResult(""); // Clear previous result
      setError(null);
    }
  };

  const handleGenerate = async () => {
    if (!image) return;

    setLoading(true);
    setError(null);
    setResult("");

    try {
      const base64 = await fileToBase64(image);
      const mimeType = image.type;
      
      // Use Flash for playground as it's fast
      const caption = await generateImageCaption(base64, mimeType, prompt, BotModel.FLASH);
      setResult(caption);
    } catch (err: any) {
      setError(err.message || "Failed to generate caption");
    } finally {
      setLoading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-12rem)] min-h-[600px]">
      {/* Left Column: Input */}
      <div className="flex flex-col gap-4 bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm h-full">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-indigo-400" />
          Input Source
        </h3>
        
        <div 
          className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden group ${
            imagePreview 
              ? 'border-slate-700 bg-slate-900' 
              : 'border-slate-700 hover:border-indigo-500 hover:bg-slate-800/50 cursor-pointer'
          }`}
          onClick={!imagePreview ? triggerFileInput : undefined}
        >
          {imagePreview ? (
            <>
              <img 
                src={imagePreview} 
                alt="Preview" 
                className="w-full h-full object-contain p-4" 
              />
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setImage(null);
                  setImagePreview(null);
                  setResult("");
                }}
                className="absolute top-4 right-4 bg-slate-900/80 hover:bg-red-500/80 text-white p-2 rounded-full backdrop-blur-md transition-colors border border-white/10"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-8 h-8 text-indigo-400" />
              </div>
              <p className="text-slate-300 font-medium">Click to upload an image</p>
              <p className="text-slate-500 text-sm mt-1">Support JPG, PNG</p>
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/jpeg, image/png, image/webp"
            onChange={handleImageUpload}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-400">Prompt</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Ask Gemini something about the image..."
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
            <button
              onClick={handleGenerate}
              disabled={!image || loading}
              className={`px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                !image || loading
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
              }`}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {loading ? 'Thinking...' : 'Run'}
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Output */}
      <div className="flex flex-col bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm h-full relative overflow-hidden">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          {BotModel.FLASH === 'gemini-2.5-flash' ? <Zap className="w-5 h-5 text-amber-400" /> : <Info className="w-5 h-5" />}
          Gemini Response
        </h3>

        <div className="flex-1 bg-slate-950/50 rounded-xl border border-slate-800/50 p-6 overflow-y-auto font-mono text-sm leading-relaxed">
          {loading ? (
             <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                <p className="animate-pulse">Analyzing pixels...</p>
             </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center text-red-400 space-y-2">
                <Info className="w-8 h-8" />
                <p className="text-center max-w-xs">{error}</p>
            </div>
          ) : result ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <p className="whitespace-pre-wrap text-slate-300">{result}</p>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-600">
                <p>Upload an image and click run to see the magic.</p>
            </div>
          )}
        </div>

        {/* Stats/Meta */}
        {result && !loading && (
            <div className="mt-4 flex items-center gap-4 text-xs text-slate-500 border-t border-slate-800 pt-4">
                <span>Model: gemini-2.5-flash</span>
                <span>Status: Success</span>
                <span>Time: {new Date().toLocaleTimeString()}</span>
            </div>
        )}
      </div>
    </div>
  );
};