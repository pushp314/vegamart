/**
 * Type-safe API Client for Vegamart Go Backend (http://localhost:8080/api/v1).
 * Features automatic JWT Bearer token header injection and fallback error handling.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8080/api/v1"
    : "/api/v1");

export const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");

export const ACCESS_TOKEN_KEY = "vegamart_access_token";
export const REFRESH_TOKEN_KEY = "vegamart_refresh_token";
export const USER_STORAGE_KEY = "vegamart_user";
export const AUTH_SESSION_EVENT = "vegamart:auth-session";

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
  pagination?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface AuthSessionPayload<TUser = unknown> {
  access_token: string;
  refresh_token: string;
  user: TUser;
}

export const authStorage = {
  getAccessToken() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  saveSession<TUser>(session: AuthSessionPayload<TUser>) {
    if (typeof window === "undefined") return;
    localStorage.setItem(ACCESS_TOKEN_KEY, session.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session.user));
  },
  clearSession() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  },
};

class ApiClient {
  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (typeof window !== "undefined") {
      const token = authStorage.getAccessToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    allowRefresh = true,
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    try {
      const headers = {
        ...this.getHeaders(),
        ...options.headers,
      } as Record<string, string>;

      if (options.body instanceof FormData) {
        delete headers["Content-Type"];
      }

      const res = await fetch(url, {
        ...options,
        headers,
      });

      const json = await this.parseResponse<T>(res);
      if (res.status === 401 && allowRefresh && this.shouldRefresh(endpoint)) {
        const refreshed = await this.refreshSession();
        if (refreshed) {
          return this.request<T>(endpoint, options, false);
        }
      }

      return json;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[API] Connection error for ${endpoint}:`, errMsg);
      return {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message:
            "Unable to connect to Vegamart backend. Make sure the server is running on port 8080.",
        },
      };
    }
  }

  private async parseResponse<T>(res: Response): Promise<ApiResponse<T>> {
    const text = await res.text();
    if (!text) {
      return { success: res.ok } as ApiResponse<T>;
    }

    try {
      return JSON.parse(text) as ApiResponse<T>;
    } catch {
      return {
        success: false,
        error: {
          code: "INVALID_RESPONSE",
          message: "Backend returned a response that could not be parsed.",
        },
      };
    }
  }

  private shouldRefresh(endpoint: string) {
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const refreshSkipped = [
      "/auth/login",
      "/auth/register",
      "/auth/guest",
      "/auth/login/otp/send",
      "/auth/login/otp/verify",
      "/auth/refresh",
      "/auth/logout",
      "/auth/forgot-password",
      "/auth/reset-password",
      "/auth/google/url",
      "/auth/google/callback",
    ];

    return !!authStorage.getRefreshToken() && !refreshSkipped.some((authPath) => path.startsWith(authPath));
  }

  private async refreshSession() {
    const refreshToken = authStorage.getRefreshToken();
    if (!refreshToken) return false;

    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const json = await this.parseResponse<AuthSessionPayload>(res);

    if (res.ok && json.success && json.data?.access_token && json.data?.refresh_token) {
      authStorage.saveSession(json.data);
      window.dispatchEvent(new CustomEvent(AUTH_SESSION_EVENT, { detail: json.data }));
      return true;
    }

    authStorage.clearSession();
    return false;
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: "GET" });
  }

  post<T>(endpoint: string, data?: unknown) {
    const isFormData = data instanceof FormData;
    return this.request<T>(endpoint, {
      method: "POST",
      body: isFormData ? (data as FormData) : data ? JSON.stringify(data) : undefined,
    });
  }

  put<T>(endpoint: string, data?: unknown) {
    const isFormData = data instanceof FormData;
    return this.request<T>(endpoint, {
      method: "PUT",
      body: isFormData ? (data as FormData) : data ? JSON.stringify(data) : undefined,
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

export const api = new ApiClient();

// ── Vendor Status & Nearby APIs ────────────────────────────────────────────
export const toggleVendorStatus = (isOpen: boolean) =>
  api.put("/vendors/me/availability", { is_open: isOpen });

export const getNearbyVendors = (lat: number, lng: number, radiusKm = 5) =>
  api.get(`/vendors/nearby?lat=${lat}&lng=${lng}&radius=${radiusKm}`);

export const updateVendorLocation = (lat: number, lng: number) =>
  api.put("/vendors/me/location", { lat, lng });
