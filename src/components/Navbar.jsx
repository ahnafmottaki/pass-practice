import React, { useState, useEffect } from 'react';
import { KeyRound, Zap, BarChart3, Volume2, VolumeX, ShieldCheck, Database } from 'lucide-react';
import { isSoundEnabled, setSoundEnabled } from '../utils/audio';
import { getStorageMode, subscribeStorageMode } from '../api';

export default function Navbar({ activeTab, setActiveTab, passwordCount = 0, soundOn, setSoundOn }) {
  const [storageMode, setStorageMode] = useState(getStorageMode());

  useEffect(() => {
    return subscribeStorageMode(setStorageMode);
  }, []);

  const toggleSound = () => {
    const newState = !soundOn;
    setSoundEnabled(newState);
    setSoundOn(newState);
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <KeyRound className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                PassPractice
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 font-medium">
                v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Muscle Memory & Recall Trainer
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('passwords')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'passwords'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700/60'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <KeyRound className="w-4 h-4 text-brand-400" />
            <span>Passwords</span>
            {passwordCount > 0 && (
              <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-700 text-slate-300 font-mono">
                {passwordCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('practice')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'practice'
                ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40 shadow-sm shadow-brand-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Practice Hub</span>
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'stats'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700/60'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span>Stats & Logs</span>
          </button>
        </nav>

        {/* Badges & Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800">
            <Database className="w-3.5 h-3.5 text-brand-400" />
            <span>{storageMode}</span>
          </div>

          <button
            onClick={toggleSound}
            title={soundOn ? 'Mute sound effects' : 'Enable sound effects'}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            {soundOn ? (
              <Volume2 className="w-4 h-4 text-brand-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
