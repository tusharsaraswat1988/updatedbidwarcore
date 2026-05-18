import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./routes";
import { logger } from "./lib/logger";
import { globalLimiter } from "./lib/rate-limiters";
import { pool } from "@workspace/db";

const app: Express = express();

const isProd = process.env.NODE_ENV === "production";

// Replit and most production setups run behind a reverse proxy.
// This tells Express to trust the X-Forwarded-For header so that
// rate limiting and secure cookies work correctly.
app.set("trust proxy", 1);

function buildAllowedOrigins(): string[] {
  const origins: string[] = [
    "https://bidwar.in",
    "https://www.bidwar.in",
  ];

  const replitDomains = process.env.REPLIT_DOMAINS ?? "";
  const replitDevDomain = process.env.REPLIT_DEV_DOMAIN ?? "";

  for (const d of replitDomains.split(",").filter(Boolean)) {
    origins.push(`https://${d.trim()}`);
  }
  if (replitDevDomain) {
    origins.push(`https://${replitDevDomain}`);
  }

  if (!isProd) {
    origins.push(
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:8080",
    );
  }

  return origins;
}

const allowedOrigins = buildAllowedOrigins();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin not allowed: ${origin}`));
    },
    credentials: true,
  }),
);

// Images are now stored as Cloudinary URLs (not base64), so JSON payloads
// are small. 1 MB is ample for all API request bodies.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

const sessionSecret = process.env.SESSION_SECRET;
if (isProd && !sessionSecret) {
  throw new Error("SESSION_SECRET must be set in production.");
}

const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "sessions",
    }),
    secret: sessionSecret ?? "bidwar-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

logger.info("Session store: PostgreSQL (persistent across restarts)");

// Global rate limiter — catches spam on all non-auction routes.
// Auction endpoints are automatically skipped inside globalLimiter
// so live bidding (2-3 req/sec) and polling (every 1s) are never throttled.
app.use(globalLimiter);

app.use("/api", router);

export default app;
