import { useState, useEffect } from 'react';
import {
  FileText,
  Database,
  Clock,
  MessageSquare,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getAnalytics } from '../lib/api';

const COLORS = ['#8b5cf6', '#34d399', '#f87171', '#6b7280', '#60a5fa'];

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalytics()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0a0b]">
        <p className="text-sm text-white/40">Loading analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0a0b]">
        <div className="text-center">
          <TrendingUp className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-sm text-white/40">Could not load analytics. Is the backend running?</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 bg-[#0a0a0b]">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-lg font-semibold text-white/90 mb-6">Analytics Dashboard</h1>

        {/* Row 1: Metric Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <MetricCard icon={FileText} label="Documents" value={data.total_documents} />
          <MetricCard
            icon={Database}
            label="Chunks Indexed"
            value={data.total_chunks?.toLocaleString()}
          />
          <MetricCard icon={Clock} label="Avg Response" value={`${data.avg_response_time || '~2'}s`} />
          <MetricCard icon={MessageSquare} label="Queries Today" value={data.queries_today || 0} />
        </div>

        {/* Row 2: Charts */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Chunks per Document */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-medium text-white/80 mb-4">Chunks per Document</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.chunks_per_document || []}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                  tickLine={false}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a2e',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="chunks" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Document Type Distribution */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-medium text-white/80 mb-4">Document Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data.chunks_per_document || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="chunks"
                  nameKey="name"
                >
                  {(data.chunks_per_document || []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a2e',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              {(data.chunks_per_document || []).map((d, i) => (
                <span key={i} className="flex items-center gap-1.5 text-xs text-white/40">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  {d.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Query Log */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <h3 className="text-sm font-medium text-white/80">Recent Queries</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left text-xs font-medium text-white/30 px-4 py-2.5 uppercase tracking-wider">
                    Query
                  </th>
                  <th className="text-left text-xs font-medium text-white/30 px-4 py-2.5 uppercase tracking-wider">
                    Mode
                  </th>
                  <th className="text-left text-xs font-medium text-white/30 px-4 py-2.5 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="text-left text-xs font-medium text-white/30 px-4 py-2.5 uppercase tracking-wider">
                    Verified
                  </th>
                </tr>
              </thead>
              <tbody>
                {(data.recent_queries || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-xs text-white/20 py-8">
                      No queries yet. Ask a question in the Chat tab.
                    </td>
                  </tr>
                ) : (
                  (data.recent_queries || []).map((q, i) => (
                    <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                      <td className="text-sm text-white/80 px-4 py-2.5 max-w-md truncate">
                        {q.question}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            q.mode === 'agentic'
                              ? 'bg-violet-500/15 text-violet-300'
                              : 'bg-white/[0.04] text-white/40'
                          }`}
                        >
                          {q.mode}
                        </span>
                      </td>
                      <td className="text-xs text-white/40 px-4 py-2.5">{q.time}s</td>
                      <td className="px-4 py-2.5">
                        {q.verified ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400/80" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400/80" />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-violet-400" />
        <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white/90">{value}</p>
    </div>
  );
}
