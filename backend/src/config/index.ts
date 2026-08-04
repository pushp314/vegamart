import dotenv from "dotenv";
import path from "path";

import { loadEnv, loadEnvForTest } from "./env";

// Check if we're in test mode by checking NODE_ENV or if we're being loaded by Jest
const isTestEnvironment = process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined;

// Tests must not inherit developer credentials from a local .env file. Besides
// making test runs non-reproducible, this could accidentally call configured
// third-party services while exercising error paths.
if (!isTestEnvironment) {
  dotenv.config({
    path: path.resolve(process.cwd(), ".env"),
  });
}

export const env = isTestEnvironment ? loadEnvForTest() : loadEnv();

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";

export const apiPrefix = `/api/${env.API_VERSION}`;
