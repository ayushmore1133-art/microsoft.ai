import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { router as apiRouter } from "./src/routes.js";
import { activeProvider } from "./src/anthropicClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Fail fast and clearly at startup instead of letting the first request run
// the (slow, rate-limited) pipeline and only then discover a missing key.
const PROVIDER_KEY_ENV = { gemini: "GEMINI_API_KEY", groq: "GROQ_API_KEY", anthropic: "ANTHROPIC_API_KEY" };
const requiredKeyEnv = PROVIDER_KEY_ENV[activeProvider];
if (requiredKeyEnv && !process.env[requiredKeyEnv]) {
  console.error(
    `\n[startup] LLM_PROVIDER is set to "${activeProvider}" but ${requiredKeyEnv} is missing from .env.\n` +
      `          Add it to .env before running the panel, or change LLM_PROVIDER to a provider you have a key for.\n`
  );
}

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Minimal request logging so a slow multi-step run (rate-limited Gemini calls
// can take ~2 min end-to-end) shows visible progress in the terminal instead
// of looking frozen.
app.use("/api", (req, res, next) => {
  const startedAt = Date.now();
  console.log(`[api] ${req.method} ${req.path} — started`);
  res.on("finish", () => {
    console.log(`[api] ${req.method} ${req.path} — ${res.statusCode} (${Date.now() - startedAt}ms)`);
  });
  next();
});

// Basic rate limiting on every /api/* route — the browser never holds the
// Anthropic key, so this also protects the server's own API budget.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 30 requests/minute/IP across the pipeline endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded. Please wait a moment and try again." },
});
app.use("/api", apiLimiter);

app.use("/api", apiRouter);

// Serve the frontend (index.html + assets) — kept visually untouched.
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Centralized error handler — must be registered last. Turns thrown errors
// (LLM timeouts, malformed JSON after retry, missing API key, etc.) into a
// clean JSON error the frontend can render as a clear error state.
app.use((err, req, res, next) => {
  console.error("[error]", err);
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(status).json({
    error: err.message || "Something went wrong on the server.",
    code: err.code || "UNKNOWN",
  });
});

export { app };

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () => {
    console.log(`InterviewIQ backend running at http://localhost:${PORT}`);
    console.log(`Using LLM_PROVIDER=${activeProvider}`);
  });
}
