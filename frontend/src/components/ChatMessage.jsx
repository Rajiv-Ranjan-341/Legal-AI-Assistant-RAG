import { User, Scale, CheckCircle, AlertTriangle, Eye, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatMessage({ message, onViewSources }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-[#d4a843]/15 flex items-center justify-center shrink-0 mt-1">
          <Scale className="w-4 h-4 text-[#d4a843]" />
        </div>
      )}

      <div className={`max-w-[75%] ${isUser ? 'order-first' : ''}`}>
        <div
          className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-[#1c2333] border border-[#d4a843]/30 text-[#e6edf3]'
              : 'bg-[#161b22] border border-[#30363d] text-[#e6edf3]'
          }`}
        >
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div
              className="prose prose-invert prose-sm max-w-none
                [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-[#e6edf3] [&_h1]:mt-3 [&_h1]:mb-2
                [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-[#e6edf3] [&_h2]:mt-3 [&_h2]:mb-2
                [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-[#e6edf3] [&_h3]:mt-2 [&_h3]:mb-1
                [&_p]:text-[#e6edf3] [&_p]:mb-2
                [&_li]:text-[#e6edf3]
                [&_strong]:text-[#d4a843]
                [&_code]:bg-[#0d1117] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                [&_ul]:my-2 [&_ol]:my-2"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content || ''}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!isUser && (
          <div className="flex items-center gap-2 mt-2 ml-1">
            {message.verified !== undefined && (
              message.verified ? (
                <span className="flex items-center gap-1 text-xs text-[#2ea043]">
                  <CheckCircle className="w-3.5 h-3.5" /> Verified
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-[#d29922]">
                  <AlertTriangle className="w-3.5 h-3.5" /> Unverified
                </span>
              )
            )}
            {message.sources && message.sources.length > 0 && (
              <button
                onClick={() => onViewSources?.(message)}
                className="flex items-center gap-1 text-xs text-[#8b949e] hover:text-[#d4a843] transition-colors"
              >
                <Eye className="w-3.5 h-3.5" /> Sources ({message.sources.length})
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-[#1c2333] border border-[#30363d] flex items-center justify-center shrink-0 mt-1">
          <User className="w-4 h-4 text-[#8b949e]" />
        </div>
      )}
    </div>
  );
}
