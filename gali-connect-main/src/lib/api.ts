/**
 * Type-safe API Client for VegaMart Node/Express Backend (http://localhost:8080/api/v1).
 * Features automatic JWT Bearer token header injection and fallback error handling.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8080/api/v1"
    : "/api/v1");

export const WS_BASE_URL = (() => {
  if (API_BASE_URL.startsWith("http")) {
    return API_BASE_URL.replace(/^http/, "ws");
  }
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${API_BASE_URL}`;
  }
  return API_BASE_URL;
})();

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

export function formatErrorMessage(
  error?: { code?: string; message?: string; details?: Record<string, string> } | null,
  fallback = "An unexpected error occurred",
): string {
  if (!error) return fallback;
  if (error.details && Object.keys(error.details).length > 0) {
    const detailList = Object.entries(error.details)
      .map(([field, msg]) => `${field.replace(/^body\./, "")}: ${msg}`)
      .join(" | ");
    return `${error.message || "Validation failed"}: ${detailList}`;
  }
  return error.message || fallback;
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

let refreshInFlight: Promise<boolean> | null = null;

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

      // Handle service unavailable gracefully
      if (res.status === 503) {
        const bodyText = await res.text();
        try {
          const body = JSON.parse(bodyText) as { maintenance?: boolean; message?: string };
          if (body && body.maintenance === true) {
            if (
              typeof window !== "undefined" &&
              !window.location.pathname.startsWith("/maintenance")
            ) {
              window.location.assign("/maintenance");
            }
            return {
              success: false,
              error: {
                code: "MAINTENANCE_MODE",
                message: body.message ?? "This site is currently undergoing maintenance.",
              },
            };
          }
        } catch {
          // fall through to the generic 503 handling below
        }
        return {
          success: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Backend service is not running. Please start the Node backend on port 8080.",
          },
        };
      }

      // Handle not found gracefully
      if (res.status === 404) {
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Resource not found.",
          },
        };
      }

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
            "Unable to connect to VegaMart backend. Make sure the server is running on port 8080.",
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

    return (
      !!authStorage.getRefreshToken() &&
      !refreshSkipped.some((authPath) => path.startsWith(authPath))
    );
  }

  private refreshSession(): Promise<boolean> {
    // Single-flight refresh: when several requests 401 at once (e.g. react-query
    // refetching on window focus), only one token rotation should hit the server.
    // Concurrent callers all await the same promise; otherwise the first rotation
    // revokes the refresh token and the rest fail and wipe the session.
    if (!refreshInFlight) {
      refreshInFlight = this.performRefresh().finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  }

  private async performRefresh() {
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
    window.dispatchEvent(new CustomEvent(AUTH_SESSION_EVENT, { detail: null }));
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

  patch<T>(endpoint: string, data?: unknown) {
    const isFormData = data instanceof FormData;
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: isFormData ? (data as FormData) : data ? JSON.stringify(data) : undefined,
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

export const api = new ApiClient();

export interface MaintenanceStatusPayload {
  maintenance: boolean;
  message: string | null;
}

export const checkMaintenanceStatus = () =>
  api.get<MaintenanceStatusPayload>("/system/maintenance/status");

// ── Vendor Status & Nearby APIs ────────────────────────────────────────────
export const toggleVendorStatus = (isOpen: boolean) =>
  api.put("/vendors/me/availability", { is_open: isOpen });

export const getNearbyVendors = (lat: number, lng: number, radiusKm = 5) =>
  api.get(`/vendors/nearby?lat=${lat}&lng=${lng}&radius=${radiusKm}`);

export const updateVendorLocation = (lat: number, lng: number) =>
  api.put("/vendors/me/location", { lat, lng });

// ── Vendor Daily Location APIs ────────────────────────────────────────────
export interface DailyLocationData {
  id: string;
  vendor_id: string;
  broadcast_date: string;
  area: string;
  landmark: string | null;
  address: string;
  latitude: number;
  longitude: number;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpsertDailyLocationPayload {
  area: string;
  landmark?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  start_time?: string | null;
  end_time?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export const getMyDailyLocation = () =>
  api.get<{
    vendor: { id: string; business_name: string; slug: string; roaming: boolean };
    location: DailyLocationData | null;
  }>("/vendors/me/daily-location");

export const upsertDailyLocation = (data: UpsertDailyLocationPayload) =>
  api.put<DailyLocationData>("/vendors/me/daily-location", data);

export const removeDailyLocation = () => api.delete("/vendors/me/daily-location");

export const getVendorDailyLocation = (vendorId: string) =>
  api.get<{
    vendor: {
      id: string;
      business_name: string;
      slug: string;
      category: string | null;
      logo_url: string | null;
      rating: number;
      review_count: number;
      is_verified: boolean;
      roaming: boolean;
    };
    location: DailyLocationData | null;
  }>(`/vendors/${vendorId}/daily-location`);

export const getNearbyDailyLocations = (lat: number, lng: number, radiusKm = 5) =>
  api.get(`/vendors/nearby/daily?lat=${lat}&lng=${lng}&radius=${radiusKm}`);

// ── Hero Slides (Admin) ──────────────────────────────────────────────
export interface HeroSlide {
  id: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  link_text: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface HeroSlideListResponse {
  rows: HeroSlide[];
  total: number;
  page: number;
  perPage: number;
}

export const getHeroSlides = () => api.get<HeroSlideListResponse>("/admin/hero-slides");

export const createHeroSlide = (data: {
  title: string;
  subtitle?: string;
  body?: string;
  image_url?: string;
  link_url?: string;
  link_text?: string;
  is_active?: boolean;
  sort_order?: number;
}) => api.post<HeroSlide>("/admin/hero-slides", data);

export const updateHeroSlide = (
  id: string,
  data: {
    title?: string;
    subtitle?: string;
    body?: string;
    image_url?: string;
    link_url?: string;
    link_text?: string;
    is_active?: boolean;
    sort_order?: number;
  },
) => api.patch<HeroSlide>(`/admin/hero-slides/${id}`, data);

export const deleteHeroSlide = (id: string) => api.delete(`/admin/hero-slides/${id}`);

export const publishHeroSlide = (id: string) => api.post(`/admin/hero-slides/${id}/publish`);

export const unpublishHeroSlide = (id: string) => api.post(`/admin/hero-slides/${id}/unpublish`);

// ── Featured Products ─────────────────────────────────────────────────
export interface FeaturedProductImage {
  id: string;
  url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
}

export interface FeaturedProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  mrp: number;
  images: FeaturedProductImage[];
  rating: number;
  review_count: number;
  is_featured: boolean;
}

export const getFeaturedProducts = () =>
  api.get<{ rows: FeaturedProduct[]; total: number }>("/products/featured");

// ── Maintenance Reminders (Admin) ──────────────────────────────────────
export interface MaintenanceTask {
  type: string;
  label: string;
  description: string;
  dev_note: string;
  severity: "critical" | "high" | "medium" | "low";
  cadence_days: number;
  done_at: string | null;
  due_at: string;
  status: "due" | "upcoming";
  overdue_days: number;
}

export interface MaintenanceStatus {
  baseline: string;
  contact: { contact_email: string | null; contact_phone: string | null };
  next_due_at: string | null;
  tasks: MaintenanceTask[];
}

export const getMaintenanceStatus = () => api.get<MaintenanceStatus>("/admin/maintenance");

export const completeMaintenanceTask = (type: string) =>
  api.post<MaintenanceStatus>(`/admin/maintenance/${encodeURIComponent(type)}/done`);

export const updateMaintenanceContact = (data: {
  contact_email?: string | null;
  contact_phone?: string | null;
}) => api.patch<MaintenanceStatus>("/admin/maintenance/contact", data);
