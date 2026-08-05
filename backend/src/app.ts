import express, { Application, Request, Response } from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import path from "path";

import { env, apiPrefix } from "./config";
import { httpLogger } from "./config/morgan";
import { swaggerSpec } from "./config/swagger";
import { requestId } from "./middlewares/request-id";
import { corsMiddleware } from "./middlewares/cors";
import { securityHeaders, ipAbuseGuard } from "./middlewares/security";
import { apiVersion } from "./middlewares/version";
import { metricsMiddleware } from "./monitoring/metrics";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler";
import v1Routes from "./routes/v1";

const app: Application = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(securityHeaders);
app.use(requestId);
app.use(metricsMiddleware);
app.use(ipAbuseGuard);
app.use(corsMiddleware);
app.use(compression({ threshold: 1024 }));
app.use(express.json({
  limit: `${env.MAX_BODY_SIZE_MB}mb`,
  verify: (req, _res, buf) => { (req as { rawBody?: Buffer }).rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: `${env.MAX_BODY_SIZE_MB}mb` }));
app.use(cookieParser());
app.use(httpLogger);

const publicDir = path.resolve(process.cwd(), "public");
app.use(express.static(publicDir));

if (env.SWAGGER_ENABLED) {
  app.use(
    `${apiPrefix}/docs`,
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: `${env.APP_NAME} API Docs`,
      swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
    })
  );
}

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      name: env.APP_NAME,
      version: "1.0.0",
      docs: `${apiPrefix}/docs`,
      health: `${apiPrefix}/health`,
    },
  });
});

app.use(apiPrefix, apiVersion("v1"), v1Routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
