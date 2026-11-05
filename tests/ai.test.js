import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { createApp } from "../backend/server.js";
import { isAnalysisResult } from "../src/reviewAnalysis.js";

test("AI analysis validates input, returns the first valid result and respects cooldowns", async () => {
  const sample = JSON.parse(await readFile(new URL("./fixtures/analysis.json", import.meta.url), "utf8"));
  const facts = {
    criteria: Object.fromEntries(["required", "preferred", "projects", "experience"].map(category => [
      category, sample.analysis.criteria.filter(item => item.category === category),
    ])),
    annotations: sample.analysis.annotations,
  };
  const networkFetch = globalThis.fetch;
  const keys = { OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY, GROQ_API_KEY: process.env.GROQ_API_KEY, OPENROUTER_API_KE: process.env.OPENROUTER_API_KE };
  process.env.OPENROUTER_API_KEY = "router-test";
  process.env.GROQ_API_KEY = "groq-test";
  delete process.env.OPENROUTER_API_KE;
  let mode = "success";
  let calls = 0;
  let cancelled = false;
  globalThis.fetch = async (url, options) => {
    calls++;
    if (mode === "limited") return Response.json({}, { status: 429, headers: { "Retry-After": "30" } });
    if (mode === "failed") return Response.json({}, { status: 500 });
    if (url.includes("groq")) {
      if (mode === "malformed") {
        await new Promise(resolve => setTimeout(resolve, 15));
        return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(facts) } }] });
      }
      return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => {
        cancelled = true;
        reject(Object.assign(new Error("Cancelled"), { name: "AbortError" }));
      }, { once: true }));
    }
    await new Promise(resolve => setTimeout(resolve, 5));
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: mode === "malformed" ? "{}" : JSON.stringify(facts) } }] });
  };
  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}/api/analyze`;
  const input = { resumeText: sample.resumeText, jobDescription: sample.jobDescription };
  const post = (body = input, type = "application/json") => networkFetch(url, {
    method: "POST", headers: { "Content-Type": type }, body: typeof body === "string" ? body : JSON.stringify(body),
  });
  try {
    assert.equal((await networkFetch(url)).status, 405);
    for (const body of [{}, { ...input, resumeText: "x".repeat(15001) }, { resumeText: "same", jobDescription: "same" }, "{broken"]) {
      assert.equal((await post(body)).status, 400);
    }
    assert.equal((await post("file", "application/pdf")).status, 415);
    assert.equal((await post({ resumeText: "x".repeat(140000) })).status, 413);
    assert.equal(calls, 0);
    const res = await post();
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(isAnalysisResult(data, input.resumeText, input.jobDescription));
    assert.equal(data.matchScore, sample.analysis.matchScore);
    assert.ok(cancelled);
    assert.equal(calls, 2);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(isAnalysisResult({ ...data, matchScore: NaN }, input.resumeText, input.jobDescription), false);
    assert.equal(isAnalysisResult(data, "another resume", input.jobDescription), false);
    mode = "malformed";
    assert.ok(isAnalysisResult(await (await post()).json(), input.resumeText, input.jobDescription));
    mode = "failed";
    const failure = await post();
    assert.equal(failure.status, 502);
    assert.equal((await failure.json()).matchScore, undefined);
    mode = "limited";
    const before = calls;
    const limited = await post();
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("retry-after")) > 0);
    assert.equal((await post()).status, 429);
    assert.equal(calls, before + 2);
  } finally {
    globalThis.fetch = networkFetch;
    for (const [name, value] of Object.entries(keys)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await new Promise(resolve => server.close(resolve));
  }
});
