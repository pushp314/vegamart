// Set test environment variables before importing anything
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/gali_connect_test?schema=public";
process.env.JWT_ACCESS_SECRET = "test_access_secret_at_least_32_chars_long";
process.env.JWT_REFRESH_SECRET = "test_refresh_secret_at_least_32_chars_long";
process.env.API_VERSION = "v1";
process.env.MAINTENANCE_DEV_API_KEY = "test_dev_maintenance_api_key_123456";
process.env.MAINTENANCE_DEV_JWT_SECRET = "test_dev_maintenance_jwt_secret_at_least_32_chars";
process.env.MAINTENANCE_DEV_JWT_TTL_SECONDS = "60";
process.env.MAINTENANCE_DEV_IPS = "";
process.env.MAINTENANCE_DEV_RATE_LIMIT_WINDOW_MS = "60000";
process.env.MAINTENANCE_DEV_RATE_LIMIT_MAX = "20";
process.env.MAINTENANCE_CACHE_TTL_MS = "50";

import prisma from "../src/database/prisma";

afterAll(async () => {
  await prisma.$disconnect();
});
