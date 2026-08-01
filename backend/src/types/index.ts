export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  role_id: string;
  permissions: string[];
  vendor_id?: string | null;
  delivery_id?: string | null;
  is_verified: boolean;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, string>;
}

export interface ApiSuccessPayload<T> {
  success: true;
  message?: string;
  data: T;
  pagination?: PaginationMeta;
}

export interface ApiErrorPayload {
  success: false;
  error: ApiErrorDetail;
  requestId?: string;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginationOptions {
  page: number;
  per_page: number;
}

export interface CursorPaginationOptions {
  cursor?: string;
  limit: number;
}

export interface CursorMeta {
  has_next: boolean;
  next_cursor: string | null;
}

export interface ListQuery {
  page?: number;
  per_page?: number;
  sort?: string;
  order?: "asc" | "desc";
  q?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  category?: string;
  [key: string]: unknown;
}

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: string;
  type: "access";
  session_id?: string;
  guest?: boolean;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface JwtRefreshPayload {
  sub: string;
  session_id: string;
  token_id: string;
  type: "refresh";
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export type OrderByClause<T> = { [K in keyof T]?: "asc" | "desc" };

export type SearchableFields = "name" | "slug" | "description";

export interface GeoPoint {
  lat: number;
  lng: number;
}
