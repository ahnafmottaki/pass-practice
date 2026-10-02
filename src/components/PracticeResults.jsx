import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  Trophy, CheckCircle2, XCircle, Clock, Zap, Target, 
  RotateCcw, ArrowRight, Eye, EyeOff, StickyNote,
  AlertCircle, Sparkles, Filter, ChevronRight
} from 'lucide-react';
import { computeCharDiff, generateFeedback } from '../utils/metrics';

export default function PracticeResults({
  results = [],
  sessionConfig,
  onRetryAll,
  onRetryFailed,
  onReturnToHub,
  onReturnToPasswords,
}) {
  const [revealedIds, setRevealedIds] = useState(new Set());

  // Aggregate metrics
  const totalTasks = results.length;
  const successfulTasks = results.filter((r) => r.isSuccess).length;
  const timedOutTasks = results.filter((r) => r.timedOut).length;
  const failedTasks = results.filter((r) => !r.isSuccess);
  
  const successRate = totalTasks > 0 ? Math.round((successfulTasks / totalTasks) * 100) : 0;
  
  const avgAccuracy = totalTasks > 0 
    ? Math.round(results.reduce((acc, r) => acc + (r.accuracy || 0), 0) / totalTasks * 10) / 10 
    : 0;

  const validSpeeds = results.filter((r) => r.wpm > 0);
  const avgWpm = validSpeeds.length > 0 
    ? Math.round(validSpeeds.reduce((acc, r) => acc + r.wpm, 0) / validSpeeds.length) 
    : 0;
  
  const totalDurationSec = (results.reduce((acc, r) => acc + (r.durationMs || 0), 0) / 1000).toFixed(1);

  // Trigger celebration if high score
  useEffect(() => {
    if (successRate >= 80 && totalTasks > 0) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899'],
        });
      } catch (e) {
        // ignore confetti errors
      }
    }
  }, [successRate, totalTasks]);

  const toggleReveal = (idx) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Session Hero Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-brand-950/40 border border-slate-800 text-center relative overflow-hidden">
        <div className="inline-flex p-3 rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/20 mb-3 shadow-lg shadow-brand-500/10">
          <Trophy className="w-8 h-8" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {successRate === 100 ? 'Flawless Practice Session! 🎉' : successRate >= 70 ? 'Great Practice Run! 👏' : 'Session Complete — Review & Refine 💪'}
        </h2>
        <p className="text-sm text-slate-400 mt-2 max-w-lg mx-auto">
          Here is your comprehensive performance breakdown, accuracy score, typing velocity, and customized improvement tips.
        </p>

        {/* 4 Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-8 max-w-3xl mx-auto">
          <div className="glass-card p-4 rounded-2xl border border-slate-800/80">
            <span className="text-xs text-slate-400 font-medium block">Success Rate</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 mt-1">
              {successRate}%
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {successfulTasks} of {totalTasks} correct
            </span>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-slate-800/80">
            <span className="text-xs text-slate-400 font-medium block">Avg Accuracy</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-cyan-400 mt-1">
              {avgAccuracy}%
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Keystroke precision
            </span>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-slate-800/80">
            <span className="text-xs text-slate-400 font-medium block">Typing Speed</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400 mt-1">
              {avgWpm} <span className="text-xs font-sans text-slate-400 font-normal">WPM</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Muscle velocity
            </span>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-slate-800/80">
            <span className="text-xs text-slate-400 font-medium block">Total Time</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-purple-400 mt-1">
              {totalDurationSec}s
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Active drilling time
            </span>
          </div>
        </div>
      </div>

      {/* Task by Task Detailed Feedback */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>Password Breakdown & Feedback</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {results.length} items
            </span>
          </h3>
          <span className="text-xs text-slate-500">
            Character diff highlights matching and mismatched keys
          </span>
        </div>

        <div className="space-y-3.5">
          {results.map((item, idx) => {
            const isRevealed = revealedIds.has(idx);
            const diff = computeCharDiff(item.typed, item.target);
            const feedback = generateFeedback({
              isSuccess: item.isSuccess,
              accuracy: item.accuracy,
              wpm: item.wpm,
              durationSec: (item.durationMs / 1000).toFixed(1),
              timedOut: item.timedOut,
              errorCount: item.errorCount,
              targetLength: item.target.length,
            });

            return (
              <div
                key={idx}
                className="glass-panel p-5 rounded-2xl border border-slate-800/80 space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    {item.isSuccess ? (
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    ) : item.timedOut ? (
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <XCircle className="w-4 h-4" />
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-mono text-slate-500">Task #{idx + 1}</span>
                      {item.repetition && item.totalReps > 1 && (
                        <span className="text-xs text-purple-400 font-mono ml-2">
                          (Rep {item.repetition}/{item.totalReps})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badge & metrics */}
                  <div className="flex items-center gap-3 text-xs">
                    <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${feedback.badgeColor}`}>
                      {feedback.badge}
                    </span>
                    <span className="text-slate-400 font-mono">
                      {(item.durationMs / 1000).toFixed(2)}s
                    </span>
                    <span className="text-slate-400 font-mono font-bold">
                      {item.accuracy}% acc
                    </span>
                    {item.wpm > 0 && (
                      <span className="text-amber-400 font-mono">
                        {item.wpm} WPM
                      </span>
                    )}
                  </div>
                </div>

                {/* Password display & Note */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                  {/* Target string */}
                  <div className="flex items-center justify-between bg-slate-950/80 px-3.5 py-2.5 rounded-xl border border-slate-800/80">
                    <div className="font-mono text-sm tracking-wider">
                      {isRevealed ? (
                        <span className="text-slate-100 select-all">{item.target}</span>
                      ) : (
                        <span className="text-slate-500 tracking-widest">
                          {'•'.repeat(item.target.length)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleReveal(idx)}
                      className="p-1 text-slate-500 hover:text-slate-300"
                      title={isRevealed ? 'Hide' : 'Reveal'}
                    >
                      {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Note / Hint */}
                  {item.passwordItem?.note ? (
                    <div className="text-xs text-amber-200/90 bg-amber-500/5 border border-amber-500/10 rounded-xl px-3 py-2 flex items-center gap-2">
                      <StickyNote className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{item.passwordItem.note}</span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic px-2">
                      No mnemonic note
                    </div>
                  )}
                </div>

                {/* Character Diff Visualizer (If typos occurred or timed out) */}
                {(!item.isSuccess || item.typed !== item.target) && (
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                      Keystroke Analysis
                    </span>
                    <div className="flex flex-wrap gap-1 font-mono text-xs">
                      {diff.map((charItem, cIdx) => {
                        if (charItem.status === 'correct') {
                          return (
                            <span key={cIdx} className="px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Correct">
                              {charItem.actual}
                            </span>
                          );
                        } else if (charItem.status === 'incorrect') {
                          return (
                            <span key={cIdx} className="px-1 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40" title={`Typed '${charItem.actual}' instead of '${charItem.expected}'`}>
                              {charItem.actual || ' '}
                              <span className="text-[9px] text-slate-400 ml-0.5 line-through">({charItem.expected})</span>
                            </span>
                          );
                        } else if (charItem.status === 'missing') {
                          return (
                            <span key={cIdx} className="px-1 py-0.5 rounded border border-dashed border-slate-700 text-slate-500" title={`Missing character: '${charItem.expected}'`}>
                              [{charItem.expected}]
                            </span>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}

                {/* Intelligent Feedback & Tips */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60 space-y-1 text-xs">
                  <div className="font-semibold text-slate-200">{feedback.title}</div>
                  <p className="text-slate-400 leading-relaxed">{feedback.description}</p>
                  {feedback.tip && (
                    <p className="text-brand-400/90 font-medium pt-0.5 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>{feedback.tip}</span>
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        <button
          type="button"
          onClick={onReturnToPasswords}
          className="order-3 sm:order-1 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors text-center"
        >
          Back to Passwords
        </button>

        <div className="order-1 sm:order-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          {failedTasks.length > 0 && (
            <button
              type="button"
              onClick={() => onRetryFailed(failedTasks.map((t) => t.passwordItem))}
              className="px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Drill Failed Only ({failedTasks.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRetryAll}
            className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition-all active:scale-95"
          >
            <RotateCcw className="w-4 h-4 stroke-[3]" />
            <span>Practice Again</span>
          </button>
        </div>
      </div>
    </div>
  );
}
