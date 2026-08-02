import React, { createContext, useContext, useState, useEffect } from "react";
import { api, authStorage } from "@/lib/api";

export type UserRole = "customer" | "vendor" | "admin" | "super_admin" | "delivery";

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
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; message?: string }>;
  register: (data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role?: UserRole;
  }) => Promise<{ success: boolean; message?: string }>;
  sendOTP: (email: string, purpose: string) => Promise<{ success: boolean; message?: string }>;
  verifyOTP: (
    email: string,
    otp: string,
    purpose: string,
  ) => Promise<{ success: boolean; message?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message?: string }>;
  resetPassword: (
    email: string,
    otp: string,
    newPassword: string,
  ) => Promise<{ success: boolean; message?: string }>;
  updateProfile: (data: { name?: string; phone?: string; avatar_url?: string }) => Promise<{ success: boolean; message?: string }>;
  getGoogleAuthUrl: () => Promise<string | null>;
  guestLogin: () => Promise<void>;
  googleLogin: (code: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  setRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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
            localStorage.removeItem("vegamart_access_token");
            localStorage.removeItem("vegamart_user");
          }
        }
      } catch (err) {
        console.error("Session validation failed:", err);
      } finally {
        setIsLoading(false);
      }
    };

    validateSession();
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    const res = await api.post<{ access_token: string; user: User }>("/auth/login", {
      email,
      password: pass,
    });
    setIsLoading(false);

    if (res.success && res.data) {
      const token = res.data.access_token;
      const u = res.data.user;
      setAccessToken(token);
      setUser(u);
      localStorage.setItem("vegamart_access_token", token);
      localStorage.setItem("vegamart_user", JSON.stringify(u));
      return { success: true };
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
    const res = await api.post<{ access_token: string; user: User }>("/auth/register", data);
    setIsLoading(false);

    if (res.success && res.data) {
      const token = res.data.access_token;
      const u = res.data.user;
      setAccessToken(token);
      setUser(u);
      localStorage.setItem("vegamart_access_token", token);
      localStorage.setItem("vegamart_user", JSON.stringify(u));
      return { success: true };
    }

    return { success: false, message: res.error?.message || "Registration failed" };
  };

  const guestLogin = async () => {
    setIsLoading(true);
    try {
      const res = await api.post<{ access_token: string; user: User }>("/auth/guest", {});
      if (res.data) {
        localStorage.setItem("vegamart_access_token", res.data.access_token);
        setAccessToken(res.data.access_token);
        setUser(res.data.user);
        localStorage.setItem("vegamart_user", JSON.stringify(res.data.user));
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
    const res = await api.post<{ access_token: string; user: User }>("/auth/login/otp/verify", {
      email,
      otp,
      purpose,
    });
    if (res.success && res.data) {
      const token = res.data.access_token;
      const u = res.data.user;
      setAccessToken(token);
      setUser(u);
      localStorage.setItem("vegamart_access_token", token);
      localStorage.setItem("vegamart_user", JSON.stringify(u));
      return { success: true };
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
    const res = await api.post<{ access_token: string; user: User }>("/auth/google/callback", {
      code,
    });
    setIsLoading(false);

    if (res.success && res.data) {
      const token = res.data.access_token;
      const u = res.data.user;
      setAccessToken(token);
      setUser(u);
      localStorage.setItem("vegamart_access_token", token);
      localStorage.setItem("vegamart_user", JSON.stringify(u));
      return { success: true };
    }

    return { success: false, message: res.error?.message || "Google login failed" };
  };

  const logout = () => {
    api.post("/auth/logout", { refresh_token: authStorage.getRefreshToken() || "" }).catch(() => {});
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem("vegamart_access_token");
    localStorage.removeItem("vegamart_refresh_token");
    localStorage.removeItem("vegamart_user");
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
