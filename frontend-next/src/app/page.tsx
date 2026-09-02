"use client";

import { useState, useEffect } from "react";
import { useAuth, REGISTERED_CLIENTS } from "@/context/auth-context";
import { MfaSetupModal } from "@/components/mfa-setup-modal";
import { MfaDisableModal } from "@/components/mfa-disable-modal";

export default function Home() {
  const {
    user,
    accessToken,
    refreshToken,
    tokenExpiresAt,
    isLoading,
    error,
    clientId,
    setClientId,
    iamBaseUrl,
    setIamBaseUrl,
    loginWithSSO,
    refreshAccessToken,
    fetchUserProfile,
    logout,
    clearError,
  } = useAuth();

  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [apiLoading, setApiLoading] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isMfaSetupOpen, setIsMfaSetupOpen] = useState<boolean>(false);
  const [isMfaDisableOpen, setIsMfaDisableOpen] = useState<boolean>(false);

  // Live token countdown timer
  useEffect(() => {
    if (!tokenExpiresAt) {
      setSecondsRemaining(null);
      return;
    }

    const updateRemaining = () => {
      const remaining = Math.max(0, Math.floor((tokenExpiresAt - Date.now()) / 1000));
      setSecondsRemaining(remaining);
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [tokenExpiresAt]);

  const handleTestProtectedApi = async () => {
    setApiLoading(true);
    setApiResponse(null);
    try {
      const res = await fetch(`${iamBaseUrl}/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      setApiResponse(JSON.stringify({ status: res.status, data }, null, 2));
    } catch (err: unknown) {
      setApiResponse(
        JSON.stringify(
          { error: err instanceof Error ? err.message : "Failed to call /auth/me" },
          null,
          2
        )
      );
    } finally {
      setApiLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-zinc-500">Checking SSO Session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/20 font-bold text-lg">
              TX
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  TechAxon
                </span>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  OIDC / SSO Client
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Connected to IAM: <code className="font-mono text-[11px]">{iamBaseUrl}</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {user.username}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    {user.email || user.id}
                  </span>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white font-semibold text-sm shadow-sm">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={() => logout()}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  No Active Session
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col p-4 sm:p-6 lg:p-8">
        {error && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 flex-shrink-0 text-rose-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
            <button onClick={clearError} className="text-xs font-semibold hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {!user ? (
          /* ================================================================
             UNAUTHENTICATED STATE (Hero + Login Trigger + Flow Visualizer)
             ================================================================ */
          <div className="flex flex-col gap-10 py-6">
            <div className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900/60 p-8 sm:p-12 shadow-xl">
              <div className="absolute top-0 right-0 -mt-12 -mr-12 h-96 w-96 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/20 blur-3xl pointer-events-none"></div>

              <div className="relative z-10 max-w-3xl space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/80 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/50 dark:text-indigo-300">
                  <span>🚀</span> End-to-End OIDC Authorization Code Flow
                </div>

                <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
                  TechAxon Single Sign-On Portal
                </h1>

                <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
                  This Next.js application acts as a registered client application in the TechAxon ecosystem. It tests the complete OIDC Authorization Code Grant flow, session detection, and token exchange.
                </p>

                {/* Client Selector & Configuration */}
                <div className="grid gap-4 sm:grid-cols-2 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      OIDC Client Identifier
                    </label>
                    <select
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm font-medium text-zinc-900 shadow-sm transition dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {REGISTERED_CLIENTS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      IAM Base URL (NestJS)
                    </label>
                    <input
                      type="text"
                      value={iamBaseUrl}
                      onChange={(e) => setIamBaseUrl(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm font-medium text-zinc-900 shadow-sm transition dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button
                    onClick={() => loginWithSSO()}
                    className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.98]"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Sign In with TechAxon SSO
                  </button>

                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>Redirect target:</span>
                    <code className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-1 font-mono">
                      /auth/authorize?client_id={clientId}
                    </code>
                  </div>
                </div>
              </div>
            </div>

            {/* OIDC Flow Architecture Steps */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                OIDC Authorization Code Flow Pipeline
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-bold text-sm dark:bg-indigo-950 dark:text-indigo-400 mb-3">
                    1
                  </div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                    GET /auth/authorize
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Client initiates flow with <code className="font-mono text-[11px]">client_id</code>, <code className="font-mono text-[11px]">redirect_uri</code>, and <code className="font-mono text-[11px]">state</code>.
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-bold text-sm dark:bg-indigo-950 dark:text-indigo-400 mb-3">
                    2
                  </div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                    SSO Cookie / Login Form
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    If <code className="font-mono text-[11px]">techaxon_refresh_token</code> cookie is present, skips login form; otherwise renders Handlebars UI.
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-bold text-sm dark:bg-indigo-950 dark:text-indigo-400 mb-3">
                    3
                  </div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                    302 Auth Code Redirect
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Generates 60-second single-use Authorization Code and redirects browser with <code className="font-mono text-[11px]">?code=...</code>.
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-bold text-sm dark:bg-indigo-950 dark:text-indigo-400 mb-3">
                    4
                  </div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                    POST /auth/token
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Client exchanges code for real <code className="font-mono text-[11px]">accessToken</code> + <code className="font-mono text-[11px]">refreshToken</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ================================================================
             AUTHENTICATED STATE (Profile + Session Status + API Tester)
             ================================================================ */
          <div className="space-y-6 py-4">
            {/* User Profile Banner */}
            <div className="rounded-3xl border border-zinc-200/80 bg-gradient-to-r from-indigo-900 via-indigo-950 to-zinc-900 p-6 sm:p-8 text-white shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-2xl font-bold">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold">{user.username}</h2>
                      <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                        Authenticated
                      </span>
                    </div>
                    <p className="text-sm text-indigo-200 font-mono mt-0.5">
                      Subject ID: {user.id}
                    </p>
                    {user.email && (
                      <p className="text-xs text-indigo-300/80 mt-0.5">
                        Email: {user.email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => refreshAccessToken()}
                    className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 text-xs font-semibold text-white transition backdrop-blur-sm"
                  >
                    🔄 Refresh Token
                  </button>
                  <button
                    onClick={() => logout()}
                    className="rounded-xl bg-rose-500/80 hover:bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>

            {/* Token Inspector & Session Cards */}
            <div className="grid gap-6 md:grid-cols-3">
              {/* Access Token Card */}
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Access Token (JWT)
                    </span>
                    {secondsRemaining !== null && (
                      <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full ${
                        secondsRemaining < 60
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 animate-pulse"
                          : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                      }`}>
                        ⏱ {secondsRemaining}s left
                      </span>
                    )}
                  </div>
                  <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 p-3 font-mono text-[11px] text-zinc-600 dark:text-zinc-400 break-all max-h-24 overflow-y-auto border border-zinc-200/50 dark:border-zinc-800">
                    {accessToken || "None"}
                  </div>
                </div>
                <button
                  onClick={() => accessToken && copyToClipboard(accessToken, "access")}
                  className="mt-3 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition text-center"
                >
                  {copiedKey === "access" ? "✓ Copied" : "Copy Access Token"}
                </button>
              </div>

              {/* Refresh Token Card */}
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Refresh Token
                    </span>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      ● Active (30d TTL)
                    </span>
                  </div>
                  <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 p-3 font-mono text-[11px] text-zinc-600 dark:text-zinc-400 break-all max-h-24 overflow-y-auto border border-zinc-200/50 dark:border-zinc-800">
                    {refreshToken || "None"}
                  </div>
                </div>
                <button
                  onClick={() => refreshToken && copyToClipboard(refreshToken, "refresh")}
                  className="mt-3 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition text-center"
                >
                  {copiedKey === "refresh" ? "✓ Copied" : "Copy Refresh Token"}
                </button>
              </div>

              {/* SSO Cross-App Test Card */}
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-purple-50/30 p-5 dark:border-indigo-900/40 dark:from-indigo-950/20 dark:to-purple-950/20 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-1">
                    Multi-App SSO Demo
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Because your IAM session cookie is active, requesting authorization for another app (e.g. LMS) will log you in <strong>instantly without a password</strong>.
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    onClick={() => loginWithSSO("techaxon-lms")}
                    className="w-full rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                  >
                    Test SSO with TechAxon LMS →
                  </button>
                  <button
                    onClick={() => loginWithSSO("techaxon-kanban")}
                    className="w-full rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-900 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-zinc-800 transition"
                  >
                    Test SSO with TechAxon Kanban →
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive API Tester Panel */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100">
                    Test Protected API Endpoint (<code className="font-mono text-sm">GET /auth/me</code>)
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Validates the issued Access Token with the NestJS <code className="font-mono text-[11px]">JwtAuthGuard</code>.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestProtectedApi}
                    disabled={apiLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 hover:opacity-90 transition disabled:opacity-50"
                  >
                    {apiLoading ? (
                      <span className="flex items-center gap-1.5">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white dark:border-zinc-900 border-t-transparent"></span>
                        Sending...
                      </span>
                    ) : (
                      "Send GET /auth/me"
                    )}
                  </button>
                </div>
              </div>

              {apiResponse && (
                <div className="mt-4">
                  <div className="flex items-center justify-between rounded-t-xl bg-zinc-800 px-4 py-2 text-xs text-zinc-300 font-mono">
                    <span>Response from IAM</span>
                    <span>HTTP 200 OK</span>
                  </div>
                  <pre className="rounded-b-xl bg-zinc-950 p-4 font-mono text-xs text-emerald-400 overflow-x-auto border border-zinc-800">
                    {apiResponse}
                  </pre>
                </div>
              )}
            </div>

            {/* Two-Factor Authentication (2FA / MFA) Management Card */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                    user.mfaEnabled
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  }`}>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-zinc-900 dark:text-zinc-100">
                        Two-Factor Authentication (TOTP)
                      </h3>
                      {user.mfaEnabled ? (
                        <span className="rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 text-xs font-semibold">
                          🛡️ Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2.5 py-0.5 text-xs font-semibold">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {user.mfaEnabled
                        ? "Your account is secured with Time-based One-Time Passwords (RFC 6238) and 8 recovery backup codes."
                        : "Protect your account by requiring an authenticator app code during sign-in."}
                    </p>
                  </div>
                </div>

                <div>
                  {user.mfaEnabled ? (
                    <button
                      onClick={() => setIsMfaDisableOpen(true)}
                      className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition"
                    >
                      Disable 2FA
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsMfaSetupOpen(true)}
                      className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-semibold text-white shadow-md transition"
                    >
                      ⚡ Set Up 2FA Now
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MFA Setup Modal */}
      <MfaSetupModal
        isOpen={isMfaSetupOpen}
        onClose={() => setIsMfaSetupOpen(false)}
        onSuccess={() => {
          fetchUserProfile();
        }}
      />

      {/* MFA Disable Modal */}
      <MfaDisableModal
        isOpen={isMfaDisableOpen}
        onClose={() => setIsMfaDisableOpen(false)}
        onSuccess={() => {
          fetchUserProfile();
        }}
      />
    </div>
  );
}
