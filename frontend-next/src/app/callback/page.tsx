"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import Link from "next/link";

function CallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { exchangeCode } = useAuth();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const executedRef = useRef(false);

  useEffect(() => {
    // Avoid double execution in React 18/19 StrictMode
    if (executedRef.current) return;
    executedRef.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state") || "";
    const errorParam = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (errorParam) {
      setStatus("error");
      setErrorMessage(errorDescription || errorParam || "Authentication was rejected by the server.");
      return;
    }

    if (!code) {
      setStatus("error");
      setErrorMessage("No authorization code was found in the callback request.");
      return;
    }

    const performExchange = async () => {
      try {
        const success = await exchangeCode(code, state);
        if (success) {
          setStatus("success");
          setTimeout(() => {
            router.replace("/");
          }, 1200);
        } else {
          setStatus("error");
          setErrorMessage("Failed to exchange authorization code for tokens.");
        }
      } catch (err: unknown) {
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Unexpected error during token exchange");
      }
    };

    performExchange();
  }, [searchParams, exchangeCode, router]);

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 p-8 shadow-2xl backdrop-blur-xl transition-all">
        {status === "processing" && (
          <div className="text-center space-y-5">
            <div className="relative mx-auto h-16 w-16">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20"></div>
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400 dark:border-t-transparent"></div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Verifying Credentials
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Exchanging OIDC authorization code with TechAxon IAM (<code className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">POST /auth/token</code>)...
              </p>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <svg className="h-8 w-8 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Authentication Successful
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Access token issued. Redirecting to dashboard...
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="text-center space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Authorization Failed
              </h2>
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 font-mono text-left break-words">
                {errorMessage}
              </div>
            </div>
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 dark:bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-white dark:text-zinc-900 shadow-sm hover:opacity-90 transition-opacity"
            >
              Return to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[80vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
