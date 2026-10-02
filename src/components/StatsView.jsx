import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Trophy, Target, Zap, Clock, Calendar, 
  RotateCcw, ShieldCheck, CheckCircle2, Award, Trash2
} from 'lucide-react';
import api from '../api';

export default function StatsView({ onGoToPractice }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getStats();
      setStats(data);
    } catch (err) {
      setError(err.message || 'Failed to load practice statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear all practice stats and logs? Saved passwords will NOT be deleted.')) {
      return;
    }
    try {
      setClearing(true);
      await api.clearStats();
      await fetchStats();
    } catch (err) {
      alert('Failed to clear stats: ' + err.message);
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs">Loading training telemetry...</p>
      </div>
    );
  }

  const formatModeLabel = (mode) => {
    if (mode === 'time_all') return 'Time-Based (All Passwords)';
    if (mode === 'time_selected') return 'Time-Based (Selected)';
    if (mode === 'count_all') return 'Count-Based (All Passwords)';
    if (mode === 'count_selected') return 'Count-Based (Selected)';
    return mode;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-brand-400" />
            <span>Training Statistics & Logs</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Historical muscle memory retention metrics stored permanently in your local SQLite database.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {stats && stats.totalSessions > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              disabled={clearing}
              className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-semibold text-rose-400 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{clearing ? 'Clearing...' : 'Clear History'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={fetchStats}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-2 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Sessions */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Total Sessions</span>
            <Award className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white">
            {stats?.totalSessions || 0}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {stats?.totalAttempts || 0} individual password drills
          </span>
        </div>

        {/* Success Rate */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Success Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
            {stats?.overallSuccessRate || 0}%
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {stats?.successfulAttempts || 0} successful completions
          </span>
        </div>

        {/* Avg Accuracy */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Avg Accuracy</span>
            <Target className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-cyan-400">
            {stats?.avgAccuracy || 0}%
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Across all attempts
          </span>
        </div>

        {/* Top Speed */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Best Speed</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">
            {stats?.bestWpm || 0} <span className="text-xs font-sans text-slate-400 font-normal">WPM</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Avg: {stats?.avgWpm || 0} WPM ({stats?.avgCpm || 0} CPM)
          </span>
        </div>
      </div>

      {/* Recent Sessions Table */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-400" />
          <span>Recent Practice Sessions</span>
        </h3>

        {!stats?.recentSessions || stats.recentSessions.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 text-center">
            <p className="text-sm text-slate-400">No practice sessions logged yet.</p>
            <button
              type="button"
              onClick={onGoToPractice}
              className="mt-3 px-4 py-2 rounded-xl bg-brand-500 text-slate-950 font-bold text-xs inline-flex items-center gap-2"
            >
              Start First Practice
            </button>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Session Date</th>
                    <th className="py-3 px-4">Practice Variation</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4">Accuracy</th>
                    <th className="py-3 px-4">Speed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {stats.recentSessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-slate-300 font-mono">
                        {new Date(s.started_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-200">
                          {formatModeLabel(s.mode_type)}
                        </span>
                        {s.target_count > 1 && (
                          <span className="text-[10px] text-purple-400 font-mono ml-1.5">
                            ({s.target_count}x reps)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {s.successful_items} / {s.total_items}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-cyan-400">
                        {s.avg_accuracy !== null ? `${s.avg_accuracy}%` : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-amber-400">
                        {s.avg_speed_cpm !== null ? `${s.avg_speed_cpm} CPM` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
