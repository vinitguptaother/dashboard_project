'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Bot, User, Minimize2, Maximize2, Globe, MessageSquare, Trash2 } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  citations?: string[];
  mode?: 'chat' | 'search';
}

const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [mode, setMode] = useState<'chat' | 'search'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: 'Hello! I\'m your AI trading assistant powered by Perplexity.\n\nI can work in two modes:\n\n💬 **Chat** — Ask me anything about stocks, trading strategies, or the dashboard\n🌐 **Search** — I\'ll search the internet for real-time market news, prices, and analysis\n\nSwitch modes using the toggle below.',
      timestamp: new Date(),
      suggestions: ['RELIANCE latest news', 'Market outlook today', 'NIFTY support levels', 'Top gainers today'],
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
      mode,
    };

    setMessages((prev) => [...prev, userMessage]);
    const query = inputMessage;
    setInputMessage('');
    setIsTyping(true);

    try {
      const endpoint = mode === 'search' ? '/api/perplexity/search' : '/api/perplexity/ask';
      const bodyKey = mode === 'search' ? 'query' : 'question';

      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [bodyKey]: query }),
      });

      const data = await res.json();

      if (data.status === 'error') {
        throw new Error(data.message || 'Request failed');
      }

      const answer = data.data?.answer || data.data?.choices?.[0]?.message?.content || '';
      const citations = data.data?.citations || [];

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: answer,
        timestamp: new Date(),
        citations: citations.length > 0 ? citations : undefined,
        mode,
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Could not get a response. Check backend connection.';
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: `⚠️ ${errMsg}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputMessage(suggestion);
  };

  // Use effect to send when suggestion is clicked
  const pendingSend = useRef(false);
  useEffect(() => {
    if (pendingSend.current && inputMessage.trim()) {
      pendingSend.current = false;
      handleSendMessage();
    }
  }, [inputMessage]);

  const handleSuggestionSend = (suggestion: string) => {
    pendingSend.current = true;
    setInputMessage(suggestion);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        type: 'bot',
        content: 'Chat cleared. How can I help you?',
        timestamp: new Date(),
        suggestions: ['RELIANCE latest news', 'Market outlook today', 'NIFTY support levels', 'Top gainers today'],
      },
    ]);
  };

  // Render formatted content with basic markdown-like support
  const renderContent = (content: string) => {
    // Split by double newlines for paragraphs, handle bold (**text**)
    const parts = content.split('\n');
    return parts.map((line, i) => {
      // Handle bold
      const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Handle bullet points
      if (line.trim().startsWith('• ') || line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return (
          <div key={i} className="ml-2 mb-0.5" dangerouslySetInnerHTML={{ __html: '&bull; ' + formatted.replace(/^[\s]*[•\-*]\s*/, '') }} />
        );
      }
      if (line.trim() === '') return <div key={i} className="h-1" />;
      return <div key={i} className="mb-0.5" dangerouslySetInnerHTML={{ __html: formatted }} />;
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-all z-50 animate-pulse"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        isMinimized ? 'w-80 h-16' : 'w-[420px] h-[650px]'
      }`}
    >
      <div className="glass-effect rounded-xl shadow-2xl h-full flex flex-col border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 rounded-t-xl bg-blue-600 text-white">
          <div className="flex items-center space-x-2">
            <Bot className="h-5 w-5" />
            <span className="font-semibold text-sm">AI Trading Assistant</span>
            {mode === 'search' && (
              <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-medium">
                WEB
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={clearChat}
              title="Clear chat"
              className="text-white/70 hover:text-white transition-colors p-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-white/70 hover:text-white transition-colors p-1"
            >
              {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/70 hover:text-white transition-colors p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Mode Toggle */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              <button
                onClick={() => setMode('chat')}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-medium transition-colors ${
                  mode === 'chat'
                    ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Chat</span>
              </button>
              <button
                onClick={() => setMode('search')}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-medium transition-colors ${
                  mode === 'search'
                    ? 'text-green-700 bg-green-50 border-b-2 border-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Web Search</span>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] ${
                      message.type === 'user'
                        ? 'bg-blue-600 text-white rounded-l-lg rounded-tr-lg'
                        : 'bg-gray-100 text-gray-900 rounded-r-lg rounded-tl-lg'
                    } p-2.5`}
                  >
                    <div className="flex items-start space-x-1.5">
                      {message.type === 'bot' && <Bot className="h-3.5 w-3.5 mt-0.5 text-blue-600 shrink-0" />}
                      {message.type === 'user' && (
                        <div className="flex items-center space-x-1 shrink-0">
                          <User className="h-3.5 w-3.5 mt-0.5" />
                          {message.mode === 'search' && <Globe className="h-3 w-3 mt-0.5 text-green-300" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs leading-relaxed">{renderContent(message.content)}</div>

                        {/* Citations */}
                        {message.citations && message.citations.length > 0 && (
                          <div className="mt-2 pt-1.5 border-t border-gray-200">
                            <p className="text-[10px] text-gray-400 font-medium mb-1">Sources:</p>
                            <div className="space-y-0.5">
                              {message.citations.slice(0, 5).map((url, i) => {
                                let domain = '';
                                try {
                                  domain = new URL(url).hostname.replace('www.', '');
                                } catch {
                                  domain = url.slice(0, 30);
                                }
                                return (
                                  <a
                                    key={i}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-[10px] text-blue-500 hover:text-blue-700 truncate"
                                  >
                                    [{i + 1}] {domain}
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Suggestions */}
                        {message.suggestions && (
                          <div className="mt-2 space-y-1">
                            {message.suggestions.map((suggestion, index) => (
                              <button
                                key={index}
                                onClick={() => handleSuggestionSend(suggestion)}
                                className="block w-full text-left text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-r-lg rounded-tl-lg p-2.5">
                    <div className="flex items-center space-x-1.5">
                      <Bot className="h-3.5 w-3.5 text-blue-600" />
                      <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                        <div
                          className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: '0.1s' }}
                        ></div>
                        <div
                          className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: '0.2s' }}
                        ></div>
                      </div>
                      <span className="text-[10px] text-gray-400 ml-1">
                        {mode === 'search' ? 'Searching the web...' : 'Thinking...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-200">
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={
                      mode === 'search'
                        ? 'Search the web for market info...'
                        : 'Ask about stocks, markets, or the dashboard...'
                    }
                    className="w-full p-2 pr-8 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isTyping}
                  />
                  {mode === 'search' && (
                    <Globe className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-green-500" />
                  )}
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isTyping}
                  className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    mode === 'search'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AIChatbot;
