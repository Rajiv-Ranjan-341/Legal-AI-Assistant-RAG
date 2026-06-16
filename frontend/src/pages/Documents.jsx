import { useState, useEffect } from 'react';
import { FileText, Search, ChevronLeft, ChevronRight, Database, Hash, Layers } from 'lucide-react';
import { getDocuments, getDocumentChunks } from '../lib/api';

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [chunkMeta, setChunkMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [chunksLoading, setChunksLoading] = useState(false);

  useEffect(() => {
    getDocuments()
      .then((data) => {
        setDocuments(data.documents || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const selectDocument = async (doc) => {
    setSelectedDoc(doc);
    setSearch('');
    await loadChunks(doc.filename, 1, '');
  };

  const loadChunks = async (filename, page, searchQuery) => {
    setChunksLoading(true);
    try {
      const data = await getDocumentChunks(filename, page, searchQuery);
      setChunks(data.chunks || []);
      setChunkMeta({ total: data.total, page: data.page, pages: data.pages });
    } catch {
      setChunks([]);
    } finally {
      setChunksLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (selectedDoc) loadChunks(selectedDoc.filename, 1, search);
  };

  const totalChunks = documents.reduce((s, d) => s + (d.chunk_count || 0), 0);

  return (
    <div className="flex h-full bg-[#0a0a0b]">
      {/* Left: Document List */}
      <div className="w-[280px] border-r border-white/[0.06] bg-white/[0.02] flex flex-col shrink-0">
        <div className="p-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white/90 mb-1">Ingested Documents</h2>
          <p className="text-xs text-white/40">
            {documents.length} files &middot; {totalChunks.toLocaleString()} chunks
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {loading ? (
            <p className="text-xs text-white/40 text-center py-8">Loading...</p>
          ) : (
            documents.map((doc) => (
              <button
                key={doc.filename}
                onClick={() => selectDocument(doc)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  selectedDoc?.filename === doc.filename
                    ? 'border-violet-500/30 bg-violet-500/10'
                    : 'border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <FileText
                    className={`w-4 h-4 shrink-0 ${
                      selectedDoc?.filename === doc.filename ? 'text-violet-400' : 'text-white/30'
                    }`}
                  />
                  <span className="text-sm text-white/90 truncate">{doc.filename}</span>
                </div>
                <div className="flex gap-3 ml-6 text-xs text-white/40">
                  <span>{doc.pages} pages</span>
                  <span>{doc.chunk_count} chunks</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Center: Chunk Browser */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedDoc ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Database className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <p className="text-sm text-white/40">Select a document to browse its chunks</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-4">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-white/90">{selectedDoc.filename}</h2>
                <p className="text-xs text-white/40">{chunkMeta.total} chunks</p>
              </div>
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="flex items-center bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 focus-within:border-violet-500/30">
                  <Search className="w-4 h-4 text-white/20" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search within document..."
                    className="bg-transparent text-sm text-white/90 placeholder-white/20 px-2 py-2 outline-none w-60"
                  />
                </div>
              </form>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {chunksLoading ? (
                <p className="text-sm text-white/40 text-center py-8">Loading chunks...</p>
              ) : (
                <div className="flex flex-col gap-4 max-w-4xl">
                  {chunks.map((chunk, i) => (
                    <div
                      key={i}
                      className="border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.12] transition-all"
                    >
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.06]">
                        <span className="text-xs font-mono text-violet-400">
                          #{(chunkMeta.page - 1) * 10 + i + 1}
                        </span>
                        {chunk.legal_section && (
                          <span className="text-xs text-white/80 bg-violet-500/10 px-2 py-0.5 rounded">
                            {chunk.legal_section}
                          </span>
                        )}
                        {chunk.page !== undefined && (
                          <span className="text-xs text-white/40">Page {chunk.page}</span>
                        )}
                        <span className="text-xs text-white/30 ml-auto">
                          {chunk.length} chars
                        </span>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-sm text-white/50 leading-relaxed font-mono whitespace-pre-wrap">
                          {chunk.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className="px-6 py-3 border-t border-white/[0.06] flex items-center justify-between">
              <button
                onClick={() => loadChunks(selectedDoc.filename, chunkMeta.page - 1, search)}
                disabled={chunkMeta.page <= 1}
                className="flex items-center gap-1 text-sm text-white/40 hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <span className="text-xs text-white/30">
                Page {chunkMeta.page} of {chunkMeta.pages}
              </span>
              <button
                onClick={() => loadChunks(selectedDoc.filename, chunkMeta.page + 1, search)}
                disabled={chunkMeta.page >= chunkMeta.pages}
                className="flex items-center gap-1 text-sm text-white/40 hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right: Stats */}
      {selectedDoc && (
        <div className="w-[260px] border-l border-white/[0.06] bg-white/[0.02] flex flex-col shrink-0 p-4 gap-4">
          <div>
            <p className="text-xs font-medium text-white/30 mb-3 uppercase tracking-wider">
              Document Stats
            </p>
            <div className="flex flex-col gap-3">
              <StatCard icon={Layers} label="Total Chunks" value={selectedDoc.chunk_count} />
              <StatCard icon={Hash} label="Pages" value={selectedDoc.pages} />
              <StatCard
                icon={FileText}
                label="Avg Chunk Size"
                value={`${selectedDoc.avg_chunk_size || '~800'} chars`}
              />
            </div>
          </div>

          {selectedDoc.section_distribution && (
            <div>
              <p className="text-xs font-medium text-white/30 mb-3 uppercase tracking-wider">
                Section Distribution
              </p>
              <div className="flex flex-col gap-2">
                {Object.entries(selectedDoc.section_distribution).map(([label, count]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-xs text-white/40 w-16 truncate">{label}</span>
                    <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-400/60 rounded-full"
                        style={{
                          width: `${(count / selectedDoc.chunk_count) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-white/30 w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-violet-400" />
        <span className="text-xs text-white/40">{label}</span>
      </div>
      <p className="text-lg font-semibold text-white/90 ml-5.5">{value}</p>
    </div>
  );
}
