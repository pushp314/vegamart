import http from "http";
import { AddressInfo } from "net";

import app from "./app";
import { env } from "./config";
import log from "./config/logger";
import { connectDatabase, disconnectDatabase } from "./database/connection";
import { startJobs, stopJobs } from "./jobs/scheduler";
import { initRealtime } from "./realtime/realtime";

const PORT = env.APP_PORT;

let server: http.Server;
let shuttingDown = false;

async function bootstrap(): Promise<void> {
  server = http.createServer(app);
  initRealtime(server);

  server.listen(PORT, () => {
    const address = server.address() as AddressInfo;
    log.info(`${env.APP_NAME} API started`, {
      context: "server",
      url: `http://localhost:${address.port}/api/${env.API_VERSION}`,
      docs: `http://localhost:${address.port}/api/${env.API_VERSION}/docs`,
      environment: env.NODE_ENV,
    });
  });

  try {
    await connectDatabase();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Database connection failed: ${message}`, { context: "database" });
    log.warn(
      "Server is still running, but database-backed endpoints will return 503. " +
        "Fix DATABASE_URL and run `npm run prisma:migrate` then restart."
    );
  }

  startJobs();

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      log.error(`Port ${PORT} is already in use.`, { context: "server" });
      process.exit(1);
    }
    throw error;
  });
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  log.info(`Received ${signal}, shutting down gracefully...`, { context: "server" });

  const forceExit = setTimeout(() => {
    log.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  if (server) {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeIdleConnections();
    });
  }

  try {
    await disconnectDatabase();
  } catch (error) {
    log.error("Error disconnecting database.", { context: "database", error });
  }

  stopJobs();

  log.info("Shutdown complete.");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  log.error("Unhandled promise rejection", {
    context: "process",
    reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : String(reason),
  });
});

process.on("uncaughtException", (error) => {
  log.error("Uncaught exception", {
    context: "process",
    error: { message: error.message, stack: error.stack },
  });
  process.exit(1);
});

void bootstrap();
