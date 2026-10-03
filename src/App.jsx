import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import PasswordManager from './components/PasswordManager';
import PracticeConfig from './components/PracticeConfig';
import PracticeEngine from './components/PracticeEngine';
import PracticeResults from './components/PracticeResults';
import StatsView from './components/StatsView';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PinModal from './components/PinModal';
import api from './api';
import { deriveKeyFromPin, computeBlindIndex, encryptString, decryptString } from './utils/vaultCrypto';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authAlert, setAuthAlert] = useState('');

  // Dedicated Auth Page Navigation ('login' | 'register')
  const getInitialAuthPage = () => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/register')) {
      return 'register';
    }
    return 'login';
  };
  const [authPage, setAuthPage] = useState(getInitialAuthPage);

  // Sync auth page with browser history
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname.startsWith('/register')) {
        setAuthPage('register');
      } else {
        setAuthPage('login');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateAuth = (page) => {
    setAuthPage(page);
    setAuthAlert('');
    const targetPath = page === 'register' ? '/register' : '/login';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  // 6-Digit PIN Vault State
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [vaultPin, setVaultPin] = useState('');
  const [vaultCryptoKey, setVaultCryptoKey] = useState(null);

  const [activeTab, setActiveTab] = useState('passwords'); // 'passwords' | 'practice' | 'stats'
  const [passwords, setPasswords] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [soundOn, setSoundOn] = useState(true);

  // Practice session state machine: 'config' | 'active' | 'results'
  const [practicePhase, setPracticePhase] = useState('config');
  const [activeSessionConfig, setActiveSessionConfig] = useState(null);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessionResults, setSessionResults] = useState([]);

  // Load and decrypt passwords from SQLite backend
  const loadPasswords = async (keyOverride = null) => {
    const key = keyOverride || vaultCryptoKey;
    if (!key) return;

    try {
      setLoading(true);
      setGlobalError('');
      const rawList = await api.getPasswords();

      // Zero-Knowledge Decryption: decrypt passwords & notes in client RAM
      const decryptedList = await Promise.all(
        rawList.map(async (item) => {
          let decryptedPassword = item.password;
          let decryptedNote = item.note || '';

          try {
            decryptedPassword = await decryptString(item.password, key);
          } catch (e) {
            console.error(`Failed to decrypt password for item ${item.id}:`, e);
          }

          try {
            if (item.note) {
              decryptedNote = await decryptString(item.note, key);
            }
          } catch (e) {
            console.error(`Failed to decrypt note for item ${item.id}:`, e);
          }

          return {
            ...item,
            password: decryptedPassword,
            note: decryptedNote,
          };
        })
      );

      setPasswords(decryptedList);
    } catch (err) {
      console.error('Failed to load passwords:', err);
      if (err.status === 401) {
        handleLogout('Session expired. Please sign in again.');
      } else {
        setGlobalError(err.message || 'Unable to connect to local SQLite database');
      }
    } finally {
      setLoading(false);
    }
  };

  // Check auth session on startup
  useEffect(() => {
    async function checkAuth() {
      try {
        setAuthChecking(true);
        const user = await api.getMe();
        if (user) {
          setCurrentUser(user);
          // Vault stays locked until user provides 6-digit PIN
          setIsVaultUnlocked(false);
        } else {
          setCurrentUser(null);
        }
      } catch (e) {
        setCurrentUser(null);
      } finally {
        setAuthChecking(false);
      }
    }
    checkAuth();
  }, []);

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    setAuthAlert('');
    setIsVaultUnlocked(false);
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
  };

  // Called when 6-digit PIN is successfully set up or verified
  const handlePinSuccess = async (enteredPin) => {
    setVaultPin(enteredPin);
    setIsVaultUnlocked(true);
    setCurrentUser((prev) => (prev ? { ...prev, hasPin: true } : prev));

    try {
      // Derive 256-bit AES-GCM CryptoKey from PIN in browser memory
      const userSalt = currentUser?.email || 'passpractice_vault';
      const key = await deriveKeyFromPin(enteredPin, userSalt);
      setVaultCryptoKey(key);
      await loadPasswords(key);
    } catch (err) {
      console.error('Failed to derive encryption key:', err);
      setGlobalError('Failed to initialize zero-knowledge vault encryption.');
    }
  };

  // Lock vault manually - wipes keys and decrypted passwords from memory
  const handleLockVault = () => {
    setIsVaultUnlocked(false);
    setVaultPin('');
    setVaultCryptoKey(null);
    setPasswords([]);
    setSelectedIds([]);
    setPracticePhase('config');
    setActiveTab('passwords');
  };

  const handleLogout = async (reason = '') => {
    await api.logout();
    setCurrentUser(null);
    setIsVaultUnlocked(false);
    setVaultPin('');
    setVaultCryptoKey(null);
    setPasswords([]);
    setSelectedIds([]);
    setPracticePhase('config');
    setActiveTab('passwords');
    setAuthPage('login');
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.history.pushState({}, '', '/login');
    }
    if (reason && typeof reason === 'string') {
      setAuthAlert(reason);
    }
  };

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

  // Password CRUD with Zero-Knowledge Client-Side Encryption
  const handleAddPassword = async (plainPassword, plainNote) => {
    if (!vaultCryptoKey) {
      throw new Error('Vault is locked. Cannot encrypt password.');
    }

    const userSalt = currentUser?.email || 'passpractice_vault';
    const blindIndex = await computeBlindIndex(vaultPin, plainPassword, userSalt);
    const encryptedPassword = await encryptString(plainPassword, vaultCryptoKey);
    const encryptedNote = plainNote ? await encryptString(plainNote, vaultCryptoKey) : '';

    const savedItem = await api.addPassword(encryptedPassword, encryptedNote, blindIndex);

    // Keep decrypted plaintext in client state for UI & practice
    const clientItem = {
      ...savedItem,
      password: plainPassword,
      note: plainNote || '',
    };

    setPasswords((prev) => [clientItem, ...prev]);
    setSelectedIds((prev) => [...prev, clientItem.id]);
    return clientItem;
  };

  const handleUpdatePassword = async (id, plainPassword, plainNote) => {
    if (!vaultCryptoKey) {
      throw new Error('Vault is locked. Cannot encrypt password.');
    }

    const userSalt = currentUser?.email || 'passpractice_vault';
    const blindIndex = await computeBlindIndex(vaultPin, plainPassword, userSalt);
    const encryptedPassword = await encryptString(plainPassword, vaultCryptoKey);
    const encryptedNote = plainNote ? await encryptString(plainNote, vaultCryptoKey) : '';

    const updated = await api.updatePassword(id, encryptedPassword, encryptedNote, blindIndex);

    const clientItem = {
      ...updated,
      password: plainPassword,
      note: plainNote || '',
    };

    setPasswords((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...clientItem } : p))
    );
    return clientItem;
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
            setPracticePhase('config');
          }
        }}
        passwordCount={passwords.length}
        soundOn={soundOn}
        setSoundOn={setSoundOn}
        currentUser={currentUser}
        onLogout={() => handleLogout('Signed out successfully.')}
        isVaultUnlocked={isVaultUnlocked}
        onLockVault={handleLockVault}
        authPage={authPage}
        onNavigateToLogin={() => navigateAuth('login')}
        onNavigateToRegister={() => navigateAuth('register')}
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
      <main className={`flex-1 max-w-7xl w-full mx-auto px-2 xs:px-4 sm:px-6 lg:px-8 py-3 sm:py-8 ${currentUser && isVaultUnlocked ? 'pb-24 sm:pb-8' : 'pb-6 sm:pb-8'}`}>
        {authChecking ? (
          <div className="py-32 text-center text-slate-500">
            <div className="w-9 h-9 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-mono">Verifying local session...</p>
          </div>
        ) : !currentUser ? (
          /* Render Dedicated Login or Register Page */
          authPage === 'register' ? (
            <RegisterPage
              onRegisterSuccess={handleAuthSuccess}
              onNavigateToLogin={() => navigateAuth('login')}
            />
          ) : (
            <LoginPage
              onLoginSuccess={handleAuthSuccess}
              onNavigateToRegister={() => navigateAuth('register')}
              alertMessage={authAlert}
            />
          )
        ) : !currentUser.hasPin ? (
          /* Set Up 6-Digit Encryption PIN */
          <PinModal
            mode="setup"
            currentUser={currentUser}
            onPinSuccess={handlePinSuccess}
            onLogout={handleLogout}
          />
        ) : !isVaultUnlocked ? (
          /* Unlock Password Vault with 6-Digit PIN */
          <PinModal
            mode="unlock"
            currentUser={currentUser}
            onPinSuccess={handlePinSuccess}
            onLogout={handleLogout}
          />
        ) : loading && passwords.length === 0 ? (
          <div className="py-32 text-center text-slate-500">
            <div className="w-9 h-9 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Decrypting and loading passwords...</p>
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
            SQLite Database · Zero-Knowledge · Offline First
          </p>
        </div>
      </footer>
    </div>
  );
}
