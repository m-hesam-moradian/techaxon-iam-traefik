"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/auth-context";

interface MfaDisableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function MfaDisableModal({ isOpen, onClose, onSuccess }: MfaDisableModalProps) {
  const { disableMfa } = useAuth();
  const [password, setPassword] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || code.length !== 6) return;

    setIsSubmitting(true);
    setError(null);

    const result = await disableMfa(password, code);
    setIsSubmitting(false);

    if (result.success) {
      onSuccess();
      onClose();
    } else {
      setError(result.error || "Failed to disable 2FA. Please verify password and code.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Disable Two-Factor Auth
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                This will lower your account security level.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleDisable} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Account Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              6-Digit Authenticator Code
            </label>
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full text-center tracking-[0.3em] font-mono text-xl font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!password || code.length !== 6 || isSubmitting}
              className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 py-2.5 text-xs font-semibold text-white shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? "Disabling..." : "Disable 2FA"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
