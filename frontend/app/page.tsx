'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, ChevronDown, ChevronRight, Terminal, Database, FileText, CheckCircle2, BookOpen, BrainCircuit } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Dashboard from '../components/Dashboard';


function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ToolCall = {
  name: string;
  args: any;
  result?: any;
  status: 'running' | 'completed' | 'error';
};

// New: Chronological parts
type PartType = 'text' | 'tool_call';

type MessagePart = 
  | { type: 'text', content: string }
  | { type: 'tool_call', call: ToolCall };

type Message = {
  role: 'user' | 'agent';
  parts: MessagePart[];
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // 1. User Message
    const userMessage: Message = { 
        role: 'user', 
        parts: [{ type: 'text', content: input }] 
    };
    setMessages(prev => [...prev, userMessage]);
    
    setInput('');
    setIsLoading(true);

    // 2. Initial Agent Message (Empty)
    setMessages(prev => [...prev, { role: 'agent', parts: [] }]);

    try {
      // Build history for the API
      // Note: We need to reconstruct the "text" content from parts for the API's history format
      const history = messages.map(m => {
          const textContent = m.parts
            .filter(p => p.type === 'text')
            .map(p => (p as { type: 'text', content: string }).content)
            .join('');
            
          return {
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: textContent }]
          };
      });
      // Append the new user message we just added
      const lastUserText = userMessage.parts.find(p => p.type === 'text') as { type: 'text', content: string } | undefined;
      history.push({ role: 'user', parts: [{ text: lastUserText?.content || '' }] });

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: lastUserText?.content || '', history })
      });

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let buffer = '';
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        const lines = buffer.split('\n');
        // The last line might be incomplete, so we keep it in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
             if (line.trim() === '') continue;
             
             try {
                const event = JSON.parse(line);
                
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMsgIndex = newMessages.length - 1;
                    const lastMsg = { ...newMessages[lastMsgIndex] }; 
                    const parts = [...lastMsg.parts]; 
                    
                    const lastPartIndex = parts.length - 1;
                    const lastPart = parts[lastPartIndex];

                    if (event.type === 'text') {
                        // Merge with previous text part if exists
                        if (lastPart && lastPart.type === 'text') {
                            parts[lastPartIndex] = { ...lastPart, content: lastPart.content + event.content };
                        } else {
                            parts.push({ type: 'text', content: event.content });
                        }

                    } else if (event.type === 'tool_call') {
                        // Always a NEW part for a tool call
                        parts.push({ 
                            type: 'tool_call', 
                            call: { name: event.name, args: event.args, status: 'running' } 
                        });

                    } else if (event.type === 'tool_result') {
                        let foundIndex = -1;
                        for (let i = parts.length - 1; i >= 0; i--) {
                            if (parts[i].type === 'tool_call') {
                                const p = parts[i] as { type: 'tool_call', call: ToolCall };
                                if (p.call.name === event.name && p.call.status === 'running') {
                                    foundIndex = i;
                                    break;
                                }
                            }
                        }

                        if (foundIndex !== -1) {
                            parts[foundIndex] = {
                                ...parts[foundIndex],
                                call: {
                                    ...(parts[foundIndex] as any).call,
                                    result: event.result,
                                    status: 'completed'
                                }
                            } as MessagePart;
                        }

                    } else if (event.type === 'error') {
                        parts.push({ type: 'text', content: `\n[Error: ${event.error}]` });
                    }
                    
                    lastMsg.parts = parts;
                    newMessages[lastMsgIndex] = lastMsg;
                    return newMessages;
                });

             } catch (e) {
                 console.error('Error parsing JSON chunk', line, e);
             }
        }
      }

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          lastMsg.parts = [...lastMsg.parts, { type: 'text', content: '\nSorry, something went wrong.' }];
          return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-neutral-950 text-neutral-200 font-sans selection:bg-indigo-500/30">
      
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-neutral-950/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex flex-col gap-1">
             <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                <h1 className="font-bold text-xl tracking-tight text-white flex items-center gap-2">
                    Agentic Orchestration Layer
                </h1>
             </div>
             <p className="text-xs text-neutral-400 font-medium ml-4">
                Service-as-a-Software. <span className="text-neutral-600 mx-1">|</span> Universal Analyst. <span className="text-neutral-600 mx-1">|</span> System 2 Reasoning.
             </p>
          </div>
          
          {/* Tech Stats / Cool Details */}
          <div className="hidden md:flex items-center gap-4 text-[10px] font-mono text-neutral-600 border border-white/5 rounded-full px-3 py-1 bg-neutral-900/50">
             <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                <span>AGENT: ONLINE</span>
             </div>
             <div className="w-px h-3 bg-white/10" />
             <div className="flex items-center gap-1.5">
                <BrainCircuit className="w-3 h-3" />
                <span>SYSTEM 2: ACTIVE</span>
             </div>
             <div className="w-px h-3 bg-white/10" />
             <div>MODE: CAG</div>
             <div className="w-px h-3 bg-white/10" />
             <div className="flex items-center gap-1.5 text-indigo-400">
                <div className="w-1.5 h-1.5 rounded-sm bg-indigo-500 animate-pulse" />
                <span>MEMORY: SELF-CORRECTING</span>
             </div>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto px-4 py-8">
        <div className="flex-1 space-y-8 min-h-[50vh]">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full opacity-30 mt-20">
              <Database className="w-16 h-16 mb-4" />
              <p className="text-xl font-medium">Ready to Orchestrate</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={cn("flex flex-col gap-2", msg.role === 'user' ? "items-end" : "items-start")}>
              
              {/* Chronological Render Loop */}
              {msg.parts.map((part, pIdx) => {

                  
                  if (part.type === 'tool_call') {
                      return (
                          <div key={pIdx} className="w-full max-w-2xl mb-2">
                              {part.call.name === 'render_dashboard'
                                  ? <Dashboard {...part.call.args} />
                                  : <ToolCallItem tool={part.call} />
                              }
                          </div>
                      );
                  }

                  if (part.type === 'text') {
                      if (!part.content.trim()) return null;
                      return (
                        <div key={pIdx}
                            className={cn(
                                "max-w-[85%] rounded-2xl px-6 py-5 shadow-sm text-sm leading-7",
                                msg.role === 'user' 
                                    ? "bg-indigo-600 text-white rounded-br-none shadow-indigo-500/20" 
                                    : "bg-neutral-900 border border-white/10 text-neutral-300 rounded-bl-none w-full shadow-black/40"
                            )}
                        >
                            {msg.role === 'user' ? (
                                <div className="whitespace-pre-wrap font-medium">{part.content}</div>
                            ) : (
                                <div className="markdown-prose space-y-4">
                                    <ReactMarkdown 
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-8 mb-6 text-white border-b border-white/10 pb-4 flex items-center gap-3 tracking-tight" {...props} />,
                                            h2: ({node, ...props}) => <h2 className="text-xl font-semibold mt-8 mb-4 text-emerald-400 flex items-center gap-2 tracking-tight" {...props} />,
                                            h3: ({node, ...props}) => <h3 className="text-lg font-medium mt-6 mb-3 text-indigo-300" {...props} />,
                                            p: ({node, ...props}) => <p className="mb-4 last:mb-0 leading-7 text-neutral-300/90 text-[15px]" {...props} />,
                                            ul: ({node, ...props}) => <ul className="list-disc list-outside ml-6 mb-6 space-y-2 text-neutral-300/90 marker:text-emerald-500/50" {...props} />,
                                            ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-6 mb-6 space-y-2 text-neutral-300/90 marker:text-emerald-500/50" {...props} />,
                                            li: ({node, ...props}) => <li className="pl-1" {...props} />,
                                            blockquote: ({node, ...props}) => (
                                                <blockquote className="border-l-[3px] border-emerald-500/30 bg-gradient-to-r from-emerald-500/5 to-transparent py-4 px-6 rounded-r-xl italic text-neutral-300 my-6 shadow-inner" {...props} />
                                            ),
                                            code: ({node, className, children, ...props}) => {
                                                // @ts-ignore
                                                const inline = props.inline;
                                                const content = String(children);
                                                const isShort = content.length < 60 && !content.includes('\n');
                                                const shouldUseInline = inline || isShort;

                                                return shouldUseInline 
                                                    ? <code className="bg-white/10 px-1.5 py-0.5 rounded-md text-emerald-200 font-mono text-xs border border-white/5 whitespace-pre-wrap break-all" {...props}>{children}</code>
                                                    : <code className="block bg-[#0A0A0A] p-4 rounded-xl border border-white/5 font-mono text-xs my-4 overflow-x-auto text-emerald-300/90 shadow-2xl" {...props}>{children}</code>
                                            },
                                            table: ({node, ...props}) => (
                                                <div className="overflow-hidden rounded-xl border border-white/5 my-8 shadow-2xl bg-[#0A0A0A]">
                                                    <table className="w-full text-left border-collapse" {...props} />
                                                </div>
                                            ),
                                            thead: ({node, ...props}) => <thead className="bg-white/5 text-neutral-200" {...props} />,
                                            th: ({node, ...props}) => <th className="p-4 border-b border-white/5 font-semibold text-xs uppercase tracking-wider text-neutral-400 select-none" {...props} />,
                                            td: ({node, ...props}) => <td className="p-4 border-b border-white/5 text-neutral-300 text-sm tabular-nums" {...props} />,
                                            hr: ({node, ...props}) => <hr className="my-10 border-white/5" {...props} />,
                                            strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                                            a: ({node, ...props}) => <a className="text-emerald-400 hover:text-emerald-300 hover:underline transition-colors decoration-emerald-500/30 underline-offset-4" target="_blank" rel="noopener noreferrer" {...props} />,
                                        }}
                                    >
                                        {part.content}
                                    </ReactMarkdown>
                                </div>
                            )}
                        </div>
                      );
                  }
                  return null;
              })}

            </div>
          ))}
          
           {isLoading && messages[messages.length-1]?.role === 'agent' && messages[messages.length-1].parts.length === 0 && (
              <FunnyLoader />
           )}

           {isLoading && messages[messages.length-1]?.role === 'agent' && messages[messages.length-1].parts.length > 0 && (
              <StreamingIndicator />
           )}

           <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 z-50 bg-neutral-950/80 backdrop-blur-md border-t border-white/5 pb-8 pt-4 px-4">
         <div className="max-w-4xl mx-auto relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
            <form onSubmit={handleSubmit} className="relative flex items-center bg-neutral-900 rounded-xl border border-white/10 shadow-xl overflow-hidden focus-within:border-white/20 transition-colors">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Fragen Sie nach Umsatz, Kunden oder Analysen..."
                    className="flex-1 bg-transparent border-0 px-5 py-4 text-white placeholder-neutral-500 focus:ring-0 focus:outline-none"
                    disabled={isLoading}
                />
                <button 
                    type="submit" 
                    disabled={isLoading || !input.trim()}
                    className="mr-2 p-2.5 rounded-lg text-indigo-400 hover:text-white hover:bg-white/5 disabled:opacity-50 disabled:hover:bg-transparent transition-all"
                >
                    <Send className="w-5 h-5" />
                </button>
            </form>
            <div className="mt-2 text-center text-xs text-neutral-600 font-mono">
                Powered by Gemini 2.5 Pro • Supabase • E2B
            </div>
         </div>
      </div>
    </main>
  );
}

