import React, { createContext, useContext, useState, useEffect } from "react";
import { api, authStorage, AUTH_SESSION_EVENT, type AuthSessionPayload } from "@/lib/api";

export type UserRole = "customer" | "vendor" | "admin" | "super_admin" | "delivery";

export const GUEST_USER_ID = "00000000-0000-0000-0000-000000000001";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatar_url?: string;
  is_verified: boolean;
  vendor_id?: string;
}

interface AuthContextType {
  user: User | null;
  role: UserRole;
  accessToken: string | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  login: (
    email: string,
    pass: string,
  ) => Promise<{ success: boolean; message?: string; role?: UserRole }>;
  register: (data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role?: UserRole;
  }) => Promise<{ success: boolean; message?: string; role?: UserRole }>;
  sendOTP: (email: string, purpose: string) => Promise<{ success: boolean; message?: string }>;
  verifyOTP: (
    email: string,
    otp: string,
    purpose: string,
  ) => Promise<{ success: boolean; message?: string; role?: UserRole }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message?: string }>;
  resetPassword: (
    email: string,
    otp: string,
    newPassword: string,
  ) => Promise<{ success: boolean; message?: string }>;
  updateProfile: (data: {
    name?: string;
    phone?: string;
    avatar_url?: string;
  }) => Promise<{ success: boolean; message?: string }>;
  getGoogleAuthUrl: () => Promise<string | null>;
  guestLogin: () => Promise<void>;
  googleLogin: (code: string) => Promise<{ success: boolean; message?: string; role?: UserRole }>;
  refreshSession: () => Promise<boolean>;
  logout: () => void;
  setRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const establishSession = (session: AuthSessionPayload<User>) => {
    authStorage.saveSession(session);
    setAccessToken(session.access_token);
    setUser(session.user);
  };

  useEffect(() => {
    // Restore session from localStorage and validate with backend
    const validateSession = async () => {
      try {
        const storedToken = localStorage.getItem("vegamart_access_token");
        if (storedToken) {
          setAccessToken(storedToken);
          // Fetch fresh user profile
          const res = await api.get<User>("/users/me");
          if (res.success && res.data) {
            setUser(res.data);
            localStorage.setItem("vegamart_user", JSON.stringify(res.data));
          } else {
            // Token invalid or expired
            setAccessToken(null);
            setUser(null);
            authStorage.clearSession();
          }
        }
      } catch (err) {
        console.error("Session validation failed:", err);
      } finally {
        setIsLoading(false);
      }
    };

    validateSession();

    // Sync React state when the API layer refreshes or clears the session
    const onSessionEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.access_token) {
        setAccessToken(detail.access_token);
        if (detail.user) {
          setUser(detail.user);
          localStorage.setItem("vegamart_user", JSON.stringify(detail.user));
        }
      } else {
        setAccessToken(null);
        setUser(null);
      }
    };
    window.addEventListener(AUTH_SESSION_EVENT, onSessionEvent);
    return () => window.removeEventListener(AUTH_SESSION_EVENT, onSessionEvent);
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    const res = await api.post<AuthSessionPayload<User>>("/auth/login", {
      email,
      password: pass,
    });
    setIsLoading(false);

    if (res.success && res.data) {
      establishSession(res.data);
      return { success: true, role: res.data.user?.role };
    }

    return { success: false, message: res.error?.message || "Invalid credentials" };
  };

  const register = async (data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role?: UserRole;
  }) => {
    setIsLoading(true);
    const res = await api.post<AuthSessionPayload<User>>("/auth/register", data);
    setIsLoading(false);

    if (res.success && res.data) {
      establishSession(res.data);
      return { success: true, role: res.data.user?.role };
    }

    return { success: false, message: res.error?.message || "Registration failed" };
  };

  const guestLogin = async () => {
    setIsLoading(true);
    try {
      const res = await api.post<AuthSessionPayload<User>>("/auth/guest", {});
      if (res.success && res.data) {
        establishSession(res.data);
      }
    } catch (err: any) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const sendOTP = async (email: string, purpose: string) => {
    const res = await api.post("/auth/login/otp/send", { email, purpose });
    return { success: res.success, message: res.message || res.error?.message };
  };

  const verifyOTP = async (email: string, otp: string, purpose: string) => {
    const res = await api.post<AuthSessionPayload<User>>("/auth/login/otp/verify", {
      email,
      otp,
      purpose,
    });
    if (res.success && res.data) {
      establishSession(res.data);
      return { success: true, role: res.data.user?.role };
    }

    return { success: false, message: res.error?.message || "Invalid OTP" };
  };

  const forgotPassword = async (email: string) => {
    const res = await api.post("/auth/forgot-password", { email });
    return { success: res.success, message: res.message || res.error?.message };
  };

  const resetPassword = async (email: string, otp: string, newPassword: string) => {
    const res = await api.post("/auth/reset-password", {
      email,
      otp,
      password: newPassword,
    });
    return { success: res.success, message: res.message || res.error?.message };
  };

  const updateProfile = async (data: { name?: string; phone?: string; avatar_url?: string }) => {
    const res = await api.put<User>("/users/me", data);
    if (res.success && res.data) {
      setUser(res.data);
      localStorage.setItem("vegamart_user", JSON.stringify(res.data));
      return { success: true };
    }
    return { success: false, message: res.error?.message || "Failed to update profile" };
  };

  const getGoogleAuthUrl = async () => {
    const res = await api.get<{ url: string }>("/auth/google/url");
    if (res.success && res.data?.url) {
      return res.data.url;
    }
    return null;
  };

  const googleLogin = async (code: string) => {
    setIsLoading(true);
    const res = await api.post<AuthSessionPayload<User>>("/auth/google/callback", {
      code,
    });
    setIsLoading(false);

    if (res.success && res.data) {
      establishSession(res.data);
      return { success: true, role: res.data.user?.role };
    }

    return { success: false, message: res.error?.message || "Google login failed" };
  };

  const refreshSession = async () => {
    const refreshToken = authStorage.getRefreshToken();
    if (!refreshToken) return false;

    const res = await api.post<AuthSessionPayload<User>>("/auth/refresh", {
      refresh_token: refreshToken,
    });
    if (res.success && res.data) {
      establishSession(res.data);
      return true;
    }
    authStorage.clearSession();
    setAccessToken(null);
    setUser(null);
    return false;
  };

  const logout = () => {
    api
      .post("/auth/logout", { refresh_token: authStorage.getRefreshToken() || "" })
      .catch(() => {});
    setUser(null);
    setAccessToken(null);
    authStorage.clearSession();
  };

  const setRole = (newRole: UserRole) => {
    if (user) {
      const updated = { ...user, role: newRole };
      setUser(updated);
      localStorage.setItem("vegamart_user", JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || "customer",
        accessToken,
        isAuthenticated: !!user,
        isGuest: user?.id === GUEST_USER_ID,
        isLoading,
        login,
        register,
        sendOTP,
        verifyOTP,
        forgotPassword,
        resetPassword,
        updateProfile,
        getGoogleAuthUrl,
        guestLogin,
        googleLogin,
        refreshSession,
        logout,
        setRole,
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
