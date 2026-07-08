import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  authApi,
  billingApi,
  type AuthUser,
  type PlanStatus,
  type LoginPayload,
  type SignupPayload,
  setStoredAccessToken,
  getStoredAccessToken,
  registerSessionExpiredHandler,
} from "./api";

interface AuthContextType {
  user: AuthUser | null;
  plan: PlanStatus | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserAndPlan: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORED_USER_KEY = "iap_user";

function getInitialUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORED_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getInitialUser);
  const [plan, setPlan] = useState<PlanStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUserAndPlan = useCallback(async () => {
    try {
      const [meRes, planRes] = await Promise.all([
        authApi.me(),
        billingApi.status().catch(() => null),
      ]);
      setUser(meRes.user);
      localStorage.setItem(STORED_USER_KEY, JSON.stringify(meRes.user));
      if (planRes) setPlan(planRes);
    } catch {
      // If fetching user fails, token may be invalid
      setUser(null);
      setPlan(null);
      localStorage.removeItem(STORED_USER_KEY);
      setStoredAccessToken(null);
    }
  }, []);

  useEffect(() => {
    // Register expired handler so 401 refresh failures clear state
    registerSessionExpiredHandler(() => {
      setUser(null);
      setPlan(null);
      localStorage.removeItem(STORED_USER_KEY);
    });

    // Check session on mount
    async function initAuth() {
      const token = getStoredAccessToken();
      if (token || document.cookie.includes("iap_refresh")) {
        try {
          await refreshUserAndPlan();
        } catch {
          // No active session
        }
      }
      setIsLoading(false);
    }

    initAuth();
  }, [refreshUserAndPlan]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const res = await authApi.login(payload);
      setStoredAccessToken(res.accessToken);
      setUser(res.user);
      localStorage.setItem(STORED_USER_KEY, JSON.stringify(res.user));
      try {
        const planRes = await billingApi.status();
        setPlan(planRes);
      } catch {
        // non-blocking
      }
    },
    []
  );

  const signup = useCallback(
    async (payload: SignupPayload) => {
      const res = await authApi.signup(payload);
      setStoredAccessToken(res.accessToken);
      setUser(res.user);
      localStorage.setItem(STORED_USER_KEY, JSON.stringify(res.user));
      try {
        const planRes = await billingApi.status();
        setPlan(planRes);
      } catch {
        // non-blocking
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      setStoredAccessToken(null);
      setUser(null);
      setPlan(null);
      localStorage.removeItem(STORED_USER_KEY);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        plan,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        signup,
        logout,
        refreshUserAndPlan,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
