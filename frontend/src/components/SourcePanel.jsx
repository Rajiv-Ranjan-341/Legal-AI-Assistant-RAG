import { X, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

function ScoreBar({ score, max = 6 }) {
  const pct = Math.min(Math.max((score / max) * 100, 5), 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex-1 h-1.5 bg-[#30363d] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#d4a843] rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[#8b949e] w-10 text-right">{score.toFixed(2)}</span>
    </div>
  );
}

function SourceCard({ source, index }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-[#30363d] rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-start gap-3 hover:bg-[#1c2333] transition-colors text-left"
      >
        <span className="text-[#d4a843] font-bold text-sm mt-0.5">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-3.5 h-3.5 text-[#8b949e] shrink-0" />
            <span className="text-sm text-[#e6edf3] truncate">{source.source_file}</span>
          </div>
          <div className="flex gap-3 text-xs text-[#8b949e]">
            {source.legal_section && <span>{source.legal_section}</span>}
            {source.page && <span>Page {source.page}</span>}
          </div>
          <div className="mt-2">
            <ScoreBar score={source.rerank_score || 0} />
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[#8b949e] shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#8b949e] shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t border-[#30363d]">
          <p className="text-xs text-[#8b949e] leading-relaxed mt-3 font-mono bg-[#0d1117] p-3 rounded">
            {source.excerpt}
          </p>
        </div>
      )}
    </div>
  );
}

export default function SourcePanel({ sources, stats, onClose }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="w-[350px] border-l border-[#30363d] bg-[#161b22] flex flex-col shrink-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
        <h3 className="text-sm font-semibold text-[#e6edf3]">
          Sources ({sources.length})
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[#30363d] text-[#8b949e] hover:text-[#e6edf3] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {stats && (
        <div className="px-4 py-3 border-b border-[#30363d]">
          <p className="text-xs font-medium text-[#8b949e] mb-2">RETRIEVAL STATS</p>
          <div className="flex flex-wrap gap-2">
            {stats.dense && (
              <span className="text-xs bg-[#0d1117] text-[#8b949e] px-2 py-1 rounded">
                Dense: {stats.dense}
              </span>
            )}
            {stats.bm25 && (
              <span className="text-xs bg-[#0d1117] text-[#8b949e] px-2 py-1 rounded">
                BM25: {stats.bm25}
              </span>
            )}
            {stats.reranked && (
              <span className="text-xs bg-[#0d1117] text-[#8b949e] px-2 py-1 rounded">
                Final: {stats.reranked}
              </span>
            )}
            {stats.time && (
              <span className="text-xs bg-[#d4a843]/10 text-[#d4a843] px-2 py-1 rounded">
                {stats.time}s
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {sources.map((source, i) => (
          <SourceCard key={i} source={source} index={i} />
        ))}
      </div>
    </div>
  );
}
