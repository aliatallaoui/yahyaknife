import React, { useState, useRef, useEffect, useContext } from 'react';
import { Bot, X, Send, User, Sparkles, Loader2 } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function CopilotWidget() {
    const { t } = useTranslation();
    const { auth } = useContext(AuthContext);

    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'ai', text: "Hello! I am Cortex AI, your enterprise assistant. What can I do for you today?" }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    const messagesEndRef = useRef(null);

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleSendMessage = async (e) => {
        e?.preventDefault();
        if (!input.trim() || isTyping) return;

        const userMessage = { role: 'user', text: input.trim() };
        const updatedMessages = [...messages, userMessage];

        setMessages(updatedMessages);
        setInput('');
        setIsTyping(true);

        try {
            const res = await apiFetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: updatedMessages })
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.reply || data.error || "Request failed");
            }

            if (data?.reply) {
                setMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
            } else {
                throw new Error("Invalid response format");
            }
        } catch (error) {
            const errorMsg = error.message || "Sorry, I am having trouble connecting to my central node. Please try again later.";
            setMessages(prev => [...prev, { role: 'ai', text: errorMsg, isError: true }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="fixed bottom-6 end-6 z-50 flex flex-col items-end">

            {/* Chat Window */}
            {isOpen && (
                <div className="w-[380px] h-[550px] max-w-[calc(100vw-3rem)] max-h-[calc(100vh-6rem)] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden mb-4 transition-all duration-300 origin-bottom-right">

                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 flex items-center justify-between text-white shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm leading-tight">Cortex AI Copilot</h3>
                                <p className="text-xs text-blue-100 opacity-90">Enterprise Assistant</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-gray-50/50 dark:bg-gray-900/50">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ms-auto flex-row-reverse' : ''}`}>

                                {/* Avatar */}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                                    }`}>
                                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-5 h-5" />}
                                </div>

                                {/* Message Bubble */}
                                <div className={`p-3 rounded-2xl text-sm ${msg.role === 'user'
                                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                                    : msg.isError
                                        ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-800 rounded-tl-sm'
                                        : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-600 shadow-sm rounded-tl-sm'
                                    }`}>
                                    {msg.role === 'user' ? (
                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                    ) : (
                                        <div className="prose prose-sm prose-indigo dark:prose-invert max-w-none
                                            prose-p:leading-relaxed prose-p:my-1
                                            prose-ul:my-1 prose-ul:pl-4
                                            prose-li:my-0.5
                                            prose-strong:text-indigo-900 dark:prose-strong:text-indigo-300 prose-strong:font-semibold
                                            prose-table:border-collapse prose-table:w-full prose-table:my-2
                                            prose-th:border prose-th:border-gray-200 dark:prose-th:border-gray-600 prose-th:px-2 prose-th:py-1 prose-th:bg-gray-50 dark:prose-th:bg-gray-700
                                            prose-td:border prose-td:border-gray-200 dark:prose-td:border-gray-600 prose-td:px-2 prose-td:py-1"
                                        >
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {msg.text}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Typing Indicator */}
                        {isTyping && (
                            <div className="flex gap-3 max-w-[85%]">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                                    <Bot className="w-5 h-5" />
                                </div>
                                <div className="p-4 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 shadow-sm rounded-2xl rounded-tl-sm flex items-center gap-1.5 w-16">
                                    <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shrink-0">
                        <form onSubmit={handleSendMessage} className="relative flex items-center">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask Cortex AI a question..."
                                disabled={isTyping}
                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-3 pl-4 pr-12 text-sm dark:text-gray-100 focus:outline-none focus:border-indigo-400 focus:bg-white dark:focus:bg-gray-600 transition-all disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isTyping}
                                className="absolute right-2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:hover:bg-indigo-600"
                            >
                                {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Floating Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-center p-4 rounded-full shadow-2xl transition-all duration-300 ${isOpen
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30 scale-90'
                    : 'bg-gray-900 hover:bg-gray-800 hover:scale-105 text-white shadow-gray-900/30'
                    }`}
            >
                {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-7 h-7" />}
            </button>
        </div>
    );
}
