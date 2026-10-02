import React, { useState } from 'react';
import { 
  Timer, Repeat, CheckSquare, Square, Eye, EyeOff, 
  HelpCircle, Shuffle, Play, AlertCircle, Sparkles, Key, CheckCircle2
} from 'lucide-react';

export default function PracticeConfig({
  passwords = [],
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onStartSession,
}) {
  // Mode selection:
  // 'time_all' | 'time_selected' | 'count_all' | 'count_selected'
  const [activeMode, setActiveMode] = useState('time_all');
  
  // Count-based settings
  const [targetReps, setTargetReps] = useState(3);
  const [customRepsInput, setCustomRepsInput] = useState('3');

  // Display preferences
  const [blindRecall, setBlindRecall] = useState(true); // true = masked, false = visible
  const [showNotes, setShowNotes] = useState(true);
  const [shuffleOrder, setShuffleOrder] = useState(false);
  const [clueLetters, setClueLetters] = useState(3); // 3 letters, 2 letters, or 0 (none)

  // Determine current active candidate passwords
  const candidatePasswords = React.useMemo(() => {
    if (activeMode === 'time_selected' || activeMode === 'count_selected') {
      return passwords.filter((p) => selectedIds.includes(p.id));
    }
    return passwords;
  }, [activeMode, passwords, selectedIds]);

  const handleStart = () => {
    if (candidatePasswords.length === 0) return;

    let repetitions = 1;
    if (activeMode.startsWith('count')) {
      repetitions = Math.max(1, parseInt(customRepsInput, 10) || targetReps || 1);
    }

    onStartSession({
      modeType: activeMode,
      targetCount: repetitions,
      passwords: [...candidatePasswords],
      blindRecall,
      showNotes,
      shuffleOrder,
      clueLetters,
    });
  };

  const handlePresetReps = (count) => {
    setTargetReps(count);
    setCustomRepsInput(count.toString());
  };

  const isSelectedMode = activeMode === 'time_selected' || activeMode === 'count_selected';

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Title */}
      <div className="text-center max-w-xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Configure Practice Session
        </h2>
        <p className="text-sm text-slate-400 mt-2">
          Select your training variation, adjust timers, or drill repetitions to build automatic muscle memory.
        </p>
      </div>

      {passwords.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 text-center">
          <Key className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No Passwords to Practice</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            You need at least one saved password in your repository before launching a practice drill.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Mode Selector Cards */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              1. Choose Practice Variation
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Variation 1: Time-based + All Passwords */}
              <div
                onClick={() => setActiveMode('time_all')}
                className={`cursor-pointer p-5 rounded-2xl border transition-all relative ${
                  activeMode === 'time_all'
                    ? 'border-brand-500 bg-brand-950/20 ring-1 ring-brand-500/50 shadow-lg shadow-brand-500/10'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Timer className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    30s / Pass
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">Time-Based</h3>
                <p className="text-xs text-brand-400 font-medium mt-0.5">All Passwords</p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Fast-paced drill through every password in your vault. 30 seconds strict countdown per password.
                </p>
                <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Scope: All</span>
                  <span className="font-mono text-slate-200">{passwords.length} items</span>
                </div>
              </div>

              {/* Variation 2: Time-based + Selected Passwords */}
              <div
                onClick={() => setActiveMode('time_selected')}
                className={`cursor-pointer p-5 rounded-2xl border transition-all relative ${
                  activeMode === 'time_selected'
                    ? 'border-brand-500 bg-brand-950/20 ring-1 ring-brand-500/50 shadow-lg shadow-brand-500/10'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Timer className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    30s / Pass
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">Time-Based</h3>
                <p className="text-xs text-cyan-400 font-medium mt-0.5">Selected Passwords</p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Focus on challenging passwords under timed pressure. 30 seconds per chosen password.
                </p>
                <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Scope: Chosen</span>
                  <span className="font-mono text-slate-200">{selectedIds.length} selected</span>
                </div>
              </div>

              {/* Variation 3: Count-based */}
              <div
                onClick={() => setActiveMode(selectedIds.length > 0 ? 'count_selected' : 'count_all')}
                className={`cursor-pointer p-5 rounded-2xl border transition-all relative ${
                  activeMode.startsWith('count')
                    ? 'border-brand-500 bg-brand-950/20 ring-1 ring-brand-500/50 shadow-lg shadow-brand-500/10'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Repeat className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    {customRepsInput}x Reps
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">Count-Based</h3>
                <p className="text-xs text-purple-400 font-medium mt-0.5">
                  {activeMode === 'count_selected' ? 'Selected Passwords' : 'All Passwords'}
                </p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Repetition drill. Practice each password multiple times consecutively without timer stress.
                </p>
                <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Target Reps</span>
                  <span className="font-mono text-slate-200">{customRepsInput} times each</span>
                </div>
              </div>
            </div>
          </div>

          {/* If Count-Based is selected, show repetition controls & scope sub-toggle */}
          {activeMode.startsWith('count') && (
            <div className="glass-panel p-5 rounded-2xl space-y-4 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-white">Repetition Target</h4>
                  <p className="text-xs text-slate-400">How many times would you like to practice each password?</p>
                </div>
                {/* Scope selector */}
                <div className="flex flex-col xs:flex-row items-stretch xs:items-center rounded-xl bg-slate-950 p-1 border border-slate-800 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setActiveMode('count_all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeMode === 'count_all'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All Passwords ({passwords.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMode('count_selected')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeMode === 'count_selected'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Selected Passwords ({selectedIds.length})
                  </button>
                </div>
              </div>

              {/* Repetition presets */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {[1, 3, 5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handlePresetReps(num)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all border ${
                      parseInt(customRepsInput, 10) === num
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {num}x
                  </button>
                ))}
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-xs text-slate-400">Custom:</span>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={customRepsInput}
                    onChange={(e) => setCustomRepsInput(e.target.value)}
                    className="w-16 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-center text-slate-100 focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-xs text-slate-400">times</span>
                </div>
              </div>
            </div>
          )}

          {/* Password Picker (Shown if Selected Mode is active) */}
          {isSelectedMode && (
            <div className="glass-panel p-5 rounded-2xl space-y-4 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800">
                <div>
                  <h4 className="text-sm font-semibold text-white flex flex-wrap items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-brand-400 shrink-0" />
                    <span>Select Passwords ({selectedIds.length} of {passwords.length})</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">Check the specific passwords you want to drill.</p>
                </div>
                <div className="flex items-center gap-2 text-xs self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={onSelectAll}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={onClearSelection}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {selectedIds.length === 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Please check at least one password below to start this mode.</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                {passwords.map((item, idx) => {
                  const checked = selectedIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => onToggleSelect(item.id)}
                      className={`cursor-pointer p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                        checked
                          ? 'border-brand-500/60 bg-brand-950/20 text-white'
                          : 'border-slate-800/80 bg-slate-950/50 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-brand-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600 shrink-0" />
                        )}
                        <span className="font-mono text-xs text-slate-500">#{idx + 1}</span>
                        <span className="font-mono text-xs tracking-wider truncate">
                          {'•'.repeat(Math.min(item.password.length, 12))}
                        </span>
                        <span className="text-[10px] text-slate-500">({item.password.length}c)</span>
                      </div>
                      {item.note && (
                        <span className="text-[11px] text-amber-400/80 truncate max-w-[120px]">
                          {item.note}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Practice Experience Preferences */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              2. Training Preferences
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Blind Recall vs Transcription */}
              <button
                type="button"
                onClick={() => setBlindRecall(!blindRecall)}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-colors ${
                  blindRecall
                    ? 'border-brand-500/50 bg-brand-950/20 text-white'
                    : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                }`}
              >
                {blindRecall ? (
                  <EyeOff className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                ) : (
                  <Eye className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-xs font-bold text-slate-200">
                    {blindRecall ? 'Blind Recall (Masked)' : 'Visual Copy (Visible)'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {blindRecall ? 'Hide target password to test pure memory.' : 'Display password to train muscle memory.'}
                  </p>
                </div>
              </button>

              {/* Starting Clue Prefix */}
              <button
                type="button"
                onClick={() => {
                  if (clueLetters === 3) setClueLetters(2);
                  else if (clueLetters === 2) setClueLetters(0);
                  else setClueLetters(3);
                }}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-colors ${
                  clueLetters > 0
                    ? 'border-emerald-500/50 bg-emerald-950/20 text-white'
                    : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Sparkles className={`w-4 h-4 shrink-0 mt-0.5 ${clueLetters > 0 ? 'text-emerald-400' : 'text-slate-500'}`} />
                <div>
                  <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
                    <span>Starting Clue</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-emerald-400 ml-1">
                      {clueLetters > 0 ? `${clueLetters} letters` : 'Off'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {clueLetters > 0 
                      ? `Shows first ${clueLetters} chars so you recognize which password to type.`
                      : 'No starting letters shown (full blind recall).'}
                  </p>
                </div>
              </button>

              {/* Show Notes Hint */}
              <button
                type="button"
                onClick={() => setShowNotes(!showNotes)}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-colors ${
                  showNotes
                    ? 'border-amber-500/50 bg-amber-950/20 text-white'
                    : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                }`}
              >
                <HelpCircle className={`w-4 h-4 shrink-0 mt-0.5 ${showNotes ? 'text-amber-400' : 'text-slate-500'}`} />
                <div>
                  <div className="text-xs font-bold text-slate-200">
                    {showNotes ? 'Mnemonic Hint Enabled' : 'Hints Disabled'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {showNotes ? 'Display your attached notes as memory aids.' : 'No hints shown during typing.'}
                  </p>
                </div>
              </button>

              {/* Shuffle Order */}
              <button
                type="button"
                onClick={() => setShuffleOrder(!shuffleOrder)}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-colors ${
                  shuffleOrder
                    ? 'border-cyan-500/50 bg-cyan-950/20 text-white'
                    : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Shuffle className={`w-4 h-4 shrink-0 mt-0.5 ${shuffleOrder ? 'text-cyan-400' : 'text-slate-500'}`} />
                <div>
                  <div className="text-xs font-bold text-slate-200">
                    {shuffleOrder ? 'Randomized Order' : 'Sequential Order'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {shuffleOrder ? 'Shuffle sequence to prevent routine bias.' : 'Practice in repository order.'}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Launch Action */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-brand-950/60 via-slate-900 to-slate-900 border border-brand-500/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <div className="text-sm font-bold text-white flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2">
                <span>Ready to Practice:</span>
                <span className="font-mono text-brand-400">
                  {candidatePasswords.length} Password{candidatePasswords.length !== 1 ? 's' : ''}
                </span>
                {activeMode.startsWith('count') && (
                  <span className="text-slate-400 font-normal">
                    ({candidatePasswords.length * (parseInt(customRepsInput, 10) || 1)} total reps)
                  </span>
                )}
                {activeMode.startsWith('time') && (
                  <span className="text-amber-400 font-normal">
                    · 30s per password
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Results, accuracy breakdown, and feedback will be displayed after completion.
              </p>
            </div>

            <button
              type="button"
              onClick={handleStart}
              disabled={candidatePasswords.length === 0}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-brand-500/20 transition-all active:scale-95 shrink-0"
            >
              <Play className="w-4 h-4 fill-current stroke-none" />
              <span>Start Practice Session</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
