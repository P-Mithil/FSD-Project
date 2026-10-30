import express from "express";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJobHandlers } from "./jobs.js";

export function createApp(options) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "128kb" }));
  const jobs = createJobHandlers(options);
  app.get("/api/jobs", jobs.getJobs);
  app.post("/api/jobs/match", jobs.matchJobs);
  app.use((_req, res) => res.status(404).json({ error: "Endpoint not found." }));
  app.use((error, _req, res, _next) => {
    if (error.type === "entity.too.large") {
      return res.status(413).json({ error: "The request is too large. Shorten the resume." });
    }
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Send valid JSON containing resumeText and filters." });
    }
    return res.status(500).json({ error: "The jobs service could not process this request. Please try again." });
  });
  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || "127.0.0.1";
  createApp().listen(port, host, () => {
    console.log(`ResuMate Jobs API running at http://${host}:${port}`);
  }).on("error", (error) => {
    console.error(`Could not start the Jobs API: ${error.code || "server error"}`);
    process.exitCode = 1;
  });
}
