import express from "express";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import analyze from "../api/analyze.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "128kb" }));
  let retryAt = 0;

  // PDF.js already extracts PDFs in React. This endpoint receives only text.
  app.all("/api/analyze", async (req, res, next) => {
    if (req.method === "POST" && !req.is("application/json")) {
      return res
        .status(415)
        .json({
          error:
            "Send the resume and job description as JSON text, not file uploads.",
        });
    }
    const wait = Math.ceil((retryAt - Date.now()) / 1000);
    if (req.method === "POST" && wait > 0) {
      res.setHeader("Retry-After", String(wait));
      return res.status(429).json({ error: `Groq is rate-limited. Wait ${wait} seconds before trying again.` });
    }
    try {
      await analyze(req, res);
      if (res.statusCode === 429) {
        const seconds = Number(res.getHeader("Retry-After") ?? 60);
        retryAt = Date.now() + seconds * 1000;
      }
    } catch (err) {
      next(err);
    }
  });

  app.use((_req, res) =>
    res.status(404).json({ error: "Endpoint not found." }),
  );
  app.use((error, _req, res, _next) => {
    if (error.type === "entity.too.large") {
      return res
        .status(413)
        .json({ error: "The request is too large. Shorten the documents." });
    }
    if (error.type === "entity.parse.failed") {
      return res
        .status(400)
        .json({
          error: "Send valid JSON containing resumeText and jobDescription.",
        });
    }
    return res
      .status(500)
      .json({
        error:
          "The analysis service could not process this request. Please try again.",
      });
  });
  return app;
}

// Importing createApp in tests does not start a server or load real credentials.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const envPath = fileURLToPath(new URL("./.env", import.meta.url));
  if (existsSync(envPath)) loadEnvFile(envPath);
  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || "127.0.0.1";
  createApp()
    .listen(port, host, () => {
      console.log(`Resume Mate API running at http://${host}:${port}`);
    })
    .on("error", (error) => {
      console.error(`Could not start the API: ${error.code || "server error"}`);
      process.exitCode = 1;
    });
}
