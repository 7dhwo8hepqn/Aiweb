import React from 'react';
import { ChatInterface } from './components/ChatInterface';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white overflow-hidden">
        <main className="flex-1 flex flex-col h-[100dvh] p-4 sm:p-6 lg:p-8">
             <ChatInterface />
        </main>
    </div>
  );
}