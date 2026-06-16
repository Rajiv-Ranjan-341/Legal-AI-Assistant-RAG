"use client";

import { useEffect, useRef, useCallback } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
    Scale,
    ShieldCheck,
    FileText,
    Gavel,
    ArrowUp,
    Bot,
    Check,
    ChevronDown,
    Copy,
    CheckCircle,
    AlertTriangle,
    Eye,
    X,
    ChevronUp,
    Loader2,
    Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
// @ts-ignore
import { queryLegal } from "@/lib/api";
// @ts-ignore
import { useChat } from "@/lib/chat-context";

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

function useAutoResizeTextarea({
    minHeight,
    maxHeight,
}: UseAutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(
        (reset?: boolean) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            if (reset) {
                textarea.style.height = `${minHeight}px`;
                return;
            }

            textarea.style.height = `${minHeight}px`;
            const newHeight = Math.max(
                minHeight,
                Math.min(
                    textarea.scrollHeight,
                    maxHeight ?? Number.POSITIVE_INFINITY
                )
            );

            textarea.style.height = `${newHeight}px`;
        },
        [minHeight, maxHeight]
    );

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = `${minHeight}px`;
        }
    }, [minHeight]);

    useEffect(() => {
        const handleResize = () => adjustHeight();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

interface CommandSuggestion {
    icon: React.ReactNode;
    label: string;
    description: string;
    prefix: string;
}

interface ChatMsg {
    role: "user" | "assistant";
    content: string;
    sources?: any[];
    verified?: boolean;
    modeUsed?: string;
    responseTime?: string;
}

const MODES = [
    { value: "agentic", label: "Agentic", icon: <Bot className="w-4 h-4 text-violet-400" /> },
    { value: "direct", label: "Direct RAG", icon: <Scale className="w-4 h-4 text-amber-400" /> },
];

export function AnimatedAIChat() {
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 36,
        maxHeight: 150,
    });
    const [inputFocused, setInputFocused] = useState(false);
    const [selectedMode, setSelectedMode] = useState("direct");

    const { messages, setMessages, newChat, saveToHistory } = useChat();
    const [showSources, setShowSources] = useState(false);
    const [activeSources, setActiveSources] = useState<any[] | null>(null);
    const [activeStats, setActiveStats] = useState<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const commandSuggestions: CommandSuggestion[] = [
        {
            icon: <Gavel className="w-4 h-4" />,
            label: "Theft penalty",
            description: "Punishment for theft under IPC",
            prefix: "What is the punishment for theft under IPC?"
        },
        {
            icon: <ShieldCheck className="w-4 h-4" />,
            label: "Article 21",
            description: "Right to life and personal liberty",
            prefix: "Explain Article 21 of the Indian Constitution"
        },
        {
            icon: <FileText className="w-4 h-4" />,
            label: "FIR process",
            description: "How to file an FIR under CrPC",
            prefix: "What is the process to file an FIR under CrPC?"
        },
        {
            icon: <Scale className="w-4 h-4" />,
            label: "Murder vs culpable homicide",
            description: "Distinction under IPC sections 299 and 300",
            prefix: "What is the difference between murder and culpable homicide under IPC?"
        },
    ];

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey && value.trim()) {
            e.preventDefault();
            handleSendMessage(value.trim());
        }
    };

    const handleSendMessage = async (text?: string) => {
        const question = text || value.trim();
        if (!question || loading) return;

        setValue("");
        adjustHeight(true);

        const userMsg: ChatMsg = { role: "user", content: question };
        setMessages((prev: ChatMsg[]) => [...prev, userMsg]);
        setLoading(true);

        try {
            const res = await queryLegal(question, selectedMode);
            const aiMsg: ChatMsg = {
                role: "assistant",
                content: res.answer,
                sources: res.sources || [],
                verified: res.verified,
                modeUsed: res.mode_used,
                responseTime: res.responseTime,
            };
            setMessages((prev: ChatMsg[]) => [...prev, aiMsg]);
            setTimeout(() => saveToHistory(), 0);
        } catch (err: any) {
            const errorMsg: ChatMsg = {
                role: "assistant",
                content: `Error: ${err.response?.data?.detail || err.message || "Failed to get response. Is the backend running?"}`,
                verified: false,
            };
            setMessages((prev: ChatMsg[]) => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    const handleViewSources = (msg: ChatMsg) => {
        setActiveSources(msg.sources || null);
        setActiveStats({
            reranked: msg.sources?.length,
            time: msg.responseTime,
        });
        setShowSources(true);
    };

    const hasMessages = messages.length > 0;
    const currentMode = MODES.find((m) => m.value === selectedMode)!;

    return (
        <div className="h-full flex w-full bg-[#0a0a0b] text-white relative overflow-hidden">
            {/* Background blobs */}
            <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full mix-blend-normal filter blur-[128px] animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full mix-blend-normal filter blur-[128px] animate-pulse delay-700" />
                <div className="absolute top-1/4 right-1/3 w-64 h-64 bg-fuchsia-500/10 rounded-full mix-blend-normal filter blur-[96px] animate-pulse delay-1000" />
            </div>

            {/* Main chat area */}
            <div className="flex-1 flex flex-col min-w-0 relative z-10">
                {!hasMessages ? (
                    /* ── Landing State ── */
                    <div className="flex-1 flex flex-col items-center justify-center p-6">
                        <div className="w-full max-w-2xl mx-auto space-y-12">
                            <motion.div
                                className="relative z-10 space-y-12"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                            >
                                <div className="text-center space-y-3">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
                                        className="flex justify-center mb-2"
                                    >
                                        <img src="/logo.png" alt="Legal AI" className="w-20 h-20 object-contain drop-shadow-[0_0_15px_rgba(139,92,246,0.3)]" />
                                    </motion.div>
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2, duration: 0.5 }}
                                        className="inline-block"
                                    >
                                        <h1 className="text-3xl font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white/90 to-white/40 pb-1">
                                            Indian Legal AI Assistant
                                        </h1>
                                        <motion.div
                                            className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                            initial={{ width: 0, opacity: 0 }}
                                            animate={{ width: "100%", opacity: 1 }}
                                            transition={{ delay: 0.5, duration: 0.8 }}
                                        />
                                    </motion.div>
                                    <motion.p
                                        className="text-sm text-white/40 max-w-md mx-auto"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.3 }}
                                    >
                                        Ask any question about Indian law. Your answers are grounded in 4,034 indexed legal provisions with citation tracking.
                                    </motion.p>
                                </div>

                                {/* Input bar */}
                                <ChatInputBar
                                    value={value}
                                    setValue={setValue}
                                    textareaRef={textareaRef}
                                    adjustHeight={adjustHeight}
                                    handleKeyDown={handleKeyDown}
                                    handleSend={() => handleSendMessage()}
                                    loading={loading}
                                    setInputFocused={setInputFocused}
                                    selectedMode={selectedMode}
                                    setSelectedMode={setSelectedMode}
                                    currentMode={currentMode}
                                />

                                <div className="flex flex-wrap items-center justify-center gap-2">
                                    {commandSuggestions.map((suggestion, index) => (
                                        <motion.button
                                            key={suggestion.prefix}
                                            onClick={() => handleSendMessage(suggestion.prefix)}
                                            className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] hover:bg-white/[0.05] rounded-lg text-sm text-white/60 hover:text-white/90 transition-all relative group"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                        >
                                            {suggestion.icon}
                                            <span>{suggestion.label}</span>
                                            <motion.div
                                                className="absolute inset-0 border border-white/[0.05] rounded-lg"
                                                initial={false}
                                                animate={{ opacity: [0, 1], scale: [0.98, 1] }}
                                                transition={{ duration: 0.3, ease: "easeOut" }}
                                            />
                                        </motion.button>
                                    ))}
                                </div>
                            </motion.div>
                        </div>
                    </div>
                ) : (
                    /* ── Chat State ── */
                    <>
                        {/* Header */}
                        <div className="h-14 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl flex items-center px-6 shrink-0">
                            <span className="font-semibold text-white/90 text-sm">Indian Legal AI</span>
                            <span className="ml-3 text-xs text-white/30 px-2 py-0.5 rounded-full border border-white/[0.06]">
                                {currentMode.label}
                            </span>
                            <button
                                onClick={() => {
                                    newChat();
                                    setShowSources(false);
                                    setActiveSources(null);
                                }}
                                className="ml-auto text-xs text-white/40 hover:text-white/80 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/[0.05]"
                            >
                                New Chat
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-6 py-6">
                            <div className="max-w-3xl mx-auto flex flex-col gap-5">
                                <AnimatePresence initial={false}>
                                    {messages.map((msg: ChatMsg, i: number) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <MessageBubble
                                                message={msg}
                                                onViewSources={handleViewSources}
                                            />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                {loading && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex gap-3"
                                    >
                                        <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                                            <Scale className="w-4 h-4 text-violet-400" />
                                        </div>
                                        <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-4 py-3">
                                            <div className="flex items-center gap-2 text-sm text-white/50">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Searching legal database</span>
                                                <TypingDots />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        {/* Bottom input */}
                        <div className="border-t border-white/[0.06] px-6 py-4 bg-white/[0.01] backdrop-blur-xl">
                            <div className="max-w-3xl mx-auto">
                                <ChatInputBar
                                    value={value}
                                    setValue={setValue}
                                    textareaRef={textareaRef}
                                    adjustHeight={adjustHeight}
                                    handleKeyDown={handleKeyDown}
                                    handleSend={() => handleSendMessage()}
                                    loading={loading}
                                    setInputFocused={setInputFocused}
                                    selectedMode={selectedMode}
                                    setSelectedMode={setSelectedMode}
                                    currentMode={currentMode}
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Sources panel */}
            <AnimatePresence>
                {showSources && activeSources && activeSources.length > 0 && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 360, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="h-full border-l border-white/[0.06] bg-[#0d0d0f]/95 backdrop-blur-xl flex flex-col shrink-0 overflow-hidden relative z-10"
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                            <h3 className="text-sm font-semibold text-white/90">
                                Sources ({activeSources.length})
                            </h3>
                            <button
                                onClick={() => setShowSources(false)}
                                className="p-1 rounded hover:bg-white/[0.05] text-white/40 hover:text-white/80 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {activeStats && (
                            <div className="px-4 py-3 border-b border-white/[0.06]">
                                <p className="text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">Retrieval Stats</p>
                                <div className="flex flex-wrap gap-2">
                                    {activeStats.reranked && (
                                        <span className="text-xs bg-white/[0.04] text-white/50 px-2 py-1 rounded">
                                            Final: {activeStats.reranked}
                                        </span>
                                    )}
                                    {activeStats.time && (
                                        <span className="text-xs bg-violet-500/10 text-violet-300 px-2 py-1 rounded">
                                            {activeStats.time}s
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                            {activeSources.map((source: any, i: number) => (
                                <SourceCard key={i} source={source} index={i} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cursor glow */}
            {inputFocused && (
                <motion.div
                    className="fixed w-[50rem] h-[50rem] rounded-full pointer-events-none z-0 opacity-[0.02] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 blur-[96px]"
                    animate={{
                        x: mousePosition.x - 400,
                        y: mousePosition.y - 400,
                    }}
                    transition={{
                        type: "spring",
                        damping: 25,
                        stiffness: 150,
                        mass: 0.5,
                    }}
                />
            )}
        </div>
    );
}

/* ── Chat Input Bar ── */

interface ChatInputBarProps {
    value: string;
    setValue: (v: string) => void;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    adjustHeight: (reset?: boolean) => void;
    handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    handleSend: () => void;
    loading: boolean;
    setInputFocused: (v: boolean) => void;
    selectedMode: string;
    setSelectedMode: (v: string) => void;
    currentMode: { value: string; label: string; icon: React.ReactNode };
}

function ChatInputBar({
    value,
    setValue,
    textareaRef,
    adjustHeight,
    handleKeyDown,
    handleSend,
    loading,
    setInputFocused,
    selectedMode,
    setSelectedMode,
    currentMode,
}: ChatInputBarProps) {
    return (
        <motion.div
            className="bg-white/[0.06] border border-white/[0.08] rounded-full px-1.5 py-1.5 flex items-end gap-1"
            initial={{ scale: 0.98 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
        >
            {/* + button → mode selector */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className="shrink-0 w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.10] flex items-center justify-center transition-colors"
                        aria-label="Select mode"
                    >
                        <Plus className="w-4 h-4 text-white/50" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    className={cn(
                        "min-w-[11rem]",
                        "border-white/10",
                        "bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-800"
                    )}
                >
                    {MODES.map((mode) => (
                        <DropdownMenuItem
                            key={mode.value}
                            onSelect={() => setSelectedMode(mode.value)}
                            className="flex items-center justify-between gap-2 text-white/80 focus:bg-white/10 focus:text-white"
                        >
                            <div className="flex items-center gap-2">
                                {mode.icon}
                                <span>{mode.label}</span>
                            </div>
                            {selectedMode === mode.value && (
                                <Check className="w-4 h-4 text-violet-400" />
                            )}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Input */}
            <div className="flex-1 overflow-y-auto max-h-[150px] min-w-0">
                <Textarea
                    id="legal-ai-input"
                    value={value}
                    placeholder="Ask anything"
                    className="w-full bg-transparent border-none text-sm text-white placeholder:text-white/30 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-2 min-h-[36px]"
                    ref={textareaRef as React.Ref<HTMLTextAreaElement>}
                    rows={1}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    onChange={(e) => {
                        setValue(e.target.value);
                        adjustHeight();
                    }}
                />
            </div>

            {/* Right side: mode badge + send */}
            <div className="shrink-0 flex items-center gap-1.5">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={selectedMode}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-white/[0.04] text-[10px] text-white/30"
                    >
                        {currentMode.icon}
                    </motion.div>
                </AnimatePresence>

                <button
                    type="button"
                    className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                        value.trim()
                            ? "bg-white text-[#0A0A0B]"
                            : "bg-white/[0.06] text-white/20"
                    )}
                    aria-label="Send message"
                    disabled={!value.trim() || loading}
                    onClick={handleSend}
                >
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <ArrowUp
                            className={cn(
                                "w-4 h-4 transition-opacity duration-200",
                                value.trim() ? "opacity-100" : "opacity-30"
                            )}
                        />
                    )}
                </button>
            </div>
        </motion.div>
    );
}

/* ── Message Bubble ── */

function MessageBubble({
    message,
    onViewSources,
}: {
    message: ChatMsg;
    onViewSources: (msg: ChatMsg) => void;
}) {
    const [copied, setCopied] = useState(false);
    const isUser = message.role === "user";

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`flex gap-3 ${isUser ? "justify-end" : ""}`}>
            {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 mt-1">
                    <Scale className="w-4 h-4 text-violet-400" />
                </div>
            )}

            <div className={`max-w-[75%] ${isUser ? "order-first" : ""}`}>
                <div
                    className={cn(
                        "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                        isUser
                            ? "bg-white/[0.08] border border-white/[0.08] text-white/90"
                            : "bg-white/[0.03] border border-white/[0.06] text-white/85"
                    )}
                >
                    {isUser ? (
                        <p>{message.content}</p>
                    ) : (
                        <div
                            className="prose prose-invert prose-sm max-w-none
                                [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-white/90 [&_h1]:mt-3 [&_h1]:mb-2
                                [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-white/90 [&_h2]:mt-3 [&_h2]:mb-2
                                [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-white/90 [&_h3]:mt-2 [&_h3]:mb-1
                                [&_p]:text-white/80 [&_p]:mb-2
                                [&_li]:text-white/80
                                [&_strong]:text-violet-300
                                [&_code]:bg-white/[0.06] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                                [&_ul]:my-2 [&_ol]:my-2"
                        >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {message.content || ""}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>

                {!isUser && (
                    <div className="flex items-center gap-3 mt-2 ml-1">
                        {message.verified !== undefined && (
                            message.verified ? (
                                <span className="flex items-center gap-1 text-xs text-emerald-400/80">
                                    <CheckCircle className="w-3.5 h-3.5" /> Verified
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-xs text-amber-400/80">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Unverified
                                </span>
                            )
                        )}
                        {message.responseTime && (
                            <span className="text-xs text-white/25">{message.responseTime}s</span>
                        )}
                        {message.sources && message.sources.length > 0 && (
                            <button
                                onClick={() => onViewSources(message)}
                                className="flex items-center gap-1 text-xs text-white/40 hover:text-violet-300 transition-colors"
                            >
                                <Eye className="w-3.5 h-3.5" /> Sources ({message.sources.length})
                            </button>
                        )}
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1 text-xs text-white/30 hover:text-white/70 transition-colors"
                        >
                            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? "Copied" : "Copy"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Source Card ── */

function SourceCard({ source, index }: { source: any; index: number }) {
    const [expanded, setExpanded] = useState(false);
    const score = source.rerank_score || 0;
    const pct = Math.min(Math.max((score / 6) * 100, 5), 100);

    return (
        <div className="border border-white/[0.06] rounded-xl overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-3 flex items-start gap-3 hover:bg-white/[0.03] transition-colors text-left"
            >
                <span className="text-violet-400 font-bold text-sm mt-0.5">{index + 1}</span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-3.5 h-3.5 text-white/30 shrink-0" />
                        <span className="text-sm text-white/80 truncate">{source.source_file}</span>
                    </div>
                    <div className="flex gap-3 text-xs text-white/40">
                        {source.legal_section && <span>{source.legal_section}</span>}
                        {source.page && <span>Page {source.page}</span>}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                        <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-violet-400/60 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        <span className="text-white/30 w-10 text-right">{score.toFixed(2)}</span>
                    </div>
                </div>
                {expanded ? (
                    <ChevronUp className="w-4 h-4 text-white/30 shrink-0" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />
                )}
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-3 border-t border-white/[0.06]">
                            <p className="text-xs text-white/50 leading-relaxed mt-3 font-mono bg-white/[0.03] p-3 rounded-lg">
                                {source.excerpt}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ── Helpers ── */

function TypingDots() {
    return (
        <div className="flex items-center ml-1">
            {[1, 2, 3].map((dot) => (
                <motion.div
                    key={dot}
                    className="w-1.5 h-1.5 bg-white/90 rounded-full mx-0.5"
                    initial={{ opacity: 0.3 }}
                    animate={{
                        opacity: [0.3, 0.9, 0.3],
                        scale: [0.85, 1.1, 0.85],
                    }}
                    transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: dot * 0.15,
                        ease: "easeInOut",
                    }}
                    style={{ boxShadow: "0 0 4px rgba(255, 255, 255, 0.3)" }}
                />
            ))}
        </div>
    );
}

