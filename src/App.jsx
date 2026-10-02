import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import PasswordManager from './components/PasswordManager';
import PracticeConfig from './components/PracticeConfig';
import PracticeEngine from './components/PracticeEngine';
import PracticeResults from './components/PracticeResults';
import StatsView from './components/StatsView';
import api from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('passwords'); // 'passwords' | 'practice' | 'stats'
  const [passwords, setPasswords] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState('');
  const [soundOn, setSoundOn] = useState(true);

  // Practice session state machine: 'config' | 'active' | 'results'
  const [practicePhase, setPracticePhase] = useState('config');
  const [activeSessionConfig, setActiveSessionConfig] = useState(null);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessionResults, setSessionResults] = useState([]);

  // Load passwords from SQLite backend
  const loadPasswords = async () => {
    try {
      setLoading(true);
      setGlobalError('');
      const data = await api.getPasswords();
      setPasswords(data);
    } catch (err) {
      console.error('Failed to load passwords:', err);
      setGlobalError(err.message || 'Unable to connect to local SQLite database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPasswords();
  }, []);

  // Selection handlers
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds(passwords.map((p) => p.id));
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Password CRUD
  const handleAddPassword = async (password, note) => {
    const newItem = await api.addPassword(password, note);
    setPasswords((prev) => [newItem, ...prev]);
    // Auto-select newly added password for convenience
    setSelectedIds((prev) => [...prev, newItem.id]);
    return newItem;
  };

  const handleUpdatePassword = async (id, password, note) => {
    const updated = await api.updatePassword(id, password, note);
    setPasswords((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updated } : p))
    );
    return updated;
  };

  const handleDeletePassword = async (id) => {
    await api.deletePassword(id);
    setPasswords((prev) => prev.filter((p) => p.id !== id));
    setSelectedIds((prev) => prev.filter((i) => i !== id));
  };

  // Quick single-password practice launcher
  const handleQuickPractice = (item) => {
    setSelectedIds([item.id]);
    setActiveSessionConfig({
      modeType: 'time_selected',
      targetCount: 1,
      passwords: [item],
      blindRecall: true,
      showNotes: true,
      shuffleOrder: false,
      clueLetters: 3,
    });
    startSessionWithConfig({
      modeType: 'time_selected',
      targetCount: 1,
      passwords: [item],
      blindRecall: true,
      showNotes: true,
      shuffleOrder: false,
      clueLetters: 3,
    });
    setActiveTab('practice');
  };

  // Start practice session
  const startSessionWithConfig = async (config) => {
    try {
      setActiveSessionConfig(config);
      const totalItems = config.modeType.startsWith('count')
        ? config.passwords.length * config.targetCount
        : config.passwords.length;

      const res = await api.startSession(config.modeType, config.targetCount, totalItems);
      setCurrentSessionId(res.sessionId);
      setSessionResults([]);
      setPracticePhase('active');
    } catch (err) {
      console.error('Failed to start practice session:', err);
      alert('Failed to start session: ' + err.message);
    }
  };

  // Record individual password task log
  const handleRecordLog = async (logData) => {
    if (!currentSessionId) return;
    try {
      await api.recordLog({
        ...logData,
        session_id: currentSessionId,
      });
    } catch (err) {
      console.error('Failed to record practice log:', err);
    }
  };

  // Finish practice session
  const handleFinishSession = async (finalResults) => {
    setSessionResults(finalResults);
    setPracticePhase('results');

    if (currentSessionId && finalResults.length > 0) {
      const successfulItems = finalResults.filter((r) => r.isSuccess).length;
      const avgAccuracy = Math.round(
        (finalResults.reduce((acc, r) => acc + (r.accuracy || 0), 0) / finalResults.length) * 10
      ) / 10;
      const speeds = finalResults.filter((r) => r.cpm > 0);
      const avgCpm = speeds.length > 0
        ? Math.round(speeds.reduce((acc, r) => acc + r.cpm, 0) / speeds.length)
        : 0;

      try {
        await api.completeSession(currentSessionId, {
          total_items: finalResults.length,
          successful_items: successfulItems,
          avg_accuracy: avgAccuracy,
          avg_speed_cpm: avgCpm,
        });
      } catch (err) {
        console.error('Failed to finalize session in DB:', err);
      }
    }

    // Refresh password practice counts
    loadPasswords();
  };

  // Cancel practice in progress
  const handleCancelPractice = () => {
    setPracticePhase('config');
    setActiveSessionConfig(null);
    setCurrentSessionId(null);
    setSessionResults([]);
  };

  // Retry handlers from results screen
  const handleRetryAll = () => {
    if (activeSessionConfig) {
      startSessionWithConfig(activeSessionConfig);
    }
  };

  const handleRetryFailed = (failedPasswords) => {
    if (!activeSessionConfig) return;
    const retryConfig = {
      ...activeSessionConfig,
      passwords: failedPasswords,
    };
    startSessionWithConfig(retryConfig);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'practice') {
            // reset to config phase if leaving practice
            setPracticePhase('config');
          }
        }}
        passwordCount={passwords.length}
        soundOn={soundOn}
        setSoundOn={setSoundOn}
      />

      {/* Global Error Banner */}
      {globalError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 w-full">
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center justify-between">
            <span>{globalError}</span>
            <button
              onClick={loadPasswords}
              className="px-3 py-1 bg-rose-500/20 rounded-lg text-xs font-bold hover:bg-rose-500/30"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 pb-24 sm:pb-8">
        {loading && passwords.length === 0 ? (
          <div className="py-32 text-center text-slate-500">
            <div className="w-9 h-9 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Connecting to local SQLite database...</p>
          </div>
        ) : (
          <>
            {/* Tab 1: Passwords Management */}
            {activeTab === 'passwords' && (
              <PasswordManager
                passwords={passwords}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onClearSelection={handleClearSelection}
                onAddPassword={handleAddPassword}
                onUpdatePassword={handleUpdatePassword}
                onDeletePassword={handleDeletePassword}
                onQuickPractice={handleQuickPractice}
              />
            )}

            {/* Tab 2: Practice Hub */}
            {activeTab === 'practice' && (
              <>
                {practicePhase === 'config' && (
                  <PracticeConfig
                    passwords={passwords}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onSelectAll={handleSelectAll}
                    onClearSelection={handleClearSelection}
                    onStartSession={startSessionWithConfig}
                  />
                )}

                {practicePhase === 'active' && activeSessionConfig && (
                  <PracticeEngine
                    sessionConfig={activeSessionConfig}
                    onFinishSession={handleFinishSession}
                    onCancelPractice={handleCancelPractice}
                    onRecordLog={handleRecordLog}
                  />
                )}

                {practicePhase === 'results' && (
                  <PracticeResults
                    results={sessionResults}
                    sessionConfig={activeSessionConfig}
                    onRetryAll={handleRetryAll}
                    onRetryFailed={handleRetryFailed}
                    onReturnToHub={() => setPracticePhase('config')}
                    onReturnToPasswords={() => {
                      setActiveTab('passwords');
                      setPracticePhase('config');
                    }}
                  />
                )}
              </>
            )}

            {/* Tab 3: Stats & Logs */}
            {activeTab === 'stats' && (
              <StatsView
                onGoToPractice={() => {
                  setActiveTab('practice');
                  setPracticePhase('config');
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-500 mb-16 sm:mb-0">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            PassPractice — Local Muscle Memory & Mental Recall Trainer.
          </p>
          <p className="font-mono text-slate-600">
            SQLite Database · Zero Tracking · Offline First
          </p>
        </div>
      </footer>
    </div>
  );
}
