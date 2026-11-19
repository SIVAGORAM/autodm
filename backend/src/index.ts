import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { env } from "./configs/env";
import { logger } from "./utils/logger";
import { prisma } from "./lib/prisma";
import { redisClient } from "./configs/redis";
import { setupRoutes } from "./routes";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import { startWorkers } from "./workers";

const app = express();

// ─── Security middleware ────────────────────────────────────────────
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(compression());
app.use(cookieParser(env.COOKIE_SECRET));

app.use(
  morgan("combined", {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);

// ─── Body parsers ───────────────────────────────────────────────────
app.use("/webhooks", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── ⭐ HEALTH ROUTE (VERY IMPORTANT) ────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "instagram-automation-backend",
    uptime: process.uptime(),
    time: new Date().toISOString(),
  });
});

// ─── Routes ─────────────────────────────────────────────────────────
setupRoutes(app);
app.use(notFound);
app.use(errorHandler);

// ─── Bootstrap ──────────────────────────────────────────────────────
async function bootstrap() {
  try {
    // Connect DB (retry safe)
    await prisma.$connect();
    logger.info("PostgreSQL connected");

    // Connect Redis
    await redisClient.ping();
    logger.info("Redis connected");

    // Start workers
    await startWorkers();
    logger.info("BullMQ workers started");

    // Start server
    const server = app.listen(env.PORT, () => {
      logger.info(
        `Server running on port ${env.PORT} [${env.NODE_ENV}]`
      );
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received. Shutting down...`);

      server.close(async () => {
        await prisma.$disconnect();
        await redisClient.quit();
        process.exit(0);
      });

      setTimeout(() => process.exit(1), 10000);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

    process.on("uncaughtException", async (err) => {
      logger.error("Uncaught Exception", err);
      await shutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled Rejection", reason);
    });
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
}

bootstrap();