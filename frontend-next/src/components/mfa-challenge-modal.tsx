"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/auth-context";

interface MfaChallengeModalProps {
  isOpen: boolean;
  mfaToken: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function MfaChallengeModal({ isOpen, mfaToken, onClose, onSuccess }: MfaChallengeModalProps) {
  const { authenticateMfa } = useAuth();
  const [useBackupCode, setUseBackupCode] = useState<boolean>(false);
  const [code, setCode] = useState<string>("");
  const [backupCode, setBackupCode] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !mfaToken) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const success = await authenticateMfa(
      mfaToken,
      useBackupCode ? undefined : code,
      useBackupCode ? backupCode : undefined
    );

    setIsSubmitting(false);

    if (success) {
      onSuccess();
    } else {
      setError(
        useBackupCode
          ? "Invalid or already used backup code."
          : "Invalid 6-digit code. Please check your authenticator app."
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Two-Step Verification
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {useBackupCode
              ? "Enter one of your single-use 8-character backup recovery codes."
              : "Enter the 6-digit code from your authenticator app."}
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 font-medium text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!useBackupCode ? (
            <div className="space-y-1.5">
              <input
                type="text"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full text-center tracking-[0.4em] font-mono text-2xl font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                autoFocus
                required
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <input
                type="text"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value.toLowerCase().trim())}
                placeholder="xxxx-xxxx"
                className="w-full text-center tracking-widest font-mono text-lg font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                autoFocus
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={(!useBackupCode && code.length !== 6) || (useBackupCode && !backupCode) || isSubmitting}
            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 py-3 text-sm font-semibold text-white shadow-md transition disabled:opacity-50"
          >
            {isSubmitting ? "Verifying..." : "Authenticate"}
          </button>

          <div className="flex items-center justify-between text-xs pt-2">
            <button
              type="button"
              onClick={() => {
                setUseBackupCode(!useBackupCode);
                setError(null);
              }}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              {useBackupCode ? "← Use Authenticator App" : "Lost phone? Use Backup Code"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
