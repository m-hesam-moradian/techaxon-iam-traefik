"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

interface AuthContextType {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresIn: number | null;
  tokenExpiresAt: number | null;
  isLoading: boolean;
  error: string | null;
  clientId: string;
  setClientId: (id: string) => void;
  iamBaseUrl: string;
  setIamBaseUrl: (url: string) => void;
  loginWithSSO: (customClientId?: string) => void;
  exchangeCode: (code: string, returnedState: string) => Promise<boolean>;
  refreshAccessToken: () => Promise<boolean>;
  fetchUserProfile: (token?: string) => Promise<UserProfile | null>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ACCESS_TOKEN: "techaxon_access_token",
  REFRESH_TOKEN: "techaxon_refresh_token",
  USER: "techaxon_user_profile",
  EXPIRES_AT: "techaxon_token_expires_at",
  CLIENT_ID: "techaxon_client_id",
  OIDC_STATE: "techaxon_oidc_state",
};

export const REGISTERED_CLIENTS = [
  { id: "techaxon-web", name: "TechAxon Web Portal", callbackUrl: "/callback" },
  { id: "techaxon-lms", name: "TechAxon LMS", callbackUrl: "/callback" },
  { id: "techaxon-kanban", name: "TechAxon Kanban", callbackUrl: "/callback" },
  { id: "techaxon-shop", name: "TechAxon Shop", callbackUrl: "/callback" },
  { id: "test-client", name: "Test Client Application", callbackUrl: "/callback" },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientIdState] = useState<string>("techaxon-web");
  const [iamBaseUrl, setIamBaseUrlState] = useState<string>("http://localhost:3000");

  const clearError = () => setError(null);

  const setClientId = (id: string) => {
    setClientIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.CLIENT_ID, id);
    }
  };

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
            // Token expired or invalid
            setUser(null);
          }
          return null;
        }

        const data = await res.json();
        const profile: UserProfile = {
          id: data.id || data.userId || data.sub,
          username: data.username || "User",
          email: data.email,
        };
        setUser(profile);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(profile));
        return profile;
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
        return null;
      }
    },
    [accessToken, iamBaseUrl]
  );

  // Initialize state from localStorage on initial client mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedAccessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const savedRefreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
      const savedExpiresAt = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
      const savedClientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID);

      if (savedClientId) {
        setClientIdState(savedClientId);
      }

      if (savedAccessToken) {
        setAccessToken(savedAccessToken);
        setRefreshToken(savedRefreshToken);

        if (savedExpiresAt) {
          setTokenExpiresAt(parseInt(savedExpiresAt, 10));
        }

        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }

        // Verify token with backend
        fetchUserProfile(savedAccessToken);
      }
    } catch (e) {
      console.error("Error hydrating auth state:", e);
    } finally {
      setIsLoading(false);
    }
  }, [fetchUserProfile]);

  // Initiate OIDC Authorization Code Flow (Redirect to IAM /auth/authorize)
  const loginWithSSO = (customClientId?: string) => {
    if (typeof window === "undefined") return;

    const activeClientId = customClientId || clientId;
    const redirectUri = `${window.location.origin}/callback`;
    const state = Math.random().toString(36).substring(2) + Date.now().toString(36);

    sessionStorage.setItem(STORAGE_KEYS.OIDC_STATE, state);
    sessionStorage.setItem(STORAGE_KEYS.CLIENT_ID, activeClientId);

    const authorizeUrl = new URL(`${iamBaseUrl}/auth/authorize`);
    authorizeUrl.searchParams.set("client_id", activeClientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("state", state);

    window.location.href = authorizeUrl.toString();
  };

  // Exchange authorization code for tokens (POST /auth/token)
  const exchangeCode = async (code: string, returnedState: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const savedState = sessionStorage.getItem(STORAGE_KEYS.OIDC_STATE);
      const savedClientId = sessionStorage.getItem(STORAGE_KEYS.CLIENT_ID) || clientId;
      const redirectUri = `${window.location.origin}/callback`;

      if (savedState && returnedState !== savedState) {
        throw new Error("CSRF State mismatch detected. Authorization aborted.");
      }

      const res = await fetch(`${iamBaseUrl}/auth/token`, {
        method: "POST",
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
      setRefreshToken(data.refresh_token);
      setExpiresIn(data.expires_in);
      setTokenExpiresAt(expiresAtTimestamp);

      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
      localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, expiresAtTimestamp.toString());

      // Fetch user profile immediately
      await fetchUserProfile(data.access_token);

      // Clean up session storage
      sessionStorage.removeItem(STORAGE_KEYS.OIDC_STATE);

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
    if (!refreshToken) {
      setError("No refresh token available");
      return false;
    }

    try {
      const res = await fetch(`${iamBaseUrl}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refreshToken,
        }),
      });

      if (!res.ok) {
        throw new Error("Session expired or refresh token revoked. Please login again.");
      }

      const data = await res.json();
      const newAccessToken = data.accessToken || data.access_token;
      const expiresAtTimestamp = Date.now() + 15 * 60 * 1000; // default 15m

      setAccessToken(newAccessToken);
      setTokenExpiresAt(expiresAtTimestamp);
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newAccessToken);
      localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, expiresAtTimestamp.toString());

      await fetchUserProfile(newAccessToken);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Token refresh failed";
      setError(msg);
      // Auto logout on refresh failure
      await logout();
      return false;
    }
  };

  // Logout (POST /auth/logout)
  const logout = async () => {
    try {
      if (accessToken) {
        await fetch(`${iamBaseUrl}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({}),
        }).catch(() => {});
      }
    } finally {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      setExpiresIn(null);
      setTokenExpiresAt(null);
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        expiresIn,
        tokenExpiresAt,
        isLoading,
        error,
        clientId,
        setClientId,
        iamBaseUrl,
        setIamBaseUrl,
        loginWithSSO,
        exchangeCode,
        refreshAccessToken,
        fetchUserProfile,
        logout,
        clearError,
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
