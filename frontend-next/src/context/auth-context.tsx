"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  mfaEnabled?: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface AuthContextType {
  user: UserProfile | null;
  accessToken: string | null;
  expiresIn: number | null;
  tokenExpiresAt: number | null;
  isLoading: boolean;
  error: string | null;
  clientId: string;
  iamBaseUrl: string;
  setIamBaseUrl: (url: string) => void;
  loginWithSSO: (customClientId?: string) => Promise<void>;
  exchangeCode: (code: string, returnedState: string) => Promise<boolean>;
  refreshAccessToken: () => Promise<boolean>;
  fetchUserProfile: (token?: string) => Promise<UserProfile | null>;
  logout: () => Promise<void>;
  clearError: () => void;

  // ─── MFA Methods ───
  setupMfa: () => Promise<{ secret: string; keyUri: string } | null>;
  enableMfa: (code: string, secret: string) => Promise<{ success: boolean; backupCodes?: string[]; error?: string }>;
  disableMfa: (password: string, code: string) => Promise<{ success: boolean; error?: string }>;
  authenticateMfa: (mfaToken: string, code?: string, backupCode?: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  CLIENT_ID: "techaxon_client_id",
  OAUTH_STATE: "techaxon_oauth_state",
  REDIRECT_URI: "techaxon_redirect_uri",
};

