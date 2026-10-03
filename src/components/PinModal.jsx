import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ShieldAlert, ShieldCheck, Lock, Eye, EyeOff, 
  KeyRound, LogOut, AlertTriangle, ArrowLeft 
} from 'lucide-react';
import api from '../api';

// Dedicated 6-Digit PIN input row with auto-advance, backspace, and paste support
function DigitInputRow({ value, onChange, disabled, isMasked, autoFocus = false, error = false }) {
  const inputRefs = useRef([]);
  const digits = (value || '').padEnd(6, ' ').slice(0, 6).split('').map((c) => (c === ' ' ? '' : c));

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const handleChange = (e, index) => {
    const val = e.target.value.replace(/\D/g, ''); // Digits only
    if (!val) {
      // Clear this digit
      const next = [...digits];
      next[index] = '';
      onChange(next.join(''));
      return;
    }

    // Handle single digit or pasted sequence in single box
    const char = val.slice(-1);
    const next = [...digits];
    next[index] = char;
    const updated = next.join('');
    onChange(updated);

    // Move to next box
    if (index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
      inputRefs.current[index + 1].select();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0 && inputRefs.current[index - 1]) {
        // Move back and clear previous
        const next = [...digits];
        next[index - 1] = '';
        onChange(next.join(''));
        inputRefs.current[index - 1].focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    onChange(pasted);
    const targetIdx = Math.min(pasted.length, 5);
    if (inputRefs.current[targetIdx]) {
      inputRefs.current[targetIdx].focus();
    }
  };

  return (
    <div className="flex items-center justify-center gap-1.5 xs:gap-2 sm:gap-3 w-full max-w-[340px] mx-auto" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => (inputRefs.current[idx] = el)}
          type={isMasked ? 'password' : 'text'}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          value={digits[idx] || ''}
          onChange={(e) => handleChange(e, idx)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          className={`flex-1 min-w-0 max-w-[46px] h-12 xs:h-13 sm:h-14 text-center text-lg sm:text-2xl font-mono font-bold rounded-xl border bg-slate-950 text-slate-100 transition-all outline-none ${
            error
              ? 'border-rose-500/80 bg-rose-500/5 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
              : digits[idx]
              ? 'border-brand-500/70 bg-brand-500/5 text-brand-300'
              : 'border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
          }`}
        />
      ))}
    </div>
  );
}

