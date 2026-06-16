import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Scale,
  MessageSquare,
  FileText,
  BarChart3,
  Search,
  PanelLeft,
  Trash2,
} from 'lucide-react';
import { useChat } from '../lib/chat-context';

const links = [
  { to: '/', label: 'Chat', icon: MessageSquare },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function Sidebar() {
  const [open, setOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const { history, activeId, loadChat, deleteChat } = useChat();

  const filtered = searchQuery.trim()
    ? history.filter((h) => h.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : history;

  return (
    <div
      className="h-full flex flex-col shrink-0 bg-[#0e0e10] border-r border-white/[0.06] transition-all duration-300 ease-in-out overflow-hidden"
      style={{ width: open ? 220 : 56 }}
    >
      {/* Top row: logo + toggle */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1 shrink-0">
        {open ? (
          <div className="flex items-center pl-0.5">
            <img src="/logo.png" alt="Legal AI" className="w-7 h-7 shrink-0 object-contain" />
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <img src="/logo.png" alt="Legal AI" className="w-7 h-7 object-contain" />
          </div>
        )}

        {open && (
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
            title="Close sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Toggle button when collapsed */}
      {!open && (
        <div className="flex justify-center pt-1 pb-1 shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
            title="Open sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className={open ? 'px-3 pt-2 shrink-0' : 'px-2 pt-2 flex justify-center shrink-0'}>
        <button
          onClick={() => open && setShowSearch((v) => !v)}
          className={
            open
              ? 'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white/80 hover:bg-white/[0.04] transition-all w-full'
              : 'flex items-center justify-center p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.04] transition-all'
          }
          title="Search chats"
        >
          <Search className="w-4 h-4 shrink-0" />
          {open && <span>Search chats</span>}
        </button>
      </div>

      {/* Search input */}
      {open && showSearch && (
        <div className="px-3 pt-1.5 shrink-0">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            autoFocus
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white/80 placeholder:text-white/20 outline-none focus:border-violet-500/30"
          />
        </div>
      )}

      {/* Divider */}
      <div className="px-3 py-2.5 shrink-0">
        <div className="border-t border-white/[0.06]" />
      </div>

      {/* Nav Links */}
      <nav className={open ? 'px-3 flex flex-col gap-0.5 shrink-0' : 'px-2 flex flex-col gap-0.5 items-center shrink-0'}>
        {open && (
          <p className="text-[10px] font-medium text-white/20 uppercase tracking-widest px-2 mb-1">
            Navigate
          </p>
        )}
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={label}
            className={({ isActive }) => {
              const base = open
                ? 'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all'
                : 'flex items-center justify-center p-2 rounded-lg transition-all';
              return isActive
                ? `${base} bg-violet-500/10 text-violet-300`
                : `${base} text-white/40 hover:text-white/80 hover:bg-white/[0.04]`;
            }}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {open && label}
          </NavLink>
        ))}
      </nav>

      {/* Chat History */}
      {open && filtered.length > 0 && (
        <>
          <div className="px-3 pt-3 pb-1 shrink-0">
            <div className="border-t border-white/[0.06]" />
          </div>
          <div className="px-3 pt-1 shrink-0">
            <p className="text-[10px] font-medium text-white/20 uppercase tracking-widest px-2 mb-1">
              Recent
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-2 min-h-0">
            <div className="flex flex-col gap-0.5">
              {filtered.map((chat) => (
                <div
                  key={chat.id}
                  className="group relative"
                >
                  <button
                    onClick={() => loadChat(chat.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all truncate pr-8 ${
                      activeId === chat.id
                        ? 'bg-violet-500/10 text-violet-300'
                        : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                    }`}
                    title={chat.title}
                  >
                    {chat.title}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
                    }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-white/0 group-hover:text-white/30 hover:!text-red-400/80 transition-colors"
                    title="Delete chat"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Spacer when no history */}
      {(!open || filtered.length === 0) && <div className="flex-1" />}

      {/* Bottom */}
      <div className="px-3 pb-4 shrink-0">
        <div className="border-t border-white/[0.06] pt-3">
          <div className={open ? 'flex items-center gap-2 px-2' : 'flex justify-center'}>
            <div className="w-2 h-2 rounded-full bg-emerald-400/80 animate-pulse shrink-0" />
            {open && <span className="text-xs text-white/30">Groq + Gemini</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
