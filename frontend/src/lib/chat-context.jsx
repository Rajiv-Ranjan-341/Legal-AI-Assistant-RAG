import { createContext, useContext, useState, useCallback } from 'react';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeId, setActiveId] = useState(null);

  const saveToHistory = useCallback(() => {
    if (messages.length === 0) return;

    const firstUserMsg = messages.find((m) => m.role === 'user');
    const title = firstUserMsg?.content?.slice(0, 50) || 'New chat';

    if (activeId) {
      setHistory((prev) =>
        prev.map((h) => (h.id === activeId ? { ...h, title, messages: [...messages] } : h))
      );
    } else {
      const id = Date.now().toString();
      setHistory((prev) => [{ id, title, messages: [...messages], createdAt: Date.now() }, ...prev]);
      setActiveId(id);
    }
  }, [messages, activeId]);

  const newChat = useCallback(() => {
    if (messages.length > 0) {
      saveToHistory();
    }
    setMessages([]);
    setActiveId(null);
  }, [messages, saveToHistory]);

  const loadChat = useCallback((id) => {
    const chat = history.find((h) => h.id === id);
    if (!chat) return;

    if (messages.length > 0 && activeId !== id) {
      saveToHistory();
    }

    setMessages([...chat.messages]);
    setActiveId(id);
  }, [history, messages, activeId, saveToHistory]);

  const deleteChat = useCallback((id) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
    if (activeId === id) {
      setMessages([]);
      setActiveId(null);
    }
  }, [activeId]);

  return (
    <ChatContext.Provider
      value={{ messages, setMessages, history, activeId, newChat, loadChat, deleteChat, saveToHistory }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
