import React, { useState } from 'react';
import { Lock, User, ShieldCheck, LogIn } from 'lucide-react';
import iconLogo from '../assets/download-no-bg.png';

interface LoginScreenProps {
  onLogin: (username: string, password: string) => void;
  error?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, error }) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] grid-background flex items-center justify-center p-6 md:p-10">
      <style>{`
        @keyframes logoBlinkGlow {
          0%, 100% { opacity: 1; filter: drop-shadow(0 2px 10px rgba(59, 130, 246, 0.15)); }
          50% { opacity: 0.84; filter: drop-shadow(0 6px 22px rgba(90, 53, 243, 0.32)); }
        }
      `}</style>
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="text-center lg:text-left">
          <img
            src={iconLogo}
            alt="Build1 logo"
            className="mx-auto lg:mx-0 w-4/5 lg:w-full h-auto object-contain rounded-2xl"
            style={{ animation: 'logoBlinkGlow 2.2s ease-in-out infinite' }}
          />
        </div>

        <div className="w-full max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-xl p-7 space-y-5">
          <div className="space-y-1.5 text-center">
            <h1 className="text-xl font-extrabold text-slate-900">Login to Continue</h1>
            <p className="text-xs text-slate-500">
              Enter your username and password to access workflow processing.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Username</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-xs flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Login
            </button>
          </form>

          <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Forgot Password?
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
