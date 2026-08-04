import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

import { loadEnv, loadEnvForTest } from "./env";

// Check if we're in test mode by checking NODE_ENV or if we're being loaded by Jest
const isTestEnvironment = process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined;

export const env = isTestEnvironment ? loadEnvForTest() : loadEnv();

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";

export const apiPrefix = `/api/${env.API_VERSION}`;
