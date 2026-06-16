import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { AnimatedAIChat } from './components/ui/animated-ai-chat';
import Documents from './pages/Documents';
import Analytics from './pages/Analytics';
import { ChatProvider } from './lib/chat-context';

export default function App() {
  return (
    <BrowserRouter>
      <ChatProvider>
        <div className="h-screen flex bg-[#0a0a0b]">
          <Sidebar />
          <div className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={<AnimatedAIChat />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/analytics" element={<Analytics />} />
            </Routes>
          </div>
        </div>
      </ChatProvider>
    </BrowserRouter>
  );
}
