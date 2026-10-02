import React, { useState, useMemo } from 'react';
import { 
  Key, Plus, Eye, EyeOff, Copy, Check, Trash2, Edit3, 
  StickyNote, Search, AlertCircle, ShieldAlert, CheckCircle2,
  Sparkles, CheckSquare, Square, Zap, HelpCircle
} from 'lucide-react';
import PasswordModal from './PasswordModal';

export default function PasswordManager({
  passwords = [],
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onAddPassword,
  onUpdatePassword,
  onDeletePassword,
  onQuickPractice,
}) {
  const [newPassword, setNewPassword] = useState('');
  const [newNote, setNewNote] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [revealedIds, setRevealedIds] = useState(new Set());
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Real-time duplicate check for the new password input
  const isDuplicate = useMemo(() => {
    const trimmed = newPassword.trim();
    if (!trimmed) return false;
    return passwords.some((p) => p.password === trimmed);
  }, [newPassword, passwords]);

  // Filtered passwords based on search query
  const filteredPasswords = useMemo(() => {
    if (!searchQuery.trim()) return passwords;
    const q = searchQuery.toLowerCase();
    return passwords.filter(
      (p) => p.password.toLowerCase().includes(q) || (p.note && p.note.toLowerCase().includes(q))
    );
  }, [passwords, searchQuery]);

  // Reveal toggle per card
  const toggleReveal = (id) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Copy to clipboard
  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Add password submission
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const trimmed = newPassword.trim();
    if (!trimmed) {
      setFormError('Please enter a password string.');
      return;
    }
    if (isDuplicate) {
      setFormError('This password is already saved. Duplicate passwords are not allowed.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');
      await onAddPassword(trimmed, newNote.trim());
      setNewPassword('');
      setNewNote('');
    } catch (err) {
      setFormError(err.message || 'Failed to add password');
    } finally {
      setSubmitting(false);
    }
  };

  // Add sample demo passwords for quick testing if empty
  const handleAddSampleData = async () => {
    const samples = [
      { password: 'K9#mQ!vL28$pZ', note: 'High complexity 13-char alphanumeric with mixed symbols' },
      { password: 'BlueHorizon#2026', note: 'Passphrase style mnemonic with current year' },
      { password: 'tr0ub4dor&3', note: 'Classic XKCD style memorable password' }
    ];
    for (const s of samples) {
      if (!passwords.some(p => p.password === s.password)) {
        await onAddPassword(s.password, s.note);
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner & Context Note */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-brand-950/40 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Password Repository</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Anonymous Storage
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Store raw password strings to practice memory and typing fluency. 
            No service tags (no Google, Facebook, etc.). Duplicate passwords are strictly prohibited.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <span className="text-2xl font-black font-mono text-brand-400">{passwords.length}</span>
            <span className="text-xs text-slate-400 block">Total Stored</span>
          </div>
        </div>
      </div>

      {/* Add Password Card */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl">
        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-400">
            <Plus className="w-4 h-4" />
          </div>
          <span>Add Password to Practice</span>
        </h3>

        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Password input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Password String <span className="text-brand-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (formError) setFormError('');
                  }}
                  placeholder="e.g. T4#mK8$wR9"
                  required
                  className={`w-full px-3.5 py-2.5 bg-slate-950 border rounded-xl text-slate-100 font-mono text-sm focus:outline-none pr-10 transition-colors ${
                    isDuplicate 
                      ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-950/20' 
                      : 'border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Duplicate Warning */}
              {isDuplicate && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-400 font-medium animate-in fade-in">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>Duplicate detected: This password is already in your repository!</span>
                </div>
              )}

              {newPassword && !isDuplicate && (
                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                  <span>{newPassword.length} characters</span>
                  <span>•</span>
                  <span>Unique & Valid</span>
                </div>
              )}
            </div>

            {/* Note input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                <StickyNote className="w-3.5 h-3.5 text-amber-400" />
                Mnemonic Note / Recall Hint (Optional)
              </label>
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="e.g. Left-hand pattern + graduation year"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                A subtle hint you can peek at during recall practice if you freeze.
              </p>
            </div>
          </div>

          {formError && !isDuplicate && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-500 hidden sm:inline">
              Saved locally to your machine with zero server logins.
            </span>
            <button
              type="submit"
              disabled={submitting || isDuplicate || !newPassword.trim()}
              className="ml-auto px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg shadow-brand-500/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{submitting ? 'Saving...' : 'Save Password'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Passwords List Section */}
      <div className="space-y-4">
        {/* Controls Bar: Search & Batch Selection */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by password substring or note..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Selection Actions */}
          {passwords.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={onSelectAll}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center gap-1.5 transition-colors"
              >
                <CheckSquare className="w-3.5 h-3.5 text-brand-400" />
                <span>Select All</span>
              </button>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <span>Clear ({selectedIds.length})</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* List of Passwords */}
        {filteredPasswords.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500 mb-3">
              <Key className="w-6 h-6" />
            </div>
            {passwords.length === 0 ? (
              <>
                <h4 className="text-base font-semibold text-white">No Passwords Saved Yet</h4>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                  Add your first password above to start training muscle memory, or load sample passwords for testing.
                </p>
                <button
                  type="button"
                  onClick={handleAddSampleData}
                  className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-2 border border-slate-700 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Load 3 Sample Practice Passwords</span>
                </button>
              </>
            ) : (
              <>
                <h4 className="text-base font-semibold text-white">No Matching Passwords</h4>
                <p className="text-xs text-slate-400 mt-1">Try a different search query.</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredPasswords.map((item, idx) => {
              const isSelected = selectedIds.includes(item.id);
              const isRevealed = revealedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  className={`glass-card p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-brand-500/50 bg-brand-950/20 shadow-md shadow-brand-500/5'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Top Bar: Checkbox & Actions */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => onToggleSelect(item.id)}
                      className="flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-white"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-brand-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                      <span className="font-mono text-slate-500">#{idx + 1}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50">
                        {item.password.length} chars
                      </span>
                    </button>

                    <div className="flex items-center gap-1">
                      {/* Quick practice this specific password */}
                      <button
                        type="button"
                        onClick={() => onQuickPractice(item)}
                        title="Practice this password right now"
                        className="px-2 py-1 rounded-md bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span>Practice</span>
                      </button>

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => setEditingItem(item)}
                        title="Edit password or note"
                        className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Delete this password? This cannot be undone.')) {
                            onDeletePassword(item.id);
                          }
                        }}
                        title="Delete password"
                        className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Password Value Display */}
                  <div className="flex items-center justify-between gap-3 bg-slate-950/80 px-3 py-2 rounded-lg border border-slate-800/80 mb-3">
                    <div className="font-mono text-sm tracking-wider overflow-x-auto whitespace-nowrap scrollbar-none">
                      {isRevealed ? (
                        <span className="text-slate-100 select-all">{item.password}</span>
                      ) : (
                        <span className="text-slate-500 tracking-widest">
                          {'•'.repeat(Math.min(item.password.length, 18))}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleReveal(item.id)}
                        className="p-1 text-slate-500 hover:text-slate-300"
                        title={isRevealed ? 'Hide' : 'Reveal'}
                      >
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(item.id, item.password)}
                        className="p-1 text-slate-500 hover:text-brand-400"
                        title="Copy to clipboard"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-brand-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Note Section */}
                  {item.note ? (
                    <div className="text-xs text-amber-200/90 bg-amber-500/5 border border-amber-500/10 rounded-lg px-2.5 py-1.5 mb-2.5 flex items-start gap-1.5">
                      <StickyNote className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2 leading-relaxed">{item.note}</span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic mb-2.5 flex items-center gap-1">
                      <span>No note attached</span>
                      <button
                        type="button"
                        onClick={() => setEditingItem(item)}
                        className="text-brand-400 hover:underline not-italic"
                      >
                        + Add note
                      </button>
                    </div>
                  )}

                  {/* Footer Stats */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <div>
                      {item.practice_count > 0 ? (
                        <span>
                          Practiced <strong className="text-slate-200">{item.practice_count}x</strong>
                          {item.avg_accuracy !== null && ` · ${item.avg_accuracy}% acc`}
                        </span>
                      ) : (
                        <span className="text-slate-500">Not practiced yet</span>
                      )}
                    </div>
                    {item.avg_speed_cpm ? (
                      <span className="font-mono text-emerald-400">{item.avg_speed_cpm} CPM</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <PasswordModal
          item={editingItem}
          existingPasswords={passwords}
          onClose={() => setEditingItem(null)}
          onSave={onUpdatePassword}
        />
      )}
    </div>
  );
}
