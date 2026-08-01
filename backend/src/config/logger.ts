import path from "path";
import fs from "fs";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

import { env, isProduction } from "./index";

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const logDir = path.resolve(process.cwd(), env.LOG_DIR);

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const consoleFormat = printf(
  ({ level, message, timestamp: ts, requestId, context, security_event, ...meta }) => {
    const req = requestId ? ` [${requestId}]` : "";
    const ctx = context ? ` ${String(context)}` : "";
    const sec = security_event ? ` [SECURITY]` : "";
    const extra = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    return `${ts} ${level}${sec}${req}${ctx}: ${String(message)}${extra}`;
  }
);

const jsonFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const baseTransports: winston.transport[] = [
  new winston.transports.Console({
    level: env.LOG_LEVEL,
    format: combine(
      colorize({ all: isProduction ? false : true }),
      timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      errors({ stack: true }),
      consoleFormat
    ),
  }),
];

// Daily rotation with retention (files kept for RETENTION_DAYS).
const dailyFile = new DailyRotateFile({
  filename: path.join(logDir, "app-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  level: "info",
  maxFiles: "14d",
  zippedArchive: !isProduction,
  format: jsonFormat,
});

const errorFile = new DailyRotateFile({
  filename: path.join(logDir, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  level: "error",
  maxFiles: "30d",
  zippedArchive: !isProduction,
  format: combine(timestamp(), errors({ stack: true }), json()),
});

// Emit security events to the dedicated security log via a filter.
const securityOnly = winston.format((info) => (info.security_event ? info : false));

const securityTransport = new DailyRotateFile({
  filename: path.join(logDir, "security-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  level: "info",
  maxFiles: "30d",
  zippedArchive: !isProduction,
  format: combine(securityOnly(), jsonFormat),
});

if (!isProduction) {
  baseTransports.push(
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
      level: "info",
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      format: jsonFormat,
    })
  );
}

baseTransports.push(dailyFile, errorFile);

export const logger = winston.createLogger({
  levels: winston.config.npm.levels,
  level: env.LOG_LEVEL,
  format: combine(errors({ stack: true })),
  transports: [...baseTransports, securityTransport],
  exitOnError: false,
});

export interface LoggerMeta {
  requestId?: string;
  context?: string;
  userId?: string;
  [key: string]: unknown;
}

export const log = {
  error: (message: string, meta?: LoggerMeta) => logger.error(message, meta),
  warn: (message: string, meta?: LoggerMeta) => logger.warn(message, meta),
  info: (message: string, meta?: LoggerMeta) => logger.info(message, meta),
  http: (message: string, meta?: LoggerMeta) => logger.http(message, meta),
  debug: (message: string, meta?: LoggerMeta) => logger.debug(message, meta),
  verbose: (message: string, meta?: LoggerMeta) => logger.verbose(message, meta),
  child: (defaultMeta: LoggerMeta) =>
    logger.child(defaultMeta) as unknown as typeof logger,
};

export default log;
