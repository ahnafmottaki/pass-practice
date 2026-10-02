import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Timer, Repeat, Eye, EyeOff, HelpCircle, ArrowRight, 
  RotateCcw, XCircle, CheckCircle2, AlertTriangle, Zap,
  KeyRound, ShieldAlert, Sparkles, Volume2, Lock
} from 'lucide-react';
import { calculateMetrics, computeCharDiff } from '../utils/metrics';
import { playKeyClick, playErrorSound, playSuccessChime, playTimerTick, playTimesUp } from '../utils/audio';

export default function PracticeEngine({
  sessionConfig,
  onFinishSession,
  onCancelPractice,
  onRecordLog,
}) {
  const {
    modeType,
    targetCount = 1,
    passwords = [],
    blindRecall = true,
    showNotes = true,
    shuffleOrder = false,
  } = sessionConfig;

  // Build task queue
  const taskQueue = useMemo(() => {
    let items = [...passwords];
    if (shuffleOrder) {
      items.sort(() => Math.random() - 0.5);
    }

    const queue = [];
    if (modeType.startsWith('count')) {
      // Repeat each password targetCount times
      items.forEach((pwd) => {
        for (let rep = 1; rep <= targetCount; rep++) {
          queue.push({
            passwordItem: pwd,
            repetition: rep,
            totalReps: targetCount,
          });
        }
      });
    } else {
      // Time-based: 1 iteration through each password with 30s timer
      items.forEach((pwd, idx) => {
        queue.push({
          passwordItem: pwd,
          repetition: 1,
          totalReps: 1,
        });
      });
    }
    return queue;
  }, [passwords, modeType, targetCount, shuffleOrder]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [typedInput, setTypedInput] = useState('');
  const [keystrokeCount, setKeystrokeCount] = useState(0);
  const [sessionResults, setSessionResults] = useState([]);
  const [taskStartTime, setTaskStartTime] = useState(Date.now());
  
  // Timer for time-based mode (30 seconds per password)
  const isTimeBased = modeType.startsWith('time');
  const [timeRemaining, setTimeRemaining] = useState(30.0);
  const [isTimedOut, setIsTimedOut] = useState(false);
  
  // Masking & Peek
  const [isPeeking, setIsPeeking] = useState(!blindRecall);
  const [showNoteHint, setShowNoteHint] = useState(showNotes);

  // Success flash state
  const [isSuccessFlash, setIsSuccessFlash] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState(null);

  const inputRef = useRef(null);
  const timerIntervalRef = useRef(null);

  const currentTask = taskQueue[currentIndex];
  const currentTarget = currentTask?.passwordItem?.password || '';

  const clueLettersSetting = sessionConfig.clueLetters !== undefined ? sessionConfig.clueLetters : 3;

  const cluePrefix = useMemo(() => {
    if (!currentTarget || clueLettersSetting === 0) return '';
    const len = currentTarget.length;
    if (len <= 2) return currentTarget.slice(0, 1);
    if (len <= 4) return currentTarget.slice(0, Math.min(2, clueLettersSetting));
    return currentTarget.slice(0, Math.min(clueLettersSetting, len - 1));
  }, [currentTarget, clueLettersSetting]);

  // Focus input on task switch
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentIndex, isTimedOut]);

  // Handle 30s countdown for time-based mode
  useEffect(() => {
    if (!isTimeBased) return;

    setTimeRemaining(30.0);
    setIsTimedOut(false);
    setTaskStartTime(Date.now());

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    timerIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        const next = Math.max(0, Math.round((prev - 0.1) * 10) / 10);
        
        // Audio tick for final 5 seconds
        if (next <= 5.0 && next > 0 && Math.floor(next * 10) % 10 === 0) {
          playTimerTick();
        }

        if (next <= 0) {
          clearInterval(timerIntervalRef.current);
          handleTimeExpired();
          return 0;
        }
        return next;
      });
    }, 100);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [currentIndex, isTimeBased]);

  // Handle timeout
  const handleTimeExpired = async () => {
    setIsTimedOut(true);
    playTimesUp();

    const durationMs = 30000;
    const metrics = calculateMetrics(typedInput, currentTarget, durationMs, keystrokeCount);
    
    const taskResult = {
      passwordItem: currentTask.passwordItem,
      typed: typedInput,
      target: currentTarget,
      isSuccess: false,
      timedOut: true,
      durationMs,
      accuracy: metrics.accuracy,
      cpm: metrics.cpm,
      wpm: metrics.wpm,
      errorCount: metrics.errorCount,
      repetition: currentTask.repetition,
      totalReps: currentTask.totalReps,
    };

    setSessionResults((prev) => [...prev, taskResult]);

    // Send log to backend
    if (onRecordLog) {
      onRecordLog({
        password_id: currentTask.passwordItem.id,
        is_success: false,
        duration_ms: durationMs,
        accuracy: metrics.accuracy,
        typed_length: typedInput.length,
        target_length: currentTarget.length,
        speed_cpm: metrics.cpm,
        speed_wpm: metrics.wpm,
        error_count: metrics.errorCount,
        timed_out: 1,
      });
    }
  };

  // Process keystrokes
  const handleInputChange = (e) => {
    if (isTimedOut) return;

    const val = e.target.value;
    setTypedInput(val);
    setKeystrokeCount((c) => c + 1);

    // Audio feedback
    if (val.length > typedInput.length) {
      const lastChar = val[val.length - 1];
      const targetChar = currentTarget[val.length - 1];
      if (lastChar === targetChar) {
        playKeyClick();
      } else {
        playErrorSound();
      }
    } else {
      playKeyClick();
    }

    // Check exact match completion
    if (val === currentTarget) {
      handleTaskSuccess(val);
    }
  };

  // Handle task success
  const handleTaskSuccess = async (exactVal) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const durationMs = Math.max(Date.now() - taskStartTime, 150);
    const metrics = calculateMetrics(exactVal, currentTarget, durationMs, keystrokeCount + 1);
    
    setIsSuccessFlash(true);
    playSuccessChime();

    const taskResult = {
      passwordItem: currentTask.passwordItem,
      typed: exactVal,
      target: currentTarget,
      isSuccess: true,
      timedOut: false,
      durationMs,
      accuracy: 100,
      cpm: metrics.cpm,
      wpm: metrics.wpm,
      errorCount: 0,
      repetition: currentTask.repetition,
      totalReps: currentTask.totalReps,
    };

    setCurrentFeedback(`Perfect! 100% in ${(durationMs / 1000).toFixed(1)}s (${metrics.wpm} WPM)`);

    // Record log to backend
    if (onRecordLog) {
      onRecordLog({
        password_id: currentTask.passwordItem.id,
        is_success: true,
        duration_ms: durationMs,
        accuracy: 100,
        typed_length: exactVal.length,
        target_length: currentTarget.length,
        speed_cpm: metrics.cpm,
        speed_wpm: metrics.wpm,
        error_count: 0,
        timed_out: 0,
      });
    }

    // Advance after brief satisfaction flash
    setTimeout(() => {
      advanceNextTask([...sessionResults, taskResult]);
    }, 700);
  };

  // Move to next task in queue or finish
  const advanceNextTask = (updatedResults = sessionResults) => {
    setIsSuccessFlash(false);
    setCurrentFeedback(null);
    setTypedInput('');
    setKeystrokeCount(0);
    setIsTimedOut(false);
    setIsPeeking(!blindRecall);

    if (currentIndex + 1 < taskQueue.length) {
      setCurrentIndex((i) => i + 1);
      setTaskStartTime(Date.now());
      if (isTimeBased) setTimeRemaining(30.0);
    } else {
      // Completed all tasks in queue!
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      onFinishSession(updatedResults);
    }
  };

  // Skip current task manually
  const handleSkip = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const durationMs = Date.now() - taskStartTime;
    const metrics = calculateMetrics(typedInput, currentTarget, durationMs, keystrokeCount);

    const taskResult = {
      passwordItem: currentTask.passwordItem,
      typed: typedInput,
      target: currentTarget,
      isSuccess: false,
      timedOut: false,
      skipped: true,
      durationMs,
      accuracy: metrics.accuracy,
      cpm: metrics.cpm,
      wpm: metrics.wpm,
      errorCount: metrics.errorCount,
      repetition: currentTask.repetition,
      totalReps: currentTask.totalReps,
    };

    const nextResults = [...sessionResults, taskResult];
    setSessionResults(nextResults);

    if (onRecordLog) {
      onRecordLog({
        password_id: currentTask.passwordItem.id,
        is_success: false,
        duration_ms: durationMs,
        accuracy: metrics.accuracy,
        typed_length: typedInput.length,
        target_length: currentTarget.length,
        speed_cpm: metrics.cpm,
        speed_wpm: metrics.wpm,
        error_count: metrics.errorCount,
        timed_out: 0,
      });
    }

    advanceNextTask(nextResults);
  };

  // Toggle peek with auto-refocus
  const togglePeeking = () => {
    setIsPeeking((prev) => {
      const next = !prev;
      if (!next) {
        // Hiding password - immediately refocus input for typing!
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      return next;
    });
  };

  // Keyboard shortcut listener for Enter / Tab / Esc
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      togglePeeking();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelPractice();
    }
  };

  // Typing is locked while password is seen in blind recall mode
  const isTypingLocked = blindRecall && isPeeking && !isTimedOut;

  // Calculate live diff
  const liveDiff = computeCharDiff(typedInput, currentTarget);
  const progressPercent = Math.round(((currentIndex) / taskQueue.length) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header: Progress & Modes */}
      <div className="glass-panel p-3.5 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20 shrink-0">
              <KeyRound className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                  {modeType.startsWith('time') ? 'Time Drill' : 'Count Drill'}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                  {currentIndex + 1} of {taskQueue.length}
                </span>
              </div>
              {currentTask && modeType.startsWith('count') && (
                <p className="text-xs text-purple-400 font-medium mt-0.5">
                  Repetition {currentTask.repetition} of {currentTask.totalReps}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (confirm('Exit practice session early? Completed items will be logged.')) {
                if (sessionResults.length > 0) {
                  onFinishSession(sessionResults);
                } else {
                  onCancelPractice();
                }
              }
            }}
            className="sm:hidden px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition-colors shrink-0"
          >
            End
          </button>
        </div>

        {/* 30s Countdown Timer Widget (If Time-Based Mode) */}
        {isTimeBased && (
          <div className="flex items-center justify-center gap-3 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 w-full sm:w-auto">
            <Timer className={`w-4 h-4 ${timeRemaining <= 5 ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`} />
            <div className="flex items-baseline gap-1">
              <span className={`text-xl font-black font-mono tracking-tight ${
                timeRemaining <= 5 ? 'text-rose-400' : timeRemaining <= 10 ? 'text-amber-400' : 'text-slate-100'
              }`}>
                {timeRemaining.toFixed(1)}s
              </span>
              <span className="text-[10px] text-slate-500 font-mono">/ 30.0s</span>
            </div>
          </div>
        )}

        {/* Exit Button */}
        <button
          type="button"
          onClick={() => {
            if (confirm('Exit practice session early? Completed items will be logged.')) {
              if (sessionResults.length > 0) {
                onFinishSession(sessionResults);
              } else {
                onCancelPractice();
              }
            }
          }}
          className="hidden sm:inline-flex px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition-colors"
        >
          End Session
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800/80">
        <div
          className="bg-gradient-to-r from-brand-500 to-emerald-400 h-full transition-all duration-300"
          style={{ width: `${Math.max(5, progressPercent)}%` }}
        />
      </div>

      {/* Main Focus Typing Arena */}
      <div 
        className={`glass-panel p-4 sm:p-10 rounded-2xl sm:rounded-3xl transition-all duration-300 relative border-2 ${
          isSuccessFlash 
            ? 'border-emerald-500 bg-emerald-950/20 shadow-2xl shadow-emerald-500/20' 
            : isTimedOut
            ? 'border-rose-500 bg-rose-950/20 shadow-2xl shadow-rose-500/10'
            : 'border-slate-800/80'
        }`}
      >
        {/* Celebration / Success Feedback Banner (Flow layout - Never overlaps on mobile) */}
        {currentFeedback && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm font-bold font-mono flex items-center justify-center gap-2 animate-in fade-in zoom-in-95 shadow-lg shadow-emerald-500/10 text-center">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
            <span>{currentFeedback}</span>
          </div>
        )}

        {/* Note / Mnemonic Drawer if present */}
        {currentTask?.passwordItem?.note && showNotes && (
          <div className="mb-5 sm:mb-6 p-3 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 flex items-start gap-3">
            <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                Memory Hook / Note
              </span>
              <p className="text-xs sm:text-sm mt-0.5 leading-relaxed font-medium">
                {currentTask.passwordItem.note}
              </p>
            </div>
          </div>
        )}

        {/* Target Password Prompt / Visualizer */}
        <div className="text-center space-y-3 mb-6 sm:mb-8">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Target Password
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              ({currentTarget.length} chars)
            </span>
            {cluePrefix && !isPeeking && blindRecall && !isTimedOut && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono flex items-center gap-1">
                <span>Starts with:</span>
                <strong className="text-emerald-400 font-bold bg-slate-900 px-1 rounded">{cluePrefix}</strong>
              </span>
            )}
          </div>

          {/* Password Display Box - Constant Fixed Length (Zero Layout Shift) */}
          <div className="w-full max-w-md mx-auto flex items-center justify-between gap-3 px-4 sm:px-5 py-3 rounded-2xl bg-slate-950/90 border border-slate-800/80 shadow-inner h-14">
            <div className="flex-1 text-center font-mono-code text-base sm:text-xl tracking-widest overflow-hidden text-ellipsis whitespace-nowrap px-1">
              {isPeeking || !blindRecall || isTimedOut ? (
                <span className="text-white select-all">{currentTarget}</span>
              ) : (
                <span className="select-none inline-flex items-center justify-center">
                  {cluePrefix && (
                    <span className="text-emerald-400 font-bold mr-0.5">{cluePrefix}</span>
                  )}
                  <span className="text-slate-500 tracking-widest">
                    {'•'.repeat(Math.max(0, currentTarget.length - cluePrefix.length))}
                  </span>
                </span>
              )}
            </div>

            {/* Toggle peek button */}
            <button
              type="button"
              onClick={togglePeeking}
              title={isPeeking ? "Hide password (Press Tab)" : "Reveal password (Press Tab)"}
              className={`p-2 rounded-xl transition-all shrink-0 ${
                isPeeking
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {isPeeking ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-brand-400" />}
            </button>
          </div>

          <div className="text-[11px] text-slate-500 h-4">
            {blindRecall ? (
              <span>
                Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-slate-300">Tab</kbd> to {isPeeking ? 'hide and type' : 'peek password'}
              </span>
            ) : (
              <span>Visual transcription mode active</span>
            )}
          </div>
        </div>

        {/* Real-time Character Diff Breakdown */}
        {typedInput.length > 0 && !isTimedOut && (
          <div className="mb-4 text-center">
            <div className="inline-flex items-center gap-1 p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 max-w-full overflow-x-auto font-mono text-base">
              {liveDiff.slice(0, Math.max(typedInput.length, currentTarget.length)).map((item, i) => {
                let colorClass = 'text-slate-600';
                if (item.status === 'correct') colorClass = 'text-emerald-400 font-bold';
                else if (item.status === 'incorrect') colorClass = 'text-rose-400 bg-rose-500/20 px-0.5 rounded underline';
                else if (item.status === 'extra') colorClass = 'text-amber-400 bg-amber-500/20 px-0.5 rounded';

                return (
                  <span key={i} className={`inline-block min-w-[12px] text-center ${colorClass}`}>
                    {item.actual || '·'}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Interactive Typing Input */}
        <div className="space-y-4">
          <div className="relative">
            <input
              ref={inputRef}
              type={isPeeking || !blindRecall ? 'text' : 'password'}
              value={typedInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isTimedOut || isSuccessFlash || isTypingLocked}
              placeholder={
                isTimedOut
                  ? "Time's up!"
                  : isTypingLocked
                  ? "Password revealed — hide to type"
                  : "Type the exact password here..."
              }
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              className={`w-full px-4 sm:px-5 py-3 sm:py-4 bg-slate-950 border-2 rounded-xl sm:rounded-2xl text-slate-100 font-mono-code text-base sm:text-xl tracking-wider text-center focus:outline-none transition-all ${
                isTimedOut
                  ? 'border-rose-500/60 bg-rose-950/20 cursor-not-allowed'
                  : isSuccessFlash
                  ? 'border-emerald-500 bg-emerald-950/30 ring-2 ring-emerald-500'
                  : isTypingLocked
                  ? 'border-amber-500/40 bg-amber-950/10 text-amber-300/40 cursor-not-allowed select-none'
                  : 'border-slate-700/80 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'
              }`}
            />
          </div>

          {/* Time Expired Callout */}
          {isTimedOut && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                <span className="font-bold text-sm">Time's Up (30 Seconds Elapsed)</span>
              </div>
              <p className="text-xs text-rose-200/80">
                The target password was: <strong className="font-mono text-white select-all">{currentTarget}</strong>
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => advanceNextTask()}
                  className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
                >
                  <span>Proceed to Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Bottom Bar: Action buttons and stats */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
            <div className="flex items-center gap-4">
              <span>Typed: <strong className="text-slate-300 font-mono">{typedInput.length}</strong> / {currentTarget.length}</span>
              {keystrokeCount > 0 && (
                <span>Keystrokes: <strong className="text-slate-300 font-mono">{keystrokeCount}</strong></span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSkip}
                disabled={isTimedOut || isSuccessFlash}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Skip Password
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
