import { useState } from 'react';
import { ChevronDown, ChevronRight, Terminal, Database, BookOpen, BrainCircuit, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming this now exists

export type ToolCall = {
  name: string;
  args: any;
  result?: any;
  status: 'running' | 'completed' | 'error';
};

export function ToolCallItem({ tool }: { tool: ToolCall }) {
    const [isOpen, setIsOpen] = useState(false);
    
    const isKnowledgeTool = tool.name.includes('read_file') || tool.name.includes('search') || tool.name.includes('knowledge');
    const isThinkingTool = tool.name.includes('think') || tool.name.includes('plan');
    const isVerificationTool = tool.name.includes('verify_integrity');

    const getIcon = (name: string) => {
        if (name.includes('verify_integrity')) return <CheckCircle2 className="w-3.5 h-3.5" />;
        if (name.includes('read_file')) return <BookOpen className="w-3.5 h-3.5" />;
        if (name.includes('search')) return <BookOpen className="w-3.5 h-3.5" />;
        if (name.includes('sql')) return <Database className="w-3.5 h-3.5" />;
        if (name.includes('python')) return <Terminal className="w-3.5 h-3.5" />;
        if (name.includes('think')) return <BrainCircuit className="w-3.5 h-3.5" />;
        return <Terminal className="w-3.5 h-3.5" />; // Default
    };

    const getTheme = () => {
        if (isVerificationTool) return {
            bg: "bg-purple-500/10",
            text: "text-purple-400",
            border: "border-purple-500/20",
            badge: "bg-purple-500/20 text-purple-300 border-purple-500/30",
            label: "CONSENSUS LOOP"
        };
        if (isKnowledgeTool) return {
            bg: "bg-indigo-500/10",
            text: "text-indigo-400",
            border: "border-indigo-500/20",
            badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
            label: "KNOWLEDGE ACCESS"
        };
        if (isThinkingTool) return {
            bg: "bg-amber-500/10",
            text: "text-amber-400",
            border: "border-amber-500/20",
            badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
            label: "REASONING"
        };
        return {
            bg: "bg-emerald-400/10",
            text: "text-emerald-400",
            border: "border-white/5", // Standard border
            badge: "hidden", 
            label: "" 
        };
    };

    const theme = getTheme();

    return (
        <div className={cn("rounded-lg border overflow-hidden text-xs font-mono transition-colors", theme.border, tool.status === 'running' ? "bg-neutral-900/80" : "bg-neutral-900/50")}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors text-left"
            >
                <div className={cn("p-1.5 rounded-md", theme.bg, theme.text, tool.status === 'running' && "animate-pulse")}>
                    {getIcon(tool.name)}
                </div>
                
                <div className="flex-1 min-w-0 flex items-center gap-3">
                    <span className={cn("font-semibold mr-2", isVerificationTool ? "text-purple-300" : isKnowledgeTool ? "text-indigo-300" : "text-neutral-300")}>{tool.name}</span>
                    
                    {/* Knowledge/Verification Badge */}
                    {(isKnowledgeTool || isVerificationTool) && (
                        <span className={cn("hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border", theme.badge)}>
                            {theme.label}
                        </span>
                    )}

                    <span className="text-neutral-500 truncate text-[11px] flex-1">
                        {tool.status === 'running' ? (
                            <span className={cn("font-semibold animate-pulse", isVerificationTool ? "text-purple-400" : "text-amber-400")}>
                                {isVerificationTool ? "Verifying Logic..." : "Executing..."}
                            </span>
                        ) : (
                            JSON.stringify(tool.args).substring(0, 60) + (JSON.stringify(tool.args).length > 60 ? '...' : '')
                        )}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                     {tool.status === 'completed' ? (
                         <CheckCircle2 className={cn("w-3.5 h-3.5", isKnowledgeTool ? "text-indigo-500" : "text-emerald-500")} />
                     ) : (
                         <div className={cn("w-3.5 h-3.5 rounded-full border-2 animate-spin", isKnowledgeTool ? "border-indigo-500/30 border-t-indigo-500" : "border-emerald-500/30 border-t-emerald-500")} />
                     )}
                     {isOpen ? <ChevronDown className="w-3 h-3 text-neutral-500" /> : <ChevronRight className="w-3 h-3 text-neutral-500" />}
                </div>
            </button>

            {isOpen && (
                <div className="border-t border-white/5 bg-neutral-950/30 p-3 space-y-2">
                    <div>
                        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Arguments</div>
                        <pre className="overflow-x-auto text-neutral-300 bg-neutral-900 p-2 rounded border border-white/5 scrollbar-thin scrollbar-thumb-neutral-700">
                            {JSON.stringify(tool.args, null, 2)}
                        </pre>
                    </div>
                    {tool.result && (
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Result</div>
                            <pre className={cn("overflow-x-auto p-2 rounded border border-white/5 max-h-60 scrollbar-thin scrollbar-thumb-neutral-700", isKnowledgeTool ? "text-indigo-300/90 bg-indigo-950/20" : "text-emerald-300/90 bg-neutral-900")}>
                                {typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
