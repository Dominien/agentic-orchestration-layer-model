import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, BrainCircuit, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolCall, ToolCallItem } from './ToolCallItem';

interface ThinkingProcessProps {
  thoughts: string[];
  tools?: ToolCall[];
  isComplete: boolean;
}

export function ThinkingProcess({ thoughts, isComplete }: ThinkingProcessProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dots, setDots] = useState('');

  // Pulsing dots animation for "Thinking..." state
  useEffect(() => {
    if (isComplete) return;
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, [isComplete]);
  
  if (thoughts.length === 0) return null;

  const fullThought = thoughts.join('');

  return (
    <div className="w-full max-w-2xl mb-4">
      <div 
        className={cn(
            "rounded-lg overflow-hidden border transition-all duration-200",
            isOpen 
                ? "bg-neutral-900 border-neutral-800 shadow-sm"
                : "bg-transparent border-transparent hover:bg-neutral-900/30"
        )}
      >
        <button 
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-3 py-2 w-full text-left group"
        >
            <div className={cn(
                "p-1 rounded-sm transition-colors",
                isComplete ? "text-neutral-500" : "text-amber-500/80 bg-amber-500/10"
            )}>
                {isComplete ? (
                    <BrainCircuit className="w-3.5 h-3.5" />
                ) : (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
            </div>
            
            <div className="flex-1 text-xs font-medium text-neutral-500 group-hover:text-neutral-400 transition-colors font-mono uppercase tracking-wide flex items-center gap-2">
                <span>{isComplete ? "Thinking Process" : "Thinking..."}</span>
            </div>

            {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-neutral-600" /> : <ChevronRight className="w-3.5 h-3.5 text-neutral-600" />}
        </button>

        {isOpen && (
            <div className="px-4 pb-4 pt-1 space-y-4">
                {/* Thoughts */}
                {fullThought && (
                    <div className="text-[11px] leading-relaxed font-mono text-neutral-400 whitespace-pre-wrap border-l-2 border-neutral-800 pl-3">
                        {fullThought}
                        {!isComplete && <span className="inline-block w-1.5 h-3 bg-amber-500/50 ml-1 animate-pulse align-middle" />}
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
}
