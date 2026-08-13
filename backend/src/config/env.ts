import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const stringOrEmpty = z.string().optional().default("");

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production", "staging"])
      .default("development"),
    APP_NAME: z.string().default("VegaMart"),
    APP_PORT: z.coerce.number().int().positive().default(8080),
    APP_URL: z.string().url().default("http://localhost:8080"),
    API_VERSION: z.string().default("v1"),
    CLIENT_URL: z.string().url().default("http://localhost:3000"),

    DATABASE_URL: z
      .string()
      .regex(
        /^postgres(ql)?:\/\//,
        "DATABASE_URL must be a valid postgresql:// connection string"
      ),

    JWT_ACCESS_SECRET: z
      .string()
      .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
    JWT_ACCESS_SECRET_PREVIOUS: stringOrEmpty,
    JWT_REFRESH_SECRET_PREVIOUS: stringOrEmpty,
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
    JWT_ISSUER: z.string().default("vegamart"),
    JWT_AUDIENCE: z.string().default("vegamart-client"),

    COOKIE_SECURE: booleanFromString,
    COOKIE_SAME_SITE: z
      .enum(["lax", "strict", "none"])
      .default("lax"),

    MAX_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
    ACCOUNT_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
    EMAIL_VERIFICATION_REQUIRED: booleanFromString,
    VERIFY_EMAIL_TOKEN_TTL_HOURS: z.coerce.number().int().positive().default(24),
    OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(40),
    PAYMENT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
    PAYMENT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
    UPLOAD_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
    UPLOAD_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    ADMIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
    ADMIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
    VENDOR_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
    VENDOR_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),

    LOG_LEVEL: z
      .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
      .default("info"),
    LOG_DIR: z.string().default("logs"),

    REDIS_URL: stringOrEmpty,
    REDIS_PASSWORD: stringOrEmpty,
    REDIS_PREFIX: z.string().default("gali:"),

    CACHE_TTL_SECONDS_DEFAULT: z.coerce.number().int().positive().default(300),
    CACHE_TTL_PRODUCT: z.coerce.number().int().positive().default(300),
    CACHE_TTL_CATEGORY: z.coerce.number().int().positive().default(600),
    CACHE_TTL_VENDOR: z.coerce.number().int().positive().default(600),
    CACHE_TTL_SETTINGS: z.coerce.number().int().positive().default(600),
    CACHE_TTL_DASHBOARD: z.coerce.number().int().positive().default(120),
    CACHE_TTL_ANALYTICS: z.coerce.number().int().positive().default(300),

    PASSWORD_HISTORY_LIMIT: z.coerce.number().int().min(0).default(5),
    PASSWORD_EXPIRY_DAYS: z.coerce.number().int().min(0).default(0),
    LOGIN_DEVICE_THRESHOLD: z.coerce.number().int().positive().default(3),
    MAX_BODY_SIZE_MB: z.coerce.number().int().positive().default(2),
    MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(10),

    CRON_ENABLED: booleanFromString,
    NOTIFICATION_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
    TEMP_FILE_RETENTION_HOURS: z.coerce.number().int().positive().default(24),

    R2_ACCOUNT_ID: stringOrEmpty,
    R2_ACCESS_KEY_ID: stringOrEmpty,
    R2_SECRET_ACCESS_KEY: stringOrEmpty,
    R2_BUCKET_NAME: stringOrEmpty,
    R2_PUBLIC_URL: stringOrEmpty,

    RAZORPAY_KEY_ID: stringOrEmpty,
    RAZORPAY_KEY_SECRET: stringOrEmpty,
    RAZORPAY_WEBHOOK_SECRET: stringOrEmpty,

    SMTP_HOST: stringOrEmpty,
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: booleanFromString,
    SMTP_USER: stringOrEmpty,
    SMTP_PASSWORD: stringOrEmpty,
    SMTP_FROM: z.string().default("VegaMart <no-reply@vegamart.in>"),

    GOOGLE_CLIENT_ID: stringOrEmpty,
    GOOGLE_CLIENT_SECRET: stringOrEmpty,
    GOOGLE_REDIRECT_URI: stringOrEmpty,

    SWAGGER_ENABLED: booleanFromString,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production") {
      if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["R2_ACCOUNT_ID"],
          message: "Cloudflare R2 credentials are required in production",
        });
      }
      if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["RAZORPAY_KEY_ID"],
          message: "Razorpay credentials are required in production",
        });
      }
      if (env.JWT_ACCESS_SECRET === "change_me_access_secret_at_least_32_chars_long") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_ACCESS_SECRET"],
          message: "You must change the default JWT_ACCESS_SECRET in production",
        });
      }
      if (env.JWT_REFRESH_SECRET === "change_me_refresh_secret_at_least_32_chars_long") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_REFRESH_SECRET"],
          message: "You must change the default JWT_REFRESH_SECRET in production",
        });
      }
    }
    // In test environment, ensure required fields have defaults
    if (env.NODE_ENV === "test") {
      if (!env.DATABASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["DATABASE_URL"],
          message: "DATABASE_URL is required in test environment",
        });
      }
      if (!env.JWT_ACCESS_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_ACCESS_SECRET"],
          message: "JWT_ACCESS_SECRET is required in test environment",
        });
      }
      if (!env.JWT_REFRESH_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_REFRESH_SECRET"],
          message: "JWT_REFRESH_SECRET is required in test environment",
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `❌ Invalid environment variables — cannot start server.\n${issues}`
    );
  }
  return parsed.data;
}

export function loadEnvForTest(): Env {
  // For tests, provide defaults for required fields
  const testEnv = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/vegamart_test?schema=public",
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "test_access_secret_at_least_32_chars_long",
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "test_refresh_secret_at_least_32_chars_long",
    API_VERSION: process.env.API_VERSION || "v1",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    GOOGLE_REDIRECT_URI: "",
  };
  
  const parsed = envSchema.safeParse(testEnv);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `❌ Invalid environment variables — cannot start server.\n${issues}`
    );
  }
  return parsed.data;
}
