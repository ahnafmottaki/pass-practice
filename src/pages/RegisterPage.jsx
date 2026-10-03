import React, { useState } from 'react';
import { 
  UserPlus, User, Mail, Lock, Eye, EyeOff, 
  ArrowRight, ShieldCheck, AlertCircle, CheckCircle2, Sparkles, ArrowLeft 
} from 'lucide-react';
import api from '../api';

export default function RegisterPage({ onRegisterSuccess, onNavigateToLogin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError('Please enter your full name (minimum 2 characters).');
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setError('Please provide a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your password confirmation.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.register(trimmedName, trimmedEmail, password, confirmPassword);
      onRegisterSuccess(res.user);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center py-2 sm:py-6 px-1 xs:px-3 sm:px-4">
      {/* Brand logo banner */}
      <div className="text-center mb-4 sm:mb-6">
        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] sm:text-xs text-slate-400">
          <Sparkles className="w-3.5 h-3.5 text-brand-400 shrink-0" />
          <span>Local SQLite · Zero-Knowledge Security</span>
        </div>
      </div>

      {/* Main Register Card */}
      <div className="w-full max-w-md glass-panel p-4 xs:p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-800 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Card Header */}
        <div className="text-center space-y-1.5 mb-5 sm:mb-6">
          <h1 className="text-xl xs:text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <UserPlus className="w-5 h-5 sm:w-6 sm:h-6 text-brand-400 stroke-[2.3] shrink-0" />
            <span>Create Your Vault</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xs mx-auto px-1">
            Set up your account to start building password muscle memory and recall.
          </p>
        </div>

        {/* Error / Alert banner */}
        {error && (
          <div className="mb-4 sm:mb-5 p-2.5 sm:p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Register Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                autoComplete="name"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Password
              </label>
              <span className="text-[11px] text-slate-500">Min 6 characters</span>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="new-password"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Confirm Password
              </label>
              {passwordsMatch && (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Passwords match
                </span>
              )}
              {passwordsMismatch && (
                <span className="text-[11px] text-rose-400">
                  Passwords do not match
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="new-password"
                className={`w-full pl-10 pr-10 py-2.5 bg-slate-950 border rounded-xl text-slate-100 text-sm focus:outline-none transition-colors ${
                  passwordsMismatch
                    ? 'border-rose-500 focus:border-rose-500'
                    : 'border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || passwordsMismatch}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition-all active:scale-[0.99]"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Create Vault Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Navigation to Login Page */}
        <div className="mt-7 pt-6 border-t border-slate-800/80 text-center">
          <p className="text-xs text-slate-400">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="text-brand-400 hover:text-brand-300 font-bold hover:underline transition-colors inline-flex items-center gap-1 ml-1"
            >
              <span>Sign In to Vault</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </p>
        </div>

        {/* Security badge footer */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-brand-400 shrink-0" />
          <span>Passwords securely hashed with scrypt in local SQLite</span>
        </div>
      </div>
    </div>
  );
}
