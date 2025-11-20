import React, { useState, useEffect } from 'react';
import { Settings, Key, FileText, MessageSquare, Download, Code, Zap } from 'lucide-react';
import { CodeDisplay } from './CodeDisplay';
import { BotModel } from '../types';

const DEFAULT_SYSTEM_PROMPT = "Describe this image in detail for visually impaired users. Be concise but descriptive. Include main objects, colors, and text if present.";

export const BotGenerator: React.FC = () => {
  const [config, setConfig] = useState({
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    model: BotModel.FLASH,
    botTokenPlaceholder: 'YOUR_TELEGRAM_BOT_TOKEN',
    apiKeyPlaceholder: 'YOUR_GEMINI_API_KEY',
  });

  const [generatedCode, setGeneratedCode] = useState('');
  const [requirementsCode, setRequirementsCode] = useState('');

  // Function to generate the Python code string
  const generatePythonCode = () => {
    const code = `import os
import logging
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler, MessageHandler, filters
from google import genai
from google.genai import types
import base64

# --- Configuration ---
# Replace these with your actual keys or use environment variables
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "${config.botTokenPlaceholder}")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "${config.apiKeyPlaceholder}")

# Model Configuration
MODEL_ID = "${config.model}"
SYSTEM_PROMPT = """${config.systemPrompt}"""

# --- Setup Logging ---
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# --- Initialize Gemini Client ---
client = genai.Client(api_key=GEMINI_API_KEY)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send a welcome message when the command /start is issued."""
    await context.bot.send_message(
        chat_id=update.effective_chat.id,
        text="👋 Hi! I'm an Auto-Caption Bot.\\n\\nSend me a photo and I will describe it for you using Gemini AI!"
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send a help message."""
    await context.bot.send_message(
        chat_id=update.effective_chat.id,
        text="Simply send an image (compressed or as a file) and I will caption it."
    )

async def process_image(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Download image, send to Gemini, and reply with caption."""
    user = update.message.from_user
    logging.info(f"Processing image from user {user.first_name} (ID: {user.id})")
    
    status_msg = await update.message.reply_text("👀 Analyzing image...")
    
    try:
        # 1. Get the photo file
        # Telegram sends multiple sizes, take the largest
        photo_file = await update.message.photo[-1].get_file()
        
        # 2. Download the file into memory (bytearray)
        image_bytes = await photo_file.download_as_bytearray()
        
        # 3. Prepare input for Gemini (Base64)
        # The Google GenAI Python SDK accepts bytes or base64
        b64_image = base64.b64encode(image_bytes).decode('utf-8')
        
        # 4. Call Gemini API
        logging.info(f"Sending request to {MODEL_ID}...")
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=[
                types.Content(
                    parts=[
                        types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                        types.Part.from_text(text=SYSTEM_PROMPT),
                    ]
                )
            ]
        )
        
        caption = response.text
        
        # 5. Reply to user
        await context.bot.edit_message_text(
            chat_id=update.effective_chat.id,
            message_id=status_msg.message_id,
            text=caption
        )
        
    except Exception as e:
        logging.error(f"Error processing image: {e}")
        await context.bot.edit_message_text(
            chat_id=update.effective_chat.id,
            message_id=status_msg.message_id,
            text="❌ Sorry, I encountered an error analyzing the image."
        )

if __name__ == '__main__':
    if not TELEGRAM_BOT_TOKEN or "YOUR_" in TELEGRAM_BOT_TOKEN:
        print("⚠️  WARNING: Please set a valid TELEGRAM_BOT_TOKEN")
    if not GEMINI_API_KEY or "YOUR_" in GEMINI_API_KEY:
        print("⚠️  WARNING: Please set a valid GEMINI_API_KEY")

    application = ApplicationBuilder().token(TELEGRAM_BOT_TOKEN).build()
    
    # Handlers
    start_handler = CommandHandler('start', start)
    help_handler = CommandHandler('help', help_command)
    image_handler = MessageHandler(filters.PHOTO, process_image)
    
    application.add_handler(start_handler)
    application.add_handler(help_handler)
    application.add_handler(image_handler)
    
    print("🤖 Bot is running...")
    application.run_polling()
`;
    setGeneratedCode(code);
    setRequirementsCode(`python-telegram-bot==20.8\ngoogle-genai`);
  };

  useEffect(() => {
    generatePythonCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Configuration Panel */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 shadow-lg backdrop-blur-sm sticky top-24">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-800">
            <Settings className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-semibold text-white">Bot Configuration</h3>
          </div>

          <div className="space-y-5">
            
            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4" /> Gemini Model
              </label>
              <select
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value as BotModel })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              >
                <option value={BotModel.FLASH}>Gemini 2.5 Flash (Recommended)</option>
                <option value={BotModel.LITE}>Gemini 2.5 Flash Lite</option>
                <option value={BotModel.PRO}>Gemini 2.5 Pro (Higher Cost)</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">Flash is fastest for real-time bots.</p>
            </div>

            {/* System Prompt */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Prompt Instruction
              </label>
              <textarea
                value={config.systemPrompt}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                rows={4}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none"
                placeholder="Enter instructions for the AI..."
              />
            </div>

            {/* Placeholders (Optional) */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                <Key className="w-4 h-4" /> Token Placeholders
              </label>
              <div className="space-y-3">
                <input
                    type="text"
                    value={config.botTokenPlaceholder}
                    onChange={(e) => setConfig({ ...config, botTokenPlaceholder: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 outline-none"
                    placeholder="Bot Token Variable Name"
                />
                <input
                    type="text"
                    value={config.apiKeyPlaceholder}
                    onChange={(e) => setConfig({ ...config, apiKeyPlaceholder: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 outline-none"
                    placeholder="API Key Variable Name"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
                <p className="text-xs text-slate-500 leading-relaxed">
                    Changes update the code instantly. Copy the code to a <code>main.py</code> file and run it.
                </p>
            </div>

          </div>
        </div>
      </div>

      {/* Code Output */}
      <div className="lg:col-span-2 space-y-6">
         <CodeDisplay 
            title="bot.py" 
            language="python" 
            code={generatedCode} 
         />
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <CodeDisplay 
                title="requirements.txt" 
                language="text" 
                code={requirementsCode} 
             />
             
             <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-6">
                <h4 className="text-indigo-400 font-medium flex items-center gap-2 mb-3">
                    <Code className="w-4 h-4" /> Quick Start
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300 marker:text-indigo-500">
                    <li>Install Python 3.8+</li>
                    <li>Save the code files locally.</li>
                    <li>Run <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300">pip install -r requirements.txt</span></li>
                    <li>Set your env vars or edit the placeholders.</li>
                    <li>Run <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300">python bot.py</span></li>
                </ol>
             </div>
         </div>
      </div>
    </div>
  );
};