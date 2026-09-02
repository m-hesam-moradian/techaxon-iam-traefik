"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { QrCode } from "./qr-code";

interface MfaSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function MfaSetupModal({ isOpen, onClose, onSuccess }: MfaSetupModalProps) {
  const { setupMfa, enableMfa } = useAuth();
  const [step, setStep] = useState<"loading" | "scan" | "backup">("loading");
  const [setupData, setSetupData] = useState<{ secret: string; keyUri: string } | null>(null);
  const [verificationCode, setVerificationCode] = useState<string>("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [copiedCodes, setCopiedCodes] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      setStep("loading");
      setSetupData(null);
      setVerificationCode("");
      setBackupCodes([]);
      setError(null);
      return;
    }

    const initSetup = async () => {
      setStep("loading");
      const data = await setupMfa();
      if (data) {
        setSetupData(data);
        setStep("scan");
      } else {
        setError("Failed to generate 2FA secret. Please try again.");
      }
    };

    initSetup();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupData || verificationCode.length !== 6) return;

    setIsSubmitting(true);
    setError(null);

    const result = await enableMfa(verificationCode, setupData.secret);
    setIsSubmitting(false);

    if (result.success && result.backupCodes) {
      setBackupCodes(result.backupCodes);
      setStep("backup");
      onSuccess();
    } else {
      setError(result.error || "Invalid 6-digit code. Please verify the code in your app.");
    }
  };

  const copySecret = () => {
    if (!setupData) return;
    navigator.clipboard.writeText(setupData.secret);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const downloadBackupCodes = () => {
    const element = document.createElement("a");
    const file = new Blob([backupCodes.join("\n")], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = "techaxon-backup-codes.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-3xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 sm:p-8 shadow-2xl overflow-hidden transition-all">
        {step === "loading" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Generating secure TOTP secret key...
            </p>
          </div>
        )}

        {step === "scan" && setupData && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Set Up Two-Factor Authentication
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Scan the QR code with Google Authenticator, 1Password, or Bitwarden.
                </p>
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

            {/* QR Code display */}
            <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
              <QrCode value={setupData.keyUri} size={160} />

              <div className="flex-1 space-y-3 w-full">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Manual Entry Secret Key
                  </span>
                  <div className="flex items-center gap-2">
                    <code className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1.5 font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200 select-all break-all">
                      {setupData.secret}
                    </code>
                    <button
                      type="button"
                      onClick={copySecret}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap"
                    >
                      {copiedKey ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Can&apos;t scan? Enter the manual secret into your authenticator app under Time-based (TOTP).
                </p>
              </div>
            </div>

            {/* Verification Form */}
            <form onSubmit={handleVerify} className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  Enter 6-Digit Code from App
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full text-center tracking-[0.4em] font-mono text-2xl font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  autoFocus
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verificationCode.length !== 6 || isSubmitting}
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2.5 text-sm font-semibold text-white shadow-md transition disabled:opacity-50"
                >
                  {isSubmitting ? "Verifying..." : "Verify & Enable 2FA"}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === "backup" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  2FA Activated Successfully!
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Save your recovery backup codes in a secure place.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20 p-4 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              ⚠️ If you lose access to your authenticator app, these single-use codes are the <strong>only way</strong> to regain access to your account. Each code can be used once.
            </div>

            {/* Backup Codes Grid */}
            <div className="grid grid-cols-2 gap-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 p-4 border border-zinc-200/80 dark:border-zinc-800">
              {backupCodes.map((code, idx) => (
                <div
                  key={idx}
                  className="rounded-lg bg-white dark:bg-zinc-900 px-3 py-2 text-center font-mono text-xs font-bold text-zinc-800 dark:text-zinc-200 border border-zinc-200/50 dark:border-zinc-800 select-all"
                >
                  {code}
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={copyBackupCodes}
                className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                {copiedCodes ? "✓ Copied to Clipboard" : "📋 Copy All Codes"}
              </button>
              <button
                type="button"
                onClick={downloadBackupCodes}
                className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                💾 Download (.txt)
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-zinc-900 dark:bg-zinc-100 py-3 text-sm font-semibold text-white dark:text-zinc-900 shadow-sm hover:opacity-90 transition"
            >
              I have saved my backup codes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
