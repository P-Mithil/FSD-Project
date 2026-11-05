import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import app from "../api/index.js";

test("Vercel entry preserves API validation and prevents public response caching", async () => {
  const key = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = "deployment-test-placeholder";
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ["/api/analyze", "/api/jobs/match"]) {
      const res = await fetch(base + path, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      assert.equal(res.status, 400);
      assert.equal(res.headers.get("cache-control"), "no-store");
    }
    const jobs = await fetch(base + "/api/jobs?days=invalid");
    assert.equal(jobs.status, 400);
    const missing = await fetch(base + "/api/unknown");
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get("content-type"), /application\/json/);
  } finally {
    if (key === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = key;
    await new Promise(resolve => server.close(resolve));
  }
});

test("Vercel routes APIs before static assets and SPA fallback", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  const [api, files, spa] = config.routes;
  for (const path of ["/api/analyze", "/api/jobs", "/api/jobs/match"]) {
    assert.ok(new RegExp(`^${api.src}$`).test(path));
  }
  assert.equal(api.dest, "/api/index");
  assert.equal(files.handle, "filesystem");
  assert.equal(spa.dest, "/index.html");
  assert.equal(config.outputDirectory, "dist");
  assert.equal(config.buildCommand, "npm run build");
});
