import swaggerJSDoc from "swagger-jsdoc";

import { env, apiPrefix } from "./index";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: `${env.APP_NAME} API`,
      version: "1.0.0",
      description: [
        "REST API for the VegaMart hyperlocal marketplace.",
        "Connects customers, street vendors, delivery partners and administrators.",
        "",
        "## API versioning",
        "The API is served at `/api/v1/*`. The `API-Version` header is echoed on every response.",
        "",
        "## Rate limiting",
        "Global, auth, payment, upload, admin and vendor scoped limits apply. On exceeding a limit the API returns `429` with code `RATE_LIMITED`.",
        "",
        "## Caching",
        "Read-heavy endpoints (products, categories, vendors, settings, dashboard, analytics) are cached with a fallback in-memory store. Writes invalidate the relevant cache namespace.",
      ].join(" "),
      contact: {
        name: "VegaMart Team",
        email: "support@vegamart.in",
      },
      license: {
        name: "Proprietary",
      },
    },
    servers: [
      {
        url: `${env.APP_URL}${apiPrefix}`,
        description: `${env.NODE_ENV} server`,
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT access token issued at login/register.",
        },
        refreshCookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "refresh_token",
          description: "HTTP-only refresh token cookie.",
        },
      },
      responses: {
        Unauthorized: {
          description: "Access token missing, invalid or expired.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                success: false,
                error: {
                  code: "UNAUTHORIZED",
                  message: "Authentication required.",
                },
              },
            },
          },
        },
        Forbidden: {
          description: "Authenticated but missing required role/permission.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                success: false,
                error: { code: "FORBIDDEN", message: "Insufficient permissions." },
              },
            },
          },
        },
        NotFound: {
          description: "Resource not found.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                success: false,
                error: { code: "NOT_FOUND", message: "Resource not found." },
              },
            },
          },
        },
        ValidationError: {
          description: "Request failed validation.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
      },
      schemas: {
        ErrorDetail: {
          type: "object",
          properties: {
            code: { type: "string", example: "VALIDATION_ERROR" },
            message: { type: "string" },
            details: { type: "object", additionalProperties: { type: "string" } },
          },
        },
        ErrorResponse: {
          type: "object",
          required: ["success", "error"],
          properties: {
            success: { type: "boolean", example: false },
            error: { $ref: "#/components/schemas/ErrorDetail" },
          },
        },
        SuccessResponse: {
          type: "object",
          required: ["success", "data"],
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
            data: {},
          },
        },
        Pagination: {
          type: "object",
          properties: {
            page: { type: "number", example: 1 },
            per_page: { type: "number", example: 20 },
            total: { type: "number", example: 120 },
            total_pages: { type: "number", example: 6 },
            has_next: { type: "boolean", example: true },
            has_prev: { type: "boolean", example: false },
          },
        },
        PaginatedResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { type: "array", items: {} },
            pagination: { $ref: "#/components/schemas/Pagination" },
          },
        },
      },
    },
    tags: [
      { name: "Health", description: "System health & readiness checks (liveness, database, redis, storage, payment, email, system and aggregate)." },
      { name: "Monitoring", description: "Application metrics snapshot." },
      { name: "Auth", description: "Authentication & session management." },
      { name: "Users", description: "Self-service user profile & session management." },
      { name: "Categories", description: "Product categories and hierarchy (admin-managed)." },
      { name: "Vendors", description: "Vendor profiles, availability, location and admin review." },
      { name: "Products", description: "Product catalog and product images." },
      { name: "Inventory", description: "Vendor inventory management." },
      { name: "Search", description: "Search & autocomplete across products and vendors." },
      { name: "Cart", description: "Customer shopping cart." },
      { name: "Wishlist", description: "Customer wishlist." },
      { name: "Coupons", description: "Discount coupons (customer validate + admin management)." },
      { name: "Addresses", description: "Customer saved delivery addresses." },
      { name: "Checkout", description: "Checkout preview and order placement." },
      { name: "Payments", description: "Razorpay payments, verification, webhooks and refunds." },
      { name: "Orders", description: "Order lifecycle, timeline, invoices and status transitions." },
      { name: "Notifications", description: "In-app notifications." },
      { name: "Uploads", description: "File uploads to Cloudflare R2 storage." },
      { name: "Admin", description: "Administration: dashboard, users, vendors, delivery partners, reports, analytics, audit logs, settings and announcements." },
    ],
  },
  apis: ["src/routes/**/*.ts", "src/controllers/**/*.ts"],
};

export const swaggerSpec = swaggerJSDoc(options);