export default function PinModal({
  mode = 'unlock', // 'setup' | 'unlock'
  currentUser,
  onPinSuccess,
  onLogout,
  initialError = '',
}) {
  const isSetup = mode === 'setup';

  // Setup 2-step single-field state: 'enter' -> 'confirm'
  const [setupStep, setSetupStep] = useState('enter'); // 'enter' | 'confirm'
  const [firstPin, setFirstPin] = useState('');
  const [pin, setPin] = useState('');

  const [isMasked, setIsMasked] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);

  // Automatically trigger action when 6 digits are given
  const triggerAutoAction = useCallback((enteredCode) => {
    if (isSetup) {
      if (setupStep === 'enter') {
        // Step 1 -> Step 2: Auto-jump to confirmation step
        setTimeout(() => {
          setFirstPin(enteredCode);
          setPin('');
          setSetupStep('confirm');
          setError('');
        }, 130);
        return;
      }

      // Step 2: Auto-confirm entered PIN
      setTimeout(async () => {
        if (enteredCode !== firstPin) {
          setError('PINs did not match. Please set your 6-digit PIN again.');
          setPin('');
          setFirstPin('');
          setSetupStep('enter');
          return;
        }

        // Both match -> submit to backend automatically
        try {
          setLoading(true);
          await api.setupPin(firstPin, enteredCode);
          onPinSuccess(firstPin);
        } catch (err) {
          console.error('PIN setup error:', err);
          setError(err.message || 'Failed to configure encryption PIN.');
          setPin('');
          setFirstPin('');
          setSetupStep('enter');
        } finally {
          setLoading(false);
        }
      }, 130);
      return;
    }

    // Unlock Mode: Auto-verify PIN
    setTimeout(async () => {
      try {
        setLoading(true);
        await api.verifyPin(enteredCode);
        onPinSuccess(enteredCode);
      } catch (err) {
        console.error('PIN unlock error:', err);
        setLoading(false);
        setPin(''); // Clear on failure
        if (err.lockedOut) {
          onLogout(err.message || 'You entered the wrong PIN twice and have been logged out for security.');
        } else {
          setError(err.message || 'Incorrect PIN.');
          if (err.attemptsRemaining !== undefined) {
            setAttemptsRemaining(err.attemptsRemaining);
          }
        }
      }
    }, 130);
  }, [isSetup, setupStep, firstPin, onPinSuccess, onLogout]);

  // Handle PIN input change & check for 6-digit completion
  const handlePinChange = (newVal) => {
    if (loading) return;
    setPin(newVal);
    setError('');

    if (newVal.length === 6) {
      triggerAutoAction(newVal);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin.length === 6 && !loading) {
      triggerAutoAction(pin);
    }
  };

  return (
    <div className="w-full flex items-center justify-center py-2 sm:py-6 px-1 xs:px-3 sm:px-4">
      <div className="w-full max-w-md glass-panel p-4 xs:p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-800 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with inline icon */}
        <div className="text-center space-y-1.5 mb-5 sm:mb-6">
          <h2 className="text-xl xs:text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            {isSetup ? (
              setupStep === 'confirm' ? (
                <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-brand-400 stroke-[2.3] shrink-0" />
              ) : (
                <KeyRound className="w-5 h-5 sm:w-6 sm:h-6 text-brand-400 stroke-[2.3] shrink-0" />
              )
            ) : (
              <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-brand-400 stroke-[2.3] shrink-0" />
            )}
            <span>
              {isSetup
                ? setupStep === 'confirm'
                  ? 'Confirm 6-Digit PIN'
                  : 'Set Up 6-Digit PIN'
                : 'Unlock Password Vault'}
            </span>
          </h2>

          {/* Subtitle instructions */}
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto px-1">
            {isSetup
              ? setupStep === 'confirm'
                ? 'Re-enter your 6-digit PIN to confirm and activate your vault.'
                : 'Enter a 6-digit master PIN. It will automatically jump to confirmation.'
              : `Welcome back, ${currentUser?.name || 'User'}! Enter your 6-digit PIN to unlock.`}
          </p>

          {/* Step indicator in setup mode */}
          {isSetup && (
            <div className="pt-1.5 flex items-center justify-center gap-2">
              <span className={`text-[10px] xs:text-[11px] font-bold px-2.5 py-0.5 rounded-full transition-all ${
                setupStep === 'enter'
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                1. Enter PIN
              </span>
              <span className="text-slate-600 text-xs">→</span>
              <span className={`text-[10px] xs:text-[11px] font-bold px-2.5 py-0.5 rounded-full transition-all ${
                setupStep === 'confirm'
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                  : 'bg-slate-800/60 text-slate-500'
              }`}>
                2. Confirm PIN
              </span>
            </div>
          )}
        </div>

        {/* User identification badge in Unlock mode */}
        {!isSetup && currentUser && (
          <div className="mb-4 sm:mb-6 p-2 sm:p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center font-bold text-xs text-brand-400 shrink-0">
                {(currentUser.name || 'U').slice(0, 2).toUpperCase()}
              </div>
              <div className="truncate text-left">
                <p className="text-xs font-semibold text-slate-200 truncate">{currentUser.name}</p>
                <p className="text-[10px] sm:text-[11px] text-slate-500 font-mono truncate">{currentUser.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onLogout('Signed out successfully.')}
              className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-900 transition-colors shrink-0"
              title="Switch user account"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Switch</span>
            </button>
          </div>
        )}

        {/* Failed Attempt Warning Banner */}
        {attemptsRemaining === 1 && (
          <div className="mb-4 sm:mb-5 p-2.5 sm:p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">1 Attempt Remaining</p>
              <p className="text-[11px] text-amber-400/90 mt-0.5">
                If the incorrect PIN is entered again, you will be automatically logged out of your account.
              </p>
            </div>
          </div>
        )}

        {/* Error notification */}
        {error && attemptsRemaining !== 1 && (
          <div className="mb-4 sm:mb-5 p-2.5 sm:p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* PIN Form - No submit button, 100% automated on 6th digit */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {isSetup 
                  ? setupStep === 'confirm' ? 'Re-Enter 6-Digit PIN' : 'Enter 6-Digit PIN'
                  : 'Enter 6-Digit PIN'}
              </label>
              <button
                type="button"
                onClick={() => setIsMasked(!isMasked)}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800/60 transition-colors"
              >
                {isMasked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>{isMasked ? 'Reveal' : 'Mask'}</span>
              </button>
            </div>

            {/* Single 6-digit input row */}
            <DigitInputRow
              key={`${mode}-${setupStep}`}
              value={pin}
              onChange={handlePinChange}
              disabled={loading}
              isMasked={isMasked}
              autoFocus={true}
              error={!!error}
            />
          </div>

          {/* Inline Loading Status Indicator (Appears when verifying or setting up) */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-brand-400 font-medium animate-in fade-in">
              <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <span>
                {isSetup ? 'Activating encryption PIN...' : 'Verifying PIN & unlocking vault...'}
              </span>
            </div>
          )}

          {/* Optional Step 2 "Back to change PIN" link */}
          {isSetup && setupStep === 'confirm' && !loading && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setSetupStep('enter');
                  setPin(firstPin);
                  setError('');
                }}
                className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 transition-colors hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to change PIN</span>
              </button>
            </div>
          )}
        </form>

        {/* Security advisory */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-2 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-400" />
            <span>Zero-Knowledge: PIN is never transmitted in cleartext</span>
          </div>
          {isSetup && (
            <p className="text-[11px] text-slate-600">
              Important: Memorize this PIN. Without it, your encrypted passwords cannot be unlocked.
            </p>
          )}
          {isSetup && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onLogout('Signed out.')}
                className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-4"
              >
                Sign out and set up PIN later
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