const getTokenExpiresAt = (expiresIn: number): number =>
  Date.now() + expiresIn * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [clientId] = useState<string>("techaxon-web");
  const restoreAttempted = useRef(false);
  const [iamBaseUrl, setIamBaseUrlState] = useState<string>(
    process.env.NEXT_PUBLIC_IAM_BASE_URL || "http://localhost:3000",
  );

  const clearError = () => setError(null);

  const setIamBaseUrl = (url: string) => {
    setIamBaseUrlState(url);
  };

  // Fetch current user profile using access token (GET /auth/me)
  const fetchUserProfile = useCallback(
    async (tokenToUse?: string): Promise<UserProfile | null> => {
      const token = tokenToUse || accessToken;
      if (!token) return null;

      try {
        const res = await fetch(`${iamBaseUrl}/auth/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          if (res.status === 401) {
            setUser(null);
          }
          return null;
        }

        const data = await res.json();
        const profile: UserProfile = {
          id: data.id || data.userId || data.sub,
          username: data.username || "User",
          email: data.email,
          mfaEnabled: Boolean(data.mfa?.enabled || data.mfaEnabled),
        };
        setUser(profile);
        return profile;
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
        return null;
      }
    },
    [accessToken, iamBaseUrl]
  );

  // Restore the in-memory access token from the HttpOnly refresh cookie.
  useEffect(() => {
    if (restoreAttempted.current) return;
    restoreAttempted.current = true;

    const restoreSession = async () => {
      try {
        try {
          localStorage.removeItem("techaxon_access_token");
          localStorage.removeItem("techaxon_refresh_token");
          localStorage.removeItem("techaxon_user_profile");
          localStorage.removeItem("techaxon_token_expires_at");
        } catch (cleanupError) {
          console.warn("Could not remove legacy browser auth storage:", cleanupError);
        }

        const res = await fetch(`${iamBaseUrl}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        });

        if (res.status === 401) return;
        if (!res.ok) {
          throw new Error(`Session restoration failed with status ${res.status}`);
        }

        const data = await res.json();
        const restoredAccessToken = data.accessToken || data.access_token;
        if (!restoredAccessToken) {
          throw new Error("Session restoration response did not include an access token");
        }

        const restoredExpiresIn = data.expires_in || 900;
        setAccessToken(restoredAccessToken);
        setExpiresIn(restoredExpiresIn);
        setTokenExpiresAt(Date.now() + restoredExpiresIn * 1000);
        await fetchUserProfile(restoredAccessToken);
      } catch (restoreError) {
        console.error("Failed to restore authentication session:", restoreError);
      } finally {
        setIsLoading(false);
      }
    };

    void restoreSession();
  }, [fetchUserProfile, iamBaseUrl]);

  // Initiate the OAuth 2.0 Authorization Code flow using IAM's registered callback.
  const loginWithSSO = async (customClientId?: string): Promise<void> => {
    if (typeof window === "undefined") return;

    const activeClientId = customClientId || clientId;
    setError(null);

    try {
      const configUrl = new URL(`${iamBaseUrl}/auth/client-config`, window.location.origin);
      configUrl.searchParams.set("client_id", activeClientId);
      const configResponse = await fetch(configUrl, { credentials: "include" });
      if (!configResponse.ok) {
        throw new Error(`IAM client configuration failed with status ${configResponse.status}`);
      }

      const { redirectUri } = await configResponse.json();
      if (typeof redirectUri !== "string" || !redirectUri) {
        throw new Error("IAM did not return a registered callback URI");
      }

      const state = crypto.randomUUID();
      sessionStorage.setItem(STORAGE_KEYS.OAUTH_STATE, state);
      sessionStorage.setItem(STORAGE_KEYS.CLIENT_ID, activeClientId);
      sessionStorage.setItem(STORAGE_KEYS.REDIRECT_URI, redirectUri);

      const authorizeUrl = new URL(
        `${iamBaseUrl}/auth/authorize`,
        window.location.origin,
      );
      authorizeUrl.searchParams.set("client_id", activeClientId);
      authorizeUrl.searchParams.set("redirect_uri", redirectUri);
      authorizeUrl.searchParams.set("response_type", "code");
      authorizeUrl.searchParams.set("state", state);

      window.location.href = authorizeUrl.toString();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Failed to start sign-in");
    }
  };

  // Exchange authorization code for tokens (POST /auth/token)
  const exchangeCode = async (code: string, returnedState: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const savedState = sessionStorage.getItem(STORAGE_KEYS.OAUTH_STATE);
      const savedClientId = sessionStorage.getItem(STORAGE_KEYS.CLIENT_ID) || clientId;
      const redirectUri = sessionStorage.getItem(STORAGE_KEYS.REDIRECT_URI);

      if (!savedState || returnedState !== savedState) {
        throw new Error("CSRF State mismatch detected. Authorization aborted.");
      }
      if (!redirectUri) {
        throw new Error("The registered callback URI is missing. Please sign in again.");
      }

      const res = await fetch(`${iamBaseUrl}/auth/token`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
          client_id: savedClientId,
          redirect_uri: redirectUri,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Token exchange failed with status ${res.status}`
        );
      }

      const data: TokenResponse = await res.json();
      const expiresAtTimestamp = Date.now() + (data.expires_in || 900) * 1000;

      setAccessToken(data.access_token);
      setExpiresIn(data.expires_in);
      setTokenExpiresAt(expiresAtTimestamp);

      await fetchUserProfile(data.access_token);
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_STATE);
      sessionStorage.removeItem(STORAGE_KEYS.CLIENT_ID);
      sessionStorage.removeItem(STORAGE_KEYS.REDIRECT_URI);

      return true;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to exchange authorization code";
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh access token (POST /auth/refresh)
  const refreshAccessToken = async (): Promise<boolean> => {
    try {
      const res = await fetch(`${iamBaseUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error("Session expired or refresh token revoked. Please login again.");
      }

      const data = await res.json();
      const newAccessToken = data.accessToken || data.access_token;
      const refreshedExpiresIn = data.expires_in || 15 * 60;
      const expiresAtTimestamp = getTokenExpiresAt(refreshedExpiresIn);

      setAccessToken(newAccessToken);
      setExpiresIn(refreshedExpiresIn);
      setTokenExpiresAt(expiresAtTimestamp);

      await fetchUserProfile(newAccessToken);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Token refresh failed";
      setError(msg);
      await logout();
      return false;
    }
  };

  // ─── MFA API Implementations ───

  const setupMfa = async (): Promise<{ secret: string; keyUri: string } | null> => {
    if (!accessToken) return null;
    setError(null);

    try {
      const res = await fetch(`${iamBaseUrl}/auth/mfa/setup`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to initialize 2FA setup");
      }

      return await res.json();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "2FA setup failed";
      setError(msg);
      return null;
    }
  };

  const enableMfa = async (
    code: string,
    secret: string
  ): Promise<{ success: boolean; backupCodes?: string[]; error?: string }> => {
    if (!accessToken) return { success: false, error: "Not authenticated" };
    setError(null);

    try {
      const res = await fetch(`${iamBaseUrl}/auth/mfa/enable`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code, secret }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || "Invalid 2FA code" };
      }

      if (user) {
        setUser({ ...user, mfaEnabled: true });
      }

      return { success: true, backupCodes: data.backupCodes };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to enable 2FA";
      return { success: false, error: msg };
    }
  };

  const disableMfa = async (
    password: string,
    code: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!accessToken) return { success: false, error: "Not authenticated" };
    setError(null);

    try {
      const res = await fetch(`${iamBaseUrl}/auth/mfa/disable`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password, code }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || "Failed to disable 2FA" };
      }

      if (user) {
        setUser({ ...user, mfaEnabled: false });
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to disable 2FA";
      return { success: false, error: msg };
    }
  };

  const authenticateMfa = async (
    mfaToken: string,
    code?: string,
    backupCode?: string
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${iamBaseUrl}/auth/mfa/authenticate`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Client": clientId,
        },
        body: JSON.stringify({
          mfa_token: mfaToken,
          code: code || undefined,
          backup_code: backupCode || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "MFA verification failed");
      }

      const data = await res.json();
      const expiresAtTimestamp = Date.now() + 15 * 60 * 1000;

      setAccessToken(data.accessToken);
      setTokenExpiresAt(expiresAtTimestamp);

      if (data.user) {
        const profile: UserProfile = {
          id: data.user.id,
          username: data.user.username,
          email: data.user.email,
          mfaEnabled: true,
        };
        setUser(profile);
      } else {
        await fetchUserProfile(data.accessToken);
      }

      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "2FA verification failed";
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout (POST /auth/logout)
  const logout = async () => {
    try {
      if (accessToken) {
        const res = await fetch(`${iamBaseUrl}/auth/logout`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          throw new Error(`Logout failed with status ${res.status}`);
        }
      }
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Logout failed");
    } finally {
      setUser(null);
      setAccessToken(null);
      setExpiresIn(null);
      setTokenExpiresAt(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        expiresIn,
        tokenExpiresAt,
        isLoading,
        error,
        clientId,
        iamBaseUrl,
        setIamBaseUrl,
        loginWithSSO,
        exchangeCode,
        refreshAccessToken,
        fetchUserProfile,
        logout,
        clearError,
        setupMfa,
        enableMfa,
        disableMfa,
        authenticateMfa,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
