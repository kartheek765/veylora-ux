import React from 'react';
import { Sparkles } from 'lucide-react';

interface AskVeyloraButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export const AskVeyloraButton: React.FC<AskVeyloraButtonProps> = ({ onClick, isOpen }) => {
  if (isOpen) return null; // Hide floating trigger when panel is already expanded

  return (
    <button
      onClick={onClick}
      aria-label="Open Ask Veylora AI assistant"
      title="Ask Veylora — Product & Screen Guide"
      className="fixed bottom-6 right-6 z-40 group flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-indigo-600 via-indigo-500 to-primary-600 hover:from-indigo-500 hover:to-primary-500 text-white rounded-full shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 border border-indigo-400/30 transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-background"
    >
      <div className="relative flex items-center justify-center">
        <Sparkles className="w-5 h-5 text-white animate-pulse" />
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-background" />
      </div>
      <span className="text-sm font-semibold tracking-wide">Ask Veylora</span>
    </button>
  );
};
