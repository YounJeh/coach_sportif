import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import {
  normalizeDbError,
  dbErrorHttpStatus,
  dbErrorClientMessage,
} from "./lib/db-error.js";

const app = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: { id?: unknown; method?: string; url?: string }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: { statusCode?: number }) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const requestId = (req as express.Request & { id?: string }).id;
  const requestLogger =
    (req as express.Request & {
      log?: { error: (obj: unknown, message: string) => void };
    }).log ?? logger;
  const dbError = normalizeDbError(err);

  if (dbError) {
    requestLogger.error(
      {
        err,
        requestId,
        route: req.originalUrl,
        method: req.method,
        dbError,
      },
      "Request failed with database error",
    );

    if (!res.headersSent) {
      res.status(dbErrorHttpStatus(dbError.kind)).json({
        error: dbErrorClientMessage(dbError.kind),
        category: dbError.kind,
        requestId,
      });
    }
    return;
  }

  requestLogger.error(
    {
      err,
      requestId,
      route: req.originalUrl,
      method: req.method,
    },
    "Request failed with unhandled error",
  );

  if (!res.headersSent) {
    res.status(500).json({
      error: "Internal server error",
      category: "unknown",
      requestId,
    });
  }
});

export default app;
