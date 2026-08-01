import { PrismaClient, Prisma } from "@prisma/client";

import { isDevelopment } from "../config";
import { recordDbQuery } from "../monitoring/metrics";

type PrismaClientWithEvents = PrismaClient<
  Prisma.PrismaClientOptions,
  "query" | "info" | "warn" | "error"
>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientWithEvents | undefined;
};

export function createPrismaClient(): PrismaClientWithEvents {
  const client = new PrismaClient({
    log: isDevelopment
      ? [
          { emit: "event", level: "query" },
          { emit: "event", level: "info" },
          { emit: "event", level: "warn" },
          { emit: "event", level: "error" },
        ]
      : [
          { emit: "event", level: "warn" },
          { emit: "event", level: "error" },
        ],
    errorFormat: "minimal",
  }) as PrismaClientWithEvents;

  client.$on("query", () => {
    recordDbQuery(false);
  });
  client.$on("error", () => {
    recordDbQuery(true);
  });

  return client;
}

export const prisma: PrismaClientWithEvents = globalForPrisma.prisma ?? createPrismaClient();

if (isDevelopment) {
  globalForPrisma.prisma = prisma;
}

export default prisma;