function StreamingIndicator() {
  return (
    <div className="flex items-center gap-2 text-neutral-500 text-xs font-mono ml-4 animate-in fade-in duration-300 mt-2 mb-4">
        <div className="flex gap-1">
            <div className="h-1 w-1 bg-emerald-500/50 rounded-full animate-bounce delay-75" />
            <div className="h-1 w-1 bg-emerald-500/50 rounded-full animate-bounce delay-150" />
            <div className="h-1 w-1 bg-emerald-500/50 rounded-full animate-bounce delay-200" />
        </div>
        <span className="animate-pulse">Generating...</span>
    </div>
  );
}

function ToolCallItem({ tool }: { tool: ToolCall }) {
    const [isOpen, setIsOpen] = useState(false);
    
    const isKnowledgeTool = tool.name.includes('read_file') || tool.name.includes('search') || tool.name.includes('knowledge');
    const isThinkingTool = tool.name.includes('think') || tool.name.includes('plan');

    const getIcon = (name: string) => {
        if (name.includes('read_file')) return <BookOpen className="w-3.5 h-3.5" />;
        if (name.includes('search')) return <BookOpen className="w-3.5 h-3.5" />;
        if (name.includes('sql')) return <Database className="w-3.5 h-3.5" />;
        if (name.includes('python')) return <Terminal className="w-3.5 h-3.5" />;
        if (name.includes('think')) return <BrainCircuit className="w-3.5 h-3.5" />;
        return <Terminal className="w-3.5 h-3.5" />; // Default
    };

    const getTheme = () => {
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
                    <span className={cn("font-semibold mr-2", isKnowledgeTool ? "text-indigo-300" : "text-neutral-300")}>{tool.name}</span>
                    
                    {/* Knowledge Badge */}
                    {isKnowledgeTool && (
                        <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Knowledge Base
                        </span>
                    )}

                    <span className="text-neutral-500 truncate text-[11px] flex-1">
                        {JSON.stringify(tool.args).substring(0, 60)}...
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

function FunnyLoader() {
  const [msgIndex, setMsgIndex] = useState(0);
  
  const loadingMessages = [
    "Optimiere den Cap Table...",
    "Verbrenne Venture Capital...",
    "Suche nach Product-Market-Fit...",
    "Erkläre dem neuronalen Netz 'EBITDA'...",
    "Ignoriere Technical Debt...",
    "Generiere Hockey-Stick-Chart...",
    "Pivot to AI...",
    "Frage Sam Altman nach GPUs...",
    "Skaliere den Hype-Cycle...",
    "Ersetze Junior Developer durch Skripte...",
    "Kalkuliere Runway bis zur Series B...",
    "Disruptiere die Kaffeemaschine...",
    "Überzeuge VCs mit Buzzwords...",
    "Fake it till you make it..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000); // Slightly faster rotation
    return () => clearInterval(interval);
  }, [loadingMessages.length]);

  return (
    <div className="flex items-center gap-3 text-indigo-400 text-sm font-mono ml-2 animate-in fade-in slide-in-from-bottom-2 duration-500 my-4">
        <div className="flex gap-1">
            <div className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce delay-75" />
            <div className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce delay-150" />
            <div className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce delay-200" />
        </div>
        <span className="italic">{loadingMessages[msgIndex]}</span>
    </div>
  );
}
